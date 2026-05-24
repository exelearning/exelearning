import WebMCPLogger from './WebMCPLogger.js';
import WebMCPAudit, { AUDIT_EVENTS } from './WebMCPAudit.js';
import WebMCPPermissions from './WebMCPPermissions.js';
import WebMCPRegistry from './WebMCPRegistry.js';
import { toolCatalog } from './tools/index.js';
import { isDataGameType, buildDataGameHtml } from './builders/dataGameBuilder.js';
import {
    requireString,
    optionalString,
    optionalNumber,
    optionalBoolean,
    normalizeMetadataValue,
    getMissingRequiredMetadataFields,
    normalizeJsonPropertiesForStorage,
    parseJsonObject,
    parseArrayValue,
    clampNumber,
    parseOptionalNumberArray,
    escapeHtml,
    normalizeInsertPosition,
    mergeHtmlContent,
    normalizeQuestionHtml,
    detectMimeType,
    extensionFromMimeType,
    getFileExtension,
    sanitizeFilename,
    filenameFromImageUrl,
    normalizeCssSize,
    normalizeImageAlign,
    requireDataUrl,
    detectDataUrlMimeType,
    base64ToUint8Array,
    createFileFromBytes,
    createFileFromBlob,
    isTextIdeviceType,
    isTextIdeviceComponent,
    generateOdeId,
    generateLocalId,
    encodeLegacyText,
    wrapResult,
    tryParseHttpImageUrl,
    requireHttpImageUrl,
    buildPicsumImageUrl,
    resolveImageUrlFromInput,
    requireAssetUuidUrl,
} from './validators.js';

const WEBMCP_DOCS_URL =
    'https://github.com/exelearning/exelearning/blob/main/doc/webmcp.md';
const WEBMCP_LOCAL_SCRIPT_PATH = 'libs/webmcp/webmcp.js';
const WEBMCP_ROOT_SCRIPT_PATH = 'webmcp.js';
const WEBMCP_FALLBACK_REMOTE_SCRIPT_URLS = [
    'https://webmcp.dev/src/webmcp.js',
    'https://cdn.jsdelivr.net/npm/@jason.today/webmcp@latest/build/webmcp.js',
    'https://unpkg.com/@jason.today/webmcp@latest/build/webmcp.js',
];
function buildAzQuizDefaultMessages() {
    const t = typeof c_ === 'function' ? c_ : (s) => s;
    return {
        msgReady: t('Ready?'),
        msgStartGame: t('Click here to start'),
        msgHappen: t('Move on'),
        msgReply: t('Reply'),
        msgSubmit: t('Submit'),
        msgEnterCode: t('Enter the access code'),
        msgErrorCode: t('The access code is not correct'),
        msgGameOver: t('Game Over!'),
        msgNewWord: t('New word'),
        msgStartWith: t('Starts with %1'),
        msgContaint: t('Contains letter %1'),
        msgPass: t('Move on to the next word'),
        msgIndicateWord: t('Provide a word'),
        msgClue: t('Cool! The clue is:'),
        msgNewGame: t('Click here for a new game'),
        msgYouHas: t('You have got %1 hits and %2 misses'),
        msgCodeAccess: t('Access code'),
        msgPlayAgain: t('Play Again'),
        msgRequiredAccessKey: t('Access code required'),
        msgInformationLooking: t('The information you were looking for'),
        msgPlayStart: t('Click here to play'),
        msgMinimize: t('Minimize'),
        msgMaximize: t('Maximize'),
        msgHits: t('Hits'),
        msgErrors: t('Errors'),
        msgTime: t('Time Limit (mm:ss)'),
        msgOneRound: t('One round'),
        msgTowRounds: t('Two rounds'),
        msgImage: t('Image'),
        msgNoImage: t('No image'),
        msgWrote: t('Write the correct word and click on Reply. If you hesitate, click on Move on.'),
        msgNotNetwork: t('You can only play this game with internet connection.'),
        msgSuccesses: t('Right! | Excellent! | Great! | Very good! | Perfect!'),
        msgFailures: t('It was not that! | Incorrect! | Not correct! | Sorry! | Error!'),
        msgEndGameScore: t('Please start the game before saving your score.'),
        msgScoreScorm: t("The score can't be saved because this page is not part of a SCORM package."),
        msgShowRoulette: t('Show word wheel'),
        msgHideRoulette: t('Hide word wheel'),
        msgQuestion: t('Question'),
        msgAnswer: t('Answer'),
        msgOnlySaveScore: t('You can only save the score once!'),
        msgOnlySave: t('You can only save once'),
        msgInformation: t('Information'),
        msgYouScore: t('Your score'),
        msgOnlySaveAuto: t('Your score will be saved after each question. You can only play once.'),
        msgSaveAuto: t('Your score will be automatically saved after each question.'),
        msgAuthor: t('Authorship'),
        msgSeveralScore: t('You can save the score as many times as you want'),
        msgYouLastScore: t('The last score saved is'),
        msgActityComply: t('You have already done this activity.'),
        msgPlaySeveralTimes: t('You can do this activity as many times as you want'),
        msgFullScreen: t('Full Screen'),
        msgExitFullScreen: t('Exit Full Screen'),
        msgMoveOne: t('Move on'),
        msgAudio: t('Audio'),
        msgCorrect: t('Correct'),
        msgIncorrect: t('Incorrect'),
        msgWhiteBoard: t('Digital whiteboard'),
        msgClose: t('Close'),
        msgUncompletedActivity: t('Incomplete activity'),
        msgSuccessfulActivity: t('Activity: Passed. Score: %s'),
        msgUnsuccessfulActivity: t('Activity: Not passed. Score: %s'),
        msgTypeGame: t('A-Z quiz'),
        msgShowWords: t('Show solutions'),
        msgAll: t('All'),
        msgUnanswered: t('Not answered'),
        msgScore: t('Score'),
        msgWeight: t('Weight'),
    };
}

function buildAzQuizDefaultInstructions() {
    const t = typeof c_ === 'function' ? c_ : (s) => s;
    return t('Observe the letters, identify and fill in the missing words.');
}

function buildAzQuizDefaultNotSupportedBrowserMessage() {
    const t = typeof c_ === 'function' ? c_ : (s) => s;
    return t('Your browser is not compatible with this tool.');
}

export default class WebMCPService {
    constructor(app) {
        this.app = app;
        this.instance = null;
        this.initialized = false;
        this.available = false;
        this.loading = false;
        this.mode = null;
        this.lastError = null;
        this.loadedScriptUrl = null;
        this.loadPromise = null;

        // Module instances for lifecycle, permissions, logging, and audit
        this._logger = new WebMCPLogger();
        this._audit = new WebMCPAudit({ logger: this._logger });
        this._permissions = new WebMCPPermissions({
            logger: this._logger,
            audit: this._audit,
        });
        this._registry = new WebMCPRegistry({
            logger: this._logger,
            audit: this._audit,
            permissions: this._permissions,
        });

        // Legacy compatibility — keep these for any external consumers
        this.registeredTools = [];
        this.writeConfirmationPolicy = this._permissions.getPolicy();
        this.writeSessionApproved = false;
    }

    init() {
        this._logger.debug('init() called', { alreadyInitialized: this.initialized });
        if (this.initialized) {
            return this.initializeInstance();
        }

        this.initialized = true;
        this._audit.emit(AUDIT_EVENTS.SESSION_STARTED, { mode: 'init' });
        return this.initializeInstance();
    }

    dispose() {
        this._logger.info('Disposing WebMCP service');
        this._registry.disposeSession();
        this._permissions.resetSession();
        this.registeredTools = [];
        this.writeSessionApproved = false;
        this.instance = null;
        this.mode = null;
        this.initialized = false;
        this._audit.emit(AUDIT_EVENTS.SESSION_ENDED, { reason: 'dispose' });
    }

    async ensureReady(options = {}) {
        const forceReload = options.forceReload === true;

        if (this.hasNativeModelContext()) {
            return this.initializeNativeInstance(forceReload);
        }

        if (this.instance && !forceReload) {
            return true;
        }

        if (!this.getWebMcpConstructor() || forceReload) {
            if (this.loading && this.loadPromise && !forceReload) {
                return this.loadPromise;
            }

            this.loadPromise = this.loadAndInitialize(forceReload);
            return this.loadPromise;
        }

        return this.initializeInstance();
    }

    getScriptCandidates() {
        const candidates = [];
        const config = window.eXeLearning?.config || {};

        if (typeof config.webmcpScriptUrl === 'string') {
            candidates.push(config.webmcpScriptUrl);
        }
        if (Array.isArray(config.webmcpScriptUrls)) {
            config.webmcpScriptUrls.forEach((url) => {
                if (typeof url === 'string') {
                    candidates.push(url);
                }
            });
        }

        if (typeof this.app?.composeUrl === 'function') {
            candidates.push(this.app.composeUrl(WEBMCP_LOCAL_SCRIPT_PATH));
            candidates.push(this.app.composeUrl(WEBMCP_ROOT_SCRIPT_PATH));
        } else {
            candidates.push(`/${WEBMCP_LOCAL_SCRIPT_PATH}`);
            candidates.push(`/${WEBMCP_ROOT_SCRIPT_PATH}`);
        }

        // Remote CDN fallbacks are opt-in: many LMS deployments block third-party
        // origins via CSP and embed eXeLearning in iframes that should not call
        // out to webmcp.dev / unpkg / jsdelivr without consent.
        if (config.webmcpAllowRemoteFallback === true) {
            WEBMCP_FALLBACK_REMOTE_SCRIPT_URLS.forEach((url) => {
                candidates.push(url);
            });
        }

        return [...new Set(candidates.filter((url) => typeof url === 'string' && url.trim()))];
    }

    isEmbeddedInIframe() {
        try {
            return typeof window !== 'undefined' && window.top !== window.self;
        } catch {
            // Cross-origin access denial implies we are inside an iframe.
            return true;
        }
    }

    async loadAndInitialize(forceReload) {
        this.loading = true;
        this.lastError = null;

        try {
            if (!this.getWebMcpConstructor() || forceReload) {
                await this.loadWebMcpLibrary(forceReload);
            }

            return this.initializeWebMcpJsInstance(forceReload);
        } catch (error) {
            this.available = !!this.getWebMcpConstructor();
            this.lastError = String(error?.message || error || 'Unknown error');
            this.instance = null;
            this.mode = null;
            return false;
        } finally {
            this.loading = false;
        }
    }

    async loadWebMcpLibrary(forceReload) {
        const candidates = this.getScriptCandidates();
        const failedSources = [];
        this._logger.logFallbackLoad({ status: 'started', candidates: candidates.length });

        for (const sourceUrl of candidates) {
            try {
                await this.injectScript(sourceUrl, forceReload);
                const constructor = this.getWebMcpConstructor();
                if (constructor) {
                    if (typeof window.WebMCP !== 'function') {
                        window.WebMCP = constructor;
                    }
                    this.loadedScriptUrl = sourceUrl;
                    this.available = true;
                    this._logger.logFallbackLoad({ status: 'succeeded', url: sourceUrl });
                    return;
                }
                failedSources.push(
                    `Script loaded from "${sourceUrl}" but no WebMCP constructor was detected.`,
                );
            } catch (error) {
                failedSources.push(String(error?.message || error || 'Unknown error'));
            }
        }

        this._logger.logFallbackLoad({ status: 'failed', errors: failedSources });

        throw new Error(
            `Unable to load webmcp.js from configured sources. Tried: ${candidates.join(
                ', ',
            )}. Errors: ${failedSources.join(' | ') || 'none'}`,
        );
    }

    injectScript(url, forceReload = false) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.async = true;
            script.defer = true;
            script.crossOrigin = 'anonymous';
            script.dataset.webmcp = 'true';
            script.src = forceReload ? this.addCacheBust(url) : url;

            script.onload = () => resolve();
            script.onerror = () => {
                reject(new Error(`Failed to load WebMCP script: ${url}`));
            };

            document.head.append(script);
        });
    }

    addCacheBust(url) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}t=${Date.now()}`;
    }

    initializeInstance(forceReload = false) {
        if (this.hasNativeModelContext()) {
            return this.initializeNativeInstance(forceReload);
        }

        return this.initializeWebMcpJsInstance(forceReload);
    }

    hasNativeModelContext() {
        return typeof navigator?.modelContext?.registerTool === 'function';
    }

    initializeNativeInstance(forceReload = false) {
        this.available = this.hasNativeModelContext();

        if (!this.available) {
            this._logger.logDetection({ native: false, fallback: false, mode: null });
            this.instance = null;
            this.mode = null;
            return false;
        }

        if (this.instance && this.mode === 'native' && !forceReload) {
            return true;
        }

        try {
            this._logger.logDetection({ native: true, fallback: false, mode: 'native' });
            this.instance = navigator.modelContext;
            this.mode = 'native';
            this.registerDefaultTools();
            this.lastError = null;
            this.loadedScriptUrl = null;
            return true;
        } catch (error) {
            this.lastError = String(error?.message || error || 'Unknown error');
            this._logger.error('Native initialization failed', this.lastError);
            this.instance = null;
            this.mode = null;
            return false;
        }
    }

    initializeWebMcpJsInstance(forceReload = false) {
        const WebMcpConstructor = this.getWebMcpConstructor();
        this.available = typeof WebMcpConstructor === 'function';

        if (!this.available) {
            this._logger.logDetection({ native: false, fallback: false, mode: null });
            this.instance = null;
            this.mode = null;
            return false;
        }

        if (this.instance && this.mode === 'webmcp-js' && !forceReload) {
            return true;
        }

        try {
            this._logger.logDetection({ native: false, fallback: true, mode: 'webmcp-js' });

            if (typeof window.WebMCP !== 'function') {
                window.WebMCP = WebMcpConstructor;
            }

            this.instance = new WebMcpConstructor({
                color: '#0d6efd',
                position: 'bottom-right',
                size: '40px',
                padding: '14px',
            });

            this.mode = 'webmcp-js';
            this.registerDefaultTools();
            this.lastError = null;
            return true;
        } catch (error) {
            this.lastError = String(error?.message || error || 'Unknown error');
            this._logger.error('webmcp-js initialization failed', this.lastError);
            this.instance = null;
            this.mode = null;
            return false;
        }
    }

    getWebMcpConstructor() {
        if (typeof window?.WebMCP === 'function') {
            return window.WebMCP;
        }

        if (typeof globalThis?.WebMCP === 'function') {
            return globalThis.WebMCP;
        }

        if (typeof WebMCP === 'function') {
            return WebMCP;
        }

        return null;
    }

    getClientConfigSnippet() {
        if (this.mode === 'native') {
            // Native mode: the browser exposes navigator.modelContext directly,
            // so no MCP client config is needed. Show a one-line note instead.
            return '// Native WebMCP detected — no MCP client config needed.\n'
                + '// Open a WebMCP-aware browser agent (e.g. Claude in Chrome) on this tab.';
        }
        return JSON.stringify(
            {
                mcpServers: {
                    webmcp: {
                        command: 'npx',
                        args: ['-y', '@jason.today/webmcp@latest', '--mcp'],
                    },
                },
            },
            null,
            2,
        );
    }

    getDocsUrl() {
        return WEBMCP_DOCS_URL;
    }

    isReady() {
        return !!this.instance;
    }

    isLoading() {
        return this.loading;
    }

    canOpenWidget() {
        return this.mode === 'webmcp-js';
    }

    getStatus() {
        const toolCount = this._registry.getRegisteredTools().length;

        if (this.mode === 'native' && this.instance) {
            return {
                label: 'Ready (native WebMCP)',
                className: 'text-success',
                description: `${toolCount} tools registered via navigator.modelContext.`,
            };
        }

        if (this.loading) {
            return {
                label: 'Loading WebMCP script...',
                className: 'text-info',
                description: 'Trying to load webmcp.js automatically.',
            };
        }

        if (this.lastError) {
            return {
                label: 'Error',
                className: 'text-danger',
                description: this.lastError,
            };
        }

        if (!this.available) {
            const description = this.isEmbeddedInIframe()
                ? 'eXeLearning is running inside an iframe. The W3C navigator.modelContext API is restricted to top-level documents, and webmcp.js is not loaded. Open the editor in its own tab to use MCP.'
                : 'This browser does not expose navigator.modelContext and webmcp.js is not loaded.';
            return {
                label: 'WebMCP unavailable',
                className: 'text-warning',
                description,
            };
        }

        if (!this.instance) {
            return {
                label: 'WebMCP unavailable',
                className: 'text-danger',
                description: 'The WebMCP instance could not be created.',
            };
        }

        return {
            label: 'Ready',
            className: 'text-success',
            description: `${toolCount} tools registered${
                this.loadedScriptUrl ? ` (source: ${this.loadedScriptUrl})` : ''
            }`,
        };
    }

    getRegisteredTools() {
        return this._registry.getRegisteredTools();
    }

    openWidget() {
        if (!this.instance || !this.canOpenWidget()) {
            return false;
        }

        try {
            if (typeof this.instance.open === 'function') {
                this.instance.open();
                return true;
            }
            if (typeof this.instance.toggle === 'function') {
                this.instance.toggle();
                return true;
            }
        } catch {
            // Fall through to DOM fallback.
        }

        const widget = document.querySelector(
            '.webmcp-widget, #webmcp-widget, [data-webmcp-widget]'
        );
        if (widget && typeof widget.click === 'function') {
            widget.click();
            return true;
        }

        return false;
    }

    registerDefaultTools() {
        if (!this.instance || typeof this.instance.registerTool !== 'function') {
            this._logger.warn('Cannot register tools: no valid instance');
            return;
        }

        // Create a new idempotent session — aborts any prior registration
        this._registry.createSession();

        const handlerMap = this._buildHandlerMap();
        const count = this._registry.registerAll(this.instance, this.mode, toolCatalog, handlerMap);

        // Sync legacy property for backward compatibility
        this.registeredTools = this._registry.getRegisteredTools();
        this._logger.info(`Registered ${count} tools (mode: ${this.mode})`);
    }

    _buildHandlerMap() {
        return {
            getCurrentContext: () => this.getCurrentContext(),
            getProjectMetadataStatus: () => this.getProjectMetadataStatus(),
            ensureProjectMetadata: (args) => this.ensureProjectMetadata(args),
            createPage: (args) => this.createPage(args),
            movePage: (args) => this.movePage(args),
            deletePage: (args) => this.deletePage(args),
            createBlock: (args) => this.createBlock(args),
            moveBlock: (args) => this.moveBlock(args),
            createComponent: (args) => this.createComponent(args),
            addTextIdevice: (args) => this.addTextIdevice(args),
            addAzQuizGameIdevice: (args) => this.addAzQuizGameIdevice(args),
            addDataGameIdevice: (args) => this.addDataGameIdevice(args),
            addImageGalleryIdevice: (args) => this.addImageGalleryIdevice(args),
            addFormIdevice: (args) => this.addFormIdevice(args),
            listIdeviceIcons: () => this.listIdeviceIcons(),
            setTextIdeviceRichHtml: (args) => this.setTextIdeviceRichHtml(args),
            appendTextIdeviceRichHtml: (args) => this.appendTextIdeviceRichHtml(args),
            insertTextIdeviceImageFromBase64: (args) => this.insertTextIdeviceImageFromBase64(args),
            insertTextIdeviceImageFromUrl: (args) => this.insertTextIdeviceImageFromUrl(args),
            setComponentHtml: (args) => this.setComponentHtml(args),
            deleteComponent: (args) => this.deleteComponent(args),
            uploadAssetFromBase64: (args) => this.uploadAssetFromBase64(args),
            uploadAssetFromDataUrl: (args) => this.uploadAssetFromDataUrl(args),
            importAssetFromUrl: (args) => this.importAssetFromUrl(args),
            listAssets: (args) => this.listAssets(args),
            insertTextIdeviceImageFromAsset: (args) => this.insertTextIdeviceImageFromAsset(args),
            saveProject: () => this.saveProject(),
        };
    }

    // Legacy compatibility — delegates to permissions module
    confirmWriteAction(toolName) {
        const { allowed } = this._permissions.checkPermission(toolName, { writes: true });
        if (allowed) {
            this.writeSessionApproved = this._permissions.isSessionApproved();
        }
        return allowed;
    }

    wrapResult(payload, options = {}) {
        return wrapResult(payload, options);
    }

    getCurrentContext() {
        const binding = this.getStructureBinding();
        const pages = binding.getPages();
        const selectedPageId = this.getSelectedPageId();
        const metadataStatus = this.getProjectMetadataStatus();

        return {
            projectId: this.app?.project?.odeId || this.app?.project?.yjsProjectId || null,
            selectedPageId: selectedPageId || null,
            pagesCount: pages.length,
            metadataReady: metadataStatus.ready,
            missingProjectMetadata: metadataStatus.missing,
            projectMetadata: metadataStatus.metadata,
            writeConfirmationPolicy: this.writeConfirmationPolicy,
            writeSessionApproved: this.writeSessionApproved,
            tools: this.registeredTools.map((tool) => tool.name),
        };
    }

    getProjectMetadataStatus() {
        const bridge = this.getBridge();
        const metadata = bridge.getMetadata?.() || {};
        const normalized = {
            title: normalizeMetadataValue(metadata.title),
            author: normalizeMetadataValue(metadata.author),
            description: normalizeMetadataValue(metadata.description),
            language: normalizeMetadataValue(metadata.language),
            license: normalizeMetadataValue(metadata.license),
            createdAt: normalizeMetadataValue(metadata.createdAt),
            modifiedAt: normalizeMetadataValue(metadata.modifiedAt),
        };
        const missing = getMissingRequiredMetadataFields(normalized);

        return {
            ready: missing.length === 0,
            missing,
            metadata: normalized,
        };
    }

    ensureProjectMetadata(args = {}) {
        const bridge = this.getBridge();
        const title = optionalString(args.title);
        const author = optionalString(args.author);
        const description = optionalString(args.description);
        const updates = {};

        if (title !== null) {
            updates.title = title;
        }
        if (author !== null) {
            updates.author = author;
        }
        if (description !== null) {
            updates.description = description;
        }
        if (Object.keys(updates).length > 0) {
            bridge.updateMetadata(updates);
        }

        const status = this.getProjectMetadataStatus();
        if (!status.ready) {
            throw new Error(
                `Project metadata is incomplete. Missing: ${status.missing.join(
                    ', ',
                )}. Use exe.project.ensure_metadata with title, author and description.`,
            );
        }

        return status;
    }

    async createPage(args) {
        const bridge = this.getBridge();
        const name = requireString(args.name, 'name');
        const parentId = optionalString(args.parentId);
        const pageReused = this.tryReuseInitialBlankPage(name, parentId);

        if (pageReused) {
            const position = optionalNumber(args.order);
            if (position !== null) {
                bridge.movePage(pageReused.pageId, parentId, position);
            }

            await this.refreshStructure(pageReused.pageId);
            return {
                ...pageReused,
                reusedInitialPage: true,
            };
        }

        const created = bridge.addPage(name, parentId);

        const position = optionalNumber(args.order);
        if (position !== null) {
            bridge.movePage(created.id, parentId, position);
        }

        await this.refreshStructure(created.id);
        return created;
    }

    tryReuseInitialBlankPage(targetName, parentId = null) {
        if (parentId) {
            return null;
        }

        const bridge = this.getBridge();
        const pages = this.getStructureBinding().getPages();
        if (!Array.isArray(pages) || pages.length !== 1) {
            return null;
        }

        const onlyPage = pages[0];
        if (!this.isInitialBlankPage(onlyPage)) {
            return null;
        }

        const pageId = onlyPage.id || onlyPage.pageId;
        if (!pageId) {
            return null;
        }

        bridge.updatePage(pageId, {
            pageName: targetName,
            title: targetName,
        });

        return bridge.getPage(pageId) || {
            id: pageId,
            pageId,
            pageName: targetName,
            parentId: null,
            order: 0,
            blockCount: 0,
        };
    }

    isInitialBlankPage(page) {
        if (!page) return false;
        if (page.parentId !== null && page.parentId !== undefined && page.parentId !== '') return false;
        if ((page.blockCount || 0) > 0) return false;
        if ((page.order ?? 0) !== 0) return false;

        const rawName = normalizeMetadataValue(page.pageName || page.title || '');
        if (!rawName) return false;

        const localizedNewPage = normalizeMetadataValue(
            typeof _ === 'function' ? _('New page') : '',
        );
        const candidates = new Set(
            [
                'new page',
                'nueva página',
                'nueva pagina',
                localizedNewPage.toLowerCase(),
            ].filter(Boolean),
        );

        return candidates.has(rawName.toLowerCase());
    }

    async movePage(args) {
        const bridge = this.getBridge();
        const pageId = requireString(args.pageId, 'pageId');
        const parentId = optionalString(args.parentId);
        const position = optionalNumber(args.position);

        bridge.movePage(pageId, parentId, position);
        await this.refreshStructure(pageId);

        const page = bridge.getPage(pageId);
        return { pageId, page };
    }

    async deletePage(args) {
        const bridge = this.getBridge();
        const pageId = requireString(args.pageId, 'pageId');
        const deleted = bridge.deletePage(pageId);

        await this.refreshStructure(this.getSelectedPageId());
        return { pageId, deleted };
    }

    async createBlock(args) {
        const bridge = this.getBridge();
        const pageId = this.requirePageId(args.pageId);
        const name = optionalString(args.name) || 'Content';
        const order = optionalNumber(args.order);

        const blockId = bridge.addBlock(pageId, name, null, order);
        await this.refreshStructure(pageId);

        return {
            pageId,
            blockId,
            block: this.getStructureBinding().getBlock(blockId),
        };
    }

    async moveBlock(args) {
        const binding = this.getStructureBinding();
        const blockId = requireString(args.blockId, 'blockId');
        const targetPageId = optionalString(args.targetPageId);
        const order = optionalNumber(args.order);

        let moved = false;
        if (targetPageId) {
            moved = binding.moveBlockToPage(blockId, targetPageId, order);
        } else if (order !== null) {
            moved = binding.updateBlockOrder(blockId, order);
        } else {
            throw new Error('Provide targetPageId and/or order');
        }

        await this.refreshStructure(targetPageId || this.getSelectedPageId());
        return {
            blockId,
            moved,
            block: binding.getBlock(blockId),
        };
    }

    async createComponent(args) {
        const bridge = this.getBridge();
        const pageId = this.requirePageId(args.pageId);
        const blockId = requireString(args.blockId, 'blockId');
        const ideviceType = optionalString(args.ideviceType) || 'text';
        const order = optionalNumber(args.order);

        const initialData = {};
        if (typeof args.title === 'string') {
            initialData.title = args.title;
        }
        if (typeof args.html === 'string') {
            initialData.htmlContent = args.html;
            if (isTextIdeviceType(ideviceType)) {
                initialData.htmlView = args.html;
                if (args.jsonProperties === undefined) {
                    initialData.jsonProperties = JSON.stringify(
                        this.buildTextIdeviceJsonProperties(args.html),
                    );
                }
            }
        }
        if (args.jsonProperties !== undefined) {
            initialData.jsonProperties = normalizeJsonPropertiesForStorage(
                args.jsonProperties,
                'jsonProperties',
            );
        }
        if (order !== null) {
            initialData.order = order;
        }

        const componentId = bridge.addComponent(pageId, blockId, ideviceType, initialData);
        await this.refreshStructure(pageId);

        return {
            componentId,
            ideviceType,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    prepareIdeviceTarget(args) {
        const bridge = this.getBridge();
        const pageId = this.requirePageId(args.pageId);
        let blockId = optionalString(args.blockId);
        const blockName = requireString(args.blockName, 'blockName');
        const iconName = this.resolveOptionalIconName(args.iconName);

        if (!blockId) {
            blockId = bridge.addBlock(pageId, blockName, null, null);
        }

        const binding = this.getStructureBinding();
        const blockUpdates = { blockName };
        if (iconName !== null) {
            blockUpdates.iconName = iconName;
        }
        binding.updateBlock(blockId, blockUpdates);

        return {
            pageId,
            blockId,
            blockName,
            iconName: iconName || '',
        };
    }

    buildComponentInitialData(args = {}) {
        const initialData = {};

        const title = optionalString(args.title);
        if (title !== null) {
            initialData.title = title;
        }

        if (typeof args.htmlContent === 'string') {
            initialData.htmlContent = args.htmlContent;
            initialData.htmlView =
                typeof args.htmlView === 'string' ? args.htmlView : args.htmlContent;
        } else if (typeof args.htmlView === 'string') {
            initialData.htmlView = args.htmlView;
        }

        if (args.jsonProperties !== undefined) {
            initialData.jsonProperties = normalizeJsonPropertiesForStorage(
                args.jsonProperties,
                'jsonProperties',
            );
        }

        const order = optionalNumber(args.order);
        if (order !== null) {
            initialData.order = order;
        }

        return initialData;
    }

    async addTextIdevice(args) {
        const bridge = this.getBridge();
        this.ensureProjectMetadata({
            title: args.projectTitle,
            author: args.projectAuthor,
            description: args.projectDescription,
        });

        const { pageId, blockId, blockName, iconName } =
            this.prepareIdeviceTarget(args);

        const html =
            typeof args.html === 'string' && args.html.trim().length > 0
                ? args.html
                : '<p></p>';

        const initialData = this.buildComponentInitialData({
            title: optionalString(args.title) || blockName,
            htmlContent: html,
            jsonProperties: this.buildTextIdeviceJsonProperties(html),
            order: args.order,
        });

        const componentId = bridge.addComponent(pageId, blockId, 'text', initialData);
        await this.refreshStructure(pageId);

        return {
            pageId,
            blockId,
            blockName,
            iconName: iconName || '',
            componentId,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    async addAzQuizGameIdevice(args) {
        const bridge = this.getBridge();
        this.ensureProjectMetadata({
            title: args.projectTitle,
            author: args.projectAuthor,
            description: args.projectDescription,
        });

        const { pageId, blockId, blockName, iconName } =
            this.prepareIdeviceTarget(args);
        const dataGame = this.buildAzQuizGameData(args);
        const textAfter = optionalString(args.textAfter) || '';
        const html = this.buildAzQuizGameHtml(dataGame, textAfter);
        const initialData = this.buildComponentInitialData({
            title: optionalString(args.title) || blockName,
            htmlContent: html,
            jsonProperties: {
                dataGame,
                textAfter,
            },
            order: args.order,
        });

        const componentId = bridge.addComponent(
            pageId,
            blockId,
            'az-quiz-game',
            initialData,
        );
        await this.refreshStructure(pageId);

        return {
            pageId,
            blockId,
            blockName,
            iconName,
            componentId,
            entriesCount: dataGame.wordsGame.length,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    async addImageGalleryIdevice(args) {
        const bridge = this.getBridge();
        this.ensureProjectMetadata({
            title: args.projectTitle,
            author: args.projectAuthor,
            description: args.projectDescription,
        });

        const { pageId, blockId, blockName, iconName } =
            this.prepareIdeviceTarget(args);
        const galleryData = this.buildImageGalleryJsonProperties(args);
        const initialData = this.buildComponentInitialData({
            title: optionalString(args.title) || blockName,
            htmlContent: '',
            htmlView: '',
            jsonProperties: galleryData,
            order: args.order,
        });

        const componentId = bridge.addComponent(pageId, blockId, 'image-gallery', initialData);
        await this.refreshStructure(pageId);

        return {
            pageId,
            blockId,
            blockName,
            iconName,
            componentId,
            imagesCount: Object.keys(galleryData).filter((key) => key !== 'ideviceId').length,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    buildImageGalleryJsonProperties(args = {}) {
        const images = this.normalizeImageGalleryImages(args.images);
        const data = {
            ideviceId: optionalString(args.ideviceId) || '',
        };

        images.forEach((image, index) => {
            data[`img_${index}`] = image;
        });

        return data;
    }

    normalizeImageGalleryImages(value) {
        const images = parseArrayValue(value, 'images');
        if (images.length === 0) {
            throw new Error('images must contain at least one item');
        }

        return images.map((entry, index) => {
            if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
                throw new Error(`images[${index}] must be an object`);
            }

            const imageUrl = resolveImageUrlFromInput(
                entry.imageUrl ?? entry.url,
                {
                    picsumSeed:
                        entry.picsumSeed ??
                        entry.seed ??
                        entry.title ??
                        `gallery-${index + 1}`,
                    picsumWidth: entry.picsumWidth ?? entry.width,
                    picsumHeight: entry.picsumHeight ?? entry.height,
                    allowTextAsPicsumSeed: true,
                },
            );

            const thumbnailUrl = resolveImageUrlFromInput(
                entry.thumbnailUrl ?? entry.thumbnail ?? imageUrl,
                {
                    picsumSeed:
                        entry.thumbnailSeed ??
                        entry.picsumSeed ??
                        entry.seed ??
                        entry.title ??
                        `gallery-thumb-${index + 1}`,
                    picsumWidth: entry.thumbnailWidth ?? entry.width ?? 512,
                    picsumHeight: entry.thumbnailHeight ?? entry.height ?? 512,
                    allowTextAsPicsumSeed: true,
                },
            );

            return {
                img: imageUrl,
                thumbnail: thumbnailUrl,
                title: optionalString(entry.title) || '',
                linktitle: optionalString(entry.linktitle ?? entry.titleUrl) || '',
                author: optionalString(entry.author) || '',
                linkauthor: optionalString(entry.linkauthor ?? entry.authorUrl) || '',
                license: this.normalizeGalleryLicense(
                    entry.license ?? entry.licenseCode ?? '',
                ),
            };
        });
    }

    normalizeGalleryLicense(value) {
        const raw = optionalString(value);
        if (!raw) return '';
        const normalized = raw.toLowerCase();
        const map = {
            'public domain': 'pd',
            pd: 'pd',
            'gnu/gpl': 'gnu-gpl',
            'gnu-gpl': 'gnu-gpl',
            gpl: 'gnu-gpl',
            cc0: 'CC0',
            'creative commons by': 'CC-BY',
            'cc-by': 'CC-BY',
            'creative commons by-sa': 'CC-BY-SA',
            'cc-by-sa': 'CC-BY-SA',
            'creative commons by-nd': 'CC-BY-ND',
            'cc-by-nd': 'CC-BY-ND',
            'creative commons by-nc': 'CC-BY-NC',
            'cc-by-nc': 'CC-BY-NC',
            'creative commons by-nc-sa': 'CC-BY-NC-SA',
            'cc-by-nc-sa': 'CC-BY-NC-SA',
            'creative commons by-nc-nd': 'CC-BY-NC-ND',
            'cc-by-nc-nd': 'CC-BY-NC-ND',
            copyright: 'copyright',
        };
        return map[normalized] || raw;
    }

    async addFormIdevice(args) {
        const bridge = this.getBridge();
        this.ensureProjectMetadata({
            title: args.projectTitle,
            author: args.projectAuthor,
            description: args.projectDescription,
        });

        const { pageId, blockId, blockName, iconName } =
            this.prepareIdeviceTarget(args);
        const formData = this.buildFormJsonProperties(args);
        const initialData = this.buildComponentInitialData({
            title: optionalString(args.title) || blockName,
            htmlContent: '',
            htmlView: '',
            jsonProperties: formData,
            order: args.order,
        });

        const componentId = bridge.addComponent(pageId, blockId, 'form', initialData);
        await this.refreshStructure(pageId);

        return {
            pageId,
            blockId,
            blockName,
            iconName,
            componentId,
            questionsCount: formData.questionsData.length,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    buildFormJsonProperties(args = {}) {
        const questionsData = this.normalizeFormQuestions(args.questions);
        const evaluation = optionalBoolean(args.evaluation, false);
        const evaluationID = optionalString(args.evaluationID) || '';
        if (evaluation && evaluationID.length < 5) {
            throw new Error('evaluationID must have at least 5 characters when evaluation=true');
        }

        const percentageQuestions = clampNumber(
            optionalNumber(args.percentageQuestions),
            1,
            100,
            100,
        );
        const passRate = clampNumber(
            optionalNumber(args.passRate),
            5,
            100,
            50,
        );
        const addBtnAnswers = optionalBoolean(args.addBtnAnswers, true);
        const isScorm = this.normalizeAzQuizScormMode(args.isScorm);
        const weighted = clampNumber(
            optionalNumber(args.weighted),
            1,
            100,
            100,
        );

        return {
            ideviceId: optionalString(args.ideviceId) || '',
            id: optionalString(args.id) || '',
            evaluation,
            evaluationID,
            repeatActivity: optionalBoolean(args.repeatActivity, true),
            isScorm,
            textButtonScorm: optionalString(args.textButtonScorm) || 'Save score',
            weighted,
            msgs: parseJsonObject(args.msgs ?? args.messages ?? {}),
            questionsRandom: optionalBoolean(args.questionsRandom, false),
            percentageQuestions,
            time: clampNumber(optionalNumber(args.time), 0, 3600, 0),
            eXeFormInstructions: optionalString(args.instructions) || '',
            questionsData,
            passRate,
            dropdownPassRate: String(passRate),
            addBtnAnswers,
            checkAddBtnAnswers: addBtnAnswers,
            eXeIdeviceTextAfter: optionalString(args.textAfter) || '',
            showSlider: optionalBoolean(args.showSlider, false),
        };
    }

    normalizeFormQuestions(value) {
        const questions = parseArrayValue(value, 'questions');
        if (questions.length === 0) {
            throw new Error('questions must contain at least one question');
        }

        return questions.map((question, index) =>
            this.normalizeSingleFormQuestion(question, index),
        );
    }

    normalizeSingleFormQuestion(question, index) {
        if (!question || typeof question !== 'object' || Array.isArray(question)) {
            throw new Error(`questions[${index}] must be an object`);
        }

        const activityTypeRaw =
            optionalString(question.activityType ?? question.type)?.toLowerCase() ||
            'selection';
        const activityType = this.normalizeFormActivityType(activityTypeRaw);
        const baseText = normalizeQuestionHtml(
            question.baseText ?? question.question ?? question.prompt ?? '',
            `questions[${index}]`,
        );
        const common = {
            id: optionalString(question.id) || generateOdeId(),
            activityType,
            baseText,
            feedbackRight: optionalString(question.feedbackRight) || '',
            feedbackWrong: optionalString(question.feedbackWrong) || '',
            suggestion: optionalString(question.suggestion) || '',
            customScore: optionalNumber(question.customScore) || 1,
            time: optionalNumber(question.time) || 0,
        };

        if (activityType === 'selection') {
            const selection = this.normalizeFormSelectionAnswers(question, index);
            return {
                ...common,
                selectionType: selection.selectionType,
                answers: selection.answers,
            };
        }

        if (activityType === 'true-false') {
            return {
                ...common,
                answer: this.normalizeTrueFalseAnswer(
                    question.answer ?? question.correct,
                    `questions[${index}].answer`,
                ),
            };
        }

        if (activityType === 'dropdown') {
            return {
                ...common,
                wrongAnswersValue: this.normalizeWrongAnswersValue(question),
            };
        }

        return {
            ...common,
            capitalization: optionalBoolean(question.capitalization, false),
            strict: optionalBoolean(question.strict, false),
        };
    }

    normalizeWrongAnswersValue(question) {
        const wrongAnswers = question.wrongAnswers;
        if (Array.isArray(wrongAnswers)) {
            return wrongAnswers
                .map((item) => optionalString(item) || '')
                .filter(Boolean)
                .join('|');
        }
        return optionalString(question.wrongAnswersValue) || '';
    }

    normalizeFormSelectionAnswers(question, index) {
        const answersInput = parseArrayValue(
            question.answers,
            `questions[${index}].answers`,
        );
        if (answersInput.length < 2) {
            throw new Error(`questions[${index}].answers must contain at least two options`);
        }

        let derivedCorrectCount = 0;
        const normalizedAnswers = answersInput.map((answer, answerIndex) => {
            if (Array.isArray(answer) && answer.length >= 2) {
                const isCorrect = optionalBoolean(answer[0], false);
                if (isCorrect) derivedCorrectCount++;
                return [isCorrect, requireString(answer[1], `questions[${index}].answers[${answerIndex}]`)];
            }

            if (answer && typeof answer === 'object') {
                const text = requireString(
                    answer.text ?? answer.label,
                    `questions[${index}].answers[${answerIndex}].text`,
                );
                const isCorrect = optionalBoolean(answer.correct, false);
                if (isCorrect) derivedCorrectCount++;
                return [isCorrect, text];
            }

            const text = requireString(
                answer,
                `questions[${index}].answers[${answerIndex}]`,
            );
            return [false, text];
        });

        if (derivedCorrectCount === 0) {
            const correctIndex = optionalNumber(question.correctIndex);
            const correctIndices = parseOptionalNumberArray(question.correctIndices);
            if (Number.isInteger(correctIndex)) {
                if (correctIndex >= 0 && correctIndex < normalizedAnswers.length) {
                    normalizedAnswers[correctIndex][0] = true;
                    derivedCorrectCount = 1;
                }
            } else if (correctIndices.length > 0) {
                correctIndices.forEach((idx) => {
                    if (idx >= 0 && idx < normalizedAnswers.length) {
                        normalizedAnswers[idx][0] = true;
                    }
                });
                derivedCorrectCount = normalizedAnswers.filter((ans) => ans[0]).length;
            } else {
                normalizedAnswers[0][0] = true;
                derivedCorrectCount = 1;
            }
        }

        const selectionTypeRaw =
            optionalString(question.selectionType)?.toLowerCase() || '';
        const selectionType =
            selectionTypeRaw === 'multiple'
                ? 'multiple'
                : selectionTypeRaw === 'single'
                    ? 'single'
                    : derivedCorrectCount > 1
                        ? 'multiple'
                        : 'single';

        return {
            selectionType,
            answers: normalizedAnswers,
        };
    }

    normalizeFormActivityType(value) {
        const normalized = String(value || '').toLowerCase();
        if (normalized === 'selection' || normalized === 'single' || normalized === 'multiple') {
            return 'selection';
        }
        if (normalized === 'true-false' || normalized === 'truefalse' || normalized === 'boolean') {
            return 'true-false';
        }
        if (normalized === 'dropdown' || normalized === 'select') {
            return 'dropdown';
        }
        if (normalized === 'fill' || normalized === 'fill-in' || normalized === 'fill-in-the-blank') {
            return 'fill';
        }
        throw new Error('question activityType must be selection, true-false, dropdown or fill');
    }

    normalizeTrueFalseAnswer(value, fieldName) {
        const numeric = optionalNumber(value);
        if (numeric !== null) {
            return numeric === 1 ? 1 : 0;
        }
        const normalized = optionalString(value)?.toLowerCase() || '';
        if (normalized === 'true' || normalized === 'verdadero' || normalized === 'v') return 1;
        if (normalized === 'false' || normalized === 'falso' || normalized === 'f') return 0;
        throw new Error(`${fieldName} must be true/false or 1/0`);
    }

    buildAzQuizGameData(args = {}) {
        const wordsGame = this.normalizeAzQuizEntries(args.entries);
        const letters = wordsGame.map((item) => item.letter).join('');
        const durationGame = clampNumber(
            optionalNumber(args.durationGame),
            5,
            9999,
            240,
        );
        const numberTurns = clampNumber(
            optionalNumber(args.numberTurns),
            0,
            2,
            1,
        );
        const timeShowSolution = clampNumber(
            optionalNumber(args.timeShowSolution),
            1,
            9,
            3,
        );
        const weighted = clampNumber(
            optionalNumber(args.weighted),
            1,
            100,
            100,
        );
        const evaluation = optionalBoolean(args.evaluation, false);
        const evaluationID = optionalString(args.evaluationID) || '';
        if (evaluation && evaluationID.length < 5) {
            throw new Error('evaluationID must have at least 5 characters when evaluation=true');
        }

        const itinerary = this.normalizeAzQuizItinerary(args.itinerary, args);
        const showCodeAccess = itinerary.showCodeAccess === true;
        if (showCodeAccess && itinerary.codeAccess.length === 0) {
            throw new Error('itinerary.codeAccess is required when showCodeAccess=true');
        }
        if (showCodeAccess && itinerary.messageCodeAccess.length === 0) {
            throw new Error('itinerary.messageCodeAccess is required when showCodeAccess=true');
        }
        const showClue = itinerary.showClue === true;
        if (showClue && itinerary.clueGame.length === 0) {
            throw new Error('itinerary.clueGame is required when showClue=true');
        }

        const isScorm = this.normalizeAzQuizScormMode(args.isScorm);
        const textButtonScorm =
            optionalString(args.textButtonScorm) || 'Save score';
        const messages = this.normalizeAzQuizMessages(args.msgs ?? args.messages);

        return {
            typeGame: 'Rosco',
            instructions:
                optionalString(args.instructions) || buildAzQuizDefaultInstructions(),
            timeShowSolution,
            durationGame,
            numberTurns,
            showSolution: optionalBoolean(args.showSolution, true),
            showMinimize: optionalBoolean(args.showMinimize, false),
            itinerary,
            wordsGame,
            isScorm,
            textButtonScorm,
            repeatActivity: optionalBoolean(args.repeatActivity, true),
            weighted,
            letters,
            textAfter: encodeLegacyText(optionalString(args.textAfter) || ''),
            caseSensitive: optionalBoolean(args.caseSensitive, false),
            version: 2,
            modeBoard: optionalBoolean(args.modeBoard, false),
            evaluation,
            evaluationID,
            id: optionalString(args.id) || '',
            msgs: messages,
        };
    }

    buildAzQuizGameHtml(dataGame, textAfter = '') {
        const instructions = optionalString(dataGame.instructions) || '';
        const serializedData = escapeHtml(JSON.stringify(dataGame));
        const linksImages = this.buildAzQuizMediaLinks(dataGame.wordsGame, 'url');
        const linksAudios = this.buildAzQuizMediaLinks(dataGame.wordsGame, 'audio');
        const encodedEvaluationId = escapeHtml(dataGame.evaluationID || '');
        const encodedIdeviceId = escapeHtml(dataGame.id || '');
        const browserMessage = escapeHtml(
            optionalString(dataGame.msgs?.msgNoSuportBrowser) ||
                buildAzQuizDefaultNotSupportedBrowserMessage(),
        );

        let html = '<div class="rosco-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${encodedIdeviceId}" data-evaluationb="${dataGame.evaluation ? 'true' : 'false'}" data-evaluationid="${encodedEvaluationId}"></div>`;
        if (instructions.length > 0) {
            html += `<div class="rosco-instructions">${instructions}</div>`;
        }
        html += `<div class="rosco-DataGame js-hidden">${serializedData}</div>`;
        html += linksImages;
        html += linksAudios;
        if (textAfter.length > 0) {
            html += `<div class="rosco-extra-content">${textAfter}</div>`;
        }
        html += `<div class="rosco-bns js-hidden">${browserMessage}</div>`;
        html += '</div>';
        return html;
    }

    buildAzQuizMediaLinks(wordsGame, field) {
        const className =
            field === 'audio' ? 'js-hidden rosco-LinkAudios' : 'js-hidden rosco-LinkImages';

        return wordsGame
            .map((word, index) => {
                const href = optionalString(word[field]) || '#';
                return `<a href="${escapeHtml(href)}" class="${className}">${index}</a>`;
            })
            .join('');
    }

    async addDataGameIdevice(args) {
        const bridge = this.getBridge();
        this.ensureProjectMetadata({
            title: args.projectTitle,
            author: args.projectAuthor,
            description: args.projectDescription,
        });

        const type = requireString(args.type, 'type');
        if (!isDataGameType(type)) {
            throw new Error(`type '${type}' is not a Pattern 2 DataGame iDevice`);
        }

        const state = args.state && typeof args.state === 'object' && !Array.isArray(args.state)
            ? args.state
            : {};

        const { pageId, blockId, blockName, iconName } = this.prepareIdeviceTarget(args);

        const html = buildDataGameHtml(type, state, {
            instructions: optionalString(args.instructions) || '',
            textAfter: optionalString(args.textAfter) || '',
        });

        const initialData = this.buildComponentInitialData({
            title: optionalString(args.title) || blockName,
            htmlContent: html,
            jsonProperties: {},
            order: args.order,
        });

        const componentId = bridge.addComponent(pageId, blockId, type, initialData);
        await this.refreshStructure(pageId);

        return {
            pageId,
            blockId,
            blockName,
            iconName,
            componentId,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    normalizeAzQuizEntries(value) {
        const entries = parseArrayValue(value, 'entries');
        if (entries.length === 0) {
            throw new Error('entries must contain at least one word/definition pair');
        }

        const seenLetters = new Set();
        return entries.map((rawEntry, index) => {
            if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
                throw new Error(`entries[${index}] must be an object`);
            }

            const word = requireString(rawEntry.word, `entries[${index}].word`);
            const definition = optionalString(rawEntry.definition) || '';
            const url =
                optionalString(rawEntry.url) ||
                optionalString(rawEntry.imageUrl) ||
                '';
            if (!definition && !url) {
                throw new Error(
                    `entries[${index}] must include definition or imageUrl/url`,
                );
            }

            const requestedLetter =
                optionalString(rawEntry.letter) || this.deriveAzQuizLetterFromWord(word);
            const letter = this.normalizeAzQuizLetter(
                requestedLetter,
                `entries[${index}].letter`,
            );
            if (seenLetters.has(letter)) {
                throw new Error(`entries contains duplicate letter "${letter}"`);
            }
            seenLetters.add(letter);

            return {
                letter,
                word,
                definition,
                type: this.normalizeAzQuizEntryType(rawEntry.mode ?? rawEntry.type),
                alt:
                    optionalString(rawEntry.alt) ||
                    optionalString(rawEntry.imageAlt) ||
                    '',
                author:
                    optionalString(rawEntry.author) ||
                    optionalString(rawEntry.imageAuthor) ||
                    '',
                url,
                audio:
                    optionalString(rawEntry.audio) ||
                    optionalString(rawEntry.audioUrl) ||
                    '',
                x: optionalNumber(rawEntry.x) || 0,
                y: optionalNumber(rawEntry.y) || 0,
            };
        });
    }

    normalizeAzQuizItinerary(rawItinerary, args = {}) {
        const itineraryFromArgs = parseJsonObject(rawItinerary || {});
        const fallback = {
            showClue: optionalBoolean(args.showClue, false),
            clueGame: optionalString(args.clueGame) || '',
            percentageClue: clampNumber(
                optionalNumber(args.percentageClue),
                10,
                100,
                40,
            ),
            showCodeAccess: optionalBoolean(args.showCodeAccess, false),
            codeAccess: optionalString(args.codeAccess) || '',
            messageCodeAccess: optionalString(args.messageCodeAccess) || '',
        };

        return {
            showClue: optionalBoolean(
                itineraryFromArgs.showClue,
                fallback.showClue,
            ),
            clueGame: optionalString(itineraryFromArgs.clueGame) || fallback.clueGame,
            percentageClue: clampNumber(
                optionalNumber(itineraryFromArgs.percentageClue),
                10,
                100,
                fallback.percentageClue,
            ),
            showCodeAccess: optionalBoolean(
                itineraryFromArgs.showCodeAccess,
                fallback.showCodeAccess,
            ),
            codeAccess:
                optionalString(itineraryFromArgs.codeAccess) || fallback.codeAccess,
            messageCodeAccess:
                optionalString(itineraryFromArgs.messageCodeAccess) ||
                fallback.messageCodeAccess,
        };
    }

    normalizeAzQuizMessages(value) {
        const input = parseJsonObject(value || {});
        return {
            ...buildAzQuizDefaultMessages(),
            ...input,
        };
    }

    normalizeAzQuizScormMode(value) {
        const numeric = optionalNumber(value);
        if (numeric !== null) {
            if (numeric <= 0) return 0;
            if (numeric === 1) return 1;
            return 2;
        }
        return optionalBoolean(value, false) ? 1 : 0;
    }

    normalizeAzQuizEntryType(value) {
        const numeric = optionalNumber(value);
        if (numeric !== null) {
            return numeric === 1 ? 1 : 0;
        }

        const normalized = optionalString(value)?.toLowerCase() || '';
        if (
            normalized === 'contains' ||
            normalized === 'contain' ||
            normalized === 'contiene'
        ) {
            return 1;
        }
        return 0;
    }

    deriveAzQuizLetterFromWord(word) {
        const normalizedWord = requireString(word, 'word')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();

        if (!normalizedWord) {
            return '';
        }

        return normalizedWord.charAt(0).toUpperCase();
    }

    normalizeAzQuizLetter(value, fieldName = 'letter') {
        const raw = requireString(value, fieldName).toUpperCase();
        if (raw === 'L·L') return '0';
        if (raw === 'SS') return '1';
        if (raw.length !== 1) {
            throw new Error(`${fieldName} must be a single letter, "L·L" or "SS"`);
        }
        return raw;
    }

    async setComponentHtml(args) {
        const binding = this.getStructureBinding();
        const componentId = requireString(args.componentId, 'componentId');
        const html = requireString(args.html, 'html');

        const component = binding.getComponent(componentId);
        if (!component) {
            throw new Error(`Component not found: ${componentId}`);
        }

        if (isTextIdeviceComponent(component)) {
            await this.updateTextIdeviceContent(componentId, html, component);
        } else {
            binding.updateComponent(componentId, { htmlContent: html });
            await this.refreshStructure(this.getSelectedPageId());
        }

        return {
            componentId,
            component: binding.getComponent(componentId),
        };
    }

    async setTextIdeviceRichHtml(args) {
        const componentId = requireString(args.componentId, 'componentId');
        const html = requireString(args.html, 'html');

        await this.updateTextIdeviceContent(componentId, html);
        return {
            componentId,
            htmlLength: html.length,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    async appendTextIdeviceRichHtml(args) {
        const componentId = requireString(args.componentId, 'componentId');
        const fragment = requireString(args.html, 'html');
        const position = normalizeInsertPosition(args.position);

        const component = this.requireTextIdeviceComponent(componentId);
        const currentHtml =
            typeof component.htmlContent === 'string' ? component.htmlContent : '';
        const nextHtml = mergeHtmlContent(currentHtml, fragment, position);

        await this.updateTextIdeviceContent(componentId, nextHtml, component);

        return {
            componentId,
            position,
            appendedLength: fragment.length,
            htmlLength: nextHtml.length,
            component: this.getStructureBinding().getComponent(componentId),
        };
    }

    async updateTextIdeviceContent(componentId, html, existingComponent = null) {
        const binding = this.getStructureBinding();
        const component = existingComponent || this.requireTextIdeviceComponent(componentId);
        const jsonProperties = this.buildTextIdeviceJsonProperties(
            html,
            component?.jsonProperties,
        );

        binding.updateComponent(componentId, {
            htmlContent: html,
            htmlView: html,
            jsonProperties: JSON.stringify(jsonProperties),
        });

        await this.refreshStructure(this.getSelectedPageId());
    }

    async insertTextIdeviceImageFromBase64(args) {
        const componentId = requireString(args.componentId, 'componentId');
        this.requireTextIdeviceComponent(componentId);

        const filename =
            optionalString(args.filename) ||
            `ai-image-${Date.now()}.png`;
        const base64 = requireString(args.base64, 'base64');
        const mimeType = optionalString(args.mimeType) || detectMimeType(filename);
        const folderPath = optionalString(args.folderPath) || '';

        const bytes = base64ToUint8Array(base64);
        const file = createFileFromBytes(bytes, filename, mimeType);
        const assetData = await this.insertAssetFromFile(file, folderPath);
        const imageHtml = this.buildTextImageHtml({
            assetUrl: assetData.assetUrl,
            alt: optionalString(args.alt),
            caption: optionalString(args.caption),
            width: optionalString(args.width),
            align: optionalString(args.align),
        });

        const update = await this.appendTextIdeviceRichHtml({
            componentId,
            html: imageHtml,
            position: args.position,
        });

        return {
            componentId,
            asset: assetData,
            insertedHtml: imageHtml,
            update,
        };
    }

    async insertTextIdeviceImageFromUrl(args) {
        const componentId = requireString(args.componentId, 'componentId');
        this.requireTextIdeviceComponent(componentId);

        const imageUrl = resolveImageUrlFromInput(args.imageUrl, {
            picsumSeed: args.picsumSeed,
            picsumWidth: args.picsumWidth,
            picsumHeight: args.picsumHeight,
            allowTextAsPicsumSeed: true,
        });
        const folderPath = optionalString(args.folderPath) || '';
        const allowExternalFallback = optionalBoolean(args.allowExternalFallback, true);

        try {
            const response = await fetch(imageUrl, {
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                mode: 'cors',
                redirect: 'follow',
            });

            if (!response.ok) {
                throw new Error(
                    `Could not fetch image URL (${response.status} ${response.statusText})`
                );
            }

            const blob = await response.blob();
            if (!blob || blob.size <= 0) {
                throw new Error('Downloaded image is empty');
            }

            const filename =
                optionalString(args.filename) ||
                filenameFromImageUrl(imageUrl, blob.type);
            const mimeType =
                optionalString(args.mimeType) || blob.type || detectMimeType(filename);
            const file = createFileFromBlob(blob, filename, mimeType);
            const assetData = await this.insertAssetFromFile(file, folderPath);
            const imageHtml = this.buildTextImageHtml({
                assetUrl: assetData.assetUrl,
                alt: optionalString(args.alt),
                caption: optionalString(args.caption),
                width: optionalString(args.width),
                align: optionalString(args.align),
            });

            const update = await this.appendTextIdeviceRichHtml({
                componentId,
                html: imageHtml,
                position: args.position,
            });

            return {
                componentId,
                imageUrl,
                mode: 'asset',
                asset: assetData,
                insertedHtml: imageHtml,
                update,
            };
        } catch (error) {
            if (!allowExternalFallback) {
                throw error;
            }

            const imageHtml = this.buildTextExternalImageHtml({
                imageUrl,
                alt: optionalString(args.alt),
                caption: optionalString(args.caption),
                width: optionalString(args.width),
                align: optionalString(args.align),
            });

            const update = await this.appendTextIdeviceRichHtml({
                componentId,
                html: imageHtml,
                position: args.position,
            });

            return {
                componentId,
                imageUrl,
                mode: 'external_url',
                warning:
                    'Image could not be uploaded to the file manager; inserted as external URL in text content.',
                insertError: String(error?.message || error || 'Unknown error'),
                insertedHtml: imageHtml,
                update,
            };
        }
    }

    async deleteComponent(args) {
        const bridge = this.getBridge();
        const componentId = requireString(args.componentId, 'componentId');
        const deleted = bridge.deleteComponent(componentId);

        await this.refreshStructure(this.getSelectedPageId());
        return { componentId, deleted };
    }

    async uploadAssetFromBase64(args) {
        const bridge = this.getBridge();
        const filename = requireString(args.filename, 'filename');
        const base64 = requireString(args.base64, 'base64');
        const mimeType = optionalString(args.mimeType) || 'application/octet-stream';
        const folderPath = optionalString(args.folderPath) || '';

        if (!bridge.assetManager) {
            throw new Error('AssetManager is not available');
        }

        const bytes = base64ToUint8Array(base64);
        let file;

        if (typeof File !== 'undefined') {
            file = new File([bytes], filename, { type: mimeType });
        } else {
            file = new Blob([bytes], { type: mimeType });
            file.name = filename;
        }

        const assetUrl = await bridge.assetManager.insertImage(file, {
            folderPath,
        });

        return {
            filename,
            folderPath,
            assetUrl,
            assetId: bridge.assetManager.extractAssetId(assetUrl),
        };
    }

    async uploadAssetFromDataUrl(args) {
        const filename = requireString(args.filename, 'filename');
        const dataUrl = requireDataUrl(args.dataUrl);
        const folderPath = optionalString(args.folderPath) || '';
        const mimeType = detectDataUrlMimeType(dataUrl) || detectMimeType(filename);
        const bytes = base64ToUint8Array(dataUrl);
        const file = createFileFromBytes(bytes, filename, mimeType);

        return this.insertAssetFromFile(file, folderPath);
    }

    async importAssetFromUrl(args) {
        const imageUrl = resolveImageUrlFromInput(args.imageUrl, {
            picsumSeed: args.picsumSeed,
            picsumWidth: args.picsumWidth,
            picsumHeight: args.picsumHeight,
            allowTextAsPicsumSeed: true,
        });
        const folderPath = optionalString(args.folderPath) || '';
        const response = await fetch(imageUrl, {
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
            mode: 'cors',
            redirect: 'follow',
        });

        if (!response.ok) {
            throw new Error(
                `Could not fetch image URL (${response.status} ${response.statusText})`,
            );
        }

        const blob = await response.blob();
        if (!blob || blob.size <= 0) {
            throw new Error('Downloaded image is empty');
        }

        const filename =
            optionalString(args.filename) ||
            filenameFromImageUrl(imageUrl, blob.type);
        const mimeType =
            optionalString(args.mimeType) || blob.type || detectMimeType(filename);
        const file = createFileFromBlob(blob, filename, mimeType);
        const asset = await this.insertAssetFromFile(file, folderPath);

        return {
            imageUrl,
            ...asset,
        };
    }

    async listAssets(args = {}) {
        const bridge = this.getBridge();
        if (!bridge.assetManager) {
            throw new Error('AssetManager is not available');
        }

        const folderPath = optionalString(args.folderPath);
        const assets =
            folderPath === null
                ? await bridge.assetManager.getProjectAssets({ includeBlobs: false })
                : await bridge.assetManager.getAssetsInFolder(folderPath);

        const normalizedAssets = assets.map((asset) => ({
            id: asset.id,
            filename: asset.filename || '',
            folderPath: asset.folderPath || '',
            mime: asset.mime || '',
            size: asset.size || 0,
            uploaded: asset.uploaded === true,
            createdAt: asset.createdAt || '',
            assetUrl: this.getAssetUrlFromIdOrMetadata(asset.id, asset),
        }));

        const subfolders =
            folderPath === null
                ? await bridge.assetManager.getSubfolders('')
                : await bridge.assetManager.getSubfolders(folderPath);

        return {
            folderPath: folderPath || '',
            count: normalizedAssets.length,
            subfolders,
            assets: normalizedAssets,
        };
    }

    async insertTextIdeviceImageFromAsset(args) {
        const componentId = requireString(args.componentId, 'componentId');
        this.requireTextIdeviceComponent(componentId);

        const assetUrl = this.resolveAssetUrlFromArgs(args);
        const imageHtml = this.buildTextImageHtml({
            assetUrl,
            alt: optionalString(args.alt),
            caption: optionalString(args.caption),
            width: optionalString(args.width),
            align: optionalString(args.align),
        });

        const update = await this.appendTextIdeviceRichHtml({
            componentId,
            html: imageHtml,
            position: args.position,
        });

        return {
            componentId,
            assetUrl,
            insertedHtml: imageHtml,
            update,
        };
    }

    async insertAssetFromFile(file, folderPath = '') {
        const bridge = this.getBridge();
        if (!bridge.assetManager) {
            throw new Error('AssetManager is not available');
        }

        const assetUrl = await bridge.assetManager.insertImage(file, {
            folderPath,
        });

        return {
            filename: file.name,
            folderPath,
            assetUrl,
            assetId: bridge.assetManager.extractAssetId(assetUrl),
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
        };
    }

    async saveProject() {
        const bridge = this.getBridge();
        return bridge.save({ showProgress: false });
    }

    getBridge() {
        const bridge = this.app?.project?._yjsBridge;
        if (!bridge || !bridge.structureBinding) {
            throw new Error('Project is not ready yet');
        }
        return bridge;
    }

    getStructureBinding() {
        return this.getBridge().structureBinding;
    }

    getSelectedPageId() {
        const selectedNode =
            this.app?.project?.structure?.menuStructureBehaviour?.nodeSelected;
        if (!selectedNode || typeof selectedNode.getAttribute !== 'function') {
            return null;
        }
        return selectedNode.getAttribute('nav-id');
    }

    requirePageId(pageId) {
        const id = optionalString(pageId) || this.getSelectedPageId();
        if (!id) {
            throw new Error('pageId is required (or select a page in the editor)');
        }
        return id;
    }

    requireTextIdeviceComponent(componentId) {
        const component = this.getStructureBinding().getComponent(componentId);
        if (!component) {
            throw new Error(`Component not found: ${componentId}`);
        }

        if (!isTextIdeviceComponent(component)) {
            throw new Error(
                `Component ${componentId} is not a text iDevice (type: ${component.ideviceType || 'unknown'})`,
            );
        }

        return component;
    }

    // resolveWriteConfirmationPolicy is now in WebMCPPermissions module

    buildTextIdeviceJsonProperties(html, existingJson = null) {
        let properties = {};
        try {
            properties = parseJsonObject(existingJson);
        } catch {
            properties = {};
        }
        properties.textTextarea = html;
        return properties;
    }

    listIdeviceIcons() {
        const icons = this.getThemeIconsList();
        return {
            count: icons.length,
            icons,
        };
    }

    getThemeIconsList() {
        const themeIcons =
            this.app?.themes?.getThemeIcons?.() ||
            window.eXeLearning?.app?.themes?.getThemeIcons?.() ||
            {};
        const entries = Object.entries(themeIcons).map(([key, icon]) => ({
            key,
            id: normalizeMetadataValue(icon?.id || key),
            title: normalizeMetadataValue(icon?.title || key),
            value: normalizeMetadataValue(icon?.value || ''),
        }));

        return entries.sort((a, b) => a.key.localeCompare(b.key));
    }

    resolveOptionalIconName(iconName) {
        const requested = optionalString(iconName);
        if (!requested) {
            return null;
        }

        const icons = this.getThemeIconsList();
        const exactKey = icons.find((icon) => icon.key === requested);
        if (exactKey) {
            return exactKey.key;
        }

        const byId = icons.find((icon) => icon.id === requested);
        if (byId) {
            return byId.key;
        }

        throw new Error(
            `iconName "${requested}" is not available in the current theme. Use exe.idevices.icons.list to inspect valid icons.`,
        );
    }

    buildTextImageHtml(options = {}) {
        const assetUrl = requireString(options.assetUrl, 'assetUrl');
        const assetId = this.getBridge().assetManager.extractAssetId(assetUrl);
        const alt = escapeHtml(optionalString(options.alt) || '');
        const caption = optionalString(options.caption);
        const escapedCaption = caption ? escapeHtml(caption) : '';
        const width = normalizeCssSize(options.width);
        const alignClass = normalizeImageAlign(options.align);

        const figureClassAttr = alignClass ? ` class="${alignClass}"` : '';
        const widthAttr = width ? ` style="max-width:${width};"` : '';
        const captionHtml = escapedCaption
            ? `<figcaption>${escapedCaption}</figcaption>`
            : '';

        return `<figure${figureClassAttr}><img src="${assetUrl}" alt="${alt}" data-asset-id="${assetId}"${widthAttr}>${captionHtml}</figure>`;
    }

    buildTextExternalImageHtml(options = {}) {
        const imageUrl = requireHttpImageUrl(options.imageUrl);
        const alt = escapeHtml(optionalString(options.alt) || '');
        const caption = optionalString(options.caption);
        const escapedCaption = caption ? escapeHtml(caption) : '';
        const width = normalizeCssSize(options.width);
        const alignClass = normalizeImageAlign(options.align);

        const figureClassAttr = alignClass ? ` class="${alignClass}"` : '';
        const widthAttr = width ? ` style="max-width:${width};"` : '';
        const captionHtml = escapedCaption
            ? `<figcaption>${escapedCaption}</figcaption>`
            : '';

        return `<figure${figureClassAttr}><img src="${escapeHtml(imageUrl)}" alt="${alt}"${widthAttr}>${captionHtml}</figure>`;
    }

    resolveAssetUrlFromArgs(args = {}) {
        const directAssetUrl = optionalString(args.assetUrl);
        if (directAssetUrl) {
            if (!directAssetUrl.startsWith('asset://')) {
                throw new Error('assetUrl must start with asset://');
            }
            return directAssetUrl;
        }

        if (args.assetId !== undefined) {
            const assetId = requireAssetUuidUrl(args.assetId);
            return this.getAssetUrlFromIdOrMetadata(assetId);
        }

        throw new Error('Provide assetUrl or assetId');
    }

    getAssetUrlFromIdOrMetadata(assetId, metadata = null) {
        const bridge = this.getBridge();
        const manager = bridge.assetManager;
        if (!manager) {
            throw new Error('AssetManager is not available');
        }

        const id = requireString(assetId, 'assetId');
        const meta = metadata || manager.getAssetMetadata?.(id) || null;
        const filename = optionalString(meta?.filename) || '';

        if (typeof manager.getAssetUrl === 'function') {
            return manager.getAssetUrl(id, filename);
        }

        return filename ? `asset://${id}.${getFileExtension(filename)}` : `asset://${id}`;
    }

    async refreshStructure(pageId) {
        const selectedBefore = this.getSelectedPageId();
        const target = pageId || this.getSelectedPageId();
        if (
            this.app?.project?.structure &&
            typeof this.app.project.structure.resetStructureData === 'function'
        ) {
            await this.app.project.structure.resetStructureData(target);
        }

        // If the update happened in the currently selected page, force a content reload.
        // MenuStructureBehaviour.selectNode skips loadApiIdevicesInPage when selecting the same node.
        if (target && selectedBefore && target === selectedBefore) {
            await this.forceReloadPageContent(target);
        }
    }

    getNavElementByPageId(pageId) {
        if (!pageId) return null;
        const safeId = String(pageId).replace(/"/g, '\\"');

        const fromStructureMenu =
            this.app?.project?.structure?.menuStructureCompose?.menuNav?.querySelector?.(
                `.nav-element[nav-id="${safeId}"]`,
            );
        if (fromStructureMenu) {
            return fromStructureMenu;
        }

        return document.querySelector(`.nav-element[nav-id="${safeId}"]`);
    }

    async forceReloadPageContent(pageId) {
        const loadPage = this.app?.project?.idevices?.loadApiIdevicesInPage;
        if (typeof loadPage !== 'function') {
            return;
        }

        const navElement = this.getNavElementByPageId(pageId);
        if (!navElement) {
            return;
        }

        await loadPage.call(this.app.project.idevices, false, navElement);

        const checkIfEmptyNode =
            this.app?.menus?.menuStructure?.menuStructureBehaviour?.checkIfEmptyNode;
        if (typeof checkIfEmptyNode === 'function') {
            checkIfEmptyNode.call(this.app.menus.menuStructure.menuStructureBehaviour);
        }
    }
}
