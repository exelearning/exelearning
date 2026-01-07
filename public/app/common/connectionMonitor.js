/**
 * ConnectionMonitor
 * Monitors WebSocket connection state and displays toast notifications
 * for persistent connection failures.
 *
 * Features:
 * - Tracks consecutive connection failures
 * - Shows "Connection lost" toast after grace period (3 failures)
 * - Stops reconnection after max attempts (5 failures)
 * - Handles access revocation (401/403 close codes)
 *
 * Usage:
 *   const monitor = new ConnectionMonitor({
 *       wsProvider: documentManager.wsProvider,
 *       toastsManager: app.toasts,
 *       sessionMonitor: app.sessionMonitor,
 *   });
 *   monitor.start();
 */
export default class ConnectionMonitor {
    /**
     * @param {Object} options
     * @param {Object} options.wsProvider - y-websocket WebsocketProvider instance
     * @param {Object} options.toastsManager - Toast manager (app.toasts)
     * @param {Object} [options.sessionMonitor] - SessionMonitor instance (optional)
     * @param {number} [options.maxReconnectAttempts=5] - Max consecutive failures before giving up
     * @param {number} [options.graceFailures=2] - Failures to tolerate before showing toast (toast shown on graceFailures+1)
     */
    constructor(options = {}) {
        this.wsProvider = options.wsProvider;
        this.toastsManager = options.toastsManager;
        this.sessionMonitor = options.sessionMonitor || null;

        // Configuration
        this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
        this.graceFailures = options.graceFailures ?? 2;

        // State
        this.consecutiveFailures = 0;
        this.connectionLostToast = null;
        this.accessDeniedToast = null;
        this.isGivingUp = false;
        this.isConnected = false;
        this.started = false;

        // Bound handlers for cleanup
        this._boundHandleStatus = this._handleStatus.bind(this);
        this._boundHandleConnectionError = this._handleConnectionError.bind(this);
        this._boundHandleConnectionClose = this._handleConnectionClose.bind(this);
    }

    /**
     * Start monitoring the WebSocket connection
     */
    start() {
        if (this.started || !this.wsProvider) {
            return;
        }

        this.wsProvider.on('status', this._boundHandleStatus);
        this.wsProvider.on('connection-error', this._boundHandleConnectionError);
        this.wsProvider.on('connection-close', this._boundHandleConnectionClose);

        this.started = true;
        console.debug('[ConnectionMonitor] Started monitoring WebSocket connection');
    }

    /**
     * Stop monitoring and cleanup
     */
    stop() {
        if (!this.started || !this.wsProvider) {
            return;
        }

        // Note: y-websocket uses lib0/observable which has 'off' method
        try {
            this.wsProvider.off('status', this._boundHandleStatus);
            this.wsProvider.off('connection-error', this._boundHandleConnectionError);
            this.wsProvider.off('connection-close', this._boundHandleConnectionClose);
        } catch (error) {
            console.debug('[ConnectionMonitor] Error removing event listeners:', error);
        }

        this._dismissAllToasts();
        this.started = false;
        console.debug('[ConnectionMonitor] Stopped monitoring');
    }

    /**
     * Handle WebSocket status changes
     * @param {{ status: string }} param
     * @private
     */
    _handleStatus({ status }) {
        if (status === 'connected') {
            this._onConnected();
        } else if (status === 'disconnected') {
            this._onDisconnected();
        }
    }

    /**
     * Handle successful connection
     * @private
     */
    _onConnected() {
        console.debug('[ConnectionMonitor] Connected');
        this.isConnected = true;
        this.consecutiveFailures = 0;
        this.isGivingUp = false;
        this._dismissConnectionLostToast();
    }

    /**
     * Handle disconnection
     * @private
     */
    _onDisconnected() {
        console.debug('[ConnectionMonitor] Disconnected');
        this.isConnected = false;
        // Don't increment failures here - wait for connection-error
    }

    /**
     * Handle connection errors
     * @param {Event} event
     * @private
     */
    _handleConnectionError(event) {
        if (this.isGivingUp) {
            return;
        }

        this.consecutiveFailures++;
        console.warn(
            `[ConnectionMonitor] Connection error (attempt ${this.consecutiveFailures}/${this.maxReconnectAttempts})`
        );

        // Check if we should give up
        if (this.consecutiveFailures >= this.maxReconnectAttempts) {
            this._giveUp();
            return;
        }

        // Show toast after grace period
        if (this.consecutiveFailures > this.graceFailures && !this.connectionLostToast) {
            this._showConnectionLostToast(false);
        }

        // Notify SessionMonitor to check if session is still valid
        if (this.sessionMonitor?.handleYjsConnectionError) {
            this.sessionMonitor.handleYjsConnectionError(event);
        }
    }

    /**
     * Handle connection close events
     * @param {CloseEvent} event
     * @private
     */
    _handleConnectionClose(event) {
        // Check for access revocation (custom close codes)
        // 4001 = Unauthorized (invalid/expired token) - show toast
        // 4003 = Forbidden (access revoked) - redirect handled by AssetWebSocketHandler
        if (event?.code === 4001) {
            console.warn('[ConnectionMonitor] Unauthorized, code:', event.code);
            this._handleAccessRevoked();
            return;
        }

        // 4003 = Access revoked (visibility changed or collaborator removed)
        // Handle redirect to /access-denied page
        if (event?.code === 4003) {
            console.warn('[ConnectionMonitor] Access denied/revoked, code:', event.code);
            this._handleAccessDenied4003();
            return;
        }

        // Normal close - y-websocket will auto-reconnect
        console.debug('[ConnectionMonitor] Connection closed, code:', event?.code);
    }

    /**
     * Give up reconnecting after max attempts
     * @private
     */
    _giveUp() {
        if (this.isGivingUp) {
            return;
        }

        this.isGivingUp = true;
        console.error('[ConnectionMonitor] Giving up after max reconnection attempts');

        // Stop y-websocket from reconnecting
        if (this.wsProvider) {
            try {
                this.wsProvider.disconnect();
            } catch (error) {
                console.debug('[ConnectionMonitor] Error disconnecting wsProvider:', error);
            }
        }

        // Show persistent connection lost toast
        this._showConnectionLostToast(true);
    }

    /**
     * Handle access revocation (401/403)
     * @private
     */
    _handleAccessRevoked() {
        this.isGivingUp = true;

        // Stop reconnection attempts
        if (this.wsProvider) {
            try {
                this.wsProvider.disconnect();
            } catch (error) {
                console.debug('[ConnectionMonitor] Error disconnecting wsProvider:', error);
            }
        }

        // Show access denied toast
        this._showAccessDeniedToast();
    }

    /**
     * Handle access denied with code 4003 (project visibility changed or collaborator removed)
     * Stops reconnection and redirects to access-denied page
     * @private
     */
    _handleAccessDenied4003() {
        this.isGivingUp = true;

        // Stop reconnection attempts
        if (this.wsProvider) {
            try {
                // Prevent y-websocket from auto-reconnecting
                this.wsProvider.shouldConnect = false;
                this.wsProvider.disconnect();
            } catch (error) {
                console.debug('[ConnectionMonitor] Error disconnecting wsProvider:', error);
            }
        }

        // Redirect to access-denied page
        const basePath = window.eXeLearning?.config?.basePath || '';
        const accessDeniedUrl = `${basePath}/access-denied`;

        console.warn('[ConnectionMonitor] Redirecting to access-denied page:', accessDeniedUrl);

        // Small delay to ensure disconnect completes
        setTimeout(() => {
            window.location.href = accessDeniedUrl;
        }, 100);
    }

    /**
     * Show the "Connection lost" toast
     * @param {boolean} permanent - If true, show "Please refresh..." message
     * @private
     */
    _showConnectionLostToast(permanent = false) {
        if (this.connectionLostToast) {
            // Update existing toast if transitioning to permanent
            if (permanent && this.connectionLostToast.toastBody) {
                this.connectionLostToast.toastBody.innerHTML =
                    'Please refresh the page to try to reconnect to the server...';
            }
            return;
        }

        if (!this.toastsManager) {
            console.warn('[ConnectionMonitor] No toastsManager available');
            return;
        }

        const message = permanent
            ? _('Please refresh the page to try to reconnect to the server...')
            : _('Attempting to reconnect...');

        this.connectionLostToast = this.toastsManager.createToast({
            icon: 'warning',
            title: _('Connection lost'),
            body: message,
            error: true,
            // NO 'remove' = persistent toast
        });

        console.debug('[ConnectionMonitor] Showing connection lost toast, permanent:', permanent);
    }

    /**
     * Show the "Access denied" toast
     * @private
     */
    _showAccessDeniedToast() {
        if (this.accessDeniedToast) {
            return;
        }

        if (!this.toastsManager) {
            console.warn('[ConnectionMonitor] No toastsManager available');
            return;
        }

        this.accessDeniedToast = this.toastsManager.createToast({
            icon: 'error',
            title: _('Access denied'),
            body: _('Your access to this project has been revoked.'),
            error: true,
            // NO 'remove' = persistent toast
        });

        console.debug('[ConnectionMonitor] Showing access denied toast');
    }

    /**
     * Dismiss the connection lost toast
     * @private
     */
    _dismissConnectionLostToast() {
        if (this.connectionLostToast) {
            try {
                this.connectionLostToast.remove();
            } catch (error) {
                console.debug('[ConnectionMonitor] Error removing toast:', error);
            }
            this.connectionLostToast = null;
        }
    }

    /**
     * Dismiss all toasts
     * @private
     */
    _dismissAllToasts() {
        this._dismissConnectionLostToast();

        if (this.accessDeniedToast) {
            try {
                this.accessDeniedToast.remove();
            } catch (error) {
                console.debug('[ConnectionMonitor] Error removing toast:', error);
            }
            this.accessDeniedToast = null;
        }
    }

    /**
     * Destroy the monitor and cleanup resources
     */
    destroy() {
        this.stop();
        this.wsProvider = null;
        this.toastsManager = null;
        this.sessionMonitor = null;
        console.debug('[ConnectionMonitor] Destroyed');
    }

    /**
     * Get current state (for debugging/testing)
     * @returns {{ consecutiveFailures: number, isGivingUp: boolean, isConnected: boolean }}
     */
    getState() {
        return {
            consecutiveFailures: this.consecutiveFailures,
            isGivingUp: this.isGivingUp,
            isConnected: this.isConnected,
            hasConnectionLostToast: !!this.connectionLostToast,
            hasAccessDeniedToast: !!this.accessDeniedToast,
        };
    }
}

// Export for module usage and make available globally
if (typeof window !== 'undefined') {
    window.ConnectionMonitor = ConnectionMonitor;
}
