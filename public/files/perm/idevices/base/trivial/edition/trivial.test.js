/**
 * Unit tests for TriviExt iDevice edition.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('TriviExt SCORM configuration', () => {
    const code = readFileSync(join(__dirname, 'trivial.js'), 'utf-8');

    it('hides the manual save button option in the SCORM tab', () => {
        expect(code).toContain('$exeDevicesEdition.iDevice.gamification.scorm.getTab(true)');
    });

    it('does not persist manual SCORM save mode', () => {
        expect(code).toContain('isScorm = scorm.isScorm === 2 ? 1 : scorm.isScorm');
        expect(code).toContain('isScorm: isScorm');
    });

    it('loads legacy manual SCORM mode as automatic mode', () => {
        expect(code).toContain('game.isScorm === 2 ? 1 : game.isScorm');
    });
});
