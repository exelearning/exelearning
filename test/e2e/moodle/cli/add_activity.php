<?php
// SCORM grading audit harness — add one SCORM activity to the audit course.
//
// Works for Moodle core's mod_scorm and for the exelearning/mod_exescorm fork:
// both accept the same field names, only the module name and the grade-method
// constants' prefix differ, and both parse the package on instance creation.
//
// Usage:
//   php add_activity.php --module=scorm --package=/var/www/packages/x.zip \
//       --name=A1-scorm-main [--grademethod=1] [--maxgrade=100] [--maxattempt=1] \
//       [--whatgrade=0] [--forcenewattempt=0] [--auto=0] [--popup=0]
//
// Prints a JSON object describing the created activity, including every SCO the
// package parsed into, so the driver can address them by identifier.

define('CLI_SCRIPT', true);
require(__DIR__ . '/../config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->dirroot . '/lib/enrollib.php');

[$options, $unrecognised] = cli_get_params([
    'module' => 'scorm',
    'package' => '',
    'name' => '',
    'grademethod' => '1',
    'maxgrade' => '100',
    'maxattempt' => '1',
    'whatgrade' => '0',
    'forcenewattempt' => '0',
    'auto' => '0',
    'popup' => '0',
    'help' => false,
]);

if ($options['help'] || $options['package'] === '' || $options['name'] === '') {
    cli_writeln('Usage: php add_activity.php --module=scorm|exescorm --package=<zip> --name=<name> [...]');
    exit(1);
}

$module = $options['module'];
if (!in_array($module, ['scorm', 'exescorm'], true)) {
    cli_error('--module must be scorm or exescorm');
}
if (!file_exists($options['package'])) {
    cli_error('package not found: ' . $options['package']);
}

require_once($CFG->dirroot . '/mod/' . $module . '/lib.php');
require_once($CFG->dirroot . '/mod/' . $module . '/locallib.php');

$admin = get_admin();
\core\session\manager::set_user($admin);

// One course per activity.
//
// Piling every cell of a matrix into a single course is what a first version does, and it
// breaks at scale in a way that looks like a product bug: Moodle keeps the course total as
// a grade item whose maximum is the sum of its children, and after a few hundred
// activities at 100 points each the UPDATE fails with "Out of range value for column
// 'grademax'" — measured at cell 321 of a 400-cell run. A course is cheap, and one per
// activity also removes any gradebook cross-talk between cells, which is worth having on
// its own.
$parent = $DB->get_record('course', ['shortname' => 'SCORMAUDIT'], '*', MUST_EXIST);
$shortname = 'SCORMAUDIT-' . substr(sha1($options['name'] . microtime(true) . random_int(0, PHP_INT_MAX)), 0, 12);
$course = create_course((object) [
    'fullname'    => 'SCORM audit — ' . $options['name'],
    'shortname'   => $shortname,
    'category'    => $parent->category,
    'format'      => 'topics',
    'numsections' => 1,
    'visible'     => 1,
]);

// Enrol everyone the audit uses, so a cell can be played by any learner account.
$studentrole = $DB->get_record('role', ['shortname' => 'student'], '*', MUST_EXIST);
$enrol = $DB->get_record('enrol', ['courseid' => $course->id, 'enrol' => 'manual'], '*', MUST_EXIST);
$plugin = enrol_get_plugin('manual');
foreach ($DB->get_records_select('user', "username LIKE 'learner%'") as $learner) {
    $plugin->enrol_user($enrol, $learner->id, $studentrole->id);
}
$moduleid = $DB->get_field('modules', 'id', ['name' => $module], MUST_EXIST);

// Stage the package in the admin's draft file area; both modules read it from there.
$usercontext = context_user::instance($admin->id);
$draftitemid = file_get_unused_draft_itemid();
get_file_storage()->create_file_from_pathname([
    'component' => 'user',
    'filearea' => 'draft',
    'contextid' => $usercontext->id,
    'itemid' => $draftitemid,
    'filename' => basename($options['package']),
    'filepath' => '/',
], $options['package']);

$config = get_config($module);

$moduleinfo = (object) [
    'modulename' => $module,
    'module' => $moduleid,
    'course' => $course->id,
    'section' => 1,
    'visible' => 1,
    'name' => $options['name'],
    'introeditor' => ['text' => '', 'format' => FORMAT_HTML, 'itemid' => 0],
    'showdescription' => 0,
    // mod_exescorm renamed every field: it reads `exescormtype`, not `scormtype`.
    // Setting only the core name leaves its own property undefined, which makes its
    // type dispatch fall through silently instead of taking the local-package branch.
    'scormtype' => 'local',
    'exescormtype' => 'local',
    'packagefile' => $draftitemid,
    'packageurl' => '',
    'updatefreq' => 0,
    'popup' => (int) $options['popup'],
    'width' => $config->framewidth ?? 100,
    'height' => $config->frameheight ?? 500,
    'skipview' => 0,
    'hidebrowse' => 0,
    'displaycoursestructure' => 0,
    'hidetoc' => 0,
    'nav' => 1,
    'navpositionleft' => -100,
    'navpositiontop' => -100,
    'displayattemptstatus' => 1,
    'timeopen' => 0,
    'timeclose' => 0,
    'grademethod' => $options['grademethod'],
    'maxgrade' => $options['maxgrade'],
    'grade' => $options['maxgrade'],
    'maxattempt' => $options['maxattempt'],
    'whatgrade' => $options['whatgrade'],
    'forcenewattempt' => $options['forcenewattempt'],
    'lastattemptlock' => 0,
    'forcecompleted' => 0,
    'masteryoverride' => $config->masteryoverride ?? 1,
    'auto' => (int) $options['auto'],
    'completion' => COMPLETION_TRACKING_NONE,
    'completionunlocked' => 1,
    'visibleoncoursepage' => 1,
    'cmidnumber' => '',
    'groupmode' => 0,
    'groupingid' => 0,
];

$created = add_moduleinfo($moduleinfo, $course);

$instance = $DB->get_record($module, ['id' => $created->instance], '*', MUST_EXIST);
$scoes = $DB->get_records($module . '_scoes', [$module => $instance->id], 'sortorder, id');

$scolist = [];
foreach ($scoes as $sco) {
    $scolist[] = [
        'id' => (int) $sco->id,
        'identifier' => $sco->identifier,
        'title' => $sco->title,
        'launch' => $sco->launch,
        'scormtype' => $sco->scormtype ?? '',
        'sortorder' => (int) $sco->sortorder,
    ];
}

echo json_encode([
    'module' => $module,
    'cmid' => (int) $created->coursemodule,
    'instanceid' => (int) $instance->id,
    'name' => $instance->name,
    'grademethod' => (int) $instance->grademethod,
    'maxgrade' => (float) $instance->maxgrade,
    'version' => $instance->version,
    'launchurl' => (new moodle_url('/mod/' . $module . '/view.php', ['id' => $created->coursemodule]))->out(false),
    'playerurl' => (new moodle_url('/mod/' . $module . '/player.php', ['cm' => $created->coursemodule]))->out(false),
    'scoes' => $scolist,
], JSON_PRETTY_PRINT) . "\n";
