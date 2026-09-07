// Loads the project pool produced by scripts/prepare.sh.
// `open()` is only valid during k6's init phase, so callers must invoke
// `loadProjects()` at the top level of a test script (not inside `default`,
// `setup`, or any callback).
export function loadProjects(path) {
    const raw = open(path);
    return JSON.parse(raw);
}

// Groups virtual users into projects of `usersPerProject` size, so a
// scenario with e.g. 40 VUs and usersPerProject=4 exercises 10 independent
// projects with 4 collaborators each, rather than everyone joining the same
// room or everyone getting their own.
export function pickProject(projects, vuIndex, usersPerProject) {
    if (projects.length === 0) {
        throw new Error('no projects available: run scripts/prepare.sh first');
    }
    const projectIndex = Math.floor(vuIndex / usersPerProject) % projects.length;
    return projects[projectIndex];
}
