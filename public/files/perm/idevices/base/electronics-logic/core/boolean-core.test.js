import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import core from './boolean-core.js';
import syntaxFixtures from './fixtures/boolean-syntax-v1.json';

const tokenFields = token => ({
    type: token.type,
    value: token.value,
    lexeme: token.lexeme,
    fixity: token.fixity,
    implicit: token.implicit,
    start: token.start,
    end: token.end,
});

const tokenTypes = tokens => tokens.map(token => token.type);

function serializeAst(node) {
    if (node.type === 'Literal') return String(node.value);
    if (node.type === 'Variable') return node.name;
    if (node.type === 'UnaryExpression') return `${node.operator}(${serializeAst(node.argument)})`;
    return `${node.operator}(${serializeAst(node.left)},${serializeAst(node.right)})`;
}

describe('Electronics Logic Boolean lexer/normalizer', () => {
    it('returns a positioned EOF token for an empty expression', () => {
        expect(core.tokenize('')).toEqual([
            {
                type: 'EOF',
                value: null,
                lexeme: '',
                fixity: null,
                implicit: false,
                start: 0,
                end: 0,
            },
        ]);
    });

    it('tokenizes variables, literals, and parentheses without losing positions', () => {
        expect(core.tokenize('(A+1)').map(tokenFields)).toEqual([
            { type: 'LPAREN', value: '(', lexeme: '(', fixity: null, implicit: false, start: 0, end: 1 },
            { type: 'VARIABLE', value: 'A', lexeme: 'A', fixity: null, implicit: false, start: 1, end: 2 },
            { type: 'OR', value: 'OR', lexeme: '+', fixity: 'infix', implicit: false, start: 2, end: 3 },
            { type: 'LITERAL', value: 1, lexeme: '1', fixity: null, implicit: false, start: 3, end: 4 },
            { type: 'RPAREN', value: ')', lexeme: ')', fixity: null, implicit: false, start: 4, end: 5 },
            { type: 'EOF', value: null, lexeme: '', fixity: null, implicit: false, start: 5, end: 5 },
        ]);
    });

    it.each([
        ['!A', '!', 'prefix'],
        ['¬A', '¬', 'prefix'],
        ['NOT A', 'NOT', 'prefix'],
        ["A'", "'", 'postfix'],
    ])('normalizes NOT variant %s', (expression, lexeme, fixity) => {
        const notToken = core.tokenize(expression).find(token => token.type === 'NOT');

        expect(notToken).toMatchObject({
            type: 'NOT',
            value: 'NOT',
            lexeme,
            fixity,
            implicit: false,
        });
    });

    it.each([
        ['A.B', '.'],
        ['A*B', '*'],
        ['A AND B', 'AND'],
    ])('normalizes explicit AND variant %s', (expression, lexeme) => {
        const andToken = core.tokenize(expression).find(token => token.type === 'AND');

        expect(andToken).toMatchObject({
            type: 'AND',
            value: 'AND',
            lexeme,
            fixity: 'infix',
            implicit: false,
        });
    });

    it.each([
        ['A XOR B', 'XOR'],
        ['A⊕B', '⊕'],
    ])('normalizes XOR variant %s', (expression, lexeme) => {
        expect(core.tokenize(expression).find(token => token.type === 'XOR')).toMatchObject({
            type: 'XOR',
            value: 'XOR',
            lexeme,
            fixity: 'infix',
            implicit: false,
        });
    });

    it.each([
        ['A+B', '+'],
        ['A OR B', 'OR'],
    ])('normalizes OR variant %s', (expression, lexeme) => {
        expect(core.tokenize(expression).find(token => token.type === 'OR')).toMatchObject({
            type: 'OR',
            value: 'OR',
            lexeme,
            fixity: 'infix',
            implicit: false,
        });
    });

    it('recognizes keywords before inserting implicit AND', () => {
        expect(tokenTypes(core.tokenize('AAND B'))).toEqual(['VARIABLE', 'AND', 'VARIABLE', 'EOF']);
        expect(tokenTypes(core.tokenize('AXOR B'))).toEqual(['VARIABLE', 'XOR', 'VARIABLE', 'EOF']);
        expect(tokenTypes(core.tokenize('AOR B'))).toEqual(['VARIABLE', 'OR', 'VARIABLE', 'EOF']);
        expect(tokenTypes(core.tokenize('NOTA'))).toEqual(['NOT', 'VARIABLE', 'EOF']);
    });

    it('inserts zero-width canonical AND tokens for every supported adjacency', () => {
        const tokens = core.tokenize("A(B+C)(D')");
        const implicitTokens = tokens.filter(token => token.implicit);

        expect(tokenTypes(tokens)).toEqual([
            'VARIABLE',
            'AND',
            'LPAREN',
            'VARIABLE',
            'OR',
            'VARIABLE',
            'RPAREN',
            'AND',
            'LPAREN',
            'VARIABLE',
            'NOT',
            'RPAREN',
            'EOF',
        ]);
        expect(implicitTokens.map(tokenFields)).toEqual([
            { type: 'AND', value: 'AND', lexeme: '', fixity: 'infix', implicit: true, start: 1, end: 1 },
            { type: 'AND', value: 'AND', lexeme: '', fixity: 'infix', implicit: true, start: 6, end: 6 },
        ]);
    });

    it('inserts implicit AND before a prefix NOT expression but not after prefix NOT', () => {
        expect(tokenTypes(core.tokenize('A NOT B'))).toEqual(['VARIABLE', 'AND', 'NOT', 'VARIABLE', 'EOF']);
        expect(tokenTypes(core.tokenize('!AB'))).toEqual(['NOT', 'VARIABLE', 'AND', 'VARIABLE', 'EOF']);
    });

    it('ignores whitespace while preserving source positions', () => {
        expect(core.tokenize(' A ⊕\tB ').map(tokenFields)).toEqual([
            { type: 'VARIABLE', value: 'A', lexeme: 'A', fixity: null, implicit: false, start: 1, end: 2 },
            { type: 'XOR', value: 'XOR', lexeme: '⊕', fixity: 'infix', implicit: false, start: 3, end: 4 },
            { type: 'VARIABLE', value: 'B', lexeme: 'B', fixity: null, implicit: false, start: 5, end: 6 },
            { type: 'EOF', value: null, lexeme: '', fixity: null, implicit: false, start: 7, end: 7 },
        ]);
    });

    it('returns fresh token arrays deterministically', () => {
        const first = core.tokenize('AB');
        const second = core.tokenize('AB');

        expect(first).toEqual(second);
        expect(first).not.toBe(second);
        expect(first[0]).not.toBe(second[0]);
    });

    it.each(['unsupported-variable', 'lowercase-variable', 'unsupported-constant', 'unsupported-character'])(
        'throws the locked Vietnamese lexer error for %s',
        fixtureId => {
            const fixture = syntaxFixtures.invalid.find(testCase => testCase.id === fixtureId);

            expect(() => core.tokenize(fixture.expression)).toThrow(core.BooleanSyntaxError);
            try {
                core.tokenize(fixture.expression);
            } catch (error) {
                expect(error).toMatchObject({
                    name: 'BooleanSyntaxError',
                    code: fixture.error.code,
                    position: fixture.error.position,
                    expected: fixture.error.expected,
                    message: fixture.error.message,
                });
            }
        },
    );

    it('reports operand expectations for an invalid leading character', () => {
        expect(() => core.tokenize('@A')).toThrow(core.BooleanSyntaxError);
        try {
            core.tokenize('@A');
        } catch (error) {
            expect(error).toMatchObject({
                code: 'INVALID_CHARACTER',
                position: 0,
                expected: ['LITERAL', 'VARIABLE', 'LPAREN', 'NOT'],
                found: '@',
                message: 'Ký tự "@" không được hỗ trợ.',
            });
        }
    });

    it('rejects non-string programmer input', () => {
        expect(() => core.tokenize(null)).toThrow(TypeError);
        expect(() => core.tokenize(null)).toThrow('Boolean expression must be a string.');
    });

    it('has no DOM, Electron, eval, or Function dependency', () => {
        const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'boolean-core.js'), 'utf-8');

        expect(source).not.toMatch(/\b(?:document|window|electron)\b/i);
        expect(source).not.toMatch(/\beval\s*\(|\bFunction\s*\(/);
    });
});

describe('Electronics Logic Boolean parser', () => {
    it.each(syntaxFixtures.valid)('parses golden syntax fixture $id', fixture => {
        expect(serializeAst(core.parse(fixture.expression))).toBe(fixture.expectedAst);
    });

    it('returns discriminated AST nodes with source ranges', () => {
        expect(core.parse('!A+B*C')).toEqual({
            type: 'BinaryExpression',
            operator: 'OR',
            left: {
                type: 'UnaryExpression',
                operator: 'NOT',
                argument: { type: 'Variable', name: 'A', start: 1, end: 2 },
                start: 0,
                end: 2,
            },
            right: {
                type: 'BinaryExpression',
                operator: 'AND',
                left: { type: 'Variable', name: 'B', start: 3, end: 4 },
                right: { type: 'Variable', name: 'C', start: 5, end: 6 },
                start: 3,
                end: 6,
            },
            start: 0,
            end: 6,
        });
    });

    it('keeps prefix NOT right-associative and binary operators left-associative', () => {
        expect(serializeAst(core.parse('!!A'))).toBe('NOT(NOT(A))');
        expect(serializeAst(core.parse('A*B*C'))).toBe('AND(AND(A,B),C)');
        expect(serializeAst(core.parse('A XOR B XOR C'))).toBe('XOR(XOR(A,B),C)');
        expect(serializeAst(core.parse('A+B+C'))).toBe('OR(OR(A,B),C)');
    });

    it('applies postfix NOT before implicit AND', () => {
        expect(core.parse("A'B")).toEqual({
            type: 'BinaryExpression',
            operator: 'AND',
            left: {
                type: 'UnaryExpression',
                operator: 'NOT',
                argument: { type: 'Variable', name: 'A', start: 0, end: 1 },
                start: 0,
                end: 2,
            },
            right: { type: 'Variable', name: 'B', start: 2, end: 3 },
            start: 0,
            end: 3,
        });
    });

    it.each(syntaxFixtures.invalid)('returns the locked parser error for $id', fixture => {
        expect(() => core.parse(fixture.expression)).toThrow(core.BooleanSyntaxError);
        try {
            core.parse(fixture.expression);
        } catch (error) {
            expect(error).toMatchObject({
                name: 'BooleanSyntaxError',
                code: fixture.error.code,
                position: fixture.error.position,
                expected: fixture.error.expected,
                message: fixture.error.message,
            });
        }
    });

    it('returns fresh AST objects deterministically', () => {
        const first = core.parse('(A+B)C');
        const second = core.parse('(A+B)C');

        expect(first).toEqual(second);
        expect(first).not.toBe(second);
        expect(first.left).not.toBe(second.left);
    });
});

describe('Electronics Logic Boolean evaluator and truth vectors', () => {
    it.each([
        ['0', {}, 0],
        ['1', {}, 1],
        ['!A', { A: 0 }, 1],
        ['¬A', { A: 1 }, 0],
        ["A'", { A: 1 }, 0],
        ['AB', { A: 1, B: 1 }, 1],
        ['A+B', { A: 0, B: 1 }, 1],
        ['A XOR B', { A: 1, B: 1 }, 0],
        ['A XOR B', { A: 1, B: 0 }, 1],
        ['!(A+B)*C', { A: 0, B: 0, C: 1 }, 1],
    ])('evaluates %s deterministically', (expression, assignment, expected) => {
        expect(core.evaluate(expression, assignment)).toBe(expected);
    });

    it('evaluates a parsed AST without changing it', () => {
        const ast = core.parse('A XOR B');
        const before = JSON.stringify(ast);

        expect(core.evaluate(ast, { A: 0, B: 1 })).toBe(1);
        expect(JSON.stringify(ast)).toBe(before);
    });

    it('extracts unique variables in canonical A-to-D order', () => {
        expect(core.getVariables('D+A+C+B+A')).toEqual(['A', 'B', 'C', 'D']);
        expect(core.getVariables(core.parse('C+AC'))).toEqual(['A', 'C']);
        expect(core.getVariables('1')).toEqual([]);
    });

    it('creates a two-variable vector in binary ascending row order', () => {
        expect(core.createTruthVector('A XOR B')).toEqual({
            variables: ['A', 'B'],
            values: [0, 1, 1, 0],
        });
        expect(core.createTruthVector('AB')).toEqual({
            variables: ['A', 'B'],
            values: [0, 0, 0, 1],
        });
    });

    it('uses the caller variable order as most-significant to least-significant', () => {
        expect(core.createTruthVector('A', ['B', 'A'])).toEqual({
            variables: ['B', 'A'],
            values: [0, 1, 0, 1],
        });
    });

    it('evaluates every four-variable combination', () => {
        expect(core.createTruthVector('A XOR B XOR C XOR D')).toEqual({
            variables: ['A', 'B', 'C', 'D'],
            values: [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0],
        });
    });

    it('creates one deterministic row for a constant expression', () => {
        expect(core.createTruthVector('1')).toEqual({ variables: [], values: [1] });
    });

    it.each([
        [null, { A: 0 }, 'Boolean AST must be an expression string or node.'],
        [{ type: 'Unknown' }, {}, 'Unsupported Boolean AST node type: Unknown.'],
        [{ type: 'Literal', value: 2, start: 0, end: 1 }, {}, 'Boolean literal value must be 0 or 1.'],
        [{ type: 'Variable', name: 'E', start: 0, end: 1 }, { E: 0 }, 'Boolean variable must be A, B, C, or D.'],
        [
            { type: 'UnaryExpression', operator: 'AND', argument: { type: 'Literal', value: 1 } },
            {},
            'Unsupported unary Boolean operator: AND.',
        ],
        [
            { type: 'UnaryExpression', operator: 'NOT', argument: null },
            {},
            'Boolean AST node must be an object.',
        ],
        [
            {
                type: 'BinaryExpression',
                operator: 'NAND',
                left: { type: 'Literal', value: 1 },
                right: { type: 'Literal', value: 1 },
            },
            {},
            'Unsupported binary Boolean operator: NAND.',
        ],
    ])('rejects invalid AST input %#', (ast, assignment, message) => {
        expect(() => core.evaluate(ast, assignment)).toThrow(TypeError);
        expect(() => core.evaluate(ast, assignment)).toThrow(message);
    });

    it('rejects missing or non-binary variable assignments', () => {
        expect(() => core.evaluate('A', null)).toThrow('Boolean assignment must be an object.');
        expect(() => core.evaluate('A', {})).toThrow('Missing Boolean value for variable A.');
        expect(() => core.evaluate('A', { A: 2 })).toThrow('Boolean value for variable A must be 0 or 1.');
    });

    it.each([
        [['A', 'A'], 'Boolean variable order must not contain duplicates.'],
        [['A', 'E'], 'Boolean variable order only accepts A through D.'],
        [['A', 'B', 'C', 'D', 'A'], 'Boolean variable order supports at most four variables.'],
        [['B'], 'Boolean variable order is missing expression variable A.'],
        ['A', 'Boolean variable order must be an array.'],
    ])('rejects invalid truth-vector variable order %#', (variables, message) => {
        expect(() => core.createTruthVector('A', variables)).toThrow(TypeError);
        expect(() => core.createTruthVector('A', variables)).toThrow(message);
    });
});

describe('Electronics Logic Boolean equivalence and conversions', () => {
    it.each([
        ['A+B', 'B OR A', true],
        ['A XOR B', '!A*B+A*!B', true],
        ['!(A+B)', '!A*!B', true],
        ['A', 'A+AB', true],
        ['A+B', 'AB', false],
        ['A XOR B', 'A+B', false],
    ])('compares %s and %s by all combinations', (left, right, expected) => {
        expect(core.areEquivalent(left, right)).toBe(expected);
    });

    it('supports a deterministic caller variable order for equivalence', () => {
        expect(core.areEquivalent('A', 'A+AB', ['B', 'A'])).toBe(true);
        expect(() => core.areEquivalent('A', 'A', ['B'])).toThrow(
            'Boolean variable order is missing expression variable A.',
        );
    });

    it('converts a vector to minterms, don\'t-cares, and canonical SOP', () => {
        const vector = { variables: ['A', 'B'], values: [0, 1, 'X', 1] };

        expect(core.vectorToMinterms(vector)).toEqual({
            variables: ['A', 'B'],
            minterms: [1, 3],
            dontCares: [2],
        });
        expect(core.vectorToCanonicalSop(vector)).toBe('!A*B+A*B');
    });

    it('uses stable canonical SOP constants', () => {
        expect(core.vectorToCanonicalSop({ variables: [], values: [0] })).toBe('0');
        expect(core.vectorToCanonicalSop({ variables: [], values: [1] })).toBe('1');
        expect(core.vectorToCanonicalSop({ variables: [], values: ['X'] })).toBe('0');
        expect(core.vectorToCanonicalSop({ variables: ['A'], values: [0, 0] })).toBe('0');
        expect(core.vectorToCanonicalSop({ variables: ['A'], values: [1, 1] })).toBe('!A+A');
    });

    it('round-trips minterms and don\'t-cares without changing meaning', () => {
        const mintermModel = {
            variables: ['A', 'B', 'C'],
            minterms: [1, 3, 7],
            dontCares: [0, 6],
        };
        const vector = core.mintermsToVector(mintermModel);

        expect(vector).toEqual({ variables: ['A', 'B', 'C'], values: ['X', 1, 0, 1, 0, 0, 'X', 1] });
        expect(core.vectorToMinterms(vector)).toEqual(mintermModel);
        expect(core.mintermsToVector({ variables: ['A'], minterms: [1] })).toEqual({
            variables: ['A'],
            values: [0, 1],
        });
    });

    it.each([
        [
            { variables: ['A', 'B'], values: [0, 0, 0, 1] },
            [
                [0, 1],
                [2, 3],
            ],
        ],
        [
            { variables: ['A', 'B', 'C'], values: [0, 0, 0, 0, 0, 0, 0, 1] },
            [
                [0, 1, 3, 2],
                [4, 5, 7, 6],
            ],
        ],
        [
            { variables: ['A', 'B', 'C', 'D'], values: Array(15).fill(0).concat(1) },
            [
                [0, 1, 3, 2],
                [4, 5, 7, 6],
                [12, 13, 15, 14],
                [8, 9, 11, 10],
            ],
        ],
    ])('creates the locked Gray-code K-map layout %#', (vector, expectedIndices) => {
        const model = core.vectorToKmapModel(vector);

        expect(model.schemaVersion).toBe(1);
        expect(model.cells.map(row => row.map(cell => cell.index))).toEqual(expectedIndices);
        expect(model.cells.flat().find(cell => cell.index === vector.values.length - 1).value).toBe(1);
        expect(core.kmapModelToVector(model)).toEqual(vector);
    });

    it('exposes deterministic K-map axes and cell assignments', () => {
        const model = core.vectorToKmapModel({
            variables: ['A', 'B', 'C'],
            values: [0, 1, 'X', 1, 0, 1, 0, 1],
        });

        expect(model).toMatchObject({
            variables: ['A', 'B', 'C'],
            rowVariables: ['A'],
            columnVariables: ['B', 'C'],
            rowLabels: ['0', '1'],
            columnLabels: ['00', '01', '11', '10'],
        });
        expect(model.cells[1][2]).toEqual({
            row: 1,
            column: 2,
            index: 7,
            value: 1,
            assignment: { A: 1, B: 1, C: 1 },
        });
        expect(model.cells[0][3]).toMatchObject({ index: 2, value: 'X', assignment: { A: 0, B: 1, C: 0 } });
    });

    it('converts learner-edited K-map cells back to a vector', () => {
        const model = core.vectorToKmapModel({ variables: ['A', 'B'], values: [0, 0, 0, 0] });
        model.cells[0][1].value = 1;
        model.cells[1][0].value = 'X';

        expect(core.kmapModelToVector(model)).toEqual({ variables: ['A', 'B'], values: [0, 1, 'X', 0] });
    });

    it.each([
        [null, 'Boolean truth vector must be an object.'],
        [{ variables: ['A'], values: '01' }, 'Boolean truth vector values must be an array.'],
        [{ variables: ['A'], values: [0] }, 'Boolean truth vector must contain exactly 2 values.'],
        [{ variables: ['A'], values: [0, 2] }, 'Boolean truth vector values only accept 0, 1, or X.'],
    ])('rejects invalid truth vector %#', (vector, message) => {
        expect(() => core.vectorToMinterms(vector)).toThrow(TypeError);
        expect(() => core.vectorToMinterms(vector)).toThrow(message);
    });

    it.each([
        [null, 'Boolean minterm model must be an object.'],
        [
            { variables: ['A'], minterms: '1', dontCares: [] },
            'Boolean minterms and don\'t-cares must be arrays.',
        ],
        [
            { variables: ['A'], minterms: [2], dontCares: [] },
            'Boolean minterm indices must be unique integers from 0 through 1.',
        ],
        [
            { variables: ['A'], minterms: [1], dontCares: [1] },
            'Boolean minterms and don\'t-cares must not overlap.',
        ],
    ])('rejects invalid minterm model %#', (model, message) => {
        expect(() => core.mintermsToVector(model)).toThrow(TypeError);
        expect(() => core.mintermsToVector(model)).toThrow(message);
    });

    it('rejects invalid K-map dimensions and cell layout', () => {
        expect(() => core.vectorToKmapModel({ variables: ['A'], values: [0, 1] })).toThrow(
            'Boolean K-map requires two through four variables.',
        );
        expect(() => core.kmapModelToVector(null)).toThrow('Boolean K-map model must be an object.');
        expect(() => core.kmapModelToVector({ variables: ['A'], cells: [] })).toThrow(
            'Boolean K-map requires two through four variables.',
        );

        const model = core.vectorToKmapModel({ variables: ['A', 'B'], values: [0, 1, 1, 0] });
        expect(() => core.kmapModelToVector({ ...model, cells: [] })).toThrow(
            'Boolean K-map cell layout does not match Gray-code order.',
        );
        model.cells[0][0].index = 3;
        expect(() => core.kmapModelToVector(model)).toThrow('Boolean K-map cell layout does not match Gray-code order.');
    });
});

describe('Electronics Logic exact SOP minimizer', () => {
    it.each([
        [
            { variables: ['A', 'B'], values: [0, 0, 0, 0] },
            { expression: '0', patterns: [], terms: [], cost: { implicants: 0, literals: 0 } },
        ],
        [
            { variables: ['A', 'B'], values: [1, 1, 1, 1] },
            { expression: '1', patterns: ['--'], terms: ['1'], cost: { implicants: 1, literals: 0 } },
        ],
        [
            { variables: ['A', 'B'], values: [0, 1, 1, 1] },
            { expression: 'A+B', patterns: ['1-', '-1'], terms: ['A', 'B'], cost: { implicants: 2, literals: 2 } },
        ],
        [
            { variables: ['A', 'B'], values: [0, 1, 1, 0] },
            {
                expression: '!A*B+A*!B',
                patterns: ['01', '10'],
                terms: ['!A*B', 'A*!B'],
                cost: { implicants: 2, literals: 4 },
            },
        ],
        [
            { variables: ['A', 'B'], values: [1, 1, 0, 0] },
            { expression: '!A', patterns: ['0-'], terms: ['!A'], cost: { implicants: 1, literals: 1 } },
        ],
        [
            { variables: ['A', 'B'], values: [1, 'X', 0, 0] },
            { expression: '!A', patterns: ['0-'], terms: ['!A'], cost: { implicants: 1, literals: 1 } },
        ],
        [
            { variables: ['A', 'B', 'C'], values: [0, 0, 0, 1, 0, 1, 1, 1] },
            {
                expression: 'A*B+A*C+B*C',
                patterns: ['11-', '1-1', '-11'],
                terms: ['A*B', 'A*C', 'B*C'],
                cost: { implicants: 3, literals: 6 },
            },
        ],
    ])('returns the exact stable minimum for golden case %#', (vector, expected) => {
        const result = core.minimizeSop(vector);

        expect(result).toMatchObject({
            variables: vector.variables,
            expression: expected.expression,
            cost: expected.cost,
        });
        expect(result.implicants.map(implicant => implicant.pattern)).toEqual(expected.patterns);
        expect(result.implicants.map(implicant => implicant.term)).toEqual(expected.terms);
    });

    it('reports only required minterms in implicant evidence when using don\'t-cares', () => {
        expect(core.minimizeSop({ variables: ['A', 'B'], values: [1, 'X', 0, 0] }).implicants).toEqual([
            { pattern: '0-', term: '!A', minterms: [0] },
        ]);
    });

    it('keeps zero-variable constants stable', () => {
        expect(core.minimizeSop({ variables: [], values: [0] })).toEqual({
            variables: [],
            expression: '0',
            implicants: [],
            cost: { implicants: 0, literals: 0 },
        });
        expect(core.minimizeSop({ variables: [], values: [1] })).toEqual({
            variables: [],
            expression: '1',
            implicants: [{ pattern: '', term: '1', minterms: [0] }],
            cost: { implicants: 1, literals: 0 },
        });
    });

    it('is deterministic and equivalent for one hundred generated truth vectors', () => {
        let state = 0x13579bdf;
        for (let caseIndex = 0; caseIndex < 100; caseIndex += 1) {
            state = (Math.imul(1664525, state) + 1013904223) >>> 0;
            const vector = {
                variables: ['A', 'B', 'C', 'D'],
                values: Array.from({ length: 16 }, (_, bit) => (state >>> bit) & 1),
            };
            const canonical = core.vectorToCanonicalSop(vector);
            const first = core.minimizeSop(vector);
            const second = core.minimizeSop(vector);

            expect(first).toEqual(second);
            expect(core.areEquivalent(canonical, first.expression, vector.variables)).toBe(true);
            expect(first.cost.implicants).toBeLessThanOrEqual(vector.values.filter(value => value === 1).length);
        }
    });
});
