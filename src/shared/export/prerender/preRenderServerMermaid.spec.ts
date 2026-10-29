import { describe, expect, it, spyOn } from 'bun:test';
import { ServerMermaidPreRenderer } from './ServerMermaidPreRenderer';
import { preRenderServerMermaid } from './preRenderServerMermaid';

const globals = ['window', 'document', 'navigator', 'Element', 'HTMLElement', 'SVGElement', 'CSSStyleSheet'];
const descriptors = () => globals.map(name => Object.getOwnPropertyDescriptor(globalThis, name));

describe('preRenderServerMermaid', () => {
    it('renders concurrent exports and restores the host globals after each batch', async () => {
        const before = descriptors();
        const results = await Promise.all(
            ['First', 'Second', 'Third'].map(label =>
                preRenderServerMermaid(`<pre class="mermaid">graph LR; A[${label}]-->B[End]</pre>`),
            ),
        );
        for (const [index, label] of ['First', 'Second', 'Third'].entries()) {
            expect(results[index].mermaidRendered).toBe(true);
            expect(results[index].html).toContain('<svg');
            expect(results[index].html).toContain(label);
        }
        expect(descriptors()).toEqual(before);
        const plain = await preRenderServerMermaid('<p>Plain text</p>');
        expect(plain).toMatchObject({ html: '<p>Plain text</p>', hasMermaid: false });
        expect(descriptors()).toEqual(before);
    }, 60_000);

    it('cleans up on failure and lets the next queued request render', async () => {
        const before = descriptors();
        const original = ServerMermaidPreRenderer.prototype.preRender;
        const render = spyOn(ServerMermaidPreRenderer.prototype, 'preRender').mockImplementationOnce(async function () {
            await this.initialize();
            throw new Error('Interrupted render');
        });
        try {
            await expect(preRenderServerMermaid('<pre class="mermaid">graph LR; A-->B</pre>')).rejects.toThrow(
                'Interrupted render',
            );
            expect(descriptors()).toEqual(before);
            render.mockImplementation(original);
            expect((await preRenderServerMermaid('<pre class="mermaid">graph LR; C-->D</pre>')).mermaidRendered).toBe(
                true,
            );
            expect(descriptors()).toEqual(before);
        } finally {
            render.mockRestore();
        }
    }, 60_000);
});
