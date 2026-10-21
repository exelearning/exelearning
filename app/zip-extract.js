const fs = require('fs');
const path = require('path');

/**
 * Resolve a ZIP entry name to an absolute path inside destDir, or throw.
 * Backslashes are treated as separators on every platform so an entry such
 * as "..\\x" cannot escape on Windows. `p` is injectable to test win32 rules.
 */
function resolveZipEntryPath(destDir, entryName, p = path) {
    const name = String(entryName).replace(/\\/g, '/');
    const base = p.resolve(destDir);
    const target = p.resolve(base, name);
    const rel = p.relative(base, target);
    if (name.includes('\0') || !rel || rel === '..' || rel.startsWith(`..${p.sep}`) || p.isAbsolute(rel)) {
        throw new Error(`Unsafe ZIP entry: ${entryName}`);
    }
    return target;
}

/**
 * Write fflate unzipSync output into destDir. Every entry is validated before
 * anything is written, so a single unsafe entry aborts the whole extraction.
 */
function extractZipEntries(unzipped, destDir) {
    const entries = Object.entries(unzipped).map(([name, content]) => [
        resolveZipEntryPath(destDir, name),
        name.endsWith('/'),
        content,
    ]);
    for (const [fullPath, isDir, content] of entries) {
        if (isDir) {
            fs.mkdirSync(fullPath, { recursive: true });
        } else {
            fs.mkdirSync(path.dirname(fullPath), { recursive: true });
            fs.writeFileSync(fullPath, Buffer.from(content));
        }
    }
}

module.exports = { resolveZipEntryPath, extractZipEntries };
