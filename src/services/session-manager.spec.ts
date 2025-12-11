/**
 * Session Manager Tests
 * Tests for in-memory session management using dependency injection
 *
 * Pattern: Each test creates its own isolated SessionManager instance
 * No mock.module() needed - tests are fully isolated
 */
import { describe, it, expect, beforeEach } from 'bun:test';
import { createSessionManager, type SessionManager } from './session-manager';

describe('Session Manager', () => {
    let manager: SessionManager;
    let idCounter: number;

    beforeEach(() => {
        idCounter = 0;
        // Create fresh instance for each test - complete isolation
        manager = createSessionManager({
            generateId: () => `test-session-${++idCounter}`,
        });
    });

    describe('generateSessionId', () => {
        it('should generate unique IDs', () => {
            const id1 = manager.generateSessionId();
            const id2 = manager.generateSessionId();
            const id3 = manager.generateSessionId();

            expect(id1).toBe('test-session-1');
            expect(id2).toBe('test-session-2');
            expect(id3).toBe('test-session-3');
            expect(id1).not.toBe(id2);
            expect(id2).not.toBe(id3);
        });

        it('should use real UUID when no custom generator', () => {
            const realManager = createSessionManager();
            const id = realManager.generateSessionId();

            // UUID v4 format
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        });
    });

    describe('createSession', () => {
        it('should create session with default values', () => {
            const session = manager.createSession();

            expect(session.sessionId).toBe('test-session-1');
            expect(session.createdAt).toBeInstanceOf(Date);
            expect(session.updatedAt).toBeInstanceOf(Date);
        });

        it('should create session with custom session ID', () => {
            const session = manager.createSession({ sessionId: 'custom-id' });

            expect(session.sessionId).toBe('custom-id');
        });

        it('should create session with all optional fields', () => {
            const session = manager.createSession({
                fileName: 'test.elp',
                filePath: '/path/to/file',
                odeId: 'ode-123',
                odeVersionId: 'v1',
                userId: 42,
                structure: { pages: [] },
                metadata: { custom: 'value' },
            });

            expect(session.fileName).toBe('test.elp');
            expect(session.filePath).toBe('/path/to/file');
            expect(session.odeId).toBe('ode-123');
            expect(session.odeVersionId).toBe('v1');
            expect(session.userId).toBe(42);
            expect(session.structure).toEqual({ pages: [] });
            expect(session.metadata).toEqual({ custom: 'value' });
        });

        it('should increment session count', () => {
            expect(manager.getSessionCount()).toBe(0);
            manager.createSession();
            expect(manager.getSessionCount()).toBe(1);
            manager.createSession();
            expect(manager.getSessionCount()).toBe(2);
        });
    });

    describe('getSession', () => {
        it('should return existing session', () => {
            const created = manager.createSession({ fileName: 'test.elp' });
            const retrieved = manager.getSession(created.sessionId);

            expect(retrieved).toBeDefined();
            expect(retrieved?.sessionId).toBe(created.sessionId);
            expect(retrieved?.fileName).toBe('test.elp');
        });

        it('should return undefined for non-existent session', () => {
            const session = manager.getSession('non-existent-id');
            expect(session).toBeUndefined();
        });
    });

    describe('updateSession', () => {
        it('should update session properties', () => {
            const session = manager.createSession({ fileName: 'old.elp' });
            const originalUpdatedAt = session.updatedAt;

            // Small delay to ensure timestamp changes
            const updated = manager.updateSession(session.sessionId, {
                fileName: 'new.elp',
            });

            expect(updated?.fileName).toBe('new.elp');
            expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
        });

        it('should return undefined for non-existent session', () => {
            const result = manager.updateSession('non-existent', { fileName: 'test.elp' });
            expect(result).toBeUndefined();
        });

        it('should preserve other properties when updating', () => {
            const session = manager.createSession({
                fileName: 'test.elp',
                userId: 42,
            });

            manager.updateSession(session.sessionId, { fileName: 'updated.elp' });
            const retrieved = manager.getSession(session.sessionId);

            expect(retrieved?.userId).toBe(42);
            expect(retrieved?.fileName).toBe('updated.elp');
        });
    });

    describe('deleteSession', () => {
        it('should delete existing session', () => {
            const session = manager.createSession();

            expect(manager.hasSession(session.sessionId)).toBe(true);
            const result = manager.deleteSession(session.sessionId);
            expect(result).toBe(true);
            expect(manager.hasSession(session.sessionId)).toBe(false);
        });

        it('should return false for non-existent session', () => {
            const result = manager.deleteSession('non-existent');
            expect(result).toBe(false);
        });
    });

    describe('getAllSessions', () => {
        it('should return empty array when no sessions', () => {
            const sessions = manager.getAllSessions();
            expect(sessions).toEqual([]);
        });

        it('should return all sessions', () => {
            manager.createSession({ fileName: 'file1.elp' });
            manager.createSession({ fileName: 'file2.elp' });
            manager.createSession({ fileName: 'file3.elp' });

            const sessions = manager.getAllSessions();
            expect(sessions).toHaveLength(3);
        });
    });

    describe('getSessionsByUser', () => {
        it('should return sessions for specific user', () => {
            manager.createSession({ userId: 1, fileName: 'user1-file1.elp' });
            manager.createSession({ userId: 1, fileName: 'user1-file2.elp' });
            manager.createSession({ userId: 2, fileName: 'user2-file.elp' });

            const user1Sessions = manager.getSessionsByUser(1);
            expect(user1Sessions).toHaveLength(2);
            expect(user1Sessions.every(s => s.userId === 1)).toBe(true);
        });

        it('should return empty array for user with no sessions', () => {
            manager.createSession({ userId: 1 });
            const sessions = manager.getSessionsByUser(999);
            expect(sessions).toEqual([]);
        });
    });

    describe('hasSession', () => {
        it('should return true for existing session', () => {
            const session = manager.createSession();
            expect(manager.hasSession(session.sessionId)).toBe(true);
        });

        it('should return false for non-existent session', () => {
            expect(manager.hasSession('non-existent')).toBe(false);
        });
    });

    describe('clearAllSessions', () => {
        it('should remove all sessions', () => {
            manager.createSession();
            manager.createSession();
            manager.createSession();

            expect(manager.getSessionCount()).toBe(3);

            manager.clearAllSessions();

            expect(manager.getSessionCount()).toBe(0);
            expect(manager.getAllSessions()).toEqual([]);
        });
    });

    describe('getSessionCount', () => {
        it('should return correct count', () => {
            expect(manager.getSessionCount()).toBe(0);

            manager.createSession();
            expect(manager.getSessionCount()).toBe(1);

            manager.createSession();
            expect(manager.getSessionCount()).toBe(2);

            manager.deleteSession('test-session-1');
            expect(manager.getSessionCount()).toBe(1);
        });
    });

    describe('cleanupOldSessions', () => {
        it('should remove sessions older than maxAge', () => {
            // Create old session by manipulating updatedAt directly
            const oldSession = manager.createSession({ fileName: 'old.elp' });
            const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
            manager.updateSession(oldSession.sessionId, {});
            // Force old date
            const session = manager.getSession(oldSession.sessionId);
            if (session) {
                session.updatedAt = oldDate;
            }

            // Create a new session
            manager.createSession({ fileName: 'new.elp' });

            expect(manager.getSessionCount()).toBe(2);

            // Cleanup with 1 day maxAge
            const cleaned = manager.cleanupOldSessions(24 * 60 * 60 * 1000);

            expect(cleaned).toBe(1);
            expect(manager.getSessionCount()).toBe(1);
            expect(manager.getAllSessions()[0].fileName).toBe('new.elp');
        });

        it('should use default maxAge of 24 hours', () => {
            const session = manager.createSession();
            // Force old date (25 hours ago)
            const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
            const retrieved = manager.getSession(session.sessionId);
            if (retrieved) {
                retrieved.updatedAt = oldDate;
            }

            const cleaned = manager.cleanupOldSessions();
            expect(cleaned).toBe(1);
        });

        it('should not remove recent sessions', () => {
            manager.createSession({ fileName: 'recent.elp' });
            const cleaned = manager.cleanupOldSessions();

            expect(cleaned).toBe(0);
            expect(manager.getSessionCount()).toBe(1);
        });
    });

    describe('isolation', () => {
        it('should have isolated state between instances', () => {
            const manager1 = createSessionManager();
            const manager2 = createSessionManager();

            manager1.createSession({ fileName: 'manager1.elp' });
            manager1.createSession({ fileName: 'manager1-2.elp' });

            manager2.createSession({ fileName: 'manager2.elp' });

            expect(manager1.getSessionCount()).toBe(2);
            expect(manager2.getSessionCount()).toBe(1);

            manager1.clearAllSessions();

            expect(manager1.getSessionCount()).toBe(0);
            expect(manager2.getSessionCount()).toBe(1); // Not affected
        });
    });
});
