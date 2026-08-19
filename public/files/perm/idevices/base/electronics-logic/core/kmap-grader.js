'use strict';

const core = require('./boolean-core.js');
const { validateKmapGroup } = require('./kmap-group-validator.js');

const WEIGHTS = Object.freeze({ cells: 0.3, groups: 0.4, sop: 0.3 });

function passedRatio(checks) {
    return checks.filter(check => check.passed).length / checks.length;
}

function gradeKmapResponse({ expected, response, variableCount, maxScore }) {
    const model = core.vectorToKmapModel(expected);
    const cellChecks = model.cells.flatMap((row, rowIndex) =>
        row.map((cell, columnIndex) => {
            const expectedValue = String(cell.value);
            const actual = response.cells[rowIndex][columnIndex];
            return {
                id: `kmap-cell-${cell.index}`,
                passed: expectedValue === 'X' || actual === expectedValue,
                expected: expectedValue,
                actual,
            };
        }),
    );

    const stringValues = expected.values.map(String);
    const groupResults = response.groups.map(group =>
        validateKmapGroup({ variableCount, cells: group.cells, values: stringValues }),
    );
    const groupValidityChecks = response.groups.map((group, index) => ({
        id: `kmap-group-${group.id}`,
        passed: groupResults[index].valid,
        expected: 'valid-group',
        actual: groupResults[index].valid ? 'valid-group' : groupResults[index].reason,
    }));
    const coverageChecks = core.vectorToMinterms(expected).minterms.map(index => {
        const covered = response.groups.some(
            (group, groupIndex) => groupResults[groupIndex].valid && group.cells.includes(index),
        );
        return {
            id: `kmap-coverage-${index}`,
            passed: covered,
            expected: 'covered',
            actual: covered ? 'covered' : 'not-covered',
        };
    });
    const groupDimensionChecks = coverageChecks.concat(groupValidityChecks);
    if (groupDimensionChecks.length === 0) {
        groupDimensionChecks.push({
            id: 'kmap-groups-not-required',
            passed: true,
            expected: 'no-groups-needed',
            actual: 'no-groups-needed',
        });
    }

    const equivalent = groupDimensionChecks.every(check => check.passed);
    const equivalenceCheck = {
        id: 'kmap-sop-equivalence',
        passed: equivalent,
        expected: 'covers-exactly-required-minterms',
        actual: equivalent ? 'covers-exactly-required-minterms' : 'incorrect-or-incomplete-coverage',
    };
    const expectedMinimal = core.minimizeSop(expected);
    const learnerImplicants = response.groups.length;
    const learnerLiterals = response.groups.reduce(
        (sum, group) => sum + (variableCount - Math.log2(group.cells.length)),
        0,
    );
    const minimal =
        equivalent &&
        learnerImplicants === expectedMinimal.cost.implicants &&
        learnerLiterals === expectedMinimal.cost.literals;
    const minimalCheck = {
        id: 'kmap-sop-minimal',
        passed: minimal,
        expected: `${expectedMinimal.cost.implicants} nhóm, ${expectedMinimal.cost.literals} literal`,
        actual: equivalent ? `${learnerImplicants} nhóm, ${learnerLiterals} literal` : 'not-equivalent',
        solution: expectedMinimal.expression,
    };

    const cellScore = passedRatio(cellChecks) * maxScore * WEIGHTS.cells;
    const groupScore = passedRatio(groupDimensionChecks) * maxScore * WEIGHTS.groups;
    const sopScore = passedRatio([equivalenceCheck, minimalCheck]) * maxScore * WEIGHTS.sop;
    return {
        score: Number((cellScore + groupScore + sopScore).toFixed(4)),
        checks: cellChecks.concat(groupDimensionChecks, [equivalenceCheck, minimalCheck]),
    };
}

module.exports = {
    WEIGHTS,
    gradeKmapResponse,
};
