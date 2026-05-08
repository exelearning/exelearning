/* global _ */
/**
 * LOMLOE Curriculum Concretion iDevice — Editor
 *
 * Allows educators to browse the Spanish LOMLOE curriculum tree
 * (Etapa → Nivel → Materia → Saberes Básicos / Competencias Específicas)
 * and tag an educational resource (REA) with the curriculum elements it covers.
 *
 * Supported datasets (ISO 3166-2:ES codes):
 *   - ES       : Spanish national (state) concretion  [coming soon]
 *   - ES-CN    : Canary Islands (Islas Canarias)
 *   - ES-AN, ES-MD, ES-CT, …  : other communities (add as needed)
 *
 * To add a new autonomous community: add one entry to DATASETS and supply
 * a JSON file under data/ named lomloe-{ISO-code}.json (e.g. lomloe-ES-MD.json).
 *
 * Data format:  Etapa → Nivel → CodArea → { denominacion,
 *                    competencias_especificas: { CodigoComp → { descripcion,
 *                        explicacion_bloque_competencial,
 *                        criterios_evaluacion: [{codigo, descripcion, competencias_clave}] } },
 *                    saberes_basicos: { bloques: { BlockTitle → [{nombre, subtitulo_nivel_1,
 *                        subtitulo_nivel_2}] } } }
 *
 * @license AGPL-3.0-or-later
 */
var $exeDevice = (function () {
    'use strict';

    // ════════════════════════════════════════════════════════════════
    // CONFIGURATION
    // ════════════════════════════════════════════════════════════════

    /**
     * Dataset registry — uses ISO 3166-2:ES codes as identifiers.
     *
     * To add a new autonomous community:
     *   1. Add an entry here with its ISO 3166-2:ES code as `id`.
     *   2. Place the JSON data file at data/lomloe-{id}.json (e.g. lomloe-ES-MD.json).
     *   3. Set `available: true`.  No other code changes needed.
     *
     * ISO 3166-2:ES reference:
     *   ES      = national (state)    ES-AN = Andalucía      ES-AR = Aragón
     *   ES-AS   = Asturias            ES-CB = Cantabria      ES-CL = Castilla y León
     *   ES-CM   = Castilla-La Mancha  ES-CN = Canarias       ES-CT = Catalunya
     *   ES-EX   = Extremadura         ES-GA = Galicia        ES-IB = Illes Balears
     *   ES-MD   = Madrid              ES-MC = Murcia         ES-NC = Navarra
     *   ES-PV   = País Vasco          ES-RI = La Rioja       ES-VC = C. Valenciana
     */
    var DATASETS = [
        {
            id: 'ES',
            isoCode: 'ES',
            label: 'LOMLOE — Estado (España)',
            labelEn: 'LOMLOE — State (Spain)',
            framework: 'LOMLOE',
            community: null,
            file: '../data/lomloe-ES.json',
            available: false  // National concretion JSON not yet available
        },
        {
            id: 'ES-CN',
            isoCode: 'ES-CN',
            label: 'LOMLOE — Islas Canarias',
            labelEn: 'LOMLOE — Canary Islands',
            framework: 'LOMLOE',
            community: 'Islas Canarias',
            file: '../data/lomloe-ES-CN.json',
            available: true
        }
        // Future entries — add when data files are ready:
        // { id: 'ES-AN', isoCode: 'ES-AN', label: 'LOMLOE — Andalucía', ... }
        // { id: 'ES-MD', isoCode: 'ES-MD', label: 'LOMLOE — Comunidad de Madrid', ... }
        // { id: 'ES-CT', isoCode: 'ES-CT', label: 'LOMLOE — Catalunya', ... }
    ];

    var DEFAULT_DATASET = 'ES-CN';

    /**
     * Display names for each LOMLOE competencia clave code.
     * Used as tooltip text (title attribute) on cc-tag and cc-badge spans.
     */
    var CC_DESCRIPTIONS = {
        // Competencia en comunicación lingüística
        'CCL':    'Competencia en comunicación lingüística',
        'CCL1':   'CCL1 — Expresa e interpreta conceptos, pensamientos, hechos y opiniones de forma oral, escrita o signada',
        'CCL2':   'CCL2 — Comprende e interpreta con sentido crítico textos orales, escritos o multimodales',
        'CCL3':   'CCL3 — Localiza, selecciona y contrasta información de distintas fuentes evaluando su fiabilidad',
        'CCL4':   'CCL4 — Lee con fluidez y comprende textos de distinta naturaleza y complejidad',
        'CCL5':   'CCL5 — Produce textos con corrección lingüística, adecuación y coherencia',
        // Competencia plurilingüe
        'CP':     'Competencia plurilingüe',
        'CP1':    'CP1 — Usa al menos una lengua adicional de forma eficiente en situaciones cotidianas',
        'CP2':    'CP2 — Media en situaciones cotidianas que requieren comunicarse en distintas lenguas',
        'CP3':    'CP3 — Conoce y respeta la diversidad lingüística y cultural como valor de las sociedades',
        // Competencia matemática y en ciencia, tecnología e ingeniería
        'STEM':   'Competencia matemática y en ciencia, tecnología e ingeniería',
        'STEM1':  'STEM1 — Utiliza conceptos y razonamientos matemáticos para interpretar y producir información',
        'STEM2':  'STEM2 — Aplica métodos del razonamiento científico para analizar situaciones y resolver problemas',
        'STEM3':  'STEM3 — Plantea proyectos de diseño, creando prototipos o modelos para resolver problemas',
        'STEM4':  'STEM4 — Interpreta y transmite elementos relevantes de investigaciones de forma clara y precisa',
        'STEM5':  'STEM5 — Desarrolla proyectos de diseño de forma creativa, evaluando su sostenibilidad e impacto',
        // Competencia digital
        'CD':     'Competencia digital',
        'CD1':    'CD1 — Realiza búsquedas en internet y contrasta información de forma crítica',
        'CD2':    'CD2 — Crea, integra y reelabora contenidos digitales respetando los derechos de autoría',
        'CD3':    'CD3 — Protege dispositivos, datos personales y privacidad en entornos digitales',
        'CD4':    'CD4 — Conoce los riesgos en entornos digitales y adopta medidas de seguridad',
        'CD5':    'CD5 — Desarrolla soluciones tecnológicas innovadoras para dar respuesta a necesidades',
        // Competencia personal, social y de aprender a aprender
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
        // Competencia ciudadana
        'CC':    'Competencia ciudadana',
        'CC1':   'CC1 — Interpreta y comprende la realidad histórica, social y política del mundo',
        'CC2':   'CC2 — Comprende y analiza problemas éticos fundamentales y de actualidad',
        'CC3':   'CC3 — Aplica estrategias de análisis sistemático y crítico de la información',
        'CC4':   'CC4 — Comprende las diferentes realidades de un mundo global e interdependiente',
        // Competencia emprendedora
        'CE':    'Competencia emprendedora',
        'CE1':   'CE1 — Analiza necesidades y oportunidades afrontando retos con sentido crítico y ético',
        'CE2':   'CE2 — Evalúa las fortalezas y debilidades propias con vistas al emprendimiento',
        'CE3':   'CE3 — Desarrolla un proyecto emprendedor individual o colectivo buscando cooperación',
        'CE7':   'CE7 — Desarrolla ideas innovadoras y creativas con valor para la sociedad',
        // Competencia en conciencia y expresión culturales
        'CCEC':    'Competencia en conciencia y expresión culturales',
        'CCEC1':   'CCEC1 — Conoce, aprecia críticamente y respeta el patrimonio cultural y artístico',
        'CCEC2':   'CCEC2 — Disfruta, respeta y valora críticamente las manifestaciones culturales y artísticas',
        'CCEC3':   'CCEC3 — Expresa ideas, sentimientos y emociones por medio de producciones culturales y artísticas',
        'CCEC3.1': 'CCEC3.1 — Desarrolla la creatividad y el sentido estético para enriquecer la comunicación',
        'CCEC3.2': 'CCEC3.2 — Respeta e interpreta el patrimonio cultural y artístico en su contexto sociohistórico',
        'CCEC4':   'CCEC4 — Define e implementa acciones de responsabilidad cultural y artística',
        'CCEC4.1': 'CCEC4.1 — Conoce y aplica los derechos de autoría y respeta la propiedad intelectual',
        'CCEC4.2': 'CCEC4.2 — Participa de forma comprometida y creativa en proyectos culturales y artísticos'
    };

    // ════════════════════════════════════════════════════════════════
    // STATE  (one instance per iDevice node on the page)
    // ════════════════════════════════════════════════════════════════

    var ideviceBody    = null;  // the <article> DOM element
    var instanceId     = null;  // idevice-id attribute value

    var currentDataset = DEFAULT_DATASET;
    var rawData        = null;  // parsed JSON from active dataset
    var dataCache      = {};    // { datasetId: parsedJSON }
    var dataPromises   = {};    // in-flight fetch promises

    var selectedEtapa  = null;
    var selectedNivel  = null;
    var selectedMateria = null; // { codArea, denominacion }
    var activeTab      = 'competencias';

    /** @type {Map<string, Object>} selectionId → selection object */
    var selections = new Map();

    // ════════════════════════════════════════════════════════════════
    // DATA LOADING
    // ════════════════════════════════════════════════════════════════

    function getDataset(id) {
        return DATASETS.find(function (d) { return d.id === id; });
    }

    /**
     * Resolves a path like '../data/lomloe-canarias.json' relative to the
     * iDevice edition script URL, handling eXeLearning API, HTTP and file:// cases.
     */
    function resolveEditionResource(relativePath) {
        // 1. Use eXe.app infrastructure (most reliable: handles BASE_PATH and API paths)
        if (typeof eXe !== 'undefined' && eXe.app &&
            typeof eXe.app.getIdeviceInstalled === 'function') {
            var idevice = eXe.app.getIdeviceInstalled('lomloe');
            if (idevice && typeof idevice.getResourceServicePath === 'function') {
                var basePath = idevice.pathEdition || idevice.path || '';
                if (basePath) {
                    var resolved = resolveRelativePath(basePath, relativePath);
                    return idevice.getResourceServicePath(resolved);
                }
            }
        }
        // 2. Resolve from current script element src attribute (raw value, not DOM property)
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
            var src = scripts[i].getAttribute('src') || '';
            if (src.indexOf('lomloe.js') !== -1 && src.indexOf('/edition/') !== -1) {
                var lastSlash = src.lastIndexOf('/');
                if (lastSlash !== -1) {
                    var base = src.substring(0, lastSlash + 1);
                    try {
                        var fullBase = new URL(base, window.location.href).href;
                        return new URL(relativePath, fullBase).pathname;
                    } catch (e) {
                        return resolveRelativePath(base, relativePath);
                    }
                }
            }
        }
        // 3. Resolve from window location
        return resolveRelativePath(window.location.href, relativePath);
    }

    function resolveRelativePath(base, relative) {
        // Remove trailing slash and query/hash, then split into segments
        var baseClean = base.replace(/\/$/, '').split('?')[0].split('#')[0];
        var baseParts = baseClean.split('/');
        relative.split('/').forEach(function (part) {
            if (part === '..') {
                baseParts.pop();
            } else if (part !== '.' && part !== '') {
                baseParts.push(part);
            }
        });
        return baseParts.join('/');
    }

    function loadData(datasetId) {
        if (dataCache[datasetId]) {
            return Promise.resolve(dataCache[datasetId]);
        }
        if (dataPromises[datasetId]) {
            return dataPromises[datasetId];
        }

        var ds = getDataset(datasetId);
        if (!ds || !ds.available) {
            return Promise.reject(new Error('Dataset not available: ' + datasetId));
        }

        var url = resolveEditionResource(ds.file);

        var promise = (function () {
            if (typeof fetch === 'function') {
                return fetch(url)
                    .then(function (r) {
                        if (!r.ok) throw new Error('HTTP ' + r.status);
                        return r.json();
                    })
                    .catch(function () { return loadViaXHR(url); });
            }
            return loadViaXHR(url);
        }()).then(function (data) {
            dataCache[datasetId] = data;
            delete dataPromises[datasetId];
            return data;
        });

        dataPromises[datasetId] = promise;
        return promise;
    }

    function loadViaXHR(url) {
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { resolve(JSON.parse(xhr.responseText)); }
                    catch (e) { reject(e); }
                } else {
                    reject(new Error('XHR ' + xhr.status));
                }
            };
            xhr.onerror = function () { reject(new Error('Network error')); };
            xhr.send();
        });
    }

    // ════════════════════════════════════════════════════════════════
    // DATA ACCESSORS
    // ════════════════════════════════════════════════════════════════

    var ETAPA_ORDER = ['infantil', 'primaria', 'eso', 'bachillerato'];

    function getEtapas() {
        if (!rawData) return [];
        return Object.keys(rawData).sort(function (a, b) {
            var al = a.toLowerCase();
            var bl = b.toLowerCase();
            var ai = ETAPA_ORDER.length;
            var bi = ETAPA_ORDER.length;
            for (var i = 0; i < ETAPA_ORDER.length; i++) {
                if (al.indexOf(ETAPA_ORDER[i]) !== -1 && ai === ETAPA_ORDER.length) ai = i;
                if (bl.indexOf(ETAPA_ORDER[i]) !== -1 && bi === ETAPA_ORDER.length) bi = i;
            }
            return ai - bi;
        });
    }

    function getNiveles(etapa) {
        return (rawData && rawData[etapa]) ? Object.keys(rawData[etapa]) : [];
    }

    function getMaterias(etapa, nivel) {
        if (!rawData || !rawData[etapa] || !rawData[etapa][nivel]) return [];
        return Object.entries(rawData[etapa][nivel]).map(function (pair) {
            return { codArea: pair[0], denominacion: pair[1].denominacion || pair[0] };
        });
    }

    function getSabereBloques(etapa, nivel, codArea) {
        try {
            return rawData[etapa][nivel][codArea].saberes_basicos.bloques || {};
        } catch (e) { return {}; }
    }

    function getCompetencias(etapa, nivel, codArea) {
        try {
            return rawData[etapa][nivel][codArea].competencias_especificas || {};
        } catch (e) { return {}; }
    }

    // ════════════════════════════════════════════════════════════════
    // SELECTION IDs  (using unit-separator \x1F to avoid collisions)
    // ════════════════════════════════════════════════════════════════

    var SEP = '\x1F';

    function saberSelId(etapa, nivel, codArea, bloque, nombre) {
        return ['saber', etapa, nivel, codArea, bloque, nombre].join(SEP);
    }

    function criterioSelId(etapa, nivel, codArea, codigoComp, codigoCriterio) {
        return ['criterio', etapa, nivel, codArea, codigoComp, codigoCriterio].join(SEP);
    }

    function matGroupKey(etapa, nivel, codArea) {
        return etapa + SEP + nivel + SEP + codArea;
    }

    /** Count selections for a given materia (for the badge). */
    function countSelectionsForMateria(etapa, nivel, codArea) {
        var key = matGroupKey(etapa, nivel, codArea);
        var n = 0;
        selections.forEach(function (sel) {
            if (matGroupKey(sel.etapa, sel.nivel, sel.codArea) === key) n++;
        });
        return n;
    }

    // ════════════════════════════════════════════════════════════════
    // HTML HELPERS
    // ════════════════════════════════════════════════════════════════

    function esc(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function q(id) { return ideviceBody ? ideviceBody.querySelector('#' + id) : null; }
    function qa(sel) { return ideviceBody ? Array.from(ideviceBody.querySelectorAll(sel)) : []; }

    /** Returns data-lomloe-tip attribute consumed by the popover-based tooltip controller. */
    function tipAttr(text) {
        if (!text) return '';
        return ' data-lomloe-tip="' + esc(text) + '"';
    }

    // ────────────────────────────────────────────────────────────────
    // Tooltip controller — single popover element rendered in the top
    // layer (when supported), positioned by JS so it escapes the
    // overflow/stacking context of every parent. Idempotent: shared
    // across all LOMLOE iDevice instances mounted on the page.
    // ────────────────────────────────────────────────────────────────
    function installTooltipController(doc) {
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
    }

    // ════════════════════════════════════════════════════════════════
    // UI SHELL  (rendered once; inner sections re-rendered on change)
    // ════════════════════════════════════════════════════════════════

    function buildShell() {
        var uid = instanceId;

        var datasetOptions = DATASETS.map(function (ds) {
            var sel = (ds.id === currentDataset) ? ' selected' : '';
            var dis = ds.available ? '' : ' disabled';
            return '<option value="' + esc(ds.id) + '"' + sel + dis + '>' + esc(ds.label) + '</option>';
        }).join('');

        ideviceBody.innerHTML = [
            '<div class="lomloe-editor" id="lomloe-editor-' + uid + '">',

            // ── Header ───────────────────────────────────────────
            '<div class="lomloe-header">',
            '  <label>',
            '    <span>' + _('Marco legal:') + '</span>',
            '    <select id="lomloe-fw-' + uid + '" disabled>',
            '      <option value="lomloe">LOMLOE (España)</option>',
            '    </select>',
            '  </label>',
            '  <label>',
            '    <span>' + _('Concreción:') + '</span>',
            '    <select id="lomloe-ds-' + uid + '">' + datasetOptions + '</select>',
            '  </label>',
            '</div>',

            // ── Dataset not-available notice (shown when needed) ─
            '<div class="lomloe-dataset-notice" id="lomloe-notice-' + uid + '" hidden>',
            '  ⚠️ ' + _('Este conjunto de datos no está disponible todavía. Se añadirá en una próxima versión.'),
            '</div>',

            // ── Two-column layout ────────────────────────────────
            '<div class="lomloe-layout">',

            //   LEFT: browser panel
            '  <section class="lomloe-panel lomloe-browser" id="lomloe-browser-' + uid + '">',
            '    <div class="lomloe-panel-header">' + _('Selector de elementos curriculares') + '</div>',
            '    <div id="lomloe-loading-' + uid + '" class="lomloe-loading">' + _('Cargando datos curriculares…') + '</div>',
            '    <div id="lomloe-browser-body-' + uid + '" class="lomloe-browser-body" hidden>',
            '      <!-- Etapa buttons -->',
            '      <div class="lomloe-etapa-bar" id="lomloe-etapas-' + uid + '"></div>',
            '      <!-- Nivel buttons -->',
            '      <div class="lomloe-nivel-bar" id="lomloe-niveles-' + uid + '"></div>',
            '      <!-- Materia list + content -->',
            '      <div class="lomloe-materia-content">',
            '        <div class="lomloe-materia-col">',
            '          <input class="lomloe-materia-search" id="lomloe-mat-search-' + uid + '"',
            '            type="search" placeholder="' + _('Filtrar materias…') + '" autocomplete="off">',
            '          <ul class="lomloe-materia-list" id="lomloe-mat-list-' + uid + '"></ul>',
            '        </div>',
            '        <div class="lomloe-content-col">',
            '          <div class="lomloe-tabs">',
            '            <button class="lomloe-tab-btn active" data-tab="competencias" id="lomloe-tab-comp-' + uid + '">',
            '              🎯 ' + _('Criterios de evaluación'),
            '            </button>',
            '            <button class="lomloe-tab-btn" data-tab="saberes" id="lomloe-tab-sab-' + uid + '">',
            '              📚 ' + _('Saberes Básicos'),
            '            </button>',
            '          </div>',
            '          <div class="lomloe-tab-content" id="lomloe-content-' + uid + '">',
            '            <div class="lomloe-no-materia" id="lomloe-no-mat-' + uid + '">',
            '              ← ' + _('Selecciona una materia'),
            '            </div>',
            '            <div id="lomloe-items-' + uid + '" hidden></div>',
            '          </div>',
            '        </div>',
            '      </div>',
            '    </div>',
            '  </section>',

            //   RIGHT: selections panel
            '  <aside class="lomloe-panel lomloe-selected-panel">',
            '    <div class="lomloe-selected-header">',
            '      <span>' + _('Seleccionados') + '</span>',
            '      <span class="lomloe-selected-count" id="lomloe-sel-count-' + uid + '">0</span>',
            '    </div>',
            '    <div class="lomloe-selected-list" id="lomloe-sel-list-' + uid + '">',
            '      <div class="lomloe-selected-empty">' + _('Aún no hay elementos seleccionados.') + '</div>',
            '    </div>',
            '    <div class="lomloe-actions">',
            '      <button class="lomloe-btn lomloe-btn-primary" id="lomloe-preview-' + uid + '" disabled>',
            '        👁 ' + _('Vista previa del resumen'),
            '      </button>',
            '      <button class="lomloe-btn lomloe-btn-secondary" id="lomloe-reset-' + uid + '">',
            '        🔄 ' + _('Restablecer selección'),
            '      </button>',
            '    </div>',
            '  </aside>',

            '</div>', // .lomloe-layout

            // ── Modal: summary preview ───────────────────────────
            '<div class="lomloe-modal-overlay" id="lomloe-modal-' + uid + '" hidden role="dialog" aria-modal="true">',
            '  <div class="lomloe-modal-box">',
            '    <div class="lomloe-modal-top">',
            '      <h2>' + _('Resumen de la fundamentación curricular') + '</h2>',
            '      <button class="lomloe-modal-close" id="lomloe-modal-close-' + uid + '" aria-label="' + _('Cerrar') + '">✕</button>',
            '    </div>',
            '    <div class="lomloe-modal-body" id="lomloe-modal-body-' + uid + '"></div>',
            '  </div>',
            '</div>',

            '</div>' // .lomloe-editor
        ].join('\n');

        attachEvents();
    }

    // ════════════════════════════════════════════════════════════════
    // EVENT WIRING
    // ════════════════════════════════════════════════════════════════

    function attachEvents() {
        var uid = instanceId;

        // Dataset selector
        var dsSelect = q('lomloe-ds-' + uid);
        if (dsSelect) {
            dsSelect.addEventListener('change', function () {
                onDatasetChange(this.value);
            });
        }

        // Etapa bar (event delegation)
        var etapaBar = q('lomloe-etapas-' + uid);
        if (etapaBar) {
            etapaBar.addEventListener('click', function (e) {
                var btn = e.target.closest('.lomloe-etapa-btn');
                if (btn) onEtapaClick(btn.dataset.etapa);
            });
        }

        // Nivel bar (event delegation)
        var nivelBar = q('lomloe-niveles-' + uid);
        if (nivelBar) {
            nivelBar.addEventListener('click', function (e) {
                var btn = e.target.closest('.lomloe-nivel-btn');
                if (btn) onNivelClick(btn.dataset.nivel);
            });
        }

        // Materia search
        var matSearch = q('lomloe-mat-search-' + uid);
        if (matSearch) {
            matSearch.addEventListener('input', function () {
                renderMateriaList(this.value.toLowerCase());
            });
        }

        // Materia list (event delegation)
        var matList = q('lomloe-mat-list-' + uid);
        if (matList) {
            matList.addEventListener('click', function (e) {
                var item = e.target.closest('.lomloe-materia-item');
                if (item) onMateriaClick(item.dataset.codarea, item.dataset.denominacion);
            });
        }

        // Tab buttons
        var tabs = qa('.lomloe-tab-btn');
        tabs.forEach(function (btn) {
            btn.addEventListener('click', function () {
                onTabClick(this.dataset.tab);
            });
        });

        // Content area: saberes checkboxes + block collapse (delegation)
        var itemsArea = q('lomloe-items-' + uid);
        if (itemsArea) {
            itemsArea.addEventListener('change', function (e) {
                if (e.target.type === 'checkbox') {
                    onCheckboxChange(e.target);
                }
            });
            itemsArea.addEventListener('click', function (e) {
                var blockHdr = e.target.closest('.lomloe-block-header');
                if (blockHdr) toggleBlock(blockHdr);
                var compHdr = e.target.closest('.lomloe-comp-header');
                if (compHdr) toggleComp(compHdr);
                // Click anywhere on a saber/criterio row toggles its checkbox
                if (e.target.type !== 'checkbox') {
                    var row = e.target.closest('.lomloe-saber-item, .lomloe-criterio-item');
                    if (row) {
                        var cb = row.querySelector('input[type="checkbox"]');
                        if (cb) {
                            cb.checked = !cb.checked;
                            onCheckboxChange(cb);
                        }
                    }
                }
            });
        }

        // Selected list: partial/remove (delegation)
        var selList = q('lomloe-sel-list-' + uid);
        if (selList) {
            selList.addEventListener('change', function (e) {
                var selId = e.target.dataset.selid;
                if (!selId) return;
                if (e.target.classList.contains('lomloe-partial-cb')) {
                    onPartialChange(selId, e.target.checked);
                }
            });
            selList.addEventListener('click', function (e) {
                var btn = e.target.closest('.lomloe-sel-remove');
                if (btn) onRemoveSelection(btn.dataset.selid);
            });
        }

        // Preview button
        var previewBtn = q('lomloe-preview-' + uid);
        if (previewBtn) {
            previewBtn.addEventListener('click', openModal);
        }

        // Reset button
        var resetBtn = q('lomloe-reset-' + uid);
        if (resetBtn) {
            resetBtn.addEventListener('click', onReset);
        }

        // Modal close
        var modalClose = q('lomloe-modal-close-' + uid);
        if (modalClose) {
            modalClose.addEventListener('click', closeModal);
        }

        var modal = q('lomloe-modal-' + uid);
        if (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) closeModal();
            });
        }

        // Global Escape key (remove first to prevent duplicates on re-init)
        document.removeEventListener('keydown', onKeyDown);
        document.addEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
        if (e.key === 'Escape') closeModal();
    }

    // ════════════════════════════════════════════════════════════════
    // EVENT HANDLERS
    // ════════════════════════════════════════════════════════════════

    function onDatasetChange(id) {
        var ds = getDataset(id);
        var notice = q('lomloe-notice-' + instanceId);
        if (!ds || !ds.available) {
            if (notice) notice.hidden = false;
            return;
        }
        if (notice) notice.hidden = true;
        currentDataset = id;
        rawData = null;
        selectedEtapa = null;
        selectedNivel = null;
        selectedMateria = null;
        showLoading();
        loadAndRender();
    }

    function onEtapaClick(etapa) {
        selectedEtapa = etapa;
        selectedNivel = null;
        selectedMateria = null;
        renderEtapaBar();
        renderNivelBar();
        renderMateriaList();
        clearContent();
    }

    function onNivelClick(nivel) {
        selectedNivel = nivel;
        selectedMateria = null;
        renderNivelBar();
        renderMateriaList();
        clearContent();
    }

    function onMateriaClick(codArea, denominacion) {
        selectedMateria = { codArea: codArea, denominacion: denominacion };
        renderMateriaList();  // refresh badges
        renderContent();
    }

    function onTabClick(tab) {
        activeTab = tab;
        qa('.lomloe-tab-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.tab === tab);
        });
        renderContent();
    }

    function onCheckboxChange(checkbox) {
        var type = checkbox.dataset.type;
        var id = checkbox.dataset.id;
        if (type === 'saber') {
            toggleSaber(id, checkbox.checked);
        } else if (type === 'criterio') {
            toggleCriterio(id, checkbox.checked);
        }
    }

    function toggleSaber(selId, checked) {
        if (!checked) {
            selections.delete(selId);
        } else if (!selections.has(selId)) {
            // Decode the ID to reconstruct the full saber object
            var parts = selId.split(SEP);
            // parts: ['saber', etapa, nivel, codArea, bloque, nombre]
            var etapa   = parts[1];
            var nivel   = parts[2];
            var codArea = parts[3];
            var bloque  = parts[4];
            var nombre  = parts[5];
            // Look up saber data
            var bloques = getSabereBloques(etapa, nivel, codArea);
            var items = bloques[bloque] || [];
            var saber = items.find(function (s) { return s.nombre === nombre; }) || {};
            var matDenom = '';
            try { matDenom = rawData[etapa][nivel][codArea].denominacion || codArea; } catch (e) {}
            selections.set(selId, {
                id: selId,
                type: 'saber',
                dataset: currentDataset,
                etapa: etapa,
                nivel: nivel,
                codArea: codArea,
                denominacion: matDenom,
                bloque: bloque,
                nombre: nombre,
                subtitulo1: saber.subtitulo_nivel_1 || '',
                subtitulo2: saber.subtitulo_nivel_2 || ''
            });
        }
        refreshMateriaSelBadge();
        renderSelectedPanel();
    }

    function toggleCriterio(selId, checked) {
        if (!checked) {
            selections.delete(selId);
        } else if (!selections.has(selId)) {
            var parts = selId.split(SEP);
            // parts: ['criterio', etapa, nivel, codArea, codigoComp, codigoCriterio]
            var etapa          = parts[1];
            var nivel          = parts[2];
            var codArea        = parts[3];
            var codigoComp     = parts[4];
            var codigoCriterio = parts[5];
            var comps = getCompetencias(etapa, nivel, codArea);
            var comp = comps[codigoComp] || {};
            var criterios = comp.criterios_evaluacion || [];
            var crit = criterios.find(function (c) { return c.codigo === codigoCriterio; }) || {};
            var matDenom = '';
            try { matDenom = rawData[etapa][nivel][codArea].denominacion || codArea; } catch (e) {}
            selections.set(selId, {
                id: selId,
                type: 'criterio',
                dataset: currentDataset,
                etapa: etapa,
                nivel: nivel,
                codArea: codArea,
                denominacion: matDenom,
                codigoComp: codigoComp,
                descripcionComp: comp.descripcion || '',
                codigoCriterio: codigoCriterio,
                descripcionCriterio: crit.descripcion || '',
                competenciasClave: crit.competencias_clave || [],
                partial: false
            });
        }
        refreshMateriaSelBadge();
        renderSelectedPanel();
    }

    function onPartialChange(selId, checked) {
        if (selections.has(selId)) {
            selections.get(selId).partial = checked;
        }
    }

    function onRemoveSelection(selId) {
        selections.delete(selId);
        // Uncheck the matching checkbox if visible
        var cb = ideviceBody && ideviceBody.querySelector(
            'input[type="checkbox"][data-id="' + CSS.escape(selId) + '"]'
        );
        if (cb) cb.checked = false;
        refreshMateriaSelBadge();
        renderSelectedPanel();
    }

    function onReset() {
        if (selections.size === 0) return;
        if (!window.confirm(_('¿Restablecer toda la selección? Se perderán los cambios.'))) return;
        selections.clear();
        // Uncheck all visible checkboxes
        qa('input[type="checkbox"][data-id]').forEach(function (cb) { cb.checked = false; });
        renderMateriaList();
        renderSelectedPanel();
    }

    function toggleBlock(header) {
        header.classList.toggle('collapsed');
        var items = header.nextElementSibling;
        if (items) items.classList.toggle('hidden');
    }

    function toggleComp(header) {
        header.classList.toggle('collapsed');
        var criterios = header.nextElementSibling;
        if (criterios) criterios.classList.toggle('hidden');
    }

    // ════════════════════════════════════════════════════════════════
    // RENDER: BROWSER SECTIONS
    // ════════════════════════════════════════════════════════════════

    function showLoading() {
        var loading = q('lomloe-loading-' + instanceId);
        var body    = q('lomloe-browser-body-' + instanceId);
        if (loading) loading.hidden = false;
        if (body)    body.hidden    = true;
    }

    function showBrowserBody() {
        var loading = q('lomloe-loading-' + instanceId);
        var body    = q('lomloe-browser-body-' + instanceId);
        if (loading) loading.hidden = true;
        if (body)    body.hidden    = false;
    }

    function renderEtapaBar() {
        var bar = q('lomloe-etapas-' + instanceId);
        if (!bar) return;
        var etapas = getEtapas();
        bar.innerHTML = etapas.map(function (e) {
            var active = (e === selectedEtapa) ? ' active' : '';
            return '<button class="lomloe-etapa-btn' + active + '" data-etapa="' + esc(e) + '">' + esc(e) + '</button>';
        }).join('');
    }

    function renderNivelBar() {
        var bar = q('lomloe-niveles-' + instanceId);
        if (!bar) return;
        if (!selectedEtapa) { bar.innerHTML = ''; return; }
        var niveles = getNiveles(selectedEtapa);
        bar.innerHTML = niveles.map(function (n) {
            var active = (n === selectedNivel) ? ' active' : '';
            return '<button class="lomloe-nivel-btn' + active + '" data-nivel="' + esc(n) + '">' + esc(n) + '</button>';
        }).join('');
    }

    function renderMateriaList(filterText) {
        var list = q('lomloe-mat-list-' + instanceId);
        if (!list) return;
        if (!selectedEtapa || !selectedNivel) {
            list.innerHTML = '<li class="lomloe-materia-placeholder">' +
                _('Selecciona etapa y nivel') + '</li>';
            return;
        }
        var materias = getMaterias(selectedEtapa, selectedNivel);
        var filter = (filterText || '').toLowerCase().trim();
        if (filter) {
            materias = materias.filter(function (m) {
                return m.denominacion.toLowerCase().includes(filter) ||
                       m.codArea.toLowerCase().includes(filter);
            });
        }
        if (!materias.length) {
            list.innerHTML = '<li class="lomloe-materia-placeholder">' +
                _('Sin resultados') + '</li>';
            return;
        }
        list.innerHTML = materias.map(function (m) {
            var active = (selectedMateria && selectedMateria.codArea === m.codArea) ? ' active' : '';
            var count = countSelectionsForMateria(selectedEtapa, selectedNivel, m.codArea);
            var badge = count > 0 ? '<span class="lomloe-sel-count">' + count + '</span>' : '';
            return '<li class="lomloe-materia-item' + active + '" ' +
                'data-codarea="' + esc(m.codArea) + '" ' +
                'data-denominacion="' + esc(m.denominacion) + '">' +
                esc(m.denominacion) + badge +
                '</li>';
        }).join('');
    }

    function refreshMateriaSelBadge() {
        if (!selectedEtapa || !selectedNivel) return;
        // Re-render just the badges in the materia list without resetting scroll/selection
        var matSearch = q('lomloe-mat-search-' + instanceId);
        var filter = matSearch ? matSearch.value : '';
        renderMateriaList(filter);
    }

    function clearContent() {
        var noMat  = q('lomloe-no-mat-' + instanceId);
        var items  = q('lomloe-items-' + instanceId);
        if (noMat) noMat.hidden = false;
        if (items) { items.hidden = true; items.innerHTML = ''; }
    }

    function renderContent() {
        var noMat = q('lomloe-no-mat-' + instanceId);
        var items = q('lomloe-items-' + instanceId);
        if (!selectedMateria || !noMat || !items) return;
        noMat.hidden = true;
        items.hidden = false;
        if (activeTab === 'saberes') {
            items.innerHTML = buildSaberesHtml();
        } else {
            items.innerHTML = buildCompetenciasHtml();
        }
        // Restore checkbox states from current selections
        items.querySelectorAll('input[type="checkbox"][data-id]').forEach(function (cb) {
            cb.checked = selections.has(cb.dataset.id);
        });
    }

    // ════════════════════════════════════════════════════════════════
    // RENDER: SABERES
    // ════════════════════════════════════════════════════════════════

    function buildSaberesHtml() {
        if (!selectedMateria) return '';
        var bloques = getSabereBloques(selectedEtapa, selectedNivel, selectedMateria.codArea);
        var bloqueKeys = Object.keys(bloques);
        if (!bloqueKeys.length) {
            return '<div class="lomloe-no-materia">' + _('No hay saberes básicos para esta materia.') + '</div>';
        }
        return bloqueKeys.map(function (bloque) {
            var items = bloques[bloque];
            var itemsHtml = items.map(function (saber) {
                var selId = saberSelId(selectedEtapa, selectedNivel, selectedMateria.codArea, bloque, saber.nombre);
                return [
                    '<div class="lomloe-saber-item">',
                    '  <input type="checkbox" data-type="saber" data-id="' + esc(selId) + '">',
                    '  <div class="lomloe-saber-texts">',
                    '    <span class="lomloe-saber-code">' + esc(saber.nombre) + '</span>',
                    saber.subtitulo_nivel_1
                        ? '<div class="lomloe-saber-s1">' + esc(saber.subtitulo_nivel_1) + '</div>'
                        : '',
                    saber.subtitulo_nivel_2
                        ? '<div class="lomloe-saber-s2">' + esc(saber.subtitulo_nivel_2) + '</div>'
                        : '',
                    '  </div>',
                    '</div>'
                ].join('');
            }).join('');

            return [
                '<div class="lomloe-block">',
                '  <div class="lomloe-block-header">',
                '    <span class="lomloe-block-toggle">▾</span>',
                '    <span>' + esc(bloque) + '</span>',
                '  </div>',
                '  <div class="lomloe-block-items">' + itemsHtml + '</div>',
                '</div>'
            ].join('');
        }).join('');
    }

    // ════════════════════════════════════════════════════════════════
    // RENDER: COMPETENCIAS
    // ════════════════════════════════════════════════════════════════

    function buildCompetenciasHtml() {
        if (!selectedMateria) return '';
        var comps = getCompetencias(selectedEtapa, selectedNivel, selectedMateria.codArea);
        var compKeys = Object.keys(comps);
        if (!compKeys.length) {
            return '<div class="lomloe-no-materia">' + _('No hay competencias específicas para esta materia.') + '</div>';
        }
        return compKeys.map(function (codComp) {
            var comp = comps[codComp];
            var criterios = comp.criterios_evaluacion || [];
            var criteriosHtml = criterios.map(function (crit) {
                var selId = criterioSelId(selectedEtapa, selectedNivel, selectedMateria.codArea, codComp, crit.codigo);
                var ccTags = (crit.competencias_clave || []).map(function (cc) {
                    var title = CC_DESCRIPTIONS[cc] || cc;
                    return '<span class="lomloe-cc-tag" title="' + esc(title) + '">' + esc(cc) + '</span>';
                }).join('');
                return [
                    '<div class="lomloe-criterio-item">',
                    '  <input type="checkbox" data-type="criterio" data-id="' + esc(selId) + '">',
                    '  <div class="lomloe-criterio-texts">',
                    '    <span class="lomloe-criterio-code">' + esc(crit.codigo) + '</span>',
                    '    <div class="lomloe-criterio-desc">' + esc(crit.descripcion) + '</div>',
                    ccTags ? '<div class="lomloe-cc-tags">' + ccTags + '</div>' : '',
                    '  </div>',
                    '</div>'
                ].join('');
            }).join('');

            return [
                '<div class="lomloe-comp-item">',
                '  <div class="lomloe-comp-header">',
                '    <span class="lomloe-comp-toggle">▾</span>',
                '    <span class="lomloe-comp-code">' + esc(codComp) + '</span>',
                '    <span class="lomloe-comp-desc">' + esc(comp.descripcion) + '</span>',
                '  </div>',
                '  <div class="lomloe-criterios">' + criteriosHtml + '</div>',
                '</div>'
            ].join('');
        }).join('');
    }

    // ════════════════════════════════════════════════════════════════
    // RENDER: SELECTED PANEL
    // ════════════════════════════════════════════════════════════════

    function renderSelectedPanel() {
        var countEl = q('lomloe-sel-count-' + instanceId);
        var listEl  = q('lomloe-sel-list-' + instanceId);
        var previewBtn = q('lomloe-preview-' + instanceId);
        if (!listEl) return;

        var count = selections.size;
        if (countEl) countEl.textContent = count;
        if (previewBtn) previewBtn.disabled = (count === 0);

        if (count === 0) {
            listEl.innerHTML = '<div class="lomloe-selected-empty">' +
                _('Aún no hay elementos seleccionados.') + '</div>';
            return;
        }

        // Group by materia
        var groups = new Map(); // groupKey → { label, items[] }
        selections.forEach(function (sel) {
            var key = matGroupKey(sel.etapa, sel.nivel, sel.codArea);
            if (!groups.has(key)) {
                groups.set(key, {
                    label: sel.etapa + ' · ' + sel.nivel + ' · ' + sel.denominacion,
                    items: []
                });
            }
            groups.get(key).items.push(sel);
        });

        var html = '';
        groups.forEach(function (group) {
            html += '<div class="lomloe-selected-group-title">' + esc(group.label) + '</div>';
            group.items.forEach(function (sel) {
                html += buildSelItemHtml(sel);
            });
        });

        listEl.innerHTML = html;

        // Restore current partial values
        selections.forEach(function (sel) {
            var partialCb = listEl.querySelector(
                'input.lomloe-partial-cb[data-selid="' + CSS.escape(sel.id) + '"]'
            );
            if (partialCb) partialCb.checked = !!sel.partial;
        });

    }

    function buildSelItemHtml(sel) {
        var icon = sel.type === 'saber' ? '📚' : '🎯';
        var code = sel.type === 'saber' ? sel.nombre : sel.codigoCriterio;
        var tooltip = sel.type === 'saber'
            ? ((sel.subtitulo1 || '') + (sel.subtitulo2 ? ' — ' + sel.subtitulo2 : ''))
            : (sel.descripcionCriterio || '');

        var metaHtml = '';
        if (sel.type === 'criterio') {
            metaHtml = [
                '  <div class="lomloe-sel-meta">',
                '    <label class="lomloe-sel-partial-label">',
                '      <input type="checkbox" class="lomloe-partial-cb" data-selid="' + esc(sel.id) + '"' + (sel.partial ? ' checked' : '') + '>',
                '      ' + _('Parcial'),
                '    </label>',
                '  </div>'
            ].join('');
        }

        return [
            '<div class="lomloe-sel-item">',
            '  <div class="lomloe-sel-item-top">',
            '    <span class="lomloe-sel-type-icon">' + icon + '</span>',
            '    <div class="lomloe-sel-label"' + tipAttr(tooltip) + '>',
            '      <span class="lomloe-sel-code">' + esc(code) + '</span>',
            '    </div>',
            '    <button class="lomloe-sel-remove" data-selid="' + esc(sel.id) + '" title="' + _('Eliminar') + '">✕</button>',
            '  </div>',
            metaHtml,
            '</div>'
        ].join('');
    }

    // ════════════════════════════════════════════════════════════════
    // SUMMARY GENERATION
    // ════════════════════════════════════════════════════════════════

    /**
     * Generates the complete summary HTML for both modal preview and export.
     * The export renderer ($Lomloe) can use pre-rendered HTML or regenerate
     * from the selections array — both approaches are supported.
     */
    /**
     * Determines the column header for competencias clave based on etapa.
     * Infantil uses "Comp. Clave", Primaria/ESO/Bachillerato use "Descriptores operativos".
     */
    function isInfantil(etapa) {
        return etapa && etapa.toLowerCase().indexOf('infantil') !== -1;
    }

    function getCompClaveHeader(etapa) {
        if (isInfantil(etapa)) {
            return _('Comp. Clave');
        }
        return _('Descriptores operativos');
    }

    function generateSummaryHtml() {
        var sels = Array.from(selections.values());
        if (!sels.length) {
            return '<p>' + _('No hay elementos curriculares seleccionados.') + '</p>';
        }

        var ds = getDataset(currentDataset);
        var datasetLabel = ds ? ds.label : currentDataset;

        var criterios = sels.filter(function (s) { return s.type === 'criterio'; });
        var saberes = sels.filter(function (s) { return s.type === 'saber'; });

        var html = '';
        html += '<h3 class="lomloe-export-title">' + _('Fundamentación Curricular LOMLOE') + '</h3>';
        html += '<p class="lomloe-export-meta">';
        html += _('Fundamentación') + ': <strong>' + esc(datasetLabel) + '</strong>';
        html += ' &nbsp;|&nbsp; ' + _('Elementos seleccionados') + ': <strong>' + sels.length + '</strong>';
        if (criterios.length) html += ' (' + criterios.length + ' ' + _('criterios');
        if (saberes.length && criterios.length) html += ', ' + saberes.length + ' ' + _('saberes') + ')';
        else if (criterios.length) html += ')';
        else if (saberes.length) html += ' (' + saberes.length + ' ' + _('saberes') + ')';
        html += '</p>';

        if (criterios.length) {
            var ccHeader = getCompClaveHeader(criterios[0].etapa);
            var infantil = isInfantil(criterios[0].etapa);
            var hasSaberes = saberes.length > 0;

            // Group by competencia específica
            var compGroups = new Map();
            var totalCriterioRows = 0;
            criterios.forEach(function (sel) {
                var compKey = sel.codigoComp || '';
                if (!compGroups.has(compKey)) {
                    compGroups.set(compKey, {
                        codigoComp: sel.codigoComp,
                        descripcionComp: sel.descripcionComp || '',
                        items: []
                    });
                }
                compGroups.get(compKey).items.push(sel);
                totalCriterioRows++;
            });

            html += '<table class="lomloe-export-table">';
            html += '<thead><tr>';
            html += '<th' + tipAttr(_('Competencias Específicas')) + '>' + _('Comp. Específica') + '</th>';
            if (infantil) {
                html += '<th' + tipAttr(_('Competencias Clave')) + '>' + esc(ccHeader) + '</th>';
                html += '<th' + tipAttr(_('Criterios de evaluación')) + '>' + _('Criterios de Eval.') + '</th>';
            } else {
                html += '<th' + tipAttr(_('Criterios de evaluación')) + '>' + _('Criterios de Eval.') + '</th>';
                html += '<th' + tipAttr(_('Descriptores operativos')) + '>' + esc(ccHeader) + '</th>';
            }
            if (hasSaberes) html += '<th>' + _('Saberes Básicos') + '</th>';
            html += '</tr></thead><tbody>';

            var isFirstCriterioRow = true;
            compGroups.forEach(function (group) {
                var isFirstInGroup = true;
                group.items.forEach(function (sel) {
                    html += '<tr>';
                    if (isFirstInGroup) {
                        var compTip = [sel.etapa, sel.nivel, sel.denominacion]
                            .filter(Boolean).join(' · ');
                        if (group.descripcionComp) {
                            compTip += (compTip ? '\n\n' : '') + group.descripcionComp;
                        }
                        html += '<td rowspan="' + group.items.length + '"><strong' + tipAttr(compTip) + '>' + esc(group.codigoComp) + '</strong></td>';
                        isFirstInGroup = false;
                    }
                    var criterioCell = '<td>';
                    criterioCell += '<span class="lomloe-criterio-code-badge"' + tipAttr(sel.descripcionCriterio) + '>' + esc(sel.codigoCriterio) + '</span>';
                    if (sel.partial) {
                        criterioCell += ' <span class="lomloe-partial-indicator">(' + _('parcial') + ')</span>';
                    }
                    criterioCell += '</td>';
                    var ccCell = '<td>';
                    (sel.competenciasClave || []).forEach(function (cc) {
                        var ccTitle = CC_DESCRIPTIONS[cc] || cc;
                        ccCell += '<span class="lomloe-cc-badge"' + tipAttr(ccTitle) + '>' + esc(cc) + '</span>';
                    });
                    ccCell += '</td>';
                    if (infantil) {
                        html += ccCell + criterioCell;
                    } else {
                        html += criterioCell + ccCell;
                    }
                    // Single shared Saberes cell on first row
                    if (hasSaberes && isFirstCriterioRow) {
                        html += '<td rowspan="' + totalCriterioRows + '" class="lomloe-saberes-cell">';
                        saberes.forEach(function (sab) {
                            var sabTip = (sab.subtitulo1 || '') + (sab.subtitulo2 ? ' — ' + sab.subtitulo2 : '');
                            html += '<span class="lomloe-saber-link-badge"' + tipAttr(sabTip) + '>';
                            html += esc(sab.nombre);
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
            html += '<table class="lomloe-export-table">';
            html += '<thead><tr>';
            html += '<th>' + _('Saberes Básicos') + '</th>';
            html += '</tr></thead><tbody>';

            saberes.forEach(function (sel) {
                var sabTip = (sel.subtitulo1 || '') + (sel.subtitulo2 ? ' — ' + sel.subtitulo2 : '');
                html += '<tr>';
                html += '<td><span class="lomloe-saber-link-badge"' + tipAttr(sabTip) + '>' + esc(sel.nombre) + '</span></td>';
                html += '</tr>';
            });

            html += '</tbody></table>';
        }

        return html;
    }

    // ════════════════════════════════════════════════════════════════
    // MODAL
    // ════════════════════════════════════════════════════════════════

    function openModal() {
        var modal = q('lomloe-modal-' + instanceId);
        var body  = q('lomloe-modal-body-' + instanceId);
        if (!modal) return;
        if (body) {
            // Wrap in .lomloeIdeviceContent so the export CSS variables
            // (defined on that selector) apply to the preview HTML.
            body.innerHTML = '<div class="lomloeIdeviceContent">' + generateSummaryHtml() + '</div>';
        }
        modal.hidden = false;
        modal.focus && modal.focus();
    }

    function closeModal() {
        var modal = q('lomloe-modal-' + instanceId);
        if (modal) modal.hidden = true;
    }

    // ════════════════════════════════════════════════════════════════
    // DATA LOAD + INITIAL RENDER
    // ════════════════════════════════════════════════════════════════

    function loadAndRender() {
        loadData(currentDataset).then(function (data) {
            rawData = data;
            showBrowserBody();
            // Pick first etapa and nivel automatically
            var etapas = getEtapas();
            if (etapas.length) {
                selectedEtapa = selectedEtapa || etapas[0];
                var niveles = getNiveles(selectedEtapa);
                selectedNivel = selectedNivel || (niveles.length ? niveles[0] : null);
            }
            renderEtapaBar();
            renderNivelBar();
            renderMateriaList();
            // Restore materia if it was previously selected and still exists
            if (selectedMateria) renderContent();
            renderSelectedPanel();
        }).catch(function (err) {
            var loading = q('lomloe-loading-' + instanceId);
            if (loading) loading.innerHTML = '❌ ' + _('Error al cargar los datos: ') + esc(err.message);
        });
    }

    // ════════════════════════════════════════════════════════════════
    // PUBLIC INTERFACE  (eXeLearning iDevice API)
    // ════════════════════════════════════════════════════════════════

    return {
        /**
         * Called by eXeLearning when the iDevice is first created or loaded.
         * @param {HTMLElement} element    The iDevice article element.
         * @param {Object|null} previousData  Previously saved state (null on first creation).
         */
        init: function (element, previousData) {
            ideviceBody    = element;
            instanceId     = element.getAttribute('idevice-id') || String(Date.now());
            currentDataset = DEFAULT_DATASET;
            rawData        = null;
            selectedEtapa  = null;
            selectedNivel  = null;
            selectedMateria = null;
            activeTab      = 'competencias';
            selections     = new Map();

            // Restore state from previous session
            if (previousData && previousData.lomloeSelections) {
                currentDataset = previousData.lomloeDataset || DEFAULT_DATASET;
                activeTab      = previousData.lomloeActiveTab || 'competencias';
                previousData.lomloeSelections.forEach(function (sel) {
                    // Migrate old data: remove coverage/notes/linkedSaberes, ensure partial
                    delete sel.coverage;
                    delete sel.notes;
                    delete sel.linkedSaberes;
                    if (sel.type === 'criterio') {
                        if (sel.partial === undefined) sel.partial = false;
                    }
                    selections.set(sel.id, sel);
                });
                selectedEtapa   = previousData.lomloeSelectedEtapa   || null;
                selectedNivel   = previousData.lomloeSelectedNivel    || null;
                selectedMateria = previousData.lomloeSelectedMateria  || null;
            }

            buildShell();
            showLoading();
            loadAndRender();
            installTooltipController(element && element.ownerDocument);
        },

        /**
         * Called by eXeLearning when it needs to persist the iDevice state.
         * @returns {Object} The data object to be stored in the Yjs document.
         */
        save: function () {
            // Ensure partial from live DOM is captured before saving
            var selList = q('lomloe-sel-list-' + instanceId);
            if (selList) {
                selList.querySelectorAll('.lomloe-partial-cb[data-selid]').forEach(function (cb) {
                    var s = selections.get(cb.dataset.selid);
                    if (s) s.partial = cb.checked;
                });
            }

            return {
                ideviceId:              ideviceBody.getAttribute('idevice-id'),
                lomloeDataset:          currentDataset,
                lomloeActiveTab:        activeTab,
                lomloeSelectedEtapa:    selectedEtapa,
                lomloeSelectedNivel:    selectedNivel,
                lomloeSelectedMateria:  selectedMateria,
                lomloeSelections:       Array.from(selections.values()),
                lomloeSummaryHtml:      generateSummaryHtml()
            };
        }
    };
}());
