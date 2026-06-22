import '../../../../../../../public/vitest.setup.js';

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadExportIdevice(code) {
    const modifiedCode = code
        .replace(
            /var\s+\$eXeSeleccionaMedias\s*=/,
            'global.$eXeSeleccionaMedias ='
        )
        .replace(
            /\$\(function\s*\(\)\s*\{\s*\$eXeSeleccionaMedias\.init\(\);\s*\}\);?/g,
            ''
        );
    // eslint-disable-next-line no-eval
    (0, eval)(modifiedCode);
    return global.$eXeSeleccionaMedias;
}

function loadExport() {
    const code = readFileSync(join(__dirname, 'select-media-files.js'), 'utf-8');
    let modified = code.replace(/var\s+\$eXeSeleccionaMedias\s*=/, 'global.$eXeSeleccionaMedias =');
    modified = modified.replace(
        /\$\(function\s*\(\)\s*\{\s*\$eXeSeleccionaMedias\.init\(\);\s*\}\);?/g,
        '',
    );
    // eslint-disable-next-line no-eval
    (0, eval)(modified);
    return global.$eXeSeleccionaMedias;
}

describe('select-media-files iDevice export — SCORM score', () => {
    let $eXeSeleccionaMedias;
    let originalMedia;
    let originalReport;
    let originalSendScoreNew;

    beforeEach(() => {
        // checkQuestion/gameOver defer a setTimeout(gameOver, ...) callback that
        // bare-references $eXeSeleccionaMedias; fake timers keep it from leaking
        // past teardown (where the audio suite deletes the global).
        vi.useFakeTimers();
        global.$eXeSeleccionaMedias = undefined;
        const code = readFileSync(join(__dirname, 'select-media-files.js'), 'utf-8');
        $eXeSeleccionaMedias = loadExportIdevice(code);

        originalMedia = global.$exeDevices.iDevice.gamification.media;
        originalReport = global.$exeDevices.iDevice.gamification.report;
        originalSendScoreNew =
            global.$exeDevices.iDevice.gamification.scorm.sendScoreNew;
        global.$exeDevices.iDevice.gamification.media = {
            stopSound: vi.fn(),
        };
        global.$exeDevices.iDevice.gamification.report = {
            saveEvaluation: vi.fn(),
            updateEvaluationIcon: vi.fn(),
        };
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew = vi.fn();
    });

    afterEach(() => {
        global.$exeDevices.iDevice.gamification.media = originalMedia;
        global.$exeDevices.iDevice.gamification.report = originalReport;
        global.$exeDevices.iDevice.gamification.scorm.sendScoreNew =
            originalSendScoreNew;
        document.body.innerHTML = '';
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('does not register its own unload or beforeunload SCORM handlers', () => {
        const code = readFileSync(
            join(__dirname, 'select-media-files.js'),
            'utf-8'
        );

        expect(code).not.toMatch(
            /beforeunload|unload\.eXeSeleccionaMedias|endScorm/
        );
    });

    it('does not initialize scorerp to zero on load', () => {
        const code = readFileSync(
            join(__dirname, 'select-media-files.js'),
            'utf-8'
        );

        expect(code).not.toContain('mOption.scorerp = 0');
    });

    it('does not save score while updating an intermediate wrong answer', () => {
        const instance = 0;
        document.body.innerHTML = `
            <div id="slcmpPNumber-${instance}"></div>
            <div id="slcmpPErrors-${instance}"></div>
            <div id="slcmpPScore-${instance}"></div>
            <div id="slcmpPHits-${instance}"></div>
            <div id="slcmpMultimedia-${instance}"></div>
        `;
        $eXeSeleccionaMedias.options[instance] = {
            errors: 0,
            hits: 0,
            isScorm: 1,
            itinerary: { percentageClue: 80 },
            numberQuestions: 2,
            phrasesGame: [{}, {}],
            score: 0,
            showSolution: false,
        };
        vi.spyOn($eXeSeleccionaMedias, 'nextPhrase').mockImplementation(() => {});

        $eXeSeleccionaMedias.updateScore(false, instance);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).not.toHaveBeenCalled();
        expect(global.$exeDevices.iDevice.gamification.report.saveEvaluation).not.toHaveBeenCalled();
        expect($eXeSeleccionaMedias.nextPhrase).toHaveBeenCalledWith(instance);
    });

    it('saves score when the player answers correctly', () => {
        const instance = 0;
        document.body.innerHTML = `
            <div id="slcmpCheck-${instance}"></div>
            <div id="slcmpMultimedia-${instance}">
                <div class="SLCMP-GridItem SLCMP-Select"></div>
            </div>
            <div id="slcmpMessage-${instance}"></div>
            <div id="slcmpPNumber-${instance}"></div>
            <div id="slcmpPErrors-${instance}"></div>
            <div id="slcmpPScore-${instance}"></div>
            <div id="slcmpPHits-${instance}"></div>
        `;
        $(`#slcmpMultimedia-${instance} .SLCMP-GridItem`).data('state', true);
        $eXeSeleccionaMedias.options[instance] = {
            active: 0,
            customMessages: false,
            errors: 0,
            hits: 0,
            isScorm: 1,
            itinerary: { percentageClue: 80 },
            msgs: {
                msgAllOK: 'Correct',
            },
            numberQuestions: 1,
            phrasesGame: [{}],
            repeatActivity: true,
            score: 0,
            showSolution: false,
        };

        $eXeSeleccionaMedias.checkQuestion(instance);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                scorerp: 10,
            })
        );
    });

    it('saves score when the player exhausts attempts', () => {
        const instance = 0;
        document.body.innerHTML = `
            <div id="slcmpCheck-${instance}"></div>
            <div id="slcmpMultimedia-${instance}">
                <div class="SLCMP-GridItem"></div>
            </div>
            <div id="slcmpMessage-${instance}"></div>
            <div id="slcmpReboot-${instance}"></div>
            <div id="slcmpPNumber-${instance}"></div>
            <div id="slcmpPErrors-${instance}"></div>
            <div id="slcmpPScore-${instance}"></div>
            <div id="slcmpPHits-${instance}"></div>
        `;
        $(`#slcmpMultimedia-${instance} .SLCMP-GridItem`).data('state', true);
        $eXeSeleccionaMedias.options[instance] = {
            active: 0,
            customMessages: false,
            errors: 0,
            hits: 0,
            intentos: 1,
            isScorm: 1,
            itinerary: { percentageClue: 80 },
            msgs: {
                msgAgain: 'Try again',
                msgFailures: 'Wrong',
            },
            numberQuestions: 1,
            phrasesGame: [{}],
            repeatActivity: true,
            score: 0,
            showSolution: false,
        };
        vi.spyOn($eXeSeleccionaMedias, 'getRetroFeedMessages').mockReturnValue('Wrong');

        $eXeSeleccionaMedias.checkQuestion(instance);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                scorerp: 0,
            })
        );
    });

    it('saves score when the game finishes', () => {
        const instance = 0;
        document.body.innerHTML = `
            <div id="slcmpCubierta-${instance}"></div>
            <div id="slcmpCodeAccessDiv-${instance}"></div>
        `;
        $eXeSeleccionaMedias.options[instance] = {
            errors: 0,
            feedBack: false,
            gameStarted: true,
            hits: 1,
            isScorm: 1,
            msgs: {
                msgYouScore: 'Your score',
            },
            numberQuestions: 2,
            phrasesGame: [{}, {}],
            score: 5,
        };
        vi.spyOn($eXeSeleccionaMedias, 'desactivateHover').mockImplementation(() => {});
        vi.spyOn($eXeSeleccionaMedias, 'showScoreGame').mockImplementation(() => {});
        vi.spyOn($eXeSeleccionaMedias, 'showFeedBack').mockImplementation(() => {});

        $eXeSeleccionaMedias.gameOver(1, instance);

        expect(global.$exeDevices.iDevice.gamification.scorm.sendScoreNew).toHaveBeenCalledWith(
            true,
            expect.objectContaining({
                gameOver: true,
                gameStarted: false,
                scorerp: 5,
            })
        );
    });

    describe('getScore', () => {
        it('computes (hits * 10) / numberQuestions on a 0-10 scale', () => {
            $eXeSeleccionaMedias.options[0] = { hits: 3, numberQuestions: 4 };
            expect($eXeSeleccionaMedias.getScore(0)).toBe(7.5);
        });

        it('returns 0 when numberQuestions is zero (no division by zero)', () => {
            $eXeSeleccionaMedias.options[0] = { hits: 3, numberQuestions: 0 };
            expect($eXeSeleccionaMedias.getScore(0)).toBe(0);
        });

        it('returns 0 when numberQuestions is missing or not numeric', () => {
            $eXeSeleccionaMedias.options[0] = { hits: 3 };
            expect($eXeSeleccionaMedias.getScore(0)).toBe(0);
        });

        it('treats a missing hits count as 0', () => {
            $eXeSeleccionaMedias.options[0] = { numberQuestions: 4 };
            expect($eXeSeleccionaMedias.getScore(0)).toBe(0);
        });
    });
});

describe('select-media-files iDevice export — audio icon + autoplay gating', () => {
    let media;
    let dmedia;

    beforeEach(() => {
        global.$eXeSeleccionaMedias = undefined;
        media = { playSound: vi.fn(), stopSound: vi.fn() };
        global.$exeDevices = { iDevice: { gamification: { media } } };
        dmedia = loadExport();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        delete global.$exeDevices;
        delete global.$eXeSeleccionaMedias;
    });

    describe('showPhrase audio icon + autoplay gating', () => {
        const instance = 0;

        function setup(phrases) {
            dmedia.options[instance] = {
                active: 0,
                attempsNumber: 1,
                phrasesGame: phrases,
            };
            // Isolate showPhrase from the card/image/message rendering helpers.
            dmedia.addCards = () => {};
            dmedia.showImage = () => {};
            dmedia.showMessage = () => {};
            document.body.innerHTML = `
                <a href="#" id="slcmpAudioDef-${instance}" style="display:none"></a>
                <div id="slcmpQuestion-${instance}"></div>
            `;
        }

        it('shows the speaker icon and does NOT autoplay on the first question (num === 0)', () => {
            setup([{ definition: 'Q0', audioDefinition: 'audio0.mp3', cards: [] }]);
            dmedia.showPhrase(0, instance);
            const icon = document.getElementById(`slcmpAudioDef-${instance}`);
            expect(icon.style.display).toBe('block');
            expect(media.playSound).not.toHaveBeenCalled();
        });

        it('shows the speaker icon AND autoplays when navigating to a later question (num > 0)', () => {
            setup([
                { definition: 'Q0', audioDefinition: 'audio0.mp3', cards: [] },
                { definition: 'Q1', audioDefinition: 'audio1.mp3', cards: [] },
            ]);
            dmedia.showPhrase(1, instance);
            const icon = document.getElementById(`slcmpAudioDef-${instance}`);
            expect(icon.style.display).toBe('block');
            expect(media.playSound).toHaveBeenCalledWith('audio1.mp3');
        });

        it('keeps the icon hidden when the statement has no audio', () => {
            setup([{ definition: 'Q0', audioDefinition: '', cards: [] }]);
            dmedia.showPhrase(0, instance);
            const icon = document.getElementById(`slcmpAudioDef-${instance}`);
            expect(icon.style.display).toBe('none');
            expect(media.playSound).not.toHaveBeenCalled();
        });
    });

    describe('startGame never autoplays the statement audio', () => {
        const instance = 0;

        it('starts the game silently even when the first statement has audio', () => {
            dmedia.options[instance] = {
                phrasesGame: [{ definition: 'Q0', audioDefinition: 'audio0.mp3', cards: [] }],
                phrase: { definition: 'Q0', audioDefinition: 'audio0.mp3', cards: [] },
                time: 0,
                attempts: 0,
                gameStarted: false,
                itinerary: { showCodeAccess: false },
            };
            // activateHover/uptateTime touch unrelated DOM; stub them out.
            dmedia.activateHover = () => {};
            dmedia.uptateTime = () => {};

            dmedia.startGame(instance);

            expect(media.playSound).not.toHaveBeenCalled();
            expect(dmedia.options[instance].gameStarted).toBe(true);
        });
    });
});

describe('select-media-files iDevice export — Masonry guard', () => {
    let dmedia;
    let hadMasonry;
    let originalMasonry;

    beforeEach(() => {
        // initializeMasonry retries via setTimeout; fake timers keep it deterministic.
        vi.useFakeTimers();
        global.$eXeSeleccionaMedias = undefined;
        dmedia = loadExport();
        // Masonry is an optional dependency not present in the test runtime.
        // Snapshot whatever (if anything) is on $.fn so we can restore it cleanly.
        hadMasonry = Object.prototype.hasOwnProperty.call($.fn, 'masonry');
        originalMasonry = $.fn.masonry;
        delete $.fn.masonry;
        document.body.innerHTML = '';
    });

    afterEach(() => {
        if (hadMasonry) {
            $.fn.masonry = originalMasonry;
        } else {
            delete $.fn.masonry;
        }
        document.body.innerHTML = '';
        vi.clearAllTimers();
        vi.useRealTimers();
        delete global.$eXeSeleccionaMedias;
    });

    function gridMarkup(instance) {
        document.body.innerHTML = `
            <div id="slcmpMainContainer-${instance}">
                <div class="SLCMP-Multimedia">
                    <div class="SLCMP-GridItem"></div>
                </div>
            </div>
        `;
    }

    it('isMasonryReady reflects whether the plugin is registered on jQuery', () => {
        expect(dmedia.isMasonryReady()).toBe(false);
        $.fn.masonry = vi.fn();
        expect(dmedia.isMasonryReady()).toBe(true);
    });

    it('does not throw when the masonry plugin is missing on first layout', () => {
        gridMarkup(0);
        expect(() => dmedia.initializeMasonry(0)).not.toThrow();
    });

    it('initializes masonry with grid options when the plugin is available', () => {
        gridMarkup(0);
        const masonry = vi.fn();
        $.fn.masonry = masonry;

        dmedia.initializeMasonry(0);

        expect(masonry).toHaveBeenCalledWith({
            itemSelector: '.SLCMP-GridItem',
            columnWidth: '.SLCMP-GridItem',
            gutter: 10,
        });
        expect(masonry).toHaveBeenCalledWith('reloadItems');
        expect(masonry).toHaveBeenCalledWith('layout');
    });

    it('retries until the plugin becomes available, then initializes', () => {
        gridMarkup(0);
        dmedia.initializeMasonry(0); // plugin missing -> schedules a retry
        const masonry = vi.fn();
        $.fn.masonry = masonry;
        vi.advanceTimersByTime(200); // retry fires; plugin is now present
        expect(masonry).toHaveBeenCalled();
    });

    it('falls back to table mode when the plugin never loads', () => {
        gridMarkup(0);
        dmedia.initializeMasonry(0, 1); // one retry left
        vi.advanceTimersByTime(200); // retry exhausts the budget -> fallback
        const $grid = $('#slcmpMainContainer-0').find('.SLCMP-Multimedia');
        expect($grid.hasClass('SLCMP-ModeTable')).toBe(true);
    });

    it('returns early without scheduling a retry when the grid is absent', () => {
        expect(() => dmedia.initializeMasonry(99)).not.toThrow();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('destroyMasonry is a no-op when the plugin is missing', () => {
        gridMarkup(0);
        expect(() => dmedia.destroyMasonry()).not.toThrow();
    });

    it('destroyMasonry calls masonry("destroy") when the plugin is available', () => {
        gridMarkup(0);
        const masonry = vi.fn();
        $.fn.masonry = masonry;
        dmedia.destroyMasonry();
        expect(masonry).toHaveBeenCalledWith('destroy');
    });
});
