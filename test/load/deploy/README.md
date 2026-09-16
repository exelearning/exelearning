# HA benchmark deployment (issue #2255)

`docker-compose.ha.yml` is an adaptation of
[`doc/deploy/docker-compose.redis.yml`](../../../doc/deploy/docker-compose.redis.yml)
for running the horizontal-scaling phase of the benchmark on the
system-under-test host. It differs from the canonical HA reference doc in
ways specific to being a throwaway benchmark stack rather than a production
example:

- Uses the prebuilt `ghcr.io/exelearning/exelearning:exenew` image only (no
  `build:` context — the system-under-test host does not have this
  repository checked out).
- Exposes the Nginx load balancer directly on a host port (`8090` by
  default) instead of routing through Traefik — there is no public domain
  involved in this internal comparison, so Traefik adds nothing but
  complexity here.
- Runs PostgreSQL (matching the documented HA architecture) instead of the
  MariaDB used by the single-instance `exenew` deployment. This is a
  deliberate, documented difference between the single-instance and HA
  baselines — see the benchmark report for whether it was also isolated as
  its own variable.
- `APP_ENV=prod` / `APP_DEBUG=0` (the single-instance baseline should be
  tested the same way — see the top-level `test/load/README.md`).

## Deploying on the system-under-test host

```bash
# from the controller machine:
rsync -a test/load/deploy/ deploy@sut-host:/home/deploy/exenew-ha/

# on the system-under-test host:
cd /home/deploy/exenew-ha
docker compose -f docker-compose.ha.yml up -d              # 2 instances
docker compose -f docker-compose.ha.yml --profile ha4 up -d # 4 instances
docker compose -f docker-compose.ha.yml down -v             # full reset
```

Then seed data against it (adjust the compose file/service name):

```bash
SUT_COMPOSE_DIR=/home/deploy/exenew-ha \
SUT_COMPOSE_FILE=docker-compose.ha.yml \
SUT_SERVICE=exelearning-1 \
BASE_URL=http://sut-host:8090 \
HOST_HEADER=bench.example.com \
../scripts/prepare.sh 200 2
```

`HOST_HEADER` doesn't matter for routing here (Nginx's `server_name _;`
matches anything), but the k6 scripts still send it — leave it as-is.

## Three Nginx configs, two isolated experiments

Per issue #2255's own concerns (default `worker_connections 1024` becomes a
ceiling well before 10k WebSockets; `ip_hash` may skew load from a
single-IP generator), this directory ships three variants so each variable
is changed in isolation, never together:

| File | `worker_connections` | `worker_rlimit_nofile` | WS load-balancing |
|---|---|---|---|
| `nginx-baseline-default.conf` | 1024 | (unset) | `ip_hash` |
| `nginx-tuned-ip-hash.conf` | 32768 | 200000 | `ip_hash` |
| `nginx-tuned-least-conn.conf` | 32768 | 200000 | `least_conn` |

**Experiment 1 — file descriptors:** run the same scenario against
`nginx-baseline-default.conf`, then again against `nginx-tuned-ip-hash.conf`.
Everything else (including the load-balancing algorithm) is identical, so
any capacity difference isolates the FD/`worker_connections` change.

**Experiment 2 — load-balancing algorithm:** run the same scenario against
`nginx-tuned-ip-hash.conf`, then again against `nginx-tuned-least-conn.conf`,
and additionally record **WebSocket connections per backend instance** for
each (via `docker stats` per container, or the connection counts each
instance logs) to directly verify the single-source-IP skew the issue
raises. FD limits are already tuned in both, isolating just the algorithm.

Switch the active config and reload Nginx without touching anything else:

```bash
NGINX_CONF=nginx-baseline-default.conf docker compose -f docker-compose.ha.yml up -d nginx
# ... run the benchmark, collect results ...
NGINX_CONF=nginx-tuned-ip-hash.conf docker compose -f docker-compose.ha.yml up -d nginx
# ... run the same benchmark again, compare ...
```

`up -d nginx` recreates only the `nginx` container (new bind mount), leaving
the eXeLearning instances, PostgreSQL, and Redis untouched — satisfying the
"change one variable, keep everything else identical" rule.
