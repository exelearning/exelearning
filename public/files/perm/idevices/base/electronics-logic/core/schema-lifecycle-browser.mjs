import lifecycle from './schema-lifecycle.js';

if (typeof globalThis !== 'undefined') {
    globalThis.$electronicsLogicSchemaLifecycle = lifecycle;
}
