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
      // formatFileSize(1024) is "1 KB"
      expect(modalProgress.statusText.textContent).toContain('1 KB');
    });
  });

  describe('setProcessingPhase', () => {
    it('should update status and phase info text', () => {
      modalProgress.show();
      modalProgress.setProcessingPhase('extracting');
      
      expect(modalProgress.statusText.textContent).toBe('Extracting files...');
      expect(modalProgress.phaseText.textContent).toContain('Extracting ZIP file contents');
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
  });
});
