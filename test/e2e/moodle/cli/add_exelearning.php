<?php
/**
 * Create one mod_exelearning activity from an ELPX package, the way the module form
 * does, and print what a grading run needs to address it.
 *
 *   php add_exelearning.php --package=/path/to.elpx --name=X [--grademodel=0|1]
 *       [--gradeenabled=1] [--grademethod=0] [--grademax=100] [--maxattempt=0]
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
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->libdir . '/filelib.php');
require_once($CFG->libdir . '/gradelib.php');

[$options, $unrecognised] = cli_get_params([
    'package'      => '',
    'name'         => 'exelearning-audit',
    'course'       => 'EXEAUDIT',
    'grademodel'   => '1',
    'gradeenabled' => '1',
    'grademethod'  => '0',
    'grademax'     => '100',
    'gradepass'    => '0',
    'maxattempt'   => '0',
    'section'      => '0',
]);
if ($unrecognised) {
    cli_error('Unrecognised: ' . implode(', ', $unrecognised));
}
if ($options['package'] === '' || !file_exists($options['package'])) {
    cli_error('--package must point at an existing .elpx file');
}

$admin = get_admin();
\core\session\manager::set_user($admin);

$course = $DB->get_record('course', ['shortname' => $options['course']], '*', MUST_EXIST);

// The form posts the package as a draft file; mirror that rather than reaching into
// the plugin's internals, so the instance is built by the same code a teacher runs.
$usercontext = context_user::instance($admin->id);
$draftid = file_get_unused_draft_itemid();
get_file_storage()->create_file_from_pathname([
    'component' => 'user',
    'filearea'  => 'draft',
    'contextid' => $usercontext->id,
    'itemid'    => $draftid,
    'filepath'  => '/',
    'filename'  => basename($options['package']),
    'userid'    => $admin->id,
], $options['package']);

$moduleinfo = (object) [
    'modulename'       => 'exelearning',
    'module'           => $DB->get_field('modules', 'id', ['name' => 'exelearning'], MUST_EXIST),
    'course'           => $course->id,
    'section'          => (int) $options['section'],
    'visible'          => 1,
    'name'             => $options['name'],
    // add_moduleinfo() reads this without checking; leaving it unset makes the
    // script emit a PHP warning into the JSON it is supposed to print.
    'cmidnumber'       => '',
    'intro'            => '',
    'introformat'      => FORMAT_HTML,
    'package'          => $draftid,
    'grademodel'       => (int) $options['grademodel'],
    'gradeenabled'     => (int) $options['gradeenabled'],
    'grademethod'      => (int) $options['grademethod'],
    'grademax'         => (float) $options['grademax'],
    'grademin'         => 0,
    'gradepass'        => (float) $options['gradepass'],
    'gradedisplaytype' => 0,
    'maxattempt'       => (int) $options['maxattempt'],
    'reviewmode'       => 1,
    'completion'       => 0,
    'completionview'   => 0,
];

$created = add_moduleinfo($moduleinfo, $course);
$instance = $DB->get_record('exelearning', ['id' => $created->instance], '*', MUST_EXIST);

$items = array_values(array_map(function ($row) {
    return [
        'itemnumber' => (int) $row->itemnumber,
        'objectid'   => $row->objectid,
        'name'       => $row->name,
        'weight'     => isset($row->weight) ? (float) $row->weight : null,
        'deleted'    => (int) $row->deleted,
    ];
}, $DB->get_records('exelearning_grade_item', ['exelearningid' => $instance->id], 'itemnumber')));

echo json_encode([
    'cmid'         => (int) $created->coursemodule,
    'instanceid'   => (int) $instance->id,
    'courseid'     => (int) $course->id,
    'name'         => $instance->name,
    'grademodel'   => (int) $instance->grademodel,
    'gradeenabled' => (int) $instance->gradeenabled,
    'grademethod'  => (int) $instance->grademethod,
    'grademax'     => (float) $instance->grademax,
    'maxattempt'   => (int) $instance->maxattempt,
    'url'          => (new moodle_url('/mod/exelearning/view.php', ['id' => $created->coursemodule]))->out(false),
    'gradeitems'   => $items,
], JSON_PRETTY_PRINT), "\n";
