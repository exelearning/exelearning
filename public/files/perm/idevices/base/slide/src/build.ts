/**
 * Build script for the Slide iDevice tldraw bundle.
 *
 * 1. Bundles src/index.ts → edition/slide-editor.bundle.js (IIFE)
 * 2. Copies node_modules/tldraw/tldraw.css → edition/tldraw.css
 *
 * The CSS is loaded at runtime via a <link> tag injected by the bundle
 * when mount() is called, using the idevice path passed from edition/slide.js.
 *
 * Run via: bun run src/build.ts  (or: make bundle-slide)
 */

import { copyFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const root = join(import.meta.dir, '..')

// Step 1: Bundle JS using Bun.build API (avoids shell arg parsing issues)
const result = await Bun.build({
    entrypoints: [join(root, 'src/index.ts')],
    outdir: join(root, 'edition'),
    naming: '[dir]/slide-editor.bundle.[ext]',
    format: 'iife',
    globalName: '__slideEditorInit',
    minify: true,
    target: 'browser',
})

if (!result.success) {
    for (const log of result.logs) {
        console.error(log)
    }
    process.exit(1)
}

// Bun may output a CSS file alongside the JS — find the JS output
for (const output of result.outputs) {
    if (output.path.endsWith('.css')) {
        // Remove CSS output; we handle CSS separately below
        try {
            const { unlinkSync } = await import('fs')
            unlinkSync(output.path)
        } catch {
            // ignore
        }
    }
}

// Step 2: Copy tldraw CSS alongside the bundle
const cssSrc  = join(root, 'node_modules/tldraw/tldraw.css')
const cssDest = join(root, 'edition/tldraw.css')
copyFileSync(cssSrc, cssDest)

// Report sizes
const jsBundlePath = join(root, 'edition/slide-editor.bundle.js')
const jsFile  = Bun.file(jsBundlePath)
const cssFile = Bun.file(cssDest)
const [jsSize, cssSize] = await Promise.all([jsFile.size, cssFile.size])
console.log(`✓ edition/slide-editor.bundle.js  ${(jsSize / 1024).toFixed(1)} KB`)
console.log(`✓ edition/tldraw.css              ${(cssSize / 1024).toFixed(1)} KB`)
