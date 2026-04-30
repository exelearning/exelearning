/**
 * Slide iDevice — IIFE bridge for the tldraw editor bundle.
 *
 * Exposes window.__slideEditorInit.mount() which mounts the React editor
 * into any DOM container and returns a synchronous API for the eXeLearning
 * $exeDevice.save() contract.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning — https://exelearning.net
 * License: https://creativecommons.org/licenses/by-sa/4.0/
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import Editor, { type EditorApi } from './Editor'
import type { TLStoreSnapshot } from 'tldraw'

interface MountOptions {
    previousData?: unknown
    bundlePath?: string
}

interface SlideEditorMountResult {
    getStoreSnapshot(): TLStoreSnapshot | null
    getSvgString(): string
}

/**
 * Inject tldraw's CSS from the same directory as this bundle.
 * Called once on first mount; subsequent calls are no-ops.
 */
function ensureTldrawStyles(bundlePath: string): void {
    const CSS_ID = 'exe-slide-tldraw-css'
    if (document.getElementById(CSS_ID)) return
    const link = document.createElement('link')
    link.id = CSS_ID
    link.rel = 'stylesheet'
    link.href = bundlePath + 'tldraw.css'
    document.head.appendChild(link)
}

/**
 * Parse saved data and extract a tldraw store snapshot if available.
 * Version 2 data has { version: 2, store: TLStoreSnapshot, svg: string }.
 * Version 1 and legacy Fabric data produce null (start fresh).
 */
function parseInitialSnapshot(previousData: unknown): TLStoreSnapshot | null {
    if (!previousData) return null
    let parsed: unknown = previousData
    if (typeof previousData === 'string') {
        try {
            parsed = JSON.parse(previousData)
        } catch {
            return null
        }
    }
    if (!parsed || typeof parsed !== 'object') return null
    const data = parsed as Record<string, unknown>
    if (data.version === 2 && data.store) {
        return data.store as TLStoreSnapshot
    }
    // Version 1 (Fabric) or legacy: no tldraw data, start with empty canvas
    return null
}

window.__slideEditorInit = {
    mount(
        container: HTMLElement,
        opts: MountOptions,
    ): SlideEditorMountResult {
        const { previousData, bundlePath } = opts
        if (bundlePath) ensureTldrawStyles(bundlePath)
        const initialSnapshot = parseInitialSnapshot(previousData)
        const editorRef = React.createRef<EditorApi>()

        // The caller (slide.js) always passes a freshly created wrapper div, so
        // this element has never been passed to createRoot() before — no caching needed.
        const root = ReactDOM.createRoot(container)

        root.render(
            React.createElement(Editor, {
                ref: editorRef,
                initialSnapshot,
            }),
        )

        return {
            getStoreSnapshot() {
                return editorRef.current?.getStoreSnapshot() ?? null
            },
            getSvgString() {
                return editorRef.current?.getSvgString() ?? ''
            },
        }
    },
}

declare global {
    interface Window {
        __slideEditorInit: {
            mount(container: HTMLElement, opts: MountOptions): SlideEditorMountResult
        }
    }
}
