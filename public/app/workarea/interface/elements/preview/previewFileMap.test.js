import { describe, it, expect } from 'vitest';
import { documentMimeFor } from './previewFileMap.js';

describe('previewFileMap', () => {
    describe('documentMimeFor', () => {
        it('maps common document and media extensions', () => {
            expect(documentMimeFor('report.pdf')).toBe('application/pdf');
            expect(documentMimeFor('a/b/pres.pptx')).toBe(
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            );
            expect(documentMimeFor('song.mp3')).toBe('audio/mpeg');
        });

        it('defaults to octet-stream for unknown extensions', () => {
            expect(documentMimeFor('file.xyz')).toBe('application/octet-stream');
            expect(documentMimeFor('noextension')).toBe('application/octet-stream');
        });
    });
});
