/** Shared print preview markup. Translation belongs to the host UI. */
export function printPreviewShell(_) {
    const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
    return `<!-- Print Preview Overlay (not using Bootstrap modal) -->
<div id="printPreviewOverlay" class="print-preview-overlay" data-visible="false" role="dialog" aria-modal="true" aria-label="${escape(_('Print preview'))}" data-busy="false">
    <div class="print-preview-header d-flex justify-content-between align-items-center p-2 border-bottom">
        <div class="print-preview-title h5 mb-0">
            <span class="print-preview-title-text">${escape(_("Print preview"))}</span>
        </div>
        <div class="print-preview-actions d-flex gap-2">
            <button type="button" class="print-preview-options-btn btn btn-secondary" aria-controls="printOptionsPanel" aria-expanded="false" hidden>
                ${escape(_("Print options"))}
            </button>

            <button type="button" class="print-preview-pdf-btn btn btn-secondary" hidden>
                ${escape(_("Save as PDF"))}
            </button>
            <button type="button" class="print-preview-print-btn btn btn-primary" title="${escape(_("Print"))}">
                ${escape(_("Print"))}
            </button>
            <button type="button" class="print-preview-close-btn btn btn-secondary" title="${escape(_("Close"))}">
                ${escape(_("Close"))}
            </button>
        </div>
    </div>

    <div class="print-preview-notice" role="alert" hidden>
        <p class="print-preview-notice-text" data-notice="not-started">${escape(_("Printing did not start. Printing may be disabled in this browser or on this device."))}</p>
        <p class="print-preview-notice-text" data-notice="pdf-failed" hidden>${escape(_("The PDF could not be saved."))}</p>
        <p class="print-preview-notice-text" data-notice="images-skipped" hidden>${escape(_("Some images could not be loaded and are left out of the printout."))}</p>
        <button type="button" class="print-preview-open-tab-btn btn btn-secondary btn-sm">${escape(_("Open in a new tab"))}</button>
        <button type="button" class="print-preview-notice-pdf-btn btn btn-secondary btn-sm" hidden>${escape(_("Save as PDF"))}</button>
    </div>
    <div class="print-preview-body">
        <div class="print-preview-content">
            <div class="print-preview-loading">
                <div class="spinner-border" role="status"></div>
                <p>${escape(_("Generating preview..."))}</p>
            </div>

            <iframe class="print-preview-iframe" name="exe-print-preview" title="${escape(_("Print preview"))}"></iframe>
        </div>

        <aside id="printOptionsPanel" class="print-options-panel" aria-labelledby="printOptionsTitle" hidden>
            <div class="print-options-header">
                <h2 id="printOptionsTitle" class="print-options-title">${escape(_("Print options"))}</h2>
                <button type="button" class="print-options-close" aria-label="${escape(_("Close"))}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
                        <path d="M15 5L5 15M5 5L15 15" stroke="black" stroke-width="1.66667" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
            <div class="print-options-body">

                <div class="print-options-intro">
                    <svg class="print-options-intro-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
                        <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3"/>
                        <path d="M8 7.25V11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                        <circle cx="8" cy="5" r="0.8" fill="currentColor"/>
                    </svg>

                    <p class="print-options-intro-text">
                        <span>${escape(_("All visible content will be printed."))}</span>
                        <span class="print-options-intro-activities" hidden>${escape(_("You can choose which activities to include and whether to show hidden content."))}</span>
                        <span class="print-options-intro-document">${escape(_("You can choose whether to show hidden content."))}</span>
                    </p>
                </div>
                <fieldset class="print-options-group print-options-document">
                    <legend class="print-options-group-title">${escape(_("Document"))}</legend>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="printOptLinkUrls" checked>
                        <label class="form-check-label" for="printOptLinkUrls">${escape(_("Show link URLs"))}</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="printOptUnfoldBlocks">
                        <label class="form-check-label" for="printOptUnfoldBlocks">${escape(_("Print the content of minimized boxes"))}</label>
                    </div>

                    <div class="form-check print-options-teacher-only" hidden>
                        <input class="form-check-input" type="checkbox" id="printOptTeacherOnly">
                        <label class="form-check-label" for="printOptTeacherOnly">${escape(_("Print teacher-only content"))}</label>
                    </div>
                </fieldset>
                <div class="print-options-activities" hidden></div>
            </div>
            <p class="print-options-status" role="status" aria-live="polite"></p>
        </aside>
    </div>
</div>`;
}
