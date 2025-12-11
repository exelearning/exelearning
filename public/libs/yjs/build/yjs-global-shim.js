/**
 * Yjs Global Shim
 * Re-exports window.Y for use in bundles that need to share the same Yjs instance.
 * This prevents duplicate Yjs imports which break constructor checks.
 */

// Get Yjs from global (loaded via yjs.min.js)
const Y = (typeof window !== 'undefined' && window.Y) ? window.Y : require('yjs');

// Re-export everything from Y
module.exports = Y;
module.exports.default = Y;

// Also export named exports that @hocuspocus/provider might need
module.exports.Doc = Y.Doc;
module.exports.Array = Y.Array;
module.exports.Map = Y.Map;
module.exports.Text = Y.Text;
module.exports.XmlFragment = Y.XmlFragment;
module.exports.XmlElement = Y.XmlElement;
module.exports.XmlText = Y.XmlText;
module.exports.applyUpdate = Y.applyUpdate;
module.exports.encodeStateAsUpdate = Y.encodeStateAsUpdate;
module.exports.encodeStateVector = Y.encodeStateVector;
module.exports.createAbsolutePositionFromRelativePosition = Y.createAbsolutePositionFromRelativePosition;
module.exports.createRelativePositionFromTypeIndex = Y.createRelativePositionFromTypeIndex;
