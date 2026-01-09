import ModalsManagement from './modalsManager.js';
import ModalAlert from './modals/generic/modalAlert.js';
import ModalConfirm from './modals/generic/modalConfirm.js';
import ModalInfo from './modals/generic/modalInfo.js';
import ModalUploadGoogleDrive from './modals/pages/modalUploadGoogleDrive.js';
import ModalUploadDropbox from './modals/pages/modalUploadDropbox.js';
import ModalFileManager from './modals/pages/modalFileManager.js';
import ModalOdeBrokenLinks from './modals/pages/modalOdeBrokenLinks.js';
import ModalOdeUsedFiles from './modals/pages/modalOdeUsedFiles.js';
import ModalStyleManager from './modals/pages/modalStyleManager.js';
import ModalIdeviceManager from './modals/pages/modalIdeviceManager.js';
import ModalLopd from './modals/pages/modalLopd.js';
import ModalAssistant from './modals/pages/modalAssistant.js';
import ModalReleaseNotes from './modals/pages/modalReleaseNotes.js';
import ModalLegalNotes from './modals/pages/modalLegalNotes.js';
import ModalAbout from './modals/pages/modalAbout.js';
import ModalEasterEgg from './modals/pages/modalEasterEgg.js';
import ModalProperties from './modals/pages/modalProperties.js';
import ModalOpenUserOdeFiles from './modals/pages/modalOpenUserOdeFiles.js';
import ModalTemplateSelection from './modals/pages/modalTemplateSelection.js';
import ModalSessionLogout from './modals/pages/modalSessionLogout.js';
import ModalUploadProgress from './modals/pages/modalUploadProgress.js';
import ModalShare from './modals/pages/modalShare.js';
import ModalPrintPreview from './modals/pages/modalPrintPreview.js';
import ModalImageOptimizer from './modals/pages/modalImageOptimizer.js';

// Mock all modal classes
vi.mock('./modals/generic/modalAlert.js');
vi.mock('./modals/generic/modalConfirm.js');
vi.mock('./modals/generic/modalInfo.js');
vi.mock('./modals/pages/modalUploadGoogleDrive.js');
vi.mock('./modals/pages/modalUploadDropbox.js');
vi.mock('./modals/pages/modalFileManager.js');
vi.mock('./modals/pages/modalOdeBrokenLinks.js');
vi.mock('./modals/pages/modalOdeUsedFiles.js');
vi.mock('./modals/pages/modalStyleManager.js');
vi.mock('./modals/pages/modalIdeviceManager.js');
vi.mock('./modals/pages/modalLopd.js');
vi.mock('./modals/pages/modalAssistant.js');
vi.mock('./modals/pages/modalReleaseNotes.js');
vi.mock('./modals/pages/modalLegalNotes.js');
vi.mock('./modals/pages/modalAbout.js');
vi.mock('./modals/pages/modalEasterEgg.js');
vi.mock('./modals/pages/modalProperties.js');
vi.mock('./modals/pages/modalOpenUserOdeFiles.js');
vi.mock('./modals/pages/modalTemplateSelection.js');
vi.mock('./modals/pages/modalSessionLogout.js');
vi.mock('./modals/pages/modalUploadProgress.js');
vi.mock('./modals/pages/modalShare.js');
vi.mock('./modals/pages/modalPrintPreview.js');
vi.mock('./modals/pages/modalImageOptimizer.js');

describe('ModalsManagement', () => {
  let modalsManager;
  let mockApp;

  beforeEach(() => {
    mockApp = {
      project: {
        offlineInstallation: false,
      },
    };
    modalsManager = new ModalsManagement(mockApp);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with null modals', () => {
      expect(modalsManager.alert).toBeNull();
      expect(modalsManager.info).toBeNull();
      expect(modalsManager.app).toBe(mockApp);
    });
  });

  describe('init', () => {
    it('should instantiate all modal classes', () => {
      modalsManager.init();

      expect(ModalAlert).toHaveBeenCalledWith(modalsManager);
      expect(ModalInfo).toHaveBeenCalledWith(modalsManager);
      expect(ModalConfirm).toHaveBeenCalledWith(modalsManager);
      expect(ModalUploadGoogleDrive).toHaveBeenCalledWith(modalsManager);
      expect(ModalUploadDropbox).toHaveBeenCalledWith(modalsManager);
      expect(ModalFileManager).toHaveBeenCalledWith(modalsManager);
      expect(ModalStyleManager).toHaveBeenCalledWith(modalsManager);
      expect(ModalIdeviceManager).toHaveBeenCalledWith(modalsManager);
      expect(ModalOdeBrokenLinks).toHaveBeenCalledWith(modalsManager);
      expect(ModalOdeUsedFiles).toHaveBeenCalledWith(modalsManager);
      expect(ModalLopd).toHaveBeenCalledWith(modalsManager);
      expect(ModalAssistant).toHaveBeenCalledWith(modalsManager);
      expect(ModalReleaseNotes).toHaveBeenCalledWith(modalsManager);
      expect(ModalLegalNotes).toHaveBeenCalledWith(modalsManager);
      expect(ModalAbout).toHaveBeenCalledWith(modalsManager);
      expect(ModalEasterEgg).toHaveBeenCalledWith(modalsManager);
      expect(ModalProperties).toHaveBeenCalledWith(modalsManager);
      expect(ModalOpenUserOdeFiles).toHaveBeenCalledWith(modalsManager);
      expect(ModalTemplateSelection).toHaveBeenCalledWith(modalsManager);
      expect(ModalSessionLogout).toHaveBeenCalledWith(modalsManager);
      expect(ModalUploadProgress).toHaveBeenCalledWith(document.body);
      expect(ModalShare).toHaveBeenCalledWith(modalsManager);
      expect(ModalPrintPreview).toHaveBeenCalledWith(modalsManager);
      expect(ModalImageOptimizer).toHaveBeenCalledWith(modalsManager);
    });
  });

  describe('behaviour', () => {
    it('should call behaviour() on all modals', () => {
      modalsManager.init();
      modalsManager.behaviour();

      modalsManager.list().forEach(modal => {
        expect(modal.behaviour).toHaveBeenCalled();
      });
    });
  });

  describe('list', () => {
    it('should return an array of all modals', () => {
      modalsManager.init();
      const list = modalsManager.list();
      expect(list).toHaveLength(23); // ImageOptimizer is 23rd
      expect(list).toContain(modalsManager.alert);
      expect(list).toContain(modalsManager.share);
      expect(list).toContain(modalsManager.printpreview);
      expect(list).toContain(modalsManager.imageoptimizer);
    });
  });

  describe('closeModals', () => {
    it('should close all shown non-permanent modals', () => {
      modalsManager.init();
      
      const mockModal1 = {
        modal: { _isShown: true },
        permanent: false,
        close: vi.fn(),
      };
      const mockModal2 = {
        modal: { _isShown: true },
        permanent: true,
        close: vi.fn(),
      };
      const mockModal3 = {
        modal: { _isShown: false },
        permanent: false,
        close: vi.fn(),
      };

      vi.spyOn(modalsManager, 'list').mockReturnValue([mockModal1, mockModal2, mockModal3]);

      const result = modalsManager.closeModals();

      expect(mockModal1.close).toHaveBeenCalledWith(true);
      expect(mockModal2.close).not.toHaveBeenCalled();
      expect(mockModal3.close).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false if no modals were closed', () => {
      modalsManager.init();
      vi.spyOn(modalsManager, 'list').mockReturnValue([]);
      const result = modalsManager.closeModals();
      expect(result).toBe(false);
    });
  });
});
