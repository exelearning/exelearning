/* eslint-disable no-undef */
/**
 * DigCompEdu iDevice (edition mode)
 *
 * Provides a management interface to browse, filter, and select indicators
 * from the DigCompEdu framework while generating a reusable summary.
 */
var $exeDevice = {
    name: _('DigCompEdu: Digital Competence Manager'),

    prefix: 'digcompedu',
    dataLangSelectId: 'digcompeduFrameworkSelector',
    granularityFieldsetId: 'digcompeduGranularity',
    granularityName: 'digcompeduGranularity',
    displayModeName: 'digcompeduDisplayMode',
    levelFilterClass: 'digcompedu-level-filter',
    searchInputId: 'digcompeduSearch',
    tableBodyId: 'digcompeduTableBody',
    summaryTablePreviewId: 'digcompeduSummaryTablePreview',
    summaryTextPreviewId: 'digcompeduSummaryTextPreview',
    fullscreenOverlayId: 'digcompeduFullscreenOverlay',
    fullscreenTriggerId: 'digcompeduFullscreenTrigger',
    fullscreenCloseId: 'digcompeduFullscreenClose',
    modalId: 'digcompeduSummaryModal',
    modalCloseId: 'digcompeduSummaryModalClose',
    modalDismissId: 'digcompeduSummaryModalDismiss',
    modalOpenId: 'digcompeduPreviewSummary',
    resetButtonId: 'digcompeduResetSelection',
    displayModeTableId: 'digcompeduDisplayTable',
    displayModeTableSummaryId: 'digcompeduDisplayTableSummary',
    selectionCounterId: 'digcompeduSelectionCounter',

    defaultLang: 'es',
    levelOrder: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    jsonPathTemplate: '../data/digcompedu_{lang}.json',

    ideviceBody: null,
    idevicePreviousData: null,
    frameworkData: null,
    indicatorLookup: null,
    rowsData: null,
    selectedIds: null,
    activeLang: null,
    selectionGranularity: 'indicator',
    frameworkHasIndicators: false,
    levelLookup: null,
    competenceLookup: null,
    summaryTableHtml: '',
    summaryTextHtml: '',
    fullscreenPreviousFocus: null,
    modalPreviousFocus: null,
    fullscreenPlaceholder: null,
    editionBasePath: null,
    dataLoadPromises: {},
    frameworkDataCache: {},

    /**
     * Initialize editor with previous data if available.
     * @param {HTMLElement} element
     * @param {Object} previousData
     */
    init: function (element, previousData) {
        this.ideviceBody = element;
        this.idevicePreviousData = previousData || {};
        this.selectedIds = new Set(
            Array.isArray(this.idevicePreviousData.digcompeduSelected)
                ? this.idevicePreviousData.digcompeduSelected
                : []
        );
        this.selectionGranularity =
            this.idevicePreviousData.digcompeduGranularity || 'indicator';
        this.activeLang =
            this.idevicePreviousData.digcompeduDataLang || this.defaultLang;
        this.summaryTableHtml =
            this.idevicePreviousData.digcompeduSummaryTableHtml || '';
        this.summaryTextHtml =
            this.idevicePreviousData.digcompeduSummaryTextHtml || '';

        this.loadFrameworkData(this.activeLang)
            .then((data) => {
                this.frameworkData = data;
                this.prepareLookupStructures();
                this.ensureGranularityCompatibility();
                this.createForm();
                this.renderTable();
                this.restoreInterfaceState();
                this.updateSelectionCounter();
                this.updateSummaryPreview();
            })
            .catch((error) => {
                console.error('DigCompEdu data loading failed:', error);
                this.ideviceBody.innerHTML = `
                    <div class="digcompedu-editor">
                        <p class="digcompedu-error">${_('Framework data could not be loaded. Please verify the data file is available.')}</p>
                    </div>`;
            });
    },

    /**
     * Persist the current editor state.
     * @returns {Object|boolean}
     */
    save: function () {
        if (!this.frameworkData) {
            eXe.app.alert(_('Framework data is still loading. Please wait.'));
            return false;
        }

        const displayMode = this.getDisplayModeValue();
        const langSelect = this.ideviceBody.querySelector(
            `#${this.dataLangSelectId}`
        );
        const dataLang = langSelect ? langSelect.value : this.defaultLang;

        if (!this.summaryTableHtml || !this.summaryTextHtml) {
            const summary = this.generateSummaryContent();
            this.summaryTableHtml = summary.tableHtml;
            this.summaryTextHtml = summary.textHtml;
        }

        const data = {
            ideviceId: this.ideviceBody.getAttribute('idevice-id'),
            digcompeduSelected: Array.from(this.selectedIds),
            digcompeduDisplayMode: displayMode,
            digcompeduDataLang: dataLang,
            digcompeduGranularity: this.selectionGranularity,
            digcompeduSummaryTableHtml: this.summaryTableHtml,
            digcompeduSummaryTextHtml: this.summaryTextHtml,
        };

        return data;
    },

    /**
     * Load DigCompEdu framework data as JSON.
     * @param {string} lang
     * @returns {Promise<Object>}
     */
    loadFrameworkData: function (lang) {
        if (this.frameworkDataCache[lang]) {
            return Promise.resolve(
                this.cloneFrameworkData(this.frameworkDataCache[lang])
            );
        }

        if (this.dataLoadPromises[lang]) {
            return this.dataLoadPromises[lang].then((data) =>
                this.cloneFrameworkData(data)
            );
        }

        const url = this.resolveEditionResource(
            this.jsonPathTemplate.replace('{lang}', lang)
        );

        const loadViaXHR = () =>
            new Promise((resolve, reject) => {
                if (typeof XMLHttpRequest === 'undefined') {
                    reject(
                        new Error(
                            'XMLHttpRequest is not available in this environment.'
                        )
                    );
                    return;
                }
                const request = new XMLHttpRequest();
                request.open('GET', url, true);
                if (typeof request.overrideMimeType === 'function') {
                    request.overrideMimeType('application/json');
                }
                request.onreadystatechange = function () {
                    if (request.readyState !== 4) {
                        return;
                    }
                    if (
                        (request.status >= 200 && request.status < 300) ||
                        request.status === 0
                    ) {
                        try {
                            resolve(JSON.parse(request.responseText));
                        } catch (parseError) {
                            reject(parseError);
                        }
                    } else {
                        reject(
                            new Error(
                                `Failed to load ${url}: ${request.status}`
                            )
                        );
                    }
                };
                request.onerror = function () {
                    reject(new Error(`Network error while loading ${url}`));
                };
                request.send();
            });

        const shouldUseFetch =
            typeof fetch === 'function' &&
            (typeof window === 'undefined' ||
                !window.location ||
                window.location.protocol !== 'file:');

        const fetchPromise = shouldUseFetch
            ? fetch(url, { cache: 'no-cache' })
                  .then((response) => {
                      if (!response.ok) {
                          throw new Error(
                              `Failed to load ${response.url || url}: ${response.status}`
                          );
                      }
                      return response.json();
                  })
                  .catch((error) => {
                      if (typeof XMLHttpRequest === 'function') {
                          return loadViaXHR().catch((xhrError) => {
                              throw xhrError || error;
                          });
                      }
                      throw error;
                  })
            : loadViaXHR();

        this.dataLoadPromises[lang] = fetchPromise
            .then((data) => {
                this.frameworkDataCache[lang] = data;
                return data;
            })
            .catch((error) => {
                delete this.dataLoadPromises[lang];
                throw error;
            });

        return this.dataLoadPromises[lang].then((data) =>
            this.cloneFrameworkData(data)
        );
    },

    /**
     * Build lookup maps to speed up rendering and grouping.
     */
    prepareLookupStructures: function () {
        this.indicatorLookup = {};
        this.rowsData = [];
        this.levelLookup = {};
        this.competenceLookup = {};
        this.frameworkHasIndicators = false;

        const frameworkAreas = this.frameworkData.digcompedu || [];
        frameworkAreas.forEach((area) => {
            const areaNumber = area.area;
            const areaTitle = area.title;

            (area.competences || []).forEach((competence) => {
                const competenceCode = String(competence.competence);
                const competenceTitle = competence.title;
                const competenceIndex =
                    this.obtainCompetenceIndex(competenceCode);
                const competenceId = this.composeCompetenceId(competenceCode);

                (competence.stages || []).forEach((stage) => {
                    const stageCode = stage.stage;
                    const stageTitle = stage.title || '';

                    (stage.levels || []).forEach((level) => {
                        const levelCode = level.nivel;
                        const levelTitle = level.title || '';
                        const performanceStatement =
                            level.performance_statements || '';
                        const levelExamples = Array.isArray(level.examples)
                            ? level.examples
                            : [];
                        const levelId = this.composeLevelId(
                            competenceCode,
                            levelCode
                        );
                        const groupKey = `${areaNumber}::${competenceCode}::${levelCode}`;

                        const indicators = Array.isArray(
                            level.achievement_indicators
                        )
                            ? level.achievement_indicators.filter(Boolean)
                            : [];

                        if (indicators.length > 0) {
                            this.frameworkHasIndicators = true;
                            indicators.forEach((indicator) => {
                                const indicatorNumber = indicator.indicator;
                                const indicatorTitle = indicator.title || '';
                                const entryId = this.composeIndicatorId(
                                    competenceCode,
                                    levelCode,
                                    indicatorNumber
                                );

                                const entry = {
                                    entryId,
                                    type: 'indicator',
                                    areaNumber,
                                    areaTitle,
                                    competenceCode,
                                    competenceTitle,
                                    competenceIndex,
                                    competenceId,
                                    stageCode,
                                    stageTitle,
                                    levelCode,
                                    levelTitle,
                                    levelId,
                                    performanceStatement,
                                    levelExamples,
                                    indicatorNumber,
                                    indicatorTitle,
                                    groupKey,
                                };

                                entry.searchIndex =
                                    this.composeSearchIndex(entry);
                                this.rowsData.push(entry);
                                this.indicatorLookup[entryId] = entry;
                                this.registerLookupEntry(
                                    levelId,
                                    competenceId,
                                    entryId
                                );
                            });
                        } else {
                            const entryId = levelId;

                            const entry = {
                                entryId,
                                type: 'level',
                                areaNumber,
                                areaTitle,
                                competenceCode,
                                competenceTitle,
                                competenceIndex,
                                competenceId,
                                stageCode,
                                stageTitle,
                                levelCode,
                                levelTitle,
                                levelId,
                                performanceStatement,
                                levelExamples,
                                indicatorNumber: null,
                                indicatorTitle: '',
                                groupKey,
                            };

                            entry.searchIndex = this.composeSearchIndex(entry);
                            this.rowsData.push(entry);
                            this.indicatorLookup[entryId] = entry;
                            this.registerLookupEntry(
                                levelId,
                                competenceId,
                                entryId
                            );
                        }
                    });
                });
            });
        });
    },

    /**
     * Determine competence index within its area.
     * @param {string} competenceCode
     * @returns {string}
     */
    obtainCompetenceIndex: function (competenceCode) {
        const parts = competenceCode.split('.');
        return parts.length > 1 ? parts[1] : parts[0];
    },

    /**
     * Compose a normalized competence identifier.
     * @param {string} competenceCode
     * @returns {string}
     */
    composeCompetenceId: function (competenceCode) {
        const normalizedCompetence = String(competenceCode).replace('.', '');
        return `C${normalizedCompetence}`;
    },

    /**
     * Compose a deterministic level identifier.
     * @param {string} competenceCode
     * @param {string} levelCode
     * @returns {string}
     */
    composeLevelId: function (competenceCode, levelCode) {
        return `${this.composeCompetenceId(competenceCode)}.${levelCode}`;
    },

    /**
     * Compose a deterministic indicator identifier.
     * @param {string} competenceCode
     * @param {string} levelCode
     * @param {number|string} indicatorNumber
     * @returns {string}
     */
    composeIndicatorId: function (competenceCode, levelCode, indicatorNumber) {
        return `${this.composeLevelId(competenceCode, levelCode)}.I${indicatorNumber}`;
    },

    /**
     * Build a searchable index string for a row.
     * @param {Object} entry
     * @returns {string}
     */
    composeSearchIndex: function (entry) {
        const parts = [
            entry.areaTitle,
            entry.competenceTitle,
            entry.stageCode,
            entry.stageTitle,
            entry.levelCode,
            entry.levelTitle,
            entry.performanceStatement,
            (entry.levelExamples || []).join(' '),
        ];

        if (
            entry.indicatorNumber !== null &&
            entry.indicatorNumber !== undefined
        ) {
            parts.push(String(entry.indicatorNumber));
        }
        if (entry.indicatorTitle) {
            parts.push(entry.indicatorTitle);
        }

        return this.removeDiacritics(
            parts.filter(Boolean).join(' ').toLowerCase()
        );
    },

    /**
     * Register entry identifiers within competence and level lookup tables.
     * @param {string} levelId
     * @param {string} competenceId
     * @param {string} entryId
     */
    registerLookupEntry: function (levelId, competenceId, entryId) {
        if (!this.levelLookup[levelId]) {
            this.levelLookup[levelId] = [];
        }
        if (this.levelLookup[levelId].indexOf(entryId) === -1) {
            this.levelLookup[levelId].push(entryId);
        }

        if (!this.competenceLookup[competenceId]) {
            this.competenceLookup[competenceId] = [];
        }
        if (this.competenceLookup[competenceId].indexOf(entryId) === -1) {
            this.competenceLookup[competenceId].push(entryId);
        }
    },

    /**
     * Extract associated level identifier from any stored entry identifier.
     * @param {string} entryId
     * @returns {string}
     */
    extractLevelIdFromEntryId: function (entryId) {
        if (!entryId) {
            return '';
        }
        const indicatorSeparator = entryId.indexOf('.I');
        return indicatorSeparator === -1
            ? entryId
            : entryId.substring(0, indicatorSeparator);
    },

    /**
     * Ensure current granularity configuration is valid for the loaded framework.
     */
    ensureGranularityCompatibility: function () {
        const allowed = ['competence', 'level', 'indicator'];
        if (allowed.indexOf(this.selectionGranularity) === -1) {
            this.selectionGranularity = this.frameworkHasIndicators
                ? 'indicator'
                : 'level';
        }

        if (
            !this.frameworkHasIndicators &&
            this.selectionGranularity === 'indicator'
        ) {
            this.selectionGranularity = 'level';
        }
    },

    /**
     * Render the editor form structure.
     */
    createForm: function () {
        const filters = this.renderFiltersMarkup();
        const actions = this.renderActionsMarkup();
        const modal = this.renderModalMarkup();
        const fullscreen = this.renderFullscreenMarkup();

        this.ideviceBody.innerHTML = `
            <div class="digcompedu-editor" data-lang="${this.activeLang}">
                <div class="digcompedu-layout">
                    <section class="digcompedu-panel" aria-label="${_('DigCompEdu framework viewer')}">
                        <header class="digcompedu-table-header">
                            <h3>${_('DigCompEdu framework')}</h3>
                            <p class="digcompedu-toolbar-tip">${_('Use filters, search, or fullscreen to explore the framework. Indicators remain selected while filtering.')}</p>
                        </header>
                        <div class="digcompedu-table-wrapper" role="region" aria-live="polite">
                            <table class="digcompedu-table" aria-describedby="${this.selectionCounterId}">
                                <colgroup>
                                    <col class="digcompedu-col-area">
                                    <col class="digcompedu-col-competence">
                                    <col class="digcompedu-col-stage">
                                    <col class="digcompedu-col-level">
                                    <col class="digcompedu-col-indicator">
                                    <col class="digcompedu-col-performance">
                                </colgroup>
                                <thead>
                                    <tr>
                                        <th scope="col">${_('Area')}</th>
                                        <th scope="col">${_('Competence')}</th>
                                        <th scope="col">${_('Stage')}</th>
                                        <th scope="col">${_('Level')}</th>
                                        <th scope="col">${_('Indicator')}</th>
                                        <th scope="col" class="digcompedu-performance-col">${_('Performance and examples')}</th>
                                    </tr>
                                </thead>
                                <tbody id="${this.tableBodyId}"></tbody>
                            </table>
                        </div>
                        <p id="${this.selectionCounterId}" class="digcompedu-flash" aria-live="polite"></p>
                    </section>
                    <aside class="digcompedu-panel" aria-label="${_('DigCompEdu settings')}">
                        ${filters}
                        ${actions}
                    </aside>
                </div>
                ${modal}
                ${fullscreen}
            </div>
        `;

        this.attachBehaviour();
    },

    /**
     * Build filters and options markup.
     * @returns {string}
     */
    renderFiltersMarkup: function () {
        const displayMode =
            this.idevicePreviousData.digcompeduDisplayMode || 'table';
        const frameworkOptions = `
            <option value="es"${this.activeLang === 'es' ? ' selected' : ''}>${_('Español (MRCDD detallado)')}</option>
            <option value="en"${this.activeLang === 'en' ? ' selected' : ''}>${_('English (DigCompEdu core)')}</option>
        `;

        return `
            <section class="digcompedu-filters" aria-label="${_('Display options')}">
                <div class="digcompedu-filter-group" role="group" aria-label="${_('Display mode')}">
                    <label>
                        <input type="radio" name="${this.displayModeName}" id="${this.displayModeTableId}" value="table"${displayMode === 'table' ? ' checked' : ''}>
                        ${_('Table only')}
                    </label>
                    <label>
                        <input type="radio" name="${this.displayModeName}" id="${this.displayModeTableSummaryId}" value="table+summary"${displayMode === 'table+summary' ? ' checked' : ''}>
                        ${_('Table + textual summary')}
                    </label>
                </div>
                <div class="digcompedu-selector-group">
                    <label for="${this.dataLangSelectId}">${_('Competency framework')}</label>
                    <select id="${this.dataLangSelectId}">
                        ${frameworkOptions}
                    </select>
                </div>
                <fieldset class="digcompedu-filter-group digcompedu-granularity" aria-labelledby="${this.granularityFieldsetId}Legend">
                    <legend id="${this.granularityFieldsetId}Legend">${_('Selection granularity')}</legend>
                    ${this.renderGranularityOption('competence', _('Competences'))}
                    ${this.renderGranularityOption('level', _('Levels'))}
                    ${this.renderGranularityOption('indicator', _('Indicators'), !this.frameworkHasIndicators)}
                </fieldset>
                <div class="digcompedu-search">
                    <label for="${this.searchInputId}">${_('Search indicators')}</label>
                    <input type="search" id="${this.searchInputId}" placeholder="${_('Search by area, competence, indicator...')}">
                </div>
                <fieldset class="digcompedu-filter-group" aria-labelledby="digcompeduLevelFiltersLegend">
                    <legend id="digcompeduLevelFiltersLegend">${_('Filter by level')}</legend>
                    ${this.renderLevelFilter('A1', true)}
                    ${this.renderLevelFilter('A2', true)}
                    ${this.renderLevelFilter('B1', true)}
                    ${this.renderLevelFilter('B2', true)}
                    ${this.renderLevelFilter('C1', true)}
                    ${this.renderLevelFilter('C2', true)}
                </fieldset>
            </section>
        `;
    },

    /**
     * Render one level checkbox.
     * @param {string} levelCode
     * @param {boolean} isChecked
     * @returns {string}
     */
    renderLevelFilter: function (levelCode, isChecked) {
        const id = `${this.prefix}-filter-${levelCode.toLowerCase()}`;
        return `
            <label for="${id}">
                <input type="checkbox" id="${id}" class="${this.levelFilterClass}" value="${levelCode}"${isChecked ? ' checked' : ''}>
                ${levelCode}
            </label>
        `;
    },

    /**
     * Render granularity option radio input.
     * @param {string} value
     * @param {string} label
     * @param {boolean} [isDisabled=false]
     * @returns {string}
     */
    renderGranularityOption: function (value, label, isDisabled) {
        const id = `${this.prefix}-granularity-${value}`;
        const isChecked = this.selectionGranularity === value;
        const disabledAttribute = isDisabled ? ' disabled' : '';

        return `
            <label for="${id}">
                <input type="radio" name="${this.granularityName}" id="${id}" value="${value}"${isChecked ? ' checked' : ''}${disabledAttribute}>
                ${label}
            </label>
        `;
    },

    /**
     * Build actions markup.
     * @returns {string}
     */
    renderActionsMarkup: function () {
        return `
            <section class="digcompedu-actions" aria-label="${_('Actions')}">
                <button type="button" id="${this.fullscreenTriggerId}" aria-expanded="false">${_('Toggle fullscreen')}</button>
                <button type="button" id="${this.resetButtonId}" class="secondary">${_('Reset selection')}</button>
                <button type="button" id="${this.modalOpenId}" class="secondary">${_('Preview summary')}</button>
            </section>
        `;
    },

    /**
     * Build fullscreen overlay markup.
     * @returns {string}
     */
    renderFullscreenMarkup: function () {
        return `
            <div id="${this.fullscreenOverlayId}" class="digcompedu-fullscreen-overlay" aria-hidden="true" role="dialog" aria-modal="true">
                <div class="digcompedu-fullscreen-header">
                    <h4>${_('DigCompEdu framework (fullscreen)')}</h4>
                    <button type="button" id="${this.fullscreenCloseId}" class="digcompedu-fullscreen-close">${_('Close')}</button>
                </div>
                <div class="digcompedu-fullscreen-content" tabindex="0"></div>
            </div>
        `;
    },

    /**
     * Build modal markup.
     * @returns {string}
     */
    renderModalMarkup: function () {
        return `
            <div id="${this.modalId}" class="digcompedu-modal" aria-hidden="true" role="dialog" aria-modal="true">
                <div class="digcompedu-modal-dialog">
                    <header class="digcompedu-modal-header">
                        <h5 class="digcompedu-modal-title">${_('Selection summary preview')}</h5>
                        <button type="button" id="${this.modalCloseId}">${_('Close')}</button>
                    </header>
                    <div class="digcompedu-modal-body">
                        <div id="${this.summaryTablePreviewId}" class="digcompedu-summary-table-container"></div>
                        <div id="${this.summaryTextPreviewId}" class="digcompedu-text-summary"></div>
                    </div>
                    <footer class="digcompedu-modal-footer">
                        <button type="button" id="${this.modalDismissId}" class="secondary">${_('Dismiss')}</button>
                    </footer>
                </div>
            </div>
        `;
    },

    /**
     * Attach component behaviour once markup is rendered.
     */
    attachBehaviour: function () {
        const searchInput = this.ideviceBody.querySelector(
            `#${this.searchInputId}`
        );
        if (searchInput) {
            searchInput.addEventListener(
                'input',
                this.applyFiltersAndSearch.bind(this)
            );
        }

        const levelFilters = this.ideviceBody.querySelectorAll(
            `.${this.levelFilterClass}`
        );
        levelFilters.forEach((checkbox) => {
            checkbox.addEventListener(
                'change',
                this.applyFiltersAndSearch.bind(this)
            );
        });

        const displayModeInputs = this.ideviceBody.querySelectorAll(
            `input[name="${this.displayModeName}"]`
        );
        displayModeInputs.forEach((input) => {
            input.addEventListener('change', () => {
                this.summaryTableHtml = '';
                this.summaryTextHtml = '';
            });
        });

        const langSelect = this.ideviceBody.querySelector(
            `#${this.dataLangSelectId}`
        );
        if (langSelect) {
            langSelect.addEventListener('change', (event) => {
                const newLang = event.target.value;
                if (newLang === this.activeLang) {
                    return;
                }
                this.handleFrameworkChange(newLang);
            });
        }

        const granularityInputs = this.ideviceBody.querySelectorAll(
            `input[name="${this.granularityName}"]`
        );
        granularityInputs.forEach((input) => {
            input.addEventListener('change', (event) => {
                if (!event.target.checked) {
                    return;
                }
                this.handleGranularityChange(event.target.value);
            });
        });

        const fullscreenBtn = this.ideviceBody.querySelector(
            `#${this.fullscreenTriggerId}`
        );
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', () => {
                const expanded =
                    fullscreenBtn.getAttribute('aria-expanded') === 'true';
                if (expanded) {
                    this.exitFullscreen();
                } else {
                    this.enterFullscreen();
                }
            });
        }

        const fullscreenClose = this.ideviceBody.querySelector(
            `#${this.fullscreenCloseId}`
        );
        if (fullscreenClose) {
            fullscreenClose.addEventListener(
                'click',
                this.exitFullscreen.bind(this)
            );
        }

        const resetBtn = this.ideviceBody.querySelector(
            `#${this.resetButtonId}`
        );
        if (resetBtn) {
            resetBtn.addEventListener('click', this.resetSelection.bind(this));
        }

        const previewBtn = this.ideviceBody.querySelector(
            `#${this.modalOpenId}`
        );
        if (previewBtn) {
            previewBtn.addEventListener(
                'click',
                this.openSummaryModal.bind(this)
            );
        }

        const modalClose = this.ideviceBody.querySelector(
            `#${this.modalCloseId}`
        );
        const modalDismiss = this.ideviceBody.querySelector(
            `#${this.modalDismissId}`
        );
        if (modalClose) {
            modalClose.addEventListener(
                'click',
                this.closeSummaryModal.bind(this)
            );
        }
        if (modalDismiss) {
            modalDismiss.addEventListener(
                'click',
                this.closeSummaryModal.bind(this)
            );
        }

        document.addEventListener(
            'keydown',
            this.handleGlobalKeydown.bind(this)
        );

        this.updateGranularityControls();
    },

    /**
     * Handle user changes to selection granularity.
     * @param {string} value
     */
    handleGranularityChange: function (value) {
        const allowed = ['competence', 'level', 'indicator'];
        let targetValue =
            allowed.indexOf(value) !== -1 ? value : this.selectionGranularity;

        if (targetValue === 'indicator' && !this.frameworkHasIndicators) {
            targetValue = 'level';
        }

        if (this.selectionGranularity === targetValue) {
            this.updateGranularityControls();
            return;
        }

        this.selectionGranularity = targetValue;
        this.summaryTableHtml = '';
        this.summaryTextHtml = '';
        this.updateGranularityControls();
        this.updateSelectionInputs();
    },

    /**
     * Synchronize granularity radio controls with current state.
     */
    updateGranularityControls: function () {
        if (
            !this.frameworkHasIndicators &&
            this.selectionGranularity === 'indicator'
        ) {
            this.selectionGranularity = 'level';
        }

        const granularityInputs = this.ideviceBody
            ? this.ideviceBody.querySelectorAll(
                  `input[name="${this.granularityName}"]`
              )
            : [];

        granularityInputs.forEach((input) => {
            if (input.value === 'indicator') {
                input.disabled = !this.frameworkHasIndicators;
            }
            input.checked = input.value === this.selectionGranularity;
        });
    },

    /**
     * Apply filters and re-render the table.
     */
    applyFiltersAndSearch: function () {
        this.renderTable();
    },

    /**
     * Render table rows based on current filters.
     */
    renderTable: function () {
        const tbody = this.ideviceBody.querySelector(`#${this.tableBodyId}`);
        if (!tbody) {
            return;
        }
        tbody.innerHTML = '';

        const activeLevels = this.collectActiveLevels();
        const searchTerm = this.removeDiacritics(
            (
                this.ideviceBody.querySelector(`#${this.searchInputId}`)
                    ?.value || ''
            )
                .trim()
                .toLowerCase()
        );

        const lastCells = [null, null, null, null, null];

        this.rowsData.forEach((entry) => {
            if (!activeLevels.has(entry.levelCode)) {
                return;
            }

            if (searchTerm && !entry.searchIndex.includes(searchTerm)) {
                return;
            }

            const row = this.createRow(entry, lastCells);
            tbody.appendChild(row);
        });
    },

    /**
     * Create table row with rowspan logic.
     * @param {Object} entry
     * @param {HTMLElement[]} lastCells
     * @returns {HTMLTableRowElement}
     */
    createRow: function (entry, lastCells) {
        const row = document.createElement('tr');
        row.classList.add(`area${entry.areaNumber}`);

        const areaCell = this.createCell(
            'td',
            `${entry.areaNumber}. ${entry.areaTitle}`,
            'area'
        );
        const competenceCell = this.createCell(
            'td',
            `${entry.competenceCode}. ${entry.competenceTitle}`,
            'competence'
        );
        const stageLabel = entry.stageTitle
            ? `${entry.stageCode}. ${entry.stageTitle}`
            : entry.stageCode || '';
        const stageCell = this.createCell('td', stageLabel, 'stage');
        const levelLabel = entry.levelTitle
            ? `${entry.levelCode}. ${entry.levelTitle}`
            : entry.levelCode || '';
        const levelCell = this.createCell('td', levelLabel, 'level');
        const performanceCell = this.createPerformanceCell(entry);

        const indicatorCell = document.createElement('td');
        const indicatorWrapper = document.createElement('div');
        indicatorWrapper.classList.add('digcompedu-indicator');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = entry.entryId;
        checkbox.value = entry.entryId;
        checkbox.checked = this.selectedIds.has(entry.entryId);
        checkbox.dataset.area = entry.areaNumber;
        checkbox.dataset.areaTitle = entry.areaTitle;
        checkbox.dataset.competence = entry.competenceCode;
        checkbox.dataset.competenceTitle = entry.competenceTitle;
        checkbox.dataset.stage = entry.stageCode;
        checkbox.dataset.stageTitle = entry.stageTitle;
        checkbox.dataset.level = entry.levelCode;
        checkbox.dataset.levelId = entry.levelId;
        checkbox.dataset.competenceId = entry.competenceId;
        checkbox.dataset.entryType = entry.type;
        if (entry.type === 'indicator') {
            checkbox.dataset.indicator = entry.indicatorNumber;
            checkbox.dataset.indicatorTitle = entry.indicatorTitle;
            checkbox.setAttribute(
                'aria-label',
                `${_('Indicator')} ${entry.indicatorNumber}: ${entry.indicatorTitle}`
            );
        } else {
            checkbox.setAttribute(
                'aria-label',
                `${_('Level')} ${entry.levelCode}: ${entry.performanceStatement}`
            );
        }

        checkbox.addEventListener('change', (event) => {
            this.handleIndicatorToggle(event.target);
        });

        const indicatorLabel = document.createElement('label');
        indicatorLabel.setAttribute('for', entry.entryId);
        if (entry.type === 'indicator') {
            const strong = document.createElement('strong');
            strong.textContent = `${entry.indicatorNumber}. `;
            const titleSpan = document.createElement('span');
            titleSpan.textContent = entry.indicatorTitle;
            indicatorLabel.appendChild(strong);
            indicatorLabel.appendChild(titleSpan);
        } else {
            indicatorLabel.textContent =
                entry.performanceStatement ||
                entry.levelTitle ||
                entry.levelCode;
        }

        checkbox.id = entry.entryId;
        indicatorWrapper.appendChild(checkbox);
        indicatorWrapper.appendChild(indicatorLabel);
        indicatorCell.appendChild(indicatorWrapper);

        const cells = [
            areaCell,
            competenceCell,
            stageCell,
            levelCell,
            performanceCell,
        ];
        cells.forEach((cell, index) => {
            const lastCell = lastCells[index];
            if (lastCell && lastCell.dataset.key === cell.dataset.key) {
                lastCell.rowSpan += 1;
                cell.remove();
            } else {
                row.appendChild(cell);
                lastCells[index] = cell;
            }
            if (index === 3) {
                row.appendChild(indicatorCell);
            }
        });

        return row;
    },

    /**
     * Create generic table cell with tooltip.
     * @param {string} tag
     * @param {string} text
     * @param {string} type
     * @returns {HTMLTableCellElement}
     */
    createCell: function (tag, text, type) {
        const cell = document.createElement(tag);
        cell.classList.add(`digcompedu-${type}`);
        cell.textContent = text;
        cell.title = text;
        cell.dataset.key = `${type}:${text}`;
        return cell;
    },

    /**
     * Create performance cell with structured content.
     * @param {Object} entry
     * @returns {HTMLTableCellElement}
     */
    createPerformanceCell: function (entry) {
        const cell = document.createElement('td');
        cell.classList.add('digcompedu-performance');
        cell.dataset.key = `performance:${entry.groupKey}`;

        const statementPara = document.createElement('p');
        statementPara.textContent = entry.performanceStatement;
        cell.appendChild(statementPara);

        if (entry.levelExamples.length > 0) {
            const label = document.createElement('strong');
            label.textContent = _('Examples:');
            cell.appendChild(label);

            const list = document.createElement('ul');
            entry.levelExamples.forEach((example) => {
                const item = document.createElement('li');
                item.textContent = example;
                list.appendChild(item);
            });
            cell.appendChild(list);
        }

        return cell;
    },

    /**
     * Handle checkbox toggle for indicators.
     * @param {HTMLInputElement} checkbox
     */
    handleIndicatorToggle: function (checkbox) {
        const entry = this.indicatorLookup[checkbox.value];
        if (!entry) {
            return;
        }

        const targetIds = this.getSelectionTargetIds(entry);

        if (checkbox.checked) {
            targetIds.forEach((id) => this.selectedIds.add(id));
        } else {
            targetIds.forEach((id) => this.selectedIds.delete(id));
        }

        this.summaryTableHtml = '';
        this.summaryTextHtml = '';
        this.updateSelectionInputs();
        this.updateSelectionCounter();
    },

    /**
     * Determine which identifiers should be toggled based on granularity and entry type.
     * @param {Object} entry
     * @returns {string[]}
     */
    getSelectionTargetIds: function (entry) {
        if (!entry) {
            return [];
        }

        if (entry.type === 'level') {
            return [entry.entryId];
        }

        if (this.selectionGranularity === 'competence') {
            return this.competenceLookup[entry.competenceId] || [entry.entryId];
        }

        if (this.selectionGranularity === 'level') {
            return this.levelLookup[entry.levelId] || [entry.entryId];
        }

        return [entry.entryId];
    },

    /**
     * Update selection counter status text.
     */
    updateSelectionCounter: function () {
        const counter = this.ideviceBody.querySelector(
            `#${this.selectionCounterId}`
        );
        if (!counter) {
            return;
        }
        const count = this.selectedIds.size;
        counter.textContent =
            count === 0
                ? _('No items selected.')
                : _('Selected items: ') + count;
    },

    /**
     * Collect active levels from checkboxes.
     * @returns {Set<string>}
     */
    collectActiveLevels: function () {
        const active = new Set();
        const levelFilters = this.ideviceBody.querySelectorAll(
            `.${this.levelFilterClass}`
        );
        let anyChecked = false;
        levelFilters.forEach((checkbox) => {
            if (checkbox.checked) {
                active.add(checkbox.value);
                anyChecked = true;
            }
        });

        if (!anyChecked) {
            this.levelOrder.forEach((level) => active.add(level));
        }
        return active;
    },

    /**
     * Reset selection and filters to defaults.
     */
    resetSelection: function () {
        this.selectedIds.clear();
        this.summaryTableHtml = '';
        this.summaryTextHtml = '';

        const searchInput = this.ideviceBody.querySelector(
            `#${this.searchInputId}`
        );
        if (searchInput) {
            searchInput.value = '';
        }
        const levelFilters = this.ideviceBody.querySelectorAll(
            `.${this.levelFilterClass}`
        );
        levelFilters.forEach((checkbox) => {
            checkbox.checked = true;
        });

        this.renderTable();
        this.updateSelectionInputs();
        this.updateSelectionCounter();
    },

    /**
     * Re-check inputs based on current selection.
     */
    updateSelectionInputs: function () {
        const checkboxes = this.ideviceBody.querySelectorAll(
            `#${this.tableBodyId} input[type="checkbox"]`
        );
        checkboxes.forEach((checkbox) => {
            checkbox.checked = this.selectedIds.has(checkbox.value);
            checkbox.indeterminate = false;
        });
    },

    /**
     * Open fullscreen overlay.
     */
    enterFullscreen: function () {
        const overlay = this.ideviceBody.querySelector(
            `#${this.fullscreenOverlayId}`
        );
        const fullscreenBtn = this.ideviceBody.querySelector(
            `#${this.fullscreenTriggerId}`
        );
        const editorRoot = this.ideviceBody.querySelector('.digcompedu-editor');
        const layout = this.ideviceBody.querySelector('.digcompedu-layout');
        if (!overlay) {
            return;
        }
        const wrapper = overlay.querySelector('.digcompedu-fullscreen-content');
        if (wrapper && layout && editorRoot) {
            if (!this.fullscreenPlaceholder) {
                this.fullscreenPlaceholder = document.createElement('div');
                this.fullscreenPlaceholder.className =
                    'digcompedu-fullscreen-placeholder';
                this.fullscreenPlaceholder.setAttribute('aria-hidden', 'true');
                this.fullscreenPlaceholder.style.display = 'none';
            }
            if (!this.fullscreenPlaceholder.parentNode) {
                layout.parentNode.insertBefore(
                    this.fullscreenPlaceholder,
                    layout
                );
            }
            wrapper.innerHTML = '';
            wrapper.appendChild(layout);
            editorRoot.classList.add('digcompedu-is-fullscreen');
        }

        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('digcompedu-overlay-open');

        this.fullscreenPreviousFocus = document.activeElement;
        const closeBtn = this.ideviceBody.querySelector(
            `#${this.fullscreenCloseId}`
        );
        if (closeBtn) {
            closeBtn.focus();
        }

        if (fullscreenBtn) {
            fullscreenBtn.setAttribute('aria-expanded', 'true');
        }
    },

    /**
     * Exit fullscreen overlay.
     */
    exitFullscreen: function () {
        const overlay = this.ideviceBody.querySelector(
            `#${this.fullscreenOverlayId}`
        );
        const fullscreenBtn = this.ideviceBody.querySelector(
            `#${this.fullscreenTriggerId}`
        );
        const editorRoot = this.ideviceBody.querySelector('.digcompedu-editor');
        if (!overlay) {
            return;
        }
        const wrapper = overlay.querySelector('.digcompedu-fullscreen-content');
        const layout = wrapper
            ? wrapper.querySelector('.digcompedu-layout')
            : null;
        if (layout) {
            if (
                this.fullscreenPlaceholder &&
                this.fullscreenPlaceholder.parentNode
            ) {
                this.fullscreenPlaceholder.parentNode.insertBefore(
                    layout,
                    this.fullscreenPlaceholder
                );
            } else if (editorRoot) {
                editorRoot.insertBefore(layout, editorRoot.firstChild);
            }
        }
        if (wrapper) {
            wrapper.innerHTML = '';
        }
        if (this.fullscreenPlaceholder) {
            this.fullscreenPlaceholder.remove();
            this.fullscreenPlaceholder = null;
        }
        if (editorRoot) {
            editorRoot.classList.remove('digcompedu-is-fullscreen');
        }

        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('digcompedu-overlay-open');

        if (
            this.fullscreenPreviousFocus &&
            typeof this.fullscreenPreviousFocus.focus === 'function'
        ) {
            this.fullscreenPreviousFocus.focus();
        } else if (fullscreenBtn) {
            fullscreenBtn.focus();
        }
        if (fullscreenBtn) {
            fullscreenBtn.setAttribute('aria-expanded', 'false');
        }
    },

    /**
     * Handle Escape key for overlays.
     * @param {KeyboardEvent} event
     */
    handleGlobalKeydown: function (event) {
        if (event.key !== 'Escape') {
            return;
        }

        const overlay = this.ideviceBody.querySelector(
            `#${this.fullscreenOverlayId}`
        );
        const modal = this.ideviceBody.querySelector(`#${this.modalId}`);
        if (overlay && overlay.getAttribute('aria-hidden') === 'false') {
            this.exitFullscreen();
            event.preventDefault();
        } else if (modal && modal.getAttribute('aria-hidden') === 'false') {
            this.closeSummaryModal();
            event.preventDefault();
        }
    },

    /**
     * Open summary modal.
     */
    openSummaryModal: function () {
        const summary = this.generateSummaryContent();
        this.summaryTableHtml = summary.tableHtml;
        this.summaryTextHtml = summary.textHtml;
        this.updateSummaryPreview();

        const modal = this.ideviceBody.querySelector(`#${this.modalId}`);
        if (!modal) {
            return;
        }
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('digcompedu-overlay-open');
        this.modalPreviousFocus = document.activeElement;

        const modalClose = this.ideviceBody.querySelector(
            `#${this.modalCloseId}`
        );
        if (modalClose) {
            modalClose.focus();
        }
    },

    /**
     * Close summary modal.
     */
    closeSummaryModal: function () {
        const modal = this.ideviceBody.querySelector(`#${this.modalId}`);
        if (!modal) {
            return;
        }
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('digcompedu-overlay-open');
        if (
            this.modalPreviousFocus &&
            typeof this.modalPreviousFocus.focus === 'function'
        ) {
            this.modalPreviousFocus.focus();
        }
    },

    /**
     * Update modal preview content with stored summary.
     */
    updateSummaryPreview: function () {
        const tablePreview = this.ideviceBody.querySelector(
            `#${this.summaryTablePreviewId}`
        );
        const textPreview = this.ideviceBody.querySelector(
            `#${this.summaryTextPreviewId}`
        );
        if (tablePreview) {
            tablePreview.innerHTML = this.summaryTableHtml || '';
        }
        if (textPreview) {
            textPreview.innerHTML = this.summaryTextHtml || '';
        }
    },

    /**
     * Generate summary table and text based on selection.
     * @returns {{tableHtml: string, textHtml: string}}
     */
    generateSummaryContent: function () {
        const selectedEntries = Array.from(this.selectedIds)
            .map((id) => this.indicatorLookup[id])
            .filter(Boolean);

        const grouped = this.groupSelection(selectedEntries);
        const table = this.buildSummaryTable(grouped);
        const text = this.buildSummaryText(grouped);

        return {
            tableHtml: table.outerHTML,
            textHtml: text.innerHTML,
        };
    },

    /**
     * Group selection by area, competence, and level.
     * @param {Object[]} entries
     * @returns {Object}
     */
    groupSelection: function (entries) {
        const grouped = {};

        entries.forEach((entry) => {
            if (!grouped[entry.areaNumber]) {
                grouped[entry.areaNumber] = {
                    title: entry.areaTitle,
                    competences: {},
                };
            }
            const areaGroup = grouped[entry.areaNumber];
            if (!areaGroup.competences[entry.competenceCode]) {
                areaGroup.competences[entry.competenceCode] = {
                    title: entry.competenceTitle,
                    competenceIndex: entry.competenceIndex,
                    indicatorsByLevel: {},
                };
            }
            const competenceGroup = areaGroup.competences[entry.competenceCode];
            if (!competenceGroup.indicatorsByLevel[entry.levelCode]) {
                competenceGroup.indicatorsByLevel[entry.levelCode] = [];
            }
            competenceGroup.indicatorsByLevel[entry.levelCode].push(entry);
        });

        return grouped;
    },

    /**
     * Build summary table DOM element.
     * @param {Object} grouped
     * @returns {HTMLTableElement}
     */
    buildSummaryTable: function (grouped) {
        const table = document.createElement('table');
        table.classList.add('digcompedu-summary-table');

        const thead = document.createElement('thead');
        const areasRow = document.createElement('tr');
        const competencesRow = document.createElement('tr');

        const bodyRow = document.createElement('tr');
        const tbody = document.createElement('tbody');

        const frameworkAreas = this.frameworkData.digcompedu || [];

        frameworkAreas.forEach((area) => {
            const areaTh = document.createElement('th');
            areaTh.scope = 'col';
            areaTh.colSpan = area.competences.length;
            areaTh.classList.add(`area${area.area}`);
            areaTh.textContent = `${area.area}. ${area.title}`;
            areasRow.appendChild(areaTh);

            area.competences.forEach((competence) => {
                const compTh = document.createElement('th');
                compTh.textContent = competence.competence;
                compTh.classList.add(`area${area.area}`);
                competencesRow.appendChild(compTh);

                const compIndex = this.obtainCompetenceIndex(
                    String(competence.competence)
                );
                const cell = document.createElement('td');
                cell.classList.add(`a${area.area}c${compIndex}`, 'cell-level');
                cell.textContent = '';

                const areaGroup = grouped[area.area];
                if (areaGroup) {
                    const competenceGroup =
                        areaGroup.competences[String(competence.competence)];
                    if (competenceGroup) {
                        const highestLevel = this.obtainHighestLevel(
                            Object.keys(competenceGroup.indicatorsByLevel)
                        );
                        if (highestLevel) {
                            cell.textContent = highestLevel;
                        }
                    }
                }

                bodyRow.appendChild(cell);
            });
        });

        thead.appendChild(areasRow);
        thead.appendChild(competencesRow);
        tbody.appendChild(bodyRow);
        table.appendChild(thead);
        table.appendChild(tbody);

        return table;
    },

    /**
     * Select the highest level code from a list.
     * @param {string[]} levels
     * @returns {string|undefined}
     */
    obtainHighestLevel: function (levels) {
        if (!levels || levels.length === 0) {
            return undefined;
        }
        const sorted = levels.slice().sort((a, b) => {
            return this.levelOrder.indexOf(a) - this.levelOrder.indexOf(b);
        });
        return sorted[sorted.length - 1];
    },

    /**
     * Build summary text container.
     * @param {Object} grouped
     * @returns {HTMLDivElement}
     */
    buildSummaryText: function (grouped) {
        const container = document.createElement('div');

        Object.keys(grouped)
            .sort((a, b) => Number(a) - Number(b))
            .forEach((areaKey) => {
                const areaGroup = grouped[areaKey];
                const heading = document.createElement('h6');
                heading.textContent = `${_('Area of')} ${areaGroup.title}`;
                container.appendChild(heading);

                const list = document.createElement('ul');
                const competenceKeys = Object.keys(areaGroup.competences).sort(
                    (a, b) => {
                        const indexA = areaGroup.competences[a].competenceIndex;
                        const indexB = areaGroup.competences[b].competenceIndex;
                        return Number(indexA) - Number(indexB);
                    }
                );

                competenceKeys.forEach((competenceCode) => {
                    const competence = areaGroup.competences[competenceCode];
                    const levels = Object.keys(
                        competence.indicatorsByLevel
                    ).sort(
                        (a, b) =>
                            this.levelOrder.indexOf(a) -
                            this.levelOrder.indexOf(b)
                    );

                    levels.forEach((levelCode) => {
                        const indicators =
                            competence.indicatorsByLevel[levelCode];
                        const item = document.createElement('li');
                        const strong = document.createElement('strong');
                        strong.textContent = `${levelCode} for competence ${competenceCode}. `;
                        item.appendChild(strong);

                        const hasIndicatorEntries = indicators.some(
                            (indicator) => indicator.type === 'indicator'
                        );
                        const descriptor = hasIndicatorEntries
                            ? 'indicator(s)'
                            : 'level(s)';
                        const text = document.createTextNode(
                            `${competence.title} because it contributes to the digital competence development with ${descriptor} `
                        );
                        item.appendChild(text);

                        const descriptions = indicators.map(
                            (indicator, index) => {
                                const prefix =
                                    indicators.length > 1 &&
                                    index === indicators.length - 1
                                        ? _('and ')
                                        : '';
                                if (indicator.type === 'indicator') {
                                    return `${prefix}${_('indicator')} ${indicator.indicatorNumber}. ${indicator.indicatorTitle}`;
                                }
                                const statement =
                                    indicator.performanceStatement ||
                                    indicator.levelTitle ||
                                    '';
                                const levelLabel = `${_('level')} ${indicator.levelCode}`;
                                return `${prefix}${levelLabel}: ${statement}`.trim();
                            }
                        );

                        const finalSentence = descriptions
                            .join(indicators.length > 2 ? '; ' : ' ')
                            .trim();
                        if (finalSentence.length > 0) {
                            item.appendChild(
                                document.createTextNode(`${finalSentence}.`)
                            );
                        }
                        list.appendChild(item);
                    });
                });

                container.appendChild(list);
            });

        return container;
    },

    /**
     * Gather display mode value.
     * @returns {string}
     */
    getDisplayModeValue: function () {
        const checked = this.ideviceBody.querySelector(
            `input[name="${this.displayModeName}"]:checked`
        );
        return checked ? checked.value : 'table';
    },

    /**
     * Restore previously saved UI state.
     */
    restoreInterfaceState: function () {
        if (this.selectedIds.size > 0) {
            this.updateSelectionInputs();
        }

        if (this.summaryTableHtml || this.summaryTextHtml) {
            this.updateSummaryPreview();
        }
    },

    /**
     * Handle framework switching while preserving selection state.
     * @param {string} newLang
     */
    handleFrameworkChange: function (newLang) {
        if (!newLang || newLang === this.activeLang) {
            return;
        }

        const previousLang = this.activeLang;
        const previousSelections = Array.from(this.selectedIds);
        const previousHadIndicators = this.frameworkHasIndicators;

        this.ideviceBody.classList.add('digcompedu-loading');

        return this.loadFrameworkData(newLang)
            .then((data) => {
                this.activeLang = newLang;
                this.frameworkData = data;
                this.prepareLookupStructures();
                this.ensureGranularityCompatibility();

                const mappedSelections = this.transitionSelections(
                    previousSelections,
                    previousHadIndicators
                );

                this.selectedIds = mappedSelections;
                this.renderTable();
                this.updateSelectionInputs();
                this.updateSelectionCounter();
                this.summaryTableHtml = '';
                this.summaryTextHtml = '';
                this.updateSummaryPreview();
                this.updateGranularityControls();
                this.ideviceBody.classList.remove('digcompedu-loading');
            })
            .catch((error) => {
                console.error('DigCompEdu framework change failed:', error);
                if (
                    typeof eXe !== 'undefined' &&
                    eXe.app &&
                    typeof eXe.app.alert === 'function'
                ) {
                    eXe.app.alert(
                        _(
                            'Unable to change framework. The previous data will remain loaded.'
                        )
                    );
                }
                const frameworkSelect = this.ideviceBody.querySelector(
                    `#${this.dataLangSelectId}`
                );
                if (frameworkSelect) {
                    frameworkSelect.value = previousLang;
                }
                this.ideviceBody.classList.remove('digcompedu-loading');
                throw error;
            });
    },

    /**
     * Map previous selections to the newly loaded framework.
     * @param {string[]} previousSelections
     * @param {boolean} previousHadIndicators
     * @returns {Set<string>}
     */
    transitionSelections: function (previousSelections, previousHadIndicators) {
        const mapped = new Set();

        previousSelections.forEach((id) => {
            if (previousHadIndicators && !this.frameworkHasIndicators) {
                const levelId = this.extractLevelIdFromEntryId(id);
                if (this.indicatorLookup[levelId]) {
                    mapped.add(levelId);
                }
                return;
            }

            if (!previousHadIndicators && this.frameworkHasIndicators) {
                const levelId = this.extractLevelIdFromEntryId(id);
                const indicatorIds = this.levelLookup[levelId] || [];
                indicatorIds.forEach((indicatorId) => mapped.add(indicatorId));
                return;
            }

            if (this.indicatorLookup[id]) {
                mapped.add(id);
            }
        });

        return mapped;
    },

    /**
     * Legacy helper kept for backward compatibility.
     * @param {string} newLang
     */
    reloadForLanguage: function (newLang) {
        this.handleFrameworkChange(newLang);
    },

    /**
     * Remove diacritics from a string.
     * @param {string} value
     * @returns {string}
     */
    removeDiacritics: function (value) {
        if (!value || typeof value.normalize !== 'function') {
            return value;
        }
        return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    },

    /**
     * Resolve edition resource path relative to the script location.
     * @param {string} relativePath
     * @returns {string}
     */
    resolveEditionResource: function (relativePath) {
        if (
            typeof eXe !== 'undefined' &&
            eXe.app &&
            typeof eXe.app.getIdeviceInstalled === 'function'
        ) {
            const idevice = eXe.app.getIdeviceInstalled(this.prefix);
            if (
                idevice &&
                typeof idevice.getResourceServicePath === 'function'
            ) {
                const basePath = idevice.pathEdition || idevice.path || '';
                if (basePath) {
                    // Resolve relative path manually (basePath is not a full URL)
                    const resolved = this.resolveRelativePath(
                        basePath,
                        relativePath
                    );
                    return idevice.getResourceServicePath(resolved);
                }
            }
        }

        const base = this.getEditionBasePath();
        if (!base) {
            return relativePath;
        }
        // Try to resolve using window.location as base for full URL construction
        try {
            const fullBase = new URL(base, window.location.href).href;
            const resolved = new URL(relativePath, fullBase).pathname;
            return resolved;
        } catch (error) {
            return this.resolveRelativePath(base, relativePath);
        }
    },

    /**
     * Resolve a relative path against a base path using string manipulation.
     * @param {string} basePath - The base path (e.g., '/v1/files/perm/idevices/base/digcompedu/edition/')
     * @param {string} relativePath - The relative path (e.g., '../data/digcompedu_es.json')
     * @returns {string} The resolved absolute path
     */
    resolveRelativePath: function (basePath, relativePath) {
        // Remove trailing slash and split into segments
        const baseSegments = basePath.replace(/\/$/, '').split('/');

        // Handle relative path segments
        const relativeSegments = relativePath.split('/');

        for (let i = 0; i < relativeSegments.length; i++) {
            const segment = relativeSegments[i];
            if (segment === '..') {
                // Go up one directory
                baseSegments.pop();
            } else if (segment !== '.' && segment !== '') {
                // Add the segment
                baseSegments.push(segment);
            }
        }

        return baseSegments.join('/');
    },

    /**
     * Retrieve cached edition base path.
     * @returns {string}
     */
    getEditionBasePath: function () {
        if (this.editionBasePath !== null) {
            return this.editionBasePath;
        }
        const scripts = document.getElementsByTagName('script');
        for (let index = 0; index < scripts.length; index += 1) {
            const script = scripts[index];
            const src = script.getAttribute('src') || '';
            if (
                src.indexOf('digcompedu.js') !== -1 &&
                src.indexOf('/edition/') !== -1
            ) {
                const lastSlash = src.lastIndexOf('/');
                if (lastSlash !== -1) {
                    this.editionBasePath = src.substring(0, lastSlash + 1);
                    return this.editionBasePath;
                }
            }
        }
        this.editionBasePath = '';
        return this.editionBasePath;
    },

    /**
     * Return a deep clone of the framework data to avoid shared mutations.
     * @param {Object} source
     * @returns {Object}
     */
    cloneFrameworkData: function (source) {
        return JSON.parse(JSON.stringify(source));
    },
};
