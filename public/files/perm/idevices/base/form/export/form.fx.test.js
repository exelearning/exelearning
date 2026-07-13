import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
  const modifiedCode = code.replace(/var\s+\$form\s*=/, 'global.$form =');
  // eslint-disable-next-line no-eval
  (0, eval)(modifiedCode);
  return global.$form;
}

describe('form iDevice FX export', () => {
  let form;
  let intervalSpy;

  beforeEach(() => {
    global.$form = undefined;
    const code = readFileSync(join(__dirname, 'form.js'), 'utf-8');
    form = loadExportIdevice(code);

    document.body.innerHTML = `
      <div id="form-test">
        <div id="frmMainContainer-form-test">
          <div id="form-questions-form-test"></div>
          <div class="form-buttons-container"></div>
        </div>
      </div>
    `;

    intervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation(() => 1);
    global.$exeFX = { init: vi.fn() };
    global.$exeDevices = {
      iDevice: {
        gamification: {
          math: {
            hasLatex: vi.fn(() => false),
            updateLatex: vi.fn(),
          },
          report: {
            updateEvaluationIcon: vi.fn(),
          },
          scorm: {
            registerActivity: vi.fn(),
          },
        },
      },
    };

    form.updateConfig = vi.fn(() => ({
      id: 'form-test',
      questionsData: [{}],
      addBtnAnswers: false,
      showSlider: false,
      isScorm: 0,
      evaluation: false,
      evaluationID: '',
      msgs: {
        msgSingleSelectionHelp: '',
        msgMultipleSelectionHelp: '',
        msgDropdownHelp: '',
        msgTrueFalseHelp: '',
        msgFillHelp: '',
        msgSuggestion: '',
      },
    }));
    form.getHtmlFormView = vi.fn(
      () => `
        <div class="exe-fx exe-tabs">
          <h2>One</h2><p>First tab</p>
          <h2>Two</h2><p>Second tab</p>
        </div>
      `
    );
  });

  afterEach(() => {
    intervalSpy.mockRestore();
    delete global.$exeFX;
    delete global.$exeDevices;
    delete global.$form;
  });

  it('initializes FX after dynamically rendering the questions', () => {
    form.renderBehaviour({}, 0, 'form-test');

    const questionsContainer = document.getElementById('form-questions-form-test');
    expect(questionsContainer.querySelector('.exe-fx.exe-tabs')).not.toBeNull();
    expect(global.$exeFX.init).toHaveBeenCalledTimes(1);
    expect(global.$exeFX.init).toHaveBeenCalledWith(questionsContainer);
  });
});
