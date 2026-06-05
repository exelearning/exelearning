# Upgrade Guide

This document describes breaking changes and migration steps between major versions.

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
