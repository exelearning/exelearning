/**
 * Inform progress activity (Export)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * Ana María Zamora Moreno
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 *
 */
var $eXeInforme = {
    idevicePath: '',
    options: {},
    isInExe: false,
    data: null,
    dataIDevices: [],
    menusNav: [],

    init: function () {
        this.isInExe = eXe.app.isInExe();

        this.idevicePath = this.isInExe
            ? eXe.app.getIdeviceInstalledExportPath('progress-report')
            : (this.idevicePath = $('.idevice_node.progress-report')
                  .eq(0)
                  .attr('data-idevice-path'));

        this.activities = $('.informe-IDevice');

        if (this.activities.length == 0) {
            $('.informe-IDevice').hide();
            return;
        }

        if (
            !$exeDevices.iDevice.gamification.helpers.supportedBrowser(
                'informe'
            )
        )
            return;

        if ($('#exe-submitButton').length > 0) {
            this.activities.hide();
            if (typeof _ != 'undefined')
                this.activities.before('<p>' + _('Progress report') + '</p>');
            return;
        }

        this.enable();
    },
    loadFromContentXml: function (mOption) {
        const isExeIndex =
            document.documentElement &&
            document.documentElement.id === 'exe-index';
        const rutaContent = isExeIndex ? './content.xml' : '../content.xml';
        fetch(rutaContent)
            .then((response) => response.text())
            .then((xmlString) => {
                const pagesJson = this.parseOdeXmlToJson(xmlString);
                const pagesHtml = this.generateHtmlFromJsonPages(pagesJson);
                $eXeInforme.createTableIdevices(pagesHtml);
                $eXeInforme.updatePages($eXeInforme.options.dataIDevices);
                $eXeInforme.applyTypeShow(mOption.typeshow);
            })
            .catch(() => {
                const $msg = $('#informeNotLocal');
                if ($msg.length) {
                    $msg.show();
                }
            });
    },

    parseOdeXmlToJson: function (xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        const navStructures = xmlDoc.querySelectorAll(
            'odeNavStructures > odeNavStructure'
        );
        const flatPages = [];

        navStructures.forEach((pageNode) => {
            const odePageId =
                pageNode.querySelector('odePageId')?.textContent || '';
            const odeParentPageId =
                pageNode.querySelector('odeParentPageId')?.textContent || null;
            const name = pageNode.querySelector('pageName')?.textContent || '';
            let components = [];

            const pagStructures = pageNode.querySelectorAll(
                'odePagStructures > odePagStructure'
            );
            pagStructures.forEach((pagStruct) => {
                const blockName =
                    pagStruct.querySelector('blockName')?.textContent || '';
                const jsonProp = pagStruct.querySelector('jsonProperties');
                if (
                    jsonProp &&
                    jsonProp.textContent &&
                    jsonProp.textContent.trim().length > 0
                ) {
                    try {
                        const json = JSON.parse(jsonProp.textContent);
                        components.push({
                            odeIdeviceId: json.id || json.ideviceId || '',
                            odeIdeviceTypeName:
                                json.typeGame || json.type || '',
                            blockName: blockName,
                            evaluationID: json['data-evaluationid'] || '',
                            evaluation: json['data-evaluationb'] || null,
                        });
                    } catch (e) {
                        //
                    }
                }

                const odeComponents = pagStruct.querySelectorAll(
                    'odeComponents > odeComponent'
                );
                odeComponents.forEach((comp) => {
                    const ideviceId =
                        comp.querySelector('odeIdeviceId')?.textContent || '';
                    const typeName =
                        comp.querySelector('odeIdeviceTypeName')?.textContent ||
                        '';
                    let evaluationID = '',
                        evaluation = false;

                    const htmlViewNode = comp.querySelector('htmlView');
                    if (htmlViewNode && htmlViewNode.textContent) {
                        const matchId = htmlViewNode.textContent.match(
                            /data-evaluationid\s*=\s*['"]([^'"]+)['"]/
                        );
                        if (matchId && matchId[1]) evaluationID = matchId[1];

                        const matchEval = htmlViewNode.textContent.match(
                            /data-evaluationb(?:\s*=\s*['"]([^'"]*)['"])?/
                        );
                        if (!matchEval || matchEval[1] === 'true')
                            evaluation = true;
                    }

                    components.push({
                        odeIdeviceId: ideviceId,
                        odeIdeviceTypeName: typeName,
                        blockName,
                        evaluationID,
                        evaluation,
                    });
                });
            });

            const filtered = {};
            components.forEach((comp) => {
                const prev = filtered[comp.odeIdeviceId];
                if (!prev) {
                    filtered[comp.odeIdeviceId] = comp;
                } else {
                    if (!prev.evaluationID && comp.evaluationID) {
                        filtered[comp.odeIdeviceId] = comp;
                    } else if (
                        !prev.odeIdeviceTypeName &&
                        comp.odeIdeviceTypeName
                    ) {
                        filtered[comp.odeIdeviceId] = comp;
                    }
                }
            });
            components = Object.values(filtered);

            flatPages.push({
                odePageId,
                id: odePageId,
                name,
                parentID:
                    odeParentPageId && odeParentPageId.trim() !== ''
                        ? odeParentPageId
                        : null,
                children: [],
                components,
            });
        });

        const index = {};
        flatPages.forEach((p) => {
            index[p.odePageId] = p;
        });

        const roots = [];
        flatPages.forEach((p) => {
            if (p.parentID && index[p.parentID]) {
                index[p.parentID].children.push(p);
            } else {
                roots.push(p);
            }
        });

        return roots;
    },

    enable: function () {
        $eXeInforme.loadGame();
    },

    loadGame: function () {
        $eXeInforme.options = {};
        $eXeInforme.activities.each(function (i) {
            if (i == 0) {
                const dl = $('.informe-DataGame', this),
                    mOption = $eXeInforme.loadDataGame(dl);
                $eXeInforme.options = mOption;
                const informe = $eXeInforme.createInterfaceinforme();
                dl.before(informe).remove();
                $eXeInforme.addEvents();
                if (eXe.app.isInExe()) {
                    $eXeInforme.getIdevicesBySessionId(true);
                } else {
                    $eXeInforme.loadFromContentXml(mOption);
                }
            }
        });
    },
    async getIdevicesBySessionId(init) {
        const odeSessionId = eXeLearning.app.project.odeSession;
        const response =
            await eXeLearning.app.api.getIdevicesBySessionId(odeSessionId);
        let idevices = $eXeInforme.buildNestedPages(response.data);
        const pages = $eXeInforme.createPagesHtml(idevices);
        $eXeInforme.createTableIdevices(pages);
        $eXeInforme.updatePages($eXeInforme.options.dataIDevices);
        $eXeInforme.applyTypeShow($eXeInforme.options.typeshow);
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
                    ode_idevice_id: row.ode_idevice_id,
                    odeIdeviceTypeName: row.odeIdeviceTypeName,
                    ode_components_sync_order:
                        Number(row.ode_components_sync_order) || 0,
                    componentIsActive: row.componentIsActive,
                });
            }
        });

        Object.values(pageIndex).forEach((p) => {
            if (Array.isArray(p.components) && p.components.length > 1) {
                p.components.sort(
                    (a, b) =>
                        a.ode_components_sync_order -
                        b.ode_components_sync_order
                );
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
        const dataHtml = $eXeInforme.extractEvaluationDataHtml(htmlwiew);
        const dataJson = $eXeInforme.extractEvaluationDataJSON(idevicejson);
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

    loadDataGame(data) {
        const json = data.text(),
            mOptions =
                $exeDevices.iDevice.gamification.helpers.isJsonString(json);
        const tmpData = $eXeInforme.getDataStorage(mOptions.evaluationID);
        mOptions.dataIDevices = Array.isArray(tmpData) ? tmpData : [];

        mOptions.activeLinks =
            this.isInExe ||
            $('body').hasClass('exe-scorm') ||
            typeof mOptions.activeLinks == 'undefined'
                ? false
                : mOptions.activeLinks;

        return mOptions;
    },

    getURLPage: function (pageId) {
        if (!pageId) return '';

        const url = new URL(window.location.href);

        let base = url.pathname.replace(/\/html(\/.*)?$/i, '');
        base = base.replace(/\/$/, '');

        if (pageId === 'index') {
            url.pathname = `${base}/index.html`;
        } else {
            url.pathname = `${base}/html/${pageId}.html`;
        }

        return url.toString();
    },

    createInterfaceinforme: function () {
        const msgs = $eXeInforme.options.msgs;
        const download = msgs.msgDownload || 'Descargar informe de progreso';
        const localmod =
            msgs.msgLocalMode ||
            'En modo local, los resultados de las actividades realizadas no se pueden mostrar en el informe';
        const html = `<div class="IFPP-MainContainer" >
                        <p id="informeNotLocal" style="display:none">${localmod}<p>
                        <div class="IFPP-GameContainer" id="informeGameContainer">
                            <div id="informeData" class="IFPP-Data" ></div>
                        </div>
                            <a id="informeDownloadLink" href="#" download="imagen.jpg" style="display: none;">${download}</a>
                        </div>
                    </div>`;
        return html;
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

    generateHtmlFromPages: function (pages, acc) {
        const isRootCall = !acc;
        acc = acc || { count: 0 };

        let html = isRootCall
            ? '<ul id="informePagesContainer">'
            : '<ul class="IFPP-Children">';
        let firstRootPending = true;

        pages.forEach((page) => {
            const hasParent = Boolean(page.parentId) || Boolean(page.parentID);
            const pageIdAttr =
                !hasParent && firstRootPending ? 'index' : page.id;
            if (!hasParent && firstRootPending) firstRootPending = false;

            let pageHtml = `<li class="IFPP-PageItem" data-page-id="${pageIdAttr}">`;
            pageHtml += `<div class="IFPP-PageTitleDiv">
                            <div class="IFPP-PageIcon"></div>
                            <div class="IFPP-PageTitle">${page.title}</div>
                        </div>`;
            let componentsHtml = '';

            if (page.components && page.components.length > 0) {
                componentsHtml += '<ul class="IFPP-Components">';
                page.components.forEach((component) => {
                    const surl =
                        $eXeInforme.isInExe || !page.title
                            ? ''
                            : $eXeInforme.getURLPage(page.url) +
                              `#${component.ideviceID}`;
                    const isEvaluable =
                        component.evaluation &&
                        component.evaluationID &&
                        $eXeInforme.options.evaluationID &&
                        $eXeInforme.options.evaluationID ==
                            component.evaluationID;

                    if (isEvaluable) {
                        acc.count += 1;
                    }
                    const iconClass = isEvaluable
                        ? 'IFPP-IdiviceIcon'
                        : 'IFPP-IdiviceIconNo';
                    const componentScore = isEvaluable
                        ? `<div class="IFPP-ComponentDateScore">
                               <div class="IFPP-ComponentDate"></div>
                               <div class="IFPP-ComponentScore" style="text-align:right;min-width:1em"></div>
                           </div>`
                        : '';
                    const typeIdevice = $eXeInforme.options.showTypeGame
                        ? `<div id="informeType">(${component.odeIdeviceTypeName})</div>`
                        : '';

                    const inWeb =
                        !$eXeInforme.isInExe &&
                        location.protocol !== 'file:' &&
                        typeof window.API === 'undefined' &&
                        typeof window.API_1484_11 === 'undefined' &&
                        Boolean($eXeInforme.options?.activeLinks) &&
                        Boolean(isEvaluable) &&
                        typeof surl === 'string' &&
                        surl.length > 4;

                    const showLinks = inWeb
                        ? `<div class="IFPP-PageTitleDiv">
                                <a href="#" class="IFPP-PageTitleDiv IFPP-IdeviceLink" data-page-id="${surl}" data-idevice-id="${component.ideviceID}" title="${$eXeInforme.options.msgs.msgSeeActivity}">
                                    <div class="IFPP-Icon ${iconClass}"></div>
                                    <div class="IFPP-ComponentTitle">${component.blockName || ''}</div>
                                </a>
                                ${typeIdevice}
                            </div>`
                        : `<div class="IFPP-PageTitleDiv">
                                <div class="IFPP-Icon ${iconClass}"></div>
                                <div class="IFPP-ComponentTitle">${component.blockName || ''}</div>
                                ${typeIdevice}
                            </div>`;
                    componentsHtml += `<li class="IFPP-ComponentItem" data-component-id="${component.ideviceID}" data-is-evaluable="${isEvaluable}">
                                            <div class="IFPP-ComponentData">
                                                ${showLinks}
                                            </div>
                                            ${componentScore}
                                        </li>`;
                });
                componentsHtml += '</ul>';
            }

            let childrenHtml = '';
            if (page.children && page.children.length > 0) {
                childrenHtml = $eXeInforme.generateHtmlFromPages(
                    page.children,
                    acc
                );
            }

            pageHtml += componentsHtml;
            pageHtml += childrenHtml;
            pageHtml += '</li>';

            html += pageHtml;
        });
        html += '</ul>';

        if (isRootCall) {
            $eXeInforme.options.number = acc.count;
        }

        $('#informeEvalutationNumber').html(
            $eXeInforme.options.msgs.msgNoPendientes.replace(
                '%s',
                $eXeInforme.options.number
            )
        );

        return html;
    },

    generateHtmlFromJsonPages: function (pages, acc) {
        const isRootCall = !acc;
        acc = acc || { count: 0 };

        let html = '<ul id="informePagesContainer">';
        let pn = true,
            pageId = '';

        pages.forEach((page) => {
            const pId = page.odePageId || page.id || '';
            const pTitle = page.name || page.title || '';
            let pUrl = page.url || $eXeInforme.normalizeFileName(pTitle) || '';
            const hasParent =
                typeof page.parentID != 'undefined' && page.parentID != null;

            if (pn && !hasParent) {
                pUrl = 'index';
                pageId = 'index';
                pn = false;
            } else {
                pageId = pId || '';
            }

            let pageHtml = `<li class="IFPP-PageItem" data-page-id="${pageId}">`;
            pageHtml += `<div class="IFPP-PageTitleDiv">
                        <div class="IFPP-PageIcon"></div>
                        <div class="IFPP-PageTitle">${pTitle}</div>
                     </div>`;

            let componentsHtml = '';
            if (page.components && page.components.length > 0) {
                componentsHtml += '<ul class="IFPP-Components">';

                page.components.forEach((component) => {
                    const ideviceID =
                        component.odeIdeviceId || component.ideviceID || '';
                    const blockName = component.blockName || '';
                    const odeIdeviceTypeName =
                        component.odeIdeviceTypeName || '';
                    const evaluationID = component.evaluationID || '';
                    const evaluation = component.evaluation || false;

                    const surl =
                        $eXeInforme.isInExe || !pTitle
                            ? ''
                            : $eXeInforme.getURLPage(pUrl) + `#${ideviceID}`;

                    const isEvaluable =
                        evaluation &&
                        evaluationID &&
                        $eXeInforme.options.evaluationID &&
                        $eXeInforme.options.evaluationID == evaluationID;

                    if (isEvaluable) {
                        acc.count += 1;
                    }

                    const iconClass = isEvaluable
                        ? 'IFPP-IdiviceIcon'
                        : 'IFPP-IdiviceIconNo';

                    const componentScore = isEvaluable
                        ? `<div class="IFPP-ComponentDateScore">
                           <div class="IFPP-ComponentDate"></div>
                           <div class="IFPP-ComponentScore" style="text-align:right:min-width:1em"></div>
                       </div>`
                        : '';

                    const typeIdevice =
                        $eXeInforme.options.showTypeGame && odeIdeviceTypeName
                            ? `<div id="informeType">(${odeIdeviceTypeName})</div>`
                            : '';

                    const inWeb =
                        !$eXeInforme.isInExe &&
                        location.protocol !== 'file:' &&
                        typeof window.API === 'undefined' &&
                        typeof window.API_1484_11 === 'undefined' &&
                        Boolean($eXeInforme.options?.activeLinks) &&
                        Boolean(isEvaluable) &&
                        typeof surl === 'string' &&
                        surl.length > 4;

                    const showLinks = inWeb
                        ? `<div class="IFPP-PageTitleDiv">
                           <a href="#" class="IFPP-PageTitleDiv IFPP-IdeviceLink" data-page-id="${surl}" data-idevice-id="${ideviceID}" title="${$eXeInforme.options.msgs.msgSeeActivity}">
                               <div class="IFPP-Icon ${iconClass}"></div>
                               <div class="IFPP-ComponentTitle">${blockName}</div>
                           </a>
                           ${typeIdevice}
                       </div>`
                        : `<div class="IFPP-PageTitleDiv">
                           <div class="IFPP-Icon ${iconClass}"></div>
                           <div class="IFPP-ComponentTitle">${blockName}</div>
                           ${typeIdevice}
                       </div>`;

                    componentsHtml += `<li class="IFPP-ComponentItem" data-component-id="${ideviceID}" data-is-evaluable="${isEvaluable}">
                                       <div class="IFPP-ComponentData">
                                           ${showLinks}
                                       </div>
                                       ${componentScore}
                                   </li>`;
                });

                componentsHtml += '</ul>';
            }

            let childrenHtml = '';
            if (page.children && page.children.length > 0) {
                childrenHtml = $eXeInforme.generateHtmlFromJsonPages(
                    page.children,
                    acc
                );
            }

            pageHtml += componentsHtml;
            pageHtml += childrenHtml;
            pageHtml += '</li>';

            html += pageHtml;
        });

        html += '</ul>';

        if (isRootCall) {
            $eXeInforme.options.number = acc.count;
        }

        $('#informeEvalutationNumber').html(
            $eXeInforme.options.msgs.msgNoPendientes.replace(
                '%s',
                $eXeInforme.options.number
            )
        );

        return html;
    },

    applyTypeShow: function (typeshow) {
        const $gameContainer = $('#informePagesContainer');
        if (typeshow == 1) {
            $gameContainer.find('.IFPP-ComponentItem').each(function () {
                const isEvaluable = $(this).data('is-evaluable');
                if (!isEvaluable) {
                    $(this).hide();
                } else {
                    $(this).show();
                }
            });
            $gameContainer.find('.IFPP-PageItem').show();
        } else if (typeshow == 2) {
            $gameContainer.find('.IFPP-ComponentItem').each(function () {
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
                        '> ul.IFPP-Components > .IFPP-ComponentItem:visible'
                    ).length > 0;

                $pageItem.find('> ul > .IFPP-PageItem').each(function () {
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

            $gameContainer.children('.IFPP-PageItem').each(function () {
                processPageItem($(this));
            });
        } else {
            $gameContainer.find('.IFPP-ComponentItem').show();
            $gameContainer.find('.IFPP-PageItem').show();
        }
    },

    formatNumber: function (num) {
        if (typeof num !== 'number' || isNaN(num)) return 0;
        return Number.isInteger(num) ? num : num.toFixed(2);
    },

    updatePages: function (data) {
        let completed = 0;
        let score = 0;
        let date = '';
        if (data) {
            data.forEach((idevice) => {
                let $idevice = $('#informeGameContainer').find(
                    `.IFPP-ComponentItem[data-component-id="${idevice.id}"]`
                );
                if ($idevice.length === 1) {
                    completed++;
                    let sp = parseFloat(idevice.score) || 0;
                    score += sp;
                    date = idevice.date;
                    $idevice.find('.IFPP-ComponentDate').text(date);
                    $idevice
                        .find('.IFPP-ComponentScore')
                        .text($eXeInforme.formatNumber(sp));

                    let bgc = sp < 5 ? '#B61E1E' : '#007F5F';
                    let icon =
                        sp < 5
                            ? 'IFPP-IdiviceIconFail'
                            : 'IFPP-IdiviceIconPass';
                    $idevice
                        .find('.IFPP-Icon')
                        .removeClass(
                            'IFPP-IdiviceIconFail IFPP-IdiviceIconPass IFPP-IdiviceIcon'
                        )
                        .addClass(icon);
                    $idevice.find('.IFPP-ComponentScore').css({ color: bgc });
                }
            });
        }

        let scorepartial = completed > 0 ? score / completed : 0;
        scorepartial = $eXeInforme.formatNumber(scorepartial);

        let scoretotal = score / $eXeInforme.options.number;
        scoretotal = $eXeInforme.formatNumber(scoretotal);

        let bgc = scoretotal < 5 ? '#B61E1E' : '#007F5F';
        $('#informeTotalActivities').text(
            $eXeInforme.options.msgs.mssActivitiesNumber.replace(
                '%s',
                $eXeInforme.options.number
            )
        );
        $('#informeCompletedActivities').text(
            $eXeInforme.options.msgs.msgActivitiesCompleted.replace(
                '%s',
                completed
            )
        );

        $('#informeTotalScore').text(
            $eXeInforme.options.msgs.msgAverageScore1.replace('%s', scoretotal)
        );
        $('#informeTotalScoreA').text(
            $eXeInforme.options.msgs.msgAverageScoreCompleted.replace(
                '%s',
                scorepartial
            )
        );

        $('#informeScoretTotal').text(scoretotal);
        $('#informeScoreBar').css({ 'background-color': bgc });
    },

    createPagesHtml: function (idevices) {
        let pages =
            $eXeInforme.options.msgs.msgReload ||
            'Edita este idevice para actualizar sus contenidos';
        if (idevices) {
            pages = $eXeInforme.generateHtmlFromPages(idevices);
        }
        return pages;
    },

    createTableIdevices: function (pages) {
        let userDisplay = $eXeInforme.options.userData ? 'flex' : 'none';
        let table = `
            <div class="IFPP-Table" id="informeTable">
                <div id="informeTitleProyect" class="IFPP-Title">
                    ${$eXeInforme.options.msgs.msgReportTitle}
                </div>
                <div id="informeUserData" class="IFPP-UserData" style="display:${userDisplay};">
                    <div id="informeUserNameDiv" class="IFPP-UserName">
                        <label for="informeUserName">${$eXeInforme.options.msgs.msgName}: </label>
                        <input type="text" id="informeUserName">
                    </div>
                    <div id="informeUserDateDiv" class="IFPP-UserDate">
                        <label for="informeUserDate">${$eXeInforme.options.msgs.msgDate}: </label>
                        <input type="text" id="informeUserDate" disabled>
                    </div>
                </div>
                <div class="IFPP-Header">
                    <div id="informeTotalActivities"></div>
                    <div id="informeCompletedActivities"></div>
                    <div id="informeTotalScoreA"></div>
                    <div id="informeTotalScore"></div>
                </div>
                <div id="informePlusDiv" class="IFPP-Plus">
                    <div>${$eXeInforme.options.msgs.mgsSections}:</div>
                        <div class="IFPP-PagesContainer">${pages}</div>
                        <div id="informeScoreBar"class="IFPP-GameScore">
                            <div>${$eXeInforme.options.msgs.msgAverageScore}</div>
                            <div id="informeScoretTotal"></div>
                        </div>
                    </div>
                    <div id="informeButtons" class="IFPP-LinksInforme" style="background-color:white; text-align:right">
                        <button id="informeReboot" type="button" class="btn btn-primary">${$eXeInforme.options.msgs.msgReboot}</button>
                        <button id="informeCapture" type="button" class="btn btn-primary">${$eXeInforme.options.msgs.msgSave}</button>
                    </div>
                </div>`;

        $('#informeData').empty();
        $('#informeData').append(table);
        $('#informeUserDate').val($eXeInforme.getDateNow());
    },

    getDataStorage: function (id) {
        const key = 'dataEvaluation-' + id;
        const parsed = $exeDevices.iDevice.gamification.helpers.isJsonString(
            localStorage.getItem(key)
        );
        return parsed && Array.isArray(parsed.activities)
            ? parsed.activities
            : [];
    },

    addEvents: function () {
        const $c = $('#informeGameContainer');

        $c.on('click', '#informeLinkPlus', function (e) {
            e.preventDefault();
            $('#informePlusDiv').slideToggle();
        });

        $c.on('click', '#informeReboot', function (e) {
            e.preventDefault();
            if (confirm($eXeInforme.options.msgs.msgDelete)) {
                localStorage.removeItem(
                    'dataEvaluation-' + $eXeInforme.options.evaluationID
                );
                $eXeInforme.options.dataIDevices = [];
                if (eXe.app.isInExe()) {
                    $eXeInforme.getIdevicesBySessionId(false);
                } else {
                    $eXeInforme.loadFromContentXml($eXeInforme.options);
                }
            }
        });

        $c.on('click', '#informeCapture', function (e) {
            e.preventDefault();
            $eXeInforme.saveReport();
        });

        $c.on('click', '.IFPP-IdeviceLink', function (e) {
            e.preventDefault();
            const url = $(this).data('page-id');
            const idevice = $(this).data('idevice-id');
            if (!url || !idevice) return;
            localStorage.setItem('hashScrolled', idevice);
            try {
                window.location.href = url;
            } catch (_) {}
        });

        window.addEventListener('gamification-evaluation-saved', function (ev) {
            const d = ev && ev.detail ? ev.detail : null;
            if (!d) return;
            const targetEval = $eXeInforme?.options?.evaluationID;
            const eventEval = d.evaluationID || d.evaluationId;
            if (
                !targetEval ||
                !eventEval ||
                String(targetEval) !== String(eventEval)
            )
                return;

            const data = $eXeInforme.updateIdevicesData(d);
            $eXeInforme.updatePages(data);
        });
    },
    updateIdevicesData: function (detail) {
        try {
            if (!detail) return this.dataIDevices || [];
            const ideviceId = String(detail.ideviceId || detail.id || '');
            if (!ideviceId) return this.dataIDevices || [];

            const rawScore = parseFloat(detail.score);
            const score = isNaN(rawScore) ? 0 : rawScore;
            const now = this.getDateNow();
            const state =
                typeof detail.state !== 'undefined' ? detail.state : undefined;
            const ideviceType = detail.ideviceType || '';

            if (!Array.isArray(this.dataIDevices)) this.dataIDevices = [];

            const idx = this.dataIDevices.findIndex(
                (x) => String(x.id) === ideviceId
            );
            if (idx >= 0) {
                this.dataIDevices[idx].score = score;
                this.dataIDevices[idx].date = now;
                if (state !== undefined) this.dataIDevices[idx].state = state;
                if (ideviceType)
                    this.dataIDevices[idx].ideviceType = ideviceType;
            } else {
                this.dataIDevices.push({
                    id: ideviceId,
                    score: score,
                    date: now,
                    state: state,
                    ideviceType: ideviceType,
                });
            }
            return this.dataIDevices;
        } catch (e) {
            console.error('updateIdevicesData error:', e);
            return this.dataIDevices || [];
        }
    },
    saveReport: function () {
        if ($eXeInforme.options.userData) {
            if ($('#informeUserName').val().trim() === '') {
                var msg =
                    $eXeInforme.options.msgs.msgNotCompleted +
                    ': ' +
                    $eXeInforme.options.msgs.msgName;
                alert(msg);
                return;
            }
        }
        var divElement = document.getElementById('informeTable');
        if (!divElement) {
            console.error(
                'No se encontró el elemento con el ID proporcionado.'
            );
            return;
        }
        $('#informeButtons').hide();
        html2canvas(divElement)
            .then(function (canvas) {
                const imgData = canvas.toDataURL('image/png');
                const fileBase =
                    $eXeInforme.options.msgs.msgReport || 'informe';
                const doPdf = function () {
                    try {
                        if (!(window.jspdf && window.jspdf.jsPDF)) return false;
                        const { jsPDF } = window.jspdf;
                        const pdf = new jsPDF({
                            orientation: 'p',
                            unit: 'mm',
                            format: 'a4',
                        });
                        const pageWidth = pdf.internal.pageSize.getWidth();
                        const pageHeight = pdf.internal.pageSize.getHeight();
                        const imgWidth = pageWidth;
                        const imgProps = {
                            width: canvas.width,
                            height: canvas.height,
                        };
                        const imgHeight =
                            (imgProps.height * imgWidth) / imgProps.width;
                        let y = 0;
                        const pageCanvas = document.createElement('canvas');
                        const ctx = pageCanvas.getContext('2d');
                        const ratio = imgWidth / imgProps.width;
                        pageCanvas.width = imgProps.width;
                        pageCanvas.height = Math.min(
                            imgProps.height,
                            Math.round(pageHeight / ratio)
                        );

                        let sY = 0;
                        while (sY < imgProps.height) {
                            const sliceHeight = Math.min(
                                pageCanvas.height,
                                imgProps.height - sY
                            );
                            pageCanvas.height = sliceHeight;
                            ctx.clearRect(
                                0,
                                0,
                                pageCanvas.width,
                                pageCanvas.height
                            );
                            ctx.drawImage(
                                canvas,
                                0,
                                sY,
                                pageCanvas.width,
                                sliceHeight,
                                0,
                                0,
                                pageCanvas.width,
                                sliceHeight
                            );
                            const sliceData = pageCanvas.toDataURL('image/png');
                            const sliceHeightMM = sliceHeight * ratio;
                            if (y > 0) pdf.addPage();
                            pdf.addImage(
                                sliceData,
                                'PNG',
                                0,
                                0,
                                imgWidth,
                                sliceHeightMM
                            );
                            sY += sliceHeight;
                            y += sliceHeightMM;
                        }
                        pdf.save(fileBase + '.pdf');
                        return true;
                    } catch (e) {
                        console.error('PDF generation error:', e);
                        return false;
                    }
                };

                const fallbackPng = function () {
                    try {
                        const link = document.createElement('a');
                        link.href = imgData;
                        link.download = fileBase + '.png';
                        link.click();
                    } catch (e) {
                        console.error('PNG download error:', e);
                    }
                };

                if (window.jspdf && window.jspdf.jsPDF) {
                    if (!doPdf()) fallbackPng();
                } else {
                    $eXeInforme.ensureJsPDF(
                        () => {
                            if (!doPdf()) fallbackPng();
                        },
                        () => fallbackPng()
                    );
                }
            })
            .catch(function (error) {
                $('#informeButtons').show();
                console.error('Error al generar la captura: ', error);
            })
            .finally(function () {
                $('#informeButtons').show();
            });
    },

    showMessage: function (type, message) {
        var colors = [
                '#555555',
                $eXeInforme.borderColors.red,
                $eXeInforme.borderColors.green,
                $eXeInforme.borderColors.blue,
                $eXeInforme.borderColors.yellow,
            ],
            color = colors[type];
        $('#informePAuthor-' + instance).text(message);
        $('#informePAuthor-' + instance).css({
            color: color,
        });
    },

    getDateNow: function () {
        var dateNow = new Date();
        var dia = $eXeInforme.addZero(dateNow.getDate());
        var mes = $eXeInforme.addZero(dateNow.getMonth() + 1);
        var anio = dateNow.getFullYear();
        var hora = $eXeInforme.addZero(dateNow.getHours());
        var minutos = $eXeInforme.addZero(dateNow.getMinutes());
        var segundos = $eXeInforme.addZero(dateNow.getSeconds());

        return (
            dia +
            '/' +
            mes +
            '/' +
            anio +
            ' ' +
            hora +
            ':' +
            minutos +
            ':' +
            segundos
        );
    },

    addZero: function (number) {
        return number < 10 ? '0' + number : number;
    },

    ensureJsPDF: function (onReady, onError) {
        try {
            if (window.jspdf && window.jspdf.jsPDF) {
                onReady();
                return;
            }
        } catch (_) {}
        const scriptId = 'jspdf-umd-loader';
        if (document.getElementById(scriptId)) {
            let tries = 0;
            const iv = setInterval(() => {
                tries++;
                if (window.jspdf && window.jspdf.jsPDF) {
                    clearInterval(iv);
                    onReady();
                } else if (tries > 50) {
                    clearInterval(iv);
                    onError && onError();
                }
            }, 100);
            return;
        }
        const s = document.createElement('script');
        s.id = scriptId;
        s.src = 'https://cdn.jsdelivr.net/npm/jspdf/dist/jspdf.umd.min.js';
        s.async = true;
        s.onload = function () {
            onReady();
        };
        s.onerror = function () {
            onError && onError();
        };
        document.head.appendChild(s);
    },
};
$(function () {
    $eXeInforme.init();
});
