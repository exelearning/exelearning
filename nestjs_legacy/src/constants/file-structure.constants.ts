/**
 * File structure constants for ELP file creation and storage
 * Matches Symfony's permanent save structure
 */

export const FILE_STRUCTURE = {
    /**
     * Content XML filename
     * This is the main XML file inside the ELP archive
     */
    PERMANENT_SAVE_CONTENT_FILENAME: 'content.xml',

    /**
     * ELP file extension
     */
    FILE_EXTENSION_ELP: 'elpx',

    /**
     * Separator between odeId and odeVersionId in filename
     * Format: {odeId}_{odeVersionId}.elpx
     */
    ELP_NAME_SEPARATOR: '_',

    /**
     * File extension separator (dot)
     */
    FILE_EXTENSION_SEPARATOR: '.',

    /**
     * Directory structure inside ELP file
     * Structure created in dist directory before zipping:
     *
     * dist/{sessionId}/
     * ├── content.xml
     * ├── custom/              (file manager uploads)
     * └── content/
     *     ├── css/             (custom CSS files)
     *     └── resources/       (iDevice assets)
     *         ├── {ideviceId1}/
     *         └── {ideviceId2}/
     */
    PERMANENT_SAVE_ODE_DIR_STRUCTURE: {
        custom: null, // Flat directory for file manager uploads
        content: {
            css: null, // Custom CSS files
            resources: null, // iDevice assets (subdirs per iDevice)
        },
    },

    /**
     * Directory names used in ELP structure
     */
    DIR_NAMES: {
        CUSTOM: 'custom', // File manager uploads directory
        CONTENT: 'content', // Main content directory
        CSS: 'css', // CSS subdirectory
        RESOURCES: 'resources', // iDevice assets subdirectory
    },

    /**
     * Permanent storage subdirectories
     */
    STORAGE_DIRS: {
        PERMANENT: 'perm', // Permanent storage root
        ODES: 'odes', // ODE files subdirectory
        DIST: 'dist', // Distribution/temporary build directory
        TEMP: 'tmp', // Temporary files directory
    },
};

/**
 * Default property values for new projects
 */
export const DEFAULT_PROPERTIES = {
    NO_TITLE_NAME: 'Untitled Project',
};

/**
 * Autosave configuration
 */
export const AUTOSAVE_CONFIG = {
    /**
     * Maximum number of autosave files to keep per project
     * Older autosaves are automatically deleted
     */
    MAX_AUTOSAVE_FILES: 10,

    /**
     * Default autosave interval in milliseconds
     */
    DEFAULT_INTERVAL_MS: 60000, // 1 minute
};
