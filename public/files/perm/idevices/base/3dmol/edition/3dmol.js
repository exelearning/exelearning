/* eslint-disable no-undef */
/**
 * 3Dmol Quiz iDevice (edition code)
 * Based on Select Activity (quick-questions-multiple-choice).
 * Questions are paired with interactive 3D models.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    // i18n
    i18n: {
        name: _('3Dmol'),
        alt: _('3Dmol'),
    },
    idevicePath: '',
    msgs: {},
    classIdevice: 'dmole',
    active: 0,
    selectsGame: [],
    typeEdit: -1,
    numberCutCuestion: -1,
    clipBoard: '',
    id: false,
    ci18n: {},
    version: 3.1,
    modelViewer: null,
    modelStyle: 'stick',
    modelBgDark: false,
    modelLibraryLoading: false,
    modelLibraryCallbacks: [],
    defaultModelFile: 'GLC_ideal.sdf',
    defaultModelDataCache: null,
    defaultModelDataPromise: null,

    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.ci18n.msgTryAgain = this.ci18n.msgTryAgain.replace(
            '&percnt;',
            '%'
        );

        this.setMessagesInfo();
        this.createForm();
    },

    getEditorContent: function (id) {
        const editor = tinyMCE.get(id);
        if (editor) return editor.getContent();
        return $('#' + id).val() || '';
    },

    setEditorContent: function (id, content) {
        const editor = tinyMCE.get(id);
        if (editor) {
            editor.setContent(content);
        } else {
            $('#' + id).val(content);
        }
    },

    enableForm: async function () {
        await $exeDevice.initQuestions();
        $exeDevice.loadPreviousValues();
        $exeDevice.addEvents();
        // Ensure correct layout for current mode
        var currentMode = $('input[name="slcactivitymode"]:checked').val() || 'test';
        $exeDevice.toggleActivityMode(currentMode);
        // Show first question and render model preview
        $exeDevice.showQuestion($exeDevice.active);
    },

    toggleActivityMode: function (mode) {
        const isShow = mode === 'show';
        const ids = [
            'dmoleTypeDiv', 'dmoleInputNumbers', 'dmolePercentageSpan',
            'dmoleTimeDiv', 'dmoleScoreQuestionDiv',
            'dmoleShowSolutionDiv', 'dmoleGlobalTimeDiv',
            'dmoleAnswersRamdonDiv', 'dmoleModeBoardDiv'
        ];
        ids.forEach(function (id) {
            const $el = $('#' + id);
            if (isShow) {
                $el.addClass('d-none');
            } else {
                $el.removeClass('d-none');
            }
        });
        // Show mode layout: centered full-width preview
        var $panel = $('#dmolePanel');
        if (isShow) {
            $panel.addClass('DMOLE-ShowMode');
            // Move model file group below preview in multimedia column
            $('#dmoleModelFileGroup').insertAfter('#dmoleMultimedia');
            $('#dmoleAnswers, #dmoleWordDiv, #dmoleSolitionOptions').addClass('d-none');
            $('#dmoleQuestionDiv').removeClass('d-flex').addClass('d-none');
            $('#dmoleDescriptionDiv').removeClass('d-none').addClass('d-flex');
        } else {
            $panel.removeClass('DMOLE-ShowMode');
            // Move model file group to options column, before Type
            $('#dmoleModelFileGroup').insertBefore('#dmoleTypeDiv');
            $('#dmoleAnswers, #dmoleWordDiv, #dmoleSolitionOptions').removeClass('d-none');
            $('#dmoleDescriptionDiv').removeClass('d-flex').addClass('d-none');
            $('#dmoleQuestionDiv').removeClass('d-none').addClass('d-flex');
            const currentType = parseInt(
                $('input[name="slctypeselect"]:checked').val(),
                10
            );
            $exeDevice.showTypeQuestion(isNaN(currentType) ? 0 : currentType);
        }
    },

    refreshTranslations: function () {
        this.ci18n = {
            // Used in export/3dmole.js
            msgSubmit: c_('Submit'),
            msgClue: c_('Cool! The clue is:'),
            msgNewGame: c_('Click here for a new game'),
            msgCodeAccess: c_('Access code'),
            msgInformationLooking: c_(
                'Cool! The information you were looking for'
            ),
            msgPlayStart: c_('Click here to play'),
            msgErrors: c_('Errors'),
            msgHits: c_('Hits'),
            msgScore: c_('Score'),
            msgMinimize: c_('Minimize'),
            msgMaximize: c_('Maximize'),
            msgTime: c_('Time per question'),
            msgLive: c_('Life'),
            msgFullScreen: c_('Full Screen'),
            msgNumQuestions: c_('Number of questions'),
            msgNoImage: c_('No 3D model'),
            msgResetCamera: c_('Reset camera view'),
            msgCool: c_('Cool!'),
            msgLoseLive: c_('You lost one life'),
            msgLostLives: c_('You lost all your lives!'),
            msgAllQuestions: c_('You answered all the questions.'),
            msgSuccesses: c_('Right! | Excellent! | Great! | Very good! | Perfect!'),
            msgFailures: c_('It was not that! | Incorrect! | Not correct! | Sorry! | Error!'),
            msgYouScore: c_('Your score'),
            msgTryAgain: c_('You need at least &percnt;s&percnt; of correct answers to get the information. Please try again.'),
            msgQuestion: c_('Question'),
            msgAnswer: c_('Check'),
            msgInformation: c_('Information'),
            msgAuthor: c_('Authorship'),
            msgClose: c_('Close'),
            msgOption: c_('Option'),
            msgModelStyle: c_('Molecule style'),
            msgModelStyleLine: c_('Line'),
            msgModelStyleCross: c_('Cross'),
            msgModelStyleStick: c_('Stick'),
            msgModelStyleSphere: c_('Sphere'),
            msgModelStyleCartoon: c_('Cartoon'),
            msgModelStyleSurface: c_('Surface'),
            msgModelSizeDown: c_('Smaller'),
            msgModelSizeUp: c_('Bigger'),
            msgToggleBg: c_('Toggle background'),
            msgDownloadPng: c_('Download image'),
            msgOrders: c_('Please order the answers'),
            msgIndicateWord: c_('Provide a word or phrase'),
            msgMoveOne: c_('Move on'),
            msgPoints: c_('points'),
            msgCorrect: c_('Correct'),
            msgIncorrect: c_('Incorrect'),
            msgPrevious: c_('Previous'),
            msgNext: c_('Next'),
            msgWeight: c_('Weight'),
            msgScoreScorm: c_('The score can not be saved because this page is not part of a SCORM package.'),
            msgOnlySaveScore: c_('You can only save the score once'),
            msgOnlySaveAuto: c_('Your score will be saved after each question. You can only play once.'),
            msgSeveralScore: c_('You can save the score as many times as you want'),
            msgYouLastScore: c_('The last score saved is'),
            msgEndGameScore: c_('Please start the activity before saving your score.'),
            msgSaveAuto: c_('Your score will be automatically saved after each question.'),
            msgActityComply: c_('You have already done this activity.'),
            msgPlaySeveralTimes: c_('You can do this activity as many times as you want'),
            msgUncompletedActivity: c_('Incomplete activity'),
            msgSuccessfulActivity: c_('Activity: Passed. Score: %s'),
            msgUnsuccessfulActivity: c_('Activity: Not passed. Score: %s'),
            msgTypeGame: c_('3D Model Quiz'),
            msgComposition: c_('Chemical composition'),
        };
    },

    setMessagesInfo: function () {
        const msgs = $exeDevice.msgs;
        msgs.msgEOneQuestion = _('Please provide at least one question');
        msgs.msgTypeChoose = _('Please select the correct answer for each option');
        msgs.msgECompleteQuestion = _('Please write the question');
        msgs.msgECompleteAllOptions = _('Please complete all options');
        msgs.msgTimeFormat = _('Please check the time format: hh:mm:ss');
        msgs.msgProvideSolution = _('Please write the word/phrase');
        msgs.msgESelectFile = _('The selected file is not a valid game');
        msgs.msgEProvideTimeSolution = _('Please indicate the time to display the solution');
        msgs.msgEProvideWord = _('Please provide the word or phrase');
        msgs.msgEDefintion = _('Please provide the definition of the word or phrase');
        msgs.msgProvideFB = _('Message to display when passing the game');
        msgs.msgNotHitCuestion = _('The question marked as next in case of success does not exist.');
        msgs.msgNotErrorCuestion = _('The question marked as next in case of error does not exist.');
        msgs.msgNoSuportBrowser = _('Your browser is not compatible with this tool.');
        msgs.msgIDLenght = _('The report identifier must have at least 5 characters');
        msgs.msgESelectModel = _('Please upload a valid 3D model file');
        msgs.msgEModelFormat = _('Unsupported 3D model format. Supported formats: pdb, sdf, mol2, xyz, cif, mmcif, zip, tgz, gz');
        msgs.msgEModelRender = _('Could not render the selected 3D model');
        msgs.msgModelLarge = _('Large model file. This may affect performance.');
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    addQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.clearQuestion();
            $exeDevice.selectsGame.push($exeDevice.getCuestionDefault());
            $exeDevice.active = $exeDevice.selectsGame.length - 1;
            $exeDevice.typeEdit = -1;
            $('#dmolePaste').hide();
            $('#dmoleNumQuestions').text($exeDevice.selectsGame.length);
            $('#dmoleNumberQuestion').val($exeDevice.selectsGame.length);
            $exeDevice.updateSelectOrder();
        }
    },

    removeQuestion: function () {
        if ($exeDevice.selectsGame.length < 2) {
            $exeDevice.showMessage($exeDevice.msgs.msgEOneQuestion);
            return;
        } else {
            $exeDevice.selectsGame.splice($exeDevice.active, 1);
            if ($exeDevice.active >= $exeDevice.selectsGame.length - 1) {
                $exeDevice.active = $exeDevice.selectsGame.length - 1;
            }
            $exeDevice.showQuestion($exeDevice.active);
            $exeDevice.typeEdit = -1;
            $('#dmolePaste').hide();
            $('#dmoleNumQuestions').text($exeDevice.selectsGame.length);
            $('#dmoleNumberQuestion').val($exeDevice.active + 1);
            $exeDevice.updateSelectOrder();
        }
    },

    copyQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.typeEdit = 0;
            $exeDevice.clipBoard = JSON.parse(
                JSON.stringify($exeDevice.selectsGame[$exeDevice.active])
            );
            $('#dmolePaste').show();
        }
    },

    cutQuestion: function () {
        if ($exeDevice.validateQuestion()) {
            $exeDevice.numberCutCuestion = $exeDevice.active;
            $exeDevice.typeEdit = 1;
            $('#dmolePaste').show();
        }
    },

    pasteQuestion: function () {
        if ($exeDevice.typeEdit == 0) {
            $exeDevice.active++;
            $exeDevice.selectsGame.splice(
                $exeDevice.active,
                0,
                $exeDevice.clipBoard
            );
            $exeDevice.showQuestion($exeDevice.active);
        } else if ($exeDevice.typeEdit == 1) {
            $('#dmolePaste').hide();
            $exeDevice.typeEdit = -1;
            $exeDevices.iDevice.gamification.helpers.arrayMove(
                $exeDevice.selectsGame,
                $exeDevice.numberCutCuestion,
                $exeDevice.active
            );
            $exeDevice.showQuestion($exeDevice.active);
            $('#dmoleNumQuestions').text($exeDevice.selectsGame.length);
        }
        $exeDevice.updateSelectOrder();
    },

    nextQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.selectsGame.length - 1
        ) {
            $exeDevice.active++;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    lastQuestion: function () {
        if (
            $exeDevice.validateQuestion() &&
            $exeDevice.active < $exeDevice.selectsGame.length - 1
        ) {
            $exeDevice.active = $exeDevice.selectsGame.length - 1;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    previousQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.active > 0) {
            $exeDevice.active--;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    firstQuestion: function () {
        if ($exeDevice.validateQuestion() && $exeDevice.active > 0) {
            $exeDevice.active = 0;
            $exeDevice.showQuestion($exeDevice.active);
        }
    },

    updateSelectOrder: function () {
        const activeGame = $exeDevice.selectsGame[$exeDevice.active];

        function updateSelectOptions(selectId, valueToSet) {
            const $select = $(selectId);
            $select
                .empty()
                .append(
                    $('<option>', { value: -2, text: _('End') }),
                    $('<option>', { value: -1, text: _('Next') })
                );

            $.each($exeDevice.selectsGame, function (index) {
                $select.append(
                    $('<option>', {
                        value: index,
                        text: (index + 1).toString(),
                    })
                );
            });

            $select.val(valueToSet);
        }
        $exeDevice.updateQuestionsNumber();
    },

    updateQuestionsNumber: function () {
        let percentaje = parseInt(
            $exeDevice.removeTags(
                $('#dmolePercentajeQuestionsValue').val()
            ),
            10
        );
        if (isNaN(percentaje)) return;

        percentaje = Math.max(1, Math.min(percentaje, 100));
        const totalQuestions = $exeDevice.selectsGame.length,
            num = Math.max(1, Math.round((percentaje * totalQuestions) / 100));
        $('#dmoleNumeroPercentaje').text(num + '/' + totalQuestions);
    },

    showQuestion: function (i) {
        $exeDevice.clearQuestion();
        const totalQuestions = $exeDevice.selectsGame.length,
            num = Math.max(0, Math.min(i, totalQuestions - 1));
        let p = $exeDevice.selectsGame[num];
        const activityMode =
            $('input[name="slcactivitymode"]:checked').val() || 'test';

        $('#dmoleNumQuestions').text(totalQuestions);
        $('#dmoleNumberQuestion').val(num + 1);

        // Load model data and render preview
        $('#dmoleModelData').val(p.modelData || '');
        $('#dmoleModelFormat').val(p.modelFormat || '');
        $('#dmoleModelFileName').text(p.modelName || '');
        $('#dmoleModelFile').val(p.modelPath || '');
        $('#dmoleModelFile').removeData('blobUrl');
        $exeDevice.renderModelPreview();

        // Sync viewer toolbar to current question's settings
        const qStyle = $exeDevice.normalizeModelStyle(p.modelStyle);
        $('#dmoleModelStyle').val(qStyle);
        $exeDevice.updateBgButtonState(p);
        $exeDevice.updatePinButtonState(p);
        $exeDevice.updateAtomLegendButtonState(p);

        if (p.typeSelect !== 2) {
            let numOptions = 0;
            $('.DMOLE-EAnwersOptions').each(function (j) {
                numOptions++;
                if (p.options[j].trim() !== '') {
                    p.numOptions = numOptions;
                }
                $(this).val(p.options[j]);
            });
        } else {
            $('#dmoleSolutionWord').val(p.solutionQuestion);
            $('#dmolePercentageShow').val(p.percentageShow);
            $('#dmoleDefinitionWord').val(p.quextion);
        }

        $exeDevice.showTypeQuestion(p.typeSelect);
        $exeDevice.showOptions(p.numberOptions);
        $('#dmoleQuestion').val(p.quextion);
        $('#dmoleDescription').val(p.description || '');

        $('.DMOLE-EAnwersOptions').each(function (j) {
            $(this).val(p.options[j] || '');
        });

        $exeDevicesEdition.iDevice.gamification.helpers.stopSound();

        $(
            "input.DMOLE-Number[name='slcnumber'][value='" +
                p.numberOptions +
                "']"
        ).prop('checked', true);
        $exeDevice.checkQuestions(p.solution);
        $("input.DMOLE-Times[name='slctime'][value='" + p.time + "']").prop(
            'checked',
            true
        );
        $(
            "input.DMOLE-TypeSelect[name='slctypeselect'][value='" +
                p.typeSelect +
                "']"
        ).prop('checked', true);

        if (activityMode === 'show') {
            $('#dmoleQuestionDiv')
                .removeClass('d-flex')
                .addClass('d-none');
            $('#dmoleDescriptionDiv')
                .removeClass('d-none')
                .addClass('d-flex');
        }
    },

    checkQuestions: function (solution) {
        $("input.DMOLE-ESolution[name='slcsolution']").prop('checked', false);
        for (let i = 0; i < solution.length; i++) {
            let sol = solution[i];
            $(
                "input.DMOLE-ESolution[name='slcsolution'][value='" + sol + "']"
            ).prop('checked', true);
        }
        $('#dmoleSolutionSelect').text(solution);
    },

    /**
     * Build the URL to load 3Dmol.js from the export folder.
     */
    get3DmolScriptPath: function () {
        let base = ($exeDevice.idevicePath || '').replace(/\\/g, '/');
        if (/\/edition\/?$/.test(base)) {
            base = base.replace(/\/edition\/?$/, '/export/');
        }
        if (!base.endsWith('/')) {
            base += '/';
        }
        return base + '3Dmol-min.js';
    },

    ensure3Dmol: function (callback) {
        if (typeof $3Dmol !== 'undefined' && $3Dmol.createViewer) {
            callback(true);
            return;
        }

        $exeDevice.modelLibraryCallbacks.push(callback);
        if ($exeDevice.modelLibraryLoading) return;

        $exeDevice.modelLibraryLoading = true;
        const script = document.createElement('script');
        script.src = $exeDevice.get3DmolScriptPath();
        script.onload = function () {
            $exeDevice.modelLibraryLoading = false;
            const callbacks = $exeDevice.modelLibraryCallbacks.slice();
            $exeDevice.modelLibraryCallbacks = [];
            callbacks.forEach(function (cb) {
                cb(true);
            });
        };
        script.onerror = function () {
            $exeDevice.modelLibraryLoading = false;
            const callbacks = $exeDevice.modelLibraryCallbacks.slice();
            $exeDevice.modelLibraryCallbacks = [];
            callbacks.forEach(function (cb) {
                cb(false);
            });
        };
        document.head.appendChild(script);
    },

    getModelFormatByName: function (fileName) {
        const name = (fileName || '').toLowerCase().trim();
        if (!name || name.indexOf('.') === -1) return '';
        const parts = name.split('.');
        const ext = parts[parts.length - 1];
        const map = $exeDevice.getSupportedModelFormatMap();

        if (map[ext]) return map[ext];

        if (ext === 'gz' && parts.length >= 3) {
            const innerExt = parts[parts.length - 2];
            if (map[innerExt]) return map[innerExt];

            if (innerExt === 'tar' && parts.length >= 4) {
                const tarInnerExt = parts[parts.length - 3];
                if (map[tarInnerExt]) return map[tarInnerExt];
            }
        }

        return '';
    },

    getSupportedModelFormatMap: function () {
        return {
            pdb: 'pdb',
            sdf: 'sdf',
            mol2: 'mol2',
            xyz: 'xyz',
            cif: 'cif',
            mmcif: 'cif',
        };
    },

    hasCompressedModelExtension: function (fileName) {
        const name = (fileName || '').toLowerCase().trim();
        return (
            name.endsWith('.zip') ||
            name.endsWith('.tgz') ||
            name.endsWith('.tar.gz') ||
            name.endsWith('.gz')
        );
    },

    readFileAsText: function (file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function (ev) {
                resolve((ev.target.result || '').toString());
            };
            reader.onerror = function () {
                reject(new Error('Could not read model file as text'));
            };
            reader.readAsText(file);
        });
    },

    readFileAsArrayBuffer: function (file) {
        return new Promise(function (resolve, reject) {
            const reader = new FileReader();
            reader.onload = function (ev) {
                resolve(ev.target.result);
            };
            reader.onerror = function () {
                reject(new Error('Could not read model file as binary'));
            };
            reader.readAsArrayBuffer(file);
        });
    },

    decodeBytesAsText: function (bytes) {
        if (typeof TextDecoder !== 'undefined') {
            try {
                return new TextDecoder('utf-8').decode(bytes);
            } catch (error) {
                console.warn(error);
            }
        }

        let text = '';
        for (let i = 0; i < bytes.length; i++) {
            text += String.fromCharCode(bytes[i]);
        }
        return text;
    },

    detectModelFormatFromContent: function (content) {
        const text = (content || '').trim();
        if (!text) return '';

        const firstLine = text.split(/\r?\n/, 1)[0].trim();
        if (/^@<TRIPOS>MOLECULE/i.test(text)) return 'mol2';
        if (/^data_/im.test(text) || /_atom_site\./i.test(text)) return 'cif';
        if (/^\s*(HEADER|ATOM|HETATM|MODEL|COMPND|TITLE)\b/im.test(text)) {
            return 'pdb';
        }
        if (/^\s*\$?\$\$\$/m.test(text) || /\bV(2000|3000)\b/.test(text)) {
            return 'sdf';
        }
        if (/^\d+$/.test(firstLine)) return 'xyz';

        return '';
    },

    readTarField: function (header, start, length) {
        let value = '';
        for (let i = start; i < start + length; i++) {
            const code = header[i];
            if (!code) break;
            value += String.fromCharCode(code);
        }
        return value.trim();
    },

    extractModelFromTarBytes: function (tarBytes) {
        let offset = 0;

        while (offset + 512 <= tarBytes.length) {
            const header = tarBytes.subarray(offset, offset + 512);
            const isEmptyHeader = header.every(function (value) {
                return value === 0;
            });
            if (isEmptyHeader) break;

            const name = $exeDevice.readTarField(header, 0, 100);
            const prefix = $exeDevice.readTarField(header, 345, 155);
            const sizeRaw = $exeDevice
                .readTarField(header, 124, 12)
                .replace(/\0/g, '')
                .trim();
            const size = parseInt(sizeRaw || '0', 8) || 0;
            const typeFlag = header[156];
            const fullName = prefix ? `${prefix}/${name}` : name;
            const dataStart = offset + 512;
            const dataEnd = dataStart + size;

            if (dataEnd > tarBytes.length) break;

            const baseName = fullName.split('/').pop() || '';
            const isRegularFile = typeFlag === 0 || typeFlag === 48;
            if (isRegularFile && baseName && size > 0) {
                const modelData = $exeDevice.decodeBytesAsText(
                    tarBytes.subarray(dataStart, dataEnd)
                );
                let modelFormat = $exeDevice.getModelFormatByName(baseName);
                if (!modelFormat) {
                    modelFormat =
                        $exeDevice.detectModelFormatFromContent(modelData);
                }

                if (modelFormat) {
                    return {
                        modelData: modelData,
                        modelFormat: modelFormat,
                        modelName: baseName,
                    };
                }
            }

            offset = dataStart + Math.ceil(size / 512) * 512;
        }

        return null;
    },

    extractModelFromZipBytes: function (zipBytes) {
        if (!window.fflate || !window.fflate.unzipSync) return null;

        const files = window.fflate.unzipSync(zipBytes);
        const paths = Object.keys(files);

        for (let i = 0; i < paths.length; i++) {
            const filePath = paths[i];
            const content = files[filePath];
            if (!content || !content.length) continue;

            const baseName = filePath.split('/').pop() || '';
            if (!baseName || baseName.startsWith('.') || baseName.startsWith('__')) {
                continue;
            }

            let bytes = content;
            let modelFormat = $exeDevice.getModelFormatByName(baseName);
            if (
                baseName.toLowerCase().endsWith('.gz') &&
                window.fflate &&
                window.fflate.gunzipSync
            ) {
                try {
                    bytes = window.fflate.gunzipSync(content);
                    modelFormat =
                        $exeDevice.getModelFormatByName(
                            baseName.replace(/\.gz$/i, '')
                        ) || modelFormat;
                } catch (error) {
                    console.warn(error);
                    bytes = content;
                }
            }

            const modelData = $exeDevice.decodeBytesAsText(bytes);
            if (!modelFormat) {
                modelFormat =
                    $exeDevice.detectModelFormatFromContent(modelData);
            }
            if (modelFormat) {
                return {
                    modelData: modelData,
                    modelFormat: modelFormat,
                    modelName: baseName,
                };
            }
        }

        return null;
    },

    getModelFileNameFromPath: function (modelPath) {
        const rawPath = (modelPath || '').trim();
        if (!rawPath) return '';

        const cleanPath = rawPath.split('#')[0].split('?')[0];
        const parts = cleanPath.split('/');
        const fileName = parts[parts.length - 1] || '';
        if (!fileName) return '';

        try {
            return decodeURIComponent(fileName);
        } catch (error) {
            console.warn(error);
            return fileName;
        }
    },

    resolveModelSourceUrl: async function (modelPath, blobUrl) {
        const rawPath = (modelPath || '').trim();
        const rawBlobUrl = (blobUrl || '').trim();
        if (!rawPath) return '';

        if (rawPath.startsWith('asset://')) {
            if (rawBlobUrl) {
                return rawBlobUrl;
            }

            if (
                window.eXeLearningAssetResolver &&
                typeof window.eXeLearningAssetResolver.resolve === 'function'
            ) {
                const resolvedUrl =
                    await window.eXeLearningAssetResolver.resolve(rawPath);
                if (resolvedUrl) {
                    return resolvedUrl;
                }
            }
            throw new Error('Could not resolve model asset URL');
        }

        return rawPath;
    },

    loadModelFromPath: async function (modelPath, blobUrl) {
        const sourceUrl = await $exeDevice.resolveModelSourceUrl(
            modelPath,
            blobUrl
        );
        const fileName =
            $exeDevice.getModelFileNameFromPath(modelPath) ||
            $exeDevice.getModelFileNameFromPath(sourceUrl);
        if (!sourceUrl || !fileName) {
            throw new Error('Could not determine model source');
        }

        const response = await fetch(sourceUrl);
        if (!response.ok) {
            throw new Error(`Could not load model file (${response.status})`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const contentType =
            response.headers.get('content-type') || 'application/octet-stream';
        const modelFile =
            typeof File === 'function'
                ? new File([arrayBuffer], fileName, {
                      type: contentType,
                  })
                : Object.assign(new Blob([arrayBuffer], { type: contentType }), {
                      name: fileName,
                  });

        return $exeDevice.loadModelFromFile(modelFile);
    },

    loadModelFromFile: async function (file) {
        const fileName = (file?.name || '').trim();
        const plainFormat = $exeDevice.getModelFormatByName(fileName);
        const isCompressed = $exeDevice.hasCompressedModelExtension(fileName);

        if (!isCompressed) {
            if (!plainFormat) {
                throw new Error('Unsupported model format');
            }

            const modelData = await $exeDevice.readFileAsText(file);
            return {
                modelData: modelData,
                modelFormat: plainFormat,
                modelName: fileName,
            };
        }

        if (!window.fflate) {
            throw new Error('fflate not available');
        }

        const bytes = new Uint8Array(
            await $exeDevice.readFileAsArrayBuffer(file)
        );
        const lowerName = fileName.toLowerCase();

        if (lowerName.endsWith('.zip')) {
            const extracted = $exeDevice.extractModelFromZipBytes(bytes);
            if (!extracted) {
                throw new Error('No supported model found inside ZIP');
            }
            return extracted;
        }

        if (lowerName.endsWith('.tgz') || lowerName.endsWith('.tar.gz')) {
            if (!window.fflate.gunzipSync) {
                throw new Error('GZIP support not available');
            }

            const tarBytes = window.fflate.gunzipSync(bytes);
            const extracted = $exeDevice.extractModelFromTarBytes(tarBytes);
            if (!extracted) {
                throw new Error('No supported model found inside TGZ');
            }
            return extracted;
        }

        if (lowerName.endsWith('.gz')) {
            if (!window.fflate.gunzipSync) {
                throw new Error('GZIP support not available');
            }

            const rawBytes = window.fflate.gunzipSync(bytes);
            const modelData = $exeDevice.decodeBytesAsText(rawBytes);
            let modelFormat = $exeDevice.getModelFormatByName(
                fileName.replace(/\.gz$/i, '')
            );
            if (!modelFormat) {
                modelFormat =
                    $exeDevice.detectModelFormatFromContent(modelData);
            }
            if (!modelFormat) {
                throw new Error('Could not detect model format from GZ');
            }

            return {
                modelData: modelData,
                modelFormat: modelFormat,
                modelName: fileName.replace(/\.gz$/i, ''),
            };
        }

        throw new Error('Unsupported compressed model format');
    },

    isWebGLAvailable: function () {
        try {
            var canvas = document.createElement('canvas');
            return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
        } catch (e) {
            return false;
        }
    },

    updateModelA11y: function (modelName) {
        const desc = modelName
            ? _('3D model') + ': ' + modelName
            : _('No 3D model');
        $('#dmoleModelPreview').attr('aria-label', desc);
        $('#dmoleModelDesc').text(desc);
    },

    /**
     * Update the camera (◎) button appearance based on the question's camera state.
     * Two states:
     * - Green (default): camera active in export, toolbar visible
     * - Gray: camera disabled in export, toolbar hidden
     */
    updatePinButtonState: function (question) {
        const $btn = $('#dmoleModelSaveView');
        if (!question || !question.disableCamera) {
            $btn.css({ 'border-color': '#4a9e4a', 'background-color': '#e6f4e6', 'border-style': 'solid' });
            $btn.attr('title', _('Camera enabled') + ' — ' + _('Click to disable'));
        } else {
            $btn.css({ 'border-color': '#999', 'background-color': '#e0e0e0', 'border-style': 'dashed' });
            $btn.attr('title', _('Camera disabled') + ' — ' + _('Click to enable'));
        }
    },

    /**
     * Update the background toggle (☀/🌑) button appearance based on the question's bgDark state.
     * Two states:
     * - Light (default): white background, sun icon
     * - Dark: dark background, moon icon
     */
    updateBgButtonState: function (question) {
        const $btn = $('#dmoleModelToggleBg');
        const isDark = question && !!question.bgDark;
        $btn.attr('aria-pressed', isDark ? 'true' : 'false');
        $btn.text(isDark ? '🌑' : '☀');
        if (isDark) {
            $btn.css({ 'border-color': '#555', 'background-color': '#333', 'border-style': 'solid' });
            $btn.attr('title', _('Dark background') + ' — ' + _('Click to switch to light'));
        } else {
            $btn.css({ 'border-color': '#e6a817', 'background-color': '#fff8e1', 'border-style': 'solid' });
            $btn.attr('title', _('Light background') + ' — ' + _('Click to switch to dark'));
        }
    },

    /**
     * Update the atom legend (⚛) button appearance based on the question's showAtomLegend state.
     * Two states:
     * - Active: legend shown in export
     * - Inactive: legend hidden in export
     */
    updateAtomLegendButtonState: function (question) {
        const $btn = $('#dmoleShowAtomLegend');
        const isOn = question && !!question.showAtomLegend;
        $btn.attr('aria-pressed', isOn ? 'true' : 'false');
        if (isOn) {
            $btn.css({ 'border-color': '#4a9e4a', 'background-color': '#e6f4e6', 'border-style': 'solid' });
            $btn.attr('title', _('Atom legend visible') + ' — ' + _('Click to hide'));
        } else {
            $btn.css({ 'border-color': '#999', 'background-color': '#e0e0e0', 'border-style': 'dashed' });
            $btn.attr('title', _('Atom legend hidden') + ' — ' + _('Click to show'));
        }
    },

    normalizeModelStyle: function (style) {
        const allowed = ['line', 'cross', 'stick', 'sphere', 'cartoon', 'surface'];
        const normalized = (style || '').toString().trim().toLowerCase();
        return allowed.includes(normalized) ? normalized : 'stick';
    },

    getModelStyleChoices: function (msgs) {
        return [
            { value: 'line', label: msgs.msgModelStyleLine || 'Line' },
            { value: 'cross', label: msgs.msgModelStyleCross || 'Cross' },
            { value: 'stick', label: msgs.msgModelStyleStick || 'Stick' },
            { value: 'sphere', label: msgs.msgModelStyleSphere || 'Sphere' },
            { value: 'cartoon', label: msgs.msgModelStyleCartoon || 'Cartoon' },
            { value: 'surface', label: msgs.msgModelStyleSurface || 'Surface' },
        ];
    },

    createModelStyleOptions: function (msgs, selectedStyle) {
        const style = $exeDevice.normalizeModelStyle(selectedStyle);
        return $exeDevice
            .getModelStyleChoices(msgs)
            .map(function (item) {
                const selected = item.value === style ? ' selected' : '';
                return `<option value="${item.value}"${selected}>${item.label}</option>`;
            })
            .join('');
    },

    applyModelStyle: function (viewer, styleName) {
        const style = $exeDevice.normalizeModelStyle(styleName);
        if (viewer.removeAllSurfaces) {
            viewer.removeAllSurfaces();
        }
        if (style === 'surface') {
            viewer.setStyle({}, { stick: { radius: 0.12, opacity: 0.35 } });
            if (typeof $3Dmol !== 'undefined' && $3Dmol.SurfaceType && viewer.addSurface) {
                viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.85, color: 'white' });
            }
            return;
        }
        const styleMap = {
            line: { line: {} },
            cross: { cross: {} },
            stick: { stick: {} },
            sphere: { sphere: { scale: 0.3 } },
            cartoon: { cartoon: {} },
        };
        viewer.setStyle({}, styleMap[style] || styleMap.stick);
    },

    renderModelPreview: function () {
        const modelData = $('#dmoleModelData').val().trim();
        let modelFormat = $('#dmoleModelFormat').val().trim().toLowerCase();
        const modelName = $('#dmoleModelFileName').text().trim();
        const preview = document.getElementById('dmoleModelPreview');
        const $noModel = $('#dmoleNoModel');

        if (!modelFormat && modelName) {
            modelFormat = $exeDevice.getModelFormatByName(modelName);
            $('#dmoleModelFormat').val(modelFormat);
        }

        if (!modelData || !modelFormat) {
            if ($exeDevice.modelViewer) {
                $exeDevice.modelViewer.clear();
                $exeDevice.modelViewer.render();
            }
            $exeDevice.updateModelA11y('');
            $noModel.show();
            return;
        }

        if (!$exeDevice.isWebGLAvailable()) {
            $exeDevice.updateModelA11y(modelName);
            $noModel.show();
            return;
        }

        $exeDevice.ensure3Dmol(function (ok) {
            if (!ok || typeof $3Dmol === 'undefined') {
                $exeDevice.updateModelA11y(modelName);
                $noModel.show();
                return;
            }

            try {
                const activeQ = $exeDevice.selectsGame[$exeDevice.active] || {};
                const qStyle = $exeDevice.normalizeModelStyle(activeQ.modelStyle);
                const qBgDark = !!activeQ.bgDark;
                const qCameraView = activeQ.cameraView || null;
                const bgColor = qBgDark ? 'black' : 'white';

                if (!$exeDevice.modelViewer) {
                    $exeDevice.modelViewer = $3Dmol.createViewer(preview, {
                        backgroundColor: bgColor,
                    });
                } else if ($exeDevice.modelViewer.setBackgroundColor) {
                    $exeDevice.modelViewer.setBackgroundColor(bgColor);
                }

                $exeDevice.modelViewer.clear();
                $exeDevice.modelViewer.addModel(modelData, modelFormat, {
                    keepH: true,
                });
                $exeDevice.applyModelStyle($exeDevice.modelViewer, qStyle);
                $exeDevice.modelViewer.zoomTo();
                if (qCameraView) {
                    $exeDevice.modelViewer.setView(qCameraView);
                }
                $exeDevice.modelViewer.render();
                if ($exeDevice.modelViewer.resize) {
                    $exeDevice.modelViewer.resize();
                }
                $exeDevice.updateModelA11y(modelName);
                $noModel.hide();
            } catch (error) {
                console.error(error);
                $exeDevice.updateModelA11y(modelName);
                $noModel.show();
                $exeDevice.showMessage($exeDevice.msgs.msgEModelRender);
            }
        });
    },

    clearQuestion: function () {
        $exeDevice.showOptions(4);
        $exeDevice.showSolution('');
        $('.DMOLE-Times')[0].checked = true;
        $('.DMOLE-Number')[2].checked = true;
        $('#dmoleModelFile').val('').removeData('blobUrl');
        $('#dmoleModelData').val('');
        $('#dmoleModelFormat').val('');
        $('#dmoleModelFileName').text('');
        $('#dmoleModelSizeWarning').addClass('d-none');
        if ($exeDevice.modelViewer) {
            $exeDevice.modelViewer.clear();
            $exeDevice.modelViewer.render();
        }
        $('#dmoleNoModel').show();
        $("input.DMOLE-ESolution[name='slcsolution']").prop('checked', false);
        $('#dmoleSolutionSelect').text('');
        $('#dmoleQuestion').val('');
        $('#dmoleDescription').val('');
        $('#dmoleSolutionWord').val('');
        $('#dmoleDefinitionWord').val('');
        $('.DMOLE-EAnwersOptions').each(function () {
            $(this).val('');
        });
        $('#dmoleMessageOK').val('');
        $('#dmoleMessageKO').val('');
    },

    showOptions: function (number) {
        $('.DMOLE-EOptionDiv').each(function (i) {
            $(this).show();
            if (i >= number) {
                $(this).hide();
                $exeDevice.showSolution('');
            }
        });

        $('.DMOLE-EAnwersOptions').each(function (j) {
            if (j >= number) {
                $(this).val('');
            }
        });
    },

    showSolution: function (solution) {
        $("input.DMOLE-ESolution[name='slcsolution']").prop('checked', false);

        for (let i = 0; i < solution.length; i++) {
            const sol = solution[i];
            $('.DMOLE-ESolution')[solution].checked = true;
            $(
                "input.DMOLE-ESolution[name='slcsolution'][value='" + sol + "']"
            ).prop('checked', true);
        }
    },

    createForm: function () {
        const path = $exeDevice.idevicePath,
            html = `
            <div id="dMoleIdeviceForm">
                <p class="exe-block-info exe-block-dismissible" style="position:relative">
                    ${_('Create quiz activities based on interactive 3D models.')}
                    <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
                </p>
                <div class="exe-form-tab" title="${_('General settings')}">
                    ${$exeDevicesEdition.iDevice.gamification.instructions.getFieldset(c_('Observe the 3D model and answer the questions.') + ' ' + c_('You can rotate the 3D model by clicking on it and dragging.'))}
                    <fieldset class="exe-fieldset exe-fieldset-closed">
                        <legend><a href="#">${_('Options')}</a></legend>
                        <div id="dmoleOptions">
                            <div class="d-flex align-items-center gap-3 mb-3" id="dmoleActivityMode">
                                <span>${_('Mode')}:</span>
                                <div class="form-check form-check-inline m-0">
                                    <input class="form-check-input" type="radio" name="slcactivitymode" id="dmoleModeTest" value="test" checked />
                                    <label class="form-check-label" for="dmoleModeTest">${_('Test')}</label>
                                </div>
                                <div class="form-check form-check-inline m-0">
                                    <input class="form-check-input" type="radio" name="slcactivitymode" id="dmoleModeShow" value="show" />
                                    <label class="form-check-label" for="dmoleModeShow">${_('Presentation')}</label>
                                </div>
                            </div>
                            <div class="toggle-item mb-3" data-target="dmoleShowMinimize">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="dmoleShowMinimize" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="dmoleShowMinimize">${_('Show minimized.')} </label>
                            </div>  
   
                            <div class="toggle-item mb-3" data-target="dmoleAnswersRamdon" id="dmoleAnswersRamdonDiv">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="dmoleAnswersRamdon" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="dmoleAnswersRamdon">${_('Random options')}</label>
                            </div>
                            <div class="toggle-item mb-3" id="dmoleQuestionsRandomDiv">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="dmoleQuestionsRandom" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="dmoleQuestionsRandom">${_('Random questions')}</label>
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3" id="dmoleShowSolutionDiv">
                                <div class="toggle-item toggle-related" data-target="dmoleShowSolution">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="dmoleShowSolution" checked />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="dmoleShowSolution">${_('Show solutions')}.</label>
                                </div>
                                <div class="mb-0 d-flex align-items-center gap-2">
                                    <input type="number" name="dmoleTimeShowSolution" id="dmoleTimeShowSolution" value="3" min="1" max="9" class="form-control" />
                                    <label for="dmoleTimeShowSolution">${_('Show solution time (seconds)')}</label>
                                </div>
                            </div>                            
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item toggle-related" data-target="dmoleHasFeedBack">
                                    <span class="toggle-control">
                                        <input type="checkbox" class="toggle-input" id="dmoleHasFeedBack" />
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="dmoleHasFeedBack">${_('Feedback')}.</label>
                                </div>
                                <div class="mb-0 d-flex align-items-center gap-2">
                                    <input type="number" name="dmolePercentajeFB" id="dmolePercentajeFB" value="100" min="5" max="100" step="5" disabled class="form-control" />
                                    <label for="dmolePercentajeFB">${_('&percnt; right to see the feedback')}</label>
                                </div>
                            </div>
                            <div id="dmoleFeedbackP" class="DMOLE-EFeedbackP mb-3">
                                <textarea id="dmoleFeedBackEditor" class="exe-html-editor form-control" rows="4"></textarea>
                            </div>
                            <div class="d-flex align-items-center flex-wrap mb-3 gap-2" id="dmoleInputPercentajeQuestions">
                                <label for="dmolePercentajeQuestionsValue">%${_('Questions')}:</label>
                                <input type="number" name="dmolePercentajeQuestionsValue" id="dmolePercentajeQuestionsValue" value="100" min="1" max="100" class="form-control" />
                                <span id="dmoleNumeroPercentaje" class="ms-2">1/1</span>
                            </div>
                            <div class="toggle-item mb-3" data-target="dmoleModeBoard" id="dmoleModeBoardDiv">
                                <span class="toggle-control">
                                    <input type="checkbox" class="toggle-input" id="dmoleModeBoard" />
                                    <span class="toggle-visual"></span>
                                </span>
                                <label class="toggle-label" for="dmoleModeBoard">${_('Digital whiteboard mode')}</label>
                            </div>
                            <div class="d-flex align-items-center gap-2 mb-3" id="dmoleGlobalTimeDiv">
                                <label for="dmoleGlobalTimes">${_('Time per question')}:</label>
                                <select id="dmoleGlobalTimes" class="form-select form-select-sm" style="max-width:10ch">
                                    <option value="0" selected>15s</option>
                                    <option value="1">30s</option>
                                    <option value="2">1m</option>
                                    <option value="3">3m</option>
                                    <option value="4">5m</option>
                                    <option value="5">10m</option>
                                </select>
                                <button id="dmoleGlobalTimeButton" class="btn btn-primary" type="button">${_('Accept')}</button>
                            </div>
                            <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                                <div class="toggle-item" data-target="dmoleEvaluation">
                                    <span class="toggle-control">
                                        <input type="checkbox" id="dmoleEvaluation" class="toggle-input" aria-label="${_('Progress report')}">
                                        <span class="toggle-visual"></span>
                                    </span>
                                    <label class="toggle-label" for="dmoleEvaluation">${_('Progress report')}.</label>
                                </div>
                                <div class="d-flex align-items-center flex-nowrap gap-2 ms-2 DMOLE-EEvaluationFields">
                                    <label for="dmoleEvaluationID" class="mb-0">${_('Identifier')}:</label>
                                    <input type="text" class="form-control" id="dmoleEvaluationID" disabled value="${eXeLearning.app.project.odeId || ''}" />
                                    <a href="#dmoleEvaluationHelp" id="dmoleEvaluationHelpLnk" class="GameModeHelpLink" title="${_('Help')}">
                                        <img src="${path}quextIEHelp.png" width="18" height="18" alt="${_('Help')}" />
                                    </a>
                                </div>
                            </div>
                            <p id="dmoleEvaluationHelp" class="exe-block-info DMOLE-TypeGameHelp">
                                ${_('You must indicate the ID. It can be a word, a phrase or a number of more than four characters. You will use this ID to mark the activities covered by this progress report. It must be the same in all iDevices of a report and different in each report.')}
                            </p>
                        </div>
                    </fieldset>
                    <fieldset class="exe-fieldset">
                        <legend><a href="#">${_('Questions')}</a></legend>
                        <div class="DMOLE-EPanel" id="dmolePanel">
                            <div class="DMOLE-EOptionsMedia d-flex flex-nowrap align-items-center gap-2 mb-3">
                                <div class="DMOLE-EOptionsGame">
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="dmoleTypeDiv">
                                        <span>${_('Type')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="DMOLE-TypeSelect form-check-input" checked id="dmoleTypeChoose" type="radio" name="slctypeselect" value="0"/>
                                                <label class="form-check-label" for="dmoleTypeChoose">${_('Select')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="DMOLE-TypeSelect form-check-input" id="dmoleTypeOrders" type="radio" name="slctypeselect" value="1"/>
                                                <label class="form-check-label" for="dmoleTypeOrders">${_('Order')}</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="DMOLE-TypeSelect form-check-input" id="dmoleTypeWord" type="radio" name="slctypeselect" value="2"/>
                                                <label class="form-check-label" for="dmoleTypeWord">${_('Word')}</label>
                                            </div>
                                        </span>
                                    </div>
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="dmoleInputNumbers">
                                        <span>${_('Options Number')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="DMOLE-Number form-check-input" id="numQ2" type="radio" name="slcnumber" value="2" />
                                                <label class="form-check-label" for="numQ2">2</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="DMOLE-Number form-check-input" id="numQ3" type="radio" name="slcnumber" value="3" />
                                                <label class="form-check-label" for="numQ3">3</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="DMOLE-Number form-check-input" id="numQ4" type="radio" name="slcnumber" value="4" checked="checked" />
                                                <label class="form-check-label" for="numQ4">4</label>
                                            </div>
                                         </span>
                                    </div>
                                    <div id="dmolePercentageSpan" class="d-none flex-wrap align-items-center gap-2 mb-3">
                                        <span >${_('Percentage of letters to show (%)')}:</span>
                                        <span class="DMOLE-EPercentage" id="dmolePercentage">
                                            <input type="number" class="form-control form-control-sm"  name="dmolePercentageShow" id="dmolePercentageShow" value="35" min="0" max="100" step="5" />
                                        </span>
                                    </div>
                                    <div class="d-flex flex-wrap align-items-center gap-2 mb-3" id="dmoleTimeDiv">
                                        <span>${_('Time per question')}:</span>
                                        <span class="d-flex align-items-center gap-2 flex-nowrap">
                                            <div class="form-check form-check-inline m-0">
                                                <input class="DMOLE-Times form-check-input" checked="checked" id="q15s" type="radio" name="slctime" value="0" />
                                                <label class="form-check-label" for="q15s">15s</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="DMOLE-Times form-check-input" id="q30s" type="radio" name="slctime" value="1" />
                                                <label class="form-check-label" for="q30s">30s</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="DMOLE-Times form-check-input" id="q1m" type="radio" name="slctime" value="2" />
                                                <label class="form-check-label" for="q1m">1m</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="DMOLE-Times form-check-input" id="q3m" type="radio" name="slctime" value="3" />
                                                <label class="form-check-label" for="q3m">3m</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="DMOLE-Times form-check-input" id="q5m" type="radio" name="slctime" value="4" />
                                                <label class="form-check-label" for="q5m">5m</label>
                                            </div>
                                            <div class="form-check form-check-inline m-0">
                                                <input class="DMOLE-Times form-check-input" id="q10m" type="radio" name="slctime" value="5" />
                                                <label class="form-check-label" for="q10m">10m</label>
                                            </div>
                                        </span>
                                    </div>
                                    <div id="dmoleScoreQuestionDiv" class="DMOLE-ScoreQuestionDiv align-items-center gap-2 mb-3 d-none">
                                        <label for="dmoleScoreQuestion">${_('Score')}:</label>
                                        <input type="number" name="dmoleScoreQuestion" id="dmoleScoreQuestion" value="1" min="0" max="100" step="0.05" class="form-control"/>
                                    </div>                                    
                                </div>
                                <div class="DMOLE-EMultiMediaOption ">
                                    <div class="DMOLE-EMultimedia" id="dmoleMultimedia">
                                        <div id="dmoleModelPreview" class="DMOLE-EModelPreview" tabindex="0" role="img" aria-label="${_('3D model preview')}"></div>
                                        <span id="dmoleModelDesc" class="sr-av"></span>
                                        <img class="DMOLE-EMedia" src="${path}quextI3DBack.png" id="dmoleNoModel" alt="${_('No 3D model')}" />
                                    </div>
                                    <div class="DMOLE-ModelStyleControl" id="dmoleModelStyleControl">
                                        <label for="dmoleModelStyle" class="DMOLE-ModelStyleLabel">${_('Molecule style')}:</label>
                                        <div class="DMOLE-ModelStyleInputGroup">
                                            <select id="dmoleModelStyle" class="DMOLE-ModelStyleSelect form-select form-select-sm">
                                                ${$exeDevice.createModelStyleOptions($exeDevice.msgs, $exeDevice.modelStyle)}
                                            </select>
                                            <button type="button" id="dmoleModelSizeDown" class="DMOLE-ModelSizeBtn" title="${_('Smaller')}">-</button>
                                            <button type="button" id="dmoleModelSizeUp" class="DMOLE-ModelSizeBtn" title="${_('Bigger')}">+</button>
                                            <button type="button" id="dmoleModelResetCamera" class="d-none DMOLE-ModelSizeBtn" title="${_('Reset camera view')}">↺</button>
                                            <button type="button" id="dmoleModelSaveView" class="DMOLE-ModelSizeBtn" title="${_('Save initial view')}">◎</button>
                                            <button type="button" id="dmoleModelToggleBg" class="DMOLE-ModelSizeBtn DMOLE-ToggleBgBtn" title="${_('Light background')} — ${_('Click to switch to dark')}" aria-pressed="false">☀</button>
                                            <button type="button" id="dmoleShowAtomLegend" class="DMOLE-ModelSizeBtn DMOLE-ToggleBgBtn" title="${_('Atom legend hidden')} — ${_('Click to show')}" aria-pressed="false">⚛</button>
                                            <button type="button" id="dmoleModelDownloadPng" class="DMOLE-ModelSizeBtn" title="${_('Download image')}">⬇</button>
                                        </div>
                                    </div>
                                    <div id="dmoleModelFileGroup">
                                        <span id="dmoleTitleModel">${_('3D model file')}:</span>
                                        <div class="DMOLE-EModelInput d-flex flex-nowrap align-items-start gap-2 mb-3">
                                            <input type="text" id="dmoleModelFile" class="DMOLE-EModelFileInput file-picker exe-file-picker form-control me-0" />
                                            <a href="#" id="dmolePreviewModel" class="DMOLE-ENavigationButton" title="${_('Preview model')}">
                                                <img src="${path}quextIEPlay.png" alt="${_('Preview')}" class="DMOLE-ENavigationButton" />
                                            </a>
                                            <button type="button" id="dmoleResetCamera" class="DMOLE-EResetCamera btn btn-outline-secondary btn-sm" title="${_('Reset camera view')}">↺<span class="sr-av"> ${_('Reset camera view')}</span></button>
                                        </div>
                                        <div id="dmoleModelFileName" class="small text-muted mb-2"></div>
                                        <p id="dmoleModelSizeWarning" class="d-none small text-warning mb-1"></p>
                                        <textarea id="dmoleModelData" class="d-none"></textarea>
                                        <input type="hidden" id="dmoleModelFormat" value="" />
                                    </div>
                                </div>                               
                            </div>
                            <div class="DMOLE-EContents" id="dmoleContents">
                                <div id="dmoleSolitionOptions" class="DMOLE-SolitionOptionsDiv"><span>${_('Question')}:</span><span><span>${_('Solution')}: </span><span id="dmoleSolutionSelect">A</span></span></div>
                                <div class="DMOLE-EQuestionDiv" id="dmoleQuestionDiv">
                                    <label class="sr-av" for="dmoleQuestion">${_('Question')}:</label>
                                    <input type="text" class="DMOLE-EQuestion form-control" id="dmoleQuestion" value="${c_('What is the central atom in the model?')}">
                                </div>
                                <div class="DMOLE-EQuestionDiv d-none" id="dmoleDescriptionDiv">
                                    <label for="dmoleDescription">${_('Description')}:</label>
                                    <input type="text" class="DMOLE-EQuestion form-control" id="dmoleDescription" value="">
                                </div>
                                <div class="DMOLE-EAnswers" id="dmoleAnswers">
                                    <div class="DMOLE-EOptionDiv gap-2">
                                        <label class="sr-av" for="dmoleSolution0">${_('Solution')} A:</label>
                                        <input type="checkbox" class="DMOLE-ESolution form-check-input me-0" name="slcsolution" id="dmoleSolution0" value="A" checked />
                                        <label for="dmoleOption0">A</label>
                                        <input type="text" class="DMOLE-EOption0 DMOLE-EAnwersOptions form-control" id="dmoleOption0" value="${c_('Carbon')}">
                                    </div>
                                    <div class="DMOLE-EOptionDiv gap-2">
                                        <label class="sr-av" for="dmoleSolution1">${_('Solution')} B:</label>
                                        <input type="checkbox" class="DMOLE-ESolution form-check-input me-0" name="slcsolution" id="dmoleSolution1" value="B" />
                                        <label for="dmoleOption1">B</label>
                                        <input type="text" class="DMOLE-EOption1 DMOLE-EAnwersOptions form-control" id="dmoleOption1" value="${c_('Oxygen')}">
                                    </div>
                                    <div class="DMOLE-EOptionDiv gap-2">
                                        <label class="sr-av" for="dmoleSolution2">${_('Solution')} C:</label>
                                        <input type="checkbox" class="DMOLE-ESolution form-check-input me-0" name="slcsolution" id="dmoleSolution2" value="C" />
                                        <label for="dmoleOption2">C</label>
                                        <input type="text" class="DMOLE-EOption2 DMOLE-EAnwersOptions form-control" id="dmoleOption2" value="${c_('Hydrogen')}">
                                    </div>
                                    <div class="DMOLE-EOptionDiv gap-2">
                                        <label class="sr-av" for="dmoleSolution3">${_('Solution')} D:</label>
                                        <input type="checkbox" class="DMOLE-ESolution form-check-input me-0" name="slcsolution" id="dmoleSolution3" value="D" />
                                        <label for="dmoleOption3">D</label>
                                        <input type="text" class="DMOLE-EOption3 DMOLE-EAnwersOptions form-control" id="dmoleOption3" value="${c_('Nitrogen')}">
                                    </div>
                                </div>
                                <div class="DMOLE-EWordDiv DMOLE-DP" id="dmoleWordDiv">
                                    <div class="DMOLE-ESolutionWord"><label for="dmoleSolutionWord">${_('Word/Phrase')}:</label><input type="text" id="dmoleSolutionWord" class="form-control"/></div>
                                    <div class="DMOLE-ESolutionWord"><label for="dmoleDefinitionWord">${_('Definition')}:</label><input type="text" id="dmoleDefinitionWord" class="form-control"/></div>
                                </div>
                            </div>                           
                            <div class="DMOLE-ENavigationButtons gap-2">
                                <a href="#" id="dmoleAdd" class="DMOLE-ENavigationButton" title="${_('Add question')}"><img src="${path}quextIEAdd.png" alt="${_('Add question')}" class="DMOLE-ENavigationButton" /></a>
                                <a href="#" id="dmoleFirst" class="DMOLE-ENavigationButton" title="${_('First question')}"><img src="${path}quextIEFirst.png" alt="${_('First question')}" class="DMOLE-ENavigationButton" /></a>
                                <a href="#" id="dmolePrevious" class="DMOLE-ENavigationButton" title="${_('Previous question')}"><img src="${path}quextIEPrev.png" alt="${_('Previous question')}" class="DMOLE-ENavigationButton" /></a>
                                <label class="sr-av" for="dmoleNumberQuestion">${_('Question number:')}</label><input type="text" class="DMOLE-NumberQuestion form-control" id="dmoleNumberQuestion" value="1"/>
                                <a href="#" id="dmoleNext" class="DMOLE-ENavigationButton" title="${_('Next question')}"><img src="${path}quextIENext.png" alt="${_('Next question')}" class="DMOLE-ENavigationButton" /></a>
                                <a href="#" id="dmoleLast" class="DMOLE-ENavigationButton" title="${_('Last question')}"><img src="${path}quextIELast.png" alt="${_('Last question')}" class="DMOLE-ENavigationButton" /></a>
                                <a href="#" id="dmoleDelete" class="DMOLE-ENavigationButton" title="${_('Delete question')}"><img src="${path}quextIEDelete.png" alt="${_('Delete question')}" class="DMOLE-ENavigationButton" /></a>
                                <a href="#" id="dmoleCopy" class="DMOLE-ENavigationButton" title="${_('Copy question')}"><img src="${path}quextIECopy.png" alt="${_('Copy question')}" class="DMOLE-ENavigationButton" /></a>
                                <a href="#" id="dmoleCut" class="DMOLE-ENavigationButton" title="${_('Cut question')}"><img src="${path}quextIECut.png" alt="${_('Cut question')}" class="DMOLE-ENavigationButton" /></a>
                                <a href="#" id="dmolePaste" class="DMOLE-ENavigationButton" title="${_('Paste question')}"><img src="${path}quextIEPaste.png" alt="${_('Paste question')}" class="DMOLE-ENavigationButton" /></a>
                            </div>
                            <div class="DMOLE-ENumQuestionDiv" id="dmoleNumQuestionDiv">
                                <div class="DMOLE-ENumQ"><span class="sr-av">${_('Number of questions:')}</span></div> <span class="DMOLE-ENumQuestions" id="dmoleNumQuestions">0</span>
                            </div>
                        </div>
                    </fieldset>
                    ${$exeDevicesEdition.iDevice.common.getTextFieldset('after')}
                 </div>
                ${$exeDevicesEdition.iDevice.gamification.itinerary.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.scorm.getTab()}
                ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}

            </div>`;

        this.ideviceBody.innerHTML = html;
        $exeDevicesEdition.iDevice.tabs.init('dMoleIdeviceForm');
        $exeDevicesEdition.iDevice.gamification.scorm.init();

        $exeDevice.enableForm();
    },

    initQuestions: async function () {

        if ($exeDevice.selectsGame.length == 0) {
            const defaultModel = await $exeDevice.ensureDefaultModelLoaded();
            const question = $exeDevice.getCuestionDefault(defaultModel);
            $exeDevice.selectsGame.push(question);
            this.showOptions(4);
            this.showSolution('');
        }
        $exeDevice.showTypeQuestion(0);
        this.active = 0;
    },

    getDefaultModelSourcePath: function () {
        const basePath = ($exeDevice.idevicePath || '').replace(/\\/g, '/');
        const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
        return `${normalizedBase}${$exeDevice.defaultModelFile}`;
    },

    ensureDefaultModelLoaded: async function () {
        if (
            $exeDevice.defaultModelDataCache &&
            $exeDevice.defaultModelDataCache.modelData &&
            $exeDevice.defaultModelDataCache.modelFormat
        ) {
            return $exeDevice.defaultModelDataCache;
        }

        if ($exeDevice.defaultModelDataPromise) {
            return $exeDevice.defaultModelDataPromise;
        }

        const sourcePath = $exeDevice.getDefaultModelSourcePath();
        $exeDevice.defaultModelDataPromise = $exeDevice
            .loadModelFromPath(sourcePath)
            .then((modelFile) => {
                $exeDevice.defaultModelDataCache = {
                    modelData: modelFile.modelData || '',
                    modelFormat: (modelFile.modelFormat || '').toLowerCase(),
                    modelName:
                        modelFile.modelName ||
                        $exeDevice.getModelFileNameFromPath(sourcePath),
                    modelPath: sourcePath,
                };
                return $exeDevice.defaultModelDataCache;
            })
            .catch((error) => {
                console.error(error);
                $exeDevice.defaultModelDataCache = {
                    modelData: '',
                    modelFormat: '',
                    modelName: '',
                    modelPath: sourcePath,
                };
                return $exeDevice.defaultModelDataCache;
            })
            .finally(() => {
                $exeDevice.defaultModelDataPromise = null;
            });

        return $exeDevice.defaultModelDataPromise;
    },

    getCuestionDefault: function (defaultModel) {
        const sampleModel = defaultModel || $exeDevice.defaultModelDataCache || {};
        const sampleModelPath =
            sampleModel.modelPath || $exeDevice.getDefaultModelSourcePath();
        const p = {
            typeSelect: 0,
            time: 0,
            numberOptions: 4,
            modelData: sampleModel.modelData || '',
            modelFormat: sampleModel.modelFormat || '',
            modelName:
                sampleModel.modelName ||
                $exeDevice.getModelFileNameFromPath(sampleModelPath),
            modelPath: sampleModelPath,
            quextion: c_('How many hydroxyl groups (–OH) does a glucose molecule have?'),
            options: [c_('5'), c_('4'), c_('3'), c_('6')],
            solution: 'A',
            solutionQuestion: '',
            percentageShow: 35,
            description: c_('Glucose (C₆H₁₂O₆) is the most abundant monosaccharide and the primary source of cellular energy. Rotate the model to explore its structure.'),
            modelStyle: 'stick',
            bgDark: false,
            cameraView: null,
            disableCamera: false,
            showAtomLegend: false,
        };
        return p;
    },

    loadPreviousValues: function () {
        const originalHTML = this.idevicePreviousData;

        if (originalHTML && Object.keys(originalHTML).length > 0) {
            $exeDevice.active = 0;

            const wrapper = $('<div></div>').html(originalHTML),
                json = $exeDevices.iDevice.gamification.helpers.decrypt(
                    $('.dmole-DataGame', wrapper).text()
                ),
                dataGame =
                    $exeDevices.iDevice.gamification.helpers.isJsonString(json);
            if (dataGame) {
                $exeDevice.updateFieldGame(dataGame);

                const instructions =
                    dataGame.instructionsExe || dataGame.instructions;
                if (instructions) {
                    $exeDevice.setEditorContent('eXeGameInstructions', unescape(instructions));
                }
                const textAfter = dataGame.textAfter || '';
                if (textAfter) {
                    $exeDevice.setEditorContent('eXeIdeviceTextAfter', unescape(textAfter));
                }
                const textFeedBack = dataGame.textFeedBack || '';
                if (textFeedBack) {
                    $exeDevice.setEditorContent('dmoleFeedBackEditor', unescape(textFeedBack));
                }
            }
        }
    },

    updateFieldGame: function (game) {
        $exeDevicesEdition.iDevice.gamification.itinerary.setValues(
            game.itinerary
        );
        game.answersRamdon = game.answersRamdon || false;
        game.questionsRandom = game.questionsRandom || false;
        game.percentajeFB =
            typeof game.percentajeFB != 'undefined' ? game.percentajeFB : 100;
        game.feedBack =
            typeof game.feedBack != 'undefined' ? game.feedBack : false;
        game.percentajeQuestions =
            typeof game.percentajeQuestions == 'undefined'
                ? 100
                : game.percentajeQuestions;
        game.evaluation =
            typeof game.evaluation != 'undefined' ? game.evaluation : false;
        game.evaluationID =
            typeof game.evaluationID != 'undefined' ? game.evaluationID : '';
        game.weighted =
            typeof game.weighted != 'undefined' ? game.weighted : 100;
        game.globalTime =
            typeof game.globalTime != 'undefined' ? game.globalTime : 0;
        game.activityMode =
            typeof game.activityMode != 'undefined' ? game.activityMode : 'test';

        $('input[name="slcactivitymode"][value="' + game.activityMode + '"]').prop('checked', true);
        $exeDevice.toggleActivityMode(game.activityMode);

        $exeDevice.id =
            typeof game.id !== 'undefined'
                ? game.id
                : $exeDevice.getIdeviceID();

        $('#dmoleShowMinimize').prop('checked', game.showMinimize);
        $('#dmoleAnswersRamdon').prop('checked', game.answersRamdon);
        $('#dmoleQuestionsRandom').prop('checked', game.questionsRandom);
        $('#dmoleShowSolution').prop('checked', game.showSolution);
        $('#dmoleTimeShowSolution').prop('disabled', !game.showSolution);
        $('#dmoleTimeShowSolution').val(game.timeShowSolution);
        $('#dmoleModeBoard').prop('checked', game.modeBoard);
        $('#dmoleScoreQuestionDiv')
            .addClass('d-none')
            .removeClass('d-flex');
        $('#dmoleHasFeedBack').prop('checked', game.feedBack);
        $('#dmolePercentajeFB').val(game.percentajeFB);
        $('#dmolePercentajeQuestionsValue').val(game.percentajeQuestions);
        $('#dmoleEvaluation').prop('checked', game.evaluation);
        $('#dmoleEvaluationID').val(game.evaluationID);
        $('#dmoleGlobalTimes').val(game.globalTime);

        $('#dmoleEvaluationID').prop('disabled', !game.evaluation);

        for (let i = 0; i < game.selectsGame.length; i++) {
            game.selectsGame[i].typeSelect =
                typeof game.selectsGame[i].typeSelect == 'undefined'
                    ? ''
                    : game.selectsGame[i].typeSelect;
            game.selectsGame[i].solutionQuestion =
                typeof game.selectsGame[i].solutionQuestion == 'undefined'
                    ? ''
                    : game.selectsGame[i].solutionQuestion;
            game.selectsGame[i].modelData =
                typeof game.selectsGame[i].modelData == 'undefined'
                    ? ''
                    : game.selectsGame[i].modelData;
            game.selectsGame[i].modelFormat =
                typeof game.selectsGame[i].modelFormat == 'undefined'
                    ? ''
                    : game.selectsGame[i].modelFormat;
            game.selectsGame[i].modelName =
                typeof game.selectsGame[i].modelName == 'undefined'
                    ? ''
                    : game.selectsGame[i].modelName;
            game.selectsGame[i].modelPath =
                typeof game.selectsGame[i].modelPath == 'undefined'
                    ? ''
                    : game.selectsGame[i].modelPath;
            game.selectsGame[i].description =
                typeof game.selectsGame[i].description == 'undefined'
                    ? ''
                    : game.selectsGame[i].description;
            if (!game.selectsGame[i].modelFormat && game.selectsGame[i].modelName) {
                game.selectsGame[i].modelFormat = $exeDevice.getModelFormatByName(
                    game.selectsGame[i].modelName
                );
            }
            game.selectsGame[i].modelStyle = $exeDevice.normalizeModelStyle(
                game.selectsGame[i].modelStyle || game.modelStyle || 'stick'
            );
            game.selectsGame[i].bgDark = !!game.selectsGame[i].bgDark;
            game.selectsGame[i].cameraView = game.selectsGame[i].cameraView || null;
            // Migrate global disableCamera to per-question (backward compat)
            game.selectsGame[i].disableCamera = typeof game.selectsGame[i].disableCamera !== 'undefined'
                ? !!game.selectsGame[i].disableCamera
                : !!game.disableCamera;
            game.selectsGame[i].showAtomLegend = !!game.selectsGame[i].showAtomLegend;
        }
        if (game.feedBack) {
            $('#dmoleFeedbackP').show();
        } else {
            $('#dmoleFeedbackP').hide();
        }
        $('#dmolePercentajeFB').prop('disabled', !game.feedBack);
        $exeDevicesEdition.iDevice.gamification.scorm.setValues(
            game.isScorm,
            game.textButtonScorm,
            game.repeatActivity,
            game.weighted
        );
        $exeDevice.selectsGame = game.selectsGame;
        $exeDevice.updateSelectOrder();
        $exeDevice.showQuestion($exeDevice.active);
    },

    escapeHtml: function (string) {
        return String(string)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    save: function () {
        if (!$exeDevice.validateQuestion()) {
            return false;
        }

        const dataGame = this.validateData();
        if (!dataGame) {
            return false;
        }

        $exeDevicesEdition.iDevice.gamification.helpers.stopSound();

        const fields = this.ci18n;
        const i18n = { ...fields };

        for (let key in fields) {
            const fVal = $('#ci18n_' + key).val();
            if (fVal !== '') {
                i18n[key] = fVal;
            }
        }

        dataGame.msgs = i18n;

        const json = JSON.stringify(dataGame),
            instructions = $exeDevice.getEditorContent('eXeGameInstructions');

        let divContent = '';
        if (instructions !== '') {
            divContent = `<div class="dmole-instructions SLCNP-instructions">${instructions}</div>`;
        }

        const textFeedBack = $exeDevice.getEditorContent('dmoleFeedBackEditor');
   
        const ideviceID = $exeDevice.getIdeviceID();

        let html = '<div class="dmole-IDevice">';
        html += `<div class="game-evaluation-ids js-hidden" data-id="${ideviceID}" data-evaluationb="${dataGame.evaluation}" data-evaluationid="${dataGame.evaluationID}"></div>`;
        html += divContent;
        html += `<div class="dmole-version js-hidden">${$exeDevice.version}</div>`;
        html += `<div class="dmole-feedback-game">${textFeedBack}</div>`;
        html += `<div class="dmole-DataGame js-hidden">${$exeDevices.iDevice.gamification.helpers.encrypt(json)}</div>`;

        const textAfter = $exeDevice.getEditorContent('eXeIdeviceTextAfter');
        if (textAfter !== '') {
            html += `<div class="dmole-extra-content">${textAfter}</div>`;
        }

        html += `<div class="dmole-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>`;
        html += '</div>';

        return html;
    },

    validateQuestion: function () {
        const msgs = $exeDevice.msgs;
        const activityMode = $('input[name="slcactivitymode"]:checked').val() || 'test';
        let p = {},
            message = '';

        p.time = parseInt($('input[name=slctime]:checked').val());
        p.numberOptions = parseInt($('input[name=slcnumber]:checked').val());
        p.typeSelect = parseInt($('input[name=slctypeselect]:checked').val());
        p.customScore = parseFloat($('#dmoleScoreQuestion').val()) || 1;
        p.modelData = $('#dmoleModelData').val().trim();
        p.modelFormat = $('#dmoleModelFormat').val().trim();
        p.modelName = $('#dmoleModelFileName').text().trim();
        p.modelPath = ($('#dmoleModelFile').val() || '').trim();
        p.description = $('#dmoleDescription').val().trim();
        p.modelStyle = $exeDevice.normalizeModelStyle($('#dmoleModelStyle').val());
        p.bgDark = $('#dmoleModelToggleBg').attr('aria-pressed') === 'true';
        // Auto-save the current camera view from the 3D viewer whenever the question is saved
        const currentViewer = $exeDevice.modelViewer;
        if (currentViewer && currentViewer.getView) {
            p.cameraView = currentViewer.getView();
        } else {
            p.cameraView = ($exeDevice.selectsGame[$exeDevice.active] || {}).cameraView || null;
        }
        p.disableCamera = !!($exeDevice.selectsGame[$exeDevice.active] || {}).disableCamera;
        p.showAtomLegend = $('#dmoleShowAtomLegend').attr('aria-pressed') === 'true';
        if (!p.modelFormat && p.modelName) {
            p.modelFormat = $exeDevice.getModelFormatByName(p.modelName);
        }

        $exeDevicesEdition.iDevice.gamification.helpers.stopSound();

        p.quextion = $('#dmoleQuestion').val().trim();
        p.options = [];
        p.solution = $('#dmoleSolutionSelect').text().trim();
        p.solutionQuestion = '';

        if (p.typeSelect == 2) {
            p.quextion = $('#dmoleDefinitionWord').val().trim();
            p.solution = '';
            p.solutionQuestion = $('#dmoleSolutionWord').val();
        }

        p.percentageShow = parseInt($('#dmolePercentageShow').val());

        let optionEmpy = false;
        $('.DMOLE-EAnwersOptions').each(function (i) {
            let option = $(this).val().trim();
            if (i < p.numberOptions && option.length == 0) {
                optionEmpy = true;
            }
            if (p.typeSelect == 2) {
                option = '';
            }
            p.options.push(option);
        });

        if (activityMode === 'test') {
            if (!p.modelData || !p.modelFormat) {
                message = msgs.msgESelectModel;
            } else if (p.typeSelect == 1 && p.solution.length != p.numberOptions) {
                message = msgs.msgTypeChoose;
            } else if (p.typeSelect != 2 && p.quextion.length == 0) {
                message = msgs.msgECompleteQuestion;
            } else if (p.typeSelect != 2 && optionEmpy) {
                message = msgs.msgECompleteAllOptions;
            } else if (p.typeSelect == 2 && p.solutionQuestion.trim().length == 0) {
                message = $exeDevice.msgs.msgEProvideWord;
            } else if (p.typeSelect == 2 && p.quextion.trim().length == 0) {
                message = $exeDevice.msgs.msgEDefintion;
            }
        }

        if (message.length == 0) {
            $exeDevice.selectsGame[$exeDevice.active] = p;
            message = true;
        } else {
            $exeDevice.showMessage(message);
            message = false;
        }

        return message;
    },



    getIdeviceID: function () {
        // Note: the outer .idevice_node has class '3dmol' (folder name), which is an
        // invalid CSS selector (starts with digit). Use generic .idevice_node selector.
        return $('#dMoleIdeviceForm').closest('div.idevice_node').attr('id') || '';
    },

    validateData: function () {
        const clear = $exeDevice.removeTags,
            activityMode = $('input[name="slcactivitymode"]:checked').val() || 'test',
            instructions = $('#eXeGameInstructions').text(),
            instructionsExe = escape(
                $exeDevice.getEditorContent('eXeGameInstructions')
            ),
            textAfter = escape($exeDevice.getEditorContent('eXeIdeviceTextAfter')),
            textFeedBack = escape(
                $exeDevice.getEditorContent('dmoleFeedBackEditor')
            ),
            showMinimize = $('#dmoleShowMinimize').is(':checked'),
            modeBoard = $('#dmoleModeBoard').is(':checked'),
            answersRamdon = $('#dmoleAnswersRamdon').is(':checked'),
            questionsRandom = $('#dmoleQuestionsRandom').is(':checked'),
            // disableCamera is now per-question (no global checkbox)
            showSolution = $('#dmoleShowSolution').is(':checked'),
            timeShowSolution = parseInt(
                clear($('#dmoleTimeShowSolution').val())
            ),
            itinerary =
                $exeDevicesEdition.iDevice.gamification.itinerary.getValues(),
            feedBack = $('#dmoleHasFeedBack').is(':checked'),
            percentajeFB = parseInt(clear($('#dmolePercentajeFB').val())),
            percentajeQuestions = parseInt(
                clear($('#dmolePercentajeQuestionsValue').val())
            ),
            evaluation = $('#dmoleEvaluation').is(':checked'),
            evaluationID = $('#dmoleEvaluationID').val(),
            id = $exeDevice.getIdeviceID(),
            globalTime = parseInt($('#dmoleGlobalTimes').val(), 10);

        if (!itinerary) return false;

        if (activityMode === 'test') {
            if (feedBack && textFeedBack.trim().length == 0) {
                eXe.app.alert($exeDevice.msgs.msgProvideFB);
                return false;
            }
            if (showSolution && timeShowSolution.length == 0) {
                $exeDevice.showMessage($exeDevice.msgs.msgEProvideTimeSolution);
                return false;
            }
            if (evaluation && evaluationID.length < 5) {
                eXe.app.alert($exeDevice.msgs.msgIDLenght);
                return false;
            }
        }
        const selectsGame = $exeDevice.selectsGame;

        for (let i = 0; i < selectsGame.length; i++) {
            const mquestion = selectsGame[i];
            if (!mquestion.modelData || !mquestion.modelFormat) {
                $exeDevice.showMessage($exeDevice.msgs.msgESelectModel);
                return false;
            }
        }

        if (activityMode === 'test') {
            for (let i = 0; i < selectsGame.length; i++) {
                let mquestion = selectsGame[i];
                mquestion.customScore =
                    typeof mquestion.customScore == 'undefined'
                        ? 1
                        : mquestion.customScore;
                if (mquestion.quextion.length == 0) {
                    $exeDevice.showMessage($exeDevice.msgs.msgECompleteQuestion);
                    return false;
                }
                if (mquestion.typeSelect == 2) {
                    if (mquestion.solutionQuestion.length == 0) {
                        $exeDevice.showMessage($exeDevice.msgs.msgProvideSolution);
                        return false;
                    }
                } else {
                    let completAnswer = true;
                    for (let j = 0; j < mquestion.numberOptions; j++) {
                        if (mquestion.options[j].length == 0) {
                            completAnswer = false;
                        }
                    }
                    if (!completAnswer) {
                        $exeDevice.showMessage(
                            $exeDevice.msgs.msgECompleteAllOptions
                        );
                        return false;
                    }
                }
            }
        }

        const scorm = $exeDevicesEdition.iDevice.gamification.scorm.getValues();
        return {
            asignatura: '',
            author: '',
            typeGame: '3DMol',
            activityMode: activityMode,
            instructionsExe: instructionsExe,
            instructions: instructions,
            showMinimize: showMinimize,
            answersRamdon: answersRamdon,
            questionsRandom: questionsRandom,
            // disableCamera is now per-question (stored in selectsGame[i].disableCamera)
            showSolution: showSolution,
            timeShowSolution: timeShowSolution,
            useLives: false,
            numberLives: 3,
            itinerary: itinerary,
            selectsGame: selectsGame,
            isScorm: scorm.isScorm,
            textButtonScorm: scorm.textButtonScorm,
            repeatActivity: scorm.repeatActivity,
            weighted: scorm.weighted || 100,
            title: '',
            customScore: false,
            textAfter: textAfter,
            textFeedBack: textFeedBack,
            gameMode: 1,
            feedBack: feedBack,
            percentajeFB: percentajeFB,
            version: 3.1,
            percentajeQuestions: percentajeQuestions,
            modeBoard: modeBoard,
            evaluation: evaluation,
            evaluationID: evaluationID,
            id: id,
            globalTime: globalTime,
            modelStyle: $exeDevice.normalizeModelStyle($exeDevice.modelStyle),
        };
    },

    removeTags: function (str) {
        return $('<div></div>').html(str).text();
    },

    showTypeQuestion: function (type) {
        const activityMode =
            $('input[name="slcactivitymode"]:checked').val() || 'test';
        if (activityMode === 'show') {
            $('#dmoleAnswers').hide();
            $('#dmoleWordDiv').hide();
            $('#dmoleQuestionDiv')
                .removeClass('d-flex')
                .addClass('d-none');
            $('#dmoleDescriptionDiv')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#dMoleIdeviceForm .DMOLE-ESolutionSelect').hide();
            $('#dmoleInputNumbers')
                .removeClass('d-flex')
                .addClass('d-none');
            $('#dmoleSolitionOptions')
                .removeClass('d-flex')
                .addClass('d-none');
            $('#dmolePercentageSpan')
                .removeClass('d-flex')
                .addClass('d-none');
            $('#dmolePercentage').removeClass('d-flex').addClass('d-none');
            return;
        }

        if (type == 2) {
            $('#dmoleAnswers').hide();
            $('#dmoleQuestionDiv')
                .removeClass('d-flex')
                .addClass('d-none');
            $('#dMoleIdeviceForm .DMOLE-ESolutionSelect').hide();
            $('#dmoleInputNumbers')
                .removeClass('d-flex')
                .addClass('d-none');
            $('#dmoleSolitionOptions')
                .removeClass('d-flex')
                .addClass('d-none');
            $('#dmolePercentageSpan')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#dmolePercentage').removeClass('d-none').addClass('d-flex');
            $('#dmoleWordDiv').show();
        } else {
            $('#dmoleAnswers').show();
            $('#dmoleQuestionDiv')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#dMoleIdeviceForm .DMOLE-ESolutionSelect').show();
            $('#dmoleInputNumbers')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#dmoleSolitionOptions')
                .removeClass('d-none')
                .addClass('d-flex');
            $('#dmolePercentageSpan')
                .removeClass('d-flex')
                .addClass('d-none');
            $('#dmolePercentage').removeClass('d-flex').addClass('d-none');
            $('#dmoleWordDiv').hide();
        }
    },

    addEvents: function () {
        const $dmolePaste = $('#dmolePaste'),
            $dmoleTimeShowSolution = $('#dmoleTimeShowSolution'),
            $dmoleShowSolution = $('#dmoleShowSolution'),
            $dmolePercentajeQuestions = $(
                '#dmolePercentajeQuestionsValue'
            ),
            $dmoleNumberQuestion = $('#dmoleNumberQuestion'),
            $dmoleForm = $('#dMoleIdeviceForm');

        $dmolePaste.hide();

        // Activity mode (Test / Show)
        $('#dmoleModeTest, #dmoleModeShow').on('click', function () {
            $exeDevice.toggleActivityMode($(this).val());
        });

        // Toggle switch delegation
        $dmoleForm.on(
            'click.qq.toggle',
            '.toggle-item',
            function (e) {
                if (
                    $(e.target).is(
                        'input.toggle-input, label[for], input[type=number], input[type=text], select, textarea, button'
                    )
                )
                    return;
                if (
                    $(e.target).is('#dmoleEvaluationID') ||
                    $(e.target).closest('#dmoleEvaluationHelpLnk').length
                )
                    return;
                const $input = $(this).find('input.toggle-input').first();
                if ($input.length) {
                    const newVal = !$input.prop('checked');
                    $input.prop('checked', newVal).trigger('change');
                }
            }
        );

        $dmoleForm.on(
            'click',
            '#dmoleEvaluationID',
            function (e) {
                e.stopPropagation();
            }
        );
        $dmoleForm.on(
            'click',
            '#dmoleEvaluationHelpLnk, #dmoleEvaluationHelpLnk *',
            function (e) {
                e.stopPropagation();
            }
        );

        $('#dmoleShowCodeAccess').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#dmoleCodeAccess, #dmoleMessageCodeAccess').prop(
                'disabled',
                !marcado
            );
        });

        $('.DMOLE-EPanel').on('click', 'input.DMOLE-TypeSelect', function () {
            const type = parseInt($(this).val(), 10);
            $exeDevice.showTypeQuestion(type);
        });

        $('.DMOLE-EPanel').on('click', 'input.DMOLE-Number', function () {
            const number = parseInt($(this).val(), 10);
            $exeDevice.showOptions(number);
        });

        $('#dmoleAdd').on('click', (e) => {
            e.preventDefault();
            $exeDevice.addQuestion();
        });

        $('#dmoleFirst').on('click', (e) => {
            e.preventDefault();
            $exeDevice.firstQuestion();
        });

        $('#dmolePrevious').on('click', (e) => {
            e.preventDefault();
            $exeDevice.previousQuestion();
        });

        $('#dmoleNext').on('click', (e) => {
            e.preventDefault();
            $exeDevice.nextQuestion();
        });

        $('#dmoleLast').on('click', (e) => {
            e.preventDefault();
            $exeDevice.lastQuestion();
        });

        $('#dmoleDelete').on('click', (e) => {
            e.preventDefault();
            $exeDevice.removeQuestion();
        });

        $('#dmoleCopy').on('click', (e) => {
            e.preventDefault();
            $exeDevice.copyQuestion();
        });

        $('#dmoleCut').on('click', (e) => {
            e.preventDefault();
            $exeDevice.cutQuestion();
        });

        $('#dmolePaste').on('click', (e) => {
            e.preventDefault();
            $exeDevice.pasteQuestion();
        });

        $('#dmoleGlobalTimeButton').on('click', (e) => {
            e.preventDefault();
            const selectedTime = parseInt(
                $('#dmoleGlobalTimes').val(),
                10
            );
            for (let i = 0; i < $exeDevice.selectsGame.length; i++) {
                $exeDevice.selectsGame[i].time = selectedTime;
            }
            $(
                `input.DMOLE-Times[name='slctime'][value='${selectedTime}']`
            ).prop('checked', true);
        });

        // Only allow 3D viewer interaction when mouse is over the viewer
        $('#dmoleModelPreview')
            .on('mouseenter', function () {
                const canvas = this.querySelector('canvas');
                if (canvas) canvas.style.pointerEvents = 'auto';
            })
            .on('mouseleave', function () {
                const canvas = this.querySelector('canvas');
                if (canvas) canvas.style.pointerEvents = 'none';
            });

        // 3D model preview button
        $('#dmolePreviewModel').on('click', (e) => {
            e.preventDefault();
            $exeDevice.renderModelPreview();
        });

        // Reset camera button (hidden legacy button)
        $('#dmoleResetCamera').on('click', (e) => {
            e.preventDefault();
            if ($exeDevice.modelViewer && $exeDevice.modelViewer.zoomTo) {
                $exeDevice.modelViewer.zoomTo();
                $exeDevice.modelViewer.render();
            }
        });

        // Toolbar: model style select
        $('#dmoleModelStyle').on('change', function () {
            const q = $exeDevice.selectsGame[$exeDevice.active];
            if (!q) return;
            q.modelStyle = $exeDevice.normalizeModelStyle($(this).val());
            if ($exeDevice.modelViewer) {
                $exeDevice.applyModelStyle($exeDevice.modelViewer, q.modelStyle);
                $exeDevice.modelViewer.render();
            }
        });

        // Toolbar: zoom out
        $('#dmoleModelSizeDown').on('click', (e) => {
            e.preventDefault();
            if ($exeDevice.modelViewer && $exeDevice.modelViewer.zoom) {
                $exeDevice.modelViewer.zoom(0.8);
                $exeDevice.modelViewer.render();
            }
        });

        // Toolbar: zoom in
        $('#dmoleModelSizeUp').on('click', (e) => {
            e.preventDefault();
            if ($exeDevice.modelViewer && $exeDevice.modelViewer.zoom) {
                $exeDevice.modelViewer.zoom(1.25);
                $exeDevice.modelViewer.render();
            }
        });

        // Toolbar: reset camera
        $('#dmoleModelResetCamera').on('click', (e) => {
            e.preventDefault();
            if ($exeDevice.modelViewer && $exeDevice.modelViewer.zoomTo) {
                $exeDevice.modelViewer.zoomTo();
                $exeDevice.modelViewer.render();
            }
        });

        // Toolbar: camera button — toggles between 2 states:
        //   Green (default): camera active in export, toolbar visible
        //   Gray: camera disabled in export, toolbar hidden
        // In both states the cameraView is saved so export matches edition view.
        $('#dmoleModelSaveView').on('click', (e) => {
            e.preventDefault();
            const q = $exeDevice.selectsGame[$exeDevice.active];
            if (!q) return;
            q.disableCamera = !q.disableCamera;
            $exeDevice.updatePinButtonState(q);
        });

        // Toolbar: toggle background
        $('#dmoleModelToggleBg').on('click', (e) => {
            e.preventDefault();
            const q = $exeDevice.selectsGame[$exeDevice.active];
            if (!q) return;
            q.bgDark = !q.bgDark;
            if ($exeDevice.modelViewer && $exeDevice.modelViewer.setBackgroundColor) {
                $exeDevice.modelViewer.setBackgroundColor(q.bgDark ? 'black' : 'white');
                $exeDevice.modelViewer.render();
            }
            $exeDevice.updateBgButtonState(q);
        });

        // Toolbar: toggle atom color legend
        $('#dmoleShowAtomLegend').on('click', (e) => {
            e.preventDefault();
            const q = $exeDevice.selectsGame[$exeDevice.active];
            if (!q) return;
            q.showAtomLegend = !q.showAtomLegend;
            $exeDevice.updateAtomLegendButtonState(q);
        });

        // Toolbar: download PNG
        $('#dmoleModelDownloadPng').on('click', (e) => {
            e.preventDefault();
            if ($exeDevice.modelViewer && $exeDevice.modelViewer.pngURI) {
                const a = document.createElement('a');
                a.href = $exeDevice.modelViewer.pngURI();
                a.download = 'model.png';
                a.click();
            }
        });

        $('#dmoleModelFile').on('change', async function () {
            const selectedFile = ($(this).val() || '').trim();
            if (!selectedFile) {
                $(this).removeData('blobUrl');
                $('#dmoleModelData').val('');
                $('#dmoleModelFormat').val('');
                $('#dmoleModelFileName').text('');
                $('#dmoleModelSizeWarning').addClass('d-none');
                $exeDevice.renderModelPreview();
                return;
            }

            try {
                const blobUrl =
                    selectedFile.startsWith('asset://') &&
                    $(this).data('blobUrl')
                        ? $(this).data('blobUrl').toString()
                        : '';
                const modelFile = await $exeDevice.loadModelFromPath(
                    selectedFile,
                    blobUrl
                );
                $('#dmoleModelData').val(modelFile.modelData || '');
                $('#dmoleModelFormat').val(modelFile.modelFormat || '');
                $('#dmoleModelFileName').text(
                    modelFile.modelName ||
                        $exeDevice.getModelFileNameFromPath(selectedFile)
                );
                // Warn if model data exceeds 500 KB
                const dataSize = (modelFile.modelData || '').length;
                const $warning = $('#dmoleModelSizeWarning');
                if (dataSize > 500 * 1024) {
                    console.warn('[3DMol] Large model: ' + Math.round(dataSize / 1024) + ' KB');
                    $warning.text($exeDevice.msgs.msgModelLarge).removeClass('d-none');
                } else {
                    $warning.addClass('d-none');
                }
                $exeDevice.renderModelPreview();
            } catch (error) {
                console.error(error);
                $('#dmoleModelData').val('');
                $('#dmoleModelFormat').val('');
                $('#dmoleModelFileName').text('');
                $('#dmoleModelSizeWarning').addClass('d-none');
                $exeDevice.showMessage($exeDevice.msgs.msgEModelFormat);
                $(this).val('').removeData('blobUrl');
            }
        });

        $dmoleTimeShowSolution
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 1);
                this.value = v;
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 3, 10);
                val = Math.max(1, Math.min(val, 9));
                this.value = val;
            });

        $('#dmolePercentageShow')
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 35, 10);
                val = Math.max(0, Math.min(val, 100));
                this.value = val;
            });

        $('#dmoleScoreQuestion').on('focusout', function () {
            if (!$exeDevice.validateScoreQuestion($(this).val())) {
                $(this).val(1);
            }
        });

        $('#eXeGameExportImport').show();
        $('#eXeGameExportQuestions').on('click', () => {
            $exeDevice.exportQuestions();
        });


        $dmoleShowSolution.on('change', function () {
            const marcado = $(this).is(':checked');
            $dmoleTimeShowSolution.prop('disabled', !marcado);
        });

        $('.DMOLE-ESolution').on('change', function () {
            const marcado = $(this).is(':checked'),
                value = $(this).val();
            $exeDevice.clickSolution(marcado, value);
        });

        $('#dmoleHasFeedBack').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#dmoleFeedbackP').slideToggle(marcado);
            $('#dmolePercentajeFB').prop('disabled', !marcado);
        });

        $dmolePercentajeQuestions
            .on('keyup', function () {
                let v = this.value.replace(/\D/g, '').substring(0, 3);
                this.value = v;
                if (this.value > 0 && this.value <= 100) {
                    $exeDevice.updateQuestionsNumber();
                }
            })
            .on('click', function () {
                $exeDevice.updateQuestionsNumber();
            })
            .on('focusout', function () {
                let val = parseInt(this.value.trim() || 100, 10);
                val = Math.max(1, Math.min(val, 100));
                this.value = val;
                $exeDevice.updateQuestionsNumber();
            });

        $dmoleNumberQuestion.on('keyup', function (e) {
            if (e.keyCode === 13) {
                const num = parseInt($(this).val(), 10);
                if (!isNaN(num) && num > 0) {
                    if ($exeDevice.validateQuestion()) {
                        $exeDevice.active = Math.min(
                            num - 1,
                            $exeDevice.selectsGame.length - 1
                        );
                        $exeDevice.showQuestion($exeDevice.active);
                    } else {
                        $(this).val($exeDevice.active + 1);
                    }
                } else {
                    $(this).val($exeDevice.active + 1);
                }
            }
        });

        $('#dmoleEvaluation').on('change', function () {
            const marcado = $(this).is(':checked');
            $('#dmoleEvaluationID').prop('disabled', !marcado);
        });

        $('#dmoleEvaluationHelpLnk').on('click', function () {
            $('#dmoleEvaluationHelp').toggle();
            return false;
        });

        $exeDevicesEdition.iDevice.gamification.itinerary.addEvents();
        $exeDevicesEdition.iDevice.gamification.share.addEvents(2);

        //eXe 3.0 Dismissible messages
        $('.exe-block-dismissible .exe-block-close').on('click', function () {
            $(this).parent().fadeOut();
            return false;
        });
    },

    clickSolution: function (checked, value) {
        let solutions = $('#dmoleSolutionSelect').text();
        if (checked) {
            if (solutions.indexOf(value) == -1) {
                solutions += value;
            }
        } else {
            solutions = solutions.split(value).join('');
        }
        $('#dmoleSolutionSelect').text(solutions);
    },

    validateScoreQuestion: function (text) {
        const isValid =
            text.length > 0 &&
            text !== '.' &&
            text !== ',' &&
            /^-?\d*[.,]?\d*$/.test(text);
        return isValid;
    },
};
