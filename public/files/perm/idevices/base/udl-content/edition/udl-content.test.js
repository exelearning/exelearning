/**
 * Edition lifecycle tests for the udl-content iDevice.
 *
 * `loadPreviousValues()` listens on the node chrome around the form
 * (`#activeIdevice`) and on the icon image the style panel swaps in
 * (`#iconiDevice`). Neither lives inside the edition form, so emptying the form
 * never removed them: every re-open stacked another pair, and the icon `load`
 * event — which fires asynchronously — drove whichever iDevice happened to be
 * in the `$exeDevice` global at that moment.
 */

/* eslint-disable no-undef */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('udl-content iDevice edition lifecycle', () => {
    let $exeDevice;

    /** Build the node chrome the handlers target, outside any edition form. */
    const buildNodeChrome = () => {
        document.body.innerHTML = `
      <div id="activeIdevice">
        <button class="js-show-icon-panel-button" type="button"></button>
        <input type="text" />
      </div>
      <img id="iconiDevice" />
      <div id="udlContentTypeOptions"></div>
      <input type="radio" id="udlContentType-engagement" />
      <input type="radio" id="udlContentType-representation" />
      <input type="radio" id="udlContentType-expression" />`;
    };

    /** Run loadPreviousValues far enough to wire the chrome handlers. */
    const openEdition = device => {
        device.idevicePreviousData = '';
        device.jsonToForm = () => {};
        device.loadPreviousValues();
    };

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'udl-content.js'));
        buildNodeChrome();
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) $exeDevice.$lifecycle.destroy();
    });

    const selectIcon = filename => {
        document.querySelector('#activeIdevice .js-show-icon-panel-button').click();
        const icon = document.getElementById('iconiDevice');
        icon.src = `http://localhost/style/icon_${filename}`;
        $(icon).trigger('load');
    };

    it('switches the content type when an icon is picked while the edition is open', () => {
        const setActiveType = vi.spyOn($exeDevice, 'setActiveType').mockImplementation(() => {});
        openEdition($exeDevice);

        selectIcon('udl_eng_star.png');

        expect(setActiveType).toHaveBeenCalledWith('engagement');
        expect(document.getElementById('udlContentType-engagement').checked).toBe(true);
        setActiveType.mockRestore();
    });

    it('recognises representation and expression icons too', () => {
        const setActiveType = vi.spyOn($exeDevice, 'setActiveType').mockImplementation(() => {});
        openEdition($exeDevice);

        selectIcon('udl_rep_book.png');
        expect(setActiveType).toHaveBeenLastCalledWith('representation');

        selectIcon('udl_exp_pen.png');
        expect(setActiveType).toHaveBeenLastCalledWith('expression');
        setActiveType.mockRestore();
    });

    it('stops reacting to the icon panel once the edition closes', () => {
        const setActiveType = vi.spyOn($exeDevice, 'setActiveType').mockImplementation(() => {});
        openEdition($exeDevice);
        selectIcon('udl_eng_star.png');
        expect(setActiveType).toHaveBeenCalledTimes(1);

        $exeDevice.$lifecycle.destroy();
        selectIcon('udl_rep_book.png');

        expect(setActiveType).toHaveBeenCalledTimes(1);
        setActiveType.mockRestore();
    });

    it('never drives the iDevice that replaced this one', () => {
        const first = $exeDevice;
        openEdition(first);
        // Arm the icon handler, then close the editor before the image loads.
        document.querySelector('#activeIdevice .js-show-icon-panel-button').click();
        first.$lifecycle.destroy();

        const second = { setActiveType: vi.fn() };
        global.$exeDevice = second;
        const icon = document.getElementById('iconiDevice');
        icon.src = 'http://localhost/style/icon_udl_exp_pen.png';
        $(icon).trigger('load');

        expect(second.setActiveType).not.toHaveBeenCalled();
        global.$exeDevice = first;
    });

    it('leaves unrelated handlers on the same chrome elements alone', () => {
        openEdition($exeDevice);
        const onButton = vi.fn();
        const onIcon = vi.fn();
        $('#activeIdevice .js-show-icon-panel-button').on('click', onButton);
        $('#iconiDevice').on('load', onIcon);

        $exeDevice.$lifecycle.destroy();
        document.querySelector('#activeIdevice .js-show-icon-panel-button').click();
        $(document.getElementById('iconiDevice')).trigger('load');

        expect(onButton).toHaveBeenCalledTimes(1);
        expect(onIcon).toHaveBeenCalledTimes(1);
    });
});

describe('udl-content edition: shared form tabs', () => {
    const PATH = '/files/perm/idevices/base/udl-content/edition/';
    const panel = (name) => document.getElementById(`udlContentEditorWrapper-panel-${name}`);
    const saved =
        '<div class="exe-udlContent exe-udlContent-representation"><section class="exe-udlContent-block">' +
        '<div class="exe-udlContent-content"><div class="exe-udlContent-content-main">Main</div>' +
        '<article class="exe-udlContent-content-simplified js-hidden"><header class="exe-udlContent-alt-content-title">' +
        '<h2>Simple</h2></header>Easy<button class="exe-udlContent-alt-content-hide">Shut</button></article>' +
        '</div></section></div>';
    let device;
    let previousApp;
    let tooltips;

    beforeEach(() => {
        global.$exeDevice = undefined;
        previousApp = global.eXeLearning.app;
        tooltips = new Map();
        global.eXeLearning.app = {
            ...previousApp,
            common: {
                initTooltips: vi.fn((scope) => {
                    scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
                        if (!tooltips.has(button)) tooltips.set(button, { hide: vi.fn(), dispose: vi.fn() });
                    });
                }),
            },
        };
        vi.stubGlobal('bootstrap', { Tooltip: { getInstance: (button) => tooltips.get(button) } });
        // The block editors read and write their textareas, as TinyMCE does.
        vi.spyOn(global.tinymce, 'get').mockImplementation((id) => ({
            getContent: () => document.getElementById(id)?.value ?? '',
            setContent: (content) => {
                document.getElementById(id).value = content;
            },
        }));
        document.body.innerHTML = '<div id="activeIdevice"><input type="text" /></div><div id="udlBody"></div>';
        device = global.loadIdevice(join(__dirname, 'udl-content.js'));
    });

    afterEach(() => {
        device.$lifecycle?.destroy();
        global.eXeLearning.app = previousApp;
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        global.$exeDevice = undefined;
        document.body.innerHTML = '';
    });

    const open = (previousData = '') => device.init(document.getElementById('udlBody'), previousData, PATH);

    it('lays the form out in the shared tabs, and opens on the blocks', () => {
        open();
        const tabNames = [...document.querySelectorAll('#udlContentEditorWrapper-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );

        expect(tabNames).toEqual(['options', 'contents', 'texts']);
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab, with no share windows', () => {
        open();

        expect(panel('options').querySelectorAll('input[name="udlContentType"]')).toHaveLength(3);
        expect(panel('contents').querySelector('#udlContentFormAddBlock')).not.toBeNull();
        expect(panel('contents').querySelectorAll('.udlContentFormBlock')).toHaveLength(1);
        expect(panel('contents').firstElementChild.textContent).toContain('Write the content in blocks');
        expect(panel('texts').querySelector('#ci18n_simplified').value).toBe('Easier to read');
        expect(panel('texts').querySelector('#ci18n_hide').value).toBe('Close');
        expect(document.querySelectorAll('[data-exe-share]')).toHaveLength(0);
    });

    it('names the type group and explains it with an information button at the end of its row', () => {
        open();
        const group = document.getElementById('udlContentTypeOptions');
        const help = group.querySelector('.exe-idevice-help');

        expect(group.getAttribute('role')).toBe('radiogroup');
        expect(document.getElementById(group.getAttribute('aria-labelledby')).textContent).toBe('Type:');
        expect(panel('options').querySelectorAll('.exe-idevice-help')).toHaveLength(1);
        expect(group.lastElementChild.contains(help)).toBe(true);
        expect(help.getAttribute('aria-label')).toBe(help.title);
        help.click();
        document.getElementById(help.getAttribute('aria-controls')).click();
        expect(document.getElementById('udlContentType-engagement').checked).toBe(true);
    });

    it('colours the chosen type', () => {
        open();

        $('#udlContentType-expression').prop('checked', true).trigger('change');

        expect(document.querySelector('label[for="udlContentType-expression"]').classList.contains('active')).toBe(true);
        expect(document.querySelector('label[for="udlContentType-engagement"]').classList.contains('active')).toBe(false);
    });

    it('disposes the tooltips when the edition closes', () => {
        open();

        expect(tooltips.size).toBe(document.querySelectorAll('#udlContentEditorWrapper .exe-app-tooltip').length);
        expect(tooltips.size).toBeGreaterThanOrEqual(1);
        device.$lifecycle.destroy();
        for (const tooltip of tooltips.values()) {
            expect(tooltip.dispose).toHaveBeenCalledTimes(1);
        }
    });

    it('reopens and saves the type, the blocks and the custom texts', () => {
        open(saved);

        expect(document.getElementById('udlContentType-representation').checked).toBe(true);
        expect(document.getElementById('ci18n_simplified').value).toBe('Simple');
        expect(document.getElementById('ci18n_hide').value).toBe('Shut');
        expect(document.getElementById('udlContentFormTxt-0-0').value).toBe('Main');
        expect(document.getElementById('udlContentFormTxt-0-1').value).toBe('Easy');

        const html = device.save();

        expect(html).toContain('class="exe-udlContent exe-udlContent-representation"');
        expect(html).toContain('<div class="exe-udlContent-content-main">Main</div>');
        expect(html).toContain('<h2>Simple</h2></header>Easy');
        expect(html).toContain('<button class="exe-udlContent-alt-content-hide">Shut</button>');
    });
});
