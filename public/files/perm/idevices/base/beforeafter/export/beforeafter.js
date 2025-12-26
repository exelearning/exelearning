/**
 * Relaciona activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeBeforeAfter = {
    idevicePath: '',
    borderColors: $exeDevices.iDevice.gamification.colors.borderColors,
    colors: $exeDevices.iDevice.gamification.colors.backColor,
    options: [],
    hasSCORMbutton: false,
    isInExe: false,
    userName: '',
    previousScore: '',
    initialScore: '',
    version: 3,
    scormAPIwrapper: 'libs/SCORM_API_wrapper.js',
    scormFunctions: 'libs/SCOFunctions.js',
    mScorm: null,
    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Before/After',
            'beforeafter',
            'beforeafter-IDevice'
        );
    },

    enable: function () {
        $eXeBeforeAfter.loadGame();
    },

    loadGame: function () {
        $eXeBeforeAfter.options = [];

        $eXeBeforeAfter.activities.each(function (i) {
            const dl = $('.beforeafter-DataGame', this);
            const mOption = $eXeBeforeAfter.loadDataGame(dl, this);

            mOption.scorerp = 0;
            mOption.idevicePath = $eXeBeforeAfter.idevicePath;
            mOption.main = 'bfafMainContainer-' + i;
            mOption.idevice = 'beforeafter-IDevice';

            $eXeBeforeAfter.options.push(mOption);

            const bfaf = $eXeBeforeAfter.createInterfaceCards(i);

            dl.before(bfaf).remove();
            $('#bfafGameMinimize-' + i).hide();
            $('#bfafGameContainer-' + i).hide();
            $('#bfafCubierta-' + i).hide();
            if (mOption.showMinimize) {
                $('#bfafGameMinimize-' + i)
                    .css({ cursor: 'pointer' })
                    .show();
            } else {
                $('#bfafGameContainer-' + i).show();
            }
            $eXeBeforeAfter.addEvents(i);
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $eXeBeforeAfter,
                node
            );

        const html = $('.beforeafter-IDevice').html();
        if ($exeDevices.iDevice.gamification.math.hasLatex(html)) {
            $exeDevices.iDevice.gamification.math.updateLatex(
                '.beforeafter-IDevice'
            );
        }
    },

    loadDataGame: function (data, sthis) {
        const json = data.text(),
            mOptions =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json),
            $imagesLink = $('.beforeafter-LinkImages', sthis),
            $imagesLinkBack = $('.beforeafter-LinkImagesBack', sthis);

        mOptions.gameStarted = false;
        mOptions.visiteds = 0;

        $imagesLink.each(function () {
            const iq = parseInt($(this).text());
            if (!isNaN(iq) && iq < mOptions.cardsGame.length) {
                const flipcard = mOptions.cardsGame[iq];
                flipcard.url = $(this).attr('href');
                if (flipcard.url.length < 4) {
                    flipcard.url = '';
                }
            }
        });

        $imagesLinkBack.each(function () {
            const iq = parseInt($(this).text());
            if (!isNaN(iq) && iq < mOptions.cardsGame.length) {
                const flipcard = mOptions.cardsGame[iq];
                flipcard.urlBk = $(this).attr('href');
                if (flipcard.urlBk.length < 4) {
                    flipcard.urlBk = '';
                }
            }
        });

        mOptions.id = typeof mOptions.id === 'undefined' ? false : mOptions.id;
        mOptions.hits = 0;
        mOptions.score = 0;
        mOptions.active = 0;
        mOptions.obtainedClue = false;
        mOptions.gameStarted = false;

        for (let i = 0; i < mOptions.cardsGame.length; i++) {
            mOptions.cardsGame[i].id = i;
            mOptions.cardsGame[i].eText = mOptions.cardsGame[i].eText;
            mOptions.cardsGame[i].eTextBk = mOptions.cardsGame[i].eTextBk;
        }

        mOptions.numberCards = mOptions.cardsGame.length;
        mOptions.fullscreen = false;
        return mOptions;
    },

    startGame: function (instance) {
        let mOptions = $eXeBeforeAfter.options[instance];
        if (mOptions.gameStarted) return;
        mOptions.gameStarted = true;
        mOptions.hits = 0;
        mOptions.score = 0;
        mOptions.gameOver = false;
        mOptions.obtainedClue = false;
        $('#bfafCubierta-' + instance).hide();
        $('#bfafStartGame-' + instance).hide();
        if (mOptions.isScorm > 0) {
            $eXeBeforeAfter.sendScore(true, instance);
        }
        $eXeBeforeAfter.saveEvaluation(instance);
        $eXeBeforeAfter.showClue(instance);
    },

    createInterfaceCards: function (instance) {
        const path = $eXeBeforeAfter.idevicePath,
            msgs = $eXeBeforeAfter.options[instance].msgs,
            mOptions = $eXeBeforeAfter.options[instance],
            html = `
        <div class="BFAFP-MainContainer" id="bfafMainContainer-${instance}">
            <div class="BFAFP-GameMinimize" id="bfafGameMinimize-${instance}">
                <a href="#" class="BFAFP-LinkMaximize" id="bfafLinkMaximize-${instance}" title="${msgs.msgMaximize}">
                    <img src="${path}beforeafter-icon.png" class="BFAFP-IconMinimize BFAFP-Activo" alt="">
                    <div class="BFAFP-MessageMaximize" id="bfafMessageMaximize-${instance}">${msgs.msgPlayStart}</div>
                </a>
            </div>
            <div class="BFAFP-GameContainer" id="bfafGameContainer-${instance}">
                <div class="BFAFP-Information">
                    <a href="#" style="display:none" id="bfafStartGame-${instance}">${msgs.msgPlayStart}</a>
                    <p class="BFAFP-Message" id="bfafMessage-${instance}"></p>
                </div>
                <div class="BFAFP-NumberInfo" id="bfafNumberInfo-${instance}"></div>
                <div class="BFAFP-ButtonsBar" id="bfafButtonsBar-${instance}">
                    <button id="bfafPrevious-${instance}" class="BFAFP-CustomBtn BFAFP-Activo" aria-label="${msgs.msgPrevious}">
                        <img src="${path}bfafprevious.png" alt="${msgs.msgPrevious}">
                    </button>
                    <div class="BFAFP-NumberInfo" id="bfafpDescription-${instance}"></div>
                    <button id="bfafNext-${instance}" class="BFAFP-CustomBtn BFAFP-Activo" aria-label="${msgs.msgNext}">
                        <img src="${path}bfafnext.png" alt="${msgs.msgNext}">
                    </button>
                </div>
                <div class="BFAFP-Multimedia" id="bfafMultimedia-${instance}">
                    ${$eXeBeforeAfter.getMainHtml(instance)}                        
                </div>
                <div class="BFAFP-AuthorGame" id="bfafAuthorGame-${instance}"></div>
            </div>
            <div class="BFAFP-Cover" id="bfafCubierta-${instance}">
                <div class="BFAFP-CodeAccessDiv" id="bfafCodeAccessDiv-${instance}">
                    <div class="BFAFP-MessageCodeAccessE" id="bfafMesajeAccesCodeE-${instance}"></div>
                    <div class="BFAFP-DataCodeAccessE">
                        <label class="sr-av">${msgs.msgCodeAccess}:</label>
                        <input type="text" class="BFAFP-CodeAccessE form-control" id="bfafCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess}">
                        <a href="#" id="bfafCodeAccessButton-${instance}" title="${msgs.msgSubmit}">
                            <strong><span class="sr-av">${msgs.msgSubmit}</span></strong>
                            <div class="exeQuextIcons-Submit BFAFP-Activo"></div>
                        </a>
                    </div>
                </div>
            </div>
        </div>
        ${$exeDevices.iDevice.gamification.scorm.addButtonScoreNew(mOptions, this.isInExe)}
    `;
        return html;
    },

    getMainHtml: function (instance) {
        const mOptions = $eXeBeforeAfter.options[instance];
        const msgs = mOptions.msgs;
        const orientation = mOptions.cardsGame[mOptions.active].vertical
            ? 'vertical'
            : 'horizontal';
        const html = `<div class="BFAFP-ContainerBA" id="bfafpContainerBA-${instance}" data-orientation=${orientation}>
                <img id="bfafpImageBefore-${instance}" src="" alt="${msgs.msgBeforeImage}" class="BFAFP-ImageBefore">
                <div class="BFAFP-TitleBefore" id="bfafTitleBefore-${instance}"></div>
                <div class="BFAFP-Overlay"  id="bfafpOverlay-${instance}">
                    <img  id="bfafpImageAfter-${instance}" src="" alt="${msgs.msgAfterImage}">
                    <div class="BFAFP-TitleAfter" id="bfafTitleAfter-${instance}"></div>
                </div>
                <div class="BFAFP-Slider" id="bfafpSlider-${instance}"></div>
                 <a href="#" class="BFAFP-LinkFullScreen" id="bfafLinkFullScreen-${instance}" title="${msgs.msgFullScreen}">
                    <strong><span class="sr-av">${msgs.msgFullScreen}:</span></strong>
                    <div class="exeQuextIcons exeQuextIcons-FullScreen BFAFP-Activo" id="bfafFullScreen-${instance}"></div>
                </a>
            </div>`;
        return html;
    },

    showImage: function (number, instance) {
        const mOptions = $eXeBeforeAfter.options[instance];
        const $imgAfter = $(`#bfafpImageAfter-${instance}`);
        const $imgBefore = $(`#bfafpImageBefore-${instance}`);
        const $Multimedia = $(`#bfafMultimedia-${instance}`);
        const $overlay = $(`#bfafpOverlay-${instance}`);
        const $slider = $(`#bfafpSlider-${instance}`);
        const $nubmerInfo = $(`#bfafNumberInfo-${instance}`);
        const $containerBA = $(`#bfafpContainerBA-${instance}`);
        const $description = $(`#bfafpDescription-${instance}`);
        const $titleAfter = $(`#bfafTitleAfter-${instance}`);
        const $titleBefore = $(`#bfafTitleBefore-${instance}`);
        mOptions.active = number;
        mOptions.visiteds =
            mOptions.visiteds < number ? number : mOptions.visiteds;

        const isVertical = mOptions.cardsGame[number].vertical;

        const orientation = isVertical ? 'vertical' : 'horizontal';
        $containerBA.css('opacity', 0);
        $containerBA.attr('data-orientation', orientation);
        $description.html(mOptions.cardsGame[number].description);

        const card = mOptions.cardsGame[number];
        $imgAfter.attr('alt', card.alt);
        $imgBefore.attr('alt', card.altBk);

        // Handler for image load - extracted to fix cached image race condition
        const handleImageLoad = function () {
            let naturalWidth = this.naturalWidth;
            let naturalHeight = this.naturalHeight;

            let containerWidth = $Multimedia.width();
            let containerHeight = $Multimedia.height();

            let ratioAncho = naturalWidth / containerWidth;
            let ratioAlto = naturalHeight / containerHeight;

            if (ratioAncho > ratioAlto) {
                let nuevoAlto =
                    naturalHeight * (containerWidth / naturalWidth);
                $imgAfter.css({
                    width: containerWidth + 'px',
                    height: nuevoAlto + 'px',
                });
                $imgBefore.css({
                    width: containerWidth + 'px',
                    height: nuevoAlto + 'px',
                });
                $containerBA.css({
                    width: containerWidth + 'px',
                    height: nuevoAlto + 'px',
                });
            } else {
                let nuevoAncho =
                    naturalWidth * (containerHeight / naturalHeight);
                $imgAfter.css({
                    height: containerHeight + 'px',
                    width: nuevoAncho + 'px',
                });
                $imgBefore.css({
                    height: containerHeight + 'px',
                    width: nuevoAncho + 'px',
                });
                $containerBA.css({
                    height: containerHeight + 'px',
                    width: nuevoAncho + 'px',
                });
            }
            const percentageInit = card.position;
            const containerWidth1 = $containerBA.width();
            const containerHeight1 = $containerBA.height();

            const containerSize = isVertical
                ? containerHeight1
                : containerWidth1;

            const pos = (percentageInit / 100) * containerSize;
            $overlay.css({ border: '' });
            $slider.css({ border: '' });
            $titleBefore.removeClass(
                'BFAFP-TitleBefore BFAFP-TitleBeforeV'
            );
            $titleAfter.removeClass('BFAFP-TitleAfter BFAFP-TitleAfterV');
            $titleBefore.hide();
            $titleAfter.hide();

            if (card.eText.length > 0) {
                $titleAfter.html(card.eText).show();
            }
            if (card.eTextBk.length > 0) {
                $titleBefore.html(card.eTextBk).show();
            }
            $nubmerInfo.text(
                `${mOptions.msgs.msgImage}: ${number + 1}/${mOptions.cardsGame.length}`
            );

            if (mOptions.gameStarted && mOptions.isScorm > 0) {
                $eXeBeforeAfter.sendScore(true, instance);
            }
            if (mOptions.gameStarted) {
                $eXeBeforeAfter.saveEvaluation(instance);
                $eXeBeforeAfter.showClue(instance);
            }

            if (isVertical) {
                $overlay.height(pos);
                $overlay.css({ 'border-bottom': '4px solid #555' });
                $overlay.width(containerWidth1);
                $slider.css({ left: 0, top: pos - 3 + 'px' });
                $imgAfter.css({ cursor: 'n-resize' });
                $imgBefore.css({ cursor: 's-resize' });
                $titleBefore.addClass('BFAFP-TitleBeforeV');
                $titleAfter.addClass('BFAFP-TitleAfterV');
            } else {
                $overlay.width(pos);
                $overlay.css({ 'border-right': '4px solid #555' });
                $overlay.height(containerHeight1);
                $slider.css({ left: pos - 3 + 'px', top: 0 });
                $imgAfter.css({ cursor: 'w-resize' });
                $imgBefore.css({ cursor: 'e-resize' });
                $titleBefore.addClass('BFAFP-TitleBefore');
                $titleAfter.addClass('BFAFP-TitleAfter');
            }
            setTimeout(function () {
                $eXeBeforeAfter.initComparison(number, instance);
                $containerBA.animate({ opacity: 1 }, 500);
            }, 200);
        };

        // Fix for cached images: attach handler BEFORE setting src
        // This ensures the load event is captured even for cached images
        $imgAfter.off('load').one('load', handleImageLoad);
        $imgBefore.prop('src', card.urlBk);
        $imgAfter.attr('src', card.url);

        // For cached images, the load event may have already fired synchronously
        // Use setTimeout(0) to check after the current execution context
        setTimeout(function () {
            if ($imgAfter[0].complete && $imgAfter[0].naturalWidth > 0) {
                $imgAfter.trigger('load');
            }
        }, 0);
    },

    initComparison: function (number, instance) {
        const mOptions = $eXeBeforeAfter.options[instance],
            container = document.querySelector('#bfafpContainerBA-' + instance),
            overlay = container.querySelector('.BFAFP-Overlay'),
            slider = container.querySelector('.BFAFP-Slider'),
            card = mOptions.cardsGame[number];

        if (!overlay || !slider) return;

        const isVertical = card.vertical;

        if (slider._initComparisonHandlers) {
            slider.removeEventListener(
                'mousedown',
                slider._initComparisonHandlers.startSlide
            );
            slider.removeEventListener(
                'touchstart',
                slider._initComparisonHandlers.startSlide
            );
            window.removeEventListener(
                'mouseup',
                slider._initComparisonHandlers.stopSlide
            );
            window.removeEventListener(
                'touchend',
                slider._initComparisonHandlers.stopSlide
            );
            window.removeEventListener(
                'mousemove',
                slider._initComparisonHandlers.slideMove
            );
            window.removeEventListener(
                'touchmove',
                slider._initComparisonHandlers.slideMove
            );
            window.removeEventListener(
                'touchmove',
                slider._initComparisonHandlers.containerClick
            );
        }

        let clicked = false;

        const getContainerSize = () =>
            isVertical ? container.offsetHeight : container.offsetWidth;

        const getCursorPos = (e) => {
            const point = e.touches ? e.touches[0] : e,
                rect = container.getBoundingClientRect();
            return isVertical
                ? point.clientY - rect.top
                : point.clientX - rect.left;
        };

        const slide = (pos) => {
            const size = getContainerSize(),
                clamped = Math.max(0, Math.min(pos, size)),
                offset =
                    clamped -
                    (isVertical ? slider.offsetHeight : slider.offsetWidth) / 2;
            if (isVertical) {
                overlay.style.height = `${clamped}px`;
                slider.style.top = `${offset - 3}px`;
            } else {
                overlay.style.width = `${clamped}px`;
                slider.style.left = `${offset - 3}px`;
            }
        };

        const slideMove = (e) => clicked && slide(getCursorPos(e));

        const startSlide = (e) => {
            e.preventDefault();
            clicked = true;
            slideMove(e);
            window.addEventListener('mousemove', slideMove);
            window.addEventListener('touchmove', slideMove, { passive: true });
        };

        const stopSlide = () => {
            clicked = false;
            window.removeEventListener('mousemove', slideMove);
            window.removeEventListener('touchmove', slideMove);
        };

        slider._initComparisonHandlers = { startSlide, stopSlide, slideMove };

        slider.addEventListener('mousedown', startSlide);
        slider.addEventListener('touchstart', startSlide, { passive: true });
        window.addEventListener('mouseup', stopSlide);
        window.addEventListener('touchend', stopSlide);

        if (
            container._initComparisonHandlers &&
            container._initComparisonHandlers.containerClick
        ) {
            container.removeEventListener(
                'click',
                container._initComparisonHandlers.containerClick
            );
        }

        const containerClick = (e) => {
            if (e.target === slider) return;

            const pos = getCursorPos(e);
            const newOffset =
                pos -
                (isVertical ? slider.offsetHeight / 2 : slider.offsetWidth / 2);
            if (isVertical) {
                $(overlay).animate({ height: pos }, 500, 'swing');
                $(slider).animate({ top: newOffset }, 500, 'swing');
            } else {
                $(overlay).animate({ width: pos }, 500, 'swing');
                $(slider).animate({ left: newOffset }, 500, 'swing');
            }
        };

        container._initComparisonHandlers =
            container._initComparisonHandlers || {};
        container._initComparisonHandlers.containerClick = containerClick;
        container.addEventListener('click', containerClick);

        const percentageInit =
            mOptions.cardsGame[mOptions.active].position || 50;
        const initPos = (percentageInit / 100) * getContainerSize();
        slide(initPos);
    },

    showClue: function (instance) {
        const mOptions = $eXeBeforeAfter.options[instance],
            percentageHits =
                (mOptions.visiteds * 10) / mOptions.cardsGame.length;
        if (
            mOptions.itinerary.showClue &&
            percentageHits >= mOptions.itinerary.percentageClue &&
            !mOptions.obtainedClue
        ) {
            mOptions.obtainedClue = true;
            const msg = `${mOptions.msgs.msgInformation}: ${mOptions.itinerary.clueGame}`;
            $eXeBeforeAfter.showMessage(2, msg, instance);
        }
    },

    removeEvents: function (instance) {
        $(`#bfafLinkMaximize-${instance}`).off('click touchstart');
        $(`#bfafLinkMinimize-${instance}`).off('click touchstart');
        $(`#bfafCodeAccessButton-${instance}`).off('click touchstart');
        $(`#bfafCodeAccessE-${instance}`).off('keydown');
        $(window).off('unload.eXeBeforeAfter beforeunload.eXeBeforeAfter');
    },

    addEvents: function (instance) {
        const mOptions = $eXeBeforeAfter.options[instance];
        const $bfafGameContainer = $('#bfafGameContainer-' + instance);

        $eXeBeforeAfter.removeEvents(instance);

        $('#bfafLinkMaximize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $bfafGameContainer.show();
            $('#bfafGameMinimize-' + instance).hide();
        });

        $('#bfafLinkMinimize-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $bfafGameContainer.hide();
            $('#bfafGameMinimize-' + instance)
                .css('visibility', 'visible')
                .show();
        });

        $('#bfafCubierta-' + instance).hide();
        $('#bfafCodeAccessDiv-' + instance).hide();

        if (mOptions.itinerary && mOptions.itinerary.showCodeAccess) {
            $('#bfafMesajeAccesCodeE-' + instance).text(
                mOptions.itinerary.messageCodeAccess
            );
            $('#bfafCodeAccessDiv-' + instance).show();
            $('#bfafShowClue-' + instance).hide();
            $('#bfafCubierta-' + instance).show();
        }

        $('#bfafCodeAccessButton-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                $eXeBeforeAfter.enterCodeAccess(instance);
            }
        );

        $('#bfafCodeAccessE-' + instance).on('keydown', function (event) {
            if (event.which == 13 || event.keyCode == 13) {
                $eXeBeforeAfter.enterCodeAccess(instance);
                return false;
            }
            return true;
        });

        $('#beforeEPosition')
            .on('keyup click', function () {
                this.value = this.value.replace(/\D/g, '').substring(0, 3);
            })
            .on('focusout', function () {
                let value =
                    this.value.trim() === '' ? 100 : parseInt(this.value, 10);
                value = Math.max(0, Math.min(value, 100));
                this.value = value;
            });

        $(window).on(
            'unload.eXeBeforeAfter beforeunload.eXeBeforeAfter',
            function () {
                if ($eXeBeforeAfter.mScorm) {
                    $exeDevices.iDevice.gamification.scorm.endScorm(
                        $eXeBeforeAfter.mScorm
                    );
                }
            }
        );

        if (mOptions.author.trim().length > 0 && !mOptions.fullscreen) {
            $('#bfafAuthorGame-' + instance).html(
                mOptions.msgs.msgAuthor + ': ' + mOptions.author
            );
            $('#bfafAuthorGame-' + instance).show();
        }

        if (mOptions.isScorm > 0) {
            $exeDevices.iDevice.gamification.scorm.registerActivity(mOptions);
        }

        $('#bfafLinkFullScreen-' + instance).on(
            'click touchstart',
            function (e) {
                e.preventDefault();
                const element = document.getElementById(
                    'bfafGameContainer-' + instance
                );
                $exeDevices.iDevice.gamification.helpers.toggleFullscreen(
                    element
                );
                setTimeout(function () {
                    $eXeBeforeAfter.showImage(mOptions.active, instance);
                }, 500);
            }
        );

        $('#bfafNext-' + instance).on('click', function () {
            mOptions.active =
                mOptions.active < mOptions.cardsGame.length - 1
                    ? mOptions.active + 1
                    : mOptions.active;
            $eXeBeforeAfter.showImage(mOptions.active, instance);
            $eXeBeforeAfter.activeButton(mOptions.active, instance);
        });

        $('#bfafPrevious-' + instance).on('click', function () {
            mOptions.active = mOptions.active > 0 ? mOptions.active - 1 : 0;
            $eXeBeforeAfter.showImage(mOptions.active, instance);
            $eXeBeforeAfter.activeButton(mOptions.active, instance);
        });
        $('#bfafMultimedia-' + instance).hide();

        if (!mOptions.itinerary.showCodeAccess) {
            $('#bfafMultimedia-' + instance).show();
            $eXeBeforeAfter.showImage(0, instance);
            $eXeBeforeAfter.activeButton(0, instance);
        }

        $('#bfafGameContainer-' + instance).on('click', function () {
            if (!mOptions.gameStarted) {
                $eXeBeforeAfter.startGame(instance);
            }
        });

        setTimeout(() => {
            $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                mOptions,
                this.isInExe
            );
        }, 500);
    },

    activeButton: function (number, instance) {
        const mOptions = $eXeBeforeAfter.options[instance];
        const path = $eXeBeforeAfter.idevicePath;

        $('#bfafPrevious-' + instance)
            .prop('disabled', false)
            .find('img')
            .attr('src', `${path}bfafprevious.png`);
        $('#bfafNext-' + instance)
            .prop('disabled', false)
            .find('img')
            .attr('src', `${path}bfafnext.png`);
        $('#bfafPrevious-' + instance).css('cursor', 'pointer');
        $('#bfafNext-' + instance).css('cursor', 'pointer');
        if (number <= 0) {
            $('#bfafPrevious-' + instance)
                .prop('disabled', true)
                .find('img')
                .attr('src', `${path}bfafpreviousd.png`);
            $('#bfafPrevious-' + instance).css('cursor', 'default');
        }

        if (number >= mOptions.cardsGame.length - 1) {
            $('#bfafNext-' + instance)
                .prop('disabled', true)
                .find('img')
                .attr('src', `${path}bfafnextd.png`);
            $('#bfafNext-' + instance).css('cursor', 'default');
        }

        if (mOptions.cardsGame.length == 1) {
            $('#bfafButtonsBar-' + instance).hide();
        }
    },

    isMobile: function () {
        return /Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(
            navigator.userAgent
        );
    },

    enterCodeAccess: function (instance) {
        const mOptions = $eXeBeforeAfter.options[instance],
            codeInput = $(`#bfafCodeAccessE-${instance}`).val().toLowerCase(),
            codeAccess = mOptions.itinerary.codeAccess.toLowerCase();
        if (codeAccess === codeInput) {
            $(
                `#bfafCodeAccessDiv-${instance}, #bfafCubierta-${instance}`
            ).hide();
            $(`#bfafLinkMaximize-${instance}`).trigger('click');
            $('#bfafMultimedia-' + instance).show();
            $eXeBeforeAfter.showImage(0, instance);
            $eXeBeforeAfter.activeButton(0, instance);
        } else {
            $(`#bfafMesajeAccesCodeE-${instance}`)
                .fadeOut(300)
                .fadeIn(200)
                .fadeOut(300)
                .fadeIn(200);
            $(`#bfafCodeAccessE-${instance}`).val('');
        }
    },

    showMessage: function (type, message, instance) {
        const colors = [
                '#555555',
                $eXeBeforeAfter.borderColors.red,
                $eXeBeforeAfter.borderColors.green,
                $eXeBeforeAfter.borderColors.blue,
                $eXeBeforeAfter.borderColors.yellow,
            ],
            color = colors[type],
            $bfafMessage = $(`#bfafMessage-${instance}`);
        $bfafMessage
            .html(message)
            .css({ color: color, 'font-style': 'bold' })
            .show();
    },

    saveEvaluation: function (instance) {
        const mOptions = $eXeBeforeAfter.options[instance];

        mOptions.scorerp =
            ((mOptions.visiteds + 1) * 10) / mOptions.cardsGame.length;
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            mOptions,
            $eXeBeforeAfter.isInExe
        );
    },

    sendScore: function (auto, instance) {
        const mOptions = $eXeBeforeAfter.options[instance];

        mOptions.scorerp =
            ((mOptions.visiteds + 1) * 10) / mOptions.cardsGame.length;
        mOptions.previousScore = $eXeBeforeAfter.previousScore;
        mOptions.userName = $eXeBeforeAfter.userName;

        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, mOptions);

        $eXeBeforeAfter.previousScore = mOptions.previousScore;
    },
};
$(function () {
    $eXeBeforeAfter.init();
});
