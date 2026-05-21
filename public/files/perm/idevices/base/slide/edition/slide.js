/**
 * Slide iDevice — edition bridge for the Fabric.js editor.
 *
 * Loads the pre-built Fabric editor bundle (slide-editor.bundle.js) and
 * implements the $exeDevice.init/save contract expected by eXeLearning.
 *
 * Vanilla DOM. No jQuery. No React. No tldraw. The editor itself owns
 * the toolbar, canvas, and status bar — the bridge only mounts it and
 * forwards the saved payload back to the engine.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning - https://exelearning.net
 * License: https://creativecommons.org/licenses/by-sa/4.0/
 */

/* global _ */
/* eslint-disable no-undef */

(() => {
    var BUNDLE_GLOBAL = '__slideEditorInit';
    var BUNDLE_FILE = 'slide-editor.bundle.js';
    var DATA_VERSION = 3;
    var ENGINE_NAME = 'fabric';
    var DEFAULT_WIDTH = 1280;
    var DEFAULT_HEIGHT = 720;
    var DEFAULT_BG = '#ffffff';

    function loadBundle(idevicePath) {
        if (window[BUNDLE_GLOBAL]) {
            return Promise.resolve();
        }
        if (window.__slideBundlePromise) {
            return window.__slideBundlePromise;
        }

        window.__slideBundlePromise = new Promise((resolve, reject) => {
            var script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = idevicePath + BUNDLE_FILE;
            script.onload = resolve;
            script.onerror = err => {
                delete window.__slideBundlePromise;
                reject(err);
            };
            document.head.appendChild(script);
        });

        return window.__slideBundlePromise;
    }

    window.$exeDevice = {
        _editorApi: null,
        _ideviceId: null,
        _previousData: null,

        /**
         * Called by eXeLearning when the iDevice is opened for editing.
         *
         * @param {HTMLElement} element       Container element
         * @param {*}           previousData  Previously saved JSON (or null)
         * @param {string}      path          URL path to the iDevice edition folder
         */
        init: function (element, previousData, path) {
            this._editorApi = null;
            this._previousData = previousData;
            this._ideviceId = element.getAttribute('idevice-id');

            element.classList.add('exe-slide-idevice');
            element.setAttribute('data-testid', 'slide-idevice');

            element.innerHTML = '';

            var host = document.createElement('div');
            host.className = 'exe-slide-host';
            host.setAttribute('data-testid', 'slide-host');
            element.appendChild(host);

            var loadingEl = document.createElement('div');
            loadingEl.className = 'exe-slide-loading';
            loadingEl.textContent = _('Loading editor…');
            host.appendChild(loadingEl);

            loadBundle(path)
                .then(() => {
                    if (!window[BUNDLE_GLOBAL] || typeof window[BUNDLE_GLOBAL].mount !== 'function') {
                        throw new Error('slide editor bundle did not expose mount()');
                    }
                    host.innerHTML = '';
                    var mount = document.createElement('div');
                    mount.className = 'exe-slide-mount';
                    host.appendChild(mount);

                    this._editorApi = window[BUNDLE_GLOBAL].mount(mount, {
                        previousData: previousData,
                    });
                })
                .catch(() => {
                    host.innerHTML = '';
                    var errEl = document.createElement('p');
                    errEl.className = 'exe-slide-error';
                    errEl.setAttribute('data-testid', 'slide-error');
                    errEl.textContent = _('Could not load the slide editor. Please reload the page.');
                    host.appendChild(errEl);
                });
        },

        /**
         * Called by eXeLearning when saving the iDevice. Returns version-3
         * payload: editable Fabric scene + sanitized SVG snapshot.
         */
        save: function () {
            if (!this._editorApi) {
                return null;
            }

            var dims =
                typeof this._editorApi.getDimensions === 'function'
                    ? this._editorApi.getDimensions()
                    : { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
            var bg =
                typeof this._editorApi.getBackground === 'function'
                    ? this._editorApi.getBackground()
                    : DEFAULT_BG;

            return {
                ideviceId: this._ideviceId,
                version: DATA_VERSION,
                engine: ENGINE_NAME,
                width: dims.width,
                height: dims.height,
                background: bg,
                fabric: this._editorApi.getFabricJSON(),
                svg: this._editorApi.getSvgString(),
            };
        },
    };
})();
