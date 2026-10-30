/**
 * Tests for MermaidPreRenderer, which renders Mermaid diagrams to static SVG with Pele.
 *
 * These run the real `pele` package, so every supported diagram must produce a real SVG:
 * no test accepts an unrendered diagram as success.
 */
import { describe, expect, it } from 'bun:test';
import { render } from 'pele';
import { MermaidPreRenderer } from './MermaidPreRenderer';

const renderer = new MermaidPreRenderer(render);

const DIAGRAMS: Record<string, string> = {
    flowchart: 'flowchart LR\n  A[Inicio] --> B{¿Decisión?}\n  B -->|Sí| C[Fin]',
    graph: 'graph TD;\n  A-->B;\n  A-->C;',
    subgraphs: 'flowchart LR\n  subgraph Uno\n    A --> B\n  end\n  subgraph Dos\n    C --> D\n  end\n  B --> C',
    sequence: 'sequenceDiagram\n  Alumno->>Profesor: Entrega\n  Profesor-->>Alumno: Corrección',
    class: 'classDiagram\n  Animal <|-- Perro\n  class Animal {\n    +String nombre\n  }',
    state: 'stateDiagram-v2\n  [*] --> Borrador\n  Borrador --> Publicado\n  Publicado --> [*]',
    er: 'erDiagram\n  CURSO ||--o{ MATRICULA : tiene',
    gantt: 'gantt\n  dateFormat YYYY-MM-DD\n  section Unidad\n  Tarea :a1, 2026-09-01, 7d\n  Otra :after a1, 5d',
    pie: 'pie title Notas\n  "Aprobado" : 70\n  "Suspenso" : 30',
    mindmap: 'mindmap\n  root((Ciencias))\n    Física\n    Química',
    timeline: 'timeline\n  1936 : Turing\n  1991 : WWW',
    gitGraph: 'gitGraph\n  commit\n  branch develop\n  commit\n  checkout main\n  merge develop',
    journey: 'journey\n  title Día\n  section Mañana\n    Clase: 3: Alumno',
    kanban: 'kanban\n  Pendiente\n    t1[Preparar]\n  Hecho\n    t2[Publicar]',
    architecture: 'architecture-beta\n  service db(database)[BD]\n  service api(server)[API]\n  db:L -- R:api',
};

function pre(code: string, attrs = 'class="mermaid"'): string {
    const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre ${attrs}>${escaped}</pre>`;
}

function viewBox(svg: string): number[] {
    const match = /viewBox="([^"]+)"/.exec(svg);
    return match ? match[1].trim().split(/\s+/).map(Number) : [];
}

describe('MermaidPreRenderer', () => {
    describe('hasMermaid', () => {
        it('detects a pre with the mermaid class token', () => {
            expect(renderer.hasMermaid('<pre class="mermaid">graph TD</pre>')).toBe(true);
            expect(renderer.hasMermaid('<pre class="big mermaid">graph TD</pre>')).toBe(true);
        });

        it('ignores other classes that merely contain the word', () => {
            expect(renderer.hasMermaid('<pre class="language-mermaid">graph TD</pre>')).toBe(false);
            expect(renderer.hasMermaid('<div class="exe-mermaid-rendered"></div>')).toBe(false);
            expect(renderer.hasMermaid('')).toBe(false);
        });
    });

    describe('preRender', () => {
        it('returns HTML without diagrams untouched', async () => {
            const html = '<p>Hello</p>';
            const result = await renderer.preRender(html);
            expect(result).toEqual({
                html,
                hasMermaid: false,
                mermaidRendered: false,
                count: 0,
                failures: [],
            });
        });

        for (const [type, code] of Object.entries(DIAGRAMS)) {
            it(`renders a ${type} diagram to a valid SVG`, async () => {
                const result = await renderer.preRender(`<div>${pre(code)}</div>`);

                expect(result.failures).toEqual([]);
                expect(result.count).toBe(1);
                expect(result.mermaidRendered).toBe(true);
                expect(result.html).not.toContain('<pre');

                const svg = /<svg[\s\S]*<\/svg>/.exec(result.html)?.[0] ?? '';
                expect(svg).toContain('class="pele');
                const [, , width, height] = viewBox(svg);
                expect(width).toBeGreaterThan(0);
                expect(height).toBeGreaterThan(0);
                expect(Number.isFinite(width) && Number.isFinite(height)).toBe(true);
                expect(svg).not.toMatch(/NaN|Infinity/);
                expect(svg).toContain('<text');
            });
        }

        it('keeps the original source in data-mermaid so it can be re-edited', async () => {
            const code = 'flowchart LR\n  A["a < b & c"] --> B["x<br>y"]';
            const result = await renderer.preRender(pre(code));
            const encoded = /data-mermaid="([^"]*)"/.exec(result.html)?.[1] ?? '';
            const decoded = encoded
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&');
            expect(decoded).toBe(code);
        });

        it('decodes numeric entities and line breaks in the source', async () => {
            const html = '<pre class="mermaid">flowchart LR<br>  A[caf&#233;] --&gt; B[&#x41;]</pre>';
            const result = await renderer.preRender(html);
            expect(result.count).toBe(1);
            expect(result.html).toContain('>café<');
        });

        it('keeps the max-width and max-height set on the diagram', async () => {
            const result = await renderer.preRender(pre('graph TD\n A-->B', 'class="mermaid" style="max-width:300px"'));
            expect(result.html).toContain('<div class="exe-mermaid-rendered" style="max-width:300px"');
        });

        it('does not touch code blocks highlighted as Mermaid', async () => {
            const html = pre('graph TD\n A-->B', 'class="language-mermaid"');
            const result = await renderer.preRender(html);
            expect(result.html).toBe(html);
            expect(result.hasMermaid).toBe(false);
        });

        it('renders every diagram on a page without duplicate SVG ids', async () => {
            const html = Object.values(DIAGRAMS)
                .map(code => pre(code))
                .join('\n');
            const result = await renderer.preRender(html);
            expect(result.count).toBe(Object.keys(DIAGRAMS).length);
            const ids = [...result.html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('re-renders legacy markup that still holds a runtime SVG', async () => {
            const html = '<pre class="mermaid" data-processed="true"><svg><g></g></svg>graph TD\n A-->B</pre>';
            const result = await renderer.preRender(html);
            expect(result.count).toBe(1);
            expect(result.html).toContain('data-mermaid="graph TD\n A--&gt;B"');
        });

        it('skips empty diagrams', async () => {
            const result = await renderer.preRender('<pre class="mermaid">  </pre>');
            expect(result.count).toBe(0);
            expect(result.failures).toEqual([]);
        });
    });

    describe('failures', () => {
        it('reports a syntax error with its position and keeps the source', async () => {
            const html = pre('flowchart LR\n  A --> ');
            const result = await renderer.preRender(html);
            expect(result.count).toBe(0);
            expect(result.mermaidRendered).toBe(false);
            expect(result.html).toBe(html);
            expect(result.failures).toHaveLength(1);
            expect(result.failures[0].code).toBe('syntax');
            expect(result.failures[0].message).toContain('line 3');
            expect(result.failures[0].source).toBe('flowchart LR\n  A -->');
        });

        it('reports unsupported diagram types', async () => {
            const result = await renderer.preRender(pre('notADiagram foo'));
            expect(result.failures).toHaveLength(1);
            expect(result.failures[0].code).toBe('unsupported-diagram');
        });

        it('reports diagrams over the source size limit', async () => {
            const result = await renderer.preRender(pre(`graph TD\n${'  A-->B\n'.repeat(8000)}`));
            expect(result.failures[0].code).toBe('limit');
        });

        it('accounts for partial rendering instead of reporting full success', async () => {
            const html = [pre('graph TD\n A-->B'), pre('flowchart LR\n A -->'), pre('pie\n "a": 1')].join('');
            const result = await renderer.preRender(html);
            expect(result.count).toBe(2);
            expect(result.failures).toHaveLength(1);
            expect(result.mermaidRendered).toBe(true);
            expect(result.html.match(/exe-mermaid-rendered/g)).toHaveLength(2);
            expect(result.html).toContain('<pre class="mermaid">flowchart LR');
        });

        it('reports errors thrown by an unavailable renderer', async () => {
            const broken = new MermaidPreRenderer(() => {
                throw new Error('Pele is not loaded');
            });
            const result = await broken.preRender(pre('graph TD\n A-->B'));
            expect(result.failures).toEqual([
                { code: 'error', message: 'Pele is not loaded', source: 'graph TD\n A-->B' },
            ]);
        });
    });

    describe('JSON iDevice data', () => {
        function jsonAttr(data: object): string {
            const json = JSON.stringify(data)
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            return `<div class="idevice_node" data-idevice-json-data="${json}"></div>`;
        }

        it('renders diagrams stored in iDevice properties', async () => {
            const html = jsonAttr({ textTextarea: `<p>Intro</p>${pre('graph TD\n A-->B')}`, other: 1 });
            const result = await renderer.preRender(html);
            expect(result.count).toBe(1);

            const encoded = /data-idevice-json-data="([^"]*)"/.exec(result.html)?.[1] ?? '';
            const data = JSON.parse(
                encoded
                    .replace(/&quot;/g, '"')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&'),
            );
            expect(data.other).toBe(1);
            expect(data.textTextarea).toContain('<p>Intro</p><div class="exe-mermaid-rendered"');
            expect(data.textTextarea).toContain('<svg');
        });

        it('counts failures inside iDevice properties', async () => {
            const result = await renderer.preRender(jsonAttr({ textTextarea: pre('flowchart LR\n A -->') }));
            expect(result.hasMermaid).toBe(true);
            expect(result.failures).toHaveLength(1);
        });

        it('leaves malformed JSON untouched', async () => {
            const html = '<div data-idevice-json-data="{not json &lt;pre class=&quot;mermaid&quot;&gt;"></div>';
            const result = await renderer.preRender(html);
            expect(result.html).toBe(html);
        });
    });

    describe('regressions', () => {
        it('gives Gantt charts a real width without a browser (#2544)', async () => {
            const result = await renderer.preRender(pre(DIAGRAMS.gantt));
            const [, , width, height] = viewBox(result.html);
            expect(width).toBeGreaterThan(100);
            expect(height).toBeGreaterThan(0);
        });

        it('sizes flowcharts from their content, not from a DOM polyfill (#2544)', async () => {
            const result = await renderer.preRender(pre('flowchart LR\n    A --> B'));
            const [, , width, height] = viewBox(result.html);
            expect(width).toBeGreaterThan(50);
            expect(width).toBeLessThan(500);
            expect(height).toBeGreaterThan(20);
        });

        it('wraps long labels inside a box wide enough for them (#2490)', async () => {
            const code =
                'flowchart TD\n  A[El alumnado entrega el trabajo a través de la plataforma del centro] --> B[Se corrige]';
            const result = await renderer.preRender(pre(code));
            const node = /<g class="pele-node[^"]*" data-id="A"[^>]*>([\s\S]*?)<\/g>/.exec(result.html)?.[1] ?? '';
            const rectWidth = Number(/<rect[^>]*width="([\d.]+)"/.exec(node)?.[1]);
            const lines = [...node.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map(m => m[1]);
            expect(lines.length).toBeGreaterThan(1);
            expect(lines.join(' ')).toBe('El alumnado entrega el trabajo a través de la plataforma del centro');
            expect(rectWidth).toBeGreaterThan(0);
        });
    });
});
