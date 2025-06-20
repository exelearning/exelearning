import ApiCallBaseFunctions from './apiCallBaseFunctions.js';

export default class ApiCallManager {
    constructor(app) {
        this.app = app;
        this.apiUrlBase = `${app.eXeLearning.symfony.baseURL}`;
        this.apiUrlBasePath = `${app.eXeLearning.symfony.basePath}`;
        this.apiUrlParameters = `${this.apiUrlBase}${this.apiUrlBasePath}/api/parameter-management/parameters/data/list`;
        this.func = new ApiCallBaseFunctions();
        this.endpoints = {};
    }

    /**
     * Load symfony api endpoints routes
     *
     */
    async loadApiParameters() {
        this.parameters = await this.getApiParameters();
        for (var [key, data] of Object.entries(this.parameters.routes)) {
            this.endpoints[key] = {};
            this.endpoints[key].path = this.apiUrlBase + data.path;
            this.endpoints[key].methods = data.methods;
        }
    }

    /**
     * Get symfony api endpoints parameters
     *
     * @returns
     */
    async getApiParameters() {
        let url = this.apiUrlParameters;
        return await this.func.get(url);
    }

    /**
     * Get current project
     *
     * @returns
     */
    async getCurrentProject() {
        let url = this.endpoints.api_current_ode_users_for_user_get.path;
        return await this.func.get(url);
    }

    /**
     * Get app changelog text
     *
     * @returns
     */
    async getChangelogText() {
        let url = this.app.eXeLearning.symfony.changelogURL;
        url += '?version=' + eXeLearning.app.common.getVersionTimeStamp();
        return await this.func.getText(url);
    }

    /**
     * Get the third party code information
     *
     * @returns
     */
    async getThirdPartyCodeText() {
        let url = this.app.eXeLearning.symfony.baseURL + '/libs/README';
        url += '?version=' + eXeLearning.app.common.getVersionTimeStamp();
        return await this.func.getText(url);
    }

    /**
     * Get the list of licenses
     *
     * @returns
     */
    async getLicensesList() {
        let url = this.app.eXeLearning.symfony.baseURL + '/libs/LICENSES';
        url += '?version=' + eXeLearning.app.common.getVersionTimeStamp();
        return await this.func.getText(url);
    }

    /**
     * Get idevices installed
     *
     * @returns
     */
    async getIdevicesInstalled() {
        let url = this.endpoints.api_idevices_installed.path;
        return await this.func.get(url);
    }

    /**
     * Get themes installed
     *
     * @returns
     */
    async getThemesInstalled() {
        let url = this.endpoints.api_themes_installed.path;
        return await this.func.get(url);
    }

    /**
     * Get user odefiles
     *
     * @returns
     */
    async getUserOdeFiles() {
        let url = this.endpoints.api_odes_user_get_ode_list.path;
        return await this.func.get(url);
    }

    /**
     * Get recent user odefiles
     *
     * @returns
     */
    async getRecentUserOdeFiles() {
        let url = this.endpoints.api_odes_get_user_recent_ode_list.path;
        return await this.func.get(url);
    }

    /**
     * Get currentUser odeSessionId
     *
     * @returns
     */
    async getCurrentUserOdeSessionId() {
        let url = this.endpoints.get_ode_session_id_current_ode_user.path;
        return await this.func.get(url);
    }

    /**
     * Post odeSessionId and check availability
     *
     * @param {*} params
     * @returns
     */
    async postJoinCurrentOdeSessionId(params) {
        let url = this.endpoints.check_current_users_ode_session_id.path;
        return await this.func.post(url, params);
    }

    /**
     * Post selected odefile
     *
     * @param {*} odeFileName
     * @returns
     */
    async postSelectedOdeFile(odeFileName) {
        let url = this.endpoints.api_odes_ode_elp_open.path;
        return await this.func.post(url, odeFileName);
    }

    /**
     *
     * @param {*} data
     * @returns
     */
    async postLocalLargeOdeFile(data) {
        let url = this.endpoints.api_odes_ode_local_large_elp_open.path;
        return await this.func.fileSendPost(url, data);
    }

    /**
     *
     * @param {*} data
     * @returns
     */
    async postLocalOdeFile(data) {
        let url = this.endpoints.api_odes_ode_local_elp_open.path;
        return await this.func.post(url, data);
    }

    /**
     *
     * @param {*} data
     * @returns
     */
    async postLocalXmlPropertiesFile(data) {
        let url = this.endpoints.api_odes_ode_local_xml_properties_open.path;
        return await this.func.post(url, data);
    }

    /**
     *
     * @param {*} data
     * @returns
     */
    async postLocalOdeComponents(data) {
        let url = this.endpoints.api_odes_ode_local_idevices_open.path;
        return await this.func.post(url, data);
    }

    /**
     * @param {*} data
     * @returns
     *
     */
    async postMultipleLocalOdeFiles(data) {
        let url = this.endpoints.api_odes_ode_multiple_local_elp_open.path;
        return await this.func.post(url, data);
    }

    /**
     * Post ode file to remove
     *
     * @param {*} odeFileId
     * @returns
     */
    async postDeleteOdeFile(odeFileId) {
        let url = this.endpoints.api_odes_remove_ode_file.path;
        return await this.func.post(url, odeFileId);
    }

    /**
     *
     * @param {*} params
     * @returns
     */
    async postDeleteOdeFilesByDate(params) {
        let url = this.endpoints.api_odes_remove_date_ode_files.path;
        return await this.func.post(url, params);
    }

    /**
     * Post to check number of current ode users
     *
     * @param {*} params
     * @returns
     *
     */
    async postCheckCurrentOdeUsers(params) {
        let url = this.endpoints.api_odes_check_before_leave_ode_session.path;
        return await this.func.post(url, params);
    }

    /**
     * clean autosaves
     *
     * @param {*} params
     * @returns
     *
     */
    async postCleanAutosavesByUser(params) {
        let url = this.endpoints.api_odes_clean_init_autosave_elp.path;
        return await this.func.post(url, params);
    }

    /**
     * Post session to close
     *
     * @param {*} params
     * @returns
     *
     */
    async postCloseSession(params) {
        let url = this.endpoints.api_odes_ode_session_close.path;
        return await this.func.post(url, params);
    }

    /**
     * Import theme
     *
     * @param {*} params
     * @returns
     */
    async postUploadTheme(params) {
        let url = this.endpoints.api_themes_upload.path;
        return await this.func.post(url, params);
    }

    /**
     * Import ode theme
     *
     * @param {*} params
     * @returns
     */
    async postOdeImportTheme(params) {
        let url = this.endpoints.api_ode_theme_import.path;
        return await this.func.post(url, params);
    }

    /**
     * Delete theme
     *
     * @param {*} params
     * @returns
     */
    async deleteTheme(params) {
        let url = this.endpoints.api_themes_installed_delete.path;
        return await this.func.delete(url, params);
    }

    /**
     * Get installed theme zip
     *
     * @param {*} odeSessionId
     * @param {*} $themeDirName
     * @returns
     */
    async getThemeZip(odeSessionId, themeDirName) {
        let url = this.endpoints.api_themes_download.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        url = url.replace('{themeDirName}', themeDirName);
        return await this.func.get(url);
    }

    /**
     *
     * @param {*} themeConfig
     * @param {*} themeRules
     */
    async postNewTheme(params) {
        let url = this.endpoints.api_themes_new.path;
        return await this.func.post(url, params);
    }

    /**
     *
     * @param {*} themeDir
     * @param {*} themeConfig
     * @param {*} themeRules
     */
    async putEditTheme(themeDir, params) {
        let url = this.endpoints.api_themes_edit.path;
        url = url.replace('{themeDirName}', themeDir);
        return await this.func.put(url, params);
    }

    /**
     * Import idevice
     *
     * @param {*} params
     * @returns
     */
    async postUploadIdevice(params) {
        let url = this.endpoints.api_idevices_upload.path;
        return await this.func.post(url, params);
    }

    /**
     * Delete idevice installed
     *
     * @param {*} params
     * @returns
     */
    async deleteIdeviceInstalled(params) {
        let url = this.endpoints.api_idevices_installed_delete.path;
        return await this.func.delete(url, params);
    }

    /**
     * Get installed idevice zip
     *
     * @param {*} odeSessionId
     * @param {*} $ideviceDirName
     * @returns
     */
    async getIdeviceInstalledZip(odeSessionId, ideviceDirName) {
        let url = this.endpoints.api_idevices_installed_download.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        url = url.replace('{ideviceDirName}', ideviceDirName);
        return await this.func.get(url);
    }

    /**
     * Accept LOPD
     *
     * @returns
     */
    async postUserSetLopdAccepted() {
        let url = this.endpoints.api_user_set_lopd_accepted.path;
        return await this.func.post(url);
    }

    /**
     * Get user preferences
     *
     * @returns
     */
    async getUserPreferences() {
        let url = this.endpoints.api_user_preferences_get.path;
        return await this.func.get(url);
    }

    /**
     * Save user preferences
     *
     * @param {*} params
     * @returns
     */
    async putSaveUserPreferences(params) {
        let url = this.endpoints.api_user_preferences_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Get ode last update
     *
     * @param {*} odeId
     * @returns
     */
    async getOdeLastUpdated(odeId) {
        let url = this.endpoints.api_odes_last_updated.path;
        url = url.replace('{odeId}', odeId);
        return await this.func.get(url);
    }

    /**
     * get ode concurrent users
     *
     * @param {*} odeId
     * @param {*} versionId
     * @param {*} sessionId
     * @returns
     */
    async getOdeConcurrentUsers(odeId, versionId, sessionId) {
        let url = this.endpoints.api_odes_current_users.path;
        url = url.replace('{odeId}', odeId);
        url = url.replace('{odeVersionId}', versionId);
        url = url.replace('{odeSessionId}', sessionId);
        return await this.func.get(url, null, false);
    }

    /**
     * get ode structure
     *
     * @param {*} versionId
     * @param {*} sessionId
     * @returns
     */
    async getOdeStructure(versionId, sessionId) {
        let url = this.endpoints.api_nav_structures_nav_structure_get.path;
        url = url.replace('{odeVersionId}', versionId);
        url = url.replace('{odeSessionId}', sessionId);
        return await this.func.get(url);
    }

    /**
     * Get ode broken links
     *
     * @param {*} params
     * @returns
     */
    async getOdeSessionBrokenLinks(params) {
        let url = this.endpoints.api_odes_session_get_broken_links.path;
        return await this.func.post(url, params);
    }

    /**
     * Get page broken links
     *
     * @param {*} pageId
     * @returns
     */
    async getOdePageBrokenLinks(pageId) {
        let url = this.endpoints.api_odes_pag_get_broken_links.path;
        url = url.replace('{odePageId}', pageId);
        return await this.func.get(url);
    }

    /**
     * Get block broken links
     *
     * @param {*} BlockId
     * @returns
     */
    async getOdeBlockBrokenLinks(blockId) {
        let url = this.endpoints.api_odes_block_get_broken_links.path;
        url = url.replace('{odeBlockId}', blockId);
        return await this.func.get(url);
    }

    /**
     * Get idevice broken links
     *
     * @param {*} IdeviceId
     * @returns
     */
    async getOdeIdeviceBrokenLinks(ideviceId) {
        let url = this.endpoints.api_odes_idevice_get_broken_links.path;
        url = url.replace('{odeIdeviceId}', ideviceId);
        return await this.func.get(url);
    }

    /**
     *
     * @param {*} odeSessionId
     * @returns
     */
    async getOdeProperties(odeSessionId) {
        let url = this.endpoints.api_odes_properties_get.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        return await this.func.get(url);
    }

    /**
     *
     * @param {*} odeId
     * @returns
     */
    async putSaveOdeProperties(params) {
        let url = this.endpoints.api_odes_properties_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Get ode used files
     *
     * @param {*} params
     * @returns
     */
    async getOdeSessionUsedFiles(params) {
        let url = this.endpoints.api_odes_session_get_used_files.path;
        return await this.func.post(url, params);
    }

    /**
     * Download ode
     *
     * @param {*} params
     * @returns
     */
    async getOdeDownload(odeSessionId) {
        return await this.getOdeExportDownload(odeSessionId, 'elp');
    }

    /**
     * Download ode export
     *
     * @param {*} params
     * @returns
     */
    async getOdeExportDownload(odeSessionId, exportType) {
        let downloadResponse = [];
        let url = this.endpoints.api_ode_export_download.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        url = url.replace('{exportType}', exportType);

        return await this.func.get(url);
    }

    /**
     * Preview ode export
     *
     * @param {*} params
     * @returns
     */
    async getOdePreviewUrl(odeSessionId) {
        let url = this.endpoints.api_ode_export_preview.path;
        url = url.replace('{odeSessionId}', odeSessionId);

        return await this.func.get(url);
    }

    /**
     * download idevice/block content
     *
     * @param {*} params
     * @returns
     */
    async getOdeIdevicesDownload(odeSessionId, odeBlockId, odeIdeviceId) {
        let downloadResponse = [];
        let url = this.endpoints.api_idevices_download_ode_components.path;

        downloadResponse['url'] = url.replace('{odeSessionId}', odeSessionId);
        downloadResponse['url'] = downloadResponse['url'].replace(
            '{odeBlockId}',
            odeBlockId,
        );
        downloadResponse['url'] = downloadResponse['url'].replace(
            '{odeIdeviceId}',
            odeIdeviceId,
        );
        downloadResponse['response'] = await this.func.getText(
            downloadResponse['url'],
        );

        return downloadResponse;
    }

    /**
     * Force to download file resources (case xml)
     * Only gets url
     *
     * @param {*} resource
     * @returns
     */
    async getFileResourcesForceDownload(resource) {
        let downloadResponse = [];
        let url =
            this.endpoints.api_idevices_force_download_file_resources.path;
        downloadResponse['url'] = url + '?resource=' + resource;
        return downloadResponse;
    }

    /**
     * Save ode
     *
     * @param {*} params
     * @returns
     */
    async postOdeSave(params) {
        let url = this.endpoints.api_odes_ode_save_manual.path;
        return await this.func.post(url, params);
    }

    /**
     * Autosave ode
     *
     * @param {*} params
     * @returns
     */
    async postOdeAutosave(params) {
        let url = this.endpoints.api_odes_ode_save_auto.path;
        this.func.post(url, params);
    }

    /**
     * Save as ode
     *
     * @param {*} params
     * @returns
     */
    async postOdeSaveAs(params) {
        let url = this.endpoints.api_odes_ode_save_as.path;
        return await this.func.post(url, params);
    }

    /**
     * Upload new elp to first type platform
     *
     * @param {*} params
     * @returns
     */
    async postFirstTypePlatformIntegrationElpUpload(params) {
        let url = this.endpoints.set_platform_new_ode.path;
        return await this.func.post(url, params);
    }

    /**
     * Open elp from platform
     *
     * @param {*} params
     * @returns
     */
    async platformIntegrationOpenElp(params) {
        let url = this.endpoints.open_platform_elp.path;
        return await this.func.post(url, params);
    }

    /**
     *
     * @param {*} params
     * @returns
     */
    async postCheckUserOdeUpdates(params) {
        let url = this.endpoints.current_ode_user_sync.path;
        return await this.func.post(url, params, false);
    }

    /**
     *
     * @param {*} params
     * @returns
     */
    async postCheckUsersOdePage(params) {
        let url = this.endpoints.current_ode_users_on_page_id.path;
        return await this.func.post(url, params);
    }

    /**
     *
     * @param {*} params
     * @returns
     */
    async postActivateCurrentOdeUsersUpdateFlag(params) {
        let url = this.endpoints.current_ode_users_update_flag.path;
        return await this.func.post(url, params);
    }

    /**
     *
     *
     */
    async checkCurrentOdeUsersComponentFlag(params) {
        let url =
            this.endpoints.check_ode_component_flag_current_ode_users.path;
        return await this.func.post(url, params);
    }

    /**
     *
     * @param {*} params
     * @returns
     */
    async postObtainOdeBlockSync(params) {
        let url = this.endpoints.get_current_block_update.path;
        return await this.func.post(url, params);
    }

    /**
     *
     * @param {*} params
     * @returns
     */
    async postOdeOperation(params) {
        let url = this.endpoints.api_ode_operations_ode_operation_log_get.path;
        return await this.func.post(url, params);
    }

    /**
     *
     * @returns
     *
     */
    async getActionFromLastOdeOperation() {
        let url =
            this.endpoints.api_ode_operations_send_action_ode_operation.path;
        return await this.func.get(url);
    }

    /**
     *
     * @returns
     *
     */
    async getConfirmLastOperationLogDone() {
        let url =
            this.endpoints.api_ode_operations_set_active_flag_ode_operation
                .path;
        return await this.func.get(url);
    }

    /**
     * Get all translations
     *
     * @param {*} locale
     * @returns
     */
    async getTranslationsAll() {
        let url = this.endpoints.api_translations_lists.path;
        return await this.func.get(url);
    }

    /**
     * Get translations
     *
     * @param {*} locale
     * @returns
     */
    async getTranslations(locale) {
        let url = this.endpoints.api_translations_list_by_locale.path;
        url = url.replace('{locale}', locale);
        return await this.func.get(url);
    }

    /**
     * Get login url of Google Drive
     *
     * @returns
     */
    async getUrlLoginGoogleDrive() {
        let url = this.endpoints.api_google_oauth_login_url_get.path;
        return await this.func.get(url);
    }

    /**
     * Get folders of Google Drive account
     *
     * @returns
     */
    async getFoldersGoogleDrive() {
        let url = this.endpoints.api_google_drive_folders_list.path;
        return await this.func.get(url);
    }

    /**
     * Upload file to Google Drive
     *
     * @param {*} params
     * @returns
     */
    async uploadFileGoogleDrive(params) {
        let url = this.endpoints.api_google_drive_file_upload.path;
        return await this.func.post(url, params);
    }

    /**
     * Get login url of Dropbox
     *
     * @returns
     */
    async getUrlLoginDropbox() {
        let url = this.endpoints.api_dropbox_oauth_login_url_get.path;
        return await this.func.get(url);
    }

    /**
     * Get folders of Dropbox account
     *
     * @returns
     */
    async getFoldersDropbox() {
        let url = this.endpoints.api_dropbox_folders_list.path;
        return await this.func.get(url);
    }

    /**
     * Upload file to Dropbox
     *
     * @param {*} params
     * @returns
     */
    async uploadFileDropbox(params) {
        let url = this.endpoints.api_dropbox_file_upload.path;
        return await this.func.post(url, params);
    }

    /**
     * Get page components
     *
     * @param {*} odeNavStructureSyncId
     * @returns
     */
    async getComponentsByPage(odeNavStructureSyncId) {
        let url = this.endpoints.api_idevices_list_by_page.path;
        url = url.replace('{odeNavStructureSyncId}', odeNavStructureSyncId);
        return await this.func.get(url);
    }

    /**
     * Get html template of idevice
     *
     * @param {*} odeNavStructureSyncId
     * @returns
     */
    async getComponentHtmlTemplate(odeNavStructureSyncId) {
        let url = this.endpoints.api_idevices_html_template_get.path;
        url = url.replace('{odeComponentsSyncId}', odeNavStructureSyncId);
        return await this.func.get(url);
    }

    /**
     * Get idevice html saved
     *
     * @param {*} params
     * @returns
     */
    async getSaveHtmlView(odeComponentsSyncId) {
        let url = this.endpoints.api_idevices_html_view_get.path;
        url.replace('{odeComponentsSyncId}', odeComponentsSyncId);
        return await this.func.get(url);
    }

    /**
     * Set idevice html saved
     *
     * @param {*} params
     * @returns
     */
    async putSaveHtmlView(params) {
        let url = this.endpoints.api_idevices_html_view_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Save idevice
     *
     * @param {*} params
     * @returns
     */
    async putSaveIdevice(params) {
        let url = this.endpoints.api_idevices_idevice_data_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Save idevice properties
     *
     * @param {*} params
     * @returns
     */
    async putSavePropertiesIdevice(params) {
        let url = this.endpoints.api_idevices_idevice_properties_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Edit idevice action
     *
     * @param {*} params
     * @retuns
     *
     */
    async postEditIdevice(params) {
        let url = this.endpoints.update_api_current_ode_user_flag.path;
        return await this.func.post(url, params);
    }

    /**
     * Reorder idevice
     *
     * @param {*} params
     * @returns
     */
    async putReorderIdevice(params) {
        let url = this.endpoints.api_idevices_idevice_reorder.path;
        return await this.func.put(url, params);
    }

    /**
     * Duplicate idevice
     *
     * @param {*} params
     * @returns
     */
    async postCloneIdevice(params) {
        let url = this.endpoints.api_idevices_idevice_duplicate.path;
        return await this.func.post(url, params);
    }

    /**
     * Delete idevice
     *
     * @param {*} ideviceId
     * @returns
     */
    async deleteIdevice(ideviceId) {
        let url = this.endpoints.api_idevices_idevice_delete.path;
        url = url.replace('{odeComponentsSyncId}', ideviceId);
        return await this.func.delete(url);
    }

    /**
     * Save block
     *
     * @param {*} params
     * @returns
     */
    async putSaveBlock(params) {
        let url =
            this.endpoints.api_pag_structures_pag_structure_data_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Save block properties
     *
     * @param {*} params
     * @returns
     */
    async putSavePropertiesBlock(params) {
        let url =
            this.endpoints.api_pag_structures_pag_structure_properties_save
                .path;
        return await this.func.put(url, params);
    }

    /**
     * Reorder block
     *
     * @param {*} params
     * @returns
     */
    async putReorderBlock(params) {
        let url = this.endpoints.api_pag_structures_pag_structure_reorder.path;
        return await this.func.put(url, params);
    }

    /**
     * Duplicate block
     *
     * @param {*} params
     * @returns
     */
    async postCloneBlock(params) {
        let url =
            this.endpoints.api_pag_structures_pag_structure_duplicate.path;
        return await this.func.post(url, params);
    }

    /**
     * Delete block
     *
     * @param {*} blockId
     * @returns
     */
    async deleteBlock(blockId) {
        let url = this.endpoints.api_pag_structures_pag_structure_delete.path;
        url = url.replace('{odePagStructureSyncId}', blockId);
        return await this.func.delete(url);
    }

    /**
     * Save page node
     *
     * @param {*} params
     * @returns
     */
    async putSavePage(params) {
        let url =
            this.endpoints.api_nav_structures_nav_structure_data_save.path;
        return await this.func.put(url, params);
    }

    /**
     * Save page node properties
     *
     * @param {*} params
     * @returns
     */
    async putSavePropertiesPage(params) {
        let url =
            this.endpoints.api_nav_structures_nav_structure_properties_save
                .path;
        return await this.func.put(url, params);
    }

    /**
     * Reorder page node
     *
     * @param {*} params
     * @returns
     */
    async putReorderPage(params) {
        let url = this.endpoints.api_nav_structures_nav_structure_reorder.path;
        return await this.func.put(url, params);
    }

    /**
     * Duplicate page
     *
     * @param {*} params
     * @returns
     */
    async postClonePage(params) {
        let url =
            this.endpoints.api_nav_structures_nav_structure_duplicate.path;
        return await this.func.post(url, params);
    }

    /**
     * Delete page node
     *
     * @param {*} blockId
     * @returns
     */
    async deletePage(pageId) {
        let url = this.endpoints.api_nav_structures_nav_structure_delete.path;
        url = url.replace('{odeNavStructureSyncId}', pageId);
        return await this.func.delete(url);
    }

    /**
     * Upload file
     *
     * @param {*} params
     * @returns
     */
    async postUploadFileResource(params) {
        let url = this.endpoints.api_idevices_upload_file_resources.path;
        return await this.func.post(url, params);
    }

    /**
     * Upload large file
     *
     * @param {*} params
     * @returns
     */
    async postUploadLargeFileResource(params) {
        let url = this.endpoints.api_idevices_upload_large_file_resources.path;
        return await this.func.fileSendPost(url, params);
    }

    /**
     * Base api func call
     *
     * @param {*} endpointId
     * @param {*} params
     */
    async send(endpointId, params) {
        let url = this.endpoints[endpointId].path;
        let method = this.endpoints[endpointId].method;
        return await this.func.do(method, url, params);
    }

    /**
     * Games get idevices by session ID
     *
     * @param {string} odeSessionId
     * @returns {Promise<any>}
     */
    async getIdevicesBySessionId(odeSessionId) {
        let url = this.endpoints.api_games_session_idevices.path;
        url = url.replace('{odeSessionId}', odeSessionId);
        return await this.func.get(url);
    }
}
