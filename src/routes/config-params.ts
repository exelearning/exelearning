/**
 * Shared configuration parameter objects used by both the API routes (config.ts)
 * and the static bundle builder (build-static-bundle.ts).
 *
 * The factory function accepts `TRANS_PREFIX` and locale/license data as deps so that:
 *  - In server mode (config.ts): strings carry "TRANSLATABLE_TEXT:" prefix and are
 *    translated server-side via translateObject() before being sent to the client.
 *  - In static mode (build-static-bundle.ts): TRANS_PREFIX is "" so all strings are
 *    plain English, which the frontend translates at render time via _().
 */

export interface ConfigParamsDeps {
    TRANS_PREFIX: string;
    LICENSES: Record<string, string>;
    PACKAGE_LOCALES: Record<string, string>;
    LOCALES: Record<string, string>;
}

export function buildConfigParams(deps: ConfigParamsDeps) {
    // Named TRANS_PREFIX so the translation extractor can detect strings in this file.
    const TRANS_PREFIX = deps.TRANS_PREFIX;
    const { LICENSES, PACKAGE_LOCALES, LOCALES } = deps;

    const GROUPS_TITLE = {
        properties_package: `${TRANS_PREFIX}Content metadata`,
        export: `${TRANS_PREFIX}Export options`,
        custom_code: `${TRANS_PREFIX}Custom code`,
    };

    const USER_PREFERENCES_CONFIG = {
        locale: {
            title: `${TRANS_PREFIX}Language`,
            help: `${TRANS_PREFIX}You can choose a different language for the current project.`,
            value: null,
            type: 'select',
            options: LOCALES,
            category: `${TRANS_PREFIX}General settings`,
        },
        advancedMode: {
            title: `${TRANS_PREFIX}Advanced mode`,
            value: 'true',
            type: 'checkbox',
            hide: true,
            category: `${TRANS_PREFIX}General settings`,
        },
        defaultLicense: {
            title: `${TRANS_PREFIX}License for the new documents`,
            help: `${TRANS_PREFIX}You can choose a different licence for the current project.`,
            value: 'creative commons: attribution - share alike 4.0',
            type: 'select',
            options: LICENSES,
            category: `${TRANS_PREFIX}General settings`,
        },
        theme: {
            title: `${TRANS_PREFIX}Style`,
            value: 'base',
            type: 'text',
            hide: true,
            category: `${TRANS_PREFIX}General settings`,
        },
        versionControl: {
            title: `${TRANS_PREFIX}Version control`,
            value: 'true',
            type: 'checkbox',
            category: `${TRANS_PREFIX}General settings`,
        },
        defaultAI: {
            title: `${TRANS_PREFIX}Default AI Assistant`,
            help: `${TRANS_PREFIX}Select the AI that will be selected by default when editing iDevices.`,
            value: 'https://chatgpt.com/?q=',
            type: 'select',
            options: {
                'https://chatgpt.com/?q=': 'ChatGPT',
                'https://claude.ai/new?q=': 'Claude',
                'https://www.perplexity.ai/search?q=': 'Perplexity',
                'https://chat.mistral.ai/chat/?q=': 'Le Chat (Mistral)',
                'https://grok.com/?q=': 'Grok',
                'https://chat.qwen.ai/?text=': 'Qwen',
            },
            category: `${TRANS_PREFIX}General settings`,
        },
    };

    const IDEVICE_INFO_FIELDS_CONFIG = {
        title: { title: `${TRANS_PREFIX}Title`, tag: 'text' },
        description: { title: `${TRANS_PREFIX}Description`, tag: 'textarea' },
        version: { title: `${TRANS_PREFIX}Version`, tag: 'text' },
        author: { title: `${TRANS_PREFIX}Authorship`, tag: 'text' },
        authorUrl: { title: `${TRANS_PREFIX}Author URL`, tag: 'text' },
        license: { title: `${TRANS_PREFIX}License`, tag: 'textarea' },
        licenseUrl: { title: `${TRANS_PREFIX}License URL`, tag: 'textarea' },
    };

    const THEME_INFO_FIELDS_CONFIG = {
        title: { title: `${TRANS_PREFIX}Title`, tag: 'text' },
        description: { title: `${TRANS_PREFIX}Description`, tag: 'textarea' },
        version: { title: `${TRANS_PREFIX}Version`, tag: 'text' },
        author: { title: `${TRANS_PREFIX}Authorship`, tag: 'text' },
        license: { title: `${TRANS_PREFIX}License`, tag: 'textarea' },
        licenseUrl: { title: `${TRANS_PREFIX}License URL`, tag: 'textarea' },
    };

    const THEME_EDITION_FIELDS_CONFIG = {
        title: { title: `${TRANS_PREFIX}Title`, tag: 'text', editable: true },
        description: { title: `${TRANS_PREFIX}Description`, tag: 'textarea', editable: true },
    };

    const ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG = {
        visibility: {
            title: `${TRANS_PREFIX}Visible in export`,
            value: 'true',
            type: 'checkbox',
            category: null,
            heritable: true,
        },
        teacherOnly: {
            title: `${TRANS_PREFIX}Teacher only`,
            value: 'false',
            type: 'checkbox',
            category: null,
            heritable: true,
        },
        cssClass: {
            title: `${TRANS_PREFIX}CSS Class`,
            value: '',
            type: 'text',
            category: null,
            heritable: true,
        },
    };

    const ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG = {
        titleNode: {
            title: `${TRANS_PREFIX}Title`,
            value: '',
            type: 'text',
            category: `${TRANS_PREFIX}General`,
            heritable: false,
        },
        hidePageTitle: {
            title: `${TRANS_PREFIX}Hide page title`,
            type: 'checkbox',
            category: `${TRANS_PREFIX}General`,
            value: 'false',
            heritable: false,
        },
        titleHtml: {
            title: `${TRANS_PREFIX}Title HTML`,
            value: '',
            type: 'text',
            category: `${TRANS_PREFIX}Advanced (SEO)`,
            heritable: false,
        },
        editableInPage: {
            title: `${TRANS_PREFIX}Different title on the page`,
            type: 'checkbox',
            category: `${TRANS_PREFIX}General`,
            value: 'false',
            alwaysVisible: true,
        },
        titlePage: {
            title: `${TRANS_PREFIX}Title in page`,
            value: '',
            type: 'text',
            category: `${TRANS_PREFIX}General`,
            heritable: false,
        },
        visibility: {
            title: `${TRANS_PREFIX}Visible in export`,
            value: 'true',
            type: 'checkbox',
            category: `${TRANS_PREFIX}General`,
            heritable: true,
        },
        highlight: {
            title: `${TRANS_PREFIX}Highlight this page in the website navigation menu`,
            value: 'false',
            type: 'checkbox',
            category: `${TRANS_PREFIX}General`,
            heritable: false,
        },
        description: {
            title: `${TRANS_PREFIX}Description`,
            value: '',
            type: 'textarea',
            category: `${TRANS_PREFIX}Advanced (SEO)`,
            heritable: false,
        },
    };

    const ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG = {
        visibility: {
            title: `${TRANS_PREFIX}Visible in export`,
            value: 'true',
            type: 'checkbox',
            category: null,
            heritable: true,
        },
        teacherOnly: {
            title: `${TRANS_PREFIX}Teacher only`,
            value: 'false',
            type: 'checkbox',
            category: null,
            heritable: true,
        },
        allowToggle: {
            title: `${TRANS_PREFIX}Allows to minimize/display content`,
            value: 'true',
            type: 'checkbox',
            category: null,
            heritable: true,
        },
        minimized: {
            title: `${TRANS_PREFIX}Minimized`,
            value: 'false',
            type: 'checkbox',
            category: null,
            heritable: true,
        },
        cssClass: {
            title: `${TRANS_PREFIX}CSS Class`,
            value: '',
            type: 'text',
            category: null,
            heritable: true,
        },
    };

    const ODE_PROJECT_SYNC_PROPERTIES_CONFIG = {
        properties: {
            pp_title: {
                title: `${TRANS_PREFIX}Title`,
                help: `${TRANS_PREFIX}The name given to the resource.`,
                value: '',
                alwaysVisible: true,
                type: 'text',
                category: 'properties',
                groups: { properties_package: GROUPS_TITLE.properties_package },
            },
            pp_subtitle: {
                title: `${TRANS_PREFIX}Subtitle`,
                help: `${TRANS_PREFIX}Adds additional information to the main title.`,
                value: '',
                alwaysVisible: true,
                type: 'text',
                category: 'properties',
                groups: { properties_package: GROUPS_TITLE.properties_package },
            },
            pp_lang: {
                title: `${TRANS_PREFIX}Language`,
                help: `${TRANS_PREFIX}Select a language.`,
                value: 'en',
                alwaysVisible: true,
                type: 'select',
                options: PACKAGE_LOCALES,
                category: 'properties',
                groups: { properties_package: GROUPS_TITLE.properties_package },
            },
            pp_author: {
                title: `${TRANS_PREFIX}Authorship`,
                help: `${TRANS_PREFIX}Primary author/s of the resource.`,
                value: '',
                alwaysVisible: true,
                type: 'text',
                category: 'properties',
                groups: { properties_package: GROUPS_TITLE.properties_package },
            },
            pp_license: {
                title: `${TRANS_PREFIX}License`,
                value: 'creative commons: attribution - share alike 4.0',
                alwaysVisible: true,
                type: 'select',
                options: LICENSES,
                category: 'properties',
                groups: { properties_package: GROUPS_TITLE.properties_package },
            },
            pp_description: {
                title: `${TRANS_PREFIX}Description`,
                value: '',
                alwaysVisible: true,
                type: 'textarea',
                category: 'properties',
                groups: { properties_package: GROUPS_TITLE.properties_package },
            },
            exportSource: {
                title: `${TRANS_PREFIX}Editable export`,
                help: `${TRANS_PREFIX}The exported content will be editable with eXeLearning.`,
                value: 'true',
                type: 'checkbox',
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_addExeLink: {
                title: `${TRANS_PREFIX}"Made with eXeLearning" link`,
                help: `${TRANS_PREFIX}Help us spreading eXeLearning. Checking this option, a "Made with eXeLearning" link will be displayed in your pages.`,
                value: 'true',
                type: 'checkbox',
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_addPagination: {
                title: `${TRANS_PREFIX}Page counter`,
                help: `${TRANS_PREFIX}A text with the page number will be added on each page.`,
                value: 'false',
                type: 'checkbox',
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_addSearchBox: {
                title: `${TRANS_PREFIX}Search bar (Website export only)`,
                help: `${TRANS_PREFIX}A search box will be added to every page of the website.`,
                value: 'false',
                type: 'checkbox',
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_addAccessibilityToolbar: {
                title: `${TRANS_PREFIX}Accessibility toolbar`,
                help: `${TRANS_PREFIX}The accessibility toolbar allows visitors to manipulate some aspects of your site, such as font and text size.`,
                value: 'false',
                type: 'checkbox',
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_addMathJax: {
                title: `${TRANS_PREFIX}Include MathJax (advanced features)`,
                help: `${TRANS_PREFIX}Formulas are rendered even if this is disabled. Enable this option to include the full MathJax library in exports (about 8 MB) for advanced features such as accessibility tools and contextual menus.`,
                value: 'false',
                type: 'checkbox',
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_globalFont: {
                title: `${TRANS_PREFIX}Global font`,
                help: `${TRANS_PREFIX}Apply a global font to all content. Useful for accessibility and early literacy.`,
                value: 'default',
                type: 'select',
                options: {
                    default: `${TRANS_PREFIX}Style default`,
                    opendyslexic: 'OpenDyslexic',
                    andika: 'Andika',
                    'atkinson-hyperlegible-next': 'Atkinson Hyperlegible Next',
                    nunito: 'Nunito',
                    'playwrite-es': 'Playwrite ES',
                },
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_extraHeadContent: {
                title: `${TRANS_PREFIX}HEAD`,
                help: `${TRANS_PREFIX}HTML to be included at the end of HEAD: LINK, META, SCRIPT, STYLE...`,
                value: '',
                alwaysVisible: true,
                type: 'textarea',
                category: 'properties',
                groups: { custom_code: GROUPS_TITLE.custom_code },
            },
            footer: {
                title: `${TRANS_PREFIX}Page footer`,
                help: `${TRANS_PREFIX}Type any HTML. It will be placed after every page content. No JavaScript code will be executed inside eXe.`,
                value: '',
                alwaysVisible: true,
                type: 'textarea',
                category: 'properties',
                groups: { custom_code: GROUPS_TITLE.custom_code },
            },
        },
    };

    const ODE_PROJECT_SYNC_CATALOGUING_CONFIG = {};

    return {
        GROUPS_TITLE,
        USER_PREFERENCES_CONFIG,
        IDEVICE_INFO_FIELDS_CONFIG,
        THEME_INFO_FIELDS_CONFIG,
        THEME_EDITION_FIELDS_CONFIG,
        ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG,
        ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG,
        ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG,
        ODE_PROJECT_SYNC_PROPERTIES_CONFIG,
        ODE_PROJECT_SYNC_CATALOGUING_CONFIG,
    };
}
