<?php
/**
 * Create a NEW eXeLearning activity holding the current evil.elpx, through the module's
 * own creation path (create_module → exelearning_add_instance → package_manager), so the
 * activity is built exactly as a teacher's upload would build it.
 *
 * Run inside the Moodle container:
 *   php /tmp/moodle-import-evil.php
 */

define('CLI_SCRIPT', true);
require(__DIR__ . '/../var/www/html/config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->libdir . '/filelib.php');

$source = '/tmp/evil.elpx';
if (!file_exists($source)) {
    cli_error("missing $source");
}

// Reuse the course that already carries an eXeLearning activity, so the new one lands
// somewhere a reviewer can find it rather than in a course of its own.
$existing = $DB->get_record('course_modules', ['id' => 6], '*', IGNORE_MISSING);
$courseid = $existing ? (int) $existing->course : (int) $DB->get_field_sql(
    'SELECT MIN(id) FROM {course} WHERE id > 1'
);
$course = get_course($courseid);

$admin = get_admin();
\core\session\manager::set_user($admin);

// Stage the package in a draft area, which is what the form would hand the module.
$draftid = file_get_unused_draft_itemid();
$usercontext = context_user::instance($admin->id);
get_file_storage()->create_file_from_pathname(
    (object) [
        'contextid' => $usercontext->id,
        'component' => 'user',
        'filearea'  => 'draft',
        'itemid'    => $draftid,
        'filepath'  => '/',
        'filename'  => 'evil.elpx',
    ],
    $source
);

$moduleinfo = (object) [
    'modulename'     => 'exelearning',
    'module'         => (int) $DB->get_field('modules', 'id', ['name' => 'exelearning']),
    'course'         => $course->id,
    'section'        => 0,
    'visible'        => 1,
    'name'           => 'evil.elpx (adversarial probe)',
    // create_module() validates the FORM shape, so the intro arrives as an editor
    // array rather than as intro/introformat scalars.
    'introeditor'    => [
        'text'   => 'Untrusted-content probe from the LMS security paper.',
        'format' => FORMAT_HTML,
        'itemid' => file_get_unused_draft_itemid(),
    ],
    'package'        => $draftid,
    'displaymode'    => 0,
    'completion'     => 0,
];

$created = create_module($moduleinfo);

rebuild_course_cache($course->id, true);

echo json_encode([
    'cmid'   => (int) $created->coursemodule,
    'course' => (int) $course->id,
    'url'    => (string) (new moodle_url('/mod/exelearning/view.php', ['id' => $created->coursemodule])),
]), PHP_EOL;
