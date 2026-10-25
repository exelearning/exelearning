import { describe, expect, it } from 'bun:test';
import { getSupportedIdeviceTypes } from './adapters/registry';
import { getIdeviceConfig } from '../browser/idevice-config-browser';
import { getNeverPrintableIdevices, isInteractiveActivity, isNeverPrintable } from './interactiveActivities';

describe('isInteractiveActivity', () => {
    it('counts the gamified iDevices as activities', () => {
        for (const type of ['guess', 'crossword', 'complete', 'classify', 'dragdrop', 'map', 'puzzle', 'trivial'])
            expect(isInteractiveActivity(type)).toBe(true);
    });

    it('leaves out the iDevices that render content rather than an exercise', () => {
        for (const type of ['text', 'image-gallery', 'markdown-text', 'slide', 'udl-content', 'checklist'])
            expect(isInteractiveActivity(type)).toBe(false);
    });

    it('counts an activity by its adapter, however it stores its data', () => {
        // How an iDevice stores its data says nothing about whether the student has to work
        // through it. These four store JSON, and each has a printed form.
        for (const type of ['adaptative-quiz', 'form', 'trueorfalse', 'scrambled-list'])
            expect(isInteractiveActivity(type)).toBe(true);
    });

    it('leaves out digcompedu and lomloe, which declare json in their config.xml', () => {
        expect(isInteractiveActivity('digcompedu')).toBe(false);
        expect(isInteractiveActivity('lomloe')).toBe(false);
    });

    it('recognises a type written the legacy way', () => {
        // Classification goes through the shim's normalisation rather than matching the string,
        // so the PascalCase spelling lands on the same answer as the kebab-case one.
        expect(isInteractiveActivity('MarkdownTextIdevice')).toBe(isInteractiveActivity('markdown-text'));
        expect(isInteractiveActivity('CrosswordIdevice')).toBe(isInteractiveActivity('crossword'));
    });

    it('leaves out an iDevice it does not know, which prints as it always has', () => {
        // One an administrator installed is content of its own: taken for an activity, it would
        // be replaced by a pointer to a note saying it cannot be printed.
        expect(isInteractiveActivity('my-accordion')).toBe(false);
        expect(isInteractiveActivity('some-new-idevice')).toBe(false);
    });

    it('says no for an empty type', () => {
        expect(isInteractiveActivity('')).toBe(false);
    });

    it('counts every iDevice that already has a printable form', () => {
        // The invariant that makes the feature coherent: an adapter exists to convert an
        // interactive activity, so an adapter for a type printing never asks about would never
        // run.
        for (const type of getSupportedIdeviceTypes()) expect(isInteractiveActivity(type)).toBe(true);
    });
});

describe('the activities that will never have a printed form', () => {
    it('names the ones whose answer is settled', () => {
        expect(getNeverPrintableIdevices().map(entry => entry.type)).toEqual([
            'download-source-file',
            'external-website',
            'file-attachment',
            'geogebra-activity',
            'interactive-video',
            'magnifier',
            'map',
            'progress-report',
            'puzzle',
            'quick-questions-video',
            'trivial',
        ]);
    });

    it('counts one as an activity even when it stores its data as JSON', () => {
        // A magnifier and a file list are json iDevices and nothing else would count them.
        for (const type of ['magnifier', 'file-attachment']) {
            expect(getIdeviceConfig(type).componentType).toBe('json');
            expect(isInteractiveActivity(type)).toBe(true);
        }
    });

    it('says why for each of them', () => {
        for (const { reason } of getNeverPrintableIdevices()) expect(reason.length).toBeGreaterThan(10);
    });

    it('recognises them however the type is written', () => {
        expect(isNeverPrintable('trivial')).toBe(true);
        expect(isNeverPrintable('interactive-video')).toBe(true);
        expect(isNeverPrintable('quick-questions-video')).toBe(true);
    });

    it('says nothing about an activity that has a printed form', () => {
        // The distinction is the whole point: these become exercises, the others never will.
        expect(isNeverPrintable('identify')).toBe(false);
        expect(isNeverPrintable('trueorfalse')).toBe(false);
    });

    it('still counts them as interactive, so printing keeps asking about them', () => {
        // They are activities; what is settled is only whether they become an exercise.
        for (const { type } of getNeverPrintableIdevices()) expect(isInteractiveActivity(type)).toBe(true);
    });

    it('never names one that already has an adapter', () => {
        const supported = new Set(getSupportedIdeviceTypes());

        for (const { type } of getNeverPrintableIdevices()) expect(supported.has(type)).toBe(false);
    });
});
