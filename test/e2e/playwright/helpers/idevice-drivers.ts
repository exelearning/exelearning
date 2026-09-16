/**
 * Real-UI drivers for the gradable iDevices, bound to any content iframe.
 *
 * Every gradable iDevice runtime is driven the same way whatever hosts it — what
 * changes between hosts is only the id of the iframe the package runs in:
 *
 *   mod_exelearning   `#exelearningobject`   (the simulated serving model)
 *   mod_scorm         `#scorm_object`        (Moodle core's player)
 *   mod_exescorm      `#exescorm_object`     (the eXeLearning fork's player)
 *
 * So the interaction logic lives here once, parameterised by frame id, and the host
 * adapters in `lms-host.ts` bind it. `moodle-serving-model.ts` re-exports the
 * `#exelearningobject` binding so its own callers are unaffected.
 *
 * Nothing here knows about grading: a driver clicks what a learner clicks and waits
 * for what a learner would see. What the click is worth is the scenario's business.
 */
import type { Page } from '@playwright/test';

/** Every interaction a scenario can perform on a gradable iDevice. */
export interface IdeviceDriver {
    /** The iframe this driver reaches into. */
    readonly frameId: string;
    waitForScormActive(timeout?: number): Promise<void>;
    waitForInFrame(selector: string, timeout?: number): Promise<void>;
    scrollToInFrame(selector: string): Promise<void>;
    answerTrueOrFalse(ideviceId: string, questionIndex: number, value: 0 | 1): Promise<void>;
    checkTrueOrFalse(ideviceId: string): Promise<void>;
    dragDropInstance(ideviceId: string): Promise<number>;
    dragCard(instance: number, cardId: number, targetId: number): Promise<void>;
    checkDragDrop(instance: number): Promise<void>;
    dragDropStates(instance: number): Promise<Record<string, string>>;
    scrambledListOrderIndex(ideviceId: string): Promise<number>;
    scrambledListOrigIndices(listOrder: number): Promise<number[]>;
    sortScrambledList(listOrder: number, wanted: number[]): Promise<void>;
    checkScrambledList(listOrder: number): Promise<void>;
    answerForm(ideviceId: string, questionIndex: number, value: 0 | 1): Promise<void>;
    waitForFormBound(ideviceId: string, timeout?: number): Promise<void>;
    checkForm(ideviceId: string): Promise<void>;
}

/**
 * Bind the iDevice drivers to one page and one content iframe.
 *
 * @param page the Playwright page holding the iframe
 * @param frameId the iframe's element id, without the leading '#'
 * @returns a driver whose every method targets that iframe
 */
export function createIdeviceDriver(page: Page, frameId: string): IdeviceDriver {
    const sel = `#${frameId}`;
    const frame = () => page.frameLocator(sel);

    /**
     * Press one of the activity's own controls.
     *
     * Dispatched on the element rather than at its coordinates. The host owns the viewport
     * the package sits in — Moodle pins a navbar over the top of it — and an activity's
     * check button that happens to line up with that navbar is unclickable by pointer even
     * after scrolling: measured as two lost cells of a 400-cell Firefox run, both reported
     * as `<nav class="navbar fixed-top"> intercepts pointer events`. The handler under test
     * is the activity's; the host's chrome is not part of the question.
     *
     * @param selector the control, inside the content frame
     */
    const press = async (selector: string): Promise<void> => {
        const control = frame().locator(selector);
        await control.waitFor({ state: 'attached' });
        await control.scrollIntoViewIfNeeded().catch(() => {});
        await control.evaluate(element => (element as HTMLElement).click());
    };

    return {
        frameId,

        /**
         * Wait until the package's SCORM connection is live inside the iframe.
         *
         * Gating on `pipwerks.SCORM.connection.isActive` rather than on a DOM node is
         * deliberate: until the connection is up, `pipwerks.SCORM.set()` is a documented
         * no-op and nothing an interaction produces would reach `window.API`.
         */
        async waitForScormActive(timeout = 30000): Promise<void> {
            await page.waitForFunction(
                id => {
                    const f = document.getElementById(id) as HTMLIFrameElement | null;
                    const w = f?.contentWindow as unknown as
                        | { pipwerks?: { SCORM?: { connection?: { isActive?: boolean } } } }
                        | undefined;
                    return !!w?.pipwerks?.SCORM && w.pipwerks.SCORM.connection?.isActive === true;
                },
                frameId,
                { timeout },
            );
        },

        /** Wait until a selector exists inside the package iframe. */
        async waitForInFrame(selector: string, timeout = 30000): Promise<void> {
            await page.waitForFunction(
                ([id, s]) => {
                    const f = document.getElementById(id) as HTMLIFrameElement | null;
                    const d = f?.contentDocument;
                    return !!d && !!d.querySelector(s);
                },
                [frameId, selector] as const,
                { timeout },
            );
        },

        /**
         * Scroll the PARENT window so an element inside the iframe is clickable.
         *
         * The margin is not a fixed 60px: a real Moodle player has a `position: fixed`
         * navbar over the top of the page, and an element scrolled to y=60 sits UNDER it.
         * Playwright then reports "subtree intercepts pointer events" and retries until
         * the action times out. Measuring whatever is actually pinned to the top of the
         * host page keeps one driver working in every host.
         */
        async scrollToInFrame(selector: string): Promise<void> {
            await page.evaluate(
                ([id, s]) => {
                    const f = document.getElementById(id) as HTMLIFrameElement | null;
                    const d = f?.contentDocument;
                    const el = d?.querySelector(s) as HTMLElement | null;
                    if (!f || !el) throw new Error(`scrollToInFrame: ${s} not found in #${id}`);

                    let banner = 0;
                    for (const node of Array.from(document.body.querySelectorAll('*'))) {
                        const style = getComputedStyle(node);
                        if (style.position !== 'fixed' && style.position !== 'sticky') continue;
                        const box = (node as HTMLElement).getBoundingClientRect();
                        if (box.top <= 0 && box.height > 0 && box.width > window.innerWidth / 2) {
                            banner = Math.max(banner, box.bottom);
                        }
                    }

                    const top = f.getBoundingClientRect().top + window.scrollY + el.getBoundingClientRect().top;
                    window.scrollTo(0, Math.max(0, top - banner - 40));
                },
                [frameId, selector] as const,
            );
        },

        /**
         * trueorfalse — click one answer radio.
         *
         * @param value 1 = true, 0 = false (the radio's `value`)
         */
        async answerTrueOrFalse(ideviceId: string, questionIndex: number, value: 0 | 1): Promise<void> {
            const selector =
                `#tofPGameContainer-${ideviceId} .TOFP-QuestionDiv[data-number="${questionIndex}"] ` +
                `.TOFP-Answer[value="${value}"]`;
            await this.scrollToInFrame(selector);
            // Click the radio itself rather than at its coordinates. The host page owns
            // the viewport the iframe sits in — Moodle pins a navbar over the top of it,
            // and the iDevice reflows as questions are answered — so a pointer click can
            // be intercepted by something that is not part of the activity at all. What
            // is under test is the runtime's scoring, not whether Moodle's chrome is in
            // the way.
            await frame()
                .locator(selector)
                .evaluate(element => (element as HTMLElement).click());
        },

        /** trueorfalse — its own check button (`gameOver()` -> `sendScore(true)`). */
        async checkTrueOrFalse(ideviceId: string): Promise<void> {
            // Answering reveals feedback and moves the button; scroll to the button
            // itself, not to the container it was in before the answers were entered.
            await this.scrollToInFrame(`#tofPCheckTest-${ideviceId}`);
            await press(`#tofPCheckTest-${ideviceId}`);
        },

        /**
         * dragdrop — the PAGE-GLOBAL instance index of the board inside `ideviceId`.
         *
         * Element ids are keyed by `$eXeDragDrop.activities.each(function (i))`, not by
         * the iDevice id, so this resolves `i` from the DOM.
         */
        async dragDropInstance(ideviceId: string): Promise<number> {
            return (await page.evaluate(
                ([id, node]) => {
                    const f = document.getElementById(id) as HTMLIFrameElement | null;
                    const d = f?.contentDocument as Document;
                    const host = d.getElementById(node);
                    const main = host?.querySelector('[id^="dadPMainContainer-"]');
                    if (!main) throw new Error(`no dragdrop board inside #${node}`);
                    return parseInt(main.id.replace('dadPMainContainer-', ''), 10);
                },
                [frameId, ideviceId] as const,
            )) as number;
        },

        /**
         * dragdrop — drag the source card onto the target with real mouse events
         * (jQuery UI draggable/droppable). Both sides are matched on `data-id` because
         * both containers are reshuffled on every load.
         */
        async dragCard(instance: number, cardId: number, targetId: number): Promise<void> {
            const source = frame()
                .locator(`#dadPDragSourcesContainer-${instance} .DADP-DS[data-id="${cardId}"]`)
                .first();
            const target = frame()
                .locator(`#dadPDragTargetsContainer-${instance} .DADP-DragTargetContainer[data-id="${targetId}"]`)
                .first();
            await source.scrollIntoViewIfNeeded();
            const from = await source.boundingBox();
            const to = await target.boundingBox();
            if (!from || !to) throw new Error(`dragdrop ${instance}: card ${cardId} or target ${targetId} has no box`);
            await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
            await page.mouse.down();
            // jQuery UI needs several moves past its distance threshold before it starts.
            for (let step = 1; step <= 8; step++) {
                await page.mouse.move(
                    from.x + from.width / 2 + ((to.x + to.width / 2 - (from.x + from.width / 2)) * step) / 8,
                    from.y + from.height / 2 + ((to.y + to.height / 2 - (from.y + from.height / 2)) * step) / 8,
                );
            }
            await page.mouse.up();
        },

        /** dragdrop — its own check button (`checkState()` -> `sendScore(true)`). */
        async checkDragDrop(instance: number): Promise<void> {
            await this.scrollToInFrame(`#dadPCheckButton-${instance}`);
            await press(`#dadPCheckButton-${instance}`);
        },

        /**
         * dragdrop — the live state of every card, keyed by card id ('0' = correct).
         *
         * `moveCard()` writes the state with jQuery's `.data()`, which updates jQuery's
         * internal store and NOT the `data-state` attribute — and `checkStateDrags()`
         * reads it back the same way. Reading the attribute would always report the
         * authored value, so this goes through the frame's own jQuery, like the scorer.
         */
        async dragDropStates(instance: number): Promise<Record<string, string>> {
            return (await page.evaluate(
                ([id, i]) => {
                    const f = document.getElementById(id as string) as HTMLIFrameElement | null;
                    const w = f?.contentWindow as unknown as {
                        jQuery: (s: unknown) => {
                            each: (cb: (i: number, el: Element) => void) => void;
                            data: (k: string) => unknown;
                        };
                    };
                    const out: Record<string, string> = {};
                    w.jQuery(`#dadPGameContainer-${i} .DADP-DS`).each((_: number, el: Element) => {
                        const $el = w.jQuery(el);
                        out[String($el.data('id'))] = String($el.data('state'));
                    });
                    return out;
                },
                [frameId, instance] as const,
            )) as Record<string, string>;
        },

        /** scrambled-list — the PAGE-GLOBAL `listOrder` of the list inside `ideviceId`. */
        async scrambledListOrderIndex(ideviceId: string): Promise<number> {
            return (await page.evaluate(
                ([id, node]) => {
                    const f = document.getElementById(id) as HTMLIFrameElement | null;
                    const d = f?.contentDocument as Document;
                    const host = d.getElementById(node);
                    const ul = host?.querySelector('ul[id^="exe-sortableList-"]');
                    if (!ul) throw new Error(`no sortable list inside #${node}`);
                    return parseInt(ul.id.replace('exe-sortableList-', ''), 10);
                },
                [frameId, ideviceId] as const,
            )) as number;
        },

        /** scrambled-list — the current `data-orig-index` of every `li`, in display order. */
        async scrambledListOrigIndices(listOrder: number): Promise<number[]> {
            return (await page.evaluate(
                ([id, order]) => {
                    const f = document.getElementById(id as string) as HTMLIFrameElement | null;
                    const d = f?.contentDocument as Document;
                    const lis = d.querySelectorAll(`#exe-sortableList-${order} > li`);
                    return Array.from(lis).map(li => parseInt(String(li.getAttribute('data-orig-index')), 10));
                },
                [frameId, listOrder] as const,
            )) as number[];
        },

        /**
         * scrambled-list — reorder into `wanted` (an array of `data-orig-index` values in
         * the order they should end up) using ONLY the runtime's own up-arrows.
         *
         * Selection sort: for each target position, find where that item currently is and
         * click its `.up` arrow until it arrives. The runtime re-renders the arrows after
         * every move, so everything is re-queried each iteration.
         */
        async sortScrambledList(listOrder: number, wanted: number[]): Promise<void> {
            for (let position = 0; position < wanted.length; position++) {
                for (let guard = 0; guard < wanted.length + 2; guard++) {
                    const current = await this.scrambledListOrigIndices(listOrder);
                    const at = current.indexOf(wanted[position]);
                    if (at === -1) throw new Error(`orig-index ${wanted[position]} not in list ${listOrder}`);
                    if (at === position) break;
                    // Dispatch the click on the element itself rather than through the
                    // pointer. The arrow is a real anchor with a real handler, but whether
                    // it is *visible* depends on the host: mod_exescorm sizes its player
                    // iframe differently from mod_scorm, and an arrow scrolled out of the
                    // iframe's own viewport fails Playwright's visibility check even with
                    // `force`. What is under test is the runtime's reordering, not the
                    // host's iframe height.
                    await frame()
                        .locator(`#exe-sortableList-${listOrder} > li`)
                        .nth(at)
                        .locator('a.up')
                        .first()
                        .evaluate(element => (element as HTMLElement).click());
                }
            }
        },

        /** scrambled-list — its own check button (`check()` -> `sendScore()`). */
        async checkScrambledList(listOrder: number): Promise<void> {
            await this.scrollToInFrame(`#exe-sortableListButton-${listOrder}`);
            await press(`#exe-sortableListButton-${listOrder} input[type="button"]`);
        },

        /**
         * form — click one true/false radio.
         *
         * @param value 1 = true, 0 = false
         */
        async answerForm(ideviceId: string, questionIndex: number, value: 0 | 1): Promise<void> {
            const radio = frame()
                .locator(
                    `#frmMainContainer-${ideviceId} li.FormView_question[data-question-index="${questionIndex}"] ` +
                        `.true-false-radio-buttons-container input[value="${value}"]`,
                )
                .first();
            await radio.scrollIntoViewIfNeeded().catch(() => {});
            await radio.evaluate(element => (element as HTMLElement).click());

            // Verify the answer took, and retry once.
            //
            // The form binds its handlers asynchronously, so a click can land on a radio
            // that is in the DOM but not yet wired: the input looks answered to nobody and
            // the iDevice scores as if the question were skipped. Measured: one cell of a
            // 400-cell run recorded `ide-d;…;75;…` for the same click sequence that scored
            // 100 everywhere else, which read as a difference between two LMS hosts until
            // the per-item payload showed it was this.
            for (let attempt = 0; attempt < 2; attempt++) {
                if (await radio.isChecked()) return;
                await radio.evaluate(element => (element as HTMLElement).click());
            }
            if (!(await radio.isChecked())) {
                throw new Error(`form ${ideviceId} question ${questionIndex} did not register the answer`);
            }
        },

        /**
         * form — wait until the runtime has BOUND its buttons.
         *
         * `renderBehaviour()` renders the questions synchronously but defers
         * `setBehaviourButtonCheckQuestions()` into a `setInterval(..., 200)`. Clicking
         * as soon as the questions exist therefore clicks an unbound button and nothing
         * happens at all — no score, silently. Poll jQuery's event store instead.
         */
        async waitForFormBound(ideviceId: string, timeout = 30000): Promise<void> {
            await page.waitForFunction(
                ([id, node]) => {
                    const f = document.getElementById(id) as HTMLIFrameElement | null;
                    const w = f?.contentWindow as unknown as
                        | { jQuery?: { _data?: (el: Element, key: string) => unknown } }
                        | undefined;
                    const d = f?.contentDocument as Document | null;
                    const btn = d?.getElementById(`form-button-check-${node}`);
                    if (!btn || !w?.jQuery?._data) return false;
                    const events = w.jQuery._data(btn, 'events') as { click?: unknown[] } | undefined;
                    return !!events?.click?.length;
                },
                [frameId, ideviceId] as const,
                { timeout },
            );
        },

        /** form — its own check button (`gameOver()` -> `checkAllQuestions()` -> `sendScore()`). */
        async checkForm(ideviceId: string): Promise<void> {
            await this.scrollToInFrame(`#form-button-check-${ideviceId}`);
            await press(`#form-button-check-${ideviceId}`);
        },
    };
}
