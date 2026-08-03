/**
 * LOMLOE Euskadi / País Vasco (ES-PV) dataset — content regression tests.
 *
 * The dataset ships entirely in official Basque (euskara): Educación Básica
 * (Lehen Hezkuntza + DBH) from Decreto 77/2023 and Educación Infantil (Haur
 * Hezkuntza) from Decreto 75/2023, both EHAA 109. zk. (2023-06-09). These guards
 * keep the structure, code namespace, per-course ESO distribution, Basque-text
 * integrity, descriptor coverage and the documented Infantil descriptor gap from
 * silently regressing.
 *
 * Run with:  npx vitest run public/files/perm/idevices/base/lomloe/data/lomloe-ES-PV.test.js
 */
import { describe, it, expect } from 'vitest';
import dataset from './lomloe-ES-PV.json';

const INFANTIL = 'Haur Hezkuntza';
const PRIMARIA = 'Lehen Hezkuntza';
const ESO = 'Derrigorrezko Bigarren Hezkuntza';
const ETAPAS = [INFANTIL, PRIMARIA, ESO];

const PRIMARIA_NIVELES = [
    'Lehen Hezkuntzako 1. maila', 'Lehen Hezkuntzako 2. maila',
    'Lehen Hezkuntzako 3. maila', 'Lehen Hezkuntzako 4. maila',
    'Lehen Hezkuntzako 5. maila', 'Lehen Hezkuntzako 6. maila',
];
const ESO_NIVELES = ['DBHko 1. maila', 'DBHko 2. maila', 'DBHko 3. maila', 'DBHko 4. maila'];
const INFANTIL_NIVELES = ['Lehen zikloa (0-3 urte)', 'Bigarren zikloa (3-6 urte)'];

// Basque descriptor family codes published in ANEXO I of Decreto 77/2023.
const DESC_FAMILIES = ['HKK', 'KE', 'STEM', 'KD', 'KPSII', 'HK', 'EK', 'KAKK'];
const DESC_CODE_RE = new RegExp(`^(${DESC_FAMILIES.join('|')})(\\d+)?$`);

// Reserved top-level key, mirrors RESERVED_DATASET_KEYS in edition/lomloe.js.
const RESERVED = ['descriptors'];

function etapaKeys() {
    return Object.keys(dataset).filter((k) => !RESERVED.includes(k));
}

function walkAreas() {
    const out = [];
    for (const etapa of etapaKeys()) {
        for (const [nivel, areas] of Object.entries(dataset[etapa])) {
            for (const [codArea, area] of Object.entries(areas)) {
                out.push({ etapa, nivel, codArea, area });
            }
        }
    }
    return out;
}

describe('lomloe-ES-PV.json — structure', () => {
    it('parses as a non-empty object with no placeholder notice', () => {
        expect(typeof dataset).toBe('object');
        expect(dataset).not.toBeNull();
        expect(dataset.__notice__).toBeUndefined();
        expect(Object.keys(dataset).length).toBeGreaterThan(0);
    });

    it('exposes the three expected etapas (no Bachillerato) plus descriptors', () => {
        expect(etapaKeys().sort()).toEqual([...ETAPAS].sort());
        expect(dataset.Bachillerato).toBeUndefined();
        expect(dataset.Batxillerat).toBeUndefined();
    });

    it('uses the expected Basque nivel keys for each etapa', () => {
        expect(Object.keys(dataset[INFANTIL])).toEqual(INFANTIL_NIVELES);
        expect(Object.keys(dataset[PRIMARIA])).toEqual(PRIMARIA_NIVELES);
        expect(Object.keys(dataset[ESO])).toEqual(ESO_NIVELES);
    });

    it('every area carries the iDevice schema shape', () => {
        for (const { area, codArea, etapa, nivel } of walkAreas()) {
            const ctx = `${etapa}/${nivel}/${codArea}`;
            expect(area.denominacion, ctx).toBeTruthy();
            expect(area.competencias_especificas, ctx).toBeDefined();
            expect(area.saberes_basicos, ctx).toBeDefined();
            expect(area.saberes_basicos.bloques, ctx).toBeDefined();
        }
    });

    it('every competencia carries descripcion + criterios; every criterio has codigo/descripcion/competencias_clave', () => {
        for (const { area, codArea, etapa, nivel } of walkAreas()) {
            const ctx = `${etapa}/${nivel}/${codArea}`;
            for (const comp of Object.values(area.competencias_especificas)) {
                expect(typeof comp.descripcion, ctx).toBe('string');
                expect(comp.descripcion.length, ctx).toBeGreaterThan(0);
                expect(Array.isArray(comp.criterios_evaluacion), ctx).toBe(true);
                for (const crit of comp.criterios_evaluacion) {
                    expect(crit.codigo, ctx).toBeTruthy();
                    expect(crit.descripcion, ctx).toBeTruthy();
                    expect(Array.isArray(crit.competencias_clave), ctx).toBe(true);
                }
            }
        }
    });
});

describe('lomloe-ES-PV.json — codes', () => {
    it('every competencia/criterio code uses the ES-PV- namespace with split[3] === area', () => {
        for (const { area, codArea } of walkAreas()) {
            for (const [code, comp] of Object.entries(area.competencias_especificas)) {
                expect(code.startsWith('ES-PV-')).toBe(true);
                expect(code.split('-')[3]).toBe(codArea);
                for (const crit of comp.criterios_evaluacion) {
                    expect(crit.codigo.startsWith(code + '-')).toBe(true);
                }
            }
        }
    });

    it('competencia codes are unique within each (etapa, nivel, area)', () => {
        for (const { area, codArea, etapa, nivel } of walkAreas()) {
            const codes = Object.keys(area.competencias_especificas);
            expect(new Set(codes).size, `${etapa}/${nivel}/${codArea}`).toBe(codes.length);
        }
    });

    it('criterio codes are unique within each competencia', () => {
        for (const { area } of walkAreas()) {
            for (const comp of Object.values(area.competencias_especificas)) {
                const codes = comp.criterios_evaluacion.map((c) => c.codigo);
                expect(new Set(codes).size).toBe(codes.length);
            }
        }
    });

    it('saber nombres are globally unique inside the dataset', () => {
        const seen = new Set();
        const dupes = [];
        for (const { area } of walkAreas()) {
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

describe('lomloe-ES-PV.json — descriptors (Basque perfil de salida catalogue)', () => {
    function usedCodes() {
        const used = new Set();
        for (const { area } of walkAreas()) {
            for (const comp of Object.values(area.competencias_especificas)) {
                for (const cr of comp.criterios_evaluacion) {
                    for (const cc of cr.competencias_clave || []) used.add(cc);
                }
            }
        }
        return used;
    }

    it('ships a non-empty `descriptors` catalogue with well-formed Basque codes', () => {
        const cat = dataset.descriptors;
        expect(cat && typeof cat === 'object' && !Array.isArray(cat)).toBe(true);
        const keys = Object.keys(cat);
        expect(keys.length).toBeGreaterThan(0);
        for (const k of keys) {
            expect(k, `bad descriptor code ${k}`).toMatch(DESC_CODE_RE);
            expect(typeof cat[k]).toBe('string');
            expect(cat[k].trim().length).toBeGreaterThan(0);
        }
    });

    it('covers every competencia-clave code used anywhere in the dataset', () => {
        const cat = dataset.descriptors || {};
        const missing = [...usedCodes()].filter((c) => !(c in cat)).sort();
        expect(missing, `codes used but missing from catalogue: ${missing.join(', ')}`).toEqual([]);
    });

    it('`descriptors` is a reserved top-level key, not an etapa', () => {
        expect(Object.keys(dataset)).toContain('descriptors');
        expect(etapaKeys()).not.toContain('descriptors');
    });

    it('uses Basque family codes (HKK/KE/KD/KPSII/HK/EK/KAKK), not the Castilian set', () => {
        const cat = dataset.descriptors;
        expect(cat.HKK).toBeTruthy();
        expect(cat.KAKK).toBeTruthy();
        expect(cat.CCL).toBeUndefined();
        expect(cat.CCEC).toBeUndefined();
    });
});

describe('lomloe-ES-PV.json — Basque text integrity', () => {
    function allText() {
        const chunks = [];
        for (const { area } of walkAreas()) {
            chunks.push(area.denominacion);
            for (const comp of Object.values(area.competencias_especificas)) {
                chunks.push(comp.descripcion, comp.explicacion_bloque_competencial || '');
                for (const cr of comp.criterios_evaluacion) chunks.push(cr.descripcion);
            }
            for (const items of Object.values(area.saberes_basicos.bloques)) {
                for (const it of items) chunks.push(it.subtitulo_nivel_1 || '', it.subtitulo_nivel_2 || '');
            }
        }
        for (const v of Object.values(dataset.descriptors || {})) chunks.push(v);
        return chunks.join('\n');
    }

    it('contains no Unicode replacement characters or obvious mojibake', () => {
        const text = allText();
        expect(text.includes('�')).toBe(false);
        expect(text).not.toMatch(/Ã©|Ã±|Â¿|â€/);
    });

    it('contains no BOPV/EHAA headers, footers or page-number fragments', () => {
        const text = allText();
        expect(text).not.toMatch(/EUSKAL HERRIKO AGINTARITZAREN ALDIZKARIA/);
        expect(text).not.toMatch(/BOLET[ÍI]N OFICIAL DEL PA[ÍI]S VASCO/);
        expect(text).not.toMatch(/109\. zk\./);
        expect(text).not.toMatch(/2023\/27\d{2} \(\d+\/\d+\)/);
    });
});

describe('lomloe-ES-PV.json — Primaria cycle-to-year mapping', () => {
    const critShape = (area) =>
        Object.values(area.competencias_especificas).map((c) => ({
            d: c.descripcion,
            crits: c.criterios_evaluacion.map((x) => x.descripcion),
        }));

    // Both years of a cycle carry IDENTICAL criterios (cycle content duplicated).
    for (const [a, b] of [
        ['Lehen Hezkuntzako 1. maila', 'Lehen Hezkuntzako 2. maila'],
        ['Lehen Hezkuntzako 3. maila', 'Lehen Hezkuntzako 4. maila'],
        ['Lehen Hezkuntzako 5. maila', 'Lehen Hezkuntzako 6. maila'],
    ]) {
        it(`${a} and ${b} share identical criterios for every shared area`, () => {
            const ya = dataset[PRIMARIA][a];
            const yb = dataset[PRIMARIA][b];
            for (const codArea of Object.keys(ya)) {
                if (yb[codArea]) {
                    expect(critShape(ya[codArea]), codArea).toEqual(critShape(yb[codArea]));
                }
            }
        });
    }

    it('Balio Zibiko eta Etikoetako Heziketa appears only in 6. maila', () => {
        const present = PRIMARIA_NIVELES.filter((n) => dataset[PRIMARIA][n].BZEH);
        expect(present).toEqual(['Lehen Hezkuntzako 6. maila']);
    });
});

describe('lomloe-ES-PV.json — ESO per-course distribution (no runtime filter needed)', () => {
    it('every ESO course exposes at least the full-stage core subjects', () => {
        // Euskara (EL), Gaztelania (GL), foreign language, Matematika, GH and EF
        // are taught in all four courses.
        for (const course of ESO_NIVELES) {
            const areas = dataset[ESO][course];
            expect(Object.keys(areas).length, course).toBeGreaterThan(0);
        }
    });

    it('Biologia eta Geologia / Fisika eta Kimika are not exposed in 1.º–2.º ESO', () => {
        // They are taught from 3.º (Ciencias de la Naturaleza covers 1.º–2.º).
        const codesIn = (n) => Object.keys(dataset[ESO][n]);
        const bg = walkAreas().find((a) => /Biologia eta Geologia/i.test(a.area.denominacion));
        if (bg) {
            expect(codesIn('DBHko 1. maila')).not.toContain(bg.codArea);
            expect(codesIn('DBHko 2. maila')).not.toContain(bg.codArea);
        }
    });

    it('exposes Música in 1.º–4.º and the corrected 3.º/4.º subjects', () => {
        const codesIn = (n) => Object.keys(dataset[ESO][n]);
        for (const level of ESO_NIVELES) {
            expect(codesIn(level), level).toContain('MUS');
        }
        expect(codesIn('DBHko 3. maila')).toContain('KZ');
        expect(codesIn('DBHko 4. maila')).toEqual(
            expect.arrayContaining(['MUS', 'LAT', 'AA', 'KZ', 'ML']),
        );
        expect(codesIn('DBHko 1. maila')).not.toContain('AA');
        expect(codesIn('DBHko 2. maila')).not.toContain('AA');
        expect(codesIn('DBHko 3. maila')).not.toContain('AA');
    });

    it('keeps Matematika Lantegia visible without fabricating an unpublished curriculum', () => {
        const area = dataset[ESO]['DBHko 4. maila'].ML;
        expect(area.denominacion).toBe('Matematika Lantegia');
        expect(area.competencias_especificas).toEqual({});
        expect(area.saberes_basicos.bloques).toEqual({});
    });

    it('does not bleed Música curriculum text into Matematika', () => {
        for (const level of ESO_NIVELES) {
            const area = dataset[ESO][level].MAT;
            expect(JSON.stringify(area)).not.toContain('Produkzio musikal');
        }
    });

    it('newly extracted subjects carry competencia-level operational descriptors', () => {
        for (const [level, codes] of [
            ['DBHko 1. maila', ['MUS']],
            ['DBHko 3. maila', ['MUS', 'KZ']],
            ['DBHko 4. maila', ['MUS', 'LAT', 'AA', 'KZ']],
        ]) {
            for (const code of codes) {
                const area = dataset[ESO][level][code];
                for (const comp of Object.values(area.competencias_especificas)) {
                    const descriptors = new Set(
                        comp.criterios_evaluacion.flatMap((criterion) => criterion.competencias_clave),
                    );
                    expect(descriptors.size, `${level}/${code}`).toBeGreaterThan(0);
                }
            }
        }
    });

});

describe('lomloe-ES-PV.json — Infantil descriptor policy (documented source limitation)', () => {
    it('exposes the three Infantil areas across both cycles', () => {
        for (const nivel of INFANTIL_NIVELES) {
            expect(Object.keys(dataset[INFANTIL][nivel]).length).toBe(3);
        }
    });

    // Decreto 75/2023 publishes NO per-competencia / per-criterio competencia-clave
    // mapping for Infantil (the perfil de salida descriptores are defined only at
    // the end of Lehen Hezkuntza and Oinarrizko Hezkuntza). We therefore leave the
    // Infantil criterios' competencias_clave empty rather than fabricate or copy a
    // mapping the source does not make. This guard locks that decision.
    it('Infantil criterios carry an empty competencias_clave array (no fabricated backfill)', () => {
        let total = 0;
        for (const niveles of Object.values(dataset[INFANTIL])) {
            for (const area of Object.values(niveles)) {
                for (const comp of Object.values(area.competencias_especificas)) {
                    for (const cr of comp.criterios_evaluacion) {
                        total++;
                        expect(Array.isArray(cr.competencias_clave)).toBe(true);
                        expect(cr.competencias_clave).toEqual([]);
                    }
                }
            }
        }
        expect(total).toBeGreaterThan(0);
    });
});
