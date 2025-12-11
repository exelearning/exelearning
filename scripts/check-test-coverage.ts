// scripts/check-test-coverage.ts
import { readdir, exists } from 'fs/promises'
import { join, basename } from 'path'

const SRC_DIR = './src'
const IGNORE_PATTERNS = [
    /\.spec\.ts$/,
    /\.test\.ts$/,
    /index\.ts$/,
    /\.d\.ts$/,
    /types\.ts$/,
]

async function getFiles(dir: string): Promise<string[]> {
    const files: string[] = []
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) {
            files.push(...await getFiles(path))
        } else if (entry.name.endsWith('.ts')) {
            files.push(path)
        }
    }
    return files
}

async function main() {
    const files = await getFiles(SRC_DIR)
    const missing: string[] = []

    for (const file of files) {
        const shouldIgnore = IGNORE_PATTERNS.some(p => p.test(file))
        if (shouldIgnore) continue

        const specFile = file.replace(/\.ts$/, '.spec.ts')
        if (!await exists(specFile)) {
            missing.push(file)
        }
    }

    if (missing.length > 0) {
        console.error('Files without tests:')
        missing.forEach(f => console.error(`  - ${f}`))
        process.exit(1)
    }

    console.log('All files have tests')
}

main()