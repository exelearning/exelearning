import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import '../../types/fastify';
import { TranslationService } from '../../modules/translation/services/translation.service';
import { TranslatableException } from '../exceptions/translatable.exception';
import { getBasePath } from '../../utils/basepath.util';

/**
 * Global HTTP exception filter that handles all exceptions.
 *
 * Behavior:
 * - API routes (/api/*) or JSON Accept header: returns JSON response
 * - Web routes: renders HTML error page using Nunjucks template
 * - TranslatableException: translates message using TranslationService
 * - Standard exceptions: uses message as-is or translates if key exists
 *
 * Migrated from Symfony ErrorController.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    constructor(private readonly translationService: TranslationService) {}

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<FastifyReply>();
        const request = ctx.getRequest<FastifyRequest>();

        // Determine HTTP status code
        const status = this.getStatusCode(exception);

        // Get error message (translated if possible)
        const message = this.getErrorMessage(exception);

        // Log the error
        this.logError(exception, request);

        // Determine if this is an API request
        if (this.isApiRequest(request)) {
            this.sendJsonResponse(response, request, status, message);
        } else {
            this.sendHtmlResponse(response, request, status, message);
        }
    }

    /**
     * Determine HTTP status code from exception
     */
    private getStatusCode(exception: unknown): number {
        if (exception instanceof HttpException) {
            return exception.getStatus();
        }
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }

    /**
     * Get error message, translating if necessary
     */
    private getErrorMessage(exception: unknown): string {
        // Handle TranslatableException - translate using key and parameters
        if (exception instanceof TranslatableException) {
            return this.translationService.trans(
                exception.getTranslationKey(),
                exception.getTranslationParameters(),
            );
        }

        // Handle standard HttpException
        if (exception instanceof HttpException) {
            const response = exception.getResponse();
            if (typeof response === 'string') {
                // Try to translate if it looks like a translation key
                return this.tryTranslate(response);
            }
            if (typeof response === 'object' && response !== null) {
                const responseObj = response as Record<string, unknown>;
                const message = responseObj.message;
                if (typeof message === 'string') {
                    return this.tryTranslate(message);
                }
                if (Array.isArray(message)) {
                    return message.map((m) => this.tryTranslate(String(m))).join(', ');
                }
            }
        }

        // Handle unknown exceptions
        if (exception instanceof Error) {
            return exception.message;
        }

        return 'An unexpected error occurred';
    }

    /**
     * Try to translate a message. If it looks like a translation key, translate it.
     * Otherwise, return the original message.
     */
    private tryTranslate(message: string): string {
        // If message looks like a translation key (e.g., error.something), try to translate
        if (/^[a-z_]+\.[a-z_]+$/i.test(message)) {
            const translated = this.translationService.trans(message);
            // Only use translation if it's different from the key
            if (translated !== message) {
                return translated;
            }
        }
        return message;
    }

    /**
     * Check if the request is for an API endpoint
     */
    private isApiRequest(request: FastifyRequest): boolean {
        const url = request.url || '';
        const accept = request.headers.accept || '';
        const contentType = request.headers['content-type'] || '';

        // Check if URL starts with /api/ (accounting for basePath)
        const basePath = getBasePath();
        const apiPath = basePath ? `${basePath}/api/` : '/api/';
        if (url.startsWith(apiPath) || url.startsWith('/api/')) {
            return true;
        }

        // Check if client explicitly requests JSON
        if (accept.includes('application/json') && !accept.includes('text/html')) {
            return true;
        }

        // Check if request is sending JSON (likely API call)
        if (contentType.includes('application/json')) {
            return true;
        }

        // XHR requests that don't accept HTML are likely API calls
        const xRequestedWith = request.headers['x-requested-with'];
        if (xRequestedWith === 'XMLHttpRequest' && !accept.includes('text/html')) {
            return true;
        }

        return false;
    }

    /**
     * Send JSON error response for API routes
     */
    private sendJsonResponse(
        response: FastifyReply,
        request: FastifyRequest,
        status: number,
        message: string,
    ): void {
        response.code(status).send({
            statusCode: status,
            message: message,
            error: HttpStatus[status] || 'Error',
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }

    /**
     * Send HTML error response using Nunjucks template
     */
    private sendHtmlResponse(
        response: FastifyReply,
        request: FastifyRequest,
        status: number,
        message: string,
    ): void {
        const basePath = getBasePath();

        // Determine if user is authenticated (check session/user)
        const isAuthenticated = !!(request as any).user || !!(request as any).session?.user;

        // Choose appropriate template based on context
        // Use workarea/error for workarea routes, security/error for everything else
        const isWorkareaRoute = request.url.includes('/workarea');
        const template = isWorkareaRoute ? 'workarea/error' : 'security/error';

        try {
            response.code(status).view(template, {
                error: message,
                message: message,
                status_code: status,
                status_text: HttpStatus[status] || 'Error',
                is_authenticated: isAuthenticated,
                basePath: basePath,
            });
        } catch (renderError) {
            // Fallback to simple HTML if template rendering fails
            this.logger.error(`Failed to render error template: ${renderError}`);
            response.code(status).type('text/html').send(`
                <!DOCTYPE html>
                <html>
                <head><title>Error ${status}</title></head>
                <body>
                    <h1>Error ${status}</h1>
                    <p>${this.escapeHtml(message)}</p>
                    <a href="${basePath || ''}/login">Return to login</a>
                </body>
                </html>
            `);
        }
    }

    /**
     * Log the error with appropriate level
     */
    private logError(exception: unknown, request: FastifyRequest): void {
        const status = this.getStatusCode(exception);
        const method = request.method;
        const url = request.url;

        if (status >= 500) {
            this.logger.error(
                `[${method}] ${url} - ${status} - ${exception instanceof Error ? exception.message : 'Unknown error'}`,
                exception instanceof Error ? exception.stack : undefined,
            );
        } else if (status >= 400) {
            this.logger.warn(
                `[${method}] ${url} - ${status} - ${exception instanceof Error ? exception.message : 'Unknown error'}`,
            );
        }
    }

    /**
     * Escape HTML to prevent XSS in fallback response
     */
    private escapeHtml(text: string): string {
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;',
        };
        return text.replace(/[&<>"']/g, (char) => map[char]);
    }
}
