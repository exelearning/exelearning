/**
 * Tests for browser-compatible iDevice Configuration shim
 */
import { describe, it, expect } from 'bun:test';
import {
    getIdeviceConfig,
    isJsonIdevice,
    loadIdeviceConfigs,
    resetIdeviceConfigCache,
    setIdevicesBasePath,
    getIdeviceExportFiles,
} from './idevice-config-browser';

describe('idevice-config-browser', () => {
    describe('getIdeviceConfig', () => {
        it('returns config for text type', () => {
            const config = getIdeviceConfig('text');
            expect(config.cssClass).toBe('text');
            expect(config.componentType).toBe('json'); // text uses JSON for feedback toggle
            expect(config.template).toBe('text.html');
        });

        it('maps FreeTextIdevice to text via freetext key', () => {
            const config = getIdeviceConfig('freetext');
            expect(config.cssClass).toBe('text');
        });

        it('maps freetextfpd to text', () => {
            const config = getIdeviceConfig('freetextfpd');
            expect(config.cssClass).toBe('text');
        });

        it('normalizes FreeTextIdevice to free-text', () => {
            const config = getIdeviceConfig('FreeTextIdevice');
            expect(config.cssClass).toBe('free-text');
        });

        it('maps generic to text', () => {
            const config = getIdeviceConfig('generic');
            expect(config.cssClass).toBe('text');
        });

        it('maps GenericIdevice to text', () => {
            const config = getIdeviceConfig('GenericIdevice');
            expect(config.cssClass).toBe('text');
        });

        it('maps reflection to text', () => {
            const config = getIdeviceConfig('reflection');
            expect(config.cssClass).toBe('text');
        });

        it('maps ReflectionIdevice to text', () => {
            const config = getIdeviceConfig('ReflectionIdevice');
            expect(config.cssClass).toBe('text');
        });

        it('maps reflectionfpd to text', () => {
            const config = getIdeviceConfig('reflectionfpd');
            expect(config.cssClass).toBe('text');
        });

        it('maps multi-choice type correctly', () => {
            const config = getIdeviceConfig('multi-choice');
            expect(config.cssClass).toBe('multi-choice');
            expect(config.template).toBe('multi-choice.html');
        });

        it('maps multichoice to multi-choice', () => {
            const config = getIdeviceConfig('multichoice');
            expect(config.cssClass).toBe('multi-choice');
        });

        it('maps MultiChoiceIdevice to multi-choice', () => {
            const config = getIdeviceConfig('MultiChoiceIdevice');
            expect(config.cssClass).toBe('multi-choice');
        });

        it('maps true-false type correctly', () => {
            const config = getIdeviceConfig('true-false');
            expect(config.cssClass).toBe('true-false');
        });

        it('maps truefalse to true-false', () => {
            const config = getIdeviceConfig('truefalse');
            expect(config.cssClass).toBe('true-false');
        });

        it('maps TrueFalseIdevice to true-false', () => {
            const config = getIdeviceConfig('TrueFalseIdevice');
            expect(config.cssClass).toBe('true-false');
        });

        it('maps cloze type correctly', () => {
            const config = getIdeviceConfig('cloze');
            expect(config.cssClass).toBe('cloze');
        });

        it('maps clozeactivity to cloze', () => {
            const config = getIdeviceConfig('clozeactivity');
            expect(config.cssClass).toBe('cloze');
        });

        it('normalizes ClozeActivityIdevice to cloze-activity', () => {
            const config = getIdeviceConfig('ClozeActivityIdevice');
            expect(config.cssClass).toBe('cloze-activity');
        });

        it('maps case-study to casestudy (directory name)', () => {
            const config = getIdeviceConfig('case-study');
            expect(config.cssClass).toBe('casestudy');
        });

        it('maps casestudy to casestudy (directory name)', () => {
            const config = getIdeviceConfig('casestudy');
            expect(config.cssClass).toBe('casestudy');
        });

        it('maps CaseStudyIdevice to casestudy (directory name)', () => {
            const config = getIdeviceConfig('CaseStudyIdevice');
            expect(config.cssClass).toBe('casestudy');
        });

        it('handles unknown types by normalizing the name', () => {
            const config = getIdeviceConfig('CustomIdevice');
            expect(config.cssClass).toBe('custom');
            expect(config.template).toBe('custom.html');
        });

        it('handles PascalCase types', () => {
            const config = getIdeviceConfig('MyCustomType');
            expect(config.cssClass).toBe('my-custom-type');
        });

        it('handles empty string by defaulting to text', () => {
            const config = getIdeviceConfig('');
            expect(config.cssClass).toBe('text');
        });

        it('returns correct componentType based on idevice type', () => {
            // JSON idevices that need JS initialization (feedback toggle, etc.)
            expect(getIdeviceConfig('text').componentType).toBe('json');
            expect(getIdeviceConfig('freetext').componentType).toBe('json');
            expect(getIdeviceConfig('reflection').componentType).toBe('json');

            // HTML idevices (no JS initialization needed)
            expect(getIdeviceConfig('multi-choice').componentType).toBe('html');
            expect(getIdeviceConfig('unknown').componentType).toBe('html');
        });

        it('generates template name from cssClass', () => {
            const config = getIdeviceConfig('some-type');
            expect(config.template).toBe(`${config.cssClass}.html`);
        });
    });

    describe('isJsonIdevice', () => {
        it('returns true for multi-choice', () => {
            expect(isJsonIdevice('multi-choice')).toBe(true);
        });

        it('returns true for multichoice', () => {
            expect(isJsonIdevice('multichoice')).toBe(true);
        });

        it('returns true for MultiChoiceIdevice', () => {
            expect(isJsonIdevice('MultiChoiceIdevice')).toBe(true);
        });

        it('returns true for true-false', () => {
            expect(isJsonIdevice('true-false')).toBe(true);
        });

        it('returns true for truefalse', () => {
            expect(isJsonIdevice('truefalse')).toBe(true);
        });

        it('returns true for TrueFalseIdevice', () => {
            expect(isJsonIdevice('TrueFalseIdevice')).toBe(true);
        });

        it('returns true for cloze', () => {
            expect(isJsonIdevice('cloze')).toBe(true);
        });

        it('returns true for clozeactivity', () => {
            expect(isJsonIdevice('clozeactivity')).toBe(true);
        });

        it('returns true for ClozeActivityIdevice', () => {
            expect(isJsonIdevice('ClozeActivityIdevice')).toBe(true);
        });

        it('returns true for drag-and-drop', () => {
            expect(isJsonIdevice('drag-and-drop')).toBe(true);
        });

        it('returns true for draganddrop', () => {
            expect(isJsonIdevice('draganddrop')).toBe(true);
        });

        it('returns true for fill-blanks', () => {
            expect(isJsonIdevice('fill-blanks')).toBe(true);
        });

        it('returns true for fillblanks', () => {
            expect(isJsonIdevice('fillblanks')).toBe(true);
        });

        it('returns true for matching', () => {
            expect(isJsonIdevice('matching')).toBe(true);
        });

        it('returns true for ordering', () => {
            expect(isJsonIdevice('ordering')).toBe(true);
        });

        it('returns false for text', () => {
            expect(isJsonIdevice('text')).toBe(false);
        });

        it('returns false for FreeTextIdevice', () => {
            expect(isJsonIdevice('FreeTextIdevice')).toBe(false);
        });

        it('returns false for unknown types', () => {
            expect(isJsonIdevice('unknown')).toBe(false);
        });

        it('returns false for empty string', () => {
            expect(isJsonIdevice('')).toBe(false);
        });
    });

    describe('stub functions', () => {
        it('loadIdeviceConfigs is a no-op', () => {
            // Should not throw
            expect(() => loadIdeviceConfigs()).not.toThrow();
        });

        it('resetIdeviceConfigCache is a no-op', () => {
            // Should not throw
            expect(() => resetIdeviceConfigCache()).not.toThrow();
        });

        it('setIdevicesBasePath is a no-op', () => {
            // Should not throw
            expect(() => setIdevicesBasePath()).not.toThrow();
        });
    });

    describe('getIdeviceExportFiles', () => {
        it('returns main JS file for unknown iDevice', () => {
            const files = getIdeviceExportFiles('unknown', '.js');
            expect(files).toEqual(['unknown.js']);
        });

        it('returns main CSS file for iDevice without dependencies', () => {
            const files = getIdeviceExportFiles('checklist', '.css');
            expect(files).toEqual(['checklist.css']);
        });

        it('includes simple-lightbox.min.css for image-gallery', () => {
            const files = getIdeviceExportFiles('image-gallery', '.css');
            expect(files).toContain('image-gallery.css');
            expect(files).toContain('simple-lightbox.min.css');
            expect(files[0]).toBe('image-gallery.css'); // main file first
        });

        it('includes html2canvas.js for checklist', () => {
            const files = getIdeviceExportFiles('checklist', '.js');
            expect(files).toContain('checklist.js');
            expect(files).toContain('html2canvas.js');
            expect(files[0]).toBe('checklist.js'); // main file first
        });

        it('includes html2canvas.js for progress-report', () => {
            const files = getIdeviceExportFiles('progress-report', '.js');
            expect(files).toContain('progress-report.js');
            expect(files).toContain('html2canvas.js');
            expect(files[0]).toBe('progress-report.js'); // main file first
        });

        it('includes mansory-jq.js for select-media-files', () => {
            const files = getIdeviceExportFiles('select-media-files', '.js');
            expect(files).toContain('select-media-files.js');
            expect(files).toContain('mansory-jq.js');
        });

        it('includes simple-lightbox.min.js for image-gallery', () => {
            const files = getIdeviceExportFiles('image-gallery', '.js');
            expect(files).toContain('image-gallery.js');
            expect(files).toContain('simple-lightbox.min.js');
        });

        it('returns just main file for iDevice without dependencies', () => {
            const files = getIdeviceExportFiles('text', '.js');
            expect(files).toEqual(['text.js']);
        });
    });
});
