/**
 * Unified Export System - Constants
 *
 * Contains iDevice configurations, library patterns, and export format constants.
 * These are used by both frontend (browser) and backend (CLI) export code.
 */

import type { IdeviceConfig, LibraryPattern } from './interfaces';

// =============================================================================
// Export Formats
// =============================================================================

/**
 * Supported export formats
 */
export enum ExportFormat {
    HTML5 = 'html5',
    HTML5_SINGLE_PAGE = 'html5-sp',
    SCORM_12 = 'scorm12',
    SCORM_2004 = 'scorm2004',
    IMS = 'ims',
    EPUB3 = 'epub3',
    ELPX = 'elpx',
}

/**
 * Export format metadata
 */
export const EXPORT_FORMAT_INFO: Record<
    ExportFormat,
    { name: string; extension: string; suffix: string; description: string }
> = {
    [ExportFormat.HTML5]: {
        name: 'HTML5 Website',
        extension: '.zip',
        suffix: '_web',
        description: 'Multi-page HTML5 website',
    },
    [ExportFormat.HTML5_SINGLE_PAGE]: {
        name: 'HTML5 Single Page',
        extension: '.zip',
        suffix: '_sp',
        description: 'Single-page HTML5 with anchor navigation',
    },
    [ExportFormat.SCORM_12]: {
        name: 'SCORM 1.2',
        extension: '.zip',
        suffix: '_scorm12',
        description: 'SCORM 1.2 package for LMS',
    },
    [ExportFormat.SCORM_2004]: {
        name: 'SCORM 2004',
        extension: '.zip',
        suffix: '_scorm2004',
        description: 'SCORM 2004 package for LMS',
    },
    [ExportFormat.IMS]: {
        name: 'IMS Content Package',
        extension: '.zip',
        suffix: '_ims',
        description: 'IMS Content Package standard',
    },
    [ExportFormat.EPUB3]: {
        name: 'EPUB3',
        extension: '.epub',
        suffix: '',
        description: 'EPUB3 ebook format',
    },
    [ExportFormat.ELPX]: {
        name: 'eXeLearning Project',
        extension: '.elpx',
        suffix: '',
        description: 'Native eXeLearning project format',
    },
};

// =============================================================================
// iDevice Configurations
// =============================================================================

/**
 * iDevice type configurations
 * Maps iDevice type names to their CSS class, component type, and template
 *
 * Based on directory listing from: public/files/perm/idevices/base/
 */
export const IDEVICE_CONFIGS: Record<string, IdeviceConfig> = {
    // Text and content
    text: { cssClass: 'text', componentType: 'json', template: 'text.html' },
    FreeTextIdevice: { cssClass: 'text', componentType: 'json', template: 'text.html' },
    TextIdevice: { cssClass: 'text', componentType: 'json', template: 'text.html' },

    // Forms and quizzes
    form: { cssClass: 'form', componentType: 'json', template: 'form.html' },
    QuizActivity: { cssClass: 'form', componentType: 'json', template: 'form.html' },
    MultipleChoiceIdevice: { cssClass: 'form', componentType: 'json', template: 'form.html' },

    // Interactive activities - Basic
    guess: { cssClass: 'guess', componentType: 'json', template: 'guess.html' },
    Guess: { cssClass: 'guess', componentType: 'json', template: 'guess.html' },

    checklist: { cssClass: 'checklist', componentType: 'json', template: 'checklist.html' },
    Checklist: { cssClass: 'checklist', componentType: 'json', template: 'checklist.html' },

    rubric: { cssClass: 'rubric', componentType: 'json', template: 'rubric.html' },
    Rubric: { cssClass: 'rubric', componentType: 'json', template: 'rubric.html' },

    casestudy: { cssClass: 'casestudy', componentType: 'json', template: 'casestudy.html' },
    CaseStudy: { cssClass: 'casestudy', componentType: 'json', template: 'casestudy.html' },

    challenge: { cssClass: 'challenge', componentType: 'json', template: 'challenge.html' },
    Challenge: { cssClass: 'challenge', componentType: 'json', template: 'challenge.html' },

    flipcards: { cssClass: 'flipcards', componentType: 'json', template: 'flipcards.html' },
    FlipCards: { cssClass: 'flipcards', componentType: 'json', template: 'flipcards.html' },

    crossword: { cssClass: 'crossword', componentType: 'json', template: 'crossword.html' },
    Crossword: { cssClass: 'crossword', componentType: 'json', template: 'crossword.html' },

    trivial: { cssClass: 'trivial', componentType: 'json', template: 'trivial.html' },
    Trivial: { cssClass: 'trivial', componentType: 'json', template: 'trivial.html' },
    TrivialPursuit: { cssClass: 'trivial', componentType: 'json', template: 'trivial.html' },

    trueorfalse: { cssClass: 'trueorfalse', componentType: 'json', template: 'trueorfalse.html' },
    TrueOrFalse: { cssClass: 'trueorfalse', componentType: 'json', template: 'trueorfalse.html' },

    // Interactive activities - Advanced
    discover: { cssClass: 'discover', componentType: 'json', template: 'discover.html' },
    Discover: { cssClass: 'discover', componentType: 'json', template: 'discover.html' },

    example: { cssClass: 'example', componentType: 'json', template: 'example.html' },
    Example: { cssClass: 'example', componentType: 'json', template: 'example.html' },

    identify: { cssClass: 'identify', componentType: 'json', template: 'identify.html' },
    Identify: { cssClass: 'identify', componentType: 'json', template: 'identify.html' },

    classify: { cssClass: 'classify', componentType: 'json', template: 'classify.html' },
    Classify: { cssClass: 'classify', componentType: 'json', template: 'classify.html' },

    relate: { cssClass: 'relate', componentType: 'json', template: 'relate.html' },
    Relate: { cssClass: 'relate', componentType: 'json', template: 'relate.html' },

    sort: { cssClass: 'sort', componentType: 'json', template: 'sort.html' },
    Sort: { cssClass: 'sort', componentType: 'json', template: 'sort.html' },

    complete: { cssClass: 'complete', componentType: 'json', template: 'complete.html' },
    Complete: { cssClass: 'complete', componentType: 'json', template: 'complete.html' },

    dragdrop: { cssClass: 'dragdrop', componentType: 'json', template: 'dragdrop.html' },
    DragDrop: { cssClass: 'dragdrop', componentType: 'json', template: 'dragdrop.html' },

    // Media
    'image-gallery': { cssClass: 'image-gallery', componentType: 'json', template: 'image-gallery.html' },
    ImageGallery: { cssClass: 'image-gallery', componentType: 'json', template: 'image-gallery.html' },

    'interactive-video': {
        cssClass: 'interactive-video',
        componentType: 'json',
        template: 'interactive-video.html',
    },
    InteractiveVideo: {
        cssClass: 'interactive-video',
        componentType: 'json',
        template: 'interactive-video.html',
    },

    'select-media-files': {
        cssClass: 'select-media-files',
        componentType: 'json',
        template: 'select-media-files.html',
    },
    SelectMediaFiles: {
        cssClass: 'select-media-files',
        componentType: 'json',
        template: 'select-media-files.html',
    },

    // Games
    'az-quiz-game': { cssClass: 'az-quiz-game', componentType: 'json', template: 'az-quiz-game.html' },
    AzQuizGame: { cssClass: 'az-quiz-game', componentType: 'json', template: 'az-quiz-game.html' },

    'word-search': { cssClass: 'word-search', componentType: 'json', template: 'word-search.html' },
    WordSearch: { cssClass: 'word-search', componentType: 'json', template: 'word-search.html' },

    puzzle: { cssClass: 'puzzle', componentType: 'json', template: 'puzzle.html' },
    Puzzle: { cssClass: 'puzzle', componentType: 'json', template: 'puzzle.html' },

    padlock: { cssClass: 'padlock', componentType: 'json', template: 'padlock.html' },
    Padlock: { cssClass: 'padlock', componentType: 'json', template: 'padlock.html' },

    'hidden-image': { cssClass: 'hidden-image', componentType: 'json', template: 'hidden-image.html' },
    HiddenImage: { cssClass: 'hidden-image', componentType: 'json', template: 'hidden-image.html' },

    beforeafter: { cssClass: 'beforeafter', componentType: 'json', template: 'beforeafter.html' },
    BeforeAfter: { cssClass: 'beforeafter', componentType: 'json', template: 'beforeafter.html' },

    'scrambled-list': { cssClass: 'scrambled-list', componentType: 'json', template: 'scrambled-list.html' },
    ScrambledList: { cssClass: 'scrambled-list', componentType: 'json', template: 'scrambled-list.html' },

    // Math and Science
    mathematicaloperations: {
        cssClass: 'mathematicaloperations',
        componentType: 'json',
        template: 'mathematicaloperations.html',
    },
    MathematicalOperations: {
        cssClass: 'mathematicaloperations',
        componentType: 'json',
        template: 'mathematicaloperations.html',
    },

    mathproblems: { cssClass: 'mathproblems', componentType: 'json', template: 'mathproblems.html' },
    MathProblems: { cssClass: 'mathproblems', componentType: 'json', template: 'mathproblems.html' },

    'periodic-table': { cssClass: 'periodic-table', componentType: 'json', template: 'periodic-table.html' },
    PeriodicTable: { cssClass: 'periodic-table', componentType: 'json', template: 'periodic-table.html' },

    // External content
    'external-website': {
        cssClass: 'external-website',
        componentType: 'json',
        template: 'external-website.html',
    },
    ExternalWebsite: {
        cssClass: 'external-website',
        componentType: 'json',
        template: 'external-website.html',
    },

    'geogebra-activity': {
        cssClass: 'geogebra-activity',
        componentType: 'json',
        template: 'geogebra-activity.html',
    },
    GeogebraActivity: {
        cssClass: 'geogebra-activity',
        componentType: 'json',
        template: 'geogebra-activity.html',
    },

    map: { cssClass: 'map', componentType: 'json', template: 'map.html' },
    Map: { cssClass: 'map', componentType: 'json', template: 'map.html' },

    // Utilities
    'attached-files': { cssClass: 'attached-files', componentType: 'json', template: 'attached-files.html' },
    AttachedFiles: { cssClass: 'attached-files', componentType: 'json', template: 'attached-files.html' },

    'download-source-file': {
        cssClass: 'download-source-file',
        componentType: 'json',
        template: 'download-source-file.html',
    },
    DownloadSourceFile: {
        cssClass: 'download-source-file',
        componentType: 'json',
        template: 'download-source-file.html',
    },

    'progress-report': { cssClass: 'progress-report', componentType: 'json', template: 'progress-report.html' },
    ProgressReport: { cssClass: 'progress-report', componentType: 'json', template: 'progress-report.html' },

    // Learning design
    'udl-content': { cssClass: 'udl-content', componentType: 'json', template: 'udl-content.html' },
    UdlContent: { cssClass: 'udl-content', componentType: 'json', template: 'udl-content.html' },
    UDLContent: { cssClass: 'udl-content', componentType: 'json', template: 'udl-content.html' },

    // Quick questions
    'quick-questions': { cssClass: 'quick-questions', componentType: 'json', template: 'quick-questions.html' },
    QuickQuestions: { cssClass: 'quick-questions', componentType: 'json', template: 'quick-questions.html' },

    'quick-questions-multiple-choice': {
        cssClass: 'quick-questions-multiple-choice',
        componentType: 'json',
        template: 'quick-questions-multiple-choice.html',
    },
    QuickQuestionsMultipleChoice: {
        cssClass: 'quick-questions-multiple-choice',
        componentType: 'json',
        template: 'quick-questions-multiple-choice.html',
    },

    'quick-questions-video': {
        cssClass: 'quick-questions-video',
        componentType: 'json',
        template: 'quick-questions-video.html',
    },
    QuickQuestionsVideo: {
        cssClass: 'quick-questions-video',
        componentType: 'json',
        template: 'quick-questions-video.html',
    },

    // Image tools
    magnifier: { cssClass: 'magnifier', componentType: 'json', template: 'magnifier.html' },
    Magnifier: { cssClass: 'magnifier', componentType: 'json', template: 'magnifier.html' },
    ImageMagnifierIdevice: { cssClass: 'magnifier', componentType: 'json', template: 'magnifier.html' },

    // Collaborative
    'collaborative-editing': {
        cssClass: 'collaborative-editing',
        componentType: 'json',
        template: 'collaborative-editing.html',
    },
    CollaborativeEditing: {
        cssClass: 'collaborative-editing',
        componentType: 'json',
        template: 'collaborative-editing.html',
    },
};

/**
 * Get iDevice configuration for a type
 * Falls back to derived config if type is unknown
 */
export function getIdeviceConfig(ideviceType: string): IdeviceConfig {
    if (IDEVICE_CONFIGS[ideviceType]) {
        return IDEVICE_CONFIGS[ideviceType];
    }

    // Fallback: derive from type name
    const typeName = ideviceType.toLowerCase().replace('idevice', '');
    return {
        cssClass: typeName,
        componentType: 'json',
        template: `${typeName}.html`,
    };
}

// =============================================================================
// Library Patterns (for detecting required JS/CSS libraries)
// =============================================================================

/**
 * Library detection patterns
 * Used to scan HTML content and determine which libraries to include
 */
export const LIBRARY_PATTERNS: LibraryPattern[] = [
    // Effects library (animations, transitions)
    {
        name: 'exe_effects',
        type: 'class',
        pattern: 'exe-fx',
        files: ['exe_effects/exe_effects.js', 'exe_effects/exe_effects.css'],
    },

    // Games library
    {
        name: 'exe_games',
        type: 'class',
        pattern: 'exe-game',
        files: ['exe_games/exe_games.js', 'exe_games/exe_games.css'],
    },

    // Code highlighting
    {
        name: 'exe_highlighter',
        type: 'class',
        pattern: 'highlighted-code',
        files: ['exe_highlighter/exe_highlighter.js', 'exe_highlighter/exe_highlighter.css'],
    },

    // Lightbox for images
    {
        name: 'exe_lightbox',
        type: 'rel',
        pattern: 'lightbox',
        files: ['exe_lightbox/exe_lightbox.js', 'exe_lightbox/exe_lightbox.css'],
    },

    // Lightbox for image galleries
    {
        name: 'exe_lightbox_gallery',
        type: 'class',
        pattern: 'imageGallery',
        files: ['exe_lightbox/exe_lightbox.js', 'exe_lightbox/exe_lightbox.css'],
    },

    // Tooltips (qTip2)
    {
        name: 'exe_tooltips',
        type: 'class',
        pattern: 'exe-tooltip',
        files: [
            'exe_tooltips/exe_tooltips.js',
            'exe_tooltips/jquery.qtip.min.js',
            'exe_tooltips/jquery.qtip.min.css',
            'exe_tooltips/imagesloaded.pkg.min.js',
        ],
    },

    // Image magnifier
    {
        name: 'exe_magnify',
        type: 'class',
        pattern: 'ImageMagnifierIdevice',
        files: ['exe_magnify/mojomagnify.js'],
    },

    // Wikipedia content styling
    {
        name: 'exe_wikipedia',
        type: 'class',
        pattern: 'exe-wikipedia-content',
        files: ['exe_wikipedia/exe_wikipedia.css'],
    },

    // Media player (MediaElement.js)
    {
        name: 'exe_media',
        type: 'class',
        pattern: 'mediaelement',
        files: [
            'exe_media/exe_media.js',
            'exe_media/exe_media.css',
            'exe_media/exe_media_background.png',
            'exe_media/exe_media_bigplay.png',
            'exe_media/exe_media_bigplay.svg',
            'exe_media/exe_media_controls.png',
            'exe_media/exe_media_controls.svg',
            'exe_media/exe_media_loading.gif',
        ],
    },

    // Media player via audio/video file links with lightbox
    {
        name: 'exe_media_link',
        type: 'regex',
        pattern: /href="[^"]*\.(mp3|mp4|flv|ogg|ogv)"[^>]*rel="[^"]*lightbox/i,
        files: [
            'exe_media/exe_media.js',
            'exe_media/exe_media.css',
            'exe_media/exe_media_background.png',
            'exe_media/exe_media_bigplay.png',
            'exe_media/exe_media_bigplay.svg',
            'exe_media/exe_media_controls.png',
            'exe_media/exe_media_controls.svg',
            'exe_media/exe_media_loading.gif',
        ],
    },

    // ABC Music notation (abcjs)
    {
        name: 'abcjs',
        type: 'class',
        pattern: 'abc-music',
        files: ['abcjs/abcjs-basic-min.js', 'abcjs/exe_abc_music.js', 'abcjs/abcjs-audio.css'],
    },

    // LaTeX math expressions (MathJax)
    {
        name: 'exe_math',
        type: 'regex',
        pattern: /\\\(|\\\[/,
        files: ['exe_math/tex-mml-svg.js'],
    },

    // DataGame with encrypted LaTeX (special case)
    {
        name: 'exe_math_datagame',
        type: 'class',
        pattern: 'DataGame',
        files: ['exe_math/tex-mml-svg.js'],
        requiresLatexCheck: true,
    },

    // Mermaid diagrams
    {
        name: 'mermaid',
        type: 'class',
        pattern: 'mermaid',
        files: ['mermaid/mermaid.min.js'],
    },

    // jQuery UI for sortable/draggable iDevices
    {
        name: 'jquery_ui_ordena',
        type: 'class',
        pattern: 'ordena-IDevice',
        files: ['jquery-ui/jquery-ui.min.js'],
    },
    {
        name: 'jquery_ui_clasifica',
        type: 'class',
        pattern: 'clasifica-IDevice',
        files: ['jquery-ui/jquery-ui.min.js'],
    },
    {
        name: 'jquery_ui_relaciona',
        type: 'class',
        pattern: 'relaciona-IDevice',
        files: ['jquery-ui/jquery-ui.min.js'],
    },
    {
        name: 'jquery_ui_dragdrop',
        type: 'class',
        pattern: 'dragdrop-IDevice',
        files: ['jquery-ui/jquery-ui.min.js'],
    },
    {
        name: 'jquery_ui_completa',
        type: 'class',
        pattern: 'completa-IDevice',
        files: ['jquery-ui/jquery-ui.min.js'],
    },

    // Accessibility toolbar
    {
        name: 'exe_atools',
        type: 'class',
        pattern: 'exe-atools',
        files: ['exe_atools/exe_atools.js', 'exe_atools/exe_atools.css'],
    },
];

// =============================================================================
// Base Libraries (always included in exports)
// =============================================================================

/**
 * Base libraries always included in exports
 * Order matters: jQuery must load before Bootstrap
 */
export const BASE_LIBRARIES = [
    // jQuery
    'jquery/jquery.min.js',
    // Common eXe scripts
    'common_i18n.js',
    'common.js',
    'exe_export.js',
    // Bootstrap (JS bundle includes Popper)
    'bootstrap/bootstrap.bundle.min.js',
    'bootstrap/bootstrap.bundle.min.js.map',
    'bootstrap/bootstrap.min.css',
    'bootstrap/bootstrap.min.css.map',
] as const;

/**
 * SCORM-specific libraries
 */
export const SCORM_LIBRARIES = ['scorm/SCORM_API_wrapper.js', 'scorm/SCOFunctions.js'] as const;

// =============================================================================
// MIME Type to Extension Mapping
// =============================================================================

/**
 * MIME type to file extension mapping
 */
export const MIME_TO_EXTENSION: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/x-icon': '.ico',
    'application/pdf': '.pdf',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogv',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/webm': '.weba',
    'application/zip': '.zip',
    'application/json': '.json',
    'text/plain': '.txt',
    'text/html': '.html',
    'text/css': '.css',
    'application/javascript': '.js',
    'application/octet-stream': '.bin',
};

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMime(mime: string): string {
    return MIME_TO_EXTENSION[mime] || '.bin';
}

// =============================================================================
// XML Namespaces
// =============================================================================

/**
 * SCORM 1.2 XML namespaces
 */
export const SCORM_12_NAMESPACES = {
    imscp: 'http://www.imsproject.org/xsd/imscp_rootv1p1p2',
    adlcp: 'http://www.adlnet.org/xsd/adlcp_rootv1p2',
    imsmd: 'http://www.imsglobal.org/xsd/imsmd_v1p2',
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
} as const;

/**
 * SCORM 2004 XML namespaces
 */
export const SCORM_2004_NAMESPACES = {
    imscp: 'http://www.imsglobal.org/xsd/imscp_v1p1',
    adlcp: 'http://www.adlnet.org/xsd/adlcp_v1p3',
    adlseq: 'http://www.adlnet.org/xsd/adlseq_v1p3',
    adlnav: 'http://www.adlnet.org/xsd/adlnav_v1p3',
    imsss: 'http://www.imsglobal.org/xsd/imsss',
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
} as const;

/**
 * IMS Content Package namespaces
 */
export const IMS_NAMESPACES = {
    imscp: 'http://www.imsglobal.org/xsd/imscp_v1p1',
    imsmd: 'http://www.imsglobal.org/xsd/imsmd_v1p2',
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
} as const;

/**
 * LOM metadata namespaces
 */
export const LOM_NAMESPACES = {
    lom: 'http://ltsc.ieee.org/xsd/LOM',
    xsi: 'http://www.w3.org/2001/XMLSchema-instance',
} as const;

/**
 * EPUB3 XML namespaces
 */
export const EPUB3_NAMESPACES = {
    OPF: 'http://www.idpf.org/2007/opf',
    DC: 'http://purl.org/dc/elements/1.1/',
    XHTML: 'http://www.w3.org/1999/xhtml',
    EPUB: 'http://www.idpf.org/2007/ops',
    CONTAINER: 'urn:oasis:names:tc:opendocument:xmlns:container',
} as const;

/**
 * EPUB3 MIME type
 */
export const EPUB3_MIMETYPE = 'application/epub+zip';
