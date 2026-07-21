/**
 * Regression coverage for the Euskadi Infantil level labels.
 *
 * The dataset keys remain unchanged because they are part of persisted selection
 * identifiers. Only the labels rendered in the editor use the inclusive age
 * ranges requested for the two cycles.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock eXeLearning globals used by the editor module.
globalThis._ = (str) => str;
globalThis.CSS = { escape: (str) => str.replace(/[^a-zA-Z0-9\-_]/g, '\\$&') };

const src = await import('./lomloe.js?raw').then((module) => module.default);
const factory = new Function('globalThis', '_', 'CSS', `${src}\nreturn $exeDevice;`);
const device = factory(globalThis, globalThis._, globalThis.CSS);

const DATASET = {
    'Haur Hezkuntza': {
        'Lehen zikloa (0-3 urte)': {},
        'Bigarren zikloa (3-6 urte)': {},
    },
};

// A restored criterio selection whose `nivel` holds the canonical dataset key.
// The editor must show the remapped inclusive label wherever the level is
// presented to the teacher, while the persisted key stays untouched.
const CRITERIO_SELECTION = {
    id: ['criterio', 'Haur Hezkuntza', 'Lehen zikloa (0-3 urte)', 'AREA', 'CE1', 'C1'].join('\x1F'),
    type: 'criterio',
    dataset: 'ES-PV',
    etapa: 'Haur Hezkuntza',
    nivel: 'Lehen zikloa (0-3 urte)',
    codArea: 'AREA',
    denominacion: 'Test Area',
    codigoComp: 'CE1',
    descripcionComp: 'Competency description',
    codigoCriterio: 'C1',
    descripcionCriterio: 'Criterion description',
    competenciasClave: [],
    partial: false,
};

function buildMockElement() {
    const element = document.createElement('article');
    element.setAttribute('idevice-id', 'test-lomloe-es-pv-level-labels');
    element.setAttribute('class', 'box idevice_node lomloe');
    document.body.appendChild(element);
    return element;
}

afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

describe('Euskadi Infantil level labels', () => {
    it('renders inclusive age labels while keeping canonical dataset keys', async () => {
        const element = buildMockElement();
        globalThis.fetch = vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(DATASET),
        }));

        device.init(element, {
            lomloeDataset: 'ES-PV',
            lomloeSelections: [],
        });

        await new Promise((resolve) => setTimeout(resolve, 50));

        const buttons = [...element.querySelectorAll('.lomloe-nivel-btn')];
        expect(buttons.map((button) => button.textContent)).toEqual([
            'Lehen zikloa (0-2 urte)',
            'Bigarren zikloa (3-5 urte)',
        ]);
        expect(buttons.map((button) => button.dataset.nivel)).toEqual([
            'Lehen zikloa (0-3 urte)',
            'Bigarren zikloa (3-6 urte)',
        ]);
        expect(device.save().lomloeSelectedNivel).toBe('Lehen zikloa (0-3 urte)');
    });

    it('remaps the Infantil level label in the selection panel and summary tooltip', async () => {
        const element = buildMockElement();
        globalThis.fetch = vi.fn(() => Promise.resolve({
            ok: true,
            json: () => Promise.resolve(DATASET),
        }));

        device.init(element, {
            lomloeDataset: 'ES-PV',
            lomloeSelections: [structuredClone(CRITERIO_SELECTION)],
        });

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Selection panel group title must use the inclusive (remapped) label,
        // not the raw canonical dataset key.
        const groupTitle = element.querySelector('.lomloe-selected-group-title');
        expect(groupTitle.textContent).toBe('Haur Hezkuntza · Lehen zikloa (0-2 urte) · Test Area');
        expect(groupTitle.textContent).not.toContain('0-3');

        // The exported/persisted summary tooltip must also use the remapped label.
        const summaryHtml = device.save().lomloeSummaryHtml;
        expect(summaryHtml).toContain('data-lomloe-tip="Haur Hezkuntza · Lehen zikloa (0-2 urte)');
        expect(summaryHtml).not.toContain('0-3 urte');

        // The persisted selection key stays canonical (unchanged).
        expect(device.save().lomloeSelections[0].nivel).toBe('Lehen zikloa (0-3 urte)');
    });
});
