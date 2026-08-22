/**
 * Bridge to the audit Moodle's CLI scripts.
 *
 * Creating an activity and reading back what Moodle persisted are done with PHP CLI
 * scripts running inside the Moodle container, never through the web UI: a grading
 * audit must assert on the database and the gradebook API, not on rendered HTML.
 *
 * The container name and the script directory are configurable so the same harness
 * can point at any Moodle stack.
 */
import { execFileSync } from 'child_process';
import type { HostActivity, ScormModule } from './lms-host';

const CONTAINER = process.env.AUDIT_MOODLE_CONTAINER ?? 'scormaudit-moodle-1';
const CLI_DIR = process.env.AUDIT_MOODLE_CLI_DIR ?? '/var/www/html/scormaudit';
const PACKAGE_DIR = process.env.AUDIT_MOODLE_PACKAGE_DIR ?? '/var/www/packages';

/** Everything Moodle persisted for one learner on one activity. */
export interface PersistedState {
    /** Which LMS produced this reading — evidence outlives the container it came from. */
    moodleRelease: string;
    moodleVersion: string;
    moduleVersion: string | null;
    module: ScormModule;
    cmid: number;
    instanceid: number;
    name: string;
    grademethod: number;
    maxgrade: number;
    whatgrade: number;
    username: string;
    scoes: { id: number; identifier: string; title: string; launch: string; scormtype: string }[];
    /** attempt number -> SCO identifier -> cmi element -> value. */
    tracks: Record<string, Record<string, Record<string, string>>>;
    moduleGradePerAttempt: Record<string, number>;
    moduleGrade: number;
    gradebook: number | null;
    gradebookMax: number | null;
}

/**
 * Run one CLI script in the Moodle container and parse its JSON output.
 *
 * @param script the script filename, e.g. 'add_activity.php'
 * @param args CLI arguments, already in `--name=value` form
 * @returns the parsed JSON the script printed
 */
function runCli<T>(script: string, args: string[]): T {
    const out = execFileSync('docker', ['exec', CONTAINER, 'php', `${CLI_DIR}/${script}`, ...args], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    });
    const start = out.indexOf('{');
    if (start === -1) throw new Error(`${script} printed no JSON:\n${out}`);
    return JSON.parse(out.slice(start)) as T;
}

/** Options accepted when creating an activity. */
export interface AddActivityOptions {
    module: ScormModule;
    /** Package filename as it exists in the container's package directory. */
    packageFile: string;
    name: string;
    grademethod?: number;
    maxgrade?: number;
    maxattempt?: number;
    whatgrade?: number;
    forcenewattempt?: number;
    auto?: number;
}

/** Create one SCORM activity in the audit course from a real exported package. */
export function addActivity(options: AddActivityOptions): HostActivity {
    const args = [
        `--module=${options.module}`,
        `--package=${PACKAGE_DIR}/${options.packageFile}`,
        `--name=${options.name}`,
        `--grademethod=${options.grademethod ?? 1}`,
        `--maxgrade=${options.maxgrade ?? 100}`,
        `--maxattempt=${options.maxattempt ?? 1}`,
        `--whatgrade=${options.whatgrade ?? 0}`,
        `--forcenewattempt=${options.forcenewattempt ?? 0}`,
        `--auto=${options.auto ?? 0}`,
    ];
    return runCli<HostActivity>('add_activity.php', args);
}

/** Read back every track, the module's own grade and the gradebook value. */
export function readState(cmid: number, username: string): PersistedState {
    return runCli<PersistedState>('read_state.php', [`--cmid=${cmid}`, `--username=${username}`]);
}
