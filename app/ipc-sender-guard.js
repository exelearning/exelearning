/**
 * Which renderer frames may call the main process.
 *
 * The preload — and with it `ipcRenderer` — is injected only into the main frame of the
 * windows this app creates, so by DOM rules a preview iframe never holds the bridge. The
 * guard closes the remaining path: a compromised renderer process can still address IPC
 * channels directly, and the enabled preview (`preview://`, ADR on the preview trust
 * boundary) runs author code in that process family. Every handler therefore refuses an
 * event whose sender is not the main frame of a window loaded from the app's own origin.
 *
 * Pure module: no Electron import, so it is unit-tested with plain objects.
 */

const DEFAULT_TRUSTED_ORIGINS = Object.freeze(['app://localhost']);

/**
 * Whether the frame that sent an IPC event is one the app loaded itself.
 *
 * @param {{ sender?: { mainFrame?: unknown } | null, senderFrame?: { url?: string } | null }} event
 * @param {{ trustedOrigins?: readonly string[] }} [options]
 * @returns {boolean}
 */
function isTrustedSender(event, { trustedOrigins = DEFAULT_TRUSTED_ORIGINS } = {}) {
    const frame = event?.senderFrame;
    const sender = event?.sender;
    if (!frame || !sender) return false;
    // Only the window's own top document carries the preload; a subframe never does, and
    // a message claiming to come from one is not ours.
    if (sender.mainFrame && frame !== sender.mainFrame) return false;
    if (typeof frame.url !== 'string') return false;
    let origin;
    try {
        // Not `URL#origin`: the WHATWG parser answers "null" for every non-special scheme,
        // and `app:` is one. Scheme plus host is the origin the browser enforces for a
        // `standard` custom scheme.
        const url = new URL(frame.url);
        origin = `${url.protocol}//${url.host}`;
    } catch {
        return false;
    }
    return trustedOrigins.includes(origin);
}

/**
 * Wrap `ipcMain` so every registered handler checks the sender first.
 *
 * `handle` rejects the invocation (the renderer's promise rejects); `on` drops the message.
 * The returned object has the same `handle`/`on` shape, so modules that take `ipcMain` as a
 * parameter can be handed the guarded one unchanged.
 *
 * @param {{ handle: Function, on: Function }} ipcMain
 * @param {{ isTrusted?: (event: unknown) => boolean, log?: (message: string) => void }} [options]
 */
function guardIpcMain(ipcMain, { isTrusted = isTrustedSender, log = console.warn } = {}) {
    const refuse = (channel, event) => {
        const from = event?.senderFrame?.url ?? '(no frame)';
        log(`[ipc] Rejected "${channel}" from an untrusted frame: ${from}`);
    };
    return {
        handle(channel, listener) {
            ipcMain.handle(channel, (event, ...args) => {
                if (!isTrusted(event)) {
                    refuse(channel, event);
                    throw new Error(`IPC channel "${channel}" is not available to this frame`);
                }
                return listener(event, ...args);
            });
        },
        on(channel, listener) {
            ipcMain.on(channel, (event, ...args) => {
                if (!isTrusted(event)) {
                    refuse(channel, event);
                    return;
                }
                listener(event, ...args);
            });
        },
        /**
         * Like `ipcMain.once`, but an untrusted message does not consume the registration:
         * the one trusted reply the caller is waiting for still arrives.
         */
        once(channel, listener) {
            const wrapped = (event, ...args) => {
                if (!isTrusted(event)) {
                    refuse(channel, event);
                    return;
                }
                ipcMain.removeListener(channel, wrapped);
                listener(event, ...args);
            };
            ipcMain.on(channel, wrapped);
        },
    };
}

module.exports = { DEFAULT_TRUSTED_ORIGINS, isTrustedSender, guardIpcMain };
