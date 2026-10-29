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

    it('lays the form out in Activities and Texts, with no Options tab', () => {
        open();
        const tabNames = [...document.querySelectorAll('#udlContentEditorWrapper-tabs [data-exe-tab]')].map((tab) =>
            tab.getAttribute('data-exe-tab')
        );

        expect(tabNames).toEqual(['contents', 'texts']);
        expect(panel('contents').classList.contains('active')).toBe(true);
    });

    it('puts each part of the form in its tab, with no share windows', () => {
        open();

        // The type leads the blocks, as in main.
        const form = panel('contents').querySelector('#udlContentForm');
        expect(form.firstElementChild.id).toBe('udlContentTypeOptions');
        expect(form.querySelectorAll('input[name="udlContentType"]')).toHaveLength(3);
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
        expect(panel('contents').querySelectorAll('.exe-idevice-help')).toHaveLength(1);
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

    it('keeps markup, literal angle brackets and quotes through a reopening', () => {
        open(
            '<div class="exe-udlContent exe-udlContent-engagement"><section class="exe-udlContent-block js-hidden">' +
                '<header class="exe-udlContent-header"><h2 style="display:none;">Say "hi"</h2></header>' +
                '<div class="exe-udlContent-content"><div class="exe-udlContent-content-main">' +
                '<p>Use the &lt;br&gt; tag</p></div></div></section></div>'
        );

        // The textarea used to decode the text into a real tag, and the quote
        // to end the value of the button text.
        expect(document.getElementById('udlContentFormTxt-0-0').value).toBe('<p>Use the &lt;br&gt; tag</p>');
        expect(document.getElementById('udlContentFormBlockButtonTxt-0').value).toBe('Say "hi"');

        const html = device.save();

        expect(html).toContain('<div class="exe-udlContent-content-main"><p>Use the &lt;br&gt; tag</p></div>');
        expect(html).toContain('<h2 style="display:none;">Say "hi"</h2>');
    });

    it('shows the presentation options as soon as a button text is pasted', () => {
        open();
        const input = document.getElementById('udlContentFormBlockButtonTxt-0');
        const options = document.getElementById('udlContentFormBlockButtonTxtOptions-0');
        expect(options.style.display).toBe('none');

        input.value = 'Read more';
        input.dispatchEvent(new Event('input', { bubbles: true }));

        expect(options.style.display).not.toBe('none');
    });
});

/**
 * Re-editing tests (#2646). The form used to be built by concatenating the saved
 * HTML inside the TEXTAREA markup, where the parser decodes character references:
 * escaped code (`&lt;div&gt;`) reached TinyMCE as real markup, and a quote in the
 * button text ended its value attribute.
 */
describe('udl-content iDevice edition form', () => {
    let $exeDevice;

    const contents = {
        main: '<pre><code>&lt;div class="box"&gt;Hola&lt;/div&gt;</code></pre>',
        simplified: '<p>&lt;b&gt;hola&lt;/b&gt;</p>',
        audio: '<p>a &lt; b &amp;&amp; c &gt; d</p>',
        visual: '<pre><code>&lt;/textarea&gt;</code></pre>',
    };

    /** One block as save() stores it, with its button header and four contents. */
    const savedBlock = ({ header = '', main, simplified, audio, visual }) => {
        const alt = (type, content) =>
            `<article class="exe-udlContent-content-${type} js-hidden">` +
            "<header class='exe-udlContent-alt-content-title'><h2>Title</h2></header>" +
            content +
            '<button class="exe-udlContent-alt-content-hide">Hide</button></article>';
        return (
            '<div class="exe-udlContent exe-udlContent-engagement">' +
            `<section class="exe-udlContent-block js-hidden">${header}` +
            '<div class="exe-udlContent-content">' +
            `<div class="exe-udlContent-content-main">${main}</div>` +
            alt('simplified', simplified) +
            alt('audio', audio) +
            alt('visual', visual) +
            '</div></section></div>'
        );
    };

    /** Open the edition of a saved iDevice and return its first block form. */
    const openEdition = previousData => {
        $exeDevice.idevicePreviousData = previousData;
        $exeDevice.loadPreviousValues();
        return $('#udlContentFormBlock-0');
    };

    beforeEach(() => {
        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'udl-content.js'));
        $exeDevice.idevicePath = '/udl-content/';
        document.body.innerHTML = '<div id="udlContentFormBlocks"></div>';
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) $exeDevice.$lifecycle.destroy();
    });

    it('keeps escaped code as code in every content tab', () => {
        openEdition(savedBlock(contents));

        expect($('#udlContentFormTxt-0').val()).toBe(contents.main);
        expect($('#udlContentFormTxt-0-0').val()).toBe(contents.main);
        expect($('#udlContentFormTxt-0-1').val()).toBe(contents.simplified);
        expect($('#udlContentFormTxt-0-2').val()).toBe(contents.audio);
        expect($('#udlContentFormTxt-0-3').val()).toBe(contents.visual);
    });

    it('keeps a quote and markup-like text in the button text', () => {
        const header =
            '<header class="exe-udlContent-header"><h2 style="display:none;">' +
            '<span class="sr-av">Read "more" </span>Show &lt;code&gt;</h2></header>';
        const block = openEdition(savedBlock({ ...contents, header }));

        expect(block.find("input[type='text']").val()).toBe('Read "more" | Show <code>');
        const explanation = block.find('.udlContentFormBlockButtonTxtExplanation span');
        expect(explanation.eq(0).text()).toBe('Read "more" ');
        expect(explanation.eq(1).text()).toBe(' Show <code>');
    });

    it('keeps the form intact when the content holds a real TEXTAREA', () => {
        const visual = '<p>a</p><textarea>x</textarea><p>b</p>';
        const block = openEdition(savedBlock({ ...contents, visual }));

        expect($('#udlContentFormTxt-0-3').val()).toBe(visual);
        expect(block.find('textarea')).toHaveLength(5);
        // Nothing of the content leaks out of its field into the form
        expect(block.find('.udlContentFormBlockTxt > p')).toHaveLength(0);
    });

    it('saves again the same contents and button text it loaded', () => {
        const header =
            '<header class="exe-udlContent-header"><h2 style="display:none;">Open "the code"</h2></header>';
        openEdition(savedBlock({ ...contents, header }));
        // TinyMCE hands back the content of the TEXTAREA it was started on
        const get = vi
            .spyOn(tinymce, 'get')
            .mockImplementation(id => ({ getContent: () => document.getElementById(id).value }));

        const [block] = $exeDevice.formToJSON();
        get.mockRestore();

        expect(block).toMatchObject({
            btnTxt: 'Open "the code"',
            contMain: contents.main,
            contAlt1: contents.simplified,
            contAlt2: contents.audio,
            contAlt3: contents.visual,
        });
    });
});
