/**
 * Legacy iDevice Handler Registry
 *
 * Maps legacy iDevice class names to their handlers.
 * Handlers are checked in order - first match wins.
 *
 * DefaultHandler is always last as fallback.
 *
 * Requires these files to be loaded first:
 * - BaseLegacyHandler.js
 * - handlers/MultichoiceHandler.js
 * - handlers/TrueFalseHandler.js
 * - handlers/FreeTextHandler.js
 * - handlers/CaseStudyHandler.js
 * - handlers/FillHandler.js
 * - handlers/DropdownHandler.js
 * - handlers/GalleryHandler.js
 * - handlers/ExternalUrlHandler.js
 * - handlers/FileAttachHandler.js
 * - handlers/ImageMagnifierHandler.js
 * - handlers/GameIdeviceHandler.js
 * - handlers/ScormTestHandler.js
 * - handlers/FpdSolvedExerciseHandler.js
 * - handlers/RssHandler.js
 * - handlers/WikipediaHandler.js
 * - handlers/GeogebraHandler.js
 * - handlers/InteractiveVideoHandler.js
 * - handlers/NotaHandler.js
 * - handlers/DefaultHandler.js
 */

/**
 * Registered handlers in priority order
 * More specific handlers should come before generic ones
 */
const LegacyHandlerRegistry = {
  handlers: null,

  /**
   * Initialize handlers (called once when needed)
   */
  init() {
    if (this.handlers) return;

    this.handlers = [
      new MultichoiceHandler(),      // MultichoiceIdevice, MultiSelectIdevice → form
      new TrueFalseHandler(),        // TrueFalseIdevice → trueorfalse
      new FillHandler(),             // ClozeIdevice, ClozeLanguageIdevice → form (fill-in-blanks)
      new DropdownHandler(),         // ListaIdevice → form (dropdown questions)
      new ScormTestHandler(),        // ScormTestIdevice, QuizTestIdevice → form (SCORM quiz)
      new CaseStudyHandler(),        // CaseStudyIdevice → casestudy
      new GalleryHandler(),          // ImageGalleryIdevice, GalleryIdevice → image-gallery
      new ExternalUrlHandler(),      // ExternalUrlIdevice → external-website
      new FileAttachHandler(),       // FileAttachIdevice, AttachmentIdevice → text (with file links)
      new ImageMagnifierHandler(),   // ImageMagnifierIdevice → magnifier
      new GeogebraHandler(),         // GeogebraIdevice → geogebra-activity
      new InteractiveVideoHandler(), // JsIdevice interactive-video → interactive-video
      new GameIdeviceHandler(),      // flipcards, selecciona, trivial, etc. → game types
      new FpdSolvedExerciseHandler(),// SolvedExerciseIdevice → text (with Q&A)
      new WikipediaHandler(),        // WikipediaIdevice → text (with wrapper)
      new RssHandler(),              // RssIdevice → text
      new NotaHandler(),             // NotaIdevice → text (with visibility=false block)
      new FreeTextHandler(),         // FreeTextIdevice, ReflectionIdevice, GenericIdevice → text
      new DefaultHandler(),          // Fallback for unknown types (must be last)
    ];
  },

  /**
   * Get the appropriate handler for a legacy iDevice class
   * @param {string} className - Legacy class name (e.g., 'exe.engine.multichoiceidevice.MultichoiceIdevice')
   * @param {string} [ideviceType] - Optional iDevice type (e.g., 'flipcards-activity') for JsIdevice handlers
   * @returns {BaseLegacyHandler} Handler instance
   */
  getHandler(className, ideviceType) {
    this.init();
    for (const handler of this.handlers) {
      if (handler.canHandle(className, ideviceType)) {
        return handler;
      }
    }
    // Should never reach here since DefaultHandler.canHandle() returns true
    return this.handlers[this.handlers.length - 1];
  },

  /**
   * Get all registered handlers (for debugging/testing)
   * @returns {Array<BaseLegacyHandler>} Array of handler instances
   */
  getAllHandlers() {
    this.init();
    return [...this.handlers];
  }
};

/**
 * Legacy type name to modern type name mapping
 * This is used for type normalization when handlers don't provide specific mapping
 */
const LEGACY_TYPE_MAP = {
  // Text/Content iDevices → text
  'FreeTextIdevice': 'text',
  'FreeTextfpdIdevice': 'text',
  'ReflectionIdevice': 'text',
  'ReflectionfpdIdevice': 'text',
  'GenericIdevice': 'text',
  'SolvedExerciseIdevice': 'text',
  'EjercicioResueltoFpdIdevice': 'text',
  'WikipediaIdevice': 'text',
  'RssIdevice': 'text',

  // Quiz/Form iDevices → form
  'MultichoiceIdevice': 'form',
  'MultiSelectIdevice': 'form',
  'ListaIdevice': 'form',

  // TrueFalse → trueorfalse (dedicated iDevice type)
  'TrueFalseIdevice': 'trueorfalse',
  'VerdaderoFalsoFPDIdevice': 'trueorfalse',
  'ClozeIdevice': 'form',
  'ClozeActivityIdevice': 'form',
  'ClozeLanguageIdevice': 'form',
  'ClozeLangIdevice': 'form',
  'ScormTestIdevice': 'form',
  'QuizTestIdevice': 'form',

  // Case Study
  'CaseStudyIdevice': 'casestudy',

  // Media iDevices
  'ImageGalleryIdevice': 'image-gallery',
  'ImageMagnifierIdevice': 'magnifier',
  'GalleryIdevice': 'image-gallery',

  // File iDevices → text with links (Symfony: OdeOldXmlFileAttachIdevice)
  'FileAttachIdevice': 'text',
  'FileAttachIdeviceInc': 'text',
  'AttachmentIdevice': 'text',

  // External content
  'ExternalUrlIdevice': 'external-website',
  'GeogebraIdevice': 'geogebra-activity',
  'JavaAppIdevice': 'java-app',
};

/**
 * Get modern type name from legacy class name
 * Falls back to extracting type from class name
 * @param {string} className - Legacy class name
 * @returns {string} Modern type name
 */
function getLegacyTypeName(className) {
  if (!className) return 'text';

  // Extract the iDevice name from class (e.g., 'exe.engine.freetextidevice.FreeTextIdevice' → 'FreeTextIdevice')
  const parts = className.split('.');
  const ideviceName = parts[parts.length - 1];

  // Check mapping
  if (LEGACY_TYPE_MAP[ideviceName]) {
    return LEGACY_TYPE_MAP[ideviceName];
  }

  // Fallback: normalize the iDevice name
  // Remove 'Idevice' suffix and convert to kebab-case
  const normalized = ideviceName
    .replace(/Idevice$/i, '')
    .replace(/fpd$/i, '')  // Remove FPD suffix
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();

  return normalized || 'text';
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LegacyHandlerRegistry, LEGACY_TYPE_MAP, getLegacyTypeName };
} else {
  window.LegacyHandlerRegistry = LegacyHandlerRegistry;
  window.LEGACY_TYPE_MAP = LEGACY_TYPE_MAP;
  window.getLegacyTypeName = getLegacyTypeName;
}
