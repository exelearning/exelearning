import { test, expect } from '../../fixtures/auth.fixture';
import {
    waitForAppReady,
    gotoWorkarea,
    saveIdevice,
    editIdevice,
    getPreviewFrame,
    dismissBlockingAlertModal,
} from '../../helpers/workarea-helpers';
import {
    IV_IDEVICE as IDEVICE,
    IV_LOCAL_VIDEO_FIXTURE as LOCAL_VIDEO_FIXTURE,
    IV_YOUTUBE_URL as YOUTUBE_URL,
    addInteractiveVideo,
    getIdeviceId,
    previewFrame,
    uploadLocalVideo,
    waitForPlayableVideo,
} from '../../helpers/interactive-video-helpers';

/**
 * E2E tests for the reworked Interactive Video iDevice.
 *
 * The editor is now a single inline form with exactly three tabs — "General
 * settings" (holding the before-text, a collapsed "Options" fieldset and an
 * open "Video" fieldset that holds both the single source field and the
 * "Interactions" authoring surface, then the after-text), "SCORM" and "Custom
 * texts". Everything interaction-related lives on the
 * default-active first tab, so no tab hopping is needed. There is no detached
 * iframe / full-screen editor popup and no Video/Interactions/Behaviour/Preview
 * tabs (this replaces the previous four-tab spec).
 *
 * Coverage:
 *   A. Editor structure (3 tabs, first active, Options collapsed, no popup).
 *   B. Interaction authoring (question row + marker + single prompt; keyboard).
 *   C. Single choice (exclusive radios; invalid save blocked with an alert).
 *   D. True/False (dedicated radio pair, no repeater; persists through save).
 *   E. Cloze (mark selection as a plain-text [[…]] blank, never a <span>).
 *   F+G. Local video: "use current time" in the editor, and the runtime pausing
 *        at a timed question in the workarea Preview and resuming after answering.
 *   H. Several interactive videos coexisting on one page.
 *
 * The end-to-end learner cycle across all four surfaces (editor, saved workarea
 * view, Preview and the HTML5 export) for every interaction kind and all three
 * providers lives in `interactive-video-walkthrough.spec.ts`; the shared driving
 * helpers live in `helpers/interactive-video-helpers.ts`.
 */

test.describe('Interactive Video iDevice (reworked inline editor)', () => {
    // A. Editor structure -----------------------------------------------------
    test('renders an inline three-tab editor with everything on the first tab', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV Structure Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addInteractiveVideo(page);

        const form = page.locator('#interactiveVideoIdeviceForm');
        await expect(form).toBeVisible();

        // Exactly three tabs: General settings, Custom texts, SCORM.
        await expect(form.locator('.exe-form-tab')).toHaveCount(3);
        await expect(page.locator('#interactiveVideoIdeviceFormTabs > li')).toHaveCount(3);

        // The first tab (General settings) is active by default.
        await expect(page.locator('#interactiveVideoIdeviceFormTabs li').first().locator('a')).toHaveClass(
            /exe-form-active-tab/,
        );
        await expect(page.locator('#interactiveVideoIdeviceFormTab0')).toBeVisible();

        // Video + interactions fields are reachable without switching tabs.
        await expect(page.locator('#ivVideoFile')).toBeVisible();
        await expect(page.locator('#ivAddTime')).toBeVisible();
        await expect(page.locator('#ivInteractionList')).toBeVisible();

        // The Options fieldset (the one wrapping the behaviour/scoring fields) is
        // collapsed on the first tab.
        const options = page.locator('fieldset.exe-fieldset-closed', { has: page.locator('#ivCompletionMode') });
        await expect(options).toHaveCount(1);
        await expect(page.locator('#ivCompletionMode')).toBeHidden();

        // No detached editor: no full-screen modal and no legacy editor iframe.
        await expect(page.locator('.modal-fullscreen')).toHaveCount(0);
        await expect(page.locator(`${IDEVICE} iframe[src*="editor/index.html"]`)).toHaveCount(0);
    });

    // B. Interaction authoring (mouse + keyboard) -----------------------------
    test('adds a timed question (row + marker + single editor) and supports keyboard navigation', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV Authoring Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addInteractiveVideo(page);

        // Add a question at 00:05 via the add bar.
        await page.locator('#ivAddTime').fill('00:05');
        await page.locator('#ivAddQuestion').click();

        // A row appears in the list AND a marker in the strip; exactly one editor.
        await expect(page.locator('#ivInteractionList .exe-iv-edit-select')).toHaveCount(1);
        await expect(page.locator('#ivEditTimeline button[data-iv-id]')).toHaveCount(1);
        await expect(page.locator('#ivQuestionPrompt')).toHaveCount(1);
        await expect(page.locator('#ivInteractionList')).toContainText('00:05');

        // Add a second interaction so there are two rows to navigate.
        await page.locator('#ivAddTime').fill('00:10');
        await page.locator('#ivAddNote').click();
        await expect(page.locator('#ivInteractionList .exe-iv-edit-select')).toHaveCount(2);

        // Keyboard-only: arrows move the roving row focus, Enter expands, Esc collapses.
        const rows = page.locator('#ivInteractionList .exe-iv-edit-select');
        await rows.first().focus();
        await expect(rows.first()).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(rows.nth(1)).toBeFocused();
        await page.keyboard.press('ArrowUp');
        await expect(rows.first()).toBeFocused();

        await page.keyboard.press('Enter');
        await expect(rows.first()).toHaveAttribute('aria-expanded', 'true');
        await expect(page.locator('#ivDetailPanel')).toHaveCount(1);

        await page.keyboard.press('Escape');
        await expect(page.locator('#ivDetailPanel')).toHaveCount(0);
    });

    // B2. Cover (#4) ----------------------------------------------------------
    test('adds a cover pinned to the start of the video', async ({ authenticatedPage, createProject }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV Cover Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addInteractiveVideo(page);

        // The cover has its own distinct Add button.
        await page.locator('#ivAddCover').click();
        await expect(page.locator('#ivInteractionList .exe-iv-edit-select')).toHaveCount(1);
        // Pinned to the start: a fixed-time indicator, no editable time field.
        await expect(page.locator('.exe-iv-detail-fixed-time')).toHaveCount(1);
        await expect(page.locator('#ivDetailTime')).toHaveCount(0);
    });

    // C. Single choice --------------------------------------------------------
    test('single choice: exclusive correct radios; an invalid save is blocked with an alert', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV Single Choice Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addInteractiveVideo(page);

        // A valid video source is required before the question validation runs.
        await page.locator('#ivVideoFile').fill(YOUTUBE_URL);

        // Add a single-choice question (the default kind).
        await page.locator('#ivAddTime').fill('00:03');
        await page.locator('#ivAddQuestion').click();
        await page.locator('#ivQuestionPrompt').waitFor({ state: 'visible' });
        await page.locator('#ivQuestionPrompt').fill('Capital of France?');

        const answers = page.locator('#ivAnswers .exe-iv-answer-text');
        await answers.nth(0).fill('Madrid');
        await answers.nth(1).fill('Paris');

        // Correct-toggles are exclusive radios: selecting B deselects A.
        const correct = page.locator('#ivAnswers .exe-iv-answer-correct');
        await expect(correct.first()).toHaveAttribute('type', 'radio');
        await correct.nth(1).check();
        await expect(correct.nth(1)).toBeChecked();
        await expect(correct.nth(0)).not.toBeChecked();

        const ideviceId = await getIdeviceId(page);

        // Make the question invalid, then save. The radio UI cannot express a
        // 0- or 2-correct single choice, so we drive the UI-reachable invalid
        // state (fewer than two answers); it takes the same validate → alert →
        // stay-in-edit path.
        await answers.nth(1).fill('');
        await page.locator(`.idevice_node[id="${ideviceId}"] .btn-save-idevice`).click();

        // The save is blocked: an alert modal surfaces and the iDevice stays in
        // edition (scope to the wrapper — the engine sets the same id on the body too).
        await expect(page.locator('#modalAlert.show, #modalAlert[data-open="true"]')).toBeVisible();
        await expect(page.locator(`.idevice_node[id="${ideviceId}"]`)).toHaveAttribute('mode', 'edition');
        await dismissBlockingAlertModal(page);

        // Restore a valid single choice and confirm the save now succeeds.
        await answers.nth(1).fill('Paris');
        await saveIdevice(page, ideviceId);
        await expect(page.locator(`.idevice_node[id="${ideviceId}"]`)).not.toHaveAttribute('mode', 'edition');
    });

    // D. True/False -----------------------------------------------------------
    test('true/false renders a dedicated radio pair (no repeater) and persists through save', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV True False Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addInteractiveVideo(page);

        await page.locator('#ivVideoFile').fill(YOUTUBE_URL);

        await page.locator('#ivAddTime').fill('00:02');
        await page.locator('#ivAddQuestion').click();
        await page.locator('#ivQuestionKind').waitFor({ state: 'visible' });
        await page.locator('#ivQuestionKind').selectOption('trueFalse');

        // Exactly two True/False radios and no "+ Answer" repeater.
        await expect(page.locator('.exe-iv-tf-correct')).toHaveCount(2);
        await expect(page.locator('#ivAddAnswer')).toHaveCount(0);

        await page.locator('#ivQuestionPrompt').fill('The sky is green.');

        // Pick False and save.
        await page.locator('.exe-iv-tf-correct[value="0"]').check();
        await expect(page.locator('.exe-iv-tf-correct[value="0"]')).toBeChecked();

        const ideviceId = await getIdeviceId(page);
        await saveIdevice(page, ideviceId);

        // Reopen the editor and confirm False is still selected.
        await editIdevice(page, ideviceId);
        await page.locator('#ivInteractionList .exe-iv-edit-select').first().click();
        await page.locator('.exe-iv-tf-correct').first().waitFor({ state: 'visible' });
        await expect(page.locator('.exe-iv-tf-correct[value="0"]')).toBeChecked();
        await expect(page.locator('.exe-iv-tf-correct[value="1"]')).not.toBeChecked();
    });

    // E. Cloze ----------------------------------------------------------------
    test('cloze marks the selected word as a plain-text blank (never a <span>)', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV Cloze Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addInteractiveVideo(page);

        await page.locator('#ivAddTime').fill('00:04');
        await page.locator('#ivAddQuestion').click();
        await page.locator('#ivQuestionKind').waitFor({ state: 'visible' });
        await page.locator('#ivQuestionKind').selectOption('cloze');

        const prompt = page.locator('#ivQuestionPrompt');
        await prompt.fill('el caballo blanco');

        // Select the word "blanco" (indices 11..17) and mark it as a blank.
        await prompt.evaluate((el: HTMLTextAreaElement) => {
            el.focus();
            el.setSelectionRange(11, 17);
        });
        await page.locator('#ivClozeMark').click();

        await expect(prompt).toHaveValue('el caballo [[blanco]]');
        expect(await prompt.inputValue()).not.toContain('<span');
    });

    // F + G. Local video: use-current-time in the editor and the preview runtime
    test('local video: use-current-time in the editor, then the preview runtime pauses at a question and resumes', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(120000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV Local Video Runtime Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addInteractiveVideo(page);

        // Local file is the default provider; upload the fixture via the picker.
        await uploadLocalVideo(page, LOCAL_VIDEO_FIXTURE);

        // The inline editor player mounts as a native <video> with a blob src.
        await page.waitForFunction(
            () => {
                const v = document.getElementById('ivEditPlayerVideo') as HTMLVideoElement | null;
                return !!v && v.readyState >= 1 && isFinite(v.duration) && v.duration > 3;
            },
            undefined,
            { timeout: 20000 },
        );

        // G. Use current time: seek the inline video to ~3s and capture the playhead.
        await page.evaluate(() => {
            const v = document.getElementById('ivEditPlayerVideo') as HTMLVideoElement;
            v.currentTime = 3;
        });
        await page.waitForFunction(
            () => {
                const v = document.getElementById('ivEditPlayerVideo') as HTMLVideoElement | null;
                return !!v && v.currentTime >= 2.9 && !v.seeking;
            },
            undefined,
            { timeout: 10000 },
        );
        // Expected mm:ss is derived from the actual (floored) playhead — keyframe
        // seeking can land a few ms off, so we compare against the real value.
        const expectedTime = await page.evaluate(() => {
            const v = document.getElementById('ivEditPlayerVideo') as HTMLVideoElement;
            const total = Math.floor(v.currentTime);
            const mm = String(Math.floor(total / 60)).padStart(2, '0');
            const ss = String(total % 60).padStart(2, '0');
            return `${mm}:${ss}`;
        });
        await page.locator('#ivAddCurrentTime').click();
        await expect(page.locator('#ivAddTime')).toHaveValue(expectedTime);
        expect(expectedTime).toMatch(/^00:0[23]$/);

        // F. Add a question at 00:01 (pause=true by default) and save.
        await page.locator('#ivAddTime').fill('00:01');
        await page.locator('#ivAddQuestion').click();
        await page.locator('#ivQuestionPrompt').waitFor({ state: 'visible' });
        await page.locator('#ivQuestionPrompt').fill('What colour is a clear sky?');
        const answers = page.locator('#ivAnswers .exe-iv-answer-text');
        await answers.nth(0).fill('Blue');
        await answers.nth(1).fill('Green');
        await expect(page.locator('#ivDetailPause')).toBeChecked();

        const ideviceId = await getIdeviceId(page);
        await saveIdevice(page, ideviceId);

        // Open the workarea Preview and load the declarative runtime. The preview
        // reads live from the Y.Doc (client is source of truth), so no project
        // save is needed first. Click the eye button directly and wait for the
        // page <article> to attach before looking for the iDevice (the SW-served
        // iframe navigates a moment after the panel becomes visible).
        await page.click('#head-bottom-preview');
        await expect(page.locator('#previewsidenav')).toBeVisible({ timeout: 15000 });
        const frameLoc = getPreviewFrame(page);
        await frameLoc.locator('article').first().waitFor({ state: 'attached', timeout: 40000 });
        await frameLoc
            .locator('.exe-interactive-video-container, .exe-iv')
            .first()
            .waitFor({ state: 'attached', timeout: 20000 });
        const frame = await previewFrame(page);

        // F(a) + F(b): both runtime scripts loaded (globals defined) and the
        // preview document carries their <script> tags.
        await frame.waitForFunction(
            () =>
                typeof (window as { exeInteractiveVideoCore?: unknown }).exeInteractiveVideoCore !== 'undefined' &&
                typeof (window as { exeInteractiveVideoProviders?: unknown }).exeInteractiveVideoProviders !==
                    'undefined',
            undefined,
            { timeout: 20000 },
        );
        // The runtime is ONE self-contained bundle; the compatibility globals
        // asserted above are published by it.
        expect(await frame.locator('script[src*="interactive-video.js"]').count()).toBeGreaterThan(0);
        expect(
            await frame.evaluate(
                () => typeof (window as { exeInteractiveVideoCore?: unknown }).exeInteractiveVideoCore,
            ),
        ).not.toBe('undefined');

        // Wait for the local <video> to resolve to a playable (non-asset://) src.
        // The preview serves media over byte ranges, so the element buffers
        // progressively: wait for HAVE_FUTURE_DATA (3), not merely HAVE_CURRENT_DATA,
        // so play() starts advancing the clock immediately instead of stalling.
        await waitForPlayableVideo(frame);

        // F(c): play (muted, so autoplay policy allows it) → the scheduler pauses
        // at the interaction and shows the question overlay.
        await frame.evaluate(() => {
            const v = document.querySelector('video.exe-iv-video') as HTMLVideoElement;
            v.muted = true;
            try {
                v.currentTime = 0;
            } catch {
                /* not seekable yet */
            }
            return v.play().catch(() => {});
        });
        // Playback really started (the clock is moving)…
        await frame.waitForFunction(
            () => {
                const v = document.querySelector('video.exe-iv-video') as HTMLVideoElement | null;
                return !!v && v.currentTime > 0;
            },
            undefined,
            { timeout: 25000 },
        );
        // …and the scheduler then pauses at the interaction and fills the panel.
        await frame.waitForFunction(
            () => {
                const v = document.querySelector('video.exe-iv-video') as HTMLVideoElement | null;
                const overlay = document.querySelector('.exe-iv-overlay') as HTMLElement | null;
                if (!v || !overlay) return false;
                const overlayVisible = !overlay.hasAttribute('hidden');
                return v.currentTime >= 1 && v.paused === true && overlayVisible;
            },
            undefined,
            { timeout: 25000 },
        );
        const overlay = frameLoc.locator('.exe-iv-overlay');
        await expect(overlay).toContainText('What colour is a clear sky?');
        await expect(overlay.locator('.exe-iv-question')).toBeVisible();

        // F(d): answer, continue → the video resumes.
        await overlay.locator('input[type="radio"]').first().check();
        await overlay.locator('.exe-iv-check').click();
        await overlay.locator('.exe-iv-continue').waitFor({ state: 'visible', timeout: 10000 });
        await overlay.locator('.exe-iv-continue').click();
        await frame.waitForFunction(
            () => {
                const v = document.querySelector('video.exe-iv-video') as HTMLVideoElement | null;
                return !!v && v.paused === false;
            },
            undefined,
            { timeout: 15000 },
        );
    });

    // External provider stays non-networked: assert only the embed markup shape.
    test('youtube provider embeds inline with an enablejsapi nocookie URL (no live network)', async ({
        authenticatedPage,
        createProject,
    }) => {
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV YouTube Embed Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);
        await addInteractiveVideo(page);

        await page.locator('#ivVideoFile').fill(YOUTUBE_URL);
        await page.locator('#ivAddTime').fill('00:05');
        await page.locator('#ivAddNote').click();

        const ideviceId = await getIdeviceId(page);
        await saveIdevice(page, ideviceId);

        // The view-mode runtime embeds via a privacy-enhanced iframe — never a
        // new-window facade link.
        const embed = page.locator(`${IDEVICE} iframe.exe-iv-embed-frame`);
        await expect(embed).toHaveCount(1);
        const src = (await embed.getAttribute('src')) || '';
        expect(src).toContain('youtube-nocookie.com/embed/');
        expect(src).toContain('enablejsapi=1');
        await expect(page.locator(`${IDEVICE} a.exe-iv-embed-facade[target="_blank"]`)).toHaveCount(0);
    });

    // H. Multiple instances per page. The legacy iDevice hard-capped one
    // interactive video per page; the reworked runtime is instance-scoped, so
    // several can coexist. Each renders its own `#exe-iv-<id>` container and the
    // question controls are namespaced by instance id (asserted at DOM level by
    // the runtime unit tests) so radio groups and `<label for>` never collide.
    test('supports more than one interactive-video iDevice on the same page', async ({
        authenticatedPage,
        createProject,
    }) => {
        test.setTimeout(120000);
        const page = authenticatedPage;
        const projectUuid = await createProject(page, 'IV Multi-Instance Test');
        await gotoWorkarea(page, projectUuid);
        await waitForAppReady(page);

        // First interactive video (a note at 00:05).
        await addInteractiveVideo(page);
        await page.locator('#ivVideoFile').fill(YOUTUBE_URL);
        await page.locator('#ivAddTime').fill('00:05');
        await page.locator('#ivAddNote').click();
        const id1 = await getIdeviceId(page);
        await saveIdevice(page, id1);

        // Second interactive video ON THE SAME PAGE. Adding it is never blocked by
        // a one-per-page guard: addInteractiveVideo waits for the inline editor to
        // open, which would time out if the add were refused.
        await addInteractiveVideo(page);
        await page.locator('#ivVideoFile').fill(YOUTUBE_URL);
        await page.locator('#ivAddTime').fill('00:03');
        await page.locator('#ivAddQuestion').click();
        await page.locator('#ivQuestionPrompt').waitFor({ state: 'visible' });
        await page.locator('#ivQuestionPrompt').fill('Second video question?');
        const secondAnswers = page.locator('#ivAnswers .exe-iv-answer-text');
        await secondAnswers.nth(0).fill('Yes');
        await secondAnswers.nth(1).fill('No');

        // The new node is whichever interactive-video node is not the first.
        await expect(page.locator(IDEVICE)).toHaveCount(2);
        const id2 = (await page.locator(IDEVICE).evaluateAll(els => els.map(e => e.id))).find(x => x !== id1);
        if (!id2) throw new Error('second interactive-video iDevice id not found');
        expect(id2).not.toBe(id1);
        await saveIdevice(page, id2);

        // Both persist and each renders its own runtime container with a DISTINCT
        // id — the two videos do not collapse onto a shared container.
        await expect(page.locator(IDEVICE)).toHaveCount(2);
        const containerIds = await page.locator(`${IDEVICE} .exe-iv`).evaluateAll(els => els.map(e => e.id));
        expect(containerIds).toHaveLength(2);
        expect(new Set(containerIds).size).toBe(2);
        expect(containerIds.every(cid => cid.startsWith('exe-iv-'))).toBe(true);
    });
});
