/**
 * Two independent SCORM 1.2 LMS implementations, as launcher pages.
 *
 * The point of having both is that they fail differently. scorm-again is a third-party
 * runtime with its own reading of the data model, so agreeing with it is evidence that the
 * package is not merely self-consistent. The strict adapter is deliberately unforgiving:
 * it refuses what SCORM 1.2 forbids and records the violation instead of tolerating it, so
 * a package can be conformant against a permissive LMS and still fail here.
 *
 * Both expose the same two globals to the test — `__scormJournal` (every SCO-visible call,
 * in order) and `__lmsState()` (the LMS's own view of the data model) — so one comparison
 * can read either.
 */

/** The iframe id both launchers give the SCO, so one driver reaches into either. */
export const ORACLE_FRAME_ID = 'sco';

/**
 * scorm-again as `window.API`, behind a journaling facade.
 *
 * Settings mirror the unit-level contract suite exactly: nothing auto-commits, nothing is
 * inferred, and errors are strict — the package must be the thing that decides, not the
 * LMS being helpful.
 *
 * @returns The launcher page's HTML.
 */
export function scormAgainLauncher(): string {
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>scorm-again launcher</title>
<script src="/scorm-again.js"></script>
<script>
(function () {
    var api;
    api = new (typeof Scorm12API === 'function' ? Scorm12API : Scorm12API.Scorm12API)({
        autocommit: false, lmsCommitUrl: false, logLevel: 5, mastery_override: false,
        score_overrides_status: false, autoCompleteLessonStatus: false,
        selfReportSessionTime: false, alwaysSendTotalTime: false, sendFullCommit: false,
        autoProgress: false, strict_errors: true
    });
    api.loadFromJSON({ cmi: { core: {
        student_id: 'exe-student-1', student_name: 'Student, Oracle',
        lesson_status: 'not attempted', credit: 'credit', entry: 'ab-initio',
        lesson_mode: 'normal', total_time: '0000:00:00.00'
    }, suspend_data: '', launch_data: '' } });

    var journal = (window.__scormJournal = []);
    var facade = {};
    ['LMSInitialize', 'LMSFinish', 'LMSCommit', 'LMSGetValue', 'LMSSetValue'].forEach(function (name) {
        facade[name] = function () {
            var args = Array.prototype.slice.call(arguments);
            var result = api[name].apply(api, args);
            journal.push({ method: name, args: args.map(String), result: String(result),
                errorAfter: String(api.LMSGetLastError()) });
            return result;
        };
    });
    ['LMSGetLastError', 'LMSGetErrorString', 'LMSGetDiagnostic'].forEach(function (name) {
        facade[name] = function () { return api[name].apply(api, arguments); };
    });
    window.API = facade;
    window.__violations = [];
    // An LMS starts a NEW session every time it launches a SCO, carrying the stored data
    // model forward. Without this the second page of a scenario meets a runtime that
    // already finished, its LMSInitialize is refused, and the lane measures the harness
    // instead of the package.
    var stored = {};
    var currentSco = null;
    window.__newSession = function (scoId) {
        // An LMS keeps ONE data model per SCO, not one per package: page two of a package
        // does not inherit page one's score. Store what the finishing SCO produced, then
        // launch the next one on its own state — which is exactly what Moodle's
        // per-SCO tracks do, and what makes the two comparable.
        if (currentSco !== null) {
            var dump = api.renderCommitCMI(true);
            stored[currentSco] = (dump && dump.cmi) ? dump.cmi : {};
        }
        currentSco = scoId || 'default';
        api = new (typeof Scorm12API === 'function' ? Scorm12API : Scorm12API.Scorm12API)({
            autocommit: false, lmsCommitUrl: false, logLevel: 5, mastery_override: false,
            score_overrides_status: false, autoCompleteLessonStatus: false,
            selfReportSessionTime: false, alwaysSendTotalTime: false, sendFullCommit: false,
            autoProgress: false, strict_errors: true
        });
        api.loadFromJSON({ cmi: stored[currentSco] || {
            core: {
                student_id: 'exe-student-1', student_name: 'Student, Oracle',
                lesson_status: 'not attempted', credit: 'credit', entry: 'ab-initio',
                lesson_mode: 'normal', total_time: '0000:00:00.00'
            }, suspend_data: '', launch_data: ''
        } });
    };
    window.__allScoState = function () {
        var out = {};
        for (var key in stored) out[key] = stored[key];
        if (currentSco !== null) {
            var dump = api.renderCommitCMI(true);
            out[currentSco] = (dump && dump.cmi) ? dump.cmi : {};
        }
        return out;
    };
    window.__lmsState = function () {
        var dump = api.renderCommitCMI(true);
        return dump && dump.cmi ? dump.cmi : dump;
    };
})();
</script></head>
<body><iframe id="${ORACLE_FRAME_ID}" src="about:blank" style="width:1000px;height:700px;border:0"></iframe></body>
</html>`;
}

/**
 * A strict SCORM 1.2 adapter that refuses illegal calls and records them.
 *
 * Everything it rejects is rejected because the specification says so: writing a read-only
 * element, reading a write-only one, a status outside the vocabulary, a session_time that
 * is not a CMITimespan, a score outside 0..100, any call after the session ended. A
 * runtime that makes one of these fails the comparison rather than being tolerated into
 * looking correct.
 *
 * @returns The launcher page's HTML.
 */
export function strictLauncher(): string {
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>strict LMS launcher</title>
<script>
(function () {
    'use strict';
    var WRITE_ONLY = ['cmi.core.exit', 'cmi.core.session_time'];
    var READ_ONLY = ['cmi._version', 'cmi.core.student_id', 'cmi.core.student_name', 'cmi.core.credit',
        'cmi.core.entry', 'cmi.core.total_time', 'cmi.core.lesson_mode', 'cmi.launch_data'];
    var STATUS = ['passed', 'completed', 'failed', 'incomplete', 'browsed'];
    var EXIT = ['time-out', 'suspend', 'logout', ''];
    var defaults = {
        'cmi._version': '3.4',
        'cmi.core.student_id': 'exe-student-1',
        'cmi.core.student_name': 'Student, Oracle',
        'cmi.core.lesson_location': '',
        'cmi.core.credit': 'credit',
        'cmi.core.lesson_status': 'not attempted',
        'cmi.core.entry': 'ab-initio',
        'cmi.core.score.raw': '',
        'cmi.core.score.min': '',
        'cmi.core.score.max': '',
        'cmi.core.total_time': '0000:00:00.00',
        'cmi.core.lesson_mode': 'normal',
        'cmi.suspend_data': '',
        'cmi.launch_data': ''
    };
    var data = JSON.parse(JSON.stringify(defaults));
    var journal = (window.__scormJournal = []);
    var violations = (window.__violations = []);
    var errorCode = '0';
    var initialized = false;
    var finished = false;

    function writeOnly(el) {
        return WRITE_ONLY.indexOf(el) !== -1 ||
            (el.indexOf('cmi.interactions.') === 0 && el.indexOf('_count') === -1);
    }
    function log(method, args, result) {
        journal.push({ method: method, args: Array.prototype.slice.call(args).map(String),
            result: String(result), errorAfter: errorCode });
        return result;
    }
    function refuse(message, code) { violations.push(message); errorCode = code; }

    window.API = {
        LMSInitialize: function (arg) {
            if (arg !== '') { refuse('LMSInitialize argument was not ""', '201'); return log('LMSInitialize', arguments, 'false'); }
            if (initialized || finished) { refuse('duplicate LMSInitialize', '101'); return log('LMSInitialize', arguments, 'false'); }
            initialized = true; errorCode = '0'; return log('LMSInitialize', arguments, 'true');
        },
        LMSFinish: function (arg) {
            if (!initialized) { refuse('LMSFinish without an active session', '301'); return log('LMSFinish', arguments, 'false'); }
            initialized = false; finished = true; errorCode = '0'; return log('LMSFinish', arguments, 'true');
        },
        LMSCommit: function () {
            if (!initialized) { refuse('LMSCommit without an active session', '301'); return log('LMSCommit', arguments, 'false'); }
            errorCode = '0'; return log('LMSCommit', arguments, 'true');
        },
        LMSGetValue: function (el) {
            if (!initialized) { refuse('LMSGetValue after the session ended: ' + el, '301'); return log('LMSGetValue', arguments, ''); }
            if (writeOnly(el)) { refuse('LMSGetValue on the write-only ' + el, '404'); return log('LMSGetValue', arguments, ''); }
            errorCode = '0';
            return log('LMSGetValue', arguments, Object.prototype.hasOwnProperty.call(data, el) ? data[el] : '');
        },
        LMSSetValue: function (el, value) {
            if (!initialized) { refuse('LMSSetValue after the session ended: ' + el, '301'); return log('LMSSetValue', arguments, 'false'); }
            if (READ_ONLY.indexOf(el) !== -1) { refuse('LMSSetValue on the read-only ' + el, '403'); return log('LMSSetValue', arguments, 'false'); }
            if (el === 'cmi.core.lesson_status' && STATUS.indexOf(value) === -1) {
                refuse('lesson_status out of vocabulary: ' + value, '405'); return log('LMSSetValue', arguments, 'false');
            }
            if (el === 'cmi.core.exit' && EXIT.indexOf(value) === -1) {
                refuse('exit out of vocabulary: ' + value, '405'); return log('LMSSetValue', arguments, 'false');
            }
            if (el === 'cmi.core.session_time' && !/^[0-9]{2,4}:[0-9]{2}:[0-9]{2}(\\.[0-9]{1,2})?$/.test(value)) {
                refuse('session_time is not a CMITimespan: ' + value, '405'); return log('LMSSetValue', arguments, 'false');
            }
            if (el.indexOf('cmi.core.score.') === 0 && value !== '' && !(Number(value) >= 0 && Number(value) <= 100)) {
                refuse('score out of range: ' + el + '=' + value, '405'); return log('LMSSetValue', arguments, 'false');
            }
            data[el] = String(value); errorCode = '0';
            return log('LMSSetValue', arguments, 'true');
        },
        LMSGetLastError: function () { return errorCode; },
        LMSGetErrorString: function () { return ''; },
        LMSGetDiagnostic: function () { return ''; }
    };
    // A launch is a session: the LMS keeps the data model and starts a new one, which is
    // why relaunching a SCO is not the "duplicate LMSInitialize" the spec forbids.
    var stored = {};
    var currentSco = null;
    /**
     * Launch a SCO: store what the previous one produced and swap in this one's own data
     * model. One data model per SCO is what an LMS keeps, and what Moodle's per-SCO tracks
     * are; sharing one across pages would make a multi-page package look like a single
     * accumulating record.
     */
    window.__newSession = function (scoId) {
        if (currentSco !== null) stored[currentSco] = data;
        currentSco = scoId || 'default';
        data = stored[currentSco] || JSON.parse(JSON.stringify(defaults));
        initialized = false; finished = false; errorCode = '0';
    };
    window.__allScoState = function () {
        var out = {};
        for (var key in stored) out[key] = stored[key];
        if (currentSco !== null) out[currentSco] = data;
        return out;
    };
    window.__lmsState = function () { return data; };
})();
</script></head>
<body><iframe id="${ORACLE_FRAME_ID}" src="about:blank" style="width:1000px;height:700px;border:0"></iframe></body>
</html>`;
}
