/**
 * Template Service for Elysia
 * Nunjucks template rendering
 */
import * as nunjucks from 'nunjucks';
import * as path from 'path';
import { getBasePath } from '../utils/basepath.util';
import { getAppVersion } from '../utils/version';
import { trans as translateFn } from './translation';

// Stores the locale for current rendering (thread-safe in single-threaded Bun)
let currentRenderLocale = 'en';

/**
 * Set the locale for template rendering
 * Call this before renderTemplate() to ensure translations use the correct locale
 */
export const setRenderLocale = (locale: string) => {
    currentRenderLocale = locale;
};

// Configure Nunjucks
const viewsDir = path.join(process.cwd(), 'views');

const env = nunjucks.configure(viewsDir, {
    autoescape: true,
    noCache: process.env.APP_ENV === 'dev',
    watch: process.env.APP_ENV === 'dev',
});

// Add custom filters

// JSON filter - serialize to JSON
env.addFilter('json', (value: unknown) => JSON.stringify(value));

// jsonScript filter - serialize a value to JSON that is safe to embed inside a
// SINGLE-QUOTED JS string literal in an inline <script> and JSON.parse() client-side.
// JSON.stringify does NOT escape the string delimiter ('), the template-literal markers
// (` and ${), or `</script>`, and leaves U+2028/U+2029 (illegal in JS string literals)
// raw — so attacker-controlled values (e.g. a user's saved locale preference rendered
// into views/workarea/workarea.njk) could break out and execute. Escape order matters:
// backslashes first (so JSON's own escapes survive the JS-literal decode), then the '
// delimiter, then `<` (neutralizes `</script>` while staying valid JSON via <) and
// the line separators. Round-trips to the original value on JSON.parse.
env.addFilter('jsonScript', (value: unknown) =>
    JSON.stringify(value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/</g, '\\u003c')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029'),
);

// Asset filter - prefix paths with base path and version for static assets (cache busting)
env.addFilter('asset', (assetPath: string) => {
    const basePath = getBasePath();
    const version = getAppVersion();
    // Remove leading slash if present to avoid double slashes
    const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    // Result: /{basePath}/{version}/{path} or /{version}/{path}
    return basePath ? `${basePath}/${version}/${cleanPath}` : `/${version}/${cleanPath}`;
});

// Trans filter - uses translation service with current render locale
env.addFilter('trans', (key: string, params?: Record<string, string | number>) => {
    return translateFn(key, params, currentRenderLocale);
});

// Path filter - prefix paths for routing
env.addFilter('path', (routeName: string, _params?: Record<string, unknown>) => {
    // Simple route name to path mapping
    const routes: Record<string, string> = {
        'app_login': '/login',
        'app_logout': '/api/auth/logout',
        'app_workarea': '/workarea',
    };
    const basePath = getBasePath();
    const route = routes[routeName] || `/${routeName}`;
    return basePath ? `${basePath}${route}` : route;
});

/**
 * Render a template with data
 */
export const renderTemplate = (templatePath: string, data: Record<string, unknown> = {}): string => {
    // Add .njk extension if not present
    const fullPath = templatePath.endsWith('.njk') ? templatePath : `${templatePath}.njk`;
    return env.render(fullPath, data);
};

/**
 * Get the Nunjucks environment
 */
export const getNunjucksEnv = () => env;
