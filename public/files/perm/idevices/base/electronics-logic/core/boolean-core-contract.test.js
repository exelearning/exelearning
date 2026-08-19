import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import contract from './boolean-core-contract.js';
import syntaxFixtures from './fixtures/boolean-syntax-v1.json';

describe('Electronics Logic Boolean Core contract', () => {
    it('locks the standalone API and grammar versions', () => {
        expect(contract).toMatchObject({
            coreVersion: '0.1.0',
            grammarVersion: 'boolean-expression-v1',
            fixtureSchemaVersion: 1,
        });
        expect(contract.apiMethods).toEqual([
            'tokenize',
            'parse',
            'evaluate',
            'getVariables',
            'createTruthVector',
            'areEquivalent',
            'vectorToCanonicalSop',
            'vectorToMinterms',
            'mintermsToVector',
            'vectorToKmapModel',
            'kmapModelToVector',
            'minimizeSop',
        ]);
    });

    it('has no DOM, Electron, or dynamic-code dependency', () => {
        const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'boolean-core-contract.js'), 'utf-8');

        expect(source).not.toMatch(/\b(?:document|window|electron)\b/i);
        expect(source).not.toMatch(/\beval\s*\(|\bFunction\s*\(/);
    });

    it('locks token and AST discriminators', () => {
        expect(contract.tokenTypes).toEqual({
            LITERAL: 'LITERAL',
            VARIABLE: 'VARIABLE',
            NOT: 'NOT',
            AND: 'AND',
            XOR: 'XOR',
            OR: 'OR',
            LPAREN: 'LPAREN',
            RPAREN: 'RPAREN',
            EOF: 'EOF',
        });
        expect(contract.tokenShape).toEqual({
            type: 'BooleanTokenType',
            value: 'canonical string, number, or null',
            lexeme: 'exact source string',
            fixity: 'prefix, postfix, infix, or null',
            implicit: 'boolean',
            start: 'zero-based inclusive integer',
            end: 'zero-based exclusive integer',
        });
        expect(contract.astTypes).toEqual({
            LITERAL: 'Literal',
            VARIABLE: 'Variable',
            UNARY_EXPRESSION: 'UnaryExpression',
            BINARY_EXPRESSION: 'BinaryExpression',
        });
    });

    it('locks operator variants, precedence, associativity, and keyword routing', () => {
        expect(contract.operators).toEqual([
            {
                name: 'NOT',
                prefix: ['!', '¬', 'NOT'],
                postfix: ["'"],
                precedence: 4,
                associativity: 'right',
            },
            {
                name: 'AND',
                infix: ['.', '*', 'AND'],
                implicit: true,
                precedence: 3,
                associativity: 'left',
            },
            { name: 'XOR', infix: ['XOR', '⊕'], precedence: 2, associativity: 'left' },
            { name: 'OR', infix: ['+', 'OR'], precedence: 1, associativity: 'left' },
        ]);
        expect(contract.lexerRules.keywordBeforeImplicitAnd).toBe(true);
        expect(contract.grammar).toContain('orExpression');
        expect(contract.grammar).toContain('postfixNot');
    });

    it('locks deterministic variable and truth-vector ordering', () => {
        expect(contract.variableOrder).toEqual(['A', 'B', 'C', 'D']);
        expect(contract.truthVectorOrder).toEqual({
            direction: 'binary-ascending',
            firstRow: 'all-zero',
            lastRow: 'all-one',
            significance: 'variables-left-to-right-most-significant-first',
        });
    });

    it('locks the parser error shape and Vietnamese error catalogue', () => {
        expect(contract.errorShape).toEqual({
            name: 'BooleanSyntaxError',
            code: 'string',
            position: 'zero-based integer',
            expected: 'token type array',
            found: 'string or null',
            message: 'Vietnamese string',
        });
        expect(Object.keys(contract.errorMessages)).toEqual([
            'EMPTY_EXPRESSION',
            'INVALID_VARIABLE',
            'INVALID_CONSTANT',
            'INVALID_CHARACTER',
            'UNEXPECTED_TOKEN',
            'UNEXPECTED_END',
            'UNCLOSED_PARENTHESIS',
        ]);
        for (const message of Object.values(contract.errorMessages)) {
            expect(message.trim().length).toBeGreaterThan(0);
            expect(message).toMatch(/[À-ỹĐđ]/);
        }
    });

    it('provides at least thirty immutable golden syntax fixtures', () => {
        expect(syntaxFixtures.schemaVersion).toBe(contract.fixtureSchemaVersion);
        expect(syntaxFixtures.grammarVersion).toBe(contract.grammarVersion);
        expect(syntaxFixtures.valid.length + syntaxFixtures.invalid.length).toBeGreaterThanOrEqual(30);

        const cases = [...syntaxFixtures.valid, ...syntaxFixtures.invalid];
        expect(new Set(cases.map(testCase => testCase.id)).size).toBe(cases.length);
        expect(Object.isFrozen(contract)).toBe(true);
        expect(Object.isFrozen(contract.operators)).toBe(true);
        expect(Object.isFrozen(contract.operators[0].prefix)).toBe(true);
    });

    it('keeps valid fixture variables unique and in deterministic order', () => {
        for (const testCase of syntaxFixtures.valid) {
            expect(testCase.expression).toBeTypeOf('string');
            expect(testCase.expectedAst).toBeTypeOf('string');
            expect(testCase.variables).toEqual(
                [...new Set(testCase.variables)].sort(
                    (left, right) => contract.variableOrder.indexOf(left) - contract.variableOrder.indexOf(right),
                ),
            );
            expect(testCase.variables.every(variable => contract.variableOrder.includes(variable))).toBe(true);
        }
    });

    it('keeps invalid fixtures compatible with the public error contract', () => {
        const knownTokenTypes = new Set(Object.values(contract.tokenTypes));
        for (const testCase of syntaxFixtures.invalid) {
            expect(testCase.error.position).toBeGreaterThanOrEqual(0);
            expect(contract.errorMessages).toHaveProperty(testCase.error.code);
            expect(testCase.error.expected.length).toBeGreaterThan(0);
            expect(testCase.error.expected.every(tokenType => knownTokenTypes.has(tokenType))).toBe(true);
            expect(testCase.error.message).toBeTypeOf('string');
            expect(testCase.error.message.trim()).not.toBe('');
        }
    });
});
