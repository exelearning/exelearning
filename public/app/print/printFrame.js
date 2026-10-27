import { printPreviewSnapshot } from '../workarea/modals/modals/pages/printPreviewSnapshot.js';

// Leave time for the host's 30-second deadline to receive a resource error.
const RESOURCE_TIMEOUT_MS = 25000;

function waitForImage(image, cancellations) {
    // Empty placeholders are common in interactive activities.
    if (!image.currentSrc && !image.getAttribute('src') && !image.getAttribute('srcset') &&
        !image.closest('picture')?.querySelector('source[srcset]')) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const finish = (error) => {
            image.removeEventListener('load', loaded);
            image.removeEventListener('error', failed);
            cancellations.delete(cancel);
            if (error) reject(error);
            else resolve();
        };
        const loaded = () => finish(image.naturalWidth > 0 ? null : new Error('PRINT_IMAGE_FAILED'));
        const failed = () => finish(new Error('PRINT_IMAGE_FAILED'));
        const cancel = () => finish();
        cancellations.add(cancel);
        image.addEventListener('load', loaded);
        image.addEventListener('error', failed);
        // The frame is hidden while loading, so lazy images must load without scrolling.
        image.loading = 'eager';
        // Register listeners first, then handle cached images (including failed requests).
        if (image.complete) loaded();
    });
}

/** Runs inside the sandbox. Only the embedding window can request these operations. */
export function bindPrintFrame(token, host = window) {
    let disposed = false;
    let settled = false;
    let preparing = false;
    let printId = null;
    const cancellations = new Set();
    let cancelWaiting;
    const cancelled = new Promise(resolve => { cancelWaiting = resolve; });
    const reply = (id, type, value, error) => {
        if (!disposed) host.parent.postMessage({ channel: 'exe-print', token, id, type, value, error }, '*');
    };
    const started = () => {
        if (printId !== null) reply(printId, 'started');
        printId = null;
    };
    const receive = async (event) => {
        const data = event.data;
        if (event.source !== host.parent || !data || data.channel !== 'exe-print' || data.token !== token) return;
        if (data.type === 'dispose') {
            dispose();
        } else if (data.type === 'options') {
            const options = data.value || {};
            if (typeof options.unfoldBlocks === 'boolean') host.document.documentElement.classList.toggle('exe-print-as-shown', !options.unfoldBlocks);
            if (typeof options.teacherOnly === 'boolean') host.document.documentElement.classList.toggle('mode-teacher', options.teacherOnly);
        } else if (data.type === 'print') {
            printId = data.id;
            host.print();
        } else if (data.type === 'snapshot') {
            try { reply(data.id, 'snapshot', await printPreviewSnapshot(host.document)); }
            catch (error) { reply(data.id, 'snapshot', null, String(error)); }
        }
    };
    const cleanupLifecycle = () => {
        host.document.removeEventListener('readystatechange', onStateChange);
        host.document.removeEventListener('DOMContentLoaded', onStateChange);
        host.removeEventListener('load', onStateChange);
        clearInterval(stateTimer);
    };
    const cleanupReadiness = () => {
        cleanupLifecycle();
        clearTimeout(deadline);
        cancelWaiting();
        for (const cancel of cancellations) cancel();
    };
    const finishReadiness = (error) => {
        if (disposed || settled) return;
        settled = true;
        cleanupReadiness();
        reply(0, 'ready', undefined, error ? String(error) : undefined);
    };
    const ready = async () => {
        if (preparing || disposed || settled) return;
        preparing = true;
        cleanupLifecycle();
        try {
            await Promise.race([host.MathJax?.startup?.promise, cancelled]);
            if (disposed || settled) return;
            const images = Array.from(host.document.querySelectorAll('img'));
            await Promise.race([
                Promise.all([host.document.fonts?.ready, ...images.map(image => waitForImage(image, cancellations))]),
                cancelled,
            ]);
            finishReadiness();
        } catch (error) { finishReadiness(error); }
    };
    const onStateChange = () => {
        // Wait for scripts and styles too. Interactive/DOMContentLoaded is too early for
        // asynchronous initializers; load may already have fired when this bridge binds.
        if (host.document.readyState === 'complete') ready();
    };
    const dispose = () => {
        disposed = true;
        cleanupReadiness();
        host.removeEventListener('message', receive);
        host.removeEventListener('beforeprint', started);
        host.removeEventListener('pagehide', dispose);
        printId = null;
    };
    host.addEventListener('message', receive);
    host.addEventListener('beforeprint', started);
    host.addEventListener('pagehide', dispose);
    host.document.addEventListener('readystatechange', onStateChange);
    host.document.addEventListener('DOMContentLoaded', onStateChange);
    host.addEventListener('load', onStateChange);
    // Recover missed lifecycle events without declaring a still-loading document ready.
    const stateTimer = setInterval(onStateChange, 250);
    const deadline = setTimeout(() => finishReadiness(new Error('PRINT_RESOURCES_TIMEOUT')), RESOURCE_TIMEOUT_MS);
    onStateChange();
    return dispose;
}

const token = document.currentScript?.dataset.printToken;
if (token) bindPrintFrame(token);
