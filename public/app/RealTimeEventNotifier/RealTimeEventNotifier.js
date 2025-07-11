export default class RealTimeEventNotifier {
    retryCount = 0;
    eventSource = null;
    lastEventID = null;

    constructor(url, jwtToken) {
        this.mercureUrl = url;
        this.jwtToken = jwtToken;
    }

    /**
     * @returns {string} RFC-4122 v4 UUID
     * Generates a UUID using crypto.randomUUID() if available.
     * Falls back to a manual implementation for environments (e.g., some Chromium versions used with Selenium)
     * where crypto.randomUUID is not supported.
     */
    static generateUUID() {
        if (
            typeof crypto !== 'undefined' &&
            typeof crypto.randomUUID === 'function'
        ) {
            return crypto.randomUUID();
        }
        // Minimal polyfill using crypto.getRandomValues (generates 128-bit UUID)
        const a = crypto.getRandomValues(new Uint8Array(16));
        a[6] = (a[6] & 0x0f) | 0x40;
        a[8] = (a[8] & 0x3f) | 0x80;
        return [...a]
            .map(
                (b, i) =>
                    (i === 4 || i === 6 || i === 8 || i === 10 ? '-' : '') +
                    b.toString(16).padStart(2, '0')
            )
            .join('');
    }

    notify(sessionId, jsonMessage) {
        let data = new URLSearchParams();
        data.append('topic', sessionId);
        data.append('data', JSON.stringify(jsonMessage));
        data.append('id', RealTimeEventNotifier.generateUUID());

        let body = data.toString();
        console.info('RealTimeEventNotifier.notify() body: ', body);

        fetch(this.mercureUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.jwtToken}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body,
        })
            .then((response) => {
                if (response.ok) {
                    this.resetRetryCount();
                } else {
                    console.error('Error when notifying:', response.statusText);
                }
            })
            .catch((error) => {
                console.error('Error in notify request:', error);
            });
    }

    getSubscription(sessionId) {
        const that = this;
        const url = new URL(this.mercureUrl);
        if (this.eventSource) {
            this.eventSource.close();
        }
        url.searchParams.append('topic', sessionId);
        url.searchParams.append('authorization', this.jwtToken);
        if (this.lastEventID) {
            url.searchParams.append('lastEventID', this.lastEventID);
        }
        console.info('get subscription to url:', url);

        this.eventSource = new EventSource(url);

        this.eventSource.onopen = function () {
            console.info('Conexión establecida con Mercure');
        };
        let connectionLostShown = false;
        // Manejar errores
        this.eventSource.onerror = function (error) {
            console.info('Error en la conexión a Mercure:', error);
            that.retryCount++;
            if (that.retryCount < 10) {
                console.info(`Automatic reconnection #${that.retryCount}`);
            } else {
                console.error('Mercure connection lost:', error);
                if (!connectionLostShown) {
                    window.onbeforeunload = () => undefined;
                    that.showConnectionLostMessage(sessionId);
                    connectionLostShown = true;
                }
            }
        };

        return this.eventSource;
    }

    resetRetryCount() {
        if (this.retryCount != 0) {
            console.info(`Resetting the retry counter (${this.retryCount})`);
            this.retryCount = 0;
        } else {
            console.info(
                `Unneeded call to resetRetryCount(). Actual is (${this.retryCount})`
            );
        }
    }
    setLastEventID(messageId) {
        this.lastEventID = messageId;
    }

    showConnectionLostMessage() {
        let toastData = {
            title: _('Connection lost'),
            body: _(
                'Please refresh the page to try to reconnect to the server...'
            ),
            icon: 'warning',
        };
        eXeLearning.app.toasts.createToast(toastData);
    }
}
