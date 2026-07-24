/**
 * eXeLearning SCORM 1.2 runtime — completion policy layer.
 *
 * eXeLearning-specific status and score policy for SCORM 1.2 packages, on top
 * of the client layer (exe-scorm12-client.js). SCORM 1.2 only:
 * cmi.core.lesson_status is the single status element — there is no
 * completion/success separation in this layer.
 *
 * Policy (see doc/development/scorm12-runtime-contract.md and ADR-0001):
 * - Entry: an empty or "not attempted" status becomes "incomplete";
 *   any other stored status is preserved — a status is never downgraded.
 * - Exit: when the page recorded no terminal status ("completed", "passed",
 *   "failed"), a page without scored activities is marked "completed" by
 *   viewing it, a page with scored activities is marked "incomplete".
 *   cmi.core.exit is "suspend" while the attempt is resumable and "" once a
 *   terminal status is recorded.
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

    var LESSON_STATUS = 'cmi.core.lesson_status';
    var LESSON_MODE = 'cmi.core.lesson_mode';
    var EXIT = 'cmi.core.exit';

    // SCORM 1.2 cmi.core.lesson_status vocabulary.
    var STATUS = {
        PASSED: 'passed',
        COMPLETED: 'completed',
        FAILED: 'failed',
        INCOMPLETE: 'incomplete',
        BROWSED: 'browsed',
        NOT_ATTEMPTED: 'not attempted',
    };
    var VALID_STATUSES = [
        STATUS.PASSED,
        STATUS.COMPLETED,
        STATUS.FAILED,
        STATUS.INCOMPLETE,
        STATUS.BROWSED,
        STATUS.NOT_ATTEMPTED,
    ];
    // Statuses that end the attempt: never overwritten by this policy.
    var TERMINAL_STATUSES = [STATUS.PASSED, STATUS.COMPLETED, STATUS.FAILED];

    var defaultDeps = {
        getClient: function () {
            return global.exeScorm12 && global.exeScorm12.client;
        },
        warn: function (message) {
            if (global.console && global.console.warn) {
                global.console.warn(message);
            }
        },
    };

    var deps = defaultDeps;

    var state = {
        hasScoredActivities: false,
    };

    /**
     * Coerce a score input to a finite number, accepting numeric strings.
     *
     * @param {number|string} value - Raw input.
     * @returns {number|null} Finite number, or null when not numeric.
     */
    function toFiniteNumber(value) {
        if (typeof value === 'number' && isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim() !== '') {
            var parsed = Number(value);
            return isFinite(parsed) ? parsed : null;
        }
        return null;
    }

    /**
     * Write a validated status value to cmi.core.lesson_status.
     *
     * @param {string} status - A valid SCORM 1.2 lesson_status value.
     * @returns {boolean} True when the LMS accepted the value.
     */
    function writeStatus(status) {
        return deps.getClient().setValue(LESSON_STATUS, status);
    }

    var policy = {
        STATUS: STATUS,

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

        /** Restore default dependencies and reset state (tests only). */
        resetDependencies: function () {
            deps = defaultDeps;
            state.hasScoredActivities = false;
        },

        /**
         * @param {string} status - Candidate status value.
         * @returns {boolean} True when status is valid SCORM 1.2 vocabulary.
         */
        isValidStatus: function (status) {
            return VALID_STATUSES.indexOf(status) !== -1;
        },

        /**
         * @param {string} status - Status value.
         * @returns {boolean} True when the status ends the attempt.
         */
        isTerminalStatus: function (status) {
            return TERMINAL_STATUSES.indexOf(status) !== -1;
        },

        /**
         * Entry policy, applied once after LMSInitialize: promote an empty or
         * "not attempted" status to "incomplete" (the learner is attempting
         * the SCO now); preserve every other stored status.
         */
        applyEntryPolicy: function () {
            var status = deps.getClient().getValue(LESSON_STATUS);
            if (status === '' || status === STATUS.NOT_ATTEMPTED) {
                writeStatus(STATUS.INCOMPLETE);
            }
        },

        /**
         * Record whether the current page contains activities that save a
         * SCORM score. Drives the exit completion policy.
         *
         * @param {boolean} hasScoredActivities - True when at least one
         * activity on the page reports SCORM score saving.
         */
        setHasScoredActivities: function (hasScoredActivities) {
            state.hasScoredActivities = hasScoredActivities === true;
        },

        /** @returns {boolean} Current scored-activities flag (tests). */
        getHasScoredActivities: function () {
            return state.hasScoredActivities;
        },

        /**
         * Exit policy, applied once when the session ends.
         *
         * With the completion rule (unloadPage and the pagehide safety net —
         * the legacy unload sites): when no terminal status was recorded, a
         * page without scored activities is marked "completed" by viewing
         * it and a page with scored activities stays "incomplete". Without
         * it (doQuit/doBack/doContinue/scorm.quit — legacy parity), the
         * stored status is left untouched.
         *
         * In both cases cmi.core.exit is then set to "" (normal end) for a
         * terminal status or "suspend" (resumable attempt) otherwise.
         *
         * @param {boolean} [applyCompletionRule] - Apply the completion rule
         * (default true).
         */
        applyExitPolicy: function (applyCompletionRule) {
            var client = deps.getClient();
            var status = client.getValue(LESSON_STATUS);
            if (applyCompletionRule !== false && !policy.isTerminalStatus(status)) {
                status = state.hasScoredActivities ? STATUS.INCOMPLETE : STATUS.COMPLETED;
                writeStatus(status);
            }
            client.setValue(EXIT, policy.isTerminalStatus(status) ? '' : 'suspend');
        },

        /**
         * Legacy doContinue(status) semantics: outside review/browse mode,
         * store the given status when it is valid SCORM 1.2 vocabulary.
         *
         * @param {string} status - Requested lesson_status value.
         * @returns {boolean} True when a status was written.
         */
        setStatusForContinue: function (status) {
            var client = deps.getClient();
            var mode = client.getValue(LESSON_MODE);
            if (mode === 'review' || mode === 'browse') {
                return false;
            }
            if (!policy.isValidStatus(status)) {
                deps.warn("[exe-scorm12] Ignored invalid lesson_status value '" + status + "'.");
                return false;
            }
            return writeStatus(status);
        },

        /** @returns {boolean} True when the LMS accepted the value. */
        setCompleted: function () {
            return writeStatus(STATUS.COMPLETED);
        },

        /** @returns {boolean} True when the LMS accepted the value. */
        setIncomplete: function () {
            return writeStatus(STATUS.INCOMPLETE);
        },

        /** @returns {boolean} True when the LMS accepted the value. */
        setPassed: function () {
            return writeStatus(STATUS.PASSED);
        },

        /** @returns {boolean} True when the LMS accepted the value. */
        setFailed: function () {
            return writeStatus(STATUS.FAILED);
        },

        /**
         * Write the score to cmi.core.score.raw (and .min/.max when given) as
         * strings. SCORM 1.2 constrains raw/min/max to the 0-100 CMIDecimal
         * range; invalid or inconsistent input is rejected and nothing is
         * written.
         *
         * @param {number|string} raw - Raw score, 0-100.
         * @param {number|string} [min] - Minimum score, 0-100.
         * @param {number|string} [max] - Maximum score, 0-100.
         * @returns {boolean} True when every provided element was accepted.
         */
        setScore: function (raw, min, max) {
            var client = deps.getClient();
            var rawNumber = toFiniteNumber(raw);
            var minNumber = min === undefined || min === null ? null : toFiniteNumber(min);
            var maxNumber = max === undefined || max === null ? null : toFiniteNumber(max);
            var rejected =
                rawNumber === null ||
                rawNumber < 0 ||
                rawNumber > 100 ||
                (min !== undefined && min !== null && minNumber === null) ||
                (max !== undefined && max !== null && maxNumber === null) ||
                (minNumber !== null && (minNumber < 0 || minNumber > 100 || minNumber > rawNumber)) ||
                (maxNumber !== null && (maxNumber < 0 || maxNumber > 100 || maxNumber < rawNumber)) ||
                (minNumber !== null && maxNumber !== null && minNumber > maxNumber);
            if (rejected) {
                deps.warn('[exe-scorm12] Ignored invalid score (raw/min/max must be numbers within 0-100).');
                return false;
            }
            var success = client.setValue('cmi.core.score.raw', String(rawNumber));
            if (minNumber !== null) {
                success = client.setValue('cmi.core.score.min', String(minNumber)) && success;
            }
            if (maxNumber !== null) {
                success = client.setValue('cmi.core.score.max', String(maxNumber)) && success;
            }
            return success;
        },
    };

    var exeScorm12 = (global.exeScorm12 = global.exeScorm12 || {});
    exeScorm12.policy = policy;

    // CommonJS export for the unit tests.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = policy;
    }
})(typeof window !== 'undefined' ? window : globalThis);
