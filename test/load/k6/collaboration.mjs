// Collaboration fan-out test (issue #2255, phase 4).
// Concentrates COLLABORATORS virtual users on PROJECT_COUNT project(s)
// (default 1), all editing concurrently, to measure the cost of message
// fan-out within a single Yjs room — a different scalability question from
// "many independent idle/editing projects" (see idle-websocket.js and
// normal-editing.js).
//
// Usage:
//   test/load/scripts/run.sh collaboration <RUN_ID> -- \
//       -e COLLABORATORS=50 -e PROJECT_COUNT=1 -e HOLD_DURATION_S=300
import ws from 'k6/ws';
import { sleep } from 'k6';
import { Counter } from 'k6/metrics';
import { getConfig, randomBetween, globalVuIndex } from './lib/config.mjs';
import { login } from './lib/auth.mjs';
import { loadProjects, pickProject } from './lib/projects.mjs';
import { wsUrl, fakeYjsUpdate } from './lib/ws.mjs';

const config = getConfig();
const projects = loadProjects(config.projectsFile);
const collaborators = Number(__ENV.COLLABORATORS) || 10;
const projectCount = Number(__ENV.PROJECT_COUNT) || 1;
const targetVus = collaborators * projectCount;

export const wsConnectSuccess = new Counter('bench_ws_connect_success');
export const wsConnectFailure = new Counter('bench_ws_connect_failure');
export const wsUnexpectedClose = new Counter('bench_ws_unexpected_close');
export const wsHeldOpenFullDuration = new Counter('bench_ws_held_open_full_duration');
export const editsSent = new Counter('bench_edits_sent');
export const messagesReceived = new Counter('bench_ws_fanout_messages_received');
export const bytesReceived = new Counter('bench_ws_fanout_bytes_received');

export const options = {
    scenarios: {
        collaboration: {
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
        bench_ws_connect_failure: [`count<${Math.ceil(targetVus * 0.02) + 1}`],
    },
};

export default function () {
    // Restrict to the first `projectCount` projects so `collaborators` VUs
    // pile up on each one, instead of spreading across the whole pool.
    const project = pickProject(projects.slice(0, projectCount), globalVuIndex(), collaborators);

    // New projects default to 'private' visibility (no sharing set up by
    // prepare.sh), so every collaborator must authenticate as the
    // project's own owner — cycling through the generic account pool here
    // would get most VUs an ACCESS_DENIED close right after the WS
    // handshake. This is a fan-out/relay load test, not an authorization
    // test, so one shared identity across all collaborators is correct:
    // the access-check code path costs the same either way.
    const token = login(config, { email: project.ownerEmail, password: config.password });
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
                    socket.sendBinary(fakeYjsUpdate());
                    editsSent.add(1);
                    scheduleNext();
                }, delayS * 1000);
            };
            scheduleNext();
        });

        socket.on('binaryMessage', data => {
            messagesReceived.add(1);
            bytesReceived.add(data.byteLength || 0);
        });
        socket.on('message', () => {
            messagesReceived.add(1);
        });
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
        // The socket opened and closed cleanly, but before our own
        // holdDurationS timer fired — e.g. the server closed it (an
        // application-level close code such as ACCESS_DENIED). Not counted
        // as "unexpected" (the close handshake was clean) but also not a
        // full, useful session — a gap between bench_ws_connect_success and
        // bench_ws_held_open_full_duration is the signal to look for. Sleep
        // to guard against a retry storm the same way a real failure does.
        sleep(config.holdDurationS);
    }
}
