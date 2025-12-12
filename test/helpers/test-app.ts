/**
 * Elysia Test Helper
 * Utilities for testing Elysia routes
 */
import type { Elysia } from 'elysia';

/**
 * Make a test request to an Elysia app
 */
export async function testRequest(
    app: Elysia<any, any, any, any, any, any, any, any>,
    path: string,
    options: RequestInit = {},
): Promise<Response> {
    return app.handle(new Request(`http://localhost${path}`, options));
}

/**
 * Make a GET request
 */
export async function testGet(
    app: Elysia<any, any, any, any, any, any, any, any>,
    path: string,
    headers?: Record<string, string>,
): Promise<Response> {
    return testRequest(app, path, {
        method: 'GET',
        headers,
    });
}

/**
 * Make a POST request with JSON body
 */
export async function testPost(
    app: Elysia<any, any, any, any, any, any, any, any>,
    path: string,
    body: unknown,
    headers?: Record<string, string>,
): Promise<Response> {
    return testRequest(app, path, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify(body),
    });
}

/**
 * Make a DELETE request
 */
export async function testDelete(
    app: Elysia<any, any, any, any, any, any, any, any>,
    path: string,
    headers?: Record<string, string>,
): Promise<Response> {
    return testRequest(app, path, {
        method: 'DELETE',
        headers,
    });
}

/**
 * Make an authenticated request with Bearer token
 */
export async function testAuthRequest(
    app: Elysia<any, any, any, any, any, any, any, any>,
    path: string,
    token: string,
    options: RequestInit = {},
): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);
    return testRequest(app, path, { ...options, headers });
}

/**
 * Make an authenticated POST request with JSON body
 */
export async function testAuthPost(
    app: Elysia<any, any, any, any, any, any, any, any>,
    path: string,
    token: string,
    body: unknown,
): Promise<Response> {
    return testAuthRequest(app, path, token, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
}

/**
 * Parse JSON response
 */
export async function parseJson<T = unknown>(response: Response): Promise<T> {
    return response.json() as Promise<T>;
}

/**
 * Assert response status and return parsed JSON
 */
export async function expectStatus<T = unknown>(response: Response, expectedStatus: number): Promise<T> {
    if (response.status !== expectedStatus) {
        const body = await response.text();
        throw new Error(`Expected status ${expectedStatus}, got ${response.status}. Body: ${body}`);
    }
    return parseJson<T>(response);
}
