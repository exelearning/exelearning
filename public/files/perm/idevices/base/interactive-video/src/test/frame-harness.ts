/**
 * Test-only harness for the cross-origin frame adapters.
 *
 * A stand-in for a cross-origin `<iframe>`: it records postMessage calls on
 * its contentWindow and lets the test fire a synthetic `load` event. The
 * adapters only touch `.src`, `.contentWindow`, `.addEventListener('load')`
 * and `.removeEventListener`, so this shape is sufficient.
 */

export interface RecordedPost {
    msg: string;
    targetOrigin: string;
}

export interface FakeIframe {
    src: string;
    contentWindow: { postMessage: (msg: string, targetOrigin: string) => void };
    posts: RecordedPost[];
    lastPost(): RecordedPost | undefined;
    lastParsed(): Record<string, unknown> | null;
    postsMatching(
        predicate: (parsed: Record<string, unknown>) => boolean,
    ): Array<RecordedPost & { parsed: Record<string, unknown> }>;
    addEventListener(type: string, fn: () => void): void;
    removeEventListener(type: string, fn: () => void): void;
    fireLoad(): void;
}

export function makeFakeIframe(src: string): FakeIframe {
    const posts: RecordedPost[] = [];
    const loadHandlers: Array<() => void> = [];
    return {
        src,
        contentWindow: {
            postMessage: (msg, targetOrigin) => posts.push({ msg, targetOrigin }),
        },
        posts,
        lastPost() {
            return posts[posts.length - 1];
        },
        lastParsed() {
            const post = posts[posts.length - 1];
            return post ? (JSON.parse(post.msg) as Record<string, unknown>) : null;
        },
        postsMatching(predicate) {
            return posts
                .map(post => ({ ...post, parsed: JSON.parse(post.msg) as Record<string, unknown> }))
                .filter(post => predicate(post.parsed));
        },
        addEventListener(type, fn) {
            if (type === 'load') {
                loadHandlers.push(fn);
            }
        },
        removeEventListener() {},
        fireLoad() {
            for (const fn of loadHandlers.slice()) {
                fn();
            }
        },
    };
}

/** Treat the fake as the HTMLIFrameElement the adapters expect. */
export function asIframe(fake: FakeIframe): HTMLIFrameElement {
    return fake as unknown as HTMLIFrameElement;
}

/** Dispatch a window `message` event with an explicit source/origin. */
export function dispatchMessage(options: { source: unknown; origin: string; data: string }): void {
    window.dispatchEvent(
        new MessageEvent('message', {
            data: options.data,
            origin: options.origin,
            source: options.source as MessageEventSource,
        }),
    );
}
