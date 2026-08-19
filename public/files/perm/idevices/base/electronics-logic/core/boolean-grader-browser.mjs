import core from './boolean-core.js';
import grader from './boolean-grader.js';
import kmapGroupValidator from './kmap-group-validator.js';
import circuitNetlist from './circuit-netlist.js';

if (typeof globalThis !== 'undefined') {
    globalThis.$electronicsLogicCore = core;
    globalThis.$electronicsLogicGrader = grader;
    globalThis.$electronicsLogicKmapValidator = kmapGroupValidator;
    globalThis.$electronicsLogicCircuitNetlist = circuitNetlist;
}
