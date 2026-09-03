# High Availability

This guide explains how to deploy eXeLearning in a high-availability configuration with multiple server instances, load balancing, and real-time synchronization.

---

## Architecture Overview

```
                    ┌─────────────────┐
                    │   nginx (LB)    │
                    │   Port 80/443   │
                    └────────┬────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
    ┌───────▼────────┐               ┌────────▼───────┐
    │ exelearning-1  │               │ exelearning-2  │
    │   Port 8080    │               │   Port 8081    │
    └───────┬────────┘               └────────┬───────┘
            │                                 │
            └────────────────┬────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐   ┌───────▼────────┐   ┌───────▼────────┐
│   PostgreSQL   │   │     Redis      │   │ Shared Volume  │
│   Port 5432    │   │   Port 6379    │   │   (assets)     │
└────────────────┘   └────────────────┘   └────────────────┘
```

### Components

| Component | Purpose |
|-----------|---------|
| **nginx** | Load balancer with WebSocket support |
| **exelearning-1/2** | Application instances |
| **PostgreSQL** | Shared database for all instances |
| **Redis** | Pub/sub for real-time Yjs synchronization |
| **Shared Volume** | Project assets accessible by all instances |

---

## How It Works

### Stateless Design

eXeLearning uses a stateless architecture that enables horizontal scaling:

- **JWT Authentication**: Tokens are self-contained and verified with a shared secret (`API_JWT_SECRET`). Any instance can validate any token.
- **Database-backed State**: All persistent state (users, projects, Yjs documents) is stored in PostgreSQL.
- **Shared Assets Volume**: Project assets are stored on a shared volume accessible by all instances.

### Redis Synchronization

When multiple users collaborate on a project, they may connect to different server instances. Redis pub/sub ensures their changes are synchronized:

1. **Client A** on Instance-1 sends a Yjs update
2. Instance-1 relays the message locally AND publishes to Redis channel `exe:yjs:project-{uuid}`
3. Instance-2 receives the message from Redis subscription
4. Instance-2 checks `instanceId` to avoid duplicates (message came from Instance-1)
5. Instance-2 broadcasts to all its local clients (including **Client B**)

This happens in milliseconds, providing seamless real-time collaboration across instances.

---

## Quick Start

### 1. Get the configuration files

The Docker Compose configuration is in `doc/deploy/`:

```bash
cd doc/deploy/
```

Files:
- `docker-compose.redis.yml` - Main compose file
- `nginx-ha.conf` - Nginx load balancer config

### 2. Create environment file

```bash
# Create .env with secure secrets
cat > .env << 'EOF'
APP_SECRET=your-secure-app-secret-here
API_JWT_SECRET=your-secure-jwt-secret-here
DB_PASSWORD=your-secure-db-password-here
EOF
```

> **Important**: The `API_JWT_SECRET` must be identical across all instances for JWT tokens to work.

### 3. Start the stack

```bash
docker compose -f docker-compose.redis.yml up -d
```

### 4. Verify deployment

Check all services are healthy:

```bash
docker compose -f docker-compose.redis.yml ps
```

Access the application at [http://localhost](http://localhost) (port 80).

---

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `REDIS_HOST` | Redis server hostname | Yes (for HA) |
| `REDIS_PORT` | Redis server port | No (default: 6379) |
| `REDIS_PASSWORD` | Redis password | No |
| `API_JWT_SECRET` | JWT signing secret (must be same across instances) | Yes |
| `APP_SECRET` | Application secret | Yes |
| `DB_*` | Database connection settings | Yes |

### Single vs Multi-Instance Mode

The application automatically detects the mode:

| `REDIS_HOST` | Mode | Description |
|--------------|------|-------------|
| Empty/unset | Single-instance | No Redis connection, local-only WebSocket |
| Set (e.g., `redis`) | Multi-instance | Redis pub/sub enabled for cross-instance sync |

---

## Scaling

### Adding More Instances

To add a third instance, duplicate the `exelearning-2` service in the compose file:

```yaml
exelearning-3:
  image: ghcr.io/exelearning/exelearning:${TAG:-latest}
  # ... same config as exelearning-2
```

Update `nginx-ha.conf` upstream:

```nginx
upstream exelearning_backend {
    least_conn;
    server exelearning-1:8080;
    server exelearning-2:8080;
    server exelearning-3:8080;  # Add new instance
    keepalive 32;
}
```

### Production Considerations

#### Shared Storage

The example uses a Docker volume for assets. For production, use distributed storage:

**AWS EFS:**
```yaml
volumes:
  exelearning-assets:
    driver: local
    driver_opts:
      type: nfs
      o: addr=fs-xxx.efs.region.amazonaws.com,nfsvers=4.1,rsize=1048576,wsize=1048576,hard,timeo=600,retrans=2
      device: ":/exports/exelearning"
```

**NFS Share:**
```yaml
volumes:
  exelearning-assets:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nfs-server.example.com,rw
      device: ":/exports/exelearning"
```

#### TLS/SSL

Add HTTPS to nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    # ... rest of config
}
```

#### Resource Limits

Add resource constraints to prevent runaway containers:

```yaml
exelearning-1:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '0.5'
        memory: 512M
```

---

## Monitoring

### Health Checks

Each component has health checks:

| Service | Endpoint | Interval |
|---------|----------|----------|
| nginx | `GET /health` | 10s |
| exelearning | `GET /healthcheck` | 30s |
| postgres | `pg_isready` | 10s |
| redis | `redis-cli ping` | 10s |

### Logs

View logs for all services:

```bash
docker compose -f docker-compose.redis.yml logs -f
```

View logs for specific service:

```bash
docker compose -f docker-compose.redis.yml logs -f exelearning-1
```

### Redis Monitoring

Check Redis pub/sub activity:

```bash
docker compose -f docker-compose.redis.yml exec redis redis-cli monitor
```

Check subscribed channels:

```bash
docker compose -f docker-compose.redis.yml exec redis redis-cli pubsub channels 'exe:*'
```

---

## Troubleshooting

### WebSocket connections not syncing

1. Verify Redis is running:
   ```bash
   docker compose -f docker-compose.redis.yml exec redis redis-cli ping
   ```

2. Check `REDIS_HOST` is set correctly in both instances

3. Verify instances can connect to Redis:
   ```bash
   docker compose -f docker-compose.redis.yml logs exelearning-1 | grep Redis
   ```

### JWT token errors

Ensure `API_JWT_SECRET` is identical across all instances. Tokens signed by one instance must be verifiable by all others.

### Database connection issues

1. Check PostgreSQL is healthy:
   ```bash
   docker compose -f docker-compose.redis.yml exec postgres pg_isready
   ```

2. Verify database credentials match in all instances

### Asset files not found

Ensure all instances mount the same volume:
```bash
docker compose -f docker-compose.redis.yml exec exelearning-1 ls /mnt/data/assets/
docker compose -f docker-compose.redis.yml exec exelearning-2 ls /mnt/data/assets/
```

---

## Capacity and the C10k benchmark

[Issue #2255](https://github.com/exelearning/exelearning/issues/2255) measured how many concurrent users and
long-lived WebSocket connections this architecture actually sustains, using the
[C10k problem](https://en.wikipedia.org/wiki/C10k_problem) as a reference point rather than a pass/fail target.
Full methodology, measured numbers, identified bottlenecks (two of which were real server bugs, now fixed), and
capacity recommendations: **[`doc/development/c10k-benchmark.md`](development/c10k-benchmark.md)** (English) /
**[`doc/development/c10k-benchmark.es.md`](development/c10k-benchmark.es.md)** (Spanish).

Headline results:

- A single instance sustained **10,000 concurrent idle WebSocket connections** for a full 10-minute hold at 99.92%
  success, 1.15% CPU, 257 MiB RAM.
- The 2-instance HA topology in this document was validated end to end: Redis correctly relays Yjs updates between
  clients connected to *different* instances, and **500 simultaneous collaborators on one project** worked with
  99% of connections held for the full session at only 13-14% CPU per instance.
- **`ip_hash` is confirmed unsuitable for the WebSocket upstream** when load comes from a small number of source
  IPs (a load-generator machine, or any client-side gateway/proxy): it routed effectively 100% of connections to
  one instance in testing. `nginx-ha.conf` in this directory now uses `least_conn` instead — Redis already makes
  same-backend affinity unnecessary for correctness.
- The example `worker_connections`/`worker_rlimit_nofile` values in `nginx-ha.conf` have been raised from the
  previous defaults, which measurably failed under load (58.4% login success at 1000 concurrent WebSocket
  connections) — the new values handled the same load at 100% success and under 15% instance CPU.

**Decisions recorded**: the two durable decisions above are architecture decision records —
[ADR-2255-01](https://github.com/exelearning/exelearning/blob/main/doc/architecture/adr/ADR-2255-01-balance-websocket-upstream-with-least-conn.md)
(`least_conn` for the WebSocket upstream) and
[ADR-2255-02](https://github.com/exelearning/exelearning/blob/main/doc/architecture/adr/ADR-2255-02-verify-passwords-with-bun-native-bcrypt.md)
(native password verification).

**Reproducing or extending these benchmarks**: the load-testing tooling (k6 scenarios, orchestration scripts, and
the HA deployment variant used for these tests) lives under
[`test/load/`](https://github.com/exelearning/exelearning/blob/main/test/load/README.md) — see that directory for exact commands.

---

## See Also

- [Deployment Guide](deployment.md) - Basic deployment options
- [Architecture](architecture.md) - Technical architecture details
- [Real-time Collaboration](development/real-time.md) - Yjs and WebSocket details
- [C10k Benchmark Report](development/c10k-benchmark.md) - Capacity measurements and methodology
