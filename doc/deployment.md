# Deployment

This page gives administrators a fast, copy-pasteable path to run eXeLearning in production with Docker. It embeds the official Docker Compose files, shows required environment variables, and highlights the few things you must secure.

---

## Images & Architectures

We build and publish **multi-architecture images** for **amd64** and **arm64**.
Images are pushed to two registries to avoid potential access issues or rate limiting:

* `docker.io/exelearning/exelearning`
* `ghcr.io/exelearning/exelearning`

---

## Choose your database

| Engine       | Best for                        | File (embedded below)                |
| ------------ | ------------------------------- | ------------------------------------ |
| **SQLite**   | Single user / proof-of-concept  | `deploy/docker-compose.sqlite.yml`   |
| **MariaDB**  | Most teams / general workloads  | `deploy/docker-compose.mariadb.yml`  |
| **Postgres** | Larger teams / high concurrency | `deploy/docker-compose.postgres.yml` |

> **Rule of thumb:** SQLite for demos, MariaDB for most deployments, Postgres for heavier load. 

---

### 1) SQLite (simplest)

Here is the exact Compose file used by releases:

```yaml title="deploy/docker-compose.sqlite.yml"
--8<-- "./deploy/docker-compose.sqlite.yml"
```

**Run it:**

```bash
docker compose -f docker-compose.sqlite.yml up -d
```

Access the app at [http://localhost:8080](http://localhost:8080). Change `APP_PORT` if needed.  

---

### 2) MariaDB

```yaml title="deploy/docker-compose.mariadb.yml"
--8<-- "./deploy/docker-compose.mariadb.yml"
```

**Run it:**

```bash
docker compose -f docker-compose.mariadb.yml up -d
```

> **Note:** Default DB credentials in the file are for quick starts. Override them in a `.env` (see **Configuration**). 

---

### 3) PostgreSQL

```yaml title="deploy/docker-compose.postgres.yml"
--8<-- "./deploy/docker-compose.postgres.yml"
```

**Run it:**

```bash
docker compose -f docker-compose.postgres.yml up -d
```

> **Heads-up:** The sample sets `DB_SERVER_VERSION` and pins a Postgres image tag. Keep these aligned when you customize. 

---

## Configuration

You can configure the app either:

1. **With a `.env`** living next to your `docker-compose.yml`, or
2. **Inline** in Compose using `${VARIABLE:-default}`.

Common knobs (all supported by the example files):

* **Application:** `APP_ENV`, `APP_DEBUG`, `APP_SECRET`, `APP_PORT`, `APP_ONLINE_MODE`
* **Base path (subdirectory installs):** `BASE_PATH`
* **Database:** `DB_DRIVER`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_CHARSET`, engine-specific version flags
* **Files:** `FILES_DIR` (default: `/mnt/data/`)
* **Auth:** `APP_AUTH_METHODS`, `AUTH_CREATE_USERS`
* **Admin user:** `ADMIN_EMAIL`, `ADMIN_PASSWORD` (see [Admin User Setup](#admin-user-setup))
* **Real-time (Yjs WebSocket):** Uses the main server port, no additional configuration needed
* **Post-configure hooks:** `POST_CONFIGURE_COMMANDS` (e.g., run custom scripts)

(See the embedded Compose files for the full set.)    

> **Important:** Always set strong secrets (`APP_SECRET`, DB passwords) via `.env` or environment overrides—never commit them. 

---

### Subdirectory deployment (BASE_PATH)

You can deploy eXeLearning under a subdirectory (e.g., `https://example.org/exelearning`) by setting `BASE_PATH`.

- Do not include a trailing slash.
- Can be multi-level.

Examples:

```env
# Install at root
BASE_PATH=

# One level
BASE_PATH=/exelearning

# Multi-level
BASE_PATH=/web/exelearning
```

What it does:

- Prefixes all application routes with `BASE_PATH` (e.g., `/exelearning/workarea`).
- Keeps `/healthcheck` working: requests to `/healthcheck` are redirected to `%BASE_PATH%/healthcheck` when `BASE_PATH` is set.
- Inside the container, Nginx rewrites `^$BASE_PATH/(.*)$` to `/$1` so the app sees clean paths. The rewrite is generated automatically from the container configuration when `BASE_PATH` is set.

Verification:

- Visit `https://your-host%BASE_PATH%/healthcheck` and expect `{ "status": "ok" }`.
- If you hit `/healthcheck` without the prefix while `BASE_PATH` is set, you will be redirected to `%BASE_PATH%/healthcheck`.

---

## Admin User Setup

eXeLearning can automatically create and maintain an admin user via environment variables. This is useful for:

- Initial deployment setup
- Admin password recovery (if locked out)
- Consistent admin access across container restarts

### Configuration

Set these environment variables in your `.env` file or Docker Compose:

```env
# Admin user email
ADMIN_EMAIL=admin@myorganization.org

# Admin password (required to enable admin user creation)
ADMIN_PASSWORD=your_secure_password_here
```

### Behavior

When `ADMIN_PASSWORD` is set (non-empty):

1. **If the admin user doesn't exist:** Creates a new user with `ROLE_USER` and `ROLE_ADMIN` roles
2. **If the admin user exists:** Updates the password and ensures admin roles are set

This "upsert" behavior allows admin recovery if you lose access—just set the environment variable and restart the container.

### Security Notes

- Never commit `ADMIN_PASSWORD` to version control
- Use strong, unique passwords
- Consider removing `ADMIN_PASSWORD` after initial setup and using the UI for password changes
- For multi-instance deployments (Redis HA), use the same `ADMIN_EMAIL` and `ADMIN_PASSWORD` across all instances

---

## Reverse proxy & TLS

Put eXeLearning behind Nginx or Traefik to terminate TLS and forward to the app.

```nginx title="Example: Nginx reverse proxy with TLS"
server {
    listen 80;
    server_name exelearning.example.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name exelearning.example.org;

    ssl_certificate     /etc/letsencrypt/live/exelearning.example.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/exelearning.example.org/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for Yjs collaboration
    location /yjs/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400; # Keep WebSocket alive
    }
}
```

> **If TLS is terminated at your proxy:** set `TRUSTED_PROXIES=private_ranges,REMOTE_ADDR` in your `.env` and ensure your proxy sends `X-Forwarded-*` headers. See [Reverse Proxy Configuration](#reverse-proxy-configuration) below.

---

## Reverse Proxy Configuration

When running behind a reverse proxy, eXeLearning needs to know how to construct public URLs (for SSO callbacks, redirects, etc.). Configure these variables in your `.env`:

| Variable | Description | Example |
|----------|-------------|---------|
| `TRUSTED_PROXIES` | IP ranges allowed to set proxy headers | `private_ranges,REMOTE_ADDR` |
| `TRUSTED_HEADERS` | Headers to trust from proxies | `x-forwarded-for,x-forwarded-host,x-forwarded-proto` |

**Example `.env` for reverse proxy:**

```env
# Trust private network ranges (typical for Docker/internal proxies)
TRUSTED_PROXIES=private_ranges,REMOTE_ADDR
TRUSTED_HEADERS=x-forwarded-for,x-forwarded-host,x-forwarded-proto,x-forwarded-port
```

**Why this matters:** Without proper configuration, SSO authentication (CAS, OpenID) will fail because callback URLs will use the internal server hostname instead of the public URL.

**Common issues:**

- CAS/OpenID redirects to wrong host → Check `TRUSTED_PROXIES` is set
- Protocol mismatch (http vs https) → Ensure proxy sends `X-Forwarded-Proto`
- Missing BASE_PATH in callbacks → Ensure `BASE_PATH` is set correctly

---

## Data & backups

* **Volumes:** Each Compose file declares named volumes for app data and databases.
* **Backups:** Snapshot volumes regularly (`mariadb-data`, `postgres-data`, `exelearning-data`) and any external storage used by `FILES_DIR`.
* **DB tools:** `mysqldump` / `pg_dump` for live exports; for SQLite, copy the DB file when the service is stopped.

---

## Custom templates

eXeLearning supports project templates that users can select via **File → New from Template**. Templates are managed through the **Admin Panel** under the **Extensions** tab.

### Adding templates via Admin Panel

1. Log in as an administrator
2. Navigate to **Admin Panel → Extensions → Templates**
3. Select the target language from the dropdown
4. Click **Upload Template** and select an `.elpx` file
5. Provide a display name and optional description
6. The template will be available to users with that language setting

### Template storage

Templates uploaded through the admin panel are stored in `FILES_DIR/admin/templates/<locale>/` and their metadata is stored in the database.

### Enabling/Disabling templates

Administrators can enable or disable templates through the admin panel. Disabled templates won't appear in the "New from Template" menu for users.

### Creating templates

1. Design your project in eXeLearning
2. Export it as an `.elpx` file (**File → Download as... → eXeLearning content**)
3. Place it in the appropriate language folder in your templates directory
4. Templates will automatically appear in the **File → New from Template** menu

---

## Troubleshooting

* **Port already in use:** Change `APP_PORT` in your `.env` or Compose overrides.
* **File permissions:** Ensure your volumes are writable by the container user.
* **Real-time/WebSocket issues:** Ensure your reverse proxy supports WebSocket upgrade headers. See **Reverse proxy & TLS** above. 

---

## High Availability

For deployments requiring horizontal scaling and high availability with multiple server instances, see:

* **[High Availability Guide](high-availability.md)** - Multi-instance deployment with Redis synchronization

---

## See also

* **Real-time configuration:** [development/real-time.md](../development/real-time.md)

---

## Maintenance

### Temporary files cleanup

eXeLearning stores intermediate/temporary files (exports, conversions, etc.) under the configured temporary directory. You can clean up old entries either via a console command (recommended for cron) or an HTTP endpoint (for environments where only HTTP access is available).

- Command (recommended):
  - `bun cli tmp-cleanup [--max-age=SECONDS]`
  - Example cron (daily at 03:00, keeping 24h):
    - `0 3 * * * cd /opt/exelearning && bun cli tmp-cleanup --max-age=86400`

- HTTP endpoint (GET or POST):
  - Path: `/maintenance/tmp/cleanup`
  - Query/body parameter: `key`
  - Example:
    - `curl -fsS "https://exelearning.example.org/maintenance/tmp/cleanup?key=$TMP_CLEANUP_KEY"`
  - Response: `200 OK` with a JSON summary; `207 Multi-Status` when some deletions fail.

- Security and configuration:
  - Set `TMP_CLEANUP_KEY` in your environment (also present in `.env.dist`). The endpoint validates `?key=...` against this value.
  - If `TMP_CLEANUP_KEY` is empty or unset, the endpoint is inert and returns `204 No Content` without performing any action (silent exit).
  - Expose the endpoint only over HTTPS and/or restrict by IP as needed.
