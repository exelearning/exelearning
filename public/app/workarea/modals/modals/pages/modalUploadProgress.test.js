import ModalUploadProgress from './modalUploadProgress.js';

describe('ModalUploadProgress', () => {
  let modalProgress;
  let mockContainer;
  let mockBootstrapModal;

  beforeEach(() => {
    // Mock translation function
    window._ = vi.fn(key => key);

    mockContainer = document.createElement('div');
    document.body.appendChild(mockContainer);

    // Mock bootstrap.Modal
    mockBootstrapModal = {
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
    };
    window.bootstrap = {
      Modal: vi.fn().mockImplementation(function() {
        return mockBootstrapModal;
      }),
    };
    window.bootstrap.Modal.getInstance = vi.fn(() => mockBootstrapModal);

    modalProgress = new ModalUploadProgress(mockContainer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('show', () => {
    it('should create modal HTML and show it', () => {
      modalProgress.show({ fileName: 'test.zip', fileSize: 1024 });
      
      expect(mockContainer.querySelector('#uploadProgressModal')).not.toBeNull();
      expect(mockContainer.querySelector('.upload-file-name').textContent).toContain('test.zip');
      expect(mockContainer.querySelector('.upload-file-size').textContent).toContain('1 KB');
      expect(mockBootstrapModal.show).toHaveBeenCalled();
    });

    it('should dispose existing modal before creating new one', () => {
      modalProgress.show();
      const firstModal = modalProgress.modal;
      
      modalProgress.show();
      
      expect(mockBootstrapModal.dispose).toHaveBeenCalled();
      expect(firstModal.parentNode).toBeNull();
    });
  });

  describe('updateUploadProgress', () => {
    it('should update progress bar and percentage text', () => {
      modalProgress.show();
      modalProgress.updateUploadProgress(50, 512, 1024);
      
      expect(modalProgress.progressBar.style.width).toBe('50%');
      expect(modalProgress.percentageText.textContent).toBe('50%');
      expect(modalProgress.statusText.textContent).toContain('1 KB');
    });

    it('should handle zero bytes', () => {
      modalProgress.show();
      modalProgress.updateUploadProgress(10);
      expect(modalProgress.statusText.textContent).toBe('Uploading file...');
    });

    it('should clamp percentage between 0 and 100', () => {
      modalProgress.show();
      modalProgress.updateUploadProgress(-10);
      expect(modalProgress.progressBar.style.width).toBe('0%');
      
      modalProgress.updateUploadProgress(150);
      expect(modalProgress.progressBar.style.width).toBe('100%');
    });
  });

  describe('setProcessingPhase', () => {
    it('should update status and phase info text', () => {
      modalProgress.show();
      modalProgress.setProcessingPhase('extracting');
      
      expect(modalProgress.statusText.textContent).toBe('Extracting files...');
      expect(modalProgress.phaseText.textContent).toContain('Extracting ZIP file contents');
    });

    it('should handle all predefined phases', () => {
        modalProgress.show();
        const phases = ['parsing', 'finalizing', 'savingProject', 'uploadingAssets', 'savingComplete'];
        phases.forEach(phase => {
            modalProgress.setProcessingPhase(phase);
            expect(modalProgress.statusText.textContent).not.toBe('Processing...');
        });
    });

    it('should handle unknown phase', () => {
        modalProgress.show();
        modalProgress.setProcessingPhase('unknown');
        expect(modalProgress.statusText.textContent).toBe('Processing...');
    });
  });

  describe('setAssetUploadProgress', () => {
      it('should update asset progress', () => {
          modalProgress.show();
          modalProgress.setAssetUploadProgress(1, 2, 500, 1000);
          expect(modalProgress.progressBar.style.width).toBe('50%');
          expect(modalProgress.statusText.textContent).toContain('1/2');
          expect(modalProgress.statusText.textContent).toContain('B/');
      });

      it('should handle zero total assets', () => {
          modalProgress.show();
          modalProgress.setAssetUploadProgress(1, 0);
          expect(modalProgress.progressBar.style.width).toBe('0%');
      });

      it('should work without bytes info', () => {
          modalProgress.show();
          modalProgress.setAssetUploadProgress(1, 1);
          expect(modalProgress.statusText.textContent).toBe('Uploading asset 1/1');
      });
  });

  describe('showSaveMode', () => {
      it('should create modal in save mode', () => {
          modalProgress.showSaveMode({ projectTitle: 'My Project' });
          expect(mockContainer.querySelector('.modal-title').textContent).toContain('Saving project');
          expect(mockContainer.querySelector('.upload-file-name').textContent).toContain('My Project');
      });

      it('should cleanup previous modal', () => {
          modalProgress.show();
          modalProgress.showSaveMode();
          expect(mockBootstrapModal.dispose).toHaveBeenCalled();
      });
  });

  describe('setComplete', () => {
    it('should show success state', () => {
      modalProgress.show();
      modalProgress.setComplete(true, 'Done!');
      
      expect(modalProgress.progressBar.classList.contains('bg-success')).toBe(true);
      expect(modalProgress.statusText.textContent).toBe('Done!');
    });

    it('should show error state', () => {
      modalProgress.show();
      modalProgress.setComplete(false, 'Failed');
      
      expect(modalProgress.progressBar.classList.contains('bg-danger')).toBe(true);
      expect(modalProgress.statusText.textContent).toBe('Failed');
    });

    it('should autoHide if requested', () => {
        vi.useFakeTimers();
        const hideSpy = vi.spyOn(modalProgress, 'hide');
        modalProgress.show();
        modalProgress.setComplete(true, 'Done', true);
        vi.advanceTimersByTime(2000);
        expect(hideSpy).toHaveBeenCalled();
        vi.useRealTimers();
    });
  });

  describe('showError', () => {
      it('should call setComplete with false', () => {
          const spy = vi.spyOn(modalProgress, 'setComplete');
          modalProgress.show();
          modalProgress.showError('Boom');
          expect(spy).toHaveBeenCalledWith(false, 'Boom');
      });
  });

  describe('hide', () => {
    it('should call bootstrap hide and cleanup on hidden event', async () => {
      modalProgress.show();
      const modalEl = modalProgress.modal;
      
      const hidePromise = modalProgress.hide();
      
      // Simulate hidden event
      const event = new CustomEvent('hidden.bs.modal');
      modalEl.dispatchEvent(event);
      
      await hidePromise;
      
      expect(mockBootstrapModal.hide).toHaveBeenCalled();
      expect(modalProgress.modal).toBeNull();
      expect(modalEl.parentNode).toBeNull();
    });

    it('should handle timeout if hidden event is not fired', async () => {
        vi.useFakeTimers();
        modalProgress.show();
        const hidePromise = modalProgress.hide();
        vi.advanceTimersByTime(500);
        await hidePromise;
        expect(modalProgress.modal).toBeNull();
        vi.useRealTimers();
    });

    it('should resolve immediately if no modal', async () => {
        await modalProgress.hide();
        expect(modalProgress.modal).toBeNull();
    });

    it('should cleanup directly if no bootstrap instance', async () => {
        window.bootstrap.Modal.getInstance = vi.fn(() => null);
        modalProgress.show();
        await modalProgress.hide();
        expect(modalProgress.modal).toBeNull();
    });
  });

  describe('formatFileSize', () => {
      it('should format correctly', () => {
          expect(modalProgress.formatFileSize(0)).toBe('0 B');
          expect(modalProgress.formatFileSize(1024)).toBe('1 KB');
          expect(modalProgress.formatFileSize(1024 * 1024)).toBe('1 MB');
          expect(modalProgress.formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
      });
  });
});
