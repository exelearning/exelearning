'use strict';

/**
 * @typedef {'LITERAL'|'VARIABLE'|'NOT'|'AND'|'XOR'|'OR'|'LPAREN'|'RPAREN'|'EOF'} BooleanTokenType
 */

/**
 * @typedef {Object} BooleanToken
 * @property {BooleanTokenType} type
 * @property {string|number|null} value Canonical value used by the parser.
 * @property {string} lexeme Exact source text; empty for EOF and implicit AND.
 * @property {'prefix'|'postfix'|'infix'|null} fixity
 * @property {boolean} implicit True only for a normalized implicit AND token.
 * @property {number} start Zero-based inclusive source position.
 * @property {number} end Zero-based exclusive source position.
 */

/**
 * @typedef {Object} LiteralNode
 * @property {'Literal'} type
 * @property {0|1} value
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {Object} VariableNode
 * @property {'Variable'} type
 * @property {'A'|'B'|'C'|'D'} name
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {Object} UnaryExpressionNode
 * @property {'UnaryExpression'} type
 * @property {'NOT'} operator
 * @property {BooleanAstNode} argument
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {Object} BinaryExpressionNode
 * @property {'BinaryExpression'} type
 * @property {'AND'|'XOR'|'OR'} operator
 * @property {BooleanAstNode} left
 * @property {BooleanAstNode} right
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {LiteralNode|VariableNode|UnaryExpressionNode|BinaryExpressionNode} BooleanAstNode
 */

/**
 * @typedef {Object} BooleanSyntaxErrorShape
 * @property {'BooleanSyntaxError'} name
 * @property {string} code
 * @property {number} position Zero-based source position.
 * @property {BooleanTokenType[]} expected
 * @property {string|null} found
 * @property {string} message Vietnamese learner-facing message.
 */

/**
 * Recursively freeze contract metadata so later Core tasks cannot mutate the
 * public grammar by accident.
 *
 * @template T
 * @param {T} value
 * @returns {Readonly<T>}
 */
function deepFreeze(value) {
    if (value === null || typeof value !== 'object') return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
}

const contract = {
    coreVersion: '0.1.0',
    grammarVersion: 'boolean-expression-v1',
    fixtureSchemaVersion: 1,
    apiMethods: [
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
    ],
    tokenTypes: {
        LITERAL: 'LITERAL',
        VARIABLE: 'VARIABLE',
        NOT: 'NOT',
        AND: 'AND',
        XOR: 'XOR',
        OR: 'OR',
        LPAREN: 'LPAREN',
        RPAREN: 'RPAREN',
        EOF: 'EOF',
    },
    tokenShape: {
        type: 'BooleanTokenType',
        value: 'canonical string, number, or null',
        lexeme: 'exact source string',
        fixity: 'prefix, postfix, infix, or null',
        implicit: 'boolean',
        start: 'zero-based inclusive integer',
        end: 'zero-based exclusive integer',
    },
    astTypes: {
        LITERAL: 'Literal',
        VARIABLE: 'Variable',
        UNARY_EXPRESSION: 'UnaryExpression',
        BINARY_EXPRESSION: 'BinaryExpression',
    },
    operators: [
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
    ],
    lexerRules: {
        variables: 'A-D uppercase single characters',
        literals: ['0', '1'],
        ignoreWhitespace: true,
        keywordBeforeImplicitAnd: true,
    },
    grammar: [
        'expression    ::= orExpression EOF',
        'orExpression  ::= xorExpression (OR xorExpression)*',
        'xorExpression ::= andExpression (XOR andExpression)*',
        'andExpression ::= notExpression ((AND | implicitAnd) notExpression)*',
        'notExpression ::= NOT notExpression | primary postfixNot*',
        'primary       ::= LITERAL | VARIABLE | LPAREN expression RPAREN',
        'postfixNot    ::= APOSTROPHE',
    ].join('\n'),
    variableOrder: ['A', 'B', 'C', 'D'],
    truthVectorOrder: {
        direction: 'binary-ascending',
        firstRow: 'all-zero',
        lastRow: 'all-one',
        significance: 'variables-left-to-right-most-significant-first',
    },
    errorShape: {
        name: 'BooleanSyntaxError',
        code: 'string',
        position: 'zero-based integer',
        expected: 'token type array',
        found: 'string or null',
        message: 'Vietnamese string',
    },
    errorMessages: {
        EMPTY_EXPRESSION: 'Biểu thức không được để trống.',
        INVALID_VARIABLE: 'Biến "{found}" không hợp lệ; chỉ chấp nhận A đến D.',
        INVALID_CONSTANT: 'Hằng "{found}" không hợp lệ; chỉ chấp nhận 0 hoặc 1.',
        INVALID_CHARACTER: 'Ký tự "{found}" không được hỗ trợ.',
        UNEXPECTED_TOKEN: 'Không mong đợi token "{found}" tại vị trí {position}.',
        UNEXPECTED_END: 'Thiếu toán hạng tại vị trí {position}.',
        UNCLOSED_PARENTHESIS: 'Thiếu dấu ")" cho dấu "(" tại vị trí {openPosition}.',
    },
};

module.exports = deepFreeze(contract);
