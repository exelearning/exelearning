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
    boo: {
        id: 'boo',
        displayName: 'Boo',
        fontFamily: 'Boo',
        fallback: 'cursive, sans-serif',
        files: [{ weight: 400, style: 'normal', filename: 'Boo.woff2', format: 'woff2' }],
        attribution: 'Font Boo by jboo@edu.xunta.es - https://www.edu.xunta.gal/centros/ceipfrions/es/node/101',
    },
};

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

        const fontPath = `${basePath}fonts/global/${fontId}/`;
        let css = `/* Global Font: ${fontConfig.displayName} */\n`;

        // Generate @font-face rules
        for (const file of fontConfig.files) {
            css += `@font-face {
    font-family: '${fontConfig.fontFamily}';
    font-style: ${file.style};
    font-weight: ${file.weight};
    font-display: swap;
    src: url('${fontPath}${file.filename}') format('${file.format}');
}\n`;
        }

        // Apply font to body and common content areas with !important to override theme
        css += `
body, main, article, .exe-content, .iDevice_wrapper, .idevice-content {
    font-family: '${fontConfig.fontFamily}', ${fontConfig.fallback} !important;
}
`;

        // Add attribution comment if required
        if (fontConfig.attribution) {
            css += `/* ${fontConfig.attribution} */\n`;
        }

        return css;
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

        const fontPath = `${serverBasePath}/fonts/global/${fontId}/`;
        let css = `/* Global Font: ${fontConfig.displayName} (Preview) */\n`;

        // Generate @font-face rules with absolute URLs
        for (const file of fontConfig.files) {
            css += `@font-face {
    font-family: '${fontConfig.fontFamily}';
    font-style: ${file.style};
    font-weight: ${file.weight};
    font-display: swap;
    src: url('${fontPath}${file.filename}') format('${file.format}');
}\n`;
        }

        // Apply font
        css += `
body, main, article, .exe-content, .iDevice_wrapper, .idevice-content {
    font-family: '${fontConfig.fontFamily}', ${fontConfig.fallback} !important;
}
`;

        if (fontConfig.attribution) {
            css += `/* ${fontConfig.attribution} */\n`;
        }

        return css;
    }

    /**
     * Get list of font file paths to include in export
     * @param fontId - Font identifier
     * @returns Array of relative file paths (e.g., 'fonts/global/opendyslexic/OpenDyslexic-Regular.woff')
     */
    static getFontFilePaths(fontId: string): string[] {
        if (!fontId || fontId === 'default') {
            return [];
        }

        const fontConfig = GLOBAL_FONTS[fontId];
        if (!fontConfig) {
            return [];
        }

        return fontConfig.files.map(f => `fonts/global/${fontId}/${f.filename}`);
    }

    /**
     * Get attribution text for a font
     * @param fontId - Font identifier
     * @returns Attribution string or null
     */
    static getAttribution(fontId: string): string | null {
        const fontConfig = GLOBAL_FONTS[fontId];
        return fontConfig?.attribution || null;
    }

    /**
     * Get all available font IDs (excluding 'default')
     */
    static getAvailableFontIds(): string[] {
        return Object.keys(GLOBAL_FONTS);
    }
}
