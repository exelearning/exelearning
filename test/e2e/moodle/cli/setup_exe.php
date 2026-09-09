<?php
/**
 * Provision the live mod_exelearning grading harness: one course, one teacher-owned
 * activity per requested configuration, and learner accounts to play them.
 *
 * Run inside the container:
 *   php /var/www/html/exeaudit/setup_exe.php
 *
 * @package mod_exelearning
 */
define('CLI_SCRIPT', true);
// Find Moodle's config.php upwards from wherever this directory is mounted.
$configdir = __DIR__;
while ($configdir !== '/' && !file_exists($configdir . '/config.php')) {
    $configdir = dirname($configdir);
}
require($configdir . '/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/user/lib.php');
require_once($CFG->dirroot . '/lib/enrollib.php');

const AUDIT_PASSWORD = 'Audit#1234';
const AUDIT_COURSE_SHORTNAME = 'EXEAUDIT';

/**
 * Fetch or create the audit course.
 *
 * @return stdClass The course record.
 */
function audit_course(): stdClass {
    global $DB, $CFG;
    require_once($CFG->dirroot . '/course/lib.php');

    $course = $DB->get_record('course', ['shortname' => AUDIT_COURSE_SHORTNAME]);
    if ($course) {
        return $course;
    }
    return create_course((object) [
        'fullname'  => 'mod_exelearning grading audit',
        'shortname' => AUDIT_COURSE_SHORTNAME,
        'category'  => 1,
        'format'    => 'topics',
        'numsections' => 3,
    ]);
}

/**
 * Fetch or create one learner and enrol them in the course.
 *
 * @param string $username Account to provision.
 * @param stdClass $course Course to enrol into.
 * @return stdClass The user record.
 */
function audit_learner(string $username, stdClass $course): stdClass {
    global $DB;

    $user = $DB->get_record('user', ['username' => $username]);
    if (!$user) {
        $new = (object) [
            'username'  => $username,
            'auth'      => 'manual',
            'confirmed' => 1,
            'mnethostid' => 1,
            'email'     => $username . '@example.invalid',
            'firstname' => ucfirst($username),
            'lastname'  => 'Audit',
        ];
        $id = user_create_user($new, false, false);
        $user = $DB->get_record('user', ['id' => $id], '*', MUST_EXIST);
    }
    update_internal_user_password($user, AUDIT_PASSWORD);

    $role = $DB->get_record('role', ['shortname' => 'student'], '*', MUST_EXIST);
    $instance = $DB->get_record('enrol', ['courseid' => $course->id, 'enrol' => 'manual'], '*', MUST_EXIST);
    $plugin = enrol_get_plugin('manual');
    $plugin->enrol_user($instance, $user->id, $role->id);

    return $user;
}

$course = audit_course();
$learners = [];
foreach (['exelearner1', 'exelearner2', 'exelearner3', 'exelearner4'] as $name) {
    $u = audit_learner($name, $course);
    $learners[] = ['username' => $u->username, 'id' => (int) $u->id];
}

echo json_encode([
    'course'   => ['id' => (int) $course->id, 'shortname' => $course->shortname],
    'learners' => $learners,
    'password' => AUDIT_PASSWORD,
], JSON_PRETTY_PRINT), "\n";
