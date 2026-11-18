import { afterEach, beforeEach, type MockInstance, vi } from 'vitest';

type Dispose = () => void;
type InitHelpTooltips = (element: Element | null) => Dispose | undefined;

// The edition library is a browser global, loaded before the tests run.
declare const $exeIDevicesEdition: { iDevice: { common: { initHelpTooltips: InitHelpTooltips } } };

// Exercise the real edition help handlers, and release the helps a test started without an edition around them.
export function useGradingHelpHarness() {
    let init: MockInstance<InitHelpTooltips>;
    let disposers: Dispose[];

    beforeEach(() => {
        disposers = [];
        const common = $exeIDevicesEdition.iDevice.common;
        const initialize = common.initHelpTooltips;
        init = vi.spyOn(common, 'initHelpTooltips').mockImplementation(scope => {
            const dispose = initialize(scope);
            if (dispose) disposers.push(dispose);
            return dispose;
        });
    });

    afterEach(() => {
        disposers.forEach(dispose => dispose());
        init.mockRestore();
    });
}
