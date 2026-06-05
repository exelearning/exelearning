# dev-reverse-proxy

Local nginx reverse proxy that mimics the **production deployment shape**
so you can reproduce (and verify fixes for) the subdirectory / `BASE_PATH`
issues without touching production. See issues
[#1802](https://github.com/exelearning/exelearning/issues/1802),
[#1806](https://github.com/exelearning/exelearning/issues/1806),
[#1833](https://github.com/exelearning/exelearning/issues/1833).

This is a local dev aid. The TLS certificates under `certs/` are **not
committed** — generate them yourself before using HTTPS (see
[Generate the HTTPS cert](#generate-the-https-cert)).

## What it reproduces

Production serves eXeLearning under a subdirectory behind a reverse proxy that
**only forwards the `BASE_PATH` namespace**. This proxy does the same:

- Forwards `…/apps/education/exelearning/*` to the local backend on `:8080`.
- Forwards the Yjs WebSocket at `…/apps/education/exelearning/yjs/`
  (`Upgrade`/`Connection` headers, long read timeout) — same as the prod vhost.
- Returns **502** for everything else (including bare `/`), so any URL the
  client wrongly emits *without* `BASE_PATH` fails loudly instead of being
  silently answered by the dev server's root mount.
- No proxy-side body-size cap (`client_max_body_size 0`), so large chunked
  asset uploads (15 MB chunks) are not rejected with `413`.

> Why nginx and not Apache? some deployments have Apache at the public edge but **nginx**
> as the immediate reverse proxy in front of the backend. Mimicking the closer
> layer (nginx) is the faithful repro.

## Files

```
docker-compose.yml          nginx service, ports 80 + 443, host-gateway
Dockerfile                  alpine + nginx; copies the conf and certs
nginx/exelearning.conf      :80 (HTTP) and :443 (HTTPS) server blocks
nginx/locations.inc         shared location rules (app, /yjs/ WS, 502 catch-all)
certs/                      self-signed cert for domain.local (HTTPS);
                            generated locally, gitignored (not committed)
```

## Prerequisites

1. **Backend running on `:8080`** (the default `APP_PORT`) with the subdirectory
   base path set. In the repo `.env`:
   ```
   BASE_PATH=/apps/education/exelearning
   ```
   `APP_PORT` defaults to `8080`, so you only need to set `BASE_PATH`. Start it
   with `make up-local` (on Linux it must bind `0.0.0.0:8080`, not only
   `127.0.0.1:8080`, so the container can reach it).
2. **Docker** (Desktop on macOS/Windows, or Engine + Compose on Linux).
3. **hosts entry** for the HTTPS hostname:
   ```
   127.0.0.1   domain.local
   ```
4. Host ports **80** and **443** free.

## Run

```sh
cd tools/dev-reverse-proxy
# First time only: generate the TLS cert (the :443 block needs it to start).
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/domain.local.key -out certs/domain.local.crt \
  -days 825 -subj "/CN=domain.local" \
  -addext "subjectAltName=DNS:domain.local,DNS:localhost,IP:127.0.0.1"

docker compose up -d --build
```

Tear down: `docker compose down`.

## How to use it (HTTP vs HTTPS)

There are two ways in, and the choice matters for the **preview**:

- **`http://localhost/apps/education/exelearning/workarea?project=…`**
  Simplest. `localhost` is a *secure context*, so the preview **Service
  Worker** registers and the preview renders correctly. No certificate needed.

- **`https://domain.local/apps/education/exelearning/workarea?project=…`**
  Most faithful to production (HTTPS + custom host). Also a secure context, so
  the Service Worker works — **but** Chrome blocks the SW unless the
  self-signed cert is trusted. Trust it once (macOS):
  ```sh
  sudo security add-trusted-cert -d -r trustRoot \
    -k /Library/Keychains/System.keychain \
    tools/dev-reverse-proxy/certs/domain.local.crt
  ```
  Then reload over `https://domain.local/…`.

> Plain `http://domain.local` (not localhost) is **not** a secure context, so
> the Service Worker is unavailable and the preview falls back to a `blob:`
> iframe where the theme's relative image URLs can't resolve (nav-button icons
> appear blank). Use `localhost` or `https://domain.local` instead.

## Verify it works

```sh
# bare root / non-BASE_PATH -> 502 (mirrors prod; the bug pattern fails loudly)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/

# BASE_PATH-prefixed asset -> 200
curl -s -o /dev/null -w "%{http_code}\n" \
  http://localhost/apps/education/exelearning/v0.0.0-alpha/files/perm/themes/base/base/icons/objectives.png

# HTTPS path -> 200 (use -k while the cert is untrusted)
curl -sk -o /dev/null -w "%{http_code}\n" \
  https://domain.local/apps/education/exelearning/v0.0.0-alpha/files/perm/themes/base/base/icons/objectives.png

# WebSocket upgrade -> 101 Switching Protocols (then the backend closes it
# with 4001 "Token required" without a valid token — that's expected)
curl -s -i -N --max-time 4 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://localhost/apps/education/exelearning/yjs/project-11111111-1111-1111-1111-111111111111 | head -1
```

If **everything** 502s, the backend on `:8080` is down — restart `make up-local`
(502 = nginx has no upstream to reach).

## Generate the HTTPS cert

The certs are **not committed** (gitignored). The `:443` server block needs
them to start, so generate them once before `docker compose up`:

```sh
cd tools/dev-reverse-proxy
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/domain.local.key -out certs/domain.local.crt \
  -days 825 -subj "/CN=domain.local" \
  -addext "subjectAltName=DNS:domain.local,DNS:localhost,IP:127.0.0.1"
docker compose up -d --build
```

## Changing the base path / host

The `BASE_PATH` and hostname are hard-coded in `nginx/locations.inc` and
`nginx/exelearning.conf`. If your `.env` uses a different `BASE_PATH`, edit the
`location` prefixes and `proxy_pass` targets to match, then rebuild.
