/**
 * GameHandler
 *
 * Handles modern game iDevices (JsIdevice) that store their data in HTML divs.
 * Extracts game data from *-DataGame divs in the htmlView.
 *
 * Supported game types:
 * - flipcards (plain JSON in flipcards-DataGame)
 * - selecciona (XOR-encrypted JSON in selecciona-DataGame)
 * - trivial, crossword, etc. (same pattern)
 *
 * The game data may be:
 * - Plain JSON: {"typeGame":"FlipCards",...}
 * - XOR-encrypted: %E9%B0%F3... (key=146)
 */

import { BaseLegacyHandler } from './BaseLegacyHandler';
import type { IdeviceHandlerContext, FeedbackResult } from './IdeviceHandler';

/**
 * Game types and their DataGame div class patterns
 * Maps game type to the class name used in the DataGame div
 */
const GAME_PATTERNS: Record<string, string> = {
    flipcards: 'flipcards-DataGame',
    selecciona: 'selecciona-DataGame',
    'selecciona-activity': 'selecciona-DataGame',
    trivial: 'trivial-DataGame',
    crossword: 'crossword-DataGame',
    relate: 'relate-DataGame',
    relaciona: 'relaciona-DataGame',
    identify: 'identify-DataGame',
    discover: 'discover-DataGame',
    complete: 'complete-DataGame',
    classify: 'classify-DataGame',
    guess: 'guess-DataGame',
    sort: 'sort-DataGame',
    puzzle: 'puzzle-DataGame',
    beforeafter: 'beforeafter-DataGame',
    'word-search': 'word-search-DataGame',
    'hidden-image': 'hidden-image-DataGame',
    mathproblems: 'mathproblems-DataGame',
    mathematicaloperations: 'mathematicaloperations-DataGame',
    padlock: 'padlock-DataGame',
    challenge: 'challenge-DataGame',
    checklist: 'checklist-DataGame',
    'quick-questions': 'quick-questions-DataGame',
    'az-quiz-game': 'az-quiz-game-DataGame',
    dragdrop: 'dragdrop-DataGame',
    trueorfalse: 'trueorfalse-DataGame',
    // Spanish legacy names
    mapa: 'mapa-DataGame',
    rosco: 'rosco-DataGame',
    videoquext: 'videoquext-DataGame',
    vquext: 'vquext-DataGame',
    quext: 'quext-DataGame',
    desafio: 'desafio-DataGame',
    candado: 'candado-DataGame',
    adivina: 'adivina-DataGame',
    clasifica: 'clasifica-DataGame',
    completa: 'completa-DataGame',
    descubre: 'descubre-DataGame',
    identifica: 'identifica-DataGame',
    sopa: 'sopa-DataGame',
    ordena: 'ordena-DataGame',
    seleccionamedias: 'seleccionamedias-DataGame',
    listacotejo: 'listacotejo-DataGame',
    informe: 'informe-DataGame',
    crucigrama: 'crucigrama-DataGame',
};

/**
 * Games that use XOR encryption for their data
 */
const ENCRYPTED_GAMES: string[] = [
    'selecciona',
    'selecciona-activity',
    'trivial',
    'identify',
    'discover',
    'complete',
    'classify',
    'guess',
    'sort',
    'puzzle',
    'relate',
    'relaciona',
    'hidden-image',
    'mathematicaloperations',
    'padlock',
    'challenge',
    'quick-questions',
    'az-quiz-game',
    'dragdrop',
    'trueorfalse',
    'mathproblems',
    'word-search',
    'checklist',
    // Spanish legacy names that use encryption
    'rosco',
    'videoquext',
    'vquext',
    'quext',
    'desafio',
    'candado',
    'adivina',
    'clasifica',
    'completa',
    'descubre',
    'identifica',
    'sopa',
    'ordena',
    'listacotejo',
    'informe',
    'crucigrama',
    // Note: 'mapa' is NOT encrypted - it uses plain JSON like flipcards
];

/**
 * Maps detected game types to their installed iDevice types
 */
const TYPE_MAP: Record<string, string> = {
    // Spanish -> English mappings
    selecciona: 'quick-questions-multiple-choice',
    trivial: 'trivial', // TriviExt game - NOT quick-questions
    mapa: 'map',
    rosco: 'az-quiz-game',
    videoquext: 'quick-questions-video',
    vquext: 'quick-questions-video',
    quext: 'quick-questions',
    desafio: 'challenge',
    candado: 'padlock',
    adivina: 'guess',
    clasifica: 'classify',
    completa: 'complete',
    descubre: 'discover',
    identifica: 'identify',
    sopa: 'word-search',
    ordena: 'sort',
    seleccionamedias: 'select-media-files',
    listacotejo: 'checklist',
    informe: 'progress-report',
    crucigrama: 'crossword',
    // These map to themselves (already correct)
    flipcards: 'flipcards',
    crossword: 'crossword',
    relate: 'relate',
    relaciona: 'relate',
    identify: 'identify',
    discover: 'discover',
    complete: 'complete',
    classify: 'classify',
    guess: 'guess',
    sort: 'sort',
    puzzle: 'puzzle',
    beforeafter: 'beforeafter',
    'word-search': 'word-search',
    'hidden-image': 'hidden-image',
    mathproblems: 'mathproblems',
    mathematicaloperations: 'mathematicaloperations',
    padlock: 'padlock',
    challenge: 'challenge',
    checklist: 'checklist',
    'quick-questions': 'quick-questions',
    'quick-questions-multiple-choice': 'quick-questions-multiple-choice',
    'quick-questions-video': 'quick-questions-video',
    'az-quiz-game': 'az-quiz-game',
    map: 'map',
    dragdrop: 'dragdrop',
    trueorfalse: 'trueorfalse',
    'select-media-files': 'select-media-files',
    'progress-report': 'progress-report',
};

export class GameHandler extends BaseLegacyHandler {
    // Track detected game type for getTargetType()
    private _detectedType: string | null = null;

    /**
     * Check if this handler can process the given legacy class
     * Handles JsIdevice types with game data
     *
     * @param className - Legacy class name
     * @param ideviceType - iDevice type from _iDeviceDir (e.g., 'flipcards-activity')
     */
    canHandle(className: string, ideviceType?: string): boolean {
        // Check if it's a JsIdevice with a known game type
        const gameTypes = Object.keys(GAME_PATTERNS);

        // Check className first (for backwards compatibility)
        if (gameTypes.some(type => className.toLowerCase().includes(type.toLowerCase()))) {
            return true;
        }

        // Check ideviceType (e.g., 'flipcards-activity' matches 'flipcards')
        if (ideviceType) {
            const normalizedType = ideviceType.replace(/-activity$/, '');
            if (gameTypes.includes(normalizedType)) {
                // Pre-set _detectedType so getTargetType() works even if extractProperties fails
                this._detectedType = normalizedType;
                return true;
            }
        }

        return false;
    }

    /**
     * Get the target modern iDevice type
     * Returns the detected game type mapped to its installed iDevice type
     */
    getTargetType(): string {
        if (this._detectedType) {
            // Normalize type names (remove -activity suffix)
            const normalized = this._detectedType.replace(/-activity$/, '');
            // Map to installed iDevice type
            return TYPE_MAP[normalized] || normalized;
        }
        return 'text';
    }

    /**
     * Extract HTML content from dictionary (game iDevices store HTML in fields list)
     * Also updates the DataGame div with decrypted/parsed JSON for proper rendering
     *
     * @param dict - Dictionary element
     * @returns HTML content with updated DataGame div
     */
    extractHtmlView(dict: Element, _context?: IdeviceHandlerContext): string {
        if (!dict) return '';

        const contents: string[] = [];
        const children = this.getChildElements(dict);

        // Find "fields" key and its list (JsIdevice format)
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (
                child.tagName === 'string' &&
                child.getAttribute('role') === 'key' &&
                child.getAttribute('value') === 'fields'
            ) {
                const listEl = children[i + 1];
                if (listEl && listEl.tagName === 'list') {
                    // Extract content from each field in the list
                    const fieldInstances = this.getChildElements(listEl).filter(el => el.tagName === 'instance');

                    for (const fieldInst of fieldInstances) {
                        const fieldClass = fieldInst.getAttribute('class') || '';
                        // Process TextAreaField and TextField
                        if (fieldClass.includes('TextAreaField') || fieldClass.includes('TextField')) {
                            const content = this.extractTextAreaFieldContent(fieldInst);
                            if (content) {
                                contents.push(content);
                            }
                        }
                    }
                }
                break;
            }
        }

        let html = contents.join('\n');

        // Update the DataGame div with decrypted/parsed JSON for proper rendering
        html = this.updateDataGameDivInHtml(html);

        return html;
    }

    /**
     * No feedback for game iDevices
     */
    extractFeedback(_dict: Element, _context?: IdeviceHandlerContext): FeedbackResult {
        return { content: '', buttonCaption: '' };
    }

    /**
     * Update the DataGame div in HTML with decrypted/parsed JSON
     *
     * IMPORTANT: Only updates NON-encrypted games (like flipcards).
     * For encrypted games, the DataGame div content is left as-is.
     *
     * @param html - HTML content
     * @returns Updated HTML (only for non-encrypted games)
     */
    private updateDataGameDivInHtml(html: string): string {
        if (!html) return html;

        // Find which game type this is and update its DataGame div
        for (const [gameType, divClass] of Object.entries(GAME_PATTERNS)) {
            const gameData = this.extractGameDataFromHtml(html, divClass);
            if (gameData !== null) {
                // Check if this game uses encryption
                const isEncrypted = ENCRYPTED_GAMES.includes(gameType);

                // For ENCRYPTED games, do NOT update the DataGame div
                if (isEncrypted) {
                    return html; // Keep original HTML with encrypted data
                }

                // For NON-encrypted games (like flipcards), update with plain JSON
                let parsedData: Record<string, unknown> | null = null;

                if (gameData.trim().startsWith('{')) {
                    parsedData = this.parseJson(gameData);
                }

                if (parsedData) {
                    // Create the new JSON string
                    const newJson = JSON.stringify(parsedData);

                    // Use regex to replace the DataGame div content
                    const escapedClass = divClass.replace(/-/g, '\\-');
                    const regex = new RegExp(
                        `(<div[^>]*class="[^"]*${escapedClass}[^"]*"[^>]*>)[\\s\\S]*?(<\\/div>)`,
                        'i',
                    );
                    if (regex.test(html)) {
                        return html.replace(regex, `$1${this.escapeHtml(newJson)}$2`);
                    }
                }
                break;
            }
        }

        return html;
    }

    /**
     * Extract properties from game data div
     * Looks for *-DataGame divs and parses the JSON (encrypted or plain)
     */
    extractProperties(dict: Element, _ideviceId?: string): Record<string, unknown> {
        // We need the raw HTML to find the DataGame div
        const rawHtml = this.extractHtmlView(dict);
        if (!rawHtml) return {};

        // Detect which game type this is and extract data
        for (const [gameType, divClass] of Object.entries(GAME_PATTERNS)) {
            const gameData = this.extractGameDataFromHtml(rawHtml, divClass);
            if (gameData !== null) {
                this._detectedType = gameType;

                // Check if this game type uses encryption
                const isEncrypted = ENCRYPTED_GAMES.includes(gameType);

                // Parse the game data
                let parsedData: Record<string, unknown> | null = null;
                if (isEncrypted && gameData.startsWith('%')) {
                    // Encrypted data - decrypt first
                    const decrypted = this.decrypt(gameData);
                    parsedData = this.parseJson(decrypted);
                } else if (gameData.trim().startsWith('{')) {
                    // Plain JSON
                    parsedData = this.parseJson(gameData);
                }

                if (parsedData) {
                    // Return the game data as jsonProperties
                    return parsedData;
                }
            }
        }

        return {};
    }

    /**
     * Extract game data from HTML by finding the DataGame div
     * Uses regex for reliable extraction
     *
     * @param html - HTML content
     * @param divClass - Class name of the DataGame div
     * @returns Content of the DataGame div, or null if not found
     */
    private extractGameDataFromHtml(html: string, divClass: string): string | null {
        if (!html) return null;

        // Use regex patterns for extraction
        const escapedClass = divClass.replace(/-/g, '\\-');
        const patterns = [
            // Match div with class, capturing everything until closing </div>
            new RegExp(`<div[^>]*class="[^"]*${escapedClass}[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, 'i'),
            // HTML-encoded quotes variant
            new RegExp(`<div[^>]*class=&quot;[^"]*${escapedClass}[^"]*&quot;[^>]*>([\\s\\S]*?)<\\/div>`, 'i'),
        ];

        for (const regex of patterns) {
            const match = html.match(regex);
            if (match?.[1]) {
                // Decode HTML entities in the extracted content
                // The content may be double-encoded from legacy XML
                let content = match[1].trim();
                content = this.decodeHtmlContent(content);
                return content;
            }
        }

        return null;
    }

    /**
     * Decrypt XOR-encrypted game data
     * Uses the same algorithm as $exeDevices.iDevice.gamification.helpers.decrypt()
     *
     * @param str - Encrypted string (URL-encoded, XOR key=146)
     * @returns Decrypted string
     */
    private decrypt(str: string): string {
        if (!str) return '';
        if (str === 'undefined' || str === 'null') return '';

        let decoded = str;
        try {
            // Unescape URL encoding
            decoded = decodeURIComponent(str);
        } catch (_e) {
            // If decodeURIComponent fails, try unescape as fallback
            try {
                decoded = unescape(str);
            } catch (_e2) {
                return '';
            }
        }

        try {
            const key = 146;
            let output = '';
            for (let i = 0; i < decoded.length; i++) {
                output += String.fromCharCode(key ^ decoded.charCodeAt(i));
            }
            return output;
        } catch (_e) {
            return '';
        }
    }

    /**
     * Parse JSON string safely
     * Handles common issues like control characters in string values
     *
     * @param str - JSON string
     * @returns Parsed object or null
     */
    private parseJson(str: string): Record<string, unknown> | null {
        if (!str || typeof str !== 'string') return null;
        str = str.trim();

        // Check if string looks like JSON
        if (!str.startsWith('{') || !str.endsWith('}')) {
            // Try to find the JSON object boundaries
            const firstBrace = str.indexOf('{');
            const lastBrace = str.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                str = str.substring(firstBrace, lastBrace + 1);
            } else {
                return null;
            }
        }

        try {
            const obj = JSON.parse(str);
            if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                return obj as Record<string, unknown>;
            }
        } catch (_e) {
            // Try to fix common JSON issues (newlines, tabs, NBSP inside strings)
            try {
                // Escape control characters that may be inside string values
                // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally matching control characters
                const controlCharRegex = /[\x00-\x1F]/g;
                let fixedStr = str.replace(controlCharRegex, char => {
                    const escapes: Record<string, string> = {
                        '\n': '\\n',
                        '\r': '\\r',
                        '\t': '\\t',
                    };
                    return escapes[char] || '';
                });
                // Replace non-breaking spaces (NBSP, char 160) with regular spaces
                fixedStr = fixedStr.replace(/\u00A0/g, ' ');

                const obj = JSON.parse(fixedStr);
                if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
                    return obj as Record<string, unknown>;
                }
            } catch (_e2) {
                // JSON parse failed even after fixing
            }
        }
        return null;
    }
}
