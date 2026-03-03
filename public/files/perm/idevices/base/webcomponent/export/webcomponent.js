/**
 * Web Component iDevice (export code)
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: Manuel Narváez Martínez
 * License: http://creativecommons.org/licenses/by-sa/4.0/
 */
var $WebComponent = {
    idevicePath: '',
    isInExe: false,
    userName: '',
    previousScore: '',
    options: [],
    loadedInlineScripts: new Set(),

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Web Component',
            'webcomponent',
            'webcomponent-IDevice'
        );
    },

    enable: function () {
        $WebComponent.loadGme();
    },

    loadGme: function () {
        $WebComponent.options = [];
        $WebComponent.activities.each(function (i) {
            const $activity = $(this);
            const idNode =
                $activity
                    .closest('.idevice_node.webcomponent, .idevice_node')
                    .attr('id') || '';
            const savedId =
                $('.game-evaluation-ids', $activity).eq(0).attr('data-id') || '';
            const dl = $('.webcomponent-DataGame', this);
            if (dl.length === 0) return; // Skip already initialized activities

            const json = dl.text();
            const data = $exeDevices.iDevice.gamification.helpers.isJsonString(json);
            if (!data) return;

            data.id = idNode || savedId || data.id || '';
            data.main = 'wcContainer-' + i;
            data.idevice = 'webcomponent-IDevice';
            data.idevicePath = $WebComponent.idevicePath;
            data.scorerp = 0;
            data.hits = 0;
            data.total = 1;
            data.gameStarted = false;
            data.obtainedClue = false;

            const instructionsNode = $('.webcomponent-instructions', this).eq(0);
            const textAfterNode = $('.webcomponent-extra-content', this).eq(0);
            const instructionsStored = $WebComponent.decodeStoredHtml(data.instructions || '');
            const textAfterStored = $WebComponent.decodeStoredHtml(data.textAfter || '');
            const instructionsHtml =
                instructionsNode.length === 1
                    ? instructionsNode.html()
                    : instructionsStored;
            const textAfterHtml =
                textAfterNode.length === 1 ? textAfterNode.html() : textAfterStored;

            const extracted = $WebComponent.extractScriptsFromHtml(instructionsHtml || '');
            data.instructionsContent = extracted.html;
            data.textAfterContent = textAfterHtml || '';
            data.scriptDefs = extracted.scriptDefs;

            $WebComponent.options.push(data);

            const component = $WebComponent.CreateInterface(i);
            dl.before(component).remove();
            instructionsNode.remove();
            textAfterNode.remove();

            $WebComponent.executeScripts(data.scriptDefs || []);

            const container = document.getElementById('wcContainer-' + i);
            if (container) {
                container.exeAPI = $WebComponent.createAPI(i);
            }

            $WebComponent.setupItinerary(i);
            $WebComponent.bindScormHandlers(i);

            if (data.isScorm > 0) {
                $exeDevices.iDevice.gamification.scorm.registerActivity(data);
            }

            setTimeout(() => {
                $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                    data,
                    $WebComponent.isInExe
                );
            }, 500);
        });

        let node = document.querySelector('.page-content');
        if (this.isInExe) {
            node = document.getElementById('node-content');
        }
        if (node)
            $exeDevices.iDevice.gamification.observers.observeResize(
                $WebComponent,
                node
            );

        $exeDevices.iDevice.gamification.math.updateLatex('.webcomponent-IDevice');
    },

    CreateInterface: function (instance) {
        const data = $WebComponent.options[instance];
        const msgs = data.msgs || {};
        const instructions = data.instructionsContent || '';
        const textAfter = data.textAfterContent || '';

        let content = `<div class="WCP-MainContainer" id="wcContainer-${instance}">`;

        content += `<div class="WCP-ShowClue" id="wcShowClue-${instance}" style="display:none;">`;
        content += `<p class="sr-av">${msgs.msgClue || ''}</p>`;
        content += `<p id="wcPShowClue-${instance}" class="WCP-PShowClue"></p>`;
        content += `</div>`;

        if (instructions) content += `<div class="WCP-Content">${instructions}</div>`;
        if (textAfter)
            content += `<div class="webcomponent-extra-content">${textAfter}</div>`;

        content += `<div class="WCP-Cover" id="wcCubierta-${instance}" style="display:none;">`;
        content += `<div class="WCP-CodeAccessDiv" id="wcCodeAccessDiv-${instance}">`;
        content += `<div class="WCP-MessageCodeAccessE" id="wcMsgCodeAccess-${instance}"></div>`;
        content += `<div class="WCP-DataCodeAccessE">`;
        content += `<label class="sr-av">${msgs.msgCodeAccess || ''}:</label>`;
        content += `<input type="text" class="WCP-CodeAccessE form-control" id="wcCodeAccessE-${instance}" placeholder="${msgs.msgCodeAccess || ''}">`;
        content += `<a href="#" id="wcCodeAccessButton-${instance}" title="${msgs.msgSubmit || ''}">`;
        content += `<strong><span class="sr-av">${msgs.msgSubmit || ''}</span></strong>`;
        content += `<div class="exeQuextIcons-Submit WCP-Activo"></div>`;
        content += `</a></div></div></div>`;

        content += '</div>';
        content += $exeDevices.iDevice.gamification.scorm.addButtonScoreNew(
            data,
            $WebComponent.isInExe
        );

        return content;
    },

    decodeStoredHtml: function (text) {
        if (!text || typeof text !== 'string') return '';
        try {
            return decodeURIComponent(text);
        } catch (error) {
            return text;
        }
    },

    extractScriptsFromHtml: function (html) {
        if (!html) {
            return {
                html: '',
                scriptDefs: [],
            };
        }

        const tpl = document.createElement('template');
        tpl.innerHTML = html;
        const scriptDefs = [];
        tpl.content.querySelectorAll('script').forEach((script) => {
            const src = script.getAttribute('src') || '';
            const text = (script.textContent || '').trim();
            if (src || text) {
                scriptDefs.push({
                    src,
                    text: src ? '' : text,
                });
            }
            script.remove();
        });

        const div = document.createElement('div');
        div.appendChild(tpl.content.cloneNode(true));
        return {
            html: div.innerHTML,
            scriptDefs,
        };
    },

    /**
     * Ejecuta los scripts extraídos de las instrucciones del web component.
     * - Scripts externos: se cargan solo si no están ya en el documento.
     * - Scripts inline: se ejecutan con try-catch para ignorar errores de re-declaración
     *   (p. ej. "class SimuladorBrujula has already been declared" en páginas con
     *   múltiples instancias del mismo componente).
     */
    executeScripts: function (scriptDefs) {
        scriptDefs.forEach(({ src, text }) => {
            if (src) {
                if (!document.querySelector(`script[src="${src}"]`)) {
                    const s = document.createElement('script');
                    s.src = src;
                    document.head.appendChild(s);
                }
            } else if (text) {
                const inlineCode = text.trim();
                if (!inlineCode) return;

                const customElementNames =
                    $WebComponent.extractDefinedCustomElementNames(inlineCode);
                if (
                    customElementNames.length > 0 &&
                    window.customElements &&
                    typeof window.customElements.get === 'function' &&
                    customElementNames.some((name) =>
                        window.customElements.get(name)
                    )
                ) {
                    return;
                }

                const fingerprint =
                    $WebComponent.getInlineScriptFingerprint(inlineCode);
                if (
                    $WebComponent.loadedInlineScripts.has(fingerprint) ||
                    document.querySelector(
                        `script[data-exe-wc-inline="${fingerprint}"]`
                    )
                ) {
                    return;
                }

                const s = document.createElement('script');
                s.textContent = inlineCode;
                s.setAttribute('data-exe-wc-inline', fingerprint);
                $WebComponent.loadedInlineScripts.add(fingerprint);
                try {
                    document.head.appendChild(s);
                } catch (e) {
                    // Ignorar SyntaxError por re-declaración de clase o customElement ya registrado
                }
            }
        });
    },

    extractDefinedCustomElementNames: function (code) {
        if (!code || typeof code !== 'string') return [];
        const regex =
            /(?:window\.)?customElements\.define\(\s*['\"]([^'\"]+)['\"]/gi;
        const names = [];
        let match = regex.exec(code);
        while (match) {
            if (match[1] && !names.includes(match[1])) {
                names.push(match[1]);
            }
            match = regex.exec(code);
        }
        return names;
    },

    getInlineScriptFingerprint: function (code) {
        let hash = 0;
        for (let i = 0; i < code.length; i++) {
            hash = (hash << 5) - hash + code.charCodeAt(i);
            hash |= 0;
        }
        return `wc_${code.length}_${Math.abs(hash)}`;
    },

    setupItinerary: function (instance) {
        const data = $WebComponent.options[instance];
        if (data.itinerary && data.itinerary.showCodeAccess) {
            $('#wcMsgCodeAccess-' + instance).text(data.itinerary.messageCodeAccess);
            $('#wcCubierta-' + instance).show();
        }

        $('#wcCodeAccessButton-' + instance).on('click touchstart', function (e) {
            e.preventDefault();
            $WebComponent.enterCodeAccess(instance);
        });

        $('#wcCodeAccessE-' + instance).on('keydown', function (e) {
            if (e.which === 13 || e.keyCode === 13) {
                $WebComponent.enterCodeAccess(instance);
                return false;
            }
            return true;
        });
    },

    bindScormHandlers: function (instance) {
        const data = $WebComponent.options[instance];
        const $container = $('#wcContainer-' + instance);
        const $node = $container.closest('.idevice_node');
        if ($node.length === 0) return;

        $node.off('click', '.Games-SendScore');
        $node.on('click', '.Games-SendScore', function (e) {
            e.preventDefault();
            $WebComponent.sendScore(false, instance);
            $exeDevices.iDevice.gamification.report.saveEvaluation(
                data,
                $WebComponent.isInExe
            );
        });
    },

    enterCodeAccess: function (instance) {
        const data = $WebComponent.options[instance];
        const codeInput = $('#wcCodeAccessE-' + instance).val();

        if (data.itinerary.codeAccess === codeInput) {
            $('#wcCubierta-' + instance).hide();
        } else {
            $('#wcMsgCodeAccess-' + instance).fadeOut(300).fadeIn(200);
            $('#wcCodeAccessE-' + instance).val('');
        }
    },

    checkClueGame: function (instance) {
        const data = $WebComponent.options[instance];
        if (!data.itinerary || !data.itinerary.showClue || data.obtainedClue) return;

        const percentageHits = (data.hits / (data.total || 1)) * 100;
        if (percentageHits >= data.itinerary.percentageClue) {
            data.obtainedClue = true;
            $('#wcPShowClue-' + instance).text(data.itinerary.clueGame);
            $('#wcShowClue-' + instance).show();
        }
    },

    /**
     * Crea el objeto API que se adjunta al contenedor DOM.
     * El web component llama a estos métodos para comunicar su estado.
     *
     * Uso desde el web component:
     *   const api = this.closest('.WCP-MainContainer').exeAPI;
     *   api.start();
     *   api.sendScore(aciertos, total, esUltimoEnvio);
     *   api.end(aciertos, total);
     */
    createAPI: function (instance) {
        return {
            /** Notifica que la actividad ha comenzado. */
            start: function () {
                $WebComponent.onStart(instance);
            },
            /**
             * Envía la puntuación parcial o final.
             * @param {number} hits    - Número de aciertos.
             * @param {number} total   - Total de ítems evaluables.
             * @param {boolean} isEnd  - true si es el envío definitivo.
             */
            sendScore: function (hits, total, isEnd) {
                $WebComponent.onScore(hits, total, !!isEnd, instance);
            },
            /**
             * Notifica el fin de la actividad y envía la puntuación final.
             * @param {number} hits  - Número de aciertos.
             * @param {number} total - Total de ítems evaluables.
             */
            end: function (hits, total) {
                $WebComponent.onScore(hits, total, true, instance);
            },
        };
    },

    onStart: function (instance) {
        const data = $WebComponent.options[instance];
        if (data.gameStarted) return;
        data.gameStarted = true;
        data.scorerp = 0;
        if (data.isScorm > 0) {
            $WebComponent.sendScore(true, instance);
        }
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            data,
            $WebComponent.isInExe
        );
    },

    onScore: function (hits, total, isEnd, instance) {
        const data = $WebComponent.options[instance];
        data.hits = Number(hits) || 0;
        data.total = Number(total) || 1;
        // scorerp en escala 0–10, igual que el resto de iDevices
        data.scorerp = (data.hits * 10) / data.total;

        $WebComponent.checkClueGame(instance);

        if (data.isScorm > 0) {
            // En modo manual (isScorm == 2) los envíos desde la API del componente
            // no deben abrir popup; el popup solo debe aparecer al pulsar
            // explícitamente el botón "Guardar puntuación".
            const auto = data.isScorm == 2 ? true : isEnd;
            $WebComponent.sendScore(auto, instance);
        }
        $exeDevices.iDevice.gamification.report.saveEvaluation(
            data,
            $WebComponent.isInExe
        );
        if (isEnd) {
            setTimeout(() => {
                $exeDevices.iDevice.gamification.report.updateEvaluationIcon(
                    data,
                    $WebComponent.isInExe
                );
            }, 500);
        }
    },

    sendScore: function (auto, instance) {
        const data = $WebComponent.options[instance];
        data.previousScore = $WebComponent.previousScore;
        data.userName = $WebComponent.userName;
        $exeDevices.iDevice.gamification.scorm.sendScoreNew(auto, data);
        $WebComponent.previousScore = data.previousScore;
    },
};

$(function () {
    $WebComponent.init();
});
