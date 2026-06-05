/**
 * Generate JWT Command
 * Generate a JWT token for API access
 *
 * Usage: bun cli jwt:generate <email> [options]
 * Options:
 *   --ttl <seconds>    Time to live (default: 3600)
 *   --issuer <string>  Issuer claim
 *   --audience <string> Audience claim
 *   -c, --claim <k=v>  Additional claims
 *   --no-iat           Omit iat/nbf claims
 *   --raw-sub          Use email as sub instead of user ID (legacy mode)
 */
import { parseArgs, getString, getNumber, getBoolean, getArray, hasHelp } from '../utils/args';
import { error, colors, EXIT_CODES } from '../utils/output';
import * as jose from 'jose';
import { db } from '../../db/client';
import { findUserByEmail } from '../../db/queries';

export interface GenerateJwtResult {
    success: boolean;
    message?: string;
    token?: string;
}

// Dependency injection for testing
export interface GenerateJwtDependencies {
    findUserByEmail: typeof findUserByEmail;
}

const defaultDependencies: GenerateJwtDependencies = {
    findUserByEmail,
};

function getJwtSecret(): string {
    return process.env.API_JWT_SECRET || process.env.JWT_SECRET || process.env.APP_SECRET || '';
}

/**
 * Parse a claim value, attempting type conversion
 */
function parseClaimValue(value: string): string | number | boolean {
    // Boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    // Number (int or float)
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') return num;
    // String
    return value;
}

export async function execute(
    positional: string[],
    flags: Record<string, string | boolean | string[]>,
    deps: GenerateJwtDependencies = defaultDependencies,
): Promise<GenerateJwtResult> {
    const [emailOrSub] = positional;

    // Validate required arguments
    if (!emailOrSub) {
        return {
            success: false,
            message: 'Missing required argument: email (user email address)',
        };
    }

    // Get JWT secret
    const secret = getJwtSecret();
    if (!secret) {
        return {
            success: false,
            message: 'JWT secret not configured. Set API_JWT_SECRET, JWT_SECRET, or APP_SECRET environment variable.',
        };
    }

    // Parse options
    const ttl = getNumber(flags, 'ttl', 3600)!;
    const issuer = getString(flags, 'issuer');
    const audience = getString(flags, 'audience');
    const noIat = getBoolean(flags, 'no-iat', false);
    const rawSub = getBoolean(flags, 'raw-sub', false);
    const extraClaims = getArray(flags, 'claim').concat(getArray(flags, 'c'));

    // Build payload
    const nowTs = Math.floor(Date.now() / 1000);
    const payload: jose.JWTPayload = {};

    // Determine sub and additional claims
    if (rawSub) {
        // Legacy mode: use provided value directly as sub
        payload.sub = emailOrSub;
    } else {
        // Modern mode: look up user by email, use numeric ID as sub
        const user = await deps.findUserByEmail(db, emailOrSub);
        if (!user) {
            return {
                success: false,
                message: `User not found: ${emailOrSub}`,
            };
        }

        // Use numeric ID as sub (standard JWT practice)
        payload.sub = String(user.id);
        payload.email = user.email;

        // Parse roles from string (format: '["ROLE_USER","ROLE_ADMIN"]')
        let roles: string[] = ['ROLE_USER'];
        try {
            if (user.roles) {
                const parsed = JSON.parse(user.roles);
                if (Array.isArray(parsed)) {
                    roles = parsed;
                }
            }
        } catch {
            // Keep default roles
        }
        payload.roles = roles;
        payload.isGuest = false;
    }

    // Add timing claims unless --no-iat
    if (!noIat) {
        payload.iat = nowTs;
        payload.nbf = nowTs;
    }

    // Expiration is always set
    payload.exp = nowTs + Math.max(1, ttl);

    // Add issuer and audience if provided
    if (issuer) payload.iss = issuer;
    if (audience) payload.aud = audience;

    // Parse extra claims
    const reservedClaims = ['exp', 'iat', 'nbf', 'sub', 'iss', 'aud', 'email', 'roles', 'isGuest'];
    for (const claim of extraClaims) {
        const eqIndex = claim.indexOf('=');
        if (eqIndex === -1) {
            console.error(colors.yellow(`WARNING: Invalid claim format (expected k=v): ${claim}`));
            continue;
        }
        const key = claim.slice(0, eqIndex).trim();
        const value = claim.slice(eqIndex + 1);

        if (!key) {
            console.error(colors.yellow(`WARNING: Empty claim key: ${claim}`));
            continue;
        }
        if (reservedClaims.includes(key)) {
            console.error(colors.yellow(`WARNING: Cannot override reserved claim: ${key}`));
            continue;
        }

        payload[key] = parseClaimValue(value);
    }

    // Sign JWT
    const secretKey = new TextEncoder().encode(secret);
    const token = await new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(secretKey);

    return {
        success: true,
        token,
    };
}

export function printHelp(): void {
    console.log(`
${colors.bold('jwt:generate')} - Generate a JWT token for API access

${colors.cyan('Usage:')}
  bun cli jwt:generate <email> [options]

${colors.cyan('Arguments:')}
  email       User email address (looked up in database to get user ID)

${colors.cyan('Options:')}
  --ttl <seconds>     Time to live in seconds (default: 3600)
  --issuer <string>   Issuer claim (iss)
  --audience <string> Audience claim (aud)
  -c, --claim <k=v>   Additional claim (can be used multiple times)
  --no-iat            Omit automatic iat/nbf timestamps
  --raw-sub           Use email as sub instead of looking up user ID (legacy mode)
  -h, --help          Show this help message

${colors.cyan('Environment:')}
  API_JWT_SECRET, JWT_SECRET, or APP_SECRET must be set

${colors.cyan('JWT Payload:')}
  The generated token includes:
  - sub: User's numeric ID (for API authorization)
  - email: User's email address
  - roles: User's roles from database
  - isGuest: false

${colors.cyan('Examples:')}
  bun cli jwt:generate user@exelearning.net
  bun cli jwt:generate user@exelearning.net --ttl=86400
  bun cli jwt:generate admin@example.com --issuer=exelearning --audience=api
  bun cli jwt:generate legacy@example.com --raw-sub  # Use email as sub directly

${colors.cyan('Output:')}
  The raw JWT token is printed to stdout for easy piping:
  TOKEN=$(bun cli jwt:generate user@exelearning.net)
`);
}

/**
 * CLI entry point handler - extracted for testability
 */
export async function runCli(
    argv: string[],
    deps: GenerateJwtDependencies = defaultDependencies,
    exitFn: (code: number) => void = code => process.exit(code),
): Promise<void> {
    const { positional, flags } = parseArgs(argv);

    if (hasHelp(flags)) {
        printHelp();
        exitFn(EXIT_CODES.SUCCESS);
        return;
    }

    try {
        const result = await execute(positional, flags, deps);
        if (result.success && result.token) {
            // Output only the token for easy piping
            console.log(result.token);
            exitFn(EXIT_CODES.SUCCESS);
        } else {
            error(result.message || 'Failed to generate JWT');
            exitFn(EXIT_CODES.FAILURE);
        }
    } catch (err) {
        error(err instanceof Error ? err.message : String(err));
        exitFn(EXIT_CODES.FAILURE);
    }
}

// Allow running directly
if (import.meta.main) {
    runCli(process.argv);
}
