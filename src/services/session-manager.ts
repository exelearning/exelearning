/**
 * Session Manager Service for Elysia
 * Manages in-memory project sessions
 *
 * Uses dependency injection pattern for testability:
 * - createSessionManager() factory creates isolated instances
 * - Default export provides singleton for production use
 */
import { randomUUID } from 'crypto';

export interface ProjectSession {
    sessionId: string;
    odeId?: string;
    odeVersionId?: string;
    userId?: number;
    filePath?: string;
    fileName?: string;
    structure?: unknown;
    createdAt: Date;
    updatedAt: Date;
    metadata?: Record<string, unknown>;
}

export interface SessionManagerDeps {
    generateId?: () => string;
    now?: () => Date;
}

export interface SessionManager {
    generateSessionId: () => string;
    createSession: (data?: Partial<ProjectSession>) => ProjectSession;
    getSession: (sessionId: string) => ProjectSession | undefined;
    updateSession: (sessionId: string, data: Partial<ProjectSession>) => ProjectSession | undefined;
    deleteSession: (sessionId: string) => boolean;
    getAllSessions: () => ProjectSession[];
    getSessionsByUser: (userId: number) => ProjectSession[];
    hasSession: (sessionId: string) => boolean;
    clearAllSessions: () => void;
    getSessionCount: () => number;
    cleanupOldSessions: (maxAgeMs?: number) => number;
}

/**
 * Factory function to create a session manager instance
 * Each instance has its own isolated state (Map)
 */
export function createSessionManager(deps: SessionManagerDeps = {}): SessionManager {
    const { generateId = randomUUID, now = () => new Date() } = deps;

    // Internal state - isolated per instance
    const sessions = new Map<string, ProjectSession>();

    const generateSessionId = (): string => {
        return generateId();
    };

    const createSession = (data: Partial<ProjectSession> = {}): ProjectSession => {
        const sessionId = data.sessionId || generateSessionId();
        const currentTime = now();

        const session: ProjectSession = {
            sessionId,
            createdAt: currentTime,
            updatedAt: currentTime,
            ...data,
        };

        sessions.set(sessionId, session);
        return session;
    };

    const getSession = (sessionId: string): ProjectSession | undefined => {
        return sessions.get(sessionId);
    };

    const updateSession = (sessionId: string, data: Partial<ProjectSession>): ProjectSession | undefined => {
        const session = sessions.get(sessionId);
        if (!session) return undefined;

        const updated = {
            ...session,
            ...data,
            updatedAt: now(),
        };

        sessions.set(sessionId, updated);
        return updated;
    };

    const deleteSession = (sessionId: string): boolean => {
        return sessions.delete(sessionId);
    };

    const getAllSessions = (): ProjectSession[] => {
        return Array.from(sessions.values());
    };

    const getSessionsByUser = (userId: number): ProjectSession[] => {
        return Array.from(sessions.values()).filter(s => s.userId === userId);
    };

    const hasSession = (sessionId: string): boolean => {
        return sessions.has(sessionId);
    };

    const clearAllSessions = (): void => {
        sessions.clear();
    };

    const getSessionCount = (): number => {
        return sessions.size;
    };

    const cleanupOldSessions = (maxAgeMs: number = 24 * 60 * 60 * 1000): number => {
        const currentTime = Date.now();
        let cleaned = 0;

        for (const [sessionId, session] of sessions) {
            if (currentTime - session.updatedAt.getTime() > maxAgeMs) {
                sessions.delete(sessionId);
                cleaned++;
            }
        }

        return cleaned;
    };

    return {
        generateSessionId,
        createSession,
        getSession,
        updateSession,
        deleteSession,
        getAllSessions,
        getSessionsByUser,
        hasSession,
        clearAllSessions,
        getSessionCount,
        cleanupOldSessions,
    };
}

// Default singleton instance for production use
const defaultManager = createSessionManager();

// Re-export individual functions for backwards compatibility
export const generateSessionId = defaultManager.generateSessionId;
export const createSession = defaultManager.createSession;
export const getSession = defaultManager.getSession;
export const updateSession = defaultManager.updateSession;
export const deleteSession = defaultManager.deleteSession;
export const getAllSessions = defaultManager.getAllSessions;
export const getSessionsByUser = defaultManager.getSessionsByUser;
export const hasSession = defaultManager.hasSession;
export const clearAllSessions = defaultManager.clearAllSessions;
export const getSessionCount = defaultManager.getSessionCount;
export const cleanupOldSessions = defaultManager.cleanupOldSessions;
