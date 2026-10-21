# Upgrade Guide

This document describes breaking changes and migration steps between major versions.

---

## Security hardening: production requires real secrets

**What changed:**
- A production deployment now **refuses to boot** (`process.exit(1)`) when
  `API_JWT_SECRET` (the API JWT signing key) **or** `APP_SECRET` (which verifies
  platform-integration JWTs) is missing or still an in-repo default. Leaving
  either at its default made tokens forgeable by anyone who reads the
  open-source repository.
- The check now treats **`APP_ENV=prod`** as production, not only
  `NODE_ENV=production`. The Docker image already sets `NODE_ENV=production`, so
  Docker deployments were already guarded on the JWT secret; the newly-covered
  surface is **non-Docker production** (`APP_ENV=prod` via systemd / PaaS / bare
  `bun`) and the **`APP_SECRET`** key.
- `.env.dist` now defaults to `APP_ENV=dev`, so a fresh clone boots for local
  development without extra setup.

**Impact / action required:**
- Production hosts must export a real `API_JWT_SECRET` **and** `APP_SECRET`
  (e.g. `openssl rand -hex 32` each) before starting the server. See
  `doc/development/authentication.md` and `doc/development/environment.md`.
- No action for local development or the Docker image beyond providing secrets
  in production compose/env as documented.
- The same production signal now sets the `Secure` attribute on the session and
  SSO cookies. A non-Docker deployment with `APP_ENV=prod` that is served over
  plain HTTP (not `localhost`) used to get non-`Secure` cookies; browsers now
  drop them and login loops. Serve it over HTTPS, directly or behind a TLS
  proxy.

---

## Security hardening: platform integration requires a `PROVIDER_URLS` allow-list

**What changed:**
- `PROVIDER_URLS` moved from optional/permissive to a **required, fail-closed
  allow-list** for platform integration (Moodle `exescorm`/`exeweb`). When it is
  empty, **every** platform-integration callback is now rejected — previously an
  empty value allowed any `returnurl` host, which was an SSRF fail-open.
- The allow-list is matched on the parsed **protocol + host + port** and, when an
  entry includes a path, a `/`-boundary **base-path** prefix (so `/moodle` does
  not also match `/moodleXX`). Embedded credentials (`user:pass@host`) are
  rejected. A one-time startup warning (`warnIfProviderUrlsMissing`) flags a
  deployment that sets `PROVIDER_IDS`/`PROVIDER_TOKENS` but leaves `PROVIDER_URLS`
  empty.

**Impact / action required:**
- Deployments that use platform integration must set an explicit allow-list, e.g.:

  ```env
  PROVIDER_URLS=https://moodle.example.org
  ```

  List several origins comma-separated if needed. Deployments that do not use
  platform integration need no action.
- Outbound platform callbacks (`get_ode.php` / `set_ode.php`) now go through the
  SSRF egress guard and no longer follow redirects. A Moodle whose host resolves
  to a loopback, RFC1918 or IPv6 unique-local address (internal network, VPN,
  private DNS, or `http://localhost` in development) is refused unless you opt in:

  ```env
  PROVIDER_URLS=http://moodle.intranet:80
  PROVIDER_ALLOW_PRIVATE_NETWORK=true
  ```

  The opt-in only applies to hosts that match `PROVIDER_URLS`; link-local
  (cloud metadata), CGNAT, multicast and reserved addresses stay blocked. Include
  the port in those entries, since an entry without one matches every port.
  Moodle must answer the callbacks directly: an HTTP-to-HTTPS redirect in front of
  `get_ode.php`/`set_ode.php` now fails, so use the final scheme in `PROVIDER_URLS`
  and in Moodle's `wwwroot`.

---

## Upgrading from 3.x to 4.x

### Breaking Change: Docker container user

**What changed:**
- eXeLearning 3.x used `erseco/alpine-php-webserver` which runs as user `nobody`
- eXeLearning 4.x uses the official Bun image (`oven/bun`) which runs as user `bun`

**Impact:**
If you have an existing installation with data in `/mnt/data` (or your configured `FILES_DIR`), the new container won't be able to write to those directories because they're owned by `nobody`.

**How to fix:**

Choose one of these options depending on your situation:

#### Option A: Fix permissions (recommended if you have existing data)

Before starting the new container, change ownership of your data directory:

```bash
# Stop the current container
docker compose down

# Fix permissions (adjust path if needed)
sudo chown -R 1000:1000 /path/to/your/mnt/data

# Start the new container
docker compose up -d
```

> **Note:** User `bun` has UID 1000 in the official Bun image.

#### Option B: Start fresh (if you don't need existing data)

If you're okay losing existing data (test installations, demos):

```bash
# Stop and remove everything including volumes
docker compose down -v

# Start fresh
docker compose up -d
```

#### Option C: Bind mount with fixed permissions

If you use bind mounts instead of Docker volumes, ensure the host directory is writable by UID 1000:

```bash
mkdir -p /opt/exelearning-data
chown 1000:1000 /opt/exelearning-data
```

Then in your `docker-compose.yml`:
```yaml
volumes:
  - /opt/exelearning-data:/mnt/data
```

---

### Other changes in 4.x

- Backend rewritten from PHP/Symfony to Bun/Elysia
- Real-time collaboration via Yjs WebSockets
- Improved export performance
- See [CHANGELOG.md](CHANGELOG.md) for full details
