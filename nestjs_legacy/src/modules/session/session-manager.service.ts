import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { ProjectOpenService } from '../project/services/project-open.service';
import { v4 as uuidv4 } from 'uuid';

export interface SessionCheckResult {
    canAutoClose: boolean;
    requiresSave: boolean;
    isBlank: boolean;
    hasOtherUsers: boolean;
}

/**
 * SessionManagerService
 *
 * Centralized service for managing user sessions in eXeLearning.
 * Provides a single source of truth for session lifecycle operations.
 *
 * NOTE: With Yjs as the source of truth for real-time collaboration,
 * this service has been simplified. Session presence and concurrent editing
 * are now handled by Yjs awareness protocol.
 *
 * Responsibilities:
 * - Create blank sessions (Login)
 * - Check if session can be closed (New/Open)
 * - Close sessions and cleanup resources
 */
@Injectable()
export class SessionManagerService {
    private readonly logger = new Logger(SessionManagerService.name);

    constructor(
        @Inject(forwardRef(() => ProjectOpenService))
        private readonly projectOpenService: ProjectOpenService,
    ) {}

    /**
     * Create a blank session for a user
     *
     * This is called on:
     * - Initial login (if no existing session)
     * - "New" button click
     *
     * NOTE: With Yjs, session creation is simpler - we just create in-memory session
     * and Yjs document. No database tracking of users/sessions needed.
     *
     * @param userEmail - User's email
     * @param clientIp - Client IP address (ignored with Yjs)
     * @returns Created session data
     */
    async createBlankSession(
        userEmail: string,
        clientIp: string = '127.0.0.1',
    ): Promise<{
        odeId: string;
        odeVersionId: string;
        odeSessionId: string;
    }> {
        this.logger.log(`Creating blank session for user: ${userEmail}`);

        // Generate new IDs
        const odeId = uuidv4();
        const odeVersionId = uuidv4();
        const odeSessionId = uuidv4();

        this.logger.debug(`Generated session IDs:`);
        this.logger.debug(`  - odeId: ${odeId}`);
        this.logger.debug(`  - odeVersionId: ${odeVersionId}`);
        this.logger.debug(`  - odeSessionId: ${odeSessionId}`);

        // Create blank project session in memory
        await this.projectOpenService.createBlankSession(odeSessionId, userEmail);

        this.logger.log(
            `Blank session created successfully: ${odeSessionId} for user: ${userEmail}`,
        );

        return { odeId, odeVersionId, odeSessionId };
    }

    /**
     * Check if a session is blank
     *
     * NOTE: With Yjs as source of truth, blank detection should be done
     * via Yjs document inspection. This is a simplified stub.
     *
     * @param odeSessionId - Session ID to check
     * @returns true if session is blank
     */
    async isSessionBlank(odeSessionId: string): Promise<boolean> {
        this.logger.debug(`Checking if session is blank: ${odeSessionId}`);

        // With Yjs, check if session has content via in-memory session
        const session = this.projectOpenService.getSession(odeSessionId);
        if (!session) {
            return true; // No session = blank
        }

        // Check if session has pages
        const isBlank =
            !session.structure?.pages || session.structure.pages.length === 0;

        this.logger.debug(`Session ${odeSessionId} blank check: ${isBlank}`);

        return isBlank;
    }

    /**
     * Check if a session has unsaved changes
     *
     * @param odeSessionId - Session ID to check
     * @returns true if session might have unsaved changes
     */
    async hasUnsavedChanges(odeSessionId: string): Promise<boolean> {
        // If session is not blank, assume it might have changes
        const isBlank = await this.isSessionBlank(odeSessionId);
        return !isBlank;
    }

    /**
     * Check if a session can be automatically closed
     *
     * NOTE: With Yjs, concurrent users are tracked by Yjs awareness, not DB.
     * This method returns hasOtherUsers: false since that info should come from Yjs.
     *
     * @param odeSessionId - Session ID to check
     * @param userEmail - Current user's email
     * @returns Session check result with multiple flags
     */
    async canAutoCloseSession(
        odeSessionId: string,
        userEmail: string,
    ): Promise<SessionCheckResult> {
        this.logger.debug(
            `Checking if session can be auto-closed: ${odeSessionId} for user: ${userEmail}`,
        );

        const isBlank = await this.isSessionBlank(odeSessionId);
        const hasOtherUsers = false; // Yjs awareness handles this
        const requiresSave = !isBlank;
        const canAutoClose = isBlank && !hasOtherUsers;

        this.logger.debug(
            `Session check result: canAutoClose=${canAutoClose}, requiresSave=${requiresSave}, isBlank=${isBlank}`,
        );

        return {
            canAutoClose,
            requiresSave,
            isBlank,
            hasOtherUsers,
        };
    }

    /**
     * Close a session and cleanup all resources
     *
     * @param odeSessionId - Session ID to close
     * @param deleteInMemory - Whether to delete from in-memory session store
     * @returns Cleanup result
     */
    async closeSession(
        odeSessionId: string,
        deleteInMemory: boolean = true,
    ): Promise<{
        navDeleted: number;
        pagDeleted: number;
        compDeleted: number;
    }> {
        this.logger.log(`Closing session: ${odeSessionId}`);

        // With Yjs, we just remove from in-memory session
        if (deleteInMemory) {
            await this.projectOpenService.closeSession(odeSessionId);
        }

        this.logger.log(`Session closed: ${odeSessionId}`);

        // Return zeros since we no longer track in ODE*Sync tables
        return { navDeleted: 0, pagDeleted: 0, compDeleted: 0 };
    }

    /**
     * Get current session for a user
     *
     * @deprecated With Yjs, session lookup should be done via Yjs document ID or URL
     * @param userEmail - User's email
     * @returns null (no longer tracking sessions in DB)
     */
    async getCurrentSessionForUser(userEmail: string): Promise<null> {
        this.logger.debug(
            `getCurrentSessionForUser called for ${userEmail} - returning null (Yjs mode)`,
        );
        return null;
    }
}
