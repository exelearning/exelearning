import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { Scorm2004API } from 'scorm-again/scorm2004';

// Load the actual exported scripts in a fresh page; the LMS validates every
// data-model call independently of eXeLearning's implementation.
const source = path => readFileSync(path, 'utf8');
const sessions = [];

function openSession({ enabled = true, stored = '', completion = 'unknown', success = 'unknown' } = {}) {
    const page = new Window({
        url: 'https://scorm.test/',
        settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true },
    });
    if (enabled) page.document.head.innerHTML = '<meta name="exe-pass-score-every-activity" content="true">';
    page.document.body.innerHTML = '<div id="eXeScoreNodeScore"></div>';
    const api = new Scorm2004API({ autocommit: false, lmsCommitUrl: false, logLevel: 5, strict_errors: true });
    api.loadFromFlattenedJSON({ 'cmi.suspend_data': stored, 'cmi.completion_status': completion, 'cmi.success_status': success });
    const calls = [];
    for (const name of ['SetValue', 'GetValue']) {
        const original = api[name].bind(api);
        api[name] = (...args) => {
            const result = original(...args);
            calls.push({ name, args, result, error: api.GetLastError() });
            return result;
        };
    }
    Object.defineProperty(page, 'parent', { value: { API_1484_11: api } });
    page.eval(source('public/app/common/scorm/SCORM_API_wrapper.js'));
    page.pipwerks.debug.isActive = false;
    page.eval(source('public/libs/jquery/jquery.min.js'));
    page.eval(source('public/app/common/common.js'));
    page.eval(source('public/app/common/scorm/SCOFunctions.js'));
    page.loadPage();
    const activities = page.$exeDevices.iDevice.gamification.scorm;
    const session = { page, api, activities, calls };
    sessions.push(session);
    expect(page.pipwerks.SCORM.version).toBe('2004');
    expect(page.pipwerks.SCORM.connection.isActive).toBe(true);
    return session;
}

/** Register one game per mark (out of 10), as the iDevices do on load. */
function register(session, marks) {
    return marks.map((mark, index) => {
        const node = session.page.document.createElement('article');
        node.className = 'idevice_node';
        node.id = `activity-${index + 1}`;
        node.innerHTML = `<div id="game-${index + 1}"></div>`;
        session.page.document.body.appendChild(node);
        const game = {
            main: `game-${index + 1}`,
            isScorm: 1,
            weighted: 100,
            passScoreMode: 'custom',
            passScoreCustom: mark,
            msgs: { msgYouScore: 'Score', msgScore: 'Score', msgWeight: 'Weight' },
        };
        session.activities.registerActivity(game);
        return game;
    });
}

/** Send a score out of 100, as sendScoreNew does. */
function report(session, game, score, completed = true) {
    game.scorerp = score / 10;
    const data = session.activities.parseSuspendData(session.api.cmi.suspend_data);
    session.activities.updateActivity(game, data, completed);
}

/** What the LMS holds, plus the exit the runtime wrote (write-only). */
function stored(session) {
    const exits = session.calls.filter(call => call.name === 'SetValue' && call.args[0] === 'cmi.exit');
    return {
        completion: session.api.cmi.completion_status,
        success: session.api.cmi.success_status,
        raw: session.api.cmi.score.raw,
        exit: exits.length ? exits[exits.length - 1].args[1] : undefined,
    };
}

afterEach(async () => {
    for (const { page, calls } of sessions.splice(0)) {
        await page.happyDOM.close();
        expect(calls.filter(call => call.name === 'SetValue' && call.result !== 'true')).toEqual([]);
        expect(calls.filter(call => call.args[0].startsWith('cmi.core.'))).toEqual([]);
    }
});

// The exported page leaves through unloadPage() with no argument, from its
// body attributes; that is the call these tests make.
describe('SCORM 2004 contract with the exported runtime', () => {
    it.each([
        [true, 70, 'failed'],
        [true, 80, 'passed'],
        [false, 70, 'passed'],
    ])('every activity=%s, first score=%s retains %s through exit', (enabled, score, verdict) => {
        const session = openSession({ enabled });
        const [first, second] = register(session, [8, 4]);
        report(session, first, score);
        report(session, second, 100);
        expect(session.api.cmi.score.raw).toBe(String((score + 100) / 2));
        expect(stored(session)).toMatchObject({ completion: 'completed', success: verdict });
        session.page.unloadPage();
        expect(stored(session)).toMatchObject({ completion: 'completed', success: verdict, exit: 'normal' });
    });

    it.each([false, true])('reports a page opened and left as incomplete, with no score (every activity=%s)', enabled => {
        const session = openSession({ enabled });
        register(session, [8, 4]);
        expect(stored(session)).toMatchObject({ completion: 'incomplete', success: 'unknown', raw: '' });
        session.page.unloadPage();
        expect(stored(session)).toEqual({ completion: 'incomplete', success: 'unknown', raw: '', exit: 'suspend' });
    });

    it.each([false, true])('keeps a half-answered page incomplete (every activity=%s)', enabled => {
        const session = openSession({ enabled });
        const [first] = register(session, [8, 4]);
        report(session, first, 70);
        session.page.unloadPage();
        expect(stored(session)).toEqual({ completion: 'incomplete', success: 'unknown', raw: '35', exit: 'suspend' });
    });

    it('does not complete activities that sent a score without finishing', () => {
        const session = openSession({ enabled: false });
        const [first, second] = register(session, [8, 4]);
        report(session, first, 100, false);
        report(session, second, 100, false);
        session.page.unloadPage();
        expect(stored(session)).toMatchObject({ completion: 'incomplete', success: 'unknown', exit: 'suspend' });
    });

    it.each([[0, 'passed'], [5, 'failed']])('restores a submitted zero against a mark of %s as %s', (mark, verdict) => {
        const first = openSession();
        const games = register(first, [mark, 5]);
        report(first, games[0], 0);
        report(first, games[1], 100);
        const saved = first.api.cmi.suspend_data;
        first.page.unloadPage();

        const resumed = openSession({ stored: saved, completion: 'completed', success: verdict });
        // Entry precedes iDevice registration: the page's default minimum must
        // not overwrite the saved verdict before custom minimums are known.
        expect(resumed.api.cmi.success_status).toBe(verdict);
        register(resumed, [mark, 5]);
        resumed.page.unloadPage();
        expect(stored(resumed)).toMatchObject({ completion: 'completed', success: verdict });
        expect(resumed.activities.parseSuspendData(saved)[1]).toMatchObject({ score: 0, state: 2 });
    });

    it('reads a payload from an older runtime: a positive score is finished, a 0 is pending', () => {
        const old = '1. "Old"; Score: 60%; Weight: 100%.\t2. "Old 2"; Score: 0%; Weight: 100%';
        const session = openSession({ enabled: false, stored: old });
        const [, second] = register(session, [5, 5]);
        expect(stored(session)).toMatchObject({ completion: 'incomplete', success: 'unknown' });
        report(session, second, 80);
        expect(stored(session)).toMatchObject({ completion: 'completed', success: 'passed', raw: '70' });
    });

    it('completes an informational page even when the option is enabled', () => {
        const session = openSession();
        session.page.unloadPage();
        expect(stored(session)).toMatchObject({ completion: 'completed', success: 'passed' });
    });
});
