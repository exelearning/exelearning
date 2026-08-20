import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';

require('./common.js');

const gamification = global.$exeDevices.iDevice.gamification;
const scorm = gamification.scorm;

describe('gamification.track (xAPI dispatch)', () => {
    let originalXapi;

    beforeEach(() => {
        originalXapi = global.$exeDevices.iDevice.xapi;
    });

    afterEach(() => {
        global.$exeDevices.iDevice.xapi = originalXapi;
        vi.restoreAllMocks();
    });

    it('exposes track as a sibling of scorm (gamification.track), not nested in scorm', () => {
        // The emitter is SCORM-independent, so it lives at gamification.track.
        expect(typeof gamification.track).toBe('function');
        expect(gamification.scorm.track).toBeUndefined();
    });

    it('forwards a normalised event to xapi.emit', () => {
        const emit = vi.fn();
        global.$exeDevices.iDevice.xapi = { emit };

        gamification.track('answered', {
            ideviceId: 'idevice-1',
            ideviceType: 'trueorfalse',
            ideviceNumber: 2,
            title: 'Q',
            scorerp: '7.5',
            weighted: 25,
        });

        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit).toHaveBeenCalledWith({
            type: 'answered',
            ideviceId: 'idevice-1',
            ideviceType: 'trueorfalse',
            ideviceNumber: 2,
            title: 'Q',
            score: 7.5,
            weighted: 25,
        });
    });

    it('forwards game.idevice as ideviceType when ideviceType is absent (real caller shape)', () => {
        const emit = vi.fn();
        global.$exeDevices.iDevice.xapi = { emit };

        // Real callers populate game.idevice (the iDevice type/class name) and never
        // game.ideviceType. The emitted statement must still carry the iDevice type.
        gamification.track('answered', {
            ideviceId: 'idevice-7',
            idevice: 'trueorfalse',
            ideviceNumber: 2,
            title: 'Q',
            scorerp: '7.5',
            weighted: 3,
        });

        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit.mock.calls[0][0].ideviceType).toBe('trueorfalse');
    });

    it('prefers an explicit ideviceType over game.idevice when both are present', () => {
        const emit = vi.fn();
        global.$exeDevices.iDevice.xapi = { emit };

        gamification.track('answered', {
            ideviceId: 'idevice-8',
            ideviceType: 'explicit-type',
            idevice: 'fallback-type',
            scorerp: 1,
        });

        expect(emit.mock.calls[0][0].ideviceType).toBe('explicit-type');
    });

    it('resolves the iDevice id from the DOM node when not preset', () => {
        const emit = vi.fn();
        global.$exeDevices.iDevice.xapi = { emit };
        const game = {
            ideviceNumber: 1,
            scorerp: 5,
            mainElement: { closest: () => ({ attr: () => 'idevice-from-dom' }) },
        };

        gamification.track('answered', game);

        expect(emit.mock.calls[0][0].ideviceId).toBe('idevice-from-dom');
        expect(game.ideviceId).toBe('idevice-from-dom');
    });

    it('is a no-op (no throw) when the xapi emitter is absent', () => {
        global.$exeDevices.iDevice.xapi = undefined;
        expect(() => gamification.track('answered', { scorerp: 5, ideviceId: 'x' })).not.toThrow();
    });

    it('is a no-op (no throw) for an invalid game', () => {
        global.$exeDevices.iDevice.xapi = { emit: vi.fn() };
        expect(() => gamification.track('answered', null)).not.toThrow();
        expect(global.$exeDevices.iDevice.xapi.emit).not.toHaveBeenCalled();
    });

    it('sendScoreNew dispatches "answered" in non-SCORM mode (no pipwerks)', () => {
        const emit = vi.fn();
        global.$exeDevices.iDevice.xapi = { emit };
        // No pipwerks defined → SCORM path is skipped, but xAPI must still fire.
        scorm.sendScoreNew(true, { gameOver: true, ideviceId: 'idevice-9', ideviceNumber: 1, scorerp: 9, title: 'T' });
        expect(emit).toHaveBeenCalledTimes(1);
        expect(emit.mock.calls[0][0].ideviceId).toBe('idevice-9');
    });

    it('sendScoreNew does not dispatch when the activity has not started', () => {
        const emit = vi.fn();
        global.$exeDevices.iDevice.xapi = { emit };
        scorm.sendScoreNew(true, {
            gameStarted: false,
            gameOver: false,
            ideviceId: 'x',
            scorerp: 0,
            weighted: 75,
        });
        expect(emit).not.toHaveBeenCalled();
    });

    it('registerActivity resolves the iDevice identity from the DOM in non-SCORM mode', () => {
        // Real jQuery + happy-dom are provided by the vitest setup.
        document.body.innerHTML = `
            <article>
                <header><span class="box-title">Question 1</span></header>
                <div class="idevice_node" id="idevice-xyz">
                    <div id="gmain"></div>
                </div>
            </article>`;
        const game = { main: 'gmain', weighted: 2, msgs: { msgYouScore: 'Score' } };

        scorm.registerActivity(game);

        // No pipwerks → SCORM suspend_data is skipped, but identity is set for xAPI.
        expect(game.ideviceId).toBe('idevice-xyz');
        expect(game.title).toBe('Question 1');
        expect(game.ideviceNumber).toBe(1);
    });

    it('registerActivity declares the iDevice to the emitter outside SCORM too', () => {
        // Outside pipwerks there is no SCORM-side registration (it lives in
        // cmi.suspend_data), so this forward is the ONLY way the emitter learns
        // about an iDevice nobody answers — the score-0 seeding depends on it.
        const registerEvaluable = vi.fn();
        global.$exeDevices.iDevice.xapi = { registerEvaluable };
        document.body.innerHTML = `
            <article>
                <header><span class="box-title">Question 1</span></header>
                <div class="idevice_node" id="idevice-xyz"><div id="gmain"></div></div>
            </article>`;

        scorm.registerActivity({ main: 'gmain', weighted: 25, msgs: { msgYouScore: 'Score' } });

        expect(registerEvaluable).toHaveBeenCalledTimes(1);
        expect(registerEvaluable.mock.calls[0][0]).toEqual({
            ideviceId: 'idevice-xyz',
            ideviceNumber: 1,
            title: 'Question 1',
            weighted: 25,
        });
    });

    it('registerActivity survives a package with no emitter at all', () => {
        // The print preview loads no emitter, so the forwarder must no-op
        // rather than throw and take the activity down with it.
        global.$exeDevices.iDevice.xapi = undefined;
        document.body.innerHTML = `
            <article>
                <div class="idevice_node" id="idevice-xyz"><div id="gmain"></div></div>
            </article>`;

        expect(() =>
            scorm.registerActivity({ main: 'gmain', weighted: 25, msgs: { msgYouScore: 'Score' } })
        ).not.toThrow();
    });

    it('gamification.registerEvaluable ignores a non-object and a thrown emitter', () => {
        const registerEvaluable = vi.fn(() => {
            throw new Error('boom');
        });
        global.$exeDevices.iDevice.xapi = { registerEvaluable };

        // Tracking must never break the activity, whatever the emitter does.
        expect(() => gamification.registerEvaluable(null)).not.toThrow();
        expect(() => gamification.registerEvaluable('nope')).not.toThrow();
        expect(registerEvaluable).not.toHaveBeenCalled();
        expect(() => gamification.registerEvaluable({ ideviceId: 'a' })).not.toThrow();
        expect(registerEvaluable).toHaveBeenCalledTimes(1);
    });
});
