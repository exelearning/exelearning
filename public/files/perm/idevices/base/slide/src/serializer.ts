/**
 * Slide iDevice — versioned data format.
 *
 * The saved payload is editor-agnostic: a small wrapper around an editable
 * Fabric scene JSON plus a sanitized SVG snapshot for static preview/export.
 *
 *   {
 *     "version": 3,
 *     "engine": "fabric",
 *     "ideviceId": "...",
 *     "width": 1280,
 *     "height": 720,
 *     "background": "#ffffff",
 *     "fabric": { ...editable scene... },
 *     "svg":    "<svg ...>...</svg>"
 *   }
 *
 * Older payloads (no version, partial fields, JSON strings) are accepted
 * and normalized to a clean blank slide. Unknown future versions are also
 * accepted — they fall back to a blank scene rather than throwing.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import {
    DATA_VERSION,
    DEFAULT_BG,
    DEFAULT_HEIGHT,
    DEFAULT_WIDTH,
    ENGINE_NAME,
    MAX_H,
    MAX_W,
    MIN_H,
    MIN_W,
} from './constants.js';

export type AnyObj = Record<string, unknown>;

export interface ParsedSlide {
    width: number;
    height: number;
    background: string;
    fabric: AnyObj | null;
    /**
     * True when the payload claims a `version` newer than the one this
     * build understands AND uses the matching engine, so the scene was
     * dropped to avoid mis-rendering. Callers should warn the user and
     * avoid overwriting the unread payload.
     */
    unsupportedVersion: boolean;
}

export interface SerializedSlide extends AnyObj {
    version: number;
    engine: string;
    ideviceId: string;
    width: number;
    height: number;
    background: string;
    fabric: AnyObj;
    svg: string;
}

function clamp(v: number, min: number, max: number): number {
    return Math.min(Math.max(v, min), max);
}

/**
 * Single source of truth for slide dimension bounds. Rounds to integers,
 * falls back to default width/height for non-finite or non-positive input,
 * then clamps into [MIN_W..MAX_W] / [MIN_H..MAX_H]. Used both by the editor
 * (input clamp on resize) and the serializer (load-time clamp).
 */
export function clampDimensions(width: unknown, height: unknown): { width: number; height: number } {
    const widthSrc = Number(width);
    const heightSrc = Number(height);
    const w = clamp(
        Math.round(Number.isFinite(widthSrc) && widthSrc > 0 ? widthSrc : DEFAULT_WIDTH),
        MIN_W,
        MAX_W,
    );
    const h = clamp(
        Math.round(Number.isFinite(heightSrc) && heightSrc > 0 ? heightSrc : DEFAULT_HEIGHT),
        MIN_H,
        MAX_H,
    );
    return { width: w, height: h };
}

export function isHexColor(v: unknown): v is string {
    return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

/**
 * Coerce arbitrary input (object, JSON string, or junk) into a usable
 * editor seed. Always returns a valid shape; never throws.
 */
export function parsePrevious(raw: unknown): ParsedSlide {
    let parsed: AnyObj | null = null;
    if (typeof raw === 'string') {
        try {
            const decoded = JSON.parse(raw) as unknown;
            parsed = decoded && typeof decoded === 'object' ? (decoded as AnyObj) : null;
        } catch {
            parsed = null;
        }
    } else if (raw && typeof raw === 'object') {
        parsed = raw as AnyObj;
    }
    const blank: ParsedSlide = {
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        background: DEFAULT_BG,
        fabric: null,
        unsupportedVersion: false,
    };
    if (!parsed) return blank;

    const { width, height } = clampDimensions(parsed.width, parsed.height);
    const background = isHexColor(parsed.background) ? (parsed.background as string) : DEFAULT_BG;

    let fabricJSON: AnyObj | null = null;
    if (
        parsed.version === DATA_VERSION &&
        parsed.engine === ENGINE_NAME &&
        parsed.fabric &&
        typeof parsed.fabric === 'object'
    ) {
        fabricJSON = parsed.fabric as AnyObj;
    }
    // Only flag when the payload looks like a slide from a future bundle
    // (same engine, higher version). Legacy versions and missing-version
    // payloads are handled by the host's legacy import path.
    const claimedVersion = Number(parsed.version);
    const unsupportedVersion =
        parsed.engine === ENGINE_NAME &&
        Number.isFinite(claimedVersion) &&
        claimedVersion > DATA_VERSION;
    return { width, height, background, fabric: fabricJSON, unsupportedVersion };
}

interface BuildPayloadInput {
    ideviceId: string;
    fabric: AnyObj;
    svg: string;
    width: number;
    height: number;
    background: string;
}

/**
 * Build the canonical save payload. All scalar fields are coerced into a
 * safe range; missing values fall back to defaults.
 */
export function buildPayload(input: BuildPayloadInput): SerializedSlide {
    const { width, height } = clampDimensions(input.width, input.height);
    const background = isHexColor(input.background) ? input.background : DEFAULT_BG;

    return {
        version: DATA_VERSION,
        engine: ENGINE_NAME,
        ideviceId: typeof input.ideviceId === 'string' ? input.ideviceId : '',
        width,
        height,
        background,
        fabric: input.fabric && typeof input.fabric === 'object' ? input.fabric : {},
        svg: typeof input.svg === 'string' ? input.svg : '',
    };
}

/**
 * Construct an empty payload (used when init runs without saved data).
 */
export function buildEmptyPayload(ideviceId: string): SerializedSlide {
    return buildPayload({
        ideviceId,
        fabric: {},
        svg: '',
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        background: DEFAULT_BG,
    });
}
