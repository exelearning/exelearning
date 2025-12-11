import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { FastifyRequest } from 'fastify';
import { JwtPayload, AuthenticatedRequest } from './jwt-auth.guard';

/**
 * OptionalJwtAuthGuard
 * Similar to JwtAuthGuard but doesn't throw if no token is present.
 * Attaches user to request if valid token exists, otherwise allows access without user.
 * Use this for endpoints that support both authenticated and anonymous access.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const token = this.extractTokenFromHeader(request);

        if (!token) {
            // No token - allow access but without user context
            return true;
        }

        try {
            const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
            // Attach user payload to request for use in controllers
            (request as AuthenticatedRequest).user = payload;
            return true;
        } catch (error) {
            // Invalid token - still allow access but without user context
            // The controller/service should handle authorization based on project visibility
            return true;
        }
    }

    private extractTokenFromHeader(request: FastifyRequest): string | undefined {
        const authHeader = request.headers.authorization;
        if (!authHeader) return undefined;

        const [type, token] = authHeader.split(' ');
        return type === 'Bearer' ? token : undefined;
    }
}
