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
