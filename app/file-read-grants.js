// The renderer also runs author content: project previews are same-origin iframes that can reach
// window.parent.electronAPI. So app:readFile only reads the files the main process itself handed to
// the renderer (the Open dialog's choice and the files the OS asked us to open), never a path the
// renderer makes up.
const fs = require('fs');
const path = require('path');

function createFileReadGrants() {
    const granted = new Set();

    return {
        // Returns the path so call sites can grant it inline where they hand it over.
        grant(filePath) {
            if (typeof filePath === 'string' && filePath) granted.add(path.resolve(filePath));
            return filePath;
        },

        // Read file contents as base64 for upload (renderer builds a File)
        read(filePath) {
            try {
                if (!filePath) return { ok: false, error: 'No path' };
                if (!granted.has(path.resolve(filePath))) return { ok: false, error: 'Access denied' };
                const data = fs.readFileSync(filePath);
                const stat = fs.statSync(filePath);
                return { ok: true, base64: data.toString('base64'), mtimeMs: stat.mtimeMs };
            } catch (err) {
                return { ok: false, error: err.message };
            }
        },
    };
}

module.exports = { createFileReadGrants };
