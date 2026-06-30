# Authentication

This application supports several authentication methods that can be enabled individually or together. Configuration is driven by environment variables.

## Supported Methods

- Password: Traditional email/password form login at `/login`.
- CAS: Central Authentication Service (service tickets via `ticket` query param).
- OpenID Connect (OIDC): Authorization Code + PKCE login, user resolution via the OIDC UserInfo endpoint.
- Guest: One‑click access that creates a temporary user without a password.
- None (offline): Disables authentication and logs in the default user for local/offline use.

To enable modes, set `APP_AUTH_METHODS` as a comma‑separated list:

```
APP_AUTH_METHODS=password,cas,openid,guest
```

Optional: automatically create users that do not exist yet when logging in with CAS/OIDC:

```
AUTH_CREATE_USERS=true
```

## Quick Reference: Environment Variables

The most important variables (see `.env.dist` for full list):

```
# Modes
APP_AUTH_METHODS=password,cas,openid,guest
AUTH_CREATE_USERS=true

# CAS
CAS_URL=https://www.casserverpac4j.dev
CAS_VALIDATE_PATH=/p3/serviceValidate
CAS_LOGIN_PATH=/login
CAS_LOGOUT_PATH=/logout

# OpenID Connect (generic; see provider sections below)
OIDC_ISSUER=https://demo.duendesoftware.com
OIDC_AUTHORIZATION_ENDPOINT=https://demo.duendesoftware.com/connect/authorize
OIDC_TOKEN_ENDPOINT=https://demo.duendesoftware.com/connect/token
# OIDC_USERINFO_ENDPOINT is discovered automatically; keep only for reference
OIDC_USERINFO_ENDPOINT=https://demo.duendesoftware.com/connect/userinfo
OIDC_SCOPE="openid email"
OIDC_CLIENT_ID=interactive.confidential
OIDC_CLIENT_SECRET=secret

# API (local JWTs accepted by the backend)
API_JWT_SECRET=dev_secret_change_me
# API_JWT_ISSUER=exelearning
# API_JWT_AUDIENCE=exelearning_clients
```

## How Authentication Works

- Form Login: Login form at `/login` posts credentials to `/login_check`.
- CAS: Clicking "CAS" sends the browser to your CAS login. The auth handler extracts the service ticket from the `ticket` query parameter and validates it.
- OIDC:
  - The app resolves the provider endpoints (authorization, token, userinfo, end_session) from `OIDC_ISSUER` via OIDC Discovery, falling back to the explicit `OIDC_*_ENDPOINT` variables. See [OIDC endpoint resolution](#oidc-endpoint-resolution-discovery) below.
  - The app builds the Authorization URL from the resolved authorization endpoint and redirects the user to the provider.
  - The callback `/login/openid/callback` exchanges the `code` for tokens using the resolved token endpoint.
  - The app forwards the browser to the target page appending `?access_token=...`.
  - The JWT middleware validates the token and resolves the user via the resolved UserInfo endpoint.
- Logout:
  - CAS: Redirects to `CAS_LOGOUT_PATH` with `service` back to the app.
  - OIDC: If the provider exposes `end_session_endpoint` (Duende/Keycloak) — either configured explicitly or discovered — we redirect there. Google does not expose it; we revoke the access token and return to the app.

Notes

- The user identity claim used for matching is `sub` (stable across providers). If user creation is enabled, missing users are created with that `sub` as external identifier and the best email found in claims.
- Tokens are accepted from: `Authorization: Bearer <token>` header, `?access_token=` query param, and CAS `?ticket=`.

## OIDC endpoint resolution (Discovery)

eXeLearning resolves the OIDC endpoints — `authorization_endpoint`, `token_endpoint`, `userinfo_endpoint`, `end_session_endpoint`, and `jwks_uri` — by combining your explicit configuration with **OpenID Connect Discovery**.

### Minimal configuration (discovery)

For any standards-compliant provider, the issuer plus client credentials is enough:

```
OIDC_ISSUER=https://idp.example.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_SCOPE="openid email"
```

On the first login the backend fetches `${OIDC_ISSUER}/.well-known/openid-configuration` and derives the endpoints it needs. This includes the `jwks_uri`, so **id_token signatures are verified out of the box** without configuring `OIDC_JWKS_URI` by hand.

### Explicit configuration (manual override)

You can still pin any endpoint explicitly. This is useful for providers with non-standard layouts or to avoid the discovery request entirely:

```
OIDC_AUTHORIZATION_ENDPOINT=https://idp.example.com/connect/authorize
OIDC_TOKEN_ENDPOINT=https://idp.example.com/connect/token
OIDC_USERINFO_ENDPOINT=https://idp.example.com/connect/userinfo
OIDC_END_SESSION_ENDPOINT=https://idp.example.com/connect/endsession
OIDC_JWKS_URI=https://idp.example.com/.well-known/jwks.json
```

### Precedence rules

- **Explicit endpoint settings always win.** Discovery never overrides a value you configured.
- **Discovery only fills the gaps** — endpoints you left blank.
- **An empty `OIDC_ISSUER` disables discovery.** All required endpoints must then be configured explicitly.
- If every endpoint is already explicit, no discovery request is made.

### Failure behavior

- If discovery **fails** (issuer unreachable, non-200, malformed/incomplete metadata, or issuer mismatch) the app falls back to whatever endpoints are configured explicitly. Logins still work if those cover the required endpoints; otherwise the route returns a clear "OpenID Connect is misconfigured" error.
- The discovered `issuer` must match `OIDC_ISSUER` (a trailing-slash difference is tolerated). A mismatched issuer is rejected to prevent metadata substitution.
- Discovery requires **HTTPS**, except for local development issuers (`http://localhost`, `http://127.0.0.1`, `http://[::1]`).
- Discovery uses a short timeout and the result is **cached in memory per issuer with a TTL** (one hour), so it does not run on every login but rotated endpoints and signing keys are eventually re-fetched.

### Optional logout endpoint

`end_session_endpoint` is optional. When present in the discovery document it is used for OIDC logout unless `OIDC_END_SESSION_ENDPOINT` is set explicitly (explicit wins). Providers that do not publish it (e.g. Google) fall back to access-token revocation. Because it is optional, a blank `end_session_endpoint` alone does **not** trigger a discovery request — discovery runs only when a required endpoint (authorization, token, userinfo, or jwks_uri) is missing.

### id_token signature verification (JWKS)

The id_token returned from the token endpoint is verified against the provider's published JSON Web Key Set. The JWKS URI is resolved like the other endpoints: an explicit `OIDC_JWKS_URI` wins, otherwise the `jwks_uri` from the discovery document is used. When neither is available the signature **cannot** be verified — the app falls back to decoding the token unverified and logs a loud warning. Configure `OIDC_ISSUER` (so discovery supplies `jwks_uri`) or set `OIDC_JWKS_URI` explicitly to enable verification in production.

## OpenID Connect: Provider Setup

Common prerequisites

- Ensure `openid` is present in `APP_AUTH_METHODS`.
- Add your application callback URL to the provider’s “Authorized Redirect URIs” (or “Valid redirect URIs”):
  - Development: `http://localhost:8080/login/openid/callback`
  - Production: `https://<your-domain>/login/openid/callback`
- Scopes: `OIDC_SCOPE="openid email"` is recommended. Add `profile` if you want name/picture.

### Google (Identity Platform)

1) Create OAuth 2.0 Client ID (Web application) in Google Cloud Console.
- Authorized redirect URI: `http://localhost:8080/login/openid/callback` (and your production URL).

2) Configure environment variables:

```
OIDC_ISSUER=https://accounts.google.com
OIDC_AUTHORIZATION_ENDPOINT=https://accounts.google.com/o/oauth2/v2/auth
OIDC_TOKEN_ENDPOINT=https://oauth2.googleapis.com/token
# UserInfo endpoint is discovered automatically; the canonical one is:
OIDC_USERINFO_ENDPOINT=https://openidconnect.googleapis.com/v1/userinfo
OIDC_SCOPE="openid email"
OIDC_CLIENT_ID=your-google-client-id
OIDC_CLIENT_SECRET=your-google-client-secret
```

3) Logout behavior:
- Google does not expose `end_session_endpoint`. The backend revokes the access token (`https://oauth2.googleapis.com/revoke`) and performs a local logout. If you need to sign the user out of their Google account in the browser, do it from Google or integrate Google Identity Services on the frontend.

### Keycloak

Keycloak exposes the issuer per realm. Use the realm issuer and standard OIDC endpoints.

1) In the Admin Console, create a “confidential” client, enable “Standard Flow (OIDC)”, and add the Redirect URIs.

2) Configure environment variables:

```
# Replace host/realm
OIDC_ISSUER=https://keycloak.example.com/realms/myrealm
OIDC_AUTHORIZATION_ENDPOINT=https://keycloak.example.com/realms/myrealm/protocol/openid-connect/auth
OIDC_TOKEN_ENDPOINT=https://keycloak.example.com/realms/myrealm/protocol/openid-connect/token
# UserInfo and end_session are discovered via discovery
OIDC_SCOPE="openid email"
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
```

3) Logout:
- Discovery provides `end_session_endpoint`; the backend redirects there with `post_logout_redirect_uri` and `id_token_hint` (and `client_id` when applicable).

### Duende (IdentityServer)

You can test with Duende’s demo server or your own instance.

1) Demo variables:

```
OIDC_ISSUER=https://demo.duendesoftware.com
OIDC_AUTHORIZATION_ENDPOINT=https://demo.duendesoftware.com/connect/authorize
OIDC_TOKEN_ENDPOINT=https://demo.duendesoftware.com/connect/token
# UserInfo and end_session via discovery
OIDC_SCOPE="openid email"
OIDC_CLIENT_ID=interactive.confidential
OIDC_CLIENT_SECRET=secret
```

2) Logout:
- IdentityServer exposes `end_session_endpoint`; the backend redirects to that endpoint with `post_logout_redirect_uri` and `id_token_hint` when available.

## CAS Configuration

Use these variables (example with a public test server):

```
CAS_URL=https://www.casserverpac4j.dev
CAS_VALIDATE_PATH=/p3/serviceValidate
CAS_LOGIN_PATH=/login
CAS_LOGOUT_PATH=/logout
```

Login starts at `/login/cas`; the firewall validates the returned `ticket`. Logout redirects to `CAS_LOGOUT_PATH` with a `service` return URL.

### Reverse Proxy Setup for SSO

When using CAS or OpenID behind a reverse proxy, you **must** configure `TRUSTED_PROXIES` so callback URLs are built correctly.

**Problem:** Without configuration, the callback URL sent to CAS/OpenID will use the internal hostname (e.g., `http://internal-server:8080/login/cas/callback`) instead of the public URL (e.g., `https://public.example.org/app/login/cas/callback`).

**Solution:** In your `.env`:

```env
# Trust proxies in private network ranges
TRUSTED_PROXIES=private_ranges,REMOTE_ADDR

# Trust these headers from the proxy
TRUSTED_HEADERS=x-forwarded-for,x-forwarded-host,x-forwarded-proto,x-forwarded-port
```

**CAS Callback URL with Subdirectory:**
If you have `BASE_PATH=/app`, the CAS callback URL will be:
`https://public.example.org/app/login/cas/callback`

See [Deployment: Reverse Proxy Configuration](../deployment.md#reverse-proxy-configuration) for more details.

## Guest Mode

Include `guest` in `APP_AUTH_METHODS` to enable `/login/guest`. It creates a temporary user and logs in with role `ROLE_GUEST`.

## Local API JWT (optional)

The backend can accept locally signed JWTs (useful for scripts/internal services).

```
API_JWT_SECRET=dev_secret_change_me
# API_JWT_ISSUER=exelearning
# API_JWT_AUDIENCE=exelearning_clients
```

Generate tokens via CLI:

```bash
# Generate a JWT for a user
bun run cli generate-jwt --email user@exelearning.net

# Or via make
make generate-jwt
```

Send the token in:

```
Authorization: Bearer <token>
```

## Debugging and Troubleshooting

- Check the server logs for authentication errors (run with `DEBUG=*` for verbose output).
- If OIDC fails with "Invalid URL: scheme is missing", verify `OIDC_ISSUER` and endpoints. The backend fetches `userinfo_endpoint` automatically from the issuer's `/.well-known/openid-configuration`.
- For Google, a 404 on `/connect/endsession` is expected; use token revocation (already integrated) or sign out of Google in the browser.
- JWT validation errors are logged with the specific claim that failed.
