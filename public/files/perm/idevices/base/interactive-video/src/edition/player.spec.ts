import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearFakeProviders,
    clickAt,
    installFakeProviders,
    makeAdapter,
    makeState,
    mountForm,
    stubTrackRect,
} from '../test/helpers';
import {
    announce,
    currentProvider,
    currentSourceValue,
    destroyAdapter,
    effectiveDuration,
    fetchDuration,
    onPlayerTime,
    placeTimeFromTrack,
    renderInteractionsPlayer,
    renderTimelineMarkers,
    resolveEmbedUrl,
    seekTo,
    setDuration,
    toggleSource,
    updateTimelineProgress,
    useCurrentTime,
} from './player';
import type { EditionState } from './state';
import { createInteraction } from './state';

/** Let the adapter promises (duration / current time) settle. */
async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const MEDIATECA_URL = 'https://mediateca.educa.madrid.org/video/3vmgyeluy8c35xzj';

function setSource(value: string): void {
    $('#ivVideoFile').val(value);
}

function videoElement(): HTMLVideoElement | null {
    return document.getElementById('ivEditPlayerVideo') as HTMLVideoElement | null;
}

function progressWidth(): string {
    return document.getElementById('ivTimelineProgress')?.style.width ?? '';
}

function playheadLeft(): string {
    return document.getElementById('ivTimelinePlayhead')?.style.left ?? '';
}

function liveText(): string {
    return document.getElementById('ivEditorLive')?.textContent ?? '';
}

describe('the inline player and its timeline', () => {
    let state: EditionState;

    beforeEach(() => {
        state = makeState();
        mountForm(state);
    });

    afterEach(() => {
        clearFakeProviders();
        document.body.innerHTML = '';
    });

    describe('announce', () => {
        it('writes to the stable live region', () => {
            announce('Seeking to 00:10');
            expect(liveText()).toBe('Seeking to 00:10');
        });

        it('is a no-op when the live region is not mounted', () => {
            document.body.innerHTML = '';
            expect(() => announce('nothing to show')).not.toThrow();
        });
    });

    describe('currentProvider', () => {
        it('has no provider while the source field is empty', () => {
            expect(currentSourceValue()).toBe('');
            expect(currentProvider()).toBeNull();
        });

        it('auto-detects the provider from the single source field', () => {
            setSource(YOUTUBE_URL);
            expect(currentProvider()).toBe('youtube');
            setSource('https://vimeo.com/123456789');
            expect(currentProvider()).toBe('vimeo');
            setSource(MEDIATECA_URL);
            expect(currentProvider()).toBe('mediateca');
            setSource('https://example.com/clip.mp4');
            expect(currentProvider()).toBe('local');
            // A bare media-library path is also 'local'.
            setSource('asset://abc/clip.mp4');
            expect(currentProvider()).toBe('local');
        });

        it('reports an unsafe URL as local (save() is what rejects it)', () => {
            setSource('javascript:alert(1)');
            expect(currentProvider()).toBe('local');
        });
    });

    describe('toggleSource', () => {
        it('shows the subtitles only for native-video sources', () => {
            const section = document.querySelector<HTMLElement>('.exe-iv-captions-section');
            setSource('resources/clip.mp4');
            toggleSource();
            expect(section?.style.display).not.toBe('none');
            setSource(YOUTUBE_URL);
            toggleSource();
            expect(section?.style.display).toBe('none');
            // Mediateca is a native <video> again -> shown.
            setSource(MEDIATECA_URL);
            toggleSource();
            expect(section?.style.display).not.toBe('none');
            // Nothing chosen yet -> hidden.
            setSource('');
            toggleSource();
            expect(section?.style.display).toBe('none');
        });
    });

    describe('effectiveDuration', () => {
        it('uses the reported duration when there is one', () => {
            state.duration = 200;
            expect(effectiveDuration(state)).toBe(200);
        });

        it('falls back to a scale that puts the last marker at 95%', () => {
            state.doc.interactions = [createInteraction('note', 'iv-0', 10), createInteraction('note', 'iv-1', 19)];
            expect(effectiveDuration(state)).toBeCloseTo(20, 6);
        });

        it('is 0 when there is nothing to scale against', () => {
            expect(effectiveDuration(state)).toBe(0);
            state.duration = 0;
            expect(effectiveDuration(state)).toBe(0);
            state.duration = Number.POSITIVE_INFINITY;
            expect(effectiveDuration(state)).toBe(0);
        });

        it('ignores non-finite interaction times', () => {
            state.doc.interactions = [createInteraction('note', 'iv-0', Number.POSITIVE_INFINITY)];
            expect(effectiveDuration(state)).toBe(0);
        });
    });

    describe('updateTimelineProgress', () => {
        it('moves the fill and the playhead proportionally, clamped to 0..100', () => {
            state.duration = 100;
            updateTimelineProgress(state, 30);
            expect(progressWidth()).toBe('30.00%');
            expect(playheadLeft()).toBe('30.00%');
            updateTimelineProgress(state, 500);
            expect(progressWidth()).toBe('100.00%');
            updateTimelineProgress(state, -5);
            expect(progressWidth()).toBe('0.00%');
        });

        it('stays at 0 while the duration is unknown, and never throws unmounted', () => {
            updateTimelineProgress(state, 30);
            expect(progressWidth()).toBe('0.00%');
            document.body.innerHTML = '';
            expect(() => updateTimelineProgress(state, 30)).not.toThrow();
        });
    });

    describe('renderTimelineMarkers', () => {
        it('renders one positioned marker per interaction with the fallback scale', () => {
            state.doc.interactions = [createInteraction('note', 'iv-0', 10), createInteraction('question', 'iv-1', 19)];
            renderTimelineMarkers(state, () => {});
            const items = document.querySelectorAll<HTMLElement>('#ivEditTimeline .exe-iv-edit-marker-item');
            expect(items.length).toBe(2);
            expect(items[0]?.style.left).toBe('50.00%');
            expect(items[1]?.style.left).toBe('95.00%');
        });

        it('colour-codes markers by kind and labels them with time and type', () => {
            state.doc.interactions = [createInteraction('pause', 'iv-0', 10)];
            renderTimelineMarkers(state, () => {});
            const marker = document.querySelector('#ivEditTimeline button[data-iv-id]');
            expect(marker?.className).toContain('exe-iv-kind--pause');
            expect(marker?.getAttribute('aria-label')).toContain('00:10');
            expect(marker?.getAttribute('aria-label')).toContain('Pause');
        });

        it('marks the selected interaction and reports clicks by id', () => {
            state.doc.interactions = [createInteraction('note', 'iv-0', 10)];
            state.selectedId = 'iv-0';
            const onSelect = vi.fn();
            renderTimelineMarkers(state, onSelect);
            const marker = document.querySelector<HTMLElement>('#ivEditTimeline button[data-iv-id="iv-0"]');
            expect(marker?.className).toContain('is-selected');
            marker?.click();
            expect(onSelect).toHaveBeenCalledWith('iv-0');
        });

        it('does nothing when the marker strip is not mounted', () => {
            document.body.innerHTML = '';
            expect(() => renderTimelineMarkers(state, () => {})).not.toThrow();
        });
    });

    describe('placeTimeFromTrack', () => {
        beforeEach(() => {
            installFakeProviders();
            setSource('resources/clip.mp4');
            renderInteractionsPlayer(state, () => {});
        });

        it('places the add-bar time proportionally, seeks and moves the progress', () => {
            state.duration = 100;
            stubTrackRect(100);
            placeTimeFromTrack(state, 25);
            expect($('#ivAddTime').val()).toBe('00:25');
            expect(videoElement()?.currentTime).toBe(25);
            expect(progressWidth()).toBe('25.00%');
            expect(liveText()).toContain('00:25');
        });

        it('announces instead of placing when the duration is unknown', () => {
            stubTrackRect(100);
            $('#ivAddTime').val('00:00');
            placeTimeFromTrack(state, 50);
            expect($('#ivAddTime').val()).toBe('00:00');
            expect(liveText()).toContain('duration is not known');
        });

        it('announces instead of placing when the track has no width', () => {
            state.duration = 100;
            stubTrackRect(0);
            $('#ivAddTime').val('00:00');
            placeTimeFromTrack(state, 50);
            expect($('#ivAddTime').val()).toBe('00:00');
            expect(liveText()).toContain('duration is not known');
        });

        it('does nothing when the track is not mounted', () => {
            document.body.innerHTML = '';
            expect(() => placeTimeFromTrack(state, 10)).not.toThrow();
        });
    });

    describe('seekTo', () => {
        it('moves the inline <video> playhead', () => {
            installFakeProviders();
            setSource('resources/clip.mp4');
            renderInteractionsPlayer(state, () => {});
            seekTo(state, 12);
            expect(videoElement()?.currentTime).toBe(12);
        });

        it('swallows a <video> that refuses to seek yet', () => {
            installFakeProviders();
            setSource('resources/clip.mp4');
            renderInteractionsPlayer(state, () => {});
            const video = videoElement() as HTMLVideoElement;
            Object.defineProperty(video, 'currentTime', {
                get: () => 0,
                set: () => {
                    throw new Error('not seekable yet');
                },
                configurable: true,
            });
            expect(() => seekTo(state, 12)).not.toThrow();
        });

        it('falls back to the provider adapter when there is no inline <video>', () => {
            const adapterSeek = vi.fn();
            state.adapter = makeAdapter({ seekTo: adapterSeek });
            seekTo(state, 30);
            expect(adapterSeek).toHaveBeenCalledWith(30);
        });

        it('swallows an adapter that is not ready and ignores non-finite times', () => {
            state.adapter = makeAdapter({
                seekTo: () => {
                    throw new Error('not ready');
                },
            });
            expect(() => seekTo(state, 30)).not.toThrow();
            expect(() => seekTo(state, Number.NaN)).not.toThrow();
        });
    });

    describe('useCurrentTime', () => {
        it('reads the playhead of the inline <video> directly', async () => {
            installFakeProviders();
            setSource('resources/clip.mp4');
            renderInteractionsPlayer(state, () => {});
            const video = videoElement() as HTMLVideoElement;
            video.currentTime = 42;
            await useCurrentTime(state, 'ivAddTime');
            expect($('#ivAddTime').val()).toBe('00:42');
        });

        it('fills the add-bar time from the provider adapter for an external provider', async () => {
            installFakeProviders({ currentTime: 42 });
            setSource(YOUTUBE_URL);
            renderInteractionsPlayer(state, () => {});
            await useCurrentTime(state, 'ivAddTime');
            expect($('#ivAddTime').val()).toBe('00:42');
        });

        it('defaults to the add-bar field when no target is given', async () => {
            state.adapter = makeAdapter({ getCurrentTime: () => Promise.resolve(7) });
            await useCurrentTime(state);
            expect($('#ivAddTime').val()).toBe('00:07');
        });

        it('accepts an adapter that answers synchronously', async () => {
            state.adapter = makeAdapter({
                getCurrentTime: () => 9 as unknown as Promise<number>,
            });
            await useCurrentTime(state, 'ivAddTime');
            expect($('#ivAddTime').val()).toBe('00:09');
        });

        it('announces politely when the adapter answers with an unusable time', async () => {
            state.adapter = makeAdapter({ getCurrentTime: () => Promise.resolve(Number.NaN) });
            $('#ivAddTime').val('00:00');
            await useCurrentTime(state, 'ivAddTime');
            expect($('#ivAddTime').val()).toBe('00:00');
            expect(liveText()).toContain('not available yet');
        });

        it('announces politely when the adapter rejects', async () => {
            state.adapter = makeAdapter({ getCurrentTime: () => Promise.reject(new Error('no handshake')) });
            await useCurrentTime(state, 'ivAddTime');
            expect(liveText()).toContain('not available yet');
        });

        it('announces politely when the adapter throws', async () => {
            state.adapter = makeAdapter({
                getCurrentTime: () => {
                    throw new Error('boom');
                },
            });
            await useCurrentTime(state, 'ivAddTime');
            expect(liveText()).toContain('not available yet');
        });

        it('announces politely when a synchronous adapter answers with nothing usable', async () => {
            state.adapter = makeAdapter({ getCurrentTime: () => undefined as unknown as Promise<number> });
            await useCurrentTime(state, 'ivAddTime');
            expect(liveText()).toContain('not available yet');
        });

        it('never silently no-ops when there is no adapter at all', async () => {
            $('#ivAddTime').val('00:00');
            await useCurrentTime(state, 'ivAddTime');
            expect($('#ivAddTime').val()).toBe('00:00');
            expect(liveText().length).toBeGreaterThan(0);
        });
    });

    describe('setDuration and fetchDuration', () => {
        it('accepts a fresh duration once and re-renders the scale', () => {
            const onScaleChange = vi.fn();
            setDuration(state, 200, onScaleChange);
            expect(state.duration).toBe(200);
            expect(onScaleChange).toHaveBeenCalledTimes(1);
            // The same value again is not a scale change.
            setDuration(state, 200, onScaleChange);
            expect(onScaleChange).toHaveBeenCalledTimes(1);
        });

        it('ignores durations that cannot scale a timeline', () => {
            const onScaleChange = vi.fn();
            setDuration(state, null, onScaleChange);
            setDuration(state, 0, onScaleChange);
            setDuration(state, Number.NaN, onScaleChange);
            expect(state.duration).toBeNull();
            expect(onScaleChange).not.toHaveBeenCalled();
        });

        it('reads the duration from the adapter and rescales', async () => {
            state.adapter = makeAdapter({ getDuration: () => Promise.resolve(120) });
            const onScaleChange = vi.fn();
            fetchDuration(state, onScaleChange);
            expect(state.durationPending).toBe(true);
            await flush();
            expect(state.duration).toBe(120);
            expect(state.durationPending).toBe(false);
            expect(onScaleChange).toHaveBeenCalled();
        });

        it('does nothing without an adapter, without getDuration, or while pending', () => {
            fetchDuration(state, () => {});
            expect(state.durationPending).toBe(false);
            state.adapter = { getDuration: undefined } as unknown as NonNullable<EditionState['adapter']>;
            fetchDuration(state, () => {});
            expect(state.durationPending).toBe(false);
            state.adapter = makeAdapter({ getDuration: () => Promise.resolve(60) });
            state.durationPending = true;
            fetchDuration(state, () => {});
            expect(state.duration).toBeNull();
        });

        it('tolerates adapters without a usable getDuration', async () => {
            state.adapter = makeAdapter({ getDuration: () => 42 as unknown as Promise<number> });
            fetchDuration(state, () => {});
            expect(state.durationPending).toBe(false);

            state.adapter = makeAdapter({
                getDuration: () => {
                    throw new Error('boom');
                },
            });
            fetchDuration(state, () => {});
            expect(state.durationPending).toBe(false);

            state.adapter = makeAdapter({ getDuration: () => Promise.reject(new Error('nope')) });
            fetchDuration(state, () => {});
            await flush();
            expect(state.durationPending).toBe(false);
            expect(state.duration).toBeNull();
        });
    });

    describe('onPlayerTime', () => {
        it('ignores unusable values and moves progress against a known duration', () => {
            onPlayerTime(state, Number.NaN, () => {});
            expect(state.lastTime).toBe(0);
            onPlayerTime(state, null as unknown as number, () => {});
            expect(state.lastTime).toBe(0);
            state.duration = 100;
            onPlayerTime(state, 30, () => {});
            expect(state.lastTime).toBe(30);
            expect(progressWidth()).toBe('30.00%');
            expect(playheadLeft()).toBe('30.00%');
        });

        it('asks the adapter for the duration the first time a playhead arrives', async () => {
            state.adapter = makeAdapter({ getDuration: () => Promise.resolve(200) });
            onPlayerTime(state, 50, () => {});
            await flush();
            expect(state.duration).toBe(200);
        });
    });

    describe('destroyAdapter', () => {
        it('tears the adapter down and forgets it', () => {
            const destroy = vi.fn();
            state.adapter = makeAdapter({ destroy });
            destroyAdapter(state);
            expect(destroy).toHaveBeenCalled();
            expect(state.adapter).toBeNull();
        });

        it('survives an adapter that is already gone', () => {
            state.adapter = makeAdapter({
                destroy: () => {
                    throw new Error('already gone');
                },
            });
            expect(() => destroyAdapter(state)).not.toThrow();
            expect(state.adapter).toBeNull();
            state.adapter = { destroy: undefined } as unknown as NonNullable<EditionState['adapter']>;
            destroyAdapter(state);
            expect(state.adapter).toBeNull();
        });
    });

    describe('resolveEmbedUrl', () => {
        it('uses the bundled provider layer when no factory is published', () => {
            expect(resolveEmbedUrl('youtube', 'dQw4w9WgXcQ')).toContain('/embed/dQw4w9WgXcQ');
        });

        it('ignores a published object that is not a provider factory', () => {
            window.exeInteractiveVideoProviders = { embedUrl: () => 'https://evil.example/' };
            expect(resolveEmbedUrl('youtube', 'dQw4w9WgXcQ')).toContain('/embed/dQw4w9WgXcQ');
        });

        it('prefers the published factory when it is a real one', () => {
            installFakeProviders({ embedUrl: () => 'https://embed.example/x' });
            expect(resolveEmbedUrl('youtube', 'dQw4w9WgXcQ')).toBe('https://embed.example/x');
        });
    });

    describe('renderInteractionsPlayer', () => {
        it('hides the timeline until a playable surface renders', () => {
            installFakeProviders();
            renderInteractionsPlayer(state, () => {});
            expect(document.getElementById('ivTimelineBox')?.style.display).toBe('none');
            expect(document.querySelector('#ivInteractionsPlayer .exe-iv-hint')?.textContent).toContain(
                'Set a video source',
            );
            setSource('resources/clip.mp4');
            renderInteractionsPlayer(state, () => {});
            expect(document.getElementById('ivTimelineBox')?.style.display).not.toBe('none');
        });

        it('renders a native <video> for a direct media URL', () => {
            const providers = installFakeProviders();
            setSource('https://example.com/clip.mp4');
            renderInteractionsPlayer(state, () => {});
            expect(videoElement()?.getAttribute('src')).toBe('https://example.com/clip.mp4');
            expect(providers.specs[0]).toMatchObject({ provider: 'local', url: 'https://example.com/clip.mp4' });
            expect(providers.specs[0]?.video).toBe(videoElement());
        });

        it('plays a media-library path in a native <video>', () => {
            installFakeProviders();
            setSource('asset://abc/clip.mp4');
            renderInteractionsPlayer(state, () => {});
            expect(videoElement()?.getAttribute('src')).toBe('asset://abc/clip.mp4');
        });

        it('prefers the picker blob URL for a reference that is not playable as-is', () => {
            installFakeProviders();
            // A reference the source normalizer rejects: the picker's resolved
            // blob URL is what makes it playable in the editor.
            setSource('data:video/mp4;base64,AAAA');
            renderInteractionsPlayer(state, () => {});
            expect(videoElement()?.getAttribute('src')).toBe('data:video/mp4;base64,AAAA');
            document.getElementById('ivVideoFile')?.setAttribute('data-blob-url', 'blob:http://localhost/xyz');
            renderInteractionsPlayer(state, () => {});
            expect(videoElement()?.getAttribute('src')).toBe('blob:http://localhost/xyz');
        });

        it('renders a Mediateca URL as a native <video> over its stream URL', () => {
            installFakeProviders();
            setSource(MEDIATECA_URL);
            renderInteractionsPlayer(state, () => {});
            expect(videoElement()?.getAttribute('src')).toContain('streaming.php?id=3vmgyeluy8c35xzj');
        });

        it('falls back to a plain hint when a provider has no playable surface', () => {
            installFakeProviders({ mediatecaStreamUrl: () => '', embedUrl: () => '' });
            setSource(MEDIATECA_URL);
            renderInteractionsPlayer(state, () => {});
            expect(videoElement()).toBeNull();
            expect(document.querySelector('#ivInteractionsPlayer .exe-iv-hint')?.textContent).toBe(MEDIATECA_URL);
        });

        it('renders an iframe embed for an external provider', () => {
            const providers = installFakeProviders();
            setSource(YOUTUBE_URL);
            renderInteractionsPlayer(state, () => {});
            const frame = document.getElementById('ivEditPlayerFrame');
            expect(frame?.getAttribute('src')).toBe('about:blank#youtube/dQw4w9WgXcQ');
            expect(document.querySelector('#ivInteractionsPlayer .exe-iv-hint')?.textContent).toContain(
                'type the interaction time manually',
            );
            expect(providers.specs[0]).toMatchObject({ provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
            expect(providers.specs[0]?.iframe).toBe(frame);
        });

        it('falls back to the stored document URL when the field is empty', () => {
            installFakeProviders();
            state.doc.video.url = 'resources/stored.mp4';
            renderInteractionsPlayer(state, () => {});
            expect(videoElement()?.getAttribute('src')).toBe('resources/stored.mp4');
        });

        it('destroys the previous adapter and resets the timeline before re-rendering', async () => {
            const providers = installFakeProviders();
            setSource(YOUTUBE_URL);
            renderInteractionsPlayer(state, () => {});
            state.duration = 200;
            state.lastTime = 90;
            renderInteractionsPlayer(state, () => {});
            expect(providers.destroyed).toBe(1);
            expect(state.duration).toBeNull();
            expect(state.lastTime).toBe(0);
            // The new adapter's duration request settles against the fresh state.
            await flush();
            expect(state.durationPending).toBe(false);
        });

        it('keeps working when the adapter cannot be created or refuses to load', () => {
            installFakeProviders({
                createAdapter: () => {
                    throw new Error('no adapter for you');
                },
            });
            setSource(YOUTUBE_URL);
            expect(() => renderInteractionsPlayer(state, () => {})).not.toThrow();
            expect(state.adapter).toBeNull();

            installFakeProviders({
                createAdapter: () =>
                    makeAdapter({
                        load: () => Promise.reject(new Error('timeout')),
                        onReady: () => {
                            throw new Error('no signal');
                        },
                        onTimeUpdate: () => {
                            throw new Error('no signal');
                        },
                    }),
            });
            expect(() => renderInteractionsPlayer(state, () => {})).not.toThrow();
            expect(state.adapter).not.toBeNull();
        });

        it('does nothing when the player container is not mounted', () => {
            document.body.innerHTML = '';
            expect(() => renderInteractionsPlayer(state, () => {})).not.toThrow();
        });

        it('rescales markers from the local <video> duration as soon as metadata is known', () => {
            installFakeProviders();
            const refresh = (): void => renderTimelineMarkers(state, () => {});
            state.doc.interactions = [createInteraction('note', 'iv-0', 10)];
            setSource('resources/clip.mp4');
            renderInteractionsPlayer(state, refresh);
            // Fallback scale first (duration unknown): the only marker sits at 95%.
            expect(document.querySelector<HTMLElement>('#ivEditTimeline .exe-iv-edit-marker-item')?.style.left).toBe(
                '95.00%',
            );
            const video = videoElement() as HTMLVideoElement;
            Object.defineProperty(video, 'duration', { value: 40, configurable: true });
            video.dispatchEvent(new window.Event('durationchange'));
            expect(document.querySelector<HTMLElement>('#ivEditTimeline .exe-iv-edit-marker-item')?.style.left).toBe(
                '25.00%',
            );
        });

        it('uses the adapter duration for marker positions and moves progress on timeupdate', async () => {
            const providers = installFakeProviders({ duration: 200 });
            const refresh = (): void => renderTimelineMarkers(state, () => {});
            setSource(YOUTUBE_URL);
            renderInteractionsPlayer(state, refresh);
            await flush();
            expect(state.duration).toBe(200);
            state.doc.interactions = [createInteraction('note', 'iv-0', 100)];
            refresh();
            expect(document.querySelector<HTMLElement>('#ivEditTimeline .exe-iv-edit-marker-item')?.style.left).toBe(
                '50.00%',
            );
            providers.emitTime(50);
            expect(progressWidth()).toBe('25.00%');
            expect(playheadLeft()).toBe('25.00%');
        });

        it('clicking the track places the add-bar time and seeks the video', () => {
            installFakeProviders();
            setSource('resources/clip.mp4');
            renderInteractionsPlayer(state, () => {});
            state.duration = 100;
            const track = stubTrackRect(100) as HTMLElement;
            // The device wires this click; drive the same handler here.
            track.addEventListener('click', event => {
                placeTimeFromTrack(state, (event as MouseEvent).clientX);
            });
            clickAt(track, 25);
            expect($('#ivAddTime').val()).toBe('00:25');
            expect(videoElement()?.currentTime).toBe(25);
            expect(progressWidth()).toBe('25.00%');
        });
    });
});
