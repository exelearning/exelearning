const LOG_PREFIX = '[WebMCP]';

export default class WebMCPLogger {
    constructor(options = {}) {
        this._debugOverride = options.debug ?? null;
        this._prefix = options.prefix ?? LOG_PREFIX;
    }

    isDebugEnabled() {
        if (this._debugOverride !== null) {
            return this._debugOverride;
        }
        return window.eXeLearning?.config?.webmcpDebug === true;
    }

    info(message, ...args) {
        console.info(`${this._prefix} ${message}`, ...args);
    }

    debug(message, ...args) {
        if (!this.isDebugEnabled()) {
            return;
        }
        console.debug(`${this._prefix} ${message}`, ...args);
    }

    warn(message, ...args) {
        console.warn(`${this._prefix} ${message}`, ...args);
    }

    error(message, ...args) {
        console.error(`${this._prefix} ${message}`, ...args);
    }

    logDetection(result) {
        this.info('Detection complete', result);
    }

    logFallbackLoad(event) {
        this.info('Fallback load', event);
    }

    logRegistration(event) {
        this.info('Registration', event);
    }

    logToolInvocation(event) {
        this.info('Tool invocation', event);
    }

    logPermission(event) {
        this.info('Permission', event);
    }

    logValidation(event) {
        this.info('Validation', event);
    }

    logDisposal(event) {
        this.info('Disposal', event);
    }
}
