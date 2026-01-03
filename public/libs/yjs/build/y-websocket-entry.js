/**
 * y-websocket Entry File
 * Bundles y-websocket's WebsocketProvider for browser usage.
 * Uses the globally loaded Yjs (window.Y) to avoid duplicate imports.
 */

// Import WebsocketProvider - it will use yjs from the alias we configure in esbuild
const { WebsocketProvider } = require('y-websocket');

// Export to window for browser usage
if (typeof window !== 'undefined') {
  window.WebsocketProvider = WebsocketProvider;
}
