import { describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

import {
    OE_REPLACEMENT,
    OE_SOURCE,
    TIKZ_EDITION_DIR,
    TIKZ_FONT_PACK_NAME,
    TIKZ_PAYLOAD_NAME,
    WORKER_MODULE_HEADER,
    WORKER_MODULE_HEADER_REPLACEMENT,
    buildPack,
    repackTikzJaxInDist,
    repackTikzJaxSource,
} from './repack-tikzjax';
import { zstdDecompress } from './zstd';

const projectRoot = path.resolve(import.meta.dir, '../..');

function gzipDataUriModule(id: number, content: string): { module: string; content: Buffer } {
    const raw = Buffer.from(content);
    const b64 = zlib.gzipSync(raw).toString('base64');
    return {
        module: `${id}:A=>{"use strict";A.exports="data:application/gzip;base64,${b64}"}`,
        content: raw,
    };
}

/** Synthetic source with the same structural landmarks as the vendored file. */
function syntheticTikzSource(assetCount: number, corruptOne = false): { source: string; contents: Buffer[] } {
    const modules: string[] = [];
    const contents: Buffer[] = [];
    for (let i = 0; i < assetCount; i++) {
        const { module, content } = gzipDataUriModule(1000 + i, `asset-${i}-`.repeat(20 + i));
        modules.push(module);
        contents.push(content);
    }
    if (corruptOne) {
        // Truncated gzip stream (the vendored build really ships one).
        const broken = zlib.gzipSync(Buffer.from('broken')).subarray(0, 12);
        modules.push(
            `9999:A=>{"use strict";A.exports="data:application/gzip;base64,${broken.toString('base64')}"}`,
        );
    }
    // Mirror the vendored layout: the asset modules, the se map and the Oe
    // consumer all live INSIDE the single-quoted worker source string that
    // webpack module 147 exports (none of them contain single quotes).
    const workerBody = `(()=>{var A={${modules.join(',')}};var se={"core.dump.gz":A};${OE_SOURCE}})();`;
    const source = `(()=>{var A={${WORKER_MODULE_HEADER}${workerBody}'}};runOuter();})();`;
    return { source, contents };
}

function unpack(packed: Buffer): { header: Record<string, [number, number]>; payload: Buffer } {
    const bytes = zstdDecompress(packed);
    const headerLength = bytes.readUInt32LE(0);
    const header = JSON.parse(bytes.subarray(4, 4 + headerLength).toString());
    return { header, payload: bytes.subarray(4 + headerLength) };
}

describe('buildPack', () => {
    it('produces a self-describing header + payload layout', () => {
        const pack = buildPack([
            { key: 'a', data: Buffer.from('AAAA') },
            { key: 'b', data: Buffer.from('BB') },
        ]);
        const headerLength = pack.readUInt32LE(0);
        const header = JSON.parse(pack.subarray(4, 4 + headerLength).toString());
        const payload = pack.subarray(4 + headerLength);

        expect(header).toEqual({ a: [0, 4], b: [4, 2] });
        expect(payload.subarray(0, 4).toString()).toBe('AAAA');
        expect(payload.subarray(4, 6).toString()).toBe('BB');
    });
});

describe('repackTikzJaxSource', () => {
    it('moves every data URI into ordered decompressed payloads and hooks the consumer', () => {
        const { source, contents } = syntheticTikzSource(205);

        const { shell, payloads, corrupt } = repackTikzJaxSource(source);

        expect(corrupt).toBe(0);
        expect(payloads.length).toBe(205);
        for (let i = 0; i < contents.length; i++) {
            expect(payloads[i]!.equals(contents[i])).toBe(true);
        }
        expect(shell).not.toContain('data:application/gzip;base64');
        expect(shell).toContain('A.exports=0}');
        expect(shell).toContain('A.exports=204}');
        expect(shell).toContain(OE_REPLACEMENT);
        expect(shell).toContain('__exeTikzAsset');
        expect(shell).toContain(TIKZ_PAYLOAD_NAME);
        // The worker-source module must be wrapped so the runtime worker
        // prelude (hook + absolute URLs) is prepended inside the TeX worker.
        expect(shell).toContain(WORKER_MODULE_HEADER_REPLACEMENT);
        expect(shell).toContain('__exeTikzWorkerPrelude');
    });

    it('fails loudly when the worker-source module disappears', () => {
        const { source } = syntheticTikzSource(205);
        const withoutWorker = source.replace(WORKER_MODULE_HEADER, `147:A=>{"use strict";A.exports=Q(`);
        expect(() => repackTikzJaxSource(withoutWorker)).toThrow(/worker source module not found/);
    });

    it('tolerates the known upstream-corrupt asset by omitting its payload', () => {
        const { source } = syntheticTikzSource(205, true);

        const { payloads, corrupt } = repackTikzJaxSource(source);

        expect(corrupt).toBe(1);
        expect(payloads.length).toBe(206);
        expect(payloads[205]).toBeNull();
    });

    it('fails loudly when the upstream layout changes', () => {
        expect(() => repackTikzJaxSource('var nothing = 1;')).toThrow(/upstream layout changed/);

        const { source } = syntheticTikzSource(205);
        const withoutConsumer = source.replace(OE_SOURCE, 'async function Oe(A){return null}');
        expect(() => repackTikzJaxSource(withoutConsumer)).toThrow(/consumer function not found/);
    });

    it('matches the consumer function shipped in the vendored tikzjax.js', () => {
        const vendored = fs.readFileSync(
            path.join(projectRoot, 'public', TIKZ_EDITION_DIR, 'tikzjax.js'),
            'utf-8',
        );
        expect(vendored).toContain(OE_SOURCE);
        expect(vendored).toContain(WORKER_MODULE_HEADER);
        expect(vendored.split('data:application/gzip;base64').length - 1).toBeGreaterThanOrEqual(200);
    });
});

describe('repackTikzJaxInDist', () => {
    it('rewrites the dist copy, writes both packs and removes the loose TTFs', () => {
        const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'exe-tikz-dist-'));
        const editionDir = path.join(dist, TIKZ_EDITION_DIR);
        const fontsDir = path.join(editionDir, 'fonts');
        try {
            fs.mkdirSync(fontsDir, { recursive: true });
            const { source, contents } = syntheticTikzSource(205);
            fs.writeFileSync(path.join(editionDir, 'tikzjax.js'), source);
            const fontNames: string[] = [];
            for (let i = 0; i < 105; i++) {
                const name = `cmfake${i}`;
                fontNames.push(name);
                fs.writeFileSync(path.join(fontsDir, `${name}.ttf`), Buffer.from(`ttf-${i}-`.repeat(10)));
            }
            fs.writeFileSync(path.join(fontsDir, 'LICENCE_BAKOMA.txt'), 'license text');

            const stats = repackTikzJaxInDist(dist);

            // Shell replaced, no URIs, payload round-trips.
            const shell = fs.readFileSync(path.join(editionDir, 'tikzjax.js'), 'utf-8');
            expect(shell).not.toContain('data:application/gzip;base64');
            expect(stats.jsAfter).toBe(Buffer.byteLength(shell));

            const payloadPack = unpack(fs.readFileSync(path.join(editionDir, TIKZ_PAYLOAD_NAME)));
            const [offset, length] = payloadPack.header['0'];
            expect(payloadPack.payload.subarray(offset, offset + length).equals(contents[0])).toBe(true);

            // Fonts packed, TTFs gone, licence kept.
            const fontPack = unpack(fs.readFileSync(path.join(editionDir, TIKZ_FONT_PACK_NAME)));
            const [fOffset, fLength] = fontPack.header['cmfake3'];
            expect(fontPack.payload.subarray(fOffset, fOffset + fLength).toString()).toBe('ttf-3-'.repeat(10));
            expect(fs.readdirSync(fontsDir)).toEqual(['LICENCE_BAKOMA.txt']);
            expect(stats.fontsBefore).toBeGreaterThan(0);
        } finally {
            fs.rmSync(dist, { recursive: true, force: true });
        }
    });
});
