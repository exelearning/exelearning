// Minimal stand-in for eXe's AssetManager (public/app/yjs/AssetManager.js):
// in-memory blobs, asset://<uuid>.<ext> canonical URLs (getAssetUrl), legacy
// asset://<uuid>/<name>, extractAssetId, and a blob -> asset reverse map
// (reverseBlobCache). Shared by every harness page.
(() => {
    const byId = new Map(); // id -> { blobUrl, filename }
    const blobToId = new Map(); // blobUrl -> id
    const S = {
        safetyNetHits: 0,
        safetyNetEnabled: new URLSearchParams(location.search).get('net') === '1',
        getAssetUrl(id, filename) {
            const ext = filename && filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
            return ext ? `asset://${id}.${ext}` : `asset://${id}`;
        },
        extractAssetId(url) {
            const m = String(url).match(/^asset:\/\/([a-f0-9-]{36})/i);
            return m ? m[1] : null;
        },
        add(id, filename, blob) {
            const blobUrl = URL.createObjectURL(blob);
            byId.set(id, { blobUrl, filename });
            blobToId.set(blobUrl, id);
            return S.getAssetUrl(id, filename);
        },
        // Sync lookup: eXe keeps blobs in memory (blobCache), so a sync path exists.
        resolveSync(assetUrl) {
            const id = S.extractAssetId(assetUrl);
            return id && byId.has(id) ? byId.get(id).blobUrl : null;
        },
        // blob: -> canonical asset:// (keeps the legacy /name form if the caller has it).
        blobToAsset(blobUrl) {
            const id = blobToId.get(blobUrl);
            return id ? S.getAssetUrl(id, byId.get(id).filename) : null;
        },
        isAsset: v => typeof v === 'string' && v.startsWith('asset://'),
        isBlob: v => typeof v === 'string' && v.startsWith('blob:'),
        // Equivalent of AssetManager.convertBlobURLsToAssetRefs. Always counts blob:
        // URLs reaching the stored HTML (so hooks-only runs measure leaks); rewrites
        // them only with ?net=1.
        safetyNet(html) {
            if (typeof html !== 'string') return html;
            return html.replace(/blob:[^"'\s)]+/g, b => {
                S.safetyNetHits++;
                return S.safetyNetEnabled ? S.blobToAsset(b) || '' : b;
            });
        },
        async png(color) {
            const c = document.createElement('canvas');
            c.width = 40;
            c.height = 40;
            const g = c.getContext('2d');
            g.fillStyle = color;
            g.fillRect(0, 0, 40, 40);
            return new Promise(r => c.toBlob(r, 'image/png'));
        },
        async seed() {
            S.add('11111111-1111-4111-8111-111111111111', 'red.png', await S.png('red'));
            S.add(
                '22222222-2222-4222-8222-222222222222',
                'doc.pdf',
                new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' }),
            );
            S.add('33333333-3333-4333-8333-333333333333', 'photo.png', await S.png('blue'));
            S.add('44444444-4444-4444-8444-444444444444', 'clip.mp4', new Blob(['fake'], { type: 'video/mp4' }));
            S.add('55555555-5555-4555-8555-555555555555', 'sound.mp3', new Blob(['fake'], { type: 'audio/mpeg' }));
            S.add(
                '66666666-6666-4666-8666-666666666666',
                'page.html',
                new Blob(['<h1>asset html</h1>'], { type: 'text/html' }),
            );
        },
        // Custom "file manager" insert: new blob -> new asset id -> asset:// URL.
        async newImageAsset() {
            const id = '77777777-7777-4777-8777-777777777777';
            return S.add(id, 'green.png', await S.png('green'));
        },
    };
    window.AssetStore = S;

    // Stored iDevice HTML as eXe persists it (asset:// only, data-mce-html marker kept).
    window.FIXTURE = [
        '<p>Intro with an inline image <img src="asset://11111111-1111-4111-8111-111111111111.png" alt="old alt" width="40" height="40"> and a link to <a href="asset://22222222-2222-4222-8222-222222222222.pdf">the PDF</a>.</p>',
        '<p>Legacy path image: <img src="asset://33333333-3333-4333-8333-333333333333/photo.png" alt="legacy"></p>',
        '<video controls="controls" width="200"><source src="asset://44444444-4444-4444-8444-444444444444.mp4" type="video/mp4"></video>',
        '<audio controls="controls" src="asset://55555555-5555-4555-8555-555555555555.mp3"></audio>',
        '<iframe src="asset://66666666-6666-4666-8666-666666666666.html" data-mce-html="true" width="300" height="150"></iframe>',
        '<p>Last paragraph.</p>',
    ].join('\n');
})();
