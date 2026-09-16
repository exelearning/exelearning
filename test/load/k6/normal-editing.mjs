// Realistic editing workload (issue #2255, phase 3).
// Each VU logs in, opens one project's Yjs WebSocket, then for the whole
// session randomly alternates between: sending a small Yjs-shaped update
// over the socket, polling a cheap metadata endpoint, and autosaving via the
// REST endpoint — with randomized think time so traffic isn't synchronized
// across VUs. USERS_PER_PROJECT controls how many VUs share one project,
// modeling the "many independent projects, few collaborators" scenario from
// the issue (1, 2, 4, 10).
//
// Usage:
//   test/load/scripts/run.sh normal-editing <RUN_ID> -- \
//       -e TARGET_VUS=40 -e USERS_PER_PROJECT=4 -e HOLD_DURATION_S=600
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { getConfig, authHeaders, randomBetween, globalVuIndex } from './lib/config.mjs';
import { login, accountForVu } from './lib/auth.mjs';
import { loadProjects, pickProject } from './lib/projects.mjs';
import { wsUrl, fakeYjsUpdate } from './lib/ws.mjs';

const config = getConfig();
const projects = loadProjects(config.projectsFile);
const targetVus = Number(__ENV.TARGET_VUS) || 40;
const usersPerProject = Number(__ENV.USERS_PER_PROJECT) || 1;

export const wsConnectSuccess = new Counter('bench_ws_connect_success');
export const wsConnectFailure = new Counter('bench_ws_connect_failure');
export const wsUnexpectedClose = new Counter('bench_ws_unexpected_close');
export const wsHeldOpenFullDuration = new Counter('bench_ws_held_open_full_duration');
export const editsSent = new Counter('bench_edits_sent');
export const autosaveDuration = new Trend('bench_autosave_duration_ms', true);
export const metadataPollDuration = new Trend('bench_metadata_poll_duration_ms', true);

export const options = {
    scenarios: {
        normal_editing: {
            executor: 'ramping-vus',
            startVUs: 0,
            // See idle-websocket.js for why a trailing plateau stage exists.
            stages: [
                { duration: `${config.rampUpS}s`, target: targetVus },
                { duration: '5s', target: targetVus },
            ],
            gracefulRampDown: `${config.holdDurationS + 60}s`,
            gracefulStop: `${config.holdDurationS + 60}s`,
        },
    },
    thresholds: {
        bench_ws_connect_failure: [`count<${Math.ceil(targetVus * 0.01) + 1}`],
        http_req_failed: ['rate<0.01'],
    },
};

function autosave(token, projectUuid) {
    const start = Date.now();
    const res = http.post(
        `${config.baseUrl}/api/projects/uuid/${projectUuid}/yjs-document`,
        fakeYjsUpdate(200 + Math.floor(Math.random() * 800)),
        { headers: { Host: config.hostHeader, Authorization: `Bearer ${token}` }, tags: { name: 'autosave' } },
    );
    autosaveDuration.add(Date.now() - start);
    check(res, { 'autosave accepted': r => r.status >= 200 && r.status < 300 });
}

function pollMetadata(token, projectUuid) {
    const start = Date.now();
    const res = http.get(`${config.baseUrl}/api/v1/projects/${projectUuid}`, {
        headers: authHeaders(config, token),
        tags: { name: 'get_project' },
    });
    metadataPollDuration.add(Date.now() - start);
    check(res, { 'metadata poll ok': r => r.status === 200 });
}

export default function () {
    const project = pickProject(projects, globalVuIndex(), usersPerProject);

    // New projects default to 'private' visibility (no sharing set up by
    // prepare.sh), so every VU sharing a project (USERS_PER_PROJECT > 1)
    // must authenticate as that project's actual owner — accountForVu()
    // picks independently of which project was chosen and would get most
    // VUs an ACCESS_DENIED close right after the WS handshake (see
    // collaboration.mjs for the same issue and fuller explanation).
    const account =
        usersPerProject > 1
            ? { email: project.ownerEmail, password: config.password }
            : accountForVu(config, globalVuIndex());
    const token = login(config, account);
    if (!token) {
        // See idle-websocket.mjs for why this sleeps instead of returning
        // immediately: ramping-vus recycles a fast-failing VU into a new
        // iteration right away, which turns any real server slowdown into
        // a self-inflicted retry storm.
        sleep(config.holdDurationS);
        return;
    }

    const url = wsUrl(config, project.uuid, token);
    let sawOpen = false;
    let closedCleanly = false;
    let heldFullDuration = false;

    ws.connect(url, { headers: { Host: config.hostHeader } }, socket => {
        socket.on('open', () => {
            sawOpen = true;
            wsConnectSuccess.add(1);
            socket.sendBinary(fakeYjsUpdate());

            const scheduleNext = () => {
                const delayS = randomBetween(config.updateIntervalMinS, config.updateIntervalMaxS);
                socket.setTimeout(() => {
                    const action = Math.random();
                    if (action < 0.6) {
                        socket.sendBinary(fakeYjsUpdate());
                        editsSent.add(1);
                    } else if (action < 0.85) {
                        pollMetadata(token, project.uuid);
                    } else {
                        autosave(token, project.uuid);
                    }
                    scheduleNext();
                }, delayS * 1000);
            };
            scheduleNext();
        });

        socket.on('message', () => {});
        socket.on('binaryMessage', () => {});
        socket.on('error', () => {});
        socket.on('close', () => {
            closedCleanly = true;
        });

        socket.setTimeout(() => {
            heldFullDuration = true;
            socket.close();
        }, config.holdDurationS * 1000);
    });

    if (!sawOpen) {
        wsConnectFailure.add(1);
        sleep(config.holdDurationS);
    } else if (!closedCleanly) {
        wsUnexpectedClose.add(1);
    } else if (heldFullDuration) {
        wsHeldOpenFullDuration.add(1);
    } else {
        // Opened and closed cleanly, but before our own holdDurationS timer
        // fired — e.g. an application-level close code. Guard against a
        // retry storm the same way a real failure does; see
        // idle-websocket.mjs.
        sleep(config.holdDurationS);
    }
}
