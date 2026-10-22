/**
 * Conservative repair of jsonProperties payloads damaged outside eXeLearning (#2611).
 *
 * eXeLearning writes jsonProperties with JSON.stringify, so it never produces
 * invalid JSON itself. Packages whose content.xml was generated or edited by
 * other tools — AI generators, scripts splicing HTML into the JSON string —
 * do: the import then keeps the payload verbatim and blocks edition (#2190),
 * which saves the data but leaves the author unable to edit the activity.
 *
 * This fixes only the damage those tools typically leave, in one pass:
 * - a `"` inside a string that is not followed by a structural token
 *   (`,` `}` `]` `:` or the end) is an unescaped quote, usually from an HTML
 *   attribute, and gets escaped;
 * - raw control characters inside a string (line breaks, tabs) are escaped;
 * - a backslash that does not start a valid JSON escape is escaped itself;
 * - a trailing comma before `}` or `]` is dropped.
 *
 * The result only counts when it parses to an object. Anything else returns
 * null and the caller keeps the original payload untouched, so a payload this
 * cannot fix is never made worse.
 */

const STRUCTURAL_AFTER_STRING = new Set([',', '}', ']', ':']);
const SIMPLE_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't']);
const CONTROL_ESCAPES: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t', '\b': '\\b', '\f': '\\f' };

function isWhitespace(ch: string | undefined): boolean {
    return ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t';
}

/** First non-whitespace character at or after `index`, or undefined at the end. */
function nextSignificant(text: string, index: number): string | undefined {
    let i = index;
    while (i < text.length && isWhitespace(text[i])) i++;
    return text[i];
}

/**
 * Rewrite the damage classes listed above. Returns the rewritten text; it is
 * not guaranteed to be valid JSON.
 */
function rewrite(text: string): string {
    let out = '';
    let inString = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (!inString) {
            if (ch === '"') {
                inString = true;
            } else if (ch === ',') {
                const next = nextSignificant(text, i + 1);
                if (next === '}' || next === ']') continue;
            }
            out += ch;
            continue;
        }

        if (ch === '\\') {
            const next = text[i + 1];
            if (next !== undefined && SIMPLE_ESCAPES.has(next)) {
                out += ch + next;
                i++;
            } else if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
                out += text.slice(i, i + 6);
                i += 5;
            } else {
                out += '\\\\';
            }
            continue;
        }

        if (ch === '"') {
            const next = nextSignificant(text, i + 1);
            if (next === undefined || STRUCTURAL_AFTER_STRING.has(next)) {
                inString = false;
                out += ch;
            } else {
                out += '\\"';
            }
            continue;
        }

        if (ch.charCodeAt(0) < 0x20) {
            out += CONTROL_ESCAPES[ch] ?? `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`;
            continue;
        }

        out += ch;
    }

    return out;
}

/**
 * Try to repair a jsonProperties payload that JSON.parse rejected.
 *
 * @param raw - payload exactly as stored in the package
 * @returns the parsed object when the repair produced valid JSON for an
 *   object, null when the payload cannot be repaired safely
 */
export function repairJsonProperties(raw: string): Record<string, unknown> | null {
    if (typeof raw !== 'string' || raw.trim() === '') return null;

    const repaired = rewrite(raw);
    if (repaired === raw) return null;

    try {
        const parsed: unknown = JSON.parse(repaired);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // Not repairable with the safe rewrites: the caller keeps the original.
    }
    return null;
}
