# Deployment

Deploy eXeLearning using Docker. Official container images are published at Docker Hub and GitHub Container Registry:

```
docker.io/exelearning/exelearning
ghcr.io/exelearning/exelearning
```

Images are built for `amd64` and `arm64` on every release.

---

## Quick Start

To try out eXeLearning instantly, run:

```bash
docker run -p 8080:8080 exelearning/exelearning
```

This starts eXeLearning at `http://localhost:8080` with default settings.

---

## Deployment Options

We provide ready-to-use Docker Compose configurations for the three supported database engines:

| Database   | File                                     | Notes                      |
| ---------- | ---------------------------------------- | -------------------------- |
| SQLite     | `doc/deploy/docker-compose.sqlite.yml`   | Easiest and default option |
| MariaDB    | `doc/deploy/docker-compose.mariadb.yml`  | Suitable for most uses     |
| PostgreSQL | `doc/deploy/docker-compose.postgres.yml` | Ideal for high-load setups |

To deploy eXeLearning with one of them:

```bash
docker compose -f doc/deploy/docker-compose.sqlite.yml up -d
```

Replace `sqlite.yml` with `mariadb.yml` or `postgres.yml` as needed.

---

## Configuration

You can configure the application in two ways:

1. **Using a `.env` file** in the same folder as your `docker-compose.yml`
2. **Directly inside the Compose file** using `${VARIABLE:-default}` syntax

All Compose files support variables for:

* Application settings (e.g. `APP_ENV`, `APP_SECRET`, `APP_AUTH_METHODS`)
* Database connection (`DB_DRIVER`, `DB_NAME`, `DB_USER`, etc.)
* Test user creation
* Real-time integration (Mercure keys)
* File storage path (`FILES_DIR`)
* Post-configuration setup (`POST_CONFIGURE_COMMANDS`)

> Important: Always set strong secrets, such as `APP_SECRET` and `MERCURE_JWT_SECRET_KEY`, in a `.env` file or as environment overrides.

---

## Quick Example

```bash
# Clone the repository
git clone https://github.com/exelearning/exelearning.git
cd exelearning

# Start with SQLite (simplest)
docker compose -f doc/deploy/docker-compose.sqlite.yml up -d

# Or with MariaDB
docker compose -f doc/deploy/docker-compose.mariadb.yml up -d

# Or with PostgreSQL
docker compose -f doc/deploy/docker-compose.postgres.yml up -d
```

Access the app at [http://localhost:8080](http://localhost:8080) (or change `APP_PORT`).

---

## Production Notes

- Secrets: Set strong `APP_SECRET`, database passwords, and `MERCURE_JWT_SECRET_KEY`.
- Database: Prefer MariaDB or PostgreSQL for multi‑user environments; SQLite is fine for demos.
- Backups: Back up volumes regularly. At minimum, back up the database volume and any `FILES_DIR` or `/mnt/data` mounted storage.
- HTTPS: Put eXeLearning behind a reverse proxy (Traefik or Nginx) to handle TLS and HTTP→HTTPS redirects.
- Healthchecks: Monitor `GET /healthcheck` from your proxy or orchestrator.

### Example: Nginx Reverse Proxy with TLS

Place this on a public host (Nginx) that forwards to the app running on an internal Docker host:

```nginx
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

> Note: If you terminate TLS in a proxy, set `USE_FORWARDED_HEADERS=1` and ensure the proxy sets `X-Forwarded-*` headers.

### Backups

- MariaDB: Backup the `mariadb-data` volume (or use `mysqldump`).
- PostgreSQL: Backup the `postgres-data` volume (or use `pg_dump`).
- SQLite: Backup the mapped `.db` file path (`DB_PATH`) and any user files (`FILES_DIR`).

### Troubleshooting

- Port in use: Change `APP_PORT` in your `.env` or Compose overrides.
- File permissions: Ensure volumes are writable by the container user.
- Real‑time/SSE issues: Confirm `proxy_buffering off;` for the Mercure location. See [development/real-time.md](../development/real-time.md).

---

## See Also

- Ready‑made Compose files: [deploy/README.md](README.md)
- Real‑time configuration: [development/real-time.md](../development/real-time.md)

