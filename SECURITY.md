# Security Policy

## Supported Versions

Only the latest version of `exelearning` is supported with security updates. `exelearning` follows a rolling release model.

| Version | Supported |
| ------- | --------- |
| 4.0     | ✅        |
| < 4.0   | ❌        |

Older versions (below 3.x) are no longer maintained or supported.

## Secure configuration in production

Deployments running in production (`APP_ENV=prod` or `NODE_ENV=production`) **must**
set strong, unique values for `API_JWT_SECRET` and `APP_SECRET` (e.g.
`openssl rand -hex 32`). The server **refuses to boot** if either is missing or
left at its in-repo default — leaving them default makes API and
platform-integration JWTs forgeable by anyone who reads this repository. See
[doc/development/environment.md](doc/development/environment.md).

## Reporting a Vulnerability

If you discover a security vulnerability in `exelearning`, please report it privately and responsibly.

- **Preferred method:** Open an issue marked as `security` and do not include sensitive details.
- **Alternative:** Email the maintainer directly at `info@exelearning.net`.

Once reported:
- You'll receive an acknowledgment within 3 working days.
- We'll investigate and aim to patch confirmed vulnerabilities within 10 working days.
- If the issue is critical and affects users broadly, we may issue a security advisory and notify on the GitHub releases page.

Do not report security issues via public channels (e.g., Twitter, public issues, discussions).
