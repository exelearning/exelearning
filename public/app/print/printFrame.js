import { printPreviewSnapshot } from '../workarea/modals/modals/pages/printPreviewSnapshot.js';

/** Runs inside the sandbox. Only the embedding window can request these operations. */
export function bindPrintFrame(token, host = window) {
    const reply = (id, type, value, error) => host.parent.postMessage({ channel: 'exe-print', token, id, type, value, error }, '*');
    let printId = null;
    const started = () => {
        if (printId !== null) reply(printId, 'started');
        printId = null;
    };
    const receive = async (event) => {
        const data = event.data;
        if (event.source !== host.parent || !data || data.channel !== 'exe-print' || data.token !== token) return;
        if (data.type === 'options') {
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
    host.addEventListener('message', receive);
    host.addEventListener('beforeprint', started);
    const ready = async () => {
        try {
            await host.document.fonts?.ready;
            await host.MathJax?.startup?.promise;
            await Promise.all([...host.document.images].map(image => image.decode?.().catch(() => {}) ));
            reply(0, 'ready');
        } catch (error) { reply(0, 'ready', null, String(error)); }
    };
    if (host.document.readyState === 'complete') ready();
    else host.addEventListener('load', ready, { once: true });
    return () => {
        host.removeEventListener('message', receive);
        host.removeEventListener('beforeprint', started);
        host.removeEventListener('load', ready);
    };
}

const token = document.currentScript?.dataset.printToken;
if (token) bindPrintFrame(token);
