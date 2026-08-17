import Modal from '../modal.js';
import { scorePasswordStrength } from '../../../../utils/passwordStrength.js';

/**
 * Self-service "Change password" dialog.
 *
 * Only reachable from the user menu when the server decided the session may
 * change its password (`user.canChangePassword`). The backend re-checks every
 * rule; hiding the entry is a UX affordance, not an authorization boundary.
 *
 * Passwords live only in the input elements: they are read at submit time, sent
 * over PATCH, and cleared afterwards. They are never logged, never stored on the
 * instance and never put in a URL.
 */
export default class ModalChangePassword extends Modal {
    constructor(manager) {
        super(manager, 'modalChangePassword', _('Change password'), false);

        this.form = this.modalElement.querySelector('#change-password-form');
        this.currentInput = this.modalElement.querySelector('#change-password-current');
        this.newInput = this.modalElement.querySelector('#change-password-new');
        this.confirmInput = this.modalElement.querySelector('#change-password-confirm');
        this.feedback = this.modalElement.querySelector('.change-password-feedback');
        this.strength = this.modalElement.querySelector('#change-password-strength');
        this.strengthBar = this.modalElement.querySelector(
            '.change-password-strength-bar'
        );
        this.strengthLabel = this.modalElement.querySelector(
            '.change-password-strength-label'
        );
        this.submitButton = this.modalElement.querySelector('.change-password-submit');
        this.cancelButton = this.modalElement.querySelector(
            'button.cancel.btn.button-tertiary'
        );
        this.submitting = false;
    }

    /**
     * Wire the dialog. Called once by ModalsManagement.
     */
    behaviour() {
        super.behaviour();

        if (this.submitButton) {
            this.submitButton.addEventListener('click', () => this.submit());
        }

        // Submitting the form (Enter in any field) must not navigate.
        if (this.form) {
            this.form.addEventListener('submit', (event) => {
                event.preventDefault();
                this.submit();
            });
        }

        // Advisory strength indicator, updated as the user types.
        if (this.newInput) {
            this.newInput.addEventListener('input', () => this.updateStrength());
        }

        // Clear the fields whenever the dialog goes away, however it was closed.
        this.modalElement.addEventListener('hidden.bs.modal', () => this.reset());
    }

    /**
     * Refresh the strength indicator from the current "New password" value.
     * Purely informative: it never prevents submission.
     */
    updateStrength() {
        if (!this.strength) return;

        const { level, percent } = scorePasswordStrength(this.newInput?.value ?? '');

        if (level === 'empty') {
            this.strength.classList.add('d-none');
            return;
        }

        this.strength.classList.remove('d-none');
        if (this.strengthBar) {
            this.strengthBar.style.width = `${percent}%`;
            this.strengthBar.className = `progress-bar change-password-strength-bar strength-${level}`;
        }
        if (this.strengthLabel) {
            this.strengthLabel.textContent = this.strengthText(level);
        }
    }

    /**
     * Translated label for a strength level.
     *
     * @param {String} level
     * @returns {String}
     */
    strengthText(level) {
        switch (level) {
            case 'too-short':
                return _('Password strength: too short');
            case 'weak':
                return _('Password strength: weak');
            case 'fair':
                return _('Password strength: fair');
            case 'good':
                return _('Password strength: good');
            case 'strong':
                return _('Password strength: strong');
            default:
                return '';
        }
    }

    /**
     * Show the dialog with empty fields.
     */
    show() {
        this.reset();
        this.modal.show();
        setTimeout(() => {
            this.currentInput?.focus();
        }, this.timeMax);
    }

    /**
     * Empty every field and any previous message.
     */
    reset() {
        [this.currentInput, this.newInput, this.confirmInput].forEach((input) => {
            if (input) input.value = '';
        });
        this.strength?.classList.add('d-none');
        this.clearFeedback();
        this.setSubmitting(false);
    }

    /**
     * Validate client-side, then ask the server to change the password.
     */
    async submit() {
        if (this.submitting) return;

        const currentPassword = this.currentInput?.value ?? '';
        const newPassword = this.newInput?.value ?? '';
        const confirmPassword = this.confirmInput?.value ?? '';

        if (!currentPassword) {
            this.showError(_('Current password is incorrect'), this.currentInput);
            return;
        }
        if (!newPassword) {
            this.showError(_('The new password cannot be empty.'), this.newInput);
            return;
        }
        if (newPassword !== confirmPassword) {
            this.showError(_('Passwords do not match'), this.confirmInput);
            return;
        }

        this.setSubmitting(true);
        this.clearFeedback();

        try {
            const response = await this.requestChange(currentPassword, newPassword);

            if (response.ok) {
                this.reset();
                this.showSuccess(_('Password changed successfully'));
                return;
            }

            this.showError(this.messageForStatus(response.status, response.body));
        } catch (error) {
            // Never log the credentials, only the failure.
            console.error('[ModalChangePassword] Request failed');
            this.showError(_('An error occurred. Please try again.'));
        } finally {
            this.setSubmitting(false);
        }
    }

    /**
     * PATCH the new password.
     *
     * Uses fetch directly rather than the shared API helper: that helper turns
     * any 401/403 into a "session expired" redirect, which would log the user
     * out when they simply mistyped their current password.
     *
     * @returns {Promise<{ok: boolean, status: number, body: Object}>}
     */
    async requestChange(currentPassword, newPassword) {
        const response = await fetch(this.endpointUrl(), {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword }),
        });

        let body = {};
        try {
            body = await response.json();
        } catch (error) {
            body = {};
        }

        return { ok: response.ok, status: response.status, body };
    }

    /**
     * Resolve the endpoint from the API route registry, falling back to the
     * canonical path prefixed with the install base path.
     *
     * @returns {String}
     */
    endpointUrl() {
        const registered =
            eXeLearning?.app?.api?.endpoints?.api_user_password_change?.path;
        if (registered) return registered;

        const basePath = eXeLearning?.config?.basePath || '';
        return `${basePath}/api/user/password`;
    }

    /**
     * Map an API failure to a message the user can act on.
     *
     * @param {Number} status
     * @param {Object} body
     * @returns {String}
     */
    messageForStatus(status, body) {
        if (status === 401) return _('Current password is incorrect');
        if (status === 403) {
            return _('Password changes are not available for this account.');
        }
        if (status === 400 || status === 422) {
            return body?.message || _('The new password is not valid.');
        }
        return _('An error occurred. Please try again.');
    }

    /**
     * @param {Boolean} submitting
     */
    setSubmitting(submitting) {
        this.submitting = submitting;
        if (this.submitButton) {
            this.submitButton.disabled = submitting;
            this.submitButton.classList.toggle('disabled', submitting);
        }
    }

    /**
     * @param {String} message
     * @param {HTMLElement} [focusTarget]
     */
    showError(message, focusTarget) {
        this.setFeedback(message, 'alert-danger');
        focusTarget?.focus();
    }

    /**
     * @param {String} message
     */
    showSuccess(message) {
        this.setFeedback(message, 'alert-success');
    }

    /**
     * @param {String} message
     * @param {String} variant
     */
    setFeedback(message, variant) {
        if (!this.feedback) return;
        this.feedback.textContent = message;
        this.feedback.classList.remove('d-none', 'alert-danger', 'alert-success');
        this.feedback.classList.add(variant);
    }

    clearFeedback() {
        if (!this.feedback) return;
        this.feedback.textContent = '';
        this.feedback.classList.remove('alert-danger', 'alert-success');
        this.feedback.classList.add('d-none');
    }
}
