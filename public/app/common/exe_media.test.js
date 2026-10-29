/**
 * Firefox binds the fullscreen change listener of every player to the document
 * (hasMozNativeFullScreen → globalBind), so leaving fullscreen anywhere reached
 * every player on the page. One that had never entered fullscreen ran
 * exitFullScreen() and read the never-assigned `docStyleOverflow`
 * (Sentry: "ReferenceError: docStyleOverflow is not defined").
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const code = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'exe_media', 'exe_media.js'), 'utf-8');

describe('exe_media fullscreen change listener', () => {
    let onChange;
    let player;

    beforeAll(() => {
        // happy-dom has no navigator.appName, which the feature sniffing reads.
        if (!navigator.appName) Object.defineProperty(navigator, 'appName', { value: 'Netscape', configurable: true });
        // eslint-disable-next-line no-eval
        (0, eval)(`${code}\n//# sourceURL=exe_media_eval.js`);
    });

    beforeEach(() => {
        Object.assign(window.mejs.MediaFeatures, {
            hasTrueNativeFullScreen: true,
            hasMozNativeFullScreen: true,
            fullScreenEventName: 'fullscreenchange',
            isFullScreen: () => false,
        });
        player = {
            isVideo: true,
            isFullScreen: false,
            id: 'player-1',
            options: { fullscreenText: 'Fullscreen' },
            media: { pluginType: 'native' },
            container: $('<div></div>'),
            globalBind: (event, handler) => {
                if (event === 'fullscreenchange') onChange = handler;
            },
            exitFullScreen: vi.fn(),
            setControlsSize: vi.fn(),
        };
        window.MediaElementPlayer.prototype.buildfullscreen.call(player, player, $('<div></div>'), null, null);
    });

    it('leaves a player that is not in fullscreen alone', () => {
        onChange();

        expect(player.exitFullScreen).not.toHaveBeenCalled();
    });

    it('takes its own player out of fullscreen', () => {
        player.isFullScreen = true;

        onChange();

        expect(player.exitFullScreen).toHaveBeenCalledTimes(1);
    });
});
