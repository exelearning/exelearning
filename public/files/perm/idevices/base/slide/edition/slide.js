/**
 * Slide iDevice — edition bridge for tldraw.
 *
 * Dynamically loads the pre-built tldraw bundle and mounts the React editor
 * into the iDevice container, implementing the $exeDevice.init/save contract.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning — https://exelearning.net
 * License: https://creativecommons.org/licenses/by-sa/4.0/
 */

/* global _ */
/* eslint-disable no-undef */

(function () {
    'use strict';

    var BUNDLE_GLOBAL  = '__slideEditorInit';
    var BUNDLE_FILE    = 'slide-editor.bundle.js';
    var DEFAULT_WIDTH  = 960;
    var DEFAULT_HEIGHT = 600;

    /**
     * Load the tldraw bundle script if not already present.
     * Memoizes the Promise so multiple concurrent inits share one request.
     *
     * @param {string} idevicePath  Base path to the iDevice edition/ folder
     * @returns {Promise<void>}
     */
    function loadBundle(idevicePath) {
        if (window[BUNDLE_GLOBAL]) { return Promise.resolve(); }
        if (window.__slideBundlePromise) { return window.__slideBundlePromise; }

        window.__slideBundlePromise = new Promise(function (resolve, reject) {
            var script    = document.createElement('script');
            script.type   = 'text/javascript';
            script.src    = idevicePath + BUNDLE_FILE;
            script.onload = resolve;
            script.onerror = function (err) {
                delete window.__slideBundlePromise;
                reject(err);
            };
            document.head.appendChild(script);
        });

        return window.__slideBundlePromise;
    }

    window.$exeDevice = {
        _editorApi:   null,
        _ideviceId:   null,
        _widthInput:  null,
        _heightInput: null,

        /**
         * Called by eXeLearning when the iDevice is opened for editing.
         *
         * @param {HTMLElement} element       Container element
         * @param {*}           previousData  Previously saved JSON (or null)
         * @param {string}      path          URL path to the iDevice edition folder
         */
        init: function (element, previousData, path) {
            var self = this;
            self._editorApi   = null;
            self._widthInput  = null;
            self._heightInput = null;
            self._ideviceId   = element.getAttribute('idevice-id');

            // Parse saved config values
            var prevData = previousData;
            if (typeof prevData === 'string') {
                try { prevData = JSON.parse(prevData); } catch (e) { prevData = {}; }
            }
            if (!prevData || typeof prevData !== 'object') { prevData = {}; }

            var cfgWidth  = Math.max(400, Math.min(1920, parseInt(prevData.width,  10) || DEFAULT_WIDTH));
            var cfgHeight = Math.max(200, Math.min(1200, parseInt(prevData.height, 10) || DEFAULT_HEIGHT));

            element.innerHTML = '';

            // ── Config panel ───────────────────────────────────────────────────
            var configPanel = document.createElement('div');
            configPanel.className = 'slide-config-panel';
            configPanel.innerHTML =
                '<label>' + _('Width') + ': <input type="number" class="slide-cfg-width" min="400" max="1920" step="10" value="' + cfgWidth + '"> px</label>'
                + '<label>' + _('Height') + ': <input type="number" class="slide-cfg-height" min="200" max="1200" step="10" value="' + cfgHeight + '"> px</label>';
            element.appendChild(configPanel);

            self._widthInput  = configPanel.querySelector('.slide-cfg-width');
            self._heightInput = configPanel.querySelector('.slide-cfg-height');

            // ── Editor host ────────────────────────────────────────────────────
            var host = document.createElement('div');
            host.className = 'slide-editor-tldraw-host';
            host.style.height = cfgHeight + 'px';
            element.appendChild(host);

            // Live-resize editor when height input changes
            self._heightInput.addEventListener('input', function () {
                var h = parseInt(this.value, 10);
                if (h >= 200 && h <= 1200) { host.style.height = h + 'px'; }
            });

            // ── Loading indicator ──────────────────────────────────────────────
            var loadingEl = document.createElement('div');
            loadingEl.className = 'slide-loading';
            loadingEl.textContent = _('Loading editor\u2026');
            host.appendChild(loadingEl);

            loadBundle(path)
                .then(function () {
                    // Remove loading indicator and mount React into a fresh wrapper.
                    host.innerHTML = '';
                    var wrapper = document.createElement('div');
                    wrapper.style.cssText = 'width:100%;height:100%';
                    host.appendChild(wrapper);

                    self._editorApi = window[BUNDLE_GLOBAL].mount(wrapper, {
                        previousData: previousData,
                        bundlePath:  path,
                    });
                })
                .catch(function () {
                    host.innerHTML = '';
                    var errEl = document.createElement('p');
                    errEl.className = 'slide-error';
                    errEl.textContent = _('Could not load the slide editor. Please reload the page.');
                    host.appendChild(errEl);
                });
        },

        /**
         * Called by eXeLearning when saving the iDevice.
         * Returns version-2 JSON with tldraw store snapshot, cached SVG, and dimensions.
         *
         * @returns {{ ideviceId: string, version: 2, store: object, svg: string, width: number, height: number } | null}
         */
        save: function () {
            if (!this._editorApi) { return null; }

            var width  = this._widthInput  ? parseInt(this._widthInput.value,  10) : DEFAULT_WIDTH;
            var height = this._heightInput ? parseInt(this._heightInput.value, 10) : DEFAULT_HEIGHT;

            return {
                ideviceId: this._ideviceId,
                version:   2,
                store:     this._editorApi.getStoreSnapshot(),
                svg:       this._editorApi.getSvgString(),
                width:     (width  >= 400  && width  <= 1920) ? width  : DEFAULT_WIDTH,
                height:    (height >= 200  && height <= 1200) ? height : DEFAULT_HEIGHT,
            };
        },
    };
}());
