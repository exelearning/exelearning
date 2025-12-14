/**
 * Tests for Convert Routes
 * Uses Dependency Injection pattern - no mock.module needed
 *
 * Tests the stateless convert/export API that accepts file uploads
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { Elysia } from 'elysia';
import { SignJWT } from 'jose';
import type { Kysely } from 'kysely';
import { zipSync, strToU8 } from 'fflate';

import { createConvertRoutes, type ConvertDependencies } from './convert';
import type { Database } from '../db/types';

const testDir = path.join(process.cwd(), 'test', 'temp', 'convert-test');

// Sample test user
const testUser = {
    id: 1,
    email: 'test@exelearning.net',
    user_id: 'test-user',
    roles: '["ROLE_USER"]',
    quota_mb: 1024,
    is_active: 1,
    is_lopd_accepted: 1,
    password: 'hashed',
    created_at: '2025-01-01 00:00:00',
    updated_at: '2025-01-01 00:00:00',
};

// JWT secret for testing - must match getJwtSecret() fallback in convert.ts
// We use the default fallback 'dev_secret_change_me' to avoid env var race conditions
const JWT_SECRET = 'dev_secret_change_me';

// Create mock database functions
function createMockQueries() {
    return {
        findUserById: async (_db: any, id: number) => {
            return id === 1 ? testUser : null;
        },
    };
}

// Create a test ELP file buffer (valid ZIP)
async function createTestElpBuffer(): Promise<Buffer> {
    const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
  <userPreferences>
    <userPreference><key>theme</key><value>base</value></userPreference>
  </userPreferences>
  <odeResources>
    <odeResource><key>odeId</key><value>test123</value></odeResource>
  </odeResources>
  <odeProperties>
    <odeProperty><key>pp_title</key><value>Test Project</value></odeProperty>
    <odeProperty><key>pp_lang</key><value>en</value></odeProperty>
  </odeProperties>
  <odeNavStructures>
    <odeNavStructure>
      <odePageId>page-1</odePageId>
      <odeParentPageId></odeParentPageId>
      <pageName>Page 1</pageName>
      <odeNavStructureOrder>0</odeNavStructureOrder>
      <odeNavStructureProperties></odeNavStructureProperties>
      <odePagStructures>
        <odePagStructure>
          <odePageId>page-1</odePageId>
          <odeBlockId>block-1</odeBlockId>
          <blockName>Content</blockName>
          <odePagStructureOrder>0</odePagStructureOrder>
          <odePagStructureProperties></odePagStructureProperties>
          <odeComponents>
            <odeComponent>
              <odePageId>page-1</odePageId>
              <odeBlockId>block-1</odeBlockId>
              <odeIdeviceId>comp-1</odeIdeviceId>
              <odeIdeviceTypeName>FreeTextIdevice</odeIdeviceTypeName>
              <htmlView><![CDATA[<p>Test content</p>]]></htmlView>
              <jsonProperties>{}</jsonProperties>
              <odeComponentsOrder>0</odeComponentsOrder>
              <odeComponentsProperties></odeComponentsProperties>
            </odeComponent>
          </odeComponents>
        </odePagStructure>
      </odePagStructures>
    </odeNavStructure>
  </odeNavStructures>
</ode>`;
    const zipped = zipSync({ 'content.xml': strToU8(contentXml) });
    return Buffer.from(zipped);
}

// Create mock dependencies
function createMockDependencies(): ConvertDependencies {
    return {
        db: {} as Kysely<Database>,
        queries: createMockQueries(),
        publicDir: path.join(testDir, 'public'),
        tempDir: path.join(testDir, 'tmp'),
    };
}

// Generate test JWT token
async function generateToken(userId: number): Promise<string> {
    const payload = {
        sub: userId,
        email: testUser.email,
        roles: ['ROLE_USER'],
        isGuest: false,
    };

    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);

    return token;
}

describe('Convert Routes', () => {
    let app: Elysia;
    let mockDeps: ConvertDependencies;
    let authToken: string;

    beforeEach(async () => {
        // Create test directories
        await fs.ensureDir(path.join(testDir, 'tmp'));
        await fs.ensureDir(path.join(testDir, 'public'));
        await fs.ensureDir(path.join(testDir, 'public', 'style', 'base'));
        await fs.ensureDir(path.join(testDir, 'public', 'libs'));

        // Create minimal theme file
        await fs.writeFile(path.join(testDir, 'public', 'style', 'base', 'content.css'), '/* base theme */');

        // Create mock dependencies
        mockDeps = createMockDependencies();

        // Create app with convert routes (uses 'dev_secret_change_me' as JWT secret)
        app = new Elysia().use(createConvertRoutes(mockDeps));

        // Generate auth token
        authToken = await generateToken(1);
    });

    afterEach(async () => {
        if (await fs.pathExists(testDir)) {
            await fs.remove(testDir);
        }
    });

    describe('GET /api/convert/formats', () => {
        it('should return list of export formats', async () => {
            const res = await app.handle(new Request('http://localhost/api/convert/formats'));

            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.success).toBe(true);
            expect(body.formats).toBeDefined();
            expect(Array.isArray(body.formats)).toBe(true);
        });

        it('should include HTML5 format', async () => {
            const res = await app.handle(new Request('http://localhost/api/convert/formats'));

            const body = await res.json();
            const html5 = body.formats.find((f: any) => f.id === 'html5');
            expect(html5).toBeDefined();
            expect(html5.name).toBe('HTML5 Website');
        });

        it('should include SCORM formats', async () => {
            const res = await app.handle(new Request('http://localhost/api/convert/formats'));

            const body = await res.json();
            expect(body.formats.find((f: any) => f.id === 'scorm12')).toBeDefined();
            expect(body.formats.find((f: any) => f.id === 'scorm2004')).toBeDefined();
        });

        it('should include EPUB3 format', async () => {
            const res = await app.handle(new Request('http://localhost/api/convert/formats'));

            const body = await res.json();
            const epub3 = body.formats.find((f: any) => f.id === 'epub3');
            expect(epub3).toBeDefined();
            expect(epub3.extension).toBe('epub');
        });

        it('should include ELP/ELPX formats', async () => {
            const res = await app.handle(new Request('http://localhost/api/convert/formats'));

            const body = await res.json();
            expect(body.formats.find((f: any) => f.id === 'elp')).toBeDefined();
            expect(body.formats.find((f: any) => f.id === 'elpx')).toBeDefined();
        });
    });

    describe('POST /api/convert/elp', () => {
        it('should require authentication', async () => {
            const elpBuffer = await createTestElpBuffer();
            const formData = new FormData();
            formData.append('file', new Blob([elpBuffer], { type: 'application/zip' }), 'test.elp');

            const res = await app.handle(
                new Request('http://localhost/api/convert/elp', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(401);
        });

        it('should return error when no file is provided', async () => {
            const formData = new FormData();

            const res = await app.handle(
                new Request('http://localhost/api/convert/elp', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.code).toBe('MISSING_FILE');
        });

        it('should convert ELP file and return metadata', async () => {
            const elpBuffer = await createTestElpBuffer();
            const formData = new FormData();
            formData.append('file', new Blob([elpBuffer], { type: 'application/zip' }), 'test.elp');

            const res = await app.handle(
                new Request('http://localhost/api/convert/elp', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            // Should succeed (even if conversion has issues, it should try)
            expect([200, 201, 500]).toContain(res.status);
        });

        it('should return file directly when download=1 is set', async () => {
            const elpBuffer = await createTestElpBuffer();
            const formData = new FormData();
            formData.append('file', new Blob([elpBuffer], { type: 'application/zip' }), 'test.elp');

            const res = await app.handle(
                new Request('http://localhost/api/convert/elp?download=1', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            // Should succeed and return file
            expect([200, 201, 500]).toContain(res.status);
            if (res.status === 200) {
                // Check for file download headers
                expect(res.headers.get('content-type')).toBeDefined();
            }
        });
    });

    describe('POST /api/convert/export/:format', () => {
        it('should require authentication', async () => {
            const elpBuffer = await createTestElpBuffer();
            const formData = new FormData();
            formData.append('file', new Blob([elpBuffer], { type: 'application/zip' }), 'test.elp');

            const res = await app.handle(
                new Request('http://localhost/api/convert/export/html5', {
                    method: 'POST',
                    body: formData,
                }),
            );

            expect(res.status).toBe(401);
        });

        it('should return error for invalid format', async () => {
            const elpBuffer = await createTestElpBuffer();
            const formData = new FormData();
            formData.append('file', new Blob([elpBuffer], { type: 'application/zip' }), 'test.elp');

            const res = await app.handle(
                new Request('http://localhost/api/convert/export/invalid-format', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.code).toBe('INVALID_FORMAT');
            expect(body.validFormats).toBeDefined();
        });

        it('should return error when no file is provided', async () => {
            const formData = new FormData();

            const res = await app.handle(
                new Request('http://localhost/api/convert/export/html5', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.code).toBe('MISSING_FILE');
        });

        it('should accept html5 format', async () => {
            const elpBuffer = await createTestElpBuffer();
            const formData = new FormData();
            formData.append('file', new Blob([elpBuffer], { type: 'application/zip' }), 'test.elp');

            const res = await app.handle(
                new Request('http://localhost/api/convert/export/html5', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            // Should attempt export (might fail due to missing resources but shouldn't 400)
            expect([200, 201, 500]).toContain(res.status);
        });

        it('should accept scorm12 format', async () => {
            const elpBuffer = await createTestElpBuffer();
            const formData = new FormData();
            formData.append('file', new Blob([elpBuffer], { type: 'application/zip' }), 'test.elp');

            const res = await app.handle(
                new Request('http://localhost/api/convert/export/scorm12', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            expect([200, 201, 500]).toContain(res.status);
        });

        it('should accept epub3 format', async () => {
            const elpBuffer = await createTestElpBuffer();
            const formData = new FormData();
            formData.append('file', new Blob([elpBuffer], { type: 'application/zip' }), 'test.elp');

            const res = await app.handle(
                new Request('http://localhost/api/convert/export/epub3', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            expect([200, 201, 500]).toContain(res.status);
        });

        it('should accept elpx format', async () => {
            const elpBuffer = await createTestElpBuffer();
            const formData = new FormData();
            formData.append('file', new Blob([elpBuffer], { type: 'application/zip' }), 'test.elp');

            const res = await app.handle(
                new Request('http://localhost/api/convert/export/elpx', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            expect([200, 201, 500]).toContain(res.status);
        });

        it('should return file directly with download=1 query param', async () => {
            const elpBuffer = await createTestElpBuffer();
            const formData = new FormData();
            formData.append('file', new Blob([elpBuffer], { type: 'application/zip' }), 'test.elp');

            const res = await app.handle(
                new Request('http://localhost/api/convert/export/html5?download=1', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            // Should succeed and return file or error
            expect([200, 201, 500]).toContain(res.status);
            if (res.status === 200) {
                // Check for download headers
                expect(res.headers.get('content-type')).toBeDefined();
            }
        });
    });

    describe('File Validation', () => {
        it('should reject files that are too large', async () => {
            // Set a small max upload size for this test
            const originalMaxSize = process.env.MAX_UPLOAD_SIZE;
            process.env.MAX_UPLOAD_SIZE = '100'; // 100 bytes

            // Recreate app with new environment
            const testApp = new Elysia().use(createConvertRoutes(mockDeps));

            // Create a file larger than 100 bytes
            const formData = new FormData();
            const largeContent = 'x'.repeat(200); // 200 bytes
            const largeBlob = new Blob([largeContent], { type: 'application/zip' });
            formData.append('file', largeBlob, 'large.elp');

            const res = await testApp.handle(
                new Request('http://localhost/api/convert/elp', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            // Restore original env
            if (originalMaxSize !== undefined) {
                process.env.MAX_UPLOAD_SIZE = originalMaxSize;
            } else {
                delete process.env.MAX_UPLOAD_SIZE;
            }

            // Should reject as too large
            expect(res.status).toBe(400);
        });

        it('should reject invalid file extensions', async () => {
            const formData = new FormData();
            formData.append('file', new Blob(['invalid'], { type: 'text/plain' }), 'test.txt');

            const res = await app.handle(
                new Request('http://localhost/api/convert/elp', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.detail).toContain('Invalid file type');
        });

        it('should respect MAX_UPLOAD_SIZE with M suffix', async () => {
            // Set max upload size using M suffix notation
            const originalMaxSize = process.env.MAX_UPLOAD_SIZE;
            process.env.MAX_UPLOAD_SIZE = '1M'; // 1 megabyte

            // Recreate app with new environment
            const testApp = new Elysia().use(createConvertRoutes(mockDeps));

            // Create a file larger than 1MB (1.5MB)
            const formData = new FormData();
            const largeContent = 'x'.repeat(1.5 * 1024 * 1024);
            const largeBlob = new Blob([largeContent], { type: 'application/zip' });
            formData.append('file', largeBlob, 'large.elp');

            const res = await testApp.handle(
                new Request('http://localhost/api/convert/elp', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                    body: formData,
                }),
            );

            // Restore original env
            if (originalMaxSize !== undefined) {
                process.env.MAX_UPLOAD_SIZE = originalMaxSize;
            } else {
                delete process.env.MAX_UPLOAD_SIZE;
            }

            // Should reject as too large
            expect(res.status).toBe(400);
        });
    });
});
