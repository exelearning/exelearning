/**
 * eXeLearning SCORM 1.2 runtime — client layer.
 *
 * Thin, SCORM 1.2-only communication layer on top of the vendored upstream
 * pipwerks SCORM API wrapper (see vendor/pipwerks/SCORM_API_wrapper.js, MIT).
 * Implemented from the SCORM 1.2 Run-Time Environment specification and the
 * project contract in doc/development/scorm12-runtime-contract.md.
 *
 * Responsibilities:
 * - Pin the wrapper to SCORM 1.2 before API discovery (a 1.2 package must
 *   never bind to a SCORM 2004 API_1484_11 instance).
 * - LMSInitialize / LMSGetValue / LMSSetValue / LMSCommit / LMSFinish with
 *   explicit error reporting via LMSGetLastError / LMSGetErrorString.
 * - An explicit session state machine (idle → active → finish_attempted →
 *   finished | finish_failed) so a failed termination stays observably failed
 *   and no call is ever forwarded to the LMS after a finish attempt.
 * - Refuse locally the calls SCORM 1.2 forbids: reading a write-only element
 *   and writing a read-only one. Legacy compatibility getters read the local
 *   write cache instead of issuing an invalid LMSGetValue.
 * - A session clock that survives being paused (back/forward cache) without
 *   double counting, and cmi.core.session_time formatting (CMITimespan,
 *   HHHH:MM:SS.SS).
 *
 * This layer holds no completion policy; see exe-scorm12-policy.js.
 * Error reports never include learner data (element names and LMS error
 * codes only).
 *
 * Copyright (C) 2026 The eXeLearning project contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version. This program is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty
 * of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero
 * General Public License <https://www.gnu.org/licenses/agpl-3.0.html> for
 * more details.
 */
(function (global) {
    'use strict';

    var MS_PER_HOUR = 3600000;
    var MS_PER_MINUTE = 60000;
    var MS_PER_SECOND = 1000;
    // Largest CMITimespan value this formatter emits (see formatSessionTime).
    var MAX_SESSION_TIME = '9999:59:59.99';

    /**
     * Session states. `finish_attempted` exists so that a termination that is
     * in flight, or that failed, can never be mistaken for a completed one:
     * the SCORM 1.2 API adapter is gone after LMSFinish either way, so no
     * further call may be forwarded, but only `finished` means the LMS
     * acknowledged it.
     */
    var STATE = {
        IDLE: 'idle',
        ACTIVE: 'active',
        FINISH_ATTEMPTED: 'finish_attempted',
        FINISHED: 'finished',
        FINISH_FAILED: 'finish_failed',
    };

    /**
     * Elements SCORM 1.2 defines as write-only. Reading one is error 404, so
     * the runtime answers legacy getters from its own write cache instead of
     * issuing the invalid call.
     */
    var WRITE_ONLY_ELEMENTS = ['cmi.core.exit', 'cmi.core.session_time'];

    /**
     * Prefixes whose leaf elements are write-only in SCORM 1.2. The whole
     * cmi.interactions collection is reported by the SCO and never read back;
     * only its `_count` / `_children` keywords are readable.
     */
    var WRITE_ONLY_PREFIXES = ['cmi.interactions.'];

    /** Elements SCORM 1.2 defines as read-only (writing one is error 403). */
    var READ_ONLY_ELEMENTS = [
        'cmi._version',
        'cmi.core.student_id',
        'cmi.core.student_name',
        'cmi.core.credit',
        'cmi.core.entry',
        'cmi.core.total_time',
        'cmi.core.lesson_mode',
        'cmi.launch_data',
        'cmi.comments_from_lms',
    ];

    /** Prefixes whose leaf elements are read-only in SCORM 1.2. */
    var READ_ONLY_PREFIXES = ['cmi.student_data.'];

    /** Keyword suffixes: always readable, never writable. */
    var KEYWORD_SUFFIXES = ['._children', '._count'];

    var defaultDeps = {
        getPipwerks: function () {
            return global.pipwerks;
        },
        now: function () {
            return Date.now();
        },
        warn: function (message) {
            if (global.console && global.console.warn) {
                global.console.warn(message);
            }
        },
        error: function (message) {
            if (global.console && global.console.error) {
                global.console.error(message);
            }
        },
    };

    var deps = defaultDeps;

    function initialState() {
        return {
            status: STATE.IDLE,
            // Result and diagnostics of the single finish attempt.
            finishResult: null,
            finishError: null,
            terminationSource: null,
            // Session clock.
            clockStartMs: null,
            accumulatedMs: 0,
            clockRunning: false,
            // Last value this runtime wrote per element, used to answer legacy
            // getters for write-only elements without an invalid LMS call.
            writeCache: {},
            // Per-step outcome of the single termination (commit and finish
            // are separate LMS calls with separate results).
            finishSteps: null,
            externalTerminationReported: false,
        };
    }

    var state = initialState();

    /**
     * Left-pad a non-negative integer with zeros.
     *
     * @param {number} value - Non-negative integer.
     * @param {number} digits - Minimum number of digits.
     * @returns {string} Zero-padded value.
     */
    function zeroPad(value, digits) {
        var text = String(value);
        while (text.length < digits) {
            text = '0' + text;
        }
        return text;
    }

    /**
     * @param {string} text - Text to inspect.
     * @param {string} suffix - Suffix to look for.
     * @returns {boolean} True when text ends with suffix (ES5-safe).
     */
    function endsWith(text, suffix) {
        return text.length >= suffix.length && text.slice(text.length - suffix.length) === suffix;
    }

    /**
     * @param {string} element - cmi element name.
     * @returns {boolean} True when the name ends in a data model keyword.
     */
    function isKeyword(element) {
        for (var index = 0; index < KEYWORD_SUFFIXES.length; index += 1) {
            if (endsWith(element, KEYWORD_SUFFIXES[index])) {
                return true;
            }
        }
        return element === 'cmi._version';
    }

    /**
     * @param {string} element - cmi element name.
     * @returns {boolean} True when SCORM 1.2 makes the element write-only.
     */
    function isWriteOnly(element) {
        if (isKeyword(element)) {
            return false;
        }
        if (WRITE_ONLY_ELEMENTS.indexOf(element) !== -1) {
            return true;
        }
        for (var index = 0; index < WRITE_ONLY_PREFIXES.length; index += 1) {
            if (element.indexOf(WRITE_ONLY_PREFIXES[index]) === 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * @param {string} element - cmi element name.
     * @returns {boolean} True when SCORM 1.2 makes the element read-only.
     */
    function isReadOnly(element) {
        if (isKeyword(element)) {
            return true;
        }
        if (READ_ONLY_ELEMENTS.indexOf(element) !== -1) {
            return true;
        }
        for (var index = 0; index < READ_ONLY_PREFIXES.length; index += 1) {
            if (element.indexOf(READ_ONLY_PREFIXES[index]) === 0) {
                return true;
            }
        }
        return false;
    }

    /**
     * Decide whether SCORM 1.2 forbids writing an element, without asking the
     * LMS. Returns the error the LMS itself would have raised so callers can
     * report the real reason.
     *
     * @param {string} element - cmi element name.
     * @returns {{code: number, message: string}|null} The rejection, or null
     * when the write is legal.
     */
    function writeRejection(element) {
        if (isKeyword(element)) {
            return { code: 402, message: 'Invalid set value, element is a keyword' };
        }
        if (isReadOnly(element)) {
            return { code: 403, message: 'Element is read only' };
        }
        return null;
    }

    /**
     * Read the current LMS error state (SCORM 1.2 LMSGetLastError /
     * LMSGetErrorString).
     *
     * @returns {{code: number, message: string}} Last error code and text.
     */
    function getLastError() {
        try {
            var pipwerks = deps.getPipwerks();
            if (!pipwerks || !pipwerks.SCORM || !pipwerks.SCORM.API.getHandle()) {
                return { code: -1, message: 'SCORM API not available' };
            }
            var code = pipwerks.SCORM.debug.getCode();
            var message = code === 0 ? 'No error' : pipwerks.SCORM.debug.getInfo(code);
            return { code: code, message: message };
        } catch (error) {
            return { code: -1, message: String(error) };
        }
    }

    /**
     * Report an LMS-level failure. Element names and error codes only —
     * never learner data.
     *
     * @param {string} operation - The SCORM API call that failed.
     * @param {string} [element] - The cmi element involved, if any.
     * @param {{code: number, message: string}} [preRead] - The LMS error, when
     * the caller already read it; read from the LMS otherwise.
     * @returns {{code: number, message: string}} The LMS error that was read.
     */
    function reportLmsError(operation, element, preRead) {
        var lastError = preRead || getLastError();
        var target = element ? " for '" + element + "'" : '';
        deps.error(
            '[exe-scorm12] ' +
                operation +
                target +
                ' failed. LMS error ' +
                lastError.code +
                ': ' +
                lastError.message,
        );
        return lastError;
    }

    /**
     * Report a client-level rejection (no LMS traffic happened).
     *
     * @param {string} message - Reason for the rejection.
     */
    function reportRejected(message) {
        deps.warn('[exe-scorm12] ' + message);
    }

    /**
     * Detect a termination performed outside this state machine — legacy
     * content that calls pipwerks.SCORM.quit() or connection.terminate()
     * directly closes the same connection this layer owns. The adapter wraps
     * those entry points, but a page can still hold a reference captured
     * before the wrap, so the state is reconciled defensively on every access.
     */
    function reconcileExternalTermination() {
        if (state.status !== STATE.ACTIVE) {
            return;
        }
        var pipwerks = deps.getPipwerks();
        if (!pipwerks || !pipwerks.SCORM || pipwerks.SCORM.connection.isActive) {
            return;
        }
        state.status = STATE.FINISHED;
        state.finishResult = true;
        state.terminationSource = 'external';
        if (!state.externalTerminationReported) {
            state.externalTerminationReported = true;
            reportRejected('the SCORM connection was closed outside the runtime; the session is now treated as ended.');
        }
    }

    /**
     * Shared implementation of the two LMSSetValue entry points.
     *
     * @param {string} element - cmi element name.
     * @param {string|number} value - Value to write.
     * @param {boolean} optionalElement - True when the SCORM 1.2 data model
     * declares the element optional: LMS error 401 ("not implemented") is
     * then a conforming answer and is returned without an error report.
     * @returns {{success: boolean, errorCode: number, errorMessage: string,
     * forwarded: boolean}} What happened.
     */
    function writeValueDetailed(element, value, optionalElement) {
        var rejection = writeRejection(element);
        if (rejection !== null) {
            reportRejected("setValue('" + element + "') rejected: " + rejection.message + ' in SCORM 1.2.');
            return {
                success: false,
                errorCode: rejection.code,
                errorMessage: rejection.message,
                forwarded: false,
            };
        }
        if (!client.isActive()) {
            reportRejected("setValue('" + element + "') rejected: no active SCORM session.");
            return { success: false, errorCode: 301, errorMessage: 'Not initialized', forwarded: false };
        }
        var pipwerks = deps.getPipwerks();
        var text = String(value);
        var success = false;
        try {
            success = pipwerks.SCORM.data.set(element, text);
        } catch (error) {
            deps.error("[exe-scorm12] LMSSetValue for '" + element + "' failed: " + error);
            return { success: false, errorCode: 101, errorMessage: String(error), forwarded: true };
        }
        if (!success) {
            var lastError = getLastError();
            if (!(optionalElement && lastError.code === 401)) {
                reportLmsError('LMSSetValue', element, lastError);
            }
            return {
                success: false,
                errorCode: lastError.code,
                errorMessage: lastError.message,
                forwarded: true,
            };
        }
        state.writeCache[element] = text;
        return { success: true, errorCode: 0, errorMessage: 'No error', forwarded: true };
    }

    var client = {
        STATE: STATE,

        /**
         * Override dependencies (tests only).
         *
         * @param {object} overrides - Partial dependency overrides.
         */
        configure: function (overrides) {
            deps = {};
            for (var key in defaultDeps) {
                deps[key] = defaultDeps[key];
            }
            for (var override in overrides) {
                deps[override] = overrides[override];
            }
        },

        /** Restore default dependencies and reset session state (tests only). */
        resetDependencies: function () {
            deps = defaultDeps;
            state = initialState();
        },

        /**
         * Open the SCORM 1.2 session. Idempotent: once active, further calls
         * return true without touching the LMS. Pins the wrapper to SCORM 1.2
         * and disables its automatic status/exit handling before the first API
         * discovery, so all policy lives in the project layers.
         *
         * @returns {boolean} True when the session is (already) active.
         */
        initialize: function () {
            reconcileExternalTermination();
            if (state.status !== STATE.IDLE) {
                if (state.status === STATE.ACTIVE) {
                    return true;
                }
                reportRejected('initialize() rejected: the session was already terminated.');
                return false;
            }
            var pipwerks = deps.getPipwerks();
            if (!pipwerks || !pipwerks.SCORM) {
                reportRejected('initialize() failed: the pipwerks SCORM wrapper is not loaded.');
                return false;
            }
            pipwerks.SCORM.version = '1.2';
            pipwerks.SCORM.handleCompletionStatus = false;
            pipwerks.SCORM.handleExitMode = false;
            // Adopt a connection another party already opened (contract §4). A host
            // can legitimately initialize before the content does — the Moodle plugin's
            // injector force-calls pipwerks.SCORM.init() on a poller and usually wins
            // the race (plugin releases before mod_exelearning #105; #105 opens through
            // exeScorm12.session.open({ ownsLifecycle: false }) and keeps that call only
            // as its two-second fallback for a package whose runtime predates it) — and
            // upstream pipwerks connection.initialize() returns FALSE on an
            // already-active connection, which would fail the iDevices'
            // `scorm.init()` gate and silently break manual score saves.
            if (pipwerks.SCORM.connection && pipwerks.SCORM.connection.isActive === true) {
                state.status = STATE.ACTIVE;
                client.startClock();
                return true;
            }
            var success = false;
            try {
                success = pipwerks.SCORM.connection.initialize();
            } catch (error) {
                // API discovery can hit an inaccessible cross-origin ancestor
                // window; treat it as "no API found".
                deps.error('[exe-scorm12] LMSInitialize failed: ' + error);
                return false;
            }
            if (!success) {
                reportLmsError('LMSInitialize');
                return false;
            }
            state.status = STATE.ACTIVE;
            client.startClock();
            return true;
        },

        /** @returns {string} The current session state (see client.STATE). */
        getState: function () {
            reconcileExternalTermination();
            return state.status;
        },

        /**
         * @returns {boolean} True while the session may still receive LMS
         * calls (initialized, and no finish has been attempted).
         */
        isActive: function () {
            reconcileExternalTermination();
            return state.status === STATE.ACTIVE;
        },

        /** @returns {boolean} True once initialize() succeeded. */
        isInitialized: function () {
            return state.status !== STATE.IDLE;
        },

        /**
         * @returns {boolean} True once a finish was attempted, whatever its
         * outcome. No LMS call may be made from this point on.
         */
        isTerminated: function () {
            reconcileExternalTermination();
            return (
                state.status === STATE.FINISH_ATTEMPTED ||
                state.status === STATE.FINISHED ||
                state.status === STATE.FINISH_FAILED
            );
        },

        /**
         * @returns {{attempted: boolean, result: boolean|null, error: object|null,
         * source: string|null, commitAttempted: boolean, commitSucceeded: boolean,
         * finishAttempted: boolean, finishSucceeded: boolean}} Everything
         * recorded about the single termination. Commit and finish are
         * reported separately: a `result` of false may mean the commit failed
         * and LMSFinish was never attempted at all. `error` preserves the
         * original failure even after later calls.
         */
        getFinishReport: function () {
            var steps = state.finishSteps || {};
            return {
                attempted: client.isTerminated(),
                result: state.finishResult,
                error: state.finishError,
                source: state.terminationSource,
                commitAttempted: steps.commitAttempted === true,
                commitSucceeded: steps.commitSucceeded === true,
                finishAttempted: steps.finishAttempted === true,
                finishSucceeded: steps.finishSucceeded === true,
            };
        },

        /**
         * Read a data model element (LMSGetValue).
         *
         * Reading a write-only element is error 404 in SCORM 1.2, so the value
         * is answered from the local write cache and no LMS call is made.
         *
         * @param {string} element - cmi element name.
         * @returns {string} The element value, or '' on error (reported).
         */
        getValue: function (element) {
            if (isWriteOnly(element)) {
                // Documented compatibility value: what this runtime last wrote.
                return Object.prototype.hasOwnProperty.call(state.writeCache, element)
                    ? state.writeCache[element]
                    : '';
            }
            if (!client.isActive()) {
                reportRejected("getValue('" + element + "') rejected: no active SCORM session.");
                return '';
            }
            var pipwerks = deps.getPipwerks();
            var value;
            try {
                value = pipwerks.SCORM.data.get(element);
            } catch (error) {
                deps.error("[exe-scorm12] LMSGetValue for '" + element + "' failed: " + error);
                return '';
            }
            // The wrapper stringifies its internal null; normalize to ''.
            if (value === 'null' || value === 'undefined') {
                value = '';
            }
            var lastError = getLastError();
            if (lastError.code !== 0) {
                reportLmsError('LMSGetValue', element);
                return '';
            }
            return value;
        },

        /**
         * Read an element the LMS is allowed not to implement.
         *
         * SCORM 1.2 makes several elements optional, and a SCO is expected to
         * probe for them; an LMS answering 401 "not implemented" is a normal
         * answer, not a failure, so it is reported as `supported: false`
         * instead of being logged as an error. Every other failure is still
         * reported through the usual path.
         *
         * @param {string} element - cmi element name.
         * @returns {{value: string, supported: boolean, errorCode: number}}
         * The value and whether the LMS implements the element.
         */
        getOptionalValue: function (element) {
            if (!client.isActive()) {
                reportRejected("getValue('" + element + "') rejected: no active SCORM session.");
                return { value: '', supported: false, errorCode: 301 };
            }
            var pipwerks = deps.getPipwerks();
            var value;
            try {
                value = pipwerks.SCORM.data.get(element);
            } catch (error) {
                deps.error("[exe-scorm12] LMSGetValue for '" + element + "' failed: " + error);
                return { value: '', supported: false, errorCode: 101 };
            }
            if (value === 'null' || value === 'undefined') {
                value = '';
            }
            var lastError = getLastError();
            if (lastError.code === 0) {
                return { value: value, supported: true, errorCode: 0 };
            }
            if (lastError.code !== 401) {
                reportLmsError('LMSGetValue', element);
            }
            return { value: '', supported: false, errorCode: lastError.code };
        },

        /**
         * Write a data model element (LMSSetValue) and report the outcome in
         * full. Values are always sent as strings, as SCORM 1.2 requires.
         *
         * Writing a read-only element is error 403 in SCORM 1.2; the call is
         * refused locally instead of being forwarded.
         *
         * @param {string} element - cmi element name.
         * @param {string|number} value - Value to write.
         * @returns {{success: boolean, errorCode: number, errorMessage: string,
         * forwarded: boolean}} Outcome of the write. `forwarded` is false when
         * the runtime refused the call without contacting the LMS.
         */
        setValueDetailed: function (element, value) {
            return writeValueDetailed(element, value, false);
        },

        /**
         * Write an element the SCORM 1.2 data model declares optional
         * (cmi.core.score.min / cmi.core.score.max). Identical to
         * setValueDetailed, except that LMS error 401 ("not implemented") is
         * returned without an error report — an LMS that skips an optional
         * element is conforming, not failing ([CR] §2.1.1.3a). The
         * write-side mirror of getOptionalValue().
         *
         * @param {string} element - cmi element name.
         * @param {string|number} value - Value to write.
         * @returns {{success: boolean, errorCode: number,
         * errorMessage: string, forwarded: boolean}} What happened.
         */
        setOptionalValueDetailed: function (element, value) {
            return writeValueDetailed(element, value, true);
        },

        /**
         * Write a data model element (LMSSetValue).
         *
         * @param {string} element - cmi element name.
         * @param {string|number} value - Value to write.
         * @returns {boolean} True when the LMS accepted the value.
         */
        setValue: function (element, value) {
            return client.setValueDetailed(element, value).success;
        },

        /**
         * @param {string} element - cmi element name.
         * @returns {string} The last value this runtime wrote for the element
         * ('' when it never wrote one). Local cache — no LMS traffic.
         */
        getCachedValue: function (element) {
            return Object.prototype.hasOwnProperty.call(state.writeCache, element) ? state.writeCache[element] : '';
        },

        /**
         * Persist the session data (LMSCommit).
         *
         * @returns {boolean} True when the LMS accepted the commit.
         */
        commit: function () {
            if (!client.isActive()) {
                reportRejected('commit() rejected: no active SCORM session.');
                return false;
            }
            var pipwerks = deps.getPipwerks();
            var success = false;
            try {
                success = pipwerks.SCORM.data.save();
            } catch (error) {
                deps.error('[exe-scorm12] LMSCommit failed: ' + error);
                return false;
            }
            if (!success) {
                reportLmsError('LMSCommit');
            }
            return success;
        },

        /**
         * Close the session: LMSCommit(""), then LMSFinish(""). Attempted at
         * most once for the whole page lifetime: the first call moves the
         * state machine through `finish_attempted` to `finished` or
         * `finish_failed`, and every later call replays the recorded result
         * without touching the LMS. A failed termination therefore stays
         * failed — retrying during page teardown cannot succeed and must not
         * loop — and any attempt, successful or not, clears the wrapper's
         * connection.isActive flag so direct pipwerks consumers see the same
         * closed session the state machine enforces.
         *
         * The two calls are issued separately (not through the wrapper's
         * connection.terminate, which folds both into one boolean), so
         * getFinishReport() can always say whether the commit or the finish
         * failed. SCORM 1.2 requires pending data to be persisted before the
         * session ends ([CR] 6.7); when the commit fails, LMSFinish is
         * deliberately not attempted — finishing anyway would close an
         * attempt whose stored state is unknown.
         *
         * @returns {boolean} True when the LMS acknowledged the termination.
         */
        terminate: function () {
            reconcileExternalTermination();
            if (client.isTerminated()) {
                return state.finishResult === true;
            }
            if (state.status !== STATE.ACTIVE) {
                reportRejected('terminate() rejected: the session was never initialized.');
                return false;
            }
            // Marked before any LMS traffic so a re-entrant termination (a
            // listener fired by the LMS mid-call) cannot start a second one.
            state.status = STATE.FINISH_ATTEMPTED;
            state.terminationSource = 'runtime';
            var steps = { commitAttempted: false, commitSucceeded: false, finishAttempted: false, finishSucceeded: false };
            state.finishSteps = steps;
            var pipwerks = deps.getPipwerks();

            // No-retry policy: after any termination attempt — successful or
            // not — the session is over for this page. The state machine
            // refuses further SCO calls, and the wrapper's connection flag
            // mirrors that so a direct scorm.connection.isActive consumer
            // fails fast instead of writing into a session whose stored
            // state is unknown.
            function closeWrapperConnection() {
                pipwerks.SCORM.connection.isActive = false;
            }

            steps.commitAttempted = true;
            try {
                steps.commitSucceeded = pipwerks.SCORM.data.save() === true;
            } catch (error) {
                state.status = STATE.FINISH_FAILED;
                state.finishResult = false;
                state.finishError = { code: 101, message: String(error) };
                closeWrapperConnection();
                deps.error('[exe-scorm12] LMSCommit failed during termination: ' + error);
                return false;
            }
            if (!steps.commitSucceeded) {
                state.status = STATE.FINISH_FAILED;
                state.finishResult = false;
                state.finishError = reportLmsError('LMSCommit');
                closeWrapperConnection();
                return false;
            }

            // The API handle directly: the adapter layer shims the wrapper's
            // connection.terminate to route legacy callers through the
            // lifecycle, so this layer must not depend on that binding.
            var api = null;
            try {
                api = pipwerks.SCORM.API.getHandle();
            } catch (error) {
                api = null;
            }
            if (!api) {
                state.status = STATE.FINISH_FAILED;
                state.finishResult = false;
                state.finishError = { code: -1, message: 'SCORM API not available' };
                closeWrapperConnection();
                deps.error('[exe-scorm12] LMSFinish failed: SCORM API not available.');
                return false;
            }
            steps.finishAttempted = true;
            var result = null;
            var thrown = null;
            try {
                result = String(api.LMSFinish(''));
            } catch (error) {
                thrown = error;
            }
            if (thrown !== null) {
                state.status = STATE.FINISH_FAILED;
                state.finishResult = false;
                state.finishError = { code: 101, message: String(thrown) };
                closeWrapperConnection();
                deps.error('[exe-scorm12] LMSFinish failed: ' + thrown);
                return false;
            }
            steps.finishSucceeded = result === 'true';
            if (!steps.finishSucceeded) {
                state.status = STATE.FINISH_FAILED;
                state.finishResult = false;
                state.finishError = reportLmsError('LMSFinish');
                closeWrapperConnection();
                return false;
            }
            closeWrapperConnection();
            state.status = STATE.FINISHED;
            state.finishResult = true;
            return true;
        },

        /**
         * Format a duration as a SCORM 1.2 CMITimespan (HHHH:MM:SS.SS).
         * Hours are zero-padded to four digits; the fraction is truncated to
         * hundredths; values beyond the representable maximum clamp to
         * 9999:59:59.99. Negative input is treated as zero.
         *
         * @param {number} milliseconds - Elapsed time in milliseconds.
         * @returns {string} CMITimespan string.
         */
        formatSessionTime: function (milliseconds) {
            var totalMs = typeof milliseconds === 'number' && milliseconds > 0 ? Math.floor(milliseconds) : 0;
            var hours = Math.floor(totalMs / MS_PER_HOUR);
            if (hours > 9999) {
                return MAX_SESSION_TIME;
            }
            var remainder = totalMs - hours * MS_PER_HOUR;
            var minutes = Math.floor(remainder / MS_PER_MINUTE);
            remainder -= minutes * MS_PER_MINUTE;
            var seconds = Math.floor(remainder / MS_PER_SECOND);
            var hundredths = Math.floor((remainder - seconds * MS_PER_SECOND) / 10);
            return (
                zeroPad(hours, 4) + ':' + zeroPad(minutes, 2) + ':' + zeroPad(seconds, 2) + '.' + zeroPad(hundredths, 2)
            );
        },

        /**
         * (Re)start the session clock used for cmi.core.session_time, dropping
         * any time already accumulated. This is the legacy `startTimer()`
         * semantics; pause/resume is what the lifecycle layer uses.
         */
        markSessionStart: function () {
            state.accumulatedMs = 0;
            client.startClock();
        },

        /** Start (or restart) the running segment of the session clock. */
        startClock: function () {
            state.clockStartMs = deps.now();
            state.clockRunning = true;
        },

        /**
         * Bank the running segment and stop the clock. Used when the page is
         * frozen into the back/forward cache: frozen time is not learning
         * time. Idempotent — pausing twice banks the segment once.
         */
        pauseClock: function () {
            if (!state.clockRunning) {
                return;
            }
            state.accumulatedMs += client.currentSegmentMs();
            state.clockRunning = false;
            state.clockStartMs = null;
        },

        /**
         * Resume the clock after a pause. Idempotent — resuming a running
         * clock keeps the current segment instead of restarting it, so
         * repeated lifecycle events cannot double count.
         */
        resumeClock: function () {
            if (state.clockRunning) {
                return;
            }
            client.startClock();
        },

        /** @returns {boolean} True while the session clock is running. */
        isClockRunning: function () {
            return state.clockRunning;
        },

        /** @returns {number} Milliseconds in the current running segment. */
        currentSegmentMs: function () {
            if (!state.clockRunning || state.clockStartMs === null) {
                return 0;
            }
            var elapsed = deps.now() - state.clockStartMs;
            return elapsed > 0 ? elapsed : 0;
        },

        /**
         * @returns {number} Total milliseconds of this session: the banked
         * segments plus the one currently running.
         */
        getElapsedMs: function () {
            return state.accumulatedMs + client.currentSegmentMs();
        },

        /**
         * Write the elapsed session time to cmi.core.session_time.
         *
         * SCORM 1.2 treats cmi.core.session_time as the total duration of the
         * current session, not a delta, so writing it repeatedly (on every
         * visibility change, say) overwrites rather than accumulates — the
         * value can never be double counted.
         *
         * @returns {boolean} True when the LMS accepted the value.
         */
        writeSessionTime: function () {
            return client.setValue('cmi.core.session_time', client.formatSessionTime(client.getElapsedMs()));
        },

        getLastError: getLastError,
        isWriteOnlyElement: isWriteOnly,
        isReadOnlyElement: isReadOnly,
    };

    var exeScorm12 = (global.exeScorm12 = global.exeScorm12 || {});
    exeScorm12.client = client;

    // CommonJS export for the unit tests.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = client;
    }
})(typeof window !== 'undefined' ? window : globalThis);
