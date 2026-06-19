/**
 * LOMLOE Comunitat Valenciana dataset — content regression tests.
 *
 * Guards the presence and structure of the Batxillerat modality subjects that
 * were missing from the original dataset (Grec I i II and Llatí I i II), so the
 * gap reported in review cannot silently regress.
 *
 * Run with:  npx vitest run public/files/perm/idevices/base/lomloe/data/lomloe-ES-VC.test.js
 */
import { describe, it, expect } from 'vitest';
import dataset from './lomloe-ES-VC.json';

const COURSES = ['1r de Batxillerat', '2n de Batxillerat'];

// Subject code -> { denominacion, tag (BAT1/BAT2 derived from course) }
const SUBJECTS = {
    GI: 'GREC I i II',
    LI: 'LLATÍ I i II',
};

describe('LOMLOE ES-VC Batxillerat modality subjects', () => {
    it('exposes both Batxillerat courses', () => {
        expect(dataset.Batxillerat).toBeDefined();
        for (const course of COURSES) {
            expect(dataset.Batxillerat[course]).toBeDefined();
        }
    });

    for (const course of COURSES) {
        const tag = course.startsWith('1r') ? 'BAT1' : 'BAT2';
        for (const [code, denominacion] of Object.entries(SUBJECTS)) {
            describe(`${denominacion} (${code}) — ${course}`, () => {
                const subject = dataset.Batxillerat[course][code];

                it('is present with the expected denominacion', () => {
                    expect(subject).toBeDefined();
                    expect(subject.denominacion).toBe(denominacion);
                });

                it('has five competències específiques with well-formed codes and criteris', () => {
                    const comps = subject.competencias_especificas;
                    const keys = Object.keys(comps);
                    expect(keys).toHaveLength(5);
                    for (const key of keys) {
                        expect(key).toMatch(new RegExp(`^ES-VC-${tag}-${code}-CE\\d{2}$`));
                        const comp = comps[key];
                        expect(comp.descripcion.length).toBeGreaterThan(0);
                        expect(comp.explicacion_bloque_competencial.length).toBeGreaterThan(0);
                        expect(comp.criterios_evaluacion.length).toBeGreaterThan(0);
                        for (const crit of comp.criterios_evaluacion) {
                            expect(crit.codigo).toMatch(new RegExp(`^${key}-CR\\d{2}$`));
                            expect(crit.descripcion.length).toBeGreaterThan(0);
                            expect(Array.isArray(crit.competencias_clave)).toBe(true);
                        }
                    }
                });

                it('has four sabers bàsics blocs with well-formed item codes', () => {
                    const bloques = subject.saberes_basicos.bloques;
                    const titles = Object.keys(bloques);
                    expect(titles).toHaveLength(4);
                    let total = 0;
                    for (const title of titles) {
                        expect(title).toMatch(/^\d\. /);
                        for (const item of bloques[title]) {
                            expect(item.nombre).toMatch(new RegExp(`^ES-VC-${tag}-${code}-SB\\d{2}-\\d{3}$`));
                            expect(item.subtitulo_nivel_1.length).toBeGreaterThan(0);
                            total += 1;
                        }
                    }
                    expect(total).toBeGreaterThan(0);
                });
            });
        }
    }

    it('splits criteris between the two courses (Grec I vs Grec II differ)', () => {
        const ce1 = course =>
            dataset.Batxillerat[course].GI.competencias_especificas[
                `ES-VC-${course.startsWith('1r') ? 'BAT1' : 'BAT2'}-GI-CE01`
            ].criterios_evaluacion.map(c => c.descripcion);
        expect(ce1('1r de Batxillerat')).not.toEqual(ce1('2n de Batxillerat'));
    });
});

// The same modality subject (e.g. GREC) is offered in both Batxillerat courses.
// The editor builds a per-selection ID from the etapa/nivel plus the data codes
// (competencia + criterio for criteris, bloc + saber code for saberes). If the
// codes did not embed the BAT1/BAT2 year tag, the "same" criterio/saber in both
// courses would collapse to a single selection ID and a teacher could not tag
// both years independently. This guard mirrors the ID composition in
// edition/lomloe.js (SEP = unit separator \x1F) and asserts the codes carry the
// year tag so selection IDs stay distinct across the two courses.
describe('LOMLOE ES-VC Batxillerat selection-id uniqueness across courses', () => {
    const SEP = '\x1F'; // keep in sync with edition/lomloe.js
    const etapa = 'Batxillerat';
    const COURSE_TAG = { '1r de Batxillerat': 'BAT1', '2n de Batxillerat': 'BAT2' };

    const saberSelId = (nivel, codArea, bloque, nombre) => ['saber', etapa, nivel, codArea, bloque, nombre].join(SEP);
    const criterioSelId = (nivel, codArea, codigoComp, codigoCriterio) =>
        ['criterio', etapa, nivel, codArea, codigoComp, codigoCriterio].join(SEP);

    function selectionIdsFor(nivel) {
        const ids = [];
        const subjects = dataset.Batxillerat[nivel];
        for (const [codArea, area] of Object.entries(subjects)) {
            for (const [codigoComp, comp] of Object.entries(area.competencias_especificas)) {
                for (const crit of comp.criterios_evaluacion) {
                    ids.push(criterioSelId(nivel, codArea, codigoComp, crit.codigo));
                }
            }
            for (const [bloque, items] of Object.entries(area.saberes_basicos.bloques)) {
                for (const item of items) {
                    ids.push(saberSelId(nivel, codArea, bloque, item.nombre));
                }
            }
        }
        return ids;
    }

    it('every data code carries the BAT1/BAT2 tag of its course', () => {
        for (const [nivel, tag] of Object.entries(COURSE_TAG)) {
            const subjects = dataset.Batxillerat[nivel];
            expect(Object.keys(subjects).length).toBeGreaterThan(0);
            for (const area of Object.values(subjects)) {
                for (const [codigoComp, comp] of Object.entries(area.competencias_especificas)) {
                    expect(codigoComp).toContain(`-${tag}-`);
                    for (const crit of comp.criterios_evaluacion) {
                        expect(crit.codigo).toContain(`-${tag}-`);
                    }
                }
                for (const items of Object.values(area.saberes_basicos.bloques)) {
                    for (const item of items) {
                        expect(item.nombre).toContain(`-${tag}-`);
                    }
                }
            }
        }
    });

    it('selection IDs are unique within and across both Batxillerat courses', () => {
        const ids1 = selectionIdsFor('1r de Batxillerat');
        const ids2 = selectionIdsFor('2n de Batxillerat');
        expect(ids1.length).toBeGreaterThan(0);
        expect(ids2.length).toBeGreaterThan(0);

        const all = [...ids1, ...ids2];
        const unique = new Set(all);
        // No collision within a course, and none across the two courses: the
        // BAT1/BAT2 tag in the codes keeps the same subject's selections distinct.
        expect(unique.size).toBe(all.length);

        // Cross-course intersection must be empty for the shared subjects.
        const set1 = new Set(ids1);
        const collisions = ids2.filter(id => set1.has(id));
        expect(collisions).toEqual([]);
    });
});

// Primària criteris d'avaluació are defined PER CICLE in Decret 106/2022, so the
// two years of a cycle must carry IDENTICAL criteris. The official annex labels
// each criteris column either by its cycle ("2n cicle (4t curs)") or only by the
// cycle's reference year ("4t primària", "4t de primària", "4t curs EP"); the
// latter variant previously collapsed onto the terminal year alone, leaving the
// first year of the cycle (3r, 5é) with no criteris for EPV / LCL / M while the
// terminal year (4t, 6é) had them. This guard keeps both years of every cycle in
// lock-step so that regression cannot return.
describe('LOMLOE ES-VC Primària per-cicle criteris parity', () => {
    const ETAPA = 'Educació Primària';
    const CYCLES = [
        ["3r d'Educació Primària", "4t d'Educació Primària"],
        ["5é d'Educació Primària", "6é d'Educació Primària"],
    ];
    // The areas that exposed the bug (column header printed without "cicle").
    const PREVIOUSLY_BROKEN = ['EPV', 'LCL', 'M'];

    // Comparable, code-independent view of an area's criteris: the competence
    // statement plus each criterio's descripcion, in document order.
    const criterisShape = area =>
        Object.values(area.competencias_especificas).map(comp => ({
            descripcion: comp.descripcion,
            criterios: comp.criterios_evaluacion.map(c => c.descripcion),
        }));

    for (const [firstYear, secondYear] of CYCLES) {
        describe(`${firstYear} ↔ ${secondYear}`, () => {
            const first = dataset[ETAPA][firstYear];
            const second = dataset[ETAPA][secondYear];

            it('both years exist with the same set of àrees', () => {
                expect(first).toBeDefined();
                expect(second).toBeDefined();
                expect(Object.keys(first).sort()).toEqual(Object.keys(second).sort());
            });

            it('every àrea carries identical criteris content in both cycle years', () => {
                for (const codArea of Object.keys(second)) {
                    expect(criterisShape(first[codArea]), codArea).toEqual(criterisShape(second[codArea]));
                }
            });

            it('the previously-broken àrees now carry criteris in the first cycle year', () => {
                for (const codArea of PREVIOUSLY_BROKEN) {
                    const comps = first[codArea].competencias_especificas;
                    expect(Object.keys(comps).length, codArea).toBeGreaterThan(0);
                    for (const [code, comp] of Object.entries(comps)) {
                        // codes carry this concrete year's niveltag (PRI3 / PRI5)
                        expect(code.split('-')[3]).toBe(codArea);
                        expect(comp.criterios_evaluacion.length).toBeGreaterThan(0);
                    }
                }
            });
        });
    }
});

// The in-force Decret 106/2022 does not publish criteris d'avaluació for the 1r
// cicle (1r i 2n) — its Annex III only has 2n/3r cicle columns. The 1r-cicle
// criteris come from the 2026 PROJECTE de modificació of Decret 106/2022, which
// re-publishes apartat 6 of each àrea with a 1r-cicle column. We add only that
// 1r-cicle column (the in-force 2n/3r criteris in 3r-6é are unchanged); both
// years of the first cicle carry identical criteris, alongside the sabers bàsics
// the in-force decree already publishes for the 1r cicle.
describe('LOMLOE ES-VC Primària 1r cicle criteris (from the 2026 modification)', () => {
    const ETAPA = 'Educació Primària';
    const FIRST_CICLE = ["1r d'Educació Primària", "2n d'Educació Primària"];
    // Standard àrees whose 1r-cicle criteris the modification graduates.
    const CORE = ['CMNSC', 'MD', 'EPV', 'EF', 'LCL', 'LE', 'M'];

    it('1r and 2n carry both criteris and sabers bàsics for the core àrees', () => {
        for (const year of FIRST_CICLE) {
            const nivel = dataset[ETAPA][year];
            for (const area of CORE) {
                const a = nivel[area];
                expect(a, `${year}/${area} missing`).toBeDefined();
                expect(
                    Object.keys(a.competencias_especificas).length,
                    `${year}/${area} should carry 1r-cicle criteris`,
                ).toBeGreaterThan(0);
                const saberItems = Object.values(a.saberes_basicos.bloques).reduce(
                    (n, items) => n + items.length,
                    0,
                );
                expect(saberItems, `${year}/${area} should carry sabers bàsics`).toBeGreaterThan(0);
            }
        }
    });

    it('1r and 2n share identical criteris (cicle-1 duplication)', () => {
        const shape = area =>
            Object.values(area.competencias_especificas).map(c => ({
                descripcion: c.descripcion,
                criterios: c.criterios_evaluacion.map(x => x.descripcion),
            }));
        for (const area of CORE) {
            expect(shape(dataset[ETAPA]["1r d'Educació Primària"][area]), area).toEqual(
                shape(dataset[ETAPA]["2n d'Educació Primària"][area]),
            );
        }
    });

    it('codes use the PRI1/PRI2 niveltag with split[3] equal to the àrea code', () => {
        for (const [year, tag] of [
            ["1r d'Educació Primària", 'PRI1'],
            ["2n d'Educació Primària", 'PRI2'],
        ]) {
            for (const area of CORE) {
                for (const [code, comp] of Object.entries(
                    dataset[ETAPA][year][area].competencias_especificas,
                )) {
                    expect(code).toContain(`-${tag}-`);
                    expect(code.split('-')[3]).toBe(area);
                    expect(comp.criterios_evaluacion.length).toBeGreaterThan(0);
                    for (const cr of comp.criterios_evaluacion) {
                        expect(cr.codigo).toContain(`-${tag}-`);
                    }
                }
            }
        }
    });
});

// ESO criteris d'avaluació in Decret 107/2022 are published as a FIRST-CYCLE
// block (cursos 1r-3r) + a separate 4t block (RD 217/2022 arts. 8-9; Decret
// 107/2022 arts. 10 & 12), NOT per individual course. A subject taught every
// year (Matemàtiques, Llengua Castellana, Geografia i Història, Llengua
// Estrangera, Educació Física) names its first-cycle column with a single
// representative course ("2n d'ESO", "3r ESO", "SEGON CURS"…) and its 4t column
// with 4t; the first-cycle criteris therefore apply to 1r, 2n AND 3r. They
// previously landed only on the representative course, leaving the other
// first-cycle years empty. This guard keeps the full-stage subjects present in
// all four courses with identical first-cycle content.
describe('LOMLOE ES-VC ESO first-cycle criteris span the whole 1r cicle (1r-3r)', () => {
    const ETAPA = 'Educació Secundària Obligatòria';
    const COURSES = ["1r d'ESO", "2n d'ESO", "3r d'ESO", "4t d'ESO"];
    // Subjects taught every ESO year (Decret 107/2022 arts. 10.2 & 12.1).
    const FULL_STAGE = ['M', 'LCL', 'LE', 'EF', 'GH'];

    const critShape = area =>
        Object.values(area.competencias_especificas).map(comp => ({
            descripcion: comp.descripcion,
            criterios: comp.criterios_evaluacion.map(c => c.descripcion),
        }));

    for (const codArea of FULL_STAGE) {
        describe(codArea, () => {
            it('carries criteris in all four ESO courses', () => {
                for (const course of COURSES) {
                    const area = dataset[ETAPA][course]?.[codArea];
                    expect(area, `${codArea} missing in ${course}`).toBeDefined();
                    expect(
                        Object.keys(area.competencias_especificas).length,
                        `${codArea}/${course} has no criteris`,
                    ).toBeGreaterThan(0);
                }
            });

            it('shares identical first-cycle criteris across 1r, 2n and 3r', () => {
                const s1 = critShape(dataset[ETAPA]["1r d'ESO"][codArea]);
                const s2 = critShape(dataset[ETAPA]["2n d'ESO"][codArea]);
                const s3 = critShape(dataset[ETAPA]["3r d'ESO"][codArea]);
                expect(s1).toEqual(s2);
                expect(s2).toEqual(s3);
            });

            it('embeds the per-course ESO tag in every code', () => {
                for (const course of COURSES) {
                    const tag = `ESO${course[0]}`;
                    for (const [code, comp] of Object.entries(
                        dataset[ETAPA][course][codArea].competencias_especificas,
                    )) {
                        expect(code).toContain(`-${tag}-`);
                        expect(code.split('-')[3]).toBe(codArea);
                        for (const crit of comp.criterios_evaluacion) {
                            expect(crit.codigo).toContain(`-${tag}-`);
                        }
                    }
                }
            });
        });
    }

    it('every ESO àrea carries sabers bàsics in at least one course', () => {
        const ESO = dataset[ETAPA];
        const areas = new Set();
        for (const course of Object.values(ESO)) {
            for (const code of Object.keys(course)) areas.add(code);
        }
        for (const code of areas) {
            const total = COURSES.reduce((n, course) => {
                const a = ESO[course]?.[code];
                if (!a) return n;
                return n + Object.values(a.saberes_basicos.bloques).reduce((m, items) => m + items.length, 0);
            }, 0);
            expect(total, `${code} has no sabers bàsics in any ESO course`).toBeGreaterThan(0);
        }
    });

    it('exposes Valencià: Llengua i Literatura (VLL) in Primària and ESO', () => {
        for (const course of COURSES) {
            const a = dataset[ETAPA][course]?.VLL;
            expect(a, `VLL missing in ${course}`).toBeDefined();
            expect(a.denominacion).toBe('VALENCIÀ: LLENGUA I LITERATURA');
            expect(Object.keys(a.competencias_especificas).length).toBeGreaterThan(0);
        }
        for (const year of ["1r d'Educació Primària", "6é d'Educació Primària"]) {
            expect(dataset['Educació Primària'][year]?.VLL, `VLL missing in ${year}`).toBeDefined();
        }
    });

    // Course-pair subjects (taught in two specific courses, Decret 107/2022
    // art. 10.4) must NOT be over-expanded: their two columns are the real
    // courses, and the untaught years stay empty.
    it('does not over-expand course-pair subjects (Biologia 1r/3r, Música 1r/2n)', () => {
        const present = codArea =>
            COURSES.filter(c => dataset[ETAPA][c]?.[codArea]?.competencias_especificas
                && Object.keys(dataset[ETAPA][c][codArea].competencias_especificas).length > 0)
                .map(c => c.slice(0, 2));
        // Biologia i Geologia: 1r and 3r only (not 2n, not 4t common table)
        expect(present('BG')).toEqual(['1r', '3r']);
        // Música: 1r and 2n only
        expect(present('M2')).toEqual(['1r', '2n']);
    });
});

// The Comunitat Valenciana publishes the descriptors del perfil d'eixida in
// Valencian. The dataset carries its own `descriptors` catalog (code -> text)
// under a reserved top-level key; the iDevice uses it instead of the shared
// Castilian default. These guards keep that catalog complete and well-formed.
describe('LOMLOE ES-VC descriptors del perfil d\'eixida (Valencian catalog)', () => {
    const ETAPAS = [
        'Educació Infantil',
        'Educació Primària',
        'Educació Secundària Obligatòria',
        'Batxillerat',
    ];
    const CODE_RE = /^(CCL|CP|STEM|CMCT|CD|CPSAA|CC|CE|CCEC)(\d+(\.\d+)?)?$/;

    function usedCodes() {
        const used = new Set();
        for (const [etapa, niveles] of Object.entries(dataset)) {
            if (etapa === 'descriptors') continue;
            for (const areas of Object.values(niveles)) {
                for (const area of Object.values(areas)) {
                    for (const comp of Object.values(area.competencias_especificas)) {
                        for (const cr of comp.criterios_evaluacion) {
                            for (const cc of cr.competencias_clave || []) used.add(cc);
                        }
                    }
                }
            }
        }
        return used;
    }

    it('exposes a non-empty `descriptors` catalog with well-formed entries', () => {
        const cat = dataset.descriptors;
        expect(cat && typeof cat === 'object' && !Array.isArray(cat)).toBe(true);
        const keys = Object.keys(cat);
        expect(keys.length).toBeGreaterThan(0);
        for (const k of keys) {
            expect(k, `bad descriptor code ${k}`).toMatch(CODE_RE);
            expect(typeof cat[k]).toBe('string');
            expect(cat[k].trim().length).toBeGreaterThan(0);
        }
    });

    it('covers every competència-clau code used anywhere in the dataset', () => {
        const cat = dataset.descriptors || {};
        const missing = [...usedCodes()].filter(c => !(c in cat)).sort();
        expect(missing, `codes used but missing from catalog: ${missing.join(', ')}`).toEqual([]);
    });

    it('includes CMCT (the VC family code with no Castilian fallback)', () => {
        expect(dataset.descriptors && dataset.descriptors.CMCT).toBeTruthy();
    });

    it('uses Valencian wording (accented characters) in the family entries', () => {
        const fams = ['CCL', 'CP', 'STEM', 'CMCT', 'CD', 'CPSAA', 'CC', 'CE', 'CCEC'];
        const blob = fams.map(f => dataset.descriptors[f] || '').join(' ');
        expect(blob).toMatch(/[àèòïçéíóúü·]/);
    });

    it('`descriptors` is a reserved top-level key, not counted as an etapa', () => {
        const top = Object.keys(dataset);
        expect(top).toContain('descriptors');
        expect(top.filter(k => k !== 'descriptors').sort()).toEqual([...ETAPAS].sort());
    });
});
