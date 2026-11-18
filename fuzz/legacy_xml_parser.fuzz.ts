/**
 * Fuzz target: legacy .elp content.xml parsing (untrusted uploads).
 * Deliberate parse rejections are fine; TypeError/RangeError are bugs.
 */
import { LegacyXmlParser } from '../src/shared/import/LegacyXmlParser';

const silent = { log() {}, warn() {}, error() {} };

export function fuzz(data: Buffer): void {
    try {
        new LegacyXmlParser(silent).parse(data.toString('utf8'));
    } catch (e) {
        if (e instanceof TypeError || e instanceof RangeError) throw e;
    }
}
