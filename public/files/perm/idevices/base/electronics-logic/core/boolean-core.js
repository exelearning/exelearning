'use strict';

const contract = require('./boolean-core-contract.js');

const TOKEN = contract.tokenTypes;
const EXPECTED_OPERAND = [TOKEN.LITERAL, TOKEN.VARIABLE, TOKEN.LPAREN, TOKEN.NOT];
const EXPECTED_AFTER_OPERAND = [TOKEN.AND, TOKEN.XOR, TOKEN.OR, TOKEN.RPAREN, TOKEN.EOF];
const KEYWORDS = [TOKEN.NOT, TOKEN.AND, TOKEN.XOR, TOKEN.OR];

class BooleanSyntaxError extends SyntaxError {
    constructor({ code, position, expected, found, message }) {
        super(message);
        this.name = 'BooleanSyntaxError';
        this.code = code;
        this.position = position;
        this.expected = [...expected];
        this.found = found;
    }
}

function formatErrorMessage(code, details) {
    let message = contract.errorMessages[code];
    for (const [name, value] of Object.entries(details)) {
        message = message.split(`{${name}}`).join(String(value));
    }
    return message;
}

function createSyntaxError(code, position, expected, found, extraDetails = {}) {
    return new BooleanSyntaxError({
        code,
        position,
        expected,
        found,
        message: formatErrorMessage(code, { found, position, ...extraDetails }),
    });
}

function createToken(type, value, lexeme, fixity, implicit, start, end) {
    return { type, value, lexeme, fixity, implicit, start, end };
}

function isOperandEnd(token) {
    return (
        token.type === TOKEN.LITERAL ||
        token.type === TOKEN.VARIABLE ||
        token.type === TOKEN.RPAREN ||
        (token.type === TOKEN.NOT && token.fixity === 'postfix')
    );
}

function isOperandStart(token) {
    return (
        token.type === TOKEN.LITERAL ||
        token.type === TOKEN.VARIABLE ||
        token.type === TOKEN.LPAREN ||
        (token.type === TOKEN.NOT && token.fixity === 'prefix')
    );
}

function keywordAt(expression, position) {
    return KEYWORDS.find(keyword => expression.startsWith(keyword, position)) || null;
}

function operatorToken(type, lexeme, position, fixity = 'infix') {
    return createToken(type, type, lexeme, fixity, false, position, position + lexeme.length);
}

function expectedAtInvalidCharacter(tokens) {
    const previous = tokens.at(-1);
    return previous && isOperandEnd(previous) ? EXPECTED_AFTER_OPERAND : EXPECTED_OPERAND;
}

function scanTokens(expression) {
    const tokens = [];
    let position = 0;

    while (position < expression.length) {
        const character = expression[position];
        if (/\s/u.test(character)) {
            position += 1;
            continue;
        }

        const keyword = keywordAt(expression, position);
        if (keyword) {
            const fixity = keyword === TOKEN.NOT ? 'prefix' : 'infix';
            tokens.push(operatorToken(keyword, keyword, position, fixity));
            position += keyword.length;
            continue;
        }

        if (/^[A-D]$/.test(character)) {
            tokens.push(createToken(TOKEN.VARIABLE, character, character, null, false, position, position + 1));
            position += 1;
            continue;
        }

        if (character === '0' || character === '1') {
            tokens.push(createToken(TOKEN.LITERAL, Number(character), character, null, false, position, position + 1));
            position += 1;
            continue;
        }

        const symbol = {
            '!': [TOKEN.NOT, 'prefix'],
            '¬': [TOKEN.NOT, 'prefix'],
            "'": [TOKEN.NOT, 'postfix'],
            '.': [TOKEN.AND, 'infix'],
            '*': [TOKEN.AND, 'infix'],
            '⊕': [TOKEN.XOR, 'infix'],
            '+': [TOKEN.OR, 'infix'],
        }[character];
        if (symbol) {
            tokens.push(operatorToken(symbol[0], character, position, symbol[1]));
            position += 1;
            continue;
        }

        if (character === '(' || character === ')') {
            const type = character === '(' ? TOKEN.LPAREN : TOKEN.RPAREN;
            tokens.push(createToken(type, character, character, null, false, position, position + 1));
            position += 1;
            continue;
        }

        if (/^[A-Za-z]$/.test(character)) {
            throw createSyntaxError('INVALID_VARIABLE', position, [TOKEN.VARIABLE], character);
        }
        if (/^[0-9]$/.test(character)) {
            throw createSyntaxError('INVALID_CONSTANT', position, [TOKEN.LITERAL], character);
        }
        throw createSyntaxError('INVALID_CHARACTER', position, expectedAtInvalidCharacter(tokens), character);
    }

    return tokens;
}

function insertImplicitAnd(tokens) {
    const normalized = [];
    for (const token of tokens) {
        const previous = normalized.at(-1);
        if (previous && isOperandEnd(previous) && isOperandStart(token)) {
            normalized.push(createToken(TOKEN.AND, TOKEN.AND, '', 'infix', true, token.start, token.start));
        }
        normalized.push(token);
    }
    return normalized;
}

function tokenize(expression) {
    if (typeof expression !== 'string') throw new TypeError('Boolean expression must be a string.');

    const tokens = insertImplicitAnd(scanTokens(expression));
    tokens.push(createToken(TOKEN.EOF, null, '', null, false, expression.length, expression.length));
    return tokens;
}

function literalNode(token) {
    return { type: contract.astTypes.LITERAL, value: token.value, start: token.start, end: token.end };
}

function variableNode(token) {
    return { type: contract.astTypes.VARIABLE, name: token.value, start: token.start, end: token.end };
}

function unaryNode(operatorTokenValue, argument) {
    const prefix = operatorTokenValue.fixity === 'prefix';
    return {
        type: contract.astTypes.UNARY_EXPRESSION,
        operator: TOKEN.NOT,
        argument,
        start: prefix ? operatorTokenValue.start : argument.start,
        end: prefix ? argument.end : operatorTokenValue.end,
    };
}

function binaryNode(operatorTokenValue, left, right) {
    return {
        type: contract.astTypes.BINARY_EXPRESSION,
        operator: operatorTokenValue.type,
        left,
        right,
        start: left.start,
        end: right.end,
    };
}

class BooleanParser {
    constructor(tokens) {
        this.tokens = tokens;
        this.position = 0;
    }

    current() {
        return this.tokens[this.position];
    }

    advance() {
        const token = this.current();
        this.position += 1;
        return token;
    }

    parse() {
        if (this.current().type === TOKEN.EOF) {
            throw createSyntaxError('EMPTY_EXPRESSION', 0, EXPECTED_OPERAND, null);
        }

        const expression = this.parseOr();
        const trailing = this.current();
        if (trailing.type !== TOKEN.EOF) {
            throw createSyntaxError('UNEXPECTED_TOKEN', trailing.start, [TOKEN.EOF], trailing.lexeme);
        }
        return expression;
    }

    parseOr() {
        let left = this.parseXor();
        while (this.current().type === TOKEN.OR) {
            const operator = this.advance();
            left = binaryNode(operator, left, this.parseXor());
        }
        return left;
    }

    parseXor() {
        let left = this.parseAnd();
        while (this.current().type === TOKEN.XOR) {
            const operator = this.advance();
            left = binaryNode(operator, left, this.parseAnd());
        }
        return left;
    }

    parseAnd() {
        let left = this.parseNot();
        while (this.current().type === TOKEN.AND) {
            const operator = this.advance();
            left = binaryNode(operator, left, this.parseNot());
        }
        return left;
    }

    parseNot() {
        const token = this.current();
        if (token.type === TOKEN.NOT && token.fixity === 'prefix') {
            this.advance();
            return unaryNode(token, this.parseNot());
        }

        let expression = this.parsePrimary();
        while (this.current().type === TOKEN.NOT && this.current().fixity === 'postfix') {
            expression = unaryNode(this.advance(), expression);
        }
        return expression;
    }

    parsePrimary() {
        const token = this.current();
        if (token.type === TOKEN.LITERAL) {
            this.advance();
            return literalNode(token);
        }
        if (token.type === TOKEN.VARIABLE) {
            this.advance();
            return variableNode(token);
        }
        if (token.type === TOKEN.LPAREN) {
            const opening = this.advance();
            const expression = this.parseOr();
            const closing = this.current();
            if (closing.type !== TOKEN.RPAREN) {
                throw createSyntaxError('UNCLOSED_PARENTHESIS', closing.start, [TOKEN.RPAREN], closing.lexeme || null, {
                    openPosition: opening.start,
                });
            }
            this.advance();
            return expression;
        }
        if (token.type === TOKEN.EOF) {
            throw createSyntaxError('UNEXPECTED_END', token.start, EXPECTED_OPERAND, null);
        }
        throw createSyntaxError('UNEXPECTED_TOKEN', token.start, EXPECTED_OPERAND, token.lexeme);
    }
}

function parse(expression) {
    return new BooleanParser(tokenize(expression)).parse();
}

function resolveAst(expressionOrAst) {
    if (typeof expressionOrAst === 'string') return parse(expressionOrAst);
    if (expressionOrAst !== null && typeof expressionOrAst === 'object' && !Array.isArray(expressionOrAst)) {
        return expressionOrAst;
    }
    throw new TypeError('Boolean AST must be an expression string or node.');
}

function astChildren(node) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) {
        throw new TypeError('Boolean AST node must be an object.');
    }
    if (node.type === contract.astTypes.LITERAL) {
        if (node.value !== 0 && node.value !== 1) throw new TypeError('Boolean literal value must be 0 or 1.');
        return [];
    }
    if (node.type === contract.astTypes.VARIABLE) {
        if (!contract.variableOrder.includes(node.name)) {
            throw new TypeError('Boolean variable must be A, B, C, or D.');
        }
        return [];
    }
    if (node.type === contract.astTypes.UNARY_EXPRESSION) {
        if (node.operator !== TOKEN.NOT) {
            throw new TypeError(`Unsupported unary Boolean operator: ${node.operator}.`);
        }
        return [node.argument];
    }
    if (node.type === contract.astTypes.BINARY_EXPRESSION) {
        if (![TOKEN.AND, TOKEN.XOR, TOKEN.OR].includes(node.operator)) {
            throw new TypeError(`Unsupported binary Boolean operator: ${node.operator}.`);
        }
        return [node.left, node.right];
    }
    throw new TypeError(`Unsupported Boolean AST node type: ${node.type}.`);
}

function walkAst(node, visitor) {
    const children = astChildren(node);
    visitor(node);
    for (const child of children) walkAst(child, visitor);
}

function validateAst(ast) {
    walkAst(ast, () => {});
}

function collectVariables(ast) {
    const variables = new Set();
    walkAst(ast, node => {
        if (node.type === contract.astTypes.VARIABLE) variables.add(node.name);
    });
    return contract.variableOrder.filter(variable => variables.has(variable));
}

function validateAssignment(assignment) {
    if (assignment === null || typeof assignment !== 'object' || Array.isArray(assignment)) {
        throw new TypeError('Boolean assignment must be an object.');
    }
}

function variableValue(node, assignment) {
    if (!Object.hasOwn(assignment, node.name)) {
        throw new TypeError(`Missing Boolean value for variable ${node.name}.`);
    }
    const value = assignment[node.name];
    if (value !== 0 && value !== 1) {
        throw new TypeError(`Boolean value for variable ${node.name} must be 0 or 1.`);
    }
    return value;
}

function evaluateNode(node, assignment) {
    if (node.type === contract.astTypes.LITERAL) return node.value;
    if (node.type === contract.astTypes.VARIABLE) return variableValue(node, assignment);
    if (node.type === contract.astTypes.UNARY_EXPRESSION) return evaluateNode(node.argument, assignment) === 0 ? 1 : 0;

    const left = evaluateNode(node.left, assignment);
    const right = evaluateNode(node.right, assignment);
    if (node.operator === TOKEN.AND) return left === 1 && right === 1 ? 1 : 0;
    if (node.operator === TOKEN.XOR) return left === right ? 0 : 1;
    return left === 1 || right === 1 ? 1 : 0;
}

function evaluate(expressionOrAst, assignment) {
    const ast = resolveAst(expressionOrAst);
    validateAst(ast);
    validateAssignment(assignment);
    return evaluateNode(ast, assignment);
}

function getVariables(expressionOrAst) {
    const ast = resolveAst(expressionOrAst);
    return collectVariables(ast);
}

function validateVariableOrder(variables, expressionVariables) {
    if (!Array.isArray(variables)) throw new TypeError('Boolean variable order must be an array.');
    if (variables.length > contract.variableOrder.length) {
        throw new TypeError('Boolean variable order supports at most four variables.');
    }
    if (variables.some(variable => !contract.variableOrder.includes(variable))) {
        throw new TypeError('Boolean variable order only accepts A through D.');
    }
    if (new Set(variables).size !== variables.length) {
        throw new TypeError('Boolean variable order must not contain duplicates.');
    }
    const missing = expressionVariables.find(variable => !variables.includes(variable));
    if (missing) throw new TypeError(`Boolean variable order is missing expression variable ${missing}.`);
    return [...variables];
}

function assignmentForRow(variables, row) {
    const assignment = {};
    variables.forEach((variable, index) => {
        const shift = variables.length - index - 1;
        assignment[variable] = (row >> shift) & 1;
    });
    return assignment;
}

function createTruthVector(expressionOrAst, variableOrder) {
    const ast = resolveAst(expressionOrAst);
    const expressionVariables = collectVariables(ast);
    const variables =
        variableOrder === undefined ? expressionVariables : validateVariableOrder(variableOrder, expressionVariables);
    const values = [];
    for (let row = 0; row < 2 ** variables.length; row += 1) {
        values.push(evaluateNode(ast, assignmentForRow(variables, row)));
    }
    return { variables: [...variables], values };
}

function areEquivalent(leftExpressionOrAst, rightExpressionOrAst, variableOrder) {
    const leftAst = resolveAst(leftExpressionOrAst);
    const rightAst = resolveAst(rightExpressionOrAst);
    const leftVariables = collectVariables(leftAst);
    const rightVariables = collectVariables(rightAst);
    const expressionVariables = contract.variableOrder.filter(
        variable => leftVariables.includes(variable) || rightVariables.includes(variable),
    );
    const variables =
        variableOrder === undefined ? expressionVariables : validateVariableOrder(variableOrder, expressionVariables);

    for (let row = 0; row < 2 ** variables.length; row += 1) {
        const assignment = assignmentForRow(variables, row);
        if (evaluateNode(leftAst, assignment) !== evaluateNode(rightAst, assignment)) return false;
    }
    return true;
}

function normalizeTruthVector(vector) {
    if (vector === null || typeof vector !== 'object' || Array.isArray(vector)) {
        throw new TypeError('Boolean truth vector must be an object.');
    }
    const variables = validateVariableOrder(vector.variables, []);
    if (!Array.isArray(vector.values)) throw new TypeError('Boolean truth vector values must be an array.');
    const expectedLength = 2 ** variables.length;
    if (vector.values.length !== expectedLength) {
        throw new TypeError(`Boolean truth vector must contain exactly ${expectedLength} values.`);
    }
    if (vector.values.some(value => value !== 0 && value !== 1 && value !== 'X')) {
        throw new TypeError('Boolean truth vector values only accept 0, 1, or X.');
    }
    return { variables, values: [...vector.values] };
}

function vectorToMinterms(vector) {
    const normalized = normalizeTruthVector(vector);
    const minterms = [];
    const dontCares = [];
    normalized.values.forEach((value, index) => {
        if (value === 1) minterms.push(index);
        if (value === 'X') dontCares.push(index);
    });
    return { variables: normalized.variables, minterms, dontCares };
}

function mintermToProduct(variables, minterm) {
    return variables
        .map((variable, index) => {
            const shift = variables.length - index - 1;
            return ((minterm >> shift) & 1) === 1 ? variable : `!${variable}`;
        })
        .join('*');
}

function vectorToCanonicalSop(vector) {
    const normalized = normalizeTruthVector(vector);
    if (normalized.variables.length === 0) return normalized.values[0] === 1 ? '1' : '0';
    const { minterms } = vectorToMinterms(normalized);
    if (minterms.length === 0) return '0';
    return minterms.map(minterm => mintermToProduct(normalized.variables, minterm)).join('+');
}

function normalizeMintermModel(model) {
    if (model === null || typeof model !== 'object' || Array.isArray(model)) {
        throw new TypeError('Boolean minterm model must be an object.');
    }
    const variables = validateVariableOrder(model.variables, []);
    const minterms = model.minterms;
    const dontCares = model.dontCares ?? [];
    if (!Array.isArray(minterms) || !Array.isArray(dontCares)) {
        throw new TypeError("Boolean minterms and don't-cares must be arrays.");
    }
    const maximum = 2 ** variables.length - 1;
    const indicesAreValid = indices =>
        new Set(indices).size === indices.length &&
        indices.every(index => Number.isInteger(index) && index >= 0 && index <= maximum);
    if (!indicesAreValid(minterms) || !indicesAreValid(dontCares)) {
        throw new TypeError(`Boolean minterm indices must be unique integers from 0 through ${maximum}.`);
    }
    if (minterms.some(minterm => dontCares.includes(minterm))) {
        throw new TypeError("Boolean minterms and don't-cares must not overlap.");
    }
    return {
        variables,
        minterms: [...minterms].sort((left, right) => left - right),
        dontCares: [...dontCares].sort((left, right) => left - right),
    };
}

function mintermsToVector(model) {
    const normalized = normalizeMintermModel(model);
    const values = Array(2 ** normalized.variables.length).fill(0);
    normalized.dontCares.forEach(index => {
        values[index] = 'X';
    });
    normalized.minterms.forEach(index => {
        values[index] = 1;
    });
    return { variables: normalized.variables, values };
}

function grayLabels(bitCount) {
    return Array.from({ length: 2 ** bitCount }, (_, index) =>
        (index ^ (index >> 1)).toString(2).padStart(bitCount, '0'),
    );
}

function kmapAxes(variables) {
    const rowVariableCount = variables.length === 4 ? 2 : 1;
    const rowVariables = variables.slice(0, rowVariableCount);
    const columnVariables = variables.slice(rowVariableCount);
    return {
        rowVariables,
        columnVariables,
        rowLabels: grayLabels(rowVariables.length),
        columnLabels: grayLabels(columnVariables.length),
    };
}

function kmapIndex(rowLabel, columnLabel) {
    return Number.parseInt(`${rowLabel}${columnLabel}`, 2);
}

function vectorToKmapModel(vector) {
    const normalized = normalizeTruthVector(vector);
    if (normalized.variables.length < 2 || normalized.variables.length > 4) {
        throw new TypeError('Boolean K-map requires two through four variables.');
    }
    const axes = kmapAxes(normalized.variables);
    const cells = axes.rowLabels.map((rowLabel, row) =>
        axes.columnLabels.map((columnLabel, column) => {
            const index = kmapIndex(rowLabel, columnLabel);
            return {
                row,
                column,
                index,
                value: normalized.values[index],
                assignment: assignmentForRow(normalized.variables, index),
            };
        }),
    );
    return {
        schemaVersion: 1,
        variables: normalized.variables,
        rowVariables: axes.rowVariables,
        columnVariables: axes.columnVariables,
        rowLabels: axes.rowLabels,
        columnLabels: axes.columnLabels,
        cells,
    };
}

function kmapModelToVector(model) {
    if (model === null || typeof model !== 'object' || Array.isArray(model)) {
        throw new TypeError('Boolean K-map model must be an object.');
    }
    const variables = validateVariableOrder(model.variables, []);
    if (variables.length < 2 || variables.length > 4) {
        throw new TypeError('Boolean K-map requires two through four variables.');
    }
    const axes = kmapAxes(variables);
    const validRows =
        Array.isArray(model.cells) &&
        model.cells.length === axes.rowLabels.length &&
        model.cells.every(row => Array.isArray(row) && row.length === axes.columnLabels.length);
    if (!validRows) throw new TypeError('Boolean K-map cell layout does not match Gray-code order.');

    const values = Array(2 ** variables.length).fill(0);
    axes.rowLabels.forEach((rowLabel, row) => {
        axes.columnLabels.forEach((columnLabel, column) => {
            const expectedIndex = kmapIndex(rowLabel, columnLabel);
            const cell = model.cells[row][column];
            if (
                cell === null ||
                typeof cell !== 'object' ||
                cell.index !== expectedIndex ||
                (cell.value !== 0 && cell.value !== 1 && cell.value !== 'X')
            ) {
                throw new TypeError('Boolean K-map cell layout does not match Gray-code order.');
            }
            values[expectedIndex] = cell.value;
        });
    });
    return { variables, values };
}

function compareText(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

function patternForIndex(index, width) {
    return width === 0 ? '' : index.toString(2).padStart(width, '0');
}

function combinePatterns(left, right) {
    let differences = 0;
    let combined = '';
    for (let index = 0; index < left.length; index += 1) {
        if (left[index] === right[index]) {
            combined += left[index];
            continue;
        }
        if (left[index] === '-' || right[index] === '-') return null;
        differences += 1;
        if (differences > 1) return null;
        combined += '-';
    }
    return combined;
}

function findPrimePatterns(indices, width) {
    let current = [...new Set(indices.map(index => patternForIndex(index, width)))].sort(compareText);
    const primes = new Set();

    while (current.length > 0) {
        const used = new Set();
        const next = new Set();
        for (let leftIndex = 0; leftIndex < current.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < current.length; rightIndex += 1) {
                const combined = combinePatterns(current[leftIndex], current[rightIndex]);
                if (combined !== null) {
                    used.add(current[leftIndex]);
                    used.add(current[rightIndex]);
                    next.add(combined);
                }
            }
        }
        current.filter(pattern => !used.has(pattern)).forEach(pattern => primes.add(pattern));
        current = [...next].sort(compareText);
    }
    return [...primes].sort(compareText);
}

function patternCovers(pattern, minterm, width) {
    const bits = patternForIndex(minterm, width);
    return [...pattern].every((bit, index) => bit === '-' || bit === bits[index]);
}

function patternToTerm(pattern, variables) {
    const literals = [...pattern].flatMap((bit, index) => {
        if (bit === '-') return [];
        return [bit === '1' ? variables[index] : `!${variables[index]}`];
    });
    return literals.length === 0 ? '1' : literals.join('*');
}

function selectedImplicants(primes, minterms) {
    const candidatesByMinterm = new Map(
        minterms.map(minterm => [
            minterm,
            primes.map((prime, index) => ({ prime, index })).filter(({ prime }) => prime.minterms.includes(minterm)),
        ]),
    );
    const essential = new Set();
    for (const candidates of candidatesByMinterm.values()) {
        if (candidates.length === 1) essential.add(candidates[0].index);
    }

    const isCovered = (minterm, selected) => [...selected].some(index => primes[index].minterms.includes(minterm));
    let best = null;

    function consider(selected) {
        const uncovered = minterms.filter(minterm => !isCovered(minterm, selected));
        if (uncovered.length === 0) {
            const indices = [...selected].sort((left, right) => left - right);
            const implicants = indices
                .map(index => primes[index])
                .sort((left, right) => compareText(left.term, right.term));
            const score = {
                implicants: implicants.length,
                literals: implicants.reduce((total, implicant) => total + implicant.literals, 0),
                key: implicants.map(implicant => `${implicant.term}:${implicant.pattern}`).join('|'),
            };
            if (
                best === null ||
                score.implicants < best.score.implicants ||
                (score.implicants === best.score.implicants && score.literals < best.score.literals) ||
                (score.implicants === best.score.implicants &&
                    score.literals === best.score.literals &&
                    compareText(score.key, best.score.key) < 0)
            ) {
                best = { score, implicants };
            }
            return;
        }
        if (best !== null && selected.size >= best.score.implicants) return;

        const nextMinterm = uncovered
            .map(minterm => ({ minterm, candidates: candidatesByMinterm.get(minterm) }))
            .sort((left, right) => left.candidates.length - right.candidates.length || left.minterm - right.minterm)[0];
        for (const candidate of nextMinterm.candidates) {
            const nextSelected = new Set(selected);
            nextSelected.add(candidate.index);
            consider(nextSelected);
        }
    }

    consider(essential);
    return best.implicants;
}

function minimizeSop(vector) {
    const normalized = normalizeTruthVector(vector);
    const { minterms, dontCares } = vectorToMinterms(normalized);
    if (minterms.length === 0) {
        return {
            variables: normalized.variables,
            expression: '0',
            implicants: [],
            cost: { implicants: 0, literals: 0 },
        };
    }

    const width = normalized.variables.length;
    const primePatterns = findPrimePatterns([...minterms, ...dontCares], width);
    const primes = primePatterns
        .map(pattern => ({
            pattern,
            term: patternToTerm(pattern, normalized.variables),
            literals: [...pattern].filter(bit => bit !== '-').length,
            minterms: minterms.filter(minterm => patternCovers(pattern, minterm, width)),
        }))
        .filter(implicant => implicant.minterms.length > 0);
    const selection = selectedImplicants(primes, minterms);
    const implicants = selection.map(({ pattern, term, minterms: coveredMinterms }) => ({
        pattern,
        term,
        minterms: [...coveredMinterms],
    }));
    return {
        variables: normalized.variables,
        expression: implicants.map(implicant => implicant.term).join('+'),
        implicants,
        cost: {
            implicants: implicants.length,
            literals: selection.reduce((total, implicant) => total + implicant.literals, 0),
        },
    };
}

module.exports = {
    BooleanSyntaxError,
    areEquivalent,
    createTruthVector,
    evaluate,
    getVariables,
    kmapModelToVector,
    minimizeSop,
    mintermsToVector,
    parse,
    tokenize,
    vectorToCanonicalSop,
    vectorToKmapModel,
    vectorToMinterms,
};
