import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLocalAdapter } from './html5-adapter';

describe('LocalHtml5 adapter', () => {
    let video: HTMLVideoElement;

    beforeEach(() => {
        video = document.createElement('video');
        document.body.appendChild(video);
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('drives onTimeUpdate from native timeupdate (no polling)', () => {
        const adapter = createLocalAdapter(video);
        const times: number[] = [];
        adapter.onTimeUpdate(s => times.push(s));
        video.currentTime = 3;
        video.dispatchEvent(new Event('timeupdate'));
        video.currentTime = 7.5;
        video.dispatchEvent(new Event('timeupdate'));
        expect(times).toEqual([3, 7.5]);
    });

    it('maps play/pause/ended to onStateChange', () => {
        const adapter = createLocalAdapter(video);
        const states: string[] = [];
        adapter.onStateChange(s => states.push(s));
        video.dispatchEvent(new Event('play'));
        video.dispatchEvent(new Event('pause'));
        video.dispatchEvent(new Event('ended'));
        expect(states).toEqual(['playing', 'paused', 'ended']);
    });

    it('controls the element: seekTo sets currentTime; getCurrentTime resolves it', async () => {
        const adapter = createLocalAdapter(video);
        adapter.seekTo(10);
        expect(video.currentTime).toBe(10);
        video.currentTime = 12;
        await expect(adapter.getCurrentTime()).resolves.toBe(12);
    });

    it('getDuration resolves the element duration or null', async () => {
        Object.defineProperty(video, 'duration', { value: 90, configurable: true });
        const adapter = createLocalAdapter(video);
        await expect(adapter.getDuration()).resolves.toBe(90);
    });

    it('destroy() removes listeners so no further callbacks fire', () => {
        const adapter = createLocalAdapter(video);
        const times: number[] = [];
        adapter.onTimeUpdate(s => times.push(s));
        video.currentTime = 1;
        video.dispatchEvent(new Event('timeupdate'));
        adapter.destroy();
        video.currentTime = 2;
        video.dispatchEvent(new Event('timeupdate'));
        expect(times).toEqual([1]);
    });

    it('load() resolves for a healthy element and rejects on a media error', async () => {
        const ok = createLocalAdapter(video);
        await expect(ok.load()).resolves.toBeUndefined();

        const bad = document.createElement('video');
        document.body.appendChild(bad);
        const adapter = createLocalAdapter(bad);
        const pending = adapter.load();
        pending.catch(() => {});
        bad.dispatchEvent(new Event('error'));
        await expect(pending).rejects.toBeTruthy();
    });

    it('onReady fires immediately for late subscribers once loaded', async () => {
        const adapter = createLocalAdapter(video);
        await adapter.load();
        let ready = false;
        adapter.onReady(() => {
            ready = true;
        });
        expect(ready).toBe(true);
    });

    it('serves Mediateca through the same native-element behaviour', async () => {
        const adapter = createLocalAdapter(video);
        const times: number[] = [];
        adapter.onTimeUpdate(s => times.push(s));
        video.currentTime = 4;
        video.dispatchEvent(new Event('timeupdate'));
        expect(times).toEqual([4]);

        const bad = document.createElement('video');
        document.body.appendChild(bad);
        const degrading = createLocalAdapter(bad);
        const pending = degrading.load();
        pending.catch(() => {});
        bad.dispatchEvent(new Event('error'));
        await expect(pending).rejects.toBeTruthy();
    });
});
