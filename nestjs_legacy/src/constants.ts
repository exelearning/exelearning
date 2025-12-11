/**
 * Application constants
 * Ported from Symfony's Constants.php and Settings.php
 */

/**
 * General application constants
 */
export const Constants = {
    /**
     * Key used to indicate generating a new item
     */
    GENERATE_NEW_ITEM_KEY: 'new',

    /**
     * CSV item separator character
     */
    CSV_ITEM_SEPARATOR: ',',

    /**
     * Temporary content storage directory name
     */
    TEMPORARY_CONTENT_STORAGE_DIRECTORY: 'tmp',

    /**
     * Permanent content storage directory name
     */
    PERMANENT_CONTENT_STORAGE_DIRECTORY: 'perm',

    /**
     * ODE files permanent storage directory
     */
    PERMANENT_CONTENT_STORAGE_ODES_DIRECTORY: 'odes',

    /**
     * Resource lock timeout in seconds (15 minutes)
     * Used for collaborative editing resource locks
     */
    RESOURCE_LOCK_TIMEOUT_SECONDS: 900,

    /**
     * Gravatar configuration (mirrors Symfony defaults)
     * Leave GRAVATAR_BASE_URL empty to disable avatars globally
     */
    GRAVATAR_BASE_URL: 'https://www.gravatar.com/avatar/',
    GRAVATAR_DEFAULT_IMAGE: 'initials',
    GRAVATAR_GUEST_DEFAULT_IMAGE: 'identicon',
    GRAVATAR_GUEST_ACCOUNT_DOMAIN: '@guest.local',
};

/**
 * Application settings
 */
export const Settings = {
    /**
     * Active locales supported by the application (for UI translation)
     * These are the locales for which full UI translations are available
     */
    LOCALES: {
        ca: 'Català',
        en: 'English',
        es: 'Español',
        eo: 'Esperanto',
        eu: 'Euskara',
        gl: 'Galego',
        pt: 'Português',
        ro: 'Română',
        va: 'Valencià',
    },

    /**
     * Default locale when user has no preference set
     */
    DEFAULT_LOCALE: 'en',

    /**
     * Package locales supported for exported content
     * These are the locales available for content packages (SCORM, HTML5, etc.)
     * More extensive than UI locales
     */
    PACKAGE_LOCALES: {
        am: 'አማርኛ',
        ar: 'العربية',
        ast: 'asturianu',
        bg: 'Български',
        bn: 'বাংলা',
        br: 'Brezhoneg',
        ca: 'Català',
        va: 'Valencià',
        cs: 'Čeština, český jazyk',
        da: 'Dansk',
        de: 'Deutsch',
        dz: 'རྫོང་ཁ་',
        ee: 'Eʋegbe',
        el: 'Ελληνικά',
        en: 'English',
        eo: 'Esperanto',
        es: 'Español',
        et: 'Eesti',
        eu: 'Euskara',
        fa: 'فارسی',
        fi: 'Suomi',
        fr: 'Français',
        gl: 'Galego',
        he: 'עברית',
        hr: 'Hrvatski',
        hu: 'Magyar',
        id: 'Bahasa Indonesia',
        ig: 'Asụsụ Igbo',
        is: 'Íslenska',
        it: 'Italiano',
        ja: '日本語',
        km: 'ភាសាខ្មែរ',
        lo: 'ພາສາລາວ',
        mi: 'Māori',
        nb: 'Norsk bokmål',
        nl: 'Nederlands',
        pl: 'Język polski, polszczyzna',
        pt: 'Português',
        pt_br: 'Português do Brazil',
        ro: 'Română',
        ru: 'Русский',
        sk: 'Slovenčina, slovenský jazyk',
        sl: 'Slovenščina',
        sr: 'Српски / srpski',
        sv: 'Svenska',
        th: 'ไทย',
        tl: 'Wikang Tagalog, ᜏᜒᜃᜅ᜔ ᜆᜄᜎᜓᜄ᜔',
        tg: 'тоҷикӣ, toğikī, تاجیکی‎',
        tr: 'Türkçe',
        tw: 'Twi',
        uk: 'Українська',
        vi: 'Tiếng Việt',
        yo: 'Yorùbá',
        zh_CN: '简体中文',
        zh_TW: '正體中文（台灣)',
        zu: 'isiZulu',
    },
};
