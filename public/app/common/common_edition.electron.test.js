import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// `common_edition.js` only references these globals from inside function
// bodies (never at module load time), so requiring it at the top level is
// safe and matches the pattern used by `common_edition.test.js`.
const $exeDevicesEdition = require('./common_edition.js');

describe('common_edition.js Electron gamification downloads', () => {
  // Scope the global overrides to this describe block so we do not leak
  // mocks into sibling test files that share the same Vitest worker.
  // `vitest.setup.js` already provides most of these globals, but we still
  // shadow them with test-specific shapes to keep this file self-contained.
  const overrideFactories = {
    _: () => vi.fn((key) => key),
    c_: () => vi.fn((key) => key),
    eXe: () => ({
      app: {
        alert: vi.fn(),
        clearHistory: vi.fn(),
        _confirmResponses: {
          clear: vi.fn(),
        },
      },
    }),
    $exeTinyMCE: () => ({
      init: vi.fn(),
    }),
    $exeDevice: () => ({
      init: vi.fn(),
      save: vi.fn(() => '<div>Saved HTML</div>'),
      i18n: {
        en: { Test: 'Translated Test' },
      },
    }),
    top: () => ({
      translations: {},
    }),
    tinymce: () => ({ majorVersion: 4 }),
    eXeLearning: () => ({
      app: {
        api: {
          getGenerateQuestions: vi.fn(),
        },
        modals: {
          filemanager: {
            show: vi.fn(),
          },
        },
      },
    }),
  };

  const savedGlobals = new Map();

  beforeAll(() => {
    for (const [key, factory] of Object.entries(overrideFactories)) {
      savedGlobals.set(
        key,
        Object.prototype.hasOwnProperty.call(globalThis, key)
          ? { present: true, value: globalThis[key] }
          : { present: false }
      );
      try {
        globalThis[key] = factory();
      } catch (_e) {
        // Some globals (e.g. `top` in a real browser) may be read-only;
        // skip silently so the describe block can still run.
      }
    }
  });

  afterAll(() => {
    for (const [key, saved] of savedGlobals) {
      try {
        if (saved.present) {
          globalThis[key] = saved.value;
        } else {
          delete globalThis[key];
        }
      } catch (_e) {
        // Match the write-phase resilience above.
      }
    }
    savedGlobals.clear();
  });

  afterEach(() => {
    delete window.electronAPI;
    delete window.__currentProjectId;
    vi.restoreAllMocks();
  });

  it('gets the Electron API from the current window', () => {
    const fakeAPI = { saveBufferAs: vi.fn() };
    window.electronAPI = fakeAPI;

    expect($exeDevicesEdition.iDevice.gamification.share.getElectronAPI()).toBe(fakeAPI);
  });

  it('returns null when Electron API is unavailable', () => {
    expect($exeDevicesEdition.iDevice.gamification.share.getElectronAPI()).toBeNull();
  });

  it('uses saveBufferAs instead of a blob anchor download in Electron', async () => {
    const saveBufferAs = vi.fn().mockResolvedValue({ saved: true });
    window.electronAPI = { saveBufferAs };
    window.__currentProjectId = 'project-1';
    const urlSpy = vi.spyOn(window.URL, 'createObjectURL');

    const result = $exeDevicesEdition.iDevice.gamification.share.downloadBlob(
      new Blob(['hello'], { type: 'text/plain' }),
      'questions.txt',
      'missing-container'
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result).toBe(true);
    expect(saveBufferAs).toHaveBeenCalledTimes(1);
    const [payload, projectKey, suggestedName] = saveBufferAs.mock.calls[0];
    expect(payload).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(payload)).toBe('hello');
    expect(projectKey).toBe('project-1');
    expect(suggestedName).toBe('questions.txt');
    expect(urlSpy).not.toHaveBeenCalled();
  });
});
