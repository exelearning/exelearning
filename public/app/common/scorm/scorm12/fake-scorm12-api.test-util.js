/**
 * Strict, deterministic fake SCORM 1.2 LMS API — test utility, never shipped
 * in exports (the exporter assembles only the runtime source layers; the
 * static build excludes test files).
 *
 * Unlike a permissive stub, this fake *validates*. It implements the SCORM 1.2
 * API adapter surface (LMSInitialize, LMSFinish, LMSCommit, LMSGetValue,
 * LMSSetValue, LMSGetLastError, LMSGetErrorString, LMSGetDiagnostic) against
 * the data model table in scorm12-data-model.test-util.js and answers with the
 * official SCORM 1.2 error codes. A runtime that makes an illegal call — a
 * read of a write-only element, a write to a read-only element, a call before
 * LMSInitialize or after LMSFinish, an out-of-vocabulary value, a skipped
 * array index — is caught by the test suite instead of by a real LMS.
 *
 * Conformance profiles model how much of the *optional* data model an LMS
 * implements:
 *
 * - `minimal`      — only the LMS-RTE1 mandatory elements; every optional
 *                    element answers 401 "not implemented".
 * - `intermediate` — mandatory plus the optional elements a typical LMS ships.
 * - `complete`     — the whole data model.
 *
 * Behaviour that the specification leaves open is marked in the code as a
 * simulator policy decision, never as a quotation. The only opt-in extra
 * strictness is `rejectAsciiViolations`.
 *
 * Sources: [RTE] SCORM 1.2 Run-Time Environment §3.3-§3.4, [CR] SCORM 1.2
 * Conformance Requirements, [ADD] SCORM Addendums 2.0. See
 * scorm12-data-model.test-util.js for the per-element citations.
 *
 * Copyright (C) 2026 The eXeLearning project contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict';

const {
    ACCESS,
    CMI_TIMESPAN_PATTERN,
    CMI_TIME_PATTERN,
    CMI_VERSION,
    DATA_MODEL,
    PROFILES,
    SCORM12_ERROR,
    SCORM12_ERROR_STRINGS,
    toTemplate,
} = require('./scorm12-data-model.test-util.js');

/** Keyword suffixes SCORM 1.2 defines on the data model. */
const CHILDREN_KEYWORD = '_children';
const COUNT_KEYWORD = '_count';

/** Milliseconds per CMITimespan unit, for total_time accumulation. */
const MS_PER_HOUR = 3600000;
const MS_PER_MINUTE = 60000;
const MS_PER_SECOND = 1000;

/**
 * Validate a value against a CMI data type.
 *
 * @param {object} spec - Data model entry (type, vocabulary, min, max…).
 * @param {string} value - The raw string the SCO passed to LMSSetValue.
 * @returns {boolean} True when the value is legal for the element.
 */
function isValidValue(spec, value) {
    const text = String(value);
    if (spec.allowBlank && text === '') {
        return true;
    }
    switch (spec.type) {
        case 'CMIString255':
            return text.length <= 255;
        case 'CMIString4096':
            return text.length <= 4096;
        case 'CMIFeedback':
            // SCORM 1.2 structures CMIFeedback per interaction type; 255 is the
            // largest value the specification requires an LMS to store, and the
            // per-type grammar depends on a sibling element the LMS may not
            // have received yet, so only the length bound is enforced here.
            return text.length <= 255;
        case 'CMIIdentifier':
            // Alphanumeric group, no white space, no unprintable characters.
            return text.length > 0 && text.length <= 255 && /^[\x21-\x7e]+$/.test(text);
        case 'CMIDecimal': {
            if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text)) {
                return false;
            }
            const numeric = Number(text);
            if (spec.min !== undefined && numeric < spec.min) {
                return false;
            }
            return !(spec.max !== undefined && numeric > spec.max);
        }
        case 'CMISInteger': {
            if (!/^[+-]?\d+$/.test(text)) {
                return false;
            }
            const numeric = Number(text);
            const lower = spec.min === undefined ? -32768 : spec.min;
            const upper = spec.max === undefined ? 32768 : spec.max;
            return numeric >= lower && numeric <= upper;
        }
        case 'CMITime':
            return CMI_TIME_PATTERN.test(text);
        case 'CMITimespan':
            return CMI_TIMESPAN_PATTERN.test(text);
        case 'CMIVocabulary':
            return (spec.writeVocabulary || spec.vocabulary).indexOf(text) !== -1;
        case 'CMIResult':
            // cmi.interactions.n.result is either a vocabulary token or a
            // CMIDecimal (a raw score for the interaction).
            return spec.vocabulary.indexOf(text) !== -1 || /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text);
        default:
            return true;
    }
}

/**
 * Parse a CMITimespan into milliseconds (used for total_time accumulation).
 *
 * @param {string} text - CMITimespan value.
 * @returns {number} Milliseconds, or 0 when unparseable.
 */
function timespanToMs(text) {
    const match = /^(\d{2,4}):(\d{2}):(\d{2})(?:\.(\d{1,2}))?$/.exec(String(text));
    if (!match) {
        return 0;
    }
    const hundredths = match[4] === undefined ? 0 : Number(match[4].length === 1 ? `${match[4]}0` : match[4]);
    return (
        Number(match[1]) * MS_PER_HOUR +
        Number(match[2]) * MS_PER_MINUTE +
        Number(match[3]) * MS_PER_SECOND +
        hundredths * 10
    );
}

/**
 * Render milliseconds as a CMITimespan, normalising minutes and seconds below
 * 60 even though the type tolerates up to 99.
 *
 * @param {number} milliseconds - Duration.
 * @returns {string} CMITimespan value.
 */
function msToTimespan(milliseconds) {
    const total = Math.max(0, Math.floor(milliseconds));
    const hours = Math.min(9999, Math.floor(total / MS_PER_HOUR));
    let rest = total - hours * MS_PER_HOUR;
    const minutes = Math.floor(rest / MS_PER_MINUTE);
    rest -= minutes * MS_PER_MINUTE;
    const seconds = Math.floor(rest / MS_PER_SECOND);
    const hundredths = Math.floor((rest - seconds * MS_PER_SECOND) / 10);
    const pad = (value, size) => String(value).padStart(size, '0');
    return `${pad(hours, 4)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(hundredths, 2)}`;
}

/**
 * Create a strict fake SCORM 1.2 API adapter.
 *
 * @param {object} [options] - Configuration.
 * @param {'minimal'|'intermediate'|'complete'} [options.profile] - LMS
 * conformance profile (default `complete`).
 * @param {Object<string, string>} [options.data] - Element values the LMS
 * itself produced, seeded into the store without SCO-side validation (they
 * override the specification defaults, and may set read-only elements).
 * @param {Object<string, {result?: string, errorCode?: number, diagnostic?: string}>} [options.failures]
 * - Per-method failure injection, e.g. `{ LMSCommit: { result: 'false',
 *   errorCode: 101 } }`. Applied before any validation, so it also models an
 *   LMS that fails for reasons the data model cannot express.
 * @param {Object<string, {errorCode?: number}>} [options.elementFailures] -
 * Per-element LMSSetValue failure injection keyed by element path, e.g.
 * `{ 'cmi.core.score.min': { errorCode: 401 } }`.
 * @param {boolean} [options.rejectAsciiViolations] - Opt-in extra strictness:
 * reject non-ASCII characters in CMIString elements. [CR] 10.7/10.8 define the
 * types as ASCII but few LMSs enforce it, so this is off by default.
 * @returns {object} The fake API object.
 */
function createFakeScorm12Api(options = {}) {
    const failures = options.failures || {};
    const elementFailures = options.elementFailures || {};
    const profileName = options.profile || 'complete';
    const tiers = PROFILES[profileName];
    if (!tiers) {
        throw new Error(`Unknown SCORM 1.2 conformance profile: ${profileName}`);
    }

    /** @returns {boolean} True when the LMS supports the element's tier. */
    function isSupported(spec) {
        return tiers.indexOf(spec.tier) !== -1;
    }

    // Seed the values SCORM 1.2 requires the LMS to present on first launch.
    const initialData = {};
    for (const template of Object.keys(DATA_MODEL)) {
        const spec = DATA_MODEL[template];
        if (spec.initial === undefined || template.indexOf('.n.') !== -1 || !isSupported(spec)) {
            continue;
        }
        initialData[template] = spec.initial;
    }

    const api = {
        /** Ordered call log: `{ method, args }` entries. */
        calls: [],
        /** Backing cmi store (concrete element paths → string values). */
        data: Object.assign(initialData, options.data),
        /** Current error state (SCORM 1.2 keeps it as a string). */
        errorCode: '0',
        /** Diagnostic detail for the current error (never learner data). */
        diagnostic: '',
        initialized: false,
        finished: false,
        profile: profileName,
    };

    function log(method, args) {
        api.calls.push({ method, args: Array.from(args) });
    }

    function fail(code, diagnostic) {
        api.errorCode = String(code);
        api.diagnostic = diagnostic || SCORM12_ERROR_STRINGS[code] || '';
        return false;
    }

    function succeed() {
        api.errorCode = '0';
        api.diagnostic = '';
        return true;
    }

    function configuredFailure(method) {
        const failure = failures[method];
        if (!failure) {
            return null;
        }
        api.errorCode = String(failure.errorCode !== undefined ? failure.errorCode : SCORM12_ERROR.GENERAL_EXCEPTION);
        api.diagnostic = failure.diagnostic || 'injected failure';
        return failure.result !== undefined ? failure.result : 'false';
    }

    /**
     * Count the records of a list element. SCORM 1.2 defines `_count` as the
     * number of records, not the last index, and lists are 0-based and dense.
     *
     * @param {string} prefix - Collection path without the `_count` keyword.
     * @returns {number} Record count.
     */
    function countOf(prefix) {
        let count = 0;
        for (const key of Object.keys(api.data)) {
            if (key.indexOf(`${prefix}.`) !== 0) {
                continue;
            }
            const index = key.slice(prefix.length + 1).split('.')[0];
            if (/^\d+$/.test(index)) {
                count = Math.max(count, Number(index) + 1);
            }
        }
        return count;
    }

    /**
     * The `_children` value for an element, filtered by what this profile
     * actually supports (a SCO reads `_children` precisely to discover that).
     *
     * @param {string} template - Data model template of the parent.
     * @param {object} spec - Its data model entry.
     * @returns {string} Comma-separated child list.
     */
    function childrenOf(template, spec) {
        return spec.children
            .split(',')
            .filter(child => {
                const childSpec = DATA_MODEL[`${template}.${child}`];
                return childSpec === undefined || isSupported(childSpec);
            })
            .join(',');
    }

    /**
     * Resolve an element path, applying every rule that does not depend on the
     * direction of the call.
     *
     * @param {string} element - Concrete element path.
     * @returns {{spec: object, template: string, keyword: string|null,
     * basePath: string, baseTemplate: string}|number} The resolution, or an
     * error code.
     */
    function resolve(element) {
        if (typeof element !== 'string' || element === '') {
            return SCORM12_ERROR.INVALID_ARGUMENT;
        }
        // cmi._version is a keyword of the model root, not of an element.
        if (element === 'cmi._version') {
            return { spec: { access: ACCESS.READ_ONLY, type: 'CMIString255' }, template: element, keyword: '_version', basePath: element, baseTemplate: element };
        }
        // An element outside the cmi namespace is "not implemented" rather
        // than "invalid" ([CR] 8.2.5 / 9.3.5).
        if (element.indexOf('cmi.') !== 0) {
            return SCORM12_ERROR.NOT_IMPLEMENTED;
        }

        const segments = element.split('.');
        const last = segments[segments.length - 1];
        const keyword = last === CHILDREN_KEYWORD || last === COUNT_KEYWORD ? last : null;
        const basePath = keyword ? segments.slice(0, -1).join('.') : element;

        const { template, malformedIndex } = toTemplate(basePath);
        if (malformedIndex) {
            return SCORM12_ERROR.INVALID_ARGUMENT;
        }

        const spec = DATA_MODEL[template];
        if (!spec) {
            return SCORM12_ERROR.INVALID_ARGUMENT;
        }
        if (!isSupported(spec)) {
            return SCORM12_ERROR.NOT_IMPLEMENTED;
        }
        if (keyword === CHILDREN_KEYWORD && spec.children === undefined) {
            return SCORM12_ERROR.ELEMENT_CANNOT_HAVE_CHILDREN;
        }
        if (keyword === COUNT_KEYWORD && !spec.array) {
            return SCORM12_ERROR.ELEMENT_NOT_AN_ARRAY;
        }
        if (!keyword && spec.aggregate) {
            // An aggregate has no value of its own; only its keywords and leaf
            // children are addressable.
            return SCORM12_ERROR.INVALID_ARGUMENT;
        }
        return { spec, template, keyword, basePath, baseTemplate: template };
    }

    /**
     * Enforce the SCORM 1.2 list rule: an index must be less than or equal to
     * the current record count of its list ([CR] 9.3.8). Writing index n+1
     * before n is rejected with 201.
     *
     * @param {string} path - Concrete element path.
     * @returns {number|null} The offending index, or null when in order.
     */
    function findOutOfOrderIndex(path) {
        const segments = path.split('.');
        for (let position = 0; position < segments.length; position += 1) {
            if (!/^\d+$/.test(segments[position])) {
                continue;
            }
            const prefix = segments.slice(0, position).join('.');
            const index = Number(segments[position]);
            if (index > countOf(prefix)) {
                return index;
            }
        }
        return null;
    }

    /**
     * True when a concrete list index has never been written. Reading such an
     * index is 201 ([CR] 8.2.7).
     *
     * @param {string} path - Concrete element path.
     * @returns {boolean} True when some index in the path does not exist yet.
     */
    function hasUnsetIndex(path) {
        const segments = path.split('.');
        for (let position = 0; position < segments.length; position += 1) {
            if (!/^\d+$/.test(segments[position])) {
                continue;
            }
            const prefix = segments.slice(0, position).join('.');
            if (Number(segments[position]) >= countOf(prefix)) {
                return true;
            }
        }
        return false;
    }

    api.LMSInitialize = function (argument) {
        log('LMSInitialize', arguments);
        const injected = configuredFailure('LMSInitialize');
        if (injected !== null) {
            return injected;
        }
        if (argument !== '') {
            // [CR] 5.5: the single parameter must be the empty string.
            return String(fail(SCORM12_ERROR.INVALID_ARGUMENT, 'LMSInitialize takes an empty string'));
        }
        if (api.initialized || api.finished) {
            // [CR] 5.6: a second LMSInitialize by a launched SCO is 101, not 301.
            return String(fail(SCORM12_ERROR.GENERAL_EXCEPTION, 'LMSInitialize was already called'));
        }
        api.initialized = true;
        succeed();
        return 'true';
    };

    api.LMSFinish = function (argument) {
        log('LMSFinish', arguments);
        const injected = configuredFailure('LMSFinish');
        if (injected !== null) {
            return injected;
        }
        if (argument !== '') {
            return String(fail(SCORM12_ERROR.INVALID_ARGUMENT, 'LMSFinish takes an empty string'));
        }
        if (!api.initialized) {
            return String(fail(SCORM12_ERROR.NOT_INITIALIZED, 'no active session to terminate'));
        }
        // [CR] 1.9.5: the LMS adds the last session_time set during the session
        // to cmi.core.total_time when it processes LMSFinish.
        if (api.data['cmi.core.session_time'] !== undefined) {
            api.data['cmi.core.total_time'] = msToTimespan(
                timespanToMs(api.data['cmi.core.total_time'] || '0000:00:00.00') +
                    timespanToMs(api.data['cmi.core.session_time']),
            );
        }
        // Simulator policy (the specification says only "ignore any API
        // function calls made after LMSFinish", [CR] 6.8): drop back to the
        // not-initialized state, so later Get/Set/Commit/Finish answer 301 and
        // a later LMSInitialize answers 101. This is what Moodle does.
        api.initialized = false;
        api.finished = true;
        succeed();
        return 'true';
    };

    api.LMSCommit = function (argument) {
        log('LMSCommit', arguments);
        const injected = configuredFailure('LMSCommit');
        if (injected !== null) {
            return injected;
        }
        if (argument !== '') {
            return String(fail(SCORM12_ERROR.INVALID_ARGUMENT, 'LMSCommit takes an empty string'));
        }
        if (!api.initialized) {
            return String(fail(SCORM12_ERROR.NOT_INITIALIZED, 'no active session to commit'));
        }
        succeed();
        return 'true';
    };

    api.LMSGetValue = function (element) {
        log('LMSGetValue', arguments);
        const injected = configuredFailure('LMSGetValue');
        if (injected !== null) {
            return '';
        }
        if (!api.initialized) {
            fail(SCORM12_ERROR.NOT_INITIALIZED, 'no active session');
            return '';
        }
        const resolution = resolve(element);
        if (typeof resolution === 'number') {
            fail(resolution, `LMSGetValue('${element}')`);
            return '';
        }
        const { spec, keyword, basePath, baseTemplate } = resolution;
        if (keyword === '_version') {
            succeed();
            return CMI_VERSION;
        }
        if (keyword === CHILDREN_KEYWORD) {
            succeed();
            return childrenOf(baseTemplate, spec);
        }
        if (keyword === COUNT_KEYWORD) {
            succeed();
            return String(countOf(basePath));
        }
        if (spec.access === ACCESS.WRITE_ONLY) {
            fail(SCORM12_ERROR.ELEMENT_IS_WRITE_ONLY, `LMSGetValue('${element}')`);
            return '';
        }
        if (hasUnsetIndex(element)) {
            fail(SCORM12_ERROR.INVALID_ARGUMENT, `LMSGetValue('${element}') addresses an index that was never set`);
            return '';
        }
        succeed();
        return Object.prototype.hasOwnProperty.call(api.data, element) ? api.data[element] : '';
    };

    api.LMSSetValue = function (element, value) {
        log('LMSSetValue', arguments);
        const injected = configuredFailure('LMSSetValue');
        if (injected !== null) {
            return injected;
        }
        if (!api.initialized) {
            return String(fail(SCORM12_ERROR.NOT_INITIALIZED, 'no active session'));
        }
        const perElement = elementFailures[element];
        if (perElement) {
            return String(
                fail(
                    perElement.errorCode !== undefined ? perElement.errorCode : SCORM12_ERROR.NOT_IMPLEMENTED,
                    `LMSSetValue('${element}') is not supported by this LMS`,
                ),
            );
        }
        const resolution = resolve(element);
        if (typeof resolution === 'number') {
            return String(fail(resolution, `LMSSetValue('${element}')`));
        }
        const { spec, keyword, basePath } = resolution;
        if (keyword) {
            return String(fail(SCORM12_ERROR.INVALID_SET_VALUE_KEYWORD, `LMSSetValue('${element}')`));
        }
        if (spec.access === ACCESS.READ_ONLY) {
            return String(fail(SCORM12_ERROR.ELEMENT_IS_READ_ONLY, `LMSSetValue('${element}')`));
        }
        const outOfOrder = findOutOfOrderIndex(basePath);
        if (outOfOrder !== null) {
            return String(
                fail(SCORM12_ERROR.INVALID_ARGUMENT, `array index ${outOfOrder} is beyond the current record count`),
            );
        }
        const text = String(value);
        if (!isValidValue(spec, text)) {
            return String(fail(SCORM12_ERROR.INCORRECT_DATA_TYPE, `LMSSetValue('${element}')`));
        }
        if (options.rejectAsciiViolations && /[^\x00-\x7f]/.test(text)) {
            return String(fail(SCORM12_ERROR.INCORRECT_DATA_TYPE, `LMSSetValue('${element}') is not ASCII`));
        }
        // [CR] 4.5: cmi.comments accumulates, it does not overwrite.
        api.data[element] = spec.append ? (api.data[element] || '') + text : text;
        succeed();
        return 'true';
    };

    // The three error functions never change the error state ([RTE] §3.3.4)
    // and are legal before LMSInitialize and after LMSFinish.
    api.LMSGetLastError = function () {
        return api.errorCode;
    };

    api.LMSGetErrorString = function (code) {
        return SCORM12_ERROR_STRINGS[Number(code)] || '';
    };

    api.LMSGetDiagnostic = function (code) {
        if (code === '' || code === undefined || String(code) === api.errorCode) {
            return api.diagnostic;
        }
        return SCORM12_ERROR_STRINGS[Number(code)] || '';
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
     * Method names in call order with LMSSetValue/LMSGetValue collapsed to
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

    /** Forget every recorded call (keeps the stored data and error state). */
    api.resetCalls = function () {
        api.calls = [];
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
        SCORM12_ERROR,
        SCORM12_ERROR_STRINGS,
        createFakeScorm12Api,
        createFakeWindowTree,
        isValidValue,
        msToTimespan,
        resetPipwerks,
        timespanToMs,
    };
}
