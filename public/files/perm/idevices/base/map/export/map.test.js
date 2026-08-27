/**
 * Unit tests for the map iDevice (export/runtime).
 *
 * Regression coverage for issue #2272: createInterfaceMapa and
 * answerTPQuestion can run when options[instance] or the active map/point/
 * question data is gone (activity torn down, stale event handlers). They
 * must bail out instead of crashing (Sentry: reading 'msgs' / 'solution'
 * of undefined).
 *
 * The export declares `var $eXeMapa`; it is rewired to a global and the
 * auto-init call is stripped so importing has no side effects. Real jQuery
 * + happy-dom (from vitest.setup.js) back the DOM.
 */

/* eslint-disable no-undef */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExport() {
    const code = readFileSync(join(__dirname, 'map.js'), 'utf-8');
    let modified = code.replace(/var\s+\$eXeMapa\s*=/, 'global.$eXeMapa =');
    modified = modified.replace(/\$\(function\s*\(\)\s*\{\s*\$eXeMapa\.init\(\);\s*\}\);?/g, '');
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$eXeMapa;
}

describe('map iDevice export — runtime guards (#2272)', () => {
    let m;
    const instance = 0;

    beforeEach(() => {
        global.$eXeMapa = undefined;
        m = loadExport();
        m.options = [];
        document.body.innerHTML = '';
        global.$exeDevices.iDevice.gamification.media = {
            stopSound: vi.fn(),
            playSound: vi.fn(),
        };
    });

    afterEach(() => {
        delete global.$eXeMapa;
        delete global.$exeDevices.iDevice.gamification.media;
        vi.useRealTimers();
    });

    describe('createInterfaceMapa', () => {
        it('returns an empty interface without throwing when options[instance] is gone', () => {
            let html;
            expect(() => {
                html = m.createInterfaceMapa(instance);
            }).not.toThrow();
            expect(html).toBe('');
        });

        it('builds the interface when options are present (positive path)', () => {
            m.idevicePath = '/idevices/map/';
            m.options[instance] = {
                msgs: {
                    msgGoActivity: 'Go to activity',
                    msgClue: 'Clue',
                    msgPlayStart: 'Start',
                    msgCheck: 'Check',
                    msgAudio: 'Audio',
                    msgReturn: 'Return',
                    msgHome: 'Home',
                },
            };
            // Sub-builders assemble unrelated markup; keep the test focused.
            for (const fn of [
                'getToolBar',
                'getDetailSound',
                'getToolTip',
                'getDetailMedia',
                'getModalMessage',
                'getTPQuestions',
                'getDetailTest',
                'getTestGame',
            ]) {
                m[fn] = () => '';
            }
            global.$exeDevices.iDevice.gamification.scorm.addButtonScoreNew = vi.fn(() => '');
            const html = m.createInterfaceMapa(instance);
            expect(html).toContain(`mapaMainContainer-${instance}`);
            expect(html).toContain('Start');
        });
    });

    describe('answerTPQuestion', () => {
        it('returns early without throwing when options[instance] is gone', () => {
            expect(() => m.answerTPQuestion(instance)).not.toThrow();
        });

        it('returns early without throwing when the active point is gone', () => {
            m.options[instance] = {
                gameActived: true,
                activeMap: { pts: [], active: 0 },
            };
            expect(() => m.answerTPQuestion(instance)).not.toThrow();
        });

        it('returns early without throwing when the active question is gone', () => {
            m.options[instance] = {
                gameActived: true,
                activeMap: {
                    pts: [{ tests: [], activeTest: 0, respuesta: 'A' }],
                    active: 0,
                },
            };
            expect(() => m.answerTPQuestion(instance)).not.toThrow();
        });

        it('answers a target-point question normally when data is present (positive path)', () => {
            vi.useFakeTimers();
            const q = { solution: 'A', typeSelect: 0 };
            const p = { tests: [q], activeTest: 0, respuesta: 'a' };
            m.options[instance] = {
                gameActived: true,
                activeMap: { pts: [p], active: 0 },
                msgs: {},
            };
            m.updateTPScore = vi.fn(() => 'well done');
            m.drawTPSolution = vi.fn();
            m.showTPMessage = vi.fn();
            m.newTPQuestion = vi.fn();

            expect(() => m.answerTPQuestion(instance)).not.toThrow();

            expect(m.options[instance].gameActived).toBe(false);
            expect(m.updateTPScore).toHaveBeenCalledWith(true, instance);
            expect(m.drawTPSolution).toHaveBeenCalledWith(instance);
            expect(m.showTPMessage).toHaveBeenCalledWith(2, 'well done', instance);
            vi.runAllTimers();
            expect(m.newTPQuestion).toHaveBeenCalledWith(instance, true, false);
        });
    });
});
