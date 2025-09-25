<?php

namespace App\Service\net\exelearning\Service\Api;

use App\Constants;
use App\Entity\net\exelearning\Dto\ThemeDto;
use App\Entity\net\exelearning\Dto\UserPreferencesDto;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\User;
use App\Exception\net\exelearning\Exception\Logical\PhpZipExtensionException;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\IdeviceHelper;
use App\Helper\net\exelearning\Helper\ThemeHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Properties;
use App\Service\net\exelearning\Service\Export\ExportEPUB3Service;
use App\Service\net\exelearning\Service\Export\ExportHTML5Service;
use App\Service\net\exelearning\Service\Export\ExportHTML5SPService;
use App\Service\net\exelearning\Service\Export\ExportIMSService;
use App\Service\net\exelearning\Service\Export\ExportSCORM12Service;
use App\Service\net\exelearning\Service\Export\ExportSCORM2004Service;
use App\Util\net\exelearning\Util\Commoni18nUtil;
use App\Util\net\exelearning\Util\ExportXmlUtil;
use App\Util\net\exelearning\Util\FilePermissionsUtil;
use App\Util\net\exelearning\Util\FileUtil;
use App\Util\net\exelearning\Util\OdeXmlUtil;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\String\Slugger\SluggerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

class OdeExportService implements OdeExportServiceInterface
{
    private EntityManagerInterface $entityManager;
    private UrlGeneratorInterface $router;
    private LoggerInterface $logger;
    private CurrentOdeUsersServiceInterface $currentOdeUsersService;
    private OdeServiceInterface $odeService;
    private FileHelper $fileHelper;
    private UserHelper $userHelper;
    private ThemeHelper $themeHelper;
    private IdeviceHelper $ideviceHelper;
    private TranslatorInterface $translator;
    private ExportHTML5Service $exportHTML5Service;
    private ExportHTML5SPService $exportHTML5SPService;
    private ExportSCORM12Service $exportSCORM12Service;
    private ExportSCORM2004Service $exportSCORM2004Service;
    private ExportIMSService $exportIMSService;
    private ExportEPUB3Service $exportEPUB3Service;
    private SluggerInterface $slugger;

    public function __construct(
        EntityManagerInterface $entityManager,
        UrlGeneratorInterface $router,
        LoggerInterface $logger,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        OdeServiceInterface $odeService,
        FileHelper $fileHelper,
        UserHelper $userHelper,
        ThemeHelper $themeHelper,
        IdeviceHelper $ideviceHelper,
        TranslatorInterface $translator,
        ExportHTML5Service $exportHTML5Service,
        ExportHTML5SPService $exportHTML5SPService,
        ExportSCORM12Service $exportSCORM12Service,
        ExportSCORM2004Service $exportSCORM2004Service,
        ExportIMSService $exportIMSService,
        ExportEPUB3Service $exportEPUB3Service,
        SluggerInterface $slugger,
    ) {
        $this->entityManager = $entityManager;
        $this->router = $router;
        $this->logger = $logger;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->odeService = $odeService;
        $this->fileHelper = $fileHelper;
        $this->userHelper = $userHelper;
        $this->themeHelper = $themeHelper;
        $this->ideviceHelper = $ideviceHelper;
        $this->translator = $translator;
        $this->exportHTML5Service = $exportHTML5Service;
        $this->exportHTML5SPService = $exportHTML5SPService;
        $this->exportSCORM12Service = $exportSCORM12Service;
        $this->exportSCORM2004Service = $exportSCORM2004Service;
        $this->exportIMSService = $exportIMSService;
        $this->exportEPUB3Service = $exportEPUB3Service;
        $this->slugger = $slugger;
    }

    /**
     * Generates an export of a project.
     *
     * @param UserInterface $user
     * @param User          $dbUser
     * @param string        $odeSessionId
     * @param string|bool   $baseUrl
     * @param string        $exportType
     * @param bool          $preview
     * @param bool          $isIntegration
     *
     * @return array
     */
    public function export(
        $user,
        $dbUser,
        $odeSessionId,
        $baseUrl,
        $exportType,
        $preview = false,
        $isIntegration = false,
        $tempPath = '',
    ) {
        $response = [];

        // Set locale
        // Get properties of user
        $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
        $localeUserPreferences = $databaseUserPreferences['locale']->getValue();
        $this->translator->setLocale($localeUserPreferences);

        // Get ode id
        $odeId = $this->currentOdeUsersService->getOdeIdByOdeSessionId($dbUser, $odeSessionId);

        // Get ode version
        $odeVersionId = $this->currentOdeUsersService->getOdeVersionIdByOdeSessionId($user, $odeSessionId);
        $odeVersionName = $this->odeService->getLastVersionNameOdeFiles($odeId);

        // Get currentOdeUser
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUserIdentifier());

        // Get ode pages
        $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
        $odeNavStructureSyncs = $odeNavStructureSyncRepo->findByOdeSessionId($odeSessionId);
        // TODO NOT NECESSARY because it will always have a page ******************
        if (empty($odeNavStructureSyncs)) {
            $error = $this->translator->trans('Please create at least one page before exporting.');
            $responseData['responseMessage'] = $error;

            return $responseData;
        }

        // Fix order of pages
        $odeNavStructureSyncs = self::fixPagesOrder($odeNavStructureSyncs);

        // Get ode properties
        $odeProperties = $this->odeService->getOdePropertiesFromDatabase($odeSessionId, $user);

        // Get user preferences
        // TODO next instruction is executed at the beginning of the method
        $dbUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
        $userPreferencesDtos = [];
        foreach ($dbUserPreferences as $userPreference) {
            $userPreferencesDto = new UserPreferencesDto();
            $userPreferencesDto->loadFromEntity($userPreference);
            $userPreferencesDtos[$userPreferencesDto->getKey()] = $userPreferencesDto;
        }

        // Get theme
        $themeDir = $userPreferencesDtos['theme']->getValue();
        $theme = $this->themeHelper->searchThemeFromThemeDir($themeDir, $dbUser);
        if (!$theme) {
            $theme = $this->themeHelper->searchThemeFromThemeDir(Constants::THEME_DEFAULT, $dbUser);
        }

        // Defensive fallback if theme not found at all
        if (!$theme) {
            $this->logger->warning('Theme not found, using fallback');
            $theme = new ThemeDto();
            $theme->setDirName(Constants::THEME_DEFAULT);
            $theme->setType(Constants::THEME_TYPE_BASE);
        }

        // ////////////////////////////////////////
        // SAVE ODE BEFORE EXPORT
        // ////////////////////////////////////////

        $isConcurrentUserSave = $this->currentOdeUsersService->checkSyncSaveFlag($odeId, $odeSessionId);
        $isEditingIdevice = $currentSessionForUser->getSyncComponentsFlag();

        // Check flags
        if ($isConcurrentUserSave || $isEditingIdevice) {
            if ($isConcurrentUserSave) {
                $error = $this->translator->trans('Other user is saving changes right now');
                $responseData['responseMessage'] = $error;
            } else {
                $error = $this->translator->trans('Please wait until the changes are completely saved.');
                $responseData['responseMessage'] = $error;
            }

            return $responseData;
        }

        // Activate flag on user
        $this->currentOdeUsersService->activateSyncSaveFlag($user);

        $isManualSave = true;
        $isSaveAs = false;
        $isDownload = false;

        // Save ode
        $saveOdeResult = false;
        try {
            $saveOdeResult = $this->odeService->saveOde(
                $odeSessionId,
                $dbUser,
                $isManualSave,
                $odeProperties,
                $userPreferencesDtos,
                $isSaveAs,
                $isDownload
            );
        } catch (\Exception $e) {
            // Remove save flag active
            $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);
        }

        if ($saveOdeResult && 'OK' == $saveOdeResult['responseMessage']) {
            if (!empty($odeProperties['pp_title']) && '' != $odeProperties['pp_title']->getValue()) {
                $odePropertiesName = $odeProperties['pp_title']->getValue();
            } else {
                $odePropertiesName = Constants::ELP_PROPERTIES_NO_TITLE_NAME;
            }
            $saveOdeResultParameters = [
                'odeId' => $saveOdeResult['odeId'],
                'odeVersionId' => $saveOdeResult['odeVersionId'],
                'odeSessionId' => $odeSessionId,
                'elpFileName' => $saveOdeResult['elpFileName'],
                'odePropertiesName' => $odePropertiesName,
                'odeVersionName' => $odeVersionName,
            ];
        } else {
            $error = $this->translator->trans('An error has occurred that prevents the project from being exported');
            $responseData['responseMessage'] = $error;
            // Remove save flag active
            $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);

            return $responseData;
        }

        // ////////////////////////////////////////
        // GENERATE EXPORT
        // ////////////////////////////////////////

        // Filenames standard - export filenames specification

        // Generate/copy ode structure to export dir
        $exportStructure = false;
        try {
            $exportStructure = $this->generateExportStructure(
                $user,
                $dbUser,
                $saveOdeResultParameters,
                $odeNavStructureSyncs,
                $odeProperties,
                $userPreferencesDtos,
                $theme,
                $baseUrl,
                $exportType,
                $preview,
                $isIntegration,
                $tempPath
            );
        } catch (\Exception $e) {
            $exportStructure = ['responseMessage' => $this->translator->trans('Export generation error')];
        }

        if ('OK' != $exportStructure['responseMessage']) {
            $response['responseMessage'] = $exportStructure['responseMessage'];
            // Remove save flag active
            $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);

            return $response;
        }

        // Export dir path
        // $exportDirPath = $this->fileHelper->getOdeSessionUserTmpExportDir($odeSessionId, $dbUser);
        $exportDirPath = $this->fileHelper->getOdeSessionUserTmpExportDir($odeSessionId, $dbUser, $tempPath);
        $exportDirPath = $exportDirPath.$tempPath;

        // Get url to export dir
        $urlExportDir = UrlUtil::getOdeSessionExportUrl($odeSessionId, $dbUser);
        $urlExportDir = $urlExportDir.$tempPath;

        // Index filename
        $indexFileName = self::generateIndexFileName();
        $response['urlPreviewIndex'] = $urlExportDir.$indexFileName;

        // In case it is not a preview we need compress the export files to generate the zip
        if (!$preview) {
            $typeSuffix = '';
            // Export project extension file
            switch ($exportType) {
                case Constants::EXPORT_TYPE_ELP:
                    $ext = Constants::FILE_EXTENSION_ELP;
                    break;
                case Constants::EXPORT_TYPE_EPUB3:
                    $ext = Constants::FILE_EXTENSION_EPUB;
                    break;
                case Constants::EXPORT_TYPE_HTML5:
                    $ext = Constants::FILE_EXTENSION_ZIP;
                    $typeSuffix = Constants::SUFFIX_TYPE_HTML5;
                    break;
                case Constants::EXPORT_TYPE_HTML5_SP:
                    $ext = Constants::FILE_EXTENSION_ZIP;
                    $typeSuffix = Constants::SUFFIX_TYPE_HTML5_SP;
                    break;
                case Constants::EXPORT_TYPE_SCORM12:
                    $ext = Constants::FILE_EXTENSION_ZIP;
                    $typeSuffix = Constants::SUFFIX_TYPE_SCORM12;
                    break;
                case Constants::EXPORT_TYPE_SCORM2004:
                    $ext = Constants::FILE_EXTENSION_ZIP;
                    $typeSuffix = Constants::SUFFIX_TYPE_SCORM2004;
                    break;
                case Constants::EXPORT_TYPE_IMS:
                    $ext = Constants::FILE_EXTENSION_ZIP;
                    $typeSuffix = Constants::SUFFIX_TYPE_IMS;
                    break;
                default:
                    $ext = Constants::FILE_EXTENSION_ZIP;
                    break;
            }
            $slug = strtolower($this->slugger->slug($odeProperties['pp_title']->getValue()));
            // Url to zip file
            $exportFileName = $this->zipExportFile($dbUser, $odeId, $odeVersionId, $odeSessionId, $exportDirPath, $ext, $slug, $typeSuffix);
            $response['urlZipFile'] = $urlExportDir.$exportFileName;
            // Add zip file name to response
            $response['zipFileName'] = $exportFileName;

            // Stores the ode permanently
            $this->odeService->moveElpFileToPerm($saveOdeResultParameters, $dbUser, $isManualSave);
        }

        // If it still exists (because it hasn't been moved) remove the elp file from the dist directory
        $this->odeService->removeElpDistFile($saveOdeResultParameters, $dbUser);

        // Remove save flag active
        $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);

        $response['responseMessage'] = 'OK';

        return $response;
    }

    /**
     * Generates an export of the project properties.
     *
     * @param UserInterface $user
     * @param User          $dbUser
     * @param string        $odeSessionId
     * @param string|bool   $baseUrl
     * @param string        $exportType
     * @param bool          $preview
     *
     * @return array
     */
    public function exportProperties(
        $user,
        $dbUser,
        $odeSessionId,
        $baseUrl,
        $exportType,
        $preview = false,
    ) {
        $response = [];

        // Get ode id
        $odeId = $this->currentOdeUsersService->getOdeIdByOdeSessionId($dbUser, $odeSessionId);

        // Get ode version
        $odeVersionId = $this->currentOdeUsersService->getOdeVersionIdByOdeSessionId($user, $odeSessionId);
        $odeVersionName = $this->odeService->getLastVersionNameOdeFiles($odeId);

        // Get currentOdeUser
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUserIdentifier());

        // Get ode properties
        $odeProperties = $this->odeService->getOdePropertiesFromDatabase($odeSessionId, $user);

        // ////////////////////////////////////////
        // GENERATE EXPORT
        // ////////////////////////////////////////

        // Server export dir path
        $exportDirPath = $this->fileHelper->getOdeSessionUserTmpExportDir($odeSessionId, $dbUser);

        // Check dist dir
        if (!($exportDirPath && FilePermissionsUtil::isWritable($exportDirPath))) {
            $response['responseMessage'] = $this->translator->trans('Export folder could not be created');

            return $response;
        }

        // Generate/copy ode structure to export dir
        $exportStructure['responseMessage'] = 'OK';
        // try {
        // Ode XML structure
        $odeSaveXML = OdeXmlUtil::createPropertiesXml(
            $odeSessionId,
            null,
            $odeProperties,
            null,
            null
        );

        $configFileName = Constants::PERMANENT_SAVE_CONTENT_FILENAME;
        $xmlFilePathName = $exportDirPath.$configFileName;
        $odeSaveXML->getXml()->asXML($xmlFilePathName);
        /*} catch (\Exception $e) {
            $exportStructure = ['responseMessage' => $this->translator->trans('Export generation error')];
        }*/

        if ('OK' != $exportStructure['responseMessage']) {
            $response['responseMessage'] = $exportStructure['responseMessage'];
            // Remove save flag active
            $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);

            return $response;
        }

        // Get url to export dir
        $urlExportDir = UrlUtil::getOdeSessionExportUrl($odeSessionId, $dbUser);

        // Filenames standard
        $fileNameStandard = $configFileName;

        // Index filename
        $indexFileName = self::generateIndexFileName($fileNameStandard);
        $response['urlPreviewIndex'] = $urlExportDir.$indexFileName;

        // In case it is not a preview we need compress the export files to generate the zip
        if (!$preview) {
            // Url to zip file
            $exportDirPath = $this->fileHelper->getOdeSessionUserTmpExportDir($odeSessionId, $dbUser);
            $exportFileName = $this->zipExportFile($dbUser, $odeId, $odeVersionId, $odeSessionId, $exportDirPath);
            $response['urlZipFile'] = $urlExportDir.$configFileName;
            // Export file name
            $response['exportProjectName'] = $configFileName;
        }

        $response['responseMessage'] = 'OK';

        return $response;
    }

    /**
     * Decrypts a given string.
     *
     * @param string $str
     *
     * @return string
     */
    public function decrypt($str)
    {
        $str = $str ?? '';
        $str = ('undefined' === $str || 'null' === $str) ? '' : $str;
        $str = urldecode($str);
        try {
            $key = 146;
            $pos = 0;
            $ostr = '';
            while ($pos < strlen($str)) {
                $ostr .= chr($key ^ ord($str[$pos]));
                ++$pos;
            }

            return $ostr;
        } catch (\Exception $ex) {
            return '';
        }
    }

    /**
     * Generates and copies all the files necessary for export.
     *
     * @param UserInterface $user
     * @param User          $dbUser
     * @param array saveOdeResultParameters
     * @param OdeNavStructureSync[] $odeNavStructureSyncs
     * @param array                 $odeProperties
     * @param userPreferencesDtos   $userPreferencesDtos
     * @param ThemeDto              $theme
     * @param string                $baseUrl
     * @param string                $exportType
     * @param bool                  $isPreview
     * @param bool                  $isIntegration
     *
     * @return array
     */
    public function generateExportStructure(
        $user,
        $dbUser,
        $saveOdeResultParameters,
        $odeNavStructureSyncs,
        $odeProperties,
        $userPreferencesDtos,
        $theme,
        $baseUrl,
        $exportType,
        $isPreview,
        $isIntegration,
        $tempPath = '',
    ) {
        // To do (see #198)
        $isPreview = false;

        $odeId = $saveOdeResultParameters['odeId'];
        $odeSessionId = $saveOdeResultParameters['odeSessionId'];
        $odeVersionId = $saveOdeResultParameters['odeVersionId'];
        $odeVersionName = $saveOdeResultParameters['odeVersionName'];

        // Control if it is necessary to include the ELP in the export
        $addElpToExport = false;

        // Server export dir path
        $exportParentDirPath = $this->fileHelper->getOdeSessionUserTmpExportDir($odeSessionId, $dbUser);
        $exportDirPath = $exportParentDirPath.'/'.$tempPath.'/';
        // Check dist dir
        if (!($exportDirPath && FilePermissionsUtil::isWritable($exportDirPath))) {
            $response['responseMessage'] = $this->translator->trans('Export folder could not be created');

            return $response;
        }

        // Export url prefix (used in preview)y
        // $isPreview=True;
        if ($isPreview) {
            $collection = $this->router->getRouteCollection();
            $routes = $collection->all();
            $apiFilesRoute = $routes['api_idevices_download_file_resources']->getPath();
            $exportUrlPath = substr(UrlUtil::getOdeSessionExportUrl($odeSessionId, $dbUser), 5).$tempPath.'/';
            $resourcesPrefix = $baseUrl.$apiFilesRoute.'?resource='.$exportUrlPath;
        } else {
            $resourcesPrefix = '';
        }

        // Check if the ELP should be added to the export
        // TODO: The next if statement will be a bit difference when exe has a new preference
        // related to add ELP to an export
        if (Constants::EXPORT_TYPE_ELP != $exportType) {
            // Check if project has a elp link in idevices
            foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
                foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                    foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                        $htmlView = $odeComponentsSync->getHtmlView();
                        if (null !== $htmlView && str_contains($htmlView, Constants::IDEVICE_ELP_LINK_IN_EXE)) {
                            $addElpToExport = true;
                            break 3;
                        }
                    }
                }
            }
        }

        // Get idevices used in the project by page
        $idevicesByPage = self::getIdeviceTypesByPages($odeNavStructureSyncs);

        // Ode data
        $odeData = [
            'odeVersionId' => $odeVersionId,
            'odeId' => $odeId,
            'odeVersionName' => $odeVersionName,
            'isDownload' => 'true',
        ];

        // Ode XML structure
        $odeSaveXML = OdeXmlUtil::createOdeXml(
            $odeSessionId,
            $odeNavStructureSyncs,
            $odeProperties,
            $odeData,
            $userPreferencesDtos
        );

        // Remove export dir
        FileUtil::removeDirContent($exportParentDirPath);

        // ///////////////////////////////////////////////////
        // COPY FILES
        // ///////////////////////////////////////////////////

        // TODO SEE WHAT IT DOES BECAUSE IT DOESN'T COPY ANYTHING in ELP export ****************
        // Copy project schema files
        $this->copySchemaFilesToExportDir($exportDirPath, $exportType);

        // Export type content directory
        // In some exports the content is placed in a subdirectory
        $newExportDirPath = $exportDirPath;
        if (isset(Constants::EXPORT_DIR_CONTENT_BY_EXPORT[$exportType])) {
            $newExportDirName = Constants::EXPORT_DIR_CONTENT_BY_EXPORT[$exportType];
            $newExportDirPath = self::createDirInExportDir($exportDirPath, $newExportDirName);
        }
        // TODO SEE WHAT IT DOES BECAUSE IT DOESN'T COPY ANYTHING in ELP export ****************
        // Copy project common files
        $this->copyCommonFilesToExportDir($newExportDirPath, $exportType);

        // we are going to create a method that recursively analyzes odeNavStructureSyncs and copies the library files that should be included in the project
        // it should search in each idevice if it has any effect included. The method will return an array with all the effects it finds.
        list($librariesToCopy, $librariesFileToCopy) = ExportXmlUtil::getPathForLibrariesInIdevices($odeNavStructureSyncs, $odeProperties);

        // The package language can be obtained from the $odeProperties array using the pp_lang key.
        $packageLanguage = isset($odeProperties['pp_lang']) ? $odeProperties['pp_lang']->getValue() : Settings::DEFAULT_LOCALE;

        // copy all libs, jquery, bootstrap
        // Copy project base files to export --> Here we are going to copy the mandatory ones
        $this->copyBaseFilesToExportDir($newExportDirPath, $exportType, $resourcesPrefix, $isPreview, $librariesToCopy, $packageLanguage, $user);

        // Copy ode files
        $idevicesMapping = $odeSaveXML->getOdeComponentsMapping();
        $idevicesMapping['odeFileNames'] = $this->odeService->copyOdeFilesToDist(
            $odeSessionId,
            $idevicesMapping,
            $dbUser,
            $newExportDirPath
        );

        // Modify the urls of the base style in the preview
        $baseCssPath = $newExportDirPath.Constants::PERMANENT_SAVE_CONTENT_DIRNAME.DIRECTORY_SEPARATOR.
            Constants::PERMANENT_SAVE_CONTENT_CSS_DIRNAME.DIRECTORY_SEPARATOR.
            Constants::WORKAREA_STYLE_BASE_CSS_FILENAME;
        $this->replaceUrlsBaseCssFile($baseCssPath, $resourcesPrefix, $isPreview);
        // array with all the library paths
        // Get links to files (previously copied files)
        $libsResourcesPath = $this->getFilesLoadedPath($exportType, $librariesFileToCopy);

        // Copy idevices export files
        $idevicesTypesData = $this->copyIdevicesToExportDir(
            $user,
            $odeNavStructureSyncs,
            $newExportDirPath,
            $resourcesPrefix,
            $isPreview,
            $exportType
        );

        // Copy ELP to the export dir if it is necessary
        $elpFileName = false;
        if ($addElpToExport || ('true' == $odeProperties['pp_exportElp']->getValue())) {
            $elpFileName = $this->copyDistElpToExport(
                $dbUser,
                $odeId,
                $odeSessionId,
                $odeVersionId,
                $odeProperties,
                $saveOdeResultParameters['elpFileName'],
                $newExportDirPath
            );
        }

        // Copy theme files
        $themeServerDir = $this->themeHelper->getThemeDir(
            $theme->getDirName(),
            $theme->getType(),
            $dbUser
        );
        $exportDirThemePath = $newExportDirPath.Constants::EXPORT_DIR_THEME;
        FileUtil::copyDir($themeServerDir, $exportDirThemePath);

        // ///////////////////////////////////////////////////

        // Get sorted structure (pages)
        $odeNavStructureSyncsSorted = self::getOdeNavStructureSyncsSorted($odeNavStructureSyncs);

        // Get export pages data
        $pagesFileData = self::getPagesData(
            $exportDirPath,
            $odeNavStructureSyncsSorted,
            $userPreferencesDtos,
            $resourcesPrefix,
            $exportType
        );

        // Clone idevices
        $odeComponentsSyncCloneArray = [];

        // Replace urls in idevice
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                    $ideviceId = $odeComponentsSync->getOdeIdeviceId();
                    $newIdeviceId = $idevicesMapping[$ideviceId];
                    $ideviceResourcesMapping = $idevicesMapping['odeFileNames']['odeComponents'][$newIdeviceId];
                    $filemanagerResourcesMapping = $idevicesMapping['odeFileNames']['fileManager'];

                    $odeComponentsSyncClone = clone $odeComponentsSync;

                    // Page file path/url
                    $pageData = $pagesFileData[$odeNavStructureSync->getOdePageId()];

                    // In case it is not a preview we need to adjust the url of the links since we will be in a subfolder
                    if (!$pageData['isIndex'] && !$isPreview && Constants::EXPORT_TYPE_HTML5_SP != $exportType) {
                        $newResourcesPrefix = '..'.Constants::SLASH.$resourcesPrefix;
                    } else {
                        $newResourcesPrefix = $resourcesPrefix;
                    }
                    $isIndex = $pageData['isIndex'];
                    $odeComponentsSyncClone->replaceLinksHtml(
                        $newIdeviceId,
                        $ideviceResourcesMapping,
                        $filemanagerResourcesMapping,
                        $pagesFileData,
                        $userPreferencesDtos,
                        $elpFileName,
                        $newResourcesPrefix,
                        $exportType,
                        $isIndex
                    );

                    $odeComponentsSyncCloneArray[$ideviceId] = $odeComponentsSyncClone;
                }
            }
        }

        // ///////////////////////////////////////////////////
        // CREATE FILES
        // ///////////////////////////////////////////////////

        // Create the config.xml in case the export is a ELP or editable export preference is activated
        if (Constants::EXPORT_TYPE_ELP == $exportType
                || ((('true' == $odeProperties['exportSource']->getValue()) || $isIntegration)
                   && (Constants::EXPORT_TYPE_HTML5 == $exportType || Constants::EXPORT_TYPE_SCORM12 == $exportType
                   || Constants::EXPORT_TYPE_SCORM2004 == $exportType || Constants::EXPORT_TYPE_HTML5_SP == $exportType
                   || Constants::EXPORT_TYPE_IMS == $exportType)
                )
        ) {
            $configFileName = Constants::PERMANENT_SAVE_CONTENT_FILENAME;
            $xmlFilePathName = $newExportDirPath.$configFileName;
            $odeSaveXML->getXml()->asXML($xmlFilePathName);
        }

        // Create files depending on the type of export
        $generatedContent = $this->generateExportContentByExportType(
            $dbUser,
            $exportType,
            $newExportDirPath,
            $odeSessionId,
            $odeProperties,
            $odeNavStructureSyncs,
            $odeComponentsSyncCloneArray,
            $libsResourcesPath,
            $idevicesMapping,
            $idevicesByPage,
            $idevicesTypesData,
            $userPreferencesDtos,
            $theme,
            $elpFileName,
            $resourcesPrefix,
            $isPreview
        );

        if ($generatedContent) {
            $response['responseMessage'] = 'OK';
        } else {
            $response['responseMessage'] = $this->translator->trans('Failed to generate export content');
        }

        return $response;
    }

    // ///////////////////////////////////////////////////////////////////////////////////////////////
    // PRIVATE FUNCTIONS
    // ///////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Generates the content of the export according to its type.
     *
     * @param User                $user
     * @param string              $exportType
     * @param string              $exportDirPath
     * @param string              $odeSessionId
     * @param array               $odeProperties
     * @param array               $odeNavStructureSyncs
     * @param array               $libsResourcesPath
     * @param array               $idevicesMapping
     * @param array               $idevicesByPage
     * @param array               $idevicesTypesData
     * @param userPreferencesDtos $userPreferencesDtos
     * @param ThemeDto            $theme
     * @param string              $elpFileName
     * @param string              $resourcesPrefix
     * @param bool                $isPreview
     *
     * @return bool
     */
    private function generateExportContentByExportType(
        $user,
        $exportType,
        $exportDirPath,
        $odeSessionId,
        $odeProperties,
        $odeNavStructureSyncs,
        $odeComponentsSyncCloneArray,
        $libsResourcesPath,
        $idevicesMapping,
        $idevicesByPage,
        $idevicesTypesData,
        $userPreferencesDtos,
        $theme,
        $elpFileName,
        $resourcesPrefix,
        $isPreview,
    ) {
        // Get sorted structure (pages)
        $odeNavStructureSyncsSorted = self::getOdeNavStructureSyncsSorted($odeNavStructureSyncs);

        // Get export pages data
        $pagesFileData = self::getPagesData(
            $exportDirPath,
            $odeNavStructureSyncsSorted,
            $userPreferencesDtos,
            $resourcesPrefix,
            $exportType
        );

        // Create export pages dir
        self::createPagesDir($exportDirPath);

        // Get service by export type
        switch ($exportType) {
            case Constants::EXPORT_TYPE_SCORM12:
                $exportService = $this->exportSCORM12Service;
                break;
            case Constants::EXPORT_TYPE_SCORM2004:
                $exportService = $this->exportSCORM2004Service;
                break;
            case Constants::EXPORT_TYPE_IMS:
                $exportService = $this->exportIMSService;
                break;
            case Constants::EXPORT_TYPE_EPUB3:
                $exportService = $this->exportEPUB3Service;
                break;
            case Constants::EXPORT_TYPE_HTML5_SP:
                $exportService = $this->exportHTML5SPService;
                break;
            case Constants::EXPORT_TYPE_ELP:
            case Constants::EXPORT_TYPE_HTML5:
            default:
                $exportService = $this->exportHTML5Service;
        }

        // Generate export type files
        // Create files: xml, html, etc. depending on the type of export
        $viewContentGenerated = false;

        if ($exportService) {
            try {
                $viewContentGenerated = $exportService->generateExportFiles(
                    $user,
                    $odeSessionId,
                    $odeNavStructureSyncsSorted,
                    $pagesFileData,
                    $odeProperties,
                    $libsResourcesPath,
                    $odeComponentsSyncCloneArray,
                    $idevicesMapping,
                    $idevicesByPage,
                    $idevicesTypesData,
                    $userPreferencesDtos,
                    $theme,
                    $elpFileName,
                    $resourcesPrefix,
                    $isPreview,
                    $this->translator
                );
            } catch (\Exception $e) {
                $this->logger->error(
                    'generateExportFiles: '.$e->getMessage(),
                    ['file:' => $this, 'line' => __LINE__]
                );
            }
        }

        return $viewContentGenerated;
    }

    /**
     * Generate common i18n JavaScript content with main translations and iDevice translations.
     *
     * @param string        $packageLanguage
     * @param array         $translations
     * @param UserInterface $user
     *
     * @return string
     */
    private function generateCommonI18nJs(
        $packageLanguage,
        $translations,
        $user,
    ) {
        // Build JS object $exe_i18n
        $entriesCommon = [];
        $commonTranslations = $translations['common'] ?? [];
        $jsContent = "// The content of this file will be dynamically generated in the language of the elp.\n";
        $jsContent .= '$exe_i18n = {';
        foreach ($commonTranslations as $key => $value) {
            $entriesCommon[] = $key.': "'.addslashes($value).'"';
        }

        $jsContent .= implode(', ', $entriesCommon);
        $jsContent .= '};'."\n";

        // Build JS object $exe_i18n.exeGames
        $entriesGames = [];
        $gamesTranslations = $translations['games'] ?? [];
        $jsContent .= "// This line is only present if the elp contains a hangman game.\n";
        $jsContent .= '$exe_i18n.exeGames = {';
        foreach ($gamesTranslations as $key => $value) {
            $entriesGames[] = $key.': "'.addslashes($value).'"';
        }

        $jsContent .= implode(', ', $entriesGames);
        $jsContent .= '};'."\n";

        // Add iDevice translations
        try {
            $idevicesInstalled = $this->ideviceHelper->getInstalledIdevices($user);
            foreach ($idevicesInstalled as $idevice) {
                $ideviceName = $idevice->getName();
                $ideviceDir = $idevice->getDirName();

                $ideviceTranslationPath = $this->ideviceHelper->getIdeviceTranslationFilePathName(
                    $packageLanguage,
                    $ideviceDir,
                    $ideviceName
                );

                if (file_exists($ideviceTranslationPath)) {
                    $ideviceTranslations = FileUtil::readXlfFile($ideviceTranslationPath, $packageLanguage);
                    foreach ($ideviceTranslations as $key => $value) {
                        $translated = $this->translator->trans($value, [], null, $packageLanguage);
                        $prefixedKey = $ideviceName.'_'.$key;
                        $jsContent .= '$exe_i18n.exeGames["'.addslashes($prefixedKey).'"] = "'.addslashes($translated)."\";\n";
                    }
                }
            }
        } catch (\Exception $e) {
            $this->logger->warning('Failed to load iDevice translations: '.$e->getMessage());
        }

        return $jsContent;
    }

    /**
     * Copy symfony base files to project export libs dir.
     *
     * @param string        $exportDirPath
     * @param string        $exportType
     * @param string        $resourcesPrefix
     * @param string        $isPreview
     * @param array         $libraries
     * @param string        $packageLanguage
     * @param UserInterface $user
     *
     * @return array
     */
    private function copyBaseFilesToExportDir(
        $exportDirPath,
        $exportType,
        $resourcesPrefix,
        $isPreview,
        $libraries,
        $packageLanguage,
        $user,
    ) {
        $filesToCopy = [];

        // Base files
        // $filesToCopy = array_merge($filesToCopy, Constants::EXPORT_SYMFONY_PUBLIC_FILES_BASE);
        $filesToCopy = [
            Constants::JS_APP_NAME.DIRECTORY_SEPARATOR.Constants::COMMON_NAME.DIRECTORY_SEPARATOR.'exe_export.js',
            // Constants::JS_APP_NAME.DIRECTORY_SEPARATOR.Constants::COMMON_NAME.DIRECTORY_SEPARATOR.'common_i18n.js',
            Constants::JS_APP_NAME.DIRECTORY_SEPARATOR.Constants::COMMON_NAME.DIRECTORY_SEPARATOR.'common.js',
            Constants::LIBS_DIR.DIRECTORY_SEPARATOR.'jquery',
            Constants::LIBS_DIR.DIRECTORY_SEPARATOR.'bootstrap',
        ];
        $filesToCopy = array_merge($filesToCopy, $libraries);

        // Get translations
        $commonI18n = new Commoni18nUtil($this->translator, $packageLanguage);

        $translations = [
            'common' => $commonI18n->getCommonStringsi18n(),
            'games' => $commonI18n->getGamesStringsi18n(),
        ];

        // Generate common_i18n.js directly in the export folder
        $commonI18nContent = $this->generateCommonI18nJs($packageLanguage, $translations, $user);
        $exportLibsDir = $exportDirPath.Constants::EXPORT_DIR_PUBLIC_LIBS.DIRECTORY_SEPARATOR;

        if (!is_dir($exportLibsDir)) {
            mkdir($exportLibsDir, 0777, true);
        }

        $commonI18nPath = $exportLibsDir.'common_i18n.js';
        file_put_contents($commonI18nPath, $commonI18nContent);

        // Add symfony path
        $symfonyPublicDirPath = $this->fileHelper->getSymfonyPublicDir();
        $filesSymfonyPath = [];
        foreach ($filesToCopy as $path) {
            $filesSymfonyPath[] = $symfonyPublicDirPath.$path;
        }

        // Copy files
        foreach ($filesSymfonyPath as $path) {
            $basename = basename($path);
            // Copy into export libs dir
            $exportLibsPath = $exportDirPath.Constants::EXPORT_DIR_PUBLIC_LIBS.DIRECTORY_SEPARATOR;
            $exportContentPath = $exportLibsPath.$basename;
            if (is_dir($path)) {
                FileUtil::copyDir($path, $exportContentPath);
                $files = FileUtil::listAllFilesByParentFolder($exportContentPath);
                foreach ($files as $file) {
                    $ext = pathinfo($file, PATHINFO_EXTENSION);
                    if ('css' == $ext) {
                        $this->replaceUrlsLibsCssFile($file, $resourcesPrefix, $isPreview);
                    }
                }
            } else {
                if (false === strpos($path, 'exe_powered_logo')) {
                    FileUtil::copyFile($path, $exportContentPath);
                    $ext = pathinfo($exportContentPath, PATHINFO_EXTENSION);
                    if ('css' == $ext) {
                        $this->replaceUrlsLibsCssFile($exportContentPath, $resourcesPrefix, $isPreview);
                    }
                } else {
                    // Copy exe_powered_logo to the export content/img dir
                    $basename = basename($path);
                    // Copy into export content dir
                    $exportContentPath = $exportDirPath.Constants::PERMANENT_SAVE_CONTENT_DIRNAME.DIRECTORY_SEPARATOR.Constants::PERMANENT_SAVE_CONTENT_RESOURCES_IMG_DIRNAME.DIRECTORY_SEPARATOR;
                    $exportContentPath = $exportContentPath.$basename;
                    FileUtil::copyFile($path, $exportContentPath);
                }
            }
        }

        return $filesSymfonyPath;
    }

    /**
     * Copy symfony schema files to project export dir.
     *
     * @param string $exportDirPath
     * @param string $exportType
     *
     * @return array
     */
    private function copySchemaFilesToExportDir($exportDirPath, $exportType)
    {
        $filesToCopy = [];

        if (isset(Constants::EXPORT_SYMFONY_PUBLIC_SCHEMAS[$exportType])) {
            $schemas = Constants::EXPORT_SYMFONY_PUBLIC_SCHEMAS[$exportType];
            $filesToCopy = array_merge($filesToCopy, $schemas);
        }

        // Add symfony path
        $symfonyPublicDirPath = $this->fileHelper->getSymfonyPublicDir();
        $symfonyPublicAppDirPath = $symfonyPublicDirPath.Constants::JS_APP_NAME.DIRECTORY_SEPARATOR;
        $symfonyPublicSchemasDirPath = $symfonyPublicAppDirPath.Constants::SCHEMAS_NAME.DIRECTORY_SEPARATOR;
        $filesSymfonyPath = [];
        foreach ($filesToCopy as $path) {
            $filesSymfonyPath[] = $symfonyPublicSchemasDirPath.$path;
        }

        // Copy files
        foreach ($filesSymfonyPath as $path) {
            // Copy into export base dir
            if (is_dir($path)) {
                FileUtil::copyDir($path, $exportDirPath);
            } else {
                FileUtil::copyFile($path, $exportDirPath.basename($path));
            }
        }

        return $filesSymfonyPath;
    }

    /**
     * Copy symfony common files to project export dir.
     *
     * @param string $exportDirPath
     * @param string $exportType
     *
     * @return array
     */
    private function copyCommonFilesToExportDir($exportDirPath, $exportType)
    {
        $filesToCopy = [];

        if (isset(Constants::EXPORT_SYMFONY_PUBLIC_COMMON[$exportType])) {
            $commonFiles = Constants::EXPORT_SYMFONY_PUBLIC_COMMON[$exportType];
            $filesToCopy = array_merge($filesToCopy, $commonFiles);
        }

        // Add symfony path
        $symfonyPublicDirPath = $this->fileHelper->getSymfonyPublicDir();
        $symfonyPublicAppDirPath = $symfonyPublicDirPath.Constants::JS_APP_NAME.DIRECTORY_SEPARATOR;
        $symfonyPublicCommonDirPath = $symfonyPublicAppDirPath.Constants::COMMON_NAME.DIRECTORY_SEPARATOR;
        $filesSymfonyPath = [];
        foreach ($filesToCopy as $path) {
            $filesSymfonyPath[] = $symfonyPublicCommonDirPath.$path;
        }

        // Copy files
        foreach ($filesSymfonyPath as $path) {
            // Copy into export base dir
            if (is_dir($path)) {
                FileUtil::copyDir($path, $exportDirPath.DIRECTORY_SEPARATOR.Constants::LIBS_DIR);
            } else {
                FileUtil::copyFile($path, $exportDirPath.basename($path).DIRECTORY_SEPARATOR.Constants::LIBS_DIR);
            }
        }

        return $filesSymfonyPath;
    }

    /**
     * Returns the path to the files that will be loaded in the export.
     *
     * @param string $exportType
     *
     * @return array
     */
    private function getFilesLoadedPath($exportType, $filesToExport)
    {
        // Get resources urls
        $libsResourcesUrlPath = ['js' => [], 'css' => []];
        $exportScriptsBase = [
            '/jquery/jquery.min.js',
            '/common_i18n.js',
            '/common.js',
            '/exe_export.js',
            '/bootstrap/bootstrap.bundle.min.js',
            '/bootstrap/bootstrap.min.css',
        ];

        // Base files to link
        $exportScripts = [];
        $exportScripts = array_merge($exportScriptsBase, ...$filesToExport);

        // Extra files to link by export type
        if (isset(Constants::EXPORT_SYMFONY_SCRIPTS_LOADING_BY_EXPORT[$exportType])) {
            $exportScriptsExtra = Constants::EXPORT_SYMFONY_SCRIPTS_LOADING_BY_EXPORT[$exportType];
            $exportScripts = array_merge($exportScripts, $exportScriptsExtra);
        }

        // Group by file type
        foreach ($exportScripts as $file) {
            $ext = pathinfo($file, PATHINFO_EXTENSION);
            switch ($ext) {
                case 'js':
                    $libsResourcesUrlPath['js'][] = Constants::EXPORT_DIR_PUBLIC_LIBS.$file;
                    break;
                case 'css':
                    $libsResourcesUrlPath['css'][] = Constants::EXPORT_DIR_PUBLIC_LIBS.$file;
                    break;
                default:
                    break;
            }
        }

        return $libsResourcesUrlPath;
    }

    /**
     * Copy idevices export dir to project export dir.
     *
     * @param UserInterface         $user
     * @param OdeNavStructureSync[] $odeNavStructureSyncs
     * @param string                $exportDirPath
     * @param string                $resourcesPrefix
     * @param bool                  $isPreview
     * @param string                $exportType
     *
     * @return array
     */
    private function copyIdevicesToExportDir(
        $user,
        $odeNavStructureSyncs,
        $exportDirPath,
        $resourcesPrefix,
        $isPreview,
        $exportType,
    ) {
        $ideviceTypesData = [];

        $exportDynamicPage = true;
        if (Constants::EXPORT_TYPE_EPUB3 == $exportType) {
            $exportDynamicPage = false;
        }

        $exportIdeviceDir = $exportDirPath.Constants::EXPORT_DIR_IDEVICES.DIRECTORY_SEPARATOR;
        $idevicesInstalled = $this->ideviceHelper->getInstalledIdevices($user);
        $ideviceTypes = self::getAllIdeviceTypes($odeNavStructureSyncs);

        foreach ($idevicesInstalled as $idevice) {
            $dirname = $idevice->getDirName();
            $type = $idevice->getType();
            $category = $idevice->getCategory();

            if (!$exportDynamicPage && in_array($category, Constants::IDEVICES_DYNAMIC_CATEGORIES)) {
                continue;
            }

            if (!in_array($dirname, $ideviceTypes)) {
                continue;
            }

            $ideviceExportDirProject = $this->ideviceHelper->getIdeviceExportDirPath($dirname, $type, $user);
            $ideviceExportDirExport = $exportIdeviceDir.$dirname;

            FileUtil::copyDir($ideviceExportDirProject, $ideviceExportDirExport);

            // Edit urls in js and css files
            if ($isPreview) {
                foreach ($idevice->getExportCss() as $cssFile) {
                    $file = $ideviceExportDirExport.DIRECTORY_SEPARATOR.$cssFile;
                    self::replaceUrlsIdeviceCssFile($file, $idevice, $resourcesPrefix);
                }
            }

            $ideviceTypesData[$dirname] = [
                'component-type' => $idevice->getComponentType(),
                'category' => $category,
                'class' => $idevice->getCssClass(),
                'js' => $idevice->getExportJs(),
                'css' => $idevice->getExportCss(),
                'template' => $idevice->getExportTemplateContent(),
                'visible' => $idevice->isVisible(),
            ];
        }

        return $ideviceTypesData;
    }

    /**
     * Copy ELP file to the export directory.
     *
     * @param User   $user
     * @param string $odeId
     * @param string $odeSessionId
     * @param string $odeVersionId
     * @param array  $odeProperties
     * @param string $elpFilename
     * @param string $exportDirPath
     *
     * @return string
     */
    public function copyDistElpToExport(
        $user,
        $odeId,
        $odeSessionId,
        $odeVersionId,
        $odeProperties,
        $elpFilename,
        $exportDirPath,
    ) {
        $elpPath = $this->fileHelper->getOdeSessionDistDirForUser($odeSessionId, $user);
        $elpFilePath = $elpPath.$elpFilename;
        $elpExportFileName = self::generateExportFileName(
            $odeId,
            $odeVersionId,
            $odeProperties,
            Constants::FILE_EXTENSION_ELP,
        );
        $elpExportFilePath = $exportDirPath.$elpExportFileName;
        FileUtil::copyFile($elpFilePath, $elpExportFilePath);

        return $elpExportFileName;
    }

    /**
     * Compresses in a zip all the content of the export.
     *
     * @param User   $user
     * @param string $odeId
     * @param string $odeVersionId
     * @param string $odeSessionId
     *
     * @return string|bool
     */
    private function zipExportFile(
        $user,
        $odeId,
        $odeVersionId,
        $odeSessionId,
        $exportDirPath,
        $exportType = Constants::FILE_EXTENSION_ZIP,
        $slug = null,
        $typeSuffix = '',
    ) {
        try {
            Util::checkPhpZipExtension();
            // Create zip file
            $exportFileName = self::createZipOdeExportFilesToDist($odeId, $odeVersionId, $exportDirPath, $exportType, $slug, $typeSuffix);
            // Remove Ode files from dist dir after generating zip
            $this->odeService->cleanOdeFilesFromDist($odeSessionId, $user);

            return $exportFileName;
        } catch (PhpZipExtensionException $e) {
            return false;
        }
    }

    // ///////////////////////////////////////////////////////////////////////////////////////////////
    // PRIVATE STATIC FUNCTIONS
    // ///////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Creates zip file to dist dir.
     *
     * @param string $odeId
     * @param string $odeVersionId
     * @param string $exportDirPath
     *
     * @return string
     */
    private static function createZipOdeExportFilesToDist(
        $odeId,
        $odeVersionId,
        $exportDirPath,
        $exportType = Constants::FILE_EXTENSION_ZIP,
        $slug = null,
        $typeSuffix = '',
    ) {
        $name = self::generateExportFileName($odeId, $odeVersionId, null, $exportType, $slug, $typeSuffix);
        $zipPath = $exportDirPath.$name;

        FileUtil::zipDir($exportDirPath, $zipPath);

        return $name;
    }

    /**
     * Replace urls.
     *
     * @param string $file
     * @param IdeviceDto idevice
     * @param string $resourcesPrefix
     *
     * @return void
     */
    private static function replaceUrlsIdeviceCssFile($file, $idevice, $resourcesPrefix)
    {
        $exportDirIdevicePath = Constants::EXPORT_DIR_IDEVICES.Constants::SLASH.$idevice->getDirName().
            Constants::SLASH;

        $fileText = file_get_contents($file);

        $oldUrlMatch = 'url(';
        $newUrlMatch = 'url('.$resourcesPrefix.$exportDirIdevicePath;

        $fileText = str_replace($oldUrlMatch, $newUrlMatch, $fileText);

        file_put_contents($file, $fileText);
    }

    /**
     * Replace urls.
     *
     * @param string $file
     * @param string $resourcesPrefix
     * @param string $isPreview
     *
     * @return void
     */
    private static function replaceUrlsLibsCssFile($file, $resourcesPrefix, $isPreview)
    {
        $exportDirPath = Constants::EXPORT_DIR_PUBLIC_LIBS.Constants::SLASH;
        $libsPathString = DIRECTORY_SEPARATOR.Constants::EXPORT_DIR_PUBLIC_LIBS.DIRECTORY_SEPARATOR;
        $filePathExplodeLibs = explode($libsPathString, $file);

        if (count($filePathExplodeLibs) > 1) {
            $pathLib = end($filePathExplodeLibs);
            $pathLibWithoutFile = str_replace(basename($file), '', $pathLib);
            $exportDirPath = $exportDirPath.$pathLibWithoutFile;
        }

        $fileText = file_get_contents($file);

        $oldUrlMatch = 'url(';
        $newUrlMatch = 'url('.$resourcesPrefix.($isPreview ? $exportDirPath : '');

        $fileText = str_replace($oldUrlMatch, $newUrlMatch, $fileText);

        file_put_contents($file, $fileText);
    }

    /**
     * Replace urls.
     *
     * @param string $file
     * @param string $resourcesPrefix
     *
     * @return void
     */
    private static function replaceUrlsBaseCssFile($file, $resourcesPrefix, $isPreview)
    {
        $exportDirPath = Constants::PERMANENT_SAVE_CONTENT_DIRNAME.Constants::SLASH.
            Constants::PERMANENT_SAVE_CONTENT_CSS_DIRNAME.Constants::SLASH;

        $fileText = file_get_contents($file);

        $oldUrlMatch = 'url(';
        $newUrlMatch = 'url('.$resourcesPrefix.($isPreview ? $exportDirPath : '');

        $fileText = str_replace($oldUrlMatch, $newUrlMatch, $fileText);

        file_put_contents($file, $fileText);
    }

    /**
     * Get idevices types in export.
     *
     * @param OdeNavStructureSync[] $odeNavStructureSyncs
     *
     * @return array
     */
    private static function getAllIdeviceTypes($odeNavStructureSyncs)
    {
        $ideviceTypes = [];
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                    $ideviceTypeName = $odeComponentsSync->getOdeIdeviceTypeName();
                    if (isset($idevicesByPage[$ideviceTypeName])) {
                        ++$ideviceTypes[$ideviceTypeName];
                    } else {
                        $ideviceTypes[$ideviceTypeName] = 1;
                    }
                }
            }
        }

        return array_keys($ideviceTypes);
    }

    /**
     * Get idevices types by page.
     *
     * @param OdeNavStructureSync[] $odeNavStructureSyncs
     *
     * @return array
     */
    private static function getIdeviceTypesByPages($odeNavStructureSyncs)
    {
        $idevicesByPage = [];
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            $pageId = $odeNavStructureSync->getOdePageId();
            $idevicesByPage[$pageId] = [];
            foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                    $ideviceTypeName = $odeComponentsSync->getOdeIdeviceTypeName();
                    if (isset($idevicesByPage[$pageId][$ideviceTypeName])) {
                        ++$idevicesByPage[$pageId][$ideviceTypeName];
                    } else {
                        $idevicesByPage[$pageId][$ideviceTypeName] = 1;
                    }
                }
            }
        }

        return $idevicesByPage;
    }

    /**
     * Get flat array of sorted pages.
     *
     * @param OdeNavStructureSync[] $odeNavStructureSyncs
     *
     * @return OdeNavStructureSync[]
     */
    private static function getOdeNavStructureSyncsSorted($odeNavStructureSyncs)
    {
        $odeNavStructureSyncsSorted = [];
        $pagesIdsSorted = self::getPageDeepChildrenIds($odeNavStructureSyncs, null);
        foreach ($pagesIdsSorted as $pageId) {
            foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
                if ($odeNavStructureSync->getOdePageId() == $pageId) {
                    $odeNavStructureSyncsSorted[] = $odeNavStructureSync;
                    continue;
                }
            }
        }

        return $odeNavStructureSyncsSorted;
    }

    /**
     * Get all children ids of page node.
     *
     * @param OdeNavStructureSync[] $odeNavStructureSyncs
     * @param string                $parentId
     *
     * @return array
     */
    private static function getPageDeepChildrenIds($odeNavStructureSyncs, $parentId)
    {
        $pageChildrenIds = [];
        $idsToReview = [$parentId];

        while (!empty($idsToReview)) {
            $pageIdToReview = array_pop($idsToReview);
            $pageChildrenIds[] = $pageIdToReview;

            $children = self::getPageChildrenIds($odeNavStructureSyncs, $pageIdToReview);
            krsort($children);
            foreach ($children as $child) {
                $idsToReview[] = $child->getOdePageId();
            }
        }

        return $pageChildrenIds;
    }

    /**
     * Get children ids of page node.
     *
     * @param OdeNavStructureSync[] $odeNavStructureSyncs
     * @param string                $parentId
     *
     * @return OdeNavStructureSync[]
     */
    private static function getPageChildrenIds($odeNavStructureSyncs, $parentId)
    {
        $children = [];
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            if ($odeNavStructureSync->getOdeParentPageId() == $parentId) {
                $children[$odeNavStructureSync->getOdeNavStructureSyncOrder()] = $odeNavStructureSync;
            }
        }
        ksort($children);

        return $children;
    }

    /**
     * Fix pages order.
     *
     * @param OdeNavStructureSync[] $odeNavStructureSyncs
     *
     * @return OdeNavStructureSync[]
     */
    private static function fixPagesOrder($odeNavStructureSyncs)
    {
        $pages = [];

        // Order root children
        $childrenRoot = self::getPageChildrenIds($odeNavStructureSyncs, null);
        $order = 1;
        foreach ($childrenRoot as $child) {
            $child->setOdeNavStructureSyncOrder($order);
            $pages[$child->getId()] = $child;
            ++$order;
        }

        // Order descendents of root children
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            $children = self::getPageChildrenIds($odeNavStructureSyncs, $odeNavStructureSync->getOdePageId());
            $order = 1;
            foreach ($children as $child) {
                $child->setOdeNavStructureSyncOrder($order);
                $pages[$child->getId()] = $child;
                ++$order;
            }
        }

        return $pages;
    }

    /**
     * Get export pages file path and url.
     *
     * @param string                $exportDirPath
     * @param OdeNavStructureSync[] $odeNavStructureSyncs
     * @param UserPreferencesDto    $userPreferencesDtos
     * @param string                $resourcePrefix
     * @param string                $exportType
     *
     * @return array
     */
    private static function getPagesData(
        $exportDirPath,
        $odeNavStructureSyncs,
        $userPreferencesDtos,
        $resourcePrefix,
        $exportType,
    ) {
        // Create pages dir
        $exportPagesDirPath = $exportDirPath.Constants::EXPORT_DIR_PAGES_NAME.DIRECTORY_SEPARATOR;

        // Pages filename data
        $prePageId = null;
        $pagesFileData = [];
        $pagesName = [];
        // Get pages info
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            $pageId = $odeNavStructureSync->getOdePageId();

            // Page file info
            $pageName = $odeNavStructureSync->getPageName();
            $isIndex = $odeNavStructureSync->isIndex();
            $fileName = self::generatePageFileName($odeNavStructureSync, $exportType, $pagesName);
            array_push($pagesName, $fileName);
            $dirPath = $isIndex ? $exportDirPath : $exportPagesDirPath;
            $filePath = $dirPath.$fileName;
            $fileUrl = $isIndex ? $fileName : (Constants::EXPORT_DIR_PAGES_NAME.Constants::SLASH.$fileName);

            // Page blocks
            $pageBlocks = [];
            foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                $block = [];
                $block['name'] = $odePagStructureSync->getBlockName();
                $block['order'] = $odePagStructureSync->getOdePagStructureSyncOrder();
                $block['idevices'] = [];
                foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                    $idevice = [];
                    $idevice['order'] = $odeComponentsSync->getOdeComponentsSyncOrder();
                    $idevice['htmlView'] = $odeComponentsSync->getHtmlView();
                    $idevice['jsonProperties'] = $odeComponentsSync->getJsonProperties();
                    $block['idevices'][$odeComponentsSync->getOdeIdeviceId()] = $idevice;
                }
                $pageBlocks[$odePagStructureSync->getOdeBlockId()] = $block;
            }

            $pagesFileData[$pageId] = [
                'name' => $pageName,
                'isIndex' => $isIndex,
                'fileName' => $fileName,
                'rootPath' => $exportDirPath,
                'dirPath' => $dirPath,
                'filePath' => $filePath,
                'fileUrl' => $resourcePrefix.$fileUrl,
                'prePageId' => $prePageId,
                'nextPageId' => null,
                'blocks' => $pageBlocks,
            ];

            if (isset($pagesFileData[$prePageId])) {
                $pagesFileData[$prePageId]['nextPageId'] = $pageId;
            }
            $prePageId = $pageId;
        }

        return $pagesFileData;
    }

    /**
     * Create dir in export dir dir.
     *
     * @param string $exportDirPath
     * @param string $dirName
     *
     * @return string
     */
    private static function createDirInExportDir($exportDirPath, $dirName)
    {
        $newExportDirPath = $exportDirPath.$dirName.DIRECTORY_SEPARATOR;
        if (FilePermissionsUtil::isWritable($newExportDirPath) && !file_exists($newExportDirPath)) {
            $mode = 0775;
            $recursive = true;
            $epubDirCreated = FileUtil::createDir($newExportDirPath, $mode, $recursive);
        }

        return $newExportDirPath;
    }

    /**
     * Create export pages dir.
     *
     * @param string $exportDirPath
     *
     * @return string|bool
     */
    private static function createPagesDir($exportDirPath)
    {
        $pagesExportDirPath = $exportDirPath.Constants::EXPORT_DIR_PAGES_NAME.DIRECTORY_SEPARATOR;
        if (FilePermissionsUtil::isWritable($exportDirPath)) {
            $mode = 0775;
            $recursive = true;
            $pagesExportDirPathCreated = FileUtil::createDir($pagesExportDirPath, $mode, $recursive);
        }

        if ($pagesExportDirPathCreated) {
            return $pagesExportDirPath;
        } else {
            return false;
        }
    }

    /**
     * Generates export zip filename.
     *
     * @param string      $odeId
     * @param string      $odeVersionId
     * @param array       $odeProperties
     * @param string      $ext           Packaging extension (zip, elp, epub…)
     * @param string|null $slug
     *
     * @return string
     */
    private static function generateExportFileName(
        $odeId,
        $odeVersionId,
        $odeProperties = null,
        $ext = Constants::FILE_EXTENSION_ZIP,
        $slug = null,
        $typeSuffix = '',
    ) {
        if (isset($odeProperties['pp_title']) && '' != $odeProperties['pp_title']->getValue()) {
            $exportFileName = $odeProperties['pp_title']->getValue().
                Constants::FILE_EXTENSION_SEPARATOR.$ext;
        } else {
            $exportFileName = Constants::DEFAULT_ELP_NAME.$typeSuffix.Constants::FILE_EXTENSION_SEPARATOR.$ext;
        }
        if (isset($slug) && ('' != $slug)) {
            $exportFileName = $slug.$typeSuffix.Constants::FILE_EXTENSION_SEPARATOR.$ext;
        }

        return $exportFileName;
    }

    /**
     * Generate page file name (html).
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param string              $exportType
     * @param array               $pgNames
     *
     * @return string
     */
    private static function generatePageFileName($odeNavStructureSync, $exportType, $pgNames)
    {
        if (Constants::EXPORT_TYPE_EPUB3 == $exportType) {
            $ext = Constants::FILE_EXTENSION_XHTML;
        } else {
            $ext = Constants::FILE_EXTENSION_HTML;
        }

        if ($odeNavStructureSync->isIndex()) {
            $pageName = Constants::EXPORT_FILE_INDEX_NAME.Constants::FILE_EXTENSION_SEPARATOR.$ext;
        } else {
            $pagePreName = $odeNavStructureSync->getPageName();
            $pageNameBase = $pagePreName;
            $pageNameBase = self::normalizeFileName($pageNameBase);
            $pageName = $pageNameBase.Constants::FILE_EXTENSION_SEPARATOR.$ext;
            $num = 1;
            $maxNum = 20;
            while (in_array($pageName, $pgNames) && $num <= $maxNum) {
                $pageName = $pageNameBase.$num.Constants::FILE_EXTENSION_SEPARATOR.$ext;
                ++$num;
            }
        }

        return $pageName;
    }

    /**
     * Standardize HTML file naming: lowercase, accents, spaces to underscores, special characters.
     *
     * @param string $fileName
     *
     * @return string
     */
    private static function normalizeFileName($fileName)
    {
        $replacements = [
            'à' => 'a',
            'á' => 'a',
            'â' => 'a',
            'ã' => 'a',
            'ä' => 'ae',
            'å' => 'aa',
            'æ' => 'ae',
            'ç' => 'c',
            'è' => 'e',
            'é' => 'e',
            'ê' => 'e',
            'ë' => 'ee',
            'ì' => 'i',
            'í' => 'i',
            'î' => 'i',
            'ï' => 'i',
            'ð' => 'dh',
            'ñ' => 'n',
            'ò' => 'o',
            'ó' => 'o',
            'ô' => 'o',
            'õ' => 'o',
            'ö' => 'oe',
            'ø' => 'oe',
            'ù' => 'u',
            'ú' => 'u',
            'û' => 'u',
            'ü' => 'ue',
            'ý' => 'y',
            'þ' => 'th',
            'ÿ' => 'y',
            'ā' => 'aa',
            'ă' => 'a',
            'ą' => 'a',
            'ć' => 'c',
            'ĉ' => 'c',
            'ċ' => 'c',
            'č' => 'ch',
            'ď' => 'd',
            'đ' => 'd',
            'ē' => 'ee',
            'ĕ' => 'e',
            'ė' => 'e',
            'ę' => 'e',
            'ě' => 'e',
            'ĝ' => 'g',
            'ğ' => 'g',
            'ġ' => 'g',
            'ģ' => 'g',
            'ĥ' => 'h',
            'ħ' => 'hh',
            'ĩ' => 'i',
            'ī' => 'ii',
            'ĭ' => 'i',
            'į' => 'i',
            'ı' => 'i',
            'ĳ' => 'ij',
            'ĵ' => 'j',
            'ķ' => 'k',
            'ĸ' => 'k',
            'ĺ' => 'l',
            'ļ' => 'l',
            'ľ' => 'l',
            'ŀ' => 'l',
            'ł' => 'l',
            'ń' => 'n',
            'ņ' => 'n',
            'ň' => 'n',
            'ŉ' => 'n',
            'ŋ' => 'ng',
            'ō' => 'oo',
            'ŏ' => 'o',
            'ő' => 'oe',
            'œ' => 'oe',
            'ŕ' => 'r',
            'ŗ' => 'r',
            'ř' => 'r',
            'ś' => 's',
            'ŝ' => 's',
            'ş' => 's',
            'š' => 'sh',
            'ţ' => 't',
            'ť' => 't',
            'ŧ' => 'th',
            'ũ' => 'u',
            'ū' => 'uu',
            'ŭ' => 'u',
            'ů' => 'u',
            'ű' => 'ue',
            'ų' => 'u',
            'ŵ' => 'w',
            'ŷ' => 'y',
            'ź' => 'z',
            'ż' => 'z',
            'ž' => 'zh',
            'ſ' => 's',
            'ǝ' => 'e',
            'ș' => 's',
            'ț' => 't',
            'ơ' => 'o',
            'ư' => 'u',
            'ầ' => 'a',
            'ằ' => 'a',
            'ề' => 'e',
            'ồ' => 'o',
            'ờ' => 'o',
            'ừ' => 'u',
            'ỳ' => 'y',
            'ả' => 'a',
            'ẩ' => 'a',
            'ẳ' => 'a',
            'ẻ' => 'e',
            'ể' => 'e',
            'ỉ' => 'i',
            'ỏ' => 'o',
            'ổ' => 'o',
            'ở' => 'o',
            'ủ' => 'u',
            'ử' => 'u',
            'ỷ' => 'y',
            'ẫ' => 'a',
            'ẵ' => 'a',
            'ẽ' => 'e',
            'ễ' => 'e',
            'ỗ' => 'o',
            'ỡ' => 'o',
            'ữ' => 'u',
            'ỹ' => 'y',
            'ấ' => 'a',
            'ắ' => 'a',
            'ế' => 'e',
            'ố' => 'o',
            'ớ' => 'o',
            'ứ' => 'u',
            'ạ' => 'a',
            'ậ' => 'a',
            'ặ' => 'a',
            'ẹ' => 'e',
            'ệ' => 'e',
            'ị' => 'i',
            'ọ' => 'o',
            'ộ' => 'o',
            'ợ' => 'o',
            'ụ' => 'u',
            'ự' => 'u',
            'ỵ' => 'y',
            'ɑ' => 'a',
            'ǖ' => 'uu',
            'ǘ' => 'uu',
            'ǎ' => 'a',
            'ǐ' => 'i',
            'ǒ' => 'o',
            'ǔ' => 'u',
            'ǚ' => 'uu',
            'ǜ' => 'uu',
            '&' => '-',
        ];
        $special_chars = ['¨', '`', '@', '^', '+', '¿', '?', '[', ']', '/', '\\', '=', '<', '>', ':', ';', ',', "'", '"', '$', '#', '*', '(', ')', '|', '~', '`', '!', '!', '{', '}', '%', '+', '’', '«', '»', '”', '“', chr(0)];
        $newFileName = strtolower($fileName);
        $newFileName = strtr($newFileName, $replacements);
        $newFileName = str_replace($special_chars, '', $newFileName);
        $newFileName = str_replace(' ', '-', $newFileName);
        $newFileName = preg_replace('/_+/', '_', $newFileName);
        $newFileName = preg_replace('/[\x00-\x1F\x7F]/u', '', $newFileName);
        $newFileName = preg_replace('/[\-\.]+/', '-', $newFileName);
        $newFileName = trim($newFileName, '-.');

        return $newFileName;
    }

    /**
     * Generate index file name.
     *
     * @return string
     */
    private static function generateIndexFileName()
    {
        $indexExt = Constants::FILE_EXTENSION_HTML;
        $indexFileExtension = Constants::FILE_EXTENSION_SEPARATOR.$indexExt;
        $indexFileName = Constants::EXPORT_FILE_INDEX_NAME.$indexFileExtension;

        return $indexFileName;
    }
}
