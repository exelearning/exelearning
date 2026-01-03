// Shim for y-indexeddb to use the globally loaded Yjs
// This allows y-indexeddb to work with window.Y loaded separately
export * from 'yjs-global';
export { default } from 'yjs-global';
