import { describe, it, expect } from 'bun:test';
import type { NormalizedComponent } from '../services/xml/interfaces';

// We need to import the function, but it's not exported.
// We can temporarily export it or test it via the main function if we mock enough.
// Alternatively, since we are in Javascript/Typescript land, we can usually access non-exported functions via Rewire,
// but Bun doesn't support that easily.
// Best approach: Export the function from export.ts (it's a helper) or test it via `convertYjsStructureToParsed` if accessible.
// Let's modify export.ts to export `transformLegacyIdeviceData` for testing purposes.

// Since I can't modify export.ts in this step, I will write the test assuming it is exported.
// I will then modify export.ts to export it.

import { transformLegacyIdeviceData } from './export';

describe('transformLegacyIdeviceData', () => {
    it('should transform legacy TrueFalseIdevice to trueorfalse game format', () => {
        const legacyComponent: NormalizedComponent = {
            id: 'tf-1',
            blockId: 'block-1',
            blockName: 'T/F',
            blockIconName: 'icon',
            type: 'TrueFalseIdevice',
            properties: {
                questions: [
                    {
                        question: 'Is the sky blue?',
                        feedback: 'Yes',
                        hint: 'Look up',
                        isCorrect: true,
                    },
                    {
                        question: 'Is fire cold?',
                        feedback: 'No',
                        hint: 'Touch it',
                        isCorrect: false,
                    },
                ],
            } as any,
            data: {},
            blockProperties: {},
            content: {},
        };

        const result = transformLegacyIdeviceData(legacyComponent);

        expect(result.type).toBe('trueorfalse');
        expect(result.properties?.questionsGame).toBeDefined();

        const questions = result.properties?.questionsGame as any[];
        expect(questions).toHaveLength(2);

        expect(questions[0].question).toBe('Is the sky blue?');
        expect(questions[0].feedback).toBe('Yes');
        expect(questions[0].suggestion).toBe('Look up');
        expect(questions[0].solution).toBe(1); // True

        expect(questions[1].question).toBe('Is fire cold?');
        expect(questions[1].solution).toBe(0); // False
    });

    it('should transform legacy FormIdevice to form', () => {
        const legacyComponent: NormalizedComponent = {
            id: 'form-1',
            blockId: 'block-1',
            blockName: 'Form',
            blockIconName: 'icon',
            type: 'FormIdevice',
            properties: {
                someProp: 'value',
            } as any,
            data: {},
            blockProperties: {},
            content: {},
        };

        const result = transformLegacyIdeviceData(legacyComponent);

        expect(result.type).toBe('form');
    });

    it('should normalize legacy ScormIdevice to scorm', () => {
        const legacyComponent: NormalizedComponent = {
            id: 'scorm-1',
            blockId: 'block-1',
            blockName: 'Scorm',
            blockIconName: 'icon',
            type: 'ScormIdevice',
            properties: {} as any,
            data: {},
            blockProperties: {},
            content: {},
        };

        const result = transformLegacyIdeviceData(legacyComponent);

        expect(result.type).toBe('scorm');
    });

    it('should pass through unknown types unchanged', () => {
        const component: NormalizedComponent = {
            id: 'other-1',
            blockId: 'block-1',
            blockName: 'Other',
            blockIconName: 'icon',
            type: 'FreeTextIdevice',
            properties: {} as any,
            data: {},
            blockProperties: {},
            content: {},
        };

        const result = transformLegacyIdeviceData(component);

        expect(result).toBe(component); // Should match reference or strictly deep equal
        expect(result.type).toBe('FreeTextIdevice');
    });
});
