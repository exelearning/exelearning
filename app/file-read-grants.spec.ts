import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createFileReadGrants } = require('./file-read-grants');

describe('file-read-grants', () => {
    let dir: string;
    let project: string;
    let secret: string;

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-read-grants-'));
        project = path.join(dir, 'project.elpx');
        secret = path.join(dir, 'id_rsa');
        fs.writeFileSync(project, 'elpx-bytes');
        fs.writeFileSync(secret, 'private-key');
    });

    afterAll(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('reads a granted file as base64 with its modification time', () => {
        const grants = createFileReadGrants();
        grants.grant(project);

        const result = grants.read(project);

        expect(result.ok).toBe(true);
        expect(Buffer.from(result.base64, 'base64').toString()).toBe('elpx-bytes');
        expect(result.mtimeMs).toBe(fs.statSync(project).mtimeMs);
    });

    it('returns the path it grants, so callers can grant inline', () => {
        expect(createFileReadGrants().grant(project)).toBe(project);
    });

    it('refuses a path the main process never handed to the renderer', () => {
        const grants = createFileReadGrants();
        grants.grant(project);

        expect(grants.read(secret)).toEqual({ ok: false, error: 'Access denied' });
    });

    it('compares resolved paths, so a granted file cannot be used to reach a sibling', () => {
        const grants = createFileReadGrants();
        grants.grant(project);

        expect(grants.read(path.join(dir, 'sub', '..', 'project.elpx')).ok).toBe(true);
        expect(grants.read(`${project}/../id_rsa`)).toEqual({ ok: false, error: 'Access denied' });
    });

    it('ignores empty grants and reports a missing path', () => {
        const grants = createFileReadGrants();
        grants.grant(undefined);
        grants.grant('');

        expect(grants.read('')).toEqual({ ok: false, error: 'No path' });
        expect(grants.read(undefined)).toEqual({ ok: false, error: 'No path' });
    });

    it('reports a read error for a granted file that no longer exists', () => {
        const grants = createFileReadGrants();
        const gone = path.join(dir, 'deleted.elpx');
        grants.grant(gone);

        const result = grants.read(gone);

        expect(result.ok).toBe(false);
        expect(result.error).toContain('ENOENT');
    });
});
