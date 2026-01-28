/**
 * Upload Session Manager
 *
 * Manages upload sessions for optimized batch uploads.
 * Sessions provide:
 * - Stateless JWT tokens for fast validation (no DB lookup)
 * - Mapping to WebSocket connections for progress updates
 * - Session expiration handling
 *
 * This enables the client to:
 * 1. Create session via WebSocket (get token)
 * 2. Upload files via HTTP with session token (no auth overhead)
 * 3. Receive real-time progress via WebSocket
 */
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

/**
 * Upload session JWT payload
 */
export interface UploadSessionPayload extends JWTPayload {
    sessionId: string;
    projectId: string;
    projectIdNum: number;
    userId: number;
    clientId: string;
    totalFiles: number;
    totalBytes: number;
}

/**
 * Active session info (stored in memory for WebSocket routing)
 */
export interface ActiveSession {
    sessionId: string;
    projectId: string;
    projectIdNum: number;
    userId: number;
    clientId: string;
    totalFiles: number;
    totalBytes: number;
    uploadedFiles: number;
    uploadedBytes: number;
    createdAt: number;
    expiresAt: number;
}

/**
 * Progress callback type for streaming progress to WebSocket
 */
export type ProgressCallback = (progress: {
    clientId: string;
    bytesWritten: number;
    totalBytes: number;
    status: 'writing' | 'complete' | 'error';
    error?: string;
}) => void;

/**
 * Batch completion callback type
 */
export type BatchCompleteCallback = (result: {
    uploaded: number;
    failed: number;
    results: Array<{
        clientId: string;
        success: boolean;
        serverId?: number;
        error?: string;
    }>;
}) => void;

/**
 * Get JWT secret from environment.
 * Returns both the encoded secret (for jose) and length (for diagnostics).
 */
const getJwtSecret = (): { encoded: Uint8Array; length: number } => {
    const secret = process.env.API_JWT_SECRET || process.env.JWT_SECRET || 'dev_secret_change_me';
    return {
        encoded: new TextEncoder().encode(secret),
        length: secret.length,
    };
};

// Session TTL in milliseconds (30 minutes)
const SESSION_TTL_MS = 30 * 60 * 1000;

// Maximum batch size in bytes (100MB)
export const MAX_BATCH_BYTES = 100 * 1024 * 1024;

// Maximum files per batch
export const MAX_BATCH_FILES = 200;

/**
 * Factory function to create upload session manager with isolated state
 */
export function createUploadSessionManager() {
    // Active sessions map (sessionId -> ActiveSession)
    const activeSessions = new Map<string, ActiveSession>();

    // Progress callbacks map (sessionId -> callback)
    const progressCallbacks = new Map<string, ProgressCallback>();

    // Batch complete callbacks map (sessionId -> callback)
    const batchCompleteCallbacks = new Map<string, BatchCompleteCallback>();

    /**
     * Create a new upload session (async due to jose library)
     */
    async function createSession(params: {
        projectId: string;
        projectIdNum: number;
        userId: number;
        clientId: string;
        totalFiles: number;
        totalBytes: number;
    }): Promise<{ sessionToken: string; expiresAt: number }> {
        const sessionId = crypto.randomUUID();
        const now = Date.now();
        const expiresAt = now + SESSION_TTL_MS;

        // Sign JWT with short expiration using jose
        let sessionToken: string;
        try {
            const { encoded: secret } = getJwtSecret();

            sessionToken = await new SignJWT({
                sessionId,
                projectId: params.projectId,
                projectIdNum: params.projectIdNum,
                userId: params.userId,
                clientId: params.clientId,
                totalFiles: params.totalFiles,
                totalBytes: params.totalBytes,
            })
                .setProtectedHeader({ alg: 'HS256' })
                .setIssuedAt()
                .setExpirationTime('30m')
                .sign(secret);
        } catch (signError) {
            console.error('[UploadSessionManager] JWT sign failed:', signError);
            throw signError;
        }

        // Store active session for WebSocket routing
        activeSessions.set(sessionId, {
            sessionId,
            projectId: params.projectId,
            projectIdNum: params.projectIdNum,
            userId: params.userId,
            clientId: params.clientId,
            totalFiles: params.totalFiles,
            totalBytes: params.totalBytes,
            uploadedFiles: 0,
            uploadedBytes: 0,
            createdAt: now,
            expiresAt,
        });

        return { sessionToken, expiresAt };
    }

    /**
     * Validate session token and return payload (async due to jose library)
     * Fast O(1) validation - just verify JWT signature
     */
    async function validateSession(token: string): Promise<UploadSessionPayload | null> {
        try {
            const { encoded: secret } = getJwtSecret();
            const { payload } = await jwtVerify(token, secret);

            // Cast and verify required fields
            const sessionPayload = payload as unknown as UploadSessionPayload;
            // Note: userId can be 0 (falsy but valid), so check for undefined/null explicitly
            if (
                !sessionPayload.sessionId ||
                !sessionPayload.projectId ||
                sessionPayload.userId === undefined ||
                sessionPayload.userId === null
            ) {
                return null;
            }

            return sessionPayload;
        } catch {
            return null;
        }
    }

    /**
     * Get active session by ID
     */
    function getSession(sessionId: string): ActiveSession | null {
        const session = activeSessions.get(sessionId);

        // Check if expired
        if (session && session.expiresAt < Date.now()) {
            activeSessions.delete(sessionId);
            progressCallbacks.delete(sessionId);
            batchCompleteCallbacks.delete(sessionId);
            return null;
        }

        return session || null;
    }

    /**
     * Update session progress
     */
    function updateProgress(sessionId: string, uploadedFiles: number, uploadedBytes: number): void {
        const session = activeSessions.get(sessionId);
        if (session) {
            session.uploadedFiles = uploadedFiles;
            session.uploadedBytes = uploadedBytes;
        }
    }

    /**
     * Register progress callback for a session
     */
    function onProgress(sessionId: string, callback: ProgressCallback): void {
        progressCallbacks.set(sessionId, callback);
    }

    /**
     * Register batch complete callback for a session
     */
    function onBatchComplete(sessionId: string, callback: BatchCompleteCallback): void {
        batchCompleteCallbacks.set(sessionId, callback);
    }

    /**
     * Emit progress to registered callback
     */
    function emitProgress(
        sessionId: string,
        progress: {
            clientId: string;
            bytesWritten: number;
            totalBytes: number;
            status: 'writing' | 'complete' | 'error';
            error?: string;
        },
    ): void {
        const callback = progressCallbacks.get(sessionId);
        if (callback) {
            callback(progress);
        }
    }

    /**
     * Emit batch complete to registered callback
     */
    function emitBatchComplete(
        sessionId: string,
        result: {
            uploaded: number;
            failed: number;
            results: Array<{
                clientId: string;
                success: boolean;
                serverId?: number;
                error?: string;
            }>;
        },
    ): void {
        const callback = batchCompleteCallbacks.get(sessionId);
        if (callback) {
            callback(result);
        }
    }

    /**
     * Delete session (cleanup after upload complete or cancelled)
     */
    function deleteSession(sessionId: string): void {
        activeSessions.delete(sessionId);
        progressCallbacks.delete(sessionId);
        batchCompleteCallbacks.delete(sessionId);
    }

    /**
     * Cleanup expired sessions (call periodically)
     */
    function cleanupExpired(): number {
        const now = Date.now();
        let cleaned = 0;

        for (const [sessionId, session] of activeSessions) {
            if (session.expiresAt < now) {
                activeSessions.delete(sessionId);
                progressCallbacks.delete(sessionId);
                batchCompleteCallbacks.delete(sessionId);
                cleaned++;
            }
        }

        return cleaned;
    }

    /**
     * Get stats for debugging
     */
    function getStats(): { activeSessions: number; oldestSession: number | null } {
        let oldestCreatedAt: number | null = null;

        for (const session of activeSessions.values()) {
            if (oldestCreatedAt === null || session.createdAt < oldestCreatedAt) {
                oldestCreatedAt = session.createdAt;
            }
        }

        return {
            activeSessions: activeSessions.size,
            oldestSession: oldestCreatedAt,
        };
    }

    return {
        createSession,
        validateSession,
        getSession,
        updateProgress,
        onProgress,
        onBatchComplete,
        emitProgress,
        emitBatchComplete,
        deleteSession,
        cleanupExpired,
        getStats,
        MAX_BATCH_BYTES,
        MAX_BATCH_FILES,
    };
}

// Default singleton instance
export const uploadSessionManager = createUploadSessionManager();

// Re-export for convenience
export const createSession = uploadSessionManager.createSession;
export const validateSession = uploadSessionManager.validateSession;
export const getSession = uploadSessionManager.getSession;
export const updateProgress = uploadSessionManager.updateProgress;
export const onProgress = uploadSessionManager.onProgress;
export const onBatchComplete = uploadSessionManager.onBatchComplete;
export const emitProgress = uploadSessionManager.emitProgress;
export const emitBatchComplete = uploadSessionManager.emitBatchComplete;
export const deleteSession = uploadSessionManager.deleteSession;
export const cleanupExpired = uploadSessionManager.cleanupExpired;
export const getStats = uploadSessionManager.getStats;
