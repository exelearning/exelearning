import { describe, expect, it } from 'bun:test';
import { addUnresolvedAssetRefs, collectUnresolvedAssetRefs } from './unresolvedAssetRefs';

describe('collectUnresolvedAssetRefs', () => {
    it('returns nothing when every reference was rewritten', () => {
        expect(collectUnresolvedAssetRefs('<img src="asset://uuid/rabbit.svg">')).toEqual([]);
    });

    it('returns the path of a reference the importer could not resolve', () => {
        expect(collectUnresolvedAssetRefs('<img src="{{context_path}}/rabbit.svg">')).toEqual(['rabbit.svg']);
    });

    it('collects every distinct unresolved path, in order', () => {
        const html = '<img src="{{context_path}}/leon.svg"><audio src="{{context_path}}/lion_name.mp3">';

        expect(collectUnresolvedAssetRefs(html)).toEqual(['leon.svg', 'lion_name.mp3']);
    });

    it('reports a repeated path once', () => {
        const html = '<img src="{{context_path}}/leon.svg"><img src="{{context_path}}/leon.svg">';

        expect(collectUnresolvedAssetRefs(html)).toEqual(['leon.svg']);
    });

    it('keeps nested paths intact', () => {
        expect(collectUnresolvedAssetRefs('{{context_path}}/content/resources/a/b.png')).toEqual([
            'content/resources/a/b.png',
        ]);
    });

    it('strips the trailing escape a serialized JSON payload leaves behind', () => {
        // Properties reach the importer as escaped JSON: {"url":"{{context_path}}/rabbit.svg\"}
        expect(collectUnresolvedAssetRefs('{"url":"{{context_path}}/rabbit.svg\\"}')).toEqual(['rabbit.svg']);
    });

    it('ignores a bare placeholder with no path', () => {
        expect(collectUnresolvedAssetRefs('{{context_path}} and {{context_path}}/')).toEqual([]);
    });

    it('tolerates empty and non-string input', () => {
        expect(collectUnresolvedAssetRefs('')).toEqual([]);
        expect(collectUnresolvedAssetRefs(null as unknown as string)).toEqual([]);
        expect(collectUnresolvedAssetRefs(undefined as unknown as string)).toEqual([]);
    });
});

describe('addUnresolvedAssetRefs', () => {
    it('leaves the report untouched when the text resolves cleanly', () => {
        const report: Parameters<typeof addUnresolvedAssetRefs>[0] = [];

        addUnresolvedAssetRefs(report, 'c1', 'classify', '<img src="asset://uuid/a.png">');

        expect(report).toEqual([]);
    });

    it('records the activity that owns an unresolved reference', () => {
        const report: Parameters<typeof addUnresolvedAssetRefs>[0] = [];

        addUnresolvedAssetRefs(report, 'c1', 'classify', '<img src="{{context_path}}/rabbit.svg">');

        expect(report).toEqual([{ componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg'] }]);
    });

    it('merges further references into the entry of the same activity', () => {
        const report: Parameters<typeof addUnresolvedAssetRefs>[0] = [];

        addUnresolvedAssetRefs(report, 'c1', 'classify', '{{context_path}}/rabbit.svg');
        addUnresolvedAssetRefs(report, 'c1', 'classify', '{{context_path}}/leon.svg');

        expect(report).toEqual([{ componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg', 'leon.svg'] }]);
    });

    it('does not repeat a path already recorded for the activity', () => {
        const report: Parameters<typeof addUnresolvedAssetRefs>[0] = [];

        addUnresolvedAssetRefs(report, 'c1', 'classify', '{{context_path}}/rabbit.svg');
        addUnresolvedAssetRefs(report, 'c1', 'classify', '{{context_path}}/rabbit.svg');

        expect(report).toEqual([{ componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg'] }]);
    });

    it('keeps separate activities apart', () => {
        const report: Parameters<typeof addUnresolvedAssetRefs>[0] = [];

        addUnresolvedAssetRefs(report, 'c1', 'classify', '{{context_path}}/rabbit.svg');
        addUnresolvedAssetRefs(report, 'c2', 'text', '{{context_path}}/leon.svg');

        expect(report).toEqual([
            { componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg'] },
            { componentId: 'c2', ideviceType: 'text', paths: ['leon.svg'] },
        ]);
    });
});
