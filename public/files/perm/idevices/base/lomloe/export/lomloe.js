/* global _ */
/**
 * LOMLOE Curriculum Concretion iDevice — Export Renderer
 *
 * Called during export to convert stored JSON data into rendered HTML.
 * The `$Lomloe` object name matches the `export-object` in config.xml.
 *
 * @license AGPL-3.0-or-later
 */
var $Lomloe = {
    ideviceClass: 'lomloeIdeviceContent',

    /** Display names for each competencia clave code (used as tooltip title). */
    CC_DESCRIPTIONS: {
        'CCL':    'Competencia en comunicación lingüística',
        'CCL1':   'CCL1 — Expresa e interpreta conceptos, pensamientos, hechos y opiniones de forma oral, escrita o signada',
        'CCL2':   'CCL2 — Comprende e interpreta con sentido crítico textos orales, escritos o multimodales',
        'CCL3':   'CCL3 — Localiza, selecciona y contrasta información de distintas fuentes evaluando su fiabilidad',
        'CCL4':   'CCL4 — Lee con fluidez y comprende textos de distinta naturaleza y complejidad',
        'CCL5':   'CCL5 — Produce textos con corrección lingüística, adecuación y coherencia',
        'CP':     'Competencia plurilingüe',
        'CP1':    'CP1 — Usa al menos una lengua adicional de forma eficiente en situaciones cotidianas',
        'CP2':    'CP2 — Media en situaciones cotidianas que requieren comunicarse en distintas lenguas',
        'CP3':    'CP3 — Conoce y respeta la diversidad lingüística y cultural como valor de las sociedades',
        'STEM':   'Competencia matemática y en ciencia, tecnología e ingeniería',
        'STEM1':  'STEM1 — Utiliza conceptos y razonamientos matemáticos para interpretar y producir información',
        'STEM2':  'STEM2 — Aplica métodos del razonamiento científico para analizar situaciones y resolver problemas',
        'STEM3':  'STEM3 — Plantea proyectos de diseño, creando prototipos o modelos para resolver problemas',
        'STEM4':  'STEM4 — Interpreta y transmite elementos relevantes de investigaciones de forma clara y precisa',
        'STEM5':  'STEM5 — Desarrolla proyectos de diseño de forma creativa, evaluando su sostenibilidad e impacto',
        'CD':     'Competencia digital',
        'CD1':    'CD1 — Realiza búsquedas en internet y contrasta información de forma crítica',
        'CD2':    'CD2 — Crea, integra y reelabora contenidos digitales respetando los derechos de autoría',
        'CD3':    'CD3 — Protege dispositivos, datos personales y privacidad en entornos digitales',
        'CD4':    'CD4 — Conoce los riesgos en entornos digitales y adopta medidas de seguridad',
        'CD5':    'CD5 — Desarrolla soluciones tecnológicas innovadoras para dar respuesta a necesidades',
        'CPSAA':    'Competencia personal, social y de aprender a aprender',
        'CPSAA1':   'CPSAA1 — Regula las emociones afrontando los retos y cambios con optimismo y resiliencia',
        'CPSAA1.1': 'CPSAA1.1 — Fortalece el optimismo, la resiliencia, la autoeficacia y la búsqueda de objetivos',
        'CPSAA1.2': 'CPSAA1.2 — Desarrolla una adecuada autoestima valorando las fortalezas y aceptando los límites',
        'CPSAA2':   'CPSAA2 — Comprende la perspectiva de otros y se relaciona con empatía y asertividad',
        'CPSAA3':   'CPSAA3 — Muestra proactividad y autonomía en la gestión del aprendizaje',
        'CPSAA3.1': 'CPSAA3.1 — Evalúa y reflexiona sobre sus procesos de aprendizaje para mejorarlos',
        'CPSAA3.2': 'CPSAA3.2 — Desarrolla autodirección y control del proceso de aprendizaje individual',
        'CPSAA4':   'CPSAA4 — Desarrolla habilidades de colaboración participando activa y responsablemente',
        'CPSAA5':   'CPSAA5 — Planifica objetivos a largo plazo evaluando progresos y ajustando estrategias',
        'CC':    'Competencia ciudadana',
        'CC1':   'CC1 — Interpreta y comprende la realidad histórica, social y política del mundo',
        'CC2':   'CC2 — Comprende y analiza problemas éticos fundamentales y de actualidad',
        'CC3':   'CC3 — Aplica estrategias de análisis sistemático y crítico de la información',
        'CC4':   'CC4 — Comprende las diferentes realidades de un mundo global e interdependiente',
        'CE':    'Competencia emprendedora',
        'CE1':   'CE1 — Analiza necesidades y oportunidades afrontando retos con sentido crítico y ético',
        'CE2':   'CE2 — Evalúa las fortalezas y debilidades propias con vistas al emprendimiento',
        'CE3':   'CE3 — Desarrolla un proyecto emprendedor individual o colectivo buscando cooperación',
        'CE7':   'CE7 — Desarrolla ideas innovadoras y creativas con valor para la sociedad',
        'CCEC':    'Competencia en conciencia y expresión culturales',
        'CCEC1':   'CCEC1 — Conoce, aprecia críticamente y respeta el patrimonio cultural y artístico',
        'CCEC2':   'CCEC2 — Disfruta, respeta y valora críticamente las manifestaciones culturales y artísticas',
        'CCEC3':   'CCEC3 — Expresa ideas, sentimientos y emociones por medio de producciones culturales y artísticas',
        'CCEC3.1': 'CCEC3.1 — Desarrolla la creatividad y el sentido estético para enriquecer la comunicación',
        'CCEC3.2': 'CCEC3.2 — Respeta e interpreta el patrimonio cultural y artístico en su contexto sociohistórico',
        'CCEC4':   'CCEC4 — Define e implementa acciones de responsabilidad cultural y artística',
        'CCEC4.1': 'CCEC4.1 — Conoce y aplica los derechos de autoría y respeta la propiedad intelectual',
        'CCEC4.2': 'CCEC4.2 — Participa de forma comprometida y creativa en proyectos culturales y artísticos'
    },

    /** ISO 3166-2:ES code → human-readable label */
    DATASET_LABELS: {
        'ES':    'Estado (España)',
        'ES-AN': 'Andalucía',
        'ES-AR': 'Aragón',
        'ES-AS': 'Asturias, Principado de',
        'ES-CB': 'Cantabria',
        'ES-CL': 'Castilla y León',
        'ES-CM': 'Castilla-La Mancha',
        'ES-CN': 'Canarias',
        'ES-CT': 'Catalunya',
        'ES-EX': 'Extremadura',
        'ES-GA': 'Galicia',
        'ES-IB': 'Illes Balears',
        'ES-MD': 'Comunidad de Madrid',
        'ES-MC': 'Región de Murcia',
        'ES-NC': 'Comunidad Foral de Navarra',
        'ES-PV': 'País Vasco / Euskadi',
        'ES-RI': 'La Rioja',
        'ES-VC': 'Comunitat Valenciana'
    },

    /** Called once on page load. No-op for this iDevice. */
    init: function (data, accessibility) {},

    /** Called to render the iDevice view into the template. */
    renderView: function (data, accessibility, template, ideviceId, pathMedia) {
        var html = this.getHTMLView(data, pathMedia);
        return template.replace('{content}', html);
    },

    /** Generates the complete HTML for the exported view. */
    getHTMLView: function (data, pathMedia) {
        var selections = data.lomloeSelections || [];
        var datasetId = data.lomloeDataset || 'canarias';
        var summaryHtml = data.lomloeSummaryHtml || '';

        // Use pre-rendered HTML if available (generated by editor on save)
        if (summaryHtml) {
            return summaryHtml;
        }

        // Fallback: render from selections array
        return this._buildSummaryFromSelections(selections, datasetId);
    },

    /** Builds summary HTML from selections array (fallback when pre-rendered not available). */
    _buildSummaryFromSelections: function (selections, datasetId) {
        if (!selections || selections.length === 0) {
            return '<p class="lomloe-export-empty">No hay elementos curriculares seleccionados.</p>';
        }

        var datasetLabel = this.DATASET_LABELS[datasetId] || datasetId;
        var criterios = selections.filter(function (s) { return s.type === 'criterio'; });
        var saberes = selections.filter(function (s) { return s.type === 'saber'; });

        var html = '';
        html += '<h3 class="lomloe-export-title">Fundamentación Curricular LOMLOE</h3>';
        html += '<p class="lomloe-export-meta">';
        html += 'Fundamentación: <strong>' + this._esc(datasetLabel) + '</strong>';
        html += ' &nbsp;|&nbsp; Elementos seleccionados: <strong>' + selections.length + '</strong>';
        if (criterios.length) html += ' (' + criterios.length + ' criterios';
        if (saberes.length && criterios.length) html += ', ' + saberes.length + ' saberes)';
        else if (criterios.length) html += ')';
        else if (saberes.length) html += ' (' + saberes.length + ' saberes)';
        html += '</p>';

        html += this._buildTable(selections);
        return html;
    },

    /**
     * Determines column header for competencias clave based on etapa.
     * Infantil → "Comp. Clave", Primaria/ESO/Bachillerato → "Descriptores operativos"
     */
    _isInfantil: function (etapa) {
        return etapa && etapa.toLowerCase().indexOf('infantil') !== -1;
    },

    _getCompClaveHeader: function (etapa) {
        if (this._isInfantil(etapa)) {
            return 'Comp. Clave';
        }
        return 'Descriptores operativos';
    },

    /** Builds the summary table HTML. */
    _buildTable: function (selections) {
        if (!selections.length) return '';

        var self = this;
        var criterios = selections.filter(function (s) { return s.type === 'criterio'; });
        var saberes = selections.filter(function (s) { return s.type === 'saber'; });

        var html = '';

        if (criterios.length) {
            var ccHeader = self._getCompClaveHeader(criterios[0].etapa);
            var infantil = self._isInfantil(criterios[0].etapa);
            var hasSaberes = saberes.length > 0;

            // Group by competencia específica
            var compGroups = [];
            var compMap = {};
            var totalCriterioRows = 0;
            criterios.forEach(function (sel) {
                var key = sel.codigoComp || '';
                if (!compMap[key]) {
                    compMap[key] = {
                        codigoComp: sel.codigoComp,
                        descripcionComp: sel.descripcionComp || '',
                        etapa: sel.etapa,
                        nivel: sel.nivel,
                        denominacion: sel.denominacion,
                        items: []
                    };
                    compGroups.push(compMap[key]);
                }
                compMap[key].items.push(sel);
                totalCriterioRows++;
            });

            html += '<table class="lomloe-export-table exe-table">';
            html += '<thead><tr>';
            html += '<th data-lomloe-tip="Competencias Específicas">Comp. Específica</th>';
            if (infantil) {
                html += '<th data-lomloe-tip="Competencias Clave">' + self._esc(ccHeader) + '</th>';
                html += '<th data-lomloe-tip="Criterios de evaluación">Criterios de Eval.</th>';
            } else {
                html += '<th data-lomloe-tip="Criterios de evaluación">Criterios de Eval.</th>';
                html += '<th data-lomloe-tip="Descriptores operativos">' + self._esc(ccHeader) + '</th>';
            }
            if (hasSaberes) html += '<th>Saberes Básicos</th>';
            html += '</tr></thead><tbody>';

            var isFirstCriterioRow = true;
            compGroups.forEach(function (group) {
                var isFirstInGroup = true;
                group.items.forEach(function (sel) {
                    html += '<tr>';
                    if (isFirstInGroup) {
                        var compTip = [group.etapa, group.nivel, group.denominacion]
                            .filter(Boolean).join(' · ');
                        if (group.descripcionComp) {
                            compTip += (compTip ? '\n\n' : '') + group.descripcionComp;
                        }
                        var compTipAttr = compTip ? ' data-lomloe-tip="' + self._esc(compTip) + '"' : '';
                        html += '<td rowspan="' + group.items.length + '"><strong' + compTipAttr + '>' + self._esc(group.codigoComp) + '</strong></td>';
                        isFirstInGroup = false;
                    }
                    var criterioCell = '<td>';
                    criterioCell += '<span class="lomloe-criterio-code-badge" data-lomloe-tip="' + self._esc(sel.descripcionCriterio || '') + '">' + self._esc(sel.codigoCriterio) + '</span>';
                    if (sel.partial) {
                        criterioCell += ' <span class="lomloe-partial-indicator">(parcial)</span>';
                    }
                    criterioCell += '</td>';
                    var ccCell = '<td>';
                    (sel.competenciasClave || []).forEach(function (cc) {
                        var title = self.CC_DESCRIPTIONS[cc] || cc;
                        ccCell += '<span class="lomloe-cc-badge" data-lomloe-tip="' + self._esc(title) + '">' + self._esc(cc) + '</span>';
                    });
                    ccCell += '</td>';
                    if (infantil) {
                        html += ccCell + criterioCell;
                    } else {
                        html += criterioCell + ccCell;
                    }
                    if (hasSaberes && isFirstCriterioRow) {
                        html += '<td rowspan="' + totalCriterioRows + '" class="lomloe-saberes-cell">';
                        saberes.forEach(function (sab) {
                            var sabTip = (sab.subtitulo1 || '') + (sab.subtitulo2 ? ' — ' + sab.subtitulo2 : '');
                            html += '<span class="lomloe-saber-link-badge" data-lomloe-tip="' + self._esc(sabTip) + '">';
                            html += self._esc(sab.nombre);
                            html += '</span>';
                        });
                        html += '</td>';
                        isFirstCriterioRow = false;
                    }
                    html += '</tr>';
                });
            });

            html += '</tbody></table>';
        }

        // Standalone saberes table (only when no criterios exist)
        if (saberes.length && !criterios.length) {
            html += '<table class="lomloe-export-table exe-table">';
            html += '<thead><tr>';
            html += '<th>Saberes Básicos</th>';
            html += '</tr></thead><tbody>';

            saberes.forEach(function (sel) {
                var sabTip = (sel.subtitulo1 || '') + (sel.subtitulo2 ? ' — ' + sel.subtitulo2 : '');
                html += '<tr>';
                html += '<td><span class="lomloe-saber-link-badge" data-lomloe-tip="' + self._esc(sabTip) + '">' + self._esc(sel.nombre) + '</span></td>';
                html += '</tr>';
            });

            html += '</tbody></table>';
        }

        return html;
    },

    /** HTML-escapes a string. */
    _esc: function (str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },

    /**
     * Installs the popover-based tooltip controller (idempotent).
     * A single #lomloe-tooltip element is rendered in the document's top
     * layer (when the Popover API is available) so it escapes the
     * overflow/stacking context of every parent. Falls back to a fixed
     * positioned element with the [hidden] attribute on older browsers.
     */
    _installTooltipController: function (doc) {
        doc = doc || (typeof document !== 'undefined' ? document : null);
        if (!doc || !doc.body || doc.__lomloeTipBound) return;
        doc.__lomloeTipBound = true;

        var hasPopover = typeof doc.body.showPopover === 'function';
        var tip = null;
        var current = null;

        function ensureTip() {
            if (tip && tip.isConnected) return tip;
            tip = doc.getElementById('lomloe-tooltip');
            if (!tip) {
                tip = doc.createElement('div');
                tip.id = 'lomloe-tooltip';
                if (hasPopover) tip.setAttribute('popover', 'manual');
                else tip.hidden = true;
                doc.body.appendChild(tip);
            }
            return tip;
        }

        function position(target) {
            if (!tip || !target || !target.getBoundingClientRect) return;
            var r = target.getBoundingClientRect();
            var tr = tip.getBoundingClientRect();
            var vw = (typeof window !== 'undefined' && window.innerWidth) || doc.documentElement.clientWidth || 0;
            var vh = (typeof window !== 'undefined' && window.innerHeight) || doc.documentElement.clientHeight || 0;
            var gap = 8;
            var top = r.bottom + gap;
            if (top + tr.height > vh - 4 && r.top - gap - tr.height >= 4) {
                top = r.top - gap - tr.height;
            }
            var left = r.left + (r.width / 2) - (tr.width / 2);
            if (left < 4) left = 4;
            if (left + tr.width > vw - 4) left = Math.max(4, vw - 4 - tr.width);
            tip.style.left = left + 'px';
            tip.style.top  = top + 'px';
        }

        function show(target) {
            var text = target.getAttribute('data-lomloe-tip');
            if (!text) return;
            ensureTip();
            tip.textContent = text;
            if (hasPopover) {
                try { if (!tip.matches(':popover-open')) tip.showPopover(); } catch (e) {}
            } else {
                tip.hidden = false;
            }
            position(target);
        }

        function hide() {
            if (!tip) return;
            if (hasPopover) {
                try { if (tip.matches(':popover-open')) tip.hidePopover(); } catch (e) {}
            } else {
                tip.hidden = true;
            }
        }

        function onOver(e) {
            var t = e.target && e.target.closest && e.target.closest('[data-lomloe-tip]');
            if (!t || t === current) return;
            current = t;
            show(t);
        }

        function onOut(e) {
            if (!current) return;
            var related = e.relatedTarget;
            if (related && (related === current || (current.contains && current.contains(related)))) return;
            var next = related && related.closest && related.closest('[data-lomloe-tip]');
            if (next) { current = next; show(next); }
            else { current = null; hide(); }
        }

        function onScrollOrResize() {
            if (current) position(current);
        }

        doc.addEventListener('mouseover', onOver, true);
        doc.addEventListener('mouseout',  onOut,  true);
        doc.addEventListener('focusin',   onOver, true);
        doc.addEventListener('focusout',  onOut,  true);
        if (typeof window !== 'undefined') {
            window.addEventListener('scroll', onScrollOrResize, true);
            window.addEventListener('resize', onScrollOrResize, true);
        }
    },

    /** Called once per iDevice instance after the HTML has been inserted into the page. */
    renderBehaviour: function (data, accessibility, ideviceId) {
        this._installTooltipController(typeof document !== 'undefined' ? document : null);
    }
};

// Alias for the framework's auto-generated export object key
// getIdeviceObjectKey() produces '$' + ideviceId (lowercase, hyphens removed)
// The framework checks window['$lomloe'], so we need this alias.
var $lomloe = $Lomloe; // eslint-disable-line no-unused-vars

// Self-install the tooltip controller in the published export.
// `renderBehaviour` is only invoked by exe_export.js when the iDevice node
// carries data-idevice-component-type="json"; in published static pages that
// attribute is sometimes absent, so we wire the controller on script load
// instead. The installer is idempotent across both entry points.
(function () {
    if (typeof document === 'undefined') return;
    function bootstrap() { $Lomloe._installTooltipController(document); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
    } else {
        bootstrap();
    }
})();
