import { describe, expect, it } from 'bun:test';
import { getSupportedIdeviceTypes } from './adapters/registry';
import { getIdeviceConfig } from '../browser/idevice-config-browser';
import {
    getJsonActivityIdevices,
    getNeverPrintableIdevices,
    getNonActivityIdevices,
    isInteractiveActivity,
    isNeverPrintable,
} from './interactiveActivities';

describe('isInteractiveActivity', () => {
    it('counts the gamified iDevices as activities', () => {
        for (const type of ['guess', 'crossword', 'complete', 'classify', 'dragdrop', 'map', 'puzzle', 'trivial'])
            expect(isInteractiveActivity(type)).toBe(true);
    });

    it('leaves out the iDevices that render content rather than an exercise', () => {
        for (const type of ['text', 'image-gallery', 'markdown-text', 'slide'])
            expect(isInteractiveActivity(type)).toBe(false);
    });

    it('counts the activities that happen to store their data as JSON', () => {
        // How an iDevice stores its data says nothing about whether the student has to work
        // through it. These four do, so printing must offer the same choices for them.
        for (const type of ['adaptative-quiz', 'form', 'trueorfalse', 'scrambled-list'])
            expect(isInteractiveActivity(type)).toBe(true);
    });

    it('lists those four, sorted, each with a reason', () => {
        const included = getJsonActivityIdevices();

        expect(included.map(entry => entry.type)).toEqual([
            'adaptative-quiz',
            'form',
            'scrambled-list',
            'true-or-false',
            'trueorfalse',
        ]);
        for (const entry of included) expect(entry.reason.length).toBeGreaterThan(0);
    });

    it('would otherwise have been left out, so none of those entries is dead weight', () => {
        // An entry for an HTML iDevice would be counted twice over and quietly rot.
        for (const { type } of getJsonActivityIdevices()) expect(getIdeviceConfig(type).componentType).toBe('json');
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

        it('lists the two, sorted, each with a reason', () => {
            const excluded = getNonActivityIdevices();

            expect(excluded.map(entry => entry.type)).toEqual(['checklist', 'udl-content']);
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

    it('says nothing about an activity that is merely waiting for an adapter', () => {
        // The distinction is the whole point: "yet" promises a release, and these do not get one.
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
