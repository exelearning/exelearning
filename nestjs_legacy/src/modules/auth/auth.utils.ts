import type { FastifyRequest } from 'fastify';
import { getBasePath } from '../../utils/basepath.util';

export function parseAuthMethods(raw?: string | null, fallback = ['password']): string[] {
    if (!raw) return [...fallback];

    return raw
        .split(',')
        .map((method) => method.trim().toLowerCase())
        .filter(Boolean);
}

export function buildBaseUrl(req: FastifyRequest): string {
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.headers.host || (req as any).hostname || 'localhost:3001';

    return `${protocol}://${host}`;
}

export function buildAbsoluteUrl(req: FastifyRequest, path: string): string {
    const basePath = getBasePath();
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${buildBaseUrl(req)}${basePath}${normalizedPath}`;
}

export function decodeJwtPayload(token?: string): Record<string, any> | null {
    if (!token || token.split('.').length < 2) {
        return null;
    }

    const base64Payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = base64Payload.padEnd(
        base64Payload.length + ((4 - (base64Payload.length % 4)) % 4),
        '=',
    );

    try {
        const json = Buffer.from(paddedPayload, 'base64').toString('utf-8');
        return JSON.parse(json);
    } catch {
        return null;
    }
}
