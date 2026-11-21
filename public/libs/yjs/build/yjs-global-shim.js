/**
 * Yjs Global Shim
 * Re-exports window.Y for use in bundles that need to share the same Yjs instance.
 * This prevents duplicate Yjs imports which break constructor checks.
 */

// Get Yjs from global (loaded via yjs.min.js)
const Y = (typeof window !== 'undefined' && window.Y) ? window.Y : require('yjs');

// Re-export everything from Y. Named exports (Doc, Map, ...) come through as-is;
// do not reassign them: window.Y's are getter-only, so that throws in strict mode.
module.exports = Y;
module.exports.default = Y;
