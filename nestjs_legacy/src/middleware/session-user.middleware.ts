import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * SessionUserMiddleware
 *
 * Populates req.user from req.session data for session-based authentication.
 * This middleware bridges the gap between session storage (req.session.userId/email)
 * and controller expectations (req.user.email).
 *
 * Flow:
 * 1. AuthController sets req.session.userId and req.session.email on login
 * 2. This middleware reads from req.session and populates req.user
 * 3. Controllers can access req.user.email consistently
 */
@Injectable()
export class SessionUserMiddleware implements NestMiddleware {
    private readonly logger = new Logger(SessionUserMiddleware.name);

    use(req: FastifyRequest & { session?: any; user?: any }, res: FastifyReply, next: () => void) {
        // Populate req.user from session if session data exists
        if (req.session?.userId && req.session?.email) {
            req.user = {
                id: req.session.userId,
                email: req.session.email,
                isGuest: req.session.isGuest || false,
            };

            this.logger.debug(
                `[Session→User] Populated req.user for ${req.user.isGuest ? 'guest' : 'user'}: ${req.user.email}`,
            );
        } else {
            // No session data - req.user remains undefined
            this.logger.debug(`[Session→User] No session data found, req.user not populated`);
        }

        next();
    }
}
