import { describe, expect, it } from 'bun:test';
import { renderActivityFragment, renderWorksheet, WORKSHEET_ACTIVITY_STYLES } from './WorksheetRenderer';
import type { PrintableActivity, PrintableChecklist, WorksheetModel } from './types';

function list(overrides: Partial<PrintableChecklist> = {}): PrintableChecklist {
    return {
        title: 'Somos artistas',
        subtitle: 'Lista de cotejo de la unidad',
        fields: ['Nombre', 'Fecha'],
        score: { label: 'Puntuación', total: 16 },
        states: ['Hecho', 'En progreso', 'No completado'],
        items: [
            { text: 'Arte con polígonos', level: 0, marker: 'none' },
            { text: 'Triángulos', level: 1, marker: 'box', points: '(5 puntos)' },
            { text: 'Geoplanos', level: 1, marker: 'boxAndLine' },
            { text: 'Arte con hilos', level: 2, marker: 'states' },
        ],
        footer: 'Del Proyecto CREA',
        ...overrides,
    };
}

function activityWith(checklist: PrintableChecklist): PrintableActivity {
    return { ideviceType: 'checklist', title: 'Checklist', board: { kind: 'checklist', list: checklist }, items: [] };
}

function modelWith(checklist: PrintableChecklist): WorksheetModel {
    return {
        projectTitle: 'Demo',
        language: 'es',
        pages: [{ pageId: 'p1', title: 'Página', activities: [activityWith(checklist)] }],
        unsupported: [],
    };
}

/** The document without its stylesheet, so a class name found is one that was drawn. */
function render(overrides: Partial<PrintableChecklist> = {}): string {
    const html = renderWorksheet(modelWith(list(overrides)), {});

    return html.slice(html.indexOf('<body>'));
}

/** The markup of each item, in order. */
function itemsOf(body: string): string[] {
    return body.match(/<li class="worksheet-checklist-item"[\s\S]*?<\/li>/g) ?? [];
}

const BOX = '<span class="worksheet-option-box"></span>';
const CONTENT = '<div class="worksheet-checklist-content">';

describe('renderWorksheet with a checklist', () => {
    it('draws its heading, then the fields, then the score out of the total', () => {
        const body = render();

        expect(body).toContain(
            '<div class="worksheet-checklist"><p class="worksheet-checklist-title">Somos artistas</p>' +
                '<p class="worksheet-checklist-subtitle">Lista de cotejo de la unidad</p>' +
                '<p class="worksheet-checklist-field"><span>Nombre:</span><span class="worksheet-line"></span></p>' +
                '<p class="worksheet-checklist-field"><span>Fecha:</span><span class="worksheet-line"></span></p>' +
                '<p class="worksheet-checklist-field worksheet-checklist-score"><span>Puntuación:</span>' +
                '<span class="worksheet-line"></span><span>/ 16</span></p>',
        );
    });

    it('draws a box before an item to tick, and nothing before one that heads others', () => {
        const [heading, box] = itemsOf(render());

        expect(heading).toBe(
            `<li class="worksheet-checklist-item">${CONTENT}<span class="worksheet-checklist-text">Arte con polígonos</span></div></li>`,
        );
        expect(box).toContain(`${BOX}${CONTENT}<span class="worksheet-checklist-text">Triángulos</span>`);
        expect(box).toContain('<span class="worksheet-checklist-points">(5 puntos)</span>');
    });

    it('draws a box and a line to write on for a Text item', () => {
        const text = itemsOf(render())[2];

        expect(text).toContain(`${BOX}${CONTENT}<span class="worksheet-checklist-text">Geoplanos</span>`);
        expect(text).toContain('<span class="worksheet-checklist-line"></span>');
    });

    it('writes out each state of a Selection item, each with a dotted blank before it to write in', () => {
        const selection = itemsOf(render())[3];
        const blank = '<span class="worksheet-checklist-blank"></span>';

        expect(selection).toStartWith(
            `<li class="worksheet-checklist-item" style="margin-left: 12mm">${CONTENT}<span class="worksheet-checklist-text">`,
        );
        expect(selection).toContain(
            '<span class="worksheet-checklist-states">' +
                `<span class="worksheet-checklist-state">${blank}Hecho</span>` +
                `<span class="worksheet-checklist-state">${blank}En progreso</span>` +
                `<span class="worksheet-checklist-state">${blank}No completado</span></span>`,
        );
        expect(selection).not.toContain(BOX);
    });

    it('indents each item to its level', () => {
        const indents = itemsOf(render()).map(item => item.match(/margin-left: (\d+)mm/)?.[1] ?? '0');

        expect(indents).toEqual(['0', '6', '6', '12']);
    });

    it('never writes anything but a number into an indent', () => {
        const items = list().items.map(item => ({ ...item, level: Number.NaN }));

        expect(render({ items })).not.toContain('margin-left');
    });

    it('draws no buttons, switches or drop-downs', () => {
        const body = render();

        expect(body).not.toMatch(/<(?:button|select|input)\b/);
    });

    it('closes with the footer', () => {
        expect(render()).toContain('<div class="worksheet-checklist-footer">Del Proyecto CREA</div></div>');
    });

    it('leaves out what the checklist does not ask for', () => {
        const body = render({ title: undefined, subtitle: undefined, fields: [], score: undefined, footer: undefined });

        expect(body).not.toContain('worksheet-checklist-title');
        expect(body).not.toContain('worksheet-checklist-subtitle');
        expect(body).not.toContain('worksheet-checklist-field');
        expect(body).not.toContain('worksheet-checklist-footer');
    });

    it('prints the same list when converted in place', () => {
        const fragment = renderActivityFragment(activityWith(list()));

        expect(fragment).toStartWith('<article class="worksheet-activity" data-idevice="checklist">');
        expect(itemsOf(fragment)).toEqual(itemsOf(render()));
    });

    it('carries the styles the list relies on with the activity styles', () => {
        // In place, the fragment gets these and nothing of the worksheet's own document.
        for (const selector of [
            '.worksheet-checklist-item {',
            '.worksheet-checklist-line {',
            '.worksheet-checklist-states {',
            '.worksheet-checklist-blank {',
            '.worksheet-checklist-score .worksheet-line {',
        ])
            expect(WORKSHEET_ACTIVITY_STYLES).toContain(selector);
        expect(WORKSHEET_ACTIVITY_STYLES).toMatch(/\.worksheet-checklist-item \{[^}]*break-inside: avoid;/);
        expect(WORKSHEET_ACTIVITY_STYLES).toMatch(/\.worksheet-checklist-blank \{[^}]*border-bottom: 1px dotted/);
    });
});
