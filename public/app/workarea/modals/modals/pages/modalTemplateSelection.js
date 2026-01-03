import Modal from '../modal.js';

export default class modalTemplateSelection extends Modal {
    constructor(manager) {
        super(manager, 'modalTemplateSelection', undefined, false);

        this.modalElementBodyContent = this.modalElementBody.querySelector(
            '.modal-body-content'
        );
        this.confirmButton = this.modalElement.querySelector(
            'button.btn.btn-primary'
        );
        this.templateList = this.modalElement.querySelector('#template-list');

        this.selectedTemplate = null;
        this.templates = [];

        // Setup confirm button handler
        this.confirmButton.addEventListener('click', () => {
            if (this.selectedTemplate) {
                this.loadTemplate(this.selectedTemplate);
            }
        });
    }

    async show(data = {}) {
        this.titleDefault = _('New from Template');
        this.selectedTemplate = null;
        this.confirmButton.disabled = true;

        const time = this.manager.closeModals() ? this.timeMax : this.timeMin;

        setTimeout(async () => {
            this.setTitle(this.titleDefault);

            // Fetch available templates
            await this.fetchTemplates();

            // Render template list
            this.renderTemplateList();

            this.modal.show();
        }, time);
    }

    async fetchTemplates() {
        try {
            const locale =
                eXeLearning.app.locale.lang || eXeLearning.config.locale;
            const response = await eXeLearning.app.api.getTemplates(locale);
            // API returns { templates: [...], locale, supportedLocales }
            this.templates = response?.templates || [];
        } catch (error) {
            console.error('Error fetching templates:', error);
            this.templates = [];
        }
    }

    renderTemplateList() {
        this.templateList.innerHTML = '';

        if (this.templates.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'alert alert-info';
            empty.innerHTML = _('No templates available for your language.');
            this.templateList.appendChild(empty);
            return;
        }

        this.templates.forEach((template) => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action';
            item.dataset.templatePath = template.path;
            item.dataset.templateName = template.name;

            const nameElement = document.createElement('div');
            nameElement.className = 'template-name';
            nameElement.textContent = template.name;

            item.appendChild(nameElement);

            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.selectTemplate(template);

                // Update UI selection state
                this.templateList
                    .querySelectorAll('.list-group-item')
                    .forEach((i) => {
                        i.classList.remove('active');
                    });
                item.classList.add('active');
            });

            this.templateList.appendChild(item);
        });
    }

    selectTemplate(template) {
        this.selectedTemplate = template;
        this.confirmButton.disabled = false;
    }

    async loadTemplate(template) {
        try {
            // Hide the modal
            this.modal.hide();

            // Clear the original file path to prevent it from being used
            try {
                delete window.__originalElpPath;
            } catch (_e) {
                // Intentional: property may not exist or be non-configurable
            }

            // Fetch the template file
            const response = await fetch(template.path);
            if (!response.ok) {
                throw new Error('Failed to fetch template file');
            }

            const blob = await response.blob();

            // Use a generic filename to avoid confusion
            const genericFilename = _('Untitled document') + '.elpx';
            const file = new File([blob], genericFilename, {
                type: 'application/octet-stream',
            });

            // Use the existing file upload workflow
            if (eXeLearning.app.modals.openuserodefiles) {
                await eXeLearning.app.modals.openuserodefiles.largeFilesUpload(
                    file
                );

                // CRITICAL: Clear the saved path AFTER upload completes
                // The upload sets the path to the temp file, which we need to remove
                // This ensures when user manually saves, they get prompted for location
                if (
                    window.electronAPI &&
                    typeof window.electronAPI.clearSavedPath === 'function'
                ) {
                    try {
                        // Wait a tiny bit to ensure the path was set first
                        await new Promise((resolve) =>
                            setTimeout(resolve, 100)
                        );
                        const projectId =
                            window.__currentProjectId || 'default';
                        await window.electronAPI.clearSavedPath(projectId);
                    } catch (_e) {
                        console.error('Failed to clear saved path:', _e);
                    }
                }
            } else {
                console.error('Open user ODE files modal not available');
            }
        } catch (error) {
            console.error('Error loading template:', error);
            eXeLearning.app.modals.alert.show({
                title: _('Error'),
                message: _('Failed to load template. Please try again.'),
            });
        }
    }
}
