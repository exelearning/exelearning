// Isolated login-burst test (issue #2255). Every VU performs exactly one
// POST /api/auth/login and nothing else — no WebSocket, no other API calls.
// Purpose: measure the auth endpoint's own concurrency ceiling in isolation,
// separate from WebSocket connection capacity (see idle-websocket.mjs).
// This is the dedicated "before/after" tool for the bcryptjs vs
// Bun.password.verify comparison (commit changing src/services/password.ts).
//
// Usage:
//   test/load/scripts/run.sh login-burst <RUN_ID> -- -e TARGET_VUS=500
import { getConfig, globalVuIndex } from './lib/config.mjs';
import { login, accountForVu } from './lib/auth.mjs';

const config = getConfig();
const targetVus = Number(__ENV.TARGET_VUS) || 100;

export const options = {
    scenarios: {
        login_burst: {
            executor: 'shared-iterations',
            vus: targetVus,
            iterations: targetVus,
            maxDuration: '5m',
        },
    },
    thresholds: {
        bench_login_failure: [`count<${Math.ceil(targetVus * 0.01) + 1}`],
        bench_login_duration_ms: ['p(95)<5000'],
    },
};

export default function () {
    const account = accountForVu(config, globalVuIndex());
    login(config, account);
}
