/**
 * Unit tests for build-static-bundle.ts
 *
 * Tests the pure functions extracted from the build script to ensure
 * correct parsing, transformation, and generation of static bundle assets.
 */

import { describe, it, expect, beforeAll } from 'bun:test';

import {
    parseXlfContent,
    parseIdeviceConfig,
    processNjkTemplateContent,
    buildApiParameters,
    generatePwaManifestContent,
    generateServiceWorkerContent,
    appendVersionToUrls,
    LOCALES,
    LOCALE_NAMES,
    PACKAGE_LOCALES,
    LICENSES,
    type IdeviceConfig,
    type ApiParameters,
} from './build-static-bundle';
import { buildConfigParams } from '../src/routes/config-params';
import fs from 'fs';
import path from 'path';

// =============================================================================
// appendVersionToUrls tests
// =============================================================================

describe('appendVersionToUrls', () => {
    it('should add version query string to script src', () => {
        const html = '<script src="./app/app.bundle.js"></script>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe('<script src="./app/app.bundle.js?v=v1.0.0"></script>');
    });

    it('should add version query string to link href', () => {
        const html = '<link rel="stylesheet" href="./style/main.css">';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe('<link rel="stylesheet" href="./style/main.css?v=v1.0.0">');
    });

    it('should handle multiple assets in same HTML', () => {
        const html = '<script src="./a.js"></script><link href="./b.css">';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe('<script src="./a.js?v=v1.0.0"></script><link href="./b.css?v=v1.0.0">');
    });

    it('should skip external HTTPS URLs', () => {
        const html = '<script src="https://cdn.example.com/lib.js"></script>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe(html);
    });

    it('should skip external HTTP URLs', () => {
        const html = '<script src="http://cdn.example.com/lib.js"></script>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe(html);
    });

    it('should skip protocol-relative URLs', () => {
        const html = '<script src="//cdn.example.com/lib.js"></script>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe(html);
    });

    it('should skip data URLs', () => {
        const html = '<img src="data:image/gif;base64,R0lGODlhAQABAA==">';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe(html);
    });

    it('should skip anchor-only hrefs', () => {
        const html = '<a href="#section">Link</a>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe(html);
    });

    it('should skip empty src/href attributes', () => {
        const html = '<script src=""></script><link href="">';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe(html);
    });

    it('should append to existing query string with &', () => {
        const html = '<script src="./app.js?debug=true"></script>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe('<script src="./app.js?debug=true&v=v1.0.0"></script>');
    });

    it('should skip URLs already containing ?v= parameter', () => {
        const html = '<script src="./app.js?v=existing"></script>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe(html);
    });

    it('should skip URLs already containing &v= parameter', () => {
        const html = '<script src="./app.js?debug=true&v=existing"></script>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe(html);
    });

    it('should handle root-relative paths', () => {
        const html = '<script src="/files/perm/idevices/text.js"></script>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe('<script src="/files/perm/idevices/text.js?v=v1.0.0"></script>');
    });

    it('should handle paths without leading dot or slash', () => {
        const html = '<script src="app/bundle.js"></script>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe('<script src="app/bundle.js?v=v1.0.0"></script>');
    });

    it('should handle version string with special characters', () => {
        const html = '<script src="./app.js"></script>';
        const result = appendVersionToUrls(html, 'v0.0.0-alpha');
        expect(result).toBe('<script src="./app.js?v=v0.0.0-alpha"></script>');
    });

    it('should handle single quotes in attributes', () => {
        const html = "<script src='./app.js'></script>";
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe("<script src='./app.js?v=v1.0.0'></script>");
    });

    it('should skip template placeholders with {{}}', () => {
        const html = '<script src="{{basePath}}/app.js"></script>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe(html);
    });

    it('should handle img src attributes', () => {
        const html = '<img src="./images/logo.png">';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe('<img src="./images/logo.png?v=v1.0.0">');
    });

    it('should handle link with rel=icon', () => {
        const html = '<link rel="icon" href="./favicon.ico">';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe('<link rel="icon" href="./favicon.ico?v=v1.0.0">');
    });

    it('should handle link with rel=manifest', () => {
        const html = '<link rel="manifest" href="./manifest.json">';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe('<link rel="manifest" href="./manifest.json?v=v1.0.0">');
    });

    it('should handle complex HTML with multiple attributes', () => {
        const html = '<script type="module" src="./app.js" defer></script>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe('<script type="module" src="./app.js?v=v1.0.0" defer></script>');
    });

    it('should not modify non-src/href attributes', () => {
        const html = '<div data-src="./image.png"></div>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe(html);
    });

    it('should handle whitespace in URLs', () => {
        const html = '<script src="  "></script>';
        const result = appendVersionToUrls(html, 'v1.0.0');
        expect(result).toBe(html);
    });
});

// =============================================================================
// parseXlfContent tests
// =============================================================================

describe('parseXlfContent', () => {
    it('should parse valid XLF content with multiple trans-units', () => {
        const xlf = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
    <file source-language="en" target-language="es">
        <body>
            <trans-unit id="1">
                <source>Hello</source>
                <target>Hola</target>
            </trans-unit>
            <trans-unit id="2">
                <source>Goodbye</source>
                <target>Adiós</target>
            </trans-unit>
        </body>
    </file>
</xliff>`;

        const result = parseXlfContent(xlf);
        expect(result).toEqual({
            Hello: 'Hola',
            Goodbye: 'Adiós',
        });
    });

    it('should parse XLF content with a single trans-unit', () => {
        const xlf = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
    <file source-language="en" target-language="fr">
        <body>
            <trans-unit id="1">
                <source>Save</source>
                <target>Enregistrer</target>
            </trans-unit>
        </body>
    </file>
</xliff>`;

        const result = parseXlfContent(xlf);
        expect(result).toEqual({
            Save: 'Enregistrer',
        });
    });

    it('should return empty object for XLF without translations', () => {
        const xlf = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
    <file source-language="en" target-language="de">
        <body>
        </body>
    </file>
</xliff>`;

        const result = parseXlfContent(xlf);
        expect(result).toEqual({});
    });

    it('should return empty object for invalid XML', () => {
        const invalidXml = 'not valid xml <><>';
        const result = parseXlfContent(invalidXml);
        expect(result).toEqual({});
    });

    it('should skip trans-units missing source or target', () => {
        const xlf = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2">
    <file source-language="en" target-language="es">
        <body>
            <trans-unit id="1">
                <source>Complete</source>
                <target>Completo</target>
            </trans-unit>
            <trans-unit id="2">
                <source>Missing target</source>
            </trans-unit>
            <trans-unit id="3">
                <target>Missing source</target>
            </trans-unit>
        </body>
    </file>
</xliff>`;

        const result = parseXlfContent(xlf);
        expect(result).toEqual({
            Complete: 'Completo',
        });
    });

    it('should handle empty string', () => {
        const result = parseXlfContent('');
        expect(result).toEqual({});
    });
});

// =============================================================================
// parseIdeviceConfig tests
// =============================================================================

describe('parseIdeviceConfig', () => {
    const mockBasePath = '/fake/path';

    it('should parse minimal config.xml', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<idevice-config>
    <title>Text</title>
    <category>Basic</category>
</idevice-config>`;

        const result = parseIdeviceConfig(xml, 'text', mockBasePath);
        expect(result).not.toBeNull();
        expect(result!.title).toBe('Text');
        expect(result!.category).toBe('Basic');
        expect(result!.id).toBe('text');
        expect(result!.name).toBe('text');
    });

    it('should parse config.xml with all fields', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<idevice-config>
    <title>Quiz</title>
    <css-class>quiz-idevice</css-class>
    <category>Assessment</category>
    <version>2.1</version>
    <api-version>3.0</api-version>
    <component-type>quiz</component-type>
    <author>eXeLearning</author>
    <author-url>https://exelearning.net</author-url>
    <license>AGPL-3.0</license>
    <license-url>https://www.gnu.org/licenses/agpl-3.0.html</license-url>
    <description>Interactive quiz iDevice</description>
    <downloadable>1</downloadable>
    <export-object>$quiz</export-object>
</idevice-config>`;

        const result = parseIdeviceConfig(xml, 'quiz', mockBasePath);
        expect(result).not.toBeNull();
        expect(result!.title).toBe('Quiz');
        expect(result!.cssClass).toBe('quiz-idevice');
        expect(result!.category).toBe('Assessment');
        expect(result!.version).toBe('2.1');
        expect(result!.apiVersion).toBe('3.0');
        expect(result!.componentType).toBe('quiz');
        expect(result!.author).toBe('eXeLearning');
        expect(result!.authorUrl).toBe('https://exelearning.net');
        expect(result!.license).toBe('AGPL-3.0');
        expect(result!.licenseUrl).toBe('https://www.gnu.org/licenses/agpl-3.0.html');
        expect(result!.description).toBe('Interactive quiz iDevice');
        expect(result!.downloadable).toBe(true);
        expect(result!.exportObject).toBe('$quiz');
    });

    it('should handle icon as simple string', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<idevice-config>
    <title>Test</title>
    <icon>fa-pencil</icon>
</idevice-config>`;

        const result = parseIdeviceConfig(xml, 'test', mockBasePath);
        expect(result).not.toBeNull();
        expect(result!.icon).toEqual({
            name: 'fa-pencil',
            url: 'fa-pencil',
            type: 'icon',
        });
    });

    it('should handle icon as nested object', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<idevice-config>
    <title>Test</title>
    <icon>
        <name>custom-icon</name>
        <url>custom-icon.svg</url>
        <type>img</type>
    </icon>
</idevice-config>`;

        const result = parseIdeviceConfig(xml, 'test', mockBasePath);
        expect(result).not.toBeNull();
        expect(result!.icon).toEqual({
            name: 'custom-icon',
            url: 'custom-icon.svg',
            type: 'img',
        });
    });

    it('should use default values for missing optional fields', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<idevice-config>
</idevice-config>`;

        const result = parseIdeviceConfig(xml, 'empty', mockBasePath);
        expect(result).not.toBeNull();
        expect(result!.title).toBe('empty');
        expect(result!.cssClass).toBe('empty');
        expect(result!.category).toBe('Uncategorized');
        expect(result!.version).toBe('1.0');
        expect(result!.apiVersion).toBe('3.0');
        expect(result!.componentType).toBe('html');
        expect(result!.downloadable).toBe(false);
        expect(result!.exportObject).toBe('$empty');
    });

    it('should generate exportObject from ideviceId when not specified', () => {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<idevice-config>
    <title>Multi Word Name</title>
</idevice-config>`;

        const result = parseIdeviceConfig(xml, 'multi-word-name', mockBasePath);
        expect(result).not.toBeNull();
        expect(result!.exportObject).toBe('$multiwordname');
    });
});

// =============================================================================
// processNjkTemplateContent tests
// =============================================================================

describe('processNjkTemplateContent', () => {
    it('should remove Nunjucks comments', () => {
        const content = '{# This is a comment #}<div>Content</div>{# Another comment #}';
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<div>Content</div>');
    });

    it('should remove multiline Nunjucks comments', () => {
        const content = `{#
            This is a
            multiline comment
        #}<div>Keep this</div>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<div>Keep this</div>');
    });

    it('should handle trans filter in element content', () => {
        const content = `<button>{{ 'Save' | trans }}</button>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<button data-i18n="Save">Save</button>');
    });

    it('should handle trans filter in title attribute', () => {
        const content = `<button title="{{ 'Click to save' | trans }}">Save</button>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<button title="Click to save" data-i18n-title="Click to save">Save</button>');
    });

    it('should handle trans filter in placeholder attribute', () => {
        const content = `<input placeholder="{{ 'Enter name' | trans }}">`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<input placeholder="Enter name" data-i18n-placeholder="Enter name">');
    });

    it('should handle trans filter in aria-label attribute', () => {
        const content = `<button aria-label="{{ 'Close dialog' | trans }}">X</button>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<button aria-label="Close dialog" data-i18n-aria-label="Close dialog">X</button>');
    });

    it('should handle trans filter in alt attribute', () => {
        const content = `<img alt="{{ 'Logo image' | trans }}">`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<img alt="Logo image" data-i18n-alt="Logo image">');
    });

    it('should handle t.xxx or "default" pattern in attributes', () => {
        const content = `<button title="{{ t.save or 'Save' }}">Save</button>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<button title="Save" data-i18n-title="Save">Save</button>');
    });

    it('should handle t.xxx or "default" pattern in content', () => {
        const content = `<span>{{ t.hello or 'Hello' }}</span>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<span><span data-i18n="Hello">Hello</span></span>');
    });

    it('should wrap mixed content translations in span', () => {
        const content = `<p>Click {{ 'here' | trans }} to continue</p>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<p>Click <span data-i18n="here">here</span> to continue</p>');
    });

    it('should not place data-i18n on closing tags (icon + trans in button)', () => {
        const content = `<button><span class="exe-icon">delete</span> {{ 'Delete' | trans }}</button>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        // Pattern 2a skips closing tag >, falls through to pattern 2b which wraps in <span>
        expect(result).toBe(
            '<button><span class="exe-icon">delete</span> <span data-i18n="Delete">Delete</span></button>',
        );
    });

    it('should not place data-i18n on void elements like input', () => {
        const content = `<label><input type="checkbox" class="check"> {{ 'Show references' | trans }}</label>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        // input is void — pattern 2a skips it, pattern 2b wraps in <span>
        expect(result).toBe(
            '<label><input type="checkbox" class="check"> <span data-i18n="Show references">Show references</span></label>',
        );
    });

    it('should add data-i18n to opening tag when trans is sole content', () => {
        const content = `<option value="x">{{ 'Name A-Z' | trans }}</option>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<option value="x" data-i18n="Name A-Z">Name A-Z</option>');
    });

    it('should replace basePath with relative path', () => {
        const content = `<link href="{{ basePath }}/style/main.css">`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<link href="./style/main.css">');
    });

    it('should replace asset filter with relative path', () => {
        const content = `<script src="{{ 'app/bundle.js' | asset }}"></script>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<script src="./app/bundle.js"></script>');
    });

    it('should replace app_version variable', () => {
        const content = `<span>Version: {{ app_version }}</span>`;
        const result = processNjkTemplateContent(content, 'v3.1.0');
        expect(result).toBe('<span>Version: v3.1.0</span>');
    });

    it('should keep content for version with dash when checking app_version conditional', () => {
        const content = `{% if '-' in app_version %}<span>Dev version</span>{% endif %}`;
        const result = processNjkTemplateContent(content, 'v3.1.0-beta');
        expect(result).toBe('<span>Dev version</span>');
    });

    it('should remove content for version without dash when checking app_version conditional', () => {
        const content = `{% if '-' in app_version %}<span>Dev version</span>{% endif %}`;
        const result = processNjkTemplateContent(content, 'v3.1.0');
        expect(result).toBe('');
    });

    it('should keep content for isOfflineInstallation conditional', () => {
        const content = `{% if config.isOfflineInstallation %}<span>Offline</span>{% endif %}`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<span>Offline</span>');
    });

    it('should remove content for not isOfflineInstallation conditional', () => {
        const content = `{% if not config.isOfflineInstallation %}<span>Online</span>{% endif %}`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('');
    });

    it('should remove content for platformIntegration conditional', () => {
        const content = `{% if config.platformIntegration %}<span>Platform</span>{% endif %}`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('');
    });

    it('should remove user-related conditionals', () => {
        const content = `{% if user.isAdmin %}<span>Admin</span>{% endif %}`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('');
    });

    it('should remove remaining template tags', () => {
        const content = `{% include 'partial.njk' %}<div>Content</div>{% extends 'base.njk' %}`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<div>Content</div>');
    });

    it('should remove other variable patterns', () => {
        const content = `<span>{{ someVariable }}</span>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<span></span>');
    });

    it('should handle other attributes with trans filter', () => {
        const content = `<div data-tooltip="{{ 'Help text' | trans }}">Help</div>`;
        const result = processNjkTemplateContent(content, 'v1.0.0');
        expect(result).toBe('<div data-tooltip="Help text">Help</div>');
    });
});

// =============================================================================
// buildApiParameters tests
// =============================================================================

describe('buildApiParameters', () => {
    let params: ApiParameters;

    beforeAll(() => {
        params = buildApiParameters();
    });

    it('should return a valid structure', () => {
        expect(params).toBeDefined();
        expect(typeof params).toBe('object');
    });

    it('should include required routes', () => {
        expect(params.routes).toBeDefined();
        expect(params.routes.api_translations_lists).toBeDefined();
        expect(params.routes.api_translations_list_by_locale).toBeDefined();
        expect(params.routes.api_idevices_installed).toBeDefined();
        expect(params.routes.api_themes_installed).toBeDefined();
        expect(params.routes.api_config_upload_limits).toBeDefined();
    });

    it('should include user preferences config', () => {
        expect(params.userPreferencesConfig).toBeDefined();
        expect(params.userPreferencesConfig.locale).toBeDefined();
        expect(params.userPreferencesConfig.advancedMode).toBeDefined();
        expect(params.userPreferencesConfig.defaultLicense).toBeDefined();
    });

    it('should include defaultAI without altering existing preferences', () => {
        expect(params.userPreferencesConfig.defaultAI).toBeDefined();
        expect(params.userPreferencesConfig.defaultAI.type).toBe('select');
        expect(params.userPreferencesConfig.defaultAI.value).toBe('https://chatgpt.com/?q=');
        expect(params.userPreferencesConfig.defaultAI.options).toBeDefined();

        // Ensure existing keys remain intact
        expect(params.userPreferencesConfig.locale).toBeDefined();
        expect(params.userPreferencesConfig.advancedMode).toBeDefined();
        expect(params.userPreferencesConfig.defaultLicense).toBeDefined();
        expect(params.userPreferencesConfig.theme).toBeDefined();
        expect(params.userPreferencesConfig.versionControl).toBeDefined();
    });

    it('should include iDevice info fields config', () => {
        expect(params.ideviceInfoFieldsConfig).toBeDefined();
        expect(params.ideviceInfoFieldsConfig.title).toBeDefined();
        expect(params.ideviceInfoFieldsConfig.description).toBeDefined();
    });

    it('should include theme info fields config', () => {
        expect(params.themeInfoFieldsConfig).toBeDefined();
        expect(params.themeInfoFieldsConfig.title).toBeDefined();
    });

    it('should include project sync properties config', () => {
        expect(params.odeProjectSyncPropertiesConfig).toBeDefined();
        expect(params.odeProjectSyncPropertiesConfig.properties).toBeDefined();
    });

    it('should include nav structure properties config', () => {
        expect(params.odeNavStructureSyncPropertiesConfig).toBeDefined();
        expect(params.odeNavStructureSyncPropertiesConfig.titleNode).toBeDefined();
        expect(params.odeNavStructureSyncPropertiesConfig.visibility).toBeDefined();
    });

    it('should include pag structure properties config', () => {
        expect(params.odePagStructureSyncPropertiesConfig).toBeDefined();
        expect(params.odePagStructureSyncPropertiesConfig.visibility).toBeDefined();
    });

    it('should include component properties config', () => {
        expect(params.odeComponentsSyncPropertiesConfig).toBeDefined();
        expect(params.odeComponentsSyncPropertiesConfig.visibility).toBeDefined();
        expect(params.odeComponentsSyncPropertiesConfig.teacherOnly).toBeDefined();
    });

    it('should have correct route methods', () => {
        expect(params.routes.api_translations_lists.methods).toContain('GET');
        expect(params.routes.api_idevices_installed.methods).toContain('GET');
    });
});

// =============================================================================
// generatePwaManifestContent tests
// =============================================================================

describe('generatePwaManifestContent', () => {
    it('should return valid JSON', () => {
        const result = generatePwaManifestContent('v1.0.0', 'abc123');
        expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should include version in name', () => {
        const result = generatePwaManifestContent('v3.1.0', 'abc123');
        const parsed = JSON.parse(result);
        expect(parsed.name).toBe('eXeLearning Editor (v3.1.0)');
    });

    it('should include required PWA fields', () => {
        const result = generatePwaManifestContent('v1.0.0', 'abc123');
        const parsed = JSON.parse(result);

        expect(parsed.short_name).toBe('eXeLearning');
        expect(parsed.description).toBeDefined();
        expect(parsed.start_url).toBe('./index.html');
        expect(parsed.display).toBe('standalone');
        expect(parsed.background_color).toBe('#ffffff');
        expect(parsed.theme_color).toBe('#00a99d');
    });

    it('should include icons array', () => {
        const result = generatePwaManifestContent('v1.0.0', 'abc123');
        const parsed = JSON.parse(result);

        expect(Array.isArray(parsed.icons)).toBe(true);
        expect(parsed.icons.length).toBeGreaterThan(0);

        const hasValidIcon = parsed.icons.some(
            (icon: { src: string; type: string }) =>
                icon.src && icon.type
        );
        expect(hasValidIcon).toBe(true);
    });

    it('should include file handlers for .elpx and .elp', () => {
        const result = generatePwaManifestContent('v1.0.0', 'abc123');
        const parsed = JSON.parse(result);

        expect(Array.isArray(parsed.file_handlers)).toBe(true);
        expect(parsed.file_handlers.length).toBeGreaterThan(0);

        const handler = parsed.file_handlers[0];
        expect(handler.accept['application/x-exelearning']).toContain('.elpx');
        expect(handler.accept['application/x-exelearning']).toContain('.elp');
    });

    it('should include unique id with version and hash', () => {
        const result = generatePwaManifestContent('v2.0.0', 'xyz789');
        const parsed = JSON.parse(result);
        expect(parsed.id).toBe('exelearning-v2.0.0-xyz789');
    });

    it('should include share target', () => {
        const result = generatePwaManifestContent('v1.0.0', 'abc123');
        const parsed = JSON.parse(result);

        expect(parsed.share_target).toBeDefined();
        expect(parsed.share_target.action).toBe('./index.html');
        expect(parsed.share_target.method).toBe('POST');
    });
});

// =============================================================================
// generateServiceWorkerContent tests
// =============================================================================

describe('generateServiceWorkerContent', () => {
    it('should return valid JavaScript', () => {
        const result = generateServiceWorkerContent('v1.0.0', 'abc123');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
    });

    it('should include cache name with version and hash', () => {
        const result = generateServiceWorkerContent('v3.1.0', 'def456');
        expect(result).toContain("CACHE_NAME = 'exelearning-static-v3.1.0-def456'");
    });

    it('should include essential static assets', () => {
        const result = generateServiceWorkerContent('v1.0.0', 'abc123');

        expect(result).toContain('./index.html');
        expect(result).toContain('./app/app.bundle.js');
        expect(result).toContain('./libs/yjs/yjs.min.js');
        expect(result).toContain('./data/bundle.json');
        expect(result).toContain('./style/workarea/main.css');
    });

    it('should include install event handler', () => {
        const result = generateServiceWorkerContent('v1.0.0', 'abc123');
        expect(result).toContain("self.addEventListener('install'");
        expect(result).toContain('cache.addAll(STATIC_ASSETS)');
    });

    it('should include activate event handler', () => {
        const result = generateServiceWorkerContent('v1.0.0', 'abc123');
        expect(result).toContain("self.addEventListener('activate'");
        expect(result).toContain('caches.delete(key)');
    });

    it('should include fetch event handler', () => {
        const result = generateServiceWorkerContent('v1.0.0', 'abc123');
        expect(result).toContain("self.addEventListener('fetch'");
        expect(result).toContain('event.respondWith');
    });

    it('should handle offline fallback', () => {
        const result = generateServiceWorkerContent('v1.0.0', 'abc123');
        expect(result).toContain('caches.match(event.request)');
        expect(result).toContain("caches.match('./index.html')");
    });
});

// =============================================================================
// Configuration exports tests
// =============================================================================

describe('Configuration exports', () => {
    describe('LOCALES', () => {
        it('should be an array of locale codes', () => {
            expect(Array.isArray(LOCALES)).toBe(true);
            expect(LOCALES.length).toBeGreaterThan(0);
        });

        it('should include common locales', () => {
            expect(LOCALES).toContain('en');
            expect(LOCALES).toContain('es');
        });
    });

    describe('LOCALE_NAMES', () => {
        it('should be an object mapping codes to names', () => {
            expect(typeof LOCALE_NAMES).toBe('object');
            expect(LOCALE_NAMES.en).toBe('English');
            expect(LOCALE_NAMES.es).toBe('Español');
        });

        it('should have entry for each locale', () => {
            for (const locale of LOCALES) {
                expect(LOCALE_NAMES[locale]).toBeDefined();
                expect(typeof LOCALE_NAMES[locale]).toBe('string');
            }
        });
    });

    describe('PACKAGE_LOCALES', () => {
        it('should include all LOCALE_NAMES entries', () => {
            for (const [locale, label] of Object.entries(LOCALE_NAMES)) {
                expect(PACKAGE_LOCALES[locale]).toBe(label);
            }
        });
    });

    describe('LICENSES', () => {
        it('should be an object with license options', () => {
            expect(typeof LICENSES).toBe('object');
            expect(Object.keys(LICENSES).length).toBeGreaterThan(0);
        });

        it('should include Creative Commons licenses', () => {
            const hasCC = Object.keys(LICENSES).some((key) =>
                key.toLowerCase().includes('creative commons')
            );
            expect(hasCC).toBe(true);
        });

        it('should include public domain', () => {
            expect(LICENSES['public domain']).toBeDefined();
        });

        it('should not include legacy licenses', () => {
            // Legacy licenses have version 3.0 or 2.5
            const hasLegacy = Object.keys(LICENSES).some(
                (key) => key.includes('3.0') || key.includes('2.5')
            );
            expect(hasLegacy).toBe(false);
        });
    });
});

// =============================================================================
// Static HTML i18n coverage tests
// =============================================================================

describe('Static HTML i18n coverage', () => {
    let html: string;

    beforeAll(() => {
        const templatePath = path.join(import.meta.dir, 'static-bundle/static-index.html');
        html = fs.readFileSync(templatePath, 'utf-8');
    });

    it('should have data-i18n on styles title', () => {
        expect(html).toContain('data-i18n="Styles"');
    });

    it('should have data-i18n on System tab button', () => {
        expect(html).toContain('data-i18n="System"');
    });

    it('should have data-i18n on Imported tab button', () => {
        expect(html).toContain('data-i18n="Imported"');
    });

    it('should have data-i18n on "No recent projects..." items', () => {
        expect(html).toContain('data-i18n="No recent projects..."');
    });

    it('should use _() for delete project confirmation', () => {
        expect(html).toContain("_('Delete this project?')");
        expect(html).toContain("_('This action cannot be undone.')");
    });
});

// =============================================================================
// Translation key existence tests
// =============================================================================

describe('Translation key existence in XLF catalog', () => {
    let xlfContent: string;

    beforeAll(() => {
        const xlfPath = path.join(import.meta.dir, '../translations/messages.es.xlf');
        xlfContent = fs.readFileSync(xlfPath, 'utf-8');
    });

    const requiredKeys: Array<[string, string]> = [
        ['Styles', 'Estilos'],
        ['System', 'Sistema'],
        ['Imported', 'Importado'],
        ['No recent projects...', 'No hay proyectos recientes...'],
        ['Delete this project?', '¿Eliminar este proyecto?'],
        ['This action cannot be undone.', 'Esta acción no se puede deshacer.'],
    ];

    for (const [source, target] of requiredKeys) {
        it(`should contain translation key "${source}" → "${target}"`, () => {
            const translations = parseXlfContent(xlfContent);
            expect(translations[source]).toBe(target);
        });
    }
});

// =============================================================================
// Config parameter parity tests
// =============================================================================

describe('Config parameter parity between static and server', () => {
    it('should return the same config keys from buildApiParameters and buildConfigParams', () => {
        const staticParams = buildApiParameters();

        const serverConfig = buildConfigParams({
            TRANS_PREFIX: '',
            LICENSES,
            PACKAGE_LOCALES,
            LOCALES: LOCALE_NAMES,
        });

        // Verify that all config keys from the shared buildConfigParams are used in static buildApiParameters
        expect(Object.keys(staticParams.userPreferencesConfig).sort()).toEqual(
            Object.keys(serverConfig.USER_PREFERENCES_CONFIG).sort()
        );
        expect(Object.keys(staticParams.ideviceInfoFieldsConfig).sort()).toEqual(
            Object.keys(serverConfig.IDEVICE_INFO_FIELDS_CONFIG).sort()
        );
        expect(Object.keys(staticParams.themeInfoFieldsConfig).sort()).toEqual(
            Object.keys(serverConfig.THEME_INFO_FIELDS_CONFIG).sort()
        );
        expect(Object.keys(staticParams.odeProjectSyncPropertiesConfig).sort()).toEqual(
            Object.keys(serverConfig.ODE_PROJECT_SYNC_PROPERTIES_CONFIG).sort()
        );
        expect(Object.keys(staticParams.odeComponentsSyncPropertiesConfig).sort()).toEqual(
            Object.keys(serverConfig.ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG).sort()
        );
        expect(Object.keys(staticParams.odeNavStructureSyncPropertiesConfig).sort()).toEqual(
            Object.keys(serverConfig.ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG).sort()
        );
        expect(Object.keys(staticParams.odePagStructureSyncPropertiesConfig).sort()).toEqual(
            Object.keys(serverConfig.ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG).sort()
        );
    });
});
