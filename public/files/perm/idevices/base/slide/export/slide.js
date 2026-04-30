/**
 * Slide iDevice — export/preview renderer.
 *
 * Version 2 (tldraw): embeds the cached SVG string directly — no runtime
 * dependency on tldraw. The SVG is made responsive (width="100%").
 *
 * Version 1 (Fabric.js legacy): converts the Fabric JSON into static HTML
 * using percentage positions relative to a 960×540 stage.  No Fabric.js
 * dependency at runtime.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning
 * License: https://creativecommons.org/licenses/by-sa/4.0/
 */

/* global $exe_i18n */
/* eslint-disable no-undef */

var $slide = (function () {
    'use strict';

    var STAGE_W = 960;
    var STAGE_H = 540;

    // ── Shared sanitization helpers ───────────────────────────────────────────

    function escAttr(v) {
        if (v == null) { return ''; }
        return String(v)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function escStyle(v) {
        if (v == null) { return ''; }
        return String(v).replace(/["<>\\]/g, '');
    }

    function escHtml(v) {
        if (v == null) { return ''; }
        return String(v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/\n/g, '<br>');
    }

    function isColor(v) {
        if (!v || typeof v !== 'string') { return false; }
        var s = v.trim();
        // Always validate hex colors with regex — CSS.supports can be unreliable across environments
        if (s.charAt(0) === '#') {
            return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s);
        }
        if (window.CSS && typeof window.CSS.supports === 'function') {
            return window.CSS.supports('color', s);
        }
        return /^(rgba?\(|transparent|inherit)/i.test(s);
    }

    function clamp(v, min, max) {
        var n = Number(v);
        return isFinite(n) ? Math.min(Math.max(n, min), max) : min;
    }

    // ── Fullscreen button SVG icons ───────────────────────────────────────────

    var ICON_ENTER_FS = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/></svg>';
    var ICON_EXIT_FS  = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 1v4H1M9 5V1h4M9 13v-4h4M5 9v4H1"/></svg>';

    // ── Version detection ─────────────────────────────────────────────────────

    /**
     * Detect the data version.
     * Returns 2 for tldraw data, 1 for Fabric/legacy data.
     *
     * @param {*} raw
     * @returns {number}
     */
    function detectVersion(raw) {
        var parsed = raw;
        if (typeof raw === 'string') {
            try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
        }
        if (parsed && typeof parsed === 'object' && parsed.version === 2) {
            return 2;
        }
        return 1;
    }

    // ── Version 2 — tldraw SVG renderer ──────────────────────────────────────

    /**
     * Render version-2 tldraw data by embedding the cached SVG.
     * Makes the SVG responsive by replacing fixed width/height attributes.
     * Applies an inline max-width when the data carries a configured width.
     *
     * @param {object} data     Parsed version-2 data object
     * @param {string} template HTML template with {content} placeholder
     * @returns {string}
     */
    function renderV2(data, template) {
        var svg = (data && typeof data.svg === 'string') ? data.svg : '';

        if (svg) {
            // Make SVG responsive: force width="100%" and remove fixed height
            svg = svg
                .replace(/(<svg[^>]*)\swidth="[^"]*"/, '$1 width="100%"')
                .replace(/(<svg[^>]*)\sheight="[^"]*"/, '$1');
        }

        var styleAttr = (data && data.width > 0) ? ' style="max-width:' + parseInt(data.width, 10) + 'px"' : '';
        var btn = '<button type="button" class="slide-fullscreen-btn" aria-label="Fullscreen">' + ICON_ENTER_FS + '</button>';
        var html = '<div class="slide-export-tldraw"' + styleAttr + '>' + btn + svg + '</div>';
        return (template || '{content}').replace('{content}', html);
    }

    // ── Version 1 — Fabric.js static HTML renderer ────────────────────────────

    function normalizeLegacyItem(item, index) {
        var base = {
            id: item.id || ('item-' + index),
            left:   clamp(item.x || 0, 0, STAGE_W),
            top:    clamp(item.y || 0, 0, STAGE_H),
            width:  clamp(item.width  || 300, 1, STAGE_W),
            height: clamp(item.height || 140, 1, STAGE_H),
            scaleX:  item.scaleX  || 1,
            scaleY:  item.scaleY  || 1,
            angle:   item.angle   || 0,
            opacity: item.opacity == null ? 1 : clamp(item.opacity, 0, 1),
            stroke:      item.borderColor || 'rgba(0,0,0,0)',
            strokeWidth: Number(item.borderWidth || 0),
            __z: typeof item.zIndex === 'number' ? item.zIndex : index,
        };
        if (item.type === 'text') {
            return Object.assign({}, base, {
                type:            'i-text',
                text:            item.text || item.content || '',
                fontFamily:      item.fontFamily || 'Inter, Arial, sans-serif',
                fontSize:        clamp(item.fontSize || 18, 8, 160),
                fontWeight:      item.bold ? 'bold' : 'normal',
                fill:            item.color || '#222222',
                backgroundColor: item.backgroundColor || 'rgba(255,255,255,0)',
            });
        }
        return Object.assign({}, base, {
            type:            'image',
            src:             item.src || '',
            alt:             item.alt || '',
            backgroundColor: item.backgroundColor || 'rgba(255,255,255,0)',
        });
    }

    /**
     * Parse and normalize the raw jsonProperties value for V1 Fabric data.
     * Handles: current format, bare fabric JSON, and legacy array format.
     *
     * @param {*} raw
     * @returns {{ background: string, objects: Array }}
     */
    function normalizeV1(raw) {
        var parsed = raw;
        if (typeof raw === 'string') {
            try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
        }
        if (!parsed || typeof parsed !== 'object') {
            return { background: '#ffffff', objects: [] };
        }

        var fabricData = null;

        if (parsed.fabric && Array.isArray(parsed.fabric.objects)) {
            fabricData = parsed.fabric;
        } else if (Array.isArray(parsed.objects)) {
            fabricData = parsed;
        } else if (Array.isArray(parsed.items)) {
            fabricData = {
                background: (parsed.stage && isColor(parsed.stage.background)) ? parsed.stage.background : '#ffffff',
                objects: parsed.items.map(normalizeLegacyItem),
            };
        }

        if (!fabricData) {
            return { background: '#ffffff', objects: [] };
        }

        var background = isColor(fabricData.background) ? fabricData.background.trim() : '#ffffff';
        var objects = (fabricData.objects || [])
            .filter(Boolean)
            .map(function (obj, idx) {
                return {
                    type:            obj.type            || 'i-text',
                    id:              obj.id              || ('item-' + idx),
                    left:            clamp(obj.left || obj.x || 0, 0, STAGE_W),
                    top:             clamp(obj.top  || obj.y || 0, 0, STAGE_H),
                    width:           clamp(obj.width  || 300, 1, STAGE_W),
                    height:          clamp(obj.height || 140, 1, STAGE_H),
                    scaleX:          obj.scaleX  == null ? 1 : obj.scaleX,
                    scaleY:          obj.scaleY  == null ? 1 : obj.scaleY,
                    angle:           obj.angle   || 0,
                    opacity:         obj.opacity == null ? 1 : clamp(obj.opacity, 0, 1),
                    fill:            obj.fill            || '#222222',
                    stroke:          obj.stroke          || obj.borderColor || 'rgba(0,0,0,0)',
                    strokeWidth:     Number(obj.strokeWidth || obj.borderWidth || 0),
                    backgroundColor: obj.backgroundColor || 'rgba(255,255,255,0)',
                    rx:              obj.rx || 0,
                    ry:              obj.ry || 0,
                    radius:          obj.radius || 0,
                    text:       obj.text       || '',
                    fontFamily: obj.fontFamily || 'Inter, Arial, sans-serif',
                    fontSize:   clamp(obj.fontSize || 18, 8, 160),
                    fontWeight: obj.fontWeight || 'normal',
                    textAlign:  obj.textAlign  || 'left',
                    src:      obj.assetSrc || obj.src || '',
                    alt:      obj.alt      || '',
                    assetSrc: obj.assetSrc || '',
                    __z: typeof obj.__z === 'number' ? obj.__z : idx,
                };
            })
            .sort(function (a, b) { return a.__z - b.__z; });

        return { background: background, objects: objects };
    }

    function toPercent(px, base) { return ((Number(px) || 0) / base * 100).toFixed(4) + '%'; }

    function buildItemHTML(obj) {
        var scaleX  = obj.scaleX == null ? 1 : obj.scaleX;
        var scaleY  = obj.scaleY == null ? 1 : obj.scaleY;
        var w       = toPercent((obj.width  || 0) * scaleX, STAGE_W);
        var h       = toPercent((obj.height || 0) * scaleY, STAGE_H);
        var left    = toPercent(obj.left || 0, STAGE_W);
        var top     = toPercent(obj.top  || 0, STAGE_H);
        var z       = (obj.__z || 0) + 1;
        var opacity = clamp(obj.opacity == null ? 1 : obj.opacity, 0, 1);
        var brdW    = Number(obj.strokeWidth || 0);
        var brdC    = obj.stroke || 'rgba(0,0,0,0)';
        var border  = brdW > 0 ? 'border:' + brdW + 'px solid ' + escStyle(brdC) + ';' : '';
        var rotate  = obj.angle ? 'transform:rotate(' + escStyle(obj.angle) + 'deg);transform-origin:0 0;' : '';
        var baseStyle = 'left:' + left + ';top:' + top + ';width:' + w + ';height:' + h + ';z-index:' + z + ';opacity:' + opacity + ';' + border + rotate;

        var type = obj.type;

        if (type === 'image') {
            var bgImg  = obj.backgroundColor ? 'background:' + escStyle(obj.backgroundColor) + ';' : '';
            var srcUrl = escAttr(obj.src || '');
            var altTxt = escAttr(obj.alt || '');
            return '<figure class="slide-export-item slide-export-image" style="' + baseStyle + bgImg + '">'
                + '<img src="' + srcUrl + '" alt="' + altTxt + '">'
                + '</figure>';
        }

        if (type === 'rect' || type === 'circle' || type === 'triangle' || type === 'ellipse' || type === 'polygon' || type === 'path') {
            var fill   = isColor(obj.fill) ? obj.fill : 'rgba(255,255,255,0)';
            var radius = '';
            if (type === 'circle' || type === 'ellipse') {
                radius = 'border-radius:50%;';
            } else if (type === 'rect' && (obj.rx || obj.ry)) {
                radius = 'border-radius:' + Math.max(obj.rx, obj.ry) + 'px;';
            }
            return '<div class="slide-export-item slide-export-shape" style="' + baseStyle + 'background:' + escStyle(fill) + ';' + radius + '"></div>';
        }

        var ff       = escStyle(obj.fontFamily || 'Inter, Arial, sans-serif');
        var fs       = escStyle((obj.fontSize  || 18) + 'px');
        var fw       = escStyle(obj.fontWeight || 'normal');
        var color    = escStyle(obj.fill       || '#222222');
        var align    = obj.textAlign ? 'text-align:' + escStyle(obj.textAlign) + ';' : '';
        var bgText   = obj.backgroundColor ? 'background:' + escStyle(obj.backgroundColor) + ';' : '';
        var textBody = escHtml(obj.text || '');
        return '<div class="slide-export-item slide-export-text" style="' + baseStyle + bgText + '">'
            + '<div class="slide-export-text-content" style="font-family:' + ff + ';font-size:' + fs + ';font-weight:' + fw + ';color:' + color + ';' + align + '">'
            + textBody
            + '</div>'
            + '</div>';
    }

    function buildMarkup(data) {
        var items = data.objects.map(buildItemHTML).join('');
        return '<div class="slide-export-canvas" style="background:' + escStyle(data.background) + ';">'
            + '<div class="slide-export-layer">' + items + '</div>'
            + '</div>';
    }

    /**
     * Unified normalize — returns a version-tagged object for dispatch.
     * Exposed for tests as _normalize.
     *
     * @param {*} raw
     * @returns {{ _version: number, ... }}
     */
    function normalize(raw) {
        var version = detectVersion(raw);
        if (version === 2) {
            var parsed = (typeof raw === 'string') ? JSON.parse(raw) : raw;
            return {
                _version: 2,
                svg:   (parsed && typeof parsed.svg === 'string') ? parsed.svg : '',
                width: (parsed && typeof parsed.width === 'number' && parsed.width > 0) ? parsed.width : null,
            };
        }
        var v1 = normalizeV1(raw);
        v1._version = 1;
        return v1;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    return {
        /**
         * Engine compatibility method — some engine versions call init(jsonProperties)
         * before renderView.
         *
         * @param {*} data
         * @returns {boolean}
         */
        init: function (data) {
            this._state = normalize(data);
            return true;
        },

        /**
         * Engine step 1 — return the HTML view of the iDevice.
         *
         * @param {*}      data         - jsonProperties (saved JSON)
         * @param {*}      accessibility
         * @param {string} template     - HTML template with {content} placeholder
         * @returns {string}
         */
        renderView: function (data, accessibility, template) {
            var n = normalize(data);
            if (n._version === 2) {
                return renderV2(n, template);
            }
            return (template || '{content}').replace('{content}', buildMarkup(n));
        },

        /**
         * Engine step 2 — wire fullscreen behaviour via document-level event
         * delegation so it works regardless of call timing and in iframe contexts.
         *
         * @returns {Promise<void>}
         */
        renderBehaviour: function () {
            // Guard: only wire once per document, even with multiple slide iDevices.
            if (document._slideExportWired) { return Promise.resolve(); }
            document._slideExportWired = true;

            // ── Helpers ────────────────────────────────────────────────────────

            function activateCssFs(wrap, btn) {
                wrap.classList.add('slide-fs-active');
                btn.setAttribute('aria-label', 'Exit fullscreen');
                btn.innerHTML = ICON_EXIT_FS;
                document.body.style.overflow = 'hidden';
            }

            function deactivateCssFs(wrap) {
                wrap.classList.remove('slide-fs-active');
                var btn = wrap.querySelector('.slide-fullscreen-btn');
                if (btn) {
                    btn.setAttribute('aria-label', 'Fullscreen');
                    btn.innerHTML = ICON_ENTER_FS;
                }
                document.body.style.overflow = '';
            }

            // ── Click delegation ───────────────────────────────────────────────
            // Handles clicks on any .slide-fullscreen-btn, even those added to the
            // DOM after renderBehaviour() was called.

            document.addEventListener('click', function (e) {
                var btn = e.target && e.target.closest
                    ? e.target.closest('.slide-fullscreen-btn')
                    : null;
                if (!btn) return;
                var wrap = btn.closest('.slide-export-tldraw');
                if (!wrap) return;

                var isNativeFs = !!document.fullscreenElement;
                var isCssFs    = wrap.classList.contains('slide-fs-active');

                if (isNativeFs) {
                    if (document.exitFullscreen) document.exitFullscreen();
                } else if (isCssFs) {
                    deactivateCssFs(wrap);
                } else {
                    // Try native Fullscreen API; fall back to CSS simulation.
                    if (wrap.requestFullscreen) {
                        try {
                            var p = wrap.requestFullscreen();
                            if (p && p.catch) {
                                p.catch(function () { activateCssFs(wrap, btn); });
                            }
                        } catch (_e) {
                            activateCssFs(wrap, btn);
                        }
                    } else {
                        activateCssFs(wrap, btn);
                    }
                }
            });

            // ── ESC key — close CSS simulation ────────────────────────────────
            document.addEventListener('keydown', function (e) {
                if (e.key !== 'Escape') return;
                document.querySelectorAll('.slide-export-tldraw.slide-fs-active').forEach(deactivateCssFs);
            });

            // ── Native fullscreenchange — sync icon ────────────────────────────
            document.addEventListener('fullscreenchange', function () {
                document.querySelectorAll('.slide-export-tldraw .slide-fullscreen-btn').forEach(function (btn) {
                    var wrap  = btn.closest('.slide-export-tldraw');
                    var isFs  = !!document.fullscreenElement && wrap === document.fullscreenElement;
                    btn.setAttribute('aria-label', isFs ? 'Exit fullscreen' : 'Fullscreen');
                    btn.innerHTML = isFs ? ICON_EXIT_FS : ICON_ENTER_FS;
                    // Clear CSS simulation if native fullscreen has taken over
                    if (wrap) wrap.classList.remove('slide-fs-active');
                    document.body.style.overflow = '';
                });
            });

            return Promise.resolve();
        },

        // Exposed for unit tests
        _normalize:   normalize,
        _buildMarkup: buildMarkup,
    };
}());
