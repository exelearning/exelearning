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
        expect(saved.lomloeSummaryHtml).toContain('>Saberes Básicos<');
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
        expect(saved.lomloeSummaryHtml).not.toContain('Saberes Básicos');
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

    it('partial: true produces "(parcial)" in summary HTML', async () => {
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
        expect(saved.lomloeSummaryHtml).toContain('parcial');
        expect(saved.lomloeSummaryHtml).toContain('lomloe-partial-indicator');
    });

    it('partial: false does not produce "(parcial)" in summary HTML', async () => {
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
        expect(saved.lomloeSummaryHtml).not.toContain('parcial');
    });

    it('uses "Descriptores operativos" header for Primaria with Criterio first', async () => {
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
        expect(saved.lomloeSummaryHtml).toContain('Descriptores operativos');
        expect(saved.lomloeSummaryHtml).not.toContain('>Comp. Clave<');
        // Column order: Criterio before Descriptores operativos
        const critIdx = saved.lomloeSummaryHtml.indexOf('>Criterios de Eval.<');
        const descIdx = saved.lomloeSummaryHtml.indexOf('>Descriptores operativos<');
        expect(critIdx).toBeLessThan(descIdx);
        // "Comp. Específica" header with tooltip
        expect(saved.lomloeSummaryHtml).toContain('Comp. Específica');
        expect(saved.lomloeSummaryHtml).toContain('data-lomloe-tip="Competencias Específicas"');
    });

    it('uses "Comp. Clave" header for Infantil with Comp. Clave first', async () => {
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
        expect(saved.lomloeSummaryHtml).toContain('Comp. Clave');
        expect(saved.lomloeSummaryHtml).not.toContain('Descriptores operativos');
        // Column order: Comp. Clave before Criterio
        const ccIdx = saved.lomloeSummaryHtml.indexOf('>Comp. Clave<');
        const critIdx = saved.lomloeSummaryHtml.indexOf('>Criterios de Eval.<');
        expect(ccIdx).toBeLessThan(critIdx);
        // "Comp. Específica" header with tooltip
        expect(saved.lomloeSummaryHtml).toContain('Comp. Específica');
        // Comp. Clave header has Bootstrap tooltip
        expect(saved.lomloeSummaryHtml).toContain('data-lomloe-tip="Competencias Clave"');
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
});
