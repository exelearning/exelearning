/**
 * Browser shim for translation service
 *
 * The server-side translation service uses fs/path to read XLF files,
 * which doesn't work in browser. In browser context, license names
 * pass through unchanged - the frontend c_() system handles content translations.
 */
export function trans(id: string, _parameters?: Record<string, string>, _locale?: string): string {
    return id;
}
