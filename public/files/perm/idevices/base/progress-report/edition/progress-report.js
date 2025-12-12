/**
/**
 * informe Activity iDevice (edition code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narvaez Martinez
 * Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $exeDevice = {
    i18n: {
        category: _('Assessment and tracking'),
        name: _('Progress report'),
    },
    msgs: {},
    id: '',
    number: 0,
    sessionIdevices: null,
    typeshow: 0,
    ci18n: {},
    init: function (element, previousData, path) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData;
        this.idevicePath = path;
        this.refreshTranslations();
        this.createForm();
        this.addEvents();
        this.getIdevicesBySessionId();
    },

    refreshTranslations: function () {
        this.ci18n = {
            msgSummary: c_('Summary of activities'),
            msgNoCompletedActivities: c_(
                'You have not completed any of the suggested activities to be assessed in this educational resource.'
            ),
            msgNoPendientes: c_('Number of activities to be completed: %s'),
            msgCompletedActivities: c_(
                'The following table registers the results you have obtained in the completed, suggested and assessed activities in this educational resource.'
            ),
            msgAverageScore: c_('Average score'),
            msgReboot: c_('Restart'),
            msgReload: c_('Update'),
            mssActivitiesNumber: c_('No. of activities: %s'),
            msgActivitiesCompleted: c_('Completed: %s'),
            msgAverageScore1: c_('Average score: %s'),
            msgAverageScoreCompleted: c_(
                'Average score of completed activities: %s'
            ),
            msgDelete: c_(
                'This will eliminate the stored scores of all activities. Are you sure you want to continue?'
            ),
            msgSections: c_('Educational resource sections'),
            msgSave: c_('Save'),
            msgReport: c_('progress_report'),
            msgReportTitle: c_('Progress report'),
            msgType: c_('Type'),
            msgSeeActivity: c_('Go to the activity'),
            mgsSections: c_('Educational resource sections'),
            msgName: c_('Name'),
            msgDate: c_('Date'),
            msgNotCompleted: c_('Not completed'),
            msgNotData: c_('Error recovering data'),
            msgScoredActivities: c_('Scored Activities'),
            msgInEXE: c_(
                'In preview mode, visit this progress report to see the status of all associated scored activities. This status can be:'
            ),
            msgInEXE2: c_('This message will only be displayed in edit mode.'),
            msgUncompletedActivity: c_('Uncompleted Activity'),
            msgUnsuccessfulActivity: c_('Unsuccessful Activity'),
            msgSuccessfulActivity: c_('Successful Activity'),
            msgLocalMode: c_(
                'In local mode, the results of completed activities cannot be displayed in the report'
            ),
            msgDownload: c_('Download progress report'),
            msgReload: c_('Edit this iDevice to update its contents.'),
        };
    },

    async getIdevicesBySessionId() {
        const odeSessionId = eXeLearning.app.project.odeSession;
        const response =
            await eXeLearning.app.api.getIdevicesBySessionId(odeSessionId);
        let idevices = $exeDevice.buildNestedPages(response.data);

        $exeDevice.sessionIdevices = idevices;

        $exeDevice.number = 0;
        const htmlContent = $exeDevice.generateHtmlFromPagesEdition(idevices);

        $('#informeEPages').empty();
        $('#informeEPages').html(htmlContent);
        $exeDevice.showPages();
    },

    showPages: function () {
        let typeshow = parseInt($('input[name="showtype"]:checked').val());
        $exeDevice.applyTypeShow(typeshow);
    },

    buildNestedPages: function (data) {
        const pageIndex = {};
        const rootPages = [];

        if (!Array.isArray(data)) {
            console.error("El parámetro 'data' debe ser un array.");
            return [];
        }

        data.forEach((row) => {
            if (!row) {
                console.warn(
                    "Se encontró una fila nula o indefinida en 'data'."
                );
                return;
            }

            const rawPageId =
                row.odePageId != null ? String(row.odePageId).trim() : '';
            const rawParentId =
                row.odeParentPageId != null && row.odeParentPageId !== ''
                    ? String(row.odeParentPageId).trim()
                    : null;
            if (!rawPageId) return;

            if (!pageIndex[rawPageId]) {
                const order = Number(row.ode_nav_structure_sync_order) || 0;
                pageIndex[rawPageId] = {
                    id: rawPageId,
                    parentId: rawParentId,
                    title: row.pageName,
                    navId: row.navId,
                    ode_nav_structure_sync_id: row.ode_nav_structure_sync_id,
                    ode_session_id: row.ode_session_id,
                    ode_nav_structure_sync_order: order,
                    navIsActive: row.navIsActive,
                    components: [],
                    children: [],
                    url:
                        !rawParentId && order === 1
                            ? 'index'
                            : $eXeInforme.normalizeFileName(row.pageName),
                };
            }

            if (row.componentId) {
                const dataIDs = $eXeInforme.getEvaluatioID(
                    row.htmlViewer,
                    row.jsonProperties
                );
                const ideviceID = dataIDs.ideviceID || row.ode_idevice_id || '';
                const evaluationID = dataIDs.evaluationID || '';
                const evaluation = dataIDs.evaluation || null;
                pageIndex[rawPageId].components.push({
                    ideviceID: ideviceID,
                    evaluationID: evaluationID,
                    evaluation: evaluation,
                    componentId: row.componentId,
                    ode_pag_structure_sync_id: row.ode_pag_structure_sync_id,
                    componentSessionId: row.componentSessionId,
                    componentPageId: row.componentPageId,
                    ode_block_id: row.ode_block_id,
                    blockName: row.blockName,
                    blockOrder: Number(row.blockOrder) || 0, // ✅ CAMPO AGREGADO
                    ode_idevice_id: row.ode_idevice_id,
                    odeIdeviceTypeName: row.odeIdeviceTypeName,
                    ode_components_sync_order:
                        Number(row.ode_components_sync_order) || 0,
                    componentIsActive: row.componentIsActive,
                });
            }
        });

        // ✅ ORDENAMIENTO CORREGIDO
        Object.values(pageIndex).forEach((p) => {
            if (Array.isArray(p.components) && p.components.length > 1) {
                p.components.sort((a, b) => {
                    // Ordenar primero por blockOrder
                    const orderDiff = (a.blockOrder || 0) - (b.blockOrder || 0);
                    if (orderDiff !== 0) return orderDiff;

                    // Si tienen el mismo blockOrder, usar ode_components_sync_order
                    return (
                        (a.ode_components_sync_order || 0) -
                        (b.ode_components_sync_order || 0)
                    );
                });
            }
        });

        Object.values(pageIndex).forEach((page) => {
            const pid = page.parentId;
            if (pid && pageIndex[pid]) {
                pageIndex[pid].children.push(page);
            } else {
                rootPages.push(page);
            }
        });

        const sortByOrder = (a, b) =>
            a.ode_nav_structure_sync_order - b.ode_nav_structure_sync_order;
        Object.values(pageIndex).forEach((p) => {
            if (Array.isArray(p.children) && p.children.length > 1) {
                p.children.sort(sortByOrder);
            }
        });
        rootPages.sort(sortByOrder);

        return rootPages;
    },

    getEvaluatioID(htmlwiew, idevicejson) {
        let leval = { evaluation: false, ideviceID: '', evaluationID: '' };
        const dataHtml = $exeDevice.extractEvaluationDataHtml(htmlwiew);
        const dataJson = $exeDevice.extractEvaluationDataJSON(idevicejson);
        if (dataHtml) {
            leval.evaluationID = dataHtml.evaluationId;
            leval.ideviceID = dataHtml.dataId;
            leval.evaluation = dataHtml.evaluation;
        } else if (dataJson) {
            leval.evaluationID = dataJson.evaluationId;
            leval.ideviceID = dataJson.dataId;
            leval.evaluation = dataJson.evaluation;
        }
        return leval;
    },

    extractEvaluationDataHtml: function (htmlText) {
        if (htmlText) {
            const match = htmlText.match(
                /data-id="([^"]+)"[^>]*data-evaluationid="([^"]+)"/
            );
            if (match) {
                const evalMatch = htmlText.match(/data-evaluationb="([^"]+)"/);
                return {
                    dataId: match[1],
                    evaluationId: match[2],
                    evaluation:
                        evalMatch === null ||
                        evalMatch[1].toLowerCase() === 'true' ||
                        evalMatch[1].toLowerCase() === '1' ||
                        evalMatch[1].toLowerCase() === 'yes' ||
                        evalMatch[1].toLowerCase() === 'on',
                };
            }
        }
        return false;
    },

    extractEvaluationDataJSON: function (idevicejson) {
        const obj =
            $exeDevices.iDevice.gamification.helpers.isJsonString(idevicejson);
        if (!obj) return false;

        const evaluationId =
            obj.evaluationID ||
            obj.evaluationId ||
            obj['data-evaluationid'] ||
            '';
        const dataId = obj.id || obj.ideviceId || obj.dataId || '';

        let evaluation = null;
        const rawEval =
            typeof obj['data-evaluation'] !== 'undefined'
                ? obj['data-evaluation']
                : typeof obj['data-evaluationb'] !== 'undefined'
                  ? obj['data-evaluationb']
                  : undefined;

        if (typeof rawEval !== 'undefined') {
            const v = String(rawEval).trim().toLowerCase();
            evaluation = v === 'true' || v === '1' || v === 'yes' || v === 'on';
        }

        if (evaluationId && evaluationId.length > 0)
            return { dataId, evaluationId, evaluation };
        return false;
    },

    generateHtmlFromPagesEdition: function (pages) {
        const idEvaluation = $('#informeEEvaluationID').val() || '';
        const showTypeGame = $('#informeEShowTypeGame').val() || false;
        let html = '<ul id="informeEPagesContainer">';
        pages.forEach((page) => {
            let pageHtml = `<li class="IFPE-PageItem" data-page-id="${page.id}">`;
            pageHtml += `<div class="IFPE-PageTitleDiv">
                            <div class="IFPE-PageIcon"></div>
                            <div class="IFPE-PageTitle">${page.title}</div>
                        </div>`;
            let componentsHtml = '';

            if (page.components && page.components.length > 0) {
                componentsHtml += '<ul class="IFPE-Components">';
                page.components.forEach((component) => {
                    const isEvaluable =
                        component.evaluation &&
                        component.evaluationID &&
                        idEvaluation &&
                        idEvaluation == component.evaluationID;
                    const iconClass = isEvaluable
                        ? 'IFPE-IdiviceIcon'
                        : 'IFPE-IdiviceIconNo';
                    const componentScore = isEvaluable
                        ? `<div class="IFPE-ComponentDateScore">
                                <div class="IFPE-ComponentDate"></div>
                                <div class="IFPE-ComponentScore" style="text-align:right:min-width:1em"></div>
                            </div>`
                        : '';
                    const typeIdevice = showTypeGame
                        ? `<div id="informeEType">(${component.odeIdeviceTypeName})</div>`
                        : '';
                    const showLinks = `<div class="IFPE-PageTitleDiv">
                                <div class="IFPE-Icon ${iconClass}"></div>
                                <div class="IFPE-ComponentTitle">${component.blockName || ''}</div>
                                ${typeIdevice}
                            </div>`;
                    componentsHtml += `<li class="IFPE-ComponentItem" data-component-id="${component.ideviceID}" data-is-evaluable="${isEvaluable}">
                                            <div class="IFPE-ComponentData">
                                                ${showLinks}
                                            </div>
                                            ${componentScore}
                                        </li>`;
                    if (isEvaluable) {
                        $exeDevice.number++;
                    }
                });
                componentsHtml += '</ul>';
            }

            let childrenHtml = '';
            if (page.children && page.children.length > 0) {
                childrenHtml = $exeDevice.generateHtmlFromPagesEdition(
                    page.children
                );
            }

            pageHtml += componentsHtml;
            pageHtml += childrenHtml;
            pageHtml += '</li>';

            html += pageHtml;
        });

        html += '</ul>';

        return html;
    },

    applyTypeShow: function (typeshow) {
        const $gameContainer = $('#informeEPagesContainer');
        if (typeshow == 1) {
            $gameContainer.find('.IFPE-ComponentItem').each(function () {
                const isEvaluable = $(this).data('is-evaluable');
                if (!isEvaluable) {
                    $(this).hide();
                } else {
                    $(this).show();
                }
            });
            $gameContainer.find('.IFPE-PageItem').show();
        } else if (typeshow == 2) {
            $gameContainer.find('.IFPE-ComponentItem').each(function () {
                const isEvaluable = $(this).data('is-evaluable');
                if (!isEvaluable) {
                    $(this).hide();
                } else {
                    $(this).show();
                }
            });
            function processPageItem($pageItem) {
                let hasVisibleEvaluableComponents =
                    $pageItem.find(
                        '> ul.IFPE-Components > .IFPE-ComponentItem:visible'
                    ).length > 0;

                $pageItem
                    .children('ul')
                    .not('.IFPE-Components')
                    .children('.IFPE-PageItem')
                    .each(function () {
                        const childHasEvaluable = processPageItem($(this));
                        hasVisibleEvaluableComponents =
                            hasVisibleEvaluableComponents || childHasEvaluable;
                    });

                if (hasVisibleEvaluableComponents) {
                    $pageItem.show();
                } else {
                    $pageItem.hide();
                }

                return hasVisibleEvaluableComponents;
            }

            $gameContainer.children('.IFPE-PageItem').each(function () {
                processPageItem($(this));
            });
        } else {
            $gameContainer.find('.IFPE-ComponentItem').show();
            $gameContainer.find('.IFPE-PageItem').show();
        }
    },

    setMessagesInfo: function () {
        var msgs = this.msgs;
        msgs.msgEProvideID = _('Please provide the ID of this progress report');
    },
    createForm: function () {
        const html = `
        <div id="reportQEIdeviceForm">
            <p class="exe-block-info exe-block-dismissible" style="position:relative">
                ${_('It shows the result of the pupils in the activities linked to their average score.')}
                <a href="https://descargas.intef.es/cedec/exe_learning/Manuales/manual_exe29/informe_de_progreso.html" hreflang="es" target="_blank">${_('Usage Instructions')}</a>
                <a href="#" class="exe-block-close" title="${_('Hide')}"><span class="sr-av">${_('Hide')} </span>×</a>
            </p>
            <div class="exe-form-tab" title="${_('General settings')}">
                <fieldset class="exe-fieldset">
                    <legend><a href="#">${_('Options')}</a></legend>
                    <div>
                        <p class="exe-block-info mb-3">
                            ${_('The ID can be a number or word of more than five characters. You must use the same ID in all the activities you will assess in this progress report.')}
                        </p>
                        <div class="d-flex flex-nowrap align-items-center gap-2 mb-3">
                            <label for="informeEEvaluationID" class="mb-0">${_('Identifier')}:</label>
                            <input type="text" id="informeEEvaluationID" value="${eXeLearning.app.project.odeId || ''}" style="max-width:250px;" class="form-control" />
                            <button id="informeERefresh" class="btn btn-primary" type="button">${_('Refresh pages')}</button>
                        </div>
                        <div class="toggle-item mb-3">
                            <span class="toggle-control">
                                <input type="checkbox" id="informeEShowDate" class="toggle-input" checked />
                                <span class="toggle-visual"></span>
                            </span>
                            <label class="toggle-label mb-0" for="informeEShowDate">${_('Show date and time')}.</label>
                        </div>
                        <div class="toggle-item mb-3">
                            <span class="toggle-control">
                                <input type="checkbox" id="informeEShowTypeGame" class="toggle-input" checked />
                                <span class="toggle-visual"></span>
                            </span>
                            <label class="toggle-label mb-0" for="informeEShowTypeGame">${_('Show type of iDevice')}.</label>
                        </div>
                        <div class="toggle-item mb-3">
                            <span class="toggle-control">
                                <input type="checkbox" id="informeEActiveLinks" class="toggle-input" checked />
                                <span class="toggle-visual"></span>
                            </span>
                            <label class="toggle-label mb-0" for="informeEActiveLinks">${_('Link report activities')}.</label>
                        </div>
                        <div class="toggle-item mb-3">
                            <span class="toggle-control">
                                <input type="checkbox" id="informeEUserData" class="toggle-input" checked />
                                <span class="toggle-visual"></span>
                            </span>
                            <label class="toggle-label mb-0" for="informeEUserData">${_('User data')}.</label>
                        </div>
                        <span class="mb-1">${_('Show')}:</span>
                        <div class="d-flex align-items-center flex-wrap gap-2 mb-3">
                            <div class="form-check form-check-inline d-inline-flex align-items-center">
                                <input type="radio" id="showtype0" name="showtype" class="form-check-input" value="0" checked>
                                <label class="form-check-label mb-0 ms-1" for="showtype0">${_('All pages and iDevices')}</label>
                            </div>
                            <div class="form-check form-check-inline d-inline-flex align-items-center">
                                <input type="radio" id="showtype1" name="showtype" class="form-check-input" value="1">
                                <label class="form-check-label mb-0 ms-1" for="showtype1">${_('All pages and only evaluable iDevices')}</label>
                            </div>
                            <div class="form-check form-check-inline d-inline-flex align-items-center">
                                <input type="radio" id="showtype2" name="showtype" class="form-check-input" value="2">
                                <label class="form-check-label mb-0 ms-1" for="showtype2">${_('Only pages with evaluable activities')}</label>
                            </div>
                        </div>
                        <div class="mb-3">
                            <span><strong>${_('Available iDevices')}:</strong></span>
                            <p id="informeEPages" class="mb-0"></p>
                        </div>
                        <p class="exe-block-info mb-0">
                            ${_('This iDevice is compatible with all game iDevices and all interactive activities.')}
                        </p>
                    </div>
                </fieldset>
            </div>
            ${$exeDevicesEdition.iDevice.gamification.common.getLanguageTab(this.ci18n)}
        </div>
    `;
        this.ideviceBody.innerHTML = html;
        $exeDevice.loadPreviousValues();
        $exeDevicesEdition.iDevice.tabs.init('reportQEIdeviceForm');
    },

    normalizeFileName: function (fileName) {
        const replacements = {
            à: 'a',
            á: 'a',
            â: 'a',
            ã: 'a',
            ä: 'ae',
            å: 'aa',
            æ: 'ae',
            ç: 'c',
            è: 'e',
            é: 'e',
            ê: 'e',
            ë: 'ee',
            ì: 'i',
            í: 'i',
            î: 'i',
            ï: 'i',
            ð: 'dh',
            ñ: 'n',
            ò: 'o',
            ó: 'o',
            ô: 'o',
            õ: 'o',
            ö: 'oe',
            ø: 'oe',
            ù: 'u',
            ú: 'u',
            û: 'u',
            ü: 'ue',
            ý: 'y',
            þ: 'th',
            ÿ: 'y',
            ā: 'aa',
            ă: 'a',
            ą: 'a',
            ć: 'c',
            ĉ: 'c',
            ċ: 'c',
            č: 'ch',
            ď: 'd',
            đ: 'd',
            ē: 'ee',
            ĕ: 'e',
            ė: 'e',
            ę: 'e',
            ě: 'e',
            ĝ: 'g',
            ğ: 'g',
            ġ: 'g',
            ģ: 'g',
            ĥ: 'h',
            ħ: 'hh',
            ĩ: 'i',
            ī: 'ii',
            ĭ: 'i',
            į: 'i',
            ı: 'i',
            ĳ: 'ij',
            ĵ: 'j',
            ķ: 'k',
            ĸ: 'k',
            ĺ: 'l',
            ļ: 'l',
            ľ: 'l',
            ŀ: 'l',
            ł: 'l',
            ń: 'n',
            ņ: 'n',
            ň: 'n',
            ŉ: 'n',
            ŋ: 'ng',
            ō: 'oo',
            ŏ: 'o',
            ő: 'oe',
            œ: 'oe',
            ŕ: 'r',
            ŗ: 'r',
            ř: 'r',
            ś: 's',
            ŝ: 's',
            ş: 's',
            š: 'sh',
            ţ: 't',
            ť: 't',
            ŧ: 'th',
            ũ: 'u',
            ū: 'uu',
            ŭ: 'u',
            ů: 'u',
            ű: 'ue',
            ų: 'u',
            ŵ: 'w',
            ŷ: 'y',
            ź: 'z',
            ż: 'z',
            ž: 'zh',
            ſ: 's',
            ǝ: 'e',
            ș: 's',
            ț: 't',
            ơ: 'o',
            ư: 'u',
            ầ: 'a',
            ằ: 'a',
            ề: 'e',
            ồ: 'o',
            ờ: 'o',
            ừ: 'u',
            ỳ: 'y',
            ả: 'a',
            ẩ: 'a',
            ẳ: 'a',
            ẻ: 'e',
            ể: 'e',
            ỉ: 'i',
            ỏ: 'o',
            ổ: 'o',
            ở: 'o',
            ủ: 'u',
            ử: 'u',
            ỷ: 'y',
            ẫ: 'a',
            ẵ: 'a',
            ẽ: 'e',
            ễ: 'e',
            ỗ: 'o',
            ỡ: 'o',
            ữ: 'u',
            ỹ: 'y',
            ấ: 'a',
            ắ: 'a',
            ế: 'e',
            ố: 'o',
            ớ: 'o',
            ứ: 'u',
            ạ: 'a',
            ậ: 'a',
            ặ: 'a',
            ẹ: 'e',
            ệ: 'e',
            ị: 'i',
            ọ: 'o',
            ộ: 'o',
            ợ: 'o',
            ụ: 'u',
            ự: 'u',
            ỵ: 'y',
            ɑ: 'a',
            ǖ: 'uu',
            ǘ: 'uu',
            ǎ: 'a',
            ǐ: 'i',
            ǒ: 'o',
            ǔ: 'u',
            ǚ: 'uu',
            ǜ: 'uu',
            '&': '-',
        };

        const escapeRegex = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const replacerPattern = new RegExp(
            Object.keys(replacements).map(escapeRegex).join('|'),
            'g'
        );
        const specialPattern = /[¨`@^+¿?\[\]\/\\=<>:;,'"#$*()|~!{}%’«»”“]/g;
        const controlPattern = /[\x00-\x1F\x7F]/g;
        const underscorePattern = /_+/g;
        const dashDotPattern = /[.\-]+/g;
        const trimPattern = /^[.\-]+|[.\-]+$/g;
        if (typeof fileName !== 'string') return '';

        return fileName
            .toLowerCase()
            .replace(replacerPattern, (m) => replacements[m])
            .replace(specialPattern, '')
            .replace(/ /g, '-')
            .replace(underscorePattern, '_')
            .replace(controlPattern, '')
            .replace(dashDotPattern, '-')
            .replace(trimPattern, '');
    },
    loadPreviousValues: function () {
        var originalHTML = this.idevicePreviousData;
        if (originalHTML && Object.keys(originalHTML).length > 0) {
            const wrapper = $('<div></div>');
            wrapper.html(originalHTML);
            const json = $('.informe-DataGame', wrapper).text();
            const dataGame =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);
            $exeDevice.updateFieldGame(dataGame);
            $exeDevicesEdition.iDevice.gamification.common.setLanguageTabValues(
                dataGame.msgs
            );
        }
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
        const dataGame = $exeDevice.validateData();
        if (!dataGame) return false;

        let fields = this.ci18n,
            i18n = fields;
        for (let i in fields) {
            var fVal = $('#ci18n_' + i).val();
            if (fVal != '') i18n[i] = fVal;
        }

        dataGame.msgs = i18n;
        const json = JSON.stringify(dataGame);
        return `<div class="informe-IDevice">
                    <div class="informe-DataGame js-hidden">${json}</div>
                    <div class="informe-bns js-hidden">${$exeDevice.msgs.msgNoSuportBrowser}</div>
                </div>`;
    },

    showMessage: function (msg) {
        eXe.app.alert(msg);
    },

    validateData: function () {
        const evaluationID = $('#informeEEvaluationID').val(),
            showDate = $('#informeEShowDate').is(':checked'),
            showTypeGame = $('#informeEShowTypeGame').is(':checked'),
            activeLinks = $('#informeEActiveLinks').is(':checked'),
            userData = $('#informeEUserData').is(':checked'),
            typeshow = parseInt($('input[name="showtype"]:checked').val());

        if (!evaluationID || evaluationID.length < 5) {
            $exeDevice.showMessage(
                _('The report identifier must have at least 5 characters')
            );
            return false;
        }

        $exeDevice.typeshow = typeshow;

        return {
            typeGame: 'Progress Report',
            typeshow: typeshow,
            evaluationID: evaluationID,
            number: $exeDevice.number,
            showDate: showDate,
            showTypeGame: showTypeGame,
            activeLinks: activeLinks,
            userData: userData,
            sessionIdevices: $exeDevice.sessionIdevices,
        };
    },

    addEvents: function () {
        $('.exe-block-dismissible .exe-block-close').on('click', function () {
            $(this).parent().fadeOut();
            return false;
        });

        $('#informeERefresh').on('click', function () {
            $exeDevice.getIdevicesBySessionId();
        });

        $(document).on('click', 'input[name="showtype"]', function () {
            $exeDevice.showPages();
        });
    },

    updateFieldGame: function (game) {
        game.evaluationID =
            typeof game.evaluationID !== 'undefined' ? game.evaluationID : '';
        game.showDate =
            typeof game.showDate !== 'undefined' ? game.showDate : false;
        game.showTypeGame =
            typeof game.showTypeGame !== 'undefined'
                ? game.showTypeGame
                : false;
        game.activeLinks =
            typeof game.activeLinks !== 'undefined' ? game.activeLinks : false;
        game.userData =
            typeof game.userData === 'undefined' ? false : game.userData;
        $(`input[name="showtype"][value="${game.typeshow}"]`).prop(
            'checked',
            true
        );
        $('#informeEEvaluationID').val(game.evaluationID);
        $('#informeEShowDate').prop('checked', game.showDate);
        $('#informeEShowTypeGame').prop('checked', game.showTypeGame);
        $('#informeEActiveLinks').prop('checked', game.activeLinks);
        $('#informeEUserData').prop('checked', game.userData);
        $exeDevice.typeshow = game.typeshow;
        $exeDevice.showPages();
    },
};
