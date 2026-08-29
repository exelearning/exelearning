/**
 * eXeLearning SCORM 1.2 runtime — completion policy layer.
 *
 * Turns the activity registry's summary (exe-scorm12-activities.js) into
 * SCORM 1.2 data model writes through the client layer
 * (exe-scorm12-client.js). SCORM 1.2 has a single status element,
 * cmi.core.lesson_status, so this layer is where eXeLearning's separate
 * notions of *completion* and *success* collapse onto one vocabulary.
 *
 * Which rules come from where:
 *
 * - SCORM 1.2 requirement: the lesson_status vocabulary; the LMS refuses
 *   "not attempted" from a SCO ([CR] 1.6.5); cmi.core.score.raw is mandatory
 *   while .min/.max are optional ([CR] §2.1.1.3a); cmi.core.exit is
 *   "suspend" for a resumable attempt.
 * - eXeLearning policy: an empty/"not attempted" status becomes "incomplete"
 *   on entry; a page with no required evaluable activity is "completed" by
 *   being viewed; the success threshold and its default; presentation-only
 *   activities never block completion; scores are validated to 0-100 before
 *   being sent.
 *
 * Both are spelled out in doc/development/scorm12-runtime-contract.md.
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
    var MASTERY_SCORE = 'cmi.student_data.mastery_score';
    var EXIT = 'cmi.core.exit';
    var SCORE_RAW = 'cmi.core.score.raw';
    var SCORE_MIN = 'cmi.core.score.min';
    var SCORE_MAX = 'cmi.core.score.max';
    var SUSPEND_DATA = 'cmi.suspend_data';

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
    /**
     * The subset a SCO may write. "not attempted" is LMS-only: SCORM 1.2
     * requires the LMS to reject it from a SCO, so sending it would be an
     * invalid call, not a downgrade.
     */
    var WRITABLE_STATUSES = [
        STATUS.PASSED,
        STATUS.COMPLETED,
        STATUS.FAILED,
        STATUS.INCOMPLETE,
        STATUS.BROWSED,
    ];
    // Statuses that end the attempt: never overwritten by this policy.
    var TERMINAL_STATUSES = [STATUS.PASSED, STATUS.COMPLETED, STATUS.FAILED];

    /**
     * eXeLearning default success threshold, as a percentage of the aggregate
     * score. Used when the LMS publishes no cmi.student_data.mastery_score.
     * Matches the threshold eXeLearning game iDevices have always applied.
     */
    var DEFAULT_SUCCESS_THRESHOLD = 50;

    var defaultDeps = {
        getClient: function () {
            return global.exeScorm12 && global.exeScorm12.client;
        },
        getActivities: function () {
            return global.exeScorm12 && global.exeScorm12.activities;
        },
        warn: function (message) {
            if (global.console && global.console.warn) {
                global.console.warn(message);
            }
        },
    };

    var deps = defaultDeps;

    function initialState() {
        return {
            // Fallback signal for pages whose iDevices do not register with
            // the activity registry (previously the only completion input).
            pageHasScoredActivities: false,
            successThreshold: DEFAULT_SUCCESS_THRESHOLD,
            thresholdResolved: false,
            // Last status this policy itself wrote during this session. A
            // terminal status the policy owns may be corrected when a
            // required activity registers late; one restored from a previous
            // attempt or written explicitly by content never is.
            policySessionStatus: null,
            // True after applyEntryPolicy() has restored suspend_data. Game
            // iDevices register on jQuery ready, which is before loadPage().
            entryApplied: false,
            // Last score bounds this session actually sent, so an unchanged
            // pair is not re-sent on every score update. The legacy runtime
            // writes them once and then only touches score.raw; matching that
            // keeps the wire traffic identical instead of merely equivalent.
            sentBounds: { 'cmi.core.score.min': null, 'cmi.core.score.max': null },
        };
    }

    var state = initialState();

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
     * @param {string} status - A SCO-writable SCORM 1.2 lesson_status value.
     * @returns {boolean} True when the LMS accepted the value.
     */
    function writeStatus(status) {
        return deps.getClient().setValue(LESSON_STATUS, status);
    }

    /**
     * Write a lesson_status on behalf of content (the explicit setters and
     * doContinue). Content's verdict belongs to content, not to the policy:
     * the session claim is cleared even when the value repeats what the
     * policy last wrote, so the late-registration correction can never
     * downgrade a status content set explicitly.
     *
     * @param {string} status - A SCO-writable SCORM 1.2 lesson_status value.
     * @returns {boolean} True when the LMS accepted the value.
     */
    function writeContentStatus(status) {
        var written = writeStatus(status);
        if (written) {
            state.policySessionStatus = null;
        }
        return written;
    }

    /**
     * Aggregate the registry, falling back to the page-level scored-activities
     * flag when no iDevice registered.
     *
     * @returns {{hasRequired: boolean, allRequiredComplete: boolean,
     * score: number|null, source: string}} The completion inputs.
     */
    function completionInputs() {
        var activities = deps.getActivities();
        var summary = activities ? activities.summary() : null;
        if (summary && summary.total > 0) {
            // The page scan said there are scored iDevices, but none of them
            // have registered as required yet (presentation inits first).
            if (state.pageHasScoredActivities && !summary.hasRequired) {
                return {
                    hasRequired: true,
                    allRequiredComplete: false,
                    score: summary.score,
                    source: 'page-flag-pending-registry',
                };
            }
            return {
                hasRequired: summary.hasRequired,
                allRequiredComplete: summary.allRequiredComplete,
                score: summary.score,
                source: 'registry',
            };
        }
        if (!activities) {
            // No registry layer at all. Tolerated, not shipped: eXeLearning's
            // exports and the Moodle plugin both carry all five layers, but a
            // host that assembles the runtime without this one must still get a
            // working runtime. There NOTHING will ever report progress — so the
            // page-flag branch below would pin such a page to `incomplete` for
            // the rest of time. Completion is simply not that host's business:
            // report no required activities and let the status be decided
            // without them.
            return {
                hasRequired: false,
                allRequiredComplete: true,
                score: null,
                source: 'no-registry',
            };
        }
        return {
            hasRequired: state.pageHasScoredActivities,
            // The registry exists but is empty: registration is still pending, so
            // a scored page cannot be complete YET. Unlike the branch above, this
            // one resolves as soon as an activity registers.
            allRequiredComplete: !state.pageHasScoredActivities,
            score: null,
            source: 'page-flag',
        };
    }

    var policy = {
        STATUS: STATUS,
        DEFAULT_SUCCESS_THRESHOLD: DEFAULT_SUCCESS_THRESHOLD,

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
            state = initialState();
        },

        /**
         * @param {string} status - Candidate status value.
         * @returns {boolean} True when status is valid SCORM 1.2 vocabulary.
         */
        isValidStatus: function (status) {
            return VALID_STATUSES.indexOf(status) !== -1;
        },

        /**
         * @param {string} status - Candidate status value.
         * @returns {boolean} True when a SCO is allowed to write the value.
         */
        isWritableStatus: function (status) {
            return WRITABLE_STATUSES.indexOf(status) !== -1;
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
         * the SCO now); preserve every other stored status. Restores the
         * activity registry from cmi.suspend_data and adopts the LMS mastery
         * score as the success threshold when the LMS publishes one.
         *
         * Idempotent: the entry decision is taken once per session. A second
         * call — a host that opened the session and the SCO's own loadPage()
         * both go through session.open() — reads and writes nothing, and never
         * merges the stored records back over progress the learner has made
         * since. Without an open session nothing is read, so nothing is
         * applied and the next call after the session opens still runs it.
         */
        applyEntryPolicy: function () {
            if (state.entryApplied) {
                return;
            }
            var client = deps.getClient();
            if (!client.isActive()) {
                return;
            }
            var status = client.getValue(LESSON_STATUS);
            if (status === '' || status === STATUS.NOT_ATTEMPTED) {
                writeStatus(STATUS.INCOMPLETE);
            }
            policy.resolveSuccessThreshold();
            var activities = deps.getActivities();
            if (activities) {
                activities.load(client.getValue(SUSPEND_DATA));
            }
            state.entryApplied = true;
            var summary = activities ? activities.summary() : null;
            // `summary.scored`, not `summary.score !== null`: the aggregate maps an
            // unanswered evaluable activity to 0, so testing the aggregate publishes a
            // zero for a page the learner has merely opened. Only republish a score the
            // registry can actually account for — which, on entry, means one restored
            // from cmi.suspend_data. `scored` is the registry's single owner of that
            // question and common.js reads the same field.
            if (summary && summary.score !== null && summary.scored > 0) {
                policy.setScoreDetailed(summary.score, 0, 100);
            }
        },

        /**
         * @returns {boolean} True after applyEntryPolicy() restored suspend_data.
         */
        hasAppliedEntry: function () {
            return state.entryApplied === true;
        },

        /**
         * Adopt cmi.student_data.mastery_score as the success threshold when
         * the LMS publishes one. The element is optional in SCORM 1.2, so a
         * minimal LMS answering "not implemented" simply leaves the
         * eXeLearning default in place — that is not an error.
         *
         * @returns {number|null} The threshold now in force.
         */
        resolveSuccessThreshold: function () {
            state.thresholdResolved = true;
            var mastery = toFiniteNumber(deps.getClient().getOptionalValue(MASTERY_SCORE).value);
            if (mastery !== null && mastery >= 0 && mastery <= 100) {
                state.successThreshold = mastery;
            }
            return state.successThreshold;
        },

        /**
         * Override the success threshold.
         *
         * @param {number|null} threshold - Percentage in 0-100, or null to
         * drop the pass/fail distinction (completion only).
         */
        setSuccessThreshold: function (threshold) {
            if (threshold === null) {
                state.successThreshold = null;
                return;
            }
            var numeric = toFiniteNumber(threshold);
            if (numeric === null || numeric < 0 || numeric > 100) {
                deps.warn('[exe-scorm12] Ignored an out-of-range success threshold (expected 0-100 or null).');
                return;
            }
            state.successThreshold = numeric;
        },

        /** @returns {number|null} The success threshold currently in force. */
        getSuccessThreshold: function () {
            return state.successThreshold;
        },

        /**
         * Record whether the current page contains activities that save a
         * SCORM score. Fallback signal for pages whose iDevices never register
         * with the activity registry.
         *
         * @param {boolean} hasScoredActivities - True when at least one
         * activity on the page reports SCORM score saving.
         */
        setHasScoredActivities: function (hasScoredActivities) {
            state.pageHasScoredActivities = hasScoredActivities === true;
        },

        /** @returns {boolean} Current scored-activities flag (tests). */
        getHasScoredActivities: function () {
            return state.pageHasScoredActivities;
        },

        /**
         * Decide the lesson status the page has earned, from the activity
         * registry alone (no LMS traffic). eXeLearning policy:
         *
         * | Registry state                                     | Status     |
         * |----------------------------------------------------|------------|
         * | no required evaluable activity                      | completed  |
         * | at least one required activity still incomplete     | incomplete |
         * | all required complete, no threshold in force        | completed  |
         * | all required complete, aggregate >= threshold       | passed     |
         * | all required complete, aggregate < threshold        | failed     |
         *
         * Presentation-only and exploration activities register with
         * `completionRequired: false`, so they never hold a page at
         * "incomplete" — they are not evaluable and nothing is inferred from
         * whether they happen to expose a game-over state.
         *
         * @param {number} [aggregateScore] - Aggregate score override, 0-100.
         * Normally omitted: the registry's summary() owns the historical
         * weighting algorithm, so every caller reads the same aggregate.
         * @returns {{status: string, reason: string, score: number|null}} The
         * decision and why it was taken.
         */
        decideStatus: function (aggregateScore) {
            var inputs = completionInputs();
            var score = aggregateScore === undefined ? inputs.score : toFiniteNumber(aggregateScore);
            if (!inputs.hasRequired) {
                return { status: STATUS.COMPLETED, reason: 'no-required-activities', score: score };
            }
            if (!inputs.allRequiredComplete) {
                return { status: STATUS.INCOMPLETE, reason: 'required-activities-pending', score: score };
            }
            var threshold = state.successThreshold;
            if (threshold === null || score === null) {
                return { status: STATUS.COMPLETED, reason: 'no-success-threshold', score: score };
            }
            return {
                status: score >= threshold ? STATUS.PASSED : STATUS.FAILED,
                reason: 'threshold-evaluated',
                score: score,
            };
        },

        /**
         * Re-evaluate the status during the session, after activity progress
         * changed. Same semantics as applyDecidedStatus.
         *
         * @param {number} [aggregateScore] - See decideStatus.
         * @returns {{status: string, written: boolean, reason: string,
         * effective: string}} What happened.
         */
        recordActivityOutcome: function (aggregateScore) {
            return policy.applyDecidedStatus(aggregateScore);
        },

        /**
         * Targeted reconciliation for activities that register after a status
         * was already written: when the registry says a required activity is
         * still pending, re-run the status decision so a stale terminal
         * verdict this policy wrote earlier in the session is corrected back
         * to "incomplete" (applyDecidedStatus's ownership rules decide
         * whether the downgrade is allowed). Any other decision is left to
         * the moments that normally write status — activity outcomes and the
         * exit policy — so a partially registered page never receives a
         * transient passed/failed verdict from a registration event.
         *
         * Called when an activity registers (common.js reportActivity) and
         * before every mid-session persist (the lifecycle layer), so the LMS
         * never keeps a stale terminal verdict alongside a pending registry.
         *
         * @returns {{status: string, written: boolean, reason: string,
         * effective: string}|null} applyDecidedStatus's report, or null when
         * no required activity was pending.
         */
        reconcilePendingActivities: function () {
            // Before the session opens there is nothing to reconcile against:
            // every read and write would be refused (and logged) by the
            // client. iDevices register on jQuery ready, before loadPage(),
            // and the entry policy sees those registrations when it runs.
            if (!deps.getClient().isActive()) {
                return null;
            }
            if (policy.decideStatus().reason !== 'required-activities-pending') {
                return null;
            }
            return policy.applyDecidedStatus();
        },

        /**
         * Apply the decided status to cmi.core.lesson_status.
         *
         * A terminal status already recorded is preserved — with one
         * exception: when the policy itself wrote that terminal status during
         * this session and the decision afterwards returns to
         * `required-activities-pending` — a required activity registering
         * late, or a replay reporting `completed: false` for one that had
         * been complete — the page demonstrably is not finished, so the
         * policy corrects its own verdict back to "incomplete". (The local
         * name `lateRegistration` covers both causes: what is checked is the
         * decision reason, not how it came about.) A terminal status
         * restored from a previous attempt, or written explicitly by content,
         * is never downgraded. Movement *between* terminal statuses (a
         * retried failed activity now passing) is always allowed.
         *
         * `effective` is the status actually in force at the LMS after the
         * call — when a write is rejected it is the previously stored value,
         * so callers (the exit policy) never act on a status the LMS refused.
         *
         * @param {number} [aggregateScore] - See decideStatus.
         * @returns {{status: string, written: boolean, reason: string,
         * effective: string}} What happened.
         */
        applyDecidedStatus: function (aggregateScore) {
            var current = deps.getClient().getValue(LESSON_STATUS);
            var decision = policy.decideStatus(aggregateScore);
            if (policy.isTerminalStatus(current) && !policy.isTerminalStatus(decision.status)) {
                var policyOwned = current === state.policySessionStatus;
                var lateRegistration = decision.reason === 'required-activities-pending';
                if (!policyOwned || !lateRegistration) {
                    return {
                        status: current,
                        written: false,
                        reason: 'terminal-status-preserved',
                        effective: current,
                    };
                }
            }
            if (decision.status === current) {
                // Deliberately NOT claimed as policy-owned: the stored value
                // may have been restored from a previous attempt or written
                // by content — agreeing with it is not the same as having
                // written it, and only a status this policy wrote may later
                // be downgraded.
                return { status: current, written: true, reason: decision.reason, effective: current };
            }
            var written = writeStatus(decision.status);
            if (written) {
                state.policySessionStatus = decision.status;
            }
            return {
                status: decision.status,
                written: written,
                reason: decision.reason,
                effective: written ? decision.status : current,
            };
        },

        /**
         * Persist the activity registry into cmi.suspend_data.
         *
         * @returns {boolean} True when the LMS accepted the value (also true
         * when there is nothing to persist).
         */
        persistActivities: function () {
            var activities = deps.getActivities();
            if (!activities) {
                return true;
            }
            if (activities.list().length === 0 && activities.pendingLegacy() === 0) {
                return true;
            }
            return deps.getClient().setValue(SUSPEND_DATA, activities.serialize());
        },

        /**
         * Exit policy, applied once when the session ends.
         *
         * With the completion rule (unloadPage and the pagehide safety net —
         * the legacy unload sites), the status decided from the activity
         * registry is written unless a terminal status is already recorded.
         * Without it (doQuit/doBack/doContinue/scorm.quit — legacy parity),
         * the stored status is left untouched.
         *
         * In both cases cmi.core.exit is then set to "" (normal end) for a
         * terminal status or "suspend" (resumable attempt) otherwise.
         *
         * @param {boolean} [applyCompletionRule] - Apply the completion rule
         * (default true).
         * @returns {{status: string, exit: string}} What was recorded.
         */
        applyExitPolicy: function (applyCompletionRule) {
            var client = deps.getClient();
            policy.persistActivities();
            var status;
            if (applyCompletionRule !== false) {
                // `effective` rather than the decision: if the LMS rejected
                // the status write, cmi.core.exit must describe the attempt
                // the LMS actually stored — reporting a normal end ("") for a
                // still-incomplete attempt would close it prematurely.
                status = policy.applyDecidedStatus().effective;
            } else {
                status = client.getValue(LESSON_STATUS);
            }
            var exit = policy.isTerminalStatus(status) ? '' : 'suspend';
            client.setValue(EXIT, exit);
            return { status: status, exit: exit };
        },

        /**
         * Legacy doContinue(status) semantics: outside review/browse mode,
         * store the given status when a SCO may write it.
         *
         * Suppressing the write in review/browse mode is eXeLearning policy,
         * not a SCORM 1.2 rule — the specification only makes the LMS ignore
         * status changes when cmi.core.credit is "no-credit".
         *
         * @param {string} status - Requested lesson_status value.
         * @returns {boolean} True when a status was written.
         */
        setStatusForContinue: function (status) {
            var client = deps.getClient();
            var modeRead = client.getOptionalValue(LESSON_MODE);
            var mode = modeRead.supported && modeRead.value !== '' ? modeRead.value : 'normal';
            if (mode === 'review' || mode === 'browse') {
                return false;
            }
            if (!policy.isWritableStatus(status)) {
                deps.warn("[exe-scorm12] Ignored invalid lesson_status value '" + status + "'.");
                return false;
            }
            return writeContentStatus(status);
        },

        /** @returns {boolean} True when the LMS accepted the value. */
        setCompleted: function () {
            return writeContentStatus(STATUS.COMPLETED);
        },

        /** @returns {boolean} True when the LMS accepted the value. */
        setIncomplete: function () {
            return writeContentStatus(STATUS.INCOMPLETE);
        },

        /** @returns {boolean} True when the LMS accepted the value. */
        setPassed: function () {
            return writeContentStatus(STATUS.PASSED);
        },

        /** @returns {boolean} True when the LMS accepted the value. */
        setFailed: function () {
            return writeContentStatus(STATUS.FAILED);
        },

        /**
         * Write a lesson_status on behalf of content through a generic entry
         * point (SetCompletionStatus, scorm.set). Validates the SCO-writable
         * vocabulary locally — forwarding "not attempted" or a foreign value
         * would be an invalid LMS call — and releases the policy's session
         * claim on success, exactly like the named setters above: whatever
         * path content uses to write a status, the result is content's
         * verdict and is never downgraded.
         *
         * @param {string} status - Requested lesson_status value.
         * @returns {boolean} True when the LMS accepted the value.
         */
        setContentStatus: function (status) {
            if (!policy.isWritableStatus(status)) {
                return false;
            }
            return writeContentStatus(status);
        },

        /**
         * Validate a raw/min/max score triplet without writing anything.
         *
         * SCORM 1.2 constrains all three to the 0-100 CMIDecimal range.
         * Requiring min <= raw <= max on top of that is eXeLearning policy: an
         * inconsistent triplet is a content bug, and sending it would record a
         * meaningless score.
         *
         * @param {number|string} raw - Raw score.
         * @param {number|string} [min] - Minimum score.
         * @param {number|string} [max] - Maximum score.
         * @returns {{valid: boolean, raw: number|null, min: number|null,
         * max: number|null, problem: string|null}} The validation result.
         */
        validateScore: function (raw, min, max) {
            var rawNumber = toFiniteNumber(raw);
            var minGiven = min !== undefined && min !== null;
            var maxGiven = max !== undefined && max !== null;
            var minNumber = minGiven ? toFiniteNumber(min) : null;
            var maxNumber = maxGiven ? toFiniteNumber(max) : null;
            var problem = null;
            if (rawNumber === null) {
                problem = 'raw-not-numeric';
            } else if (rawNumber < 0 || rawNumber > 100) {
                problem = 'raw-out-of-range';
            } else if (minGiven && minNumber === null) {
                problem = 'min-not-numeric';
            } else if (maxGiven && maxNumber === null) {
                problem = 'max-not-numeric';
            } else if (minNumber !== null && (minNumber < 0 || minNumber > 100)) {
                problem = 'min-out-of-range';
            } else if (maxNumber !== null && (maxNumber < 0 || maxNumber > 100)) {
                problem = 'max-out-of-range';
            } else if (minNumber !== null && minNumber > rawNumber) {
                // min > raw and max < raw together cover min > max, because
                // reaching this point already implies min <= raw <= max.
                problem = 'min-above-raw';
            } else if (maxNumber !== null && maxNumber < rawNumber) {
                problem = 'max-below-raw';
            }
            return {
                valid: problem === null,
                raw: rawNumber,
                min: minNumber,
                max: maxNumber,
                problem: problem,
            };
        },

        /**
         * Write the score to cmi.core.score.raw (and .min/.max when given).
         *
         * cmi.core.score.raw is mandatory in SCORM 1.2 while .min and .max are
         * optional, so an LMS may accept the raw score and answer "not
         * implemented" (401) for the bounds. That must not be reported as a
         * failed score write, and it must not stop the caller from committing
         * a score the LMS did record.
         *
         * @param {number|string} raw - Raw score, 0-100.
         * @param {number|string} [min] - Minimum score, 0-100.
         * @param {number|string} [max] - Maximum score, 0-100.
         * @returns {{valid: boolean, problem: string|null,
         * required: {element: string, attempted: boolean, written: boolean,
         *            errorCode: number}|null,
         * optional: Array<{element: string, written: boolean,
         *                  unsupported: boolean, errorCode: number}>,
         * requiredWritten: boolean, optionalFailures: string[],
         * ok: boolean}} Structured outcome. `ok` is the legacy boolean: every
         * attempted write succeeded.
         */
        /**
         * Write one score bound, once per session.
         *
         * The bounds are constants for the whole attempt, and the legacy runtime sends
         * them exactly once, at initGame. Content reaches them two ways — the pipwerks
         * extensions SetScoreMin/SetScoreMax, and setScoreDetailed alongside a score —
         * so the "have I already sent this" answer has to live in one place, here,
         * or the two paths each send their own copy.
         *
         * @param {string} element - cmi.core.score.min or cmi.core.score.max.
         * @param {number|string} value - The bound to publish.
         * @returns {boolean} True when the LMS holds this value, whether this call
         * sent it or an earlier one did.
         */
        setScoreBound: function (element, value) {
            if (element !== SCORE_MIN && element !== SCORE_MAX) {
                deps.warn('[exe-scorm12] setScoreBound only handles cmi.core.score.min and .max.');
                return false;
            }
            var text = String(value);
            if (state.sentBounds[element] === text) {
                return true;
            }
            var write = deps.getClient().setOptionalValueDetailed(element, text);
            if (write.success) {
                state.sentBounds[element] = text;
            }
            return write.success;
        },

        setScoreDetailed: function (raw, min, max) {
            var client = deps.getClient();
            var validation = policy.validateScore(raw, min, max);
            var result = {
                valid: validation.valid,
                problem: validation.problem,
                required: null,
                optional: [],
                requiredWritten: false,
                optionalFailures: [],
                ok: false,
            };
            if (!validation.valid) {
                deps.warn('[exe-scorm12] Ignored invalid score (raw/min/max must be numbers within 0-100).');
                return result;
            }
            var rawWrite = client.setValueDetailed(SCORE_RAW, String(validation.raw));
            result.required = {
                element: SCORE_RAW,
                attempted: true,
                written: rawWrite.success,
                errorCode: rawWrite.errorCode,
            };
            result.requiredWritten = rawWrite.success;

            var bounds = [
                { element: SCORE_MIN, value: validation.min },
                { element: SCORE_MAX, value: validation.max },
            ];
            for (var index = 0; index < bounds.length; index += 1) {
                if (bounds[index].value === null) {
                    continue;
                }
                var boundValue = String(bounds[index].value);
                if (state.sentBounds[bounds[index].element] === boundValue) {
                    // Already sent this session and unchanged. Reporting it as
                    // written keeps the caller's view of the score complete
                    // without putting a redundant call on the wire.
                    result.optional.push({
                        element: bounds[index].element,
                        written: true,
                        unsupported: false,
                        errorCode: '0',
                    });
                    continue;
                }
                // Optional-element write: a 401 answer is a conforming LMS
                // skipping score.min/max, so nothing is logged for it.
                var write = client.setOptionalValueDetailed(bounds[index].element, boundValue);
                if (write.success) {
                    state.sentBounds[bounds[index].element] = boundValue;
                }
                var unsupported = !write.success && write.errorCode === 401;
                result.optional.push({
                    element: bounds[index].element,
                    written: write.success,
                    unsupported: unsupported,
                    errorCode: write.errorCode,
                });
                if (!write.success) {
                    result.optionalFailures.push(bounds[index].element);
                }
            }
            result.ok =
                result.requiredWritten &&
                result.optional.every(function (entry) {
                    return entry.written;
                });
            return result;
        },

        /**
         * Write the score, reporting only whether every attempted element was
         * accepted. Kept for the documented boolean contract; callers that
         * need to know whether the *required* raw score landed should use
         * setScoreDetailed().
         *
         * @param {number|string} raw - Raw score, 0-100.
         * @param {number|string} [min] - Minimum score, 0-100.
         * @param {number|string} [max] - Maximum score, 0-100.
         * @returns {boolean} True when every provided element was accepted.
         */
        setScore: function (raw, min, max) {
            return policy.setScoreDetailed(raw, min, max).ok;
        },
    };

    var exeScorm12 = (global.exeScorm12 = global.exeScorm12 || {});
    exeScorm12.policy = policy;

    // CommonJS export for the unit tests.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = policy;
    }
})(typeof window !== 'undefined' ? window : globalThis);
