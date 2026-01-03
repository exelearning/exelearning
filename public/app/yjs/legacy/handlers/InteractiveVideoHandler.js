/**
 * InteractiveVideoHandler
 *
 * Handles legacy Interactive Video iDevices (JsIdevice with interactive-video type).
 * Converts legacy format to modern 'interactive-video' iDevice.
 *
 * Legacy format:
 * - exe.engine.jsidevice.JsIdevice with _iDeviceDir = 'interactive-video'
 * - HTML contains: <div class="exe-interactive-video">
 *   - <script>var InteractiveVideo = {...}</script> with video configuration
 *   - Image assets referenced in slides
 *
 * The transformation (based on Symfony OdeXmlUtil.php lines 2441-2476):
 * 1. Detect exe-interactive-video class in HTML
 * 2. Find the script with 'var InteractiveVideo = {...}'
 * 3. Extract and parse the JavaScript object as JSON
 * 4. Convert to <script id="exe-interactive-video-contents" type="application/json">
 *
 * This is necessary because the modern export script expects the configuration
 * in application/json format, not as a JavaScript variable.
 *
 * Requires: BaseLegacyHandler.js to be loaded first
 */
class InteractiveVideoHandler extends BaseLegacyHandler {
  /**
   * Check if this handler can process the given legacy class
   * @param {string} className - Legacy class name
   * @param {string} ideviceType - iDevice type from _iDeviceDir
   */
  canHandle(className, ideviceType) {
    // Check for JsIdevice with interactive-video type
    if (ideviceType === 'interactive-video') {
      return true;
    }
    // Fallback: check if className contains interactive-video
    if (className && className.toLowerCase().includes('interactive-video')) {
      return true;
    }
    return false;
  }

  /**
   * Get the target modern iDevice type
   */
  getTargetType() {
    return 'interactive-video';
  }

  /**
   * Extract HTML content and transform the InteractiveVideo script to JSON format
   * Based on Symfony OdeXmlUtil.php lines 2441-2476
   *
   * @param {Element} dict - Dictionary element
   * @param {Object} context - Context with language, etc.
   * @returns {string} Transformed HTML content
   */
  extractHtmlView(dict, context) {
    if (!dict) return '';

    // Get raw HTML from fields (JsIdevice format)
    const rawHtml = this.extractFieldsHtml(dict);
    if (!rawHtml) return '';

    // Check if this is an interactive video
    if (!rawHtml.includes('exe-interactive-video')) {
      return rawHtml;
    }

    // Transform the var InteractiveVideo = {...} script to JSON format
    return this.transformInteractiveVideoScript(rawHtml);
  }

  /**
   * Transform the legacy var InteractiveVideo = {...} script to modern JSON format
   *
   * Legacy format:
   * <script>
   *   //<![CDATA[
   *   var InteractiveVideo = {"slides":[...],...}
   *   //]]>
   * </script>
   *
   * Modern format:
   * <script id="exe-interactive-video-contents" type="application/json">
   *   {"slides":[...],...}
   * </script>
   *
   * @param {string} html - HTML content with legacy script
   * @returns {string} HTML with transformed script
   */
  transformInteractiveVideoScript(html) {
    // First, decode HTML entities that might be encoding the script structure
    // This handles &#10; (newline), &lt; &gt; etc.
    let decodedHtml = this.decodeHtmlEntities(html);

    // Also handle numeric entities for newlines
    decodedHtml = decodedHtml.replace(/&#10;/g, '\n').replace(/&#13;/g, '\r');

    // Find the position of var InteractiveVideo =
    const varPattern = /var\s+InteractiveVideo\s*=\s*/gi;
    const varMatch = varPattern.exec(decodedHtml);

    if (!varMatch) {
      return decodedHtml;
    }

    // Find the balanced JSON object starting after the =
    const jsonStartPos = varMatch.index + varMatch[0].length;
    const jsonContent = this.findBalancedJson(decodedHtml, jsonStartPos);

    if (!jsonContent) {
      return decodedHtml;
    }

    // Clean up and parse the JSON
    let decoded = jsonContent.trim();

    // Remove JavaScript comments (single-line)
    decoded = decoded.replace(/(^|\s)\/\/[^\n\r]*/gm, '$1');

    // Remove trailing commas before } or ]
    decoded = decoded.replace(/,\s*([}\]])/g, '$1');

    // Try to parse as JSON
    let parsed = null;
    try {
      parsed = JSON.parse(decoded);
    } catch (e) {
      // If parsing fails, try to fix common issues
      try {
        const fixed = this.fixJsonQuotes(decoded);
        parsed = JSON.parse(fixed);
      } catch (e2) {
        console.warn('[InteractiveVideoHandler] Failed to parse InteractiveVideo JSON:', e2.message);
        return decodedHtml;
      }
    }

    if (parsed) {
      // Find the full script tag to replace
      // Look backwards for <script and forwards for </script>
      let scriptStart = decodedHtml.lastIndexOf('<script', varMatch.index);
      let scriptEnd = decodedHtml.indexOf('</script>', jsonStartPos + jsonContent.length);

      if (scriptStart !== -1 && scriptEnd !== -1) {
        scriptEnd += '</script>'.length;
        const before = decodedHtml.substring(0, scriptStart);
        const after = decodedHtml.substring(scriptEnd);
        const jsonStr = JSON.stringify(parsed);
        return before + `<script id="exe-interactive-video-contents" type="application/json">${jsonStr}</script>` + after;
      }
    }

    return decodedHtml;
  }

  /**
   * Find a balanced JSON object starting from a position in the string
   * Handles nested braces properly
   *
   * @param {string} str - The string to search in
   * @param {number} startPos - Position to start searching from
   * @returns {string|null} The balanced JSON object or null if not found
   */
  findBalancedJson(str, startPos) {
    let depth = 0;
    let start = -1;

    for (let i = startPos; i < str.length; i++) {
      const char = str[i];

      if (char === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          return str.substring(start, i + 1);
        }
      }
    }

    return null;
  }

  /**
   * Decode HTML entities in string
   * @param {string} str - String with HTML entities
   * @returns {string} Decoded string
   */
  decodeHtmlEntities(str) {
    if (!str) return '';
    return str
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Fix unescaped quotes inside JSON string values
   * Based on Symfony OdeXmlUtil.php lines 2456-2462
   *
   * @param {string} jsonStr - JSON string with potential issues
   * @returns {string} Fixed JSON string
   */
  fixJsonQuotes(jsonStr) {
    // Replace unescaped quotes inside string values
    // This handles cases where HTML content contains unescaped quotes
    return jsonStr.replace(/"((?:[^"\\]|\\.)*)"/g, (match, content) => {
      // Escape any unescaped internal quotes by looking for patterns
      // that indicate broken string boundaries
      const fixed = content
        .replace(/([^\\])"/g, '$1\\"')
        .replace(/^"/g, '\\"');
      return `"${fixed}"`;
    });
  }

  /**
   * Extract HTML content from fields list (JsIdevice format)
   * @param {Element} dict - Dictionary element
   * @returns {string} HTML content
   */
  extractFieldsHtml(dict) {
    const contents = [];
    const children = Array.from(dict.children);

    // Find "fields" key and its list
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child.tagName === 'string' &&
          child.getAttribute('role') === 'key' &&
          child.getAttribute('value') === 'fields') {
        const listEl = children[i + 1];
        if (listEl && listEl.tagName === 'list') {
          // Extract content from each field
          const fieldInstances = Array.from(listEl.children).filter(
            el => el.tagName === 'instance'
          );

          for (const fieldInst of fieldInstances) {
            const fieldClass = fieldInst.getAttribute('class') || '';
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

    return contents.join('\n');
  }

  /**
   * Extract properties from the interactive video configuration
   * Parses the InteractiveVideo JSON and returns relevant properties
   *
   * @param {Element} dict - Dictionary element
   * @param {string} ideviceId - ID of the iDevice
   * @param {Object} context - Context with language, etc.
   * @returns {Object} Properties object
   */
  extractProperties(dict, ideviceId, context) {
    if (!dict) return {};

    // Get the transformed HTML (which has the JSON script)
    const html = this.extractHtmlView(dict, context);
    if (!html) return {};

    // Extract JSON from the transformed script
    // Note: Use [\s\S]*? instead of [^<]* because JSON may contain < characters (from HTML tags)
    const jsonMatch = html.match(/<script[^>]*id="exe-interactive-video-contents"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
    if (!jsonMatch || !jsonMatch[1]) {
      // Try extracting from legacy format if transform failed
      return this.extractLegacyProperties(html);
    }

    try {
      const config = JSON.parse(jsonMatch[1]);
      // Return the full configuration as properties
      // The interactive-video edition code expects these fields
      return {
        slides: config.slides || [],
        title: config.title || '',
        description: config.description || '',
        coverType: config.coverType || 'text',
        i18n: config.i18n || {},
        scorm: config.scorm || {},
        scoreNIA: config.scoreNIA || false,
        evaluation: config.evaluation || false,
        evaluationID: config.evaluationID || '',
        ideviceID: config.ideviceID || ideviceId || '',
      };
    } catch (e) {
      console.warn('[InteractiveVideoHandler] Failed to parse transformed JSON:', e.message);
      return {};
    }
  }

  /**
   * Extract properties from legacy format when transform fails
   * @param {string} html - HTML content
   * @returns {Object} Properties object
   */
  extractLegacyProperties(html) {
    // Try to extract from var InteractiveVideo = {...}
    const legacyMatch = html.match(/var\s+InteractiveVideo\s*=\s*(\{[\s\S]*?\});?\s*(?:\/\/|<\/script>)/i);
    if (!legacyMatch || !legacyMatch[1]) {
      return {};
    }

    try {
      // Clean up the JavaScript object to make it valid JSON
      let jsonStr = legacyMatch[1];
      jsonStr = this.decodeHtmlEntities(jsonStr);
      jsonStr = jsonStr.replace(/(^|\s)\/\/[^\n\r]*/gm, '$1');
      jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

      const config = JSON.parse(jsonStr);
      return {
        slides: config.slides || [],
        title: config.title || '',
        description: config.description || '',
        coverType: config.coverType || 'text',
        i18n: config.i18n || {},
        scorm: config.scorm || {},
      };
    } catch (e) {
      return {};
    }
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InteractiveVideoHandler;
} else {
  window.InteractiveVideoHandler = InteractiveVideoHandler;
}
