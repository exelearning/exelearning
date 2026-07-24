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
            api = createFakeScorm12Api({ failures: { LMSSetValue: { result: 'false', errorCode: 403 } } });
            useWindow('self');
            client.initialize();

            expect(client.setValue('cmi.core.lesson_mode', 'review')).toBe(false);
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('403'));
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Element is read only'));
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

            // Default clock (Date.now) drives the session timer.
            client.markSessionStart();
            expect(client.getElapsedMs()).toBeGreaterThanOrEqual(0);

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
