# Authentication

This application supports several authentication methods that can be enabled individually or together. Configuration is driven by environment variables and Symfony’s Security component.

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
CAS_URL=https://casserverpac4j.herokuapp.com
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

- Form Login: Standard Symfony form at `/login` posts to `/login_check`.
- CAS: Clicking “CAS” sends the browser to your CAS login. The firewall extracts the service ticket from the `ticket` query parameter and validates it.
- OIDC:
  - The app builds the Authorization URL from `OIDC_AUTHORIZATION_ENDPOINT` and redirects the user to the provider.
  - The callback `/login/openid/callback` exchanges the `code` for tokens using `OIDC_TOKEN_ENDPOINT`.
  - The app forwards the browser to the target page appending `?access_token=...`.
  - The firewall’s AccessTokenAuthenticator picks the token and our `MultiTokenHandler` resolves the user via the OIDC UserInfo endpoint.
  - The UserInfo endpoint URL is discovered automatically from `OIDC_ISSUER` using OIDC Discovery (`/.well-known/openid-configuration`).
- Logout:
  - CAS: Redirects to `CAS_LOGOUT_PATH` with `service` back to the app.
  - OIDC: If the provider exposes `end_session_endpoint` (Duende/Keycloak), we redirect there. Google does not expose it; we revoke the access token and return to the app.

Notes

- The user identity claim used for matching is `sub` (stable across providers). If user creation is enabled, missing users are created with that `sub` as external identifier and the best email found in claims.
- Tokens are accepted from: `Authorization: Bearer <token>` header, `?access_token=` query param, and CAS `?ticket=`.

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
CAS_URL=https://casserverpac4j.herokuapp.com
CAS_VALIDATE_PATH=/p3/serviceValidate
CAS_LOGIN_PATH=/login
CAS_LOGOUT_PATH=/logout
```

Login starts at `/login/cas`; the firewall validates the returned `ticket`. Logout redirects to `CAS_LOGOUT_PATH` with a `service` return URL.

## Guest Mode

Include `guest` in `APP_AUTH_METHODS` to enable `/login/guest`. It creates a temporary user and logs in with role `ROLE_GUEST`.

## Local API JWT (optional)

The backend can accept locally signed JWTs (useful for scripts/internal services).

```
API_JWT_SECRET=dev_secret_change_me
# API_JWT_ISSUER=exelearning
# API_JWT_AUDIENCE=exelearning_clients
```

Generate and validate tokens (commands):

```
php bin/console app:generate-jwt
php bin/console app:validate-jwt <token>
```

Send the token in:

```
Authorization: Bearer <token>
```

## Debugging and Troubleshooting

- Check the `security` and `app` logs for authenticator trace and OIDC/CAS errors.
- If OIDC fails with “Invalid URL: scheme is missing”, verify `OIDC_ISSUER` and endpoints. With discovery enabled, the backend fetches `userinfo_endpoint` automatically from the issuer’s `/.well-known/openid-configuration`.
- For Google, a 404 on `/connect/endsession` is expected; use token revocation (already integrated) or sign out of Google in the browser.
