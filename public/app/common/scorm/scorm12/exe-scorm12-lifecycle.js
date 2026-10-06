/**
 * eXeLearning SCORM 1.2 runtime — browser lifecycle layer.
 *
 * Owns end-of-session handling for SCORM 1.2 packages, and is the single
 * place that may terminate the session: every legacy entry point
 * (unloadPage, doQuit, doBack, doContinue, scorm.quit, pipwerks.SCORM.quit)
 * funnels through `finish()`.
 *
 * Deliberately uses no unload/onunload/beforeunload handlers. Those events are
 * unreliable on mobile, and registering one makes the page ineligible for the
 * back/forward cache, which would trade a real reliability gain for an
 * imaginary one. The events used instead:
 *
 * - `visibilitychange` to hidden — the last moment guaranteed to run on
 *   mobile. Writes cmi.core.session_time and commits. The session stays open:
 *   the learner may come back to the tab, and SCORM 1.2 has no concept of a
 *   hidden SCO.
 * - `pagehide` with `event.persisted === false` — the page is really going
 *   away. Runs the full end-of-session sequence and terminates.
 * - `pagehide` with `event.persisted === true` — the page is being frozen
 *   into the back/forward cache. It may be restored intact, so the session is
 *   persisted (session time + commit) but **not** terminated; the session
 *   clock is paused because frozen time is not learning time.
 * - `pageshow` with `event.persisted === true` — restored from the cache.
 *   Resumes the clock. Nothing is re-initialized: the LMS session was never
 *   closed.
 *
 * A page frozen into the cache can still be discarded later without firing
 * any further event, so the data written on a persisted `pagehide` is the last
 * word — which is exactly why it commits rather than deferring.
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

    var defaultDeps = {
        getClient: function () {
            return global.exeScorm12 && global.exeScorm12.client;
        },
        getPolicy: function () {
            return global.exeScorm12 && global.exeScorm12.policy;
        },
        getWindow: function () {
            return global;
        },
        getDocument: function () {
            return global.document;
        },
    };

    var deps = defaultDeps;

    function initialState() {
        return {
            installed: false,
            // Set as soon as a finalization starts, so two lifecycle paths
            // racing each other cannot both run the end-of-session sequence.
            finalizing: false,
            finished: false,
            // Recorded outcome of the single finalization.
            report: null,
            // True while the page is frozen in the back/forward cache.
            frozen: false,
        };
    }

    var state = initialState();

    /**
     * Persist the current session without ending it: reconcile the lesson
     * status against the registry, write the activity state and the elapsed
     * session time, then commit. Every step is reported — a caller must be
     * able to tell a full commit from one whose suspend_data write failed.
     *
     * @returns {{activitiesWritten: boolean, sessionTimeWritten: boolean,
     * committed: boolean}} What the LMS accepted.
     */
    function persist() {
        var client = deps.getClient();
        if (state.finalizing || !client.isActive()) {
            return { activitiesWritten: false, sessionTimeWritten: false, committed: false };
        }
        var policy = deps.getPolicy();
        // A required activity may have registered after the last status
        // write: reconcile before committing, so a page killed right after
        // this commit (mobile app switch, bfcache eviction) never leaves the
        // LMS holding a stale terminal verdict alongside a pending registry.
        policy.reconcilePendingActivities();
        // Activity state next: that same killed page must be able to restore
        // its activities, not only its session time.
        var activitiesWritten = policy.persistActivities();
        var sessionTimeWritten = client.writeSessionTime();
        return {
            activitiesWritten: activitiesWritten === true,
            sessionTimeWritten: sessionTimeWritten,
            committed: client.commit(),
        };
    }

    function onPageHide(event) {
        if (event && event.persisted === true) {
            // Frozen into the back/forward cache: persist, do not terminate.
            persist();
            deps.getClient().pauseClock();
            state.frozen = true;
            return;
        }
        lifecycle.finish();
    }

    function onPageShow(event) {
        if (!event || event.persisted !== true) {
            // A normal load also fires pageshow; there is nothing to resume.
            return;
        }
        state.frozen = false;
        // The LMS session was never closed, so nothing is re-initialized.
        deps.getClient().resumeClock();
    }

    function onVisibilityChange() {
        var documentRef = deps.getDocument();
        if (!documentRef || documentRef.visibilityState !== 'hidden') {
            return;
        }
        persist();
    }

    var lifecycle = {
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
            var windowRef = deps.getWindow();
            var documentRef = deps.getDocument();
            if (state.installed && windowRef && windowRef.removeEventListener) {
                windowRef.removeEventListener('pagehide', onPageHide);
                windowRef.removeEventListener('pageshow', onPageShow);
            }
            if (state.installed && documentRef && documentRef.removeEventListener) {
                documentRef.removeEventListener('visibilitychange', onVisibilityChange);
            }
            deps = defaultDeps;
            state = initialState();
        },

        /**
         * Attach the pagehide, pageshow and visibilitychange listeners.
         * Idempotent.
         */
        install: function () {
            if (state.installed) {
                return;
            }
            state.installed = true;
            var windowRef = deps.getWindow();
            windowRef.addEventListener('pagehide', onPageHide);
            windowRef.addEventListener('pageshow', onPageShow);
            var documentRef = deps.getDocument();
            if (documentRef) {
                documentRef.addEventListener('visibilitychange', onVisibilityChange);
            }
        },

        /** @returns {boolean} True once the session end ran. */
        hasFinished: function () {
            return state.finished;
        },

        /** @returns {boolean} True while the page sits in the bfcache. */
        isFrozen: function () {
            return state.frozen;
        },

        /**
         * @returns {{finished: boolean, committed: boolean, terminated: boolean,
         * status: string|null, exit: string|null, state: string}|null} The
         * recorded outcome of the single finalization, or null before one ran.
         */
        getReport: function () {
            return state.report;
        },

        /**
         * Persist the session without ending it (session time + commit).
         * Public so that content can force a save at a meaningful moment.
         *
         * @returns {{written: boolean, committed: boolean}} What the LMS took.
         */
        persist: persist,

        /**
         * End the SCORM session exactly once: apply the exit policy, write
         * cmi.core.session_time, then terminate (the client commits before
         * LMSFinish; a failed commit aborts the termination — LMSFinish is
         * not attempted — and is recorded as a failed termination, never
         * retried).
         *
         * The `finalizing` guard is raised before any LMS traffic, so a second
         * lifecycle path entering while the first is still running — a
         * pagehide firing during doQuit, say — replays the recorded result
         * instead of starting a second termination.
         *
         * @param {boolean} [applyCompletionRule] - Apply the completion rule
         * of the exit policy (default true; doQuit/doBack/doContinue pass
         * false for legacy parity — they never marked pages completed).
         * @returns {boolean} True when the session ended cleanly (or had
         * already ended, or was never active).
         */
        finish: function (applyCompletionRule) {
            if (state.finalizing) {
                return state.report === null ? true : state.report.terminated;
            }
            var client = deps.getClient();
            if (!client.isActive()) {
                if (!client.isInitialized()) {
                    // Nothing has been opened yet: legacy content calling
                    // doQuit() before the body onload handler runs must not
                    // consume the one-shot latch, or the real end of session
                    // would later be silenced.
                    return true;
                }
                state.finalizing = true;
                state.finished = true;
                state.report = {
                    finished: true,
                    committed: false,
                    terminated: true,
                    status: null,
                    exit: null,
                    state: client.getState(),
                    reason: 'no-active-session',
                };
                return true;
            }
            // Raised before any LMS traffic, so a second lifecycle path
            // entering while this one runs replays the recorded result.
            state.finalizing = true;
            var exitResult = deps.getPolicy().applyExitPolicy(applyCompletionRule !== false);
            client.writeSessionTime();
            var terminated = client.terminate();
            var finishReport = client.getFinishReport();
            state.finished = true;
            state.report = {
                finished: true,
                // Commit and finish separately: a failed termination may mean
                // the commit failed and LMSFinish was never attempted.
                committed: finishReport.commitSucceeded,
                terminated: terminated,
                finishAttempted: finishReport.finishAttempted,
                status: exitResult.status,
                exit: exitResult.exit,
                state: client.getState(),
                reason: 'session-ended',
            };
            return terminated;
        },
    };

    var exeScorm12 = (global.exeScorm12 = global.exeScorm12 || {});
    exeScorm12.lifecycle = lifecycle;

    // CommonJS export for the unit tests.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = lifecycle;
    }
})(typeof window !== 'undefined' ? window : globalThis);
