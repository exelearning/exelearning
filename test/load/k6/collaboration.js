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
import { Counter } from 'k6/metrics';
import { getConfig, randomBetween } from './lib/config.js';
import { login, accountForVu } from './lib/auth.js';
import { loadProjects, pickProject } from './lib/projects.js';
import { wsUrl, fakeYjsUpdate } from './lib/ws.js';

const config = getConfig();
const projects = loadProjects(config.projectsFile);
const collaborators = Number(__ENV.COLLABORATORS) || 10;
const projectCount = Number(__ENV.PROJECT_COUNT) || 1;
const targetVus = collaborators * projectCount;

export const wsConnectSuccess = new Counter('bench_ws_connect_success');
export const wsConnectFailure = new Counter('bench_ws_connect_failure');
export const wsUnexpectedClose = new Counter('bench_ws_unexpected_close');
export const editsSent = new Counter('bench_edits_sent');
export const messagesReceived = new Counter('bench_ws_fanout_messages_received');
export const bytesReceived = new Counter('bench_ws_fanout_bytes_received');

export const options = {
    scenarios: {
        collaboration: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [{ duration: `${config.rampUpS}s`, target: targetVus }],
            gracefulRampDown: `${config.holdDurationS + 60}s`,
            gracefulStop: `${config.holdDurationS + 60}s`,
        },
    },
    thresholds: {
        bench_ws_connect_failure: [`count<${Math.ceil(targetVus * 0.02) + 1}`],
    },
};

export default function () {
    const account = accountForVu(config, __VU - 1);
    const token = login(config, account);
    if (!token) return;

    // Restrict to the first `projectCount` projects so `collaborators` VUs
    // pile up on each one, instead of spreading across the whole pool.
    const project = pickProject(projects.slice(0, projectCount), __VU - 1, collaborators);
    const url = wsUrl(config, project.uuid, token);
    let sawOpen = false;
    let closedCleanly = false;

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
            socket.close();
        }, config.holdDurationS * 1000);
    });

    if (!sawOpen) {
        wsConnectFailure.add(1);
    } else if (!closedCleanly) {
        wsUnexpectedClose.add(1);
    }
}
