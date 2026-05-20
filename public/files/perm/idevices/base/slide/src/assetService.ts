/**
 * Slide iDevice — image / asset integration.
 *
 * Wraps eXeLearning's modal file manager (`eXeLearning.app.modals.filemanager`)
 * so the user picks images through the same UI as the rest of the app, and
 * the resulting URL is an `asset://` reference rather than a raw blob/data URL.
 *
 * Falls back to a hidden `<input type=file>` + data URL when the modal
 * isn't available (e.g. standalone preview, dev harness).
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 */

export interface PickedImage {
    /** asset:// or data: URL stored in the slide payload (persistence-safe). */
    assetUrl: string;
    /** blob: or data: URL used to render the image during edition. */
    displayUrl: string;
    /** Optional human-friendly name for accessibility / debugging. */
    name: string;
}

interface ModalFileManager {
    show: (opts: {
        accept?: string;
        multiSelect?: boolean;
        onSelect: (result: { assetUrl: string; blobUrl?: string; asset?: { filename?: string } } | null) => void;
    }) => void;
}

interface AssetManagerLike {
    insertImage?: (file: File) => Promise<string | null>;
    blobURLCache?: Map<string, string>;
    extractAssetId?: (assetUrl: string) => string | null;
    resolveAssetURL?: (assetUrl: string) => Promise<string | null>;
}

interface ExeLearningGlobals {
    eXeLearning?: {
        app?: {
            modals?: { filemanager?: ModalFileManager };
            project?: { _yjsBridge?: { assetManager?: AssetManagerLike } };
        };
    };
}

function readGlobals(): ExeLearningGlobals {
    return globalThis as unknown as ExeLearningGlobals;
}

function getFileManager(): ModalFileManager | null {
    const globals = readGlobals();
    return globals.eXeLearning?.app?.modals?.filemanager ?? null;
}

function getAssetManager(): AssetManagerLike | null {
    const globals = readGlobals();
    return globals.eXeLearning?.app?.project?._yjsBridge?.assetManager ?? null;
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
        reader.readAsDataURL(file);
    });
}

export class SlideAssetService {
    private fallbackInput: HTMLInputElement | null = null;

    constructor(private host: HTMLElement) {}

    /**
     * Open the file manager (or fallback input) and resolve with the picked
     * image. Resolves with null when the user cancels.
     */
    async pickImage(): Promise<PickedImage | null> {
        const manager = getFileManager();
        if (manager) {
            return new Promise<PickedImage | null>(resolve => {
                let settled = false;
                const settle = (value: PickedImage | null): void => {
                    if (settled) return;
                    settled = true;
                    resolve(value);
                };
                try {
                    manager.show({
                        accept: 'image',
                        multiSelect: false,
                        onSelect: result => {
                            if (!result || !result.assetUrl) {
                                settle(null);
                                return;
                            }
                            settle({
                                assetUrl: result.assetUrl,
                                displayUrl: result.blobUrl || result.assetUrl,
                                name: result.asset?.filename ?? 'image',
                            });
                        },
                    });
                } catch {
                    settle(null);
                }
            });
        }
        return this.pickViaFallback();
    }

    /**
     * Resolve an `asset://` URL to a renderable blob/data URL using the
     * AssetManager's cache. Returns the original URL when the helper is not
     * available (e.g. in tests).
     */
    async resolveDisplayUrl(assetUrl: string): Promise<string> {
        if (!assetUrl) return '';
        if (!assetUrl.startsWith('asset://')) return assetUrl;
        const manager = getAssetManager();
        if (!manager || typeof manager.resolveAssetURL !== 'function') return assetUrl;
        try {
            const blob = await manager.resolveAssetURL(assetUrl);
            return typeof blob === 'string' && blob ? blob : assetUrl;
        } catch {
            return assetUrl;
        }
    }

    destroy(): void {
        if (this.fallbackInput && this.fallbackInput.parentNode) {
            this.fallbackInput.parentNode.removeChild(this.fallbackInput);
        }
        this.fallbackInput = null;
    }

    private ensureFallbackInput(): HTMLInputElement {
        if (this.fallbackInput) return this.fallbackInput;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.setAttribute('aria-hidden', 'true');
        this.host.appendChild(input);
        this.fallbackInput = input;
        return input;
    }

    private pickViaFallback(): Promise<PickedImage | null> {
        const input = this.ensureFallbackInput();
        return new Promise(resolve => {
            const onChange = async () => {
                input.removeEventListener('change', onChange);
                const file = input.files?.[0] ?? null;
                input.value = '';
                if (!file) {
                    resolve(null);
                    return;
                }

                const manager = getAssetManager();
                if (manager && typeof manager.insertImage === 'function') {
                    try {
                        const assetUrl = await manager.insertImage(file);
                        if (assetUrl) {
                            const id =
                                typeof manager.extractAssetId === 'function' ? manager.extractAssetId(assetUrl) : null;
                            const blob = id ? manager.blobURLCache?.get(id) : undefined;
                            resolve({ assetUrl, displayUrl: blob || assetUrl, name: file.name });
                            return;
                        }
                    } catch {
                        /* fall through to data url */
                    }
                }

                try {
                    const dataUrl = await readFileAsDataUrl(file);
                    resolve({ assetUrl: dataUrl, displayUrl: dataUrl, name: file.name });
                } catch {
                    resolve(null);
                }
            };
            input.addEventListener('change', onChange);
            input.click();
        });
    }
}
