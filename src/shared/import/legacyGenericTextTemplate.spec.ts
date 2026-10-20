import { describe, expect, it } from 'bun:test';
import { isLegacyGenericTextTemplate } from './legacyGenericTextTemplate';

/** The payload eXeLearning 3 stamped on every activity converted from a 2.x package. */
const TEMPLATE = {
    ideviceId: '20250605150704XBOPVK',
    textInfoDurationInput: '',
    textInfoParticipantsInput: '',
    textInfoDurationTextInput: 'Duration:',
    textInfoParticipantsTextInput: 'Grouping:',
    textTextarea: '<div class="mapa-IDevice"><audio src="{{context_path}}/20250605150704XBOPVK/do.mp3"></audio></div>',
    textFeedbackInput: 'Show Feedback',
    textFeedbackTextarea: '',
};

describe('isLegacyGenericTextTemplate', () => {
    it('recognises the eXe 3 text template on an html-type activity', () => {
        expect(isLegacyGenericTextTemplate('map', TEMPLATE)).toBe(true);
    });

    it('recognises a partial template as long as textTextarea is present', () => {
        expect(isLegacyGenericTextTemplate('select-media-files', { ideviceId: 'x', textTextarea: '<p>a</p>' })).toBe(
            true,
        );
    });

    it('keeps the template on text activities, where textTextarea is the content', () => {
        for (const type of [
            'text',
            'FreeTextIdevice',
            'freetext',
            'FreeTextfpdIdevice',
            'GenericIdevice',
            'ReflectionIdevice',
        ]) {
            expect(isLegacyGenericTextTemplate(type, TEMPLATE)).toBe(false);
        }
    });

    it('ignores payloads that carry keys the template never had', () => {
        expect(isLegacyGenericTextTemplate('magnifier', { ...TEMPLATE, glassSize: '2' })).toBe(false);
    });

    it('ignores payloads without textTextarea', () => {
        expect(isLegacyGenericTextTemplate('casestudy', { ideviceId: 'x', textInfoDurationInput: '10' })).toBe(false);
    });

    it('ignores non-object payloads', () => {
        expect(isLegacyGenericTextTemplate('map', null)).toBe(false);
        expect(isLegacyGenericTextTemplate('map', undefined)).toBe(false);
        expect(isLegacyGenericTextTemplate('map', ['textTextarea'] as unknown as Record<string, unknown>)).toBe(false);
    });
});
