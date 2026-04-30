/**
 * Slide iDevice — tldraw editor.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning — https://exelearning.net
 * License: https://creativecommons.org/licenses/by-sa/4.0/
 */

import React, {
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from 'react'
import {
    AssetRecordType,
    createShapeId,
    createTLStore,
    defaultShapeUtils,
    Tldraw,
    type Editor as TldrawEditor,
    type TLAsset,
    type TLAssetStore,
    type TLShapeId,
    type TLStoreSnapshot,
    type TLRecord,
    type TLUiOverrides,
} from 'tldraw'

// ── eXeLearning ambient types ────────────────────────────────────────────────

interface ExeAssetManager {
    insertImage(file: File): Promise<string>
    resolveAssetURL(assetUrl: string): Promise<string>
    resolveAssetURLSync(assetUrl: string): string | null
}

interface ExeFileManagerResult {
    assetUrl: string
    blobUrl: string
    asset: { filename: string; mime: string }
}

interface ExeFileManager {
    show(opts: { accept?: string; onSelect(result: ExeFileManagerResult): void }): void
}

function getExeAssetManager(): ExeAssetManager | null {
    return (window as any).eXeLearning?.app?.project?._yjsBridge?.assetManager ?? null
}

function getExeFileManager(): ExeFileManager | null {
    return (window as any).eXeLearning?.app?.modals?.filemanager ?? null
}

// ── Asset store: integrates tldraw with eXeLearning's AssetManager ───────────

/**
 * Upload: stores the file in eXeLearning's AssetManager and returns an
 * `asset://` URL. All file insertions (drag-drop, paste, native file picker)
 * go through this path so images are always persisted as project assets.
 *
 * Resolve: converts `asset://` to a `blob:` URL that browsers can render.
 * Falls back to the raw src value for plain http/data URLs.
 */
function makeExeAssetStore(): TLAssetStore {
    return {
        async upload(_asset: TLAsset, file: File): Promise<string> {
            const am = getExeAssetManager()
            if (am) {
                return await am.insertImage(file)
            }
            // Offline fallback: data URL (not persistent but usable)
            return new Promise((resolve) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as string)
                reader.readAsDataURL(file)
            })
        },

        async resolve(asset: TLAsset): Promise<string | null> {
            const src = (asset as { props?: { src?: string } }).props?.src
            if (!src) return null
            if (!src.startsWith('asset://')) return src
            const am = getExeAssetManager()
            if (!am) return null
            try {
                return await am.resolveAssetURL(src)
            } catch {
                return null
            }
        },
    }
}

// ── Fullscreen button ─────────────────────────────────────────────────────────

const EnterFsIcon: React.FC = () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" />
    </svg>
)

const ExitFsIcon: React.FC = () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 1v4H1M9 5V1h4M9 13v-4h4M5 9v4H1" />
    </svg>
)

/**
 * Fullscreen toggle button rendered via InFrontOfTheCanvas.
 * Finds the closest .slide-editor-tldraw-host ancestor and toggles fullscreen on it.
 */
function FullscreenButton() {
    const btnRef = useRef<HTMLButtonElement>(null)
    const [isFullscreen, setIsFullscreen] = useState(false)

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', onFsChange)
        return () => document.removeEventListener('fullscreenchange', onFsChange)
    }, [])

    const toggle = useCallback(() => {
        if (document.fullscreenElement) {
            document.exitFullscreen()
        } else {
            const host = btnRef.current?.closest<HTMLElement>('.slide-editor-tldraw-host')
            host?.requestFullscreen?.()
        }
    }, [])

    return (
        <button
            ref={btnRef}
            type="button"
            className="slide-fullscreen-btn"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={toggle}
        >
            {isFullscreen ? <ExitFsIcon /> : <EnterFsIcon />}
        </button>
    )
}

// ── Component types ──────────────────────────────────────────────────────────

export interface EditorApi {
    getStoreSnapshot(): TLStoreSnapshot | null
    getSvgString(): string
}

export interface EditorProps {
    initialSnapshot?: TLStoreSnapshot | null
}

// ── UI overrides: replace native file picker with eXeLearning file manager ───

/**
 * Insert an image from the file-manager result into the tldraw editor.
 * Loads the blobUrl to detect natural dimensions, then creates a TLImageAsset
 * (with the persistent asset:// src) and a TLImageShape, and switches to the
 * select tool so the crop/advanced toolbar never appears.
 */
function insertImageFromFileManager(
    editor: TldrawEditor,
    { assetUrl, blobUrl, asset: meta }: ExeFileManagerResult,
): void {
    const doInsert = (w: number, h: number) => {
        const assetId = AssetRecordType.createId()
        editor.run(() => {
            editor.createAssets([{
                id: assetId,
                typeName: 'asset',
                type: 'image',
                props: {
                    name: meta.filename || 'image',
                    src: assetUrl,   // asset:// — resolved by assetStore.resolve at render time
                    w, h,
                    mimeType: meta.mime || 'image/jpeg',
                    isAnimated: false,
                },
                meta: {},
            }])
            const bounds = editor.getViewportPageBounds()
            const shapeId = createShapeId()
            editor.createShape({
                id: shapeId,
                type: 'image',
                x: bounds.midX - w / 2,
                y: bounds.midY - h / 2,
                props: { assetId, w, h },
            })
            editor.setSelectedShapes([shapeId])
            // Return to select tool so the asset-tool crop UI never activates
            editor.setCurrentTool('select')
        })
    }

    const img = new Image()
    img.onload = () => {
        const w = img.naturalWidth || 400
        const h = img.naturalHeight || 300
        img.onload = null; img.onerror = null; img.src = ''
        doInsert(w, h)
    }
    img.onerror = () => {
        img.onload = null; img.onerror = null; img.src = ''
        doInsert(400, 300)
    }
    img.src = blobUrl
}

/**
 * Replace the asset of an existing image shape with a new file from the
 * eXeLearning file manager. The shape keeps its current position and size;
 * only the underlying asset (src) is swapped out.
 */
function replaceImageFromFileManager(
    editor: TldrawEditor,
    shapeId: TLShapeId,
    { assetUrl, blobUrl, asset: meta }: ExeFileManagerResult,
): void {
    const doReplace = (w: number, h: number) => {
        const assetId = AssetRecordType.createId()
        editor.run(() => {
            editor.createAssets([{
                id: assetId,
                typeName: 'asset',
                type: 'image',
                props: {
                    name: meta.filename || 'image',
                    src: assetUrl,
                    w, h,
                    mimeType: meta.mime || 'image/jpeg',
                    isAnimated: false,
                },
                meta: {},
            }])
            editor.updateShape({ id: shapeId, type: 'image', props: { assetId } })
        })
    }

    const img = new Image()
    img.onload = () => {
        const w = img.naturalWidth || 400
        const h = img.naturalHeight || 300
        img.onload = null; img.onerror = null; img.src = ''
        doReplace(w, h)
    }
    img.onerror = () => {
        img.onload = null; img.onerror = null; img.src = ''
        doReplace(400, 300)
    }
    img.src = blobUrl
}

/**
 * Open the eXeLearning file manager and insert the selected image.
 * If the file manager is unavailable, call `fallback()` instead (native picker).
 */
function openFileManagerOrFallback(
    editor: TldrawEditor | null,
    fallback: () => void,
): void {
    const fm = getExeFileManager()
    if (!fm || !editor) { fallback(); return }
    fm.show({
        accept: 'image',
        onSelect: (result) => insertImageFromFileManager(editor, result),
    })
}

/**
 * Overrides for the tldraw UI:
 * - `tools.asset`   → toolbar button click opens the file manager
 * - `actions['insert-media']` → Cmd+U / menu item also opens the file manager
 *
 * Falls back to the original behaviour when the file manager is unavailable.
 */
function makeUiOverrides(editorRef: React.RefObject<TldrawEditor | null>): TLUiOverrides {
    return {
        actions(_editor, actions) {
            const originalInsertMedia = actions['insert-media']
            const originalImageReplace = actions['image-replace']
            return {
                ...actions,
                'insert-media': {
                    ...originalInsertMedia,
                    onSelect() {
                        openFileManagerOrFallback(
                            editorRef.current,
                            () => originalInsertMedia?.onSelect('toolbar'),
                        )
                    },
                },
                'image-replace': {
                    ...originalImageReplace,
                    onSelect(_source) {
                        const editor = editorRef.current
                        const fm = getExeFileManager()
                        if (!fm || !editor) {
                            originalImageReplace?.onSelect('image-toolbar')
                            return
                        }
                        const selected = editor.getSelectedShapes()
                        const imageShape = selected.find((s) => s.type === 'image')
                        if (!imageShape) return
                        const shapeId = imageShape.id as TLShapeId
                        fm.show({
                            accept: 'image',
                            onSelect: (result) => replaceImageFromFileManager(editor, shapeId, result),
                        })
                    },
                },
            }
        },

        tools(_editor, tools, { insertMedia }) {
            return {
                ...tools,
                asset: {
                    ...tools['asset'],
                    onSelect() {
                        // Do NOT call editor.setCurrentTool('asset') — that activates
                        // the crop/advanced UI. Instead go straight to the file manager.
                        openFileManagerOrFallback(editorRef.current, insertMedia)
                    },
                },
            }
        },
    }
}

// ── Editor component ─────────────────────────────────────────────────────────

const Editor = React.forwardRef<EditorApi, EditorProps>(function Editor(
    { initialSnapshot },
    ref,
) {
    const svgRef = useRef<string>('')
    const svgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const editorRef = useRef<TldrawEditor | null>(null)

    const initialSnapshotRef = useRef(initialSnapshot)
    initialSnapshotRef.current = initialSnapshot

    const assetStore = useMemo(() => makeExeAssetStore(), [])
    const uiOverrides = useMemo(() => makeUiOverrides(editorRef), [])

    const store = useMemo(
        () => createTLStore({ shapeUtils: defaultShapeUtils, assets: assetStore }),
        [assetStore],
    )

    useImperativeHandle(ref, () => ({
        getStoreSnapshot() {
            const editor = editorRef.current
            if (!editor) return null
            // We use store.getSnapshot('all') rather than the tldraw package's
            // getSnapshot(editor) because the latter calls editor.getSessionState()
            // which accesses instance_page_state records and can throw a reactive
            // '.ids' error if those records are in a transitional state.
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            return editor.store.getSnapshot('all')
        },
        getSvgString() {
            return svgRef.current
        },
    }))

    const handleMount = useCallback(
        (editor: TldrawEditor) => {
            editorRef.current = editor

            // Fix: Bootstrap's [role=button] { cursor: pointer } overrides tldraw's
            // SVG cursor presentation attribute on rotation/resize handles (SVG attrs
            // have specificity 0,0,0; Bootstrap wins). On pointerover we promote the
            // attribute to an inline style (specificity 1,0,0,0) so it always wins.
            const HANDLE_CLASSES = ['tl-rotate-corner', 'tl-resize-handle']
            const onHandlePointerOver = (e: PointerEvent) => {
                const el = e.target as Element | null
                if (!el?.classList) return
                if (HANDLE_CLASSES.some((c) => el.classList.contains(c))) {
                    const cur = el.getAttribute('cursor')
                    if (cur) (el as HTMLElement).style.cursor = cur
                }
            }
            const onHandlePointerOut = (e: PointerEvent) => {
                const el = e.target as Element | null
                if (!el?.classList) return
                if (HANDLE_CLASSES.some((c) => el.classList.contains(c))) {
                    ;(el as HTMLElement).style.cursor = ''
                }
            }
            const container = editor.getContainer()
            container.addEventListener('pointerover', onHandlePointerOver)
            container.addEventListener('pointerout', onHandlePointerOut)

            // SVG cache (debounced 500 ms)
            const unlistenSvg = editor.store.listen(
                () => {
                    if (svgTimerRef.current) clearTimeout(svgTimerRef.current)
                    svgTimerRef.current = setTimeout(async () => {
                        const shapeIds = [...editor.getCurrentPageShapeIds()]
                        if (!shapeIds.length) { svgRef.current = ''; return }
                        try {
                            const result = await editor.getSvgString(shapeIds, { scale: 1 })
                            svgRef.current = result?.svg ?? ''
                        } catch {
                            svgRef.current = ''
                        }
                    }, 500)
                },
                { scope: 'all', source: 'all' },
            )

            // Defer snapshot load to the next animation frame so tldraw finishes
            // its own reactive setup before we write to the store. Calling
            // store.mergeRemoteChanges synchronously inside onMount can trigger
            // reactive computations that access page state before tldraw has
            // finished initialising it.
            const frameId = requestAnimationFrame(() => {
                if (initialSnapshotRef.current) {
                    const records = Object.values(initialSnapshotRef.current.store) as TLRecord[]
                    if (records.length > 0) {
                        store.mergeRemoteChanges(() => { store.put(records) })
                    }
                }
                editor.updateInstanceState({ isGridMode: true })
                editor.zoomToFit({ animation: { duration: 0 } })
            })

            return () => {
                cancelAnimationFrame(frameId)
                editorRef.current = null
                unlistenSvg()
                if (svgTimerRef.current) clearTimeout(svgTimerRef.current)
                container.removeEventListener('pointerover', onHandlePointerOver)
                container.removeEventListener('pointerout', onHandlePointerOut)
            }
        },
        [store],
    )

    const isDebug = (window as any).__APP_DEBUG__ === '1' || (window as any).__APP_DEBUG__ === true

    return (
        <Tldraw
            store={store}
            onMount={handleMount}
            autoFocus
            options={{ maxPages: 1 }}
            components={{
                PageMenu: null,
                DebugPanel: isDebug ? undefined : null,
                InFrontOfTheCanvas: FullscreenButton,
            }}
            overrides={uiOverrides}
        />
    )
})

export default Editor
