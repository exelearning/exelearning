/**
 * GlobalFontGenerator
 *
 * Generates @font-face CSS rules and body styles for global fonts.
 * Used by both preview and export to ensure consistent font application.
 */

export interface GlobalFontFile {
    weight: number;
    style: 'normal' | 'italic';
    filename: string;
    format: 'woff' | 'woff2';
}

export interface GlobalFontConfig {
    id: string;
    displayName: string;
    fontFamily: string;
    fallback: string;
    files: GlobalFontFile[];
    attribution?: string;
    lineHeight?: string;
}

/**
 * Available global fonts configuration
 */
export const GLOBAL_FONTS: Record<string, GlobalFontConfig> = {
    opendyslexic: {
        id: 'opendyslexic',
        displayName: 'OpenDyslexic',
        fontFamily: 'OpenDyslexic',
        fallback: 'serif',
        files: [
            { weight: 400, style: 'normal', filename: 'OpenDyslexic-Regular.woff', format: 'woff' },
            { weight: 400, style: 'italic', filename: 'OpenDyslexic-Italic.woff', format: 'woff' },
            { weight: 700, style: 'normal', filename: 'OpenDyslexic-Bold.woff', format: 'woff' },
            { weight: 700, style: 'italic', filename: 'OpenDyslexic-BoldItalic.woff', format: 'woff' },
        ],
    },
    andika: {
        id: 'andika',
        displayName: 'Andika',
        fontFamily: 'Andika',
        fallback: 'sans-serif',
        files: [
            { weight: 400, style: 'normal', filename: 'Andika-Regular.woff2', format: 'woff2' },
            { weight: 400, style: 'italic', filename: 'Andika-Italic.woff2', format: 'woff2' },
            { weight: 700, style: 'normal', filename: 'Andika-Bold.woff2', format: 'woff2' },
            { weight: 700, style: 'italic', filename: 'Andika-BoldItalic.woff2', format: 'woff2' },
        ],
    },
    nunito: {
        id: 'nunito',
        displayName: 'Nunito',
        fontFamily: 'Nunito',
        fallback: 'sans-serif',
        files: [
            { weight: 400, style: 'normal', filename: 'Nunito-Regular.woff2', format: 'woff2' },
            { weight: 400, style: 'italic', filename: 'Nunito-Italic.woff2', format: 'woff2' },
            { weight: 700, style: 'normal', filename: 'Nunito-Bold.woff2', format: 'woff2' },
            { weight: 700, style: 'italic', filename: 'Nunito-BoldItalic.woff2', format: 'woff2' },
        ],
    },
    'playwrite-es': {
        id: 'playwrite-es',
        displayName: 'Playwrite ES',
        fontFamily: 'Playwrite ES',
        fallback: 'cursive, sans-serif',
        files: [
            {
                weight: 400,
                style: 'normal',
                filename: 'PlaywriteES-Regular.woff2',
                format: 'woff2',
            },
        ],
        lineHeight: '2em',
    },
};

/** CSS selectors for applying global font */
const FONT_SELECTORS = 'body, main, article, .exe-content, .iDevice_wrapper, .idevice-content';

/**
 * Build CSS string for a font configuration
 */
function buildFontCss(fontConfig: GlobalFontConfig, fontPath: string, label: string): string {
    let css = `/* Global Font: ${fontConfig.displayName}${label} */\n`;

    for (const file of fontConfig.files) {
        css += `@font-face {
    font-family: '${fontConfig.fontFamily}';
    font-style: ${file.style};
    font-weight: ${file.weight};
    font-display: swap;
    src: url('${fontPath}${file.filename}') format('${file.format}');
}\n`;
    }

    const lineHeightRule = fontConfig.lineHeight ? `\n    line-height: ${fontConfig.lineHeight} !important;` : '';

    css += `
${FONT_SELECTORS} {
    font-family: '${fontConfig.fontFamily}', ${fontConfig.fallback} !important;${lineHeightRule}
}
`;

    if (fontConfig.attribution) {
        css += `/* ${fontConfig.attribution} */\n`;
    }

    return css;
}

/**
 * Global font generator utility class
 */
export class GlobalFontGenerator {
    /**
     * Check if a font ID is valid
     */
    static isValidFont(fontId: string): boolean {
        return fontId !== 'default' && fontId in GLOBAL_FONTS;
    }

    /**
     * Get font configuration
     */
    static getFontConfig(fontId: string): GlobalFontConfig | null {
        return GLOBAL_FONTS[fontId] || null;
    }

    /**
     * Generate CSS for global font including @font-face rules and body style
     * @param fontId - Font identifier (e.g., 'opendyslexic')
     * @param basePath - Base path for font URLs (e.g., '' for index, '../' for subpages)
     * @returns CSS string or empty string if font is 'default'
     */
    static generateCss(fontId: string, basePath: string = ''): string {
        if (!fontId || fontId === 'default') {
            return '';
        }

        const fontConfig = GLOBAL_FONTS[fontId];
        if (!fontConfig) {
            console.warn(`[GlobalFontGenerator] Unknown font: ${fontId}`);
            return '';
        }

        return buildFontCss(fontConfig, `${basePath}fonts/global/${fontId}/`, '');
    }

    /**
     * Generate CSS for preview (uses absolute server URLs)
     * @param fontId - Font identifier
     * @param serverBasePath - Server base path (e.g., '/files/perm')
     * @returns CSS string
     */
    static generatePreviewCss(fontId: string, serverBasePath: string = '/files/perm'): string {
        if (!fontId || fontId === 'default') {
            return '';
        }

        const fontConfig = GLOBAL_FONTS[fontId];
        if (!fontConfig) {
            return '';
        }

        return buildFontCss(fontConfig, `${serverBasePath}/fonts/global/${fontId}/`, ' (Preview)');
    }

    /**
     * Get list of font file paths to include in export
     * @param fontId - Font identifier
     * @returns Array of relative file paths
     */
    static getFontFilePaths(fontId: string): string[] {
        const fontConfig = GLOBAL_FONTS[fontId];
        if (!fontConfig) {
            return [];
        }
        return fontConfig.files.map(f => `fonts/global/${fontId}/${f.filename}`);
    }

    /**
     * Get attribution text for a font
     */
    static getAttribution(fontId: string): string | null {
        return GLOBAL_FONTS[fontId]?.attribution || null;
    }

    /**
     * Get all available font IDs (excluding 'default')
     */
    static getAvailableFontIds(): string[] {
        return Object.keys(GLOBAL_FONTS);
    }

    /**
     * Get CSS class name for body element based on font
     * @param fontId - Font identifier
     * @returns CSS class name (e.g., 'exe-global-font-playwrite-es') or empty string if default
     */
    static getBodyClassName(fontId: string): string {
        if (!fontId || fontId === 'default') {
            return '';
        }
        return `exe-global-font-${fontId}`;
    }
}
