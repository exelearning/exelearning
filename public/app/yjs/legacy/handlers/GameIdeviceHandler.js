/**
 * GameIdeviceHandler
 *
 * Handles modern game iDevices (JsIdevice) that store their data in HTML divs.
 * Extracts game data from *-DataGame divs in the htmlView.
 *
 * Supported game types:
 * - flipcards (plain JSON in flipcards-DataGame)
 * - selecciona (XOR-encrypted JSON in selecciona-DataGame)
 * - trivial, crossword, etc. (same pattern)
 *
 * The game data may be:
 * - Plain JSON: {"typeGame":"FlipCards",...}
 * - XOR-encrypted: %E9%B0%F3... (key=146)
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class GameIdeviceHandler extends BaseLegacyHandler {
  /**
   * Game types and their DataGame div class patterns
   * Maps game type to the class name used in the DataGame div
   */
  static GAME_PATTERNS = {
    'flipcards': 'flipcards-DataGame',
    'selecciona': 'selecciona-DataGame',
    'selecciona-activity': 'selecciona-DataGame',
    'trivial': 'trivial-DataGame',
    'crossword': 'crossword-DataGame',
    'relate': 'relate-DataGame',
    'relaciona': 'relaciona-DataGame',
    'identify': 'identify-DataGame',
    'discover': 'discover-DataGame',
    'complete': 'complete-DataGame',
    'classify': 'classify-DataGame',
    'guess': 'guess-DataGame',
    'sort': 'sort-DataGame',
    'puzzle': 'puzzle-DataGame',
    'beforeafter': 'beforeafter-DataGame',
    'word-search': 'word-search-DataGame',
    'hidden-image': 'hidden-image-DataGame',
    'mathproblems': 'mathproblems-DataGame',
    'mathematicaloperations': 'mathematicaloperations-DataGame',
    'padlock': 'padlock-DataGame',
    'challenge': 'challenge-DataGame',
    'checklist': 'checklist-DataGame',
    'quick-questions': 'quick-questions-DataGame',
    'az-quiz-game': 'az-quiz-game-DataGame',
    'dragdrop': 'dragdrop-DataGame',
    'trueorfalse': 'trueorfalse-DataGame',
    // Spanish legacy names (mapped to English installed iDevice types)
    // From OdeXmlUtil.php type detection
    'mapa': 'mapa-DataGame',
    'rosco': 'rosco-DataGame',
    'videoquext': 'videoquext-DataGame',
    'vquext': 'vquext-DataGame',
    'quext': 'quext-DataGame',
    'desafio': 'desafio-DataGame',
    'candado': 'candado-DataGame',
    'adivina': 'adivina-DataGame',
    'clasifica': 'clasifica-DataGame',
    'completa': 'completa-DataGame',
    'descubre': 'descubre-DataGame',
    'identifica': 'identifica-DataGame',
    'sopa': 'sopa-DataGame',
    'ordena': 'ordena-DataGame',
    'seleccionamedias': 'seleccionamedias-DataGame',
    'listacotejo': 'listacotejo-DataGame',
    'informe': 'informe-DataGame',
    'crucigrama': 'crucigrama-DataGame',
  };

  /**
   * Games that use XOR encryption for their data
   * Most games use plain JSON, these specific ones use encryption
   */
  static ENCRYPTED_GAMES = [
    'selecciona',
    'selecciona-activity',
    'trivial',
    'identify',
    'discover',
    'complete',
    'classify',
    'guess',
    'sort',
    'puzzle',
    'relate',
    'relaciona',
    'hidden-image',
    'mathematicaloperations',
    'padlock',
    'challenge',
    'quick-questions',
    'az-quiz-game',
    'dragdrop',
    'trueorfalse',
    'mathproblems',
    'word-search',
    'checklist',
    // Spanish legacy names that use encryption
    'rosco',
    'videoquext',
    'vquext',
    'quext',
    'desafio',
    'candado',
    'adivina',
    'clasifica',
    'completa',
    'descubre',
    'identifica',
    'sopa',
    'ordena',
    'listacotejo',
    'informe',
    'crucigrama',
    // Note: 'mapa' is NOT encrypted - it uses plain JSON like flipcards
    // Note: 'seleccionamedias' may not use encryption
  ];

  /**
   * Maps detected game types to their installed iDevice types
   * Legacy ELPs use Spanish names, but installed iDevices use English names
   * Based on mappings from src/shared/export/constants.ts and OdeXmlUtil.php
   */
  static TYPE_MAP = {
    // Spanish → English mappings (must match installed iDevice css-class)
    // Based on OdeXmlUtil.php type detection
    'selecciona': 'quick-questions-multiple-choice',
    'trivial': 'quick-questions',
    'mapa': 'map',
    'rosco': 'az-quiz-game',
    'videoquext': 'quick-questions-video',
    'vquext': 'quick-questions-video',
    'quext': 'quick-questions',
    'desafio': 'challenge',
    'candado': 'padlock',
    'adivina': 'guess',
    'clasifica': 'classify',
    'completa': 'complete',
    'descubre': 'discover',
    'identifica': 'identify',
    'sopa': 'word-search',
    'ordena': 'sort',
    'seleccionamedias': 'select-media-files',
    'listacotejo': 'checklist',
    'informe': 'progress-report',
    'crucigrama': 'crossword',
    // These map to themselves (already correct)
    'flipcards': 'flipcards',
    'crossword': 'crossword',
    'relate': 'relate',
    'relaciona': 'relate',
    'identify': 'identify',
    'discover': 'discover',
    'complete': 'complete',
    'classify': 'classify',
    'guess': 'guess',
    'sort': 'sort',
    'puzzle': 'puzzle',
    'beforeafter': 'beforeafter',
    'word-search': 'word-search',
    'hidden-image': 'hidden-image',
    'mathproblems': 'mathproblems',
    'mathematicaloperations': 'mathematicaloperations',
    'padlock': 'padlock',
    'challenge': 'challenge',
    'checklist': 'checklist',
    'quick-questions': 'quick-questions',
    'quick-questions-multiple-choice': 'quick-questions-multiple-choice',
    'quick-questions-video': 'quick-questions-video',
    'az-quiz-game': 'az-quiz-game',
    'map': 'map',
    'dragdrop': 'dragdrop',
    'trueorfalse': 'trueorfalse',
    'select-media-files': 'select-media-files',
    'progress-report': 'progress-report',
  };

  // Track detected game type for getTargetType()
  _detectedType = null;

  /**
   * Check if this handler can process the given legacy class
   * Handles JsIdevice types with game data
   * @param {string} className - Legacy class name (e.g., 'exe.engine.jsidevice.JsIdevice')
   * @param {string} ideviceType - iDevice type from _iDeviceDir (e.g., 'flipcards-activity')
   */
  canHandle(className, ideviceType) {
    // Check if it's a JsIdevice with a known game type
    const gameTypes = Object.keys(GameIdeviceHandler.GAME_PATTERNS);

    // Check className first (for backwards compatibility)
    if (gameTypes.some(type => className.toLowerCase().includes(type.toLowerCase()))) {
      return true;
    }

    // Check ideviceType (e.g., 'flipcards-activity' matches 'flipcards')
    if (ideviceType) {
      const normalizedType = ideviceType.replace(/-activity$/, '');
      if (gameTypes.includes(normalizedType)) {
        // Pre-set _detectedType so getTargetType() works even if extractProperties fails
        this._detectedType = normalizedType;
        return true;
      }
    }

    return false;
  }

  /**
   * Get the target modern iDevice type
   * Returns the detected game type mapped to its installed iDevice type
   */
  getTargetType() {
    if (this._detectedType) {
      // Normalize type names (remove -activity suffix)
      const normalized = this._detectedType.replace(/-activity$/, '');
      // Map to installed iDevice type (e.g., selecciona → quick-questions-multiple-choice)
      return GameIdeviceHandler.TYPE_MAP[normalized] || normalized;
    }
    return 'text';
  }

  /**
   * Extract HTML content from dictionary (game iDevices store HTML in fields list)
   * Also updates the DataGame div with decrypted/parsed JSON for proper rendering
   * @param {Element} dict - Dictionary element
   * @returns {string} HTML content with updated DataGame div
   */
  extractHtmlView(dict) {
    if (!dict) return '';

    const contents = [];
    const children = Array.from(dict.children);

    // Find "fields" key and its list (JsIdevice format)
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === 'fields') {
        const listEl = children[i + 1];
        if (listEl && listEl.tagName === 'list') {
          // Extract content from each field in the list
          const fieldInstances = Array.from(listEl.children).filter(
            el => el.tagName === 'instance'
          );

          for (const fieldInst of fieldInstances) {
            const fieldClass = fieldInst.getAttribute('class') || '';
            // Process TextAreaField and TextField
            if (fieldClass.includes('TextAreaField') || fieldClass.includes('TextField')) {
              const content = this.extractTextAreaFieldContent(fieldInst);
              if (content) {
                contents.push(content);
              }
            }
          }
        }
        break;
      }
    }

    let html = contents.join('\n');

    // Update the DataGame div with decrypted/parsed JSON for proper rendering
    // This is crucial because the export script expects plain JSON in the DataGame div
    html = this.updateDataGameDivInHtml(html);

    return html;
  }

  /**
   * Update the DataGame div in HTML with decrypted/parsed JSON
   *
   * IMPORTANT: Only updates NON-encrypted games (like flipcards).
   * For encrypted games (selecciona, trivial, etc.), the DataGame div
   * content is left as-is because the export script expects encrypted data
   * and will decrypt it at runtime.
   *
   * - Non-encrypted games: Export script reads plain JSON directly
   * - Encrypted games: Export script calls decrypt() on the content
   *
   * @param {string} html - HTML content
   * @returns {string} Updated HTML (only for non-encrypted games)
   */
  updateDataGameDivInHtml(html) {
    if (!html) return html;

    // Find which game type this is and update its DataGame div
    for (const [gameType, divClass] of Object.entries(GameIdeviceHandler.GAME_PATTERNS)) {
      const gameData = this.extractGameDataFromHtml(html, divClass);
      if (gameData !== null) {
        // Check if this game uses encryption
        const isEncrypted = GameIdeviceHandler.ENCRYPTED_GAMES.includes(gameType);

        // For ENCRYPTED games, do NOT update the DataGame div
        // The export script expects encrypted data and will decrypt it
        if (isEncrypted) {
          return html; // Keep original HTML with encrypted data
        }

        // For NON-encrypted games (like flipcards), update with plain JSON
        let parsedData = null;

        if (gameData.trim().startsWith('{')) {
          parsedData = this.parseJson(gameData);
        }

        if (parsedData) {
          // Create the new JSON string
          const newJson = JSON.stringify(parsedData);

          // Use DOM to replace the DataGame div content
          try {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            const dataGameDiv = tempDiv.querySelector(`.${divClass}`);
            if (dataGameDiv) {
              dataGameDiv.textContent = newJson;
              return tempDiv.innerHTML;
            }
          } catch (e) {
            // DOM parsing failed, try regex replacement
            const escapedClass = divClass.replace(/-/g, '\\-');
            const regex = new RegExp(
              `(<div[^>]*class="[^"]*${escapedClass}[^"]*"[^>]*>)[\\s\\S]*?(<\\/div>)`,
              'i'
            );
            if (regex.test(html)) {
              return html.replace(regex, `$1${this.escapeHtml(newJson)}$2`);
            }
          }
        }
        break;
      }
    }

    return html;
  }

  /**
   * Escape HTML entities for safe insertion
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Extract content from a TextAreaField instance
   * @param {Element} fieldInst - TextAreaField instance element
   * @returns {string} HTML content
   */
  extractTextAreaFieldContent(fieldInst) {
    if (!fieldInst) return '';
    const dict = fieldInst.querySelector(':scope > dictionary');
    if (!dict) return '';

    const children = Array.from(dict.children);

    // Look for content_w_resourcePaths or _content key
    const contentKeys = ['content_w_resourcePaths', '_content', 'content'];

    for (const targetKey of contentKeys) {
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === 'string' &&
            child.getAttribute('role') === 'key' &&
            child.getAttribute('value') === targetKey) {
          const valueEl = children[i + 1];
          if (valueEl && valueEl.tagName === 'unicode') {
            const value = valueEl.getAttribute('value') || valueEl.textContent || '';
            if (value.trim()) {
              return this.decodeHtmlContent(value);
            }
          }
        }
      }
    }

    return '';
  }

  /**
   * Decode HTML content from legacy XML format
   * @param {string} content - Encoded HTML content
   * @returns {string} Decoded HTML
   */
  decodeHtmlContent(content) {
    if (!content) return '';

    // Handle Python-style unicode escapes and HTML entities
    return content
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r');
  }

  /**
   * Extract properties from game data div
   * Looks for *-DataGame divs and parses the JSON (encrypted or plain)
   */
  extractProperties(dict) {
    // We need the raw HTML to find the DataGame div
    // Extract HTML from fields list (JsIdevice format)
    const rawHtml = this.extractHtmlView(dict);
    if (!rawHtml) return {};

    // Detect which game type this is and extract data
    for (const [gameType, divClass] of Object.entries(GameIdeviceHandler.GAME_PATTERNS)) {
      const gameData = this.extractGameDataFromHtml(rawHtml, divClass);
      if (gameData !== null) {
        this._detectedType = gameType;

        // Check if this game type uses encryption
        const isEncrypted = GameIdeviceHandler.ENCRYPTED_GAMES.includes(gameType);

        // Parse the game data
        let parsedData = null;
        if (isEncrypted && gameData.startsWith('%')) {
          // Encrypted data - decrypt first
          const decrypted = this.decrypt(gameData);
          parsedData = this.parseJson(decrypted);
        } else if (gameData.trim().startsWith('{')) {
          // Plain JSON
          parsedData = this.parseJson(gameData);
        }

        if (parsedData) {
          // Return the game data as jsonProperties
          // The modern iDevice editor expects this format
          return parsedData;
        }
      }
    }

    return {};
  }

  /**
   * Extract game data from HTML by finding the DataGame div
   * Uses DOM parsing for reliable extraction since JSON may contain HTML tags
   * @param {string} html - HTML content
   * @param {string} divClass - Class name of the DataGame div (e.g., 'flipcards-DataGame')
   * @returns {string|null} Content of the DataGame div, or null if not found
   */
  extractGameDataFromHtml(html, divClass) {
    if (!html) return null;

    // Try DOM parsing first (most reliable)
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // Find the DataGame div by class
      const dataGameDiv = tempDiv.querySelector(`.${divClass}`);
      if (dataGameDiv) {
        const content = dataGameDiv.textContent || dataGameDiv.innerText;
        if (content && content.trim()) {
          return content.trim();
        }
      }
    } catch (e) {
      // DOM parsing failed, fall back to regex
    }

    // Fallback: Use regex patterns for edge cases
    const escapedClass = divClass.replace(/-/g, '\\-');
    const patterns = [
      // Match div with class, capturing everything until closing </div>
      // Use non-greedy match with multiline support
      new RegExp(`<div[^>]*class="[^"]*${escapedClass}[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, 'i'),
      // HTML-encoded quotes variant
      new RegExp(`<div[^>]*class=&quot;[^"]*${escapedClass}[^"]*&quot;[^>]*>([\\s\\S]*?)<\\/div>`, 'i'),
    ];

    for (const regex of patterns) {
      const match = html.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Decrypt XOR-encrypted game data
   * Uses the same algorithm as $exeDevices.iDevice.gamification.helpers.decrypt()
   *
   * @param {string} str - Encrypted string (URL-encoded, XOR key=146)
   * @returns {string} Decrypted string
   */
  decrypt(str) {
    if (!str) return '';
    if (str === 'undefined' || str === 'null') return '';

    try {
      // Unescape URL encoding
      str = decodeURIComponent(str);
    } catch (e) {
      // If decodeURIComponent fails, try unescape as fallback
      try {
        str = unescape(str);
      } catch (e2) {
        return '';
      }
    }

    try {
      const key = 146;
      let output = '';
      for (let i = 0; i < str.length; i++) {
        output += String.fromCharCode(key ^ str.charCodeAt(i));
      }
      return output;
    } catch (e) {
      return '';
    }
  }

  /**
   * Parse JSON string safely
   * Handles common issues like control characters in string values
   * @param {string} str - JSON string
   * @returns {Object|null} Parsed object or null
   */
  parseJson(str) {
    if (!str || typeof str !== 'string') return null;
    str = str.trim();

    // Check if string looks like JSON
    if (!str.startsWith('{') || !str.endsWith('}')) {
      // Try to find the JSON object boundaries
      const firstBrace = str.indexOf('{');
      const lastBrace = str.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        str = str.substring(firstBrace, lastBrace + 1);
      } else {
        return null;
      }
    }

    try {
      const obj = JSON.parse(str);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        return obj;
      }
    } catch (e) {
      // Try to fix common JSON issues (newlines, tabs inside strings)
      try {
        // Escape control characters that may be inside string values
        // This handles literal newlines that should be \n
        // eslint-disable-next-line no-control-regex
        const controlCharRegex = /[\x00-\x1F]/g;
        const fixedStr = str.replace(controlCharRegex, (char) => {
          const escapes = {
            '\n': '\\n',
            '\r': '\\r',
            '\t': '\\t',
          };
          return escapes[char] || '';
        });

        const obj = JSON.parse(fixedStr);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          return obj;
        }
      } catch (e2) {
        // JSON parse failed even after fixing
      }
    }
    return null;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GameIdeviceHandler;
} else {
  window.GameIdeviceHandler = GameIdeviceHandler;
}
