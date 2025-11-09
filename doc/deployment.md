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
* **Auth:** `APP_AUTH_METHODS`, `AUTH_CREATE_USERS`, plus optional test user (`TEST_USER_*`)
* **Real-time (Mercure):** `MERCURE_URL`, `MERCURE_*_JWT_*`
* **Post-configure hooks:** `POST_CONFIGURE_COMMANDS` (e.g., auto-create a user)

(See the embedded Compose files for the full set.)    

> **Important:** Always set strong secrets (`APP_SECRET`, `MERCURE_JWT_SECRET_KEY`, DB passwords) via `.env` or environment overrides—never commit them. 

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
- Inside the container, Nginx rewrites `^$BASE_PATH/(.*)$` to `/$1` so the app sees clean paths. The rewrite is generated automatically from `subdir.conf.template` by `02-configure-symfony.sh` when `BASE_PATH` is set.

Verification:

- Visit `https://your-host%BASE_PATH%/healthcheck` and expect `{ "status": "ok" }`.
- If you hit `/healthcheck` without the prefix while `BASE_PATH` is set, you will be redirected to `%BASE_PATH%/healthcheck`.

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

    # Mercure (SSE) must disable buffering
    location ^~ /.well-known/mercure {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off; # critical for SSE
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> **If TLS is terminated at your proxy:** set `USE_FORWARDED_HEADERS=1` and ensure `X-Forwarded-*` headers are sent. 

---

## Data & backups

* **Volumes:** Each Compose file declares named volumes for app data and databases.
* **Backups:** Snapshot volumes regularly (`mariadb-data`, `postgres-data`, `exelearning-data`) and any external storage used by `FILES_DIR`.
* **DB tools:** `mysqldump` / `pg_dump` for live exports; for SQLite, copy the DB file when the service is stopped.

---

## Custom templates

eXeLearning supports project templates that users can select via **File → New from Template**. Templates are `.elpx` files organized by language code under `public/templates/<lang>/`.

### Mounting custom templates

To provide custom templates in a Docker deployment, mount a volume to the templates directory:

```yaml
services:
  exelearning:
    volumes:
      # Mount custom templates for all languages
      - ./my-templates:/app/public/templates

      # Or mount templates for a specific language
      - ./my-en-templates:/app/public/templates/en
      - ./my-es-templates:/app/public/templates/es
```

### Template structure

Templates are organized by language code:

```
templates/
├── en/          # English templates
│   ├── basic.elpx
│   └── course.elpx
├── es/          # Spanish templates
│   ├── basic.elpx
│   └── course.elpx
└── ...
```

The filename (without `.elpx` extension) is displayed as the template name in the UI. You can use spaces and special characters in filenames (e.g., `My Course Template.elpx`).

### Creating templates

1. Design your project in eXeLearning
2. Export it as an `.elpx` file (**File → Download as... → eXeLearning content**)
3. Place it in the appropriate language folder in your templates directory
4. Templates will automatically appear in the **File → New from Template** menu

---

## Troubleshooting

* **Port already in use:** Change `APP_PORT` in your `.env` or Compose overrides.
* **File permissions:** Ensure your volumes are writable by the container user.
* **Real-time/SSE stalls:** In Nginx, set `proxy_buffering off` for `/.well-known/mercure`. See **Reverse proxy & TLS** above. 

---

## See also

* **Real-time configuration:** [development/real-time.md](../development/real-time.md)

---

## Maintenance

### Temporary files cleanup

eXeLearning stores intermediate/temporary files (exports, conversions, etc.) under the configured temporary directory. You can clean up old entries either via a console command (recommended for cron) or an HTTP endpoint (for environments where only HTTP access is available).

- Command (recommended):
  - `php bin/console app:tmp-files:cleanup [--max-age=SECONDS]`
  - Composer shortcut: `composer tmp-cleanup`
  - Example cron (daily at 03:00, keeping 24h):
    - `0 3 * * * cd /opt/exelearning && php bin/console app:tmp-files:cleanup --max-age=86400`

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
