/**
 * Ambient declarations for the browser globals eXeLearning supplies through
 * classic scripts. The Interactive Video bundles never import these — they are
 * already on the page (workarea, preview or export) when the bundle runs — so
 * every access is feature-detected and typed as possibly undefined.
 *
 * Only the members this iDevice actually uses are declared; these are NOT
 * complete typings for the eXe runtime.
 */

/** The minimal slice of a jQuery result set the editor uses. */
interface ExeJQuery {
    readonly length: number;
    [index: number]: HTMLElement;
    val(): string | undefined;
    val(value: string): ExeJQuery;
    html(html: string): ExeJQuery;
    text(text: string): ExeJQuery;
    attr(name: string): string | undefined;
    prop(name: string, value: boolean): ExeJQuery;
    is(selector: string): boolean;
    data(key: string): unknown;
    find(selector: string): ExeJQuery;
    closest(selector: string): ExeJQuery;
    hasClass(className: string): boolean;
    toggle(state: boolean): ExeJQuery;
    toggleClass(className: string, state?: boolean): ExeJQuery;
    on(events: string, handler: (this: HTMLElement, event: ExeJQueryEvent) => void): ExeJQuery;
    on(events: string, selector: string, handler: (this: HTMLElement, event: ExeJQueryEvent) => void): ExeJQuery;
    off(events?: string): ExeJQuery;
    trigger(eventName: string): ExeJQuery;
}

interface ExeJQueryEvent {
    readonly target: HTMLElement;
    readonly clientX: number;
    preventDefault(): void;
}

type ExeJQueryStatic = (selector: string | HTMLElement | Document) => ExeJQuery;

/** One live TinyMCE editor instance (the slice the body editor uses). */
interface ExeTinyMceEditor {
    getContent(): string;
    save(): void;
    remove(): void;
    isDirty?(): boolean;
    on(events: string, handler: () => void): void;
}

interface ExeTinyMceStatic {
    get?(id: string): ExeTinyMceEditor | null;
    init?(options: unknown): void;
}

declare var $: ExeJQueryStatic;

/** GUI-string translator (workarea i18n). */
declare var _: ((text: string) => string) | undefined;

/** Content-string translator (exported-content i18n). */
declare var c_: ((text: string) => string) | undefined;

declare var eXe:
    | {
          app?: {
              isInExe?: () => boolean;
              alert?: (message: string) => void;
          };
      }
    | undefined;

/** The shared export/preview helper layer (gamification, SCORM, xAPI). */
declare var $exeDevices:
    | {
          iDevice?: {
              gamification?: {
                  scorm?: {
                      registerActivity?: (game: Record<string, unknown>) => void;
                      sendScoreNew?: (auto: boolean, game: Record<string, unknown>) => void;
                  };
              };
          };
      }
    | undefined;

/** The shared edition helper layer (tabs, fieldsets, SCORM tab, Custom texts tab). */
declare var $exeDevicesEdition:
    | {
          iDevice: {
              tabs?: { init?: (formId: string) => void };
              common?: {
                  getIdeviceDescription?: (text: string) => string;
                  getTextFieldset?: (which: 'before' | 'after') => string;
              };
              gamification: {
                  scorm: {
                      getTab?: () => string;
                      init?: () => void;
                      setValues?: (
                          isScorm: number,
                          textButtonScorm: unknown,
                          repeatActivity: boolean,
                          weighted: number,
                      ) => void;
                      getValues?: () => {
                          isScorm?: number | boolean;
                          weighted?: number;
                          repeatActivity?: boolean;
                          textButtonScorm?: string;
                      } | null;
                  };
                  common: {
                      getLanguageTab?: (ci18n: Record<string, string>) => string;
                      setLanguageTabValues?: (values: Record<string, string>) => void;
                  };
                  progressBar?: {
                      getContents?: (path: string | undefined) => string;
                      addEvents?: () => void;
                      setValues?: (values: { evaluation?: unknown; evaluationID?: unknown }) => void;
                      getValues?: () => { evaluation?: unknown; evaluationID?: unknown } | null;
                  };
              };
          };
      }
    | undefined;

/** eXe's shared TinyMCE bootstrapper (`tinymce_5_settings.js`). */
declare var $exeTinyMCE:
    | {
          init?: (mode: string, selector: string) => void;
      }
    | undefined;

declare var tinymce: ExeTinyMceStatic | undefined;
declare var tinyMCE: ExeTinyMceStatic | undefined;

/** The workarea application object (File Manager modal, config). */
declare var eXeLearning:
    | {
          app?: {
              modals?: {
                  filemanager?: {
                      show?: (options: {
                          onSelect: (result: { assetUrl?: string; blobUrl?: string; url?: string } | null) => void;
                      }) => void;
                  };
              };
          };
      }
    | undefined;

interface Window {
    /** Published by the export bundle for tests and external probes. */
    $interactivevideo?: unknown;
    /** Published by the edition bundle; the workarea engine reads this. */
    $exeDevice?: unknown;
    /**
     * The shared pure core, published for tests/probes. Both bundles carry
     * their own compiled copy; this global mirrors the export bundle's one.
     */
    exeInteractiveVideoCore?: unknown;
    /**
     * Provider-adapter factory. The runtime RESOLVES adapters through this
     * global (falling back to its bundled copy) so the E2E fake-provider seam
     * can intercept it with an accessor property before the bundle loads.
     */
    exeInteractiveVideoProviders?: unknown;
    _?: (text: string) => string;
    c_?: (text: string) => string;
}
