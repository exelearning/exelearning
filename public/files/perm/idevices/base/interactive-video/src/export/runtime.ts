/**
 * Interactive Video iDevice — learner runtime (export code).
 *
 * JSON-type iDevice: `renderView(data, ...)` builds declarative, script-free
 * HTML from the versioned document; `renderBehaviour(data, ...)` wires the
 * video player, the deterministic interaction scheduler, question grading,
 * scoring and SCORM at learner runtime. Data is declarative JSON — no author
 * JavaScript is ever evaluated (SDD-0001).
 *
 * The shared core and the provider adapters are compiled INTO the bundle, so
 * the old "wait for the classic core script" retry loop is gone; the provider
 * factory is still RESOLVED through `window.exeInteractiveVideoProviders` so
 * the E2E fake-provider seam keeps working.
 */

import { createProviderFactory } from '../providers/index';
import type { ProviderFactory } from '../providers/types';
import { emptyPlayback } from '../shared/playback';
import { hydrateDocument, SCHEMA_VERSION } from '../shared/schema';
import { isLegacyIslandHtml } from '../shared/migration';
import { sortInteractions } from '../shared/scheduling';
import type { CoverInteraction, Interaction, InteractiveVideoDocumentV2 } from '../shared/types';
import { isRecord } from '../shared/types';
import type { RuntimeInstance } from './instance';
import { advance, bindContinue } from './interaction-queue';
import { makeTranslator, renderInteractionBodyHtml, renderViewHtml, resolveProviders } from './renderer';
import { refreshResults, updateScore } from './scoring';
import { registerTracking } from './scorm';

const BASE_ID = 'interactivevideo';
const DEFAULT_TEMPLATE = '<div class="exe-interactive-video-container">{content}</div>';

export interface InteractiveVideoRuntime {
    readonly baseId: string;
    readonly classIdevice: string;
    /** Live instances by iDevice id (public probe surface for the E2E suite). */
    readonly instances: Record<string, RuntimeInstance>;
    init(): void;
    renderView(data: unknown, accessibility?: unknown, template?: unknown, ideviceId?: string): string | false;
    renderBehaviour(data: unknown, accessibility?: unknown, ideviceId?: string): boolean;
}

/** The id the engine associates with this data/DOM node. */
function resolveId(data: unknown, ideviceId?: string): string {
    // exe_export injects the DOM id as data.ideviceId and calls renderView
    // without the ideviceId argument; read it so multiple instances on a page
    // do not collapse to the shared baseId (and so the legacy-island lookup
    // can find this instance's iDevice node).
    if (ideviceId) {
        return ideviceId;
    }
    if (isRecord(data)) {
        if (typeof data.ideviceId === 'string' && data.ideviceId) {
            return data.ideviceId;
        }
        if (typeof data.id === 'string' && data.id) {
            return data.id;
        }
    }
    return BASE_ID;
}

/**
 * The legacy htmlView island for this instance: an explicit `htmlView`/
 * `textTextarea` string, or — in the export DOM — the iDevice node's
 * innerHTML, which still holds the imported island because the engine calls
 * renderView BEFORE overwriting the node with the rendered output.
 */
function legacyIslandFromData(data: unknown, id: string): string {
    if (isRecord(data)) {
        if (isLegacyIslandHtml(data.htmlView)) {
            return data.htmlView;
        }
        if (isLegacyIslandHtml(data.textTextarea)) {
            return data.textTextarea;
        }
    }
    if (typeof document !== 'undefined' && id) {
        const node = document.getElementById(id);
        if (node?.innerHTML && isLegacyIslandHtml(node.innerHTML)) {
            return node.innerHTML;
        }
    }
    return '';
}

/**
 * Resolve the working document, mirroring the editor's hydrate(): a legacy
 * interactive-video keeps the video URL only in its htmlView island, so
 * whenever the stored doc is NOT already v2, prefer the island when one is
 * available — it is a superset (slides + URL). Already-v2 documents are
 * normalized as-is; documents claiming a NEWER schema yield null so the
 * stored markup is left untouched instead of being re-rendered destructively.
 */
function resolveDocument(data: unknown, id: string): InteractiveVideoDocumentV2 | null {
    const version = isRecord(data) ? Number(data.schemaVersion) : NaN;
    if (!(version >= SCHEMA_VERSION)) {
        const island = legacyIslandFromData(data, id);
        if (island) {
            const fromIsland = hydrateDocument(island);
            return fromIsland.status === 'ok' ? fromIsland.document : null;
        }
    }
    const result = hydrateDocument(data);
    return result.status === 'ok' ? result.document : null;
}

export function createInteractiveVideoRuntime(): InteractiveVideoRuntime {
    const instances: Record<string, RuntimeInstance> = {};
    /**
     * The document each instance's view was rendered from, by iDevice id, so
     * renderBehaviour drives exactly what renderView painted. A legacy
     * activity keeps its video URL ONLY in the data island, and the engine
     * replaces the node's innerHTML with our output between renderView and
     * renderBehaviour — so by the time behaviour runs, the island is gone and
     * re-resolving would silently produce a different document. Ref #2147.
     */
    const resolvedDocs: Record<string, InteractiveVideoDocumentV2> = {};
    const bundledProviders = createProviderFactory();

    function createInstance(doc: InteractiveVideoDocumentV2, id: string, root: HTMLElement): RuntimeInstance {
        const video = root.querySelector<HTMLVideoElement>('video.exe-iv-video');
        const iframe = root.querySelector<HTMLIFrameElement>('iframe.exe-iv-embed-frame');
        const instance: RuntimeInstance = {
            id: id,
            doc: doc,
            root: root,
            sorted: sortInteractions(doc.interactions),
            provider: doc.video.provider || 'local',
            video: video,
            iframe: iframe,
            adapter: null,
            t: makeTranslator(doc.customTexts),
            consumed: new Set<string>(),
            pending: [],
            answered: {},
            results: {},
            playback: emptyPlayback(),
            duration: undefined,
            seen: {},
            overlayActive: false,
            overlayTimer: null,
            lastTime: -Infinity,
            start() {
                bindMarkers(instance);
                bindAdapter(instance);
            },
            seek(time) {
                if (!isFinite(time)) {
                    return;
                }
                if (instance.adapter) {
                    instance.adapter.seekTo(time);
                } else if (video) {
                    video.currentTime = time;
                }
            },
            pause() {
                if (instance.adapter) {
                    instance.adapter.pause();
                } else if (video) {
                    video.pause();
                }
            },
            resume() {
                if (instance.adapter) {
                    instance.adapter.play();
                } else if (video) {
                    void video.play();
                }
            },
            destroy() {
                if (instance.overlayTimer) {
                    clearTimeout(instance.overlayTimer);
                    instance.overlayTimer = null;
                }
                if (instance.adapter && typeof instance.adapter.destroy === 'function') {
                    instance.adapter.destroy();
                }
                instance.adapter = null;
            },
            recordResult(interactionId, fraction) {
                instance.results[interactionId] = fraction;
                instance.answered[interactionId] = true;
                updateScore(instance);
            },
        };
        return instance;
    }

    function bindMarkers(instance: RuntimeInstance): void {
        // Timeline markers and the results-table timestamp links both carry
        // data-iv-seek and seek the video to that time.
        const buttons = instance.root.querySelectorAll('[data-iv-seek]');
        for (let i = 0; i < buttons.length; i++) {
            const button = buttons[i];
            if (!button) {
                continue;
            }
            button.addEventListener('click', event => {
                event.preventDefault();
                const time = parseFloat(button.getAttribute('data-iv-seek') || '');
                instance.seek(time);
            });
        }
    }

    /**
     * Bind the provider adapter to the shared scheduler: onTimeUpdate feeds
     * the deterministic interaction scheduler, 'ended' feeds watch-completion,
     * and load() failures degrade gracefully (keep the accessible timeline,
     * never throw). Works identically for local video, YouTube, Vimeo and
     * Mediateca.
     */
    function bindAdapter(instance: RuntimeInstance): void {
        const providers: ProviderFactory = resolveProviders(bundledProviders) || bundledProviders;
        const videoMeta = instance.doc.video;
        const adapter = providers.createAdapter({
            provider: instance.provider,
            url: videoMeta.url,
            videoId: videoMeta.videoId,
            video: instance.video,
            iframe: instance.iframe,
        });
        instance.adapter = adapter;

        adapter.onTimeUpdate(current => {
            advance(instance, current);
        });
        adapter.onStateChange(state => {
            if (state === 'ended') {
                instance.watched = true;
                updateScore(instance);
            }
        });

        try {
            const loading = adapter.load();
            if (loading && typeof loading.then === 'function') {
                loading
                    .then(() => (typeof adapter.getDuration === 'function' ? adapter.getDuration() : null))
                    .then(duration => {
                        if (typeof duration === 'number' && isFinite(duration)) {
                            instance.duration = duration;
                        }
                    })
                    .catch(() => {
                        // Offline / media error / provider unreachable: keep the
                        // accessible timeline + external link; never block
                        // rendering.
                        instance.degraded = true;
                    });
            }
        } catch {
            instance.degraded = true;
        }
    }

    /**
     * If the document has a cover, show it in the panel as the opening screen
     * (with a Start button) and consume it so it never fires again during
     * playback. The Start button dismisses the cover and begins playback via
     * the shared Continue wiring.
     */
    function showCoverOpener(instance: RuntimeInstance): void {
        const interactions: Interaction[] = instance.doc.interactions || [];
        let cover: CoverInteraction | null = null;
        for (const interaction of interactions) {
            if (interaction && interaction.type === 'cover') {
                cover = interaction;
                break;
            }
        }
        if (!cover) {
            return;
        }
        instance.consumed.add(cover.id);
        instance.seen[cover.id] = true;
        const overlay = instance.root.querySelector<HTMLElement>('.exe-iv-overlay');
        if (overlay) {
            overlay.innerHTML = renderInteractionBodyHtml(cover, instance.id, instance.t);
            bindContinue(instance, overlay);
        }
        refreshResults(instance);
    }

    return {
        baseId: BASE_ID,
        classIdevice: 'interactive-video',
        instances: instances,
        init() {},

        renderView(data, _accessibility, template, ideviceId) {
            if (!data || typeof data !== 'object') {
                return false;
            }
            const id = resolveId(data, ideviceId);
            const doc = resolveDocument(data, id);
            if (!doc) {
                // Unsupported/newer content: leave the stored markup untouched
                // rather than replacing it with an empty player.
                return false;
            }
            resolvedDocs[id] = doc;
            const content = renderViewHtml(doc, id, makeTranslator(doc.customTexts));
            const tmpl = typeof template === 'string' && template ? template : DEFAULT_TEMPLATE;
            return tmpl.replace('{content}', content);
        },

        renderBehaviour(data, _accessibility, ideviceId) {
            const id = resolveId(data, ideviceId);
            // Prefer the document the view resolved: for a legacy activity the
            // island it came from no longer exists in the DOM by now.
            const doc = resolvedDocs[id] || resolveDocument(data, id);
            if (!doc) {
                return false;
            }
            const root =
                document.getElementById('exe-iv-' + id) ||
                document.querySelector<HTMLElement>('.exe-iv[data-iv-id="' + id + '"]');
            if (!root) {
                return false;
            }
            // Tear down a previous instance (adapter + listeners) before
            // re-binding, so re-renders of the same id never leak message
            // listeners / players.
            const previous = instances[id];
            if (previous) {
                previous.destroy();
            }
            const instance = createInstance(doc, id, root as HTMLElement);
            instances[id] = instance;
            registerTracking(instance);
            instance.start();
            showCoverOpener(instance);
            return true;
        },
    };
}
