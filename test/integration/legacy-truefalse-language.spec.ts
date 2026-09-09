/**
 * Integration test for issue #2252
 *
 * A True/False iDevice coming from an eXeLearning 2.x package must keep its
 * default interface texts ("Verdadero", "Falso", "Sugerencia"…) in the language
 * declared by the package, instead of falling back to English.
 *
 * Uses real fixture: test/fixtures/more/verdaderofalso.elp (attached to issue #2252)
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import * as fs from 'fs-extra';
import * as path from 'path';
import { extractZip } from '../../src/services/zip';
import { createTempTestDir, cleanupTempTestDir } from '../helpers/fixture-loader';
import { LegacyXmlParser } from '../../src/shared/import/LegacyXmlParser';

const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'more', 'verdaderofalso.elp');

const silentLogger = { log: () => {}, warn: () => {}, error: () => {} };

describe('Legacy True/False iDevice language (issue #2252)', () => {
    let tempDir: string;
    let contentXml: string;

    beforeAll(async () => {
        tempDir = await createTempTestDir('legacy-truefalse-');
        await extractZip(FIXTURE_PATH, tempDir);
        contentXml = await fs.readFile(path.join(tempDir, 'contentv3.xml'), 'utf-8');
    });

    afterAll(async () => {
        await cleanupTempTestDir(tempDir);
    });

    it('should declare Spanish as the package language', () => {
        const result = new LegacyXmlParser(silentLogger).parse(contentXml);

        expect(result.meta.language).toBe('es');
    });

    it('should import the True/False messages in the package language', () => {
        const result = new LegacyXmlParser(silentLogger).parse(contentXml);

        const idevice = result.pages
            .flatMap(page => page.blocks.flatMap(block => block.idevices))
            .find(item => item.type === 'trueorfalse');

        expect(idevice).toBeDefined();

        const msgs = (idevice as { properties: { msgs: Record<string, string> } }).properties.msgs;
        expect(msgs.msgTrue).toBe('Verdadero');
        expect(msgs.msgFalse).toBe('Falso');
        expect(msgs.msgSuggestion).toBe('Sugerencia');
        expect(msgs.msgFeedback).toBe('Retroalimentación');
    });

    it('should keep the authored question content untouched', () => {
        const result = new LegacyXmlParser(silentLogger).parse(contentXml);

        const idevice = result.pages
            .flatMap(page => page.blocks.flatMap(block => block.idevices))
            .find(item => item.type === 'trueorfalse');

        const questions = (idevice as { properties: { questionsGame: { question: string; suggestion: string }[] } })
            .properties.questionsGame;

        expect(questions).toHaveLength(1);
        expect(questions[0].question).toContain('El protón es una partícula elemental.');
        expect(questions[0].suggestion).toContain('Revisa la información sobre el protón');
    });
});
