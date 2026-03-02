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

    init: function () {
        $exeDevices.iDevice.gamification.initGame(
            this,
            'Web Component',
            'webcomponent',
            'webcomponent-IDevice'
        );
    },

    enable: function () {
        $WebComponent.loadComponents();
    },

    loadComponents: function () {
        $WebComponent.activities.each(function (i) {
            const json = $('.webcomponent-DataGame', this).text();
            const data = $exeDevices.iDevice.gamification.helpers.isJsonString(json);
            if (!data) return;

            data.main = 'wcContainer-' + i;
            data.idevice = 'webcomponent-IDevice';
            data.idevicePath = $WebComponent.idevicePath;
            data.scorerp = 0;
            data.hits = 0;
            data.total = 1;
            data.gameStarted = false;
            data.obtainedClue = false;

            $WebComponent.options.push(data);

            const msgs = data.msgs || {};

            // Leer instrucciones desde JSON (seguro, sin acceso al DOM con src malformados)
            // Fallback al div HTML para datos guardados antes de esta versión
            const rawInstructions = data.instructions
                ? decodeURIComponent(data.instructions)
                : ($('.webcomponent-instructions', this).html() || '');

            // Parsear con <template> (inerte) para extraer <script> sin ejecutarlos ni cargar recursos
            const tpl = document.createElement('template');
            tpl.innerHTML = rawInstructions;

            // Extraer <script> para ejecutarlos por separado y evitar errores de re-declaración
            const scriptDefs = [];
            tpl.content.querySelectorAll('script').forEach(s => {
                scriptDefs.push({ src: s.src || '', text: s.textContent });
                s.remove();
            });

            // HTML de instrucciones sin scripts
            const tmpDiv = document.createElement('div');
            tmpDiv.appendChild(tpl.content.cloneNode(true));
            const instructions = tmpDiv.innerHTML;

            // textAfter: también desde JSON si está disponible
            const textAfter = data.textAfter
                ? decodeURIComponent(data.textAfter)
                : ($('.webcomponent-extra-content', this).html() || '');

            let content = `<div class="WCP-MainContainer" id="wcContainer-${i}">`;

            // Bloque de pista (visible cuando se alcanza la condición del itinerario)
            content += `<div class="WCP-ShowClue" id="wcShowClue-${i}" style="display:none;">`;
            content += `<p class="sr-av">${msgs.msgClue || ''}</p>`;
            content += `<p id="wcPShowClue-${i}" class="WCP-PShowClue"></p>`;
            content += `</div>`;

            if (instructions) content += `<div class="WCP-Content">${instructions}</div>`;
            if (textAfter) content += `<div class="webcomponent-extra-content">${textAfter}</div>`;

            // Cubierta de código de acceso (overlay sobre la actividad)
            content += `<div class="WCP-Cover" id="wcCubierta-${i}" style="display:none;">`;
            content += `<div class="WCP-CodeAccessDiv" id="wcCodeAccessDiv-${i}">`;
            content += `<div class="WCP-MessageCodeAccessE" id="wcMsgCodeAccess-${i}"></div>`;
            content += `<div class="WCP-DataCodeAccessE">`;
            content += `<label class="sr-av">${msgs.msgCodeAccess || ''}:</label>`;
            content += `<input type="text" class="WCP-CodeAccessE form-control" id="wcCodeAccessE-${i}" placeholder="${msgs.msgCodeAccess || ''}">`;
            content += `<a href="#" id="wcCodeAccessButton-${i}" title="${msgs.msgSubmit || ''}">`;
            content += `<strong><span class="sr-av">${msgs.msgSubmit || ''}</span></strong>`;
            content += `<div class="exeQuextIcons-Submit WCP-Activo"></div>`;
            content += `</a></div></div></div>`;

            content += '</div>';
            content += $exeDevices.iDevice.gamification.scorm.addButtonScoreNew(data, $WebComponent.isInExe);

            // innerHTML nativo: no ejecuta scripts (a diferencia de jQuery .html())
            this.innerHTML = content;

            // Ejecutar los scripts del web component una vez, con protección ante re-declaraciones
            $WebComponent.executeScripts(scriptDefs);

            // Exponer la API en el nodo DOM para que el componente la consuma
            const container = document.getElementById('wcContainer-' + i);
            if (container) {
                container.exeAPI = $WebComponent.createAPI(i);
            }

            $WebComponent.setupItinerary(i);

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
                const s = document.createElement('script');
                s.textContent = text;
                try {
                    document.head.appendChild(s);
                } catch (e) {
                    // Ignorar SyntaxError por re-declaración de clase o customElement ya registrado
                }
            }
        });
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
            $WebComponent.sendScore(isEnd, instance);
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
