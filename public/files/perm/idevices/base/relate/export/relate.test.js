import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('relate iDevice export', () => {
    it('does not register its own unload or beforeunload SCORM handlers', () => {
        const code = readFileSync(join(__dirname, 'relate.js'), 'utf-8');

        expect(code).not.toMatch(/beforeunload|unload\.eXeRelaciona|endScorm/);
    });
});
