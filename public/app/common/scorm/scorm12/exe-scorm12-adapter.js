/**
 * eXeLearning SCORM 1.2 runtime — legacy globals adapter.
 *
 * The only file in the SCORM 1.2 runtime that creates globals. It defines
 * exactly the public contract recorded in
 * doc/development/scorm12-runtime-contract.md and delegates everything to the
 * client/policy/lifecycle layers:
 *
 * - Page lifecycle globals called by exported pages and legacy content:
 *   loadPage, unloadPage, doQuit, doContinue, doBack, startTimer,
 *   computeTime, goBack, goForward, setComplete, setIncomplete, setScore.
 * - The `scorm` facade object used by iDevices and games.
 * - Additive extension methods on pipwerks.SCORM (verified callers invoke
 *   them on the pipwerks object directly). The vendored wrapper file itself
 *   is never modified.
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

    var exeScorm12 = global.exeScorm12;
    var pipwerks = global.pipwerks;

    if (!exeScorm12 || !exeScorm12.client || !exeScorm12.policy || !exeScorm12.lifecycle || !pipwerks) {
        if (global.console && global.console.error) {
            global.console.error(
                '[exe-scorm12] Runtime layers or the pipwerks wrapper are missing; SCORM tracking is disabled.',
            );
        }
        return;
    }

    var client = exeScorm12.client;
    var policy = exeScorm12.policy;
    var lifecycle = exeScorm12.lifecycle;

    var state = {
        loadPageRan: false,
    };

    function warn(message) {
        if (global.console && global.console.warn) {
            global.console.warn('[exe-scorm12] ' + message);
        }
    }

    /**
     * Reset adapter state (tests only).
     */
    exeScorm12.resetAdapterForTests = function () {
        state.loadPageRan = false;
    };

    /**
     * Record whether the current page contains SCORM score-saving activities.
     * Called by exe_export.js instead of registering an unload handler.
     *
     * @param {boolean} hasScoredActivities - Flag computed from the page's
     * iDevices.
     */
    exeScorm12.setPageHasScoredActivities = function (hasScoredActivities) {
        policy.setHasScoredActivities(hasScoredActivities);
    };

    // ------------------------------------------------------------------ //
    // Page lifecycle globals                                             //
    // ------------------------------------------------------------------ //

    /**
     * Open the SCORM session for this page. Idempotent — the exporter's
     * body onload attribute and exe_export.js may both call it.
     */
    global.loadPage = function () {
        if (state.loadPageRan) {
            return;
        }
        state.loadPageRan = true;
        if (client.initialize()) {
            policy.applyEntryPolicy();
            lifecycle.install();
        }
    };

    /**
     * Legacy end-of-page handler. New packages end the session via the
     * lifecycle layer (pagehide); this global stays callable for previously
     * exported packages and legacy content.
     *
     * @param {boolean} [isSCORM] - True when the page contains score-saving
     * activities (kept incomplete instead of completed on exit).
     */
    global.unloadPage = function (isSCORM) {
        policy.setHasScoredActivities(isSCORM === true);
        lifecycle.finish();
    };

    /** End the session without changing the recorded status. */
    global.doQuit = function () {
        lifecycle.finish(false);
    };

    /** Legacy alias: end the session (previous-SCO navigation). */
    global.doBack = function () {
        lifecycle.finish(false);
    };

    /**
     * Store a status (outside review/browse mode) and end the session.
     *
     * @param {string} status - SCORM 1.2 lesson_status value.
     */
    global.doContinue = function (status) {
        policy.setStatusForContinue(status);
        lifecycle.finish(false);
    };

    /** (Re)start the session-time clock. */
    global.startTimer = function () {
        client.markSessionStart();
    };

    /** Write the elapsed time to cmi.core.session_time. */
    global.computeTime = function () {
        client.writeSessionTime();
    };

    /**
     * Inert compatibility stub. The legacy implementation depended on the
     * non-standard nav.event element and only worked on Moodle 1.9.
     */
    global.goBack = function () {
        warn('goBack() is not supported by the SCORM 1.2 runtime; navigation is handled by the LMS.');
    };

    /** Inert compatibility stub (see goBack). */
    global.goForward = function () {
        warn('goForward() is not supported by the SCORM 1.2 runtime; navigation is handled by the LMS.');
    };

    /** Mark the page completed and commit. */
    global.setComplete = function () {
        policy.setCompleted();
        client.commit();
    };

    /** Mark the page incomplete and commit. */
    global.setIncomplete = function () {
        policy.setIncomplete();
        client.commit();
    };

    /**
     * Write the score and commit. Keeps the legacy fallback argument order.
     *
     * @param {number|string} score - Raw score (0-100).
     * @param {number|string} [maxScore] - Maximum score.
     * @param {number|string} [minScore] - Minimum score.
     */
    global.setScore = function (score, maxScore, minScore) {
        if (policy.setScore(score, minScore, maxScore)) {
            client.commit();
        }
    };

    // ------------------------------------------------------------------ //
    // eXe extension methods (facade + additive pipwerks.SCORM augment)   //
    // ------------------------------------------------------------------ //

    var extensions = {
        /** @returns {boolean} Always true (legacy Flash handshake). */
        isAvailable: function () {
            return true;
        },
        /** @returns {string} cmi._version. */
        GetDataModelVersion: function () {
            return client.getValue('cmi._version');
        },
        /** @returns {string} cmi.core.lesson_status. */
        GetCompletionStatus: function () {
            return client.getValue('cmi.core.lesson_status');
        },
        /**
         * Write cmi.core.lesson_status. Only valid SCORM 1.2 vocabulary is
         * accepted; in particular the SCORM 2004 value "unknown" is rejected
         * instead of being downgraded to "not attempted" (the legacy
         * behavior that erased progress).
         *
         * @param {string} status - lesson_status value.
         */
        SetCompletionStatus: function (status) {
            if (policy.isValidStatus(status)) {
                client.setValue('cmi.core.lesson_status', status);
            } else {
                warn("SetCompletionStatus ignored invalid status '" + status + "'.");
            }
        },
        /**
         * Legacy activity-completion helper (writes lesson_status in 1.2).
         *
         * @param {string} status - lesson_status value.
         */
        SetCompletionScormActivity: function (status) {
            extensions.SetCompletionStatus(status);
        },
        /** @returns {string} cmi.core.exit (write-only in 1.2; LMS-dependent). */
        GetExit: function () {
            return client.getValue('cmi.core.exit');
        },
        /**
         * Write cmi.core.exit ("time-out", "suspend", "logout" or "";
         * the SCORM 2004 value "normal" maps to "").
         *
         * @param {string} exitValue - cmi.core.exit value.
         */
        SetExit: function (exitValue) {
            var value = exitValue === 'normal' ? '' : exitValue;
            if (value === 'time-out' || value === 'suspend' || value === 'logout' || value === '') {
                client.setValue('cmi.core.exit', value);
            } else {
                warn("SetExit ignored invalid exit value '" + exitValue + "'.");
            }
        },
        /**
         * @param {string} key - cmi.interactions element (1.2 notation).
         * @returns {string} The element value.
         */
        GetInteractionValue: function (key) {
            return client.getValue(key);
        },
        /**
         * @param {string} key - cmi.interactions element (1.2 notation).
         * @param {string} value - Value to write.
         */
        SetInteractionValue: function (key, value) {
            client.setValue(key, value);
        },
        /** @returns {string} cmi.core.student_id. */
        GetLearnerId: function () {
            return client.getValue('cmi.core.student_id');
        },
        /** @returns {string} cmi.core.student_name. */
        GetLearnerName: function () {
            return client.getValue('cmi.core.student_name');
        },
        /** @returns {string} cmi.core.lesson_mode. */
        GetMode: function () {
            return client.getValue('cmi.core.lesson_mode');
        },
        /**
         * Legacy mode setter (cmi.core.lesson_mode is read-only in SCORM 1.2;
         * the LMS rejection is reported by the client layer).
         *
         * @param {string} mode - "browse", "normal" or "review".
         */
        SetMode: function (mode) {
            if (mode === 'browse' || mode === 'normal' || mode === 'review') {
                client.setValue('cmi.core.lesson_mode', mode);
            } else {
                warn("SetMode ignored invalid mode '" + mode + "'.");
            }
        },
        /** @returns {string} cmi.core.score.max. */
        GetScoreMax: function () {
            return client.getValue('cmi.core.score.max');
        },
        /** @param {number|string} maxScore - cmi.core.score.max value. */
        SetScoreMax: function (maxScore) {
            client.setValue('cmi.core.score.max', maxScore);
        },
        /** @returns {string} cmi.core.score.min. */
        GetScoreMin: function () {
            return client.getValue('cmi.core.score.min');
        },
        /** @param {number|string} minScore - cmi.core.score.min value. */
        SetScoreMin: function (minScore) {
            client.setValue('cmi.core.score.min', minScore);
        },
        /** @returns {string} cmi.core.score.raw. */
        GetScoreRaw: function () {
            return client.getValue('cmi.core.score.raw');
        },
        /** @param {number|string} score - cmi.core.score.raw value. */
        SetScoreRaw: function (score) {
            client.setValue('cmi.core.score.raw', score);
        },
        /** SCORM 2004 concept; no scaled score exists in 1.2. */
        SetScoreScaled: function () {
            // Intentional no-op (parity with the legacy wrapper in 1.2).
        },
        /** @returns {string} cmi.core.session_time (write-only in 1.2). */
        GetSessionTime: function () {
            return client.getValue('cmi.core.session_time');
        },
        /** @param {string} time - CMITimespan value (HHHH:MM:SS.SS). */
        SetSessionTime: function (time) {
            client.setValue('cmi.core.session_time', time);
        },
        /** @returns {string} cmi.core.lesson_status (single status in 1.2). */
        GetSuccessStatus: function () {
            return client.getValue('cmi.core.lesson_status');
        },
        /**
         * Success/completion separation does not exist in SCORM 1.2;
         * validated no-op for parity with the legacy wrapper (which never
         * wrote success status in 1.2 either).
         *
         * @param {string} status - "passed", "failed" or "unknown".
         */
        SetSuccessStatus: function (status) {
            if (status !== 'passed' && status !== 'failed' && status !== 'unknown') {
                warn("SetSuccessStatus ignored invalid status '" + status + "'.");
            }
        },
    };

    // ------------------------------------------------------------------ //
    // The `scorm` facade object                                          //
    // ------------------------------------------------------------------ //

    var facade = {
        version: '1.2',
        // Same connection object as the wrapper, so scorm.connection.isActive
        // keeps reflecting the real session state.
        connection: pipwerks.SCORM.connection,
        /**
         * Open (or confirm) the SCORM session. Unlike upstream pipwerks,
         * returns true when the session is already active — iDevice
         * bootstrap code gates its SCORM setup on this.
         *
         * @returns {boolean} True when the session is active.
         */
        init: function () {
            return client.initialize();
        },
        /**
         * @param {string} element - cmi element name.
         * @returns {string} The element value ('' on error).
         */
        get: function (element) {
            return client.getValue(element);
        },
        /**
         * @param {string} element - cmi element name.
         * @param {string|number} value - Value to write.
         * @returns {boolean} True when the LMS accepted the value.
         */
        set: function (element, value) {
            return client.setValue(element, value);
        },
        /** @returns {boolean} True when the LMS accepted the commit. */
        save: function () {
            return client.commit();
        },
        /**
         * End the session (exit status + session time + commit + finish)
         * without applying the completion rule (legacy parity). Idempotent.
         *
         * @returns {boolean} True when the session ended (or already had).
         */
        quit: function () {
            return lifecycle.finish(false);
        },
    };

    var name;
    for (name in extensions) {
        facade[name] = extensions[name];
    }

    // Additive augmentation of the vendored wrapper object: verified callers
    // (e.g. geogebra-activity) invoke the extension methods on pipwerks.SCORM
    // directly. Never replaces an existing upstream member.
    for (name in extensions) {
        if (pipwerks.SCORM[name] === undefined) {
            pipwerks.SCORM[name] = extensions[name];
        }
    }

    global.scorm = facade;
})(typeof window !== 'undefined' ? window : globalThis);
