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
