/* eslint-disable no-undef */
import * as Y from 'yjs';
import { buildMissingAssetsNotice } from './missingAssetsNotice.js';

function navigation(pages) {
    const convert = (value) => {
        if (Array.isArray(value)) {
            const array = new Y.Array();
            array.push(value.map(convert));
            return array;
        }
        if (value && typeof value === 'object') {
            return new Y.Map(Object.entries(value).map(([key, item]) => [key, convert(item)]));
        }
        return value;
    };
    const result = new Y.Doc().getArray('navigation');
    result.push(pages.map(convert));
    return result;
}

describe('buildMissingAssetsNotice', () => {
    it('returns null when the import reported nothing missing', () => {
        expect(buildMissingAssetsNotice([])).toBeNull();
    });

    it('returns null when the import did not report at all', () => {
        expect(buildMissingAssetsNotice(undefined)).toBeNull();
        expect(buildMissingAssetsNotice(null)).toBeNull();
    });

    it('names the activity and the file it references', () => {
        const notice = buildMissingAssetsNotice([
            { componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg'] },
        ]);

        expect(notice).not.toBeNull();
        expect(notice.body).toContain('iDevice');
        expect(notice.body).not.toContain('classify');
        expect(notice.body).toContain('rabbit.svg');
    });

    it('uses page-wide display order, including unaffected activities and nested pages', () => {
        const pages = navigation([
            { id: 'root', pageName: 'Home', blocks: [] },
            { id: 'child', parentId: 'root', pageName: 'Classify content', blocks: [
                { order: 8, components: [{ id: 'c3', order: 9 }, { id: 'c2' }, { id: 'middle', order: 0.5 }] },
                { order: 1, components: [{ id: 'unaffected' }] },
            ] },
            { id: 'other', pageName: 'Other page', blocks: [{ components: [{ id: 'c4' }] }] },
        ]);
        const notice = buildMissingAssetsNotice([
            { componentId: 'c3', ideviceType: 'classify', paths: ['rabbit.svg'] },
            { componentId: 'c2', ideviceType: 'classify', paths: ['leon.svg'] },
            { componentId: 'c4', ideviceType: 'classify', paths: ['diagram.svg'] },
        ], pages, () => 'Clasifica');
        expect(notice.body).toContain('iDevice 4 (Clasifica) on page &quot;Classify content&quot;');
        expect(notice.body).toContain('iDevice 3 (Clasifica) on page &quot;Classify content&quot;');
        expect(notice.body).toContain('iDevice 1 (Clasifica) on page &quot;Other page&quot;');
        expect(notice.body).not.toContain('classify');
    });

    it('localizes the wording and escapes names without replacing placeholders inside them', () => {
        const translate = vi.spyOn(globalThis, '_').mockImplementation((key) => ({
            'iDevice %1': 'Actividad %1',
            '%1 on page "%2"': 'En "%2": %1',
        }[key] || key));
        try {
            const notice = buildMissingAssetsNotice([
                { componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg'] },
            ], navigation([{ pageName: '<img src=x> %1', blocks: [{ components: [{ id: 'c1' }] }] }]),
            () => '<script> %2 & "title"');
            expect(notice.body).toContain('En &quot;&lt;img src=x&gt; %1&quot;: Actividad 1');
            expect(notice.body).toContain('&lt;script&gt; %2 &amp; &quot;title&quot;');
            expect(notice.body).not.toContain('<img');
            expect(notice.body).not.toContain('<script>');
        } finally {
            translate.mockRestore();
        }
    });

    it('handles unavailable components, unnamed pages and empty containers', () => {
        const pages = navigation([
            { pageName: 'Empty' },
            { blocks: [{}, { components: [{ id: 'c1' }] }] },
        ]);
        const notice = buildMissingAssetsNotice([
            { componentId: 'c1', ideviceType: 'unknown', paths: ['one.svg'] },
            { componentId: 'missing', ideviceType: 'classify', paths: ['two.svg'] },
        ], pages, type => type === 'classify' ? 'Clasifica' : undefined);
        expect(notice.body).toContain('<strong>iDevice 1</strong>');
        expect(notice.body).toContain('<strong>iDevice (Clasifica)</strong>');
        expect(notice.body).not.toContain('undefined');
        expect(notice.body).not.toContain('unknown');
    });

    it('lists every file of an activity', () => {
        const notice = buildMissingAssetsNotice([
            { componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg', 'leon.svg'] },
        ]);

        expect(notice.body).toContain('rabbit.svg');
        expect(notice.body).toContain('leon.svg');
    });

    it('lists every affected activity', () => {
        const notice = buildMissingAssetsNotice([
            { componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg'] },
            { componentId: 'c2', ideviceType: 'text', paths: ['diagram.png'] },
        ]);

        expect(notice.body).toContain('iDevice');
        expect(notice.body).not.toContain('classify');
        expect(notice.body).not.toContain('<strong>text</strong>');
        expect(notice.body).toContain('rabbit.svg');
        expect(notice.body).toContain('diagram.png');
    });

    it('escapes activity and file names so a crafted package cannot inject markup', () => {
        const notice = buildMissingAssetsNotice([
            { componentId: 'c1', ideviceType: '<img onerror=alert(1)>', paths: ['<script>x</script>.png'] },
        ]);

        expect(notice.body).not.toContain('<img');
        expect(notice.body).not.toContain('<script>');
        expect(notice.body).toContain('&lt;script&gt;');
    });

    it('caps a runaway list and says how many were left out', () => {
        const paths = Array.from({ length: 30 }, (_, i) => `file-${i}.png`);
        const notice = buildMissingAssetsNotice([{ componentId: 'c1', ideviceType: 'classify', paths }]);

        expect(notice.body).toContain('file-0.png');
        expect(notice.body).toContain('file-9.png');
        // 10 shown, so the remaining 20 are summarised rather than listed.
        expect(notice.body).not.toContain('file-29.png');
        expect(notice.body).toMatch(/20/);
    });

    it('carries a title so the caller can render it as a dialog', () => {
        const notice = buildMissingAssetsNotice([
            { componentId: 'c1', ideviceType: 'classify', paths: ['rabbit.svg'] },
        ]);

        expect(typeof notice.title).toBe('string');
        expect(notice.title.length).toBeGreaterThan(0);
    });

    it('ignores entries that carry no paths', () => {
        expect(buildMissingAssetsNotice([{ componentId: 'c1', ideviceType: 'classify', paths: [] }])).toBeNull();
    });
});
