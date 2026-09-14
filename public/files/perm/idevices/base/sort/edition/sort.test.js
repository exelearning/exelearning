/**
 * Edition lifecycle tests for the sort iDevice.
 *
 * Two resources here outlive the edition form: the audio preview created with
 * `new Audio()`, and the workarea-wide upload overlay that `lockScreen()` puts
 * up and a timer takes back down. Closing the editor mid-upload used to leave
 * the overlay covering the whole application with nothing left to remove it.
 */

/* eslint-disable no-undef */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Audio double: happy-dom's element cannot actually play anything. */
class FakeAudio {
    constructor(src) {
        FakeAudio.instances.push(this);
        this.src = src;
        this.pause = vi.fn();
        this.load = vi.fn();
        this.removeAttribute = vi.fn(() => {
            this.src = '';
        });
        this.play = vi.fn(() => Promise.resolve());
    }
}
FakeAudio.instances = [];

/**
 * Run `init()` far enough to register the edition's disposers. Building the
 * whole form needs edition helpers this harness does not provide, and none of
 * them is what these tests are about.
 */
function openEdition(device) {
    device.createForm = () => {};
    device.init(document.createElement('div'), {}, '');
}

describe('sort iDevice edition lifecycle', () => {
    let $exeDevice;
    let originalAudio;
    let originalMedia;

    beforeEach(() => {
        FakeAudio.instances = [];
        originalAudio = global.Audio;
        originalMedia = $exeDevices.iDevice.gamification.media;

        global.Audio = FakeAudio;
        window.Audio = FakeAudio;
        $exeDevices.iDevice.gamification.media = { extractURLGD: u => u };

        global.$exeDevice = undefined;
        $exeDevice = global.loadIdevice(join(__dirname, 'sort.js'));
    });

    afterEach(() => {
        if ($exeDevice && $exeDevice.$lifecycle) $exeDevice.$lifecycle.destroy();
        global.Audio = originalAudio;
        window.Audio = originalAudio;
        $exeDevices.iDevice.gamification.media = originalMedia;
        vi.useRealTimers();
    });

    describe('audio preview', () => {
        it('stops the preview when the edition closes', () => {
            $exeDevice.playSound('clip.mp3');
            const audio = FakeAudio.instances[0];
            expect(audio.play).toHaveBeenCalled();
            expect(audio.pause).not.toHaveBeenCalled();

            $exeDevice.$lifecycle.destroy();

            expect(audio.pause).toHaveBeenCalledTimes(1);
            expect(audio.removeAttribute).toHaveBeenCalledWith('src');
            expect(audio.load).toHaveBeenCalledTimes(1);
        });

        it('stops every preview the edition created', () => {
            $exeDevice.playSound('one.mp3');
            $exeDevice.playSound('two.mp3');

            $exeDevice.$lifecycle.destroy();

            expect(FakeAudio.instances).toHaveLength(2);
            FakeAudio.instances.forEach(audio => expect(audio.pause).toHaveBeenCalledTimes(1));
        });

        /**
         * The preview is rebuilt on every click. Owning each clip in the same
         * slot keeps one live `Audio` — and one disposer — per edition instead
         * of one per click, for as long as the author keeps the editor open.
         */
        it('releases the previous clip as soon as the next one starts', () => {
            $exeDevice.playSound('one.mp3');
            const first = FakeAudio.instances[0];

            $exeDevice.playSound('two.mp3');

            expect(first.pause).toHaveBeenCalledTimes(1);
            expect(first.removeAttribute).toHaveBeenCalledWith('src');
            expect(FakeAudio.instances[1].pause).not.toHaveBeenCalled();
        });

        it('keeps one media disposer however many clips are previewed', () => {
            $exeDevice.playSound('one.mp3');
            const afterFirst = $exeDevice.$lifecycle.disposers.length;

            $exeDevice.playSound('two.mp3');
            $exeDevice.playSound('three.mp3');

            expect($exeDevice.$lifecycle.slots.size).toBe(1);
            expect($exeDevice.$lifecycle.disposers.length).toBeLessThan(afterFirst + 3);
        });
    });

    describe('upload overlay', () => {
        let overlay;

        beforeEach(() => {
            vi.useFakeTimers();
            overlay = document.createElement('div');
            overlay.id = 'load-screen-node-content';
            overlay.className = 'hide hidden';
            document.body.appendChild(overlay);
        });

        it('hides the overlay after the fade delay while the edition is open', () => {
            $exeDevice.lockScreen();
            expect(overlay.classList.contains('loading')).toBe(true);
            expect(overlay.classList.contains('hidden')).toBe(false);

            $exeDevice.unlockScreen(2000);
            expect(overlay.classList.contains('hidding')).toBe(true);

            vi.advanceTimersByTime(400);

            expect(overlay.classList.contains('hide')).toBe(true);
            expect(overlay.classList.contains('hidden')).toBe(true);
            expect(overlay.classList.contains('hidding')).toBe(false);
            expect($exeDevice.screenLocked).toBe(false);
        });

        /**
         * The overlay belongs to the workarea, not to this form. If teardown simply
         * cancelled the fade-out timer the application would stay covered, so the
         * lifecycle restores it instead.
         */
        it('restores the overlay when the edition closes mid-upload', () => {
            openEdition($exeDevice);
            $exeDevice.lockScreen();
            expect(overlay.classList.contains('loading')).toBe(true);

            $exeDevice.$lifecycle.destroy();

            expect(overlay.classList.contains('hide')).toBe(true);
            expect(overlay.classList.contains('hidden')).toBe(true);
            expect(overlay.classList.contains('loading')).toBe(false);
            expect($exeDevice.screenLocked).toBe(false);
        });

        it('restores the overlay when the edition closes during the fade-out', () => {
            openEdition($exeDevice);
            $exeDevice.lockScreen();
            $exeDevice.unlockScreen(2000);
            expect(overlay.classList.contains('hidding')).toBe(true);

            $exeDevice.$lifecycle.destroy();

            expect(overlay.classList.contains('hidding')).toBe(false);
            expect(overlay.classList.contains('hidden')).toBe(true);
        });

        it('leaves an overlay this edition never locked alone', () => {
            openEdition($exeDevice);
            overlay.className = 'someone-elses-state';

            $exeDevice.$lifecycle.destroy();

            expect(overlay.className).toBe('someone-elses-state');
        });

        /**
         * The overlay is the workarea's own page loading screen. Teardown must
         * undo what this edition did to it, not force it hidden: a page switch
         * that tears an upload down while the page is loading would otherwise
         * uncover a page that is not ready yet.
         */
        it('puts the overlay back the way the upload found it', () => {
            openEdition($exeDevice);
            overlay.className = 'loading';
            overlay.setAttribute('style', 'z-index: 990;');

            $exeDevice.lockScreen();
            expect(overlay.style.position).toBe('fixed');

            $exeDevice.$lifecycle.destroy();

            expect(overlay.className).toBe('loading');
            expect(overlay.getAttribute('style')).toBe('z-index: 990;');
            expect($exeDevice.screenLocked).toBe(false);
        });

        it('drops the inline styles when the overlay had none', () => {
            openEdition($exeDevice);
            overlay.removeAttribute('style');

            $exeDevice.lockScreen();
            $exeDevice.$lifecycle.destroy();

            expect(overlay.hasAttribute('style')).toBe(false);
        });

        /**
         * A second lock during the same upload must not overwrite the state the
         * first one recorded, or unlocking would restore the locked overlay.
         */
        it('keeps the state recorded by the first lock', () => {
            openEdition($exeDevice);
            overlay.className = 'hide hidden';

            $exeDevice.lockScreen();
            $exeDevice.lockScreen();
            $exeDevice.$lifecycle.destroy();

            expect(overlay.className).toBe('hide hidden');
        });

        it('does not run the fade-out timer after the edition closed', () => {
            openEdition($exeDevice);
            const hide = vi.spyOn($exeDevice, 'hideLoadScreen');

            $exeDevice.lockScreen();
            $exeDevice.unlockScreen(2000);
            $exeDevice.$lifecycle.destroy();
            // One call comes from the teardown disposer; the timer must add nothing.
            const afterTeardown = hide.mock.calls.length;
            vi.advanceTimersByTime(10000);

            expect(hide.mock.calls.length).toBe(afterTeardown);
            hide.mockRestore();
        });

        it('never lets the fade-out timer drive a later iDevice', () => {
            const first = $exeDevice;
            openEdition(first);
            first.lockScreen();
            first.unlockScreen(2000);
            first.$lifecycle.destroy();

            const second = { hideLoadScreen: vi.fn() };
            global.$exeDevice = second;
            vi.advanceTimersByTime(10000);

            expect(second.hideLoadScreen).not.toHaveBeenCalled();
            global.$exeDevice = first;
        });
    });
});
