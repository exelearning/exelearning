import { describe, expect, it } from 'vitest';
import { mediatecaStreamUrl } from './mediateca';

describe('mediatecaStreamUrl', () => {
    it('derives the legacy stream URL from the video id (HTTPS-forced)', () => {
        expect(mediatecaStreamUrl('42')).toBe('https://mediateca.educa.madrid.org/streaming.php?id=42');
    });

    it('encodes the id and tolerates null', () => {
        expect(mediatecaStreamUrl('a b&c')).toContain('id=a%20b%26c');
        expect(mediatecaStreamUrl(null)).toBe('https://mediateca.educa.madrid.org/streaming.php?id=');
    });
});
