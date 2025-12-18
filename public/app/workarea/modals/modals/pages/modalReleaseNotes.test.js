import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ModalReleaseNotes from './modalReleaseNotes.js';

describe('ModalReleaseNotes', () => {
  let modal;
  let mockManager;
  let mockElement;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn((key) => key);
    
    // Mock jQuery
    window.$ = vi.fn((selector, context) => {
      let elements;
      if (typeof selector === 'string') {
        elements = context ? context.querySelectorAll(selector) : document.querySelectorAll(selector);
      } else if (selector instanceof HTMLElement || selector === window || selector === document) {
        elements = [selector];
      } else if (selector && selector.length !== undefined) {
        elements = selector;
      } else {
        elements = [selector];
      }

      const mockObj = {
        each: function(callback) {
          elements.forEach((el, index) => {
            callback.call(el, index, el);
          });
          return this;
        },
        attr: vi.fn().mockImplementation(function(name, value) {
          if (value !== undefined) {
             elements.forEach(el => {
                 if (el.setAttribute) el.setAttribute(name, value);
                 else el[name] = value;
             });
             return this;
          }
          return elements[0]?.getAttribute ? elements[0].getAttribute(name) : elements[0][name];
        }),
        html: vi.fn().mockImplementation(function(val) {
          if (val !== undefined) {
            elements.forEach(el => el.innerHTML = val);
            return this;
          }
          return elements[0]?.innerHTML;
        }),
        on: vi.fn().mockReturnThis(),
      };
      return mockObj;
    });

    // Mock eXeLearning global
    window.eXeLearning = {
      app: {
        api: {
          getChangelogText: vi.fn().mockResolvedValue('## 2.8 - 2023-01-01\nChange log content'),
        },
        common: {
          markdownToHTML: vi.fn((text) => {
              const title = text.split('\n')[0].replace('##', '').trim();
              return `<div><h2>${title}</h2></div>`;
          }),
        },
      },
    };

    // Mock DOM
    mockElement = document.createElement('div');
    mockElement.id = 'modalReleaseNotes';
    mockElement.innerHTML = `
      <div class="modal-header">
        <h5 class="modal-title"></h5>
      </div>
      <div class="modal-body">
        <div class="body-release">
          <div class="changelog-content"></div>
        </div>
      </div>
    `;
    document.body.appendChild(mockElement);

    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      if (id === 'modalReleaseNotes') return mockElement;
      return null;
    });

    // Mock bootstrap.Modal
    mockBootstrapModal = {
      show: vi.fn(),
      hide: vi.fn(),
    };
    window.bootstrap = {
      Modal: vi.fn().mockImplementation(function() {
        return mockBootstrapModal;
      }),
    };

    // Mock interact
    const mockInteractable = {
      draggable: vi.fn().mockReturnThis(),
    };
    window.interact = vi.fn().mockImplementation(() => mockInteractable);
    window.interact.modifiers = {
      restrictRect: vi.fn(),
    };

    mockManager = {
      closeModals: vi.fn(() => false),
    };

    modal = new ModalReleaseNotes(mockManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('show', () => {
    it('should show the modal and set title', async () => {
      vi.useFakeTimers();
      modal.show();
      vi.advanceTimersByTime(500);
      expect(mockBootstrapModal.show).toHaveBeenCalled();
      expect(mockElement.querySelector('.modal-title').innerHTML).toBe('Release notes');
      vi.useRealTimers();
    });
  });

  describe('load', () => {
    it('should load changelog and format titles', async () => {
      await modal.load();
      
      expect(window.eXeLearning.app.api.getChangelogText).toHaveBeenCalled();
      
      const h2 = mockElement.querySelector('h2');
      expect(h2.innerHTML).toBe('2.8 <span>2023-01-01</span>');
      expect(h2.getAttribute('class')).toBe('lead mb-4');
    });
  });
});