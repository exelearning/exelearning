/**
 * CLI Argument Parser
 * Lightweight argument parsing without external dependencies
 */

export interface ParsedArgs {
    command: string;
    positional: string[];
    flags: Record<string, string | boolean | string[]>;
}

/**
 * Parse command line arguments
 * Supports: --flag, --key=value, --key value, -k value, -k=value
 *
 * @param argv - process.argv array
 * @returns Parsed arguments object
 */
export function parseArgs(argv: string[]): ParsedArgs {
    const args = argv.slice(2); // Skip 'bun' and script path
    const command = args[0] && !args[0].startsWith('-') ? args[0] : '';
    const positional: string[] = [];
    const flags: Record<string, string | boolean | string[]> = {};

    const startIndex = command ? 1 : 0;

    for (let i = startIndex; i < args.length; i++) {
        const arg = args[i];

        if (arg.startsWith('--')) {
            // Long flag: --key or --key=value or --key value
            const equalIndex = arg.indexOf('=');
            if (equalIndex !== -1) {
                const key = arg.slice(2, equalIndex);
                const value = arg.slice(equalIndex + 1);
                addFlag(flags, key, value);
            } else {
                const key = arg.slice(2);
                const nextArg = args[i + 1];
                if (nextArg && !nextArg.startsWith('-')) {
                    addFlag(flags, key, nextArg);
                    i++;
                } else {
                    flags[key] = true;
                }
            }
        } else if (arg.startsWith('-') && arg.length >= 2) {
            // Short flag: -k or -k=value or -k value
            const equalIndex = arg.indexOf('=');
            if (equalIndex !== -1) {
                const key = arg.slice(1, equalIndex);
                const value = arg.slice(equalIndex + 1);
                addFlag(flags, key, value);
            } else {
                const key = arg.slice(1);
                const nextArg = args[i + 1];
                if (nextArg && !nextArg.startsWith('-')) {
                    addFlag(flags, key, nextArg);
                    i++;
                } else {
                    flags[key] = true;
                }
            }
        } else {
            positional.push(arg);
        }
    }

    return { command, positional, flags };
}

/**
 * Add a flag value, supporting repeated flags as arrays
 */
function addFlag(flags: Record<string, string | boolean | string[]>, key: string, value: string): void {
    const existing = flags[key];
    if (existing === undefined) {
        flags[key] = value;
    } else if (Array.isArray(existing)) {
        existing.push(value);
    } else if (typeof existing === 'string') {
        flags[key] = [existing, value];
    } else {
        flags[key] = value;
    }
}

/**
 * Get a flag value as string
 */
export function getString(
    flags: Record<string, string | boolean | string[]>,
    key: string,
    defaultValue?: string,
): string | undefined {
    const value = flags[key];
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value[0];
    return defaultValue;
}

/**
 * Get a flag value as number
 */
export function getNumber(
    flags: Record<string, string | boolean | string[]>,
    key: string,
    defaultValue?: number,
): number | undefined {
    const str = getString(flags, key);
    if (str === undefined) return defaultValue;
    const num = parseInt(str, 10);
    return isNaN(num) ? defaultValue : num;
}

/**
 * Get a flag value as boolean
 */
export function getBoolean(
    flags: Record<string, string | boolean | string[]>,
    key: string,
    defaultValue = false,
): boolean {
    const value = flags[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        return value.toLowerCase() !== 'false' && value !== '0';
    }
    return defaultValue;
}

/**
 * Get all values for a repeated flag as array
 */
export function getArray(flags: Record<string, string | boolean | string[]>, key: string): string[] {
    const value = flags[key];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return [];
}

/**
 * Check if help flag is present
 */
export function hasHelp(flags: Record<string, string | boolean | string[]>): boolean {
    return flags['help'] === true || flags['h'] === true;
}
