<?php
// SCORM grading audit harness — read back everything Moodle persisted.
//
// Emits, for one activity and one learner:
//   - every cmi element stored per SCO and per attempt (the raw truth),
//   - the module's own computed grade (scorm_grade_user / exescorm_grade_user),
//   - the value that actually landed in the gradebook.
//
// The two modules store tracking in different shapes: Moodle 5.x mod_scorm
// normalises into scorm_attempt + scorm_element + scorm_scoes_value, while
// mod_exescorm still carries the pre-4.5 flat exescorm_scoes_track table.
//
// Usage: php read_state.php --cmid=42 --username=learner1

define('CLI_SCRIPT', true);
require(__DIR__ . '/../config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->libdir . '/gradelib.php');

[$options, $unrecognised] = cli_get_params([
    'cmid' => '',
    'username' => '',
    'help' => false,
]);

if ($options['help'] || $options['cmid'] === '' || $options['username'] === '') {
    cli_writeln('Usage: php read_state.php --cmid=<cmid> --username=<username>');
    exit(1);
}

$cm = get_coursemodule_from_id('', (int) $options['cmid'], 0, false, MUST_EXIST);
$module = $cm->modname;
if (!in_array($module, ['scorm', 'exescorm'], true)) {
    cli_error('cmid ' . $options['cmid'] . ' is a ' . $module . ', not a SCORM activity');
}

require_once($CFG->dirroot . '/mod/' . $module . '/lib.php');
require_once($CFG->dirroot . '/mod/' . $module . '/locallib.php');

$instance = $DB->get_record($module, ['id' => $cm->instance], '*', MUST_EXIST);
$user = $DB->get_record('user', ['username' => $options['username']], '*', MUST_EXIST);
$scoes = $DB->get_records($module . '_scoes', [$module => $instance->id], 'sortorder, id');

/**
 * Read every stored cmi element, keyed attempt -> sco identifier -> element -> value.
 *
 * @param string $module either 'scorm' or 'exescorm'
 * @param stdClass $instance the activity instance record
 * @param stdClass $user the learner
 * @param array $scoes the activity's SCO records, keyed by id
 * @return array nested array of attempt number => sco identifier => element => value
 */
function audit_read_tracks(string $module, stdClass $instance, stdClass $user, array $scoes): array {
    global $DB;
    $byid = [];
    foreach ($scoes as $sco) {
        $byid[(int) $sco->id] = $sco->identifier;
    }

    $out = [];
    if ($module === 'scorm' && $DB->get_manager()->table_exists('scorm_scoes_value')) {
        $sql = "SELECT v.id, a.attempt, v.scoid, e.element, v.value, v.timemodified
                  FROM {scorm_attempt} a
                  JOIN {scorm_scoes_value} v ON v.attemptid = a.id
                  JOIN {scorm_element} e ON e.id = v.elementid
                 WHERE a.userid = :userid AND a.scormid = :scormid
              ORDER BY a.attempt, v.scoid, e.element";
        $rows = $DB->get_records_sql($sql, ['userid' => $user->id, 'scormid' => $instance->id]);
    } else {
        $table = $module . '_scoes_track';
        $sql = "SELECT t.id, t.attempt, t.scoid, t.element, t.value, t.timemodified
                  FROM {" . $table . "} t
                 WHERE t.userid = :userid AND t." . $module . "id = :instanceid
              ORDER BY t.attempt, t.scoid, t.element";
        $rows = $DB->get_records_sql($sql, ['userid' => $user->id, 'instanceid' => $instance->id]);
    }

    foreach ($rows as $row) {
        $attempt = (int) $row->attempt;
        $identifier = $byid[(int) $row->scoid] ?? ('scoid-' . (int) $row->scoid);
        $out[$attempt][$identifier][$row->element] = $row->value;
    }
    return $out;
}

$tracks = audit_read_tracks($module, $instance, $user, $scoes);

// The module's own verdict, per attempt and overall.
$gradefn = $module . '_grade_user';
$attemptfn = $module . '_grade_user_attempt';
$peratempt = [];
foreach (array_keys($tracks) as $attempt) {
    $peratempt[$attempt] = (float) $attemptfn($instance, $user->id, $attempt);
}
$modulegrade = (float) $gradefn($instance, $user->id);

// What the gradebook actually holds.
$grades = grade_get_grades($cm->course, 'mod', $module, $instance->id, $user->id);
$gradeitem = reset($grades->items);
$gradebook = null;
$gradebookmax = null;
if ($gradeitem) {
    $gradebookmax = (float) $gradeitem->grademax;
    $gradeinfo = $gradeitem->grades[$user->id] ?? null;
    if ($gradeinfo && $gradeinfo->grade !== null && $gradeinfo->grade !== '') {
        $gradebook = (float) $gradeinfo->grade;
    }
}

$scolist = [];
foreach ($scoes as $sco) {
    $scolist[] = [
        'id' => (int) $sco->id,
        'identifier' => $sco->identifier,
        'title' => $sco->title,
        'launch' => $sco->launch,
        'scormtype' => $sco->scormtype ?? '',
    ];
}

// Which LMS produced this reading. Evidence outlives the container it came from, and a
// grading result that cannot name its host is not attributable.
$moduleversion = $DB->get_field('config_plugins', 'value', ['plugin' => 'mod_' . $module, 'name' => 'version']);

echo json_encode([
    'moodleRelease'  => $CFG->release,
    'moodleVersion'  => $CFG->version,
    'moduleVersion'  => $moduleversion === false ? null : $moduleversion,
    'module' => $module,
    'cmid' => (int) $cm->id,
    'instanceid' => (int) $instance->id,
    'name' => $instance->name,
    'grademethod' => (int) $instance->grademethod,
    'maxgrade' => (float) $instance->maxgrade,
    'whatgrade' => (int) $instance->whatgrade,
    'username' => $user->username,
    'scoes' => $scolist,
    'tracks' => $tracks,
    'moduleGradePerAttempt' => $peratempt,
    'moduleGrade' => $modulegrade,
    'gradebook' => $gradebook,
    'gradebookMax' => $gradebookmax,
], JSON_PRETTY_PRINT) . "\n";
