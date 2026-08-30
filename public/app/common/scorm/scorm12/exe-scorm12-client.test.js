import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The vendored upstream wrapper (UMD: exports the pipwerks namespace in CJS).
const pipwerks = require('./vendor/pipwerks/SCORM_API_wrapper.js');
const client = require('./exe-scorm12-client.js');
const { createFakeScorm12Api, createFakeWindowTree, resetPipwerks } = require('./fake-scorm12-api.test-util.js');

describe('exe-scorm12-client', () => {
    let api;
    let errorSpy;
    let warnSpy;
    let fakeNow;

    /** Stub the global window with a fake tree exposing the API. */
    function useWindow(position, extras) {
        const tree = createFakeWindowTree(position, api, extras);
        vi.stubGlobal('window', tree);
        return tree;
    }

    beforeEach(() => {
        api = createFakeScorm12Api();
        errorSpy = vi.fn();
        warnSpy = vi.fn();
        fakeNow = 1000;
        resetPipwerks(pipwerks);
        client.resetDependencies();
        client.configure({
            getPipwerks: () => pipwerks,
            now: () => fakeNow,
            error: errorSpy,
            warn: warnSpy,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        client.resetDependencies();
    });

    describe('API discovery', () => {
        it('finds the API on the same window', () => {
            useWindow('self');

            expect(client.initialize()).toBe(true);
            expect(api.callNames()).toEqual(['LMSInitialize']);
        });

        it('finds the API on the parent window', () => {
            useWindow('parent');

            expect(client.initialize()).toBe(true);
            expect(api.callNames()).toContain('LMSInitialize');
        });

        it('finds the API on the grandparent window', () => {
            useWindow('grandparent');

            expect(client.initialize()).toBe(true);
            expect(api.callNames()).toContain('LMSInitialize');
        });

        it('finds the API on the opener window', () => {
            useWindow('opener');

            expect(client.initialize()).toBe(true);
            expect(api.callNames()).toContain('LMSInitialize');
        });

        it('fails gracefully when no API exists', () => {
            useWindow('none');

            expect(client.initialize()).toBe(false);
            expect(client.isActive()).toBe(false);
            expect(errorSpy).toHaveBeenCalled();
            expect(api.calls).toEqual([]);
        });

        it('fails gracefully when a cross-origin ancestor throws on access', () => {
            useWindow('hostile-ancestor');

            expect(() => client.initialize()).not.toThrow();
            expect(client.initialize()).toBe(false);
            expect(errorSpy).toHaveBeenCalled();
        });
    });

    describe('version pinning', () => {
        it('uses the SCORM 1.2 API when both API and API_1484_11 exist', () => {
            const scorm2004Api = createFakeScorm12Api();
            useWindow('self', { API_1484_11: scorm2004Api });

            expect(client.initialize()).toBe(true);
            expect(pipwerks.SCORM.version).toBe('1.2');
            expect(api.callNames()).toContain('LMSInitialize');
            expect(scorm2004Api.calls).toEqual([]);
        });

        it('disables the wrapper automatic status and exit handling', () => {
            useWindow('self');
            client.initialize();

            expect(pipwerks.SCORM.handleCompletionStatus).toBe(false);
            expect(pipwerks.SCORM.handleExitMode).toBe(false);
        });
    });

    describe('lifecycle', () => {
        it('initializes successfully', () => {
            useWindow('self');

            expect(client.initialize()).toBe(true);
            expect(client.isActive()).toBe(true);
            expect(api.initialized).toBe(true);
        });

        it('reports an initialize failure', () => {
            api = createFakeScorm12Api({ failures: { LMSInitialize: { result: 'false', errorCode: 101 } } });
            useWindow('self');

            expect(client.initialize()).toBe(false);
            expect(client.isActive()).toBe(false);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('LMSInitialize'));
        });

        it('adopts a connection the host already initialized (contract §4)', () => {
            useWindow('self');
            // The mod_exelearning injector force-calls pipwerks.SCORM.init() on a
            // 50 ms poller and usually wins the race against the content's own
            // scorm.init(). Reproduce that host-side activation with the REAL
            // vendored wrapper: the connection becomes active outside this state
            // machine.
            pipwerks.SCORM.version = '1.2';
            expect(pipwerks.SCORM.init()).toBe(true);
            const initcalls = api.callNames().filter(name => name === 'LMSInitialize').length;
            expect(initcalls).toBe(1);

            // The client adopts the active connection instead of failing: upstream
            // pipwerks answers FALSE to a second connection.initialize() on an
            // already-active connection, which would kill the iDevices'
            // `scorm.init()` gate and silently break manual score saves.
            expect(client.initialize()).toBe(true);
            expect(client.isActive()).toBe(true);
            // Adoption never issues a second LMSInitialize to the LMS.
            expect(api.callNames().filter(name => name === 'LMSInitialize').length).toBe(initcalls);
            // And the adopted session is a full citizen: terminate works normally.
            expect(client.terminate()).toBe(true);
        });

        it('treats a duplicate initialize as a no-op success', () => {
            useWindow('self');
            client.initialize();
            const callCount = api.calls.length;

            expect(client.initialize()).toBe(true);
            expect(api.calls.length).toBe(callCount);
        });

        it('commits successfully', () => {
            useWindow('self');
            client.initialize();

            expect(client.commit()).toBe(true);
            expect(api.callNames()).toContain('LMSCommit');
        });

        it('reports a commit failure', () => {
            api = createFakeScorm12Api({ failures: { LMSCommit: { result: 'false', errorCode: 101 } } });
            useWindow('self');
            client.initialize();

            expect(client.commit()).toBe(false);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('LMSCommit'));
        });

        it('terminates successfully (commit before finish)', () => {
            useWindow('self');
            client.initialize();

            expect(client.terminate()).toBe(true);
            const names = api.callNames();
            expect(names.indexOf('LMSCommit')).toBeGreaterThan(-1);
            expect(names.indexOf('LMSFinish')).toBeGreaterThan(names.indexOf('LMSCommit'));
        });

        it('reports a finish failure and still closes the session', () => {
            api = createFakeScorm12Api({ failures: { LMSFinish: { result: 'false', errorCode: 101 } } });
            useWindow('self');
            client.initialize();

            expect(client.terminate()).toBe(false);
            expect(client.isTerminated()).toBe(true);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('LMSFinish'));
        });

        it('treats a duplicate terminate as a no-op', () => {
            useWindow('self');
            client.initialize();
            client.terminate();
            const callCount = api.calls.length;

            expect(client.terminate()).toBe(true);
            expect(api.calls.length).toBe(callCount);
            expect(api.callNames().filter(name => name === 'LMSFinish')).toHaveLength(1);
        });

        it('rejects set/get after terminate without forwarding to the LMS', () => {
            useWindow('self');
            client.initialize();
            client.terminate();
            const callCount = api.calls.length;

            expect(client.setValue('cmi.core.score.raw', '50')).toBe(false);
            expect(client.getValue('cmi.core.lesson_status')).toBe('');
            expect(client.commit()).toBe(false);
            expect(api.calls.length).toBe(callCount);
            expect(warnSpy).toHaveBeenCalled();
        });

        it('rejects initialize after terminate', () => {
            useWindow('self');
            client.initialize();
            client.terminate();

            expect(client.initialize()).toBe(false);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('terminated'));
        });

        it('rejects set/get before initialize', () => {
            useWindow('self');

            expect(client.setValue('cmi.core.score.raw', '50')).toBe(false);
            expect(client.getValue('cmi.core.lesson_status')).toBe('');
            expect(api.calls).toEqual([]);
        });
    });

    describe('data transfer', () => {
        it('writes values as strings', () => {
            useWindow('self');
            client.initialize();

            expect(client.setValue('cmi.core.score.raw', 85)).toBe(true);
            expect(api.data['cmi.core.score.raw']).toBe('85');
            expect(api.callsFor('LMSSetValue')).toContainEqual(['cmi.core.score.raw', '85']);
        });

        it('reads stored values', () => {
            api = createFakeScorm12Api({ data: { 'cmi.core.lesson_status': 'incomplete' } });
            useWindow('self');
            client.initialize();

            expect(client.getValue('cmi.core.lesson_status')).toBe('incomplete');
        });

        it('reports a set failure with the LMS error code and message', () => {
            api = createFakeScorm12Api();
            useWindow('self');
            client.initialize();

            // Out of the CMIDecimal 0-100 range the LMS answers 405.
            expect(client.setValue('cmi.core.score.raw', '400')).toBe(false);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('405'));
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Incorrect Data Type'));
        });
    });

    describe('SCORM 1.2 element access rules', () => {
        it.each([
            'cmi.core.exit',
            'cmi.core.session_time',
            'cmi.interactions.0.id',
            'cmi.interactions.0.student_response',
        ])('never issues LMSGetValue for the write-only element %s', element => {
            useWindow('self');
            client.initialize();
            api.resetCalls();

            expect(client.getValue(element)).toBe('');
            expect(api.calls).toEqual([]);
        });

        it('answers a write-only getter from the local write cache', () => {
            useWindow('self');
            client.initialize();

            expect(client.setValue('cmi.core.exit', 'suspend')).toBe(true);

            expect(client.getValue('cmi.core.exit')).toBe('suspend');
            expect(client.getCachedValue('cmi.core.exit')).toBe('suspend');
            expect(api.callsFor('LMSGetValue')).toEqual([]);
        });

        it('still reads the readable interaction keywords from the LMS', () => {
            useWindow('self');
            client.initialize();
            client.setValue('cmi.interactions.0.id', 'q1');
            api.resetCalls();

            expect(client.getValue('cmi.interactions._count')).toBe('1');
            expect(api.callsFor('LMSGetValue')).toEqual([['cmi.interactions._count']]);
        });

        it.each([
            ['cmi.core.student_id', 403],
            ['cmi.core.student_name', 403],
            ['cmi.core.credit', 403],
            ['cmi.core.entry', 403],
            ['cmi.core.total_time', 403],
            ['cmi.core.lesson_mode', 403],
            ['cmi.launch_data', 403],
            ['cmi.comments_from_lms', 403],
            ['cmi.student_data.mastery_score', 403],
            ['cmi._version', 402],
            ['cmi.objectives._count', 402],
            ['cmi.core._children', 402],
        ])('refuses to write %s locally with error %d', (element, errorCode) => {
            useWindow('self');
            client.initialize();
            api.resetCalls();

            const result = client.setValueDetailed(element, 'whatever');

            expect(result).toMatchObject({ success: false, errorCode, forwarded: false });
            expect(api.calls).toEqual([]);
            expect(warnSpy).toHaveBeenCalled();
        });

        it('classifies elements through the exported predicates', () => {
            expect(client.isWriteOnlyElement('cmi.core.exit')).toBe(true);
            expect(client.isWriteOnlyElement('cmi.interactions._count')).toBe(false);
            expect(client.isReadOnlyElement('cmi.core.credit')).toBe(true);
            expect(client.isReadOnlyElement('cmi.core.lesson_status')).toBe(false);
        });

        it('setValueDetailed reports a forwarded LMS rejection', () => {
            useWindow('self');
            client.initialize();

            expect(client.setValueDetailed('cmi.core.lesson_status', 'not attempted')).toMatchObject({
                success: false,
                errorCode: 405,
                forwarded: true,
            });
        });

        it('setValueDetailed reports a rejection before initialize', () => {
            useWindow('self');

            expect(client.setValueDetailed('cmi.core.score.raw', '10')).toMatchObject({
                success: false,
                errorCode: 301,
                forwarded: false,
            });
        });

        it('setValueDetailed survives a throwing LMSSetValue', () => {
            useWindow('self');
            client.initialize();
            api.LMSSetValue = () => {
                throw new Error('LMS crashed');
            };

            expect(client.setValueDetailed('cmi.core.score.raw', '10')).toMatchObject({
                success: false,
                errorCode: 101,
                forwarded: true,
            });
        });
    });

    describe('optional element probing', () => {
        it('reports a supported optional element', () => {
            api = createFakeScorm12Api({ data: { 'cmi.student_data.mastery_score': '70' } });
            useWindow('self');
            client.initialize();

            expect(client.getOptionalValue('cmi.student_data.mastery_score')).toEqual({
                value: '70',
                supported: true,
                errorCode: 0,
            });
        });

        it('reports an unimplemented optional element without logging an error', () => {
            api = createFakeScorm12Api({ profile: 'minimal' });
            useWindow('self');
            client.initialize();

            expect(client.getOptionalValue('cmi.student_data.mastery_score')).toEqual({
                value: '',
                supported: false,
                errorCode: 401,
            });
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('still reports a real failure', () => {
            api = createFakeScorm12Api({ failures: { LMSGetValue: { errorCode: 101 } } });
            useWindow('self');
            client.initialize();

            expect(client.getOptionalValue('cmi.core.score.max').supported).toBe(false);
            expect(errorSpy).toHaveBeenCalled();
        });

        it('rejects the probe without an active session', () => {
            useWindow('self');

            expect(client.getOptionalValue('cmi.core.score.max')).toEqual({
                value: '',
                supported: false,
                errorCode: 301,
            });
        });

        it('survives a throwing LMSGetValue', () => {
            useWindow('self');
            client.initialize();
            api.LMSGetValue = () => {
                throw new Error('LMS crashed');
            };

            expect(client.getOptionalValue('cmi.core.score.max')).toEqual({
                value: '',
                supported: false,
                errorCode: 101,
            });
        });

        it('normalizes a stringified null probe result', () => {
            useWindow('self');
            client.initialize();
            api.LMSGetValue = () => 'null';

            expect(client.getOptionalValue('cmi.core.score.max').value).toBe('');
        });
    });

    describe('optional element writes', () => {
        it('writes a supported optional element', () => {
            useWindow('self');
            client.initialize();

            expect(client.setOptionalValueDetailed('cmi.core.score.min', '0')).toMatchObject({
                success: true,
                errorCode: 0,
            });
            expect(api.data['cmi.core.score.min']).toBe('0');
        });

        it('reports an unimplemented optional element without logging an error', () => {
            api = createFakeScorm12Api({ profile: 'minimal' });
            useWindow('self');
            client.initialize();

            expect(client.setOptionalValueDetailed('cmi.core.score.min', '0')).toMatchObject({
                success: false,
                errorCode: 401,
            });
            expect(errorSpy).not.toHaveBeenCalled();
        });

        it('still reports a real failure', () => {
            api = createFakeScorm12Api({ elementFailures: { 'cmi.core.score.min': { errorCode: 101 } } });
            useWindow('self');
            client.initialize();

            expect(client.setOptionalValueDetailed('cmi.core.score.min', '0')).toMatchObject({
                success: false,
                errorCode: 101,
            });
            expect(errorSpy).toHaveBeenCalled();
        });

        it('setValueDetailed keeps reporting a 401 — only the optional entry point is quiet', () => {
            api = createFakeScorm12Api({ profile: 'minimal' });
            useWindow('self');
            client.initialize();

            expect(client.setValueDetailed('cmi.core.score.min', '0').errorCode).toBe(401);
            expect(errorSpy).toHaveBeenCalled();
        });
    });

    describe('termination state machine', () => {
        /**
         * A pipwerks stand-in whose commit (data.save) and finish (the API
         * handle's LMSFinish) outcomes are fully controlled, so the state
         * matrix can be exercised step by step. The wrapper's own
         * connection.terminate throws: the client must never use it.
         */
        function useStubbedWrapper(behaviour = {}) {
            const handle = { LMSFinish: behaviour.finish || (() => 'true') };
            const stub = {
                SCORM: {
                    version: null,
                    handleCompletionStatus: true,
                    handleExitMode: true,
                    API: { getHandle: () => (behaviour.noApi ? null : handle) },
                    connection: {
                        isActive: false,
                        initialize: () => ((stub.SCORM.connection.isActive = true), true),
                        terminate: () => {
                            throw new Error('the wrapper terminate must not be used by the client layer');
                        },
                    },
                    data: { get: () => '', set: () => true, save: behaviour.save || (() => true) },
                    debug: { getCode: () => 0, getInfo: () => 'No error' },
                },
            };
            client.configure({ getPipwerks: () => stub, now: () => fakeNow, error: errorSpy, warn: warnSpy });
            return stub;
        }

        it('walks idle → active → finished on success', () => {
            useWindow('self');
            expect(client.getState()).toBe('idle');

            client.initialize();
            expect(client.getState()).toBe('active');

            expect(client.terminate()).toBe(true);
            expect(client.getState()).toBe('finished');
            expect(client.getFinishReport()).toMatchObject({ attempted: true, result: true, source: 'runtime' });
        });

        it('records a rejected finish as finish_failed and keeps the diagnosis', () => {
            api = createFakeScorm12Api({ failures: { LMSFinish: { result: 'false', errorCode: 101 } } });
            useWindow('self');
            client.initialize();

            expect(client.terminate()).toBe(false);
            expect(client.getState()).toBe('finish_failed');
            expect(client.getFinishReport().error).toMatchObject({ code: 101 });
        });

        it('a failed finish never becomes a success on the second call', () => {
            useStubbedWrapper({ finish: () => 'false' });
            client.initialize();

            expect(client.terminate()).toBe(false);
            expect(client.terminate()).toBe(false);
            expect(client.terminate()).toBe(false);
            expect(client.getState()).toBe('finish_failed');
        });

        it('a failed commit still closes the wrapper connection', () => {
            const stub = useStubbedWrapper({ save: () => false });
            client.initialize();
            expect(stub.SCORM.connection.isActive).toBe(true);

            expect(client.terminate()).toBe(false);

            // No-retry policy: the state machine refuses further SCO calls,
            // and the wrapper's connection flag mirrors that so a direct
            // pipwerks consumer cannot keep writing into a session whose
            // stored state is unknown.
            expect(stub.SCORM.connection.isActive).toBe(false);
        });

        it('a failed finish still closes the wrapper connection', () => {
            const stub = useStubbedWrapper({ finish: () => 'false' });
            client.initialize();

            expect(client.terminate()).toBe(false);

            expect(stub.SCORM.connection.isActive).toBe(false);
        });

        it('a successful termination closes the wrapper connection', () => {
            const stub = useStubbedWrapper({});
            client.initialize();

            expect(client.terminate()).toBe(true);

            expect(stub.SCORM.connection.isActive).toBe(false);
        });

        it('a thrown finish is recorded as failed with its message', () => {
            useStubbedWrapper({
                finish: () => {
                    throw new Error('adapter vanished');
                },
            });
            client.initialize();

            expect(client.terminate()).toBe(false);
            expect(client.getState()).toBe('finish_failed');
            expect(client.getFinishReport().error.message).toContain('adapter vanished');
        });

        it('duplicate finish after success replays the recorded result', () => {
            let calls = 0;
            useStubbedWrapper({
                finish: () => {
                    calls += 1;
                    return 'true';
                },
            });
            client.initialize();

            expect(client.terminate()).toBe(true);
            expect(client.terminate()).toBe(true);
            expect(calls).toBe(1);
        });

        it('a re-entrant terminate cannot start a second LMSFinish', () => {
            let calls = 0;
            useStubbedWrapper({
                finish: () => {
                    calls += 1;
                    // The LMS calls back into the runtime during LMSFinish.
                    expect(client.terminate()).toBe(false);
                    return 'true';
                },
            });
            client.initialize();

            expect(client.terminate()).toBe(true);
            expect(calls).toBe(1);
        });

        it('distinguishes a failed commit from a failed finish', () => {
            let finishCalls = 0;
            useStubbedWrapper({
                save: () => false,
                finish: () => {
                    finishCalls += 1;
                    return 'true';
                },
            });
            client.initialize();

            expect(client.terminate()).toBe(false);

            // The LMS could not persist the data, so LMSFinish was never
            // attempted — and the report says exactly that.
            expect(finishCalls).toBe(0);
            expect(client.getFinishReport()).toMatchObject({
                commitAttempted: true,
                commitSucceeded: false,
                finishAttempted: false,
                finishSucceeded: false,
            });
            expect(client.getState()).toBe('finish_failed');
        });

        it('records both steps as succeeded on a clean termination', () => {
            useWindow('self');
            client.initialize();

            expect(client.terminate()).toBe(true);
            expect(client.getFinishReport()).toMatchObject({
                commitAttempted: true,
                commitSucceeded: true,
                finishAttempted: true,
                finishSucceeded: true,
            });
        });

        it('records a thrown commit as a failed termination without attempting the finish', () => {
            useStubbedWrapper({
                save: () => {
                    throw new Error('backend gone');
                },
            });
            client.initialize();

            expect(client.terminate()).toBe(false);
            expect(client.getFinishReport()).toMatchObject({
                commitAttempted: true,
                commitSucceeded: false,
                finishAttempted: false,
            });
            expect(client.getFinishReport().error.message).toContain('backend gone');
        });

        it('fails the termination when the API handle disappeared', () => {
            useStubbedWrapper({ noApi: true });
            client.initialize();

            expect(client.terminate()).toBe(false);
            expect(client.getState()).toBe('finish_failed');
            expect(client.getFinishReport().error.message).toContain('not available');
        });

        it.each(['getValue', 'setValue', 'commit'])('makes no LMS call through %s after a finish attempt', method => {
            api = createFakeScorm12Api({ failures: { LMSFinish: { result: 'false', errorCode: 101 } } });
            useWindow('self');
            client.initialize();
            client.terminate();
            api.resetCalls();

            client[method]('cmi.core.lesson_status', 'completed');

            expect(api.calls).toEqual([]);
        });

        it('never depends on connection.terminate, even when the adapter shims it', () => {
            // The stub's connection.terminate throws; the client must commit
            // and finish through the API handle directly, so a shimmed (or
            // doubly-shimmed) binding can never recurse into the lifecycle.
            useStubbedWrapper({});
            client.initialize();

            expect(client.terminate()).toBe(true);
            expect(client.getState()).toBe('finished');
        });

        it('notices a connection closed outside the state machine', () => {
            useWindow('self');
            client.initialize();

            pipwerks.SCORM.connection.isActive = false;

            expect(client.isActive()).toBe(false);
            expect(client.getState()).toBe('finished');
            expect(client.getFinishReport().source).toBe('external');
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('closed outside the runtime'));
        });

        it('reports an external closure only once', () => {
            useWindow('self');
            client.initialize();
            pipwerks.SCORM.connection.isActive = false;

            client.isActive();
            client.isActive();

            expect(warnSpy.mock.calls.filter(call => String(call[0]).includes('closed outside')).length).toBe(1);
        });

        it('terminate after an external closure makes no LMS call', () => {
            useWindow('self');
            client.initialize();
            pipwerks.SCORM.connection.isActive = false;
            api.resetCalls();

            expect(client.terminate()).toBe(true);
            expect(api.calls).toEqual([]);
        });
    });

    describe('session clock', () => {
        it('pauses and resumes without double counting', () => {
            useWindow('self');
            client.initialize();

            fakeNow = 4000;
            client.pauseClock();
            expect(client.isClockRunning()).toBe(false);
            expect(client.getElapsedMs()).toBe(3000);

            // Nothing accrues while paused, however long the pause lasts.
            fakeNow = 100000;
            expect(client.getElapsedMs()).toBe(3000);

            client.resumeClock();
            fakeNow = 102000;
            expect(client.getElapsedMs()).toBe(5000);
        });

        it('pausing twice banks the running segment once', () => {
            useWindow('self');
            client.initialize();

            fakeNow = 4000;
            client.pauseClock();
            fakeNow = 9000;
            client.pauseClock();

            expect(client.getElapsedMs()).toBe(3000);
        });

        it('resuming a running clock does not restart the segment', () => {
            useWindow('self');
            client.initialize();

            fakeNow = 4000;
            client.resumeClock();

            expect(client.getElapsedMs()).toBe(3000);
        });

        it('markSessionStart drops the banked time', () => {
            useWindow('self');
            client.initialize();

            fakeNow = 4000;
            client.pauseClock();
            client.markSessionStart();
            fakeNow = 5000;

            expect(client.getElapsedMs()).toBe(1000);
        });

        it('writing the session time repeatedly reports the total, not a delta', () => {
            useWindow('self');
            client.initialize();

            fakeNow = 3000;
            client.writeSessionTime();
            fakeNow = 8000;
            client.writeSessionTime();

            expect(api.callsFor('LMSSetValue').map(args => args[1])).toEqual(['0000:00:02.00', '0000:00:07.00']);
        });
    });

    describe('failure hardening', () => {
        it('rejects initialize when the wrapper is not loaded', () => {
            client.configure({ getPipwerks: () => null, warn: warnSpy, error: errorSpy });

            expect(client.initialize()).toBe(false);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('wrapper is not loaded'));
        });

        it('rejects terminate before initialize', () => {
            useWindow('self');

            expect(client.terminate()).toBe(false);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('never initialized'));
            expect(api.calls).toEqual([]);
        });

        it('exposes isInitialized()', () => {
            useWindow('self');
            expect(client.isInitialized()).toBe(false);
            client.initialize();
            expect(client.isInitialized()).toBe(true);
        });

        it('reports an LMSGetValue error state and returns an empty string', () => {
            api = createFakeScorm12Api({ failures: { LMSGetValue: { errorCode: 301 } } });
            useWindow('self');
            client.initialize();
            api.errorCode = '0';

            expect(client.getValue('cmi.core.lesson_status')).toBe('');
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('LMSGetValue'));
        });

        it('normalizes a stringified null value to an empty string', () => {
            useWindow('self');
            client.initialize();
            api.LMSGetValue = () => 'null';

            expect(client.getValue('cmi.core.lesson_status')).toBe('');
        });

        it('survives a throwing LMSGetValue', () => {
            useWindow('self');
            client.initialize();
            api.LMSGetValue = () => {
                throw new Error('LMS crashed');
            };

            expect(client.getValue('cmi.core.lesson_status')).toBe('');
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('LMS crashed'));
        });

        it('survives a throwing LMSSetValue', () => {
            useWindow('self');
            client.initialize();
            api.LMSSetValue = () => {
                throw new Error('LMS crashed');
            };

            expect(client.setValue('cmi.core.score.raw', '10')).toBe(false);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('LMS crashed'));
        });

        it('survives a throwing LMSCommit', () => {
            useWindow('self');
            client.initialize();
            api.LMSCommit = () => {
                throw new Error('LMS crashed');
            };

            expect(client.commit()).toBe(false);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('LMSCommit'));
        });

        it('survives a throwing LMSFinish and still closes the session', () => {
            useWindow('self');
            client.initialize();
            api.LMSFinish = () => {
                throw new Error('LMS crashed');
            };

            expect(client.terminate()).toBe(false);
            expect(client.isTerminated()).toBe(true);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('LMSFinish'));
        });

        it('getLastError degrades when the wrapper itself throws', () => {
            client.configure({
                getPipwerks: () => ({
                    SCORM: {
                        API: {
                            getHandle() {
                                throw new Error('inaccessible');
                            },
                        },
                    },
                }),
            });

            const lastError = client.getLastError();
            expect(lastError.code).toBe(-1);
            expect(lastError.message).toContain('inaccessible');
        });

        it('falls back to the default console/clock dependencies', () => {
            client.resetDependencies();
            const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // No active session: rejected via the default warn channel.
            expect(client.getValue('cmi.core.lesson_status')).toBe('');
            expect(consoleWarnSpy).toHaveBeenCalled();

            // Default clock (Date.now) drives the session timer: the elapsed
            // time must track the real clock, not sit frozen at zero. Spin on
            // the observable itself — spinning on Date.now() races against
            // the clock reading inside markSessionStart() (a tick between the
            // two reads exits the loop with an elapsed time of exactly 0).
            client.markSessionStart();
            while (client.getElapsedMs() === 0) {
                // Spin until the wall clock advances at least one millisecond.
            }
            expect(client.getElapsedMs()).toBeGreaterThan(0);

            // Default pipwerks lookup + no API: reported via the default
            // error channel. (Set on the page window BEFORE stubbing the
            // window global — the module resolves its global at load time.)
            const pageWindow = window;
            pageWindow.pipwerks = pipwerks;
            vi.stubGlobal('window', createFakeWindowTree('none', api));
            expect(client.initialize()).toBe(false);
            expect(consoleErrorSpy).toHaveBeenCalled();

            consoleWarnSpy.mockRestore();
            consoleErrorSpy.mockRestore();
            delete pageWindow.pipwerks;
        });

        it('reports zero elapsed time before the clock starts or when it goes backwards', () => {
            expect(client.getElapsedMs()).toBe(0);

            useWindow('self');
            client.initialize();
            fakeNow = 500;
            expect(client.getElapsedMs()).toBe(0);
        });
    });

    describe('session time formatting (CMITimespan HHHH:MM:SS.SS)', () => {
        it.each([
            [0, '0000:00:00.00'],
            [5, '0000:00:00.00'],
            [999, '0000:00:00.99'],
            [1234, '0000:00:01.23'],
            [60000, '0000:01:00.00'],
            [3600000, '0001:00:00.00'],
            [360000000, '0100:00:00.00'],
            [35999999990, '9999:59:59.99'],
        ])('formats %d ms as %s', (milliseconds, expected) => {
            expect(client.formatSessionTime(milliseconds)).toBe(expected);
        });

        it('clamps values beyond the representable maximum', () => {
            expect(client.formatSessionTime(36000000000)).toBe('9999:59:59.99');
        });

        it('treats negative input as zero', () => {
            expect(client.formatSessionTime(-1000)).toBe('0000:00:00.00');
        });

        it('writes the elapsed session time', () => {
            useWindow('self');
            client.initialize();
            fakeNow = 61000;

            expect(client.writeSessionTime()).toBe(true);
            expect(api.data['cmi.core.session_time']).toBe('0000:01:00.00');
        });

        it('restarts the clock with markSessionStart', () => {
            useWindow('self');
            client.initialize();
            fakeNow = 61000;
            client.markSessionStart();
            fakeNow = 62500;

            client.writeSessionTime();
            expect(api.data['cmi.core.session_time']).toBe('0000:00:01.50');
        });
    });
});
