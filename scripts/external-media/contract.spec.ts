import { describe, expect, it } from 'bun:test';
import { deriveContract, ContractError } from './contract';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../..');
const POLICY = join(ROOT, 'public/app/common/exe_media_bridge/exe_media_policy.js');
const RELAY = join(ROOT, 'public/app/common/exe_embed_bridge/exe_embed_relay.js');
const SHIM = join(ROOT, 'public/app/common/exe_embed_bridge/exe_embed_shim.js');

const sources = {
    policy: readFileSync(POLICY, 'utf8'),
    relay: readFileSync(RELAY, 'utf8'),
    shim: readFileSync(SHIM, 'utf8'),
};

describe('deriveContract', () => {
    it('reads the protocol envelope by EXECUTING the policy, not by re-typing it', () => {
        const c = deriveContract(sources);
        expect(c.protocol.type).toBe('exe-media');
        expect(c.protocol.version).toBe(1);
        // Closed enums the host validates against.
        expect(c.protocol.commands).toContain('play');
        expect(c.protocol.commands).toContain('seek');
        expect(c.protocol.events).toContain('timeupdate');
    });

    it('lists the providers the relay can actually reconstruct, with their canonical template', () => {
        const c = deriveContract(sources);
        const ids = c.providers.map(p => p.id).sort();
        expect(ids).toEqual(['dailymotion', 'mediateca-madrid', 'vimeo', 'youtube']);
        const youtube = c.providers.find(p => p.id === 'youtube');
        // Privacy-friendly host is part of the contract a client relies on.
        expect(youtube?.sampleCanonicalUrl).toContain('youtube-nocookie.com/embed/');
    });

    it('publishes the handshake actions, so a client cannot guess them wrong', () => {
        const c = deriveContract(sources);
        expect(c.handshake.childToHost).toContain('hello');
        expect(c.handshake.hostToChild).toContain('welcome');
        expect(c.handshake.hostToChild).toContain('request');
    });

    it('publishes the sandbox tokens applied to promoted players', () => {
        const c = deriveContract(sources);
        expect(c.sandbox.video).toBe('allow-scripts allow-same-origin allow-popups allow-forms allow-presentation');
        expect(c.sandbox.crossOriginPdf).toBe('allow-same-origin');
    });

    /**
     * The contract exists to stop a third source of truth appearing. If a source file
     * stops carrying a value the contract publishes, the BUILD must fail rather than
     * emit a contract that quietly disagrees with the code it describes.
     */
    it('fails loudly when the relay no longer carries a published sandbox token', () => {
        const tampered = { ...sources, relay: sources.relay.replace('allow-presentation', 'allow-nonsense') };
        expect(() => deriveContract(tampered)).toThrow(ContractError);
    });

    it('fails loudly when the shim no longer announces itself', () => {
        const tampered = { ...sources, shim: sources.shim.replace(/action: 'hello'/g, "action: 'howdy'") };
        expect(() => deriveContract(tampered)).toThrow(ContractError);
    });

    it('fails loudly when the policy protocol version drifts from the manifest', () => {
        const tampered = { ...sources, policy: sources.policy.replace('var VERSION = 1;', 'var VERSION = 2;') };
        expect(() => deriveContract(tampered)).toThrow(ContractError);
    });

    it('serialises deterministically', () => {
        const a = JSON.stringify(deriveContract(sources));
        const b = JSON.stringify(deriveContract(sources));
        expect(a).toBe(b);
    });
});
