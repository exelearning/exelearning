/**
 * The inline preview player and the proportional timeline under it: mounting
 * the playback surface (native `<video>` or provider iframe), the provider
 * adapter that drives seek/current-time, the progress bar + playhead, and the
 * positioned interaction markers.
 */

import { createProviderFactory } from '../providers/index';
import type { AdapterSpec, ProviderFactory } from '../providers/types';
import { escapeHtml } from '../shared/html';
import { sortInteractions } from '../shared/scheduling';
import { secondsToHms } from '../shared/time';
import { normalizeVideoSource } from '../shared/video-source';
import { typeLabel } from './form';
import type { EditionState } from './state';
import { tr } from './state';

const bundledProviders = createProviderFactory();

/**
 * The provider factory, resolved THROUGH the window global when one is
 * published (so the E2E fake-provider seam can intercept it); the bundled
 * implementation is the fallback.
 */
function providers(): ProviderFactory {
    if (typeof window !== 'undefined') {
        const external = window.exeInteractiveVideoProviders as ProviderFactory | undefined;
        if (external && typeof external.createAdapter === 'function') {
            return external;
        }
    }
    return bundledProviders;
}

/** Prefer the shared provider layer's embed URL (enablejsapi etc.). */
export function resolveEmbedUrl(provider: string, videoId: unknown): string {
    return providers().embedUrl(provider, videoId);
}

/** Write a message to the stable editor live region. */
export function announce(text: string): void {
    const region = document.getElementById('ivEditorLive');
    if (region) {
        region.textContent = text;
    }
}

/** The active video reference (URL or media-library path). */
export function currentSourceValue(): string {
    return $('#ivVideoFile').val() ?? '';
}

/**
 * The effective provider auto-detected from the single source field: a URL
 * resolves to youtube / vimeo / mediateca / 'local' (direct media); a bare
 * media-library path is 'local'. Returns null while the field is empty.
 */
export function currentProvider(): string | null {
    const value = currentSourceValue();
    if (!value) {
        return null;
    }
    const normalized = normalizeVideoSource(value);
    return normalized ? normalized.provider : 'local';
}

/** Keep the subtitles section in sync with the detected provider. Subtitles
 *  render as native `<video><track>`, so they apply to native surfaces
 *  (library file, direct media URL, Mediateca) but not to iframe embeds. */
export function toggleSource(): void {
    const provider = currentProvider();
    $('.exe-iv-captions-section').toggle(provider === 'local' || provider === 'mediateca');
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

/**
 * The seconds-per-100% scale of the timeline: the real video duration when
 * the adapter has reported one, else a fallback that spreads the existing
 * markers along the track (the last one lands at 95%). Returns 0 when there
 * is nothing to scale against.
 */
export function effectiveDuration(state: EditionState): number {
    if (state.duration != null && isFinite(state.duration) && state.duration > 0) {
        return state.duration;
    }
    let max = 0;
    for (const interaction of state.doc.interactions) {
        if (isFinite(interaction.time)) {
            max = Math.max(max, interaction.time);
        }
    }
    return max > 0 ? max / 0.95 : 0;
}

/** Move the progress fill and the playhead knob to `seconds`. */
export function updateTimelineProgress(state: EditionState, seconds: number): void {
    const progress = document.getElementById('ivTimelineProgress');
    const playhead = document.getElementById('ivTimelinePlayhead');
    if (!progress || !playhead) {
        return;
    }
    const duration = effectiveDuration(state);
    const pct = duration > 0 ? Math.min(100, Math.max(0, (seconds / duration) * 100)) : 0;
    progress.style.width = pct.toFixed(2) + '%';
    playhead.style.left = pct.toFixed(2) + '%';
}

/** Rebuild the positioned timeline markers (one seek button per interaction). */
export function renderTimelineMarkers(state: EditionState, onSelect: (id: string) => void): void {
    const strip = $('#ivEditTimeline');
    if (!strip.length) {
        return;
    }
    const interactions = sortInteractions(state.doc.interactions);
    const duration = effectiveDuration(state);
    const html = interactions
        .map(interaction => {
            const selected = interaction.id === state.selectedId ? ' is-selected' : '';
            const pct = duration > 0 ? Math.min(100, Math.max(0, (interaction.time / duration) * 100)) : 0;
            const label = secondsToHms(interaction.time) + ' — ' + tr(typeLabel(interaction.type));
            return (
                '<li class="exe-iv-edit-marker-item" style="left:' +
                pct.toFixed(2) +
                '%"><button type="button" class="exe-iv-edit-marker exe-iv-kind--' +
                escapeHtml(interaction.type) +
                selected +
                '" data-iv-id="' +
                interaction.id +
                '" title="' +
                escapeHtml(label) +
                '" aria-label="' +
                escapeHtml(label) +
                '"></button></li>'
            );
        })
        .join('');
    strip.html(html);
    strip.find('.exe-iv-edit-marker').on('click', function () {
        onSelect($(this).attr('data-iv-id') ?? '');
    });
}

/** Timeline-track click -> mm:ss into the add bar (and seek), proportionally. */
export function placeTimeFromTrack(state: EditionState, clientX: number): void {
    const track = document.getElementById('ivTimelineTrack');
    if (!track) {
        return;
    }
    const rect = track.getBoundingClientRect();
    const duration = effectiveDuration(state);
    if (!rect.width || !duration) {
        announce(tr('The video duration is not known yet. Play the video, or type the time manually.'));
        return;
    }
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const seconds = Math.round(fraction * duration);
    $('#ivAddTime').val(secondsToHms(seconds));
    seekTo(state, seconds);
    updateTimelineProgress(state, seconds);
    announce(tr('Add at') + ' ' + secondsToHms(seconds));
}

// ---------------------------------------------------------------------------
// Adapter / playback surface
// ---------------------------------------------------------------------------

/** Accept a freshly-known duration: re-render markers + progress on change. */
export function setDuration(state: EditionState, duration: number | null | undefined, onScaleChange: () => void): void {
    if (duration != null && isFinite(duration) && duration > 0 && duration !== state.duration) {
        state.duration = duration;
        onScaleChange();
        updateTimelineProgress(state, state.lastTime);
    }
}

/** Ask the adapter for the video duration once; re-render markers when known. */
export function fetchDuration(state: EditionState, onScaleChange: () => void): void {
    const adapter = state.adapter;
    if (state.durationPending || !adapter || typeof adapter.getDuration !== 'function') {
        return;
    }
    state.durationPending = true;
    let result: Promise<number | null>;
    try {
        result = adapter.getDuration();
    } catch {
        state.durationPending = false;
        return;
    }
    if (!result || typeof result.then !== 'function') {
        state.durationPending = false;
        return;
    }
    result.then(
        duration => {
            state.durationPending = false;
            setDuration(state, duration, onScaleChange);
        },
        () => {
            state.durationPending = false;
        },
    );
}

/** Live playhead callback: remember the time and move progress + knob. */
export function onPlayerTime(state: EditionState, seconds: number, onScaleChange: () => void): void {
    if (seconds == null || !isFinite(seconds)) {
        return;
    }
    state.lastTime = seconds;
    if (state.duration == null) {
        fetchDuration(state, onScaleChange);
    }
    updateTimelineProgress(state, seconds);
}

/** Seek the inline player: local `<video>` directly, else via the adapter. */
export function seekTo(state: EditionState, seconds: number): void {
    if (!isFinite(seconds)) {
        return;
    }
    const video = document.getElementById('ivEditPlayerVideo') as HTMLVideoElement | null;
    if (video) {
        try {
            video.currentTime = seconds;
        } catch {
            /* seeking not supported yet */
        }
        return;
    }
    const adapter = state.adapter;
    if (adapter && typeof adapter.seekTo === 'function') {
        try {
            adapter.seekTo(seconds);
        } catch {
            /* adapter not ready */
        }
    }
}

/**
 * Fill a time input from the live playhead. Local video reads the inline
 * `<video>` directly; every other provider reads the adapter's
 * getCurrentTime() (a Promise). When no live time is available, this
 * announces politely rather than doing nothing (never a silent no-op).
 * Returns a Promise so callers/tests can await the async providers.
 */
export function useCurrentTime(state: EditionState, targetId?: string): Promise<number | undefined> {
    const target = targetId || 'ivAddTime';
    function apply(seconds: unknown): seconds is number {
        if (typeof seconds === 'number' && isFinite(seconds)) {
            $('#' + target).val(secondsToHms(seconds));
            return true;
        }
        return false;
    }
    function unavailable(): void {
        announce(tr('The current playback time is not available yet. Play the video, or type the time manually.'));
    }
    // A native inline <video> (library file, direct URL, Mediateca): read the
    // playhead directly.
    const video = document.getElementById('ivEditPlayerVideo') as HTMLVideoElement | null;
    if (video && isFinite(video.currentTime)) {
        apply(video.currentTime);
        return Promise.resolve(video.currentTime);
    }
    // Any provider: ask the live adapter for the current time.
    const adapter = state.adapter;
    if (adapter && typeof adapter.getCurrentTime === 'function') {
        let result: Promise<number> | null;
        try {
            result = adapter.getCurrentTime();
        } catch {
            result = null;
        }
        if (result && typeof result.then === 'function') {
            return result.then(
                seconds => {
                    if (!apply(seconds)) {
                        unavailable();
                    }
                    return seconds;
                },
                () => {
                    unavailable();
                    return undefined;
                },
            );
        }
        if (apply(result)) {
            return Promise.resolve(result as unknown as number);
        }
    }
    // No adapter / not ready: keep manual entry available and say so.
    unavailable();
    return Promise.resolve(undefined);
}

/** Tear down the current provider adapter (before replacing player DOM). */
export function destroyAdapter(state: EditionState): void {
    if (state.adapter && typeof state.adapter.destroy === 'function') {
        try {
            state.adapter.destroy();
        } catch {
            /* already gone */
        }
    }
    state.adapter = null;
}

/** Create (and load) a provider adapter for the rendered player. */
function createPlayerAdapter(state: EditionState, options: AdapterSpec, onScaleChange: () => void): void {
    let adapter: ReturnType<ProviderFactory['createAdapter']> | null;
    try {
        adapter = providers().createAdapter(options);
    } catch {
        adapter = null;
    }
    state.adapter = adapter;
    // Drive the editor timeline from the adapter's event-push time signals:
    // the duration positions the markers, timeupdate moves progress + knob.
    if (adapter && typeof adapter.onReady === 'function') {
        try {
            adapter.onReady(() => {
                fetchDuration(state, onScaleChange);
            });
        } catch {
            /* optional signal */
        }
    }
    if (adapter && typeof adapter.onTimeUpdate === 'function') {
        try {
            adapter.onTimeUpdate(seconds => {
                onPlayerTime(state, seconds, onScaleChange);
            });
        } catch {
            /* optional signal */
        }
    }
    if (adapter && typeof adapter.load === 'function') {
        try {
            const result = adapter.load();
            if (result && typeof result.then === 'function') {
                // Swallow rejections here: callers degrade gracefully to
                // manual time entry; there is nothing to block on.
                result.then(null, () => {});
            }
        } catch {
            /* keep the adapter reference; getCurrentTime will report status */
        }
    }
    // Adapters that are already ready (e.g. local metadata already loaded)
    // can report the duration straight away.
    fetchDuration(state, onScaleChange);
}

/** Mount the inline native `<video>` and its adapter (library file, direct
 *  media URL or Mediateca stream). */
function renderNativeVideo(
    state: EditionState,
    container: ExeJQuery,
    src: string,
    adapterOptions: AdapterSpec,
    onScaleChange: () => void,
): void {
    container.html(
        '<video id="ivEditPlayerVideo" class="exe-iv-edit-video" controls preload="metadata" src="' +
            escapeHtml(src) +
            '"></video>',
    );
    const videoEl = document.getElementById('ivEditPlayerVideo') as HTMLVideoElement | null;
    if (!videoEl) {
        return;
    }
    // The adapter emits ready optimistically (before metadata), so take the
    // duration straight from the element as soon as it is known.
    videoEl.addEventListener('durationchange', () => {
        setDuration(state, videoEl.duration, onScaleChange);
    });
    adapterOptions.video = videoEl;
    createPlayerAdapter(state, adapterOptions, onScaleChange);
}

/** Render the playback surface (video, iframe or a hint) into `container`. */
function renderPlayerSurface(state: EditionState, container: ExeJQuery, onScaleChange: () => void): void {
    const t = tr;
    const url = currentSourceValue() || state.doc.video.url;
    if (!url) {
        container.html('<p class="exe-iv-hint">' + t('Set a video source above to preview it here.') + '</p>');
        return;
    }
    const normalized = normalizeVideoSource(url);
    if (!normalized) {
        // A bare media-library path (no provider match) plays in a native
        // <video>; prefer the picker's resolved blob URL so asset:// videos
        // play in the editor.
        const blobUrl = $('#ivVideoFile').data('blobUrl');
        const src = typeof blobUrl === 'string' && blobUrl ? blobUrl : url;
        renderNativeVideo(state, container, src, { provider: 'local', url: src }, onScaleChange);
        return;
    }
    if (normalized.provider === 'local') {
        // A direct media URL plays in a native <video>, like the runtime.
        renderNativeVideo(state, container, normalized.url, { provider: 'local', url: normalized.url }, onScaleChange);
        return;
    }
    if (normalized.provider === 'mediateca') {
        // Mediateca is a native <video> over its legacy stream URL.
        const stream = providers().mediatecaStreamUrl(normalized.videoId);
        if (stream) {
            renderNativeVideo(
                state,
                container,
                stream,
                { provider: 'mediateca', url: normalized.url, videoId: normalized.videoId },
                onScaleChange,
            );
            return;
        }
    }
    const embed = resolveEmbedUrl(normalized.provider, normalized.videoId);
    if (embed) {
        // The hint sits above the iframe so the player stays visually joined
        // to the timeline box below it.
        container.html(
            '<p class="exe-iv-hint">' +
                t('If the video does not respond, you can still type the interaction time manually.') +
                '</p>' +
                '<iframe id="ivEditPlayerFrame" class="exe-iv-edit-video" src="' +
                escapeHtml(embed) +
                '" referrerpolicy="strict-origin-when-cross-origin" allow="fullscreen" title="' +
                t('Video') +
                '"></iframe>',
        );
        createPlayerAdapter(
            state,
            {
                provider: normalized.provider,
                url: url,
                videoId: normalized.videoId,
                iframe: document.getElementById('ivEditPlayerFrame') as HTMLIFrameElement | null,
            },
            onScaleChange,
        );
    } else {
        container.html('<p class="exe-iv-hint">' + escapeHtml(url) + '</p>');
    }
}

/** Show the video inside the Interactions section so the author can place
 *  items, and (re)create the provider adapter that drives seek/current-time.
 *  Resets the timeline state, then shows the timeline box only when an actual
 *  playback surface (video/iframe) rendered. */
export function renderInteractionsPlayer(state: EditionState, onScaleChange: () => void): void {
    const container = $('#ivInteractionsPlayer');
    if (!container.length) {
        return;
    }
    // Always tear down the previous adapter before replacing the DOM, and
    // forget the previous source's duration/playhead.
    destroyAdapter(state);
    state.duration = null;
    state.lastTime = 0;
    state.durationPending = false;
    renderPlayerSurface(state, container, onScaleChange);
    const mount = container[0];
    $('#ivTimelineBox').toggle(!!mount && !!mount.querySelector('video, iframe'));
    onScaleChange();
    updateTimelineProgress(state, 0);
}
