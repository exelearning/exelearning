/**
 * Provider-adapter factory: routes a `{provider, video|iframe}` spec to the
 * right adapter and rebuilds canonical embed URLs. Published on the page as
 * `window.exeInteractiveVideoProviders` by both bundle entry points; consumers
 * RESOLVE it through that global (with the bundled copy as fallback) so tests
 * can substitute a fake factory before the bundle binds.
 */

import { isNativeProvider } from '../shared/video-source';
import { createBaseAdapter } from './callbacks';
import { createLocalAdapter } from './html5-adapter';
import { mediatecaStreamUrl } from './mediateca';
import type { AdapterSpec, ProviderAdapter, ProviderFactory } from './types';
import { createVimeoAdapter, vimeoEmbedUrl } from './vimeo-adapter';
import { createYouTubeAdapter, youTubeEmbedUrl } from './youtube-adapter';

/** Canonical, controllable embed URL for iframe providers ('' when none). */
export function embedUrl(provider: string, videoId: unknown): string {
    if (provider === 'youtube') {
        return youTubeEmbedUrl(videoId);
    }
    if (provider === 'vimeo') {
        return vimeoEmbedUrl(videoId);
    }
    return '';
}

/** A safe, inert adapter used when the DOM mount is missing / provider unknown. */
export function createDegradedAdapter(): ProviderAdapter {
    const base = createBaseAdapter();
    return {
        onTimeUpdate: base.onTimeUpdate,
        onStateChange: base.onStateChange,
        onReady: base.onReady,
        load() {
            return Promise.reject(new Error('interactive-video: provider unavailable'));
        },
        play() {},
        pause() {},
        seekTo() {},
        getCurrentTime() {
            return Promise.resolve(0);
        },
        getDuration() {
            return Promise.resolve(null);
        },
        destroy() {
            base.clearSubscribers();
        },
    };
}

/**
 * Build the adapter for a provider. `video` is the native `<video>` element
 * for local/mediateca; `iframe` is the embed frame for youtube/vimeo.
 */
export function createAdapter(spec?: AdapterSpec | null): ProviderAdapter {
    const options = spec || {};
    const provider = options.provider;
    if (isNativeProvider(provider) && options.video) {
        return createLocalAdapter(options.video, options);
    }
    if (provider === 'youtube' && options.iframe) {
        return createYouTubeAdapter(options.iframe, options);
    }
    if (provider === 'vimeo' && options.iframe) {
        return createVimeoAdapter(options.iframe, options);
    }
    return createDegradedAdapter();
}

/** The factory object published as `window.exeInteractiveVideoProviders`. */
export function createProviderFactory(): ProviderFactory {
    return {
        embedUrl: embedUrl,
        mediatecaStreamUrl: mediatecaStreamUrl,
        createAdapter: createAdapter,
    };
}

export { mediatecaStreamUrl };
export type { AdapterSpec, PlaybackState, ProviderAdapter, ProviderFactory } from './types';
