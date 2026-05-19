/**
 * Slide iDevice — export/preview renderer.
 *
 * Embeds the cached, sanitized SVG snapshot saved by the Fabric.js editor.
 * The exported page does NOT load Fabric.js; the SVG is fully self-contained.
 *
 * Defence-in-depth: even though the editor sanitizes via DOMPurify before
 * saving, this renderer also scrubs <script>, on*= handlers, and javascript:
 * URLs at the string level — so a payload created with an older bundle
 * cannot smuggle code through the export pipeline.
 *
 * Released under Attribution-ShareAlike 4.0 International License.
 * Author: eXeLearning
 * License: https://creativecommons.org/licenses/by-sa/4.0/
 */

/* eslint-disable no-undef */

var $slide = (() => {
    // ── Fullscreen icon ──────────────────────────────────────────────────────
    // The same four-corner-arrows glyph is used for both states (enter and
    // exit). The aria-label and the wrapper class change instead, so the
    // visual remains consistent regardless of whether the slide is currently
    // expanded.

    var ICON_FS =
        '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/></svg>';
    var ICON_ENTER_FS = ICON_FS;
    var ICON_EXIT_FS = ICON_FS;

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Strip script/handler attributes from cached SVG. The editor already
     * sanitizes via DOMPurify before saving; this is a string-level safety
     * net for content authored with older bundles.
     *
     * @param {*} svg
     * @returns {string}
     */
    function scrubSvg(svg) {
        if (!svg || typeof svg !== 'string') {
            return '';
        }
        return svg
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
            .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
            .replace(/javascript:/gi, '');
    }

    /**
     * Parse the saved JSON into a renderer-ready shape:
     *   { svg: string, width: number|null, height: number|null }
     * Returns empty defaults for null/invalid input rather than throwing.
     *
     * @param {*} raw  The saved jsonProperties value
     */
    function normalize(raw) {
        var parsed = raw;
        if (typeof raw === 'string') {
            try {
                parsed = JSON.parse(raw);
            } catch (e) {
                parsed = null;
            }
        }
        if (!parsed || typeof parsed !== 'object') {
            return { svg: '', width: null, height: null };
        }
        return {
            svg: typeof parsed.svg === 'string' ? parsed.svg : '',
            width: typeof parsed.width === 'number' && parsed.width > 0 ? parsed.width : null,
            height: typeof parsed.height === 'number' && parsed.height > 0 ? parsed.height : null,
        };
    }

    /**
     * Render the SVG into the export wrapper.
     *
     * @param {{ svg: string, width: number|null, height: number|null }} data
     * @param {string} template  HTML template with {content} placeholder
     * @returns {string}
     */
    function render(data, template) {
        var svg = scrubSvg(data.svg);
        if (svg) {
            // Make SVG responsive: force width="100%" and remove fixed height
            // so the browser computes height from viewBox + container width.
            svg = svg
                .replace(/(<svg[^>]*)\swidth="[^"]*"/, '$1 width="100%"')
                .replace(/(<svg[^>]*)\sheight="[^"]*"/, '$1');
        }
        var styleParts = [];
        if (data.width && data.width > 0) {
            styleParts.push('max-width:' + parseInt(data.width, 10) + 'px');
        }
        // Force the slide aspect ratio on the wrapper so any host CSS that
        // constrains heights (workarea preview, narrow columns…) can't
        // squash the slide. Browsers compute the right height; the SVG
        // inside fills it.
        if (data.width && data.width > 0 && data.height && data.height > 0) {
            styleParts.push('aspect-ratio:' + parseInt(data.width, 10) + '/' + parseInt(data.height, 10));
        }
        var styleAttr = styleParts.length ? ' style="' + styleParts.join(';') + '"' : '';
        var btn =
            '<button type="button" class="slide-fullscreen-btn" aria-label="Fullscreen">' + ICON_FS + '</button>';
        var html = '<div class="slide-export-fabric"' + styleAttr + '>' + btn + svg + '</div>';
        return (template || '{content}').replace('{content}', html);
    }

    // ── Public API ───────────────────────────────────────────────────────────

    return {
        init: function (data) {
            this._state = normalize(data);
            return true;
        },

        renderView: (data, accessibility, template) => render(normalize(data), template),

        renderBehaviour: () => {
            if (document._slideExportWired) {
                return Promise.resolve();
            }
            document._slideExportWired = true;

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

            document.addEventListener('click', e => {
                var btn = e.target && e.target.closest ? e.target.closest('.slide-fullscreen-btn') : null;
                if (!btn) return;
                var wrap = btn.closest('.slide-export-fabric');
                if (!wrap) return;

                var isNativeFs = !!document.fullscreenElement;
                var isCssFs = wrap.classList.contains('slide-fs-active');

                if (isNativeFs) {
                    if (document.exitFullscreen) document.exitFullscreen();
                } else if (isCssFs) {
                    deactivateCssFs(wrap);
                } else {
                    if (wrap.requestFullscreen) {
                        try {
                            var p = wrap.requestFullscreen();
                            if (p && p.catch) {
                                p.catch(() => {
                                    activateCssFs(wrap, btn);
                                });
                            }
                        } catch (_e) {
                            activateCssFs(wrap, btn);
                        }
                    } else {
                        activateCssFs(wrap, btn);
                    }
                }
            });

            document.addEventListener('keydown', e => {
                if (e.key !== 'Escape') return;
                document.querySelectorAll('.slide-export-fabric.slide-fs-active').forEach(deactivateCssFs);
            });

            document.addEventListener('fullscreenchange', () => {
                document.querySelectorAll('.slide-export-fabric .slide-fullscreen-btn').forEach(btn => {
                    var wrap = btn.closest('.slide-export-fabric');
                    var isFs = !!document.fullscreenElement && wrap === document.fullscreenElement;
                    btn.setAttribute('aria-label', isFs ? 'Exit fullscreen' : 'Fullscreen');
                    btn.innerHTML = isFs ? ICON_EXIT_FS : ICON_ENTER_FS;
                    if (wrap) wrap.classList.remove('slide-fs-active');
                    document.body.style.overflow = '';
                });
            });

            return Promise.resolve();
        },

        // Exposed for unit tests
        _normalize: normalize,
        _scrubSvg: scrubSvg,
        _render: render,
    };
})();
