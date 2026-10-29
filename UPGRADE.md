# Upgrade Guide

This document describes breaking changes and migration steps between major versions.

---

## Upgrading to 4.0.6

This release hardens the backend and fixes GHSA-5p92-q7pw-7247. Production deployments must review the two
sections below **before** upgrading: an installation that keeps an example secret, or uses platform
integration without an allow-list, stops starting or stops accepting LMS callbacks.

### Breaking Change: production requires explicit secrets

**What changed:**
- Production refuses to start (`process.exit(1)`) unless `API_JWT_SECRET` (the session and API JWT signing
  key) is set to a unique value of **at least 32 bytes** that is not one of the published example values:
  `dev_secret_change_me` and the old Compose defaults such as `ChangeThisToASecretForSQLiteDeployment`.
  Those defaults were public, so anyone who read the repository could forge session and API tokens,
  including administrator tokens.
- Production also refuses to start with an empty `APP_SECRET` (which verifies platform-integration JWTs) or a
  published example value such as `CHANGE_THIS_TO_A_SECRET`. There is no minimum length for `APP_SECRET`, so
  existing LMS integrations keep working.
- Production is now detected by **`APP_ENV=prod`** as well as `NODE_ENV=production`. The Docker image already
  sets `NODE_ENV=production`; the newly covered surface is **non-Docker production** (`APP_ENV=prod` through
  systemd, a PaaS or bare `bun`).
- The deployment Compose files no longer provide defaults for either secret.
- `.env.dist` now defaults to `APP_ENV=dev`. Development and test runs without `API_JWT_SECRET` use an
  ephemeral per-process secret, so a fresh clone boots without extra setup (sessions do not survive a restart).
- The same production signal sets the `Secure` attribute on the session and SSO cookies.

**Impact:**
- Installations that relied on a Compose default `API_JWT_SECRET`, use one shorter than 32 bytes, or run in
  production with `dev_secret_change_me` or an empty or example `APP_SECRET` will not start after the upgrade.
- A non-Docker deployment with `APP_ENV=prod` served over plain HTTP (not `localhost`) used to get
  non-`Secure` cookies; browsers now drop them and login loops.
- An install whose environment comes from `.env.dist` (a `.env` copied from it, or the root
  `docker-compose.yml`, which loads `.env.dist` before `.env` and so overrides the image's `APP_ENV=prod`) now
  runs with `APP_ENV=dev` unless it sets `APP_ENV=prod`. With `APP_ENV=dev` the server creates the
  `TEST_USER_EMAIL` account (`user@exelearning.net` / `1234`) and, unless `NODE_ENV=production` is set, skips
  the secret check and the `Secure` cookie flag. Set `APP_ENV=prod` in production, and delete that account if a
  production install has already started in `dev` mode; it is not removed automatically.

**How to fix:**

1. Generate a new `API_JWT_SECRET` once and store it with your deployment configuration (for example in `.env`):
   ```bash
   openssl rand -base64 48
   ```
2. Keep `APP_SECRET` **unchanged** if it is already a private value: LMS plugins sign platform-integration
   tokens with it. Only if it is empty or a published example value, generate a new one and update every
   integrated platform at the same time.
3. Serve non-Docker `APP_ENV=prod` deployments over HTTPS, directly or behind a TLS proxy.
4. Restart. Changing `API_JWT_SECRET` invalidates all existing sessions, API Bearer tokens and upload tokens,
   so every user must log in again.

See `doc/development/authentication.md` and `doc/development/environment.md`.

---

### Breaking Change: platform integration requires a `PROVIDER_URLS` allow-list

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

**Impact / how to fix:**
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
