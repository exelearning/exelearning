<?php

namespace App;

/**
 * Constants.
 */
class Constants
{
    public const APP_VERSION = 'v0.0.0-alpha';
    public const DEMO_EXPIRATION_DATE = '20250801'; // Expiration date for the offline beta versions: YYYYMMDD (empty for no expiration date)

    // Directories
    public const PUBLIC_DIR_NAME = 'public';
    public const IDEVICES_DIR_NAME = 'idevices';
    public const IDEVICES_BASE_DIR_NAME = 'base';
    public const IDEVICES_USERS_DIR_NAME = 'users';
    public const THEMES_DIR_NAME = 'themes';
    public const THEMES_BASE_DIR_NAME = 'base';
    public const THEMES_USERS_DIR_NAME = 'users';
    public const TRANSLATIONS_DIR_NAME = 'translations';
    public const LIBS_DIR = 'libs';
    public const FILEGATOR_DIR = 'filegator';
    public const FILEGATOR_JS_DIR = 'js';
    public const TINYMCE5_DIR = 'tinymce_5';
    public const TINYMCE5_JS_DIR = 'js';
    public const TINYMCE5_JS_TINYMCE_DIR = 'tinymce';
    public const TINYMCE5_JS_TINYMCE_LANGS_DIR = 'langs';
    public const JS_APP_NAME = 'app';
    public const COMMON_NAME = 'common';
    public const SCHEMAS_NAME = 'schemas';
    public const SCORM_NAME = 'scorm';
    public const FILES_DIR_NAME = 'files';
    public const TEMPORARY_CONTENT_STORAGE_DIRECTORY = 'tmp';
    public const PERMANENT_CONTENT_STORAGE_DIRECTORY = 'perm';
    public const PERMANENT_CONTENT_STORAGE_ODES_DIRECTORY = 'odes';
    public const FILEMANAGER_DIRECTORY = 'file_manager';
    public const DIST_DIR = 'dist';
    public const ODE_SESSION_TMP_DIR = 'tmp';
    public const STYLE_DIR_NAME = 'style';
    public const STYLE_IMAGES_DIR_NAME = 'images';
    public const WORKAREA_DIR_NAME = 'workarea';

    public const TINYMCE5_JS = 'tinymce_5'.DIRECTORY_SEPARATOR.'js'.DIRECTORY_SEPARATOR;
    public const TYNYMCE5_JS_PLUGINS = self::TINYMCE5_JS.'tinymce'.DIRECTORY_SEPARATOR.'plugins';

    // Default
    public const ODE_PAGE_NAME = 'New page';
    public const ORDER_DEFAULT_VALUE = 1;

    // Changelog
    public const CHANGELOG_FILE_NAME = 'ChangeLog';

    // Style export file
    public const WORKAREA_STYLE_BASE_CSS_FILENAME = 'base.css';

    // Files
    public const FILE_CHECKED_FILENAME = 'checked';
    public const FILE_CHECKED_VERSION = 'v01.00.10';

    // Themes
    public const THEME_DEFAULT = 'base';
    public const THEME_DEFAULT_CSS_FILE = 'content.css';
    public const THEME_GENERATED_CSS_FILE = 'generated.css';
    public const THEME_CONFIG_FILENAME = 'config.xml';
    public const THEME_ICONS_DIR = 'icons';
    public const THEME_HEADER_IMG_DIR = 'header';
    public const THEME_LOGO_IMG_DIR = 'logo';
    public const THEME_HEADER_IMG = 'header';
    public const THEME_LOGO_IMG = 'logo';
    public const THEME_TYPE_BASE = 'base';
    public const THEME_TYPE_USER = 'user';

    // iDevices
    public const IDEVICE_CONFIG_FILENAME = 'config.xml';
    public const IDEVICE_EDITION_DIR_NAME = 'edition';
    public const IDEVICE_EXPORT_DIR_NAME = 'export';
    public const IDEVICE_LANG_DIR_NAME = 'lang';
    public const IDEVICE_TYPE_BASE = 'base';
    public const IDEVICE_TYPE_USER = 'user';
    public const IDEVICE_VISIBILITY_PREFERENCE_PRE = 'preference-idevice-visibility-';
    public const IDEVICE_DOWNLOAD_SOURCE_FILE_NAME = 'download-source-file';
    public const IDEVICE_ELP_LINK_IN_EXE = 'exe-package:elp';
    public const IDEVICE_ELP_NAME_IN_EXE = 'exe-package:elp-name';
    public const IDEVICE_NODE_LINK_NAME_IN_EXE = 'exe-node:';

    // Blocks
    public const BLOCK_DEFAULT_ICON_LIST = [
        'text_snippet', 'accessibility_new', 'shuffle_on', 'smart_display', 'fact_check', 'calculate', 'list_alt',
        'sort_by_alpha', 'emoji_events', 'quiz', 'video_library', 'lock', 'language', 'photo_library',
        'download_for_offline', 'apps', 'home', 'info', 'favorite_border', 'star', 'question_answer',
        'lightbulb', 'public', 'analytics', 'timer',
    ];
    public const BLOCK_DEFAULT_ICON_TYPE = 'exe';

    // Translations
    public const TRANSLATION_FILENAME = 'messages'; // name for the generated translation files
    public const TRANSLATION_FILENAME_TMP_SUFFIX = 'previous_tmp'; // tmp translation filename suffix
    public const TRANSLATION_FILENAME_SUFFIX_TO_REMOVE = '+intl-icu'; // suffix to clean from translation filenames
    public const TRANSLATION_DEFAULT_FORMAT = 'xlf'; // format for translation files
    // Do not extract strings from these files:
    public const TRANSLATION_EXCEPTIONS = [
        '/app/public/app/common/fMath/js/jquery-ui/jquery-ui.min.js',
        '/app/public/libs/filegator/js/chunk-vendors.js',
        '/app/public/libs/jquery-ui/jquery-ui.min.js',
        '/app/public/files/perm/idevices/base/classify/export/0jquery-ui.min.js',
        '/app/public/files/perm/idevices/base/dragdrop/export/0jquery-ui.min.js',
        '/app/public/files/perm/idevices/base/relate/export/jquery-ui.min.js',
        '/app/public/files/perm/idevices/base/sort/export/jquery-ui.min.js',
    ];

    // Export dirs
    public const EXPORT_TMP_DIR = 'export';
    public const EXPORT_DIR_PUBLIC_LIBS = 'libs';
    public const EXPORT_DIR_PAGES_NAME = 'html';
    public const EXPORT_DIR_THEME = 'theme';
    public const EXPORT_DIR_IDEVICES = 'idevices';
    public const EXPORT_EPUB3_EXPORT_DIR_EPUB = 'EPUB';

    // Export types
    public const EXPORT_TYPE_ELP = 'elp';
    public const EXPORT_TYPE_HTML5 = 'html5';
    public const EXPORT_TYPE_HTML5_SP = 'html5-sp';
    public const EXPORT_TYPE_SCORM12 = 'scorm12';
    public const EXPORT_TYPE_SCORM2004 = 'scorm2004';
    public const EXPORT_TYPE_IMS = 'ims';
    public const EXPORT_TYPE_EPUB3 = 'epub3';

    // Export types filename suffixes
    public const SUFFIX_TYPE_HTML5 = '_web';
    public const SUFFIX_TYPE_HTML5_SP = '_page';
    public const SUFFIX_TYPE_SCORM12 = '_scorm';
    public const SUFFIX_TYPE_SCORM2004 = '_scorm2004';
    public const SUFFIX_TYPE_IMS = '_ims';

    // Export files
    public const EXPORT_FILE_INDEX_NAME = 'index';

    // SCORM XML
    public const SCORM_IMSMANIFEST_NAME = 'imsmanifest.xml';
    public const SCORM_IMSLRM_NAME = 'imslrm.xml';

    // ePub3 OPF
    public const EPUB3_PACKAGE_OPF_NAME = 'package.opf';
    public const EPUB3_NAV_XHTML = 'nav.xhtml';

    // Export dynamic idevices categories list (not added in ePub3 export)
    public const IDEVICES_DYNAMIC_CATEGORIES = ['Games', 'Interactive activities'];

    // Export - FILES - BASE
    public const EXPORT_SYMFONY_PUBLIC_FILES_BASE = [
        self::JS_APP_NAME.DIRECTORY_SEPARATOR.self::COMMON_NAME.DIRECTORY_SEPARATOR.'common_i18n.js',
        self::JS_APP_NAME.DIRECTORY_SEPARATOR.self::COMMON_NAME.DIRECTORY_SEPARATOR.'common.js',
        self::JS_APP_NAME.DIRECTORY_SEPARATOR.self::COMMON_NAME.DIRECTORY_SEPARATOR.'exe_export.js',
        self::JS_APP_NAME.DIRECTORY_SEPARATOR.self::COMMON_NAME.DIRECTORY_SEPARATOR.'exe_effects',
        self::JS_APP_NAME.DIRECTORY_SEPARATOR.self::COMMON_NAME.DIRECTORY_SEPARATOR.'exe_games',
        self::JS_APP_NAME.DIRECTORY_SEPARATOR.self::COMMON_NAME.DIRECTORY_SEPARATOR.'exe_highlighter',
        self::JS_APP_NAME.DIRECTORY_SEPARATOR.self::COMMON_NAME.DIRECTORY_SEPARATOR.'exe_lighbox',
        self::JS_APP_NAME.DIRECTORY_SEPARATOR.self::COMMON_NAME.DIRECTORY_SEPARATOR.'exe_tooltips',
        self::LIBS_DIR.DIRECTORY_SEPARATOR.self::TYNYMCE5_JS_PLUGINS,
        self::LIBS_DIR.DIRECTORY_SEPARATOR.'jquery',
        self::LIBS_DIR.DIRECTORY_SEPARATOR.'abcjs',
        self::LIBS_DIR.DIRECTORY_SEPARATOR.'bootstrap',
    ];

    // Export - FILES - SCHEMAS
    public const EXPORT_SYMFONY_PUBLIC_SCHEMAS = [
        // SCORM 1.2
        self::EXPORT_TYPE_SCORM12 => [self::EXPORT_TYPE_SCORM12],
        // SCORM 2004
        self::EXPORT_TYPE_SCORM2004 => [self::EXPORT_TYPE_SCORM2004],
        // IMS
        self::EXPORT_TYPE_IMS => [self::EXPORT_TYPE_IMS],
        // EPUB 3
        self::EXPORT_TYPE_EPUB3 => [self::EXPORT_TYPE_EPUB3],
    ];

    // Export - FILES - COMMON
    public const EXPORT_SYMFONY_PUBLIC_COMMON = [
        // SCORM 1.2
        self::EXPORT_TYPE_SCORM12 => [self::SCORM_NAME],
        // SCORM 2004
        self::EXPORT_TYPE_SCORM2004 => [self::SCORM_NAME],
    ];

    // Export - Scripts/Styles link - BASE
    public const EXPORT_SYMFONY_SCRIPTS_LOADING_ORDER_BASE = [
        self::EXPORT_DIR_PUBLIC_LIBS.'/jquery/jquery.min.js',
        self::EXPORT_DIR_PUBLIC_LIBS.'/common_i18n.js',
        self::EXPORT_DIR_PUBLIC_LIBS.'/common.js',
        self::EXPORT_DIR_PUBLIC_LIBS.'/exe_export.js',
        self::EXPORT_DIR_PUBLIC_LIBS.'/exe_effects/exe_effects.js',
        self::EXPORT_DIR_PUBLIC_LIBS.'/exe_effects/exe_effects.css',
        self::EXPORT_DIR_PUBLIC_LIBS.'/exe_games/exe_games.js',
        self::EXPORT_DIR_PUBLIC_LIBS.'/exe_games/exe_games.css',
        self::EXPORT_DIR_PUBLIC_LIBS.'/exe_highlighter/exe_highlighter.js',
        self::EXPORT_DIR_PUBLIC_LIBS.'/exe_highlighter/exe_highlighter.css',
        self::EXPORT_DIR_PUBLIC_LIBS.'/exe_tooltips/exe_tooltips.js',
        self::EXPORT_DIR_PUBLIC_LIBS.'/abcjs/abcjs-basic-min.js',
        self::EXPORT_DIR_PUBLIC_LIBS.'/abcjs/exe_abc_music.js',
        self::EXPORT_DIR_PUBLIC_LIBS.'/abcjs/abcjs-audio.css',
        self::EXPORT_DIR_PUBLIC_LIBS.'/bootstrap/bootstrap.bundle.min.js',
        self::EXPORT_DIR_PUBLIC_LIBS.'/bootstrap/bootstrap.min.css',
    ];

    // Export - Scripts/Styles link
    public const EXPORT_SYMFONY_SCRIPTS_LOADING_BY_EXPORT = [
        // SCORM 1.2
        self::EXPORT_TYPE_SCORM12 => [DIRECTORY_SEPARATOR.'SCORM_API_wrapper.js', DIRECTORY_SEPARATOR.'SCOFunctions.js'],
        // SCORM 2004
        self::EXPORT_TYPE_SCORM2004 => [DIRECTORY_SEPARATOR.'SCORM_API_wrapper.js', DIRECTORY_SEPARATOR.'SCOFunctions.js'],
    ];

    // Export - Content DIR
    public const EXPORT_DIR_CONTENT_BY_EXPORT = [
        // ePub3
        self::EXPORT_TYPE_EPUB3 => self::EXPORT_EPUB3_EXPORT_DIR_EPUB,
    ];

    // File extensions
    public const FILE_EXTENSION_SEPARATOR = '.';
    public const FILE_EXTENSION_JS = 'js';
    public const FILE_EXTENSION_CSS = 'css';
    public const FILE_EXTENSION_HTML = 'html';
    public const FILE_EXTENSION_HTM = 'htm';
    public const FILE_EXTENSION_XHTML = 'xhtml';
    public const FILE_EXTENSION_ELP = 'elp';
    public const FILE_EXTENSION_ZIP = 'zip';
    public const FILE_EXTENSION_EPUB = 'epub';
    public const FILE_EXTENSION_XML = 'xml';

    // CSV separator
    public const CSV_ITEM_SEPARATOR = ',';

    // ELP types
    public const ELP_NAME_SEPARATOR = '_';
    public const IDEVICE_ELP_NAME = 'idevice';
    public const BLOCK_ELP_NAME = 'block';
    public const DEFAULT_ELP_NAME = 'untitled';

    // ELP files extencion
    public const ELP_FILES_AVAILABLE_EXTS = [
        self::FILE_EXTENSION_ELP, self::FILE_EXTENSION_ZIP,
    ];
    public const ELP_LOCAL_FILES_AVAILABLE_EXTS = [
        self::FILE_EXTENSION_ELP,
        self::FILE_EXTENSION_ZIP,
        self::FILE_EXTENSION_XML,
        self::IDEVICE_ELP_NAME,
        self::BLOCK_ELP_NAME,
    ];

    // ELP properties
    public const ELP_PROPERTIES_NO_TITLE_NAME = 'Untitled document'; // In case properties_name null or "" put this title
    public const ELP_PROPERTIES_NO_CATALOG_NAME = 'My Catalog'; // In case properties_catalog null or "" put this catalog

    // Thumbnails filter properties
    public const THUMBNAIL_FILTER_PROPERTIES = [
        '120_120' => [
            'quality' => 75,
            'upscale' => [
                'min' => [770, 770], // width and height
            ],
            'thumbnail' => [
                'size' => [120, 120], // width and height
                'mode' => 'inset', // performs a non-cropping relative resize.
            ],
        ],
        '240_240' => [
            'quality' => 85,
            'upscale' => [
                'min' => [770, 770], // width and height
            ],
            'thumbnail' => [
                'size' => [240, 240], // width and height
                'mode' => 'inset', // performs a non-cropping relative resize.
            ],
        ],
    ];
    public const DEFAULT_THUMBNAIL_FILTER = '120_120';

    // Permanent save
    public const PERMANENT_SAVE_CONTENT_FILENAME = 'content.xml';
    public const OLD_PERMANENT_SAVE_CONTENT_FILENAME_V3 = 'contentv3.xml';
    public const OLD_PERMANENT_SAVE_CONTENT_FILENAME_V2 = 'contentv2.xml';

    public const PERMANENT_SAVE_CUSTOM_FILES_DIRNAME = 'custom';
    public const PERMANENT_SAVE_CONTENT_DIRNAME = 'content';
    public const PERMANENT_SAVE_CONTENT_CSS_DIRNAME = 'css';
    public const PERMANENT_SAVE_CONTENT_JS_DIRNAME = 'js';
    public const PERMANENT_SAVE_CONTENT_RESOURCES_DIRNAME = 'resources';
    public const PERMANENT_SAVE_CONTENT_RESOURCES_DOCUMENTS_DIRNAME = 'documents';
    public const PERMANENT_SAVE_CONTENT_RESOURCES_ICONS_DIRNAME = 'icons';
    public const PERMANENT_SAVE_CONTENT_RESOURCES_IMG_DIRNAME = 'img';
    public const PERMANENT_SAVE_CONTENT_RESOURCES_MEDIA_DIRNAME = 'media';

    public const PERMANENT_SAVE_ODE_DIR_STRUCTURE = [
        self::PERMANENT_SAVE_CUSTOM_FILES_DIRNAME => null,
        self::PERMANENT_SAVE_CONTENT_DIRNAME => [
            self::PERMANENT_SAVE_CONTENT_CSS_DIRNAME => null,
            self::PERMANENT_SAVE_CONTENT_RESOURCES_DIRNAME => null,
        ],
    ];

    public const PERMANENT_SAVE_ODE_COMPONENT_DIR_STRUCTURE = [
        // self::PERMANENT_SAVE_CONTENT_RESOURCES_DOCUMENTS_DIRNAME => null,
        // self::PERMANENT_SAVE_CONTENT_RESOURCES_ICONS_DIRNAME => null,
        // self::PERMANENT_SAVE_CONTENT_RESOURCES_IMG_DIRNAME => null,
        // self::PERMANENT_SAVE_CONTENT_RESOURCES_MEDIA_DIRNAME => null,
    ];

    // Constant to show modal already logged user (seconds)
    public const MODAL_CLIENT_ALREADY_LOGGED_USER_TIME = 30;
    // Client timeout for server response (milliseconds)
    public const CLIENT_CALL_WAITING_TIME = 20000;

    // Client interval get last edition (milliseconds)
    public const CLIENT_INTERVAL_GET_LAST_EDITION = 20000;

    // Client interval get updates (milliseconds)
    public const CLIENT_INTERVAL_GET_UPDATES = 3000;

    // Url web slash
    public const SLASH = '/';

    // Key to send when a new element must be generated
    public const GENERATE_NEW_ITEM_KEY = 'new';

    // Page root node
    public const ROOT_NODE_IDENTIFIER = 'root';

    // Max disk space by user for offline version (in MB)
    public const INSTALLATION_TYPE_OFFLINE_DEFAULT_DISK_SPACE = PHP_INT_MAX;

    // Session
    public const SESSION_GOOGLE_CODE = 'SESSION_GOOGLE_CODE';
    public const SESSION_GOOGLE_ACCESS_TOKEN = 'SESSION_GOOGLE_ACCESS_TOKEN';
    public const SESSION_DROPBOX_CODE = 'SESSION_DROPBOX_CODE';
    public const SESSION_DROPBOX_ACCESS_TOKEN = 'SESSION_DROPBOX_ACCESS_TOKEN';
    public const SESSION_INSTALLED_IDEVICES = 'SESSION_INSTALLED_IDEVICES';
    public const SAVE_INSTALLED_IDEVICES_IN_SESSION = false;
    public const SESSION_INSTALLED_THEMES = 'SESSION_INSTALLED_THEMES';
    public const SAVE_INSTALLED_THEMES_IN_SESSION = false;
    public const SESSION_USER_DATA = 'SESSION_USER_DATA';

    // Gravatar (empty string to disable gravatar icons)
    public const GRAVATAR_BASE_URL = 'https://www.gravatar.com/avatar/';
}
