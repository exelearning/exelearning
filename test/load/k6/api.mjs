// Pure HTTP API workload (issue #2255). No WebSocket at all: measures REST
// latency/error-rate in isolation (login, list projects, get project, fetch
// the persisted Yjs document) so it can be compared against the same
// endpoints under WebSocket-heavy load in normal-editing.js/collaboration.js.
//
// Usage:
//   test/load/scripts/run.sh api <RUN_ID> -- -e TARGET_VUS=50 -e HOLD_DURATION_S=300
import http from 'k6/http';
import { check, sleep } from 'k6';
import { getConfig, authHeaders, randomBetween, globalVuIndex } from './lib/config.mjs';
import { login, accountForVu } from './lib/auth.mjs';
import { loadProjects, pickProject } from './lib/projects.mjs';

const config = getConfig();
const projects = loadProjects(config.projectsFile);
const targetVus = Number(__ENV.TARGET_VUS) || 50;

export const options = {
    scenarios: {
        api: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: `${config.rampUpS}s`, target: targetVus },
                { duration: `${config.holdDurationS}s`, target: targetVus },
                { duration: `${config.rampDownS}s`, target: 0 },
            ],
        },
    },
    thresholds: {
        http_req_failed: ['rate<0.01'],
    },
};

export default function () {
    const account = accountForVu(config, globalVuIndex());
    const token = login(config, account);
    if (!token) {
        // Without this, a fast-failing login (e.g. the server refusing
        // connections under overload) iterates far faster than a
        // successful pass would (which sleeps a think-time below),
        // turning any real slowdown into a self-inflicted retry storm.
        sleep(randomBetween(config.thinkTimeMinS, config.thinkTimeMaxS));
        return;
    }

    const project = pickProject(projects, globalVuIndex(), 1);
    const headers = authHeaders(config, token);

    const listRes = http.get(`${config.baseUrl}/api/v1/projects`, { headers, tags: { name: 'list_projects' } });
    check(listRes, { 'list projects ok': r => r.status === 200 });

    const getRes = http.get(`${config.baseUrl}/api/v1/projects/${project.uuid}`, {
        headers,
        tags: { name: 'get_project' },
    });
    check(getRes, { 'get project ok': r => r.status === 200 });

    const docRes = http.get(`${config.baseUrl}/api/projects/uuid/${project.uuid}/yjs-document`, {
        headers: { Host: config.hostHeader, Authorization: `Bearer ${token}` },
        tags: { name: 'get_yjs_document' },
    });
    check(docRes, { 'get yjs document ok': r => r.status === 200 || r.status === 404 });

    sleep(randomBetween(config.thinkTimeMinS, config.thinkTimeMaxS));
}
