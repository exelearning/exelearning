interface TagRange {
    start: number;
    end: number;
}

function hasClassToken(classValue: string, token: string): boolean {
    return classValue
        .split(/\s+/)
        .map(value => value.trim())
        .filter(Boolean)
        .includes(token);
}

function findTagEnd(input: string, start: number): number {
    let quote: '"' | "'" | null = null;
    for (let i = start; i < input.length; i++) {
        const ch = input[i];

        if (quote) {
            if (ch === quote) {
                quote = null;
            }
            continue;
        }

        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }

        if (ch === '>') {
            return i;
        }
    }

    return -1;
}

function findMatchingClosingDiv(input: string, searchStart: number): TagRange | null {
    let depth = 1;
    let cursor = searchStart;

    while (cursor < input.length) {
        const lt = input.indexOf('<', cursor);
        if (lt === -1) {
            return null;
        }

        if (input.startsWith('<!--', lt)) {
            const commentEnd = input.indexOf('-->', lt + 4);
            if (commentEnd === -1) {
                return null;
            }
            cursor = commentEnd + 3;
            continue;
        }

        const tagEnd = findTagEnd(input, lt);
        if (tagEnd === -1) {
            return null;
        }

        const rawTag = input.slice(lt, tagEnd + 1);
        const nameMatch = rawTag.match(/^<\/?\s*([a-zA-Z0-9:-]+)/);
        if (!nameMatch) {
            cursor = tagEnd + 1;
            continue;
        }

        const tagName = nameMatch[1].toLowerCase();
        if (tagName !== 'div') {
            cursor = tagEnd + 1;
            continue;
        }

        const isClosing = /^<\//.test(rawTag);
        if (isClosing) {
            depth--;
            if (depth === 0) {
                return { start: lt, end: tagEnd + 1 };
            }
        } else {
            depth++;
        }

        cursor = tagEnd + 1;
    }

    return null;
}

/**
 * Remove only a top-level legacy <div class="exe-text"> wrapper when present.
 * Keeps sibling legacy feedback blocks if they follow the wrapper.
 */
export function stripLegacyExeTextWrapper(html: string): string {
    if (!html) {
        return html;
    }

    const leadingWhitespaceLength = html.match(/^\s*/)?.[0].length ?? 0;
    const trailingWhitespaceLength = html.match(/\s*$/)?.[0].length ?? 0;
    let coreStart = leadingWhitespaceLength;
    const coreEnd = html.length - trailingWhitespaceLength;

    while (coreStart < coreEnd && html.charCodeAt(coreStart) === 0xfeff) {
        coreStart++;
    }

    const core = html.slice(coreStart, coreEnd);
    if (!core.toLowerCase().startsWith('<div')) {
        return html;
    }

    const openingEnd = findTagEnd(core, 0);
    if (openingEnd === -1) {
        return html;
    }

    const openingTag = core.slice(0, openingEnd + 1);
    const classAttr = openingTag.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    if (!classAttr) {
        return html;
    }

    const classValue = classAttr[1] ?? classAttr[2] ?? classAttr[3] ?? '';
    if (!hasClassToken(classValue, 'exe-text')) {
        return html;
    }

    const closing = findMatchingClosingDiv(core, openingEnd + 1);
    if (!closing) {
        return html;
    }

    if (closing.end !== core.length) {
        const trailing = core.slice(closing.end).trim();
        const hasOnlyLegacyFeedbackSiblings =
            trailing.length > 0 &&
            (trailing.includes('iDevice_buttons feedback-button') ||
                trailing.includes('class="feedback ') ||
                trailing.includes("class='feedback "));

        if (!hasOnlyLegacyFeedbackSiblings) {
            return html;
        }

        return `${core.slice(openingEnd + 1, closing.start)}${core.slice(closing.end)}`;
    }

    return core.slice(openingEnd + 1, closing.start);
}
