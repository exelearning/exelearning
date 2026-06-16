/*! ===========================================================================
    eXe xAPI emitter (exe_xapi.js)
    Copyright 2004-2008 eXe Project, http://eXeLearning.org/

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.    See the
    GNU General Public License for more details.
===============================================================================

    Always-on xAPI (Experience API) emitter for published eXeLearning packages.

    This library is bundled into EVERY export format (web, SCORM, IMS, EPUB,
    single-page) via BASE_LIBRARIES, so any published package is xAPI-compatible
    out of the box, with no export-time option. It emits one statement per
    gradable iDevice ("answered") and one package-level statement
    ("completed" + "passed"/"failed") whenever a score is reported.

    It does NOT depend on SCORM or pipwerks: the gamification layer in common.js
    calls `gamification.track(...)` (which forwards here) regardless of format.

    Transport (silent fall-through, both may run):
      1. window.postMessage to the parent window — for packages embedded in an
         LMS (e.g. Moodle), which captures the statement and attaches the
         authenticated learner.
      2. POST to an LRS when xAPI launch parameters (endpoint/auth) are present
         in the launch URL.
      3. No-op when neither is available (plain web / offline EPUB).

    References (official xAPI specification):
      - Statement data model:
        https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Data.md
      - Communication / LRS Statements API + X-Experience-API-Version header:
        https://github.com/adlnet/xAPI-Spec/blob/master/xAPI-Communication.md
      - ADL verbs: http://adlnet.gov/expapi/verbs/{answered,completed,passed,failed}
      - Primer: https://xapi.com/statements-101/
=========================================================================== */

(function (root) {
    'use strict';

    // ADL standard verb IRIs. See http://adlnet.gov/expapi/verbs/
    var VERBS = {
        answered: { id: 'http://adlnet.gov/expapi/verbs/answered', display: { 'en-US': 'answered' } },
        completed: { id: 'http://adlnet.gov/expapi/verbs/completed', display: { 'en-US': 'completed' } },
        passed: { id: 'http://adlnet.gov/expapi/verbs/passed', display: { 'en-US': 'passed' } },
        failed: { id: 'http://adlnet.gov/expapi/verbs/failed', display: { 'en-US': 'failed' } },
        // Generic xAPI lifecycle verbs (NOT cmi5): emitted once on load/unload.
        initialized: { id: 'http://adlnet.gov/expapi/verbs/initialized', display: { 'en-US': 'initialized' } },
        terminated: { id: 'http://adlnet.gov/expapi/verbs/terminated', display: { 'en-US': 'terminated' } },
    };

    // xAPI Activity Type for graded interactions.
    var ACTIVITY_TYPE_ASSESSMENT = 'http://adlnet.gov/expapi/activities/assessment';
    var ACTIVITY_TYPE_INTERACTION = 'http://adlnet.gov/expapi/activities/cmi.interaction';

    // Stable eXeLearning-specific context extension IRIs. Each is attached to a
    // statement's context.extensions only when the corresponding value exists.
    var EXT = {
        packageId: 'https://exelearning.net/xapi/extensions/package-id',
        ideviceId: 'https://exelearning.net/xapi/extensions/idevice-id',
        ideviceType: 'https://exelearning.net/xapi/extensions/idevice-type',
        pageId: 'https://exelearning.net/xapi/extensions/page-id',
        pageTitle: 'https://exelearning.net/xapi/extensions/page-title',
    };

    // The package is considered passed at >= 50/100, identical to the SCORM
    // lesson_status threshold used by gamification.scorm.showFinalScore().
    var PASS_THRESHOLD = 50;

    var xapi = {
        /** Resolved configuration: { odeId, baseIri, activityId, packageTitle, language, actor, parentOrigin }. */
        config: null,
        /** Parsed xAPI launch parameters from the URL, or null. */
        launch: null,
        /** Per-iDevice running scores keyed by ideviceNumber, on a 0..100 scale (feeds getFinalScore for the package total). */
        _state: {},
        /** Debounce cache: last payload signature emitted per iDevice, to avoid duplicate statements. */
        _lastSig: {},
        /** Lifecycle guards so "initialized"/"terminated" are each emitted at most once. */
        _lifecycle: { initialized: false, terminated: false },
        _initialised: false,

        /**
         * Resolve config + launch parameters. Idempotent; safe to call repeatedly.
         */
        init: function () {
            if (this._initialised) return;
            try {
                this.config = this._resolveConfig();
                this.launch = this._parseLaunch();
            } catch (e) {
                // Never let tracking setup break page rendering (e.g. EPUB sandboxes).
                this.config = this.config || { baseIri: '', activityId: '' };
                this.launch = null;
            }
            this._initialised = true;
            // Generic xAPI lifecycle: announce the session start and arrange to
            // announce its end. Only when a transport can actually carry them.
            this._emitInitialized();
            this._bindTerminate();
        },

        /**
         * Emit the generic xAPI "initialized" lifecycle statement once, when a
         * transport is available. No-op otherwise. NOT a cmi5 statement.
         */
        _emitInitialized: function () {
            try {
                if (this._lifecycle.initialized) return;
                if (!this._hasTransport()) return;
                this._lifecycle.initialized = true;
                this._send(this._buildLifecycleStatement(VERBS.initialized));
            } catch (e) { /* no-op */ }
        },

        /**
         * Register a one-shot unload listener that emits "terminated" once.
         * Uses both pagehide and unload for browser coverage; the guard in
         * _emitTerminated() keeps it to a single statement.
         */
        _bindTerminate: function () {
            try {
                if (!root || typeof root.addEventListener !== 'function') return;
                var self = this;
                var handler = function () { self._emitTerminated(); };
                root.addEventListener('pagehide', handler);
                root.addEventListener('unload', handler);
            } catch (e) { /* no-op */ }
        },

        /**
         * Emit the generic xAPI "terminated" lifecycle statement once, when a
         * transport is available. No-op otherwise. NOT a cmi5 statement.
         */
        _emitTerminated: function () {
            try {
                if (this._lifecycle.terminated) return;
                if (!this._hasTransport()) return;
                this._lifecycle.terminated = true;
                this._send(this._buildLifecycleStatement(VERBS.terminated));
            } catch (e) { /* no-op */ }
        },

        /**
         * Read the package identity injected by the exporter into <head> as
         * `window.exeXapi`. Falls back to the document URL so statements are
         * still structurally valid in a plain standalone page.
         *
         * @returns {{odeId:string, baseIri:string, activityId:string, packageTitle:string, language:string, actor:?object, parentOrigin:?string}}
         */
        _resolveConfig: function () {
            var cfg = (root && root.exeXapi) ? root.exeXapi : {};
            var loc = (root && root.location) ? root.location : { origin: '', pathname: '', href: '' };
            var fallback = (loc.origin || '') + (loc.pathname || '');
            var baseIri = cfg.baseIri ||
                (cfg.odeId ? 'https://exelearning.net/xapi/' + cfg.odeId : fallback);
            return {
                odeId: cfg.odeId || '',
                baseIri: baseIri,
                activityId: cfg.activityId || baseIri,
                packageTitle: cfg.packageTitle || '',
                language: cfg.language || 'en',
                actor: cfg.actor || null,
                parentOrigin: cfg.parentOrigin || null,
                registration: cfg.registration || null,
            };
        },

        /**
         * Parse xAPI launch parameters from the URL query string
         * (endpoint, auth, actor, registration). See xAPI Communication spec.
         * These are plain xAPI launch parameters, not cmi5 launch semantics.
         *
         * @returns {?{endpoint:string, auth:string, actor:?object, registration:?string}}
         */
        _parseLaunch: function () {
            var loc = (root && root.location) ? root.location : null;
            if (!loc || !loc.search) return null;
            var params;
            try {
                params = new URLSearchParams(loc.search);
            } catch (e) {
                return null;
            }
            var endpoint = params.get('endpoint');
            var auth = params.get('auth');
            if (!endpoint || !auth) return null;
            var actor = null;
            var rawActor = params.get('actor');
            if (rawActor) {
                try { actor = JSON.parse(rawActor); } catch (e) { actor = null; }
            }
            // Normalise endpoint to end with a single slash for "/statements".
            if (endpoint.charAt(endpoint.length - 1) !== '/') endpoint += '/';
            return {
                endpoint: endpoint,
                auth: auth,
                actor: actor,
                registration: params.get('registration') || null,
            };
        },

        /**
         * Public entry point called by gamification.track() in common.js.
         *
         * @param {{type:string, ideviceId:?string, ideviceType:?string, ideviceNumber:?number, title:?string, score:number, weighted:?number}} evt
         *   score is the per-iDevice score on a 0..10 scale (game.scorerp).
         */
        emit: function (evt) {
            if (!this._initialised) this.init();
            if (!evt || typeof evt !== 'object') return;
            var score = parseFloat(evt.score);
            if (isNaN(score)) return;

            // Update the package aggregate from this iDevice's score (0..100 scale).
            if (evt.ideviceNumber != null) {
                this._state[evt.ideviceNumber] = {
                    title: evt.title || '',
                    score: Math.max(0, Math.min(100, score * 10)),
                    weighted: evt.weighted != null ? evt.weighted : 1,
                };
            }

            // Per-iDevice "answered" statement (the granular payload).
            var perIdevice = this._buildIdeviceStatement(evt, score);
            if (perIdevice && !this._isDuplicate('idevice:' + evt.ideviceId, perIdevice)) {
                this._send(perIdevice);
            }

            // Package "completed" + "passed"/"failed", reusing the shared,
            // pure getFinalScore() so the weighting logic stays single-source.
            var finalScore = this._packageScore();
            if (finalScore != null) {
                var pkg = this._buildPackageStatements(finalScore);
                for (var i = 0; i < pkg.length; i++) {
                    if (!this._isDuplicate('package:' + pkg[i].verb.id, pkg[i])) {
                        this._send(pkg[i]);
                    }
                }
            }
        },

        /**
         * Weighted package total (0..100) from the running per-iDevice state,
         * reusing gamification.scorm.getFinalScore() (a pure function). Returns
         * null when the aggregator is unavailable.
         *
         * @returns {?number}
         */
        _packageScore: function () {
            try {
                var dev = root && root.$exeDevices && root.$exeDevices.iDevice;
                var fn = dev && dev.gamification && dev.gamification.scorm
                    && dev.gamification.scorm.getFinalScore;
                if (typeof fn !== 'function') return null;
                if (!Object.keys(this._state).length) return null;
                return fn(this._state);
            } catch (e) {
                return null;
            }
        },

        /**
         * Build the per-iDevice "answered" statement.
         *
         * @param {object} evt
         * @param {number} score 0..10
         * @returns {?object} xAPI statement
         */
        _buildIdeviceStatement: function (evt, score) {
            if (!evt.ideviceId) return null;
            var objectId = this.config.baseIri + '/idevice/' + evt.ideviceId;
            var definition = {
                type: ACTIVITY_TYPE_INTERACTION,
                name: this._lang(evt.title || evt.ideviceId),
            };
            if (evt.ideviceType) {
                definition.extensions = {};
                definition.extensions[EXT.ideviceType] = evt.ideviceType;
            }
            return this._statement(VERBS.answered, {
                id: objectId,
                objectType: 'Activity',
                definition: definition,
            }, {
                score: { scaled: round4(score / 10), raw: round2(score), min: 0, max: 10 },
                success: score >= 5,
                completion: true,
            }, [{ id: this.config.activityId }], this._contextExtensions(evt));
        },

        /**
         * Build the context.extensions map with eXeLearning-specific metadata,
         * including a key only when its value is available (never invented).
         * Page id/title are populated only when the caller supplies them.
         *
         * @param {object} [evt]
         * @returns {?object}
         */
        _contextExtensions: function (evt) {
            var ext = {};
            if (this.config && this.config.odeId) ext[EXT.packageId] = this.config.odeId;
            if (evt) {
                if (evt.ideviceId) ext[EXT.ideviceId] = evt.ideviceId;
                if (evt.ideviceType) ext[EXT.ideviceType] = evt.ideviceType;
                if (evt.pageId) ext[EXT.pageId] = evt.pageId;
                if (evt.pageTitle) ext[EXT.pageTitle] = evt.pageTitle;
            }
            return Object.keys(ext).length ? ext : null;
        },

        /**
         * Build the package-level statements: always "completed", plus
         * "passed" or "failed" depending on the threshold.
         *
         * @param {number} finalScore 0..100
         * @returns {object[]}
         */
        _buildPackageStatements: function (finalScore) {
            var object = this._packageObject();
            var result = {
                score: { scaled: round4(finalScore / 100), raw: round2(finalScore), min: 0, max: 100 },
                success: finalScore >= PASS_THRESHOLD,
                completion: true,
            };
            var ext = this._contextExtensions(null);
            var passVerb = finalScore >= PASS_THRESHOLD ? VERBS.passed : VERBS.failed;
            return [
                this._statement(VERBS.completed, object, result, null, ext),
                this._statement(passVerb, object, result, null, ext),
            ];
        },

        /**
         * The package-level Activity object (id + definition with localized
         * name and a stable type IRI). Shared by package and lifecycle statements.
         *
         * @returns {object}
         */
        _packageObject: function () {
            return {
                id: this.config.activityId,
                objectType: 'Activity',
                definition: {
                    type: ACTIVITY_TYPE_ASSESSMENT,
                    name: this._lang(this.config.packageTitle || this.config.odeId || 'eXeLearning resource'),
                },
            };
        },

        /**
         * Build a generic xAPI lifecycle statement ("initialized"/"terminated")
         * against the package Activity. Carries no score. NOT cmi5.
         *
         * @param {object} verb
         * @returns {object}
         */
        _buildLifecycleStatement: function (verb) {
            return this._statement(verb, this._packageObject(), null, null, this._contextExtensions(null));
        },

        /**
         * Assemble a full xAPI statement. See xAPI-Data.md.
         *
         * @param {object} verb
         * @param {object} object
         * @param {?object} result omitted from the statement when null (lifecycle)
         * @param {?object[]} parentActivities contextActivities.parent entries
         * @param {?object} extensions context.extensions map
         * @returns {object}
         */
        _statement: function (verb, object, result, parentActivities, extensions) {
            var stmt = {
                id: uuidv4(),
                actor: this._actor(),
                verb: verb,
                object: object,
                timestamp: new Date().toISOString(),
            };
            if (result) stmt.result = result;
            var context = {};
            var registration = this._registration();
            if (registration) {
                context.registration = registration;
            }
            if (parentActivities) {
                context.contextActivities = { parent: parentActivities };
            }
            if (extensions) {
                context.extensions = extensions;
            }
            if (Object.keys(context).length) stmt.context = context;
            return stmt;
        },

        /**
         * Resolve the xAPI context.registration from the launch URL or the
         * injected config, in that order. Null when neither supplies one.
         *
         * @returns {?string}
         */
        _registration: function () {
            if (this.launch && this.launch.registration) return this.launch.registration;
            if (this.config && this.config.registration) return this.config.registration;
            return null;
        },

        /**
         * Whether any transport can actually carry a statement: a real parent
         * window (postMessage) or xAPI launch parameters (LRS POST).
         *
         * @returns {boolean}
         */
        _hasTransport: function () {
            try {
                if (root && root.parent && root.parent !== root &&
                    typeof root.parent.postMessage === 'function') {
                    return true;
                }
            } catch (e) { /* cross-origin parent access may throw */ }
            return !!this.launch;
        },

        /**
         * Resolve the actor. When embedded, the host (e.g. Moodle) is
         * authoritative and will attach/override the real learner; we never
         * invent personal data, so we fall back to an anonymous account agent.
         *
         * @returns {object} xAPI Agent
         */
        _actor: function () {
            if (this.config && this.config.actor) return this.config.actor;
            if (this.launch && this.launch.actor) return this.launch.actor;
            return this._anonymousActor();
        },

        /**
         * Build the anonymous fallback actor (carries no personal data). Shared
         * by _actor() and by _postToParent() when broadcasting to an
         * unrestricted target origin so a configured learner identity is never
         * exposed to arbitrary embedders.
         *
         * @returns {object} anonymous xAPI Agent
         */
        _anonymousActor: function () {
            return {
                objectType: 'Agent',
                account: {
                    homePage: (this.config && this.config.baseIri) || 'https://exelearning.net/xapi',
                    name: 'anonymous',
                },
            };
        },

        /**
         * Send a statement through the transport chain. Each transport is
         * wrapped so a failure never propagates to the page.
         *
         * @param {object} statement
         */
        _send: function (statement) {
            this._postToParent(statement);
            this._postToLrs(statement);
        },

        _postToParent: function (statement) {
            try {
                if (root && root.parent && root.parent !== root && typeof root.parent.postMessage === 'function') {
                    // Prefer the configured target origin so the statement is
                    // only delivered to the intended host.
                    var parentOrigin = (this.config && this.config.parentOrigin) || '';
                    var target = parentOrigin || '*';
                    // Without a configured parentOrigin we broadcast to '*' (any
                    // origin) as best-effort delivery. In that case strip a
                    // possibly-real actor (config/launch may carry the learner's
                    // identity) down to its anonymous form, so no PII leaks to an
                    // arbitrary embedding page. The real actor still reaches a
                    // configured LRS via _postToLrs().
                    var payload = statement;
                    if (!parentOrigin) {
                        payload = Object.assign({}, statement, { actor: this._anonymousActor() });
                    }
                    root.parent.postMessage({ type: 'exe-xapi-statement', statement: payload }, target);
                }
            } catch (e) { /* no-op */ }
        },

        _postToLrs: function (statement) {
            try {
                if (!this.launch || typeof fetch !== 'function') return;
                fetch(this.launch.endpoint + 'statements', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: this.launch.auth,
                        'X-Experience-API-Version': '1.0.3',
                    },
                    body: JSON.stringify(statement),
                })['catch'](function () { /* swallow network errors */ });
            } catch (e) { /* no-op */ }
        },

        /**
         * Debounce duplicate statements: same key + same verb + same score is
         * skipped so a re-render or repeated save does not double-report.
         *
         * @param {string} key
         * @param {object} statement
         * @returns {boolean} true if this statement is a duplicate of the last one for the key
         */
        _isDuplicate: function (key, statement) {
            var sig = statement.verb.id + '|' +
                (statement.result && statement.result.score ? statement.result.score.raw : '');
            if (this._lastSig[key] === sig) return true;
            this._lastSig[key] = sig;
            return false;
        },

        /**
         * Build an xAPI Language Map for the configured language.
         *
         * @param {string} text
         * @returns {object}
         */
        _lang: function (text) {
            var map = {};
            map[(this.config && this.config.language) || 'en'] = String(text == null ? '' : text);
            return map;
        },
    };

    function round2(n) { return Math.round(n * 100) / 100; }
    function round4(n) { return Math.round(n * 10000) / 10000; }

    /**
     * RFC 4122 v4 UUID for statement ids (idempotency at the LRS).
     * Uses crypto.randomUUID when available.
     *
     * @returns {string}
     */
    function uuidv4() {
        try {
            if (root && root.crypto && typeof root.crypto.randomUUID === 'function') {
                return root.crypto.randomUUID();
            }
        } catch (e) { /* fall through */ }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = (Math.random() * 16) | 0;
            var v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    // Register on the shared iDevice namespace used by common.js / iDevices.
    if (!root.$exeDevices) root.$exeDevices = {};
    if (!root.$exeDevices.iDevice) root.$exeDevices.iDevice = {};
    root.$exeDevices.iDevice.xapi = xapi;

    // Resolve config as soon as the script loads (idempotent).
    xapi.init();

    // CommonJS export for unit tests (vitest).
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = xapi;
    }
})(typeof window !== 'undefined' ? window : this);
