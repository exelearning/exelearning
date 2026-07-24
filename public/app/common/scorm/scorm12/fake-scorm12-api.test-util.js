/**
 * Deterministic fake SCORM 1.2 LMS API — test utility, never shipped in
 * exports (the exporter assembles only the runtime source files; the static
 * build excludes test files).
 *
 * Implements the SCORM 1.2 API adapter surface (LMSInitialize, LMSFinish,
 * LMSGetValue, LMSSetValue, LMSCommit, LMSGetLastError, LMSGetErrorString,
 * LMSGetDiagnostic), records an ordered call log with arguments, and can be
 * configured to fail per method with a specific error code. Helpers build
 * fake window trees to exercise API discovery (same window, parent,
 * grandparent, opener, none, throwing cross-origin accessor).
 *
 * Copyright (C) 2026 The eXeLearning project contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict';

/** SCORM 1.2 error strings for the codes this fake can produce. */
const SCORM12_ERROR_STRINGS = {
    0: 'No error',
    101: 'General exception',
    201: 'Invalid argument error',
    301: 'Not initialized',
    401: 'Not implemented error',
    402: 'Invalid set value, element is a keyword',
    403: 'Element is read only',
    404: 'Element is write only',
    405: 'Incorrect data type',
};

/**
 * Create a deterministic fake SCORM 1.2 API adapter.
 *
 * @param {object} [options] - Configuration.
 * @param {Object<string, string>} [options.data] - Initial cmi element values.
 * @param {Object<string, {result?: string, errorCode?: number}>} [options.failures]
 * - Per-method failure configuration, e.g. `{ LMSCommit: { result: 'false',
 *   errorCode: 101 } }`.
 * @returns {object} The fake API object.
 */
function createFakeScorm12Api(options = {}) {
    const failures = options.failures || {};

    const api = {
        /** Ordered call log: `{ method, args }` entries. */
        calls: [],
        /** Backing cmi store. */
        data: Object.assign({}, options.data),
        /** Current error state (SCORM 1.2 keeps it as a string). */
        errorCode: '0',
        initialized: false,
        finished: false,
    };

    function log(method, args) {
        api.calls.push({ method, args: Array.from(args) });
    }

    function configuredFailure(method) {
        const failure = failures[method];
        if (!failure) {
            return null;
        }
        api.errorCode = String(failure.errorCode !== undefined ? failure.errorCode : 101);
        return failure.result !== undefined ? failure.result : 'false';
    }

    api.LMSInitialize = function () {
        log('LMSInitialize', arguments);
        const failure = configuredFailure('LMSInitialize');
        if (failure !== null) {
            return failure;
        }
        api.initialized = true;
        api.errorCode = '0';
        return 'true';
    };

    api.LMSFinish = function () {
        log('LMSFinish', arguments);
        const failure = configuredFailure('LMSFinish');
        if (failure !== null) {
            return failure;
        }
        api.finished = true;
        api.errorCode = '0';
        return 'true';
    };

    api.LMSGetValue = function (element) {
        log('LMSGetValue', arguments);
        const failure = configuredFailure('LMSGetValue');
        if (failure !== null) {
            return '';
        }
        api.errorCode = '0';
        return element in api.data ? api.data[element] : '';
    };

    api.LMSSetValue = function (element, value) {
        log('LMSSetValue', arguments);
        const failure = configuredFailure('LMSSetValue');
        if (failure !== null) {
            return failure;
        }
        api.data[element] = String(value);
        api.errorCode = '0';
        return 'true';
    };

    api.LMSCommit = function () {
        log('LMSCommit', arguments);
        const failure = configuredFailure('LMSCommit');
        if (failure !== null) {
            return failure;
        }
        api.errorCode = '0';
        return 'true';
    };

    api.LMSGetLastError = function () {
        return api.errorCode;
    };

    api.LMSGetErrorString = function (code) {
        return SCORM12_ERROR_STRINGS[Number(code)] || 'Unknown error';
    };

    api.LMSGetDiagnostic = function (code) {
        return `diagnostic for ${code}`;
    };

    /** @returns {string[]} Method names in call order. */
    api.callNames = function () {
        return api.calls.map(call => call.method);
    };

    /**
     * @param {string} method - API method name.
     * @returns {Array<Array>} The argument lists of every call to method.
     */
    api.callsFor = function (method) {
        return api.calls.filter(call => call.method === method).map(call => call.args);
    };

    /**
     * Method names in call order with LMSSetValue collapsed to
     * `LMSSetValue(element=value)` — readable order-sensitive assertions.
     *
     * @returns {string[]} Call signature list.
     */
    api.callSignatures = function () {
        return api.calls.map(call => {
            if (call.method === 'LMSSetValue') {
                return `LMSSetValue(${call.args[0]}=${call.args[1]})`;
            }
            if (call.method === 'LMSGetValue') {
                return `LMSGetValue(${call.args[0]})`;
            }
            return call.method;
        });
    };

    return api;
}

/**
 * Build a fake window tree exposing the API at a given position, for API
 * discovery tests. The returned object is meant to be stubbed as the global
 * `window` (the pipwerks wrapper resolves `window` dynamically).
 *
 * @param {string} position - One of 'self', 'parent', 'grandparent',
 * 'opener', 'none', 'hostile-ancestor'.
 * @param {object} api - The fake API (ignored for 'none'/'hostile-ancestor').
 * @param {object} [extras] - Extra properties merged into the content window
 * (e.g. `{ API_1484_11: otherApi }` for version pinning tests).
 * @returns {object} The fake content window object.
 */
function createFakeWindowTree(position, api, extras = {}) {
    const contentWindow = Object.assign({}, extras);
    contentWindow.parent = contentWindow;
    contentWindow.top = contentWindow;

    switch (position) {
        case 'self': {
            contentWindow.API = api;
            break;
        }
        case 'parent': {
            const parentWindow = { API: api };
            parentWindow.parent = parentWindow;
            contentWindow.parent = parentWindow;
            contentWindow.top = parentWindow;
            break;
        }
        case 'grandparent': {
            const grandparentWindow = { API: api };
            grandparentWindow.parent = grandparentWindow;
            const parentWindow = { parent: grandparentWindow };
            contentWindow.parent = parentWindow;
            contentWindow.top = grandparentWindow;
            break;
        }
        case 'opener': {
            const openerWindow = { API: api };
            openerWindow.parent = openerWindow;
            contentWindow.top = { parent: contentWindow, opener: openerWindow };
            break;
        }
        case 'none': {
            break;
        }
        case 'hostile-ancestor': {
            // Simulates a cross-origin parent: touching its properties throws.
            const hostileWindow = {};
            Object.defineProperty(hostileWindow, 'API', {
                get() {
                    throw new Error('SecurityError: cross-origin access denied');
                },
            });
            Object.defineProperty(hostileWindow, 'API_1484_11', {
                get() {
                    throw new Error('SecurityError: cross-origin access denied');
                },
            });
            contentWindow.parent = hostileWindow;
            contentWindow.top = hostileWindow;
            break;
        }
        default: {
            throw new Error(`Unknown API position: ${position}`);
        }
    }

    return contentWindow;
}

/**
 * Reset the (module-cached) pipwerks wrapper to its pristine state between
 * tests: version, automatic-handling flags, API handle and connection state.
 *
 * @param {object} pipwerks - The wrapper module.
 */
function resetPipwerks(pipwerks) {
    pipwerks.SCORM.version = null;
    pipwerks.SCORM.handleCompletionStatus = true;
    pipwerks.SCORM.handleExitMode = true;
    pipwerks.SCORM.API.handle = null;
    pipwerks.SCORM.API.isFound = false;
    pipwerks.SCORM.connection.isActive = false;
    pipwerks.SCORM.data.completionStatus = null;
    pipwerks.SCORM.data.exitStatus = null;
    // Silence the wrapper's console tracing in tests.
    pipwerks.debug.isActive = false;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SCORM12_ERROR_STRINGS,
        createFakeScorm12Api,
        createFakeWindowTree,
        resetPipwerks,
    };
}
