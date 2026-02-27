/**
 * download-source-file iDevice
 *
 * This iDevice displays download link for the source .elpx file.
 * The actual download functionality is provided by exe_elpx_download.js
 * which is included automatically when this iDevice is detected.
 */
(function() {
    'use strict';
    
    // Sync project properties dynamically when viewed in the eXeLearning Workarea (Editor View).
    // In export/preview, PageRenderer handles this server-side, and eXe.app will be undefined.
    function syncProperties() {
        if (typeof window.eXe === 'undefined' || !window.eXe.app || typeof window.eXe.app.getProjectProperties !== 'function') {
            return;
        }

        var props = window.eXe.app.getProjectProperties();
        if (!props) return;

        // Upgrade legacy iDevices (added before this feature) to have the targetable spans
        var tables = document.querySelectorAll('table.exe-package-info');
        for (var t = 0; t < tables.length; t++) {
            var tds = tables[t].querySelectorAll('td');
            if (tds.length === 4) {
                if (tds[0].querySelectorAll('.exe-prop-title').length === 0) tds[0].innerHTML = '<span class="exe-prop-title"></span>';
                if (tds[1].querySelectorAll('.exe-prop-description').length === 0) tds[1].innerHTML = '<span class="exe-prop-description"></span>';
                if (tds[2].querySelectorAll('.exe-prop-author').length === 0) tds[2].innerHTML = '<span class="exe-prop-author"></span>';
                if (tds[3].querySelectorAll('.exe-prop-license').length === 0) tds[3].innerHTML = '<span class="exe-prop-license"></span>';
            }
        }

        var title = (props.pp_title && props.pp_title.value) ? props.pp_title.value : '-';
        var author = (props.pp_author && props.pp_author.value) ? props.pp_author.value : '-';
        var desc = (props.pp_description && props.pp_description.value) ? props.pp_description.value : '-';
        var license = (props.pp_license && props.pp_license.value) ? props.pp_license.value : '-';

        // Format license
        var formattedLicense = license;
        if (license !== '-') {
            var licenseMappings = [
                ['creative commons: attribution 4.0', 'by/4.0'],
                ['creative commons: attribution - non derived work 4.0', 'by-nd/4.0'],
                ['creative commons: attribution - non derived work - non commercial 4.0', 'by-nc-nd/4.0'],
                ['creative commons: attribution - non commercial 4.0', 'by-nc/4.0'],
                ['creative commons: attribution - non commercial - share alike 4.0', 'by-nc-sa/4.0'],
                ['creative commons: attribution - share alike 4.0', 'by-sa/4.0'],
                ['creative commons: attribution 3.0', 'by/3.0'],
                ['creative commons: attribution - non derived work 3.0', 'by-nd/3.0'],
                ['creative commons: attribution - non derived work - non commercial 3.0', 'by-nc-nd/3.0'],
                ['creative commons: attribution - non commercial 3.0', 'by-nc/3.0'],
                ['creative commons: attribution - non commercial - share alike 3.0', 'by-nc-sa/3.0'],
                ['creative commons: attribution - share alike 3.0', 'by-sa/3.0'],
                ['creative commons: attribution 2.5', 'by/2.5'],
                ['creative commons: attribution - non derived work 2.5', 'by-nd/2.5'],
                ['creative commons: attribution - non derived work - non commercial 2.5', 'by-nc-nd/2.5'],
                ['creative commons: attribution - non commercial 2.5', 'by-nc/2.5'],
                ['creative commons: attribution - non commercial - share alike 2.5', 'by-nc-sa/2.5'],
                ['creative commons: attribution - share alike 2.5', 'by-sa/2.5']
            ];
            for (var i = 0; i < licenseMappings.length; i++) {
                if (licenseMappings[i][0] === license) {
                    var type = licenseMappings[i][1].replace('/', ' ').toUpperCase();
                    var css = 'cc cc-' + licenseMappings[i][1].split('/')[0];
                    formattedLicense = '<a href="https://creativecommons.org/licenses/' + licenseMappings[i][1] + '/" rel="license" class="' + css + '"><span></span>Creative Commons ' + type + '</a>';
                    break;
                }
            }
        }

        // Update DOM elements safely
        var tempDiv = document.createElement('div');
        
        var titles = document.querySelectorAll('.exe-prop-title');
        for (var i = 0; i < titles.length; i++) {
            tempDiv.textContent = title;
            titles[i].innerHTML = tempDiv.innerHTML;
        }

        var authors = document.querySelectorAll('.exe-prop-author');
        for (var j = 0; j < authors.length; j++) {
            tempDiv.textContent = author;
            authors[j].innerHTML = tempDiv.innerHTML;
        }

        var descriptions = document.querySelectorAll('.exe-prop-description');
        for (var k = 0; k < descriptions.length; k++) {
            tempDiv.textContent = desc;
            descriptions[k].innerHTML = tempDiv.innerHTML;
        }

        var licenses = document.querySelectorAll('.exe-prop-license');
        for (var l = 0; l < licenses.length; l++) {
            // License could contain HTML (formatted version), so assign directly
            // For standard text (e.g. "Public Domain"), we should sanitize, but we trust the internal properties.
            if (formattedLicense.indexOf('<a') === 0) {
                licenses[l].innerHTML = formattedLicense;
            } else {
                tempDiv.textContent = formattedLicense;
                licenses[l].innerHTML = tempDiv.innerHTML;
            }
        }
    }

    // Run on script execution (when iDevice is rendered in DOM)
    syncProperties();

    // To catch dynamic property changes while the Workarea is active without a page reload:
    // Try to hook into Yjs metadata observer if possible
    if (typeof window.eXeLearning !== 'undefined' && window.eXeLearning.app && window.eXeLearning.app.yjsBridge) {
        // Wait for connection and metadata
        setTimeout(function() {
            var docMgr = window.eXeLearning.app.yjsBridge.documentManager;
            if (docMgr) {
                var metadata = docMgr.getMetadata();
                if (metadata) {
                    metadata.observe(function(event) {
                        var relevantKeys = ['title', 'author', 'description', 'license'];
                        var needsUpdate = false;
                        if (event.changes && event.changes.keys) {
                            event.changes.keys.forEach(function(change, key) {
                                if (relevantKeys.indexOf(key) !== -1) {
                                    needsUpdate = true;
                                }
                            });
                        }
                        if (needsUpdate) {
                            syncProperties();
                        }
                    });
                }
            }
        }, 1000);
    }
})();
