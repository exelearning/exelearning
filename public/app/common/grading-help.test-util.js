import { afterEach, beforeEach, vi } from 'vitest';

// Keep Bootstrap at the boundary while exercising the real edition help handlers.
export function useGradingHelpHarness() {
  let instances;
  let previousLearning;
  let previousBootstrap;
  let init;
  let disposers;

  beforeEach(() => {
    instances = new Map();
    disposers = [];
    previousLearning = globalThis.eXeLearning;
    previousBootstrap = globalThis.bootstrap;
    globalThis.bootstrap = { Tooltip: { getInstance: (button) => instances.get(button) } };
    globalThis.eXeLearning = {
      ...previousLearning,
      app: {
        ...previousLearning?.app,
        common: {
          ...previousLearning?.app?.common,
          initTooltips: vi.fn((scope) => {
            scope.querySelectorAll('.exe-app-tooltip').forEach((button) => {
              if (!instances.has(button)) {
                instances.set(button, { hide: vi.fn(), dispose: vi.fn(() => instances.delete(button)) });
              }
            });
          }),
        },
      },
    };
    const common = $exeIDevicesEdition.iDevice.common;
    const initialize = common.initHelpTooltips;
    init = vi.spyOn(common, 'initHelpTooltips').mockImplementation((scope) => {
      const dispose = initialize(scope);
      if (dispose) disposers.push(dispose);
      return dispose;
    });
  });

  afterEach(() => {
    disposers.forEach((dispose) => dispose());
    init.mockRestore();
    globalThis.eXeLearning = previousLearning;
    globalThis.bootstrap = previousBootstrap;
  });

  return { instances: () => instances };
}
