// Shared configuration for eXeLearning C10k load tests (issue #2255).
// Every value is overridable via k6 environment variables (`-e NAME=value` or `K6_NAME`).

function envInt(name, fallback) {
    const raw = __ENV[name];
    if (raw === undefined || raw === '') return fallback;
    const value = Number.parseInt(raw, 10);
    return Number.isNaN(value) ? fallback : value;
}

function envStr(name, fallback) {
    const raw = __ENV[name];
    return raw === undefined || raw === '' ? fallback : raw;
}

// Extracts the hostname (no protocol, no port) from a BASE_URL, used as the
// HOST_HEADER fallback so config.mjs never needs a hardcoded personal domain.
function hostnameFromUrl(url) {
    return url.replace(/^https?:\/\//, '').split(/[/:]/)[0];
}

export function getConfig() {
    const baseUrl = envStr('BASE_URL', 'http://localhost:8080');
    const hostHeader = envStr('HOST_HEADER', hostnameFromUrl(baseUrl));
    const wsBaseUrl = envStr('WS_BASE_URL', baseUrl.replace(/^http/, 'ws'));

    return {
        baseUrl,
        hostHeader,
        wsBaseUrl,
        // Credential pool used to log in. Real accounts must already exist on the
        // target deployment (see scripts/prepare.sh). Reusing a small pool of
        // accounts to own many independent projects is intentional: the
        // scalability model in issue #2255 is "many projects, few collaborators
        // per project", not "many distinct logged-in identities".
        userPrefix: envStr('BENCH_USER_PREFIX', 'bench-user-'),
        userCount: envInt('BENCH_USER_COUNT', 2),
        userDomain: envStr('BENCH_USER_DOMAIN', 'exelearning.net'),
        password: envStr('BENCH_PASSWORD', 'Bench1234!'),
        // Fallback single-account credentials (matches the seeded dev test user).
        fallbackEmail: envStr('BENCH_FALLBACK_EMAIL', 'user@exelearning.net'),
        fallbackPassword: envStr('BENCH_FALLBACK_PASSWORD', '1234'),
        // Path to the JSON file produced by scripts/prepare.sh describing the
        // pre-created projects available to run against.
        projectsFile: envStr('BENCH_PROJECTS_FILE', './test/load/data/projects.json'),
        thinkTimeMinS: envInt('THINK_TIME_MIN_S', 3),
        thinkTimeMaxS: envInt('THINK_TIME_MAX_S', 12),
        updateIntervalMinS: envInt('UPDATE_INTERVAL_MIN_S', 5),
        updateIntervalMaxS: envInt('UPDATE_INTERVAL_MAX_S', 20),
        holdDurationS: envInt('HOLD_DURATION_S', 600),
        rampUpS: envInt('RAMP_UP_S', 60),
        rampDownS: envInt('RAMP_DOWN_S', 30),
    };
}

export function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
}

// A single logical test can be sharded across multiple load-generator
// machines running the identical script (see test/load/README.md's
// "multi-generator" section). Each machine gets a disjoint slice of the
// account/project pool by setting VU_OFFSET to its share's starting index;
// __VU always restarts at 1 per k6 process, so plain `__VU - 1` would
// collide across machines without this offset.
export function globalVuIndex() {
    return envInt('VU_OFFSET', 0) + (__VU - 1);
}

export function authHeaders(config, token) {
    return {
        Host: config.hostHeader,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}
