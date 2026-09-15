/**
 * Unit tests for the SCORM/xAPI reporting glue.
 *
 * The runtime reports through the SAME public flow every other gradable
 * iDevice uses (`$exeDevices.iDevice.gamification.scorm`), so the stub here
 * enforces the REAL contract: the shared layer resolves the activity's
 * identity from `main` and throws without it. An earlier version of this
 * runtime passed a shape of its own; because the call is guarded, the score
 * then vanished without a word — no SCORM, no xAPI.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { normalizeV2 } from '../shared/schema';
import type { InteractiveVideoDocumentV2 } from '../shared/types';
import type { RuntimeInstance } from './instance';
import { makeTranslator } from './renderer';
import { createInteractiveVideoRuntime, type InteractiveVideoRuntime } from './runtime';
import { updateScore } from './scoring';
import { registerTracking, reportScore, trackingOptions } from './scorm';

const TEMPLATE = '<div class="exe-interactive-video-container">{content}</div>';

interface SentReport {
    auto: boolean;
    scorerp: unknown;
    gameOver: unknown;
    msgs: unknown;
}

interface Recorded {
    register: Record<string, unknown>[];
    send: SentReport[];
    track: string[];
}

interface ScormStub {
    registerActivity: (game: Record<string, unknown>) => void;
    sendScoreNew: (auto: boolean, game: Record<string, unknown>) => void;
}

interface TestGlobal {
    $exeDevices?: { iDevice?: { gamification?: { scorm?: Partial<ScormStub> } } };
}

const testGlobal = globalThis as unknown as TestGlobal;

/** Normalize a partial v2 payload into a full document, as the runtime does. */
function makeDoc(overrides: Record<string, unknown> = {}): InteractiveVideoDocumentV2 {
    return normalizeV2({
        schemaVersion: 2,
        video: { provider: 'local', url: 'resources/clip.mp4' },
        scorm: { enabled: true, weight: 100, repeatActivity: true, showResults: true },
        ...overrides,
    });
}

/** The minimal instance state the tracking payload is built from. */
function stubInstance(doc: InteractiveVideoDocumentV2, id = 'iv1'): RuntimeInstance {
    return {
        id: id,
        doc: doc,
        t: makeTranslator(doc.customTexts),
        answered: {},
        results: {},
    } as unknown as RuntimeInstance;
}

/**
 * Stand in for the shared gamification layer with its REAL contract: the
 * identity is resolved from `main`, exactly as common.js does.
 */
function installScormStub(): Recorded {
    const calls: Recorded = { register: [], send: [], track: [] };
    testGlobal.$exeDevices = {
        iDevice: {
            gamification: {
                scorm: {
                    registerActivity(game) {
                        if (typeof game.main !== 'string') {
                            throw new TypeError('game.main is required');
                        }
                        const mainElement = document.getElementById(game.main);
                        game.mainElement = mainElement;
                        game.ideviceId = mainElement ? mainElement.id : undefined;
                        calls.register.push(game);
                    },
                    sendScoreNew(auto, game) {
                        if (typeof game.main !== 'string') {
                            throw new TypeError('game.main is required');
                        }
                        calls.send.push({
                            auto: auto,
                            scorerp: game.scorerp,
                            gameOver: game.gameOver,
                            msgs: game.msgs,
                        });
                        if (game.gameStarted || game.gameOver) {
                            calls.track.push('answered');
                        }
                    },
                },
            },
        },
    };
    return calls;
}

describe('trackingOptions', () => {
    afterEach(() => {
        delete testGlobal.$exeDevices;
    });

    it('resolves this instance as the reporting identity', () => {
        // `main` is a bare element id the shared layer looks up as `#main`, so
        // several interactive videos on one page each report as themselves.
        const options = trackingOptions(stubInstance(makeDoc(), 'ivA'));
        expect(options.main).toBe('exe-iv-ivA');
        expect(options.id).toBe('ivA');
        expect(options.idevice).toBe('interactive-video');
    });

    it('carries the SCORM settings the author chose', () => {
        const options = trackingOptions(
            stubInstance(makeDoc({ scorm: { enabled: true, weight: 40, repeatActivity: false } })),
        );
        expect(options.weighted).toBe(40);
        expect(options.isScorm).toBe(1);
        expect(options.repeatActivity).toBe(false);
    });

    it('reports isScorm 0 and the default weight when SCORM is off', () => {
        const options = trackingOptions(stubInstance(makeDoc({ scorm: { enabled: false } })));
        expect(options.isScorm).toBe(0);
        expect(options.weighted).toBe(100);
    });

    it('carries the legacy evaluation flags through', () => {
        const options = trackingOptions(
            stubInstance(makeDoc({ meta: { legacy: { evaluation: true, evaluationID: 'eval-7' } } })),
        );
        expect(options.evaluation).toBe(true);
        expect(options.evaluationID).toBe('eval-7');
    });

    it("lets the author's Custom texts reach the shared layer", () => {
        const options = trackingOptions(stubInstance(makeDoc({ customTexts: { msgYouScore: 'Tu puntuación' } })));
        expect(options.msgs).toMatchObject({ msgYouScore: 'Tu puntuación' });
    });

    it('is built once and then reused', () => {
        const instance = stubInstance(makeDoc());
        const first = trackingOptions(instance);
        expect(trackingOptions(instance)).toBe(first);
    });
});

describe('registerTracking', () => {
    afterEach(() => {
        delete testGlobal.$exeDevices;
        document.body.innerHTML = '';
    });

    it('is a no-op when the page has no gamification layer', () => {
        expect(() => registerTracking(stubInstance(makeDoc()))).not.toThrow();
    });

    it('is a no-op when the layer offers no registerActivity', () => {
        testGlobal.$exeDevices = { iDevice: { gamification: { scorm: {} } } };
        expect(() => registerTracking(stubInstance(makeDoc()))).not.toThrow();
    });

    it('swallows a failure inside the shared layer', () => {
        testGlobal.$exeDevices = {
            iDevice: {
                gamification: {
                    scorm: {
                        registerActivity() {
                            throw new Error('LMS unavailable');
                        },
                    },
                },
            },
        };
        expect(() => registerTracking(stubInstance(makeDoc()))).not.toThrow();
    });
});

describe('reportScore', () => {
    afterEach(() => {
        delete testGlobal.$exeDevices;
    });

    it('reports nothing for a learner who has only pressed play', () => {
        const calls = installScormStub();
        const instance = stubInstance(makeDoc());
        instance.score = { raw: 0, max: 1, fraction: 0, scaled10: 0, percent: 0 };
        reportScore(instance);
        // A zero here would put a spurious statement in the LRS.
        expect(calls.send).toHaveLength(0);
    });

    it('reports once something has been answered, automatically', () => {
        const calls = installScormStub();
        const instance = stubInstance(makeDoc());
        instance.answered['iv-q'] = true;
        instance.score = { raw: 1, max: 1, fraction: 1, scaled10: 10, percent: 100 };
        reportScore(instance);
        expect(calls.send).toHaveLength(1);
        // auto=true because this iDevice has no manual "save score" button.
        expect(calls.send[0]?.auto).toBe(true);
        expect(Number(calls.send[0]?.scorerp)).toBe(10);
        expect(calls.track).toContain('answered');
    });

    it('does not repeat an identical report', () => {
        const calls = installScormStub();
        const instance = stubInstance(makeDoc());
        instance.answered['iv-q'] = true;
        instance.score = { raw: 1, max: 1, fraction: 1, scaled10: 10, percent: 100 };
        reportScore(instance);
        reportScore(instance);
        reportScore(instance);
        expect(calls.send).toHaveLength(1);
    });

    it('reports again when the activity becomes complete', () => {
        const calls = installScormStub();
        const instance = stubInstance(makeDoc());
        instance.answered['iv-q'] = true;
        instance.score = { raw: 1, max: 1, fraction: 1, scaled10: 10, percent: 100 };
        reportScore(instance);
        instance.completed = true;
        reportScore(instance);
        expect(calls.send).toHaveLength(2);
        expect(calls.send[1]?.gameOver).toBe(true);
    });

    it('reports a completion even when nothing was answered', () => {
        const calls = installScormStub();
        const instance = stubInstance(makeDoc());
        instance.completed = true;
        instance.score = { raw: 0, max: 0, fraction: 0, scaled10: 0, percent: 0 };
        reportScore(instance);
        expect(calls.send).toHaveLength(1);
        expect(calls.send[0]?.gameOver).toBe(true);
    });

    it('is a no-op without a gamification layer or a sendScoreNew', () => {
        const instance = stubInstance(makeDoc());
        instance.answered['iv-q'] = true;
        expect(() => reportScore(instance)).not.toThrow();
        testGlobal.$exeDevices = { iDevice: { gamification: { scorm: {} } } };
        expect(() => reportScore(instance)).not.toThrow();
    });

    it('swallows a failure inside the shared layer', () => {
        testGlobal.$exeDevices = {
            iDevice: {
                gamification: {
                    scorm: {
                        sendScoreNew() {
                            throw new Error('LMS unavailable');
                        },
                    },
                },
            },
        };
        const instance = stubInstance(makeDoc());
        instance.answered['iv-q'] = true;
        expect(() => reportScore(instance)).not.toThrow();
    });
});

describe('reporting a live activity', () => {
    let iv: InteractiveVideoRuntime;
    let calls: Recorded;

    beforeEach(() => {
        iv = createInteractiveVideoRuntime();
        document.body.innerHTML = '';
        calls = installScormStub();
    });

    afterEach(() => {
        delete testGlobal.$exeDevices;
        document.body.innerHTML = '';
    });

    /** Mount a one-question activity and return its live instance. */
    function boot(overrides: Record<string, unknown> = {}): RuntimeInstance {
        const data = {
            schemaVersion: 2,
            video: { provider: 'local', url: 'resources/clip.mp4' },
            interactions: [
                {
                    id: 'iv-q',
                    type: 'question',
                    time: 5,
                    pause: true,
                    question: {
                        kind: 'singleChoice',
                        prompt: 'Capital?',
                        answers: [
                            ['Paris', 1],
                            ['Rome', 0],
                        ],
                    },
                },
            ],
            completion: { mode: 'none', requiredScore: null },
            scorm: { enabled: true, weight: 100, repeatActivity: true, showResults: true },
            ...overrides,
        };
        const html = iv.renderView(data, false, TEMPLATE, 'iv1');
        if (html === false) {
            throw new Error('renderView refused the document');
        }
        document.body.innerHTML = html;
        iv.renderBehaviour(data, false, 'iv1');
        const instance = iv.instances['iv1'];
        if (!instance) {
            throw new Error('renderBehaviour built no instance');
        }
        return instance;
    }

    /** Answer the question correctly, the way a learner does. */
    function answerCorrectly(): void {
        const video = document.querySelector<HTMLVideoElement>('video.exe-iv-video');
        if (!video) {
            throw new Error('the player did not mount');
        }
        video.currentTime = 6;
        video.dispatchEvent(new Event('timeupdate'));
        const overlay = document.querySelector<HTMLElement>('.exe-iv-overlay');
        const radio = overlay?.querySelector<HTMLInputElement>('input[type="radio"]');
        if (!overlay || !radio) {
            throw new Error('the question did not render');
        }
        radio.checked = true;
        overlay.querySelector<HTMLElement>('.exe-iv-check')?.click();
    }

    it('registers the activity with the shape the shared layer requires', () => {
        boot();
        expect(calls.register).toHaveLength(1);
        const game = calls.register[0];
        // Resolved to THIS instance's container, so several videos on a page
        // each report as themselves.
        expect(game?.main).toBe('exe-iv-iv1');
        expect(game?.ideviceId).toBe('exe-iv-iv1');
        expect(game?.weighted).toBe(100);
        expect(game?.isScorm).toBe(1);
        expect(game?.msgs).toMatchObject({ msgYouScore: 'Your score' });
    });

    it('reports the score through sendScoreNew, which is what emits xAPI', () => {
        const instance = boot();
        answerCorrectly();
        expect(instance.results['iv-q']).toBe(1);
        expect(calls.send.length).toBeGreaterThan(0);
        const last = calls.send[calls.send.length - 1];
        expect(last?.auto).toBe(true);
        expect(Number(last?.scorerp)).toBe(10);
        expect(calls.track).toContain('answered');
    });

    it('does not report the same score twice', () => {
        const instance = boot();
        answerCorrectly();
        const after = calls.send.length;
        expect(after).toBeGreaterThan(0);
        // Re-rendering the score changes nothing, so no second statement.
        updateScore(instance);
        updateScore(instance);
        expect(calls.send).toHaveLength(after);
    });

    it('reports nothing for a learner who has only pressed play', () => {
        const instance = boot();
        updateScore(instance);
        expect(calls.send).toHaveLength(0);
        expect(instance.score?.scaled10).toBe(0);
    });

    it('keeps the activity working when the tracking layer throws', () => {
        const scorm = testGlobal.$exeDevices?.iDevice?.gamification?.scorm;
        if (!scorm) {
            throw new Error('the stub was not installed');
        }
        scorm.registerActivity = () => {
            throw new Error('LMS unavailable');
        };
        scorm.sendScoreNew = () => {
            throw new Error('LMS unavailable');
        };
        const instance = boot();
        answerCorrectly();
        // The interaction still fired and was still graded.
        expect(instance.results['iv-q']).toBe(1);
    });

    it('works with no gamification layer at all (plain HTML export)', () => {
        delete testGlobal.$exeDevices;
        const instance = boot();
        expect(instance).toBeDefined();
        expect(() => updateScore(instance)).not.toThrow();
        expect(() => answerCorrectly()).not.toThrow();
        expect(instance.results['iv-q']).toBe(1);
    });
});
