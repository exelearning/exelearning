<?php
/**
 * Dump what one mod_exelearning activity has recorded for one learner: the attempt
 * rows the module owns and the values Moodle's gradebook holds for it.
 *
 *   php read_exelearning_state.php --cmid=123 --username=exelearner1
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
require_once($CFG->libdir . '/gradelib.php');

[$options, $unrecognised] = cli_get_params(['cmid' => '', 'username' => '']);
if ($unrecognised) {
    cli_error('Unrecognised: ' . implode(', ', $unrecognised));
}

$cm = get_coursemodule_from_id('exelearning', (int) $options['cmid'], 0, false, MUST_EXIST);
$instance = $DB->get_record('exelearning', ['id' => $cm->instance], '*', MUST_EXIST);
$user = $DB->get_record('user', ['username' => $options['username']], '*', MUST_EXIST);

$attempts = array_values(array_map(function ($row) {
    return [
        'attempt'     => (int) $row->attempt,
        'itemnumber'  => (int) $row->itemnumber,
        'rawscore'    => $row->rawscore === null ? null : (float) $row->rawscore,
        'maxscore'    => $row->maxscore === null ? null : (float) $row->maxscore,
        'scaledscore' => $row->scaledscore === null ? null : (float) $row->scaledscore,
        'status'      => $row->status,
        'gradable'    => (int) $row->gradable,
        'session'     => $row->sessiontoken,
    ];
}, $DB->get_records('exelearning_attempt', [
    'exelearningid' => $instance->id,
    'userid'        => $user->id,
], 'attempt, itemnumber')));

$grades = grade_get_grades($instance->course, 'mod', 'exelearning', $instance->id, $user->id);
$book = [];
foreach ($grades->items as $itemnumber => $item) {
    $g = $item->grades[$user->id] ?? null;
    $book[] = [
        'itemnumber' => (int) $itemnumber,
        'itemname'   => $item->name,
        'grademax'   => (float) $item->grademax,
        'grade'      => ($g === null || $g->grade === null) ? null : (float) $g->grade,
    ];
}

$items = array_values(array_map(function ($row) {
    return ['itemnumber' => (int) $row->itemnumber, 'objectid' => $row->objectid, 'name' => $row->name,
            'deleted' => (int) $row->deleted];
}, $DB->get_records('exelearning_grade_item', ['exelearningid' => $instance->id], 'itemnumber')));

echo json_encode([
    'cmid'         => (int) $cm->id,
    'instanceid'   => (int) $instance->id,
    'grademodel'   => (int) $instance->grademodel,
    'gradeenabled' => (int) $instance->gradeenabled,
    'username'     => $user->username,
    'attempts'     => $attempts,
    'gradeitems'   => $items,
    'gradebook'    => $book,
], JSON_PRETTY_PRINT), "\n";
