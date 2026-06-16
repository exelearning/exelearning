/**
 * Authoring-side live caption resolver.
 *
 * Rebuilds the figcaption of every `figure.exe-figure[data-asset-id]` in a DOM subtree
 * from the centralized File Manager asset metadata (resolved by asset id) plus the
 * per-instance presentation stored on the figure as data attributes
 * (`data-caption-heading`, `data-caption-notes`, `data-caption-hidden`).
 *
 * This is what makes a metadata edit in the File Manager propagate to every place the
 * image is inserted — the same live-resolution pattern the download-source-file and
 * resource-report iDevices use for project metadata. The actual markup is produced by
 * the shared builder in ./figureCaption.js (twin of src/shared/export/figure-caption.ts),
 * so the authored caption matches the one baked into exported packages.
 *
 * Pure DOM — no app/Yjs globals — so it is unit-testable. The observer wiring that calls
 * it lives in observeAssetCaptions().
 */
import { buildFigureCaption } from './figureCaption.js';

// asset://<uuid>(.ext) — same shape AssetManager.getReferencedAssetIds() matches.
const ASSET_URL_RE = /^asset:\/\/([a-z0-9-]+?)(?:\.[a-z0-9]+)?(?:[/?#]|$)/i;

/**
 * Resolve the centralized asset id for a figure: prefer the explicit data-asset-id,
 * otherwise derive it from the figure's asset:// image src. Returns null when neither
 * is present.
 * @param {Element} figure
 * @returns {string|null}
 */
export function extractAssetId(figure) {
    if (!figure || typeof figure.getAttribute !== 'function') return null;
    const explicit = figure.getAttribute('data-asset-id');
    if (explicit) return explicit;
    const img = figure.querySelector ? figure.querySelector('img[src^="asset://"]') : null;
    if (img) {
        const m = ASSET_URL_RE.exec(img.getAttribute('src') || '');
        if (m) return m[1];
    }
    return null;
}

/** Remove the resolver-managed caption nodes (header + figcaption) directly inside the figure. */
function clearCaptionNodes(figure) {
    figure.querySelectorAll(':scope > .figcaption.header, :scope > figcaption.figcaption').forEach(n => n.remove());
}

/**
 * (Re)build the caption of a single figure from centralized metadata + per-instance
 * data attributes. Stamps a missing data-asset-id (legacy upgrade) so the figure becomes
 * live. Idempotent: existing resolver-managed caption nodes are replaced, not duplicated.
 * @param {Element} figure - a figure.exe-figure element
 * @param {{title?:string, author?:string, authorUrl?:string, sourceUrl?:string, license?:string}|null} metadata
 */
export function renderFigureCaption(figure, metadata) {
    if (!figure) return;

    // Legacy upgrade: stamp the derived asset id so future observers find this figure.
    if (!figure.getAttribute('data-asset-id')) {
        const derived = extractAssetId(figure);
        if (derived) figure.setAttribute('data-asset-id', derived);
    }

    const instance = {
        heading: figure.getAttribute('data-caption-heading') || '',
        notes: figure.getAttribute('data-caption-notes') || '',
        hidden: figure.getAttribute('data-caption-hidden') === 'true',
    };
    const { header, caption } = buildFigureCaption(metadata || {}, instance);

    clearCaptionNodes(figure);

    const img = figure.querySelector(':scope > img') || figure.querySelector('img');
    if (header) {
        if (img) img.insertAdjacentHTML('beforebegin', header);
        else figure.insertAdjacentHTML('afterbegin', header);
    }
    if (caption) {
        if (img) img.insertAdjacentHTML('afterend', caption);
        else figure.insertAdjacentHTML('beforeend', caption);
    }
}

/**
 * Resolve the captions of every asset figure under `root`.
 * @param {ParentNode} root - subtree to scan
 * @param {(assetId: string) => (object|null)} getMetadata - centralized metadata lookup
 * @returns {number} how many figures were resolved
 */
export function renderAssetCaptions(root, getMetadata) {
    if (!root || typeof root.querySelectorAll !== 'function') return 0;
    const figures = root.querySelectorAll('figure.exe-figure');
    let count = 0;
    figures.forEach(figure => {
        const id = extractAssetId(figure);
        if (!id) return;
        renderFigureCaption(figure, getMetadata ? getMetadata(id) : null);
        count++;
    });
    return count;
}

/**
 * Render the captions under `root` now and keep them live: re-render (debounced) whenever
 * the centralized asset metadata changes. Mirrors the resource-report iDevice's
 * renderBehaviour observer — a File Manager metadata edit propagates to every inserted
 * image without re-opening the editor.
 * @param {ParentNode} root - subtree containing the rendered content
 * @param {object} assetManager - exposes getAssetMetadata(id) and getAssetsYMap().observe(cb)
 * @param {{debounceMs?: number}} [options]
 * @returns {() => void} dispose function that detaches the observer
 */
export function observeAssetCaptions(root, assetManager, options = {}) {
    const getMetadata = id => (assetManager && assetManager.getAssetMetadata ? assetManager.getAssetMetadata(id) : null);
    const render = () => renderAssetCaptions(root, getMetadata);

    // Initial pass — also runs the legacy-upgrade stamping.
    render();

    const yMap = assetManager && typeof assetManager.getAssetsYMap === 'function' ? assetManager.getAssetsYMap() : null;
    if (!yMap || typeof yMap.observe !== 'function') {
        return () => {};
    }

    const debounceMs = typeof options.debounceMs === 'number' ? options.debounceMs : 150;
    let pending = null;
    const onChange = () => {
        // Coalesce bursts (e.g. several fields changed in one transaction) into one render.
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => {
            pending = null;
            render();
        }, debounceMs);
    };
    yMap.observe(onChange);

    return () => {
        if (pending) clearTimeout(pending);
        if (typeof yMap.unobserve === 'function') yMap.unobserve(onChange);
    };
}
