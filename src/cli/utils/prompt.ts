/**
 * CLI Prompt Utilities
 *
 * Interactive input helpers. `promptHidden` reads a secret without echoing it,
 * so passwords never reach the shell history or a process listing.
 */

/**
 * Minimal stream surface used by the prompts. Declared structurally so tests can
 * inject fakes without pulling in real TTY handles.
 */
export interface PromptInput {
    isTTY?: boolean;
    setRawMode?: (mode: boolean) => unknown;
    resume?: () => unknown;
    pause?: () => unknown;
    setEncoding?: (encoding: string) => unknown;
    on: (event: string, listener: (chunk: string) => void) => unknown;
    off?: (event: string, listener: (chunk: string) => void) => unknown;
    removeListener?: (event: string, listener: (chunk: string) => void) => unknown;
}

export interface PromptOutput {
    write: (text: string) => unknown;
}

export interface PromptIo {
    input: PromptInput;
    output: PromptOutput;
}

/** Thrown when the user aborts the prompt with Ctrl+C. */
export class PromptAbortedError extends Error {
    constructor(message = 'Aborted') {
        super(message);
        this.name = 'PromptAbortedError';
    }
}

const ETX = '\u0003'; // Ctrl+C
const EOT = '\u0004'; // Ctrl+D
const BACKSPACE = '\u0008';
const DELETE = '\u007f';

function defaultIo(): PromptIo {
    return {
        input: process.stdin as unknown as PromptInput,
        output: process.stdout as unknown as PromptOutput,
    };
}

/**
 * Whether the given input stream can run an interactive prompt.
 */
export function isInteractive(io: PromptIo = defaultIo()): boolean {
    return io.input.isTTY === true && typeof io.input.setRawMode === 'function';
}

/**
 * Ask for a secret without echoing it back to the terminal.
 *
 * Requires an interactive TTY; callers should check `isInteractive()` first and
 * offer a non-interactive path (for example `--password-stdin`) otherwise.
 *
 * @throws PromptAbortedError when the user presses Ctrl+C.
 */
export function promptHidden(question: string, io: PromptIo = defaultIo()): Promise<string> {
    const { input, output } = io;

    if (!isInteractive(io)) {
        return Promise.reject(new Error('Interactive input is not available (stdin is not a TTY)'));
    }

    return new Promise<string>((resolve, reject) => {
        let value = '';
        let settled = false;

        output.write(question);
        input.setEncoding?.('utf8');
        input.setRawMode?.(true);
        input.resume?.();

        const detach = (): void => {
            input.setRawMode?.(false);
            input.pause?.();
            const remove = input.off ?? input.removeListener;
            remove?.call(input, 'data', onData);
        };

        const finish = (fn: () => void): void => {
            if (settled) return;
            settled = true;
            detach();
            output.write('\n');
            fn();
        };

        function onData(chunk: string): void {
            for (const char of String(chunk)) {
                if (char === ETX) {
                    finish(() => reject(new PromptAbortedError()));
                    return;
                }
                if (char === '\r' || char === '\n') {
                    finish(() => resolve(value));
                    return;
                }
                if (char === EOT) {
                    // Ctrl+D ends the entry, like a terminating newline.
                    finish(() => resolve(value));
                    return;
                }
                if (char === BACKSPACE || char === DELETE) {
                    value = value.slice(0, -1);
                    continue;
                }
                // Ignore remaining control characters (arrow keys, escape sequences).
                if (char.charCodeAt(0) < 0x20) continue;
                value += char;
            }
        }

        input.on('data', onData);
    });
}

/**
 * Read a single line from a non-TTY stdin, used by `--password-stdin`.
 * Trailing newline characters are stripped; everything after the first newline
 * is ignored so a here-doc with a trailing blank line still works.
 */
export async function readSecretFromStdin(stream: ReadableStream<Uint8Array> = Bun.stdin.stream()): Promise<string> {
    const decoder = new TextDecoder();
    let buffer = '';

    for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
        buffer += decoder.decode(chunk, { stream: true });
        if (buffer.includes('\n')) break;
    }
    buffer += decoder.decode();

    const [firstLine] = buffer.split('\n');
    return firstLine.replace(/\r$/, '');
}
