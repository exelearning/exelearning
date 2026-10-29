// Usage: node run.mjs [tinymce|hugerte|prosekit ...] [--net]
// Serves this folder, drives each harness in Chromium and prints a pass/fail table + JSON.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const args = process.argv.slice(2);
const net = args.includes('--net');
const offArg = (args.find(a => a.startsWith('--off=')) || '').slice(6);
const editors = args.filter(a => !a.startsWith('--'));
if (!editors.length) editors.push('tinymce', 'hugerte', 'prosekit');
const PORT = 8765;
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
    cwd: import.meta.dirname,
    stdio: 'ignore',
});
await sleep(800);

const IDS = {
    img: 'asset://11111111-1111-4111-8111-111111111111.png',
    pdf: 'asset://22222222-2222-4222-8222-222222222222.pdf',
    legacy: 'asset://33333333-3333-4333-8333-333333333333/photo.png',
    video: 'asset://44444444-4444-4444-8444-444444444444.mp4',
    audio: 'asset://55555555-5555-4555-8555-555555555555.mp3',
    iframe: 'asset://66666666-6666-4666-8666-666666666666.html',
};
const leaks = html => ({
    blob: (html.match(/blob:/g) || []).length,
    http: (html.match(/(src|href)=["']https?:/g) || []).length,
    internal: (html.match(/data-(mce-src|mce-href|asset-src)=/g) || []).length,
});

const browser = await chromium.launch();
const all = {};
for (const ed of editors) {
    const results = [];
    const check = (id, ok, detail = '') => results.push({ id, ok: !!ok, detail: String(detail).slice(0, 400) });
    const ctx = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const errors = [];
    try {
        const page = await ctx.newPage();
        page.setDefaultTimeout(5000);
        page.on('pageerror', e => errors.push(e.message));
        let assetFetches = 0; // browser tried to load asset:// (broken-image flash; harmless otherwise)
        page.on('console', m => {
            if (/ERR_UNKNOWN_URL_SCHEME/.test(m.text())) assetFetches++;
        });
        const url =
            ed === 'prosekit'
                ? `http://127.0.0.1:${PORT}/harness-prosekit.html?x=1${net ? '&net=1' : ''}${offArg ? '&off=' + offArg : ''}`
                : `http://127.0.0.1:${PORT}/harness-tiny.html?ed=${ed}${net ? '&net=1' : ''}${offArg ? '&off=' + offArg : ''}`;
        await page.goto(url);
        await page.waitForFunction(() => window.HREADY || window.HERROR, null, { timeout: 20000 });
        const herr = await page.evaluate(() => window.HERROR);
        if (herr) throw new Error('boot: ' + herr);
        const version = await page.evaluate(() => H.version);
        const frameSel = await page.evaluate(() => H.frameSelector);
        const root = frameSel ? page.frameLocator(frameSel).locator('body') : page.locator('.ProseMirror');
        const frame = frameSel ? await (await page.$(frameSel)).contentFrame() : page.mainFrame();
        await sleep(300);

        // D: display uses blob: and media actually loads
        const disp = await frame.evaluate(
            sel => {
                const r = document.querySelector(sel) || document.body;
                const q = s => [...r.querySelectorAll(s)];
                return {
                    imgs: q('img:not(.ProseMirror-separator)').map(i => ({
                        src: i.getAttribute('src'),
                        w: i.naturalWidth,
                    })),
                    source: q('video source, video[src]').map(v => v.getAttribute('src')),
                    audio: q('audio').map(a => a.getAttribute('src')),
                    iframe: q('iframe').map(f => f.getAttribute('src')),
                    a: q('a').map(a => a.getAttribute('href')),
                };
            },
            frameSel ? 'body' : '.ProseMirror',
        );
        check(
            'D1 images display via blob: and load',
            disp.imgs.length === 2 && disp.imgs.every(i => i.src?.startsWith('blob:') && i.w > 0),
            JSON.stringify(disp.imgs),
        );
        check(
            'D2 video <source> displays via blob:',
            disp.source.length === 1 && disp.source[0]?.startsWith('blob:'),
            JSON.stringify(disp.source),
        );
        check(
            'D3 audio displays via blob:',
            disp.audio.length === 1 && disp.audio[0]?.startsWith('blob:'),
            JSON.stringify(disp.audio),
        );
        check(
            'D4 iframe displays via blob:',
            disp.iframe.length === 1 && disp.iframe[0]?.startsWith('blob:'),
            JSON.stringify(disp.iframe),
        );
        check(
            'D5 <a href> kept as asset:// in editor',
            disp.a.length === 1 && disp.a[0] === IDS.pdf,
            JSON.stringify(disp.a),
        );
        check('U1 display resolution creates no undo level', !(await page.evaluate(() => H.hasUndo())));

        // S: untouched round trip
        const s0 = await page.evaluate(() => H.getStored());
        const missing = Object.entries(IDS)
            .filter(([, v]) => !s0.includes(v))
            .map(([k]) => k);
        check(
            'S1 all 6 asset:// URLs survive untouched round trip',
            !missing.length,
            missing.length ? 'missing: ' + missing + ' | ' + s0 : '',
        );
        const l0 = leaks(s0);
        check(
            'S2 no blob:/http/internal attrs in stored HTML',
            !l0.blob && !l0.http && !l0.internal,
            JSON.stringify(l0),
        );
        check('S3 data-mce-html marker preserved', s0.includes('data-mce-html="true"'), '');
        check('S4 no sandbox attr added to iframe', !/sandbox/.test(s0), '');
        check('S5 no wrapper element around stored HTML', s0.startsWith('<p>Intro'), s0.slice(0, 40));
        const fixture = await page.evaluate(() => window.FIXTURE);
        check(
            'S6 untouched round trip byte-identical to input (HTML fidelity, not asset-specific)',
            s0 === fixture,
            s0 === fixture ? '' : s0,
        );

        // E1: type text at the end of the last paragraph
        const lastP = root.locator('p', { hasText: 'Last paragraph.' });
        await lastP.click();
        await page.keyboard.press('End');
        await page.keyboard.type(' Typed text.');
        const s1 = await page.evaluate(() => H.getStored());
        check(
            'E1 typed text stored, assets intact',
            s1.includes('Typed text.') && Object.values(IDS).every(v => s1.includes(v)) && !leaks(s1).blob,
            '',
        );

        // E2: move the first image via cut + paste (clipboard carries the display DOM)
        let moveDetail = '';
        try {
            await root.locator('img').first().click();
            await page.keyboard.press('ControlOrMeta+X');
            await sleep(200);
            const afterCut = await page.evaluate(() => H.getStored());
            moveDetail += 'cut removed img: ' + !afterCut.includes(IDS.img) + '; ';
            await lastP.click();
            await page.keyboard.press('End');
            await sleep(150); // let the editor observe selectionchange (ProseMirror reads it async)
            await page.keyboard.press('ControlOrMeta+V');
            await sleep(300);
        } catch (e) {
            moveDetail += 'error ' + e.message;
        }
        const s2 = await page.evaluate(() => H.getStored());
        const imgCount = s2.split(IDS.img).length - 1;
        const lastPara = s2.slice(s2.lastIndexOf('Typed text.'));
        check(
            'E2 moved image stored once as asset:// in new place, no blob:',
            imgCount === 1 && lastPara.includes(IDS.img) && !leaks(s2).blob,
            moveDetail + s2.slice(s2.indexOf('Last paragraph')),
        );

        // E3: change alt of the (moved) first image
        let altDetail = '';
        if (ed === 'prosekit') {
            altDetail = await page.evaluate(() => H.setAlt('new alt'));
        } else {
            await root.locator(`img[alt="old alt"]`).click();
            await page.evaluate(() => H.openImageDialog());
            const dlg = page.locator('.tox-dialog');
            await dlg.waitFor();
            const inputs = dlg.locator('input.tox-textfield');
            const srcShown = await inputs.nth(0).inputValue();
            altDetail = 'dialog Source field shows: ' + srcShown;
            await inputs.nth(1).fill('new alt');
            await dlg.locator('button', { hasText: 'Save' }).click();
            await sleep(200);
            check('E3a image dialog shows asset:// (not blob:)', srcShown.startsWith('asset://'), altDetail);
        }
        const s3 = await page.evaluate(() => H.getStored());
        check(
            'E3 alt change stored, src stays asset://',
            /alt="new alt"/.test(s3) && s3.includes(IDS.img) && !leaks(s3).blob,
            altDetail + ' | ' + (s3.match(/<img[^>]*new alt[^>]*>/) || [''])[0],
        );
        const dispAfter = await frame.evaluate(
            sel =>
                [
                    ...(document.querySelector(sel) || document.body).querySelectorAll(
                        'img:not(.ProseMirror-separator)',
                    ),
                ].map(i => [i.getAttribute('src').slice(0, 10), i.naturalWidth]),
            frameSel ? 'body' : '.ProseMirror',
        );
        check(
            'E4 images still display after edits',
            dispAfter.every(([s, w]) => s.startsWith('blob:') && w > 0),
            JSON.stringify(dispAfter),
        );

        // I1: insert a new asset through a custom command
        await lastP.click();
        const newUrl = await page.evaluate(() => H.insertAsset());
        await sleep(300);
        const s4 = await page.evaluate(() => H.getStored());
        const newDisp = await frame.evaluate(
            sel => {
                const i = (document.querySelector(sel) || document.body).querySelector('img[alt="inserted"]');
                return i && [i.getAttribute('src'), i.naturalWidth];
            },
            frameSel ? 'body' : '.ProseMirror',
        );
        check(
            'I1 inserted asset displays via blob:',
            newDisp && newDisp[0].startsWith('blob:') && newDisp[1] > 0,
            JSON.stringify(newDisp),
        );
        check('I2 inserted asset stored as asset://', s4.includes(newUrl) && !leaks(s4).blob, newUrl);

        // R: reload stored HTML into the editor and re-serialize (idempotence)
        await page.evaluate(h => H.reload(h), s4);
        await sleep(200);
        const s5 = await page.evaluate(() => H.getStored());
        let firstDiff = 0;
        while (firstDiff < s4.length && s4[firstDiff] === s5[firstDiff]) firstDiff++;
        const urls = h => JSON.stringify((h.match(/(src|href)="[^"]*"/g) || []).sort());
        check('R1 reload keeps the same asset:// src/href set', urls(s4) === urls(s5), urls(s5));
        check(
            'R1b reload is byte-identical (HTML fidelity, not asset-specific)',
            s5 === s4,
            s5 === s4
                ? ''
                : 'at ' +
                      firstDiff +
                      ' len ' +
                      s4.length +
                      '/' +
                      s5.length +
                      ' before: ' +
                      s4.slice(Math.max(0, firstDiff - 60), firstDiff + 120) +
                      ' || after: ' +
                      s5.slice(Math.max(0, firstDiff - 60), firstDiff + 120),
        );
        const l5 = leaks(s5);
        check(
            'Z final: no blob:, no http(s) src/href, no internal attrs',
            !l5.blob && !l5.http && !l5.internal,
            JSON.stringify(l5),
        );
        const hits = await page.evaluate(() => H.safetyNetHits());
        check('Z safety net not needed (0 blob rewrites at GetContent)', hits === 0, 'hits=' + hits);
        check(
            'Z browser never tried to fetch asset:// (no broken-image flash; informational)',
            assetFetches === 0,
            'ERR_UNKNOWN_URL_SCHEME x' + assetFetches,
        );
        check('Z no page errors', !errors.length, errors.join(' | '));
        all[ed] = { version, net, results, initialStored: s0, finalStored: s5, errors };
    } catch (e) {
        check('run aborted', false, e.message.split('\n')[0]);
        all[ed] = { results, errors };
    }
    await ctx.close();
}
await browser.close();
server.kill();

for (const [ed, r] of Object.entries(all)) {
    const p = r.results.filter(x => x.ok).length;
    console.log(
        `\n== ${ed} ${r.version || ''} ${net ? '(safety net on)' : '(hooks only)'}${offArg ? ' hooks off: ' + offArg : ''}: ${p}/${r.results.length} pass`,
    );
    for (const x of r.results)
        console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.id}${x.ok || !x.detail ? '' : '\n      ' + x.detail}`);
}
writeFileSync(
    `${import.meta.dirname}/results${net ? '-net' : ''}${offArg ? '-off' + offArg.replace(/,/g, '_') : ''}.json`,
    JSON.stringify(all, null, 2),
);
