<?php
// SCORM grading audit harness — environment setup.
//
// Creates (idempotently) the audit course and the learner accounts the harness
// drives. Safe to run repeatedly: every object is looked up before it is created.
//
// Usage: php /var/www/html/scormaudit/setup.php

define('CLI_SCRIPT', true);
require(__DIR__ . '/../config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->libdir . '/enrollib.php');

/** Learner accounts the harness logs in as. One per parallel lane. */
const AUDIT_LEARNERS = ['learner1', 'learner2', 'learner3', 'learner4'];
const AUDIT_PASSWORD = 'Audit#1234';
const AUDIT_COURSE_SHORTNAME = 'SCORMAUDIT';

/**
 * Fetch the audit course, creating it on first run.
 *
 * @return stdClass the course record
 */
function audit_course(): stdClass {
    global $DB;
    $course = $DB->get_record('course', ['shortname' => AUDIT_COURSE_SHORTNAME]);
    if ($course) {
        return $course;
    }
    $category = $DB->get_record('course_categories', [], 'id', IGNORE_MULTIPLE);
    $data = (object) [
        'fullname' => 'SCORM Grading Audit',
        'shortname' => AUDIT_COURSE_SHORTNAME,
        'category' => $category->id,
        'format' => 'topics',
        'numsections' => 40,
        'enablecompletion' => 1,
    ];
    return create_course($data);
}

/**
 * Fetch a learner account, creating and enrolling it on first run.
 *
 * @param string $username the account to ensure exists
 * @param stdClass $course the course to enrol the account into
 * @return stdClass the user record
 */
function audit_learner(string $username, stdClass $course): stdClass {
    global $DB, $CFG;
    require_once($CFG->dirroot . '/user/lib.php');

    $user = $DB->get_record('user', ['username' => $username, 'mnethostid' => $CFG->mnet_localhost_id]);
    if (!$user) {
        $new = (object) [
            'username' => $username,
            'password' => AUDIT_PASSWORD,
            'firstname' => ucfirst($username),
            'lastname' => 'Audit',
            'email' => $username . '@example.invalid',
            'auth' => 'manual',
            'confirmed' => 1,
            'mnethostid' => $CFG->mnet_localhost_id,
        ];
        $id = user_create_user($new, false, false);
        $user = $DB->get_record('user', ['id' => $id]);
    }

    // Always (re)set the password explicitly. user_create_user()'s own password
    // handling is subject to the site policy and can leave the account unusable
    // without failing, which shows up much later as "Invalid login" in the driver.
    update_internal_user_password($user, AUDIT_PASSWORD);
    $user = $DB->get_record('user', ['id' => $user->id]);

    $context = context_course::instance($course->id);
    $studentrole = $DB->get_record('role', ['shortname' => 'student']);
    if (!is_enrolled($context, $user)) {
        $instance = $DB->get_record('enrol', ['courseid' => $course->id, 'enrol' => 'manual'], '*', MUST_EXIST);
        enrol_get_plugin('manual')->enrol_user($instance, $user->id, $studentrole->id);
    }
    return $user;
}

$course = audit_course();
$learners = [];
foreach (AUDIT_LEARNERS as $username) {
    $learner = audit_learner($username, $course);
    $learners[$username] = (int) $learner->id;
}

echo json_encode([
    'courseid' => (int) $course->id,
    'shortname' => $course->shortname,
    'learners' => $learners,
    'password' => AUDIT_PASSWORD,
], JSON_PRETTY_PRINT) . "\n";
