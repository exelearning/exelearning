import { afterEach, describe, expect, it, vi } from 'vitest';

globalThis._ = vi.fn((key) => key);
globalThis.c_ = vi.fn((key) => key);
globalThis.eXe = {
  app: {
    alert: vi.fn(),
    clearHistory: vi.fn(),
    _confirmResponses: {
      clear: vi.fn(),
    },
  },
};
globalThis.$exeTinyMCE = {
  init: vi.fn(),
};
globalThis.$exeDevice = {
  init: vi.fn(),
  save: vi.fn(() => '<div>Saved HTML</div>'),
  i18n: {
    en: { Test: 'Translated Test' },
  },
};
globalThis.top = {
  translations: {},
};
globalThis.tinymce = { majorVersion: 4 };
globalThis.eXeLearning = {
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
};

const $exeDevicesEdition = require('./common_edition.js');

describe('common_edition.js Electron gamification downloads', () => {
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
