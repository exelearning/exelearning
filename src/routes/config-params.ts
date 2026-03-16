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
    const T = deps.TRANS_PREFIX;
    const { LICENSES, PACKAGE_LOCALES, LOCALES } = deps;

    const GROUPS_TITLE = {
        properties_package: `${T}Content metadata`,
        export: `${T}Export options`,
        custom_code: `${T}Custom code`,
    };

    const USER_PREFERENCES_CONFIG = {
        locale: {
            title: `${T}Language`,
            help: `${T}You can choose a different language for the current project.`,
            value: null,
            type: 'select',
            options: LOCALES,
            category: `${T}General settings`,
        },
        advancedMode: {
            title: `${T}Advanced mode`,
            value: 'true',
            type: 'checkbox',
            hide: true,
            category: `${T}General settings`,
        },
        defaultLicense: {
            title: `${T}License for the new documents`,
            help: `${T}You can choose a different licence for the current project.`,
            value: 'creative commons: attribution - share alike 4.0',
            type: 'select',
            options: LICENSES,
            category: `${T}General settings`,
        },
        theme: {
            title: `${T}Style`,
            value: 'base',
            type: 'text',
            hide: true,
            category: `${T}General settings`,
        },
        versionControl: {
            title: `${T}Version control`,
            value: 'true',
            type: 'checkbox',
            category: `${T}General settings`,
        },
        defaultAI: {
            title: `${T}Default AI Assistant`,
            help: `${T}Select the AI that will be selected by default when editing iDevices.`,
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
            category: `${T}General settings`,
        },
    };

    const IDEVICE_INFO_FIELDS_CONFIG = {
        title: { title: `${T}Title`, tag: 'text' },
        description: { title: `${T}Description`, tag: 'textarea' },
        version: { title: `${T}Version`, tag: 'text' },
        author: { title: `${T}Authorship`, tag: 'text' },
        authorUrl: { title: `${T}Author URL`, tag: 'text' },
        license: { title: `${T}License`, tag: 'textarea' },
        licenseUrl: { title: `${T}License URL`, tag: 'textarea' },
    };

    const THEME_INFO_FIELDS_CONFIG = {
        title: { title: `${T}Title`, tag: 'text' },
        description: { title: `${T}Description`, tag: 'textarea' },
        version: { title: `${T}Version`, tag: 'text' },
        author: { title: `${T}Authorship`, tag: 'text' },
        license: { title: `${T}License`, tag: 'textarea' },
        licenseUrl: { title: `${T}License URL`, tag: 'textarea' },
    };

    const THEME_EDITION_FIELDS_CONFIG = {
        title: { title: `${T}Title`, tag: 'text', editable: true },
        description: { title: `${T}Description`, tag: 'textarea', editable: true },
    };

    const ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG = {
        visibility: {
            title: `${T}Visible in export`,
            value: 'true',
            type: 'checkbox',
            category: null,
            heritable: true,
        },
        teacherOnly: {
            title: `${T}Teacher only`,
            value: 'false',
            type: 'checkbox',
            category: null,
            heritable: true,
        },
        cssClass: {
            title: `${T}CSS Class`,
            value: '',
            type: 'text',
            category: null,
            heritable: true,
        },
    };

    const ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG = {
        titleNode: {
            title: `${T}Title`,
            value: '',
            type: 'text',
            category: `${T}General`,
            heritable: false,
        },
        hidePageTitle: {
            title: `${T}Hide page title`,
            type: 'checkbox',
            category: `${T}General`,
            value: 'false',
            heritable: false,
        },
        titleHtml: {
            title: `${T}Title HTML`,
            value: '',
            type: 'text',
            category: `${T}Advanced (SEO)`,
            heritable: false,
        },
        editableInPage: {
            title: `${T}Different title on the page`,
            type: 'checkbox',
            category: `${T}General`,
            value: 'false',
            alwaysVisible: true,
        },
        titlePage: {
            title: `${T}Title in page`,
            value: '',
            type: 'text',
            category: `${T}General`,
            heritable: false,
        },
        visibility: {
            title: `${T}Visible in export`,
            value: 'true',
            type: 'checkbox',
            category: `${T}General`,
            heritable: true,
        },
        highlight: {
            title: `${T}Highlight this page in the website navigation menu`,
            value: 'false',
            type: 'checkbox',
            category: `${T}General`,
            heritable: false,
        },
        description: {
            title: `${T}Description`,
            value: '',
            type: 'textarea',
            category: `${T}Advanced (SEO)`,
            heritable: false,
        },
    };

    const ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG = {
        visibility: {
            title: `${T}Visible in export`,
            value: 'true',
            type: 'checkbox',
            category: null,
            heritable: true,
        },
        teacherOnly: {
            title: `${T}Teacher only`,
            value: 'false',
            type: 'checkbox',
            category: null,
            heritable: true,
        },
        allowToggle: {
            title: `${T}Allows to minimize/display content`,
            value: 'true',
            type: 'checkbox',
            category: null,
            heritable: true,
        },
        minimized: {
            title: `${T}Minimized`,
            value: 'false',
            type: 'checkbox',
            category: null,
            heritable: true,
        },
        cssClass: {
            title: `${T}CSS Class`,
            value: '',
            type: 'text',
            category: null,
            heritable: true,
        },
    };

    const ODE_PROJECT_SYNC_PROPERTIES_CONFIG = {
        properties: {
            pp_title: {
                title: `${T}Title`,
                help: `${T}The name given to the resource.`,
                value: '',
                alwaysVisible: true,
                type: 'text',
                category: 'properties',
                groups: { properties_package: GROUPS_TITLE.properties_package },
            },
            pp_subtitle: {
                title: `${T}Subtitle`,
                help: `${T}Adds additional information to the main title.`,
                value: '',
                alwaysVisible: true,
                type: 'text',
                category: 'properties',
                groups: { properties_package: GROUPS_TITLE.properties_package },
            },
            pp_lang: {
                title: `${T}Language`,
                help: `${T}Select a language.`,
                value: 'en',
                alwaysVisible: true,
                type: 'select',
                options: PACKAGE_LOCALES,
                category: 'properties',
                groups: { properties_package: GROUPS_TITLE.properties_package },
            },
            pp_author: {
                title: `${T}Authorship`,
                help: `${T}Primary author/s of the resource.`,
                value: '',
                alwaysVisible: true,
                type: 'text',
                category: 'properties',
                groups: { properties_package: GROUPS_TITLE.properties_package },
            },
            pp_license: {
                title: `${T}License`,
                value: 'creative commons: attribution - share alike 4.0',
                alwaysVisible: true,
                type: 'select',
                options: LICENSES,
                category: 'properties',
                groups: { properties_package: GROUPS_TITLE.properties_package },
            },
            pp_description: {
                title: `${T}Description`,
                value: '',
                alwaysVisible: true,
                type: 'textarea',
                category: 'properties',
                groups: { properties_package: GROUPS_TITLE.properties_package },
            },
            exportSource: {
                title: `${T}Editable export`,
                help: `${T}The exported content will be editable with eXeLearning.`,
                value: 'true',
                type: 'checkbox',
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_addExeLink: {
                title: `${T}"Made with eXeLearning" link`,
                help: `${T}Help us spreading eXeLearning. Checking this option, a "Made with eXeLearning" link will be displayed in your pages.`,
                value: 'true',
                type: 'checkbox',
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_addPagination: {
                title: `${T}Page counter`,
                help: `${T}A text with the page number will be added on each page.`,
                value: 'false',
                type: 'checkbox',
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_addSearchBox: {
                title: `${T}Search bar (Website export only)`,
                help: `${T}A search box will be added to every page of the website.`,
                value: 'false',
                type: 'checkbox',
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_addAccessibilityToolbar: {
                title: `${T}Accessibility toolbar`,
                help: `${T}The accessibility toolbar allows visitors to manipulate some aspects of your site, such as font and text size.`,
                value: 'false',
                type: 'checkbox',
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_addMathJax: {
                title: `${T}Include MathJax (advanced features)`,
                help: `${T}Formulas are rendered even if this is disabled. Enable this option to include the full MathJax library in exports (about 8 MB) for advanced features such as accessibility tools and contextual menus.`,
                value: 'false',
                type: 'checkbox',
                category: 'properties',
                groups: { export: GROUPS_TITLE.export },
            },
            pp_globalFont: {
                title: `${T}Global font`,
                help: `${T}Apply a global font to all content. Useful for accessibility and early literacy.`,
                value: 'default',
                type: 'select',
                options: {
                    default: `${T}Style default`,
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
                title: `${T}HEAD`,
                help: `${T}HTML to be included at the end of HEAD: LINK, META, SCRIPT, STYLE...`,
                value: '',
                alwaysVisible: true,
                type: 'textarea',
                category: 'properties',
                groups: { custom_code: GROUPS_TITLE.custom_code },
            },
            footer: {
                title: `${T}Page footer`,
                help: `${T}Type any HTML. It will be placed after every page content. No JavaScript code will be executed inside eXe.`,
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
