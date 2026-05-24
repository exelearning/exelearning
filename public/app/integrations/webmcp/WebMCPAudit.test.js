import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebMCPAudit, { AUDIT_EVENTS } from './WebMCPAudit.js';
import WebMCPLogger from './WebMCPLogger.js';

describe('WebMCPAudit', () => {
    let audit;

    beforeEach(() => {
        audit = new WebMCPAudit();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('AUDIT_EVENTS constants', () => {
        it('exports all expected event type constants', () => {
            expect(AUDIT_EVENTS.SESSION_STARTED).toBe('session:started');
            expect(AUDIT_EVENTS.SESSION_ENDED).toBe('session:ended');
            expect(AUDIT_EVENTS.TOOL_INVOKED).toBe('tool:invoked');
            expect(AUDIT_EVENTS.TOOL_COMPLETED).toBe('tool:completed');
            expect(AUDIT_EVENTS.TOOL_REJECTED).toBe('tool:rejected');
            expect(AUDIT_EVENTS.PERMISSION_DENIED).toBe('permission:denied');
            expect(AUDIT_EVENTS.VALIDATION_FAILURE).toBe('validation:failure');
            expect(AUDIT_EVENTS.WRITE_PERFORMED).toBe('write:performed');
            expect(AUDIT_EVENTS.REGISTRATION_STARTED).toBe('registration:started');
            expect(AUDIT_EVENTS.REGISTRATION_COMPLETED).toBe('registration:completed');
            expect(AUDIT_EVENTS.DISPOSAL).toBe('disposal');
        });
    });

    describe('event subscription and emission', () => {
        it('calls registered listener when matching event is emitted', () => {
            const cb = vi.fn();
            audit.on(AUDIT_EVENTS.TOOL_INVOKED, cb);
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, { tool: 'exe.pages.create' });
            expect(cb).toHaveBeenCalledTimes(1);
            expect(cb.mock.calls[0][0]).toMatchObject({ tool: 'exe.pages.create' });
        });

        it('does not call listener for a different event type', () => {
            const cb = vi.fn();
            audit.on(AUDIT_EVENTS.SESSION_STARTED, cb);
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, {});
            expect(cb).not.toHaveBeenCalled();
        });

        it('calls multiple listeners registered for the same event', () => {
            const cb1 = vi.fn();
            const cb2 = vi.fn();
            audit.on(AUDIT_EVENTS.SESSION_STARTED, cb1);
            audit.on(AUDIT_EVENTS.SESSION_STARTED, cb2);
            audit.emit(AUDIT_EVENTS.SESSION_STARTED, {});
            expect(cb1).toHaveBeenCalledTimes(1);
            expect(cb2).toHaveBeenCalledTimes(1);
        });

        it('emitted entry includes a numeric timestamp', () => {
            const cb = vi.fn();
            audit.on(AUDIT_EVENTS.TOOL_INVOKED, cb);
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, { tool: 'test' });
            const entry = cb.mock.calls[0][0];
            expect(typeof entry.timestamp).toBe('number');
            expect(entry.timestamp).toBeGreaterThan(0);
        });

        it('emitted entry includes the eventType field', () => {
            const cb = vi.fn();
            audit.on(AUDIT_EVENTS.TOOL_COMPLETED, cb);
            audit.emit(AUDIT_EVENTS.TOOL_COMPLETED, {});
            expect(cb.mock.calls[0][0].eventType).toBe(AUDIT_EVENTS.TOOL_COMPLETED);
        });
    });

    describe('unsubscribe', () => {
        it('stops calling listener after unsubscribe is called', () => {
            const cb = vi.fn();
            const unsubscribe = audit.on(AUDIT_EVENTS.TOOL_INVOKED, cb);
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, {});
            unsubscribe();
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, {});
            expect(cb).toHaveBeenCalledTimes(1);
        });

        it('unsubscribing one listener does not affect others for the same event', () => {
            const cb1 = vi.fn();
            const cb2 = vi.fn();
            const unsubscribe1 = audit.on(AUDIT_EVENTS.SESSION_STARTED, cb1);
            audit.on(AUDIT_EVENTS.SESSION_STARTED, cb2);
            unsubscribe1();
            audit.emit(AUDIT_EVENTS.SESSION_STARTED, {});
            expect(cb1).not.toHaveBeenCalled();
            expect(cb2).toHaveBeenCalledTimes(1);
        });
    });

    describe('history', () => {
        it('stores emitted events in history most-recent-first', () => {
            audit.emit(AUDIT_EVENTS.SESSION_STARTED, { idx: 0 });
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, { idx: 1 });
            const history = audit.getHistory();
            expect(history[0].eventType).toBe(AUDIT_EVENTS.TOOL_INVOKED);
            expect(history[1].eventType).toBe(AUDIT_EVENTS.SESSION_STARTED);
        });

        it('caps history at maxHistory entries', () => {
            const small = new WebMCPAudit({ maxHistory: 3 });
            for (let i = 0; i < 5; i++) {
                small.emit(AUDIT_EVENTS.TOOL_INVOKED, { i });
            }
            expect(small.getHistory().length).toBe(3);
        });

        it('default maxHistory is 100', () => {
            const defaultAudit = new WebMCPAudit();
            for (let i = 0; i < 110; i++) {
                defaultAudit.emit(AUDIT_EVENTS.TOOL_INVOKED, { i });
            }
            expect(defaultAudit.getHistory().length).toBe(100);
        });

        it('clears history with clearHistory()', () => {
            audit.emit(AUDIT_EVENTS.SESSION_STARTED, {});
            audit.clearHistory();
            expect(audit.getHistory().length).toBe(0);
        });
    });

    describe('getHistory filtering', () => {
        beforeEach(() => {
            audit.emit(AUDIT_EVENTS.SESSION_STARTED, {});
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, { tool: 'a' });
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, { tool: 'b' });
            audit.emit(AUDIT_EVENTS.TOOL_COMPLETED, {});
        });

        it('filters by eventType', () => {
            const result = audit.getHistory({ eventType: AUDIT_EVENTS.TOOL_INVOKED });
            expect(result.length).toBe(2);
            expect(result.every((e) => e.eventType === AUDIT_EVENTS.TOOL_INVOKED)).toBe(true);
        });

        it('limits results with options.limit', () => {
            const result = audit.getHistory({ limit: 2 });
            expect(result.length).toBe(2);
        });

        it('combines eventType filter and limit', () => {
            const result = audit.getHistory({ eventType: AUDIT_EVENTS.TOOL_INVOKED, limit: 1 });
            expect(result.length).toBe(1);
            expect(result[0].eventType).toBe(AUDIT_EVENTS.TOOL_INVOKED);
        });

        it('returns all entries when no options are given', () => {
            expect(audit.getHistory().length).toBe(4);
        });
    });

    describe('getSummary', () => {
        it('returns totalEvents count', () => {
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, {});
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, {});
            audit.emit(AUDIT_EVENTS.SESSION_STARTED, {});
            const summary = audit.getSummary();
            expect(summary.totalEvents).toBe(3);
        });

        it('counts events by type in byType map', () => {
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, {});
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, {});
            audit.emit(AUDIT_EVENTS.PERMISSION_DENIED, {});
            const summary = audit.getSummary();
            expect(summary.byType[AUDIT_EVENTS.TOOL_INVOKED]).toBe(2);
            expect(summary.byType[AUDIT_EVENTS.PERMISSION_DENIED]).toBe(1);
        });

        it('returns zero totalEvents when history is empty', () => {
            const summary = audit.getSummary();
            expect(summary.totalEvents).toBe(0);
            expect(summary.byType).toEqual({});
        });

        it('byType reflects cleared history after clearHistory()', () => {
            audit.emit(AUDIT_EVENTS.TOOL_INVOKED, {});
            audit.clearHistory();
            const summary = audit.getSummary();
            expect(summary.totalEvents).toBe(0);
        });
    });

    describe('logger integration', () => {
        it('calls logger.debug when a logger is provided', () => {
            window.eXeLearning = { config: { webmcpDebug: true } };
            vi.spyOn(console, 'debug').mockImplementation(() => {});
            const logger = new WebMCPLogger({ debug: true });
            const auditWithLogger = new WebMCPAudit({ logger });
            auditWithLogger.emit(AUDIT_EVENTS.TOOL_INVOKED, { tool: 'test' });
            expect(console.debug).toHaveBeenCalled();
            delete window.eXeLearning;
        });

        it('does not throw when no logger is provided', () => {
            const auditNoLogger = new WebMCPAudit();
            expect(() => auditNoLogger.emit(AUDIT_EVENTS.SESSION_STARTED, {})).not.toThrow();
        });

        it('logger.debug receives the event type and data', () => {
            const logger = { debug: vi.fn() };
            const auditWithLogger = new WebMCPAudit({ logger });
            auditWithLogger.emit(AUDIT_EVENTS.WRITE_PERFORMED, { tool: 'exe.project.save' });
            expect(logger.debug).toHaveBeenCalledWith(
                `Audit event: ${AUDIT_EVENTS.WRITE_PERFORMED}`,
                { tool: 'exe.project.save' },
            );
        });
    });
});
