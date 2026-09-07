import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

export const loginSuccess = new Counter('bench_login_success');
export const loginFailure = new Counter('bench_login_failure');
export const loginDuration = new Trend('bench_login_duration_ms', true);

// Picks a deterministic account for a given virtual-user index from the
// pre-seeded pool (see scripts/prepare.sh). Falls back to the single
// dev-seeded test account when no pool is configured.
export function accountForVu(config, vuIndex) {
    if (config.userCount <= 0) {
        return { email: config.fallbackEmail, password: config.fallbackPassword };
    }
    const n = vuIndex % config.userCount;
    return {
        email: `${config.userPrefix}${n}@${config.userDomain}`,
        password: config.password,
    };
}

export function login(config, account) {
    const url = `${config.baseUrl}/api/auth/login`;
    const payload = JSON.stringify({ email: account.email, password: account.password });
    const res = http.post(url, payload, {
        headers: { Host: config.hostHeader, 'Content-Type': 'application/json' },
        tags: { name: 'login' },
    });

    loginDuration.add(res.timings.duration);

    const ok = check(res, {
        'login succeeded': r => r.status === 200,
        'login returned a token': r => {
            try {
                return typeof r.json('access_token') === 'string';
            } catch {
                return false;
            }
        },
    });

    if (ok) {
        loginSuccess.add(1);
        return res.json('access_token');
    }

    loginFailure.add(1);
    return null;
}
