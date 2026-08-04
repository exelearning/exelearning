/**
 * eXeLearning SCORM 1.2 runtime — legacy globals adapter.
 *
 * The only file in the SCORM 1.2 runtime that creates globals. It defines
 * exactly the public contract recorded in
 * doc/development/scorm12-runtime-contract.md and delegates everything to the
 * client/activities/policy/lifecycle layers:
 *
 * - Page lifecycle globals called by exported pages and legacy content:
 *   loadPage, unloadPage, doQuit, doContinue, doBack, startTimer,
 *   computeTime, goBack, goForward, setComplete, setIncomplete, setScore.
 * - The `scorm` facade object used by iDevices and games.
 * - Additive extension methods on pipwerks.SCORM (verified callers invoke
 *   them on the pipwerks object directly). The vendored wrapper file itself
 *   is never modified.
 * - A wrap of the wrapper's own termination entry points, so legacy content
 *   calling pipwerks.SCORM.quit() reaches the central lifecycle instead of
 *   closing the session behind the state machine's back.
 *
 * Compatibility methods fall into four documented kinds, marked per method
 * below and tabulated in the runtime contract:
 *
 *   LMS call        — a legal SCORM 1.2 data model operation.
 *   local cache     — answered from what this runtime last wrote, because the
 *                     element is write-only and reading it would be error 404.
 *   no-op           — the element is read-only, or the concept does not exist
 *                     in SCORM 1.2; the method stays callable and reports.
 *   central         — routed through the lifecycle layer.
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

    if (
        !exeScorm12 ||
        !exeScorm12.client ||
        !exeScorm12.activities ||
        !exeScorm12.policy ||
        !exeScorm12.lifecycle ||
        !pipwerks
    ) {
        if (global.console && global.console.error) {
            global.console.error(
                '[exe-scorm12] Runtime layers or the pipwerks wrapper are missing; SCORM tracking is disabled.',
            );
        }
        return;
    }

    var client = exeScorm12.client;
    var activities = exeScorm12.activities;
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
     * Called by exe_export.js instead of registering an unload handler. This
     * is the fallback completion signal for pages whose iDevices do not
     * register with the activity registry.
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
        if (client.initialize()) {
            // Only a successful initialize consumes the latch: a transient
            // failure (the LMS API not attached yet) must stay retryable —
            // exe_export.js calls loadPage() again after the body onload.
            state.loadPageRan = true;
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

    /** (Re)start the session-time clock, dropping the time already counted. */
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
     * Commits whenever the *required* cmi.core.score.raw was accepted, even
     * when the LMS does not implement the optional bounds — a score the LMS
     * recorded must not be lost because an optional element is missing.
     *
     * @param {number|string} score - Raw score (0-100).
     * @param {number|string} [maxScore] - Maximum score.
     * @param {number|string} [minScore] - Minimum score.
     */
    global.setScore = function (score, maxScore, minScore) {
        if (policy.setScoreDetailed(score, minScore, maxScore).requiredWritten) {
            client.commit();
        }
    };

    // ------------------------------------------------------------------ //
    // eXe extension methods (facade + additive pipwerks.SCORM augment)   //
    // ------------------------------------------------------------------ //

    var extensions = {
        /** no-op — always true (legacy Flash handshake). @returns {boolean} */
        isAvailable: function () {
            return true;
        },
        /** LMS call. @returns {string} cmi._version. */
        GetDataModelVersion: function () {
            return client.getValue('cmi._version');
        },
        /** LMS call. @returns {string} cmi.core.lesson_status. */
        GetCompletionStatus: function () {
            return client.getValue('cmi.core.lesson_status');
        },
        /**
         * LMS call. Write cmi.core.lesson_status.
         *
         * Only values a SCO may write are forwarded: SCORM 1.2 requires the
         * LMS to refuse "not attempted" from a SCO, and the SCORM 2004 value
         * "unknown" is not 1.2 vocabulary at all (the legacy runtime mapped it
         * to "not attempted", which erased progress).
         *
         * Routed through the policy's content entry point so the write also
         * releases the policy's session claim — a status content set through
         * this method is content's verdict and is never downgraded by the
         * late-registration correction.
         *
         * @param {string} status - lesson_status value.
         */
        SetCompletionStatus: function (status) {
            if (policy.isWritableStatus(status)) {
                policy.setContentStatus(status);
            } else {
                warn("SetCompletionStatus ignored status '" + status + "' (not writable by a SCO in SCORM 1.2).");
            }
        },
        /**
         * LMS call. Legacy activity-completion helper (writes lesson_status
         * in 1.2).
         *
         * @param {string} status - lesson_status value.
         */
        SetCompletionScormActivity: function (status) {
            extensions.SetCompletionStatus(status);
        },
        /**
         * local cache — cmi.core.exit is write-only in SCORM 1.2, so reading
         * it from the LMS would be error 404. Returns what this runtime last
         * wrote ('' when it never wrote one).
         *
         * @returns {string} The cached cmi.core.exit value.
         */
        GetExit: function () {
            return client.getCachedValue('cmi.core.exit');
        },
        /**
         * LMS call. Write cmi.core.exit ("time-out", "suspend", "logout" or
         * ""; the SCORM 2004 value "normal" maps to "").
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
         * local cache for interaction leaves — every cmi.interactions.n.*
         * element is write-only in SCORM 1.2 (reading one is error 404), so
         * the value comes from this runtime's write cache. The readable
         * keywords (cmi.interactions._count / ._children) still reach the LMS.
         *
         * @param {string} key - cmi.interactions element (1.2 notation).
         * @returns {string} The element value.
         */
        GetInteractionValue: function (key) {
            return client.getValue(key);
        },
        /**
         * LMS call.
         *
         * @param {string} key - cmi.interactions element (1.2 notation).
         * @param {string} value - Value to write.
         */
        SetInteractionValue: function (key, value) {
            client.setValue(key, value);
        },
        /** LMS call. @returns {string} cmi.core.student_id. */
        GetLearnerId: function () {
            return client.getValue('cmi.core.student_id');
        },
        /** LMS call. @returns {string} cmi.core.student_name. */
        GetLearnerName: function () {
            return client.getValue('cmi.core.student_name');
        },
        /**
         * LMS call. cmi.core.lesson_mode is optional in SCORM 1.2; a SCO must
         * assume "normal" when the LMS does not implement it.
         *
         * @returns {string} cmi.core.lesson_mode.
         */
        GetMode: function () {
            var read = client.getOptionalValue('cmi.core.lesson_mode');
            return read.supported && read.value !== '' ? read.value : 'normal';
        },
        /**
         * no-op — cmi.core.lesson_mode is read-only in SCORM 1.2, so the
         * legacy setter can only ever have produced error 403. The method
         * stays callable and reports instead of issuing an invalid call.
         *
         * @param {string} mode - "browse", "normal" or "review".
         */
        SetMode: function (mode) {
            warn(
                "SetMode('" +
                    mode +
                    "') is a no-op: cmi.core.lesson_mode is read-only in SCORM 1.2 and is set by the LMS.",
            );
        },
        /**
         * LMS call. cmi.core.score.max is optional in SCORM 1.2.
         *
         * @returns {string} cmi.core.score.max ('' when unsupported).
         */
        GetScoreMax: function () {
            return client.getOptionalValue('cmi.core.score.max').value;
        },
        /**
         * LMS call. @param {number|string} maxScore - cmi.core.score.max value.
         * @returns {boolean} True when the LMS accepted it (false also means
         * "optional element not implemented", which is not an error).
         */
        SetScoreMax: function (maxScore) {
            return client.setValue('cmi.core.score.max', maxScore);
        },
        /**
         * LMS call. cmi.core.score.min is optional in SCORM 1.2.
         *
         * @returns {string} cmi.core.score.min ('' when unsupported).
         */
        GetScoreMin: function () {
            return client.getOptionalValue('cmi.core.score.min').value;
        },
        /**
         * LMS call. @param {number|string} minScore - cmi.core.score.min value.
         * @returns {boolean} True when the LMS accepted it.
         */
        SetScoreMin: function (minScore) {
            return client.setValue('cmi.core.score.min', minScore);
        },
        /** LMS call. @returns {string} cmi.core.score.raw. */
        GetScoreRaw: function () {
            return client.getValue('cmi.core.score.raw');
        },
        /**
         * LMS call. @param {number|string} score - cmi.core.score.raw value.
         * @returns {boolean} True when the LMS accepted it.
         */
        SetScoreRaw: function (score) {
            return client.setValue('cmi.core.score.raw', score);
        },
        /** no-op — SCORM 2004 concept; no scaled score exists in 1.2. */
        SetScoreScaled: function () {
            // Intentional no-op (parity with the legacy wrapper in 1.2).
        },
        /**
         * local cache — cmi.core.session_time is write-only in SCORM 1.2, so
         * reading it from the LMS would be error 404.
         *
         * @returns {string} The cached cmi.core.session_time value.
         */
        GetSessionTime: function () {
            return client.getCachedValue('cmi.core.session_time');
        },
        /** LMS call. @param {string} time - CMITimespan value (HHHH:MM:SS.SS). */
        SetSessionTime: function (time) {
            client.setValue('cmi.core.session_time', time);
        },
        /** LMS call. @returns {string} cmi.core.lesson_status (single status in 1.2). */
        GetSuccessStatus: function () {
            return client.getValue('cmi.core.lesson_status');
        },
        /**
         * no-op — success/completion separation does not exist in SCORM 1.2,
         * where cmi.core.lesson_status is the single status element. Parity
         * with the legacy wrapper, which never wrote a success status in 1.2
         * either. Use SetCompletionStatus('passed'|'failed') to record success.
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
            if (element === 'cmi.core.lesson_status') {
                // Content writing the status through the generic facade is
                // still content writing a status: validate the SCO-writable
                // vocabulary locally (forwarding "not attempted" would be an
                // invalid LMS call) and release the policy's session claim,
                // exactly like SetCompletionStatus().
                return policy.setContentStatus(value);
            }
            return client.setValue(element, value);
        },
        /** @returns {boolean} True when the LMS accepted the commit. */
        save: function () {
            return client.commit();
        },
        /**
         * central — end the session through the lifecycle layer (exit status
         * + session time + commit + finish) without applying the completion
         * rule (legacy parity). Idempotent.
         *
         * @returns {boolean} True when the session ended (or already had).
         */
        quit: function () {
            return lifecycle.finish(false);
        },
        /** The activity registry, so iDevices can report completion. */
        activities: activities,
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

    // Centralize termination: legacy content that calls the wrapper's own
    // quit()/connection.terminate() must go through the lifecycle layer, so
    // the session is finalized once and the state machine stays coherent.
    // The client layer never uses this binding (it commits and finishes
    // through the API handle directly), and the vendored file itself is never
    // modified — only this runtime object binding is. The original
    // implementation is kept on the shim for diagnostics; if the runtime is
    // ever evaluated twice, the tag is carried over instead of pointing at
    // the first shim.
    var existingTerminate = pipwerks.SCORM.connection.terminate;
    var centralizedTerminate = function () {
        return lifecycle.finish(false);
    };
    centralizedTerminate.exeScorm12Native = (existingTerminate && existingTerminate.exeScorm12Native) || existingTerminate;
    pipwerks.SCORM.connection.terminate = centralizedTerminate;
    pipwerks.SCORM.quit = centralizedTerminate;

    global.scorm = facade;
})(typeof window !== 'undefined' ? window : globalThis);
