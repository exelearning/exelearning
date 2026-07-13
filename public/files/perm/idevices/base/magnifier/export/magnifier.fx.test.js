import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
  const modifiedCode = code.replace(/var\s+\$magnifier\s*=/, 'global.$magnifier =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$magnifier;
}

describe('magnifier iDevice FX export', () => {
  let magnifier;
  let originalIsInExe;

  beforeEach(() => {
    global.$magnifier = undefined;
    const code = readFileSync(join(__dirname, 'magnifier.js'), 'utf-8');
    magnifier = loadExportIdevice(code);

    document.body.innerHTML = '<div id="magnifier-test" class="idevice_node magnifier"></div>';

    originalIsInExe = global.eXe.app.isInExe;
    global.eXe.app.isInExe = vi.fn(() => false);
    global.$exeFX = { init: vi.fn() };
    global.$exeDevices = {
      iDevice: {
        gamification: {
          math: {
            hasLatex: vi.fn(() => false),
            updateLatex: vi.fn(),
          },
        },
      },
    };
    global.MojoMagnify = {};

    magnifier.transformObject = vi.fn(() => ({
      ideviceId: 'magnifier-test',
    }));
    magnifier.createInterfaceMagnifier = vi.fn(
      () => `
        <div class="exe-fx exe-tabs">
          <h2>One</h2><p>First tab</p>
          <h2>Two</h2><p>Second tab</p>
        </div>
      `
    );
    magnifier.addEvents = vi.fn();
  });

  afterEach(() => {
    global.eXe.app.isInExe = originalIsInExe;
    delete global.$exeFX;
    delete global.$exeDevices;
    delete global.MojoMagnify;
    delete global.$magnifier;
  });

  it('initializes FX after dynamically rendering the instructions', () => {
    magnifier.renderBehaviour({ ideviceId: 'magnifier-test' }, 0, 'magnifier-test');

    const root = document.getElementById('magnifier-test');
    expect(root.querySelector('.exe-fx.exe-tabs')).not.toBeNull();
    expect(global.$exeFX.init).toHaveBeenCalledTimes(1);
    expect(global.$exeFX.init).toHaveBeenCalledWith(root);
  });
});
