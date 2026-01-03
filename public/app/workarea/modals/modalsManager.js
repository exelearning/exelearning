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

export default class ModalsManagement {
    constructor(app) {
        this.app = app;
        this.alert = null;
        this.info = null;
        this.confirm = null;
        this.uploadtodrive = null;
        this.uploadtodropbox = null;
        this.filemanager = null;
        this.stylemanager = null;
        this.idevicemanager = null;
        this.odebrokenlinks = null;
        this.odeusedfiles = null;
        this.lopd = null;
        this.assistant = null;
        this.releasenotes = null;
        this.legalnotes = null;
        this.about = null;
        this.easteregg = null;
        this.properties = null;
        this.openuserodefiles = null;
        this.templateselection = null;
        this.sessionlogout = null;
        this.uploadprogress = null;
        this.share = null;
        this.printpreview = null;
    }

    /**
     *
     */
    init() {
        this.alert = new ModalAlert(this);
        this.info = new ModalInfo(this);
        this.confirm = new ModalConfirm(this);
        this.uploadtodrive = new ModalUploadGoogleDrive(this);
        this.uploadtodropbox = new ModalUploadDropbox(this);
        this.filemanager = new ModalFileManager(this);
        this.stylemanager = new ModalStyleManager(this);
        this.idevicemanager = new ModalIdeviceManager(this);
        this.odebrokenlinks = new ModalOdeBrokenLinks(this);
        this.odeusedfiles = new ModalOdeUsedFiles(this);
        this.lopd = new ModalLopd(this);
        this.assistant = new ModalAssistant(this);
        this.releasenotes = new ModalReleaseNotes(this);
        this.legalnotes = new ModalLegalNotes(this);
        this.about = new ModalAbout(this);
        this.easteregg = new ModalEasterEgg(this);
        this.properties = new ModalProperties(this);
        this.openuserodefiles = new ModalOpenUserOdeFiles(this);
        this.templateselection = new ModalTemplateSelection(this);
        this.sessionlogout = new ModalSessionLogout(this);
        this.uploadprogress = new ModalUploadProgress(document.body);
        this.share = new ModalShare(this);
        this.printpreview = new ModalPrintPreview(this);
    }

    /**
     *
     */
    behaviour() {
        this.alert.behaviour();
        this.info.behaviour();
        this.confirm.behaviour();
        this.uploadtodrive.behaviour();
        this.uploadtodropbox.behaviour();
        this.filemanager.behaviour();
        this.stylemanager.behaviour();
        this.idevicemanager.behaviour();
        this.odebrokenlinks.behaviour();
        this.odeusedfiles.behaviour();
        this.lopd.behaviour();
        this.assistant.behaviour();
        this.releasenotes.behaviour();
        this.legalnotes.behaviour();
        this.about.behaviour();
        this.easteregg.behaviour();
        this.properties.behaviour();
        this.openuserodefiles.behaviour();
        this.templateselection.behaviour();
        this.sessionlogout.behaviour();
        this.share.behaviour();
        this.printpreview.behaviour();
    }

    /**
     * List of modals
     *
     * @returns {Array}
     */
    list() {
        return [
            this.alert,
            this.info,
            this.confirm,
            this.uploadtodrive,
            this.uploadtodropbox,
            this.filemanager,
            this.stylemanager,
            this.idevicemanager,
            this.odebrokenlinks,
            this.odeusedfiles,
            this.lopd,
            this.assistant,
            this.releasenotes,
            this.legalnotes,
            this.about,
            this.easteregg,
            this.properties,
            this.openuserodefiles,
            this.templateselection,
            this.sessionlogout,
            this.share,
            this.printpreview,
        ];
    }

    /**
     * Close all modals
     *
     * @returns {Boolean}
     */
    closeModals() {
        let closed = false;
        this.list().forEach((modal) => {
            if (
                modal &&
                modal.modal &&
                modal.modal._isShown &&
                !modal.permanent
            ) {
                modal.close(true);
                closed = true;
            }
        });
        return closed;
    }
}
