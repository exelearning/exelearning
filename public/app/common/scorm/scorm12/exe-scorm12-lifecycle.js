/**
 * eXeLearning SCORM 1.2 runtime — browser lifecycle layer.
 *
 * Owns end-of-session handling for SCORM 1.2 packages. Deliberately uses no
 * unload/onunload/beforeunload handlers (unreliable, and they break
 * back/forward cache):
 *
 * - pagehide: end the session once (exit policy + session time + commit +
 *   LMSFinish). This is the safety net; controlled navigation and explicit
 *   activity completion remain the primary persistence path.
 * - visibilitychange to hidden: LMSCommit only. The session stays usable —
 *   the learner may come back to the tab.
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

    var state = {
        installed: false,
        finished: false,
    };

    function onPageHide() {
        lifecycle.finish();
    }

    function onVisibilityChange() {
        var documentRef = deps.getDocument();
        if (!documentRef || documentRef.visibilityState !== 'hidden') {
            return;
        }
        var client = deps.getClient();
        if (!state.finished && client.isActive()) {
            client.commit();
        }
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
            }
            if (state.installed && documentRef && documentRef.removeEventListener) {
                documentRef.removeEventListener('visibilitychange', onVisibilityChange);
            }
            deps = defaultDeps;
            state.installed = false;
            state.finished = false;
        },

        /**
         * Attach the pagehide and visibilitychange listeners. Idempotent.
         */
        install: function () {
            if (state.installed) {
                return;
            }
            state.installed = true;
            deps.getWindow().addEventListener('pagehide', onPageHide);
            var documentRef = deps.getDocument();
            if (documentRef) {
                documentRef.addEventListener('visibilitychange', onVisibilityChange);
            }
        },

        /** @returns {boolean} True once the session end ran. */
        hasFinished: function () {
            return state.finished;
        },

        /**
         * End the SCORM session exactly once: apply the exit policy, write
         * cmi.core.session_time, then terminate (the client commits before
         * LMSFinish). Later calls are no-ops.
         *
         * @param {boolean} [applyCompletionRule] - Apply the completion rule
         * of the exit policy (default true; doQuit/doBack/doContinue pass
         * false for legacy parity — they never marked pages completed).
         * @returns {boolean} True when the session ended cleanly (or had
         * already ended, or was never active).
         */
        finish: function (applyCompletionRule) {
            if (state.finished) {
                return true;
            }
            state.finished = true;
            var client = deps.getClient();
            if (!client.isActive()) {
                return true;
            }
            deps.getPolicy().applyExitPolicy(applyCompletionRule !== false);
            client.writeSessionTime();
            return client.terminate();
        },
    };

    var exeScorm12 = (global.exeScorm12 = global.exeScorm12 || {});
    exeScorm12.lifecycle = lifecycle;

    // CommonJS export for the unit tests.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = lifecycle;
    }
})(typeof window !== 'undefined' ? window : globalThis);
