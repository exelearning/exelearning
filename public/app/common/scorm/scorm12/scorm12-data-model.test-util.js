/**
 * SCORM 1.2 CMI data model description — test utility, never shipped in
 * exports (the exporter assembles only the runtime source layers; the static
 * build excludes test files).
 *
 * This is the oracle the strict fake LMS (fake-scorm12-api.test-util.js)
 * validates against. Every entry transcribes the normative ADL sources:
 *
 * - [RTE] SCORM Version 1.2 — The SCORM Run-Time Environment (2001-10-01),
 *   §3.3 (API) and §3.4 (CMI data model).
 * - [CR]  SCORM Version 1.2 Conformance Requirements — the assertions the ADL
 *   Conformance Test Suite checks. Where [RTE] and [CR] disagree, [CR] wins.
 * - [ADD] The SCORM Addendums Version 2.0 (2002-01-04) — normative errata to
 *   [RTE]; where they correct it, they win.
 *
 * It is deliberately a plain data table with no behaviour, so that a
 * disagreement between the runtime and the specification shows up as a data
 * mismatch rather than as duplicated logic.
 *
 * Copyright (C) 2026 The eXeLearning project contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
'use strict';

/**
 * SCORM 1.2 API error codes. The specification defines exactly these eleven;
 * codes such as 103, 111 or 351 belong to SCORM 2004 and must never appear.
 * (204 and 205 appear in [RTE] as typos and are retracted by [ADD] 4.)
 */
const SCORM12_ERROR = {
    NO_ERROR: 0,
    GENERAL_EXCEPTION: 101,
    INVALID_ARGUMENT: 201,
    ELEMENT_CANNOT_HAVE_CHILDREN: 202,
    ELEMENT_NOT_AN_ARRAY: 203,
    NOT_INITIALIZED: 301,
    NOT_IMPLEMENTED: 401,
    INVALID_SET_VALUE_KEYWORD: 402,
    ELEMENT_IS_READ_ONLY: 403,
    ELEMENT_IS_WRITE_ONLY: 404,
    INCORRECT_DATA_TYPE: 405,
};

/** Official SCORM 1.2 error strings, keyed by code ([CR] 11.2). */
const SCORM12_ERROR_STRINGS = {
    0: 'No error',
    101: 'General exception',
    201: 'Invalid argument error',
    202: 'Element cannot have children',
    203: 'Element not an array - cannot have count',
    301: 'Not initialized',
    401: 'Not implemented error',
    402: 'Invalid set value, element is a keyword',
    403: 'Element is read only',
    404: 'Element is write only',
    405: 'Incorrect Data Type',
};

/** Access permissions, as the SCO sees them. */
const ACCESS = {
    READ_ONLY: 'ro',
    WRITE_ONLY: 'wo',
    READ_WRITE: 'rw',
};

/**
 * LMS capability tiers used by the conformance profiles.
 *
 * `mandatory` is exactly the LMS-RTE1 mandatory set ([CR] §2.1.1.3a req 1).
 * `common` and `extended` are project-defined groupings of the *optional*
 * elements, so that a test can run against a deliberately sparse LMS.
 */
const TIER = {
    MANDATORY: 'mandatory',
    COMMON: 'common',
    EXTENDED: 'extended',
};

/** Value cmi._version returns: the AICC/IEEE CMI data model version ([RTE] §3.3.2.1). */
const CMI_VERSION = '3.4';

/** SCORM 1.2 Status vocabulary ([CR] 10.11). */
const LESSON_STATUS_VOCABULARY = ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'];

/**
 * The subset a SCO may write to cmi.core.lesson_status. "not attempted" is
 * LMS-only. [CR] 1.6.5 verbatim (the LMS conformance requirement for this
 * element): "Not accept CMIVocabulary (Status) value of 'not attempted' for
 * this element from a SCO. (This value can only be set by the LMS)". Note
 * that secondary reference charts (e.g. scorm.com's run-time chart) list the
 * element as plain read/write with the full vocabulary and do not carry this
 * restriction — the ADL Conformance Requirements are the normative source.
 * cmi.objectives.n.status, by contrast, accepts the full vocabulary
 * including "not attempted" ([CR] 6.5.4).
 */
const LESSON_STATUS_SCO_VOCABULARY = ['passed', 'completed', 'failed', 'incomplete', 'browsed'];

/** SCORM 1.2 Exit vocabulary ("" means a normal, non-suspended exit). */
const EXIT_VOCABULARY = ['time-out', 'suspend', 'logout', ''];

/** SCORM 1.2 Credit vocabulary. */
const CREDIT_VOCABULARY = ['credit', 'no-credit'];

/** SCORM 1.2 Entry vocabulary ("" means "neither first launch nor resumed"). */
const ENTRY_VOCABULARY = ['ab-initio', 'resume', ''];

/** SCORM 1.2 Mode vocabulary. */
const LESSON_MODE_VOCABULARY = ['browse', 'normal', 'review'];

/** SCORM 1.2 Time Limit Action vocabulary. */
const TIME_LIMIT_ACTION_VOCABULARY = ['exit,message', 'exit,no message', 'continue,message', 'continue,no message'];

/** SCORM 1.2 Interaction vocabulary — note it includes "numeric" ([CR] 10.11.6). */
const INTERACTION_TYPE_VOCABULARY = [
    'true-false',
    'choice',
    'fill-in',
    'matching',
    'performance',
    'likert',
    'sequencing',
    'numeric',
];

/** SCORM 1.2 Result vocabulary (a CMIDecimal is also legal). */
const INTERACTION_RESULT_VOCABULARY = ['correct', 'wrong', 'unanticipated', 'neutral'];

/** cmi.objectives.n.status accepts the full Status vocabulary ([CR] 6.5.4). */
const OBJECTIVE_STATUS_VOCABULARY = LESSON_STATUS_VOCABULARY;

/**
 * CMITime — a point on a 24-hour clock, `HH:MM:SS[.ss]` ([CR] 10.9).
 * Hours 00-23, minutes and seconds 00-59.
 */
const CMI_TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,2})?$/;

/**
 * CMITimespan — a duration, `HHHH:MM:SS[.ss]` ([CR] 10.10). Hours take two to
 * four digits (0000-9999); minutes and seconds are two digits and legal up to
 * **99**, not 59. Do not reuse the CMITime pattern here.
 */
const CMI_TIMESPAN_PATTERN = /^[0-9]{2,4}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,2})?$/;

/**
 * The data model table.
 *
 * Keys are element *templates*: an `n` segment stands for an array index.
 * - `tier`      LMS capability tier (see TIER).
 * - `access`    permission as the SCO sees it.
 * - `type`      CMI data type name (validated by the fake LMS).
 * - `aggregate` the element groups children and has no value of its own.
 * - `array`     the element is a 0-based list and supports `_count`.
 * - `children`  the value `_children` returns (absent = the element has none,
 *               so `_children` answers 202).
 * - `initial`   the value the LMS presents on first launch.
 */
const DATA_MODEL = {
    'cmi.core': {
        tier: TIER.MANDATORY,
        access: ACCESS.READ_ONLY,
        aggregate: true,
        // The full list; the fake LMS filters it down to what the profile
        // implements, which is exactly what a SCO reads _children to learn.
        // The mandatory minimum ([CR] 1.1.3) is this list without lesson_mode.
        children:
            'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time',
    },
    'cmi.core.student_id': {
        tier: TIER.MANDATORY,
        access: ACCESS.READ_ONLY,
        type: 'CMIIdentifier',
        initial: 'exe-learner',
    },
    'cmi.core.student_name': {
        tier: TIER.MANDATORY,
        access: ACCESS.READ_ONLY,
        type: 'CMIString255',
        initial: 'Doe, Jane',
    },
    'cmi.core.lesson_location': {
        tier: TIER.MANDATORY,
        access: ACCESS.READ_WRITE,
        type: 'CMIString255',
        initial: '',
    },
    'cmi.core.credit': {
        tier: TIER.MANDATORY,
        access: ACCESS.READ_ONLY,
        type: 'CMIVocabulary',
        vocabulary: CREDIT_VOCABULARY,
        initial: 'credit',
    },
    'cmi.core.lesson_status': {
        tier: TIER.MANDATORY,
        access: ACCESS.READ_WRITE,
        type: 'CMIVocabulary',
        vocabulary: LESSON_STATUS_VOCABULARY,
        // The LMS refuses "not attempted" from a SCO ([CR] 1.6.5).
        writeVocabulary: LESSON_STATUS_SCO_VOCABULARY,
        initial: 'not attempted',
    },
    'cmi.core.entry': {
        tier: TIER.MANDATORY,
        access: ACCESS.READ_ONLY,
        type: 'CMIVocabulary',
        vocabulary: ENTRY_VOCABULARY,
        initial: 'ab-initio',
    },
    'cmi.core.score': {
        tier: TIER.MANDATORY,
        access: ACCESS.READ_WRITE,
        aggregate: true,
        // Must contain at least "raw" ([CR] 1.8.1.3); min/max are filtered out
        // by the fake LMS when the profile does not implement them.
        children: 'raw,min,max',
    },
    'cmi.core.score.raw': {
        tier: TIER.MANDATORY,
        access: ACCESS.READ_WRITE,
        type: 'CMIDecimal',
        min: 0,
        max: 100,
        allowBlank: true,
        initial: '',
    },
    // score.min / score.max are OPTIONAL in SCORM 1.2 ([CR] §2.1.1.3a req 2):
    // cmi.core.score._children tells the SCO which of raw/min/max exist.
    'cmi.core.score.min': {
        tier: TIER.COMMON,
        access: ACCESS.READ_WRITE,
        type: 'CMIDecimal',
        min: 0,
        max: 100,
        allowBlank: true,
        initial: '',
    },
    'cmi.core.score.max': {
        tier: TIER.COMMON,
        access: ACCESS.READ_WRITE,
        type: 'CMIDecimal',
        min: 0,
        max: 100,
        allowBlank: true,
        initial: '',
    },
    'cmi.core.total_time': {
        tier: TIER.MANDATORY,
        access: ACCESS.READ_ONLY,
        type: 'CMITimespan',
        initial: '0000:00:00.00',
    },
    'cmi.core.lesson_mode': {
        tier: TIER.COMMON,
        access: ACCESS.READ_ONLY,
        type: 'CMIVocabulary',
        vocabulary: LESSON_MODE_VOCABULARY,
        initial: 'normal',
    },
    'cmi.core.exit': {
        tier: TIER.MANDATORY,
        access: ACCESS.WRITE_ONLY,
        type: 'CMIVocabulary',
        vocabulary: EXIT_VOCABULARY,
    },
    'cmi.core.session_time': { tier: TIER.MANDATORY, access: ACCESS.WRITE_ONLY, type: 'CMITimespan' },

    'cmi.suspend_data': { tier: TIER.MANDATORY, access: ACCESS.READ_WRITE, type: 'CMIString4096', initial: '' },
    'cmi.launch_data': { tier: TIER.MANDATORY, access: ACCESS.READ_ONLY, type: 'CMIString4096', initial: '' },

    // The LMS appends each value a SCO writes to cmi.comments ([CR] 4.5).
    'cmi.comments': {
        tier: TIER.COMMON,
        access: ACCESS.READ_WRITE,
        type: 'CMIString4096',
        append: true,
        initial: '',
    },
    'cmi.comments_from_lms': { tier: TIER.COMMON, access: ACCESS.READ_ONLY, type: 'CMIString4096', initial: '' },

    'cmi.objectives': {
        tier: TIER.COMMON,
        access: ACCESS.READ_WRITE,
        aggregate: true,
        array: true,
        children: 'id,score,status',
    },
    'cmi.objectives.n.id': { tier: TIER.COMMON, access: ACCESS.READ_WRITE, type: 'CMIIdentifier', initial: '' },
    'cmi.objectives.n.score': {
        tier: TIER.COMMON,
        access: ACCESS.READ_WRITE,
        aggregate: true,
        children: 'raw,min,max',
    },
    'cmi.objectives.n.score.raw': {
        tier: TIER.COMMON,
        access: ACCESS.READ_WRITE,
        type: 'CMIDecimal',
        min: 0,
        max: 100,
        allowBlank: true,
        initial: '',
    },
    'cmi.objectives.n.score.min': {
        tier: TIER.COMMON,
        access: ACCESS.READ_WRITE,
        type: 'CMIDecimal',
        min: 0,
        max: 100,
        allowBlank: true,
        initial: '',
    },
    'cmi.objectives.n.score.max': {
        tier: TIER.COMMON,
        access: ACCESS.READ_WRITE,
        type: 'CMIDecimal',
        min: 0,
        max: 100,
        allowBlank: true,
        initial: '',
    },
    // Unlike cmi.core.lesson_status, this one does accept "not attempted".
    'cmi.objectives.n.status': {
        tier: TIER.COMMON,
        access: ACCESS.READ_WRITE,
        type: 'CMIVocabulary',
        vocabulary: OBJECTIVE_STATUS_VOCABULARY,
        initial: 'not attempted',
    },

    'cmi.student_data': {
        tier: TIER.COMMON,
        access: ACCESS.READ_ONLY,
        aggregate: true,
        children: 'mastery_score,max_time_allowed,time_limit_action',
    },
    'cmi.student_data.mastery_score': {
        tier: TIER.COMMON,
        access: ACCESS.READ_ONLY,
        type: 'CMIDecimal',
        min: 0,
        max: 100,
        allowBlank: true,
        initial: '',
    },
    'cmi.student_data.max_time_allowed': {
        tier: TIER.EXTENDED,
        access: ACCESS.READ_ONLY,
        type: 'CMITimespan',
        allowBlank: true,
        initial: '',
    },
    'cmi.student_data.time_limit_action': {
        tier: TIER.EXTENDED,
        access: ACCESS.READ_ONLY,
        type: 'CMIVocabulary',
        vocabulary: TIME_LIMIT_ACTION_VOCABULARY,
        // [ADD] Addendum 16: the default is the vocabulary value, not "".
        initial: 'continue,no message',
    },

    'cmi.student_preference': {
        tier: TIER.EXTENDED,
        access: ACCESS.READ_WRITE,
        aggregate: true,
        children: 'audio,language,speed,text',
    },
    'cmi.student_preference.audio': {
        tier: TIER.EXTENDED,
        access: ACCESS.READ_WRITE,
        type: 'CMISInteger',
        min: -1,
        max: 100,
        initial: '0',
    },
    'cmi.student_preference.language': {
        tier: TIER.EXTENDED,
        access: ACCESS.READ_WRITE,
        type: 'CMIString255',
        initial: '',
    },
    'cmi.student_preference.speed': {
        tier: TIER.EXTENDED,
        access: ACCESS.READ_WRITE,
        type: 'CMISInteger',
        min: -100,
        max: 100,
        initial: '0',
    },
    'cmi.student_preference.text': {
        tier: TIER.EXTENDED,
        access: ACCESS.READ_WRITE,
        type: 'CMISInteger',
        min: -1,
        max: 1,
        initial: '0',
    },

    // Every leaf of an interaction record is write-only in SCORM 1.2: a SCO
    // reports interactions, it never reads them back ([CR] §2.1.2.2 req 3.2).
    // Only cmi.interactions._children / ._count and the two nested _count
    // keywords are readable.
    'cmi.interactions': {
        tier: TIER.EXTENDED,
        access: ACCESS.WRITE_ONLY,
        aggregate: true,
        array: true,
        children: 'id,objectives,time,type,correct_responses,weighting,student_response,result,latency',
    },
    'cmi.interactions.n.id': { tier: TIER.EXTENDED, access: ACCESS.WRITE_ONLY, type: 'CMIIdentifier' },
    // No `children`: SCORM 1.2 defines no _children for this nested list.
    'cmi.interactions.n.objectives': {
        tier: TIER.EXTENDED,
        access: ACCESS.WRITE_ONLY,
        aggregate: true,
        array: true,
    },
    'cmi.interactions.n.objectives.n.id': {
        tier: TIER.EXTENDED,
        access: ACCESS.WRITE_ONLY,
        type: 'CMIIdentifier',
    },
    'cmi.interactions.n.time': { tier: TIER.EXTENDED, access: ACCESS.WRITE_ONLY, type: 'CMITime' },
    'cmi.interactions.n.type': {
        tier: TIER.EXTENDED,
        access: ACCESS.WRITE_ONLY,
        type: 'CMIVocabulary',
        vocabulary: INTERACTION_TYPE_VOCABULARY,
    },
    'cmi.interactions.n.correct_responses': {
        tier: TIER.EXTENDED,
        access: ACCESS.WRITE_ONLY,
        aggregate: true,
        array: true,
    },
    'cmi.interactions.n.correct_responses.n.pattern': {
        tier: TIER.EXTENDED,
        access: ACCESS.WRITE_ONLY,
        type: 'CMIFeedback',
    },
    // ADL defines no numeric range for interaction weighting.
    'cmi.interactions.n.weighting': { tier: TIER.EXTENDED, access: ACCESS.WRITE_ONLY, type: 'CMIDecimal' },
    'cmi.interactions.n.student_response': {
        tier: TIER.EXTENDED,
        access: ACCESS.WRITE_ONLY,
        type: 'CMIFeedback',
    },
    'cmi.interactions.n.result': {
        tier: TIER.EXTENDED,
        access: ACCESS.WRITE_ONLY,
        type: 'CMIResult',
        vocabulary: INTERACTION_RESULT_VOCABULARY,
    },
    'cmi.interactions.n.latency': { tier: TIER.EXTENDED, access: ACCESS.WRITE_ONLY, type: 'CMITimespan' },
};

/**
 * Conformance profiles: which capability tiers an LMS implements.
 *
 * - `minimal`      — only the LMS-RTE1 mandatory elements. Everything optional
 *                    answers 401 "not implemented". This is the profile that
 *                    proves the runtime never depends on an optional element.
 * - `intermediate` — mandatory plus the optional elements a typical LMS ships
 *                    (score.min/max, lesson_mode, comments, objectives,
 *                    mastery_score).
 * - `complete`     — every element in the data model.
 */
const PROFILES = {
    minimal: [TIER.MANDATORY],
    intermediate: [TIER.MANDATORY, TIER.COMMON],
    complete: [TIER.MANDATORY, TIER.COMMON, TIER.EXTENDED],
};

/**
 * Reduce a concrete element path to its data model template plus the array
 * indices it used, e.g. `cmi.objectives.2.score.raw` →
 * `{ template: 'cmi.objectives.n.score.raw', indices: [2] }`.
 *
 * SCORM 1.2 array indices are 0-based non-negative integers written in plain
 * decimal; `+1`, `-1` and `01x` are malformed rather than property names.
 *
 * @param {string} element - Concrete element path.
 * @returns {{template: string, indices: number[], malformedIndex: boolean}}
 */
function toTemplate(element) {
    const indices = [];
    let malformedIndex = false;
    const segments = String(element).split('.');
    const templateSegments = segments.map((segment, position) => {
        // The first segment is always the "cmi" root, never an index.
        if (position === 0) {
            return segment;
        }
        if (/^\d+$/.test(segment)) {
            indices.push(Number(segment));
            return 'n';
        }
        if (/^[+-]\d+$/.test(segment)) {
            malformedIndex = true;
            indices.push(Number.NaN);
            return 'n';
        }
        return segment;
    });
    return { template: templateSegments.join('.'), indices, malformedIndex };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ACCESS,
        CMI_TIMESPAN_PATTERN,
        CMI_TIME_PATTERN,
        CMI_VERSION,
        CREDIT_VOCABULARY,
        DATA_MODEL,
        ENTRY_VOCABULARY,
        INTERACTION_RESULT_VOCABULARY,
        INTERACTION_TYPE_VOCABULARY,
        LESSON_MODE_VOCABULARY,
        LESSON_STATUS_SCO_VOCABULARY,
        LESSON_STATUS_VOCABULARY,
        OBJECTIVE_STATUS_VOCABULARY,
        PROFILES,
        SCORM12_ERROR,
        SCORM12_ERROR_STRINGS,
        TIER,
        TIME_LIMIT_ACTION_VOCABULARY,
        toTemplate,
    };
}
