import ModalChangePassword from './modalChangePassword.js';

describe('ModalChangePassword', () => {
  let modal;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  /** Fill the three fields as a user would. */
  function fill({ current = 'current-secret', next = 'brand-new-secret', confirm = 'brand-new-secret' } = {}) {
    modal.currentInput.value = current;
    modal.newInput.value = next;
    modal.confirmInput.value = confirm;
  }

  /** Stub fetch with a single response. */
  function mockFetch(status, body = {}) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    });
    return global.fetch;
  }

  beforeEach(() => {
    window._ = vi.fn(key => key);

    mockElement = document.createElement('div');
    mockElement.id = 'modalChangePassword';
    mockElement.innerHTML = `
      <div class="modal-header"><div class="modal-title"></div></div>
      <div class="modal-body">
        <form id="change-password-form">
          <div class="change-password-feedback alert d-none" role="alert"></div>
          <input type="password" id="change-password-current" name="currentPassword">
          <input type="password" id="change-password-new" name="newPassword">
          <div class="change-password-strength d-none" id="change-password-strength">
            <div class="progress"><div class="progress-bar change-password-strength-bar"></div></div>
            <small class="change-password-strength-label"></small>
          </div>
          <input type="password" id="change-password-confirm" name="confirmPassword">
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="cancel btn button-tertiary"></button>
        <button type="button" class="change-password-submit btn button-primary"></button>
      </div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation(id =>
      id === 'modalChangePassword' ? mockElement : null
    );

    mockBootstrapModal = { show: vi.fn(), hide: vi.fn() };
    window.bootstrap = {
      Modal: vi.fn().mockImplementation(function () {
        return mockBootstrapModal;
      }),
    };

    const mockInteractable = { draggable: vi.fn().mockReturnThis() };
    window.interact = vi.fn().mockImplementation(() => mockInteractable);
    window.interact.modifiers = { restrictRect: vi.fn() };

    window.eXeLearning = {
      config: { basePath: '/exe' },
      app: { api: { endpoints: {} } },
    };

    mockManager = { closeModals: vi.fn(() => false) };
    modal = new ModalChangePassword(mockManager);
    modal.behaviour();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete global.fetch;
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('binds the form controls', () => {
      expect(modal.id).toBe('modalChangePassword');
      expect(modal.currentInput).toBeTruthy();
      expect(modal.newInput).toBeTruthy();
      expect(modal.confirmInput).toBeTruthy();
      expect(modal.submitButton).toBeTruthy();
    });

    it('uses password inputs for every field', () => {
      [modal.currentInput, modal.newInput, modal.confirmInput].forEach(input => {
        expect(input.type).toBe('password');
      });
    });
  });

  describe('show', () => {
    it('opens the dialog with empty fields', () => {
      fill();
      modal.show();

      expect(mockBootstrapModal.show).toHaveBeenCalled();
      expect(modal.currentInput.value).toBe('');
      expect(modal.newInput.value).toBe('');
      expect(modal.confirmInput.value).toBe('');
    });

    it('clears a previous message', () => {
      modal.showError('previous error');
      modal.show();

      expect(modal.feedback.textContent).toBe('');
      expect(modal.feedback.classList.contains('d-none')).toBe(true);
    });
  });

  describe('client-side validation', () => {
    it('requires the current password', async () => {
      const fetchSpy = mockFetch(200);
      fill({ current: '' });

      await modal.submit();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(modal.feedback.textContent).toBe('Current password is incorrect');
    });

    it('requires a new password', async () => {
      const fetchSpy = mockFetch(200);
      fill({ next: '', confirm: '' });

      await modal.submit();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(modal.feedback.textContent).toContain('cannot be empty');
    });

    it('rejects a mismatched confirmation before calling the API', async () => {
      const fetchSpy = mockFetch(200);
      fill({ confirm: 'something-else' });

      await modal.submit();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(modal.feedback.textContent).toBe('Passwords do not match');
      expect(modal.feedback.classList.contains('alert-danger')).toBe(true);
    });

    it('keeps what the user typed after a validation error', async () => {
      mockFetch(200);
      fill({ confirm: 'something-else' });

      await modal.submit();

      expect(modal.currentInput.value).toBe('current-secret');
    });
  });

  describe('submit', () => {
    it('PATCHes the endpoint with both passwords in the body', async () => {
      const fetchSpy = mockFetch(200, { success: true });
      fill();

      await modal.submit();

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('/exe/api/user/password');
      expect(options.method).toBe('PATCH');
      expect(options.credentials).toBe('include');
      expect(JSON.parse(options.body)).toEqual({
        currentPassword: 'current-secret',
        newPassword: 'brand-new-secret',
      });
    });

    it('never puts a password in the URL', async () => {
      const fetchSpy = mockFetch(200, { success: true });
      fill();

      await modal.submit();

      const [url] = fetchSpy.mock.calls[0];
      expect(url).not.toContain('brand-new-secret');
      expect(url).not.toContain('?');
    });

    it('prefers the registered API route when available', async () => {
      window.eXeLearning.app.api.endpoints = {
        api_user_password_change: { path: '/sub/dir/api/user/password' },
      };
      const fetchSpy = mockFetch(200, { success: true });
      fill();

      await modal.submit();

      expect(fetchSpy.mock.calls[0][0]).toBe('/sub/dir/api/user/password');
    });

    it('shows a success message and clears the fields', async () => {
      mockFetch(200, { success: true });
      fill();

      await modal.submit();

      expect(modal.feedback.textContent).toBe('Password changed successfully');
      expect(modal.feedback.classList.contains('alert-success')).toBe(true);
      expect(modal.currentInput.value).toBe('');
      expect(modal.newInput.value).toBe('');
      expect(modal.confirmInput.value).toBe('');
    });

    it('reports a wrong current password without logging out', async () => {
      mockFetch(401, { error: 'INVALID_CURRENT_PASSWORD' });
      fill();

      await modal.submit();

      expect(modal.feedback.textContent).toBe('Current password is incorrect');
      expect(modal.feedback.classList.contains('alert-danger')).toBe(true);
    });

    it('reports an ineligible account', async () => {
      mockFetch(403, { message: 'Password changes are not available for this account.' });
      fill();

      await modal.submit();

      expect(modal.feedback.textContent).toBe('Password changes are not available for this account.');
    });

    it('surfaces a server validation message', async () => {
      mockFetch(422, { message: 'The new password must be at least 4 characters long.' });
      fill();

      await modal.submit();

      expect(modal.feedback.textContent).toBe('The new password must be at least 4 characters long.');
    });

    it('falls back to a generic message on an unexpected status', async () => {
      mockFetch(500, {});
      fill();

      await modal.submit();

      expect(modal.feedback.textContent).toBe('An error occurred. Please try again.');
    });

    it('handles a network failure without leaking the password', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('offline'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fill();

      await modal.submit();

      expect(modal.feedback.textContent).toBe('An error occurred. Please try again.');
      expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('brand-new-secret');
    });

    it('tolerates a response without a JSON body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json');
        },
      });
      fill();

      await modal.submit();

      expect(modal.feedback.textContent).toBe('An error occurred. Please try again.');
    });

    it('prevents a double submission while the request is running', async () => {
      let resolveRequest;
      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise(resolve => {
            resolveRequest = () => resolve({ ok: true, status: 200, json: async () => ({}) });
          })
      );
      fill();

      const first = modal.submit();
      expect(modal.submitButton.disabled).toBe(true);

      await modal.submit(); // ignored while in flight

      resolveRequest();
      await first;

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(modal.submitButton.disabled).toBe(false);
    });

    it('re-enables the button after a failure', async () => {
      mockFetch(500, {});
      fill();

      await modal.submit();

      expect(modal.submitButton.disabled).toBe(false);
    });

    it('submits when the form fires a submit event', async () => {
      const fetchSpy = mockFetch(200, { success: true });
      fill();

      modal.form.dispatchEvent(new Event('submit', { cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();

      expect(fetchSpy).toHaveBeenCalled();
    });

    it('submits when the footer button is clicked', async () => {
      const fetchSpy = mockFetch(200, { success: true });
      fill();

      modal.submitButton.click();
      await Promise.resolve();

      expect(fetchSpy).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('clears the fields when the dialog is hidden', () => {
      fill();

      mockElement.dispatchEvent(new Event('hidden.bs.modal'));

      expect(modal.currentInput.value).toBe('');
      expect(modal.newInput.value).toBe('');
      expect(modal.confirmInput.value).toBe('');
    });

    it('never keeps a password on the instance', async () => {
      mockFetch(200, { success: true });
      fill();

      await modal.submit();

      expect(JSON.stringify(Object.entries(modal).filter(([, v]) => typeof v === 'string'))).not.toContain(
        'brand-new-secret'
      );
    });
  });

  describe('strength indicator', () => {
    it('stays hidden while the new password is empty', () => {
      modal.newInput.value = '';
      modal.newInput.dispatchEvent(new Event('input'));

      expect(modal.strength.classList.contains('d-none')).toBe(true);
    });

    it('appears and reports a weak password', () => {
      modal.newInput.value = 'abcd';
      modal.newInput.dispatchEvent(new Event('input'));

      expect(modal.strength.classList.contains('d-none')).toBe(false);
      expect(modal.strengthLabel.textContent).toBe('Password strength: weak');
      expect(modal.strengthBar.classList.contains('strength-weak')).toBe(true);
    });

    it('reports a strong password', () => {
      modal.newInput.value = 'Corr3ct-Horse-Battery!';
      modal.newInput.dispatchEvent(new Event('input'));

      expect(modal.strengthLabel.textContent).toBe('Password strength: strong');
      expect(modal.strengthBar.style.width).toBe('100%');
    });

    it('flags a password below the accepted minimum', () => {
      modal.newInput.value = 'ab';
      modal.newInput.dispatchEvent(new Event('input'));

      expect(modal.strengthLabel.textContent).toBe('Password strength: too short');
    });

    it('replaces the previous level class instead of stacking them', () => {
      modal.newInput.value = 'abcd';
      modal.newInput.dispatchEvent(new Event('input'));
      modal.newInput.value = 'Corr3ct-Horse-Battery!';
      modal.newInput.dispatchEvent(new Event('input'));

      expect(modal.strengthBar.classList.contains('strength-weak')).toBe(false);
      expect(modal.strengthBar.classList.contains('strength-strong')).toBe(true);
    });

    it('never blocks submission, however weak the password is', async () => {
      const fetchSpy = mockFetch(200, { success: true });
      fill({ next: 'abcd', confirm: 'abcd' });
      modal.newInput.dispatchEvent(new Event('input'));

      await modal.submit();

      expect(fetchSpy).toHaveBeenCalled();
    });

    it('is hidden again after a successful change', async () => {
      mockFetch(200, { success: true });
      fill();
      modal.newInput.dispatchEvent(new Event('input'));

      await modal.submit();

      expect(modal.strength.classList.contains('d-none')).toBe(true);
    });
  });

  describe('endpointUrl', () => {
    it('falls back to the canonical path when no base path is configured', () => {
      window.eXeLearning.config.basePath = '';
      window.eXeLearning.app.api.endpoints = {};

      expect(modal.endpointUrl()).toBe('/api/user/password');
    });

    it('tolerates a missing api object', () => {
      window.eXeLearning.app = {};

      expect(modal.endpointUrl()).toBe('/exe/api/user/password');
    });
  });
});
