/**
 * Periodically checks the backend session status and reacts when it expires.
 */
export default class SessionMonitor {
    /**
     * @param {Object} options
     * @param {string} options.checkUrl - Endpoint to verify the session state.
     * @param {string} options.loginUrl - URL where the user should be redirected when the session is invalid.
     * @param {number} [options.interval=60000] - Interval in milliseconds between checks.
     * @param {Function} [options.closeMercureConnections] - Callback to close Mercure/EventSource connections.
     * @param {Function} [options.onSessionInvalid] - Callback executed before redirecting the user.
     * @param {Function} [options.onNetworkError] - Callback executed when the fetch fails (optional).
     * @param {Function} [options.onRedirect] - Custom redirect handler.
     * @param {RequestInit} [options.fetchOptions] - Extra fetch configuration.
     */
    constructor(options = {}) {
        this.checkUrl = options.checkUrl || '';
        this.loginUrl = options.loginUrl || '/login';
        const interval = Number(options.interval) || 60000;
        this.interval = Math.max(10000, interval);
        this.closeMercureConnections =
            options.closeMercureConnections || (() => {});
        this.onSessionInvalid = options.onSessionInvalid || (() => {});
        this.onNetworkError = options.onNetworkError || null;
        this.onRedirect = options.onRedirect || ((url) => {
            window.location.assign(url);
        });
        this.fetchOptions = options.fetchOptions || {};

        this.timerId = null;
        this.pendingCheck = false;
        this.invalidated = false;
    }

    /**
     * Starts the interval that checks the session state.
     */
    start() {
        if (this.timerId !== null || !this.checkUrl) {
            return;
        }

        this.timerId = window.setInterval(
            () => this.checkSession('interval'),
            this.interval
        );

        // Run an initial check immediately.
        this.checkSession('initial');
    }

    /**
     * Stops the interval.
     */
    stop() {
        if (this.timerId !== null) {
            window.clearInterval(this.timerId);
            this.timerId = null;
        }
    }

    /**
     * Forces a session check outside the scheduled interval.
     * @param {string} [reason='manual']
     */
    triggerImmediateCheck(reason = 'manual') {
        this.checkSession(reason);
    }

    /**
     * Handles Mercure/EventSource errors.
     * @param {Event|Error} error
     */
    handleMercureError(error) {
        if (this.invalidated) {
            return;
        }

        const status = error?.status || error?.detail?.status;
        if (status === 401 || status === 403) {
            this.handleInvalidSession('mercure-unauthorized');
            return;
        }

        const target = error?.currentTarget || error?.target;
        if (target && typeof target.readyState === 'number') {
            // EventSource.CLOSED === 2. This typically happens on auth errors.
            if (target.readyState === 2) {
                this.triggerImmediateCheck('mercure-closed');
                return;
            }
        }

        // Fallback: perform a manual re-check to confirm the session is still valid.
        this.triggerImmediateCheck('mercure-error');
    }

    /**
     * Performs the actual fetch to verify the session.
     * @param {string} reason
     */
    async checkSession(reason) {
        if (this.invalidated || this.pendingCheck || !this.checkUrl) {
            return;
        }

        this.pendingCheck = true;

        const headers = {
            Accept: 'application/json',
        };
        if (this.fetchOptions.headers) {
            Object.assign(headers, this.fetchOptions.headers);
        }

        const requestInit = {
            method: 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            ...this.fetchOptions,
            headers,
        };

        try {
            const response = await fetch(this.checkUrl, requestInit);

            if (response.status === 401 || response.status === 403) {
                this.handleInvalidSession('unauthorized');
                return;
            }

            if (!response.ok) {
                console.debug(
                    'SessionMonitor: unexpected status while checking the session',
                    response.status
                );
                return;
            }

            let payload = null;
            const contentType = response.headers.get('Content-Type') || '';
            if (contentType.includes('application/json')) {
                payload = await response.json();
            } else {
                try {
                    payload = await response.json();
                } catch (_error) {
                    payload = null;
                }
            }

            if (!payload || payload.authenticated !== true) {
                this.handleInvalidSession('session-check');
            }
        } catch (error) {
            if (this.onNetworkError) {
                try {
                    this.onNetworkError(error, reason);
                } catch (callbackError) {
                    console.debug(
                        'SessionMonitor: error while executing network error callback',
                        callbackError
                    );
                }
            } else {
                console.debug('SessionMonitor: network error', error);
            }
        } finally {
            this.pendingCheck = false;
        }
    }

    /**
     * Called when the session is no longer valid.
     * @param {string} reason
     */
    handleInvalidSession(reason) {
        if (this.invalidated) {
            return;
        }
        this.invalidated = true;
        this.stop();

        try {
            this.closeMercureConnections?.(reason);
        } catch (error) {
            console.debug(
                'SessionMonitor: error while closing Mercure connections',
                error
            );
        }

        try {
            this.onSessionInvalid?.(reason);
        } catch (error) {
            console.debug(
                'SessionMonitor: error while executing the invalid session callback',
                error
            );
        }

        try {
            window.onbeforeunload = null;
        } catch (_error) {
            // Ignore failures restoring beforeunload handler.
        }

        try {
            this.onRedirect?.(this.loginUrl, reason);
        } catch (error) {
            console.error('SessionMonitor: redirect handler failed', error);
        }
    }
}
