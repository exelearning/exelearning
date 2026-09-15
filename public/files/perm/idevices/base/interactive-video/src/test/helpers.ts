/**
 * Test-only harness for the inline editor specs.
 *
 * The editor talks to the workarea through classic-script globals ($ ,
 * $exeDevicesEdition, $exeTinyMCE, tinymce, eXe, eXeLearning) and to the
 * provider layer through `window.exeInteractiveVideoProviders`. The repo-wide
 * Vitest setup already publishes real jQuery, real TinyMCE 5 and the shared
 * gamification mocks; this module adds the pieces the Interactive Video editor
 * needs on top of them (the tab/fieldset helpers, a Custom-texts tab that
 * records the ci18n map, a `$exeTinyMCE` that attaches the REAL TinyMCE, and a
 * controllable provider factory) and restores everything afterwards.
 */

import type { Mock } from 'vitest';
import { vi } from 'vitest';
import type { Editor } from '../edition/editor';
import { createEditor } from '../edition/editor';
import { interactionsSectionHtml, tabGeneralSettingsHtml } from '../edition/form';
import type { EditionState } from '../edition/state';
import type { AdapterSpec, ProviderAdapter, ProviderFactory } from '../providers/types';
import { newDocument } from '../shared/types';

type EditionLayer = NonNullable<typeof $exeDevicesEdition>['iDevice'];

interface ScormStubValues {
    isScorm: number;
    textButtonScorm: string;
    repeatActivity: boolean;
    weighted: number;
}

interface ProgressStubValues {
    evaluation: unknown;
    evaluationID: unknown;
}

/** The mutable values the shared-tab stubs report back to the editor. */
export interface EditionStubValues {
    scorm: ScormStubValues;
    progress: ProgressStubValues | null;
    /** The ci18n maps handed to the Custom-texts tab, newest last. */
    languageTabArgs: Array<Record<string, string>>;
}

export interface EditionHarness {
    values: EditionStubValues;
    stubs: {
        tabsInit: Mock;
        getIdeviceDescription: Mock;
        getTextFieldset: Mock;
        getLanguageTab: Mock;
        setLanguageTabValues: Mock;
        scormGetTab: Mock;
        scormInit: Mock;
        scormGetValues: Mock;
        scormSetValues: Mock;
        progressGetContents: Mock;
        progressAddEvents: Mock;
        progressGetValues: Mock;
        progressSetValues: Mock;
        /** `$exeTinyMCE.init`, attaching the REAL TinyMCE to the body field. */
        tinyMceInit: Mock;
    };
    restore(): void;
}

function editionLayer(): EditionLayer {
    if (typeof $exeDevicesEdition === 'undefined' || !$exeDevicesEdition) {
        throw new Error('$exeDevicesEdition is missing: the Vitest setup did not run.');
    }
    return $exeDevicesEdition.iDevice;
}

/**
 * Install the shared edition helpers the editor composes its form from, plus a
 * `$exeTinyMCE` that attaches the REAL TinyMCE (so the body field, and what it
 * feeds back into the model, can be exercised for real).
 */
export function installEditionHarness(): EditionHarness {
    const layer = editionLayer();
    const previous = {
        common: layer.common,
        tabs: layer.tabs,
        gamificationCommon: layer.gamification.common,
        scorm: layer.gamification.scorm,
        progressBar: layer.gamification.progressBar,
        exeTinyMce: $exeTinyMCE,
    };
    const values: EditionStubValues = {
        scorm: { isScorm: 0, textButtonScorm: 'Save', repeatActivity: true, weighted: 100 },
        progress: { evaluation: false, evaluationID: '' },
        languageTabArgs: [],
    };
    const stubs: EditionHarness['stubs'] = {
        tabsInit: vi.fn(),
        getIdeviceDescription: vi.fn((text: string) => '<p class="alert alert-info exe-iv-desc">' + text + '</p>'),
        getTextFieldset: vi.fn(
            (which: 'before' | 'after') =>
                '<textarea id="eXeIdeviceText' + (which === 'before' ? 'Before' : 'After') + '"></textarea>',
        ),
        getLanguageTab: vi.fn((ci18n: Record<string, string>) => {
            values.languageTabArgs.push(ci18n);
            return '<div class="exe-form-tab" title="Custom texts"><input id="ci18n_check"></div>';
        }),
        setLanguageTabValues: vi.fn(),
        scormGetTab: vi.fn(() => '<div class="exe-form-tab" title="SCORM"></div>'),
        scormInit: vi.fn(),
        scormGetValues: vi.fn(() => values.scorm),
        scormSetValues: vi.fn(),
        progressGetContents: vi.fn(() => ''),
        progressAddEvents: vi.fn(),
        progressGetValues: vi.fn(() => values.progress),
        progressSetValues: vi.fn(),
        tinyMceInit: installSharedTinyMce(),
    };

    layer.common = {
        getIdeviceDescription: stubs.getIdeviceDescription as unknown as (text: string) => string,
        getTextFieldset: stubs.getTextFieldset as unknown as (which: 'before' | 'after') => string,
    };
    layer.tabs = { init: stubs.tabsInit as unknown as (formId: string) => void };
    layer.gamification.common = {
        ...previous.gamificationCommon,
        getLanguageTab: stubs.getLanguageTab as unknown as (ci18n: Record<string, string>) => string,
        setLanguageTabValues: stubs.setLanguageTabValues as unknown as (v: Record<string, string>) => void,
    };
    layer.gamification.scorm = {
        ...previous.scorm,
        getTab: stubs.scormGetTab as unknown as () => string,
        init: stubs.scormInit as unknown as () => void,
        getValues: stubs.scormGetValues as unknown as NonNullable<EditionLayer['gamification']['scorm']['getValues']>,
        setValues: stubs.scormSetValues as unknown as NonNullable<EditionLayer['gamification']['scorm']['setValues']>,
    };
    layer.gamification.progressBar = {
        ...previous.progressBar,
        getContents: stubs.progressGetContents as unknown as (path: string | undefined) => string,
        addEvents: stubs.progressAddEvents as unknown as () => void,
        getValues: stubs.progressGetValues as unknown as () => ProgressStubValues | null,
        setValues: stubs.progressSetValues as unknown as (v: { evaluation?: unknown; evaluationID?: unknown }) => void,
    };

    return {
        values,
        stubs,
        restore() {
            layer.common = previous.common;
            layer.tabs = previous.tabs;
            layer.gamification.common = previous.gamificationCommon;
            layer.gamification.scorm = previous.scorm;
            layer.gamification.progressBar = previous.progressBar;
            $exeTinyMCE = previous.exeTinyMce;
            clearFakeProviders();
            document.body.innerHTML = '';
        },
    };
}

/**
 * Point `$exeTinyMCE.init` at the real TinyMCE loaded by the Vitest setup, the
 * way the workarea's shared bootstrapper does. The body field delegates to it,
 * so this is what makes the rich-text path testable end to end. Returns the
 * spy so specs can assert HOW the shared editor was requested.
 */
export function installSharedTinyMce(): Mock {
    const init = vi.fn((_mode: string, selector: string) => {
        tinymce?.init?.({
            selector,
            menubar: false,
            statusbar: false,
            plugins: 'lists link',
            toolbar: 'bold italic',
        });
    });
    $exeTinyMCE = { init: init as unknown as (mode: string, selector: string) => void };
    return init;
}

/** The classic-script globals a spec may need to take off the page. */
export type RemovableGlobal = 'tinymce' | 'tinyMCE' | '$exeTinyMCE' | '$exeDevicesEdition' | '_' | 'c_';

/** Run `body` with globals temporarily unset (e.g. no TinyMCE on the page). */
export function withoutGlobals(names: RemovableGlobal[], body: () => void): void {
    const holder = globalThis as unknown as Record<string, unknown>;
    const previous = names.map(name => [name, holder[name]] as const);
    for (const name of names) {
        delete holder[name];
    }
    try {
        body();
    } finally {
        for (const [name, value] of previous) {
            holder[name] = value;
        }
    }
}

/** Run `body` with a single global temporarily unset. */
export function withoutGlobal(name: RemovableGlobal, body: () => void): void {
    withoutGlobals([name], body);
}

// ---------------------------------------------------------------------------
// Editor state / DOM
// ---------------------------------------------------------------------------

/** A fully-defaulted edition state, overridable field by field. */
export function makeState(overrides: Partial<EditionState> = {}): EditionState {
    return {
        doc: newDocument(),
        selectedId: null,
        confirmDeleteId: null,
        adapter: null,
        duration: null,
        lastTime: 0,
        durationPending: false,
        bodyEditorId: null,
        ideviceBody: null,
        idevicePath: undefined,
        ci18n: {},
        unsupported: null,
        ...overrides,
    };
}

/** Mount the whole "General settings" tab (source field + interactions area). */
export function mountForm(state: EditionState): void {
    document.body.innerHTML =
        '<div id="interactiveVideoIdeviceForm" class="exe-idevice-form">' + tabGeneralSettingsHtml(state) + '</div>';
}

/** Mount only the Interactions authoring surface (player, timeline, list). */
export function mountInteractionsSection(): void {
    document.body.innerHTML =
        '<div id="interactiveVideoIdeviceForm" class="exe-idevice-form">' + interactionsSectionHtml() + '</div>';
}

export interface EditorHarness {
    state: EditionState;
    editor: Editor;
}

/** A mounted form plus a freshly-painted accordion editor over it. */
export function mountEditor(overrides: Partial<EditionState> = {}): EditorHarness {
    const state = makeState(overrides);
    mountForm(state);
    const editor = createEditor(state);
    editor.renderInteractionList();
    editor.renderDetail();
    editor.refreshMarkers();
    return { state, editor };
}

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

/** A complete provider adapter whose members can be overridden one by one. */
export function makeAdapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter {
    return {
        load: () => Promise.resolve(),
        play() {},
        pause() {},
        seekTo() {},
        getCurrentTime: () => Promise.resolve(0),
        getDuration: () => Promise.resolve(null),
        onReady() {},
        onTimeUpdate() {},
        onStateChange() {},
        destroy() {},
        ...overrides,
    };
}

export interface FakeProviderOptions {
    /** Replace the adapter factory entirely (the default one is recording). */
    createAdapter?: (spec?: AdapterSpec | null) => ProviderAdapter;
    embedUrl?: (provider: string, videoId: unknown) => string;
    mediatecaStreamUrl?: (videoId: unknown) => string;
    /** What the default adapter reports for getCurrentTime(). */
    currentTime?: number;
    /** What the default adapter reports for getDuration(). */
    duration?: number | null;
}

export interface FakeProviders {
    /** The specs `createAdapter` was called with, in order. */
    specs: AdapterSpec[];
    adapters: ProviderAdapter[];
    /** How many times an adapter was destroyed (default adapter only). */
    destroyed: number;
    /** Fire the adapters' registered timeupdate callbacks. */
    emitTime(seconds: number): void;
    /** Fire the adapters' registered ready callbacks again. */
    emitReady(): void;
}

/**
 * Publish a controllable `window.exeInteractiveVideoProviders`. The player
 * resolves the factory through that global, so this intercepts the real one.
 */
export function installFakeProviders(options: FakeProviderOptions = {}): FakeProviders {
    const timeCallbacks: Array<(seconds: number) => void> = [];
    const readyCallbacks: Array<() => void> = [];
    const handle: FakeProviders = {
        specs: [],
        adapters: [],
        destroyed: 0,
        emitTime(seconds) {
            for (const callback of timeCallbacks.slice()) {
                callback(seconds);
            }
        },
        emitReady() {
            for (const callback of readyCallbacks.slice()) {
                callback();
            }
        },
    };
    const defaultCreate = (): ProviderAdapter =>
        makeAdapter({
            getCurrentTime: () => Promise.resolve(options.currentTime ?? 0),
            getDuration: () => Promise.resolve(options.duration ?? null),
            onReady: callback => {
                readyCallbacks.push(callback);
                callback();
            },
            onTimeUpdate: callback => {
                timeCallbacks.push(callback);
            },
            destroy: () => {
                handle.destroyed += 1;
            },
        });
    const factory: ProviderFactory = {
        // happy-dom really fetches an http(s) iframe src, so the default embed
        // URL is an about: URL: the specs can still assert it verbatim, and no
        // test touches the network.
        embedUrl: options.embedUrl ?? ((provider, videoId) => 'about:blank#' + provider + '/' + String(videoId)),
        mediatecaStreamUrl:
            options.mediatecaStreamUrl ??
            (videoId => 'https://mediateca.educa.madrid.org/streaming.php?id=' + String(videoId)),
        createAdapter: spec => {
            handle.specs.push(spec ?? {});
            const adapter = (options.createAdapter ?? defaultCreate)(spec);
            handle.adapters.push(adapter);
            return adapter;
        },
    };
    window.exeInteractiveVideoProviders = factory;
    return handle;
}

export function clearFakeProviders(): void {
    delete window.exeInteractiveVideoProviders;
}

// ---------------------------------------------------------------------------
// DOM assertions
// ---------------------------------------------------------------------------

/** True when `a` precedes `b` in document order. */
export function precedes(a: Node | null, b: Node | null): boolean {
    if (!a || !b) {
        return false;
    }
    return !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

/** The `.exe-form-tab` titles in DOM order (pre-tabs.init). */
export function tabTitles(): Array<string | null> {
    return Array.from(document.querySelectorAll('.exe-form-tab')).map(tab => tab.getAttribute('title'));
}

/** happy-dom has no layout, so give the timeline track a concrete rect. */
export function stubTrackRect(width: number): HTMLElement | null {
    const track = document.getElementById('ivTimelineTrack');
    if (track) {
        track.getBoundingClientRect = () =>
            ({
                left: 0,
                top: 0,
                width,
                height: 6,
                right: width,
                bottom: 6,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }) as DOMRect;
    }
    return track;
}

/** Dispatch a bubbling click carrying a viewport x coordinate. */
export function clickAt(element: Element, clientX: number): void {
    element.dispatchEvent(new window.MouseEvent('click', { bubbles: true, clientX }));
}

/** Dispatch a bubbling keydown with `key`. */
export function pressKey(element: Element, key: string): void {
    element.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
}

interface AlertingExeApp {
    _alertHistory: string[];
    clearHistory(): void;
}

/** The messages passed to `eXe.app.alert` since the last reset. */
export function alertHistory(): string[] {
    const app = (eXe as unknown as { app?: AlertingExeApp } | undefined)?.app;
    return app?._alertHistory ?? [];
}

export function clearAlerts(): void {
    const app = (eXe as unknown as { app?: AlertingExeApp } | undefined)?.app;
    app?.clearHistory();
}
