<?php

namespace App;

/**
 * Properties and preferences arrays.
 */
class Properties
{
    // Elements properties config
    public const TRANS_PREFIX = 'TRANSLATABLE_TEXT:';

    /*********************************************************************************
     * USER PREFERENCES
     *********************************************************************************/

    public const USER_PREFERENCES_CONFIG = [
        'locale' => [
            'title' => self::TRANS_PREFIX.'Language',
            'help' => self::TRANS_PREFIX.'You can choose a different language for the current project.',
            'value' => null,
            'type' => 'select',
            'options' => Settings::LOCALES,
            'category' => self::TRANS_PREFIX.'General settings',
        ],
        'advancedMode' => [
            'title' => self::TRANS_PREFIX.'Advanced mode',
            'value' => 'true',
            'type' => 'checkbox',
            'hide' => true,
            'category' => self::TRANS_PREFIX.'General settings',
        ],
        'defaultLicense' => [
            'title' => self::TRANS_PREFIX.'License for the new documents',
            'help' => self::TRANS_PREFIX.'You can choose a different licence for the current project.',
            'value' => 'creative commons: attribution - share alike 4.0',
            'type' => 'select',
            'options' => self::LICENSES,
            'category' => self::TRANS_PREFIX.'General settings',
        ],
        'theme' => [
            'title' => self::TRANS_PREFIX.'Style theme',
            'value' => Constants::THEME_DEFAULT,
            'type' => 'text',
            'hide' => true,
            'category' => self::TRANS_PREFIX.'General settings',
        ],
        'versionControl' => [
            'title' => self::TRANS_PREFIX.'Version control',
            'value' => "'".Settings::VERSION_CONTROL."'",
            'type' => 'checkbox',
            'category' => self::TRANS_PREFIX.'General settings',
        ],
    ];

    /*********************************************************************************
     * THEMES CONFIG
     *********************************************************************************/

    // Edition theme categories
    public const THEME_EDITION_CATEGORIES = [
        'information' => self::TRANS_PREFIX.'Information',
        'texts-links' => self::TRANS_PREFIX.'Texts and Links',
        'header-footer' => self::TRANS_PREFIX.'Header',
    ];

    // Theme info fields
    public const THEME_INFO_FIELDS_CONFIG = [
        'title' => [
            'title' => self::TRANS_PREFIX.'Title',
            'tag' => 'text',
        ],
        'description' => [
            'title' => self::TRANS_PREFIX.'Description',
            'tag' => 'textarea',
        ],
        'version' => [
            'title' => self::TRANS_PREFIX.'Version',
            'tag' => 'text',
        ],
        'author' => [
            'title' => self::TRANS_PREFIX.'Authorship',
            'tag' => 'text',
        ],
        'authorUrl' => [
            'title' => self::TRANS_PREFIX.'Author URL',
            'tag' => 'text',
        ],
        'license' => [
            'title' => self::TRANS_PREFIX.'License',
            'tag' => 'textarea',
        ],
        'licenseUrl' => [
            'title' => self::TRANS_PREFIX.'License URL',
            'tag' => 'textarea',
        ],
    ];

    // Theme edition fields
    public const THEME_EDITION_FIELDS_CONFIG = [
        'title' => [
            'title' => self::TRANS_PREFIX.'Title',
            'tag' => 'text',
            'config' => 'title',
            'category' => self::THEME_EDITION_CATEGORIES['information'],
        ],
        'description' => [
            'title' => self::TRANS_PREFIX.'Description',
            'tag' => 'textarea',
            'config' => 'description',
            'category' => self::THEME_EDITION_CATEGORIES['information'],
        ],
        'version' => [
            'title' => self::TRANS_PREFIX.'Version',
            'tag' => 'text',
            'config' => 'version',
            'category' => self::THEME_EDITION_CATEGORIES['information'],
        ],
        'author' => [
            'title' => self::TRANS_PREFIX.'Authorship',
            'tag' => 'text',
            'config' => 'author',
            'category' => self::THEME_EDITION_CATEGORIES['information'],
        ],
        'authorUrl' => [
            'title' => self::TRANS_PREFIX.'Author URL',
            'tag' => 'text',
            'config' => 'author-url',
            'category' => self::THEME_EDITION_CATEGORIES['information'],
        ],
        'license' => [
            'title' => self::TRANS_PREFIX.'License',
            'tag' => 'textarea',
            'config' => 'license',
            'category' => self::THEME_EDITION_CATEGORIES['information'],
        ],
        'licenseUrl' => [
            'title' => self::TRANS_PREFIX.'License URL',
            'tag' => 'textarea',
            'config' => 'license-url',
            'category' => self::THEME_EDITION_CATEGORIES['information'],
        ],
        'textColor' => [
            'title' => self::TRANS_PREFIX.'Text color',
            'tag' => 'color',
            'config' => 'text-color',
            'category' => self::THEME_EDITION_CATEGORIES['texts-links'],
        ],
        'linkColor' => [
            'title' => self::TRANS_PREFIX.'Links color',
            'tag' => 'color',
            'config' => 'link-color',
            'category' => self::THEME_EDITION_CATEGORIES['texts-links'],
        ],
        'headerImg' => [
            'title' => self::TRANS_PREFIX.'Header image',
            'tag' => 'img',
            'config' => 'header-img',
            'category' => self::THEME_EDITION_CATEGORIES['header-footer'],
        ],
        'logoImg' => [
            'title' => self::TRANS_PREFIX.'Logo image',
            'tag' => 'img',
            'config' => 'logo-img',
            'category' => self::THEME_EDITION_CATEGORIES['header-footer'],
        ],
    ];

    /*********************************************************************************
     * IDEVICES INFO
     *********************************************************************************/

    // Idevice info fields
    public const IDEVICE_INFO_FIELDS_CONFIG = [
        'title' => [
            'title' => self::TRANS_PREFIX.'Title',
            'tag' => 'text',
        ],
        'description' => [
            'title' => self::TRANS_PREFIX.'Description',
            'tag' => 'textarea',
        ],
        'version' => [
            'title' => self::TRANS_PREFIX.'Version',
            'tag' => 'text',
        ],
        'author' => [
            'title' => self::TRANS_PREFIX.'Authorship',
            'tag' => 'text',
        ],
        'authorUrl' => [
            'title' => self::TRANS_PREFIX.'Author URL',
            'tag' => 'text',
        ],
        'license' => [
            'title' => self::TRANS_PREFIX.'License',
            'tag' => 'textarea',
        ],
        'licenseUrl' => [
            'title' => self::TRANS_PREFIX.'License URL',
            'tag' => 'textarea',
        ],
    ];

    /*********************************************************************************
     * IDEVICES COMPONENTS PROPERTIES
     *********************************************************************************/

    public const ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG = [
        'visibility' => [
            'title' => self::TRANS_PREFIX.'Visible in export',
            'value' => 'true',
            'type' => 'checkbox',
            'category' => null,
            'heritable' => true,
        ],
        'identifier' => [
            'title' => self::TRANS_PREFIX.'ID',
            'type' => 'text',
            'category' => null,
            'heritable' => false,
        ],
        'cssClass' => [
            'title' => self::TRANS_PREFIX.'CSS Class',
            'value' => '',
            'type' => 'text',
            'category' => null,
            'heritable' => true,
        ],
    ];

    /*********************************************************************************
     * BLOCK COMPONENTS PROPERTIES
     *********************************************************************************/

    public const ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG = [
        'visibility' => [
            'title' => self::TRANS_PREFIX.'Visible in export',
            'value' => 'true',
            'type' => 'checkbox',
            'category' => null,
            'heritable' => true,
        ],
        'allowToggle' => [
            'title' => self::TRANS_PREFIX.'Allows to minimize/display content',
            'value' => 'true',
            'type' => 'checkbox',
            'category' => null,
            'heritable' => true,
        ],
        'minimized' => [
            'title' => self::TRANS_PREFIX.'Minimized',
            'value' => 'false',
            'type' => 'checkbox',
            'category' => null,
            'heritable' => true,
        ],
        'identifier' => [
            'title' => self::TRANS_PREFIX.'ID',
            'type' => 'text',
            'category' => null,
            'heritable' => false,
        ],
        'cssClass' => [
            'title' => self::TRANS_PREFIX.'CSS Class',
            'value' => '',
            'type' => 'text',
            'category' => null,
            'heritable' => true,
        ],
    ];

    /*********************************************************************************
     * PAGES COMPONENTS PROPERTIES
     *********************************************************************************/

    public const ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG = [
        'titleNode' => [
            'title' => self::TRANS_PREFIX.'Title',
            'type' => 'text',
            'category' => self::TRANS_PREFIX.'General',
            'heritable' => false,
        ],
        'titleHtml' => [
            'title' => self::TRANS_PREFIX.'Title HTML',
            'type' => 'text',
            'category' => self::TRANS_PREFIX.'Advanced (SEO)',
            'heritable' => false,
        ],
        'editableInPage' => [
            'title' => self::TRANS_PREFIX.'Different title on the page',
            'type' => 'checkbox',
            'category' => self::TRANS_PREFIX.'General',
            'value' => 'false',
            'alwaysVisible' => true,
        ],
        'titlePage' => [
            'title' => self::TRANS_PREFIX.'Title in page',
            'type' => 'text',
            'category' => self::TRANS_PREFIX.'General',
            'heritable' => false,
        ],
        'visibility' => [
            'title' => self::TRANS_PREFIX.'Visible in export',
            'value' => 'true',
            'type' => 'checkbox',
            'category' => self::TRANS_PREFIX.'General',
            'heritable' => true,
        ],
        'description' => [
            'title' => self::TRANS_PREFIX.'Description',
            'type' => 'textarea',
            'category' => self::TRANS_PREFIX.'Advanced (SEO)',
            'heritable' => false,
        ],
    ];

    /*********************************************************************************
     * OPTIONS - PREFERENCES
     *********************************************************************************/

    public const LICENSES = [
        'creative commons: attribution 4.0' => self::TRANS_PREFIX.'creative commons: attribution 4.0 (BY)',
        'creative commons: attribution - share alike 4.0' => self::TRANS_PREFIX.'creative commons: attribution - share alike 4.0 (BY-SA)',
        'creative commons: attribution - non derived work 4.0' => self::TRANS_PREFIX.'creative commons: attribution - non derived work 4.0 (BY-ND)',
        'creative commons: attribution - non commercial 4.0' => self::TRANS_PREFIX.'creative commons: attribution - non commercial 4.0 (BY-NC)',
        'creative commons: attribution - non commercial - share alike 4.0' => self::TRANS_PREFIX.'creative commons: attribution - non commercial - share alike 4.0 (BY-NC-SA)',
        'creative commons: attribution - non derived work - non commercial 4.0' => self::TRANS_PREFIX.'creative commons: attribution - non derived work - non commercial 4.0 (BY-NC-ND)',
        'public domain' => self::TRANS_PREFIX.'public domain',
        'free software license EUPL' => self::TRANS_PREFIX.'free software license EUPL',
        'free software license GPL' => self::TRANS_PREFIX.'free software license GPL',
        'dual free content license GPL and EUPL' => self::TRANS_PREFIX.'dual free content license GPL and EUPL',
        'license GFDL' => self::TRANS_PREFIX.'license GFDL',
        'other free software licenses' => self::TRANS_PREFIX.'other free software licenses',
        'propietary license' => self::TRANS_PREFIX.'proprietary license',
        'intellectual property license' => self::TRANS_PREFIX.'intellectual property license',
        'not appropriate' => self::TRANS_PREFIX.'not appropriate',
        // Old licenses
        'creative commons: attribution 3.0' => self::TRANS_PREFIX.'creative commons: attribution 3.0 (BY)',
        'creative commons: attribution - share alike 3.0' => self::TRANS_PREFIX.'creative commons: attribution - share alike 3.0 (BY-SA)',
        'creative commons: attribution - non derived work 3.0' => self::TRANS_PREFIX.'creative commons: attribution - non derived work 3.0 (BY-ND)',
        'creative commons: attribution - non commercial 3.0' => self::TRANS_PREFIX.'creative commons: attribution - non commercial 3.0 (BY-NC)',
        'creative commons: attribution - non commercial - share alike 3.0' => self::TRANS_PREFIX.'creative commons: attribution - non commercial - share alike 3.0 (BY-NC-SA)',
        'creative commons: attribution - non derived work - non commercial 3.0' => self::TRANS_PREFIX.'creative commons: attribution - non derived work - non commercial 3.0 (BY-NC-ND)',
        'creative commons: attribution 2.5' => self::TRANS_PREFIX.'creative commons: attribution 2.5 (BY)',
        'creative commons: attribution - share alike 2.5' => self::TRANS_PREFIX.'creative commons: attribution - share alike 2.5 (BY-SA)',
        'creative commons: attribution - non derived work 2.5' => self::TRANS_PREFIX.'creative commons: attribution - non derived work 2.5 (BY-ND)',
        'creative commons: attribution - non commercial 2.5' => self::TRANS_PREFIX.'creative commons: attribution - non commercial 2.5 (BY-NC)',
        'creative commons: attribution - non commercial - share alike 2.5' => self::TRANS_PREFIX.'creative commons: attribution - non commercial - share alike 2.5 (BY-NC-SA)',
        'creative commons: attribution - non derived work - non commercial 2.5' => self::TRANS_PREFIX.'creative commons: attribution - non derived work - non commercial 2.5 (BY-NC-ND)',
    ];

    public const LICENSES_LINKS = [
        'creative commons: attribution 4.0' => 'https://creativecommons.org/licenses/by/4.0/',
        'creative commons: attribution - share alike 4.0' => 'https://creativecommons.org/licenses/by-sa/4.0/',
        'creative commons: attribution - non derived work 4.0' => 'https://creativecommons.org/licenses/by-nd/4.0/',
        'creative commons: attribution - non commercial 4.0' => 'https://creativecommons.org/licenses/by-nc/4.0/',
        'creative commons: attribution - non commercial - share alike 4.0' => 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
        'creative commons: attribution - non derived work - non commercial 4.0' => 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
        // Old licenses
        'creative commons: attribution 3.0' => 'https://creativecommons.org/licenses/by/3.0/',
        'creative commons: attribution - share alike 3.0' => 'https://creativecommons.org/licenses/by-sa/3.0/',
        'creative commons: attribution - non derived work 3.0' => 'https://creativecommons.org/licenses/by-nd/3.0/',
        'creative commons: attribution - non commercial 3.0' => 'https://creativecommons.org/licenses/by-nc/3.0/',
        'creative commons: attribution - non commercial - share alike 3.0' => 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
        'creative commons: attribution - non derived work - non commercial 3.0' => 'https://creativecommons.org/licenses/by-nc-nd/3.0/',
        'creative commons: attribution 2.5' => 'https://creativecommons.org/licenses/by/2.5/',
        'creative commons: attribution - share alike 2.5' => 'https://creativecommons.org/licenses/by-sa/2.5/',
        'creative commons: attribution - non derived work 2.5' => 'https://creativecommons.org/licenses/by-nd/2.5/',
        'creative commons: attribution - non commercial 2.5' => 'https://creativecommons.org/licenses/by-nc/2.5/',
        'creative commons: attribution - non commercial - share alike 2.5' => 'https://creativecommons.org/licenses/by-nc-sa/2.5/',
        'creative commons: attribution - non derived work - non commercial 2.5' => 'https://creativecommons.org/licenses/by-nc-nd/2.5/',
    ];

    /*********************************************************************************
     * GROUPS
     *********************************************************************************/

    public const GROUPS_TITLE = [
        'properties_package' => self::TRANS_PREFIX.'Content metadata',
        'export' => self::TRANS_PREFIX.'Export options',
        'custom_code' => self::TRANS_PREFIX.'Custom code',
    ];

    public const PROPERTIES_CATEGORIES_TITLE = [
        'properties' => self::TRANS_PREFIX.'Properties',
        // Old cataloguing tabs (see #63)
        // 'cataloguing' => self::TRANS_PREFIX.'Cataloguing',
    ];

    /*********************************************************************************
     * PROJECT PROPERTIES - PROPERTIES
     *********************************************************************************/

    // PACKAGE
    public const ODE_PROPERTIES_PACKAGE_CONFIG = [
        'pp_title' => [
            'title' => self::TRANS_PREFIX.'Title',
            'help' => self::TRANS_PREFIX.'The name given to the resource.',
            'alwaysVisible' => true,
            'type' => 'text',
            'category' => 'properties',
            'groups' => ['properties_package'],
        ],
        'pp_lang' => [
            'title' => self::TRANS_PREFIX.'Language',
            'help' => self::TRANS_PREFIX.'Select a language.',
            'value' => null,
            'alwaysVisible' => true,
            'type' => 'select',
            'options' => Settings::PACKAGE_LOCALES,
            'category' => 'properties',
            'groups' => ['properties_package'],
        ],
        'pp_author' => [
            'title' => self::TRANS_PREFIX.'Authorship',
            'help' => self::TRANS_PREFIX.'Primary author/s of the resource.',
            'alwaysVisible' => true,
            'type' => 'text',
            'category' => 'properties',
            'groups' => ['properties_package'],
        ],
        'license' => [
            'title' => self::TRANS_PREFIX.'License',
            'value' => 'creative-commons-attribution-share-alike-4.0',
            'alwaysVisible' => true,
            'type' => 'select',
            'options' => self::LICENSES,
            'category' => 'properties',
            'groups' => ['properties_package'],
        ],
        'pp_description' => [
            'title' => self::TRANS_PREFIX.'Description',
            'alwaysVisible' => true,
            'type' => 'textarea',
            'category' => 'properties',
            'groups' => ['properties_package'],
        ],
    ];

    // EXPORT
    public const ODE_PROPERTIES_EXPORT_CONFIG = [
        'exportSource' => [
            'title' => self::TRANS_PREFIX.'Editable export',
            'value' => 'true',
            'help' => self::TRANS_PREFIX.'The exported content will be editable with eXeLearning.',
            'type' => 'checkbox',
            'category' => 'properties',
            'groups' => ['export'],
        ],
        'pp_addExeLink' => [
            'title' => self::TRANS_PREFIX.'"Made with eXeLearning" link',
            'value' => 'true',
            'help' => self::TRANS_PREFIX.'Help us spreading eXeLearning. Checking this option, a "Made with eXeLearning" link will be displayed in your pages.',
            'type' => 'checkbox',
            'category' => 'properties',
            'groups' => ['export'],
        ],
        'pp_exportElp' => [
            'title' => self::TRANS_PREFIX.'Include a copy of the source file',
            'value' => 'false',
            'help' => self::TRANS_PREFIX.'A copy of the eXeLearning file will be included when exporting the content.',
            'type' => 'checkbox',
            'category' => 'properties',
            'groups' => ['export'],
        ],
        'pp_addPagination' => [
            'title' => self::TRANS_PREFIX.'Page counter',
            'value' => 'false',
            'help' => self::TRANS_PREFIX.'A text with the page number will be added on each page.',
            'type' => 'checkbox',
            'category' => 'properties',
            'groups' => ['export'],
        ],
        'pp_addSearchBox' => [
            'title' => self::TRANS_PREFIX.'Search bar (Website export only)',
            'value' => 'false',
            'help' => self::TRANS_PREFIX.'A search box will be added to every page of the website.',
            'type' => 'checkbox',
            'category' => 'properties',
            'groups' => ['export'],
        ],
        'pp_addAccessibilityToolbar' => [
            'title' => self::TRANS_PREFIX.'Accessibility toolbar',
            'value' => 'false',
            'help' => self::TRANS_PREFIX.'The accessibility toolbar allows visitors to manipulate some aspects of your site, such as font and text size.',
            'type' => 'checkbox',
            'category' => 'properties',
            'groups' => ['export'],
        ],
        'pp_extraHeadContent' => [
            'title' => self::TRANS_PREFIX.'HEAD',
            'help' => self::TRANS_PREFIX.'HTML to be included at the end of HEAD: LINK, META, SCRIPT, STYLE...',
            'alwaysVisible' => true,
            'type' => 'textarea',
            'category' => 'properties',
            'groups' => ['custom_code'],
        ],
        'footer' => [
            'title' => self::TRANS_PREFIX.'Page footer',
            'help' => self::TRANS_PREFIX.'Type any HTML. It will be placed after every page content. No JavaScript code will be executed inside eXe.',
            'alwaysVisible' => true,
            'type' => 'textarea',
            'category' => 'properties',
            'groups' => ['custom_code'],
        ],
    ];

    // PROPERTIES TAB CONFIG
    public const ODE_PROPERTIES_CONFIG = [
        'properties' => self::ODE_PROPERTIES_PACKAGE_CONFIG,
        'export' => self::ODE_PROPERTIES_EXPORT_CONFIG,
    ];

    /*********************************************************************************
     * PROJECT PROPERTIES - CATALOGUING
     *********************************************************************************/

    // CATALOGUING TAB CONFIG
    public const ODE_CATALOGUING_CONFIG = [
        // Old LOM cataloguing options (see #63)
    ];

    // Properties default -> preferences relationships
    public const USER_PREFERENCES_DEFAULT_PROPERTIES_RELATION = [
        'license' => 'defaultLicense',
        // 'lom_rights_copyrightAndOtherRestrictions_value' => 'defaultLicense',
    ];
}
