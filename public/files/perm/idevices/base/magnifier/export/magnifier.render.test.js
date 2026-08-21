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

describe('magnifier iDevice export rendering', () => {
  let magnifier;
  let originalIsInExe;

  beforeEach(() => {
    global.$magnifier = undefined;
    const code = readFileSync(join(__dirname, 'magnifier.js'), 'utf-8');
    magnifier = loadExportIdevice(code);

    document.body.innerHTML = '<div id="magnifier-test" class="idevice_node magnifier"></div>';

    originalIsInExe = global.eXe.app.isInExe;
    global.eXe.app.isInExe = vi.fn(() => false);
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

    magnifier.transformObject = vi.fn(() => ({ ideviceId: 'magnifier-test' }));
    magnifier.createInterfaceMagnifier = vi.fn(() => '<p class="rebuilt">Interface</p>');
    magnifier.addEvents = vi.fn();
  });

  afterEach(() => {
    global.eXe.app.isInExe = originalIsInExe;
    delete global.$exeDevices;
    delete global.MojoMagnify;
    delete global.$magnifier;
  });

  it('keeps the interface renderView already produced', () => {
    // renderView inserted magnifier.html, so the container is present. Rebuilding it
    // would discard the DOM the export engine has already processed. See #2170.
    const node = document.getElementById('magnifier-test');
    node.innerHTML = '<div class="exe-magnifier-container"><span id="rendered">Kept</span></div>';

    magnifier.renderBehaviour({ ideviceId: 'magnifier-test' }, 0, 'magnifier-test');

    expect(node.querySelector('#rendered')).not.toBeNull();
    expect(node.querySelector('.rebuilt')).toBeNull();
    expect(magnifier.createInterfaceMagnifier).not.toHaveBeenCalled();
  });

  it('builds the interface when the container is missing', () => {
    // The engine falls back to the bare '{content}' template when magnifier.html
    // cannot be loaded, so renderView returns markup without the container.
    const node = document.getElementById('magnifier-test');

    magnifier.renderBehaviour({ ideviceId: 'magnifier-test' }, 0, 'magnifier-test');

    expect(node.querySelector('.exe-magnifier-container')).not.toBeNull();
    expect(node.querySelector('.rebuilt')).not.toBeNull();
    expect(magnifier.createInterfaceMagnifier).toHaveBeenCalledTimes(1);
  });

  it('does not touch the DOM inside the editor', () => {
    global.eXe.app.isInExe = vi.fn(() => true);
    const node = document.getElementById('magnifier-test');
    node.innerHTML = '<span id="editor-content">Editor</span>';

    magnifier.renderBehaviour({ ideviceId: 'magnifier-test' }, 0, 'magnifier-test');

    expect(node.querySelector('#editor-content')).not.toBeNull();
    expect(magnifier.createInterfaceMagnifier).not.toHaveBeenCalled();
  });

  it('still wires the magnifier events', () => {
    magnifier.renderBehaviour({ ideviceId: 'magnifier-test' }, 0, 'magnifier-test');

    expect(magnifier.addEvents).toHaveBeenCalledTimes(1);
  });
});
