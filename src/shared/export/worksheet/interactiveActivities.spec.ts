import { describe, expect, it } from 'bun:test';
import { getSupportedIdeviceTypes } from './adapters/registry';
import { getIdeviceConfig } from '../browser/idevice-config-browser';
import { getNonActivityIdevices, isInteractiveActivity } from './interactiveActivities';

describe('isInteractiveActivity', () => {
    it('counts the gamified iDevices as activities', () => {
        for (const type of ['guess', 'crossword', 'complete', 'classify', 'dragdrop', 'map', 'puzzle', 'trivial'])
            expect(isInteractiveActivity(type)).toBe(true);
    });

    it('leaves out the iDevices that render from stored JSON', () => {
        for (const type of ['text', 'form', 'trueorfalse', 'image-gallery', 'markdown-text'])
            expect(isInteractiveActivity(type)).toBe(false);
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

    it('treats an unrecognised iDevice as an activity', () => {
        // Deliberate: an iDevice this code has never heard of is assumed to be an activity, so
        // printing asks about it rather than silently printing a game board. The cost of being
        // wrong is one question; the cost the other way is an unusable handout.
        expect(isInteractiveActivity('some-new-idevice')).toBe(true);
    });

    it('says no for an empty type', () => {
        expect(isInteractiveActivity('')).toBe(false);
    });

    describe('the iDevices deliberately left out', () => {
        it('are not offered as activities', () => {
            for (const { type } of getNonActivityIdevices()) expect(isInteractiveActivity(type)).toBe(false);
        });

        it('lists the seven, sorted, each with a reason', () => {
            const excluded = getNonActivityIdevices();

            expect(excluded.map(entry => entry.type)).toEqual([
                'checklist',
                'download-source-file',
                'external-website',
                'geogebra-activity',
                'progress-report',
                'rubric',
                'udl-content',
            ]);
            for (const entry of excluded) expect(entry.reason.length).toBeGreaterThan(0);
        });

        it('would otherwise have counted, so none of them is dead weight', () => {
            // An entry for a json iDevice would be excluded twice over and quietly rot. If this
            // fails, the iDevice changed its component-type and the entry should go.
            for (const { type } of getNonActivityIdevices()) expect(getIdeviceConfig(type).componentType).toBe('html');
        });
    });

    it('counts every iDevice that already has a printable form', () => {
        // The invariant that makes the feature coherent: an adapter exists to convert an
        // interactive activity, so an adapter for a type printing never asks about would never
        // run.
        for (const type of getSupportedIdeviceTypes()) expect(isInteractiveActivity(type)).toBe(true);
    });
});
