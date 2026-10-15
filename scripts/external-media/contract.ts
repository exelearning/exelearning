/**
 * The published contract for the external-media artifacts.
 *
 * A client needs to know what it is talking to: the protocol envelope, which providers
 * the relay will reconstruct, the handshake actions, and the sandbox applied to a
 * promoted player. All four already exist in the sources — so this file DERIVES them
 * rather than restating them, because a hand-written contract is just a third place to
 * get out of sync (which is the failure this whole programme exists to remove).
 *
 * Values that can be executed are executed. Values that only exist as literals inside
 * DOM code are asserted to be present, and a missing assertion FAILS THE BUILD rather
 * than emitting a contract that quietly disagrees with the code it describes.
 */
import { runInNewContext } from 'node:vm';
import { PROTOCOL_VERSION } from './manifest';

export class ContractError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ContractError';
    }
}

export interface ProviderContract {
    id: string;
    sampleCanonicalUrl: string;
}

export interface Contract {
    libraryProtocol: number;
    protocol: { type: string; version: number; commands: string[]; events: string[] };
    providers: ProviderContract[];
    handshake: { childToHost: string[]; hostToChild: string[] };
    sandbox: { video: string; crossOriginPdf: string };
}

export interface ContractSources {
    policy: string;
    relay: string;
    shim: string;
}

/** Sample ids used only to prove a provider template resolves; never shipped as data. */
const PROVIDER_PROBES: Record<string, string> = {
    youtube: 'aqz-KE-bpKQ',
    vimeo: '76979871',
    dailymotion: 'x8abc12',
    'mediateca-madrid': 'abcd1234',
};

const SANDBOX_VIDEO = 'allow-scripts allow-same-origin allow-popups allow-forms allow-presentation';
const SANDBOX_CROSS_ORIGIN_PDF = 'allow-same-origin';

function assertPresent(source: string, needle: string, what: string): void {
    if (!source.includes(needle)) {
        throw new ContractError(`${what} is no longer present in the source (looked for: ${needle})`);
    }
}

/**
 * Execute a classic browser script far enough to read the global it publishes.
 * The sources are deliberately DOM-free at module scope, so a bare object stands in
 * for `window`.
 */
function evaluateGlobals(source: string, globals: Record<string, unknown> = {}): Record<string, unknown> {
    const sandbox: Record<string, unknown> = { ...globals };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    runInNewContext(source, sandbox);
    return sandbox;
}

export function deriveContract(sources: ContractSources): Contract {
    // --- protocol: executed, because exe_media_policy.js is pure and side-effect free.
    const policyGlobals = evaluateGlobals(sources.policy);
    const policy = policyGlobals.exeMediaPolicy as
        | { TYPE: string; VERSION: number; COMMANDS: Record<string, number>; EVENTS: Record<string, number> }
        | undefined;
    if (!policy) {
        throw new ContractError('exe_media_policy.js did not publish window.exeMediaPolicy');
    }
    if (policy.VERSION !== PROTOCOL_VERSION) {
        throw new ContractError(
            `protocol version drift: policy says ${policy.VERSION}, manifest says ${PROTOCOL_VERSION}`,
        );
    }

    // --- providers: executed against the relay's own reconstruction, so the contract
    // can only list templates the relay will really build.
    const relayGlobals = evaluateGlobals(sources.relay, { document: undefined });
    const relay = relayGlobals.exeEmbedRelay as
        | { reconstructProvider: (provider: string, id: string) => string | null }
        | undefined;
    if (!relay?.reconstructProvider) {
        throw new ContractError('exe_embed_relay.js did not publish reconstructProvider');
    }
    const providers: ProviderContract[] = [];
    for (const id of Object.keys(PROVIDER_PROBES).sort()) {
        const url = relay.reconstructProvider(id, PROVIDER_PROBES[id]);
        if (!url) {
            throw new ContractError(`relay can no longer reconstruct a canonical URL for provider "${id}"`);
        }
        providers.push({ id, sampleCanonicalUrl: url });
    }

    // --- handshake + sandbox: literals inside DOM code, so assert rather than execute.
    assertPresent(sources.shim, "action: 'hello'", 'the shim handshake announcement');
    assertPresent(sources.relay, "action: 'welcome'", 'the relay handshake answer');
    assertPresent(sources.relay, "action: 'request'", 'the relay geometry re-sync ping');
    assertPresent(sources.shim, "action: 'sync'", 'the shim geometry report');
    assertPresent(sources.relay, SANDBOX_VIDEO, 'the promoted video-player sandbox');
    assertPresent(sources.relay, `setAttribute('sandbox', '${SANDBOX_CROSS_ORIGIN_PDF}')`, 'the cross-origin PDF sandbox');

    return {
        libraryProtocol: PROTOCOL_VERSION,
        protocol: {
            type: policy.TYPE,
            version: policy.VERSION,
            commands: Object.keys(policy.COMMANDS).sort(),
            events: Object.keys(policy.EVENTS).sort(),
        },
        providers,
        handshake: { childToHost: ['hello', 'sync'], hostToChild: ['welcome', 'request'] },
        sandbox: { video: SANDBOX_VIDEO, crossOriginPdf: SANDBOX_CROSS_ORIGIN_PDF },
    };
}
