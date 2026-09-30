/**
 * Import-time split of the Interactive Video "content before / content after"
 * fields into sibling Text iDevices.
 *
 * Early builds of the reworked Interactive Video iDevice carried two rich-text
 * boxes (`contentBefore` / `contentAfter`) inside its jsonProperties. The
 * final model drops them: content around the video belongs to ordinary Text
 * iDevices in the same block. This pass runs on the imported page structures
 * (before Yjs materialization) and, for every interactive-video component that
 * still carries those fields:
 *
 *   - creates a Text iDevice with the `contentBefore` HTML right BEFORE it,
 *     and one with the `contentAfter` HTML right AFTER it — but only when the
 *     field carries real content (text or embedded media);
 *   - strips both fields from the interactive-video jsonProperties either
 *     way, so re-exports never carry them again.
 *
 * Legacy (pre-v3) content never had these fields, so it passes through
 * untouched.
 */

import { generateId } from '../ids';
import type { BlockData, ComponentData, PageData } from './interfaces';

const INTERACTIVE_VIDEO_TYPE = 'interactive-video';
const TEXT_TYPE = 'text';

/**
 * True when the HTML carries actual content for a learner: visible text after
 * stripping tags, or embedded media that has no text representation.
 */
export function hasMeaningfulHtml(html: unknown): html is string {
    if (typeof html !== 'string' || html.trim() === '') {
        return false;
    }
    if (/<(img|video|audio|iframe|object|embed|svg|canvas)\b/i.test(html)) {
        return true;
    }
    const text = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .trim();
    return text !== '';
}

/**
 * A minimal, valid Text iDevice component wrapping `html`. The authoritative
 * content field is `jsonProperties.textTextarea` (what the workarea edits);
 * `htmlView` mirrors the text iDevice's own renderView output (its export
 * template around the content) so static exports render without a re-save.
 */
function buildTextComponent(html: string, createdAt: string): ComponentData {
    const id = generateId('idevice');
    return {
        id: id,
        ideviceId: id,
        ideviceType: TEXT_TYPE,
        type: TEXT_TYPE,
        order: 0, // renumbered with the whole block below
        createdAt: createdAt,
        htmlView: '<div class="exe-text-template">\n    ' + html + '\n</div>',
        properties: { ideviceId: id, textTextarea: html },
        componentProps: {},
        structureProps: {},
    };
}

/**
 * Split one block's components; returns true when a sibling was inserted.
 * Also called (through the importers bundle) by the single `.idevice`/`.block`
 * import path in `public/app/yjs/ComponentImporter.js`, whose imported block
 * has the same structural shape.
 */
export function splitInteractiveVideoBlock(block: BlockData): boolean {
    const components = Array.isArray(block.components) ? block.components : [];
    const expanded: ComponentData[] = [];
    let inserted = false;
    for (const component of components) {
        if (!component || component.ideviceType !== INTERACTIVE_VIDEO_TYPE || !component.properties) {
            expanded.push(component);
            continue;
        }
        const props = component.properties;
        const before = props.contentBefore;
        const after = props.contentAfter;
        // Strip the fields either way — empty leftovers must not survive into
        // the Y.Doc (and from there into every future export).
        delete props.contentBefore;
        delete props.contentAfter;
        if (hasMeaningfulHtml(before)) {
            expanded.push(buildTextComponent(before, component.createdAt));
            inserted = true;
        }
        expanded.push(component);
        if (hasMeaningfulHtml(after)) {
            expanded.push(buildTextComponent(after, component.createdAt));
            inserted = true;
        }
    }
    if (inserted) {
        block.components = expanded;
        // `order` is written verbatim into the Y.Doc and re-emitted on export,
        // so the whole block is renumbered to keep it dense and consistent.
        expanded.forEach((component, index) => {
            component.order = index;
        });
    }
    return inserted;
}

/**
 * Run the split over every block of the imported page structures (both the
 * modern content.xml path and the legacy contentv3.xml path call this before
 * materializing Y types). Mutates the structures in place.
 */
export function splitInteractiveVideoSurroundingContent(pages: PageData[]): void {
    if (!Array.isArray(pages)) {
        return;
    }
    for (const page of pages) {
        const blocks = Array.isArray(page?.blocks) ? page.blocks : [];
        for (const block of blocks) {
            splitInteractiveVideoBlock(block);
        }
    }
}
