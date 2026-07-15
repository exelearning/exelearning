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
});
