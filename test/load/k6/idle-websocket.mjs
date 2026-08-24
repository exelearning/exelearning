// Idle WebSocket capacity test (issue #2255, phase 2).
// Ramps up to TARGET_VUS Yjs WebSocket connections, holds them open for
// HOLD_DURATION_S (default 10 minutes) doing essentially nothing, then lets
// them drain. Purpose: find the maximum stable number of concurrent
// mostly-idle WebSocket connections for one deployment topology — the C10k
// question — without conflating it with editing-workload cost.
//
// Usage:
//   test/load/scripts/run.sh idle-websocket <RUN_ID> -- \
//       -e TARGET_VUS=1000 -e HOLD_DURATION_S=600 -e RAMP_UP_S=60
import ws from 'k6/ws';
import { sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { getConfig, globalVuIndex } from './lib/config.mjs';
import { login, accountForVu } from './lib/auth.mjs';
import { loadProjects, pickProject } from './lib/projects.mjs';
import { wsUrl, fakeYjsUpdate } from './lib/ws.mjs';

const config = getConfig();
const projects = loadProjects(config.projectsFile);
const targetVus = Number(__ENV.TARGET_VUS) || 100;
const usersPerProject = Number(__ENV.USERS_PER_PROJECT) || 1;

export const wsConnectSuccess = new Counter('bench_ws_connect_success');
export const wsConnectFailure = new Counter('bench_ws_connect_failure');
export const wsConnectDuration = new Trend('bench_ws_connect_duration_ms', true);
export const wsUnexpectedClose = new Counter('bench_ws_unexpected_close');
export const wsHeldOpen = new Counter('bench_ws_held_open_full_duration');

export const options = {
    scenarios: {
        idle_ws: {
            executor: 'ramping-vus',
            startVUs: 0,
            // The trailing 5s plateau at the same target guarantees VUs
            // scheduled to start right at the end of the ramp actually get
            // to run their iteration, instead of being silently dropped by
            // the executor at the stage boundary.
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
    },
};

export default function () {
    const account = accountForVu(config, globalVuIndex());
    const token = login(config, account);
    if (!token) {
        // `ramping-vus` immediately recycles a VU whose iteration returns
        // into a brand-new iteration if the scenario is still ramping —
        // without this, a fast-failing login (e.g. the server refusing
        // connections under overload) creates a self-inflicted retry storm
        // that can generate orders of magnitude more login attempts than
        // the nominal ramp rate, swamping the very server we're measuring
        // and making the real capacity ceiling impossible to see. Sleep
        // out the rest of this VU's would-be session instead of retrying.
        sleep(config.holdDurationS);
        return;
    }

    const project = pickProject(projects, globalVuIndex(), usersPerProject);
    const url = wsUrl(config, project.uuid, token);
    const connectStart = Date.now();
    let sawOpen = false;
    let heldFullDuration = false;

    ws.connect(url, { headers: { Host: config.hostHeader } }, socket => {
        socket.on('open', () => {
            sawOpen = true;
            wsConnectDuration.add(Date.now() - connectStart);
            wsConnectSuccess.add(1);
            // A single initial frame, mirroring a client announcing presence
            // (Yjs awareness) right after joining a room. No further traffic:
            // this scenario measures pure connection-holding capacity.
            socket.sendBinary(fakeYjsUpdate());
        });

        socket.on('message', () => {});
        socket.on('binaryMessage', () => {});
        socket.on('error', () => {});

        socket.setTimeout(() => {
            heldFullDuration = true;
            socket.close();
        }, config.holdDurationS * 1000);

        socket.on('close', () => {
            if (heldFullDuration) {
                wsHeldOpen.add(1);
            }
        });
    });

    if (!sawOpen) {
        wsConnectFailure.add(1);
        // Same retry-storm guard as the login-failure path above.
        sleep(config.holdDurationS);
    } else if (!heldFullDuration) {
        wsUnexpectedClose.add(1);
    }
}
