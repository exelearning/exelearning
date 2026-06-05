/**
 * Modal Class Tests
 *
 * Unit tests for the base Modal class that handles modal dialogs.
 *
 * Run with: make test-frontend
 */

 

import Modal from './modal.js';

describe('Modal', () => {
  let mockManager;
  let modalElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn((text) => text);

    // Mock interact.js
    window.interact = vi.fn(() => ({
      draggable: vi.fn().mockReturnThis(),
    }));
    window.interact.modifiers = {
      restrictRect: vi.fn(),
    };

    // Create modal DOM structure
    modalElement = document.createElement('div');
    modalElement.id = 'test-modal';
    modalElement.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title"></h5>
          <button class="close btn btn-secondary">X</button>
        </div>
        <div class="modal-body"></div>
        <div class="modal-footer">
          <button class="confirm btn btn-primary">Confirm</button>
          <button class="cancel btn btn-secondary">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modalElement);

    // Mock Bootstrap Modal - needs to be a proper constructor
    mockBootstrapModal = {
      show: vi.fn(),
      hide: vi.fn(),
      _isShown: false,
    };
    window.bootstrap = {
      Modal: function () {
        return mockBootstrapModal;
      },
    };

    // Mock manager
    mockManager = {
      closeModals: vi.fn().mockReturnValue(false),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    delete window._;
    delete window.interact;
    delete window.bootstrap;
  });

  describe('constructor', () => {
    it('sets manager reference', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.manager).toBe(mockManager);
    });

    it('sets id', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.id).toBe('test-modal');
    });

    it('sets titleDefault', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.titleDefault).toBe('Default Title');
    });

    it('sets clearAfterClose', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', true);
      expect(modal.clearAfterClose).toBe(true);
    });

    it('gets modal element by id', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.modalElement).toBe(modalElement);
    });

    it('queries modal header', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.modalElementHeader).not.toBeNull();
    });

    it('queries modal title', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.modalElementTitle).not.toBeNull();
    });

    it('queries modal body', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.modalElementBody).not.toBeNull();
    });

    it('queries confirm buttons', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.modalElementButtonsConfirm.length).toBeGreaterThan(0);
    });

    it('queries close buttons', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.modalElementButtonsClose.length).toBeGreaterThan(0);
    });

    it('queries cancel buttons', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.modalElementButtonsCancel.length).toBeGreaterThan(0);
    });

    it('creates Bootstrap Modal instance', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.modal).toBeDefined();
      expect(modal.modal.show).toBeDefined();
      expect(modal.modal.hide).toBeDefined();
    });

    it('sets data-open attribute to false initially', () => {
      new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modalElement.getAttribute('data-open')).toBe('false');
    });

    it('initializes preventCloseModal to false', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.preventCloseModal).toBe(false);
    });

    it('sets timeMax to 500', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.timeMax).toBe(500);
    });

    it('sets timeMin to 50', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal.timeMin).toBe(50);
    });
  });

  describe('behaviour', () => {
    it('calls interactModal', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const spy = vi.spyOn(modal, 'interactModal');
      modal.behaviour();
      expect(spy).toHaveBeenCalled();
    });

    it('calls addBehaviourCloseModal', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const spy = vi.spyOn(modal, 'addBehaviourCloseModal');
      modal.behaviour();
      expect(spy).toHaveBeenCalled();
    });

    it('calls addBehaviourCancelModal', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const spy = vi.spyOn(modal, 'addBehaviourCancelModal');
      modal.behaviour();
      expect(spy).toHaveBeenCalled();
    });

    it('calls addBehaviourButtonConfirm', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const spy = vi.spyOn(modal, 'addBehaviourButtonConfirm');
      modal.behaviour();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('button event bindings', () => {
    it('close button click calls close', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const closeSpy = vi.spyOn(modal, 'close');
      modal.addBehaviourCloseModal();
      modal.modalElementButtonsClose[0].click();
      expect(closeSpy).toHaveBeenCalled();
    });

    it('cancel button click triggers cancel handler', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const cancelSpy = vi
        .spyOn(modal, 'cancel')
        .mockImplementation(async () => {});
      modal.addBehaviourCancelModal();
      modal.modalElementButtonsCancel[0].click();
      expect(cancelSpy).toHaveBeenCalled();
    });

    it('confirm button click triggers confirm handler', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const confirmSpy = vi
        .spyOn(modal, 'confirm')
        .mockImplementation(async () => {});
      modal.addBehaviourButtonConfirm();
      modal.modalElementButtonsConfirm[0].click();
      expect(confirmSpy).toHaveBeenCalled();
    });
  });

  describe('addBehaviourExeTabs', () => {
    it('switches exe content when content exists', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const tabs = document.createElement('ul');
      tabs.classList.add('exe-form-tabs');
      tabs.innerHTML = `
        <li><a href="#tab-one">Tab 1</a></li>
        <li><a href="#tab-two">Tab 2</a></li>
      `;
      const contentOne = document.createElement('div');
      contentOne.classList.add('exe-form-content');
      contentOne.id = 'tab-one';
      const contentTwo = document.createElement('div');
      contentTwo.classList.add('exe-form-content');
      contentTwo.id = 'tab-two';
      modal.modalElementBody.appendChild(tabs);
      modal.modalElementBody.appendChild(contentOne);
      modal.modalElementBody.appendChild(contentTwo);

      const hideSpy = vi.spyOn(modal, 'hideHelpContentAll');
      modal.addBehaviourExeTabs();

      const firstLink = modal.modalElement.querySelector(
        '.exe-form-tabs li a[href="#tab-one"]'
      );
      firstLink.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(hideSpy).toHaveBeenCalled();
      expect(firstLink.classList.contains('exe-form-active-tab')).toBe(true);
      expect(contentOne.classList.contains('exe-form-active-content')).toBe(true);
      expect(modal.tabSelectedLink).toBe('#tab-one');
    });

    it('toggles row content when exe-form-content elements are absent', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.modalElementBody.innerHTML += `
        <ul class="exe-form-tabs">
          <li><a href="#cat-one">Category 1</a></li>
        </ul>
        <div class="exe-form-content-rows">
          <div class="row-form-content" category="cat-one"></div>
          <div class="row-form-content" category="cat-two"></div>
        </div>
      `;

      modal.addBehaviourExeTabs();
      const rowLink = modal.modalElement.querySelector('.exe-form-tabs li a');
      rowLink.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      const rows = modal.modalElement.querySelectorAll('.row-form-content');
      expect(rows[0].classList.contains('hidden')).toBe(false);
      expect(rows[1].classList.contains('hidden')).toBe(true);
    });
  });

  describe('addBehaviourExeHelp', () => {
    it('sets up help toggles and shows help content when icon clicked', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const help = document.createElement('div');
      help.classList.add('exe-form-help');
      const helpContent = document.createElement('div');
      helpContent.classList.add('help-content', 'help-hidden');
      const icon = document.createElement('icon');
      icon.classList.add('form-help-exe-icon');
      help.appendChild(helpContent);
      help.appendChild(icon);
      modal.modalElementBody.appendChild(help);

      const hideSpy = vi.spyOn(modal, 'hideHelpContentAll');
      modal.addBehaviourExeHelp();

      icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(hideSpy).toHaveBeenCalled();
      expect(help.getAttribute('title')).toBe('Information');
      expect(helpContent.classList.contains('help-hidden')).toBe(false);
      expect(help.classList.contains('help-content-active')).toBe(true);
      expect(help.classList.contains('help-content-disabled')).toBe(false);
    });
  });

  describe('addBehaviourBodyToHideHelpDialogs', () => {
    it('does not close help when clicking help icon, but hides otherwise', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const hideSpy = vi.spyOn(modal, 'hideHelpContentAll');
      modal.addBehaviourBodyToHideHelpDialogs();

      const icon = document.createElement('span');
      icon.classList.add('form-help-exe-icon');
      modal.modalElement.appendChild(icon);
      icon.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(hideSpy).not.toHaveBeenCalled();

      modal.modalElement.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(hideSpy).toHaveBeenCalled();
    });
  });

  describe('setTitle', () => {
    it('sets modal title innerHTML', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.setTitle('New Title');
      expect(modal.modalElementTitle.innerHTML).toBe('New Title');
    });
  });

  describe('setBody', () => {
    it('sets modal body innerHTML', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.setBody('<p>Body content</p>');
      expect(modal.modalElementBody.innerHTML).toBe('<p>Body content</p>');
    });
  });

  describe('setContentId', () => {
    it('sets modal-content-id attribute when provided', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.setContentId('content-123');
      expect(modal.modalElementHeader.getAttribute('modal-content-id')).toBe('content-123');
      expect(modal.modalElementBody.getAttribute('modal-content-id')).toBe('content-123');
    });

    it('removes attribute when contentId is null', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.setContentId('content-123');
      modal.setContentId(null);
      expect(modal.modalElementHeader.hasAttribute('modal-content-id')).toBe(false);
      expect(modal.modalElementBody.hasAttribute('modal-content-id')).toBe(false);
    });
  });

  describe('setConfirmExec', () => {
    it('sets confirmExec function', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const func = vi.fn();
      modal.setConfirmExec(func);
      expect(modal.confirmExec).toBe(func);
    });
  });

  describe('setCancelExec', () => {
    it('sets cancelExec function', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const func = vi.fn();
      modal.setCancelExec(func);
      expect(modal.cancelExec).toBe(func);
    });
  });

  describe('setCloseExec', () => {
    it('sets closeExec function', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const func = vi.fn();
      modal.setCloseExec(func);
      expect(modal.closeExec).toBe(func);
    });
  });

  describe('show', () => {
    it('calls manager.closeModals', async () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.show();
      expect(mockManager.closeModals).toHaveBeenCalled();
    });

    it('sets title from data', async () => {
      vi.useFakeTimers();
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.show({ title: 'Custom Title' });
      vi.advanceTimersByTime(100);
      expect(modal.modalElementTitle.innerHTML).toBe('Custom Title');
      vi.useRealTimers();
    });

    it('uses titleDefault when no title provided', async () => {
      vi.useFakeTimers();
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.show({});
      vi.advanceTimersByTime(100);
      expect(modal.modalElementTitle.innerHTML).toBe('Default Title');
      vi.useRealTimers();
    });

    it('sets body from data', async () => {
      vi.useFakeTimers();
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.show({ body: '<p>Body</p>' });
      vi.advanceTimersByTime(100);
      expect(modal.modalElementBody.innerHTML).toBe('<p>Body</p>');
      vi.useRealTimers();
    });

    it('calls Bootstrap modal.show()', async () => {
      vi.useFakeTimers();
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.show();
      vi.advanceTimersByTime(100);
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('close', () => {
    it('calls Bootstrap modal.hide()', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.close();
      expect(mockBootstrapModal.hide).toHaveBeenCalled();
    });

    it('returns false when preventCloseModal is true', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.preventCloseModal = true;
      const result = modal.close();
      expect(result).toBe(false);
      expect(mockBootstrapModal.hide).not.toHaveBeenCalled();
    });

    it('resets preventCloseModal to false', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.preventCloseModal = true;
      modal.close();
      expect(modal.preventCloseModal).toBe(false);
    });

    it('calls closeExec when not confirming', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const closeExec = vi.fn();
      modal.setCloseExec(closeExec);
      modal.close(false);
      expect(closeExec).toHaveBeenCalled();
    });

    it('does not call closeExec when confirming', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const closeExec = vi.fn();
      modal.setCloseExec(closeExec);
      modal.close(true);
      expect(closeExec).not.toHaveBeenCalled();
    });

    it('clears content when clearAfterClose is true', () => {
      vi.useFakeTimers();
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', true);
      modal.setTitle('Test Title');
      modal.setBody('Test Body');
      modal.close();
      vi.advanceTimersByTime(200);
      expect(modal.modalElementTitle.innerHTML).toBe('');
      expect(modal.modalElementBody.innerHTML).toBe('');
      vi.useRealTimers();
    });

    it('clears interval if set', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.intervalCloseCheck = setInterval(() => {}, 1000);
      const clearSpy = vi.spyOn(global, 'clearInterval');
      modal.close();
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    it('disables confirm buttons', async () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      await modal.confirm();
      modal.modalElementButtonsConfirm.forEach((btn) => {
        expect(btn.classList.contains('disabled')).toBe(true);
      });
    });

    it('calls confirmExec', async () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const confirmExec = vi.fn();
      modal.setConfirmExec(confirmExec);
      await modal.confirm();
      expect(confirmExec).toHaveBeenCalled();
    });

    it('calls close with true', async () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const closeSpy = vi.spyOn(modal, 'close');
      await modal.confirm();
      expect(closeSpy).toHaveBeenCalledWith(true);
    });

    it('re-enables confirm buttons after timeout', async () => {
      vi.useFakeTimers();
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      await modal.confirm();
      vi.advanceTimersByTime(600);
      modal.modalElementButtonsConfirm.forEach((btn) => {
        expect(btn.classList.contains('disabled')).toBe(false);
      });
      vi.useRealTimers();
    });
  });

  describe('cancel', () => {
    it('disables cancel buttons', async () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      await modal.cancel();
      modal.modalElementButtonsCancel.forEach((btn) => {
        expect(btn.classList.contains('disabled')).toBe(true);
      });
    });

    it('calls cancelExec', async () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const cancelExec = vi.fn();
      modal.setCancelExec(cancelExec);
      await modal.cancel();
      expect(cancelExec).toHaveBeenCalled();
    });

    it('calls close with true', async () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const closeSpy = vi.spyOn(modal, 'close');
      await modal.cancel();
      expect(closeSpy).toHaveBeenCalledWith(true);
    });
  });

  describe('interactModal', () => {
    it('makes modal header draggable', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.interactModal();
      expect(window.interact).toHaveBeenCalledWith('#test-modal.modal .modal-header');
    });
  });

  describe('dragMoveModalListener', () => {
    it('updates transform when not static', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const modalContent = document.createElement('div');
      const event = {
        target: { parentNode: modalContent },
        dx: 10,
        dy: 20,
      };

      modal.dragMoveModalListener(event);

      expect(modalContent.style.transform).toBe('translate(10px, 20px)');
      expect(modalContent.getAttribute('data-x')).toBe('10');
      expect(modalContent.getAttribute('data-y')).toBe('20');
    });

    it('does not move when static', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const modalContent = document.createElement('div');
      modalContent.classList.add('static');
      const event = {
        target: { parentNode: modalContent },
        dx: 10,
        dy: 20,
      };

      modal.dragMoveModalListener(event);

      expect(modalContent.style.transform).toBe('');
    });

    it('accumulates position from data attributes', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const modalContent = document.createElement('div');
      modalContent.setAttribute('data-x', '100');
      modalContent.setAttribute('data-y', '50');
      const event = {
        target: { parentNode: modalContent },
        dx: 10,
        dy: 20,
      };

      modal.dragMoveModalListener(event);

      expect(modalContent.getAttribute('data-x')).toBe('110');
      expect(modalContent.getAttribute('data-y')).toBe('70');
    });
  });

  describe('showHelpContent', () => {
    it('removes help-hidden class from content', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const helpContainer = document.createElement('div');
      const helpContent = document.createElement('div');
      helpContent.classList.add('help-content', 'help-hidden');
      helpContainer.appendChild(helpContent);

      modal.showHelpContent(helpContainer);

      expect(helpContent.classList.contains('help-hidden')).toBe(false);
    });

    it('adds help-content-active class', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const helpContainer = document.createElement('div');
      const helpContent = document.createElement('div');
      helpContent.classList.add('help-content');
      helpContainer.appendChild(helpContent);

      modal.showHelpContent(helpContainer);

      expect(helpContainer.classList.contains('help-content-active')).toBe(true);
    });

    it('removes help-content-disabled class', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const helpContainer = document.createElement('div');
      helpContainer.classList.add('help-content-disabled');
      const helpContent = document.createElement('div');
      helpContent.classList.add('help-content');
      helpContainer.appendChild(helpContent);

      modal.showHelpContent(helpContainer);

      expect(helpContainer.classList.contains('help-content-disabled')).toBe(false);
    });
  });

  describe('hideHelpContent', () => {
    it('adds help-hidden class to content', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const helpContainer = document.createElement('div');
      const helpContent = document.createElement('div');
      helpContent.classList.add('help-content');
      helpContainer.appendChild(helpContent);

      modal.hideHelpContent(helpContainer);

      expect(helpContent.classList.contains('help-hidden')).toBe(true);
    });

    it('adds help-content-disabled class', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const helpContainer = document.createElement('div');
      const helpContent = document.createElement('div');
      helpContent.classList.add('help-content');
      helpContainer.appendChild(helpContent);

      modal.hideHelpContent(helpContainer);

      expect(helpContainer.classList.contains('help-content-disabled')).toBe(true);
    });

    it('removes help-content-active class', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const helpContainer = document.createElement('div');
      helpContainer.classList.add('help-content-active');
      const helpContent = document.createElement('div');
      helpContent.classList.add('help-content');
      helpContainer.appendChild(helpContent);

      modal.hideHelpContent(helpContainer);

      expect(helpContainer.classList.contains('help-content-active')).toBe(false);
    });
  });

  describe('sorTable', () => {
    let table;

    beforeEach(() => {
      table = document.createElement('table');
      table.innerHTML = `
        <tr><th>Name</th></tr>
        <tr><td>Banana</td></tr>
        <tr><td>Apple</td></tr>
        <tr><td>Cherry</td></tr>
      `;
    });

    it('sorts strings ascending', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.sorTable(table, 0, 'string');
      const cells = table.querySelectorAll('td');
      expect(cells[0].innerHTML).toBe('Apple');
      expect(cells[1].innerHTML).toBe('Banana');
      expect(cells[2].innerHTML).toBe('Cherry');
    });

    it('sorts strings descending on second call', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.sorTable(table, 0, 'string'); // First sort: asc
      modal.sorTable(table, 0, 'string'); // Second sort: desc
      const cells = table.querySelectorAll('td');
      expect(cells[0].innerHTML).toBe('Cherry');
    });

    it('sets sort-type attribute', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.sorTable(table, 0, 'string');
      expect(table.rows[0].getAttribute('sort-type')).toBe('desc');
    });
  });

  describe('sorTableString', () => {
    it('returns true for asc when x > y', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const x = { innerHTML: 'banana' };
      const y = { innerHTML: 'apple' };
      expect(modal.sorTableString('asc', x, y)).toBe(true);
    });

    it('returns false for asc when x < y', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const x = { innerHTML: 'apple' };
      const y = { innerHTML: 'banana' };
      expect(modal.sorTableString('asc', x, y)).toBe(false);
    });

    it('returns true for desc when x < y', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const x = { innerHTML: 'apple' };
      const y = { innerHTML: 'banana' };
      expect(modal.sorTableString('desc', x, y)).toBe(true);
    });
  });

  describe('sorTableDate', () => {
    it('compares ids for asc sort', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      // String comparison: '600' > '500' (6 > 5 lexicographically)
      const x = { id: '600' };
      const y = { id: '500' };
      expect(modal.sorTableDate('asc', x, y)).toBe(true);
    });

    it('compares ids for desc sort', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      // String comparison: '500' < '600' (5 < 6 lexicographically)
      const x = { id: '500' };
      const y = { id: '600' };
      expect(modal.sorTableDate('desc', x, y)).toBe(true);
    });
  });

  describe('sorTableFloat', () => {
    it('compares size attribute as float for asc', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const x = { getAttribute: () => '10.5' };
      const y = { getAttribute: () => '5.5' };
      expect(modal.sorTableFloat('asc', x, y)).toBe(true);
    });

    it('compares size attribute as float for desc', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const x = { getAttribute: () => '5.5' };
      const y = { getAttribute: () => '10.5' };
      expect(modal.sorTableFloat('desc', x, y)).toBe(true);
    });
  });

  describe('sorTableCheckbox', () => {
    it('compares checkbox checked state for asc', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const x = { querySelector: () => ({ checked: true }) };
      const y = { querySelector: () => ({ checked: false }) };
      expect(modal.sorTableCheckbox('asc', x, y)).toBe(true);
    });

    it('compares checkbox checked state for desc', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const x = { querySelector: () => ({ checked: false }) };
      const y = { querySelector: () => ({ checked: true }) };
      expect(modal.sorTableCheckbox('desc', x, y)).toBe(true);
    });
  });

  describe('table sorting fallbacks', () => {
    it('returns false when type is unsupported', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const table = document.createElement('table');
      table.innerHTML = `
        <tr><th></th></tr>
        <tr><td>One</td></tr>
        <tr><td>Two</td></tr>
      `;

      expect(modal.sorTable(table, 0, 'unknown')).toBe(false);
    });

    it('returns false when sorTableDate receives invalid sort', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const x = { id: '1' };
      const y = { id: '2' };
      expect(modal.sorTableDate('random', x, y)).toBe(false);
    });

    it('returns false when sorTableFloat receives invalid sort', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const x = { getAttribute: () => '5' };
      const y = { getAttribute: () => '6' };
      expect(modal.sorTableFloat('random', x, y)).toBe(false);
    });

    it('returns false when sorTableCheckbox receives invalid sort', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const x = { querySelector: () => ({ checked: true }) };
      const y = { querySelector: () => ({ checked: false }) };
      expect(modal.sorTableCheckbox('random', x, y)).toBe(false);
    });
  });

  describe('makeFilterTable', () => {
    it('creates input element with correct class', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const container = document.createElement('div');
      const input = modal.makeFilterTable(container, '.name', 'Search...');

      expect(input.tagName).toBe('INPUT');
      expect(input.classList.contains('table-filter')).toBe(true);
      expect(input.classList.contains('form-control')).toBe(true);
    });

    it('sets placeholder', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const container = document.createElement('div');
      const input = modal.makeFilterTable(container, '.name', 'Search items...');

      expect(input.getAttribute('placeholder')).toBe('Search items...');
    });

    it('filters table rows on keyup', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const container = document.createElement('div');
      container.innerHTML = `
        <table>
          <tr><td class="name">Apple</td></tr>
          <tr><td class="name">Banana</td></tr>
          <tr><td class="name">Cherry</td></tr>
        </table>
      `;
      document.body.appendChild(container);

      const input = modal.makeFilterTable(container, '.name', 'Search');
      input.value = 'ban';
      input.dispatchEvent(new Event('keyup'));

      const rows = container.querySelectorAll('tr');
      expect(rows[0].style.display).toBe('none'); // Apple
      expect(rows[1].style.display).toBe(''); // Banana
      expect(rows[2].style.display).toBe('none'); // Cherry
    });
  });

  describe('initCloseCheckInterval', () => {
    it('sets interval', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      modal.initCloseCheckInterval();
      expect(modal.intervalCloseCheck).toBeDefined();
      clearInterval(modal.intervalCloseCheck);
    });

    it('calls close when modal is hidden', () => {
      vi.useFakeTimers();
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const closeSpy = vi.spyOn(modal, 'close');

      mockBootstrapModal._isShown = false;
      modal.initCloseCheckInterval();

      vi.advanceTimersByTime(150);

      expect(closeSpy).toHaveBeenCalled();
      clearInterval(modal.intervalCloseCheck);
      vi.useRealTimers();
    });
  });

  describe('Bootstrap modal events', () => {
    it('sets data-open to true on shown.bs.modal', () => {
      new Modal(mockManager, 'test-modal', 'Default Title', false);
      modalElement.dispatchEvent(new Event('shown.bs.modal'));
      expect(modalElement.getAttribute('data-open')).toBe('true');
    });

    it('sets data-open to false on hidden.bs.modal', () => {
      new Modal(mockManager, 'test-modal', 'Default Title', false);
      modalElement.setAttribute('data-open', 'true');
      modalElement.dispatchEvent(new Event('hidden.bs.modal'));
      expect(modalElement.getAttribute('data-open')).toBe('false');
    });
  });

  describe('tableToCSV', () => {
    it('converts a basic table to CSV', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr><th>Name</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr><td>Apple</td><td>100</td></tr>
          <tr><td>Banana</td><td>200</td></tr>
        </tbody>
      `;

      const csv = modal.tableToCSV(table);

      expect(csv).toBe('Name,Value\r\nApple,100\r\nBanana,200');
    });

    it('skips specified columns', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr><th>Status</th><th>Name</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr><td>OK</td><td>Apple</td><td>100</td></tr>
        </tbody>
      `;

      const csv = modal.tableToCSV(table, { skipColumns: [0] });

      expect(csv).toBe('Name,Value\r\nApple,100');
    });

    it('skips multiple columns', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr><th>A</th><th>B</th><th>C</th><th>D</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>2</td><td>3</td><td>4</td></tr>
        </tbody>
      `;

      const csv = modal.tableToCSV(table, { skipColumns: [0, 2] });

      expect(csv).toBe('B,D\r\n2,4');
    });

    it('skips placeholder rows with colspan', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr><th>Name</th><th>Value</th></tr>
        </thead>
        <tbody>
          <tr><td colspan="2">No data found</td></tr>
        </tbody>
      `;

      const csv = modal.tableToCSV(table);

      expect(csv).toBe('Name,Value');
    });

    it('escapes values with commas', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr><th>Name</th></tr>
        </thead>
        <tbody>
          <tr><td>Hello, World</td></tr>
        </tbody>
      `;

      const csv = modal.tableToCSV(table);

      expect(csv).toBe('Name\r\n"Hello, World"');
    });

    it('escapes values with quotes', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr><th>Name</th></tr>
        </thead>
        <tbody>
          <tr><td>Say "Hello"</td></tr>
        </tbody>
      `;

      const csv = modal.tableToCSV(table);

      expect(csv).toBe('Name\r\n"Say ""Hello"""');
    });

    it('handles empty table', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr><th>Name</th></tr>
        </thead>
        <tbody></tbody>
      `;

      const csv = modal.tableToCSV(table);

      expect(csv).toBe('Name');
    });

    it('handles table without thead', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const table = document.createElement('table');
      table.innerHTML = `
        <tbody>
          <tr><td>Apple</td><td>100</td></tr>
        </tbody>
      `;

      const csv = modal.tableToCSV(table);

      expect(csv).toBe('Apple,100');
    });

    it('handles thead with th as direct children (programmatically created)', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      // Create table programmatically like modalOdeUsedFiles.makeTheadElements() does
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      ['File', 'Path', 'Size'].forEach((title) => {
        const th = document.createElement('th');
        th.textContent = title;
        thead.appendChild(th);
      });
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      const tr = document.createElement('tr');
      ['image.png', '/files/image.png', '100KB'].forEach((value) => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
      table.appendChild(tbody);

      const csv = modal.tableToCSV(table);

      expect(csv).toBe('File,Path,Size\r\nimage.png,/files/image.png,100KB');
    });
  });

  describe('_escapeCSVValue', () => {
    it('returns empty string for null', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal._escapeCSVValue(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal._escapeCSVValue(undefined)).toBe('');
    });

    it('returns value unchanged if no special characters', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal._escapeCSVValue('Hello World')).toBe('Hello World');
    });

    it('wraps value in quotes if it contains a comma', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal._escapeCSVValue('Hello, World')).toBe('"Hello, World"');
    });

    it('wraps value in quotes and doubles quotes if value contains quotes', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal._escapeCSVValue('Say "Hi"')).toBe('"Say ""Hi"""');
    });

    it('wraps value in quotes if it contains a newline', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal._escapeCSVValue('Line1\nLine2')).toBe('"Line1\nLine2"');
    });

    it('wraps value in quotes if it contains a carriage return', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal._escapeCSVValue('Line1\rLine2')).toBe('"Line1\rLine2"');
    });

    it('converts numbers to strings', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      expect(modal._escapeCSVValue(42)).toBe('42');
    });
  });

  describe('downloadCSVFile', () => {
    let originalCreateObjectURL;
    let originalRevokeObjectURL;

    beforeEach(() => {
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn().mockReturnValue('blob:test-url');
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('creates blob with UTF-8 BOM', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);
      const blobSpy = vi.spyOn(window, 'Blob');

      modal.downloadCSVFile('Name,Value\r\nApple,100', 'test.csv');

      expect(blobSpy).toHaveBeenCalled();
      const blobArgs = blobSpy.mock.calls[0][0];
      expect(blobArgs[0]).toBe('\ufeff');
    });

    it('sets correct download filename and triggers click', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);

      // Spy on the actual DOM operations
      let capturedHref = null;
      let capturedDownload = null;
      let clickCalled = false;

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
        const el = originalCreateElement(tagName);
        if (tagName === 'a') {
          const originalClickFn = el.click.bind(el);
          el.click = () => {
            clickCalled = true;
            capturedHref = el.href;
            capturedDownload = el.download;
          };
        }
        return el;
      });

      modal.downloadCSVFile('content', 'test-report.csv');

      expect(clickCalled).toBe(true);
      expect(capturedDownload).toBe('test-report.csv');
      expect(capturedHref).toBe('blob:test-url');

      vi.restoreAllMocks();
    });

    it('revokes blob URL after download', () => {
      const modal = new Modal(mockManager, 'test-modal', 'Default Title', false);

      modal.downloadCSVFile('content', 'test.csv');

      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
    });
  });
});
