// Smoke test for issue #2255 (C10k benchmark). ~10 VUs, one iteration each:
// login -> open a project -> connect the Yjs WebSocket -> exchange a couple
// of frames -> read project metadata over HTTP -> disconnect cleanly.
//
// Purpose: validate authentication, WebSocket upgrade, script wiring, and
// metric collection before attempting any real concurrency. See
// test/load/README.md for how to run this and every other scenario.
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { getConfig, authHeaders, globalVuIndex } from './lib/config.mjs';
import { login, accountForVu } from './lib/auth.mjs';
import { loadProjects, pickProject } from './lib/projects.mjs';
import { wsUrl, fakeYjsUpdate } from './lib/ws.mjs';

const config = getConfig();
const projects = loadProjects(config.projectsFile);

export const wsConnectSuccess = new Counter('bench_ws_connect_success');
export const wsConnectFailure = new Counter('bench_ws_connect_failure');
export const wsConnectDuration = new Trend('bench_ws_connect_duration_ms', true);
export const wsUnexpectedClose = new Counter('bench_ws_unexpected_close');

export const options = {
    scenarios: {
        smoke: {
            executor: 'per-vu-iterations',
            vus: Number(__ENV.SMOKE_VUS) || 10,
            iterations: 1,
            maxDuration: '2m',
        },
    },
    thresholds: {
        bench_login_failure: ['count==0'],
        bench_ws_connect_failure: ['count==0'],
        http_req_failed: ['rate==0'],
    },
};

export default function () {
    const account = accountForVu(config, globalVuIndex());
    const token = login(config, account);
    if (!token) return;

    const project = pickProject(projects, globalVuIndex(), 1);

    const metaRes = http.get(`${config.baseUrl}/api/v1/projects/${project.uuid}`, {
        headers: authHeaders(config, token),
        tags: { name: 'get_project' },
    });
    check(metaRes, { 'project metadata reachable': r => r.status === 200 });

    const url = wsUrl(config, project.uuid, token);
    const connectStart = Date.now();
    let sawOpen = false;
    let closedCleanly = false;

    const res = ws.connect(url, { headers: { Host: config.hostHeader } }, socket => {
        socket.on('open', () => {
            sawOpen = true;
            wsConnectDuration.add(Date.now() - connectStart);
            wsConnectSuccess.add(1);
            socket.sendBinary(fakeYjsUpdate());
        });

        socket.on('message', () => {});
        socket.on('binaryMessage', () => {});

        socket.on('close', () => {
            closedCleanly = true;
        });

        socket.on('error', () => {});

        socket.setTimeout(() => {
            socket.close();
        }, 3000);
    });

    check(res, { 'ws handshake status 101': r => r && r.status === 101 });
    if (!sawOpen) {
        wsConnectFailure.add(1);
    } else if (!closedCleanly) {
        wsUnexpectedClose.add(1);
    }

    sleep(1);
}
