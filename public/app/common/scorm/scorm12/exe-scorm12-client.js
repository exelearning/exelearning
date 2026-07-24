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
 * - Idempotent termination: repeated finish calls are no-ops and any call
 *   after termination is rejected locally, never forwarded to the LMS.
 * - cmi.core.session_time formatting (CMITimespan, HHHH:MM:SS.SS).
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

    var state = {
        initialized: false,
        terminated: false,
        sessionStartMs: null,
    };

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
     */
    function reportLmsError(operation, element) {
        var lastError = getLastError();
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
    }

    /**
     * Report a client-level rejection (no LMS traffic happened).
     *
     * @param {string} message - Reason for the rejection.
     */
    function reportRejected(message) {
        deps.warn('[exe-scorm12] ' + message);
    }

    var client = {
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
            state.initialized = false;
            state.terminated = false;
            state.sessionStartMs = null;
        },

        /**
         * Open the SCORM 1.2 session. Idempotent: once initialized, further
         * calls return true without touching the LMS. Pins the wrapper to
         * SCORM 1.2 and disables its automatic status/exit handling before
         * the first API discovery, so all policy lives in the project layers.
         *
         * @returns {boolean} True when the session is (already) active.
         */
        initialize: function () {
            if (state.terminated) {
                reportRejected('initialize() rejected: the session was already terminated.');
                return false;
            }
            if (state.initialized) {
                return true;
            }
            var pipwerks = deps.getPipwerks();
            if (!pipwerks || !pipwerks.SCORM) {
                reportRejected('initialize() failed: the pipwerks SCORM wrapper is not loaded.');
                return false;
            }
            pipwerks.SCORM.version = '1.2';
            pipwerks.SCORM.handleCompletionStatus = false;
            pipwerks.SCORM.handleExitMode = false;
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
            state.initialized = true;
            state.sessionStartMs = deps.now();
            return true;
        },

        /**
         * @returns {boolean} True while the session is open (initialized and
         * not terminated).
         */
        isActive: function () {
            return state.initialized && !state.terminated;
        },

        /** @returns {boolean} True once initialize() succeeded. */
        isInitialized: function () {
            return state.initialized;
        },

        /** @returns {boolean} True once terminate() ran. */
        isTerminated: function () {
            return state.terminated;
        },

        /**
         * Read a data model element (LMSGetValue).
         *
         * @param {string} element - cmi element name.
         * @returns {string} The element value, or '' on error (reported).
         */
        getValue: function (element) {
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
         * Write a data model element (LMSSetValue). Values are always sent
         * as strings, as SCORM 1.2 requires.
         *
         * @param {string} element - cmi element name.
         * @param {string|number} value - Value to write.
         * @returns {boolean} True when the LMS accepted the value.
         */
        setValue: function (element, value) {
            if (!client.isActive()) {
                reportRejected("setValue('" + element + "') rejected: no active SCORM session.");
                return false;
            }
            var pipwerks = deps.getPipwerks();
            var success = false;
            try {
                success = pipwerks.SCORM.data.set(element, String(value));
            } catch (error) {
                deps.error("[exe-scorm12] LMSSetValue for '" + element + "' failed: " + error);
                return false;
            }
            if (!success) {
                reportLmsError('LMSSetValue', element);
            }
            return success;
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
         * Close the session (LMSFinish). Idempotent: the first call ends the
         * session — success or not — and every later call is a no-op that
         * returns true. The wrapper commits (LMSCommit) before LMSFinish, so
         * terminating always persists pending data first.
         *
         * @returns {boolean} True when the session ended (or already had).
         */
        terminate: function () {
            if (state.terminated) {
                return true;
            }
            if (!state.initialized) {
                reportRejected('terminate() rejected: the session was never initialized.');
                return false;
            }
            var pipwerks = deps.getPipwerks();
            var success = false;
            var failure = null;
            try {
                success = pipwerks.SCORM.connection.terminate();
            } catch (error) {
                failure = error;
            }
            // Mark the session closed even when LMSFinish failed: retrying
            // during page teardown cannot succeed and must not loop.
            state.terminated = true;
            if (failure !== null) {
                deps.error('[exe-scorm12] LMSFinish failed: ' + failure);
            } else if (!success) {
                reportLmsError('LMSFinish');
            }
            return success;
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

        /** (Re)start the session clock used for cmi.core.session_time. */
        markSessionStart: function () {
            state.sessionStartMs = deps.now();
        },

        /**
         * @returns {number} Milliseconds elapsed since the session clock
         * started (0 when it never started).
         */
        getElapsedMs: function () {
            if (state.sessionStartMs === null) {
                return 0;
            }
            var elapsed = deps.now() - state.sessionStartMs;
            return elapsed > 0 ? elapsed : 0;
        },

        /**
         * Write the elapsed session time to cmi.core.session_time.
         *
         * @returns {boolean} True when the LMS accepted the value.
         */
        writeSessionTime: function () {
            return client.setValue('cmi.core.session_time', client.formatSessionTime(client.getElapsedMs()));
        },

        getLastError: getLastError,
    };

    var exeScorm12 = (global.exeScorm12 = global.exeScorm12 || {});
    exeScorm12.client = client;

    // CommonJS export for the unit tests.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = client;
    }
})(typeof window !== 'undefined' ? window : globalThis);
