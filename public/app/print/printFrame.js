import { printPreviewSnapshot } from '../workarea/modals/modals/pages/printPreviewSnapshot.js';

// Leave time for the host's 30-second deadline to receive the frame's answer.
const RESOURCE_TIMEOUT_MS = 25000;

/**
 * Wait for an image to load. One that fails or comes back zero-sized is passed to `skip`
 * instead of failing the whole printout; so is one still loading when cancelled with `true`.
 */
function waitForImage(image, cancellations, skip) {
    // Empty placeholders are common in interactive activities.
    if (!image.currentSrc && !image.getAttribute('src') && !image.getAttribute('srcset') &&
        !image.closest('picture')?.querySelector('source[srcset]')) return Promise.resolve();
    return new Promise(resolve => {
        const finish = (leaveOut) => {
            image.removeEventListener('load', loaded);
            image.removeEventListener('error', failed);
            cancellations.delete(cancel);
            if (leaveOut) skip(image);
            resolve();
        };
        const loaded = () => finish(image.naturalWidth === 0);
        const failed = () => finish(true);
        const cancel = (leaveOut) => finish(leaveOut);
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
    // Images that failed, or were still loading at the deadline: the rest of the page still prints.
    const skipped = new Set();
    const skip = (image) => {
        skipped.add(image);
        image.style.setProperty('display', 'none', 'important');
    };
    // Set once the document, MathJax and fonts are ready and only images are left.
    let waitingForImages = false;
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
        const value = skipped.size ? { skippedImages: skipped.size } : undefined;
        reply(0, 'ready', value, error ? String(error) : undefined);
    };
    const ready = async () => {
        if (preparing || disposed || settled) return;
        preparing = true;
        cleanupLifecycle();
        try {
            await Promise.race([host.MathJax?.startup?.promise, cancelled]);
            if (disposed || settled) return;
            const images = Array.from(host.document.querySelectorAll('img'));
            const loading = images.map(image => waitForImage(image, cancellations, skip));
            await Promise.race([host.document.fonts?.ready, cancelled]);
            if (disposed || settled) return;
            waitingForImages = true;
            await Promise.race([Promise.all(loading), cancelled]);
            finishReadiness();
        } catch (error) { finishReadiness(error); }
    };
    const expire = () => {
        if (!waitingForImages) {
            finishReadiness(new Error('PRINT_RESOURCES_TIMEOUT'));
            return;
        }
        // Only images are missing: leave out the ones still loading rather than the whole printout.
        for (const cancel of [...cancellations]) cancel(true);
        finishReadiness();
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
    const deadline = setTimeout(expire, RESOURCE_TIMEOUT_MS);
    onStateChange();
    return dispose;
}

const token = document.currentScript?.dataset.printToken;
if (token) bindPrintFrame(token);
