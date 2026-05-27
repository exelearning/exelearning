/**
 * Slide iDevice — history snapshot codec.
 *
 * The Undo/Redo stack stores JSON strings. Each entry must capture
 * everything a user can change: the Fabric scene plus the canvas
 * dimensions and background colour. Older snapshots (scene-only) are
 * accepted for forward compatibility.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

import { DEFAULT_BG, DEFAULT_HEIGHT, DEFAULT_WIDTH } from './constants.js';
import type { AnyObj } from './serializer.js';
import { clampDimensions, isHexColor } from './serializer.js';

export interface SlideSnapshot {
    scene: AnyObj;
    width: number;
    height: number;
    background: string;
}

const SNAPSHOT_TAG = 'exe-slide-snapshot-v1';

interface WireSnapshot {
    __tag: typeof SNAPSHOT_TAG;
    scene: AnyObj;
    width: number;
    height: number;
    background: string;
}

export function buildSnapshot(scene: AnyObj, width: number, height: number, background: string): string {
    const clamped = clampDimensions(width, height);
    const wire: WireSnapshot = {
        __tag: SNAPSHOT_TAG,
        scene: scene && typeof scene === 'object' ? scene : {},
        width: clamped.width,
        height: clamped.height,
        background: isHexColor(background) ? background : DEFAULT_BG,
    };
    return JSON.stringify(wire);
}

export function readSnapshot(serialized: string): SlideSnapshot {
    let parsed: unknown;
    try {
        parsed = JSON.parse(serialized);
    } catch {
        return blank();
    }
    if (!parsed || typeof parsed !== 'object') return blank();
    const obj = parsed as Record<string, unknown>;
    if (obj.__tag === SNAPSHOT_TAG) {
        const { width, height } = clampDimensions(obj.width, obj.height);
        return {
            scene: (obj.scene && typeof obj.scene === 'object' ? obj.scene : {}) as AnyObj,
            width,
            height,
            background: isHexColor(obj.background) ? (obj.background as string) : DEFAULT_BG,
        };
    }
    // Legacy snapshot: the whole blob is the Fabric scene; dims/bg fall
    // back to defaults so older entries don't crash undo.
    return {
        scene: obj as AnyObj,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        background: DEFAULT_BG,
    };
}

function blank(): SlideSnapshot {
    return {
        scene: {},
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        background: DEFAULT_BG,
    };
}
