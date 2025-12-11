import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { XlfParseResult } from '../interfaces/translation.interface';

@Injectable()
export class XlfParserService {
    private readonly logger = new Logger(XlfParserService.name);
    private readonly parser: XMLParser;

    constructor() {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
        });
    }

    /**
     * Parse an XLIFF 1.2 file and extract translations
     * @param filePath Path to the XLF file
     * @returns Parsed translations with source and target languages
     */
    async parseXlfFile(filePath: string): Promise<XlfParseResult> {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return this.parseXlfContent(content);
        } catch (error) {
            this.logger.error(`Failed to parse XLF file ${filePath}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Parse XLIFF content string
     * @param content XLF file content as string
     * @returns Parsed translations
     */
    parseXlfContent(content: string): XlfParseResult {
        const parsed = this.parser.parse(content);
        const xliff = parsed.xliff;
        const file = xliff.file;
        const body = file.body;

        const sourceLanguage = file['@_source-language'] || 'en';
        const targetLanguage = file['@_target-language'] || sourceLanguage;

        const translations = new Map<string, string>();

        // Handle both single trans-unit and array of trans-units
        let transUnits = body['trans-unit'];
        if (!Array.isArray(transUnits)) {
            transUnits = transUnits ? [transUnits] : [];
        }

        for (const unit of transUnits) {
            const source = this.extractText(unit.source);
            const target = this.extractText(unit.target);

            if (source) {
                // Use source as key, target as value (fallback to source if target is empty)
                translations.set(source, target || source);
            }
        }

        this.logger.debug(`Parsed ${translations.size} translations for locale: ${targetLanguage}`);

        return {
            sourceLanguage,
            targetLanguage,
            translations,
        };
    }

    /**
     * Extract text from an XML node
     * Handles both string values and objects with #text property
     */
    private extractText(node: unknown): string {
        if (!node) return '';
        if (typeof node === 'string') return node;
        if (typeof node === 'object' && node !== null && '#text' in node) {
            return (node as { '#text': string })['#text'];
        }
        return '';
    }
}
