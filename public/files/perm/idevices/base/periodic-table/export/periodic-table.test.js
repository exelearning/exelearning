/**
 * Unit tests for Periodic Table iDevice export/runtime.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Periodic Table score saving', () => {
    it('does not register unload or beforeunload window events', () => {
        const code = readFileSync(join(__dirname, 'periodic-table.js'), 'utf-8');

        expect(code).not.toMatch(/beforeunload/);
        expect(code).not.toMatch(/unload\.PeriodicTable/);
        expect(code).not.toMatch(/pagehide|unloadpage/);
    });
});
