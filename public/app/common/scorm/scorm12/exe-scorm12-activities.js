/**
 * eXeLearning SCORM 1.2 runtime — activity registry layer.
 *
 * A page can carry any number of iDevices. This layer is the single place
 * that knows which of them exist, which ones the learner must finish, and how
 * far they got. It performs **aggregation only**: it never talks to the LMS
 * and holds no completion policy — exe-scorm12-policy.js turns a summary into
 * a cmi.core.lesson_status value.
 *
 * The separation matters because SCORM 1.2 has a single status element while
 * eXeLearning tracks completion and success independently:
 *
 *   iDevices  ──report──▶  activities (this layer)  ──summary──▶  policy
 *                                                                  │
 *                                                        client ◀──┘  (LMS)
 *
 * Persistence: the registry serialises itself into cmi.suspend_data with an
 * explicit version tag, migrates the unversioned payload written by
 * eXeLearning releases before this layer existed, ignores malformed data
 * instead of throwing, and compacts deterministically to stay inside the
 * SCORM 1.2 4096-character limit. Only structural data is stored — activity
 * identifiers, counters, scores and weights — never learner names or answers.
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

    /** SCORM 1.2 sizes cmi.suspend_data as CMIString4096. */
    var SUSPEND_DATA_LIMIT = 4096;

    /** Payload header of the versioned format written by this layer. */
    var PAYLOAD_PREFIX = 'exe12/';
    var PAYLOAD_VERSION = 1;

    // Both separators are characters encodeURIComponent escapes, so an
    // activity identifier can never be mistaken for a record boundary.
    // (It leaves `- _ . ! ~ * ' ( )` alone, so those are not usable here.)
    var RECORD_SEPARATOR = '|';
    var FIELD_SEPARATOR = ';';

    /** Bit flags packed into a record's flag field. */
    var FLAG_EVALUABLE = 1;
    var FLAG_COMPLETION_REQUIRED = 2;
    var FLAG_COMPLETED = 4;

    /**
     * Legacy (unversioned) suspend_data written by eXeLearning releases before
     * this layer existed, one record per line:
     * `3. "Some title"; Score: 40%; Weight: 1%` joined by `.\t`.
     */
    var LEGACY_RECORD_SEPARATOR = '.\t';
    var LEGACY_RECORD_PATTERN = /^(\d+)\.\s"(.*?)";\s[^:]+:\s([\d.]+)%;\s[^:]+:\s([\d.]+)%\.?$/;

    var defaultDeps = {
        warn: function (message) {
            if (global.console && global.console.warn) {
                global.console.warn(message);
            }
        },
    };

    var deps = defaultDeps;

    function initialState() {
        return {
            // Insertion-ordered ids, so serialisation and compaction are
            // deterministic regardless of object key ordering.
            order: [],
            byId: {},
            // Migrated legacy records, keyed by their page position. The old
            // format has no stable identity, so these stay out of the main
            // registry (they neither weigh nor block completion) until a live
            // registration that knows both the position and the stable id
            // claims them (see register()).
            legacyByIndex: {},
            // Page position remembered from a registration that arrived
            // before cmi.suspend_data was loaded, so load() can still claim.
            legacyIndexById: {},
        };
    }

    /**
     * Inherit a migrated score for `id` when the live record has none yet.
     * A live score (including 0) is never replaced.
     *
     * @param {string} id - Activity identifier.
     * @param {number|string|null} legacyIndex - Page position from the old format.
     * @param {object|null} previous - Existing record, if any.
     * @returns {{score: number}|null} Score to merge, or null.
     */
    function claimFromPool(id, legacyIndex, previous) {
        var index = toNumber(legacyIndex, null);
        if (index === null) {
            return null;
        }
        if (!Object.prototype.hasOwnProperty.call(state.legacyByIndex, index)) {
            return null;
        }
        if (previous && previous.score !== null && previous.score !== undefined) {
            return null;
        }
        var seed = { score: state.legacyByIndex[index].score };
        delete state.legacyByIndex[index];
        return seed;
    }

    /**
     * Attach pool scores to records that registered before load() ran.
     */
    function claimRegisteredFromPool() {
        for (var index = 0; index < state.order.length; index += 1) {
            var id = state.order[index];
            var record = state.byId[id];
            var seed = claimFromPool(id, state.legacyIndexById[id], record);
            if (seed) {
                record.score = seed.score;
            }
        }
    }

    var state = initialState();

    /**
     * Coerce to a finite number, accepting numeric strings.
     *
     * @param {number|string} value - Raw input.
     * @param {number|null} fallback - Value to use when not numeric.
     * @returns {number|null} Finite number or the fallback.
     */
    function toNumber(value, fallback) {
        if (typeof value === 'number' && isFinite(value)) {
            return value;
        }
        if (typeof value === 'string' && value.trim() !== '') {
            var parsed = Number(value);
            if (isFinite(parsed)) {
                return parsed;
            }
        }
        return fallback;
    }

    /**
     * Clamp a number into a range.
     *
     * @param {number} value - Input.
     * @param {number} minimum - Lower bound.
     * @param {number} maximum - Upper bound.
     * @returns {number} Clamped value.
     */
    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(value, maximum));
    }

    /**
     * Build a normalised activity record from a caller-supplied descriptor.
     *
     * Every flag is explicit: an activity declares whether it is evaluable and
     * whether finishing it is required. The registry never infers either from
     * incidental iDevice properties.
     *
     * @param {string} id - Stable activity identifier.
     * @param {object} [descriptor] - Caller-supplied fields.
     * @param {object} [previous] - Existing record, when re-registering.
     * @returns {object} The normalised record.
     */
    function normalize(id, descriptor, previous) {
        var source = descriptor || {};
        var base = previous || {};
        var evaluable = source.evaluable === undefined ? base.evaluable === true : source.evaluable === true;
        var completionRequired =
            source.completionRequired === undefined
                ? base.completionRequired === undefined
                    ? evaluable
                    : base.completionRequired === true
                : source.completionRequired === true;
        var minimumScore = toNumber(source.minimumScore, toNumber(base.minimumScore, 0));
        var maximumScore = toNumber(source.maximumScore, toNumber(base.maximumScore, 100));
        var weight = toNumber(source.weight, toNumber(base.weight, 1));
        return {
            id: id,
            evaluable: evaluable,
            completionRequired: completionRequired,
            completed: source.completed === undefined ? base.completed === true : source.completed === true,
            answered: Math.max(0, toNumber(source.answered, toNumber(base.answered, 0)) || 0),
            total: Math.max(0, toNumber(source.total, toNumber(base.total, 0)) || 0),
            score: source.score === undefined ? (base.score === undefined ? null : base.score) : toNumber(source.score, null),
            minimumScore: minimumScore,
            // A degenerate range (max <= min) cannot normalise a score; fall
            // back to the SCORM 1.2 default 0-100 window.
            maximumScore: maximumScore > minimumScore ? maximumScore : minimumScore + 100,
            weight: weight > 0 ? weight : 1,
        };
    }

    /**
     * Scale an activity score into 0-100 using its own bounds.
     *
     * @param {object} activity - Normalised record.
     * @returns {number} Normalised score (0 when the activity has none yet).
     */
    function normalizedScore(activity) {
        if (activity.score === null) {
            return 0;
        }
        // normalize() guarantees maximumScore > minimumScore (a degenerate
        // range falls back to a 100-wide window), so the span is never zero.
        var span = activity.maximumScore - activity.minimumScore;
        return clamp(((activity.score - activity.minimumScore) / span) * 100, 0, 100);
    }

    /** @returns {number} Rounded to two decimals. */
    function round2(value) {
        return Math.round(value * 100) / 100;
    }

    /**
     * Aggregate the evaluable activities into one 0-100 score with the
     * historical eXeLearning weighting algorithm: each weight (clamped into
     * 1-100) is scaled so the weights sum to exactly 100 as integers
     * (largest-remainder rounding), and the aggregate is the weight-scaled
     * sum of the normalised scores.
     *
     * This is the registry's only aggregation. Published packages recorded
     * cmi.core.score.raw with this exact rounding for years, and the
     * completion policy compares the aggregate against the mastery
     * threshold — a second algorithm (say, an exact weighted mean) could
     * disagree near the threshold and flip a passed page to failed at exit.
     *
     * @returns {number|null} Aggregate score, or null when no activity is
     * evaluable.
     */
    function aggregateScore() {
        var entries = [];
        var weightSum = 0;
        for (var index = 0; index < state.order.length; index += 1) {
            var activity = state.byId[state.order[index]];
            if (!activity.evaluable) {
                continue;
            }
            var weight = clamp(activity.weight, 1, 100);
            entries.push({ score: normalizedScore(activity), scaled: weight, floored: 0, fraction: 0 });
            weightSum += weight;
        }
        if (entries.length === 0) {
            return null;
        }
        var factor = 100 / weightSum;
        var flooredSum = 0;
        for (var position = 0; position < entries.length; position += 1) {
            var scaled = entries[position].scaled * factor;
            entries[position].floored = Math.floor(scaled);
            entries[position].fraction = scaled - entries[position].floored;
            flooredSum += entries[position].floored;
        }
        var remainder = 100 - flooredSum;
        entries.sort(function (a, b) {
            return b.fraction - a.fraction;
        });
        for (var slot = 0; slot < entries.length && remainder > 0; slot += 1) {
            entries[slot].floored += 1;
            remainder -= 1;
        }
        var weightedTotal = 0;
        for (var item = 0; item < entries.length; item += 1) {
            weightedTotal += entries[item].score * entries[item].floored;
        }
        return round2(weightedTotal / 100);
    }

    /**
     * Encode a record for the versioned payload.
     *
     * @param {object} activity - Normalised record.
     * @returns {string} Encoded record.
     */
    function encodeRecord(activity) {
        var flags = 0;
        if (activity.evaluable) {
            flags += FLAG_EVALUABLE;
        }
        if (activity.completionRequired) {
            flags += FLAG_COMPLETION_REQUIRED;
        }
        if (activity.completed) {
            flags += FLAG_COMPLETED;
        }
        return [
            encodeURIComponent(activity.id),
            String(flags),
            String(activity.answered),
            String(activity.total),
            activity.score === null ? '' : String(round2(activity.score)),
            String(activity.weight),
            String(activity.minimumScore),
            String(activity.maximumScore),
        ].join(FIELD_SEPARATOR);
    }

    /**
     * Decode one record of the versioned payload.
     *
     * @param {string} text - Encoded record.
     * @returns {object|null} Normalised record, or null when malformed.
     */
    function decodeRecord(text) {
        var fields = text.split(FIELD_SEPARATOR);
        if (fields.length < 6) {
            return null;
        }
        var id;
        try {
            id = decodeURIComponent(fields[0]);
        } catch (error) {
            return null;
        }
        if (id === '') {
            return null;
        }
        var flags = toNumber(fields[1], null);
        if (flags === null) {
            return null;
        }
        /* eslint-disable no-bitwise */
        return normalize(id, {
            evaluable: (flags & FLAG_EVALUABLE) !== 0,
            completionRequired: (flags & FLAG_COMPLETION_REQUIRED) !== 0,
            completed: (flags & FLAG_COMPLETED) !== 0,
            answered: toNumber(fields[2], 0),
            total: toNumber(fields[3], 0),
            score: fields[4] === '' ? null : toNumber(fields[4], null),
            weight: toNumber(fields[5], 1),
            minimumScore: toNumber(fields[6], 0),
            maximumScore: toNumber(fields[7], 100),
        });
        /* eslint-enable no-bitwise */
    }

    /**
     * Parse the unversioned payload written by older eXeLearning releases
     * into the pending-legacy pool.
     *
     * Those records carry a page position, a title, a score in the 0-100
     * range and a weight — and **no completion flag**. Completion is
     * therefore not invented here (a finished activity with a score of 0 and
     * a half-done one with some points are indistinguishable): only the score
     * and weight are kept, and the live iDevice decides completion after
     * claiming the record. Titles are dropped: they are not needed for
     * aggregation and they are the largest field in a size-constrained
     * element.
     *
     * @param {string} payload - Raw suspend_data value.
     * @returns {Object<string, {score: number, weight: number}>} Pool entries
     * keyed by page position.
     */
    function parseLegacyPayload(payload) {
        var pool = {};
        var lines = payload.split(LEGACY_RECORD_SEPARATOR);
        for (var index = 0; index < lines.length; index += 1) {
            var match = lines[index].trim().match(LEGACY_RECORD_PATTERN);
            if (!match) {
                continue;
            }
            var score = toNumber(match[3], null);
            var weight = toNumber(match[4], 1);
            pool[match[1]] = {
                score: score === null ? 0 : clamp(score, 0, 100),
                weight: weight !== null && weight > 0 ? weight : 1,
            };
        }
        return pool;
    }

    var activities = {
        SUSPEND_DATA_LIMIT: SUSPEND_DATA_LIMIT,
        PAYLOAD_VERSION: PAYLOAD_VERSION,

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

        /** Restore default dependencies and drop every activity (tests only). */
        resetDependencies: function () {
            deps = defaultDeps;
            state = initialState();
        },

        /** Drop every registered activity, keeping injected dependencies. */
        clear: function () {
            state = initialState();
        },

        /**
         * Register an activity, or refine an already registered one.
         *
         * Registration is idempotent: registering the same id twice updates
         * the declaration and keeps whatever progress was already reported, so
         * a re-rendered iDevice never resets the learner's state.
         *
         * @param {string} id - Stable activity identifier (an iDevice node id).
         * @param {object} [descriptor] - evaluable, completionRequired,
         * completed, answered, total, score, minimumScore, maximumScore,
         * weight.
         * @returns {object|null} The stored record, or null when the id is
         * unusable.
         */
        register: function (id, descriptor) {
            if (typeof id !== 'string' || id === '') {
                deps.warn('[exe-scorm12] Ignored an activity registration without a stable identifier.');
                return null;
            }
            var previous = Object.prototype.hasOwnProperty.call(state.byId, id) ? state.byId[id] : null;
            if (descriptor && descriptor.legacyIndex !== undefined) {
                state.legacyIndexById[id] = toNumber(descriptor.legacyIndex, null);
            }
            var legacySeed = claimFromPool(id, state.legacyIndexById[id], previous);
            if (previous === null) {
                state.order.push(id);
            }
            if (legacySeed && previous) {
                previous.score = legacySeed.score;
            }
            state.byId[id] = normalize(id, descriptor, previous || legacySeed);
            return state.byId[id];
        },

        /**
         * Report progress for an already registered activity. Unknown ids are
         * registered on the fly so that an iDevice that starts reporting after
         * the page settled is still tracked.
         *
         * @param {string} id - Activity identifier.
         * @param {object} progress - Fields to merge.
         * @returns {object|null} The stored record.
         */
        update: function (id, progress) {
            return activities.register(id, progress);
        },

        /**
         * @param {string} id - Activity identifier.
         * @returns {boolean} True when an activity was removed.
         */
        unregister: function (id) {
            if (!Object.prototype.hasOwnProperty.call(state.byId, id)) {
                return false;
            }
            delete state.byId[id];
            delete state.legacyIndexById[id];
            state.order.splice(state.order.indexOf(id), 1);
            return true;
        },

        /**
         * @param {string} id - Activity identifier.
         * @returns {object|null} A copy of the stored record.
         */
        get: function (id) {
            if (!Object.prototype.hasOwnProperty.call(state.byId, id)) {
                return null;
            }
            var copy = {};
            for (var key in state.byId[id]) {
                copy[key] = state.byId[id][key];
            }
            return copy;
        },

        /** @returns {object[]} Every record, in registration order. */
        list: function () {
            var result = [];
            for (var index = 0; index < state.order.length; index += 1) {
                result.push(activities.get(state.order[index]));
            }
            return result;
        },

        /**
         * @returns {number} Migrated legacy records nobody has claimed yet.
         * They neither weigh nor block completion until a live registration
         * claims them by page position.
         */
        pendingLegacy: function () {
            return Object.keys(state.legacyByIndex).length;
        },

        /**
         * Aggregate the registry.
         *
         * `score` comes from aggregateScore(): the historical eXeLearning
         * weighting over every evaluable activity, each score normalised
         * into 0-100 with its own bounds. An evaluable activity that has not
         * produced a score yet counts as 0, so the aggregate can only rise
         * as the learner works. It is null when the page has no evaluable
         * activity at all. Every consumer — the score display, the recorded
         * cmi.core.score.raw and the completion policy — reads this one
         * number, so the status decided during the session and the status
         * decided at exit can never disagree.
         *
         * `scored` is the registry's answer to "has ANY evaluable activity
         * actually produced a score yet?". It is deliberately separate from
         * `score`: the aggregate maps an unanswered evaluable activity to 0
         * (so a partially answered page still has a defensible running
         * total), which makes `score` useless for telling "nobody has
         * answered anything" from "everybody scored zero". Every caller that
         * needs that distinction must read `scored`, and this is the only
         * place it is computed.
         *
         * @returns {{total: number, evaluable: number, scored: number,
         * required: number, requiredCompleted: number, hasRequired: boolean,
         * allRequiredComplete: boolean, answered: number, questions: number,
         * score: number|null}} The summary the policy layer consumes.
         */
        summary: function () {
            var summary = {
                total: state.order.length,
                evaluable: 0,
                scored: 0,
                required: 0,
                requiredCompleted: 0,
                hasRequired: false,
                allRequiredComplete: true,
                answered: 0,
                questions: 0,
                score: aggregateScore(),
            };
            for (var index = 0; index < state.order.length; index += 1) {
                var activity = state.byId[state.order[index]];
                summary.answered += activity.answered;
                summary.questions += activity.total;
                if (activity.evaluable) {
                    summary.evaluable += 1;
                    if (activity.score !== null && activity.score !== undefined) {
                        summary.scored += 1;
                    }
                }
                if (activity.completionRequired) {
                    summary.required += 1;
                    if (activity.completed) {
                        summary.requiredCompleted += 1;
                    }
                }
            }
            summary.hasRequired = summary.required > 0;
            summary.allRequiredComplete = summary.requiredCompleted === summary.required;
            return summary;
        },

        /**
         * Serialise the registry into a cmi.suspend_data payload.
         *
         * The result always fits the SCORM 1.2 4096-character limit. When the
         * full payload would overflow it is compacted deterministically:
         * activities that do not block completion are dropped first, then the
         * most recently registered ones, so the records that decide the
         * lesson status survive.
         *
         * @returns {string} The versioned payload.
         */
        serialize: function () {
            var header = PAYLOAD_PREFIX + PAYLOAD_VERSION;
            var records = [];
            for (var index = 0; index < state.order.length; index += 1) {
                records.push(state.byId[state.order[index]]);
            }
            // Unclaimed legacy records travel too (three fields: position,
            // score, weight — unambiguous, a full record always has more), so
            // an exit before every iDevice initialised does not wipe migrated
            // progress. A record with no stable id cannot enter the main
            // format.
            var poolParts = [];
            for (var position in state.legacyByIndex) {
                var legacy = state.legacyByIndex[position];
                poolParts.push(position + FIELD_SEPARATOR + legacy.score + FIELD_SEPARATOR + legacy.weight);
            }
            var allParts = records.map(encodeRecord).concat(poolParts);
            if (allParts.length === 0) {
                return header;
            }
            var payload = header + RECORD_SEPARATOR + allParts.join(RECORD_SEPARATOR);
            if (payload.length <= SUSPEND_DATA_LIMIT) {
                return payload;
            }
            // Compaction pass 1: drop the unclaimed legacy pool — records
            // with no live owner are the least valuable.
            if (poolParts.length > 0) {
                deps.warn(
                    '[exe-scorm12] cmi.suspend_data exceeded the SCORM 1.2 limit; dropped ' +
                        poolParts.length +
                        ' unclaimed legacy records.',
                );
                payload = header + RECORD_SEPARATOR + records.map(encodeRecord).join(RECORD_SEPARATOR);
                if (records.length > 0 && payload.length <= SUSPEND_DATA_LIMIT) {
                    return payload;
                }
            }
            // Compaction pass 2: drop the activities that do not block
            // completion, oldest kept first.
            var kept = records.filter(function (activity) {
                return activity.completionRequired;
            });
            // Compaction pass 3: drop the newest required activities until it
            // fits. The payload is rebuilt each time so the check is exact.
            while (kept.length > 0) {
                payload = header + RECORD_SEPARATOR + kept.map(encodeRecord).join(RECORD_SEPARATOR);
                if (payload.length <= SUSPEND_DATA_LIMIT) {
                    deps.warn(
                        '[exe-scorm12] cmi.suspend_data exceeded the SCORM 1.2 limit; kept ' +
                            kept.length +
                            ' of ' +
                            records.length +
                            ' activities.',
                    );
                    return payload;
                }
                kept.pop();
            }
            deps.warn('[exe-scorm12] cmi.suspend_data exceeded the SCORM 1.2 limit; no activity state was stored.');
            return header;
        },

        /**
         * Restore the registry from a cmi.suspend_data payload.
         *
         * Accepts the versioned format, migrates the unversioned legacy one
         * and ignores anything else (a corrupt or foreign payload must never
         * throw inside a learner's session). Existing registrations win over
         * restored ones for the *declaration* fields, because the running page
         * knows the real shape of its iDevices; restored progress is merged in.
         *
         * @param {string} payload - Raw suspend_data value.
         * @returns {{version: number, restored: number, migrated: boolean}}
         * What was recognised.
         */
        load: function (payload) {
            var result = { version: 0, restored: 0, migrated: false };
            if (typeof payload !== 'string' || payload.trim() === '') {
                return result;
            }
            var records;
            if (payload.indexOf(PAYLOAD_PREFIX) === 0) {
                var body = payload.slice(PAYLOAD_PREFIX.length);
                var separator = body.indexOf(RECORD_SEPARATOR);
                var versionText = separator === -1 ? body : body.slice(0, separator);
                var version = toNumber(versionText, null);
                if (version === null) {
                    deps.warn('[exe-scorm12] Ignored cmi.suspend_data with an unreadable version tag.');
                    return result;
                }
                if (version > PAYLOAD_VERSION) {
                    deps.warn(
                        '[exe-scorm12] Ignored cmi.suspend_data written by a newer runtime (version ' + version + ').',
                    );
                    return result;
                }
                result.version = version;
                records = [];
                var rawRecords = separator === -1 ? [] : body.slice(separator + 1).split(RECORD_SEPARATOR);
                for (var raw = 0; raw < rawRecords.length; raw += 1) {
                    // A three-field entry is an unclaimed legacy pool record
                    // (position, score, weight); a full record has eight.
                    var fields = rawRecords[raw].split(FIELD_SEPARATOR);
                    if (fields.length === 3) {
                        var poolPosition = toNumber(fields[0], null);
                        var poolScore = toNumber(fields[1], null);
                        if (poolPosition !== null && poolScore !== null) {
                            state.legacyByIndex[poolPosition] = {
                                score: clamp(poolScore, 0, 100),
                                weight: toNumber(fields[2], 1) || 1,
                            };
                            result.restored += 1;
                        }
                        continue;
                    }
                    var decoded = decodeRecord(rawRecords[raw]);
                    if (decoded !== null) {
                        records.push(decoded);
                    }
                }
            } else {
                var pool = parseLegacyPayload(payload);
                for (var position in pool) {
                    state.legacyByIndex[position] = pool[position];
                    result.restored += 1;
                    result.migrated = true;
                }
                records = [];
            }
            for (var index = 0; index < records.length; index += 1) {
                var record = records[index];
                var existing = Object.prototype.hasOwnProperty.call(state.byId, record.id) ? state.byId[record.id] : null;
                if (existing === null) {
                    state.order.push(record.id);
                    state.byId[record.id] = record;
                } else {
                    // Merge progress into the live declaration.
                    state.byId[record.id] = normalize(
                        record.id,
                        {
                            completed: record.completed,
                            answered: record.answered,
                            total: record.total || existing.total,
                            score: record.score,
                        },
                        existing,
                    );
                }
                result.restored += 1;
            }
            claimRegisteredFromPool();
            return result;
        },
    };

    var exeScorm12 = (global.exeScorm12 = global.exeScorm12 || {});
    exeScorm12.activities = activities;

    // CommonJS export for the unit tests.
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = activities;
    }
})(typeof window !== 'undefined' ? window : globalThis);
