export const AUDIT_EVENTS = {
    SESSION_STARTED: 'session:started',
    SESSION_ENDED: 'session:ended',
    TOOL_INVOKED: 'tool:invoked',
    TOOL_COMPLETED: 'tool:completed',
    TOOL_REJECTED: 'tool:rejected',
    PERMISSION_DENIED: 'permission:denied',
    VALIDATION_FAILURE: 'validation:failure',
    WRITE_PERFORMED: 'write:performed',
    REGISTRATION_STARTED: 'registration:started',
    REGISTRATION_COMPLETED: 'registration:completed',
    DISPOSAL: 'disposal',
};

export default class WebMCPAudit {
    constructor(options = {}) {
        this._logger = options.logger ?? null;
        this._maxHistory = options.maxHistory ?? 100;
        this._listeners = new Map();
        this._history = [];
    }

    on(eventType, callback) {
        if (!this._listeners.has(eventType)) {
            this._listeners.set(eventType, new Set());
        }
        this._listeners.get(eventType).add(callback);
        return () => {
            const set = this._listeners.get(eventType);
            if (set) {
                set.delete(callback);
            }
        };
    }

    emit(eventType, data = {}) {
        const entry = {
            eventType,
            timestamp: Date.now(),
            ...data,
        };

        this._history.unshift(entry);
        if (this._history.length > this._maxHistory) {
            this._history.length = this._maxHistory;
        }

        const listeners = this._listeners.get(eventType);
        if (listeners) {
            for (const cb of listeners) {
                cb(entry);
            }
        }

        if (this._logger) {
            this._logger.debug(`Audit event: ${eventType}`, data);
        }
    }

    getHistory(options = {}) {
        let result = this._history;
        if (options.eventType) {
            result = result.filter((e) => e.eventType === options.eventType);
        }
        if (options.limit && options.limit > 0) {
            result = result.slice(0, options.limit);
        }
        return result;
    }

    clearHistory() {
        this._history = [];
    }

    getSummary() {
        const byType = {};
        for (const entry of this._history) {
            byType[entry.eventType] = (byType[entry.eventType] ?? 0) + 1;
        }
        return {
            totalEvents: this._history.length,
            byType,
        };
    }
}
