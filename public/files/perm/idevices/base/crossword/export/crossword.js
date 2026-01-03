/* eslint-disable no-undef */
/**
 * Crucigrama activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Dieño: Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeCrucigrama = {
    idevicePath: '',
    borderColors: {
        black: '#0e1625',
        blue: '#4A90E2',
        green: '#66BB6A',
        red: '#FF6F61',
        white: '#FFF',
        deepblue: '#3A75C4',
    },
    colors: {
        black: '#0e1625',
        blue: '#4A90E2',
        green: '#66BB6A',
        red: '#FF6F61',
        white: '#ffffff',
        deepblue: '#3A75C4',
        grey: '#777777',
        incorrect: '#F22420',
        correct: '#3DA75A',
        game: 'rgba(0, 255, 0, 0.3)',
    },
    options: [],
    domCache: {},
    inputCache: {},
    hasSCORMbutton: false,
    isInExe: false,
    userName: '',
    previousScore: '',
    initialScore: '',
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,
    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Crossword',
            'crossword',
            'crucigrama-IDevice'
        );
    },

    initDOMCache: function (instance) {
        if (!this.domCache[instance]) {
            this.domCache[instance] = {
                crossword: $('#ccgmCrossword-' + instance),
                definitionsVList: $('#ccgmDefinitionsVList-' + instance),
                definitionsHList: $('#ccgmDefinitionsHList-' + instance),
                activeDefinition: $('#ccgmActiveDefinition-' + instance),
                mainContainer: $('#ccgmMainContainer-' + instance),
            };
        }
        return this.domCache[instance];
    },

    cacheInputsByPosition: function (instance) {
        if (!this.inputCache[instance]) {
            this.inputCache[instance] = {
                byPosition: {},
                byWordIndex: { vi: {}, hi: {} },
            };
        }

        const cache = this.inputCache[instance];
        const $crossword = this.domCache[instance].crossword;

        $crossword.find('input').each(function () {
            const $input = $(this);
            const row = $input.data('row');
            const col = $input.data('col');
            const vi = $input.data('vi');
            const hi = $input.data('hi');
            const lvi = $input.data('lvi');
            const lhi = $input.data('lhi');

            cache.byPosition[`${row}-${col}`] = $input;

            if (vi !== -1 && lvi !== -1) {
                if (!cache.byWordIndex.vi[vi]) cache.byWordIndex.vi[vi] = {};
                cache.byWordIndex.vi[vi][lvi] = $input;
            }
            if (hi !== -1 && lhi !== -1) {
                if (!cache.byWordIndex.hi[hi]) cache.byWordIndex.hi[hi] = {};
                cache.byWordIndex.hi[hi][lhi] = $input;
            }
        });
    },

    getCachedInput: function (instance, row, col) {
        const cache = this.inputCache[instance];
        return (cache && cache.byPosition[`${row}-${col}`]) || $();
    },

    getCachedInputByWordLetter: function (
        instance,
        wordindex,
        letterindex,
        isHorizontal
    ) {
        const cache = this.inputCache[instance];
        if (!cache) return $();

        const direction = isHorizontal ? 'hi' : 'vi';
        return (
            (cache.byWordIndex[direction][wordindex] &&
                cache.byWordIndex[direction][wordindex][letterindex]) ||
            $()
        );
    },

    cleanupInstance: function (instance) {
        if (this.domCache[instance]) {
            this.domCache[instance].crossword.off('.crossword-events');
        }

        delete this.domCache[instance];
        delete this.inputCache[instance];
    },

    generateCrossword: function (instance) {
        let mOptions = $eXeCrucigrama.options[instance];

        this.initDOMCache(instance);
        const cache = this.domCache[instance];
        let type = 0;

        cache.crossword.empty();
        cache.definitionsHList.empty();
        cache.definitionsVList.empty();

        mOptions.grid = Array(mOptions.boardSize)
            .fill()
            .map(() => Array(mOptions.boardSize).fill(null));
        mOptions.mappedWords = [];
        mOptions.occupiedRows.clear();
        mOptions.occupiedColumns.clear();

        const verticalWords = mOptions.wordsGame.slice(0, mOptions.half),
            horizontalWords = mOptions.wordsGame.slice(mOptions.half);

        $eXeCrucigrama.placeVerticalWords(instance, verticalWords);
        $eXeCrucigrama.placeHorizontalWords(instance, horizontalWords);

        let lettersShow = {};
        mOptions.wordsGame.forEach((wordObj, index) => {
            let sindices = $eXeCrucigrama.calculateLettersToShow(
                instance,
                wordObj.word
            );
            lettersShow[index] = sindices;
        });

        for (let row = 0; row < mOptions.boardSize; row++) {
            for (let col = 0; col < mOptions.boardSize; col++) {
                const $cell = $('<div>').addClass('CCGMP-Cell');
                if (mOptions.grid[row][col]) {
                    const cellData = mOptions.grid[row][col];
                    const hasHorizontal =
                        cellData.hi !== undefined && cellData.hi !== -1;
                    const hasVertical =
                        cellData.vi !== undefined && cellData.vi !== -1;

                    // Para determinar el wordindex principal (usado en data-wordindex)
                    const wordindex = hasHorizontal ? cellData.hi : cellData.vi,
                        indexLetter = hasHorizontal
                            ? cellData.lhi
                            : cellData.lvi,
                        word = mOptions.wordsGame[wordindex].word;

                    // Verificar si la letra debe mostrarse en cualquiera de las palabras
                    let shouldShowLetter = false;
                    if (hasHorizontal && lettersShow[cellData.hi]) {
                        shouldShowLetter = lettersShow[cellData.hi].includes(
                            cellData.lhi
                        );
                    }
                    if (
                        !shouldShowLetter &&
                        hasVertical &&
                        lettersShow[cellData.vi]
                    ) {
                        shouldShowLetter = lettersShow[cellData.vi].includes(
                            cellData.lvi
                        );
                    }

                    const $input = $('<input>').attr({
                        'data-row': row,
                        'data-col': col,
                        'data-wordindex': wordindex,
                        'data-hi':
                            mOptions.grid[row][col].hi !== undefined
                                ? mOptions.grid[row][col].hi
                                : -1,
                        'data-vi':
                            mOptions.grid[row][col].vi !== undefined
                                ? mOptions.grid[row][col].vi
                                : -1,
                        'data-lhi':
                            mOptions.grid[row][col].lhi !== undefined
                                ? mOptions.grid[row][col].lhi
                                : -1,
                        'data-lvi':
                            mOptions.grid[row][col].lvi !== undefined
                                ? mOptions.grid[row][col].lvi
                                : -1,
                        readonly: true,
                    });
                    if (shouldShowLetter) {
                        $input.val(word[indexLetter]);
                    }
                    $input.addClass('ccgm-input');
                    $cell.append($input);
                    if (mOptions.grid[row][col].numero) {
                        const $number = $('<span>')
                            .addClass('CCGMP-Number')
                            .text(Math.floor(mOptions.grid[row][col].numero));
                        $cell.append($number);
                    }
                } else {
                    const $input = $('<span>').prop('disabled', true);
                    $cell.append($input);
                }
                cache.crossword.append($cell);
            }
        }

        this.cacheInputsByPosition(instance);

        this.setupEventDelegation(instance);

        if (mOptions.hasBack) {
            const backgroundIconHTML = `
            <a  href="#" class="CCGMP-ToggleBackground" id="ccgmBackgroundIcon-${instance}" title="${mOptions.msgs.msgShowBack}">
                <strong class="sr-av">${mOptions.msgs.msgShowBack}</strong>
                <div class="CCGMP-IconsToolBar exeQuextIcons-background  CCGMP-Activo"></div>
             </a>`;

            cache.crossword.append(backgroundIconHTML);

            $(`#ccgmBackgroundIcon-${instance}`).on('click', function (e) {
                e.preventDefault();
                cache.crossword.toggleClass('CCGMP-NoBackground');
            });

            const backgroundUrl =
                mOptions.urlBack.length < 4
                    ? `${$eXeCrucigrama.idevicePath}ccgmbackground.jpg`
                    : `${mOptions.urlBack}`;

            cache.crossword.css({
                'background-image': `url(${backgroundUrl})`,
            });
        } else {
            cache.crossword.addClass('CCGMP-NoBackground');
        }
        $eXeCrucigrama.createDefinitionsList(instance);
    },

    setupEventDelegation: function (instance) {
        const mOptions = $eXeCrucigrama.options[instance];
        const cache = this.domCache[instance];

        cache.crossword.off('.crossword-events');

        cache.crossword.on(
            'focus.crossword-events',
            '.ccgm-input',
            function (e) {
                if (!mOptions.gameStarted) {
                    e.preventDefault();
                    return;
                }
                if ($(this).siblings('.CCGMP-Number').length > 0) {
                    const hi = parseInt($(this).data('hi')),
                        vi = parseInt($(this).data('vi')),
                        wordindex = hi !== -1 ? parseInt(hi) : parseInt(vi),
                        type = hi !== -1 ? true : false;
                    $eXeCrucigrama.highlightWord(instance, wordindex, type);
                    mOptions.activeQuestion = wordindex;
                }
            }
        );

        cache.crossword.on(
            'compositionstart.crossword-events',
            '.ccgm-input',
            function () {
                mOptions._imeComposing = true;
            }
        );

        cache.crossword.on(
            'compositionend.crossword-events',
            '.ccgm-input',
            function () {
                mOptions._imeComposing = false;
                $(this).trigger('input');
            }
        );

        cache.crossword.on(
            'keydown.crossword-events',
            '.ccgm-input',
            function (e) {
                if (!mOptions.gameStarted) {
                    e.preventDefault();
                    return;
                }

                if (
                    e.isComposing ||
                    (e.originalEvent && e.originalEvent.isComposing) ||
                    e.keyCode === 229 ||
                    e.key === 'Dead' ||
                    mOptions._imeComposing
                ) {
                    return;
                }

                const $this = $(this);
                const row = parseInt($this.data('row'));
                const col = parseInt($this.data('col'));
                const hi = $this.data('hi');
                const vi = $this.data('vi');
                let nextRow = row,
                    nextCol = col;

                if (e.key === 'Tab') {
                    $exeDevices.iDevice.gamification.media.stopSound(mOptions);
                    e.preventDefault();
                    let active = mOptions.activeQuestion;
                    active++;
                    mOptions.activeQuestion =
                        active >= mOptions.wordsGame.length ? 0 : active;
                    let wordindex = mOptions.activeQuestion,
                        mappedWord = mOptions.mappedWords[wordindex];
                    if (mappedWord && mappedWord.length > 0) {
                        let firstRow = mappedWord[0].row,
                            firstCol = mappedWord[0].col;
                        const $firstInput = $eXeCrucigrama.getCachedInput(
                            instance,
                            firstRow,
                            firstCol
                        );
                        if ($firstInput.length) {
                            $firstInput.focus();
                        }
                    }
                    $eXeCrucigrama.updateInputPresentation(
                        instance,
                        mOptions.activeQuestion
                    );
                    return;
                }

                $eXeCrucigrama.handleKeyNavigation(
                    instance,
                    e,
                    $this,
                    row,
                    col,
                    hi,
                    vi,
                    nextRow,
                    nextCol
                );
            }
        );

        cache.crossword.on(
            'input.crossword-events',
            '.ccgm-input',
            function () {
                const $this = $(this);
                const hi = $this.data('hi');
                const vi = $this.data('vi');

                if (mOptions._imeComposing) return;

                let raw = ($this.val() || '').normalize('NFC');
                const codepoints = Array.from(raw);
                const lastChar = codepoints[codepoints.length - 1] || '';
                const isValidLetterOrNumber = /[\p{L}\p{N}]/u.test(lastChar);

                if (isValidLetterOrNumber) {
                    $this.val(lastChar);
                    $eXeCrucigrama.moveToNextInput(instance, $this, hi, vi);
                    $eXeCrucigrama.updateInputPresentation(
                        instance,
                        mOptions.activeQuestion
                    );
                } else {
                    $this.val('');
                }
            }
        );

        cache.crossword.on(
            'click.crossword-events touchend.crossword-events',
            '.ccgm-input',
            function () {
                if (!mOptions.gameStarted && !mOptions.gameOver) return;
                const hi = parseInt($(this).data('hi'));
                const vi = parseInt($(this).data('vi'));
                let wordindex = hi !== -1 ? parseInt(hi) : parseInt(vi);
                $eXeCrucigrama.showActiveDefinition(instance, wordindex);
                $eXeCrucigrama.highlightWord(instance, wordindex, hi !== -1);
                mOptions.activeQuestion = wordindex;
                mOptions.focused = 0;
            }
        );
    },

    handleKeyNavigation: function (
        instance,
        e,
        $input,
        row,
        col,
        hi,
        vi,
        nextRow,
        nextCol
    ) {
        const mOptions = $eXeCrucigrama.options[instance];

        if (e.key === 'Enter') {
            e.preventDefault();
            if (hi !== -1 && mOptions.activeQuestion >= mOptions.half) {
                nextCol = col + 1;
                if (
                    nextCol >= mOptions.boardSize ||
                    !mOptions.grid[row][nextCol] ||
                    mOptions.grid[row][nextCol].hi !== hi
                ) {
                    nextCol = col;
                }
            } else if (vi !== -1 && mOptions.activeQuestion < mOptions.half) {
                nextRow = row + 1;
                if (
                    nextRow >= mOptions.boardSize ||
                    !mOptions.grid[nextRow][col] ||
                    mOptions.grid[nextRow][col].vi !== vi
                ) {
                    nextRow = row;
                }
            }
        } else if (
            e.key === 'ArrowRight' &&
            hi !== -1 &&
            mOptions.activeQuestion >= mOptions.half
        ) {
            e.preventDefault();
            nextCol = col + 1;
            if (
                nextCol >= mOptions.boardSize ||
                !mOptions.grid[row][nextCol] ||
                mOptions.grid[row][nextCol].hi !== hi
            ) {
                nextCol = col;
            }
        } else if (
            e.key === 'ArrowLeft' &&
            hi !== -1 &&
            mOptions.activeQuestion >= mOptions.half
        ) {
            e.preventDefault();
            nextCol = col - 1;
            if (
                nextCol < 0 ||
                !mOptions.grid[row][nextCol] ||
                mOptions.grid[row][nextCol].hi !== hi
            ) {
                nextCol = col;
            }
        } else if (
            e.key === 'ArrowDown' &&
            vi !== -1 &&
            mOptions.activeQuestion < mOptions.half
        ) {
            e.preventDefault();
            nextRow = row + 1;
            if (
                nextRow >= mOptions.boardSize ||
                !mOptions.grid[nextRow][col] ||
                mOptions.grid[nextRow][col].vi !== vi
            ) {
                nextRow = row;
            }
        } else if (
            e.key === 'ArrowUp' &&
            vi !== -1 &&
            mOptions.activeQuestion < mOptions.half
        ) {
            e.preventDefault();
            nextRow = row - 1;
            if (
                nextRow < 0 ||
                !mOptions.grid[nextRow][col] ||
                mOptions.grid[nextRow][col].vi !== vi
            ) {
                nextRow = row;
            }
        } else if (e.key === 'Backspace') {
            e.preventDefault();
            $input.val('');
            if (vi !== -1 && mOptions.activeQuestion < mOptions.half) {
                nextRow = row - 1;
                if (
                    nextRow < 0 ||
                    !mOptions.grid[nextRow][col] ||
                    mOptions.grid[nextRow][col].vi !== vi
                ) {
                    nextRow = row;
                }
            } else if (hi !== -1 && mOptions.activeQuestion >= mOptions.half) {
                nextCol = col - 1;
                if (
                    nextCol < 0 ||
                    !mOptions.grid[row][nextCol] ||
                    mOptions.grid[row][nextCol].hi !== hi
                ) {
                    nextCol = col;
                }
            }
            $eXeCrucigrama.updateInputPresentation(
                instance,
                mOptions.activeQuestion
            );
        } else if ($eXeCrucigrama.isIgnoredKey(e.key)) {
            e.preventDefault();
        }

        const $nextInput = $eXeCrucigrama.getCachedInput(
            instance,
            nextRow,
            nextCol
        );
        if ($nextInput.length) {
            $nextInput.focus();
        }
    },

    moveToNextInput: function (instance, $currentInput, hi, vi) {
        const mOptions = $eXeCrucigrama.options[instance];
        const row = parseInt($currentInput.data('row'));
        const col = parseInt($currentInput.data('col'));
        let nextRow = row,
            nextCol = col;

        if (mOptions.activeQuestion < mOptions.half) {
            nextRow = row + 1;
            if (
                nextRow >= mOptions.boardSize ||
                !mOptions.grid[nextRow][col] ||
                mOptions.grid[nextRow][col].vi !== vi
            ) {
                nextRow = row;
            }
        } else if (mOptions.activeQuestion >= mOptions.half) {
            nextCol = col + 1;
            if (
                nextCol >= mOptions.boardSize ||
                !mOptions.grid[row][nextCol] ||
                mOptions.grid[row][nextCol].hi !== hi
            ) {
                nextCol = col;
            }
        }

        const $nextInput = this.getCachedInput(instance, nextRow, nextCol);
        if ($nextInput.length) {
            $nextInput.focus();
        }
    },

    calculateLettersToShow: function (instance, word) {
        const mOptions = $eXeCrucigrama.options[instance],
            totalLetters = word.length,
            percentageToShow = (100 - mOptions.difficulty) / 100,
            lettersToShow = Math.floor(percentageToShow * totalLetters);

        let indices = Array.from(Array(totalLetters).keys());
        indices = indices
            .sort(() => Math.random() - 0.5)
            .slice(0, lettersToShow);
        return indices;
    },

    highlightWord: function (instance, wordindex, type) {
        const mOptions = $eXeCrucigrama.options[instance];

        if (!this.domCache[instance]) {
            this.initDOMCache(instance);
        }
        const cache = this.domCache[instance];

        let bdcolor = mOptions.gameOver
            ? `2px solid ${$eXeCrucigrama.colors.blue}`
            : `1px solid #ccc`;

        if (!mOptions.gameOver) {
            cache.crossword.find('.CCGMP-Cell input').css({
                'background-color': '#fff',
                'font-weight': 'normal',
                'border-color': '#ccc',
            });
        } else {
            cache.crossword.find('.CCGMP-Cell input').css({
                'border-color': '#ccc',
            });
        }

        let $cells = $();
        if (type) {
            const wordCache =
                this.inputCache[instance]?.byWordIndex?.hi?.[wordindex];
            if (wordCache) {
                $cells = $(Object.values(wordCache));
            } else {
                $cells = cache.crossword.find(`input[data-hi='${wordindex}']`);
            }
        } else {
            const wordCache =
                this.inputCache[instance]?.byWordIndex?.vi?.[wordindex];
            if (wordCache) {
                $cells = $(Object.values(wordCache));
            } else {
                $cells = cache.crossword.find(`input[data-vi='${wordindex}']`);
            }
        }

        $cells.each(function (index) {
            const $input = $(this);
            if (type) {
                $input.css({
                    'border-top': bdcolor,
                    'border-bottom': bdcolor,
                });
                if (index === 0) {
                    $input.css('border-left', bdcolor);
                }
                if (index === $cells.length - 1) {
                    $input.css('border-right', bdcolor);
                }
            } else {
                $input.css({
                    'border-left': bdcolor,
                    'border-right': bdcolor,
                });
                if (index === 0) {
                    $input.css('border-top', bdcolor);
                }
                if (index === $cells.length - 1) {
                    $input.css('border-bottom', bdcolor);
                }
            }
            if (!mOptions.gameOver) {
                $input.css({
                    'background-color': $eXeCrucigrama.colors.blue,
                    'font-weight': 'bold',
                    'border-color': bdcolor,
                });
            }
        });
    },

    showActiveDefinition: function (instance, wordindex) {
        const mOptions = $eXeCrucigrama.options[instance],
            $activeDefinition = $('#ccgmActiveDefinition-' + instance);

        wordindex = parseInt(wordindex);

        const readonly = mOptions.gameOver ? 'readonly' : '',
            input = `<label for="ccgmInputWord-${instance}" ${readonly} class="sr-av">${mOptions.msgs.msgSolutionWord}:</label> 
                    <input id="ccgmInputWord-${wordindex}"  data-number="${wordindex}" type="text" value="${mOptions.wordsGame[wordindex].word.replace(/./g, '_')}" class="CCGMP-InputWord" / >`,
            showimg =
                mOptions.wordsGame[wordindex].url.length > 3 ? 'block' : 'none',
            image = `<a href="#" data-number="${wordindex}" id="ccgmImageWord-${instance}" class="CCGMP-LinkImage" title="Imagen" style="display:"${showimg}">
                  <div class="CCGMP-Icons CCGMP-IconImage CCGMP-Activo"></div>
                  </a>`,
            showaudio =
                mOptions.wordsGame[wordindex].audio.length > 3
                    ? 'block'
                    : 'none',
            sound = `<a href="#" data-number="${wordindex}" id="ccgmImageSound-${instance}" class="CCGMP-LinkSound" title="Audio" style="display:"${showaudio}">
                  <div class="CCGMP-Icons CCGMP-IconAudio CCGMP-Activo"></div>
               </a>`,
            showdef =
                mOptions.wordsGame[wordindex].definition.length > 0
                    ? 'block'
                    : 'none',
            definition = `<span class="CCGMP-WordDefinition"  style="display:"${showdef}">${mOptions.wordsGame[wordindex].definition}</span>`,
            tdefinition = `<span class="CCGMP-NumberDefinition">${wordindex + 1}</span>.-${input}${image}${sound}${definition}`;

        $activeDefinition.html(tdefinition);

        $('#ccgmLinkSound-' + instance).hide();
        if (
            mOptions.wordsGame[wordindex].audio &&
            mOptions.wordsGame[wordindex].audio.length > 3
        ) {
            $('#ccgmLinkSound-' + instance).show();
        }

        $eXeCrucigrama.updateInputPresentation(instance, wordindex);
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        $('#ccgmActiveDefinition-' + instance).show();
    },

    updateInputPresentation(instance, wordindex) {
        const mOptions = $eXeCrucigrama.options[instance];

        if (!this.domCache[instance]) {
            this.initDOMCache(instance);
        }
        const cache = this.domCache[instance];

        if (typeof wordindex !== 'undefined') {
            const word = mOptions.wordsGame[wordindex].word;
            const isHorizontal = wordindex >= mOptions.half;

            let wordWithUnderscores = '';
            for (let index = 0; index < word.length; index++) {
                const $input = this.getCachedInputByWordLetter(
                    instance,
                    wordindex,
                    index,
                    isHorizontal
                );
                wordWithUnderscores +=
                    $input.length > 0 && $input.val() ? $input.val() : '_';
            }

            const $activeDefinition = cache.activeDefinition;
            $activeDefinition
                .find('input.CCGMP-InputWord')
                .val(wordWithUnderscores);
            $activeDefinition
                .find('.CCGMP-NumberDefinition')
                .text(wordindex + 1);
            $activeDefinition
                .find('.CCGMP-WordDefinition')
                .html(mOptions.wordsGame[wordindex].definition);

            const $linkImage = $activeDefinition.find('.CCGMP-LinkImage');
            const $linkSound = $activeDefinition.find('.CCGMP-LinkSound');

            $linkImage.hide().data('number', wordindex);
            $linkSound.hide().data('number', wordindex);
            $activeDefinition.find('.CCGMP-WordDefinition').hide();
            $activeDefinition
                .find('.input.CCGMP-InputWord')
                .prop('readonly', false);

            $('#ccgmLinkSound-' + instance).hide();
            if (mOptions.wordsGame[wordindex].url.length > 3) {
                $linkImage.show();
            }
            if (
                mOptions.wordsGame[wordindex].audio &&
                mOptions.wordsGame[wordindex].audio.length > 3
            ) {
                $linkSound.show();
                $('#ccgmLinkSound-' + instance).show();
            }
            if (mOptions.wordsGame[wordindex].definition.length > 0) {
                $activeDefinition.find('.CCGMP-WordDefinition').show();
            }
            if (mOptions.gameOver) {
                $activeDefinition
                    .find('.input.CCGMP-InputWord')
                    .prop('readonly', true);
            }
        }
    },

    updateInputs: function (instance, active) {
        const mOptions = $eXeCrucigrama.options[instance],
            $main = $('#ccgmMultimediaDiv-' + instance);
        for (let i = 0; i < mOptions.wordsGame.length; i++) {
            let wordWithUnderscores = mOptions.wordsGame[i].word
                .split('')
                .map((char, index) => {
                    let $lvi = $main.find(
                            `input[data-vi="${i}"][data-lvi="${index}"]`
                        ),
                        $lhi = $main.find(
                            `input[data-hi="${i}"][data-lhi="${index}"]`
                        ),
                        $input = i < mOptions.half ? $lvi : $lhi;
                    return $input.length > 0 && $input.val()
                        ? $input.val()
                        : '_';
                })
                .join('');
            if (active !== i) {
                let $inputWord = $main.find(
                    `input.CCGMP-InputWordDef[data-number="${i}"]`
                );
                $inputWord.val(wordWithUnderscores);
            }
        }
    },

    placeVerticalWords: function (instance, verticalWords) {
        const mOptions = $eXeCrucigrama.options[instance],
            centroCol = Math.floor(mOptions.boardSize / 2);

        let offset = $eXeCrucigrama.randomTwoOrThree();

        $eXeCrucigrama.placeVerticalWord(
            instance,
            centroCol,
            mOptions.grid,
            verticalWords[0],
            1
        );

        for (let i = 1; i <= Math.floor(verticalWords.length / 2); i++) {
            let rightCol = centroCol - offset;
            if (rightCol < mOptions.boardSize) {
                $eXeCrucigrama.placeVerticalWord(
                    instance,
                    rightCol,
                    mOptions.grid,
                    verticalWords[i],
                    i + 1
                );
            }
            offset += $eXeCrucigrama.randomTwoOrThree();
        }

        offset = $eXeCrucigrama.randomTwoOrThree();
        for (
            let i = Math.floor(verticalWords.length / 2) + 1;
            i < verticalWords.length;
            i++
        ) {
            let leftCol = centroCol + offset;
            if (leftCol >= 0) {
                $eXeCrucigrama.placeVerticalWord(
                    instance,
                    leftCol,
                    mOptions.grid,
                    verticalWords[i],
                    i + 1
                );
            }
            offset += $eXeCrucigrama.randomTwoOrThree();
        }
    },

    canPlaceVerticalWord: function (instance, col) {
        let mOptions = $eXeCrucigrama.options[instance];
        return (
            !mOptions.occupiedColumns.has(col) &&
            !mOptions.occupiedColumns.has(col - 1) &&
            !mOptions.occupiedColumns.has(col + 1)
        );
    },

    randomTwoOrThree: function () {
        return Math.random() < 0.5 ? 2 : 3;
    },

    placeVerticalWord: function (instance, col, grid, wordObj, numero) {
        const mOptions = $eXeCrucigrama.options[instance],
            row = Math.floor((mOptions.boardSize - wordObj.word.length) / 2);

        $eXeCrucigrama.placeWord(
            instance,
            wordObj.word,
            row,
            col,
            false,
            grid,
            numero,
            numero - 1
        );

        mOptions.occupiedColumns.add(col);
        mOptions.occupiedColumns.add(col - 1);
        mOptions.occupiedColumns.add(col + 1);
    },

    placeWord: function (
        instance,
        word,
        row,
        col,
        horizontal,
        grid,
        numero,
        wordindex
    ) {
        let mOptions = $eXeCrucigrama.options[instance];
        if (horizontal) {
            wordindex += mOptions.half;
        }

        mOptions.mappedWords[wordindex] = [];
        if (!horizontal) {
            grid[row][col] = {
                letter: word[0],
                numero,
                wordindex,
                lvi: 0,
                hi: -1,
                vi: wordindex,
            };
            mOptions.mappedWords[wordindex].push({ row, col });
            for (let i = 1; i < word.length; i++) {
                grid[row + i][col] = {
                    letter: word[i],
                    wordindex,
                    lvi: i,
                    hi: -1,
                    vi: wordindex,
                };
                mOptions.mappedWords[wordindex].push({ row: row + i, col });
            }
        } else {
            if (grid[row][col] && typeof grid[row][col].vi != 'undefined') {
                grid[row][col].letter = word[0];
                grid[row][col].wordindex = wordindex;
                grid[row][col].hi = wordindex;
                grid[row][col].lhi = 0;
            } else {
                grid[row][col] = {
                    letter: word[0],
                    numero,
                    wordindex,
                    lhi: 0,
                    hi: wordindex,
                };
            }
            mOptions.mappedWords[wordindex].push({ row, col });
            for (let i = 1; i < word.length; i++) {
                if (
                    grid[row][col + i] &&
                    typeof grid[row][col + i].vi != 'undefined'
                ) {
                    grid[row][col + i].letter = word[i];
                    grid[row][col + i].wordindex = wordindex;
                    grid[row][col + i].hi = wordindex;
                    grid[row][col + i].lhi = i;
                } else {
                    grid[row][col + i] = {
                        letter: word[i],
                        wordindex,
                        lhi: i,
                        hi: wordindex,
                        vi: -1,
                    };
                }
                mOptions.mappedWords[wordindex].push({ row, col: col + i });
            }
        }
    },

    placeHorizontalWords: function (instance, horizontalWords) {
        let mOptions = $eXeCrucigrama.options[instance],
            maxPlacedWords = [],
            bestAttempt = 0;

        for (let attempt = 0; attempt < 30; attempt++) {
            let placedWords = [],
                currentGrid = JSON.parse(JSON.stringify(mOptions.grid)),
                rowsUsed = new Set();
            horizontalWords.forEach((wordObj, index) => {
                const position = $eXeCrucigrama.findHorizontalPosition(
                    instance,
                    wordObj.word,
                    currentGrid,
                    rowsUsed
                );
                if (position) {
                    const numero = index + mOptions.half + 1;
                    $eXeCrucigrama.placeWord(
                        instance,
                        wordObj.word,
                        position.row,
                        position.col,
                        true,
                        currentGrid,
                        numero,
                        index
                    );
                    placedWords.push(wordObj);
                    rowsUsed.add(position.row);
                }
            });
            if (placedWords.length > bestAttempt) {
                bestAttempt = placedWords.length;
                maxPlacedWords = placedWords;
                mOptions.grid = currentGrid;
            }
            if (bestAttempt === horizontalWords.length) break;
        }

        if (bestAttempt < horizontalWords.length) {
            const notPlaced = horizontalWords.filter(
                (word) =>
                    !maxPlacedWords.some((placed) => placed.word === word.word)
            );

            let additionalPlaced = [];

            if (
                notPlaced.length > 0 &&
                $eXeCrucigrama.isFirstRowFree(instance, mOptions.grid)
            ) {
                const firstWord = notPlaced[0];
                const row = 0;
                const col = Math.floor(
                    (mOptions.boardSize - firstWord.word.length) / 2
                );

                if (
                    col >= 0 &&
                    col + firstWord.word.length <= mOptions.boardSize
                ) {
                    const index = horizontalWords.indexOf(firstWord);
                    const numero = index + mOptions.half + 1;
                    $eXeCrucigrama.placeWord(
                        instance,
                        firstWord.word,
                        row,
                        col,
                        true,
                        mOptions.grid,
                        numero,
                        index
                    );
                    maxPlacedWords.push(firstWord);
                    additionalPlaced.push(firstWord);
                    mOptions.occupiedRows.add(row);
                    mOptions.occupiedRows.add(row + 1);
                }
            }

            const stillNotPlaced = notPlaced.filter(
                (word) => !additionalPlaced.includes(word)
            );

            if (
                stillNotPlaced.length > 0 &&
                $eXeCrucigrama.isLastRowFree(instance, mOptions.grid)
            ) {
                const secondWord = stillNotPlaced[0];
                const row = mOptions.boardSize - 1;
                const col = Math.floor(
                    (mOptions.boardSize - secondWord.word.length) / 2
                );

                if (
                    col >= 0 &&
                    col + secondWord.word.length <= mOptions.boardSize
                ) {
                    const index = horizontalWords.indexOf(secondWord);
                    const numero = index + mOptions.half + 1;
                    $eXeCrucigrama.placeWord(
                        instance,
                        secondWord.word,
                        row,
                        col,
                        true,
                        mOptions.grid,
                        numero,
                        index
                    );
                    maxPlacedWords.push(secondWord);
                    additionalPlaced.push(secondWord);
                    mOptions.occupiedRows.add(row);
                    mOptions.occupiedRows.add(row - 1);
                }
            }

            const stillNotPlaced2 = stillNotPlaced.filter(
                (word) => !additionalPlaced.includes(word)
            );

            if (
                stillNotPlaced2.length > 0 &&
                $eXeCrucigrama.isFirstColumnFree(instance, mOptions.grid)
            ) {
                const thirdWord = stillNotPlaced2[0];
                const col = 0;
                const row = Math.floor(
                    (mOptions.boardSize - thirdWord.word.length) / 2
                );

                if (
                    row >= 0 &&
                    row + thirdWord.word.length <= mOptions.boardSize
                ) {
                    const originalIndex = horizontalWords.indexOf(thirdWord);
                    const wordindexInGame = mOptions.half + originalIndex;
                    const numero = originalIndex + mOptions.half + 1;
                    $eXeCrucigrama.placeWord(
                        instance,
                        thirdWord.word,
                        row,
                        col,
                        false,
                        mOptions.grid,
                        numero,
                        wordindexInGame
                    );
                    maxPlacedWords.push(thirdWord);
                    additionalPlaced.push(thirdWord);
                    mOptions.occupiedColumns.add(col);
                    mOptions.occupiedColumns.add(col + 1);
                }
            }

            const stillNotPlaced3 = stillNotPlaced2.filter(
                (word) => !additionalPlaced.includes(word)
            );

            if (
                stillNotPlaced3.length > 0 &&
                $eXeCrucigrama.isLastColumnFree(instance, mOptions.grid)
            ) {
                const fourthWord = stillNotPlaced3[0];
                const col = mOptions.boardSize - 1;
                const row = Math.floor(
                    (mOptions.boardSize - fourthWord.word.length) / 2
                );

                if (
                    row >= 0 &&
                    row + fourthWord.word.length <= mOptions.boardSize
                ) {
                    const originalIndex = horizontalWords.indexOf(fourthWord);
                    const wordindexInGame = mOptions.half + originalIndex;
                    const numero = originalIndex + mOptions.half + 1;
                    $eXeCrucigrama.placeWord(
                        instance,
                        fourthWord.word,
                        row,
                        col,
                        false,
                        mOptions.grid,
                        numero,
                        wordindexInGame
                    );
                    maxPlacedWords.push(fourthWord);
                    additionalPlaced.push(fourthWord);
                    mOptions.occupiedColumns.add(col);
                    mOptions.occupiedColumns.add(col - 1);
                }
            }

            const finalNotPlaced = notPlaced.filter(
                (word) => !additionalPlaced.includes(word)
            );

            if (finalNotPlaced.length > 0) {
                console.log(
                    'No se pudieron colocar todas las palabras horizontales.'
                );
                mOptions.wordsGame = mOptions.wordsGame.filter(
                    (word) =>
                        !finalNotPlaced.some((np) => np.word === word.word)
                );

                mOptions.numberQuestions = mOptions.wordsGame.length;
                mOptions.half = Math.ceil(mOptions.numberQuestions / 2);
            }
        }

        return maxPlacedWords;
    },

    findHorizontalPosition: function (instance, word, grid, rowsUsed) {
        let mOptions = $eXeCrucigrama.options[instance],
            centerRow = Math.floor(mOptions.boardSize / 2),
            startPositions = [centerRow];

        for (let i = 1; i <= Math.floor(mOptions.boardSize / 2); i++) {
            startPositions.push(centerRow - i);
            startPositions.push(centerRow + i);
        }

        for (let row of startPositions) {
            if (
                rowsUsed.has(row) ||
                rowsUsed.has(row - 1) ||
                rowsUsed.has(row + 1)
            )
                continue;
            let centerCol = Math.floor((mOptions.boardSize - word.length) / 2);
            if (
                $eXeCrucigrama.canPlaceWord(
                    instance,
                    word,
                    row,
                    centerCol,
                    true,
                    grid
                )
            ) {
                return { row: row, col: centerCol };
            }
            for (let offset = 1; offset < mOptions.boardSize; offset++) {
                let leftCol = centerCol - offset,
                    rightCol = centerCol + offset;
                if (
                    leftCol >= 0 &&
                    $eXeCrucigrama.canPlaceWord(
                        instance,
                        word,
                        row,
                        leftCol,
                        true,
                        grid
                    )
                ) {
                    return { row: row, col: leftCol };
                }
                if (
                    rightCol + word.length <= mOptions.boardSize &&
                    $eXeCrucigrama.canPlaceWord(
                        instance,
                        word,
                        row,
                        rightCol,
                        true,
                        grid
                    )
                ) {
                    return { row: row, col: rightCol };
                }
            }
        }
        return null;
    },

    shuffleArray: function (array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    },

    verifyCrossword: function (instance) {
        let mOptions = $eXeCrucigrama.options[instance],
            hits = 0,
            totalWords = mOptions.wordsGame.length;

        const $crossword = $('#ccgmCrossword-' + instance);

        $('#ccgmCheck-' + instance).hide();
        $('#ccgmReboot-' + instance).show();
        $('#ccgmSolutions-' + instance).hide();

        if (mOptions.showSolution) $('#ccgmSolutions-' + instance).show();

        if (mOptions.modeGame) {
            $eXeCrucigrama.updateInputs(instance, -1);
        } else {
            $eXeCrucigrama.completeCrosswordFromInputs(instance);
        }

        $crossword.find('.CCGMP-Cell input').css('background-color', 'white');

        const stripDiacritics = function (s) {
            return (s || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .normalize('NFC');
        };

        mOptions.mappedWords.forEach((word) => {
            let isOK = true;
            word.forEach(({ row, col }) => {
                let letterCorrecta = mOptions.grid[row][col].letter,
                    $input = $crossword.find(
                        `input[data-row='${row}'][data-col='${col}']`
                    ),
                    letterIngresada = $input.val();

                if (!mOptions.caseSensitive) {
                    letterCorrecta = (letterCorrecta || '').toLowerCase();
                    letterIngresada = (letterIngresada || '').toLowerCase();
                }

                if (mOptions.tilde === false) {
                    letterCorrecta = stripDiacritics(letterCorrecta);
                    letterIngresada = stripDiacritics(letterIngresada);
                }

                if (letterCorrecta !== letterIngresada) {
                    isOK = false;
                }
            });

            word.forEach(({ row, col }, index) => {
                const $input = $crossword.find(
                    `input[data-row='${row}'][data-col='${col}']`
                );
                let isHorizontal = parseInt($input.data('hi')) != -1,
                    isVertical = parseInt($input.data('vi')) != -1,
                    bcolor = '1px solid #333',
                    borderStyles = {};
                if (isOK) {
                    $input.css({
                        'background-color': $eXeCrucigrama.borderColors.green,
                        color: '#fff',
                    });
                }
                if (isHorizontal) {
                    borderStyles['border-top'] = bcolor;
                    borderStyles['border-bottom'] = bcolor;
                    if (index === 0) {
                        borderStyles['border-left'] = bcolor;
                    }
                    if (index === word.length - 1) {
                        borderStyles['border-right'] = bcolor;
                    }
                }
                if (isVertical) {
                    borderStyles['border-left'] = bcolor;
                    borderStyles['border-right'] = bcolor;
                    if (index === 0) {
                        borderStyles['border-top'] = bcolor;
                    }
                    if (index === word.length - 1) {
                        borderStyles['border-bottom'] = bcolor;
                    }
                }
                $input.css(borderStyles);
                $input.prop('readonly', true);
            });
            if (isOK) {
                hits++;
            }
        });

        mOptions.hits = hits;
        let score = (hits * 10) / totalWords,
            message = mOptions.msgs.msgGameOver
                .replace('%s', score.toFixed(2))
                .replace('%s', hits)
                .replace('%s', totalWords),
            type = score < 5 ? 1 : 2;
        $('#ccgmMainContainer-' + instance)
            .find('li.CCGMP-FlexSpan')
            .each(function () {
                let $answer = $(this).find('.CCGMP-InputWordDef').eq(0),
                    $correct = $(this).find('.CCGMP-WordDef').eq(0),
                    inputValue = ($answer.val() || '').trim(),
                    correctWord = ($correct.text() || '').trim();

                if (!mOptions.caseSensitive) {
                    inputValue = inputValue.toLowerCase();
                    correctWord = correctWord.toLowerCase();
                }
                if (mOptions.tilde === false) {
                    inputValue = stripDiacritics(inputValue);
                    correctWord = stripDiacritics(correctWord);
                }
                backcolor =
                    inputValue === correctWord
                        ? $eXeCrucigrama.borderColors.green
                        : $eXeCrucigrama.borderColors.red;
                $answer.css({
                    color: backcolor,
                });
                $answer.prop('readonly', true);
            });
        $eXeCrucigrama.showMessage(type, message, instance);
        $eXeCrucigrama.gameOver(instance);
    },

    getDetailMedia: function (instance) {
        const msgs = $eXeCrucigrama.options[instance].msgs,
            path = $eXeCrucigrama.idevicePath,
            html = `
            <div class="CCGMP-Detail" id="ccgmDetails-${instance}">
                <div class="CCGMP-FlexDetail">
                    <a href="#" class="CCGMP-LinkPSound" id="ccgmLinkSound-${instance}" title="Play">
                        <strong class="sr-av">Play:</strong>
                        <div class="CCGMP-IconsToolBar exeQuextIcons-Audio  CCGMP-Activo"></div>
                    </a>
                    <div></div>
                    <a href="#" class="CCGMP-LinkClose" id="ccgmLinkClose-${instance}" title="${msgs.msgClose}">
                        <strong class="sr-av">${msgs.msgClose}:</strong>
                        <div class="CCGMP-IconsToolBar exeQuextIcons-Close CCGMP-Activo"></div>
                    </a>
                </div>
                <div class="CCGMP-MultimediaPoint" id="ccgmMultimediaPoint-${instance}">
                    <img class="CCGMP-Images" id="ccgmImagePoint-${instance}" alt="${msgs.msgNoImage}" />
                    <img class="CCGMP-Cursor" id="ccgmCursor-${instance}" src="${path}exequextcursor.gif" alt="" />
                     <a href="#" class="CCGMP-FullLinkImage" id="ccgmFullLinkImage-${instance}" title="${msgs.msgFullScreen}">
                        <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                        <div  class="exeQuextIcons exeQuextIcons-FullImage CCGMP-Activo"></div>
                    </a>
                </div>
                <div class="CCGMP-AuthorPoint" id="ccgmAuthorPoint-${instance}"></div>
                <div class="CCGMP-Footer" id="ccgmFooterPoint-${instance}"></div>
            </div>
        `;
        return html;
    },

    showPoint: function (instance, num) {
        const mOptions = $eXeCrucigrama.options[instance],
            q = mOptions.wordsGame[num];

        $('#ccgmDetails-' + instance).show();
        $('#ccgmAuthorPoint-' + instance).html(q.author);
        $('#ccgmFooterPoint-' + instance).html(q.definition);

        if (q.definition.length > 0) {
            $('#ccgmFooterPoint-' + instance).show();
        }

        $eXeCrucigrama.showImagePoint(
            instance,
            q.url,
            q.x,
            q.y,
            q.author,
            q.alt
        );

        if (q.author.length > 0) {
            $('#ccgmMAuthorPoint-' + instance).show();
        }

        const html = $('#ccgmDetails-' + instance).html(),
            latex = $exeDevices.iDevice.gamification.math.hasLatex(html);
        if (latex) {
            $exeDevices.iDevice.gamification.math.updateLatex('#ccgmDetails');
        }
    },

    showImagePoint: function (instance, url, x, y, author, alt) {
        const $Image = $('#ccgmImagePoint-' + instance),
            $cursor = $('#ccgmCursor-' + instance),
            $Author = $('#ccgmAuthorPoint-' + instance);

        $Author.html(author || '');
        $Image
            .prop('src', url)
            .on('load', function () {
                if (
                    !this.complete ||
                    typeof this.naturalWidth == 'undefined' ||
                    this.naturalWidth == 0
                ) {
                    $Image.hide();
                    $Image.attr(
                        'alt',
                        $eXeCrucigrama.options[instance].msgs.msgNoImage
                    );
                    $noImage.show();
                    $eXeCrucigrama.showCubiertaOptions(instance, 2);
                    return false;
                } else {
                    $Image.show();
                    $Image.attr('alt', alt || '');
                    $eXeCrucigrama.showCubiertaOptions(instance, 2);
                    $eXeCrucigrama.positionPointerCard($cursor, x, y);
                    return true;
                }
            })
            .on('error', function () {
                $Image.hide();
                $Image.attr(
                    'alt',
                    $eXeCrucigrama.options[instance].msgs.msgNoImage
                );
                $eXeCrucigrama.showCubiertaOptions(instance, 2);
                return false;
            });

        $('#ccgmMultimediaPoint-' + instance).show();
    },

    positionPointerCard: function ($cursor, x, y) {
        $cursor.hide();

        if (x > 0 || y > 0) {
            const parentClass = '.CCGMP-MultimediaPoint',
                siblingClass = '.CCGMP-Images',
                containerElement = $cursor.closest(parentClass).eq(0),
                imgElement = $cursor.siblings(siblingClass).eq(0),
                containerPos = containerElement.offset(),
                imgPos = imgElement.offset(),
                marginTop = imgPos.top - containerPos.top,
                marginLeft = imgPos.left - containerPos.left,
                mx = marginLeft + x * imgElement.width(),
                my = marginTop + y * imgElement.height();

            $cursor.css({ left: mx, top: my, 'z-index': 1000 });
            $cursor.show();
        }
    },

    showCubiertaOptions(instance, mode) {
        const $details = $('#ccgmDetails-' + instance),
            $cubierta = $('#ccgmCubierta-' + instance),
            $access = $('#ccgmCodeAccessDiv-' + instance),
            $feeeback = $('#ccgmDivFeedBack-' + instance);

        if (mode === false) {
            $cubierta.fadeOut(400, function () {
                $access.hide();
                $feeeback.hide();
                $details.hide();
            });
            return;
        }

        $access.hide();
        $feeeback.hide();
        $details.hide();
        $cubierta.hide();

        switch (mode) {
            case 0:
                $access.show();
                $cubierta.show();
                break;
            case 1:
                $feeeback.find('.crucigrama-feedback-game').show();
                $feeeback.fadeIn();
                $cubierta.show();
                break;
            case 2:
                $details.fadeIn();
                $cubierta.show();
                break;
            default:
                break;
        }
    },

    repeatActivity: function (instance) {
        const mOptions = $eXeCrucigrama.options[instance];

        mOptions.wordsGame =
            $exeDevices.iDevice.gamification.helpers.shuffleAds(
                mOptions.wordsGame
            );
        mOptions.previousValues = [];

        for (let i = 0; i < mOptions.wordsGame.length; i++) {
            let pv = mOptions.wordsGame[i].word.replace(/./g, '_');
            mOptions.previousValues.push(pv);
        }

        this.cleanupInstance(instance);

        $eXeCrucigrama.generateCrossword(instance);
        $eXeCrucigrama.startGame(instance);

        if (mOptions.modeGame) {
            $eXeCrucigrama.modeCrossword(instance);
        } else {
            $eXeCrucigrama.modeDefinitions(instance);
        }
    },

    createDefinitionsList: function (instance) {
        const mOptions = $eXeCrucigrama.options[instance],
            $definitionsVList = $('#ccgmDefinitionsVList-' + instance),
            $definitionsHList = $('#ccgmDefinitionsHList-' + instance);

        $definitionsHList.empty();
        $definitionsVList.empty();
        mOptions.wordsGame.forEach((item, index) => {
            let def = $eXeCrucigrama.createDefinition(item, index, instance);
            const $li1 = $(
                '<li class="CCGMP-FlexSpan" data-number="' + index + '">'
            ).html(def);
            if (index < mOptions.half) {
                $definitionsVList.append($li1);
            } else {
                $definitionsHList.append($li1);
            }
        });
    },

    createDefinition(item, wordindex, instance) {
        let mOptions = $eXeCrucigrama.options[instance],
            $crossword = $('#ccgmCrossword-' + instance);

        wordindex = parseInt(wordindex);
        const isVertical = wordindex < mOptions.half;

        let wordWithUnderscores = item.word
            .split('')
            .map((char, index) => {
                // Search by data-vi for vertical words, data-hi for horizontal words
                let $input;
                if (isVertical) {
                    $input = $crossword.find(
                        `input[data-vi="${wordindex}"][data-lvi="${index}"]`
                    );
                } else {
                    $input = $crossword.find(
                        `input[data-hi="${wordindex}"][data-lhi="${index}"]`
                    );
                }
                return $input.length > 0 && $input.val() ? $input.val() : '_';
            })
            .join('');

        const input = `<span class="CCGMP-InputDefDiv"><label class="sr-av">${mOptions.msgs.msgSolutionWord}:</label> 
               <input data-number="${wordindex}" type="text" class="CCGMP-InputWordDef" 
               value="${wordWithUnderscores}"  /></span>`;
        const word = `<span  class="CCGMP-WordDef">${item.word}</span>`;

        const image =
            item.url.length > 3
                ? `<a href="#" data-number="${wordindex}"  class="CCGMP-LinkImageDef" title="Imagen">
                  <div class="CCGMP-Icons CCGMP-IconImage CCGMP-Activo"></div>
               </a>`
                : '';

        const sound =
            item.audio && item.audio.length > 3
                ? `<a href="#" data-number="${wordindex}" class="CCGMP-LinkSoundDef" title="Audio">
                  <div class="CCGMP-Icons CCGMP-IconAudio CCGMP-Activo"></div>
               </a>`
                : '';

        const definition =
            item.definition.length > 0 ? `<span>${item.definition}</span>` : '';

        const sdefinition = `<span>${wordindex + 1}.- </span>${input}${word}:${image}${sound}${definition}`;
        return sdefinition;
    },

    showSolutions: function (instance) {
        const mOptions = $eXeCrucigrama.options[instance],
            $crossword = $('#ccgmCrossword-' + instance);

        for (let row = 0; row < mOptions.boardSize; row++) {
            for (let col = 0; col < mOptions.boardSize; col++) {
                const casilla = mOptions.grid[row][col];
                if (casilla && casilla.letter) {
                    const $input = $crossword.find(
                        `input[data-row='${row}'][data-col='${col}']`
                    );
                    $input.val(casilla.letter);
                    $input.prop('readonly', true);
                }
            }
        }

        $('#ccgmMainContainer-' + instance)
            .find('li.CCGMP-FlexSpan')
            .each(function () {
                $(this).find('.CCGMP-WordDef').eq(0).show();
            });

        $crossword.find('.CCGMP-InputDefDiv').show();
        mOptions.solutionsShow = true;
    },

    canPlaceWord: function (instance, word, row, col, horizontal, grid) {
        const mOptions = $eXeCrucigrama.options[instance];

        if (horizontal) {
            if (col + word.length > mOptions.boardSize) {
                return false;
            }

            if (
                mOptions.occupiedRows.has(row) ||
                mOptions.occupiedRows.has(row - 1) ||
                mOptions.occupiedRows.has(row + 1)
            ) {
                return false;
            }

            if (!grid[row]) {
                return false;
            }

            if (grid[row][col] && typeof grid[row][col].vi !== 'undefined') {
                return false;
            }

            for (let i = 0; i < word.length; i++) {
                if (!grid[row]) {
                    return false;
                }

                const cell = grid[row][col + i];

                if (typeof cell === 'undefined' || cell === null) {
                    continue;
                }

                if (cell.letter && cell.letter !== word[i]) {
                    return false;
                }
            }
        }
        return true;
    },

    isFirstRowFree: function (instance, grid) {
        const mOptions = $eXeCrucigrama.options[instance];
        const row = 0;

        if (!grid[row]) {
            return true;
        }

        for (let col = 0; col < mOptions.boardSize; col++) {
            if (
                grid[row][col] !== null &&
                typeof grid[row][col] !== 'undefined'
            ) {
                return false;
            }
        }

        return true;
    },

    isLastRowFree: function (instance, grid) {
        const mOptions = $eXeCrucigrama.options[instance];
        const row = mOptions.boardSize - 1;

        if (!grid[row]) {
            return true;
        }

        for (let col = 0; col < mOptions.boardSize; col++) {
            if (
                grid[row][col] !== null &&
                typeof grid[row][col] !== 'undefined'
            ) {
                return false;
            }
        }

        return true;
    },

    isFirstColumnFree: function (instance, grid) {
        const mOptions = $eXeCrucigrama.options[instance];
        const col = 0;

        for (let row = 0; row < mOptions.boardSize; row++) {
            if (
                grid[row] &&
                grid[row][col] !== null &&
                typeof grid[row][col] !== 'undefined'
            ) {
                return false;
            }
        }

        return true;
    },

    isLastColumnFree: function (instance, grid) {
        const mOptions = $eXeCrucigrama.options[instance];
        const col = mOptions.boardSize - 1;

        for (let row = 0; row < mOptions.boardSize; row++) {
            if (
                grid[row] &&
                grid[row][col] !== null &&
                typeof grid[row][col] !== 'undefined'
            ) {
                return false;
            }
        }

        return true;
    },

    enable: function () {
        $eXeCrucigrama.loadGame();
    },

    loadGame: function () {
        $eXeCrucigrama.options = [];

        $eXeCrucigrama.activities.each(function (i) {
            let version = $('.crucigrama-version', this).eq(0).text(),
                dl = $('.crucigrama-DataGame', this),
                imagesLink = $('.crucigrama-LinkImages', this),
                audioLink = $('.crucigrama-LinkAudios', this),
                $imageBack = $('.crucigrama-LinkBack', this),
                mOption = $eXeCrucigrama.loadDataGame(
                    dl,
                    imagesLink,
                    audioLink,
                    version
                ),
                msg = mOption.msgs.msgPlayStart;

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeCrucigrama.idevicePath;
            mOption.main = 'ccgmMainContainer-' + i;
            mOption.idevice = 'crucigrama-IDevice';

            if ($imageBack.length == 1) {
                mOption.urlBack = $imageBack.attr('href') || '';
            }

            $eXeCrucigrama.options.push(mOption);

            const ccgm = $eXeCrucigrama.createInterfaceCrucigrama(i);

            dl.before(ccgm).remove();

            $('#ccgmGameMinimize-' + i).hide();
            $('#ccgmGameContainer-' + i).hide();

            if (mOption.showMinimize) {
                $('#ccgmGameMinimize-' + i)
                    .css({
                        cursor: 'pointer',
                    })
                    .show();
            } else {
                $('#ccgmGameContainer-' + i).show();
            }

            $('#ccgmMessageMaximize-' + i).text(msg);
            $('#ccgmDivFeedBack-' + i).prepend(
                $('.crucigrama-feedback-game', this)
            );
            $('#ccgmDivFeedBack-' + i).hide();

            mOption.previousValues = [];

            for (let i = 0; i < mOption.wordsGame.length; i++) {
                let pv = mOption.wordsGame[i].word.replace(/./g, '_');
                mOption.previousValues.push(pv);
            }

            $eXeCrucigrama.generateCrossword(i);
            $eXeCrucigrama.addEvents(i);
        });

        $exeDevices.iDevice.gamification.math.updateLatex(
            '.crucigrama-IDevice'
        );
    },

    loadDataGame: function (data, imgsLink, audioLink, version) {
        let json = data.text();
        version =
            typeof version == 'undefined' || version == ''
                ? 0
                : parseInt(version);

        if (version > 0)
            json = $exeDevices.iDevice.gamification.helpers.decrypt(json);

        const mOptions =
            $exeDevices.iDevice.gamification.helpers.isJsonString(json);

        mOptions.boardSize = 16;
        mOptions.mappedWords = [];
        mOptions.occupiedRows = new Set();
        mOptions.occupiedColumns = new Set();
        mOptions.grid = null;
        mOptions.hits = 0;
        mOptions.score = 0;
        mOptions.modeGame = true;
        mOptions.focused = 0;
        mOptions.activeQuestion = -1;
        mOptions.gameStarted = false;
        mOptions.solutionsShow = false;
        mOptions.percentajeQuestions =
            typeof mOptions.percentajeQuestions != 'undefined'
                ? mOptions.percentajeQuestions
                : 100;
        mOptions.tilde =
            typeof mOptions.tilde != 'undefined' ? mOptions.tilde : true;

        mOptions.evaluation =
            typeof mOptions.evaluation == 'undefined'
                ? false
                : mOptions.evaluation;
        mOptions.evaluationID =
            typeof mOptions.evaluationID == 'undefined'
                ? ''
                : mOptions.evaluationID;
        mOptions.id = typeof mOptions.id == 'undefined' ? false : mOptions.id;

        for (let i = 0; i < mOptions.wordsGame.length; i++) {
            let p = mOptions.wordsGame[i];
            p.url = $exeDevices.iDevice.gamification.media.extractURLGD(p.url);
        }

        mOptions.playerAudio = '';
        mOptions.gameOver = false;

        imgsLink.each(function () {
            let iq = parseInt($(this).text());
            if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                mOptions.wordsGame[iq].url = $(this).attr('href');
                if (
                    mOptions.wordsGame[iq].url.length < 4 &&
                    mOptions.wordsGame[iq].type == 1
                ) {
                    mOptions.wordsGame[iq].url = '';
                }
            }
        });

        audioLink.each(function () {
            let iq = parseInt($(this).text());
            if (!isNaN(iq) && iq < mOptions.wordsGame.length) {
                mOptions.wordsGame[iq].audio = $(this).attr('href');
                if (mOptions.wordsGame[iq].audio.length < 4) {
                    mOptions.wordsGame[iq].audio = '';
                }
            }
        });
        mOptions.wordsGame =
            $exeDevices.iDevice.gamification.helpers.shuffleAds(
                mOptions.wordsGame
            );

        mOptions.wordsGame = $eXeCrucigrama.getQuestions(
            mOptions.wordsGame,
            mOptions.percentajeQuestions
        );
        if (mOptions.wordsGame.length > 10) {
            mOptions.wordsGame = mOptions.wordsGame.splice(0, 10);
        }

        mOptions.numberQuestions = mOptions.wordsGame.length;
        mOptions.half = Math.ceil(mOptions.numberQuestions / 2);
        return mOptions;
    },

    getQuestions: function (questions, percentage) {
        const totalQuestions = questions.length;

        if (percentage >= 100) return questions;

        const num = Math.max(
            2,
            Math.round((percentage * totalQuestions) / 100)
        );

        if (num >= totalQuestions) return questions;

        const indices = Array.from({ length: totalQuestions }, (_, i) => i);
        $exeDevices.iDevice.gamification.helpers.shuffleAds(indices);

        const selectedIndices = indices.slice(0, num).sort((a, b) => a - b),
            selectedQuestions = selectedIndices.map(
                (index) => questions[index]
            );

        return selectedQuestions;
    },

    createInterfaceCrucigrama: function (instance) {
        const path = $eXeCrucigrama.idevicePath,
            msgs = $eXeCrucigrama.options[instance].msgs,
            mOptions = $eXeCrucigrama.options[instance],
            html = `
            <div class="CCGMP-MainContainer" id="ccgmMainContainer-${instance}">
                <div class="CCGMP-GameMinimize" id="ccgmGameMinimize-${instance}">
                    <a href="#" class="CCGMP-LinkMaximize" id="ccgmLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                        <img src="${path}ccccrossword.png" class="CCGMP-IconMinimize CCGMP-Activo" alt="">
                        <div class="CCGMP-MessageMaximize" id="ccgmMessageMaximize-${instance}"></div>
                    </a>
                </div>
                <div class="CCGMP-GameContainer" id="ccgmGameContainer-${instance}">
                    <div class="CCGMP-GameScoreBoard">
                        <div class="CCGMP-TimeNumber">
                            <a href="#" id="ccgmShowDefinitions-${instance}" title="${msgs.msgShowDefinitions}">
                                <strong><span class="sr-av">${msgs.msgShowDefinitions}:</span></strong>
                                <div id="ccgmIconShowDefinitions-${instance}" class="exeQuextIcons exeQuextIcons-Definitions CCGMP-Activo"></div>
                            </a>
                            <strong><span class="sr-av">${msgs.msgTime}:</span></strong>
                            <div class="exeQuextIcons exeQuextIcons-Time" title="${msgs.msgTime}"></div>
                            <p id="ccgmPTime-${instance}" class="CCGMP-PTime">00:00</p>
                            <a href="#" class="CCGMP-LinkMinimize" id="ccgmLinkMinimize-${instance}" title="${msgs.msgMinimize}">
                                <strong><span class="sr-av">${msgs.msgMinimize}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-Minimize CCGMP-Activo"></div>
                            </a>
                            <a href="#" class="CCGMP-LinkFullScreen" id="ccgmLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                                <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                                <div class="exeQuextIcons exeQuextIcons-FullScreen CCGMP-Activo" id="ccgmFullScreen-${instance}"></div>
                            </a>
                        </div>
                    </div>
                    <div class="CCGMP-StartGame">
                        <a href="#" id="ccgmStartGame-${instance}">${msgs.msgPlayStart}</a>
                    </div>
                    <div class="CCGMP-ShowClue" id="ccgmMessage-${instance}">
                        <p class="CCGMP-PShowClue CCGMP-parpadea" id="ccgmPMessage-${instance}"></p>
                    </div> 
                    <div class="CCGMP-Message" id="ccgmShowClue-${instance}">
                        <div class="sr-av">${msgs.msgClue}</div>
                        <p class="CCGMP-PShowClue CCGMP-parpadea" id="ccgmPShowClue-${instance}"></p>
                    </div>                    
                    <div class="CCGMP-MultimediaDiv" id="ccgmMultimediaDiv-${instance}">
                        <div class="CCGMP-Multimedia" id="ccgmMultimedia-${instance}">
                            <div class="CCGMP-ActiveDefinition" id="ccgmActiveDefinition-${instance}">
                                ${msgs.msgSelectWord}
                            </div>
                            <div id="ccgmCrossword-${instance}" class="CCGMP-Crucigrama"></div>
                            <div id="ccgmAuthorBackImage-${instance}" class="CCGMP-AuthorBackImage"></div>
                        </div>
                        <div id="ccgmDefinitions-${instance}" class="CCGMP-Solutions">
                            <span>${msgs.msgVerticals}</span>
                            <ul id="ccgmDefinitionsVList-${instance}" class="CCGMP-SolutionsList"></ul>
                            <span>${msgs.msgHorizontals}</span>
                            <ul id="ccgmDefinitionsHList-${instance}" class="CCGMP-SolutionsList"></ul>
                        </div>   
                    </div>              
                    <div class="CCGMP-Buttons">
                        <a href="#" id="ccgmCheck-${instance}" class="CCGMP-Boton">${msgs.msgCheck}</a>                        
                        <a href="#" id="ccgmSolutions-${instance}" class="CCGMP-Boton">${msgs.msgShowSolution}</a>
                        <a href="#" id="ccgmReboot-${instance}" class="CCGMP-Boton">${msgs.msgReboot}</a>
                    </div>       
                    <div class="CCGMP-Cubierta" id="ccgmCubierta-${instance}" style="display:none">
                            ${$eXeCrucigrama.getDetailMedia(instance)}
                        <div class="CCGMP-CodeAccessDiv" id="ccgmCodeAccessDiv-${instance}">
                            <div class="CCGMP-MessageCodeAccessE" id="ccgmMesajeAccesCodeE-${instance}"></div>
                                <div class="CCGMP-DataCodeAccessE">
                                    <label for="ccgmCodeAccessE-${instance}" class="sr-av">${msgs.msgCodeAccess}:</label>
                                    <input type="text" class="CCGMP-CodeAccessE form-control" id="ccgmCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                                    <a href="#" id="ccgmCodeAccessButton-${instance}" title="${msgs.msgReply}">
                                        <strong><span class="sr-av">${msgs.msgReply}</span></strong>
                                        <div class="exeQuextIcons-Submit CCGMP-Activo"></div>
                                    </a>
                                </div>                          
                            </div>
                                <div class="CCGMP-DivFeedBack" id="ccgmDivFeedBack-${instance}">
                                <input type="button" id="ccgmFeedBackClose-${instance}" value="${msgs.msgClose}" class="feedbackbutton" style="cursor:pointer;" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
           ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
        `;
        return html;
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeCrucigrama.options[instance];

        mOptions.scorerp = (mOptions.hits * 10) / mOptions.wordsGame.length;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeCrucigrama.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeCrucigrama.options[instance];

        mOptions.scorerp = (mOptions.hits * 10) / mOptions.wordsGame.length;
        mOptions.previousScore = $eXeCrucigrama.previousScore;
        mOptions.userName = $eXeCrucigrama.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeCrucigrama.previousScore = mOptions.previousScore;
    },

    clear: function (phrase) {
        return phrase.replace(/[&\s\n\r]+/g, ' ').trim();
    },

    removeEvents: function (instance) {
        let $mainContainer = $('#ccgmMainContainer-' + instance);

        $mainContainer.off('click', '#ccgmFullLinkImage-' + instance);
        $('#ccgmCheck-' + instance).off('click');
        $('#ccgmReboot-' + instance).off('click');
        $('#ccgmSolutions-' + instance).off('click');
        $('#ccgmLinkMaximize-' + instance).off('click touchstart');
        $('#ccgmLinkMinimize-' + instance).off('click touchstart');
        $('#ccgmLinkFullScreen-' + instance).off('click touchstart');
        $('#ccgmFeedBackClose-' + instance).off('click');
        $('#ccgmLinkSound-' + instance).off('click');
        $('#ccgmCodeAccessButton-' + instance).off('click touchstart');
        $('#ccgmCodeAccessE-' + instance).off('keydown');
        $('#ccgmMainContainer-' + instance)
            .closest('.idevice_node')
            .off('click', '.Games-SendScore');
        $('#ccgmStartGame-' + instance).off('click');
        $('#ccgnBackgroundIcon-' + instance).off('click');
        $('#ccgmShowDefinitions-' + instance).off('click');

        $mainContainer.off('click', '.CCGMP-LinkImageDef');
        $mainContainer.off('click', '.CCGMP-LinkImage');
        $mainContainer.off('click', '.CCGMP-LinkSound');
        $mainContainer.off('click', '.CCGMP-LinkSoundDef');
        $mainContainer.off('click', '.CCGMP-LinkClose');
        $mainContainer.off('click touchend', '.CCGMP-InputWord');
        $mainContainer.off('click touchend', '.CCGMP-InputWordDef');
        $mainContainer.off('click touchend', '.CCGMP-Number');
        $mainContainer.off('keydown', '.CCGMP-InputWord, .CCGMP-InputWordDef');
        $mainContainer.off('input', '.CCGMP-InputWordDef, .CCGMP-InputWord');
        $(window).off('unload.eXeCrucigrama beforeunload.eXeCrucigrama');
    },

    addEvents: function (instance) {
        $eXeCrucigrama.removeEvents(instance);

        const mOptions = $eXeCrucigrama.options[instance],
            $mainContainer = $('#ccgmMainContainer-' + instance);

        $('#ccgmFullLinkImage-' + instance).on('click', function (e) {
            e.preventDefault();
            const largeImageSrc = $('#ccgmImagePoint-' + instance).attr('src');
            if (largeImageSrc && largeImageSrc.length > 3) {
                $exeDevices.iDevice.gamification.helpers.showFullscreenImage(
                    largeImageSrc,
                    $('#ccgmGameContainer-' + instance)
                );
            }
        });

        $('#ccgmReboot-' + instance).hide();
        $('#ccgmSolutions-' + instance).hide();
        $('#ccgmCheck-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeCrucigrama.verifyCrossword(instance);
        });

        $('#ccgmReboot-' + instance).on('click', function (e) {
            e.preventDefault();
            $('#ccgmReboot-' + instance).hide();
            $('#ccgmSolutions-' + instance).hide();
            $eXeCrucigrama.repeatActivity(instance);
            $('#ccgmCheck-' + instance).show();
            $('#ccgmActiveDefinition-' + instance).html(
                mOptions.msgs.msgSelectWord
            );
        });

        $('#ccgmSolutions-' + instance).on('click', function (e) {
            e.preventDefault();
            $('#ccgmCheck-' + instance).hide();
            $('#ccgmSolutions-' + instance).hide();
            $eXeCrucigrama.showSolutions(instance);
        });

        $('#ccgmLinkMaximize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $('#ccgmGameContainer-' + instance).show();
            $('#ccgmGameMinimize-' + instance).hide();
        });

        $('#ccgmLinkMinimize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $('#ccgmGameContainer-' + instance).hide();
            $('#ccgmGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
        });

        $('#ccgmGamerOver-' + instance).hide();
        $('#ccgmCodeAccessDiv-' + instance).hide();

        $('#ccgmLinkFullScreen-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                const element = document.getElementById(
                    'ccgmGameContainer-' + instance
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element
                );
            }
        );

        $('#ccgmFeedBackClose-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeCrucigrama.showCubiertaOptions(instance, false);
        });

        $('#ccgmLinkSound-' + instance).on('click', function (e) {
            e.preventDefault();
            let audio = mOptions.wordsGame[mOptions.activeQuestion].audio;
            $exeDevices.iDevice.gamification.media.playSound(audio, mOptions);
        });

        $('#ccgmShowClue-' + instance).hide();
        if (mOptions.itinerary.showCodeAccess) {
            $('#ccgmMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#ccgmCodeAccessDiv-' + instance).show();
            $eXeCrucigrama.showCubiertaOptions(instance, 0);
        }

        $('#ccgmCodeAccessButton-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXeCrucigrama.enterCodeAccess(instance);
            }
        );

        $('#ccgmCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeCrucigrama.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#ccgmPNumber-' + instance).text(mOptions.numberQuestions);

        $(window).on(
            'unload.eXeCrucigrama beforeunload.eXeCrucigrama',
            function () {
                $exeDevices.iDevice.gamification.media.stopSound(mOptions);
                if ($eXeCrucigrama.mScorm) {
                    $exeDevices.iDevice.gamification.scorm.endScorm(
                        $eXeCrucigrama.mScorm
                    );
                }
            }
        );

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#ccgmMainContainer-' + instance)
            .closest('.idevice_node')
            .on('click', '.Games-SendScore', function (e) {
                e.preventDefault();
                $eXeCrucigrama.sendScore(false, instance);
                $eXeCrucigrama.saveEvaluation(instance);
            });

        $('#ccgmStartGame-' + instance).on('click', function (e) {
            e.preventDefault();
            $eXeCrucigrama.startGame(instance);
        });

        $mainContainer.on('click', '.CCGMP-LinkImageDef', function (e) {
            e.preventDefault();
            let num = $(this).data('number');
            $eXeCrucigrama.showPoint(instance, num);
        });

        $mainContainer.on('click', '.CCGMP-LinkImage', function (e) {
            e.preventDefault();
            let num = $(this).data('number');
            $eXeCrucigrama.showPoint(instance, num);
        });

        $mainContainer.on('click', '.CCGMP-LinkSound', function (e) {
            e.preventDefault();
            let num = $(this).data('number'),
                sound = mOptions.wordsGame[num].audio;
            $exeDevices.iDevice.gamification.media.playSound(sound, mOptions);
        });

        $mainContainer.on('click', '.CCGMP-LinkSoundDef', function (e) {
            e.preventDefault();
            let num = $(this).data('number'),
                sound = mOptions.wordsGame[num].audio;
            $exeDevices.iDevice.gamification.media.playSound(sound, mOptions);
        });

        $mainContainer.on('click', '.CCGMP-LinkClose', function (e) {
            e.preventDefault();
            $eXeCrucigrama.showCubiertaOptions(instance, false);
            if (mOptions.modeGame) {
                if (mOptions.focused == 1) {
                    setTimeout(function () {
                        $mainContainer.find('input.CCGMP-InputWordDef').focus();
                    }, 0);
                } else if (mOptions.focused == 0) {
                    setTimeout(function () {
                        const davi = $('#ccgmCrossord-' + instance)
                            .find(`input[data-vi='${mOptions.activeQuestion}']`)
                            .first();
                        const dahi = $('#ccgmCrossword-' + instance)
                            .find(`input[data-hi='${mOptions.activeQuestion}']`)
                            .first();
                        const $firstInput =
                            mOptions.activeQuestion < mOptions.half
                                ? davi
                                : dahi;
                        $firstInput.focus();
                    }, 0);
                }
            } else {
                setTimeout(function () {
                    $mainContainer
                        .find(
                            `input.CCGMP-InputWord[data-number='${mOptions.activeQuestion}']`
                        )
                        .focus();
                }, 0);
            }
        });

        $('#ccgmStartGame-' + instance).show();
        $('#ccgmActiveDefinition-' + instance).hide();
        $('#ccgmCheck-' + instance).hide();
        $('#ccgmShowDefinitions-' + instance).hide();

        $('#ccgnBackgroundIcon-' + instance).on('click', function (e) {
            e.preventDefault();
            $('#ccgmCrossword-' + instance).toggleClass('CCGMP-NoBackground');
        });

        $mainContainer.on('click', '.CCGMP-FlexSpan', function (e) {
            e.preventDefault();
            const wordindex = $(this).data('number');
            mOptions.activeQuestion = parseInt(wordindex);
            $mainContainer
                .find(
                    `input.CCGMP-InputWordDef[data-number='${mOptions.activeQuestion}']`
                )
                .focus();
        });

        $('#ccgmShowDefinitions-' + instance).on('click', function (e) {
            e.preventDefault();
            if (mOptions.modeGame) {
                $eXeCrucigrama.modeDefinitions(instance);
            } else {
                $eXeCrucigrama.modeCrossword(instance);
            }
            if (mOptions.solutionsShow) {
                $eXeCrucigrama.showSolutions(instance);
            }
            mOptions.modeGame = !mOptions.modeGame;
        });

        $mainContainer.on(
            'compositionstart',
            '.CCGMP-InputWord, .CCGMP-InputWordDef',
            function () {
                mOptions._imeComposing = true;
            }
        );
        $mainContainer.on(
            'compositionend',
            '.CCGMP-InputWord, .CCGMP-InputWordDef',
            function () {
                mOptions._imeComposing = false;
                $(this).trigger('input');
            }
        );

        $mainContainer.on(
            'keydown',
            '.CCGMP-InputWord, .CCGMP-InputWordDef',
            function (e) {
                if (mOptions.gameOver) {
                    e.preventDefault();
                    return;
                }

                if (
                    e.isComposing ||
                    (e.originalEvent && e.originalEvent.isComposing) ||
                    e.keyCode === 229 ||
                    e.key === 'Dead' ||
                    mOptions._imeComposing
                ) {
                    return;
                }
                let ismobile = $eXeCrucigrama.isMobile(),
                    input = $(this),
                    maxLength =
                        mOptions.wordsGame[mOptions.activeQuestion].word.length,
                    currentValue = input.val(),
                    cursorPosition = input[0].selectionStart;

                const validKeys =
                    /[a-zA-ZçÇáéíóúÁÉÍÓÚñÑäëïöüÄËÏÖÜ0-9àÀèÈòÒïÏüÜ]/;
                if (e.key === 'Tab' && $(this).hasClass('CCGMP-InputWordDef')) {
                    $exeDevices.iDevice.gamification.media.stopSound(mOptions);
                    e.preventDefault();
                    let currentNumber = parseInt($(this).data('number')) + 1;
                    // Wrap around to 0 if we exceed the number of words
                    if (currentNumber >= mOptions.wordsGame.length) {
                        currentNumber = 0;
                    }
                    mOptions.activeQuestion = currentNumber;
                    let input = $('#ccgmMainContainer-' + instance).find(
                        `input.CCGMP-InputWordDef[data-number=${currentNumber}]`
                    );
                    if (input.length > 0) {
                        input.focus();
                        input[0].setSelectionRange(0, 0);
                    }
                } else if (
                    $eXeCrucigrama.isIgnoredKey(e.key) ||
                    e.key === 'ArrowDown' ||
                    e.key === 'ArrowUp' ||
                    e.key === 'Delete'
                ) {
                    e.preventDefault();
                } else if (e.key === 'ArrowLeft') {
                    //
                } else if (e.key === 'ArrowRight') {
                    //
                } else if (validKeys.test(e.key)) {
                    return;
                } else if (!ismobile && e.key === 'Backspace') {
                    e.preventDefault();
                    if (cursorPosition > 0 && cursorPosition <= maxLength) {
                        let val =
                            currentValue.slice(0, cursorPosition - 1) +
                            '_' +
                            currentValue.slice(cursorPosition);
                        input.val(val);
                        cursorPosition -= 1;
                        input[0].setSelectionRange(
                            cursorPosition,
                            cursorPosition
                        );
                        $eXeCrucigrama.updateCrossword(
                            instance,
                            mOptions.activeQuestion,
                            $(this)
                        );
                        if ($(this).hasClass('CCGMP-InputWordDef')) {
                            $eXeCrucigrama.updateInputs(
                                instance,
                                mOptions.activeQuestion
                            );
                        }
                    }
                } else {
                    e.preventDefault();
                }
            }
        );

        $mainContainer.on(
            'input',
            '.CCGMP-InputWordDef, .CCGMP-InputWord',
            function () {
                if (mOptions.gameOver || mOptions._imeComposing) return;
                let input = $(this),
                    maxLength =
                        mOptions.wordsGame[mOptions.activeQuestion].word.length,
                    currentValue = (input.val() || '').normalize('NFC'),
                    cursorPosition = input[0].selectionStart;
                const validKeys = /[\p{L}\p{N}_]/u;

                let codepoints = Array.from(currentValue),
                    lastChar = codepoints[cursorPosition - 1] || '',
                    text = '',
                    isValid = validKeys.test(lastChar);

                if (isValid && currentValue.length >= maxLength) {
                    text = $eXeCrucigrama.deleteCharacter(
                        currentValue,
                        cursorPosition,
                        maxLength
                    );
                } else if (currentValue.length <= maxLength) {
                    text = $eXeCrucigrama.insertSpace(
                        currentValue,
                        cursorPosition,
                        maxLength
                    );
                } else {
                    text = $eXeCrucigrama.deleteCharacter(
                        currentValue,
                        cursorPosition - 1,
                        maxLength
                    );
                }

                $eXeCrucigrama.updateCrossword(
                    instance,
                    mOptions.activeQuestion,
                    $(this)
                );

                if ($(this).hasClass('CCGMP-InputWordDef')) {
                    $eXeCrucigrama.updateInputs(
                        instance,
                        mOptions.activeQuestion
                    );
                }

                input.val(text);
                input[0].setSelectionRange(cursorPosition, cursorPosition);
            }
        );

        $mainContainer.on('click touchend', '.CCGMP-InputWord', function () {
            mOptions.focused = 2;
            if (mOptions.gameOver) {
                $(this).blur();
                return;
            }
            let cursorPosition = this.selectionStart;
            this.setSelectionRange(cursorPosition, cursorPosition);
        });

        $mainContainer.on('click touchend', '.CCGMP-InputWordDef', function () {
            mOptions.focused = 1;
            if (mOptions.gameOver) {
                $(this).blur();
                return;
            }
            let cursorPosition = this.selectionStart;
            this.setSelectionRange(cursorPosition, cursorPosition);
        });

        $mainContainer.on('click touchend', '.CCGMP-Number', function (e) {
            e.preventDefault();
            if (mOptions.gameOver) return;
            $(this).closest('.CCGMP-Cell').find('input').click();
            $(this).closest('.CCGMP-Cell').find('input').focus();
        });

        $mainContainer.find('.exeQuextIcons-Time').hide();
        $('#ccgmPTime-' + instance).hide();

        if (mOptions.hasBack && mOptions.authorBackImage.length > 0) {
            $('#ccgmAuthorBackImage-' + instance).html(
                mOptions.authorBackImage
            );
            $('#ccgmAuthorBackImage-' + instance).css('display', 'flex');
        }

        if (mOptions.time == 0 && !mOptions.showCodeAccess) {
            mOptions.gameStarted = false;
            $eXeCrucigrama.startGame(instance);
        }

        $eXeCrucigrama.updateTime(mOptions.time * 60, instance);
        setTimeout(function () {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);
    },

    deleteCharacter(text, position, maxLength) {
        let currentValue = text,
            charArray = currentValue.split('');

        position = position < 0 ? 0 : position;
        charArray.splice(position, 1);

        let modifiedString = charArray.join('');
        modifiedString = modifiedString.slice(0, maxLength);
        return modifiedString;
    },

    insertSpace: function (text, position, maxLength) {
        let currentValue = text,
            charArray = currentValue.split('');
        position = position < 0 ? 0 : position;
        charArray.splice(position + 1, 0, '_');
        let modifiedString = charArray.join('');
        modifiedString = modifiedString.slice(0, maxLength);
        return modifiedString;
    },

    isMobile: function () {
        const userAgent =
                navigator.userAgent || navigator.vendor || window.opera,
            mobileDeviceRegex =
                /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone|Kindle|Silk|PlayBook|BB10|Mobile|Tablet|Nintendo|Switch|PSP|PlayStation/i,
            isTouchDevice =
                'ontouchstart' in window || navigator.maxTouchPoints > 0,
            isSmallScreen = window.innerWidth <= 768;
        return (
            mobileDeviceRegex.test(userAgent) || isTouchDevice || isSmallScreen
        );
    },

    modeDefinitions: function (instance) {
        let mOptions = $eXeCrucigrama.options[instance],
            $icon = $('#ccgmIconShowDefinitions-' + instance);
        $icon.removeClass('exeQuextIcons-Definitions exeQuextIcons-Crossword');
        $('#ccgmMultimedia-' + instance).hide();
        $icon.addClass('exeQuextIcons-Crossword');
        $eXeCrucigrama.updateInputs(instance, -1);
        $('#ccgmDefinitions-' + instance).show();
        if (mOptions.activeQuestion >= 0) {
            setTimeout(function () {
                $('#ccgmMainContainer-' + instance)
                    .find(
                        `input.CCGMP-InputWordDef[data-number='${mOptions.activeQuestion}']`
                    )
                    .focus();
                mOptions.focused = 2;
            }, 0);
        }
    },

    completeCrosswordFromInputs: function (instance, preserveExisting = false) {
        let mOptions = $eXeCrucigrama.options[instance];

        $('#ccgmMainContainer-' + instance)
            .find('.CCGMP-InputWordDef')
            .each(function () {
                let wordindex = $(this).data('number'),
                    inputWord = $(this).val();

                if (inputWord && mOptions.mappedWords[wordindex]) {
                    inputWord.split('').forEach((char, index) => {
                        let letter = char === '_' ? '' : char,
                            row = mOptions.mappedWords[wordindex][index].row,
                            col = mOptions.mappedWords[wordindex][index].col;
                        const $cellInput = $(`#ccgmCrossword-${instance}`).find(
                            `input[data-row=${row}][data-col=${col}]`
                        );
                        if ($cellInput.length) {
                            // Si preserveExisting es true, solo rellenar celdas vacías
                            // Si es false, sobrescribir siempre (comportamiento original para verificación)
                            if (!preserveExisting || !$cellInput.val()) {
                                $cellInput.val(letter);
                            }
                        }
                    });
                }
            });
    },
    modeCrossword: function (instance) {
        let mOptions = $eXeCrucigrama.options[instance],
            $icon = $('#ccgmIconShowDefinitions-' + instance);

        $icon.removeClass('exeQuextIcons-Definitions exeQuextIcons-Crossword');
        $icon.addClass('exeQuextIcons-Definitions');
        $('#ccgmDefinitions-' + instance).hide();
        $('#ccgmMultimedia-' + instance).show();

        // Preserve existing values (like hint letters) when copying from definitions
        $eXeCrucigrama.completeCrosswordFromInputs(instance, true);

        mOptions.focused = 0;
        if (mOptions.activeQuestion >= 0) {
            setTimeout(function () {
                const davi = $('#ccgmCrossword-' + instance)
                    .find(`input[data-vi='${mOptions.activeQuestion}']`)
                    .first();
                const dahi = $('#ccgmCrossword-' + instance)
                    .find(`input[data-hi='${mOptions.activeQuestion}']`)
                    .first();
                const $firstInput =
                    mOptions.activeQuestion < mOptions.half ? davi : dahi;
                $firstInput.focus();
                $eXeCrucigrama.updateInputPresentation(
                    instance,
                    mOptions.activeQuestion
                );
            }, 0);
        }
    },

    updateCrossword: function (instance, wordindex, $input) {
        let mOptions = $eXeCrucigrama.options[instance],
            word = mOptions.wordsGame[wordindex].word;
        const $crossword = $('#ccgmCrossword-' + instance);

        let inputs = $input.val(),
            $crucigramaCells = $crossword.find(`input[data-hi='${wordindex}']`);

        if (wordindex < mOptions.half) {
            $crucigramaCells = $crossword.find(`input[data-vi='${wordindex}']`);
        }

        $crucigramaCells.val('');
        for (let i = 0; i < word.length; i++) {
            let $inputCell = $crucigramaCells.eq(i);
            if (i < inputs.length && i < $crucigramaCells.length) {
                let currentChar = inputs.charAt(i);
                if (currentChar === '_') {
                    $inputCell.val('');
                } else {
                    $inputCell.val(currentChar);
                }
            }
        }
    },

    isIgnoredKey: function (key) {
        const ignoredKeys = [
            'Shift',
            'Control',
            'Alt',
            'Meta',
            'CapsLock',
            'AltGraph',
            'Tab',
            'Escape',
            'Insert',
            'PageUp',
            'PageDown',
            'End',
            'Home',
            'F1',
            'F2',
            'F3',
            'F4',
            'F5',
            'F6',
            'F7',
            'F8',
            'F9',
            'F10',
            'F11',
            'F12',
            'Enter',
        ];
        return ignoredKeys.includes(key);
    },

    startGame: function (instance) {
        const mOptions = $eXeCrucigrama.options[instance];

        if (mOptions.gameStarted) return;

        $('#ccgmShowClue-' + instance).hide();
        $('#ccgmCheck-' + instance).show();
        $('#ccgmStartGame-' + instance).hide();
        $('#ccgmActiveDefinition-' + instance).show();
        $('#ccgmShowDefinitions-' + instance).show();
        $('#ccgmPShowClue-' + instance).text('');
        $('#ccgmMessage-' + instance).hide();
        $('#ccgmActiveDefinition-' + instance).show();
        $('#ccgmActiveDefinition-' + instance).html(
            mOptions.msgs.msgSelectWord
        );

        mOptions.hits = 0;
        mOptions.score = 0;
        mOptions.activeQuestion = -1;
        mOptions.counter = 0;
        mOptions.gameOver = false;
        mOptions.obtainedClue = false;
        mOptions.solutionsShow = false;

        if (mOptions.time > 0) {
            $('#ccgmGameContainer-' + instance)
                .find('.exeQuextIcons-Time')
                .show();
            $('#ccgmPTime-' + instance).show();
            mOptions.counter = mOptions.time * 60;
            mOptions.counterClock = setInterval(function () {
                let $node = $('#ccgmMainContainer-' + instance);
                let $content = $('#node-content');
                if (
                    !$node.length ||
                    ($content.length && $content.attr('mode') === 'edition')
                ) {
                    clearInterval(mOptions.counterClock);
                    return;
                }
                if (mOptions.gameStarted) {
                    mOptions.counter--;
                    $eXeCrucigrama.updateTime(mOptions.counter, instance);
                    if (mOptions.counter <= 0) {
                        clearInterval(mOptions.counterClock);
                        $eXeCrucigrama.verifyCrossword(instance);
                        return;
                    }
                }
            }, 1000);
            $eXeCrucigrama.updateTime(mOptions.time * 60, instance);
        }

        $('#ccgmCrossword-' + instance)
            .find('input')
            .each(function () {
                $(this).prop('readonly', false);
            });

        mOptions.gameStarted = true;
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeCrucigrama.options[instance];

        if (
            mOptions.itinerary.codeAccess.toLowerCase() ==
            $('#ccgmCodeAccessE-' + instance)
                .val()
                .toLowerCase()
        ) {
            $('#ccgmLinkMaximize-' + instance).trigger('click');
            $eXeCrucigrama.showCubiertaOptions(instance, false);
            $eXeCrucigrama.startGame(instance);
        } else {
            $('#ccgmMesajeAccesCodeE-' + instance)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $('#ccgmCodeAccessE-' + instance).val('');
        }
    },

    updateTime: function (tiempo, instance) {
        let mTime =
            $exeDevices.iDevice.gamification.helpers.getTimeToString(tiempo);
        $('#ccgmPTime-' + instance).text(mTime);
    },

    gameOver: function (instance) {
        const mOptions = $eXeCrucigrama.options[instance],
            score = ((mOptions.hits * 10) / mOptions.numberQuestions).toFixed(
                2
            );

        clearInterval(mOptions.counterClock);

        mOptions.gameStarted = false;
        mOptions.gameOver = true;
        $exeDevices.iDevice.gamification.media.stopSound(mOptions);

        if (mOptions.isScorm == 1) {
            $eXeCrucigrama.sendScore(true, instance);
            $('#ccgmRepeatActivity-' + instance).text(
                mOptions.msgs.msgYouScore + ': ' + score
            );
            $eXeCrucigrama.initialScore = score;
        }

        if (mOptions.itinerary.showClue) {
            if (
                (mOptions.hits * 100) / mOptions.numberQuestions >=
                mOptions.itinerary.percentageClue
            ) {
                $('#ccgmPShowClue-' + instance).text(
                    mOptions.msgs.msgInformation +
                        ': ' +
                        mOptions.itinerary.clueGame
                );
            } else {
                $('#ccgmPShowClue-' + instance).text(
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.itinerary.percentageClue
                    )
                );
            }
            $('#ccgmShowClue-' + instance).show();
        }

        $('#ccgmCrossword-' + instance)
            .find('input')
            .prop('readonly', true);
        $('#ccgmMainContainer-' + instance)
            .find('.CCGMP-InputWord')
            .prop('readonly', true);
        $('#ccgmMainContainer-' + instance)
            .find('.CCGMP-InputWordDef')
            .prop('readonly', true);

        $eXeCrucigrama.highlightWord(
            instance,
            mOptions.wordIndex,
            mOptions.word >= mOptions.half
        );
        $eXeCrucigrama.saveEvaluation(instance);
        $eXeCrucigrama.showFeedBack(instance);
    },

    showFeedBack: function (instance) {
        const mOptions = $eXeCrucigrama.options[instance],
            puntos = (mOptions.hits * 100) / mOptions.wordsGame.length;

        if (mOptions.feedBack) {
            if (puntos >= mOptions.percentajeFB) {
                $eXeCrucigrama.showCubiertaOptions(instance, 1);
            } else {
                let message = $('#ccgmPMessage-' + instance).text();
                message +=
                    ' ' +
                    mOptions.msgs.msgTryAgain.replace(
                        '%s',
                        mOptions.percentajeFB
                    );
                $eXeCrucigrama.showMessage(1, message, instance);
            }
        }
    },

    showMessage: function (type, message, instance) {
        let colors = [
                '#555555',
                $eXeCrucigrama.borderColors.red,
                $eXeCrucigrama.borderColors.green,
                $eXeCrucigrama.borderColors.blue,
                $eXeCrucigrama.borderColors.deepblue,
            ],
            color = colors[type];
        $('#ccgmPMessage-' + instance).text(message);
        $('#ccgmPMessage-' + instance).css('color', color);
        $('#ccgmMessage-' + instance).fadeIn();
    },
};
$(function () {
    $eXeCrucigrama.init();
});
