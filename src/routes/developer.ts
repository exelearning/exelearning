import { Elysia } from 'elysia';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as Y from 'yjs';
import { renderTemplate } from '../services/template';
import { detectLocaleFromHeader, trans, DEFAULT_LOCALE } from '../services/translation';
import { getBasePath } from '../utils/basepath.util';
import {
    Html5Exporter,
    PageExporter,
    Scorm12Exporter,
    FileSystemResourceProvider,
    FileSystemAssetProvider,
    FflateZipProvider,
    YjsDocumentAdapter,
    ServerYjsDocumentWrapper,
} from '../shared/export';
import { ElpxImporter, FileSystemAssetHandler } from '../shared/import';
import { getAllSessions } from '../services/session-manager';
import { reconstructDocument } from '../websocket/yjs-persistence';
import { withDocument } from '../yjs';
import { db } from '../db/client';
import { findProjectByUuid } from '../db/queries';
import {
    createTheme,
    updateTheme,
    getNextSiteThemeSortOrder,
    findThemeByDirName,
    deleteTheme,
} from '../db/queries/themes';
import { DatabaseAssetProvider } from '../shared/export/providers/DatabaseAssetProvider';
import * as fflate from 'fflate';

const isDev = () => process.env.APP_ENV === 'dev';

const FIXTURES_PATH = 'test/fixtures';
const DEV_FIXTURES_PATH = 'public/dev/fixtures';
const PUBLIC_DIR = 'public';
const THEMES_BASE_PATH = 'public/files/perm/themes/base';

const ALLOWED_EXPORT_TYPES = ['html5', 'html5-sp', 'scorm12'] as const;
type AllowedExportType = (typeof ALLOWED_EXPORT_TYPES)[number];

export interface StyleLabMetaOverrides {
    addSearchBox?: boolean;
    addPagination?: boolean;
    addAccessibilityToolbar?: boolean;
    addExeLink?: boolean;
    exportSource?: boolean;
}

interface StyleLabThemeMetadata {
    name?: string;
    title?: string;
    version?: string;
    compatibility?: string;
    author?: string;
    license?: string;
    licenseUrl?: string;
    description?: string;
    downloadable?: string;
}

const THEME_METADATA_TAGS: Record<keyof StyleLabThemeMetadata, string> = {
    name: 'name',
    title: 'title',
    version: 'version',
    compatibility: 'compatibility',
    author: 'author',
    license: 'license',
    licenseUrl: 'license-url',
    description: 'description',
    downloadable: 'downloadable',
};

function jsonError(error: string, status: number): Response {
    return new Response(JSON.stringify({ error }), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

function safeFixturePath(filename: string): string | null {
    const basename = path.basename(filename);
    for (const base of [FIXTURES_PATH, DEV_FIXTURES_PATH]) {
        const resolved = path.resolve(path.join(base, basename));
        const resolvedBase = path.resolve(base);
        if (resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase) {
            if (fs.existsSync(resolved)) return resolved;
        }
    }
    return null;
}

function listFixtures(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter(e => e.isFile() && e.name.endsWith('.elpx'))
        .map(e => e.name)
        .sort();
}

async function buildPreview(
    fixturePath: string,
    theme: string,
    exportType: AllowedExportType,
    metaOverrides: StyleLabMetaOverrides = {},
): Promise<Uint8Array> {
    const elpxBuffer = new Uint8Array(await fs.promises.readFile(fixturePath));
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'exe-style-lab-'));
    try {
        const ydoc = new Y.Doc();
        const assetHandler = new FileSystemAssetHandler(tempDir);
        const importer = new ElpxImporter(ydoc, assetHandler);
        await importer.importFromBuffer(elpxBuffer);

        if (Object.keys(metaOverrides).length > 0) {
            const metaMap = ydoc.getMap('metadata');
            ydoc.transact(() => {
                for (const [key, value] of Object.entries(metaOverrides)) {
                    if (value !== undefined) metaMap.set(key, value);
                }
            });
        }

        const fakeOdeId = 'fixture-preview';
        const wrapper = new ServerYjsDocumentWrapper(ydoc, fakeOdeId);
        const document = new YjsDocumentAdapter(wrapper);
        const resources = new FileSystemResourceProvider(PUBLIC_DIR);
        const assets = new FileSystemAssetProvider(tempDir);
        const zip = new FflateZipProvider();

        let exporter;
        switch (exportType) {
            case 'html5-sp':
                exporter = new PageExporter(document, resources, assets, zip);
                break;
            case 'scorm12':
                exporter = new Scorm12Exporter(document, resources, assets, zip);
                break;
            default:
                exporter = new Html5Exporter(document, resources, assets, zip);
        }

        const result = await exporter.export({ theme });
        wrapper.destroy();
        if (!result.success || !result.data) throw new Error(result.error || 'Export failed');
        return result.data;
    } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
}

function parseBoolParam(value: string | undefined): boolean | undefined {
    if (value === '1' || value === 'true') return true;
    if (value === '0' || value === 'false') return false;
    return undefined;
}

/** Resolve theme directory: checks base themes then site themes */
function resolveThemeDir(themeDirName: string): string | null {
    const basePath = path.join(THEMES_BASE_PATH, themeDirName);
    if (fs.existsSync(basePath)) return basePath;
    // Site themes stored in FILES_DIR/themes/site/
    const filesDir = process.env.FILES_DIR || './data';
    const sitePath = path.join(filesDir, 'themes', 'site', themeDirName);
    if (fs.existsSync(sitePath)) return sitePath;
    return null;
}

/** Patch a tag value in a theme config.xml string */
function patchConfigXml(xmlContent: string, updates: Record<string, string>): string {
    let result = xmlContent;
    for (const [tag, value] of Object.entries(updates)) {
        const escaped = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const regex = new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`);
        if (regex.test(result)) {
            result = result.replace(regex, `<${tag}>${escaped}</${tag}>`);
        } else {
            result = result.replace(/<\/theme>/, `  <${tag}>${escaped}</${tag}>\n</theme>`);
        }
    }
    return result;
}

function normalizeThemeMetadata(metadata: StyleLabThemeMetadata | undefined): Record<string, string> {
    const updates: Record<string, string> = {};
    for (const [key, tag] of Object.entries(THEME_METADATA_TAGS) as [keyof StyleLabThemeMetadata, string][]) {
        const value = metadata?.[key];
        if (value === undefined) continue;
        const text = String(value).trim();
        if (text === '' && key !== 'description') continue;
        updates[tag] = key === 'downloadable' && text !== '0' ? '1' : text;
    }
    return updates;
}

function defaultConfigXml(metadata: Record<string, string>): string {
    const values = {
        name: metadata.name || 'style-lab-theme',
        title: metadata.title || metadata.name || 'Style Lab Theme',
        version: metadata.version || '1.0',
        compatibility: metadata.compatibility || '3.0',
        author: metadata.author || '',
        license: metadata.license || '',
        'license-url': metadata['license-url'] || '',
        description: metadata.description || '',
        downloadable: metadata.downloadable || '1',
    };
    const escaped = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
            key,
            value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        ]),
    );
    return `<?xml version="1.0"?>
<theme>
    <name>${escaped.name}</name>
    <title>${escaped.title}</title>
    <version>${escaped.version}</version>
    <compatibility>${escaped.compatibility}</compatibility>
    <author>${escaped.author}</author>
    <license>${escaped.license}</license>
    <license-url>${escaped['license-url']}</license-url>
    <description>${escaped.description}</description>
    <downloadable>${escaped.downloadable}</downloadable>
</theme>`;
}

function commonRoot(names: string[]): string {
    if (!names.length) return '';
    const candidate = names[0].split('/')[0];
    if (names.length === 1 && !names[0].includes('/')) return '';
    if (names.every(n => n.startsWith(candidate + '/'))) return candidate;
    return '';
}

function normalizeZipEntryPath(rawPath: string): string | null {
    if (!rawPath || rawPath.includes('\\') || rawPath.includes('\0')) return null;
    const normalized = path.posix.normalize(rawPath);
    if (
        !normalized ||
        normalized === '.' ||
        normalized.startsWith('../') ||
        normalized === '..' ||
        path.posix.isAbsolute(normalized)
    ) {
        return null;
    }
    return normalized;
}

function safeTargetPath(baseDir: string, relativePath: string): string | null {
    const normalized = normalizeZipEntryPath(relativePath);
    if (!normalized) return null;
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(baseDir, normalized);
    if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) return null;
    return resolvedTarget;
}

/** Build an installable theme ZIP from the theme directory + file overrides (CSS, config.xml…) */
async function buildThemeZip(
    themeDir: string,
    fileOverrides: Record<string, string>,
    binaryOverrides: Record<string, Uint8Array> = {},
): Promise<Uint8Array> {
    const zipFiles: Record<string, Uint8Array> = {};

    async function addDir(dir: string, prefix: string) {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            // Skip files with non-standard names (spaces, parentheses, etc.)
            // that may be created by sync tools (e.g. Syncthing conflict copies).
            // Only allow safe filename characters to prevent invalid CSS/JS from
            // being packaged into the theme ZIP and later linked in exported HTML.
            if (!/^[a-zA-Z0-9._-]+$/.test(entry.name)) continue;
            const fullPath = path.join(dir, entry.name);
            const zipPath = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                await addDir(fullPath, zipPath);
            } else {
                if (binaryOverrides[zipPath] !== undefined) {
                    zipFiles[zipPath] = binaryOverrides[zipPath];
                } else if (fileOverrides[zipPath] !== undefined) {
                    zipFiles[zipPath] = Buffer.from(fileOverrides[zipPath], 'utf-8');
                } else {
                    zipFiles[zipPath] = await fs.promises.readFile(fullPath);
                }
            }
        }
    }

    await addDir(themeDir, '');
    if (!zipFiles['config.xml'] && fileOverrides['config.xml'] !== undefined) {
        zipFiles['config.xml'] = Buffer.from(fileOverrides['config.xml'], 'utf-8');
    }
    // Binary overrides at root level (e.g. screenshot.png) not present in themeDir
    for (const [zipPath, data] of Object.entries(binaryOverrides)) {
        const safeZipPath = normalizeZipEntryPath(zipPath);
        if (!safeZipPath) throw new Error(`Invalid theme file path: ${zipPath}`);
        if (zipFiles[safeZipPath] === undefined) zipFiles[safeZipPath] = data;
    }
    return fflate.zipSync(zipFiles);
}

export const developerRoutes = new Elysia({ name: 'developer-routes' })

    .get('/developer/style-lab', ({ set, request }) => {
        if (!isDev()) {
            set.status = 404;
            return 'Not Found';
        }
        const acceptLanguage = request.headers.get('accept-language');
        const locale = process.env.APP_LOCALE || detectLocaleFromHeader(acceptLanguage) || DEFAULT_LOCALE;

        const t = {
            sl_back: trans('Back to editor', {}, locale),
            sl_tab_preview: trans('Preview', {}, locale),
            sl_tab_code: trans('Code', {}, locale),
            sl_tab_design: trans('Design', {}, locale),
            sl_tab_package: trans('Package', {}, locale),
            sl_project: trans('Project', {}, locale),
            sl_project_hint: trans('Open a project in eXeLearning to see it here.', {}, locale),
            sl_delete_theme: trans('Delete theme', {}, locale),
            sl_open_in_window: trans('Open in new window', {}, locale),
            sl_apply_export: trans('Apply / export theme...', {}, locale),
            sl_apply_hint: trans(
                'Use this button to save changes and install them in the project. If you have modified a base theme you will need to give it a new name.',
                {},
                locale,
            ),
            sl_discard_back: trans('Back to editor (discard changes)', {}, locale),
            sl_reload_theme: trans('Reload theme from disk', {}, locale),
            sl_file_list_empty: trans('Load a project and theme first.', {}, locale),
            sl_unsaved_changes: trans('Unsaved changes', {}, locale),
            sl_css_placeholder: trans('Load a project and theme to edit CSS...', {}, locale),
            sl_apply_css: trans('Apply', {}, locale),
            sl_reset_css: trans('Reset', {}, locale),
            sl_wrap_scope: trans('Wrap scope', {}, locale),
            sl_general_appearance: trans('General appearance', {}, locale),
            sl_typography: trans('Typography', {}, locale),
            sl_headings: trans('Headings', {}, locale),
            sl_nav_menu: trans('Navigation menu', {}, locale),
            sl_idevices_buttons: trans('iDevices and buttons', {}, locale),
            sl_link_color: trans('Link color', {}, locale),
            sl_page_title_color: trans('Page title color', {}, locale),
            sl_text_color: trans('Text color', {}, locale),
            sl_content_bg: trans('Content background', {}, locale),
            sl_page_bg: trans('Page background', {}, locale),
            sl_outer_bg: trans('Outer background', {}, locale),
            sl_body_font: trans('Body font', {}, locale),
            sl_headings_font: trans('Headings font', {}, locale),
            sl_base_size: trans('Base size (px)', {}, locale),
            sl_line_height: trans('Line height', {}, locale),
            sl_page_title_size: trans('Page title size (rem)', {}, locale),
            sl_page_title_weight: trans('Page title weight', {}, locale),
            sl_uppercase_title: trans('Uppercase title', {}, locale),
            sl_project_title_color: trans('Project title color', {}, locale),
            sl_menu_bg: trans('Menu background', {}, locale),
            sl_menu_text: trans('Menu text', {}, locale),
            sl_hover_bg: trans('Hover background', {}, locale),
            sl_hover_text: trans('Hover text', {}, locale),
            sl_active_bg: trans('Active background', {}, locale),
            sl_active_text: trans('Active text', {}, locale),
            sl_idevice_bg: trans('iDevice background', {}, locale),
            sl_idevice_border: trans('iDevice border', {}, locale),
            sl_idevice_title_color: trans('iDevice title color', {}, locale),
            sl_button_bg: trans('Button background', {}, locale),
            sl_button_text: trans('Button text', {}, locale),
            sl_generating_preview: trans('Generating preview...', {}, locale),
            sl_placeholder_hint: trans('Select a project and theme, then click Preview', {}, locale),
            sl_font_size_px: trans('Font size (px)', {}, locale),
            sl_apply_to_css: trans('Apply to CSS', {}, locale),
            sl_export_install_modal: trans('Export / install theme', {}, locale),
            sl_base_theme_warning_title: trans('⚠ Predefined theme', {}, locale),
            sl_base_theme_warning_body: trans(
                'You cannot save changes to a base theme with the same name. Enter a new name and identifier.',
                {},
                locale,
            ),
            sl_theme_name: trans('Theme name', {}, locale),
            sl_identifier: trans('Identifier (ID)', {}, locale),
            sl_compatibility: trans('Compatibility', {}, locale),
            sl_importable: trans('Importable', {}, locale),
            sl_theme_name_ph: trans('My custom theme', {}, locale),
            sl_dir_name_ph: trans('my-theme', {}, locale),
            sl_dir_name_hint: trans('Lowercase, numbers, hyphens and underscores only.', {}, locale),
            sl_download_zip: trans('Download ZIP', {}, locale),
            sl_install_apply: trans('Install and apply to project', {}, locale),
            sl_install_apply_title: trans(
                'Install the theme and apply it to the project open in the editor',
                {},
                locale,
            ),
            sl_no_session_title: trans('Open a project in the editor to apply the theme directly', {}, locale),
            // JS strings injected into the T constant
            sl_js_undone: trans('Undone.', {}, locale),
            sl_js_redone: trans('Redone.', {}, locale),
            sl_js_open_project: trans('Project open in editor', {}, locale),
            sl_js_fixtures: trans('Test fixtures', {}, locale),
            sl_js_error_loading: trans('Error loading', {}, locale),
            sl_js_select_theme: trans('— select theme —', {}, locale),
            sl_js_css_applied: trans('CSS applied.', {}, locale),
            sl_js_css_reset: trans('CSS reset.', {}, locale),
            sl_js_scope_all: trans('Scope is "all formats" — no wrapper needed.', {}, locale),
            sl_js_select_css_first: trans('Select CSS text to wrap first.', {}, locale),
            sl_js_wrapped: trans('Selection wrapped with scope.', {}, locale),
            sl_js_rule_added: trans('Rule added to CSS editor.', {}, locale),
            sl_js_inspect_hint: trans('⊕ Click an element in the preview...', {}, locale),
            sl_js_ready: trans('Ready', {}, locale),
            sl_js_load_preview_first: trans('Load a preview first.', {}, locale),
            sl_js_select_theme_first: trans('Select a theme first.', {}, locale),
            sl_js_fill_name_id: trans('Fill in the name and identifier.', {}, locale),
            sl_js_id_invalid: trans('The identifier can only contain lowercase letters, numbers, - and _.', {}, locale),
            sl_js_capturing: trans('Capturing thumbnail...', {}, locale),
            sl_js_installing: trans('Installing theme...', {}, locale),
            sl_js_theme_applied: trans('Theme applied to project. Returning to editor...', {}, locale),
            sl_js_theme_installed_no_apply: trans(
                'Theme installed but could not be applied to project. Check the server console.',
                {},
                locale,
            ),
            sl_js_theme_installed: trans('Theme installed: ', {}, locale),
            sl_js_exporting: trans('Exporting theme...', {}, locale),
            sl_js_downloaded: trans('Downloaded: ', {}, locale),
            sl_js_error_deleting: trans('Error deleting: ', {}, locale),
            sl_js_error_deleting_theme: trans('Error deleting theme.', {}, locale),
            sl_js_theme_deleted: trans('Theme deleted: ', {}, locale),
            sl_js_generating: trans('Generating preview...', {}, locale),
            sl_js_fetching: trans('Fetching export...', {}, locale),
            sl_js_decompressing: trans('Decompressing...', {}, locale),
            sl_js_sending_sw: trans('Sending to Service Worker...', {}, locale),
            sl_js_select_fixture_theme: trans('Select project and theme first.', {}, locale),
            sl_js_confirm_unsaved: trans(
                'You have unapplied style changes.\n\nIf you go back to the editor now the changes will be lost.\n\nTo keep them use the "✓ Apply / export theme..." button in the left panel.\n\nDiscard changes and go back to the editor?',
                {},
                locale,
            ),
            sl_js_confirm_discard: trans('Discard changes and go back to the editor?', {}, locale),
            sl_js_confirm_delete: trans('Delete theme "{name}"?\nThis action cannot be undone.', {}, locale),
            // Package tab
            sl_import_zip: trans('Import theme ZIP', {}, locale),
            sl_select_zip: trans('Select ZIP...', {}, locale),
            sl_install_uploaded: trans('Install uploaded theme', {}, locale),
            sl_export_install_section: trans('Export / install', {}, locale),
            sl_manage: trans('Manage', {}, locale),
            sl_open_preview_window: trans('Open preview in new window', {}, locale),
            sl_goto_files: trans('Export / install theme...', {}, locale),
            sl_js_reading_zip: trans('Reading ZIP...', {}, locale),
            sl_js_uploading_theme: trans('Uploading theme...', {}, locale),
            sl_js_theme_uploaded: trans('Theme installed: ', {}, locale),
            // Inspect modal
            sl_inspect: trans('Inspect', {}, locale),
            sl_inspect_title: trans('Click-to-edit: click an element in the preview', {}, locale),
            sl_text_transparency: trans('Text transparency (%)', {}, locale),
            sl_bg_transparency: trans('Background transparency (%)', {}, locale),
            sl_margin_left: trans('Margin left', {}, locale),
            sl_margin_right: trans('Margin right', {}, locale),
            sl_width: trans('Width', {}, locale),
            sl_max_width: trans('Max width', {}, locale),
            sl_margin_bottom: trans('Margin bottom', {}, locale),
            sl_padding: trans('Padding', {}, locale),
            sl_hover_states: trans('Hover/focus/active too', {}, locale),
            sl_align_justify: trans('Justify', {}, locale),
            // Custom fonts
            sl_custom_fonts: trans('Custom fonts', {}, locale),
            sl_add_fonts: trans('Add...', {}, locale),
            sl_no_custom_fonts: trans('No custom fonts', {}, locale),
            sl_js_no_valid_fonts: trans('No valid font files (.woff, .woff2, .ttf, .otf).', {}, locale),
            sl_js_fonts_added: trans('Fonts added: {n}. Available in Typography selectors.', {}, locale),
        };

        const html = renderTemplate('workarea/developer/style-lab', {
            basePath: getBasePath(),
            appEnv: process.env.APP_ENV || 'dev',
            locale,
            t,
        });
        set.headers['Content-Type'] = 'text/html; charset=utf-8';
        return html;
    })

    // List available fixtures from test/fixtures/ and public/dev/fixtures/
    .get('/api/developer/fixtures', ({ set }) => {
        if (!isDev()) {
            set.status = 404;
            return { error: 'Not Found' };
        }
        const fixtures = listFixtures(FIXTURES_PATH);
        const devFixtures = listFixtures(DEV_FIXTURES_PATH).filter(f => !fixtures.includes(f));
        return { fixtures: [...fixtures, ...devFixtures] };
    })

    // List active project sessions (projects open in the editor right now)
    // sessionId === project UUID; only sessions with a saved project in DB are shown.
    // Title comes from DB so it's always up-to-date (session.fileName may lag behind).
    .get('/api/developer/sessions', async ({ set }) => {
        if (!isDev()) {
            set.status = 404;
            return { error: 'Not Found' };
        }
        const allSessions = getAllSessions();
        const seen = new Set<string>();
        const results: { sessionId: string; fileName: string; theme?: string }[] = [];
        for (const s of allSessions) {
            if (seen.has(s.sessionId)) continue;
            seen.add(s.sessionId);
            try {
                const project = await findProjectByUuid(db, s.sessionId);
                if (!project?.title || !project.saved_once) continue; // skip untitled or never-saved projects
                let theme: string | undefined;
                try {
                    const ydoc = await reconstructDocument(project.id);
                    theme = (ydoc?.getMap('metadata')?.get('theme') as string) || undefined;
                } catch {
                    /* theme stays undefined */
                }
                results.push({ sessionId: s.sessionId, fileName: project.title, theme });
            } catch {
                /* skip on error */
            }
        }
        return { sessions: results };
    })

    // Serve a fixture file by name
    .get('/api/developer/fixtures/:filename', ({ params, set }) => {
        if (!isDev()) {
            set.status = 404;
            return new Response('Not Found', { status: 404 });
        }

        const filePath = safeFixturePath(params.filename);
        if (!filePath) {
            set.status = 404;
            return new Response('Not Found', { status: 404 });
        }

        const data = fs.readFileSync(filePath);
        const basename = path.basename(filePath);
        return new Response(data, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${basename}"`,
            },
        });
    })

    // Manifest: fixture list + export presets (for AI/automation tooling)
    .get('/api/developer/manifest', async ({ set }) => {
        if (!isDev()) {
            set.status = 404;
            return { error: 'Not Found' };
        }
        const fixtures = [...listFixtures(FIXTURES_PATH), ...listFixtures(DEV_FIXTURES_PATH)];
        return {
            fixtures,
            exportTypes: [
                { id: 'html5', label: 'Website' },
                { id: 'html5-sp', label: 'Single page' },
                { id: 'scorm12', label: 'SCORM 1.2' },
            ],
            viewports: [
                { id: 'desktop', label: 'Desktop' },
                { id: 'tablet', label: 'Tablet', maxWidth: 768 },
                { id: 'mobile', label: 'Mobile', maxWidth: 390 },
            ],
            exportOptions: [
                { id: 'addSearchBox', label: 'Search box', default: false },
                { id: 'addPagination', label: 'Page counter', default: false },
                { id: 'addAccessibilityToolbar', label: 'Accessibility toolbar', default: false },
                { id: 'addExeLink', label: 'eXeLearning link', default: true },
                { id: 'exportSource', label: 'Include source (content.xml)', default: true },
            ],
        };
    })

    // List all files in a theme directory
    .get('/api/developer/style-lab/theme-files', async ({ query, set }) => {
        if (!isDev()) {
            set.status = 404;
            return new Response('Not Found', { status: 404 });
        }
        const { theme } = query as Record<string, string>;
        if (!theme) {
            set.status = 400;
            return { error: 'theme required' };
        }
        const themeDir = resolveThemeDir(theme);
        if (!themeDir) {
            set.status = 404;
            return { error: 'Theme not found' };
        }
        const TEXT_EXT = new Set(['css', 'js', 'xml', 'txt', 'svg', 'html', 'json']);
        const results: { path: string; size: number; editable: boolean }[] = [];
        async function walk(dir: string, prefix: string) {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const e of entries) {
                const rel = prefix ? `${prefix}/${e.name}` : e.name;
                if (e.isDirectory()) {
                    await walk(path.join(dir, e.name), rel);
                } else {
                    const ext = e.name.split('.').pop()?.toLowerCase() ?? '';
                    const stat = await fs.promises.stat(path.join(dir, e.name));
                    results.push({ path: rel, size: stat.size, editable: TEXT_EXT.has(ext) });
                }
            }
        }
        await walk(themeDir, '');
        return { files: results };
    })

    // Generate preview ZIP from fixture + theme + export options
    .get('/api/developer/style-lab/preview', async ({ query, set }) => {
        if (!isDev()) {
            set.status = 404;
            return new Response('Not Found', { status: 404 });
        }

        const q = query as Record<string, string>;
        const { fixture, session, theme, exportType } = q;

        if ((!fixture && !session) || !theme) {
            set.status = 400;
            return { error: 'Missing required params: (fixture or session) and theme' };
        }

        const resolvedExportType: AllowedExportType = ALLOWED_EXPORT_TYPES.includes(exportType as AllowedExportType)
            ? (exportType as AllowedExportType)
            : 'html5';

        const metaOverrides: StyleLabMetaOverrides = {
            addSearchBox: parseBoolParam(q.addSearchBox),
            addPagination: parseBoolParam(q.addPagination),
            addAccessibilityToolbar: parseBoolParam(q.addAccessibilityToolbar),
            addExeLink: parseBoolParam(q.addExeLink),
            exportSource: parseBoolParam(q.exportSource),
        };
        for (const key of Object.keys(metaOverrides) as (keyof StyleLabMetaOverrides)[]) {
            if (metaOverrides[key] === undefined) delete metaOverrides[key];
        }

        try {
            let zipBuffer: Uint8Array;

            if (session) {
                // Preview from live session (project currently open in editor)
                const liveSession = getAllSessions().find(s => s.sessionId === session);
                if (!liveSession) {
                    set.status = 404;
                    return { error: `Session not found: ${session}` };
                }
                // sessionId === project UUID (odeId is never set on session objects)
                const project = await findProjectByUuid(db, liveSession.sessionId);
                if (!project) {
                    set.status = 404;
                    return { error: 'Project not found in database' };
                }
                const ydoc = await reconstructDocument(project.id);
                if (!ydoc) {
                    set.status = 500;
                    return { error: 'Could not reconstruct project document' };
                }

                // Apply meta overrides
                if (Object.keys(metaOverrides).length > 0) {
                    const metaMap = ydoc.getMap('metadata');
                    ydoc.transact(() => {
                        for (const [key, value] of Object.entries(metaOverrides)) {
                            if (value !== undefined) metaMap.set(key, value);
                        }
                    });
                }

                const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'exe-style-lab-'));
                try {
                    const wrapper = new ServerYjsDocumentWrapper(ydoc, liveSession.sessionId);
                    const document = new YjsDocumentAdapter(wrapper);
                    const resources = new FileSystemResourceProvider(PUBLIC_DIR);
                    const dbAssets = new DatabaseAssetProvider(db, project.id, tempDir);
                    const zip = new FflateZipProvider();

                    let exporter;
                    switch (resolvedExportType) {
                        case 'html5-sp':
                            exporter = new PageExporter(document, resources, dbAssets, zip);
                            break;
                        case 'scorm12':
                            exporter = new Scorm12Exporter(document, resources, dbAssets, zip);
                            break;
                        default:
                            exporter = new Html5Exporter(document, resources, dbAssets, zip);
                    }

                    const result = await exporter.export({ theme });
                    if (!result.success || !result.data) {
                        throw new Error(result.error || 'Export failed');
                    }
                    zipBuffer = result.data;
                    wrapper.destroy();
                } finally {
                    await fs.promises.rm(tempDir, { recursive: true, force: true });
                }
            } else {
                // Preview from fixture file
                const fixturePath = safeFixturePath(fixture!);
                if (!fixturePath) {
                    set.status = 404;
                    return { error: `Fixture not found: ${fixture}` };
                }
                zipBuffer = await buildPreview(fixturePath, theme, resolvedExportType, metaOverrides);
            }

            const filename = `style-lab-${resolvedExportType}.zip`;
            return new Response(zipBuffer, {
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `inline; filename="${filename}"`,
                },
            });
        } catch (err) {
            console.error('[style-lab] Preview error:', err);
            set.status = 500;
            return {
                error: 'Preview generation failed',
                message: err instanceof Error ? err.message : String(err),
            };
        }
    })

    // Export modified theme as an installable ZIP
    .post('/api/developer/style-lab/export-theme', async ({ body, set }) => {
        if (!isDev()) {
            set.status = 404;
            return new Response('Not Found', { status: 404 });
        }

        const { theme, cssOverrides, fileOverrides, themeMetadata, screenshotBase64, fontFiles, assetFiles } = body as {
            theme: string;
            cssOverrides?: Record<string, string>;
            fileOverrides?: Record<string, string>;
            themeMetadata?: StyleLabThemeMetadata;
            screenshotBase64?: string;
            fontFiles?: Record<string, string>;
            assetFiles?: Record<string, string>;
        };
        if (!theme) {
            set.status = 400;
            return { error: 'Missing required param: theme' };
        }

        const themeDir = resolveThemeDir(theme);
        if (!themeDir) {
            set.status = 404;
            return { error: `Theme not found: ${theme}` };
        }

        try {
            const overrides: Record<string, string> = { ...(cssOverrides || {}), ...(fileOverrides || {}) };
            const metadataUpdates = normalizeThemeMetadata(themeMetadata);
            if (Object.keys(metadataUpdates).length > 0) {
                const configPath = path.join(themeDir, 'config.xml');
                const originalXml = fs.existsSync(configPath)
                    ? await fs.promises.readFile(configPath, 'utf-8')
                    : defaultConfigXml(metadataUpdates);
                overrides['config.xml'] = patchConfigXml(originalXml, metadataUpdates);
            }
            const binaryOverrides: Record<string, Uint8Array> = {};
            if (screenshotBase64) binaryOverrides['screenshot.png'] = Buffer.from(screenshotBase64, 'base64');
            for (const [p, b64] of Object.entries(fontFiles || {})) {
                binaryOverrides[p] = Buffer.from(b64, 'base64');
            }
            for (const [p, b64] of Object.entries(assetFiles || {})) {
                binaryOverrides[p] = Buffer.from(b64, 'base64');
            }
            const zipBuffer = await buildThemeZip(themeDir, overrides, binaryOverrides);
            return new Response(zipBuffer, {
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${theme}-custom.zip"`,
                },
            });
        } catch (err) {
            if (err instanceof Error && err.message.startsWith('Invalid theme file path:')) {
                set.status = 400;
                return { error: err.message };
            }
            console.error('[style-lab] Theme export error:', err);
            set.status = 500;
            return {
                error: 'Theme export failed',
                message: err instanceof Error ? err.message : String(err),
            };
        }
    })

    // Install a modified theme as a new site theme + optionally apply it to a project
    .post('/api/developer/style-lab/install-theme', async ({ body, set }) => {
        if (!isDev()) {
            set.status = 404;
            return new Response('Not Found', { status: 404 });
        }

        const {
            theme,
            fileOverrides,
            themeMetadata,
            newDirName,
            newDisplayName,
            sessionId,
            screenshotBase64,
            fontFiles,
            assetFiles,
        } = body as {
            theme: string;
            fileOverrides?: Record<string, string>;
            themeMetadata?: StyleLabThemeMetadata;
            newDirName: string;
            newDisplayName: string;
            sessionId?: string;
            screenshotBase64?: string;
            fontFiles?: Record<string, string>;
            assetFiles?: Record<string, string>;
        };

        if (!theme || !newDirName || !newDisplayName) {
            set.status = 400;
            return { error: 'Missing required params: theme, newDirName, newDisplayName' };
        }
        if (!/^[a-z0-9_-]+$/.test(newDirName)) {
            set.status = 400;
            return { error: 'newDirName must contain only lowercase letters, numbers, hyphens and underscores' };
        }

        for (const filePath of [...Object.keys(fontFiles || {}), ...Object.keys(assetFiles || {})]) {
            if (!normalizeZipEntryPath(filePath)) {
                set.status = 400;
                return { error: `Invalid theme file path: ${filePath}` };
            }
        }

        const themeDir = resolveThemeDir(theme);
        if (!themeDir) {
            set.status = 404;
            return { error: `Theme not found: ${theme}` };
        }

        const existingTheme = await findThemeByDirName(db, newDirName);
        if (existingTheme?.is_builtin) {
            set.status = 409;
            return { error: `Theme directory "${newDirName}" already exists. Choose a different identifier.` };
        }
        const isOverwrite = !!existingTheme;

        try {
            const overrides: Record<string, string> = { ...(fileOverrides || {}) };
            const metadataUpdates = normalizeThemeMetadata({
                ...themeMetadata,
                name: newDirName,
                title: themeMetadata?.title || newDisplayName,
            });

            // Patch config.xml with new name
            const configPath = path.join(themeDir, 'config.xml');
            if (fs.existsSync(configPath)) {
                const originalXml = await fs.promises.readFile(configPath, 'utf-8');
                overrides['config.xml'] = patchConfigXml(originalXml, metadataUpdates);
            } else {
                overrides['config.xml'] = defaultConfigXml(metadataUpdates);
            }

            const binaryOverrides: Record<string, Uint8Array> = {};
            if (screenshotBase64) binaryOverrides['screenshot.png'] = Buffer.from(screenshotBase64, 'base64');
            for (const [p, b64] of Object.entries(fontFiles || {})) {
                binaryOverrides[p] = Buffer.from(b64, 'base64');
            }
            for (const [p, b64] of Object.entries(assetFiles || {})) {
                binaryOverrides[p] = Buffer.from(b64, 'base64');
            }
            const zipBuffer = await buildThemeZip(themeDir, overrides, binaryOverrides);

            // Install theme: replace directory completely so stale files (e.g. sync
            // tool conflict copies) don't survive. buildThemeZip already captured
            // every valid file, so the ZIP is the authoritative source of truth.
            const filesDir = process.env.FILES_DIR || './data';
            const targetDir = path.join(filesDir, 'themes', 'site', newDirName);
            if (isOverwrite) {
                await fs.promises.rm(targetDir, { recursive: true, force: true });
            }
            await fs.promises.mkdir(targetDir, { recursive: true });
            const files = fflate.unzipSync(zipBuffer);
            for (const [filePath, data] of Object.entries(files)) {
                const fullPath = safeTargetPath(targetDir, filePath);
                if (!fullPath) throw new Error(`Invalid theme file path: ${filePath}`);
                await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
                await fs.promises.writeFile(fullPath, data);
            }

            // Register or update in database
            if (isOverwrite) {
                await updateTheme(db, existingTheme.id, {
                    display_name: newDisplayName,
                    description: themeMetadata?.description || null,
                    version: themeMetadata?.version || null,
                    author: themeMetadata?.author || null,
                    license: themeMetadata?.license || null,
                });
            } else {
                const sortOrder = await getNextSiteThemeSortOrder(db);
                await createTheme(db, {
                    dir_name: newDirName,
                    display_name: newDisplayName,
                    description: themeMetadata?.description || null,
                    version: themeMetadata?.version || null,
                    author: themeMetadata?.author || null,
                    license: themeMetadata?.license || null,
                    is_builtin: 0,
                    is_enabled: 1,
                    is_default: 0,
                    sort_order: sortOrder,
                    storage_path: `themes/site/${newDirName}`,
                });
            }

            // Apply theme to the open project via the live doc (or DB if no live session).
            // withDocument loads from cache or DB by itself — no live session required.
            let themeApplied = false;
            if (sessionId) {
                try {
                    const project = await findProjectByUuid(db, sessionId);
                    if (project) {
                        await withDocument(sessionId, { type: 'rest' }, ydoc => {
                            ydoc.getMap('metadata').set('theme', newDirName);
                        });
                        themeApplied = true;
                        console.log(`[style-lab] Theme "${newDirName}" applied to project ${sessionId}`);
                    } else {
                        console.warn(`[style-lab] Project not found for sessionId ${sessionId}`);
                    }
                } catch (applyErr) {
                    console.error('[style-lab] Failed to apply theme to project:', applyErr);
                }
            }

            return { ok: true, dirName: newDirName, displayName: newDisplayName, themeApplied };
        } catch (err) {
            if (err instanceof Error && err.message.startsWith('Invalid theme file path:')) {
                set.status = 400;
                return { error: err.message };
            }
            console.error('[style-lab] Install theme error:', err);
            set.status = 500;
            return {
                error: 'Theme installation failed',
                message: err instanceof Error ? err.message : String(err),
            };
        }
    })

    // Delete a site theme (non-builtin only) — removes from DB and disk
    .delete('/api/developer/themes/:dirName', async ({ params, set }) => {
        if (!isDev()) {
            set.status = 404;
            return { error: 'Not Found' };
        }

        const { dirName } = params;
        const theme = await findThemeByDirName(db, dirName);
        if (!theme) {
            set.status = 404;
            return { error: `Theme not found: ${dirName}` };
        }
        if (theme.is_builtin) {
            set.status = 403;
            return { error: 'Cannot delete built-in themes' };
        }

        await deleteTheme(db, theme.id);

        // Remove files from disk
        const filesDir = process.env.FILES_DIR || './data';
        const themeDir = path.join(filesDir, 'themes', 'site', dirName);
        await fs.promises.rm(themeDir, { recursive: true, force: true });

        return { ok: true, deleted: dirName };
    })

    // Reload theme from disk: re-export is the reload — theme CSS is read fresh each time.
    .post('/api/developer/reload-theme', ({ set }) => {
        if (!isDev()) {
            set.status = 404;
            return { error: 'Not Found' };
        }
        return { ok: true, reload: true };
    })

    // Upload a theme ZIP from the client and install it as a new site theme
    .post('/api/developer/style-lab/upload-theme', async ({ body, set }) => {
        if (!isDev()) {
            set.status = 404;
            return new Response('Not Found', { status: 404 });
        }

        const { zipBase64, newDirName, newDisplayName, themeMetadata } = body as {
            zipBase64: string;
            newDirName: string;
            newDisplayName: string;
            themeMetadata?: StyleLabThemeMetadata;
        };

        if (!zipBase64 || !newDirName || !newDisplayName) {
            set.status = 400;
            return { error: 'Missing required params: zipBase64, newDirName, newDisplayName' };
        }
        if (!/^[a-z0-9_-]+$/.test(newDirName)) {
            set.status = 400;
            return { error: 'newDirName must contain only lowercase letters, numbers, hyphens and underscores' };
        }

        let uploadedFiles: Record<string, Uint8Array>;
        try {
            uploadedFiles = fflate.unzipSync(new Uint8Array(Buffer.from(zipBase64, 'base64')));
        } catch {
            set.status = 400;
            return { error: 'Invalid ZIP file' };
        }
        const uploadRoot = commonRoot(Object.keys(uploadedFiles));
        for (const rawName of Object.keys(uploadedFiles)) {
            const shortName = uploadRoot ? rawName.slice(uploadRoot.length + 1) : rawName;
            if (!shortName) continue;
            if (!normalizeZipEntryPath(shortName)) {
                set.status = 400;
                return { error: `Invalid theme ZIP entry path: ${rawName}` };
            }
        }

        const existingUploadTheme = await findThemeByDirName(db, newDirName);
        if (existingUploadTheme?.is_builtin) {
            set.status = 409;
            return { error: `Theme directory "${newDirName}" already exists. Choose a different identifier.` };
        }
        const isUploadOverwrite = !!existingUploadTheme;

        try {
            const filesDir = process.env.FILES_DIR || './data';
            const targetDir = path.join(filesDir, 'themes', 'site', newDirName);
            if (isUploadOverwrite) {
                await fs.promises.rm(targetDir, { recursive: true, force: true });
            }
            await fs.promises.mkdir(targetDir, { recursive: true });

            for (const [rawName, data] of Object.entries(uploadedFiles)) {
                const shortName = uploadRoot ? rawName.slice(uploadRoot.length + 1) : rawName;
                if (!shortName) continue;
                const fullPath = safeTargetPath(targetDir, shortName);
                if (!fullPath) throw new Error(`Invalid theme ZIP entry path: ${rawName}`);
                await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
                await fs.promises.writeFile(fullPath, data);
            }

            // Patch config.xml with the new identifier and display name
            const configPath = path.join(targetDir, 'config.xml');
            const metadataUpdates = normalizeThemeMetadata({
                ...themeMetadata,
                name: newDirName,
                title: themeMetadata?.title || newDisplayName,
            });
            if (fs.existsSync(configPath)) {
                const originalXml = await fs.promises.readFile(configPath, 'utf-8');
                await fs.promises.writeFile(configPath, patchConfigXml(originalXml, metadataUpdates));
            } else {
                await fs.promises.writeFile(configPath, defaultConfigXml(metadataUpdates));
            }

            if (isUploadOverwrite) {
                await updateTheme(db, existingUploadTheme.id, {
                    display_name: newDisplayName,
                    description: themeMetadata?.description || null,
                    version: themeMetadata?.version || null,
                    author: themeMetadata?.author || null,
                    license: themeMetadata?.license || null,
                });
            } else {
                const sortOrder = await getNextSiteThemeSortOrder(db);
                await createTheme(db, {
                    dir_name: newDirName,
                    display_name: newDisplayName,
                    description: themeMetadata?.description || null,
                    version: themeMetadata?.version || null,
                    author: themeMetadata?.author || null,
                    license: themeMetadata?.license || null,
                    is_builtin: 0,
                    is_enabled: 1,
                    is_default: 0,
                    sort_order: sortOrder,
                    storage_path: `themes/site/${newDirName}`,
                });
            }

            return { ok: true, dirName: newDirName, displayName: newDisplayName };
        } catch (err) {
            console.error('[style-lab] Upload theme error:', err);
            set.status = 500;
            return {
                error: 'Theme upload failed',
                message: err instanceof Error ? err.message : String(err),
            };
        }
    });
