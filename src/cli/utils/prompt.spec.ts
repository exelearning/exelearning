import { describe, it, expect } from 'bun:test';
import { promptHidden, isInteractive, readSecretFromStdin, PromptAbortedError, type PromptIo } from './prompt';

/**
 * Fake TTY stdin: records the raw-mode transitions and lets a test push
 * keystrokes into the registered 'data' listener.
 */
function createFakeIo(options: { isTTY?: boolean } = {}): PromptIo & {
    send: (chunk: string) => void;
    written: string[];
    rawModes: boolean[];
    listenerCount: () => number;
} {
    const listeners: Array<(chunk: string) => void> = [];
    const written: string[] = [];
    const rawModes: boolean[] = [];

    const input = {
        isTTY: options.isTTY ?? true,
        setRawMode: (mode: boolean) => rawModes.push(mode),
        resume: () => undefined,
        pause: () => undefined,
        setEncoding: () => undefined,
        on: (event: string, listener: (chunk: string) => void) => {
            if (event === 'data') listeners.push(listener);
        },
        off: (event: string, listener: (chunk: string) => void) => {
            if (event !== 'data') return;
            const index = listeners.indexOf(listener);
            if (index !== -1) listeners.splice(index, 1);
        },
    };

    return {
        input,
        output: { write: (text: string) => written.push(text) },
        send: (chunk: string) => listeners.slice().forEach(listener => listener(chunk)),
        written,
        rawModes,
        listenerCount: () => listeners.length,
    };
}

describe('isInteractive', () => {
    it('is true for a TTY that supports raw mode', () => {
        expect(isInteractive(createFakeIo())).toBe(true);
    });

    it('is false when stdin is not a TTY', () => {
        expect(isInteractive(createFakeIo({ isTTY: false }))).toBe(false);
    });

    it('is false when raw mode is unavailable', () => {
        const io = { input: { isTTY: true, on: () => undefined }, output: { write: () => undefined } };
        expect(isInteractive(io)).toBe(false);
    });
});

describe('promptHidden', () => {
    it('collects typed characters and resolves on Enter', async () => {
        const io = createFakeIo();
        const promise = promptHidden('Password: ', io);

        io.send('s3cret');
        io.send('\r');

        expect(await promise).toBe('s3cret');
    });

    it('never echoes the typed characters', async () => {
        const io = createFakeIo();
        const promise = promptHidden('Password: ', io);

        io.send('s3cret\r');
        await promise;

        expect(io.written.join('')).toBe('Password: \n');
    });

    it('resolves on a line feed as well as a carriage return', async () => {
        const io = createFakeIo();
        const promise = promptHidden('Password: ', io);

        io.send('abc\n');

        expect(await promise).toBe('abc');
    });

    it('handles backspace and delete', async () => {
        const io = createFakeIo();
        const promise = promptHidden('Password: ', io);

        io.send('abcd');
        io.send('\u0008'); // backspace
        io.send('\u007f'); // delete
        io.send('X\r');

        expect(await promise).toBe('abX');
    });

    it('ignores escape sequences such as arrow keys', async () => {
        const io = createFakeIo();
        const promise = promptHidden('Password: ', io);

        io.send('ab\u001b[Dc\r');

        expect(await promise).toBe('ab[Dc');
    });

    it('resolves an empty string when Enter is pressed immediately', async () => {
        const io = createFakeIo();
        const promise = promptHidden('Password: ', io);

        io.send('\r');

        expect(await promise).toBe('');
    });

    it('resolves what was typed when Ctrl+D ends the entry', async () => {
        const io = createFakeIo();
        const promise = promptHidden('Password: ', io);

        io.send('abc\u0004');

        expect(await promise).toBe('abc');
    });

    it('rejects with PromptAbortedError on Ctrl+C', async () => {
        const io = createFakeIo();
        const promise = promptHidden('Password: ', io);

        io.send('abc\u0003');

        await expect(promise).rejects.toBeInstanceOf(PromptAbortedError);
    });

    it('restores the terminal and detaches the listener when finished', async () => {
        const io = createFakeIo();
        const promise = promptHidden('Password: ', io);

        io.send('abc\r');
        await promise;

        expect(io.rawModes).toEqual([true, false]);
        expect(io.listenerCount()).toBe(0);
    });

    it('ignores further keystrokes after resolving', async () => {
        const io = createFakeIo();
        const promise = promptHidden('Password: ', io);

        io.send('abc\r');
        io.send('ignored\r');

        expect(await promise).toBe('abc');
    });

    it('rejects when stdin is not interactive', async () => {
        const io = createFakeIo({ isTTY: false });

        await expect(promptHidden('Password: ', io)).rejects.toThrow('not a TTY');
    });
});

describe('readSecretFromStdin', () => {
    function streamOf(text: string): ReadableStream<Uint8Array> {
        return new Response(text).body as ReadableStream<Uint8Array>;
    }

    it('reads a single line', async () => {
        expect(await readSecretFromStdin(streamOf('s3cret\n'))).toBe('s3cret');
    });

    it('ignores everything after the first newline', async () => {
        expect(await readSecretFromStdin(streamOf('s3cret\nignored\n'))).toBe('s3cret');
    });

    it('strips a trailing carriage return', async () => {
        expect(await readSecretFromStdin(streamOf('s3cret\r\n'))).toBe('s3cret');
    });

    it('reads input with no trailing newline', async () => {
        expect(await readSecretFromStdin(streamOf('s3cret'))).toBe('s3cret');
    });

    it('returns an empty string for empty input', async () => {
        expect(await readSecretFromStdin(streamOf(''))).toBe('');
    });
});
