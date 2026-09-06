import { beforeEach, describe, expect, it } from 'bun:test';
import { createControllerFactory, type ControllerFactory, type MediaPortLike } from './controller';

/**
 * The content-side controller: the API an iDevice drives, serialising neutral calls into
 * validated messages and fanning inbound events back out.
 *
 * The subtle part is not the command surface — it is that a page may hold several bridged
 * videos while the host runs ONE player over ONE transferred port. Whoever opened last
 * owns it, and the previous owner has to be told, or its question clock keeps reading a
 * time that will never advance again.
 */
let posted: unknown[];
let port: MediaPortLike & { started: boolean };
let factory: ControllerFactory;

function makePort() {
    const p = {
        started: false,
        onmessage: null as ((event: { data: unknown }) => void) | null,
        postMessage: (message: unknown) => posted.push(message),
        start: () => {
            p.started = true;
        },
    };
    return p;
}

const sent = () => posted as { action: string; [key: string]: unknown }[];
const actions = () => sent().map(m => m.action);
const deliver = (data: unknown) => port.onmessage?.({ data });
const event = (action: string, extra: Record<string, unknown> = {}) => ({
    type: 'exe-media',
    v: 1,
    action,
    ...extra,
});

beforeEach(() => {
    posted = [];
    port = makePort();
    factory = createControllerFactory();
});

describe('sending commands', () => {
    it('serialises each neutral call into a versioned, namespaced message', () => {
        const media = factory.create(port);

        media.play();
        media.pause();
        media.seek(12.5);

        expect(sent()[0]).toMatchObject({ type: 'exe-media', v: 1, action: 'play' });
        expect(actions()).toEqual(['play', 'pause', 'seek']);
        expect(sent()[2].t).toBe(12.5);
    });

    it('opens with the provider and id the caller asked for', () => {
        factory.create(port).open({ provider: 'youtube', videoId: 'aqz-KE-bpKQ', start: 30, autoplay: true });

        expect(sent()[0]).toMatchObject({
            action: 'open',
            provider: 'youtube',
            videoId: 'aqz-KE-bpKQ',
            start: 30,
            autoplay: true,
        });
    });

    /**
     * P5, closed. The transferred port is the authorisation, so a token stamped on every
     * command authenticated a channel only two endpoints could reach. It is gone from the
     * wire rather than sent-and-ignored, because nothing lags: the child runtime is
     * plugin-injected and refreshed on every extract, and plugins release with core.
     */
    it('stamps no capability token on the wire', () => {
        factory.create(port).play();

        expect(sent()[0]).not.toHaveProperty('exelearningBridge');
    });

    /** A command the protocol would reject must not reach the wire at all. */
    it('refuses to send a command it cannot validate', () => {
        const media = factory.create(port);

        media.seek(-1);
        media.open({ provider: 'evil.example', videoId: 'aqz-KE-bpKQ' });
        media.open({ provider: 'youtube', videoId: '../../evil' });

        expect(posted).toHaveLength(0);
    });

    it('sends the presentation commands the modal needs', () => {
        const media = factory.create(port);

        media.hide();
        media.show();
        media.close();

        expect(actions()).toEqual(['hide', 'show', 'close']);
    });

    it('binds the port once and starts it', () => {
        factory.create(port);
        factory.create(port);

        expect(port.started).toBe(true);
    });
});

describe('round-trip queries', () => {
    it('resolves getCurrentTime when the matching state arrives', async () => {
        const media = factory.create(port);
        const pending = media.getCurrentTime();

        const reqId = sent()[0].reqId as number;
        deliver(event('state', { reqId, currentTime: 42.5 }));

        expect(await pending).toBe(42.5);
    });

    it('resolves getDuration from the duration field, not the time field', async () => {
        const media = factory.create(port);
        const pending = media.getDuration();

        const reqId = sent()[0].reqId as number;
        deliver(event('state', { reqId, duration: 300 }));

        expect(await pending).toBe(300);
    });

    it('keeps concurrent queries apart by request id', async () => {
        const media = factory.create(port);
        const time = media.getCurrentTime();
        const duration = media.getDuration();

        const [first, second] = sent().map(m => m.reqId as number);
        expect(first).not.toBe(second);

        deliver(event('state', { reqId: second, duration: 300 }));
        deliver(event('state', { reqId: first, currentTime: 10 }));

        expect(await time).toBe(10);
        expect(await duration).toBe(300);
    });

    it('ignores a state for a request it never made', async () => {
        const media = factory.create(port);
        const pending = media.getCurrentTime();
        const reqId = sent()[0].reqId as number;

        deliver(event('state', { reqId: reqId + 999, currentTime: 1 }));
        deliver(event('state', { reqId, currentTime: 7 }));

        expect(await pending).toBe(7);
    });
});

describe('receiving events', () => {
    it('delivers each event to its listeners', () => {
        const media = factory.create(port);
        const seen: unknown[] = [];
        media.on('play', e => seen.push(e));

        deliver(event('play'));

        expect(seen).toHaveLength(1);
    });

    it('stops delivering after off()', () => {
        const media = factory.create(port);
        const seen: unknown[] = [];
        const listener = (e: unknown) => seen.push(e);
        media.on('play', listener).off('play', listener);

        deliver(event('play'));

        expect(seen).toHaveLength(0);
    });

    /** One broken listener must not silence the others, or block the relay. */
    it('keeps relaying when a listener throws', () => {
        const media = factory.create(port);
        const seen: unknown[] = [];
        media.on('play', () => {
            throw new Error('listener blew up');
        });
        media.on('play', e => seen.push(e));

        expect(() => deliver(event('play'))).not.toThrow();
        expect(seen).toHaveLength(1);
    });

    it('drops an event the protocol rejects', () => {
        const media = factory.create(port);
        const seen: unknown[] = [];
        media.on('timeupdate', e => seen.push(e));

        deliver(event('timeupdate', { currentTime: -5, duration: 10 }));
        deliver({ type: 'other', v: 1, action: 'timeupdate', currentTime: 1, duration: 10 });
        deliver(null);

        expect(seen).toHaveLength(0);
    });
});

describe('one active media per page', () => {
    /**
     * The host runs a single player over a single transferred port. Before this rule
     * existed, each new controller overwrote the port's one `onmessage` and silently froze
     * every earlier one — which broke any page with more than one bridged video.
     */
    it('tells the previous owner it was superseded', () => {
        const first = factory.create(port);
        const closed: { superseded?: boolean }[] = [];
        first.on('closed', e => closed.push(e as { superseded?: boolean }));

        factory.create(port);

        expect(closed).toHaveLength(1);
        expect(closed[0].superseded).toBe(true);
    });

    it('routes inbound events to the current owner only', () => {
        const first = factory.create(port);
        const firstSeen: unknown[] = [];
        first.on('play', e => firstSeen.push(e));

        const second = factory.create(port);
        const secondSeen: unknown[] = [];
        second.on('play', e => secondSeen.push(e));

        deliver(event('play'));

        expect(firstSeen).toHaveLength(0);
        expect(secondSeen).toHaveLength(1);
    });

    it('reports which controller is retired', () => {
        const first = factory.create(port);
        const second = factory.create(port);

        expect(first.isRetired()).toBe(true);
        expect(second.isRetired()).toBe(false);
    });

    it('does not supersede itself', () => {
        const media = factory.create(port);
        const closed: unknown[] = [];
        media.on('closed', e => closed.push(e));

        media.play();

        expect(closed).toHaveLength(0);
        expect(media.isRetired()).toBe(false);
    });

    /**
     * A DELIBERATE change from the incumbent, which cleared its pending map on supersede
     * and left those promises unsettled forever. An iDevice awaiting `getCurrentTime()`
     * when a second video opened would hang for the life of the page.
     */
    it('settles queries left pending when it is superseded', async () => {
        const first = factory.create(port);
        const pending = first.getCurrentTime();

        factory.create(port);

        expect(await pending).toBeNull();
    });

    /** The mirror of settling on supersede: a query STARTED after it must not hang either. */
    it('answers null to a query made after it was superseded', async () => {
        const first = factory.create(port);
        factory.create(port);

        expect(await first.getCurrentTime()).toBeNull();
        expect(await first.getDuration()).toBeNull();
    });

    it('sends nothing once retired', () => {
        const first = factory.create(port);
        factory.create(port);
        posted.length = 0;

        first.play();
        first.seek(5);

        expect(posted).toHaveLength(0);
    });
});
