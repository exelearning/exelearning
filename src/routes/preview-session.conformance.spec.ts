/**
 * Replays test/fixtures/preview-contract/vectors.json against the reference
 * Elysia routes. This file doubles as the REFERENCE CONSUMER of the shared
 * conformance vectors: host plugins (Moodle / WordPress / Omeka S / Nextcloud
 * / Procomún) port this interpretation to their own test harnesses — see the
 * fixture README for the harness semantics.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { SignJWT } from 'jose';
import {
    configure as configureFixedResources,
    resetDependencies as resetFixedResources,
} from '../services/preview-fixed-resources';
import { resetDependencies } from '../services/preview-session-manager';
import { previewServeRoutes, previewSessionApiRoutes } from './preview-session';

const TEST_JWT_SECRET = 'dev_secret_change_me';
const BASE = 'http://localhost';
const OWNER_ID = 7;

interface VectorHeaderMatcher {
    startsWith?: string;
    contains?: string;
    absent?: boolean;
}

interface VectorStep {
    id: string;
    comment?: string;
    request: {
        method: string;
        path: string;
        headers?: Record<string, string>;
        body?: {
            kind: 'assets' | 'revision';
            entries?: Array<{ key: string; content: string }>;
            meta?: Record<string, unknown>;
            writes?: Array<{ path: string; content: string }>;
        };
    };
    expect: {
        status: number;
        body?: unknown;
        bodyText?: string;
        headers?: Record<string, string | VectorHeaderMatcher>;
    };
}

interface Vectors {
    protocolVersion: number;
    fixedResources: Record<string, { path: string; content: string }>;
    steps: VectorStep[];
}

const vectorsPath = path.resolve(__dirname, '../../test/fixtures/preview-contract/vectors.json');
const vectors = JSON.parse(fs.readFileSync(vectorsPath, 'utf-8')) as Vectors;

/** Recursive subset match: arrays exact, objects may carry extra keys. */
function expectSubset(actual: unknown, expected: unknown, context: string): void {
    if (Array.isArray(expected)) {
        expect(actual).toEqual(expected);
        return;
    }
    if (typeof expected === 'object' && expected !== null) {
        expect(typeof actual).toBe('object');
        for (const [key, value] of Object.entries(expected)) {
            expectSubset((actual as Record<string, unknown>)[key], value, `${context}.${key}`);
        }
        return;
    }
    expect(actual).toEqual(expected);
}

function buildBody(body: NonNullable<VectorStep['request']['body']>): FormData {
    const form = new FormData();
    if (body.kind === 'assets') {
        const entries = body.entries ?? [];
        form.append(
            'assets',
            JSON.stringify(entries.map(e => ({ key: e.key, size: new TextEncoder().encode(e.content).length }))),
        );
        for (const entry of entries) form.append('files', new Blob([new TextEncoder().encode(entry.content)]));
        return form;
    }
    const writes = body.writes ?? [];
    form.append('revision', JSON.stringify({ ...(body.meta ?? {}), writes: writes.map(w => w.path) }));
    for (const write of writes) form.append('files', new Blob([new TextEncoder().encode(write.content)]));
    return form;
}

describe('preview serving contract v2 — conformance vectors', () => {
    let fixedRoot: string;
    let ownerToken: string;
    let previewId = '';

    beforeAll(async () => {
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        resetDependencies();

        // Materialize the fixed-resource distribution root described by the
        // vectors and point the resolver at it (harness semantics step 1).
        fixedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'preview-conformance-'));
        const resources: Record<string, { path: string; size: number }> = {};
        for (const [id, { path: rel, content }] of Object.entries(vectors.fixedResources)) {
            const abs = path.join(fixedRoot, rel);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, content);
            resources[id] = { path: rel, size: Buffer.byteLength(content) };
        }
        const manifestPath = path.join(fixedRoot, 'bundles', 'preview-fixed-resources.json');
        fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
        fs.writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, buildVersion: 'v-test', resources }));
        configureFixedResources({ publicRoot: fixedRoot, manifestPath });

        const secret = new TextEncoder().encode(TEST_JWT_SECRET);
        ownerToken = await new SignJWT({ sub: OWNER_ID, email: 'owner@test.local', roles: ['ROLE_USER'] })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('1h')
            .sign(secret);
    });

    afterAll(() => {
        resetDependencies();
        resetFixedResources();
        fs.rmSync(fixedRoot, { recursive: true, force: true });
    });

    it('declares the protocol version this suite validates', () => {
        expect(vectors.protocolVersion).toBe(2);
        expect(vectors.steps.length).toBeGreaterThan(0);
    });

    // Steps share one session and MUST run in file order (bun test preserves
    // declaration order within a file).
    for (const step of vectors.steps) {
        it(`step: ${step.id}`, async () => {
            const requestPath = step.request.path.replace('{previewId}', previewId);
            const isManagement = step.request.path.startsWith('/api/');
            const headers: Record<string, string> = { ...(step.request.headers ?? {}) };
            // Management runs authenticated as the owner; serving runs with no
            // credentials (harness semantics step 2).
            if (isManagement) headers.Cookie = `auth=${ownerToken}`;

            const request = new Request(`${BASE}${requestPath}`, {
                method: step.request.method,
                headers,
                body: step.request.body ? buildBody(step.request.body) : undefined,
            });
            const routes = isManagement ? previewSessionApiRoutes : previewServeRoutes;
            const response = await routes.handle(request);

            expect(response.status).toBe(step.expect.status);

            for (const [name, matcher] of Object.entries(step.expect.headers ?? {})) {
                const actual = response.headers.get(name);
                if (typeof matcher === 'string') {
                    // {previewId} substitution applies to expected header string
                    // values too (e.g. the bare-root redirect Location).
                    expect(actual).toBe(matcher.replace('{previewId}', previewId));
                } else if (matcher.absent) {
                    expect(actual).toBeNull();
                } else if (matcher.startsWith !== undefined) {
                    expect(actual ?? '').toStartWith(matcher.startsWith);
                } else if (matcher.contains !== undefined) {
                    expect(actual ?? '').toContain(matcher.contains);
                }
            }

            if (step.expect.bodyText !== undefined) {
                expect(await response.text()).toBe(step.expect.bodyText);
            } else if (step.expect.body !== undefined) {
                const json = (await response.json()) as Record<string, unknown>;
                expectSubset(json, step.expect.body, step.id);
                // Capture the session id minted by the create step.
                if (typeof json.previewId === 'string') previewId = json.previewId;
            }
        });
    }
});
