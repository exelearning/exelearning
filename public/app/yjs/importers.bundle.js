(() => {
  // src/shared/import/legacy-handlers/BaseLegacyHandler.ts
  var FEEDBACK_TRANSLATIONS = {
    es: "Mostrar retroalimentaci\xF3n",
    en: "Show Feedback",
    ca: "Mostra la retroalimentaci\xF3",
    eu: "Erakutsi feedbacka",
    gl: "Mostrar retroalimentaci\xF3n",
    pt: "Mostrar feedback",
    fr: "Afficher le feedback",
    de: "Feedback anzeigen",
    it: "Mostra feedback",
    nl: "Toon feedback",
    pl: "Poka\u017C informacj\u0119 zwrotn\u0105",
    ru: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043E\u0442\u0437\u044B\u0432",
    zh: "\u663E\u793A\u53CD\u9988",
    ja: "\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u3092\u8868\u793A",
    ar: "\u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A"
  };
  var BaseLegacyHandler = class {
    /**
     * Extract iDevice-specific properties from the dictionary
     * Default implementation returns empty object
     *
     * @param dict - Dictionary element of the iDevice
     * @param _ideviceId - Generated iDevice ID
     * @returns Properties object
     */
    extractProperties(dict, _ideviceId) {
      void dict;
      return {};
    }
    /**
     * Extract HTML content from the dictionary
     * Default implementation returns empty string
     *
     * @param dict - Dictionary element from legacy XML
     * @param _context - Context with language info
     * @returns HTML content
     */
    extractHtmlView(dict, _context) {
      void dict;
      return "";
    }
    /**
     * Extract feedback content from the dictionary
     * Default implementation returns empty content
     *
     * @param dict - Dictionary element from legacy XML
     * @param _context - Context with language info
     * @returns Feedback info
     */
    extractFeedback(dict, _context) {
      void dict;
      return { content: "", buttonCaption: "" };
    }
    // ========================================
    // Localization Utilities
    // ========================================
    /**
     * Get localized "Show Feedback" text based on language code
     * Uses static translations instead of UI locale for legacy imports
     *
     * @param langCode - Language code (e.g., 'es', 'en', 'ca')
     * @returns Localized feedback button text
     */
    getLocalizedFeedbackText(langCode) {
      const lang = (langCode || "").split("-")[0].toLowerCase();
      return FEEDBACK_TRANSLATIONS[lang] || FEEDBACK_TRANSLATIONS.es;
    }
    // ========================================
    // XML Dictionary Parsing Utilities
    // ========================================
    /**
     * Get child elements of an element (filters out text nodes)
     *
     * @param element - Parent element
     * @returns Array of child elements
     */
    getChildElements(element) {
      const result = [];
      const children = element.childNodes;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.nodeType === 1) {
          result.push(child);
        }
      }
      return result;
    }
    /**
     * Find a string value in dictionary by key
     *
     * @param dict - Dictionary element
     * @param key - Key to find
     * @returns Value or null
     */
    findDictStringValue(dict, key) {
      const children = this.getChildElements(dict);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === key) {
          const valueEl = children[i + 1];
          if (valueEl && (valueEl.tagName === "string" || valueEl.tagName === "unicode")) {
            return valueEl.getAttribute("value") || valueEl.textContent || null;
          }
        }
      }
      return null;
    }
    /**
     * Find a list element in dictionary by key
     *
     * @param dict - Dictionary element
     * @param key - Key to find
     * @returns List element or null
     */
    findDictList(dict, key) {
      const children = this.getChildElements(dict);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === key) {
          const valueEl = children[i + 1];
          if (valueEl && valueEl.tagName === "list") {
            return valueEl;
          }
        }
      }
      return null;
    }
    /**
     * Find an instance element in dictionary by key
     *
     * @param dict - Dictionary element
     * @param key - Key to find
     * @returns Instance element or null
     */
    findDictInstance(dict, key) {
      const children = this.getChildElements(dict);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === key) {
          const valueEl = children[i + 1];
          if (valueEl && valueEl.tagName === "instance") {
            return valueEl;
          }
        }
      }
      return null;
    }
    /**
     * Find a boolean value in dictionary by key
     *
     * @param dict - Dictionary element
     * @param key - Key to find
     * @returns Boolean value (false if not found)
     */
    findDictBoolValue(dict, key) {
      const children = this.getChildElements(dict);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === key) {
          const valueEl = children[i + 1];
          if (valueEl && valueEl.tagName === "bool") {
            return valueEl.getAttribute("value") === "1";
          }
        }
      }
      return false;
    }
    /**
     * Find an integer value in dictionary by key
     *
     * @param dict - Dictionary element
     * @param key - Key to find
     * @returns Integer value or null
     */
    findDictIntValue(dict, key) {
      const children = this.getChildElements(dict);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === key) {
          const valueEl = children[i + 1];
          if (valueEl && valueEl.tagName === "int") {
            const value = valueEl.getAttribute("value");
            return value !== null ? parseInt(value, 10) : null;
          }
        }
      }
      return null;
    }
    // ========================================
    // Field Content Extraction
    // ========================================
    /**
     * Get direct child element by tag name (xmldom-compatible)
     * @param parent - Parent element
     * @param tagName - Tag name to search for
     * @returns First matching child element or null
     */
    getDirectChildByTagName(parent, tagName) {
      const children = this.getChildElements(parent);
      return children.find((el) => el.tagName === tagName) || null;
    }
    /**
     * Get all direct child elements by tag name (xmldom-compatible)
     * @param parent - Parent element
     * @param tagName - Tag name to search for
     * @returns Array of matching child elements
     */
    getDirectChildrenByTagName(parent, tagName) {
      const children = this.getChildElements(parent);
      return children.filter((el) => el.tagName === tagName);
    }
    /**
     * Find elements by class name containing a substring (xmldom-compatible)
     * @param parent - Parent element
     * @param tagName - Tag name to search for
     * @param classSubstring - Substring that must be in the class attribute
     * @returns Array of matching elements
     */
    getElementsByClassContains(parent, tagName, classSubstring) {
      const elements = [];
      const allElements = parent.getElementsByTagName(tagName);
      for (let i = 0; i < allElements.length; i++) {
        const el = allElements[i];
        const className = el.getAttribute("class") || "";
        if (className.includes(classSubstring)) {
          elements.push(el);
        }
      }
      return elements;
    }
    /**
     * Extract content from a TextAreaField instance
     *
     * @param fieldInst - TextAreaField instance element
     * @returns HTML content
     */
    extractTextAreaFieldContent(fieldInst) {
      if (!fieldInst) return "";
      const dict = this.getDirectChildByTagName(fieldInst, "dictionary");
      if (!dict) return "";
      const children = this.getChildElements(dict);
      const contentKeys = ["content_w_resourcePaths", "_content", "content"];
      for (const targetKey of contentKeys) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === targetKey) {
            const valueEl = children[i + 1];
            if (valueEl && valueEl.tagName === "unicode") {
              const value = valueEl.getAttribute("value") || valueEl.textContent || "";
              if (value.trim()) {
                return this.decodeHtmlContent(value);
              }
            }
          }
        }
      }
      return "";
    }
    /**
     * Extract content from a FeedbackField instance
     *
     * @param fieldInst - FeedbackField instance element
     * @returns Feedback content and button caption
     */
    extractFeedbackFieldContent(fieldInst) {
      if (!fieldInst) return { content: "", buttonCaption: "" };
      const dict = this.getDirectChildByTagName(fieldInst, "dictionary");
      if (!dict) return { content: "", buttonCaption: "" };
      const children = this.getChildElements(dict);
      let content = "";
      let buttonCaption = "";
      const contentKeys = ["feedback", "content_w_resourcePaths", "_content", "content"];
      for (const targetKey of contentKeys) {
        if (content) break;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === targetKey) {
            const valueEl = children[i + 1];
            if (valueEl && valueEl.tagName === "unicode") {
              const value = valueEl.getAttribute("value") || valueEl.textContent || "";
              if (value.trim()) {
                content = this.decodeHtmlContent(value);
                break;
              }
            }
          }
        }
      }
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === "_buttonCaption") {
          const valueEl = children[i + 1];
          if (valueEl && (valueEl.tagName === "unicode" || valueEl.tagName === "string")) {
            buttonCaption = valueEl.getAttribute("value") || valueEl.textContent || "";
            break;
          }
        }
      }
      return {
        content,
        buttonCaption: buttonCaption || "Show Feedback"
      };
    }
    // ========================================
    // Content Decoding & Transformation
    // ========================================
    /**
     * Decode HTML content from legacy XML format
     *
     * @param content - Encoded HTML content
     * @returns Decoded HTML
     */
    decodeHtmlContent(content) {
      if (!content) return "";
      const decoded = content.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\\n/g, "\n").replace(/\\t/g, "	").replace(/\\r(?![a-zA-Z])/g, "\r");
      return decoded;
    }
    /**
     * Strip HTML tags from content, returning plain text.
     * Matches Symfony's strip_tags() behavior for legacy imports.
     *
     * Uses regex instead of DOM parsing to work in both browser and Node.js.
     *
     * @param html - HTML content to strip
     * @returns Plain text content
     */
    stripHtmlTags(html) {
      if (!html) return "";
      const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ");
      return text.trim();
    }
    /**
     * Escape HTML special characters for attribute values
     *
     * @param str - String to escape
     * @returns Escaped string safe for HTML attributes
     */
    escapeHtmlAttr(str) {
      if (!str) return "";
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    /**
     * Escape HTML entities for safe insertion
     *
     * @param str - String to escape
     * @returns Escaped string
     */
    escapeHtml(str) {
      if (!str) return "";
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
    // ========================================
    // Common Field Extraction Patterns
    // ========================================
    /**
     * Extract content from "fields" list (JsIdevice format)
     *
     * @param dict - Dictionary element
     * @returns Combined content from text fields
     */
    extractFieldsContent(dict) {
      const children = this.getChildElements(dict);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === "fields") {
          const listEl = children[i + 1];
          if (listEl && listEl.tagName === "list") {
            const contents = [];
            const fieldInstances = this.getDirectChildrenByTagName(listEl, "instance");
            for (const fieldInst of fieldInstances) {
              const fieldClass = fieldInst.getAttribute("class") || "";
              if (fieldClass.includes("TextAreaField") || fieldClass.includes("TextField")) {
                const content = this.extractTextAreaFieldContent(fieldInst);
                if (content) {
                  contents.push(content);
                }
              }
            }
            return contents.join("\n");
          }
          break;
        }
      }
      return "";
    }
    /**
     * Extract rich text content from a dictionary field
     *
     * @param dict - Dictionary element
     * @param fieldName - Field name to look for
     * @returns Content or empty string
     */
    extractRichTextContent(dict, fieldName) {
      const children = this.getChildElements(dict);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === fieldName) {
          const valueEl = children[i + 1];
          if (!valueEl) return "";
          if (valueEl.tagName === "unicode" || valueEl.tagName === "string") {
            return this.decodeHtmlContent(valueEl.getAttribute("value") || valueEl.textContent || "");
          }
          if (valueEl.tagName === "instance") {
            return this.extractTextAreaFieldContent(valueEl);
          }
        }
      }
      return "";
    }
    /**
     * Extract content from any TextAreaField or TextField in the dictionary
     *
     * @param dict - Dictionary element
     * @returns Content or empty string
     */
    extractAnyTextFieldContent(dict) {
      const instances = this.getDirectChildrenByTagName(dict, "instance");
      for (const inst of instances) {
        const className = inst.getAttribute("class") || "";
        if (className.includes("TextAreaField") || className.includes("TextField")) {
          const content = this.extractTextAreaFieldContent(inst);
          if (content) {
            return content;
          }
        }
      }
      const nestedInstances = dict.getElementsByTagName("instance");
      for (let i = 0; i < nestedInstances.length; i++) {
        const inst = nestedInstances[i];
        const className = inst.getAttribute("class") || "";
        if (className.includes("TextAreaField") || className.includes("TextField")) {
          const content = this.extractTextAreaFieldContent(inst);
          if (content) {
            return content;
          }
        }
      }
      return "";
    }
    /**
     * Extract resource path from dictionary
     * Used for extracting file paths from resource instances
     *
     * @param dict - Dictionary element
     * @param key - Key name
     * @returns Resource path or null
     */
    extractResourcePath(dict, key) {
      const resourceInst = this.findDictInstance(dict, key);
      if (!resourceInst) return null;
      const resourceDict = this.getDirectChildByTagName(resourceInst, "dictionary");
      if (!resourceDict) return null;
      const storageName = this.findDictStringValue(resourceDict, "_storageName") || this.findDictStringValue(resourceDict, "storageName") || this.findDictStringValue(resourceDict, "_fileName") || this.findDictStringValue(resourceDict, "fileName");
      return storageName || null;
    }
  };

  // src/shared/import/legacy-handlers/DefaultHandler.ts
  var DefaultHandler = class extends BaseLegacyHandler {
    /**
     * Always matches (fallback handler)
     */
    canHandle(_className, _ideviceType) {
      return true;
    }
    /**
     * Default to 'text' iDevice for unknown types
     */
    getTargetType() {
      return "text";
    }
    /**
     * Try to extract HTML content from various common fields
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const fieldsResult = this.extractFieldsContent(dict);
      if (fieldsResult) {
        return fieldsResult;
      }
      const contentFields = ["content", "_content", "_html", "htmlView", "story", "_story", "text", "_text"];
      for (const field of contentFields) {
        const content = this.extractRichTextContent(dict, field);
        if (content) {
          return content;
        }
      }
      return this.extractAnyTextFieldContent(dict);
    }
    /**
     * Try to extract feedback content
     *
     * @param dict - Dictionary element
     * @param context - Context with language info
     */
    extractFeedback(dict, context) {
      if (!dict) return { content: "", buttonCaption: "" };
      const answerTextArea = this.findDictInstance(dict, "answerTextArea");
      if (answerTextArea) {
        const content = this.extractTextAreaFieldContent(answerTextArea);
        if (content) {
          return {
            content,
            buttonCaption: this.getLocalizedFeedbackText(context?.language)
          };
        }
      }
      return { content: "", buttonCaption: "" };
    }
  };

  // src/shared/import/legacy-handlers/FreeTextHandler.ts
  var FreeTextHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("FreeTextIdevice") || className.includes("FreeTextfpdIdevice") || className.includes("ReflectionIdevice") || className.includes("ReflectionfpdIdevice") || className.includes("GenericIdevice");
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "text";
    }
    /**
     * Extract HTML content from the legacy format
     * Also renders feedback button and content directly into htmlView (matching Symfony behavior)
     * Wraps content in exe-text-activity structure for proper editor/export handling
     *
     * @param dict - Dictionary element from legacy XML
     * @param context - Context with language info
     */
    extractHtmlView(dict, context) {
      if (!dict) return "";
      let content = "";
      const activityTextArea = this.findDictInstance(dict, "activityTextArea");
      if (activityTextArea) {
        content = this.extractTextAreaFieldContent(activityTextArea);
      }
      if (!content) {
        const contentTextArea = this.findDictInstance(dict, "content");
        if (contentTextArea) {
          content = this.extractTextAreaFieldContent(contentTextArea);
        }
      }
      if (!content) {
        const fieldsContent = this.extractFieldsContent(dict);
        if (fieldsContent) {
          content = fieldsContent;
        }
      }
      if (!content) {
        const instances = this.getDirectChildrenByTagName(dict, "instance");
        for (const inst of instances) {
          const className = inst.getAttribute("class") || "";
          if (className.includes("TextAreaField")) {
            content = this.extractTextAreaFieldContent(inst);
            if (content) break;
          }
        }
      }
      const feedback = this.extractFeedback(dict, context);
      if (feedback.content) {
        const escapedCaption = this.escapeHtmlAttr(feedback.buttonCaption);
        let rebuiltHtmlView = content;
        rebuiltHtmlView += '<div class="iDevice_buttons feedback-button js-required">';
        rebuiltHtmlView += `<input type="button" class="feedbacktooglebutton" value="${escapedCaption}" `;
        rebuiltHtmlView += `data-text-a="${escapedCaption}" data-text-b="${escapedCaption}">`;
        rebuiltHtmlView += "</div>";
        rebuiltHtmlView += `<div class="feedback js-feedback js-hidden" style="display: none;">${feedback.content}</div>`;
        return `<div class="exe-text-activity">${rebuiltHtmlView}</div>`;
      }
      return content;
    }
    /**
     * Extract feedback content (for Reflection iDevices and GenericIdevice with FeedbackField)
     *
     * @param dict - Dictionary element
     * @param context - Context with language info
     */
    extractFeedback(dict, context) {
      if (!dict) return { content: "", buttonCaption: "" };
      const defaultCaption = this.getLocalizedFeedbackText(context?.language);
      const answerTextArea = this.findDictInstance(dict, "answerTextArea");
      if (answerTextArea) {
        const answerDict = this.getDirectChildByTagName(answerTextArea, "dictionary");
        if (answerDict) {
          const content = this.extractTextAreaFieldContent(answerTextArea);
          const storedCaption = this.findDictStringValue(answerDict, "buttonCaption");
          const buttonCaption = storedCaption || defaultCaption;
          if (content) {
            return { content, buttonCaption };
          }
        }
      }
      const feedbackTextArea = this.findDictInstance(dict, "feedbackTextArea");
      if (feedbackTextArea) {
        const feedbackDict = this.getDirectChildByTagName(feedbackTextArea, "dictionary");
        let buttonCaption = defaultCaption;
        if (feedbackDict) {
          const storedCaption = this.findDictStringValue(feedbackDict, "buttonCaption");
          buttonCaption = storedCaption || defaultCaption;
        }
        const content = this.extractTextAreaFieldContent(feedbackTextArea);
        if (content) {
          return { content, buttonCaption };
        }
      }
      const feedbackFromFields = this.extractFeedbackFromFieldsList(dict, context);
      if (feedbackFromFields.content) {
        return feedbackFromFields;
      }
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract feedback from FeedbackField inside "fields" list
     * Used by GenericIdevice (Reading Activity, etc.)
     *
     * @param dict - Dictionary element
     * @param context - Context with language info
     */
    extractFeedbackFromFieldsList(dict, context) {
      const defaultCaption = this.getLocalizedFeedbackText(context?.language);
      const children = this.getChildElements(dict);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === "fields") {
          const listEl = children[i + 1];
          if (listEl && listEl.tagName === "list") {
            const fieldInstances = this.getDirectChildrenByTagName(listEl, "instance");
            for (const fieldInst of fieldInstances) {
              const fieldClass = fieldInst.getAttribute("class") || "";
              if (fieldClass.includes("FeedbackField")) {
                const fieldDict = this.getDirectChildByTagName(fieldInst, "dictionary");
                if (fieldDict) {
                  const storedCaption = this.findDictStringValue(fieldDict, "_buttonCaption");
                  const buttonCaption = storedCaption || defaultCaption;
                  let content = this.findDictStringValue(fieldDict, "feedback");
                  if (!content) {
                    content = this.findDictStringValue(fieldDict, "content_w_resourcePaths");
                  }
                  if (content) {
                    content = this.decodeHtmlContent(content);
                    return { content, buttonCaption };
                  }
                }
              }
            }
          }
          break;
        }
      }
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties for text iDevice
     */
    extractProperties(dict, _ideviceId) {
      const feedback = this.extractFeedback(dict);
      if (feedback.content) {
        return {
          textFeedbackTextarea: feedback.content,
          textFeedbackInput: feedback.buttonCaption
        };
      }
      return {};
    }
  };

  // src/shared/import/legacy-handlers/MultichoiceHandler.ts
  var MultichoiceHandler = class extends BaseLegacyHandler {
    constructor() {
      super(...arguments);
      // Track the iDevice class to determine selection type
      this._isMultiSelect = false;
    }
    /**
     * Check if this handler can process the given legacy class
     * Also stores whether this is a MultiSelect iDevice for later use
     */
    canHandle(className, _ideviceType) {
      const canHandleThis = className.includes("MultichoiceIdevice") || className.includes("MultiSelectIdevice");
      if (canHandleThis) {
        this._isMultiSelect = className.includes("MultiSelectIdevice");
      }
      return canHandleThis;
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "form";
    }
    /**
     * Extract instructions HTML (if present)
     * MultichoiceIdevice typically doesn't have instructionsForLearners,
     * but we check anyway for compatibility.
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const instructionsArea = this.findDictInstance(dict, "instructionsForLearners");
      if (instructionsArea) {
        return this.extractTextAreaFieldContent(instructionsArea);
      }
      return "";
    }
    /**
     * Extract feedback from iDevice level (if present)
     * MultichoiceIdevice has per-option feedback, not iDevice-level,
     * but we check for compatibility with other formats.
     */
    extractFeedback(dict, _context) {
      if (!dict) return { content: "", buttonCaption: "" };
      const feedbackField = this.findDictInstance(dict, "feedback") || this.findDictInstance(dict, "feedbackTextArea");
      if (feedbackField) {
        return {
          content: this.extractTextAreaFieldContent(feedbackField),
          buttonCaption: ""
        };
      }
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract questionsData and optionally eXeFormInstructions from the legacy format
     * Only sets properties that have actual content - no defaults.
     */
    extractProperties(dict, _ideviceId) {
      const questionsData = this.extractQuestions(dict);
      const instructions = this.extractHtmlView(dict);
      const feedback = this.extractFeedback(dict);
      const props = {};
      if (questionsData.length > 0) {
        props.questionsData = questionsData;
      }
      if (instructions?.trim()) {
        props.eXeFormInstructions = instructions;
      }
      if (feedback.content?.trim()) {
        props.eXeIdeviceTextAfter = feedback.content;
      }
      return props;
    }
    /**
     * Extract questions from legacy MultichoiceIdevice format
     *
     * Structure:
     * - questions -> list of QuizQuestionField
     * - QuizQuestionField.questionTextArea -> question text
     * - QuizQuestionField.hintTextArea -> hint for the question
     * - QuizQuestionField.options -> list of QuizOptionField
     * - QuizOptionField.answerTextArea -> option text
     * - QuizOptionField.isCorrect -> boolean
     * - QuizOptionField.feedbackTextArea -> feedback for this option
     *
     * @param dict - Dictionary element of the MultichoiceIdevice
     * @returns Array of question objects in form iDevice format
     */
    extractQuestions(dict) {
      const questionsData = [];
      const questionsList = this.findDictList(dict, "questions");
      if (!questionsList) return questionsData;
      const questionFields = this.getDirectChildrenByTagName(questionsList, "instance");
      for (const questionField of questionFields) {
        const qDict = this.getDirectChildByTagName(questionField, "dictionary");
        if (!qDict) continue;
        const questionTextArea = this.findDictInstance(qDict, "questionTextArea");
        const questionText = questionTextArea ? this.extractTextAreaFieldContent(questionTextArea) : "";
        const hintTextArea = this.findDictInstance(qDict, "hintTextArea");
        const hint = hintTextArea ? this.extractTextAreaFieldContent(hintTextArea) : "";
        const optionsList = this.findDictList(qDict, "options");
        const answers = [];
        if (optionsList) {
          const optionFields = this.getDirectChildrenByTagName(optionsList, "instance");
          for (const optionField of optionFields) {
            const optDict = this.getDirectChildByTagName(optionField, "dictionary");
            if (!optDict) continue;
            const answerTextArea = this.findDictInstance(optDict, "answerTextArea");
            const optionHtml = answerTextArea ? this.extractTextAreaFieldContent(answerTextArea) : "";
            const optionText = this.stripHtmlTags(optionHtml);
            const isCorrect = this.findDictBoolValue(optDict, "isCorrect");
            const feedbackTextArea = this.findDictInstance(optDict, "feedbackTextArea");
            const optionFeedback = feedbackTextArea ? this.extractTextAreaFieldContent(feedbackTextArea) : "";
            if (optionFeedback?.trim()) {
              answers.push([isCorrect, optionText, optionFeedback]);
            } else {
              answers.push([isCorrect, optionText]);
            }
          }
        }
        if (questionText || answers.length > 0) {
          const questionData = {
            activityType: "selection",
            selectionType: this._isMultiSelect ? "multiple" : "single",
            baseText: questionText,
            answers
          };
          if (hint?.trim()) {
            questionData.hint = hint;
          }
          questionsData.push(questionData);
        }
      }
      return questionsData;
    }
  };

  // src/shared/import/legacy-handlers/TrueFalseHandler.ts
  var TrueFalseHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("TrueFalseIdevice") || className.includes("VerdaderoFalsoFPDIdevice");
    }
    /**
     * Get the target modern iDevice type
     * Matches Symfony: 'trueorfalse'
     */
    getTargetType() {
      return "trueorfalse";
    }
    /**
     * Get default messages for the game
     * These match the messages used by edition/trueorfalse.js
     */
    getDefaultMessages() {
      return {
        msgStartGame: "Click here to start",
        msgTime: "Time per question",
        msgNoImage: "No picture question",
        msgScoreScorm: "The score can't be saved because this page is not part of a SCORM package.",
        msgEndGameScore: "Please start the game before saving your score.",
        msgOnlySaveScore: "You can only save the score once!",
        msgOnlySave: "You can only save once",
        msgYouScore: "Your score",
        msgAuthor: "Authorship",
        msgOnlySaveAuto: "Your score will be saved after each question. You can only play once.",
        msgSaveAuto: "Your score will be automatically saved after each question.",
        msgSeveralScore: "You can save the score as many times as you want",
        msgYouLastScore: "The last score saved is",
        msgActityComply: "You have already done this activity.",
        msgPlaySeveralTimes: "You can do this activity as many times as you want",
        msgUncompletedActivity: "Incomplete activity",
        msgSuccessfulActivity: "Activity: Passed. Score: %s",
        msgUnsuccessfulActivity: "Activity: Not passed. Score: %s",
        msgTypeGame: "True or false",
        msgFeedback: "Feedback",
        msgSuggestion: "Suggestion",
        msgSolution: "Solution",
        msgQuestion: "Question",
        msgTrue: "True",
        msgFalse: "False",
        msgOk: "Correct",
        msgKO: "Incorrect",
        msgShow: "Show",
        msgHide: "Hide",
        msgCheck: "Check",
        msgReboot: "Try again!",
        msgScore: "Score",
        msgWeight: "Weight",
        msgNext: "Next",
        msgPrevious: "Previous"
      };
    }
    /**
     * Extract properties in the game-compatible format expected by the renderer.
     * This generates the full format with typeGame, questionsGame, msgs, etc.
     * to avoid the need for transformation at edit time.
     */
    extractProperties(dict, ideviceId) {
      const questionsGame = this.extractQuestionsGame(dict);
      const instructions = this.extractHtmlView(dict);
      if (questionsGame.length > 0) {
        return {
          id: ideviceId || "",
          typeGame: "TrueOrFalse",
          eXeGameInstructions: instructions || "",
          eXeIdeviceTextAfter: "",
          msgs: this.getDefaultMessages(),
          questionsRandom: false,
          percentageQuestions: 100,
          isTest: false,
          time: 0,
          questionsGame,
          isScorm: 0,
          textButtonScorm: "Save score",
          repeatActivity: true,
          weighted: 100,
          evaluation: false,
          evaluationID: "",
          showSlider: false,
          ideviceId: ideviceId || ""
        };
      }
      return {};
    }
    /**
     * Extract questions from legacy TrueFalseIdevice format in game-compatible format.
     *
     * Structure:
     * - list of TrueFalseQuestion instances
     * - TrueFalseQuestion has: questionTextArea, isCorrect, hintTextArea, feedbackTextArea
     *
     * Output format matches what the renderer expects:
     * - question: HTML content
     * - feedback: HTML content
     * - suggestion: HTML content (from hint)
     * - solution: 1 for true, 0 for false
     *
     * @param dict - Dictionary element of the TrueFalseIdevice
     * @returns Array of question objects in game format
     */
    extractQuestionsGame(dict) {
      const questionsGame = [];
      const lists = this.getDirectChildrenByTagName(dict, "list");
      let questionsList = null;
      for (const list of lists) {
        const firstInst = this.getDirectChildByTagName(list, "instance");
        if (firstInst) {
          const className = firstInst.getAttribute("class") || "";
          if (className.includes("TrueFalseQuestion")) {
            questionsList = list;
            break;
          }
        }
      }
      if (!questionsList) {
        questionsList = this.findDictList(dict, "questions");
      }
      if (!questionsList) return questionsGame;
      const questionInstances = this.getDirectChildrenByTagName(questionsList, "instance");
      for (const questionInst of questionInstances) {
        const qDict = this.getDirectChildByTagName(questionInst, "dictionary");
        if (!qDict) continue;
        const questionTextArea = this.findDictInstance(qDict, "questionTextArea");
        let altTextArea = questionTextArea;
        if (!altTextArea) {
          const instances = this.getElementsByClassContains(qDict, "instance", "TextAreaField");
          altTextArea = instances[0];
        }
        const questionText = altTextArea ? this.extractTextAreaFieldContent(altTextArea) : "";
        const isCorrect = this.findDictBoolValue(qDict, "isCorrect");
        const hintTextArea = this.findDictInstance(qDict, "hintTextArea");
        const suggestion = hintTextArea ? this.extractTextAreaFieldContent(hintTextArea) : "";
        const feedbackTextArea = this.findDictInstance(qDict, "feedbackTextArea");
        const feedback = feedbackTextArea ? this.extractTextAreaFieldContent(feedbackTextArea) : "";
        if (questionText) {
          questionsGame.push({
            question: questionText,
            feedback,
            suggestion,
            solution: isCorrect ? 1 : 0
          });
        }
      }
      return questionsGame;
    }
    /**
     * Extract instructions HTML (optional intro text)
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const instructionsArea = this.findDictInstance(dict, "instructionsForLearners");
      if (instructionsArea) {
        return this.extractTextAreaFieldContent(instructionsArea);
      }
      const instances = this.getDirectChildrenByTagName(dict, "instance");
      const textArea = instances.find((inst) => (inst.getAttribute("class") || "").includes("TextAreaField"));
      if (textArea) {
        return this.extractTextAreaFieldContent(textArea);
      }
      return "";
    }
    /**
     * No feedback at iDevice level for TrueFalse
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
  };

  // src/shared/import/legacy-handlers/FillHandler.ts
  var FillHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("ClozeIdevice") || className.includes("ClozeActivityIdevice") || className.includes("ClozeLanguageIdevice") || className.includes("ClozeLangIdevice") || className.includes("ClozelangfpdIdevice");
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "form";
    }
    /**
     * Extract the cloze text (instructions/content before gaps)
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const instructionsArea = this.findDictInstance(dict, "instructionsForLearners");
      if (instructionsArea) {
        return this.extractTextAreaFieldContent(instructionsArea);
      }
      return "";
    }
    /**
     * Extract feedback content from legacy format
     * Maps to eXeIdeviceTextAfter in modern form iDevice
     */
    extractFeedback(dict, _context) {
      if (!dict) return { content: "", buttonCaption: "" };
      const feedbackField = this.findDictInstance(dict, "feedback") || this.findDictInstance(dict, "feedbackTextArea");
      if (feedbackField) {
        return {
          content: this.extractTextAreaFieldContent(feedbackField),
          buttonCaption: ""
        };
      }
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties including questionsData and eXeFormInstructions
     */
    extractProperties(dict, _ideviceId) {
      const questionsData = this.extractClozeQuestions(dict);
      const instructions = this.extractHtmlView(dict);
      const autoCapitalize = !this.findDictBoolValue(dict, "autoCapitalize");
      const strictMarking = this.findDictBoolValue(dict, "strictMarking");
      const instantMarking = this.findDictBoolValue(dict, "instantMarking");
      const props = {};
      if (questionsData.length > 0) {
        props.questionsData = questionsData;
      }
      if (instructions) {
        props.eXeFormInstructions = instructions;
      }
      if (autoCapitalize !== void 0) {
        props.ignoreCaps = autoCapitalize;
      }
      if (strictMarking !== void 0) {
        props.strictMarking = strictMarking;
      }
      if (instantMarking !== void 0) {
        props.instantMarking = instantMarking;
      }
      const feedback = this.extractFeedback(dict);
      if (feedback.content) {
        props.eXeIdeviceTextAfter = feedback.content;
      }
      return props;
    }
    /**
     * Extract cloze questions from the legacy format
     *
     * Structure (Symfony OdeOldXmlFillIdevice.php):
     * - _content -> exe.engine.field.ClozeField
     * - ClozeField contains _encodedContent with the cloze text
     * - Gaps are marked with <u> tags
     *
     * @param dict - Dictionary element of the ClozeIdevice
     * @returns Array of question objects in form iDevice format
     */
    extractClozeQuestions(dict) {
      const questionsData = [];
      const contentInst = this.findDictInstance(dict, "_content");
      if (contentInst) {
        const clozeDict = this.getDirectChildByTagName(contentInst, "dictionary");
        if (clozeDict) {
          const encodedContent = this.findDictStringValue(clozeDict, "_encodedContent");
          if (encodedContent) {
            const parsedText = this.parseClozeText(encodedContent);
            if (parsedText.baseText) {
              questionsData.push({
                activityType: "fill",
                baseText: parsedText.baseText,
                answers: parsedText.answers || []
              });
              return questionsData;
            }
          }
        }
      }
      const clozeInst = this.findDictInstance(dict, "_cloze");
      if (clozeInst) {
        const clozeDict = this.getDirectChildByTagName(clozeInst, "dictionary");
        if (clozeDict) {
          const clozeText = this.findDictStringValue(clozeDict, "_encodedContent") || this.findDictStringValue(clozeDict, "_clozeText") || this.findDictStringValue(clozeDict, "clozeText");
          if (clozeText) {
            const parsedText = this.parseClozeText(clozeText);
            if (parsedText.baseText) {
              questionsData.push({
                activityType: "fill",
                baseText: parsedText.baseText,
                answers: parsedText.answers || []
              });
              return questionsData;
            }
          }
        }
      }
      const clozeFieldByClass = this.getDirectChildrenByTagName(dict, "instance").find(
        (inst) => (inst.getAttribute("class") || "").includes("ClozeField")
      );
      if (clozeFieldByClass) {
        const clozeDict = this.getDirectChildByTagName(clozeFieldByClass, "dictionary");
        if (clozeDict) {
          const encodedContent = this.findDictStringValue(clozeDict, "_encodedContent");
          if (encodedContent) {
            const parsedText = this.parseClozeText(encodedContent);
            if (parsedText.baseText) {
              questionsData.push({
                activityType: "fill",
                baseText: parsedText.baseText,
                answers: parsedText.answers || []
              });
              return questionsData;
            }
          }
        }
      }
      return this.extractClozeFromFields(dict);
    }
    /**
     * Alternative extraction from fields list
     */
    extractClozeFromFields(dict) {
      const questionsData = [];
      const clozeTextArea = this.findDictInstance(dict, "clozeTextArea");
      if (clozeTextArea) {
        const content = this.extractTextAreaFieldContent(clozeTextArea);
        if (content) {
          const parsedText = this.parseClozeText(content);
          if (parsedText.baseText) {
            questionsData.push({
              activityType: "fill",
              baseText: parsedText.baseText,
              answers: parsedText.answers || []
            });
          }
        }
      }
      return questionsData;
    }
    /**
     * Parse cloze text to normalize format for the form iDevice renderer
     *
     * The form iDevice renderer (export/form.js getProcessTextFillQuestion)
     * expects <u>word</u> tags in baseText and converts them to <input> fields.
     *
     * Legacy formats that need normalization:
     * - <u class="exe-cloze-word">word</u> -> <u>word</u>
     * - <span class="cloze-blank">word</span> -> <u>word</u>
     * - <input data-answer="word"> -> <u>word</u>
     *
     * Simple <u>word</u> tags are kept as-is (already correct format).
     *
     * @param text - Raw cloze text
     * @returns { baseText, answers }
     */
    parseClozeText(text) {
      if (!text) return { baseText: "", answers: [] };
      let baseText = text;
      baseText = baseText.replace(
        /<u[^>]*class="[^"]*exe-cloze-word[^"]*"[^>]*>([^<]+)<\/u>/gi,
        (_match, word) => "<u>" + word.trim() + "</u>"
      );
      baseText = baseText.replace(
        /<span[^>]*class="[^"]*cloze-blank[^"]*"[^>]*>([^<]+)<\/span>/gi,
        (_match, word) => "<u>" + word.trim() + "</u>"
      );
      baseText = baseText.replace(
        /<input[^>]*data-answer="([^"]+)"[^>]*>/gi,
        (_match, word) => "<u>" + word + "</u>"
      );
      const answers = [];
      baseText.replace(/<u>([^<]+)<\/u>/gi, (_match, word) => {
        answers.push(word.trim());
        return _match;
      });
      return { baseText, answers };
    }
  };

  // src/shared/import/legacy-handlers/DropdownHandler.ts
  var DropdownHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("ListaIdevice");
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "form";
    }
    /**
     * Extract instructions HTML
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const instructionsArea = this.findDictInstance(dict, "instructionsForLearners");
      if (instructionsArea) {
        return this.extractTextAreaFieldContent(instructionsArea);
      }
      return "";
    }
    /**
     * Extract feedback content from the legacy format
     *
     * Legacy ListaIdevice has a "feedback" key containing a TextAreaField
     * with content_w_resourcePaths for the feedback text.
     *
     * @param dict - Dictionary element
     * @param context - Context with language info
     * @returns { content, buttonCaption }
     */
    extractFeedback(dict, context) {
      if (!dict) return { content: "", buttonCaption: "" };
      const defaultCaption = this.getLocalizedFeedbackText(context?.language);
      const feedbackField = this.findDictInstance(dict, "feedback");
      if (feedbackField) {
        const feedbackDict = this.getDirectChildByTagName(feedbackField, "dictionary");
        let buttonCaption = defaultCaption;
        if (feedbackDict) {
          const storedCaption = this.findDictStringValue(feedbackDict, "buttonCaption");
          buttonCaption = storedCaption || defaultCaption;
        }
        const content = this.extractTextAreaFieldContent(feedbackField);
        if (content) {
          return { content, buttonCaption };
        }
      }
      const feedbackTextArea = this.findDictInstance(dict, "feedbackTextArea");
      if (feedbackTextArea) {
        const feedbackDict = this.getDirectChildByTagName(feedbackTextArea, "dictionary");
        let buttonCaption = defaultCaption;
        if (feedbackDict) {
          const storedCaption = this.findDictStringValue(feedbackDict, "buttonCaption");
          buttonCaption = storedCaption || defaultCaption;
        }
        const content = this.extractTextAreaFieldContent(feedbackTextArea);
        if (content) {
          return { content, buttonCaption };
        }
      }
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties including questionsData, eXeFormInstructions, and feedback
     *
     * Based on Symfony OdeOldXmlDropdownIdevice.php:
     * - eXeFormInstructions comes from instructionsForLearners
     * - questionsData contains the dropdown questions with <u> tags preserved
     * - eXeIdeviceTextAfter contains the feedback content (form iDevice uses this field)
     *
     * @param dict - Dictionary element
     * @param _ideviceId - iDevice ID (unused)
     * @param context - Context with language info
     */
    extractProperties(dict, _ideviceId, context) {
      const questionsData = this.extractDropdownQuestions(dict);
      const instructions = this.extractHtmlView(dict);
      const feedback = this.extractFeedback(dict, context);
      if (questionsData.length > 0 || feedback.content) {
        const props = {};
        if (questionsData.length > 0) {
          props.questionsData = questionsData;
        }
        if (instructions) {
          props.eXeFormInstructions = instructions;
        }
        if (feedback.content) {
          props.eXeIdeviceTextAfter = feedback.content;
        }
        return props;
      }
      return {};
    }
    /**
     * Extract dropdown questions from the legacy format
     *
     * Structure can be:
     * - Single ListaField in _content key (most common in real legacy files)
     * - List of ListaField instances
     * - Each has: _encodedContent/content_w_resourcePaths, otras (wrong answers)
     *
     * @param dict - Dictionary element of the ListaIdevice
     * @returns Array of question objects in form iDevice format
     */
    extractDropdownQuestions(dict) {
      const questionsData = [];
      const contentField = this.findDictInstance(dict, "_content");
      if (contentField) {
        const className = contentField.getAttribute("class") || "";
        if (className.includes("ListaField")) {
          const question = this.extractSingleListaField(contentField);
          if (question) questionsData.push(question);
          return questionsData;
        }
      }
      const lists = this.getDirectChildrenByTagName(dict, "list");
      let questionsList = null;
      for (const list of lists) {
        const firstInst = this.getDirectChildByTagName(list, "instance");
        if (firstInst) {
          const className = firstInst.getAttribute("class") || "";
          if (className.includes("ListaField")) {
            questionsList = list;
            break;
          }
        }
      }
      if (!questionsList) {
        questionsList = this.findDictList(dict, "questions") || this.findDictList(dict, "_questions");
      }
      if (!questionsList) return questionsData;
      const questionInstances = this.getDirectChildrenByTagName(questionsList, "instance");
      for (const questionInst of questionInstances) {
        const question = this.extractSingleListaField(questionInst);
        if (question) questionsData.push(question);
      }
      return questionsData;
    }
    /**
     * Extract a single ListaField instance
     *
     * IMPORTANT: The baseText should preserve <u> tags as-is!
     * form.js (getProcessTextDropdownQuestion) will convert <u> tags to <select> elements.
     * See Symfony OdeOldXmlDropdownIdevice.php line 145 - it also keeps <u> tags.
     *
     * @param listaFieldInst - ListaField instance element
     * @returns Question object or null
     */
    extractSingleListaField(listaFieldInst) {
      const qDict = this.getDirectChildByTagName(listaFieldInst, "dictionary");
      if (!qDict) return null;
      let baseText = this.findDictStringValue(qDict, "_encodedContent") || this.findDictStringValue(qDict, "content_w_resourcePaths") || "";
      if (!baseText) {
        const questionTextArea = this.findDictInstance(qDict, "questionTextArea");
        baseText = questionTextArea ? this.extractTextAreaFieldContent(questionTextArea) : "";
      }
      const wrongAnswers = this.findDictStringValue(qDict, "otras") || this.findDictStringValue(qDict, "wrongAnswers") || this.findDictStringValue(qDict, "_wrongAnswers") || "";
      if (baseText) {
        return {
          activityType: "dropdown",
          baseText,
          wrongAnswersValue: wrongAnswers
        };
      }
      return null;
    }
  };

  // src/shared/import/legacy-handlers/ScormTestHandler.ts
  var ScormTestHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("ScormTestIdevice") || className.includes("QuizTestIdevice");
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "form";
    }
    /**
     * Extract HTML view - QuizTestIdevice doesn't have instructionsForLearners
     * per Symfony legacy which comments out eXeFormInstructions.
     */
    extractHtmlView(_dict, _context) {
      return "";
    }
    /**
     * No feedback at iDevice level for SCORM test
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties including questionsData, dropdownPassRate, etc.
     * Follows Symfony's OdeOldXmlScormTestIdevice.php pattern.
     */
    extractProperties(dict, _ideviceId) {
      if (!dict) return {};
      const questionsData = this.extractQuestions(dict);
      if (questionsData.length === 0) {
        return {};
      }
      const props = {
        questionsData,
        checkAddBtnAnswers: true,
        userTranslations: {
          langTrueFalseHelp: "Select whether the statement is true or false",
          langDropdownHelp: "Choose the correct answer among the options proposed",
          langSingleSelectionHelp: "Multiple choice with only one correct answer",
          langMultipleSelectionHelp: "Multiple choice with multiple corrects answers",
          langFillHelp: "Fill in the blanks with the appropriate word"
        }
      };
      const passRate = this.findDictStringValue(dict, "passRate");
      if (passRate) {
        props.dropdownPassRate = passRate;
      }
      return props;
    }
    /**
     * Extract questions from the legacy SCORM test format
     *
     * Structure:
     * - "questions" key contains a list of TestQuestion instances
     * - Each TestQuestion has: questionTextArea, options (list of AnswerOption)
     *
     * @param dict - Dictionary element of the ScormTestIdevice
     * @returns Array of question objects in form iDevice format
     */
    extractQuestions(dict) {
      const questionsData = [];
      const questionsList = this.findDictList(dict, "questions");
      if (!questionsList) return questionsData;
      const questions = this.getDirectChildrenByTagName(questionsList, "instance").filter(
        (inst) => (inst.getAttribute("class") || "").includes("TestQuestion")
      );
      for (const q of questions) {
        const qDict = this.getDirectChildByTagName(q, "dictionary");
        if (!qDict) continue;
        const questionTextArea = this.findDictInstance(qDict, "questionTextArea");
        const baseText = questionTextArea ? this.extractTextAreaFieldContent(questionTextArea) : "";
        const answers = this.extractOptions(qDict);
        const correctCount = answers.filter((a) => a[0] === true).length;
        const selectionType = correctCount > 1 ? "multiple" : "single";
        if (baseText || answers.length > 0) {
          questionsData.push({
            activityType: "selection",
            selectionType,
            baseText,
            answers
          });
        }
      }
      return questionsData;
    }
    /**
     * Extract answer options from a question dictionary
     *
     * @param qDict - Question dictionary element
     * @returns Array of [isCorrect, answerText] pairs
     */
    extractOptions(qDict) {
      const answers = [];
      const optionsList = this.findDictList(qDict, "options");
      if (!optionsList) return answers;
      const options = this.getDirectChildrenByTagName(optionsList, "instance").filter(
        (inst) => (inst.getAttribute("class") || "").includes("AnswerOption")
      );
      for (const opt of options) {
        const optDict = this.getDirectChildByTagName(opt, "dictionary");
        if (!optDict) continue;
        const answerTextArea = this.findDictInstance(optDict, "answerTextArea");
        let answerText = "";
        if (answerTextArea) {
          answerText = this.extractTextAreaFieldContent(answerTextArea);
          answerText = this.stripHtmlTags(answerText);
        }
        const isCorrect = this.findDictBoolValue(optDict, "isCorrect");
        if (answerText) {
          answers.push([isCorrect, answerText]);
        }
      }
      return answers;
    }
  };

  // src/shared/import/legacy-handlers/CaseStudyHandler.ts
  var CaseStudyHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     * Case-insensitive match for CasestudyIdevice and EjercicioresueltofpdIdevice
     */
    canHandle(className, _ideviceType) {
      const lowerName = className.toLowerCase();
      return lowerName.includes("casestudyidevice") || lowerName.includes("ejercicioresueltofpdidevice");
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "casestudy";
    }
    /**
     * Extract HTML view - returns empty for casestudy
     * All content goes in jsonProperties (history + activities)
     * because casestudy has componentType: 'json'
     */
    extractHtmlView(_dict, _context) {
      return "";
    }
    /**
     * No direct feedback for casestudy - activities have individual feedback
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties including history and activities
     * This populates jsonProperties for the casestudy editor
     *
     * @param dict - Dictionary element
     * @param _ideviceId - iDevice ID (unused)
     * @param context - Context with language info
     */
    extractProperties(dict, _ideviceId, context) {
      const defaultProperties = {
        history: "",
        activities: [],
        // Task info fields (new in modern format, not in legacy)
        textInfoDurationInput: "",
        textInfoDurationTextInput: "",
        textInfoParticipantsInput: "",
        textInfoParticipantsTextInput: ""
      };
      if (!dict) return defaultProperties;
      const properties = { ...defaultProperties };
      const storyTextArea = this.findDictInstance(dict, "storyTextArea");
      if (storyTextArea) {
        properties.history = this.extractTextAreaFieldContent(storyTextArea);
      } else {
        const storyInst = this.findDictInstance(dict, "story");
        if (storyInst) {
          properties.history = this.extractTextAreaFieldContent(storyInst);
        }
      }
      properties.activities = this.extractActivities(dict, context);
      return properties;
    }
    /**
     * Extract activities from the legacy format
     *
     * Structure:
     * - "questions" key contains a list of exe.engine.casestudyidevice.Question instances
     * - Each Question has: questionTextArea, feedbackTextArea
     *
     * @param dict - Dictionary element of the CaseStudyIdevice
     * @param context - Context with language info
     * @returns Array of activity objects
     */
    extractActivities(dict, context) {
      const activities = [];
      let activitiesList = this.findDictList(dict, "questions");
      if (!activitiesList) {
        const lists = this.getDirectChildrenByTagName(dict, "list");
        for (const list of lists) {
          const firstInst = this.getDirectChildByTagName(list, "instance");
          if (firstInst) {
            const className = firstInst.getAttribute("class") || "";
            if (className.includes("Question") || className.includes("CasestudyActivityField")) {
              activitiesList = list;
              break;
            }
          }
        }
      }
      if (!activitiesList) {
        activitiesList = this.findDictList(dict, "_activities");
      }
      if (!activitiesList) return activities;
      const activityInstances = this.getDirectChildrenByTagName(activitiesList, "instance");
      for (const activityInst of activityInstances) {
        const aDict = this.getDirectChildByTagName(activityInst, "dictionary");
        if (!aDict) continue;
        let activityTextArea = this.findDictInstance(aDict, "questionTextArea");
        if (!activityTextArea) {
          activityTextArea = this.findDictInstance(aDict, "activityTextArea");
        }
        const activityText = activityTextArea ? this.extractTextAreaFieldContent(activityTextArea) : "";
        let feedbackText = "";
        let buttonCaption = "";
        const feedbackTextArea = this.findDictInstance(aDict, "feedbackTextArea");
        if (feedbackTextArea) {
          feedbackText = this.extractTextAreaFieldContent(feedbackTextArea);
          const feedbackDict = this.getDirectChildByTagName(feedbackTextArea, "dictionary");
          if (feedbackDict) {
            buttonCaption = this.findDictStringValue(feedbackDict, "buttonCaption") || "";
          }
        }
        if (!feedbackText) {
          const instances = this.getDirectChildrenByTagName(aDict, "instance");
          const feedback2Field = instances.find(
            (inst) => (inst.getAttribute("class") || "").includes("Feedback2Field")
          );
          if (feedback2Field) {
            feedbackText = this.extractTextAreaFieldContent(feedback2Field);
            const fbDict = this.getDirectChildByTagName(feedback2Field, "dictionary");
            if (fbDict) {
              buttonCaption = this.findDictStringValue(fbDict, "buttonCaption") || "";
            }
          }
        }
        if (activityText || feedbackText) {
          const defaultCaption = this.getLocalizedFeedbackText(context?.language);
          activities.push({
            activity: activityText,
            feedback: feedbackText,
            buttonCaption: buttonCaption || defaultCaption
          });
        }
      }
      return activities;
    }
  };

  // src/shared/import/legacy-handlers/GalleryHandler.ts
  var GalleryHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("ImageGalleryIdevice") || className.includes("GalleryIdevice");
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "image-gallery";
    }
    /**
     * Extract any intro/description content
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const descriptionArea = this.findDictInstance(dict, "descriptionTextArea");
      if (descriptionArea) {
        return this.extractTextAreaFieldContent(descriptionArea);
      }
      return "";
    }
    /**
     * No feedback for gallery iDevice
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties in format expected by modern image-gallery iDevice
     *
     * Modern format uses indexed keys (img_0, img_1, etc.) with fields:
     * - img: image path with resources/ prefix
     * - thumbnail: thumbnail path with resources/ prefix (optional)
     * - title: caption text
     * - linktitle, author, linkauthor, license: attribution fields
     */
    extractProperties(dict, _ideviceId) {
      const images = this.extractImages(dict);
      const props = {};
      images.forEach((image, index) => {
        props[`img_${index}`] = {
          img: `resources/${image.src}`,
          // Add resources/ prefix
          thumbnail: image.thumbnail ? `resources/${image.thumbnail}` : "",
          // Include thumbnail with prefix
          title: image.caption || "",
          // caption -> title
          linktitle: "",
          // Not available in legacy format
          author: "",
          // Not available in legacy format
          linkauthor: "",
          // Not available in legacy format
          license: ""
          // Not available in legacy format
        };
      });
      return props;
    }
    /**
     * Extract images from the legacy format
     *
     * Legacy XML structure:
     * - "images" key points to a GalleryImages wrapper instance
     * - The actual list is inside that wrapper under ".listitems" key
     * - Each GalleryImage has: _imageResource, _caption (TextField), _thumbnailResource
     *
     * @param dict - Dictionary element of the GalleryIdevice
     * @returns Array of image objects
     */
    extractImages(dict) {
      const images = [];
      let imagesList = null;
      const imagesInstance = this.findDictInstance(dict, "images") || this.findDictInstance(dict, "_images");
      if (imagesInstance) {
        const imagesDict = this.getDirectChildByTagName(imagesInstance, "dictionary");
        if (imagesDict) {
          imagesList = this.findDictList(imagesDict, ".listitems");
        }
      }
      if (!imagesList) {
        const lists = this.getDirectChildrenByTagName(dict, "list");
        for (const list of lists) {
          const firstInst = this.getDirectChildByTagName(list, "instance");
          if (firstInst) {
            const className = firstInst.getAttribute("class") || "";
            if (className.includes("GalleryImage")) {
              imagesList = list;
              break;
            }
          }
        }
      }
      if (!imagesList) {
        imagesList = this.findDictList(dict, "_images") || this.findDictList(dict, "images") || this.findDictList(dict, "_userResources");
      }
      if (!imagesList) return images;
      const imageInstances = this.getDirectChildrenByTagName(imagesList, "instance");
      for (const imageInst of imageInstances) {
        const iDict = this.getDirectChildByTagName(imageInst, "dictionary");
        if (!iDict) continue;
        const imageResource = this.extractResourcePath(iDict, "_imageResource") || this.extractResourcePath(iDict, "imageResource");
        let caption = "";
        const captionInstance = this.findDictInstance(iDict, "_caption") || this.findDictInstance(iDict, "caption");
        if (captionInstance) {
          caption = this.extractTextAreaFieldContent(captionInstance);
        }
        if (!caption) {
          caption = this.findDictStringValue(iDict, "caption") || this.findDictStringValue(iDict, "_caption") || "";
        }
        let alt = "";
        const altInstance = this.findDictInstance(iDict, "_alt") || this.findDictInstance(iDict, "alt");
        if (altInstance) {
          alt = this.extractTextAreaFieldContent(altInstance);
        }
        if (!alt) {
          alt = this.findDictStringValue(iDict, "alt") || this.findDictStringValue(iDict, "_alt") || caption;
        }
        const thumbnail = this.extractResourcePath(iDict, "_thumbnailResource") || this.extractResourcePath(iDict, "thumbnailResource");
        if (imageResource) {
          const image = {
            src: imageResource,
            alt,
            caption
          };
          if (thumbnail) {
            image.thumbnail = thumbnail;
          }
          images.push(image);
        }
      }
      return images;
    }
  };

  // src/shared/import/legacy-handlers/ExternalUrlHandler.ts
  var ExternalUrlHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("ExternalUrlIdevice");
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "external-website";
    }
    /**
     * Generate HTML view with iframe containing the URL
     *
     * The external-website iDevice JavaScript expects htmlView to contain
     * an iframe with the src attribute set to the URL.
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const url = this.extractUrl(dict);
      if (!url) return "";
      const heightValue = this.findDictStringValue(dict, "height") || this.findDictStringValue(dict, "_height") || "300";
      let sizeOption = "2";
      const height = parseInt(heightValue, 10);
      if (height <= 200) {
        sizeOption = "1";
      } else if (height <= 300) {
        sizeOption = "2";
      } else if (height <= 500) {
        sizeOption = "3";
      } else {
        sizeOption = "4";
      }
      return `<div id="iframeWebsiteIdevice">
<iframe src="${url}" size="${sizeOption}" width="600" height="${height}" style="width:100%;"></iframe>
<div class="iframe-error-message" style="display:none;">Unable to display an iframe loaded over HTTP on a website that uses HTTPS.</div>
</div>`;
    }
    /**
     * No feedback for external URL iDevice
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties including URL
     */
    extractProperties(dict, _ideviceId) {
      if (!dict) return {};
      const props = {};
      const url = this.extractUrl(dict);
      if (url) {
        props.url = url;
      }
      const height = this.findDictStringValue(dict, "height") || this.findDictStringValue(dict, "_height");
      if (height) {
        props.height = height;
      }
      return props;
    }
    /**
     * Extract URL from the legacy format
     *
     * @param dict - Dictionary element of the ExternalUrlIdevice
     * @returns The URL or null
     */
    extractUrl(dict) {
      const urlFieldNames = ["url", "_url", "urlField", "_urlField", "websiteUrl"];
      for (const fieldName of urlFieldNames) {
        const urlValue = this.findDictStringValue(dict, fieldName);
        if (urlValue) {
          return urlValue;
        }
        const urlInst = this.findDictInstance(dict, fieldName);
        if (urlInst) {
          const urlDict = this.getDirectChildByTagName(urlInst, "dictionary");
          if (urlDict) {
            const content = this.findDictStringValue(urlDict, "content") || this.findDictStringValue(urlDict, "_content") || this.findDictStringValue(urlDict, "value") || this.findDictStringValue(urlDict, "_value");
            if (content) {
              return content;
            }
          }
        }
      }
      return null;
    }
  };

  // src/shared/import/legacy-handlers/FileAttachHandler.ts
  var FileAttachHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("FileAttachIdevice") || className.includes("AttachmentIdevice");
    }
    /**
     * Get the target modern iDevice type
     * Symfony converts to 'text' iDevice with file links in textTextarea
     */
    getTargetType() {
      return "text";
    }
    /**
     * Extract HTML content with instructions (introHTML) + file links
     *
     * Matches Symfony OdeOldXmlFileAttachIdevice.php format:
     * - First: introHTML content (instructions)
     * - Then: <p><a href="path" target="_blank">description</a></p> for each file
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const parts = [];
      const introHtml = this.extractIntroHtml(dict);
      if (introHtml) {
        parts.push(introHtml);
      }
      const files = this.extractFiles(dict);
      if (files.length > 0) {
        const fileLinks = files.map((file) => {
          const linkText = file.description || file.displayName || file.filename;
          return `<p><a href="${file.path}" target="_blank" download="${file.filename}">${linkText}</a></p>`;
        }).join("");
        parts.push(fileLinks);
      }
      return parts.join("");
    }
    /**
     * No feedback for file attach iDevice
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract introHTML content (instructions text)
     *
     * Legacy structure:
     * <string role="key" value="introHTML"/>
     * <instance class="exe.engine.field.TextAreaField">
     *   <dictionary>
     *     <string role="key" value="content_w_resourcePaths"/>
     *     <unicode value="<p>estas son las instrucciones</p>"/>
     *   </dictionary>
     * </instance>
     *
     * @param dict - Dictionary element of the iDevice
     * @returns HTML content from introHTML
     */
    extractIntroHtml(dict) {
      const introInstance = this.findDictInstance(dict, "introHTML");
      if (!introInstance) return "";
      return this.extractTextAreaFieldContent(introInstance);
    }
    /**
     * Extract properties for text iDevice
     *
     * Symfony sets textTextarea with the same HTML as htmlView
     */
    extractProperties(dict, _ideviceId) {
      const htmlView = this.extractHtmlView(dict);
      if (htmlView) {
        return { textTextarea: htmlView };
      }
      return {};
    }
    /**
     * Extract files from the legacy format
     *
     * FileAttachIdeviceInc structure:
     * - fileAttachmentFields: list of FileField instances
     * - Each FileField has: fileDescription (TextField), fileResource (Resource)
     *
     * @param dict - Dictionary element of the FileAttachIdevice
     * @returns Array of file objects
     */
    extractFiles(dict) {
      const files = [];
      let filesList = this.findDictList(dict, "fileAttachmentFields");
      if (!filesList) {
        const lists = this.getDirectChildrenByTagName(dict, "list");
        for (const list of lists) {
          const firstInst = this.getDirectChildByTagName(list, "instance");
          if (firstInst) {
            const className = firstInst.getAttribute("class") || "";
            if (className.includes("FileField") || className.includes("AttachmentField")) {
              filesList = list;
              break;
            }
          }
        }
      }
      if (!filesList) {
        filesList = this.findDictList(dict, "files") || this.findDictList(dict, "_files") || this.findDictList(dict, "attachments") || this.findDictList(dict, "_attachments");
      }
      if (!filesList) {
        const singleFile = this.extractSingleFile(dict);
        if (singleFile) {
          files.push(singleFile);
        }
        return files;
      }
      const fileInstances = this.getDirectChildrenByTagName(filesList, "instance");
      for (const fileInst of fileInstances) {
        const fDict = this.getDirectChildByTagName(fileInst, "dictionary");
        if (!fDict) continue;
        const file = this.extractFileFromDict(fDict);
        if (file) {
          files.push(file);
        }
      }
      return files;
    }
    /**
     * Extract file info from a dictionary
     *
     * FileAttachIdeviceInc FileField structure:
     * - fileResource: Resource with _storageName (filename in ZIP)
     * - fileDescription: TextField with content (description for link text)
     *
     * Based on Symfony OdeOldXmlFileAttachIdevice.php extraction
     */
    extractFileFromDict(fDict) {
      const filename = this.extractResourcePath(fDict, "fileResource") || this.extractResourcePath(fDict, "_fileResource") || this.extractResourcePath(fDict, "_resource") || this.findDictStringValue(fDict, "_storageName") || this.findDictStringValue(fDict, "storageName");
      if (!filename) return null;
      let description = "";
      const descInst = this.findDictInstance(fDict, "fileDescription");
      if (descInst) {
        const descDict = this.getDirectChildByTagName(descInst, "dictionary");
        if (descDict) {
          description = this.findDictStringValue(descDict, "content") || this.findDictStringValue(descDict, "_content") || "";
        }
      }
      if (!description) {
        description = this.findDictStringValue(fDict, "_description") || this.findDictStringValue(fDict, "description") || "";
      }
      if (!description) {
        description = filename;
      }
      const displayName = this.findDictStringValue(fDict, "_displayName") || this.findDictStringValue(fDict, "displayName") || this.findDictStringValue(fDict, "_label") || this.findDictStringValue(fDict, "label") || filename;
      const path = `resources/${filename}`;
      return {
        filename,
        displayName,
        description,
        path
      };
    }
    /**
     * Extract single file resource
     */
    extractSingleFile(dict) {
      const filename = this.extractResourcePath(dict, "fileResource") || this.extractResourcePath(dict, "_fileResource");
      if (!filename) return null;
      const displayName = this.findDictStringValue(dict, "_displayName") || this.findDictStringValue(dict, "displayName") || filename;
      const path = `resources/${filename}`;
      return {
        filename,
        displayName,
        description: filename,
        // Use filename as description (link text)
        path
      };
    }
  };

  // src/shared/import/legacy-handlers/ImageMagnifierHandler.ts
  var ImageMagnifierHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("ImageMagnifierIdevice");
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "magnifier";
    }
    /**
     * Extract any description/intro HTML
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const captionArea = this.findDictInstance(dict, "captionTextArea") || this.findDictInstance(dict, "descriptionTextArea");
      if (captionArea) {
        return this.extractTextAreaFieldContent(captionArea);
      }
      const caption = this.findDictStringValue(dict, "caption") || this.findDictStringValue(dict, "_caption");
      if (caption) {
        return `<p>${caption}</p>`;
      }
      return "";
    }
    /**
     * No feedback for magnifier iDevice
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties including image and magnifier settings
     * Property names MUST match what the modern magnifier editor expects
     *
     * Based on Symfony OdeOldXmlImageMagnifierIdevice.php (lines 240-254):
     * - textTextarea, defaultImage, glassSize, initialZSize, maxZSize
     * - width, height, imageResource, isDefaultImage, message, align
     */
    extractProperties(dict, _ideviceId) {
      const defaultProperties = {
        textTextarea: "",
        // Instructions (from htmlView/caption)
        imageResource: "",
        // Image path
        isDefaultImage: "1",
        // '0' = custom image, '1' = default
        width: "",
        // Image width
        height: "",
        // Image height
        align: "left",
        // Alignment
        initialZSize: "100",
        // Initial zoom (100, 150, 200, etc.)
        maxZSize: "150",
        // Max zoom
        glassSize: "2"
        // Magnifier size (1-6 range)
      };
      if (!dict) return defaultProperties;
      const props = { ...defaultProperties };
      const magnifierDict = this.getMagnifierFieldDict(dict);
      const textArea = this.findDictInstance(dict, "text");
      if (textArea) {
        props.textTextarea = this.extractTextAreaFieldContent(textArea);
      }
      const floatValue = this.findDictStringValue(dict, "float");
      if (floatValue) {
        props.align = floatValue;
      }
      if (magnifierDict) {
        const glassSize = this.findDictStringValue(magnifierDict, "glassSize");
        if (glassSize) {
          props.glassSize = glassSize;
        }
        const initialZSize = this.findDictStringValue(magnifierDict, "initialZSize");
        if (initialZSize) {
          props.initialZSize = initialZSize;
        }
        const maxZSize = this.findDictStringValue(magnifierDict, "maxZSize");
        if (maxZSize) {
          props.maxZSize = maxZSize;
        }
        const width = this.findDictStringValue(magnifierDict, "width");
        if (width) {
          props.width = width;
        }
        const height = this.findDictStringValue(magnifierDict, "height");
        if (height) {
          props.height = height;
        }
      }
      const imagePath = this.extractImagePath(dict);
      if (imagePath) {
        props.imageResource = imagePath;
        props.isDefaultImage = "0";
      }
      return props;
    }
    /**
     * Get the MagnifierField dictionary element
     */
    getMagnifierFieldDict(dict) {
      const magnifierInst = this.findDictInstance(dict, "imageMagnifier") || this.findDictInstance(dict, "_magnifierField") || this.findDictInstance(dict, "magnifierField");
      if (magnifierInst) {
        return this.getDirectChildByTagName(magnifierInst, "dictionary");
      }
      const magnifierByClass = this.getDirectChildrenByTagName(dict, "instance").find(
        (inst) => (inst.getAttribute("class") || "").includes("MagnifierField")
      );
      if (magnifierByClass) {
        return this.getDirectChildByTagName(magnifierByClass, "dictionary");
      }
      return null;
    }
    /**
     * Extract image path from the legacy format
     *
     * Based on Symfony OdeOldXmlImageMagnifierIdevice.php:
     * - imageMagnifier -> exe.engine.field.MagnifierField
     * - imageResource -> exe.engine.resource.Resource
     * - _storageName -> filename
     *
     * @param dict - Dictionary element of the ImageMagnifierIdevice
     * @returns The image path or null
     */
    extractImagePath(dict) {
      const magnifierInst = this.findDictInstance(dict, "imageMagnifier") || this.findDictInstance(dict, "_magnifierField") || this.findDictInstance(dict, "magnifierField");
      if (magnifierInst) {
        const mDict = this.getDirectChildByTagName(magnifierInst, "dictionary");
        if (mDict) {
          const path2 = this.extractResourcePath(mDict, "imageResource") || this.extractResourcePath(mDict, "_imageResource");
          if (path2) return `resources/${path2}`;
        }
      }
      const magnifierByClass = this.getDirectChildrenByTagName(dict, "instance").find(
        (inst) => (inst.getAttribute("class") || "").includes("MagnifierField")
      );
      if (magnifierByClass) {
        const mDict = this.getDirectChildByTagName(magnifierByClass, "dictionary");
        if (mDict) {
          const path2 = this.extractResourcePath(mDict, "imageResource") || this.extractResourcePath(mDict, "_imageResource");
          if (path2) return `resources/${path2}`;
        }
      }
      const path = this.extractResourcePath(dict, "_imageResource") || this.extractResourcePath(dict, "imageResource") || this.extractResourcePath(dict, "_imagePath");
      return path ? `resources/${path}` : null;
    }
  };

  // src/shared/import/legacy-handlers/GeogebraHandler.ts
  var GeogebraHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     * Also handles JsIdevice with geogebra-activity type
     *
     * @param className - Legacy class name
     * @param ideviceType - iDevice type from _iDeviceDir (for JsIdevice)
     */
    canHandle(className, ideviceType) {
      if (className.includes("GeogebraIdevice")) {
        return true;
      }
      if (ideviceType === "geogebra-activity") {
        return true;
      }
      return false;
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "geogebra-activity";
    }
    /**
     * Extract HTML view from GeoGebra content
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const fieldsList = this.findDictList(dict, "fields");
      if (fieldsList) {
        const textAreas2 = this.getDirectChildrenByTagName(fieldsList, "instance").filter(
          (inst) => (inst.getAttribute("class") || "").includes("TextAreaField")
        );
        for (const textArea of textAreas2) {
          const content = this.extractTextAreaFieldContent(textArea);
          if (content) {
            return content;
          }
        }
      }
      const textAreas = this.getDirectChildrenByTagName(dict, "instance").filter(
        (inst) => (inst.getAttribute("class") || "").includes("TextAreaField")
      );
      for (const textArea of textAreas) {
        const content = this.extractTextAreaFieldContent(textArea);
        if (content) {
          return content;
        }
      }
      return "";
    }
    /**
     * No feedback for geogebra iDevice
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties (none needed for geogebra-activity iDevice)
     */
    extractProperties(_dict, _ideviceId) {
      return {};
    }
  };

  // src/shared/import/legacy-handlers/InteractiveVideoHandler.ts
  var InteractiveVideoHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     *
     * @param className - Legacy class name
     * @param ideviceType - iDevice type from _iDeviceDir
     */
    canHandle(className, ideviceType) {
      if (ideviceType === "interactive-video") {
        return true;
      }
      if (className?.toLowerCase().includes("interactive-video")) {
        return true;
      }
      return false;
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "interactive-video";
    }
    /**
     * Extract HTML content and transform the InteractiveVideo script to JSON format
     * Based on Symfony OdeXmlUtil.php lines 2441-2476
     *
     * @param dict - Dictionary element
     * @param _context - Context with language, etc.
     * @returns Transformed HTML content
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const rawHtml = this.extractFieldsHtml(dict);
      if (!rawHtml) return "";
      if (!rawHtml.includes("exe-interactive-video")) {
        return rawHtml;
      }
      return this.transformInteractiveVideoScript(rawHtml);
    }
    /**
     * No feedback for interactive video iDevice
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Transform the legacy var InteractiveVideo = {...} script to modern JSON format
     *
     * Legacy format:
     * <script>
     *   //<![CDATA[
     *   var InteractiveVideo = {"slides":[...],...}
     *   //]]>
     * <\/script>
     *
     * Modern format:
     * <script id="exe-interactive-video-contents" type="application/json">
     *   {"slides":[...],...}
     * <\/script>
     *
     * @param html - HTML content with legacy script
     * @returns HTML with transformed script
     */
    transformInteractiveVideoScript(html) {
      let decodedHtml = this.decodeHtmlEntities(html);
      decodedHtml = decodedHtml.replace(/&#10;/g, "\n").replace(/&#13;/g, "\r");
      const varPattern = /var\s+InteractiveVideo\s*=\s*/gi;
      const varMatch = varPattern.exec(decodedHtml);
      if (!varMatch) {
        return decodedHtml;
      }
      const jsonStartPos = varMatch.index + varMatch[0].length;
      const jsonContent = this.findBalancedJson(decodedHtml, jsonStartPos);
      if (!jsonContent) {
        return decodedHtml;
      }
      let decoded = jsonContent.trim();
      decoded = decoded.replace(/(^|\s)\/\/[^\n\r]*/gm, "$1");
      decoded = decoded.replace(/,\s*([}\]])/g, "$1");
      let parsed = null;
      try {
        parsed = JSON.parse(decoded);
      } catch (_e) {
        try {
          const fixed = this.fixJsonQuotes(decoded);
          parsed = JSON.parse(fixed);
        } catch (_e2) {
          return decodedHtml;
        }
      }
      if (parsed) {
        const scriptStart = decodedHtml.lastIndexOf("<script", varMatch.index);
        let scriptEnd = decodedHtml.indexOf("<\/script>", jsonStartPos + jsonContent.length);
        if (scriptStart !== -1 && scriptEnd !== -1) {
          scriptEnd += "<\/script>".length;
          const before = decodedHtml.substring(0, scriptStart);
          const after = decodedHtml.substring(scriptEnd);
          const jsonStr = JSON.stringify(parsed);
          return before + `<script id="exe-interactive-video-contents" type="application/json">${jsonStr}<\/script>` + after;
        }
      }
      return decodedHtml;
    }
    /**
     * Find a balanced JSON object starting from a position in the string
     * Handles nested braces properly
     *
     * @param str - The string to search in
     * @param startPos - Position to start searching from
     * @returns The balanced JSON object or null if not found
     */
    findBalancedJson(str, startPos) {
      let depth = 0;
      let start = -1;
      for (let i = startPos; i < str.length; i++) {
        const char = str[i];
        if (char === "{") {
          if (depth === 0) start = i;
          depth++;
        } else if (char === "}") {
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
     *
     * @param str - String with HTML entities
     * @returns Decoded string
     */
    decodeHtmlEntities(str) {
      if (!str) return "";
      return str.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
    }
    /**
     * Fix unescaped quotes inside JSON string values
     * Based on Symfony OdeXmlUtil.php lines 2456-2462
     *
     * @param jsonStr - JSON string with potential issues
     * @returns Fixed JSON string
     */
    fixJsonQuotes(jsonStr) {
      return jsonStr.replace(/"((?:[^"\\]|\\.)*)"/g, (_match, content) => {
        const fixed = content.replace(/([^\\])"/g, '$1\\"').replace(/^"/g, '\\"');
        return `"${fixed}"`;
      });
    }
    /**
     * Extract HTML content from fields list (JsIdevice format)
     *
     * @param dict - Dictionary element
     * @returns HTML content
     */
    extractFieldsHtml(dict) {
      const contents = [];
      const children = this.getChildElements(dict);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === "fields") {
          const listEl = children[i + 1];
          if (listEl && listEl.tagName === "list") {
            const fieldInstances = this.getChildElements(listEl).filter((el) => el.tagName === "instance");
            for (const fieldInst of fieldInstances) {
              const fieldClass = fieldInst.getAttribute("class") || "";
              if (fieldClass.includes("TextAreaField") || fieldClass.includes("TextField")) {
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
      return contents.join("\n");
    }
    /**
     * Extract properties from the interactive video configuration
     * Parses the InteractiveVideo JSON and returns relevant properties
     *
     * @param dict - Dictionary element
     * @param ideviceId - ID of the iDevice
     * @param _context - Context with language, etc.
     * @returns Properties object
     */
    extractProperties(dict, ideviceId, _context) {
      if (!dict) return {};
      const html = this.extractHtmlView(dict);
      if (!html) return {};
      const jsonMatch = html.match(
        /<script[^>]*id="exe-interactive-video-contents"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/i
      );
      if (!jsonMatch || !jsonMatch[1]) {
        return this.extractLegacyProperties(html);
      }
      try {
        const config = JSON.parse(jsonMatch[1]);
        return {
          slides: config.slides || [],
          title: config.title || "",
          description: config.description || "",
          coverType: config.coverType || "text",
          i18n: config.i18n || {},
          scorm: config.scorm || {},
          scoreNIA: config.scoreNIA || false,
          evaluation: config.evaluation || false,
          evaluationID: config.evaluationID || "",
          ideviceID: config.ideviceID || ideviceId || ""
        };
      } catch (_e) {
        return {};
      }
    }
    /**
     * Extract properties from legacy format when transform fails
     *
     * @param html - HTML content
     * @returns Properties object
     */
    extractLegacyProperties(html) {
      const legacyMatch = html.match(/var\s+InteractiveVideo\s*=\s*(\{[\s\S]*?\});?\s*(?:\/\/|<\/script>)/i);
      if (!legacyMatch || !legacyMatch[1]) {
        return {};
      }
      try {
        let jsonStr = legacyMatch[1];
        jsonStr = this.decodeHtmlEntities(jsonStr);
        jsonStr = jsonStr.replace(/(^|\s)\/\/[^\n\r]*/gm, "$1");
        jsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
        const config = JSON.parse(jsonStr);
        return {
          slides: config.slides || [],
          title: config.title || "",
          description: config.description || "",
          coverType: config.coverType || "text",
          i18n: config.i18n || {},
          scorm: config.scorm || {}
        };
      } catch (_e) {
        return {};
      }
    }
  };

  // src/shared/import/legacy-handlers/GameHandler.ts
  var GAME_PATTERNS = {
    flipcards: "flipcards-DataGame",
    selecciona: "selecciona-DataGame",
    "selecciona-activity": "selecciona-DataGame",
    trivial: "trivial-DataGame",
    crossword: "crossword-DataGame",
    relate: "relate-DataGame",
    relaciona: "relaciona-DataGame",
    identify: "identify-DataGame",
    discover: "discover-DataGame",
    complete: "complete-DataGame",
    classify: "classify-DataGame",
    guess: "guess-DataGame",
    sort: "sort-DataGame",
    puzzle: "puzzle-DataGame",
    beforeafter: "beforeafter-DataGame",
    "word-search": "word-search-DataGame",
    "hidden-image": "hidden-image-DataGame",
    mathproblems: "mathproblems-DataGame",
    mathematicaloperations: "mathematicaloperations-DataGame",
    padlock: "padlock-DataGame",
    challenge: "challenge-DataGame",
    checklist: "checklist-DataGame",
    "quick-questions": "quick-questions-DataGame",
    "az-quiz-game": "az-quiz-game-DataGame",
    dragdrop: "dragdrop-DataGame",
    trueorfalse: "trueorfalse-DataGame",
    // Spanish legacy names
    mapa: "mapa-DataGame",
    rosco: "rosco-DataGame",
    videoquext: "videoquext-DataGame",
    vquext: "vquext-DataGame",
    quext: "quext-DataGame",
    desafio: "desafio-DataGame",
    candado: "candado-DataGame",
    adivina: "adivina-DataGame",
    clasifica: "clasifica-DataGame",
    completa: "completa-DataGame",
    descubre: "descubre-DataGame",
    identifica: "identifica-DataGame",
    sopa: "sopa-DataGame",
    ordena: "ordena-DataGame",
    seleccionamedias: "seleccionamedias-DataGame",
    listacotejo: "listacotejo-DataGame",
    informe: "informe-DataGame",
    crucigrama: "crucigrama-DataGame"
  };
  var ENCRYPTED_GAMES = [
    "selecciona",
    "selecciona-activity",
    "trivial",
    "identify",
    "discover",
    "complete",
    "classify",
    "guess",
    "sort",
    "puzzle",
    "relate",
    "relaciona",
    "hidden-image",
    "mathematicaloperations",
    "padlock",
    "challenge",
    "quick-questions",
    "az-quiz-game",
    "dragdrop",
    "trueorfalse",
    "mathproblems",
    "word-search",
    "checklist",
    // Spanish legacy names that use encryption
    "rosco",
    "videoquext",
    "vquext",
    "quext",
    "desafio",
    "candado",
    "adivina",
    "clasifica",
    "completa",
    "descubre",
    "identifica",
    "sopa",
    "ordena",
    "listacotejo",
    "informe",
    "crucigrama"
    // Note: 'mapa' is NOT encrypted - it uses plain JSON like flipcards
  ];
  var TYPE_MAP = {
    // Spanish -> English mappings
    selecciona: "quick-questions-multiple-choice",
    trivial: "quick-questions",
    mapa: "map",
    rosco: "az-quiz-game",
    videoquext: "quick-questions-video",
    vquext: "quick-questions-video",
    quext: "quick-questions",
    desafio: "challenge",
    candado: "padlock",
    adivina: "guess",
    clasifica: "classify",
    completa: "complete",
    descubre: "discover",
    identifica: "identify",
    sopa: "word-search",
    ordena: "sort",
    seleccionamedias: "select-media-files",
    listacotejo: "checklist",
    informe: "progress-report",
    crucigrama: "crossword",
    // These map to themselves (already correct)
    flipcards: "flipcards",
    crossword: "crossword",
    relate: "relate",
    relaciona: "relate",
    identify: "identify",
    discover: "discover",
    complete: "complete",
    classify: "classify",
    guess: "guess",
    sort: "sort",
    puzzle: "puzzle",
    beforeafter: "beforeafter",
    "word-search": "word-search",
    "hidden-image": "hidden-image",
    mathproblems: "mathproblems",
    mathematicaloperations: "mathematicaloperations",
    padlock: "padlock",
    challenge: "challenge",
    checklist: "checklist",
    "quick-questions": "quick-questions",
    "quick-questions-multiple-choice": "quick-questions-multiple-choice",
    "quick-questions-video": "quick-questions-video",
    "az-quiz-game": "az-quiz-game",
    map: "map",
    dragdrop: "dragdrop",
    trueorfalse: "trueorfalse",
    "select-media-files": "select-media-files",
    "progress-report": "progress-report"
  };
  var GameHandler = class extends BaseLegacyHandler {
    constructor() {
      super(...arguments);
      // Track detected game type for getTargetType()
      this._detectedType = null;
    }
    /**
     * Check if this handler can process the given legacy class
     * Handles JsIdevice types with game data
     *
     * @param className - Legacy class name
     * @param ideviceType - iDevice type from _iDeviceDir (e.g., 'flipcards-activity')
     */
    canHandle(className, ideviceType) {
      const gameTypes = Object.keys(GAME_PATTERNS);
      if (gameTypes.some((type) => className.toLowerCase().includes(type.toLowerCase()))) {
        return true;
      }
      if (ideviceType) {
        const normalizedType = ideviceType.replace(/-activity$/, "");
        if (gameTypes.includes(normalizedType)) {
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
        const normalized = this._detectedType.replace(/-activity$/, "");
        return TYPE_MAP[normalized] || normalized;
      }
      return "text";
    }
    /**
     * Extract HTML content from dictionary (game iDevices store HTML in fields list)
     * Also updates the DataGame div with decrypted/parsed JSON for proper rendering
     *
     * @param dict - Dictionary element
     * @returns HTML content with updated DataGame div
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const contents = [];
      const children = this.getChildElements(dict);
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.tagName === "string" && child.getAttribute("role") === "key" && child.getAttribute("value") === "fields") {
          const listEl = children[i + 1];
          if (listEl && listEl.tagName === "list") {
            const fieldInstances = this.getChildElements(listEl).filter((el) => el.tagName === "instance");
            for (const fieldInst of fieldInstances) {
              const fieldClass = fieldInst.getAttribute("class") || "";
              if (fieldClass.includes("TextAreaField") || fieldClass.includes("TextField")) {
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
      let html = contents.join("\n");
      html = this.updateDataGameDivInHtml(html);
      return html;
    }
    /**
     * No feedback for game iDevices
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Update the DataGame div in HTML with decrypted/parsed JSON
     *
     * IMPORTANT: Only updates NON-encrypted games (like flipcards).
     * For encrypted games, the DataGame div content is left as-is.
     *
     * @param html - HTML content
     * @returns Updated HTML (only for non-encrypted games)
     */
    updateDataGameDivInHtml(html) {
      if (!html) return html;
      for (const [gameType, divClass] of Object.entries(GAME_PATTERNS)) {
        const gameData = this.extractGameDataFromHtml(html, divClass);
        if (gameData !== null) {
          const isEncrypted = ENCRYPTED_GAMES.includes(gameType);
          if (isEncrypted) {
            return html;
          }
          let parsedData = null;
          if (gameData.trim().startsWith("{")) {
            parsedData = this.parseJson(gameData);
          }
          if (parsedData) {
            const newJson = JSON.stringify(parsedData);
            const escapedClass = divClass.replace(/-/g, "\\-");
            const regex = new RegExp(
              `(<div[^>]*class="[^"]*${escapedClass}[^"]*"[^>]*>)[\\s\\S]*?(<\\/div>)`,
              "i"
            );
            if (regex.test(html)) {
              return html.replace(regex, `$1${this.escapeHtml(newJson)}$2`);
            }
          }
          break;
        }
      }
      return html;
    }
    /**
     * Extract properties from game data div
     * Looks for *-DataGame divs and parses the JSON (encrypted or plain)
     */
    extractProperties(dict, _ideviceId) {
      const rawHtml = this.extractHtmlView(dict);
      if (!rawHtml) return {};
      for (const [gameType, divClass] of Object.entries(GAME_PATTERNS)) {
        const gameData = this.extractGameDataFromHtml(rawHtml, divClass);
        if (gameData !== null) {
          this._detectedType = gameType;
          const isEncrypted = ENCRYPTED_GAMES.includes(gameType);
          let parsedData = null;
          if (isEncrypted && gameData.startsWith("%")) {
            const decrypted = this.decrypt(gameData);
            parsedData = this.parseJson(decrypted);
          } else if (gameData.trim().startsWith("{")) {
            parsedData = this.parseJson(gameData);
          }
          if (parsedData) {
            return parsedData;
          }
        }
      }
      return {};
    }
    /**
     * Extract game data from HTML by finding the DataGame div
     * Uses regex for reliable extraction
     *
     * @param html - HTML content
     * @param divClass - Class name of the DataGame div
     * @returns Content of the DataGame div, or null if not found
     */
    extractGameDataFromHtml(html, divClass) {
      if (!html) return null;
      const escapedClass = divClass.replace(/-/g, "\\-");
      const patterns = [
        // Match div with class, capturing everything until closing </div>
        new RegExp(`<div[^>]*class="[^"]*${escapedClass}[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, "i"),
        // HTML-encoded quotes variant
        new RegExp(`<div[^>]*class=&quot;[^"]*${escapedClass}[^"]*&quot;[^>]*>([\\s\\S]*?)<\\/div>`, "i")
      ];
      for (const regex of patterns) {
        const match = html.match(regex);
        if (match?.[1]) {
          return match[1].trim();
        }
      }
      return null;
    }
    /**
     * Decrypt XOR-encrypted game data
     * Uses the same algorithm as $exeDevices.iDevice.gamification.helpers.decrypt()
     *
     * @param str - Encrypted string (URL-encoded, XOR key=146)
     * @returns Decrypted string
     */
    decrypt(str) {
      if (!str) return "";
      if (str === "undefined" || str === "null") return "";
      let decoded = str;
      try {
        decoded = decodeURIComponent(str);
      } catch (_e) {
        try {
          decoded = unescape(str);
        } catch (_e2) {
          return "";
        }
      }
      try {
        const key = 146;
        let output = "";
        for (let i = 0; i < decoded.length; i++) {
          output += String.fromCharCode(key ^ decoded.charCodeAt(i));
        }
        return output;
      } catch (_e) {
        return "";
      }
    }
    /**
     * Parse JSON string safely
     * Handles common issues like control characters in string values
     *
     * @param str - JSON string
     * @returns Parsed object or null
     */
    parseJson(str) {
      if (!str || typeof str !== "string") return null;
      str = str.trim();
      if (!str.startsWith("{") || !str.endsWith("}")) {
        const firstBrace = str.indexOf("{");
        const lastBrace = str.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          str = str.substring(firstBrace, lastBrace + 1);
        } else {
          return null;
        }
      }
      try {
        const obj = JSON.parse(str);
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          return obj;
        }
      } catch (_e) {
        try {
          const controlCharRegex = /[\x00-\x1F]/g;
          const fixedStr = str.replace(controlCharRegex, (char) => {
            const escapes = {
              "\n": "\\n",
              "\r": "\\r",
              "	": "\\t"
            };
            return escapes[char] || "";
          });
          const obj = JSON.parse(fixedStr);
          if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            return obj;
          }
        } catch (_e2) {
        }
      }
      return null;
    }
  };

  // src/shared/import/legacy-handlers/FpdSolvedExerciseHandler.ts
  var FpdSolvedExerciseHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("SolvedExerciseIdevice") || className.includes("EjercicioResueltoFpdIdevice") || className.includes("ejercicioresueltofpdidevice");
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "text";
    }
    /**
     * Extract HTML view combining story and questions with feedback
     *
     * @param dict - Dictionary element
     * @param context - Context with language info
     */
    extractHtmlView(dict, context) {
      if (!dict) return "";
      let html = "";
      const storyArea = this.findDictInstance(dict, "storyTextArea");
      if (storyArea) {
        const storyContent = this.extractTextAreaFieldContent(storyArea);
        if (storyContent) {
          html += storyContent;
        }
      }
      const questionsList = this.findDictList(dict, "questions");
      if (questionsList) {
        const questions = this.getDirectChildrenByTagName(questionsList, "instance").filter(
          (inst) => (inst.getAttribute("class") || "").includes("Question")
        );
        for (const q of questions) {
          const qDict = this.getDirectChildByTagName(q, "dictionary");
          if (!qDict) continue;
          const questionTextArea = this.findDictInstance(qDict, "questionTextArea");
          if (questionTextArea) {
            const questionContent = this.extractTextAreaFieldContent(questionTextArea);
            if (questionContent) {
              html += questionContent;
            }
          }
          const feedbackTextArea = this.findDictInstance(qDict, "feedbackTextArea");
          if (feedbackTextArea) {
            const feedbackContent = this.extractTextAreaFieldContent(feedbackTextArea);
            if (feedbackContent) {
              const feedbackDict = this.getDirectChildByTagName(feedbackTextArea, "dictionary");
              const defaultCaption = this.getLocalizedFeedbackText(context?.language);
              let buttonCaption = defaultCaption;
              if (feedbackDict) {
                const caption = this.findDictStringValue(feedbackDict, "buttonCaption");
                if (caption) {
                  buttonCaption = caption;
                }
              }
              html += `<div class="iDevice_buttons feedback-button js-required">
<input type="button" class="feedbacktooglebutton" value="${buttonCaption}" data-text-a="${buttonCaption}" data-text-b="${buttonCaption}">
</div>
<div class="feedback js-feedback js-hidden" style="display: none;">${feedbackContent}</div>`;
            }
          }
        }
      }
      return html;
    }
    /**
     * No feedback for FPD solved exercise iDevice (feedback is inline)
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties (none needed for text iDevice)
     */
    extractProperties(_dict, _ideviceId) {
      return {};
    }
  };

  // src/shared/import/legacy-handlers/WikipediaHandler.ts
  var WikipediaHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("WikipediaIdevice");
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "text";
    }
    /**
     * Extract HTML view from Wikipedia content
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const textAreas = this.getDirectChildrenByTagName(dict, "instance").filter(
        (inst) => (inst.getAttribute("class") || "").includes("TextAreaField")
      );
      let html = "";
      for (const textArea of textAreas) {
        const content = this.extractTextAreaFieldContent(textArea);
        if (content) {
          const cleanedContent = content.replace(/<p><\/p>/g, "");
          html += cleanedContent;
        }
      }
      if (!html) {
        const fieldsList = this.findDictList(dict, "fields");
        if (fieldsList) {
          const fields = this.getDirectChildrenByTagName(fieldsList, "instance").filter(
            (inst) => (inst.getAttribute("class") || "").includes("TextAreaField")
          );
          for (const field of fields) {
            const content = this.extractTextAreaFieldContent(field);
            if (content) {
              const cleanedContent = content.replace(/<p><\/p>/g, "");
              html += cleanedContent;
            }
          }
        }
      }
      if (html) {
        html = `<div class="exe-wikipedia-content">${html}</div>`;
      }
      return html;
    }
    /**
     * No feedback for Wikipedia iDevice
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties (none needed for text iDevice)
     */
    extractProperties(_dict, _ideviceId) {
      return {};
    }
  };

  // src/shared/import/legacy-handlers/RssHandler.ts
  var RssHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("RssIdevice");
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "text";
    }
    /**
     * Extract HTML view from RSS content
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const textAreas = this.getDirectChildrenByTagName(dict, "instance").filter(
        (inst) => (inst.getAttribute("class") || "").includes("TextAreaField")
      );
      let html = "";
      for (const textArea of textAreas) {
        const content = this.extractTextAreaFieldContent(textArea);
        if (content) {
          html += content;
        }
      }
      if (!html) {
        const fieldsList = this.findDictList(dict, "fields");
        if (fieldsList) {
          const fields = this.getDirectChildrenByTagName(fieldsList, "instance").filter(
            (inst) => (inst.getAttribute("class") || "").includes("TextAreaField")
          );
          for (const field of fields) {
            const content = this.extractTextAreaFieldContent(field);
            if (content) {
              html += content;
            }
          }
        }
      }
      return html;
    }
    /**
     * No feedback for RSS iDevice
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties (none needed for text iDevice)
     */
    extractProperties(_dict, _ideviceId) {
      return {};
    }
  };

  // src/shared/import/legacy-handlers/NotaHandler.ts
  var NotaHandler = class extends BaseLegacyHandler {
    /**
     * Check if this handler can process the given legacy class
     */
    canHandle(className, _ideviceType) {
      return className.includes("NotaIdevice") || className.includes("NotaInformacionIdevice");
    }
    /**
     * Get the target modern iDevice type
     */
    getTargetType() {
      return "text";
    }
    /**
     * Get block properties for Nota iDevices
     * These iDevices should have their block collapsed by default
     *
     * @returns Block properties with visibility: 'false'
     */
    getBlockProperties() {
      return {
        visibility: "false"
      };
    }
    /**
     * Extract HTML content from the legacy format
     * Nota iDevices store content in commentTextArea
     *
     * @param dict - Dictionary element from legacy XML
     */
    extractHtmlView(dict, _context) {
      if (!dict) return "";
      const commentTextArea = this.findDictInstance(dict, "commentTextArea");
      if (commentTextArea) {
        return this.extractTextAreaFieldContent(commentTextArea);
      }
      const contentTextArea = this.findDictInstance(dict, "content");
      if (contentTextArea) {
        return this.extractTextAreaFieldContent(contentTextArea);
      }
      const textAreaInst = this.getDirectChildrenByTagName(dict, "instance").find(
        (inst) => (inst.getAttribute("class") || "").includes("TextAreaField")
      );
      if (textAreaInst) {
        return this.extractTextAreaFieldContent(textAreaInst);
      }
      return "";
    }
    /**
     * No feedback for Nota iDevice
     */
    extractFeedback(_dict, _context) {
      return { content: "", buttonCaption: "" };
    }
    /**
     * Extract properties for text iDevice
     */
    extractProperties(_dict, _ideviceId) {
      return {};
    }
  };

  // src/shared/import/legacy-handlers/HandlerRegistry.ts
  var LEGACY_TYPE_MAP = {
    // Text/Content iDevices -> text
    FreeTextIdevice: "text",
    FreeTextfpdIdevice: "text",
    ReflectionIdevice: "text",
    ReflectionfpdIdevice: "text",
    GenericIdevice: "text",
    SolvedExerciseIdevice: "text",
    EjercicioResueltoFpdIdevice: "text",
    WikipediaIdevice: "text",
    RssIdevice: "text",
    // Quiz/Form iDevices -> form
    MultichoiceIdevice: "form",
    MultiSelectIdevice: "form",
    ListaIdevice: "form",
    // TrueFalse -> trueorfalse (dedicated iDevice type)
    TrueFalseIdevice: "trueorfalse",
    VerdaderoFalsoFPDIdevice: "trueorfalse",
    ClozeIdevice: "form",
    ClozeActivityIdevice: "form",
    ClozeLanguageIdevice: "form",
    ClozeLangIdevice: "form",
    ScormTestIdevice: "form",
    QuizTestIdevice: "form",
    // Case Study
    CaseStudyIdevice: "casestudy",
    // Media iDevices
    ImageGalleryIdevice: "image-gallery",
    ImageMagnifierIdevice: "magnifier",
    GalleryIdevice: "image-gallery",
    // File iDevices -> text with links
    FileAttachIdevice: "text",
    FileAttachIdeviceInc: "text",
    AttachmentIdevice: "text",
    // External content
    ExternalUrlIdevice: "external-website",
    GeogebraIdevice: "geogebra-activity",
    JavaAppIdevice: "java-app"
  };
  function getLegacyTypeName(className) {
    if (!className) return "text";
    const parts = className.split(".");
    const ideviceName = parts[parts.length - 1];
    if (LEGACY_TYPE_MAP[ideviceName]) {
      return LEGACY_TYPE_MAP[ideviceName];
    }
    const normalized = ideviceName.replace(/Idevice$/i, "").replace(/fpd$/i, "").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    return normalized || "text";
  }
  var LegacyHandlerRegistryClass = class {
    constructor() {
      this.handlers = null;
    }
    /**
     * Initialize handlers (called once when needed)
     */
    init() {
      if (this.handlers) return;
      this.handlers = [
        new MultichoiceHandler(),
        // MultichoiceIdevice, MultiSelectIdevice -> form
        new TrueFalseHandler(),
        // TrueFalseIdevice -> trueorfalse
        new FillHandler(),
        // ClozeIdevice, ClozeLanguageIdevice -> form (fill-in-blanks)
        new DropdownHandler(),
        // ListaIdevice -> form (dropdown questions)
        new ScormTestHandler(),
        // ScormTestIdevice, QuizTestIdevice -> form (SCORM quiz)
        new CaseStudyHandler(),
        // CaseStudyIdevice -> casestudy
        new GalleryHandler(),
        // ImageGalleryIdevice, GalleryIdevice -> image-gallery
        new ExternalUrlHandler(),
        // ExternalUrlIdevice -> external-website
        new FileAttachHandler(),
        // FileAttachIdevice, AttachmentIdevice -> text (with file links)
        new ImageMagnifierHandler(),
        // ImageMagnifierIdevice -> magnifier
        new GeogebraHandler(),
        // GeogebraIdevice -> geogebra-activity
        new InteractiveVideoHandler(),
        // JsIdevice interactive-video -> interactive-video
        new GameHandler(),
        // flipcards, selecciona, trivial, etc. -> game types
        new FpdSolvedExerciseHandler(),
        // SolvedExerciseIdevice -> text (with Q&A)
        new WikipediaHandler(),
        // WikipediaIdevice -> text (with wrapper)
        new RssHandler(),
        // RssIdevice -> text
        new NotaHandler(),
        // NotaIdevice -> text (with visibility=false block)
        new FreeTextHandler(),
        // FreeTextIdevice, ReflectionIdevice, GenericIdevice -> text
        new DefaultHandler()
        // Fallback for unknown types (must be last)
      ];
    }
    /**
     * Get the appropriate handler for a legacy iDevice class
     *
     * @param className - Legacy class name (e.g., 'exe.engine.multichoiceidevice.MultichoiceIdevice')
     * @param ideviceType - Optional iDevice type (e.g., 'flipcards-activity') for JsIdevice handlers
     * @returns Handler instance
     */
    getHandler(className, ideviceType) {
      this.init();
      for (const handler of this.handlers) {
        if (handler.canHandle(className, ideviceType)) {
          return handler;
        }
      }
      return this.handlers[this.handlers.length - 1];
    }
    /**
     * Get all registered handlers (for debugging/testing)
     *
     * @returns Array of handler instances
     */
    getAllHandlers() {
      this.init();
      return [...this.handlers];
    }
    /**
     * Reset handlers (useful for testing)
     */
    reset() {
      this.handlers = null;
    }
  };
  var LegacyHandlerRegistry = new LegacyHandlerRegistryClass();

  // src/shared/import/browser/index.ts
  if (typeof window !== "undefined") {
    window.LegacyHandlerRegistry = LegacyHandlerRegistry;
    window.LEGACY_TYPE_MAP = LEGACY_TYPE_MAP;
    window.getLegacyTypeName = getLegacyTypeName;
    const windowExports = {
      // Registry
      LegacyHandlerRegistry,
      LEGACY_TYPE_MAP,
      getLegacyTypeName,
      // Base class
      BaseLegacyHandler,
      // All handlers
      DefaultHandler,
      FreeTextHandler,
      MultichoiceHandler,
      TrueFalseHandler,
      GalleryHandler,
      CaseStudyHandler,
      FillHandler,
      DropdownHandler,
      ScormTestHandler,
      ExternalUrlHandler,
      FileAttachHandler,
      ImageMagnifierHandler,
      GeogebraHandler,
      InteractiveVideoHandler,
      GameHandler,
      FpdSolvedExerciseHandler,
      WikipediaHandler,
      RssHandler,
      NotaHandler
    };
    window.SharedImporters = windowExports;
    console.log("[SharedImporters] Browser import system loaded");
  }
})();
