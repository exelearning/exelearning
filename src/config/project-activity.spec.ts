import { describe, it, expect } from 'bun:test';
import {
    DEFAULT_PROJECT_ACTIVITY_RETENTION_DAYS,
    getProjectActivityConfig,
    parseEditorAccess,
    parseRetentionDays,
} from './project-activity';

describe('project activity configuration', () => {
    it('defaults to 90 days when the variable is missing or empty', () => {
        expect(parseRetentionDays(undefined)).toBe(DEFAULT_PROJECT_ACTIVITY_RETENTION_DAYS);
        expect(parseRetentionDays(null)).toBe(90);
        expect(parseRetentionDays('')).toBe(90);
        expect(parseRetentionDays('   ')).toBe(90);
    });

    it('accepts positive integers and zero', () => {
        expect(parseRetentionDays('30')).toBe(30);
        expect(parseRetentionDays(' 365 ')).toBe(365);
        expect(parseRetentionDays('0')).toBe(0);
    });

    it('falls back on negative, non-integer, invalid and overflowing values', () => {
        expect(parseRetentionDays('-5')).toBe(90);
        expect(parseRetentionDays('1.5')).toBe(90);
        expect(parseRetentionDays('abc')).toBe(90);
        expect(parseRetentionDays('1e3')).toBe(90);
        expect(parseRetentionDays('99999999999999999999')).toBe(90);
    });

    it('parses editor access as a boolean with a false default', () => {
        expect(parseEditorAccess(undefined)).toBe(false);
        expect(parseEditorAccess('')).toBe(false);
        expect(parseEditorAccess('true')).toBe(true);
        expect(parseEditorAccess('YES')).toBe(true);
        expect(parseEditorAccess('1')).toBe(true);
        expect(parseEditorAccess('off')).toBe(false);
        expect(parseEditorAccess('maybe')).toBe(false);
    });

    it('builds the config from an environment object and re-reads it on every call', () => {
        const env: Record<string, string | undefined> = {};
        expect(getProjectActivityConfig(env)).toEqual({
            retentionDays: 90,
            recordingEnabled: true,
            editorAccess: false,
        });

        env.PROJECT_ACTIVITY_RETENTION_DAYS = '0';
        env.PROJECT_ACTIVITY_EDITOR_ACCESS = 'true';
        expect(getProjectActivityConfig(env)).toEqual({
            retentionDays: 0,
            recordingEnabled: false,
            editorAccess: true,
        });

        env.PROJECT_ACTIVITY_RETENTION_DAYS = '7';
        expect(getProjectActivityConfig(env).recordingEnabled).toBe(true);
    });

    it('reads process.env by default', () => {
        const previous = process.env.PROJECT_ACTIVITY_RETENTION_DAYS;
        process.env.PROJECT_ACTIVITY_RETENTION_DAYS = '12';
        try {
            expect(getProjectActivityConfig().retentionDays).toBe(12);
        } finally {
            if (previous === undefined) delete process.env.PROJECT_ACTIVITY_RETENTION_DAYS;
            else process.env.PROJECT_ACTIVITY_RETENTION_DAYS = previous;
        }
    });
});
