/**
 * The provider-adapter contract. One interface normalizes playback control and
 * time events for every supported provider (native HTML5 media, YouTube,
 * Vimeo, Mediateca) so a single scheduler can drive them all.
 *
 * Cross-origin embeds are driven by RAW postMessage — the same wire protocols
 * the official IFrame APIs use — so NO provider SDK `<script>` is ever loaded
 * into exported content (ADR-0003/ADR-0004). All time signals are event-push;
 * there is no polling.
 */

/** The shared playback-state vocabulary every adapter reports. */
export type PlaybackState = 'playing' | 'paused' | 'ended';

export interface ProviderAdapter {
    load(): Promise<void>;
    play(): void;
    pause(): void;
    seekTo(seconds: number): void;
    getCurrentTime(): Promise<number>;
    getDuration(): Promise<number | null>;
    onReady(callback: () => void): void;
    onTimeUpdate(callback: (seconds: number) => void): void;
    onStateChange(callback: (state: PlaybackState) => void): void;
    destroy(): void;
}

/** What `createAdapter` needs to build the right adapter for a provider. */
export interface AdapterSpec {
    provider?: string;
    url?: string;
    videoId?: string | null;
    /** The native `<video>` element (local files, direct URLs, Mediateca). */
    video?: HTMLVideoElement | null;
    /** The embed frame (YouTube, Vimeo). */
    iframe?: HTMLIFrameElement | null;
    /** Handshake/load timeout in milliseconds. */
    timeout?: number;
}

/** The factory surface published as `window.exeInteractiveVideoProviders`. */
export interface ProviderFactory {
    embedUrl(provider: string, videoId: unknown): string;
    mediatecaStreamUrl(videoId: unknown): string;
    createAdapter(spec?: AdapterSpec | null): ProviderAdapter;
}
