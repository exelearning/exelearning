/**
 * LOMLOE iDevice — Unit Tests
 *
 * Tests the editor module ($exeDevice) in isolation:
 *   - Selection ID generation
 *   - Save/restore state round-trip
 *   - Summary HTML generation
 *   - Dataset configuration
 *   - Partial flag
 *
 * Run with:  npx vitest run public/files/perm/idevices/base/lomloe/edition/lomloe.test.js
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import esPvDataset from '../data/lomloe-ES-PV.json';

// ── Mock eXeLearning globals ─────────────────────────────────────
globalThis._ = (str) => str;  // i18n passthrough
globalThis.CSS = { escape: (s) => s.replace(/[^a-zA-Z0-9\-_]/g, '\\$&') };

// ── Load module under test ───────────────────────────────────────
const src = await import('./lomloe.js?raw').then(m => m.default).catch(() => null);
if (src) {
    const fn = new Function('globalThis', '_', 'CSS', src + '\nreturn $exeDevice;');
    globalThis.$exeDevice = fn(globalThis, globalThis._, globalThis.CSS);
}

// ── Helpers ──────────────────────────────────────────────────────

const SEP = '\x1F';

function makeSaberSelId(etapa, nivel, codArea, bloque, nombre) {
    return ['saber', etapa, nivel, codArea, bloque, nombre].join(SEP);
}

function makeCriterioSelId(etapa, nivel, codArea, codigoComp, codigoCriterio) {
    return ['criterio', etapa, nivel, codArea, codigoComp, codigoCriterio].join(SEP);
}

const SAMPLE_DATA = {
    'Educación Primaria': {
        '1º Primaria': {
            'MAT': {
                denominacion: 'Matemáticas',
                saberes_basicos: {
                    bloques: {
                        'I. Sentido numérico': [
                            {
                                nombre: 'PM01SBI.1.1',
                                subtitulo_nivel_1: 'Números naturales',
                                subtitulo_nivel_2: '1.1. Conteo y representación'
                            },
                            {
                                nombre: 'PM01SBI.1.2',
                                subtitulo_nivel_1: 'Números naturales',
                                subtitulo_nivel_2: '1.2. Valor posicional'
                            }
                        ]
                    }
                },
                competencias_especificas: {
                    'PMC1': {
                        descripcion: 'Razonar matemáticamente interpretando datos',
                        explicacion_bloque_competencial: 'El desarrollo de esta competencia...',
                        criterios_evaluacion: [
                            {
                                codigo: 'PM01CE1.1',
                                descripcion: 'Interpretar datos cuantitativos del entorno',
                                competencias_clave: ['CCL2', 'STEM1', 'STEM3']
                            },
                            {
                                codigo: 'PM01CE1.2',
                                descripcion: 'Resolver problemas con números naturales',
                                competencias_clave: ['CCL1', 'STEM2']
                            }
                        ]
                    }
                }
            }
        }
    }
};

// Minimal ESO dataset used to exercise the per-course subject filter.
const area = (denominacion) => ({
    denominacion,
    competencias_especificas: {},
    saberes_basicos: { bloques: {} }
});
const ESO_SAMPLE = {
    ESO: {
        '1º ESO': {
            BIG: area('Biología y Geología'),
            FQX: area('Física y Química'),
            GEH: area('Geografía e Historia'),
            EFI: area('Educación Física'),
            DIG: area('Digitalización')
        }
    }
};

function buildMockElement() {
    const el = document.createElement('article');
    el.setAttribute('idevice-id', 'test-lomloe-001');
    el.setAttribute('class', 'box idevice_node lomloe');
    document.body.appendChild(el);
    return el;
}

// ════════════════════════════════════════════════════════════════
describe('LOMLOE iDevice configuration', () => {
    it('is registered as $exeDevice with required interface', () => {
        expect($exeDevice).toBeDefined();
        expect(typeof $exeDevice.init).toBe('function');
        expect(typeof $exeDevice.save).toBe('function');
    });
});

// ════════════════════════════════════════════════════════════════
describe('Selection ID helpers', () => {
    it('saber selection IDs are stable and unique', () => {
        const id1 = makeSaberSelId('Educación Primaria', '1º Primaria', 'MAT', 'I. Sentido', 'PM01SBI.1.1');
        const id2 = makeSaberSelId('Educación Primaria', '1º Primaria', 'MAT', 'I. Sentido', 'PM01SBI.1.2');
        expect(id1).toContain('saber');
        expect(id1).not.toBe(id2);
        expect(id1.split('\x1F')).toHaveLength(6);
    });

    it('criterio selection IDs are stable and unique', () => {
        const id1 = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.1');
        const id2 = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.2');
        expect(id1).toContain('criterio');
        expect(id1).not.toBe(id2);
        expect(id1.split('\x1F')).toHaveLength(6);
    });

    it('saber and criterio IDs with same fields are distinguishable', () => {
        const saberId = makeSaberSelId('ESO', '1º ESO', 'BIG', 'Bloque I', 'code');
        const critId  = makeCriterioSelId('ESO', '1º ESO', 'BIG', 'comp1', 'code');
        expect(saberId.startsWith('saber')).toBe(true);
        expect(critId.startsWith('criterio')).toBe(true);
        expect(saberId).not.toBe(critId);
    });
});

// ════════════════════════════════════════════════════════════════
describe('Save / restore round-trip', () => {
    let el;

    beforeEach(() => {
        el = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(SAMPLE_DATA)
            })
        );
    });

    afterEach(() => {
        el && el.remove();
        vi.restoreAllMocks();
    });

    it('save() returns required keys when called with no selections', async () => {
        $exeDevice.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        const data = $exeDevice.save();
        expect(data).toHaveProperty('ideviceId');
        expect(data).toHaveProperty('lomloeDataset');
        expect(data).toHaveProperty('lomloeSelections');
        expect(data).toHaveProperty('lomloeSummaryHtml');
        expect(Array.isArray(data.lomloeSelections)).toBe(true);
        expect(data.lomloeSelections).toHaveLength(0);
    });

    it('save() preserves lomloeDataset using ISO 3166-2:ES code', async () => {
        $exeDevice.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        const data = $exeDevice.save();
        expect(data.lomloeDataset).toBe('ES-CN');
    });

    it('init() restores selections from previousData and migrates old fields', async () => {
        const selId = makeSaberSelId('Educación Primaria', '1º Primaria', 'MAT', 'I. Sentido', 'PM01SBI.1.1');
        const previousData = {
            lomloeDataset: 'ES-CN',
            lomloeActiveTab: 'saberes',
            lomloeSelectedEtapa: 'Educación Primaria',
            lomloeSelectedNivel: '1º Primaria',
            lomloeSelectedMateria: { codArea: 'MAT', denominacion: 'Matemáticas' },
            lomloeSelections: [
                {
                    id: selId,
                    type: 'saber',
                    dataset: 'ES-CN',
                    etapa: 'Educación Primaria',
                    nivel: '1º Primaria',
                    codArea: 'MAT',
                    denominacion: 'Matemáticas',
                    bloque: 'I. Sentido numérico',
                    nombre: 'PM01SBI.1.1',
                    subtitulo1: 'Números naturales',
                    subtitulo2: '1.1. Conteo y representación',
                    coverage: 'introduced',
                    notes: 'Test note'
                }
            ]
        };

        $exeDevice.init(el, previousData);
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();

        expect(saved.lomloeSelections).toHaveLength(1);
        expect(saved.lomloeSelections[0].id).toBe(selId);
        expect(saved.lomloeSelections[0].coverage).toBeUndefined();
        expect(saved.lomloeSelections[0].notes).toBeUndefined();
        expect(saved.lomloeSelections[0].linkedSaberes).toBeUndefined();
    });

    it('save() → init() → save() preserves all criterio fields', async () => {
        const selId = makeCriterioSelId('ESO', '1º ESO', 'EFI', 'EFI_C1', 'EFI01CE1.1');
        const sel = {
            id: selId,
            type: 'criterio',
            dataset: 'ES-CN',
            etapa: 'ESO',
            nivel: '1º ESO',
            codArea: 'EFI',
            denominacion: 'Educación Física',
            codigoComp: 'EFI_C1',
            descripcionComp: 'Competencia sobre actividad física',
            codigoCriterio: 'EFI01CE1.1',
            descripcionCriterio: 'Criterio sobre actividad física saludable',
            competenciasClave: ['CPSAA1', 'STEM2'],
            partial: true
        };

        const prev = {
            lomloeDataset: 'ES-CN',
            lomloeActiveTab: 'competencias',
            lomloeSelectedEtapa: 'ESO',
            lomloeSelectedNivel: '1º ESO',
            lomloeSelectedMateria: { codArea: 'EFI', denominacion: 'Educación Física' },
            lomloeSelections: [sel]
        };

        $exeDevice.init(el, prev);
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        const restoredSel = saved.lomloeSelections[0];

        expect(restoredSel.type).toBe('criterio');
        expect(restoredSel.codigoCriterio).toBe('EFI01CE1.1');
        expect(restoredSel.competenciasClave).toEqual(['CPSAA1', 'STEM2']);
        expect(restoredSel.partial).toBe(true);
    });

    it('migrates old criterio with coverage/notes/linkedSaberes', async () => {
        const selId = makeCriterioSelId('ESO', '1º ESO', 'EFI', 'EFI_C1', 'EFI01CE1.1');
        const prev = {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [{
                id: selId,
                type: 'criterio',
                dataset: 'ES-CN',
                etapa: 'ESO',
                nivel: '1º ESO',
                codArea: 'EFI',
                denominacion: 'Educación Física',
                codigoComp: 'EFI_C1',
                descripcionComp: 'Competencia sobre actividad física',
                codigoCriterio: 'EFI01CE1.1',
                descripcionCriterio: 'Criterio sobre actividad física saludable',
                competenciasClave: ['CPSAA1', 'STEM2'],
                coverage: 'assessed',
                notes: 'Old data',
                linkedSaberes: ['some-old-id']
            }]
        };

        $exeDevice.init(el, prev);
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        const restoredSel = saved.lomloeSelections[0];

        expect(restoredSel.coverage).toBeUndefined();
        expect(restoredSel.notes).toBeUndefined();
        expect(restoredSel.linkedSaberes).toBeUndefined();
        expect(restoredSel.partial).toBe(false);
    });
});

// ════════════════════════════════════════════════════════════════
describe('Operational descriptor checkboxes (issue #1832)', () => {
    let el;

    beforeEach(() => {
        el = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE_DATA) })
        );
    });

    afterEach(() => {
        el && el.remove();
        vi.restoreAllMocks();
    });

    // Seeds a single criterio selection for a given dataset and returns the
    // rendered selection-panel element after init.
    async function initWithCriterio(dataset, sel) {
        const prev = {
            lomloeDataset: dataset,
            lomloeActiveTab: 'competencias',
            lomloeSelectedEtapa: 'ESO',
            lomloeSelectedNivel: '1º ESO',
            lomloeSelectedMateria: { codArea: 'BIG', denominacion: 'Biología' },
            lomloeSelections: [sel]
        };
        $exeDevice.init(el, prev);
        await new Promise(r => setTimeout(r, 50));
        return el.querySelector('[id^="lomloe-sel-list-"]');
    }

    const makeSel = (dataset, extra) => Object.assign({
        id: makeCriterioSelId('ESO', '1º ESO', 'BIG', 'BIG_C1', 'BIG01CE1.1'),
        type: 'criterio',
        dataset,
        etapa: 'ESO',
        nivel: '1º ESO',
        codArea: 'BIG',
        denominacion: 'Biología',
        codigoComp: 'BIG_C1',
        descripcionComp: 'Comp',
        codigoCriterio: 'BIG01CE1.1',
        descripcionCriterio: 'Criterio',
        partial: false
    }, extra);

    it('renders descriptor checkboxes for non-Canarias datasets', async () => {
        const list = await initWithCriterio('ES', makeSel('ES', {
            competenciasClave: [],
            descriptorOptions: ['CCL1', 'STEM4', 'CD2']
        }));
        const boxes = list.querySelectorAll('.lomloe-desc-cb');
        expect(boxes).toHaveLength(3);
        // None checked initially (teacher must pick explicitly)
        expect([...boxes].every(b => !b.checked)).toBe(true);
    });

    it('toggling descriptor checkboxes updates competenciasClave (ordered)', async () => {
        const list = await initWithCriterio('ES', makeSel('ES', {
            competenciasClave: [],
            descriptorOptions: ['CCL1', 'STEM4', 'CD2']
        }));
        // Check CD2 first, then CCL1 → result must follow option order, not click order.
        const byCc = (cc) => list.querySelector('.lomloe-desc-cb[data-cc="' + cc + '"]');
        byCc('CD2').checked = true;
        byCc('CD2').dispatchEvent(new Event('change', { bubbles: true }));
        byCc('CCL1').checked = true;
        byCc('CCL1').dispatchEvent(new Event('change', { bubbles: true }));

        let saved = $exeDevice.save();
        expect(saved.lomloeSelections[0].competenciasClave).toEqual(['CCL1', 'CD2']);

        // Unchecking removes it.
        byCc('CCL1').checked = false;
        byCc('CCL1').dispatchEvent(new Event('change', { bubbles: true }));
        saved = $exeDevice.save();
        expect(saved.lomloeSelections[0].competenciasClave).toEqual(['CD2']);
    });

    it('summary reflects only the chosen descriptors', async () => {
        const list = await initWithCriterio('ES', makeSel('ES', {
            competenciasClave: [],
            descriptorOptions: ['CCL1', 'STEM4', 'CD2']
        }));
        list.querySelector('.lomloe-desc-cb[data-cc="STEM4"]').checked = true;
        list.querySelector('.lomloe-desc-cb[data-cc="STEM4"]')
            .dispatchEvent(new Event('change', { bubbles: true }));
        const html = $exeDevice.save().lomloeSummaryHtml;
        expect(html).toContain('>STEM4<');
        expect(html).not.toContain('>CCL1<');
        expect(html).not.toContain('>CD2<');
    });

    it('Canarias keeps fixed badges and renders no descriptor checkboxes', async () => {
        const list = await initWithCriterio('ES-CN', makeSel('ES-CN', {
            competenciasClave: ['CCL1', 'CCL2', 'STEM4']
        }));
        expect(list.querySelectorAll('.lomloe-desc-cb')).toHaveLength(0);
        const saved = $exeDevice.save();
        expect(saved.lomloeSelections[0].competenciasClave).toEqual(['CCL1', 'CCL2', 'STEM4']);
    });
});

// ════════════════════════════════════════════════════════════════
// Drives the real browse-panel criterio checkbox so toggleCriterio() and
// buildCompetenciasHtml() run for both descriptor modes. Each test gets a
// FRESH module instance (empty dataset cache) so any dataset id can be loaded
// with the ESO competencia fixture below.
describe('toggleCriterio descriptor modes via browse panel (issue #1832)', () => {
    const ESO_COMP = {
        ESO: {
            '2º ESO': {
                FQX: {
                    denominacion: 'Física y Química',
                    competencias_especificas: {
                        C1: {
                            descripcion: 'Competencia 1',
                            criterios_evaluacion: [
                                { codigo: 'CR1', descripcion: 'Criterio 1', competencias_clave: ['CCL1', 'STEM4', 'CD2'] }
                            ]
                        }
                    },
                    saberes_basicos: { bloques: {} }
                }
            }
        }
    };

    let el, dev;

    beforeEach(async () => {
        const raw = await import('./lomloe.js?raw').then(m => m.default);
        dev = new Function('globalThis', '_', 'CSS', raw + '\nreturn $exeDevice;')(
            globalThis, globalThis._, globalThis.CSS
        );
        el = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(ESO_COMP) })
        );
    });

    afterEach(() => {
        el && el.remove();
        vi.restoreAllMocks();
    });

    async function selectCriterio(dataset) {
        dev.init(el, {
            lomloeDataset: dataset,
            lomloeActiveTab: 'competencias',
            lomloeSelectedEtapa: 'ESO',
            lomloeSelectedNivel: '2º ESO',
            lomloeSelectedMateria: { codArea: 'FQX', denominacion: 'Física y Química' },
            lomloeSelections: []
        });
        await new Promise(r => setTimeout(r, 50));
        const cb = el.querySelector('input[type="checkbox"][data-type="criterio"]');
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
        return dev.save().lomloeSelections[0];
    }

    it('checkbox-mode dataset starts empty with descriptorOptions and hides browse tags', async () => {
        // ES-MD stands in for any available checkbox-mode (non-Canarias) dataset.
        // (ES-EX is on hold — available:false — so its loader path is unreachable.)
        const sel = await selectCriterio('ES-MD');
        expect(sel.competenciasClave).toEqual([]);
        expect(sel.descriptorOptions).toEqual(['CCL1', 'STEM4', 'CD2']);
        // Browse panel must not present descriptors as fixed per-criterio tags.
        expect(el.querySelectorAll('.lomloe-cc-tag')).toHaveLength(0);
    });

    it('Canarias keeps the authoritative per-criterio descriptor list and shows tags', async () => {
        const sel = await selectCriterio('ES-CN');
        expect(sel.competenciasClave).toEqual(['CCL1', 'STEM4', 'CD2']);
        expect(sel.descriptorOptions).toBeUndefined();
        expect(el.querySelectorAll('.lomloe-cc-tag').length).toBeGreaterThan(0);
    });

    // Issue #1832 follow-up: after the Infantil backfill, a non-Canarias Infantil
    // criterio offers the competencias clave as checkboxes, captioned "Key Comp.".
    it('Infantil (non-Canarias) renders the picker captioned "Key Comp."', async () => {
        const INF_COMP = {
            'Educación Infantil': {
                'Primer ciclo (0-3 años)': {
                    ACA: {
                        denominacion: 'Área 1. Crecimiento en Armonía',
                        competencias_especificas: {
                            C1: {
                                descripcion: 'Competencia 1',
                                criterios_evaluacion: [
                                    { codigo: 'CR1', descripcion: 'Criterio 1', competencias_clave: ['CCL', 'CPSAA'] }
                                ]
                            }
                        },
                        saberes_basicos: { bloques: {} }
                    }
                }
            }
        };
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(INF_COMP) })
        );
        dev.init(el, {
            lomloeDataset: 'ES',
            lomloeActiveTab: 'competencias',
            lomloeSelectedEtapa: 'Educación Infantil',
            lomloeSelectedNivel: 'Primer ciclo (0-3 años)',
            lomloeSelectedMateria: { codArea: 'ACA', denominacion: 'Área 1. Crecimiento en Armonía' },
            lomloeSelections: []
        });
        await new Promise(r => setTimeout(r, 50));
        const cb = el.querySelector('input[type="checkbox"][data-type="criterio"]');
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));

        const sel = dev.save().lomloeSelections[0];
        expect(sel.descriptorOptions).toEqual(['CCL', 'CPSAA']);
        expect(sel.competenciasClave).toEqual([]); // checkbox mode: teacher picks
        // Picker rendered in the selection panel, captioned for Infantil.
        const boxes = el.querySelectorAll('.lomloe-desc-cb');
        expect(boxes).toHaveLength(2);
        const caption = el.querySelector('.lomloe-sel-descriptors-caption');
        expect(caption.textContent).toBe('Key Comp.:');
    });
});

// ════════════════════════════════════════════════════════════════
describe('Per-course ESO subject filter (issue #1832)', () => {
    let el;

    beforeEach(() => {
        el = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(ESO_SAMPLE) })
        );
    });

    afterEach(() => {
        el && el.remove();
        vi.restoreAllMocks();
    });

    async function listedCodAreas(dataset, sample) {
        if (sample) {
            globalThis.fetch = vi.fn(() =>
                Promise.resolve({ ok: true, json: () => Promise.resolve(sample) })
            );
        }
        $exeDevice.init(el, {
            lomloeDataset: dataset,
            lomloeSelectedEtapa: 'ESO',
            lomloeSelectedNivel: '1º ESO',
            lomloeSelections: []
        });
        await new Promise(r => setTimeout(r, 50));
        const list = el.querySelector('[id^="lomloe-mat-list-"]');
        return [...list.querySelectorAll('.lomloe-materia-item')]
            .map(li => li.getAttribute('data-codarea'));
    }

    // The per-course filter is exercised on Madrid because Extremadura (ES-EX) is
    // on hold (available:false) and its loader path is unreachable; the filtering
    // mechanism is dataset-agnostic, so ES-MD covers it equally. See issue #1832.
    it('Madrid 1º ESO hides Física y Química too', async () => {
        const codes = await listedCodAreas('ES-MD');
        expect(codes).toContain('BIG');
        expect(codes).not.toContain('FQX');
        // 4º-only optatives duplicated into the cycle are also filtered out.
        expect(codes).not.toContain('DIG');
    });

    it('EFP (Ceuta/Melilla) 1º ESO hides Física y Química too', async () => {
        const codes = await listedCodAreas('ES-EFP');
        expect(codes).toContain('BIG');
        expect(codes).not.toContain('FQX');
    });

    it('datasets without a per-course distribution (e.g. Navarra, State) are not filtered', async () => {
        // ES-NC is absent from ESO_COURSE_SUBJECTS, like the State (ES) floor,
        // so the full 1º–3º block is shown unchanged. (Uses ES-NC rather than
        // ES because the module caches datasets by id across tests, and rather
        // than ES-GA because that dataset is on hold / unavailable — see #1900.)
        const codes = await listedCodAreas('ES-NC');
        expect(codes).toContain('BIG');
        expect(codes).toContain('FQX');
        expect(codes).toContain('DIG');
    });
});

// ════════════════════════════════════════════════════════════════
describe('Summary HTML generation', () => {
    let el;

    beforeEach(() => {
        el = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE_DATA) })
        );
    });

    afterEach(() => {
        el && el.remove();
        vi.restoreAllMocks();
    });

    it('summary contains a table when criterio selections exist', async () => {
        const selId = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.1');
        $exeDevice.init(el, {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [{
                id: selId,
                type: 'criterio',
                dataset: 'ES-CN',
                etapa: 'Educación Primaria',
                nivel: '1º Primaria',
                codArea: 'MAT',
                denominacion: 'Matemáticas',
                codigoComp: 'PMC1',
                descripcionComp: 'Razonar matemáticamente',
                codigoCriterio: 'PM01CE1.1',
                descripcionCriterio: 'Interpretar datos cuantitativos',
                competenciasClave: ['CCL2', 'STEM1', 'STEM3'],
                partial: false
            }]
        });
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        expect(saved.lomloeSummaryHtml).toContain('<table');
        expect(saved.lomloeSummaryHtml).toContain('PM01CE1.1');
        expect(saved.lomloeSummaryHtml).toContain('lomloe-criterio-code-badge');
        expect(saved.lomloeSummaryHtml).not.toContain('Observaciones');
        expect(saved.lomloeSummaryHtml).not.toContain('Cobertura');
    });

    it('criterio description appears in tooltip attribute', async () => {
        const selId = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.1');
        $exeDevice.init(el, {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [{
                id: selId,
                type: 'criterio',
                dataset: 'ES-CN',
                etapa: 'Educación Primaria',
                nivel: '1º Primaria',
                codArea: 'MAT',
                denominacion: 'Matemáticas',
                codigoComp: 'PMC1',
                descripcionComp: 'Razonar matemáticamente',
                codigoCriterio: 'PM01CE1.1',
                descripcionCriterio: 'Interpretar datos cuantitativos del entorno',
                competenciasClave: ['CCL2'],
                partial: false
            }]
        });
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        expect(saved.lomloeSummaryHtml).toContain('data-lomloe-tip="Interpretar datos cuantitativos del entorno"');
    });

    it('summary shows standalone saber table when only saberes exist', async () => {
        const selId = makeSaberSelId('Educación Primaria', '1º Primaria', 'MAT', 'I. Sentido numérico', 'PM01SBI.1.1');
        $exeDevice.init(el, {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [{
                id: selId,
                type: 'saber',
                dataset: 'ES-CN',
                etapa: 'Educación Primaria',
                nivel: '1º Primaria',
                codArea: 'MAT',
                denominacion: 'Matemáticas',
                bloque: 'I. Sentido numérico',
                nombre: 'PM01SBI.1.1',
                subtitulo1: 'Números naturales',
                subtitulo2: '1.1. Conteo'
            }]
        });
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        expect(saved.lomloeSummaryHtml).toContain('<table');
        expect(saved.lomloeSummaryHtml).toContain('PM01SBI.1.1');
        expect(saved.lomloeSummaryHtml).toContain('data-lomloe-tip="Números naturales');
    });

    it('saberes appear in a shared rowspan cell when criterios also exist', async () => {
        const saberId = makeSaberSelId('Educación Primaria', '1º Primaria', 'MAT', 'I. Sentido numérico', 'PM01SBI.1.1');
        const critId = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.1');
        $exeDevice.init(el, {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [
                {
                    id: saberId,
                    type: 'saber',
                    dataset: 'ES-CN',
                    etapa: 'Educación Primaria',
                    nivel: '1º Primaria',
                    codArea: 'MAT',
                    denominacion: 'Matemáticas',
                    bloque: 'I. Sentido numérico',
                    nombre: 'PM01SBI.1.1',
                    subtitulo1: 'Números naturales',
                    subtitulo2: '1.1. Conteo'
                },
                {
                    id: critId,
                    type: 'criterio',
                    dataset: 'ES-CN',
                    etapa: 'Educación Primaria',
                    nivel: '1º Primaria',
                    codArea: 'MAT',
                    denominacion: 'Matemáticas',
                    codigoComp: 'PMC1',
                    descripcionComp: 'Razonar matemáticamente',
                    codigoCriterio: 'PM01CE1.1',
                    descripcionCriterio: 'Interpretar datos cuantitativos',
                    competenciasClave: ['CCL2'],
                    partial: false
                }
            ]
        });
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        // Saberes should be in a shared cell with rowspan
        expect(saved.lomloeSummaryHtml).toContain('lomloe-saberes-cell');
        expect(saved.lomloeSummaryHtml).toContain('rowspan="1"');
        expect(saved.lomloeSummaryHtml).toContain('lomloe-saber-link-badge');
        expect(saved.lomloeSummaryHtml).toContain('PM01SBI.1.1');
        // Saberes header column present
        expect(saved.lomloeSummaryHtml).toContain('>Basic knowledge<');
    });

    it('no Saberes column when no saberes are selected', async () => {
        const critId = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.1');
        $exeDevice.init(el, {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [{
                id: critId,
                type: 'criterio',
                dataset: 'ES-CN',
                etapa: 'Educación Primaria',
                nivel: '1º Primaria',
                codArea: 'MAT',
                denominacion: 'Matemáticas',
                codigoComp: 'PMC1',
                descripcionComp: 'Razonar',
                codigoCriterio: 'PM01CE1.1',
                descripcionCriterio: 'Interpretar',
                competenciasClave: ['CCL2'],
                partial: false
            }]
        });
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        expect(saved.lomloeSummaryHtml).not.toContain('Basic knowledge');
        expect(saved.lomloeSummaryHtml).not.toContain('lomloe-saberes-cell');
    });

    it('summary contains empty message when no selections', async () => {
        $exeDevice.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        expect(saved.lomloeSummaryHtml).toBeTruthy();
        expect(saved.lomloeSelections).toHaveLength(0);
    });

    it('summary includes competencias_clave tags for criterio type', async () => {
        const selId = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.1');
        $exeDevice.init(el, {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [{
                id: selId,
                type: 'criterio',
                dataset: 'ES-CN',
                etapa: 'Educación Primaria',
                nivel: '1º Primaria',
                codArea: 'MAT',
                denominacion: 'Matemáticas',
                codigoComp: 'PMC1',
                descripcionComp: 'Razonar matemáticamente',
                codigoCriterio: 'PM01CE1.1',
                descripcionCriterio: 'Interpretar datos cuantitativos',
                competenciasClave: ['CCL2', 'STEM1', 'STEM3'],
                partial: false
            }]
        });
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        expect(saved.lomloeSummaryHtml).toContain('CCL2');
        expect(saved.lomloeSummaryHtml).toContain('STEM1');
        expect(saved.lomloeSummaryHtml).toContain('STEM3');
    });

    it('partial: true produces "(partial)" in summary HTML', async () => {
        const selId = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.1');
        $exeDevice.init(el, {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [{
                id: selId,
                type: 'criterio',
                dataset: 'ES-CN',
                etapa: 'Educación Primaria',
                nivel: '1º Primaria',
                codArea: 'MAT',
                denominacion: 'Matemáticas',
                codigoComp: 'PMC1',
                descripcionComp: 'Razonar matemáticamente',
                codigoCriterio: 'PM01CE1.1',
                descripcionCriterio: 'Interpretar datos cuantitativos',
                competenciasClave: ['CCL2'],
                partial: true
            }]
        });
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        expect(saved.lomloeSummaryHtml).toContain('partial');
        expect(saved.lomloeSummaryHtml).toContain('lomloe-partial-indicator');
    });

    it('partial: false does not produce "(partial)" in summary HTML', async () => {
        const selId = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.1');
        $exeDevice.init(el, {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [{
                id: selId,
                type: 'criterio',
                dataset: 'ES-CN',
                etapa: 'Educación Primaria',
                nivel: '1º Primaria',
                codArea: 'MAT',
                denominacion: 'Matemáticas',
                codigoComp: 'PMC1',
                descripcionComp: 'Razonar matemáticamente',
                codigoCriterio: 'PM01CE1.1',
                descripcionCriterio: 'Interpretar datos cuantitativos',
                competenciasClave: ['CCL2'],
                partial: false
            }]
        });
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        expect(saved.lomloeSummaryHtml).not.toContain('partial');
    });

    it('uses "Operational descriptors" header for Primaria with Criterio first', async () => {
        const selId = makeCriterioSelId('Educación Primaria', '1º Primaria', 'MAT', 'PMC1', 'PM01CE1.1');
        $exeDevice.init(el, {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [{
                id: selId,
                type: 'criterio',
                dataset: 'ES-CN',
                etapa: 'Educación Primaria',
                nivel: '1º Primaria',
                codArea: 'MAT',
                denominacion: 'Matemáticas',
                codigoComp: 'PMC1',
                descripcionComp: 'Razonar',
                codigoCriterio: 'PM01CE1.1',
                descripcionCriterio: 'Interpretar',
                competenciasClave: ['CCL2'],
                partial: false
            }]
        });
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        expect(saved.lomloeSummaryHtml).toContain('Operational descriptors');
        expect(saved.lomloeSummaryHtml).not.toContain('>Key Comp.<');
        // Column order: Criterio before Operational descriptors
        const critIdx = saved.lomloeSummaryHtml.indexOf('>Eval. Criteria<');
        const descIdx = saved.lomloeSummaryHtml.indexOf('>Operational descriptors<');
        expect(critIdx).toBeLessThan(descIdx);
        // "Spec. Comp." header with tooltip
        expect(saved.lomloeSummaryHtml).toContain('Spec. Comp.');
        expect(saved.lomloeSummaryHtml).toContain('data-lomloe-tip="Specific Competencies"');
    });

    it('uses "Key Comp." header for Infantil with Key Comp. first', async () => {
        const selId = makeCriterioSelId('Educación Infantil', '4º Infantil de 3 años', 'CYR', 'CYR_C1', 'CYR01CE1.1');
        $exeDevice.init(el, {
            lomloeDataset: 'ES-CN',
            lomloeSelections: [{
                id: selId,
                type: 'criterio',
                dataset: 'ES-CN',
                etapa: 'Educación Infantil',
                nivel: '4º Infantil de 3 años',
                codArea: 'CYR',
                denominacion: 'Crecimiento en Armonía',
                codigoComp: 'CYR_C1',
                descripcionComp: 'Progresar en el conocimiento',
                codigoCriterio: 'CYR01CE1.1',
                descripcionCriterio: 'Participar con seguridad',
                competenciasClave: ['CPSAA1'],
                partial: false
            }]
        });
        await new Promise(r => setTimeout(r, 50));
        const saved = $exeDevice.save();
        expect(saved.lomloeSummaryHtml).toContain('Key Comp.');
        expect(saved.lomloeSummaryHtml).not.toContain('Operational descriptors');
        // Column order: Key Comp. before Criterio
        const ccIdx = saved.lomloeSummaryHtml.indexOf('>Key Comp.<');
        const critIdx = saved.lomloeSummaryHtml.indexOf('>Eval. Criteria<');
        expect(ccIdx).toBeLessThan(critIdx);
        // "Spec. Comp." header with tooltip
        expect(saved.lomloeSummaryHtml).toContain('Spec. Comp.');
        // Key Comp. header has Bootstrap tooltip
        expect(saved.lomloeSummaryHtml).toContain('data-lomloe-tip="Key Competencies"');
    });
});

// ════════════════════════════════════════════════════════════════
describe('Dataset configuration', () => {
    it('has at least one available dataset', () => {
        const el2 = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE_DATA) })
        );
        expect(() => $exeDevice.init(el2, null)).not.toThrow();
        el2.remove();
        vi.restoreAllMocks();
    });

    it('renders a dataset selector in the DOM after init', async () => {
        const el3 = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE_DATA) })
        );
        $exeDevice.init(el3, null);
        await new Promise(r => setTimeout(r, 50));
        const dsSelect = el3.querySelector('select[id*="lomloe-ds-"]');
        expect(dsSelect).not.toBeNull();
        expect(dsSelect.options.length).toBeGreaterThanOrEqual(1);
        el3.remove();
        vi.restoreAllMocks();
    });
});

// ════════════════════════════════════════════════════════════════
describe('Tooltip popover controller', () => {
    let el;

    beforeEach(() => {
        // Reset the binding flag and any leftover tooltip from prior suites.
        delete document.__lomloeTipBound;
        const old = document.getElementById('lomloe-tooltip');
        if (old) old.remove();
        el = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE_DATA) })
        );
    });

    afterEach(() => {
        el && el.remove();
        const tip = document.getElementById('lomloe-tooltip');
        if (tip) tip.remove();
        delete document.__lomloeTipBound;
        vi.restoreAllMocks();
    });

    it('does not create the tooltip element until a tipped node is hovered', async () => {
        $exeDevice.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        // Controller binds listeners but only inserts #lomloe-tooltip on first hover.
        expect(document.__lomloeTipBound).toBe(true);
        expect(document.getElementById('lomloe-tooltip')).toBeNull();
    });

    it('creates a singleton #lomloe-tooltip on first mouseover and shows the tip text', async () => {
        $exeDevice.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        const target = document.createElement('span');
        target.setAttribute('data-lomloe-tip', 'Hello tooltip');
        el.appendChild(target);
        target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        const tip = document.getElementById('lomloe-tooltip');
        expect(tip).not.toBeNull();
        expect(tip.textContent).toBe('Hello tooltip');
        const hasPopover = typeof document.body.showPopover === 'function';
        if (hasPopover) {
            expect(tip.getAttribute('popover')).toBe('manual');
        } else {
            expect(tip.hidden).toBe(false);
        }
    });

    it('updates text when hovering a different tipped node', async () => {
        $exeDevice.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        const a = document.createElement('span');
        a.setAttribute('data-lomloe-tip', 'first');
        const b = document.createElement('span');
        b.setAttribute('data-lomloe-tip', 'second');
        el.appendChild(a);
        el.appendChild(b);
        a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        b.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(document.getElementById('lomloe-tooltip').textContent).toBe('second');
    });

    it('hides the tooltip when leaving a tipped node for unrelated content', async () => {
        $exeDevice.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        const target = document.createElement('span');
        target.setAttribute('data-lomloe-tip', 'will hide');
        el.appendChild(target);
        const outside = document.createElement('div');
        document.body.appendChild(outside);
        target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        target.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: outside }));
        const tip = document.getElementById('lomloe-tooltip');
        const hasPopover = typeof document.body.showPopover === 'function';
        if (hasPopover) {
            expect(tip.matches(':popover-open')).toBe(false);
        } else {
            expect(tip.hidden).toBe(true);
        }
        outside.remove();
    });

    it('is idempotent across multiple init calls (no duplicate tooltip elements)', async () => {
        $exeDevice.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        const el2 = buildMockElement();
        $exeDevice.init(el2, null);
        await new Promise(r => setTimeout(r, 50));
        const target = document.createElement('span');
        target.setAttribute('data-lomloe-tip', 'unique');
        el2.appendChild(target);
        target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(document.querySelectorAll('#lomloe-tooltip').length).toBe(1);
        el2.remove();
    });

    it('ignores hovers on nodes without data-lomloe-tip', async () => {
        $exeDevice.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        const plain = document.createElement('span');
        el.appendChild(plain);
        plain.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(document.getElementById('lomloe-tooltip')).toBeNull();
    });

    it('clamps a tall tooltip inside the viewport so long definitions are not clipped', async () => {
        $exeDevice.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        const target = document.createElement('span');
        target.setAttribute('data-lomloe-tip', 'A very long criteria definition…');
        el.appendChild(target);
        // Create + show the tooltip, then simulate a tall tooltip near the
        // bottom edge and re-position via a scroll event.
        target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        const tip = document.getElementById('lomloe-tooltip');
        const vh = window.innerHeight || 768;
        const tipH = 700;
        // Mid-viewport target; the tooltip is too tall to fit either below or
        // above it, so the clamp must pull it back inside the viewport.
        target.getBoundingClientRect = () =>
            ({ top: 400, bottom: 420, left: 100, right: 200, width: 100, height: 20 });
        tip.getBoundingClientRect = () =>
            ({ top: 0, bottom: tipH, left: 0, right: 360, width: 360, height: tipH });
        window.dispatchEvent(new Event('scroll'));
        // Pinned so its bottom stays just inside the viewport (vh - 4 - height).
        expect(tip.style.top).toBe(Math.max(4, vh - 4 - tipH) + 'px');
    });
});

// ════════════════════════════════════════════════════════════════
// Stage (etapa) ordering must be Infantil → Primaria → ESO → Bachillerato
// regardless of how the dataset spells the stage names. Regional datasets use
// the full official names ("Educación Secundaria Obligatoria") or co-official
// spellings ("Educació Secundària Obligatòria", "Batxillerat"); these must sort
// like the Castilian abbreviations and not fall behind Bachillerato.
describe('LOMLOE stage (etapa) ordering', () => {
    let el;
    let dev;

    // Re-instantiate per test so the module-level dataCache is fresh (each test
    // loads the default dataset id with a different fixture).
    beforeEach(async () => {
        const raw = await import('./lomloe.js?raw').then(m => m.default);
        dev = new Function('globalThis', '_', 'CSS', raw + '\nreturn $exeDevice;')(
            globalThis, globalThis._, globalThis.CSS
        );
    });
    afterEach(() => {
        el && el.remove();
        vi.restoreAllMocks();
    });

    async function renderedEtapaOrder(dataset) {
        el = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(dataset) })
        );
        dev.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        return Array.from(el.querySelectorAll('.lomloe-etapa-btn')).map(b => b.dataset.etapa);
    }

    it('orders official Castilian stage names (Navarra-style) ESO before Bachillerato', async () => {
        // Insertion order scrambled on purpose to prove it is the sort, not the
        // object order, that fixes this — the regression was Bachillerato first.
        const order = await renderedEtapaOrder({
            Bachillerato: { '1º Bachillerato': { MAT: area('Matemáticas') } },
            'Educación Secundaria Obligatoria': { '1º de ESO': { MAT: area('Matemáticas') } },
            'Educación Infantil': { '2º ciclo': { ÁCA: area('Comunicación') } },
            'Educación Primaria': { '1º Primaria': { MAT: area('Matemáticas') } },
        });
        expect(order).toEqual([
            'Educación Infantil',
            'Educación Primaria',
            'Educación Secundaria Obligatoria',
            'Bachillerato',
        ]);
    });

    it('orders accented co-official stage names (Valencian-style) correctly', async () => {
        const order = await renderedEtapaOrder({
            Batxillerat: { '1r Batxillerat': { MAT: area('Matemàtiques') } },
            'Educació Secundària Obligatòria': { '1r ESO': { MAT: area('Matemàtiques') } },
            'Educació Infantil': { '2n cicle': { ÁCA: area('Comunicació') } },
            'Educació Primària': { '1r Primària': { MAT: area('Matemàtiques') } },
        });
        expect(order).toEqual([
            'Educació Infantil',
            'Educació Primària',
            'Educació Secundària Obligatòria',
            'Batxillerat',
        ]);
    });

    it('orders Basque (Euskadi-style) stage names Haur → Lehen → DBH', async () => {
        // The Euskadi dataset uses Basque stage names with no Castilian token, so
        // ETAPA_ORDER must recognise 'haur'/'lehen'/'bigarren'. Insertion order is
        // scrambled to prove it is the sort, not the object order, that fixes this.
        const order = await renderedEtapaOrder({
            'Derrigorrezko Bigarren Hezkuntza': { 'DBHko 1. maila': { MAT: area('Matematika') } },
            'Haur Hezkuntza': { 'Lehen zikloa (0-3 urte)': { HH: area('Harmonian hazten') } },
            'Lehen Hezkuntza': { 'Lehen Hezkuntzako 1. maila': { MAT: area('Matematika') } },
        });
        expect(order).toEqual([
            'Haur Hezkuntza',
            'Lehen Hezkuntza',
            'Derrigorrezko Bigarren Hezkuntza',
        ]);
    });
});

// ════════════════════════════════════════════════════════════════
// A dataset may carry its own descriptor catalog (e.g. the Comunitat
// Valenciana publishes the perfil-d'eixida descriptors in Valencian) under a
// reserved top-level `descriptors` key; when present it overrides the shared
// Castilian CC_DESCRIPTIONS, per-code, and must not be treated as an etapa.
describe('LOMLOE per-dataset descriptor override', () => {
    let el;

    function fixtureWithDescriptors(descriptors) {
        const ds = {
            'Educació Primària': {
                "1r d'Educació Primària": {
                    MAT: {
                        denominacion: 'Matemàtiques',
                        saberes_basicos: { bloques: {} },
                        competencias_especificas: {
                            C1: {
                                descripcion: 'Comp 1',
                                explicacion_bloque_competencial: '',
                                criterios_evaluacion: [
                                    { codigo: 'C1.1', descripcion: 'Crit 1', competencias_clave: ['CCL2', 'STEM1'] }
                                ]
                            }
                        }
                    }
                }
            }
        };
        if (descriptors) ds.descriptors = descriptors;
        return ds;
    }

    function mockFetch(ds) {
        globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(ds) }));
    }

    function seededPrev() {
        return {
            lomloeDataset: 'ES-VC',
            lomloeSelectedEtapa: 'Educació Primària',
            lomloeSelectedNivel: "1r d'Educació Primària",
            lomloeSelectedMateria: { codArea: 'MAT', denominacion: 'Matemàtiques' },
            lomloeSelections: [{
                id: makeCriterioSelId('Educació Primària', "1r d'Educació Primària", 'MAT', 'C1', 'C1.1'),
                type: 'criterio',
                dataset: 'ES-VC',
                etapa: 'Educació Primària',
                nivel: "1r d'Educació Primària",
                codArea: 'MAT',
                denominacion: 'Matemàtiques',
                codigoComp: 'C1',
                descripcionComp: 'Comp 1',
                codigoCriterio: 'C1.1',
                descripcionCriterio: 'Crit 1',
                competenciasClave: ['CCL2', 'STEM1']
            }]
        };
    }

    // Re-instantiate per test so the module-level dataCache is fresh (each test
    // loads the ES-VC id with a different fixture).
    let dev;
    beforeEach(async () => {
        el = buildMockElement();
        const raw = await import('./lomloe.js?raw').then(m => m.default);
        dev = new Function('globalThis', '_', 'CSS', raw + '\nreturn $exeDevice;')(
            globalThis, globalThis._, globalThis.CSS
        );
    });
    afterEach(() => { el && el.remove(); vi.restoreAllMocks(); });

    it('uses the dataset override text for a code that has one', async () => {
        mockFetch(fixtureWithDescriptors({ CCL2: 'CCL2 — text en valencià' }));
        dev.init(el, seededPrev());
        await new Promise(r => setTimeout(r, 50));
        const html = dev.save().lomloeSummaryHtml;
        expect(html).toContain('CCL2 — text en valencià');
        expect(html).not.toContain('Comprende e interpreta con sentido crítico'); // Castilian default gone
    });

    it('falls back per-code to CC_DESCRIPTIONS for codes the override lacks', async () => {
        mockFetch(fixtureWithDescriptors({ CCL2: 'CCL2 — text en valencià' }));
        dev.init(el, seededPrev());
        await new Promise(r => setTimeout(r, 50));
        const html = dev.save().lomloeSummaryHtml;
        expect(html).toContain('STEM1 — Utiliza conceptos y razonamientos'); // STEM1 not overridden
    });

    it('uses CC_DESCRIPTIONS and empty lomloeDescriptors when no descriptors key', async () => {
        mockFetch(fixtureWithDescriptors(null));
        dev.init(el, seededPrev());
        await new Promise(r => setTimeout(r, 50));
        const saved = dev.save();
        expect(saved.lomloeSummaryHtml).toContain('CCL2 — Comprende e interpreta');
        expect(saved.lomloeDescriptors).toEqual({});
    });

    it('save() denormalizes only the used codes that have an override', async () => {
        mockFetch(fixtureWithDescriptors({ CCL2: 'CCL2 — VAL', CD1: 'CD1 — unused VAL' }));
        dev.init(el, seededPrev());
        await new Promise(r => setTimeout(r, 50));
        // selection uses CCL2 (overridden) + STEM1 (not overridden); CD1 is unused
        expect(dev.save().lomloeDescriptors).toEqual({ CCL2: 'CCL2 — VAL' });
    });

    it('does not render the reserved `descriptors` key as an etapa tab', async () => {
        mockFetch(fixtureWithDescriptors({ CCL2: 'x' }));
        dev.init(el, null);
        await new Promise(r => setTimeout(r, 50));
        const tabs = Array.from(el.querySelectorAll('.lomloe-etapa-btn')).map(b => b.getAttribute('data-etapa'));
        expect(tabs).toContain('Educació Primària');
        expect(tabs).not.toContain('descriptors');
    });
});

// ── Bundled state-level datasets (lomloe-ES.json + lomloe-ES-EFP.json) ──────

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __testFilename = fileURLToPath(import.meta.url);
const __testDir = dirname(__testFilename);
const dataDir = join(__testDir, '..', 'data');

function loadDataset(name) {
    return JSON.parse(readFileSync(join(dataDir, name), 'utf-8'));
}

// Reserved top-level keys in a dataset JSON that are NOT etapes (e.g. a
// per-dataset `descriptors` override catalog). Keep in sync with the same list
// in edition/lomloe.js.
const RESERVED_DATASET_KEYS = ['descriptors'];

function walkAreas(dataset) {
    const out = [];
    for (const [etapa, niveles] of Object.entries(dataset)) {
        if (RESERVED_DATASET_KEYS.includes(etapa)) continue;
        for (const [nivel, areas] of Object.entries(niveles)) {
            for (const [codArea, area] of Object.entries(areas)) {
                out.push({ etapa, nivel, codArea, area });
            }
        }
    }
    return out;
}

// The 8 LOMLOE competencias clave (bare codes). Infantil links to these
// rather than to numbered descriptores operativos (which only exist from
// Primaria onward). See issue #1832 backfill.
const COMPETENCIAS_CLAVE = ['CCL', 'CP', 'STEM', 'CD', 'CPSAA', 'CC', 'CE', 'CCEC'];

function assertInfantilLinkedToCompetenciasClave(data) {
    const inf = data['Educación Infantil'];
    expect(inf).toBeDefined();
    let total = 0;
    let empty = 0;
    for (const niveles of Object.values(inf)) {
        for (const area of Object.values(niveles)) {
            for (const comp of Object.values(area.competencias_especificas)) {
                for (const cr of comp.criterios_evaluacion || []) {
                    total++;
                    const cc = cr.competencias_clave || [];
                    if (cc.length === 0) empty++;
                    for (const code of cc) {
                        expect(COMPETENCIAS_CLAVE, `Infantil code ${code} must be a bare competencia clave`).toContain(code);
                    }
                }
            }
        }
    }
    expect(total).toBeGreaterThan(0);
    expect(empty, 'all Infantil criterios must be linked to competencias clave').toBe(0);
}

describe('lomloe-ES.json (state minimum teachings)', () => {
    const data = loadDataset('lomloe-ES.json');

    it('parses as a non-empty object with no placeholder notice', () => {
        expect(typeof data).toBe('object');
        expect(data).not.toBeNull();
        expect(data.__notice__).toBeUndefined();
        expect(Object.keys(data).length).toBeGreaterThan(0);
    });

    it('Infantil criterios are linked to competencias clave (backfilled, issue #1832)', () => {
        assertInfantilLinkedToCompetenciasClave(data);
        // Spot-check a known mapping: Crecimiento en Armonía, competencia 1.
        const ciclo = data['Educación Infantil']['Primer ciclo (0-3 años)'];
        const aca = Object.values(ciclo).find(a => /Crecimiento en Armon/i.test(a.denominacion));
        const c1 = Object.values(aca.competencias_especificas)[0];
        expect(c1.criterios_evaluacion[0].competencias_clave).toEqual(['CCL', 'CPSAA']);
    });

    it('exposes the four expected etapas', () => {
        for (const etapa of ['Educación Infantil', 'Educación Primaria', 'ESO', 'Bachillerato']) {
            expect(data[etapa], `missing etapa ${etapa}`).toBeDefined();
            expect(Object.keys(data[etapa]).length).toBeGreaterThan(0);
        }
    });

    it('uses the expected per-year nivel keys for Primaria, ESO, Bachillerato', () => {
        expect(Object.keys(data['Educación Primaria'])).toEqual([
            '1º Primaria', '2º Primaria', '3º Primaria',
            '4º Primaria', '5º Primaria', '6º Primaria',
        ]);
        expect(Object.keys(data['ESO'])).toEqual(['1º ESO', '2º ESO', '3º ESO', '4º ESO']);
        expect(Object.keys(data['Bachillerato'])).toEqual(['1º Bachillerato', '2º Bachillerato']);
    });

    it('uses ciclo-based niveles for Infantil (no invented per-year split)', () => {
        const niveles = Object.keys(data['Educación Infantil']);
        expect(niveles).toContain('Primer ciclo (0-3 años)');
        expect(niveles).toContain('Segundo ciclo (3-6 años)');
    });

    it('every area record has the iDevice schema shape', () => {
        const sample = walkAreas(data).slice(0, 20);
        expect(sample.length).toBeGreaterThan(0);
        for (const { area, codArea, etapa, nivel } of sample) {
            const ctx = `${etapa}/${nivel}/${codArea}`;
            expect(area.denominacion, ctx).toBeTruthy();
            expect(area.competencias_especificas, ctx).toBeDefined();
            expect(area.saberes_basicos, ctx).toBeDefined();
            expect(area.saberes_basicos.bloques, ctx).toBeDefined();
        }
    });

    it('every competencia carries criterios with codigo + descripcion + competencias_clave array', () => {
        const sample = walkAreas(data).slice(0, 30);
        for (const { area } of sample) {
            for (const comp of Object.values(area.competencias_especificas)) {
                expect(typeof comp.descripcion).toBe('string');
                expect(Array.isArray(comp.criterios_evaluacion)).toBe(true);
                for (const crit of comp.criterios_evaluacion) {
                    expect(crit.codigo).toBeTruthy();
                    expect(crit.descripcion).toBeTruthy();
                    expect(Array.isArray(crit.competencias_clave)).toBe(true);
                }
            }
        }
    });

    it('competencia codes are unique within each (nivel, area)', () => {
        for (const { area, codArea, etapa, nivel } of walkAreas(data)) {
            const codes = Object.keys(area.competencias_especificas);
            const set = new Set(codes);
            expect(set.size, `${etapa}/${nivel}/${codArea}`).toBe(codes.length);
        }
    });

    it('saberes nombres are globally unique inside the dataset', () => {
        const seen = new Set();
        const dupes = [];
        for (const { area } of walkAreas(data)) {
            for (const items of Object.values(area.saberes_basicos.bloques)) {
                for (const item of items) {
                    if (seen.has(item.nombre)) {
                        dupes.push(item.nombre);
                    }
                    seen.add(item.nombre);
                }
            }
        }
        expect(dupes).toEqual([]);
    });
});

describe('lomloe-ES-EX.json (Extremadura concretion)', () => {
    const data = loadDataset('lomloe-ES-EX.json');

    it('parses as a non-empty object with no placeholder notice', () => {
        expect(typeof data).toBe('object');
        expect(data).not.toBeNull();
        expect(data.__notice__).toBeUndefined();
        expect(Object.keys(data).length).toBeGreaterThan(0);
    });

    it('exposes the four expected etapas', () => {
        for (const etapa of ['Educación Infantil', 'Educación Primaria', 'ESO', 'Bachillerato']) {
            expect(data[etapa], `missing etapa ${etapa}`).toBeDefined();
            expect(Object.keys(data[etapa]).length).toBeGreaterThan(0);
        }
    });

    it('uses the same per-year nivel keys as the state dataset', () => {
        expect(Object.keys(data['Educación Primaria'])).toEqual([
            '1º Primaria', '2º Primaria', '3º Primaria',
            '4º Primaria', '5º Primaria', '6º Primaria',
        ]);
        expect(Object.keys(data['ESO'])).toEqual(['1º ESO', '2º ESO', '3º ESO', '4º ESO']);
        expect(Object.keys(data['Bachillerato'])).toEqual(['1º Bachillerato', '2º Bachillerato']);
        expect(Object.keys(data['Educación Infantil'])).toContain('Primer ciclo (0-3 años)');
        expect(Object.keys(data['Educación Infantil'])).toContain('Segundo ciclo (3-6 años)');
    });

    it('Infantil criterios are linked to competencias clave (backfilled, issue #1832)', () => {
        assertInfantilLinkedToCompetenciasClave(data);
    });

    it('Primaria and ESO use the official Extremadura subject codes (DOE 22050223)', () => {
        // ESO official siglas (Anexo VIII): BG, FQ, GH, EPVA, TECD, EVCE, LE, EF…
        const eso1 = data['ESO']['1º ESO'];
        for (const official of ['BG', 'FQ', 'GH', 'EPVA', 'TECD', 'EVCE', 'LE', 'EF']) {
            expect(Object.keys(eso1), `ESO 1º should expose ${official}`).toContain(official);
        }
        // Generator-derived codes must no longer appear in Primaria/ESO.
        for (const etapa of ['Educación Primaria', 'ESO']) {
            for (const [, areas] of Object.entries(data[etapa])) {
                for (const old of ['BIG', 'FQX', 'GEH', 'EPV', 'TYD', 'EVC', 'LEX', 'EFI', 'EAR', 'EEX', 'FOP', 'CMN']) {
                    expect(areas[old], `${etapa} must not keep derived code ${old}`).toBeUndefined();
                }
                // Embedded competencia codes match their area key.
                for (const [codArea, area] of Object.entries(areas)) {
                    for (const code of Object.keys(area.competencias_especificas)) {
                        expect(code.split('-')[3]).toBe(codArea);
                    }
                }
            }
        }
    });

    it('every area record has the iDevice schema shape', () => {
        const sample = walkAreas(data).slice(0, 20);
        expect(sample.length).toBeGreaterThan(0);
        for (const { area, codArea, etapa, nivel } of sample) {
            const ctx = `${etapa}/${nivel}/${codArea}`;
            expect(area.denominacion, ctx).toBeTruthy();
            expect(area.competencias_especificas, ctx).toBeDefined();
            expect(area.saberes_basicos, ctx).toBeDefined();
            expect(area.saberes_basicos.bloques, ctx).toBeDefined();
        }
    });

    it('every code uses the ES-EX namespace (inheritance + regional concretion)', () => {
        const sample = walkAreas(data).slice(0, 25);
        let anyCompChecked = false;
        for (const { area } of sample) {
            for (const code of Object.keys(area.competencias_especificas)) {
                expect(code.startsWith('ES-EX-')).toBe(true);
                anyCompChecked = true;
            }
        }
        expect(anyCompChecked).toBe(true);
    });

    it('competencia codes are unique within each (nivel, area)', () => {
        for (const { area, codArea, etapa, nivel } of walkAreas(data)) {
            const codes = Object.keys(area.competencias_especificas);
            expect(new Set(codes).size, `${etapa}/${nivel}/${codArea}`).toBe(codes.length);
        }
    });

    it('saberes nombres are globally unique inside the dataset', () => {
        const seen = new Set();
        const dupes = [];
        for (const { area } of walkAreas(data)) {
            for (const items of Object.values(area.saberes_basicos.bloques)) {
                for (const item of items) {
                    if (seen.has(item.nombre)) {
                        dupes.push(item.nombre);
                    }
                    seen.add(item.nombre);
                }
            }
        }
        expect(dupes).toEqual([]);
    });
});

describe('lomloe-ES-MD.json (Comunidad de Madrid concretion)', () => {
    const data = loadDataset('lomloe-ES-MD.json');

    it('parses as a non-empty object with no placeholder notice', () => {
        expect(typeof data).toBe('object');
        expect(data).not.toBeNull();
        expect(data.__notice__).toBeUndefined();
        expect(Object.keys(data).length).toBeGreaterThan(0);
    });

    it('exposes the four expected etapas', () => {
        for (const etapa of ['Educación Infantil', 'Educación Primaria', 'ESO', 'Bachillerato']) {
            expect(data[etapa], `missing etapa ${etapa}`).toBeDefined();
            expect(Object.keys(data[etapa]).length).toBeGreaterThan(0);
        }
    });

    it('uses the same per-year nivel keys as the state dataset', () => {
        expect(Object.keys(data['Educación Primaria'])).toEqual([
            '1º Primaria', '2º Primaria', '3º Primaria',
            '4º Primaria', '5º Primaria', '6º Primaria',
        ]);
        expect(Object.keys(data['ESO'])).toEqual(['1º ESO', '2º ESO', '3º ESO', '4º ESO']);
        expect(Object.keys(data['Bachillerato'])).toEqual(['1º Bachillerato', '2º Bachillerato']);
    });

    it('Infantil criterios are linked to competencias clave (backfilled, issue #1832)', () => {
        assertInfantilLinkedToCompetenciasClave(data);
    });

    it('every area record has the iDevice schema shape', () => {
        const sample = walkAreas(data).slice(0, 20);
        expect(sample.length).toBeGreaterThan(0);
        for (const { area, codArea, etapa, nivel } of sample) {
            const ctx = `${etapa}/${nivel}/${codArea}`;
            expect(area.denominacion, ctx).toBeTruthy();
            expect(area.competencias_especificas, ctx).toBeDefined();
            expect(area.saberes_basicos.bloques, ctx).toBeDefined();
        }
    });

    it('every code uses the ES-MD namespace', () => {
        const sample = walkAreas(data).slice(0, 25);
        let checked = false;
        for (const { area } of sample) {
            for (const code of Object.keys(area.competencias_especificas)) {
                expect(code.startsWith('ES-MD-')).toBe(true);
                checked = true;
            }
        }
        expect(checked).toBe(true);
    });

    it('competencia codes are unique within each (nivel, area)', () => {
        for (const { area, codArea, etapa, nivel } of walkAreas(data)) {
            const codes = Object.keys(area.competencias_especificas);
            expect(new Set(codes).size, `${etapa}/${nivel}/${codArea}`).toBe(codes.length);
        }
    });

    it('saberes nombres are globally unique inside the dataset', () => {
        const seen = new Set();
        const dupes = [];
        for (const { area } of walkAreas(data)) {
            for (const items of Object.values(area.saberes_basicos.bloques)) {
                for (const item of items) {
                    if (seen.has(item.nombre)) {
                        dupes.push(item.nombre);
                    }
                    seen.add(item.nombre);
                }
            }
        }
        expect(dupes).toEqual([]);
    });
});

describe('lomloe-ES-EFP.json (Ministry-managed territory: MEFPD)', () => {
    const data = loadDataset('lomloe-ES-EFP.json');

    it('parses as a non-empty object with no placeholder notice', () => {
        expect(typeof data).toBe('object');
        expect(data.__notice__).toBeUndefined();
        expect(Object.keys(data).length).toBeGreaterThan(0);
    });

    it('covers Infantil, Primaria, ESO and Bachillerato (Orden EFP/608/2022 added Infantil)', () => {
        expect(Object.keys(data).sort()).toEqual(
            ['Bachillerato', 'ESO', 'Educación Infantil', 'Educación Primaria'].sort()
        );
        expect(data['Educación Infantil']).toBeDefined();
    });

    it('Infantil exposes the two ciclos and three áreas, with ES-EFP-INF-prefixed codes', () => {
        const inf = data['Educación Infantil'];
        expect(Object.keys(inf)).toEqual([
            'Primer ciclo (0-3 años)', 'Segundo ciclo (3-6 años)',
        ]);
        for (const ciclo of Object.keys(inf)) {
            // The three LOMLOE Infantil áreas (codes inherited from the state dataset).
            expect(Object.keys(inf[ciclo]).sort()).toEqual(['ÁCA', 'ÁCR', 'ÁDE']);
            for (const codArea of Object.keys(inf[ciclo])) {
                const area = inf[ciclo][codArea];
                expect(area.denominacion).toBeTruthy();
                const codes = Object.keys(area.competencias_especificas);
                expect(codes.length).toBeGreaterThan(0);
                for (const code of codes) {
                    expect(
                        code.startsWith('ES-EFP-INFPC-') || code.startsWith('ES-EFP-INFSC-'),
                        `Infantil code ${code} should use ES-EFP-INF prefix`,
                    ).toBe(true);
                }
            }
        }
    });

    it('shares the iDevice schema shape with the state dataset', () => {
        const sample = walkAreas(data).slice(0, 15);
        expect(sample.length).toBeGreaterThan(0);
        for (const { area, codArea, etapa, nivel } of sample) {
            const ctx = `${etapa}/${nivel}/${codArea}`;
            expect(area.denominacion, ctx).toBeTruthy();
            expect(area.competencias_especificas, ctx).toBeDefined();
            expect(area.saberes_basicos.bloques, ctx).toBeDefined();
        }
    });

    it('uses an ES-EFP-prefixed code namespace so codes do not collide with the ES dataset', () => {
        const codes = walkAreas(data).flatMap(({ area }) => Object.keys(area.competencias_especificas));
        expect(codes.length).toBeGreaterThan(0);
        const prefixed = codes.filter(c => c.startsWith('ES-EFP-'));
        // At least the majority of codes follow the ES-EFP- convention; a few BOE-verbatim
        // codes may have a different shape, but the generator-emitted ones are prefixed.
        expect(prefixed.length).toBeGreaterThan(codes.length * 0.5);
    });

    // Regression guard for issue #1832: the ESO etapa previously contained
    // parser artifacts ("Evaluación", codes EXX/EPE/ESC) instead of real
    // subjects. It is now inherited from the state dataset (ES-EFP- prefixed).
    it('ESO exposes real subjects (regenerated), not parser artifacts', () => {
        const eso = data['ESO'];
        expect(Object.keys(eso)).toEqual(['1º ESO', '2º ESO', '3º ESO', '4º ESO']);
        const firstYear = eso['1º ESO'];
        // Real materia codes inherited from the state RD.
        expect(firstYear['BIG']).toBeDefined();          // Biología y Geología
        expect(firstYear['FQX']).toBeDefined();          // Física y Química (data; UI hides in 1º)
        expect(firstYear['BIG'].denominacion).toBe('Biología y Geología');
        // None of the old parser-artifact area codes survive.
        for (const garbage of ['EXX', 'EPE', 'ESC', 'EX2', 'EP7']) {
            expect(firstYear[garbage], `stale artifact ${garbage}`).toBeUndefined();
        }
        // Every ESO competencia code uses the ES-EFP-ESO namespace.
        for (const [, area] of Object.entries(firstYear)) {
            for (const code of Object.keys(area.competencias_especificas)) {
                expect(code.startsWith('ES-EFP-ESO')).toBe(true);
            }
        }
    });
});

describe('lomloe-ES-GA.json (Galicia concretion — full Galician extraction)', () => {
    const data = loadDataset('lomloe-ES-GA.json');

    it('parses as a non-empty object with no placeholder notice', () => {
        expect(typeof data).toBe('object');
        expect(data).not.toBeNull();
        expect(data.__notice__).toBeUndefined();
        expect(Object.keys(data).length).toBeGreaterThan(0);
    });

    it('exposes the four Galician etapa labels', () => {
        for (const etapa of [
            'Educación Infantil',
            'Educación Primaria',
            'Educación Secundaria Obrigatoria',
            'Bacharelato',
        ]) {
            expect(data[etapa], `missing etapa ${etapa}`).toBeDefined();
            expect(Object.keys(data[etapa]).length).toBeGreaterThan(0);
        }
    });

    it('uses Galician nivel labels (per-year for Primaria/ESO/Bacharelato, ciclo for Infantil)', () => {
        expect(Object.keys(data['Educación Primaria'])).toEqual([
            '1º de educación primaria', '2º de educación primaria', '3º de educación primaria',
            '4º de educación primaria', '5º de educación primaria', '6º de educación primaria',
        ]);
        expect(Object.keys(data['Educación Secundaria Obrigatoria'])).toEqual([
            '1º de ESO', '2º de ESO', '3º de ESO', '4º de ESO',
        ]);
        expect(Object.keys(data['Bacharelato'])).toEqual(['1º de bacharelato', '2º de bacharelato']);
        expect(Object.keys(data['Educación Infantil'])).toEqual([
            'Primeiro ciclo (0-3 anos)', 'Segundo ciclo (3-6 anos)',
        ]);
    });

    it('every area record has the iDevice schema shape', () => {
        const sample = walkAreas(data).slice(0, 20);
        expect(sample.length).toBeGreaterThan(0);
        for (const { area, codArea, etapa, nivel } of sample) {
            const ctx = `${etapa}/${nivel}/${codArea}`;
            expect(area.denominacion, ctx).toBeTruthy();
            expect(area.competencias_especificas, ctx).toBeDefined();
            expect(area.saberes_basicos.bloques, ctx).toBeDefined();
        }
    });

    it('every code uses the ES-GA namespace', () => {
        const sample = walkAreas(data).slice(0, 25);
        let checked = false;
        for (const { area } of sample) {
            for (const code of Object.keys(area.competencias_especificas)) {
                expect(code.startsWith('ES-GA-')).toBe(true);
                checked = true;
            }
        }
        expect(checked).toBe(true);
    });

    it('competencia codes are unique within each (nivel, area)', () => {
        for (const { area, codArea, etapa, nivel } of walkAreas(data)) {
            const codes = Object.keys(area.competencias_especificas);
            expect(new Set(codes).size, `${etapa}/${nivel}/${codArea}`).toBe(codes.length);
        }
    });

    it('saberes nombres are globally unique inside the dataset', () => {
        const seen = new Set();
        const dupes = [];
        for (const { area } of walkAreas(data)) {
            for (const items of Object.values(area.saberes_basicos.bloques)) {
                for (const item of items) {
                    if (seen.has(item.nombre)) {
                        dupes.push(item.nombre);
                    }
                    seen.add(item.nombre);
                }
            }
        }
        expect(dupes).toEqual([]);
    });
});

// Shared structural assertions for an autonomous-community concretion. The data
// is generated from the official curriculum decrees, so we check the schema
// contract and the code invariants rather than specific wording.
function assertConcretion(name, prefix, etapaNiveles) {
    describe(name, () => {
        const data = loadDataset(name.split(' ')[0]);

        it('parses as a non-empty object with no placeholder notice', () => {
            expect(typeof data).toBe('object');
            expect(data).not.toBeNull();
            expect(data.__notice__).toBeUndefined();
            expect(Object.keys(data).length).toBeGreaterThan(0);
        });

        it('exposes the expected etapas with the exact nivel labels', () => {
            for (const [etapa, niveles] of Object.entries(etapaNiveles)) {
                expect(data[etapa], `missing etapa ${etapa}`).toBeDefined();
                expect(Object.keys(data[etapa])).toEqual(niveles);
            }
        });

        it('every area record has the iDevice schema shape', () => {
            const sample = walkAreas(data).slice(0, 30);
            expect(sample.length).toBeGreaterThan(0);
            for (const { area, codArea, etapa, nivel } of sample) {
                const ctx = `${etapa}/${nivel}/${codArea}`;
                expect(area.denominacion, ctx).toBeTruthy();
                expect(area.competencias_especificas, ctx).toBeDefined();
                expect(area.saberes_basicos.bloques, ctx).toBeDefined();
            }
        });

        it('has competencias with criterios and at least one saberes bloque', () => {
            let comps = 0, criterios = 0, saberes = 0;
            for (const { area } of walkAreas(data)) {
                for (const comp of Object.values(area.competencias_especificas)) {
                    comps++;
                    expect(comp.descripcion).toBeTruthy();
                    for (const cr of comp.criterios_evaluacion) {
                        criterios++;
                        expect(cr.codigo).toBeTruthy();
                        expect(cr.descripcion).toBeTruthy();
                        expect(Array.isArray(cr.competencias_clave)).toBe(true);
                    }
                }
                for (const items of Object.values(area.saberes_basicos.bloques)) {
                    saberes += items.length;
                }
            }
            expect(comps).toBeGreaterThan(0);
            expect(criterios).toBeGreaterThan(0);
            expect(saberes).toBeGreaterThan(0);
        });

        it(`every code uses the ${prefix} namespace and embeds its area code`, () => {
            let checked = false;
            for (const { area, codArea } of walkAreas(data)) {
                for (const code of Object.keys(area.competencias_especificas)) {
                    expect(code.startsWith(prefix)).toBe(true);
                    expect(code.split('-')[3]).toBe(codArea);
                    checked = true;
                }
            }
            expect(checked).toBe(true);
        });

        it('competencia codes are unique within each (nivel, area)', () => {
            for (const { area, codArea, etapa, nivel } of walkAreas(data)) {
                const codes = Object.keys(area.competencias_especificas);
                expect(new Set(codes).size, `${etapa}/${nivel}/${codArea}`).toBe(codes.length);
            }
        });

        it('saberes nombres are globally unique inside the dataset', () => {
            const seen = new Set();
            const dupes = [];
            for (const { area } of walkAreas(data)) {
                for (const items of Object.values(area.saberes_basicos.bloques)) {
                    for (const item of items) {
                        if (seen.has(item.nombre)) dupes.push(item.nombre);
                        seen.add(item.nombre);
                    }
                }
            }
            expect(dupes).toEqual([]);
        });
    });
}

assertConcretion(
    'lomloe-ES-NC.json (Navarra concretion — official Spanish extraction)',
    'ES-NC-',
    {
        'Educación Infantil': ['Primer ciclo (0-3 años)', 'Segundo ciclo (3-6 años)'],
        'Educación Primaria': [
            '1º de Educación Primaria', '2º de Educación Primaria', '3º de Educación Primaria',
            '4º de Educación Primaria', '5º de Educación Primaria', '6º de Educación Primaria'],
        'Educación Secundaria Obligatoria': ['1º de ESO', '2º de ESO', '3º de ESO', '4º de ESO'],
        'Bachillerato': ['1º de Bachillerato', '2º de Bachillerato'],
    },
);

assertConcretion(
    'lomloe-ES-VC.json (Comunitat Valenciana concretion — official Valencian extraction)',
    'ES-VC-',
    {
        'Educació Infantil': ['Primer cicle (0-3 anys)', 'Segon cicle (3-6 anys)'],
        'Educació Primària': [
            "1r d'Educació Primària", "2n d'Educació Primària", "3r d'Educació Primària",
            "4t d'Educació Primària", "5é d'Educació Primària", "6é d'Educació Primària"],
        'Educació Secundària Obligatòria': ["1r d'ESO", "2n d'ESO", "3r d'ESO", "4t d'ESO"],
        'Batxillerat': ['1r de Batxillerat', '2n de Batxillerat'],
    },
);

describe('lomloe-ES-VC.json (Valencian wording integrity)', () => {
    const data = loadDataset('lomloe-ES-VC.json');
    it('preserves Valencian etapa labels and accented characters', () => {
        const blob = JSON.stringify(data);
        expect(blob).toMatch(/Educació|Primària|Secundària|Batxillerat/);
        expect(blob).toMatch(/[àèòïçé·]/);
    });
});

describe('DATASETS registry (regression guard)', () => {
    // DATASETS is var-scoped inside the iDevice IIFE and not exported, so we
    // assert against the source string. Catches accidental flips of the
    // `available` flag or filename typos.
    const lomloeSrc = readFileSync(join(__testDir, 'lomloe.js'), 'utf-8');

    function entryFor(id) {
        const re = new RegExp(
            "\\{\\s*id:\\s*'" + id + "'[\\s\\S]*?available:\\s*(true|false)",
        );
        return lomloeSrc.match(re);
    }

    it('declares ES with available:true and the lomloe-ES.json file', () => {
        const m = entryFor('ES');
        expect(m, "ES entry missing").not.toBeNull();
        expect(m[1]).toBe('true');
        expect(lomloeSrc).toContain("file: '../data/lomloe-ES.json'");
    });

    it('declares ES-EFP with available:true and the lomloe-ES-EFP.json file', () => {
        const m = entryFor('ES-EFP');
        expect(m, "ES-EFP entry missing").not.toBeNull();
        expect(m[1]).toBe('true');
        expect(lomloeSrc).toContain("file: '../data/lomloe-ES-EFP.json'");
    });

    it('declares ES-EX on hold (available:false) with the lomloe-ES-EX.json file', () => {
        // Temporarily disabled pending confirmation for reactivation. The dataset
        // file stays in the repo; only the availability flag is flipped off.
        const m = entryFor('ES-EX');
        expect(m, "ES-EX entry missing").not.toBeNull();
        expect(m[1]).toBe('false');
        expect(lomloeSrc).toContain("file: '../data/lomloe-ES-EX.json'");
    });

    it('declares ES-MD with available:true and the lomloe-ES-MD.json file', () => {
        const m = entryFor('ES-MD');
        expect(m, "ES-MD entry missing").not.toBeNull();
        expect(m[1]).toBe('true');
        expect(lomloeSrc).toContain("file: '../data/lomloe-ES-MD.json'");
    });

    it('declares ES-GA on hold (available:false) with the lomloe-ES-GA.json file', () => {
        // On hold pending official Galician spec (#1900 / #1898). The dataset
        // file stays in the repo; only the availability flag is flipped off.
        const m = entryFor('ES-GA');
        expect(m, "ES-GA entry missing").not.toBeNull();
        expect(m[1]).toBe('false');
        expect(lomloeSrc).toContain("file: '../data/lomloe-ES-GA.json'");
    });

    it('declares ES-NC with available:true and the lomloe-ES-NC.json file', () => {
        const m = entryFor('ES-NC');
        expect(m, "ES-NC entry missing").not.toBeNull();
        expect(m[1]).toBe('true');
        expect(lomloeSrc).toContain("file: '../data/lomloe-ES-NC.json'");
    });

    it('declares ES-VC with available:true and the lomloe-ES-VC.json file', () => {
        const m = entryFor('ES-VC');
        expect(m, "ES-VC entry missing").not.toBeNull();
        expect(m[1]).toBe('true');
        expect(lomloeSrc).toContain("file: '../data/lomloe-ES-VC.json'");
    });

    it('declares ES-PV (Euskadi) with available:true and the lomloe-ES-PV.json file', () => {
        const m = entryFor('ES-PV');
        expect(m, "ES-PV entry missing").not.toBeNull();
        expect(m[1]).toBe('true');
        expect(lomloeSrc).toContain("file: '../data/lomloe-ES-PV.json'");
        expect(lomloeSrc).toContain('LOMLOE — Euskadi / País Vasco');
        expect(lomloeSrc).toContain('showDescriptorsAtCompetency: true');
    });

    it('leaves ES-CN unchanged (available:true)', () => {
        const m = entryFor('ES-CN');
        expect(m, "ES-CN entry missing").not.toBeNull();
        expect(m[1]).toBe('true');
    });
});

// ════════════════════════════════════════════════════════════════
// Real-dataset render test: load the actual lomloe-ES-PV.json through the
// editor and walk Infantil → Primaria → ESO, asserting the Basque stage tree
// renders and a selected materia shows its competencias/criterios/saberes.
describe('LOMLOE Euskadi (ES-PV) real-dataset render', () => {
    let el, dev;

    beforeEach(async () => {
        const raw = await import('./lomloe.js?raw').then(m => m.default);
        dev = new Function('globalThis', '_', 'CSS', raw + '\nreturn $exeDevice;')(
            globalThis, globalThis._, globalThis.CSS
        );
    });
    afterEach(() => {
        el && el.remove();
        vi.restoreAllMocks();
    });

    async function initEsPv(saved) {
        el = buildMockElement();
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ ok: true, json: () => Promise.resolve(esPvDataset) })
        );
        dev.init(el, Object.assign({ lomloeDataset: 'ES-PV', lomloeSelections: [] }, saved || {}));
        await new Promise(r => setTimeout(r, 80));
        return el;
    }

    it('renders the three Basque etapas in canonical order', async () => {
        await initEsPv();
        const order = Array.from(el.querySelectorAll('.lomloe-etapa-btn')).map(b => b.dataset.etapa);
        expect(order).toEqual([
            'Haur Hezkuntza', 'Lehen Hezkuntza', 'Derrigorrezko Bigarren Hezkuntza',
        ]);
    });

    it('renders niveles when each etapa is opened', async () => {
        await initEsPv();
        const open = (etapa) => {
            const btn = Array.from(el.querySelectorAll('.lomloe-etapa-btn'))
                .find(b => b.dataset.etapa === etapa);
            btn.click();
            return Array.from(el.querySelectorAll('.lomloe-nivel-btn')).map(b => b.dataset.nivel);
        };
        expect(open('Haur Hezkuntza')).toEqual(['Lehen zikloa (0-3 urte)', 'Bigarren zikloa (3-6 urte)']);
        expect(open('Lehen Hezkuntza')).toContain('Lehen Hezkuntzako 1. maila');
        expect(open('Derrigorrezko Bigarren Hezkuntza')).toContain('DBHko 1. maila');
    });

    async function materiasAfter(etapa, nivel) {
        const eb = Array.from(el.querySelectorAll('.lomloe-etapa-btn')).find(b => b.dataset.etapa === etapa);
        eb.click();
        await new Promise(r => setTimeout(r, 30));
        const nb = Array.from(el.querySelectorAll('.lomloe-nivel-btn')).find(b => b.dataset.nivel === nivel);
        nb.click();
        await new Promise(r => setTimeout(r, 30));
        return Array.from(el.querySelectorAll('.lomloe-materia-item')).map(li => li.dataset.codarea);
    }

    it('lists the expected materias when navigating to a nivel in each etapa', async () => {
        await initEsPv();
        expect(await materiasAfter('Haur Hezkuntza', 'Lehen zikloa (0-3 urte)'))
            .toEqual(['HH', 'IEE', 'KEA']);
        expect(await materiasAfter('Lehen Hezkuntza', 'Lehen Hezkuntzako 1. maila'))
            .toContain('MAT');
        const eso1 = await materiasAfter('Derrigorrezko Bigarren Hezkuntza', 'DBHko 1. maila');
        expect(eso1).toEqual(expect.arrayContaining(['EL', 'GL', 'AHIZ', 'MAT', 'GH', 'HF']));
    });

    it('lists the corrected ESO subjects in their official courses', async () => {
        await initEsPv();
        const eso1 = await materiasAfter('Derrigorrezko Bigarren Hezkuntza', 'DBHko 1. maila');
        const eso2 = await materiasAfter('Derrigorrezko Bigarren Hezkuntza', 'DBHko 2. maila');
        const eso3 = await materiasAfter('Derrigorrezko Bigarren Hezkuntza', 'DBHko 3. maila');
        const eso4 = await materiasAfter('Derrigorrezko Bigarren Hezkuntza', 'DBHko 4. maila');

        expect(eso1).toContain('MUS');
        expect(eso2).toContain('MUS');
        expect(eso3).toEqual(expect.arrayContaining(['MUS', 'KZ']));
        expect(eso4).toEqual(expect.arrayContaining(['MUS', 'LAT', 'AA', 'KZ', 'ML']));
        expect(eso1).not.toContain('AA');
        expect(eso2).not.toContain('AA');
        expect(eso3).not.toContain('AA');
    });

    it('renders a selected Primaria materia curriculum and competencia descriptors', async () => {
        await initEsPv();
        await materiasAfter('Lehen Hezkuntza', 'Lehen Hezkuntzako 1. maila');
        const mat = Array.from(el.querySelectorAll('.lomloe-materia-item')).find(li => li.dataset.codarea === 'MAT');
        mat.click();
        await new Promise(r => setTimeout(r, 40));
        expect(el.querySelector('.lomloe-materia-item.active')).toBeTruthy();
        expect(el.innerHTML).toContain('ES-PV-PRI1-MAT-');
        expect(el.querySelector('.lomloe-comp-cc-tags .lomloe-cc-tag')).toBeTruthy();
    });
});
