/**
 * Unit tests for the pastecode TinyMCE plugin language list.
 *
 * The plugin defines the syntax-highlighting languages offered to the user
 * when wrapping a snippet of code with Prism. These tests guard the dropdown
 * entries so accidental removals during refactors are caught.
 */

/* eslint-disable no-undef */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGIN_PATH = join(__dirname, 'plugin.min.js');
const pluginSource = readFileSync(PLUGIN_PATH, 'utf-8');

function hasLanguageEntry(value) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`value:\\s*'${escaped}'`);
    return regex.test(pluginSource);
}

describe('pastecode plugin - syntax highlighting language list', () => {
    it('keeps the previously supported languages', () => {
        const previous = [
            'markup', 'aspnet', 'clike', 'c', 'cpp', 'css', 'java', 'js',
            'json', 'latex', 'pascal', 'perl', 'php', 'processing', 'python',
            'r', 'ruby', 'sql',
        ];
        for (const lang of previous) {
            expect(hasLanguageEntry(lang)).toBe(true);
        }
    });

    it('exposes Bash as a selectable language', () => {
        expect(hasLanguageEntry('bash')).toBe(true);
        expect(pluginSource).toContain("text: 'Bash'");
    });

    it('exposes PowerShell as a selectable language', () => {
        expect(hasLanguageEntry('powershell')).toBe(true);
        expect(pluginSource).toContain("text: 'PowerShell'");
    });

    it('exposes CMD (Batch) as a selectable language', () => {
        expect(hasLanguageEntry('batch')).toBe(true);
        expect(pluginSource).toContain("text: 'CMD (Batch)'");
    });

    it('exposes all other newly added languages', () => {
        const newLanguages = [
            { value: 'arduino', text: 'Arduino' },
            { value: 'csharp', text: 'C#' },
            { value: 'docker', text: 'Docker' },
            { value: 'git', text: 'Git' },
            { value: 'less', text: 'LESS' },
            { value: 'markdown', text: 'Markdown' },
            { value: 'markup-templating', text: 'Markup templating' },
            { value: 'mermaid', text: 'Mermaid' },
            { value: 'twig', text: 'Twig' },
            { value: 'typescript', text: 'TypeScript' },
        ];
        for (const { value, text } of newLanguages) {
            expect(hasLanguageEntry(value)).toBe(true);
            expect(pluginSource).toContain(`text: '${text}'`);
        }
    });

    it('places the new entries in the expected relative order', () => {
        // Bash sits in its alphabetical slot (B before C), so it appears before
        // the "C type" anchor. Batch and PowerShell are placed after clike.
        const cTypeIndex = pluginSource.indexOf("value: 'clike'");
        const bashIndex = pluginSource.indexOf("value: 'bash'");
        const batchIndex = pluginSource.indexOf("value: 'batch'");
        const powershellIndex = pluginSource.indexOf("value: 'powershell'");

        expect(cTypeIndex).toBeGreaterThan(-1);
        expect(bashIndex).toBeGreaterThan(-1);
        expect(batchIndex).toBeGreaterThan(cTypeIndex);
        expect(powershellIndex).toBeGreaterThan(batchIndex);
    });
});
