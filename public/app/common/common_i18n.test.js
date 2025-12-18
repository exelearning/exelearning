import { beforeAll, describe, expect, it } from 'vitest';

describe('common_i18n.js', () => {
  beforeAll(async () => {
    // Load the script content and evaluate it in the global scope
    const fs = await import('fs');
    const path = await import('path');
    const scriptPath = path.resolve(__dirname, './common_i18n.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
    
    // (0, eval) ensures the code is evaluated in the global scope
    (0, eval)(scriptContent);
  });

  it('should define the global $exe_i18n object', () => {
    expect(globalThis.$exe_i18n).toBeDefined();
    expect(typeof globalThis.$exe_i18n).toBe('object');
  });

  it('should contain expected core translation keys', () => {
    const keys = [
      'previous', 'next', 'show', 'hide', 'showFeedback', 'hideFeedback',
      'correct', 'incorrect', 'menu', 'download', 'yourScoreIs', 'dataError',
      'epubJSerror', 'epubDisabled', 'solution', 'print', 'fullSearch',
      'noSearchResults', 'searchResults', 'hideResults', 'more', 'newWindow',
      'fullSize', 'search', 'accessibility_tools', 'close_toolbar',
      'default_font', 'increase_text_size', 'decrease_text_size', 'read',
      'stop_reading', 'translate', 'drag_and_drop', 'reset', 'mode_toggler',
      'teacher_mode'
    ];
    
    keys.forEach(key => {
      expect(globalThis.$exe_i18n).toHaveProperty(key);
      expect(typeof globalThis.$exe_i18n[key]).toBe('string');
    });
  });

  it('should define the exeGames sub-object', () => {
    expect(globalThis.$exe_i18n.exeGames).toBeDefined();
    expect(typeof globalThis.$exe_i18n.exeGames).toBe('object');
  });

  it('should contain expected game translation keys', () => {
    const gameKeys = [
      'hangManGame', 'accept', 'yes', 'no', 'right', 'wrong', 'rightAnswer',
      'stat', 'selectedLetters', 'word', 'words', 'play', 'playAgain',
      'results', 'total', 'otherWord', 'gameOver', 'confirmReload',
      'clickOnPlay', 'clickOnOtherWord', 'az'
    ];
    
    gameKeys.forEach(key => {
      expect(globalThis.$exe_i18n.exeGames).toHaveProperty(key);
      expect(typeof globalThis.$exe_i18n.exeGames[key]).toBe('string');
    });
  });

  it('should have the correct alphabet for hangman', () => {
    expect(globalThis.$exe_i18n.exeGames.az).toBe('abcdefghijklmnñopqrstuvwxyz');
  });
});
