/**
 * iDevice content through each iDevice's own AI tab.
 *
 * Every game iDevice with an AI tab publishes a line format (one item per
 * line, fields separated by #) and a prompt that asks a model for it. These
 * tools hand that prompt to the agent and feed the agent's lines back through
 * the iDevice's own import callback, so the iDevice keeps the only copy of its
 * data shape and rendering.
 */
import { optionalString, requireString } from './validators.js';

/** iDevice type → format id of `share.getAllowedFormats()` (the `getTabIA(n)` of each edition). */
export const AI_FORMAT_IDS = {
    'adaptative-quiz': 10,
    'az-quiz-game': 1,
    classify: 5,
    crossword: 9,
    discover: 0,
    'electrical-circuits': 11,
    flipcards: 0,
    form: 7,
    guess: 0,
    identify: 4,
    'quick-questions': 2,
    'quick-questions-multiple-choice': 3,
    relate: 0,
    'scrambled-list': 8,
    trueorfalse: 6,
    'word-search': 9,
};

export const AI_IDEVICE_TYPES = Object.keys(AI_FORMAT_IDS);

const EDITION_TIMEOUT_MS = 20000;
const POLL_MS = 50;

function getShare() {
    const share = globalThis.$exeDevicesEdition?.iDevice?.gamification?.share;
    if (!share || typeof share.buildIAPromptText !== 'function') {
        throw new Error('The iDevice edition helpers are not loaded');
    }
    return share;
}

function requireAiIdeviceType(value) {
    const ideviceType = requireString(value, 'ideviceType');
    if (!Object.hasOwn(AI_FORMAT_IDS, ideviceType)) {
        throw new Error(`ideviceType must be one of: ${AI_IDEVICE_TYPES.join(', ')}`);
    }
    return ideviceType;
}

/** Lines from a string or an array, without the code fences models wrap them in. */
export function normalizeAiLines(value) {
    const raw = Array.isArray(value) ? value : String(value ?? '').split('\n');
    const lines = raw.map((line) => String(line).trim()).filter((line) => line && !line.startsWith('```'));
    if (!lines.length) {
        throw new Error('lines must contain at least one line in the iDevice format');
    }
    return lines;
}

export function getIdeviceAiPrompt(args = {}) {
    const ideviceType = requireAiIdeviceType(args.ideviceType);
    const share = getShare();
    const formatId = AI_FORMAT_IDS[ideviceType];
    const options = args.numLevels ? { numLevels: args.numLevels } : {};
    const { format, explanation, examples } = share.getAllowedFormats(formatId, options);
    return {
        ideviceType,
        prompt: share.buildIAPromptText(formatId, options),
        format,
        explanation,
        examples,
        next: 'Generate the lines for the requested topic following this prompt, then pass them to exe.idevices.ai_content.import.',
    };
}

async function waitUntil(check, timeoutMs = EDITION_TIMEOUT_MS) {
    const deadline = Date.now() + timeoutMs;
    while (!check()) {
        if (Date.now() > deadline) return false;
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    return true;
}

async function showPage(service, pageId) {
    if (pageId === service.getSelectedPageId()) {
        await service.refreshStructure(pageId);
    } else {
        await service.app.project.structure.selectNode(pageId);
    }
}

/**
 * Add AI-format lines to an iDevice: open its editor, run its own import
 * callback and save it, exactly as the AI tab's Save button does.
 */
export async function importIdeviceAiContent(service, args = {}) {
    const ideviceType = requireAiIdeviceType(args.ideviceType);
    const lines = normalizeAiLines(args.lines);
    const share = getShare();
    // Reject unusable input before touching the project. Five levels is the
    // widest adaptative-quiz format; the open iDevice re-checks with its own.
    const precheck = share.splitAILines(AI_FORMAT_IDS[ideviceType], lines, { numLevels: 5 });
    if (!precheck.validLines.length) {
        throw new Error(`No line matches the ${ideviceType} format: ${precheck.invalidLines.join(' | ')}`);
    }
    const engine = service.app?.project?.idevices;
    if (!engine) throw new Error('The iDevice engine is not available');
    if (engine.isIdeviceInEdition()) {
        throw new Error('Another iDevice is open in the editor; save or discard it first');
    }

    let componentId = optionalString(args.componentId);
    let pageId;
    let blockId = null;
    if (componentId) {
        pageId = service.requirePageId(args.pageId);
    } else {
        const target = service.prepareIdeviceTarget(args);
        ({ pageId, blockId } = target);
        const initialData = service.buildComponentInitialData({ title: optionalString(args.title) || target.blockName });
        componentId = service.getBridge().addComponent(pageId, blockId, ideviceType, initialData);
        if (!componentId) throw new Error(`Could not create a ${ideviceType} iDevice on page ${pageId}`);
    }

    await showPage(service, pageId);
    const node = engine.getIdeviceById(componentId);
    if (!node) throw new Error(`Component ${componentId} is not on page ${pageId}`);
    if (node.odeIdeviceTypeName !== ideviceType) {
        throw new Error(`Component ${componentId} is a ${node.odeIdeviceTypeName} iDevice, not ${ideviceType}`);
    }

    // The edit button runs every guard of a manual edit (locks, malformed data).
    const editButton = () => node.ideviceButtons?.querySelector(`#editIdevice${componentId}`);
    if (!(await waitUntil(() => editButton() && !editButton().disabled))) {
        throw new Error(`Component ${componentId} cannot be edited right now`);
    }
    editButton().click();
    const opened = await waitUntil(() => share.aiImport?.lifecycle?.ownerNode === node);
    if (!opened) throw new Error(`The editor of component ${componentId} did not open`);

    const { validLines, invalidLines, result } = await share.importAILines(lines);
    if (!validLines.length) {
        await node.save(false);
        throw new Error(`No line matches the ${ideviceType} format: ${invalidLines.join(' | ')}`);
    }
    if (!(await node.save(true))) {
        throw new Error('The iDevice rejected the content; it stays open in the editor');
    }

    return {
        pageId,
        blockId,
        componentId,
        ideviceType,
        addedLines: validLines.length,
        invalidLines,
        ...(Array.isArray(result?.remainingLines) ? { notAdded: result.remainingLines } : {}),
        component: service.getStructureBinding().getComponent(componentId),
    };
}
