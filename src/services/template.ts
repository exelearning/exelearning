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
