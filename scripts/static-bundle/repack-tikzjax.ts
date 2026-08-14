/**
 * Static-build repack of the electrical-circuits TikZJax payloads.
 *
 * The vendored edition/tikzjax.js embeds 214 `data:application/gzip;base64,`
 * URIs (a 72 MB TeX core dump plus the LaTeX package sources, ~6.4 MB of
 * base64). Base64-of-gzip defeats every outer compressor, so the release ZIP
 * carried ~4.9 MB it could not deflate. The edition also ships 140 BaKoMa
 * TTFs (3.6 MB) that its custom TTF parser fetches one by one.
 *
 * At build time — the pristine vendored file stays untouched in git and keeps
 * serving the server runtime — the dist copy is transformed:
 *
 *  - every asset module (`NNN:A=>{"use strict";A.exports="data:..."}`)
 *    exports its asset index instead of the URI;
 *  - the single consumer, `async function Oe(name)` (base64-decode + pako
 *    ungzip), is replaced by an equally-async hook that lazily fetches
 *    tikzjax-payload.bin.zst, fzstd-decompresses it once, and returns the
 *    already-ungzipped bytes per index — same Uint8Array shape pako returned;
 *  - the payload sidecar stores the *decompressed* asset contents, so zstd
 *    compresses actual TeX data instead of gzip streams (4.9 MB deflated →
 *    ~3.3 MB stored);
 *  - the fonts/ TTFs are packed into one fonts.pack.zst (read by
 *    loadTikzFontPack in edition/electrical-circuits.js, which falls back to
 *    the loose files when the pack is absent — i.e. in server mode);
 *    LICENCE_BAKOMA.txt stays.
 *
 * Every structural expectation is a loud guard: if upstream tikzjax.js
 * changes shape, the build fails instead of silently shipping duplicates.
 *
 * Pack format (shared with the font pack): u32le header length + JSON header
 * (key -> [offset, length] into the payload area) + concatenated payloads,
 * all inside a single zstd frame.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

import { zstdCompress } from './zstd';

export const TIKZ_EDITION_DIR = 'files/perm/idevices/base/electrical-circuits/edition';
export const TIKZ_PAYLOAD_NAME = 'tikzjax-payload.bin.zst';
export const TIKZ_FONT_PACK_NAME = 'fonts.pack.zst';

const DATA_URI_MODULE = /(\d+):A=>\{"use strict";A\.exports="data:application\/gzip;base64,([A-Za-z0-9+/=]+)"\}/g;

/** The exact consumer in the vendored build; replaced by the async hook. */
export const OE_SOURCE =
    'async function Oe(A){const f=se[A],q=Hq.Buffer.from(f.substring("data:application/gzip;base64,".length),"base64");' +
    'try{return Xq.ungzip(q)}catch(f){throw`Unable to load ${A}.  File not available.`}}';

export const OE_REPLACEMENT =
    'async function Oe(A){const f=se[A];try{return await globalThis.__exeTikzAsset(f)}' +
    'catch(q){throw`Unable to load ${A}.  File not available.`}}';

/** Prepended loader: lazy fetch + fzstd decompress of the payload sidecar. */
export const TIKZ_PRELUDE = `/* eXeLearning static build: the embedded base64 gzip assets were moved to
 * ${TIKZ_PAYLOAD_NAME} (zstd). Asset modules now export an index; the hook
 * below fetches and decompresses the sidecar once, on first use. Regenerated
 * from the pristine vendored tikzjax.js on every build (repack-tikzjax.ts). */
(() => {
    const script = document.currentScript;
    const base = script && script.src ? script.src.replace(/[^/]*(?:\\?.*)?$/, '') : '';
    let packPromise = null;
    globalThis.__exeTikzAsset = async (index) => {
        if (!packPromise) {
            packPromise = (async () => {
                if (!globalThis.fzstd) throw new Error('fzstd is required to load TikZJax assets');
                const response = await fetch(base + '${TIKZ_PAYLOAD_NAME}');
                if (!response.ok) throw new Error('TikZJax payload missing: ' + response.status);
                const bytes = globalThis.fzstd.decompress(new Uint8Array(await response.arrayBuffer()));
                const headerLength = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
                const header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + headerLength)));
                return { header, payload: bytes.subarray(4 + headerLength) };
            })();
        }
        const { header, payload } = await packPromise;
        const entry = header[index];
        if (!entry) throw new Error('Unknown TikZJax asset index: ' + index);
        return payload.subarray(entry[0], entry[0] + entry[1]);
    };
})();
`;

/**
 * Build an uncompressed pack: u32le header length + JSON header + payloads.
 */
export function buildPack(entries: Array<{ key: string; data: Buffer }>): Buffer {
    const header: Record<string, [number, number]> = {};
    let offset = 0;
    for (const { key, data } of entries) {
        header[key] = [offset, data.length];
        offset += data.length;
    }
    const headerJson = Buffer.from(JSON.stringify(header));
    const headerLength = Buffer.alloc(4);
    headerLength.writeUInt32LE(headerJson.length, 0);
    return Buffer.concat([headerLength, headerJson, ...entries.map(e => e.data)]);
}

/**
 * Transform the tikzjax source: strip the embedded data URIs into an ordered
 * payload list and rewrite the consumer to use the sidecar hook.
 */
export function repackTikzJaxSource(source: string): {
    shell: string;
    payloads: Array<Buffer | null>;
    corrupt: number;
} {
    const payloads: Array<Buffer | null> = [];
    let corrupt = 0;
    const shellBody = source.replace(DATA_URI_MODULE, (_match, id: string, b64: string) => {
        const index = payloads.length;
        try {
            payloads.push(zlib.gunzipSync(Buffer.from(b64, 'base64')));
        } catch {
            // The vendored build ships at least one asset whose gzip stream is
            // corrupt upstream (tex_files/pgfplotscoordprocessing.code.tex.gz):
            // pako.ungzip throws for it today and TikZJax reports "File not
            // available". Omitting the index from the pack header reproduces
            // exactly that behavior through the hook.
            payloads.push(null);
            corrupt += 1;
        }
        return `${id}:A=>{"use strict";A.exports=${index}}`;
    });
    if (payloads.length < 200) {
        throw new Error(`repackTikzJax: expected >=200 embedded assets, found ${payloads.length} — upstream layout changed`);
    }
    if (corrupt > 2) {
        throw new Error(`repackTikzJax: ${corrupt} assets failed to gunzip — upstream payloads look broken`);
    }
    if (!shellBody.includes(OE_SOURCE)) {
        throw new Error('repackTikzJax: asset-consumer function not found — upstream layout changed');
    }
    const shell = TIKZ_PRELUDE + shellBody.replace(OE_SOURCE, OE_REPLACEMENT);
    if (shell.includes('data:application/gzip;base64')) {
        throw new Error('repackTikzJax: embedded data URIs remain after transform');
    }
    return { shell, payloads, corrupt };
}

/**
 * Apply the repack to a built dist: rewrite tikzjax.js, write the payload
 * sidecar, pack the fonts and remove the loose TTFs. Returns byte stats.
 */
export function repackTikzJaxInDist(distDir: string): {
    jsBefore: number;
    jsAfter: number;
    payloadBytes: number;
    fontsBefore: number;
    fontPackBytes: number;
} {
    const editionDir = path.join(distDir, TIKZ_EDITION_DIR);
    const tikzFile = path.join(editionDir, 'tikzjax.js');
    if (!fs.existsSync(tikzFile)) {
        throw new Error(`repackTikzJax: ${TIKZ_EDITION_DIR}/tikzjax.js not found in dist`);
    }
    const source = fs.readFileSync(tikzFile, 'utf-8');
    const { shell, payloads } = repackTikzJaxSource(source);
    const pack = buildPack(
        payloads.flatMap((data, index) => (data ? [{ key: String(index), data }] : [])),
    );
    const compressed = zstdCompress(pack);
    fs.writeFileSync(tikzFile, shell);
    fs.writeFileSync(path.join(editionDir, TIKZ_PAYLOAD_NAME), compressed);

    // Fonts: one zstd pack, keyed by family (basename without .ttf).
    const fontsDir = path.join(editionDir, 'fonts');
    const ttfs = fs
        .readdirSync(fontsDir)
        .filter(name => name.endsWith('.ttf'))
        .sort();
    if (ttfs.length < 100) {
        throw new Error(`repackTikzJax: expected >=100 TikZ fonts, found ${ttfs.length}`);
    }
    let fontsBefore = 0;
    const fontEntries = ttfs.map(name => {
        const data = fs.readFileSync(path.join(fontsDir, name));
        fontsBefore += data.length;
        return { key: name.replace(/\.ttf$/, ''), data };
    });
    const fontPack = zstdCompress(buildPack(fontEntries));
    fs.writeFileSync(path.join(editionDir, TIKZ_FONT_PACK_NAME), fontPack);
    for (const name of ttfs) {
        fs.unlinkSync(path.join(fontsDir, name));
    }
    // LICENCE_BAKOMA.txt (and anything that is not a TTF) stays in fonts/.

    return {
        jsBefore: Buffer.byteLength(source),
        jsAfter: Buffer.byteLength(shell),
        payloadBytes: compressed.length,
        fontsBefore,
        fontPackBytes: fontPack.length,
    };
}
