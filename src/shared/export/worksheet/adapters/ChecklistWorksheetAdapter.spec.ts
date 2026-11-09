import { describe, expect, it } from 'bun:test';
import { encryptDataGame } from '../../utils/dataGameCipher';
import type { PrintableChecklist, WorksheetAdapterOptions } from '../types';
import { ChecklistWorksheetAdapter } from './ChecklistWorksheetAdapter';

/** The wording the editor stores with every checklist, as a Spanish project carries it. */
const MSGS = {
    msgName: 'Nombre',
    msgDate: 'Fecha',
    msgScore: 'Puntuación',
    msgPoint: 'punto',
    msgPoints: 'puntos',
    msgDone: 'Hecho',
    msgInProgress: 'En progreso',
    msgUnrealized: 'No completado',
};

/** One item of each kind the editor offers, in the shape it stores them. */
function storedLevels(): Record<string, unknown>[] {
    return [
        { type: '3', nivel: '0', item: '<span style="font-weight:700">Arte con polígonos</span>', points: '' },
        { type: '0', nivel: '1', item: 'Triángulos', points: '5' },
        { type: '1', nivel: '1', item: 'Geoplanos', points: '1' },
        { type: '2', nivel: '2', item: 'Arte con hilos', points: '10' },
    ];
}

interface ChecklistFixture {
    data?: Record<string, unknown>;
    instructions?: string;
    textAfter?: string;
}

function checklistHtml(fixture: ChecklistFixture = {}): string {
    const data = {
        typeGame: 'Cotejo',
        title: 'Somos artistas',
        subtitle: 'Lista de cotejo de la unidad',
        levels: storedLevels(),
        userData: true,
        useScore: true,
        footer: 'Del <a href="https://crea.educarex.es">Proyecto CREA</a>',
        msgs: MSGS,
        ...fixture.data,
    };

    let html = '<div class="listacotejo-IDevice">';
    if (fixture.instructions)
        html += `<div class="listacotejo-instructions CTJ-instructions">${fixture.instructions}</div>`;
    html += `<div class="listacotejo-DataGame js-hidden">${encryptDataGame(JSON.stringify(data))}</div>`;
    if (fixture.textAfter) html += `<div class="listacotejo-extra-content">${fixture.textAfter}</div>`;
    html += '<img src="logo.png" class="js-hidden listacotejo-LinkLogo" alt="logo" />';

    return `${html}</div>`;
}

function listOf(fixture: ChecklistFixture = {}, options: WorksheetAdapterOptions = {}): PrintableChecklist {
    const activity = ChecklistWorksheetAdapter.build(checklistHtml(fixture), options);
    if (activity?.board?.kind !== 'checklist') throw new Error('Expected a printable checklist');
    return activity.board.list;
}

describe('ChecklistWorksheetAdapter', () => {
    it('declares the iDevice type it handles', () => {
        expect(ChecklistWorksheetAdapter.ideviceType).toBe('checklist');
    });

    it('uses the supplied title and falls back to the default', () => {
        expect(ChecklistWorksheetAdapter.build(checklistHtml(), { title: 'Lista de cotejo' })?.title).toBe(
            'Lista de cotejo',
        );
        expect(ChecklistWorksheetAdapter.build(checklistHtml(), {})?.title).toBe('Checklist');
    });

    it('carries the whole checklist as the board, its items not being questions to number', () => {
        const activity = ChecklistWorksheetAdapter.build(checklistHtml(), {});

        expect(activity?.board?.kind).toBe('checklist');
        expect(activity?.items).toEqual([]);
    });

    it('marks each item as the editor said to mark it', () => {
        expect(listOf().items.map(item => item.marker)).toEqual(['none', 'box', 'boxAndLine', 'states']);
    });

    it('keeps every item at its own level', () => {
        expect(listOf().items.map(item => item.level)).toEqual([0, 1, 1, 2]);
    });

    it('keeps the indent within what the editor offers', () => {
        const levels = [
            { type: '0', nivel: '7', item: 'Deep', points: '' },
            { type: '0', nivel: '-1', item: 'Shallow', points: '' },
            { type: '0', nivel: 'x', item: 'Unreadable', points: '' },
            { type: '0', item: 'Missing', points: '' },
        ];

        expect(listOf({ data: { levels } }).items.map(item => item.level)).toEqual([3, 0, 0, 0]);
    });

    it('prints what each item says, without the styling pasted into it', () => {
        expect(listOf().items[0].text).toBe('<span>Arte con polígonos</span>');
    });

    it('says what each scored item is worth in the activity’s words', () => {
        expect(listOf().items.map(item => item.points)).toEqual([undefined, '(5 puntos)', '(1 punto)', '(10 puntos)']);
    });

    it('leaves the worth out when the activity does not score its items', () => {
        const list = listOf({ data: { useScore: false } });

        expect(list.items.every(item => item.points === undefined)).toBe(true);
        expect(list.score).toBeUndefined();
    });

    it('asks for the score out of what the items add up to', () => {
        // As the runtime adds them: whatever parseInt reads, and nothing for an item with none.
        expect(listOf().score).toEqual({ label: 'Puntuación', total: 16 });
    });

    it('asks for no score when the items add up to nothing', () => {
        const levels = [{ type: '0', nivel: '0', item: 'Unscored', points: '' }];

        expect(listOf({ data: { levels } }).score).toBeUndefined();
    });

    it('asks for no score the activity has no word for', () => {
        expect(listOf({ data: { msgs: { ...MSGS, msgScore: '' } } }).score).toBeUndefined();
    });

    it('writes a scored item’s worth as a bare number when the activity has no word for points', () => {
        const msgs = { ...MSGS, msgPoints: undefined };

        expect(listOf({ data: { msgs } }).items[1].points).toBe('(5)');
    });

    it('writes the states out in the activity’s own words and order', () => {
        expect(listOf().states).toEqual(['Hecho', 'En progreso', 'No completado']);
    });

    it('asks for the learner’s name and date when the activity does', () => {
        expect(listOf().fields).toEqual(['Nombre', 'Fecha']);
    });

    it('asks for neither when the activity does not', () => {
        expect(listOf({ data: { userData: false } }).fields).toEqual([]);
    });

    it('asks for neither when the sheet already does', () => {
        // The worksheet's own header asks for the same learner's name and date.
        expect(listOf({}, { hasIdentityFields: true }).fields).toEqual([]);
    });

    it('leaves out a field the activity has no word for', () => {
        expect(listOf({ data: { msgs: { ...MSGS, msgDate: '' } } }).fields).toEqual(['Nombre']);
    });

    it('escapes the activity’s own words', () => {
        const list = listOf({ data: { msgs: { ...MSGS, msgName: '<b>Alumno</b>', msgPoints: 'pts & más' } } });

        expect(list.fields[0]).toBe('&lt;b&gt;Alumno&lt;/b&gt;');
        expect(list.items[1].points).toBe('(5 pts &amp; más)');
    });

    it('carries the heading and the footer, keeping the footer’s link for print to write its address', () => {
        const list = listOf();

        expect(list.title).toBe('Somos artistas');
        expect(list.subtitle).toBe('Lista de cotejo de la unidad');
        expect(list.footer).toBe('Del <a href="https://crea.educarex.es">Proyecto CREA</a>');
    });

    it('leaves out a heading or a footer the author left empty', () => {
        const list = listOf({ data: { title: '', subtitle: '', footer: '' } });

        expect(list.title).toBeUndefined();
        expect(list.subtitle).toBeUndefined();
        expect(list.footer).toBeUndefined();
    });

    it('prints none of the logos', () => {
        // On screen they are background images, which a browser leaves off the page.
        const html = JSON.stringify(ChecklistWorksheetAdapter.build(checklistHtml(), {}));

        expect(html).not.toContain('logo.png');
    });

    it('reads the instructions and closing text beside the payload', () => {
        const activity = ChecklistWorksheetAdapter.build(
            checklistHtml({ instructions: '<p>Marca lo que hayas hecho.</p>', textAfter: '<p>¡Buen trabajo!</p>' }),
            {},
        );

        expect(activity?.instructions).toBe('<p>Marca lo que hayas hecho.</p>');
        expect(activity?.textAfter).toBe('<p>¡Buen trabajo!</p>');
    });

    it('skips an item the runtime would not draw', () => {
        const levels = [
            { type: '9', nivel: '0', item: 'Unknown kind', points: '' },
            { type: '0', nivel: '0', item: '<script>alert(1)</script>', points: '' },
            { type: '0', nivel: '0', item: 'Kept', points: '' },
        ];

        expect(listOf({ data: { levels } }).items.map(item => item.text)).toEqual(['Kept']);
    });

    it('reports omitted criteria and scores only the ones that print', () => {
        const omissions: string[] = [];
        const levels = [
            { type: '0', nivel: '0', item: 'Kept', points: '2' },
            { type: '0', nivel: '0', item: '<math><mi>x</mi><mo>+</mo><mn>1</mn></math>', points: '10' },
            { type: '9', nivel: '0', item: 'Unknown kind', points: '20' },
            { type: 'constructor', nivel: '0', item: 'Invalid kind', points: '30' },
            { type: '0', nivel: '0', item: '<p><br></p>', points: '40' },
            null,
        ];
        const list = listOf({ data: { levels } }, { onOmission: reason => omissions.push(reason) });

        expect(list.items.map(item => item.text)).toEqual(['Kept']);
        expect(list.score?.total).toBe(2);
        expect(omissions).toEqual(Array(5).fill('invalid-data'));
    });

    it('does not show a score when only omitted criteria have points', () => {
        const levels = [
            { type: '0', nivel: '0', item: 'Unscored', points: '' },
            { type: '0', nivel: '0', item: '<script>alert(1)</script>', points: '10' },
        ];

        expect(listOf({ data: { levels } }).score).toBeUndefined();
    });

    it('reports every omitted criterion when none can print', () => {
        const omissions: string[] = [];
        const levels = [{ type: '0', nivel: '0', item: '<math><mi>x</mi></math>', points: '10' }];
        const activity = ChecklistWorksheetAdapter.build(checklistHtml({ data: { levels } }), {
            onOmission: reason => omissions.push(reason),
        });

        expect(activity).toBeNull();
        expect(omissions).toEqual(['invalid-data']);
    });

    it('keeps a criterion illustrated only by an image and counts its points', () => {
        const levels = [{ type: '0', nivel: '0', item: '<img src="asset://picture" width="1400">', points: '3' }];
        const list = listOf({ data: { levels } });

        expect(list.items[0].text).toContain('src="asset://picture"');
        expect(list.score?.total).toBe(3);
    });

    it('reads an item whose kind and level were stored as numbers', () => {
        const levels = [{ type: 1, nivel: 2, item: 'Numeric', points: 3 }];

        expect(listOf({ data: { levels } }).items).toEqual([
            { text: 'Numeric', level: 2, marker: 'boxAndLine', points: '(3 puntos)' },
        ]);
    });

    it('reads a payload saved without obfuscation', () => {
        const data = { title: 'Plain', levels: [{ type: '0', nivel: '0', item: 'Item', points: '' }], msgs: MSGS };
        const html = `<div class="listacotejo-DataGame js-hidden">${JSON.stringify(data)}</div>`;

        expect(ChecklistWorksheetAdapter.build(html, {})?.board).toMatchObject({ kind: 'checklist' });
    });

    it('prints nothing for a checklist with no items to tick', () => {
        expect(ChecklistWorksheetAdapter.build(checklistHtml({ data: { levels: [] } }), {})).toBeNull();
        expect(ChecklistWorksheetAdapter.build(checklistHtml({ data: { levels: 'none' } }), {})).toBeNull();
    });

    it('prints nothing for a component with no readable payload', () => {
        expect(ChecklistWorksheetAdapter.build('', {})).toBeNull();
        expect(ChecklistWorksheetAdapter.build('<div class="listacotejo-DataGame">not json</div>', {})).toBeNull();
    });

    it('prints a checklist saved without its wording, with nothing to name its states', () => {
        const data = { levels: [{ type: '2', nivel: '0', item: 'Item', points: '' }], userData: true, useScore: true };
        const html = `<div class="listacotejo-DataGame js-hidden">${encryptDataGame(JSON.stringify(data))}</div>`;
        const activity = ChecklistWorksheetAdapter.build(html, {});
        if (activity?.board?.kind !== 'checklist') throw new Error('Expected a printable checklist');

        expect(activity.board.list.fields).toEqual([]);
        expect(activity.board.list.states).toEqual(['', '', '']);
    });
});
