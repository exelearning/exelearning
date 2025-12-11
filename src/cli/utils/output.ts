/**
 * CLI Output Utilities
 * ANSI colors and formatted output for terminal
 */

// ANSI color codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

/**
 * Color functions
 */
export const colors = {
    reset: (text: string) => `${RESET}${text}`,
    bold: (text: string) => `${BOLD}${text}${RESET}`,
    dim: (text: string) => `${DIM}${text}${RESET}`,
    red: (text: string) => `${RED}${text}${RESET}`,
    green: (text: string) => `${GREEN}${text}${RESET}`,
    yellow: (text: string) => `${YELLOW}${text}${RESET}`,
    blue: (text: string) => `${BLUE}${text}${RESET}`,
    magenta: (text: string) => `${MAGENTA}${text}${RESET}`,
    cyan: (text: string) => `${CYAN}${text}${RESET}`,
    gray: (text: string) => `${GRAY}${text}${RESET}`,
};

/**
 * Print success message
 */
export function success(message: string): void {
    console.log(`${GREEN}SUCCESS${RESET} ${message}`);
}

/**
 * Print error message
 */
export function error(message: string): void {
    console.error(`${RED}ERROR${RESET} ${message}`);
}

/**
 * Print warning message
 */
export function warning(message: string): void {
    console.warn(`${YELLOW}WARNING${RESET} ${message}`);
}

/**
 * Print info message
 */
export function info(message: string): void {
    console.log(`${CYAN}INFO${RESET} ${message}`);
}

/**
 * Print a simple table
 */
export function table(headers: string[], rows: string[][]): void {
    if (headers.length === 0) return;

    // Calculate column widths
    const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] || '').length)));

    // Create separator line
    const separator = '+' + colWidths.map(w => '-'.repeat(w + 2)).join('+') + '+';

    // Format a row
    const formatRow = (row: string[]) =>
        '| ' + row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' | ') + ' |';

    // Print table
    console.log(separator);
    console.log(formatRow(headers));
    console.log(separator);
    rows.forEach(row => console.log(formatRow(row)));
    console.log(separator);
}

/**
 * Print key-value pairs
 */
export function keyValue(pairs: Record<string, string | number | boolean | null | undefined>): void {
    const maxKeyLen = Math.max(...Object.keys(pairs).map(k => k.length));
    for (const [key, value] of Object.entries(pairs)) {
        const displayValue = value === null || value === undefined ? colors.dim('(none)') : String(value);
        console.log(`  ${colors.cyan(key.padEnd(maxKeyLen))}  ${displayValue}`);
    }
}

/**
 * Print a list with bullets
 */
export function list(items: string[], bullet = '-'): void {
    for (const item of items) {
        console.log(`  ${colors.dim(bullet)} ${item}`);
    }
}

/**
 * Print section header
 */
export function section(title: string): void {
    console.log();
    console.log(colors.bold(title));
    console.log(colors.dim('-'.repeat(title.length)));
}

/**
 * Exit codes
 */
export const EXIT_CODES = {
    SUCCESS: 0,
    FAILURE: 1,
    INVALID_ARGS: 2,
    NOT_FOUND: 3,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];
