/**
 * Keeping the old global names alive while they are being retired.
 *
 * `window.exeEmbedShim`, `exeEmbedRelay`, `exeMediaPolicy`, `exeMediaBridge` and
 * `exeMediaHost` are referenced by five host plugins and by exported packages already in
 * circulation. They keep working, backed by the canonical runtime, and say so once.
 *
 * Once per name per session, deliberately. A warning per call would drown the console of
 * a page with several embeds and train everyone to ignore it — which is the same as not
 * warning at all. The point is that a maintainer sees it, learns the replacement, and is
 * not punished for it afterwards.
 *
 * These facades are removed in a later major (ADR-2199-11 step 4), never here.
 */

export interface DeprecationOptions {
    /** Injected so tests observe rather than pollute a console. */
    warn?(message: string): void;
}

export interface Deprecations {
    /** Announce one legacy name. Repeat calls for the same name are silent. */
    notice(name: string, replacement: string): void;
    /** Names announced so far, in order. */
    announced(): string[];
}

export function createDeprecations({ warn }: DeprecationOptions = {}): Deprecations {
    const seen = new Set<string>();
    const order: string[] = [];
    const emit = warn ?? ((message: string) => console.warn(message));

    return {
        notice(name, replacement) {
            if (seen.has(name)) return;
            seen.add(name);
            order.push(name);
            emit(
                `[exe] window.${name} is deprecated and will be removed in a future major. ` +
                    `Use ${replacement}. It still works for now; nothing needs changing today.`,
            );
        },
        announced() {
            return [...order];
        },
    };
}

/**
 * Wrap an object so touching any of its properties announces the legacy name once.
 *
 * A getter rather than a copy: the plugins reach for these globals at call time, often
 * long after load, so the notice has to fire when they are *used* and not when they are
 * published — otherwise every page would warn about names nobody called.
 *
 * Falls back to the plain target where `Proxy` is unavailable, because a missing warning
 * is a far better outcome than a runtime that will not start.
 */
export function withDeprecationNotice<T extends object>(
    target: T,
    name: string,
    replacement: string,
    deprecations: Deprecations,
): T {
    if (typeof Proxy === 'undefined') return target;
    return new Proxy(target, {
        get(object, property, receiver) {
            deprecations.notice(name, replacement);
            return Reflect.get(object, property, receiver);
        },
    });
}
