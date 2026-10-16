/**
 * Fuzz target: safeJoin must reject or stay inside its base directory.
 */
import * as path from 'path';
import { safeJoin, UnsafePathError } from '../src/utils/safe-path';

const BASE = '/data/files';

export function fuzz(data: Buffer): void {
    const segments = data.toString('utf8').split('\0');
    let joined: string;
    try {
        joined = safeJoin(BASE, ...segments);
    } catch (e) {
        if (e instanceof UnsafePathError) return;
        throw e;
    }
    const rel = path.relative(BASE, path.resolve(joined));
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        throw new Error(`safeJoin escaped base: ${JSON.stringify(segments)} -> ${joined}`);
    }
}
