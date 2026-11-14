import { afterEach, beforeEach, vi } from 'vitest';

// Exercise the real edition help handlers, and release the helps a test started without an edition around them.
export function useGradingHelpHarness() {
    let init;
    let disposers;

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
