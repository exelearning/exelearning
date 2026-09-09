#!/usr/bin/env bun
/**
 * CLI entry point for the generated provider table.
 *
 *   bun scripts/generate-external-media-providers.ts            # check (CI)
 *   bun scripts/generate-external-media-providers.ts --write    # regenerate
 *
 * Deliberately thin: all the logic — and all the tests — live in
 * `scripts/external-media/generate-provider-table.ts`.
 */
import { join } from 'node:path';
import { RELAY_PATH, syncProviderTable } from './external-media/generate-provider-table';

const path = join(import.meta.dir, '..', RELAY_PATH);
const result = syncProviderTable(path, { write: process.argv.includes('--write') });

if (result.written) {
    console.log(`[external-media] regenerated the provider table in ${RELAY_PATH}`);
} else if (result.stale) {
    console.error(`[external-media] ${RELAY_PATH} provider table is stale.`);
    console.error('Run: bun scripts/generate-external-media-providers.ts --write');
    process.exit(1);
} else {
    console.log('[external-media] provider table is up to date');
}
