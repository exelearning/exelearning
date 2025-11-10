<?php

namespace App;

/**
 * Settings.
 */
class Settings
{
    // Possible rea platforms integrated with the application
    // To review (this might not be necessary)
    public const PLATFORMS = [
        [    // Moodle platforms using JWT
            'set' => 'set_ode.php',
            'get' => 'get_ode.php',
            'name' => 'Moodle',
            'type' => 1,
            'api' => 2,
        ],
    ];

    // Set allowed mime types
    public const ALLOWED_MIME_TYPES = [
        'application/epub+zip',
        'application/gzip',
        'application/json',
        'application/msword',
        'application/pdf',
        'application/rtf',
        'application/vnd.ms-excel',
        'application/vnd.ms-powerpoint',
        'application/vnd.oasis.opendocument.presentation',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.rar',
        'application/x-gzip',
        'application/x-subrip',
        'application/xhtml+xml',
        'application/xml',
        'application/zip',
        'audio/3gpp',
        'audio/aac',
        'audio/midi',
        'audio/mpeg',
        'audio/mpeg3',
        'audio/ogg',
        'audio/wav',
        'audio/webm',
        'audio/x-midi',
        'audio/x-mpeg-3',
        'audio/x-wav',
        'font/woff',
        'font/woff2',
        'image/gif',
        'image/jpeg',
        'image/png',
        'image/svg+xml',
        'image/webp',
        'model/gltf-binary',
        'text/css',
        'text/csv',
        'text/html',
        'text/javascript',
        'text/plain',
        'text/vtt',
        'text/xml',
        'video/3gpp',
        'video/mp4',
        'video/mpeg',
        'video/ogg',
        'video/webm',
    ];

    public const PLATFORM_INTEGRATION = 0; // Active integrated platform (Set here the api value from PLATFORMS array)

    public const JWT_SECRET_HASH = 'HS256'; // JWT Signature algorithm
    // public const JWT_SECRET_KEY = $_ENV['APP_SECRET']; // JWT secret key shared
    // define('COOKIE_DOMAIN', getenv('COOKIE_DOMAIN'));

    // Active locales for which translations will be extracted
    public const LOCALES = [
        'en' => 'English',
        'es' => 'Español',
        'ca' => 'Català',
        'eu' => 'Euskara',
        'gl' => 'Galego',
        'va' => 'Valencià',
        'pt' => 'Português',
        'ro' => 'Română',
        'eo' => 'Esperanto',
    ];
    public const DEFAULT_LOCALE = 'en';

    // Active locales for which translations will be extracted
    public const PACKAGE_LOCALES = [
        'am' => 'አማርኛ', // Amharic አማርኛ
        'ar' => 'العربية',  // Arabic
        'ast' => 'asturianu',
        'bg' => 'Български', // Bulgarian
        'bn' => 'বাংলা', // Bengali
        'br' => 'Brezhoneg', // Breton
        'ca' => 'Català', // Catalonian
        'va' => 'Valencià', // Valencian Catalonian
        'cs' => 'Čeština, český jazyk', // Czech
        'da' => 'Dansk',
        'de' => 'Deutsch', // German
        'dz' => 'རྫོང་ཁ་', // Dzongkha, or Bhutanese
        'ee' => 'Eʋegbe', // Ewe
        'el' => 'Ελληνικά', // Greek
        'en' => 'English',
        'eo' => 'Esperanto',
        'es' => 'Español', // Spanish
        'et' => 'Eesti', // Estonian
        'eu' => 'Euskara', // Basque
        'fa' => 'فارسی', // Farsi, Persian
        'fi' => 'Suomi', // Finnish
        'fr' => 'Français', // Fran\xc3\xa7ais, French
        'gl' => 'Galego', // Galician
        'he' => 'עברית', // Hebrew
        'hr' => 'Hrvatski', // Croatian
        'hu' => 'Magyar', // Hungarian
        'id' => 'Bahasa Indonesia', // Indonesian
        'ig' => 'Asụsụ Igbo', // Nunivak Cup'ig, Igbo
        'is' => 'Íslenska', // Icelandic
        'it' => 'Italiano',
        'ja' => '日本語', // Japanese
        'km' => 'ភាសាខ្មែរ', // Khmer, Cambodyan
        'lo' => 'ພາສາລາວ', // Lao, Laotian
        'mi' => 'Māori', // Maori
        'nb' => 'Norsk bokmål', // Norwegian Bokmål
        'nl' => 'Nederlands', // Dutch
        'pl' => 'Język polski, polszczyzna', // Polski, polszczyzna
        'pt' => 'Português', // Portuguese
        'pt_br' => 'Português do Brazil', // Brazillian Portuguese
        'ro' => 'Română', // Romanian
        'ru' => 'Русский', // Russian
        'sk' => 'Slovenčina, slovenský jazyk', // Jazyk - Slovak
        'sl' => 'Slovenščina', // Slovene
        'sr' => 'Српски / srpski', // Srpski, Serbian
        'sv' => 'Svenska', // Swedish
        'th' => 'ไทย', // Thai
        'tl' => 'Wikang Tagalog, ᜏᜒᜃᜅ᜔ ᜆᜄᜎᜓᜄ᜔', // Tagalog
        'tg' => 'тоҷикӣ, toğikī, تاجیکی‎', // Tajik
        'tr' => 'Türkçe', // Turkish
        'tw' => 'Twi',
        'uk' => 'Українська', // Ukrainian
        'vi' => 'Tiếng Việt', // Vietnamese
        'yo' => 'Yorùbá', // Yoruba
        // 'zh' => '\xe7\xae\x80\xe4\xbd\x93\xe4\xb8\xad\xe6\x96\x87', // Simplified Chinese 简体中文
        'zh_CN' => '简体中文',
        'zh_TW' => '正體中文（台灣)',
        'zu' => 'isiZulu',
    ];

    // =========================================================================
    // DEPRECATED CONSTANTS - Now configured via environment variables
    // =========================================================================
    //
    // The following constants have been migrated to environment variables
    // configured in .env.dist and injected as Symfony parameters.
    //
    // Migration mapping:
    // - USER_STORAGE_MAX_DISK_SPACE → USER_STORAGE_MAX_DISK_SPACE in .env
    // - COUNT_USER_AUTOSAVE_SPACE_ODE_FILES → COUNT_USER_AUTOSAVE_SPACE_ODE_FILES in .env
    // - FILE_UPLOAD_MAX_SIZE → FILE_UPLOAD_MAX_SIZE in .env
    // - PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL → PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL in .env
    // - PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES → PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES in .env
    // - AUTOSAVE_ODE_FILES_FUNCTION → AUTOSAVE_ODE_FILES_FUNCTION in .env
    // - VERSION_CONTROL → VERSION_CONTROL in .env
    // - USER_RECENT_ODE_FILES_AMOUNT → USER_RECENT_ODE_FILES_AMOUNT in .env
    // - COLLABORATIVE_BLOCK_LEVEL → COLLABORATIVE_BLOCK_LEVEL in .env
    //
    // To access these values:
    // - Controllers: $this->getParameter('app.setting_name')
    // - Services: Inject via constructor parameters
    // - Tests: self::getContainer()->getParameter('app.setting_name')
    //
    // See config/services.yaml for parameter definitions.
    // =========================================================================
}
