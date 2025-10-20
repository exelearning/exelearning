<?php

namespace App\Service\net\exelearning\Service\Api;

use App\Constants;
use App\Entity\net\exelearning\Dto\UserPreferencesDto;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Entity\net\exelearning\Entity\OdePropertiesSync;
use App\Entity\net\exelearning\Entity\User;
use App\Exception\net\exelearning\Exception\Logical\PhpZipExtensionException;
use App\Exception\net\exelearning\Exception\Logical\UserAlreadyOpenSessionException;
use App\Exception\net\exelearning\Exception\Logical\UserInsufficientSpaceException;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Properties;
use App\Settings;
use App\Util\net\exelearning\Util\DateUtil;
use App\Util\net\exelearning\Util\FilePermissionsUtil;
use App\Util\net\exelearning\Util\FileUtil;
use App\Util\net\exelearning\Util\OdeXmlUtil;
use App\Util\net\exelearning\Util\SettingsUtil;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

class OdeService implements OdeServiceInterface
{
    private $entityManager;
    private $logger;
    private $fileHelper;
    private $currentOdeUsersService;
    private $userHelper;
    private $translator;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        FileHelper $fileHelper,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        UserHelper $userHelper,
        TranslatorInterface $translator,
    ) {
        $this->entityManager = $entityManager;
        $this->logger = $logger;
        $this->fileHelper = $fileHelper;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->userHelper = $userHelper;
        $this->translator = $translator;
    }

    /**
     * Moves elp file in dist directory.
     *
     * @param array $odeResultParameters
     * @param User  $user
     *
     * @return bool
     */
    public function removeElpDistFile($odeResultParameters, $user)
    {
        // Dist dir path where elp is located
        $elpSource = $this->fileHelper->getOdeSessionDistDirForUser(
            $odeResultParameters['odeSessionId'],
            $user
        );
        $elpSourceFilePath = $elpSource.$odeResultParameters['elpFileName'];

        $fileremoved = false;

        // Remove elp file
        if (is_file($elpSourceFilePath)) {
            FileUtil::removeFile($elpSourceFilePath);
            $fileremoved = true;
        }

        return $fileremoved;
    }

    /**
     * Moves elp file to perm and insert to ode_files.
     *
     * @param array $odeResultParameters
     * @param User  $user
     * @param bool  $isManualSave
     *
     * @return array
     */
    public function moveElpFileToPerm($odeResultParameters, $user, $isManualSave)
    {
        // Dist dir path where elp is located
        $elpSource = $this->fileHelper->getOdeSessionDistDirForUser(
            $odeResultParameters['odeSessionId'],
            $user
        );
        $elpSourceFilePath = $elpSource.$odeResultParameters['elpFileName'];

        try {
            $this->checkUserUsedSpace(
                $user,
                $odeResultParameters['odeId'],
                $elpSource,
                $odeResultParameters['elpFileName'],
                $isManualSave
            );
        } catch (UserInsufficientSpaceException $e) {
            $this->logger->error(
                $e->getMessage(),
                [
                    'file' => $e->getFile(), 'line' => $e->getLine(),
                    'user' => $user->getUsername(), 'file:' => $this, 'line' => __LINE__,
                ]
            );

            // Remove elp file
            FileUtil::removeFile($elpSourceFilePath);

            throw $e;
        }

        // Perm/odes dir path
        $elpDestination = $this->fileHelper->getPermanentContentStorageOdesDir();

        // Get identifier of elp to generate date dir structure
        $start = strpos($odeResultParameters['elpFileName'], Constants::ELP_NAME_SEPARATOR) + 1;
        $len = strpos(
            $odeResultParameters['elpFileName'],
            Constants::FILE_EXTENSION_SEPARATOR,
            $start
        ) - $start;

        $identifierForDirStructure = substr($odeResultParameters['elpFileName'], $start, $len);

        // Date dir Structure by filename
        $dateDirStructure = FileUtil::getDateDirStructureFromIdentifier($identifierForDirStructure);

        // Elp file destination dir path
        $odeFilePermContentStorageDirPath = $elpDestination.$dateDirStructure;

        // Elp file path
        $elpDestinationPath = $odeFilePermContentStorageDirPath.$odeResultParameters['elpFileName'];

        // if dir already exists
        if (!file_exists($odeFilePermContentStorageDirPath)) {
            // Create dir
            if (FilePermissionsUtil::isWritable($elpDestination)) {
                $mode = 0775;
                $recursive = true;
                FileUtil::createDir($odeFilePermContentStorageDirPath, $mode, $recursive);
            }
        }

        // Copy file and then delete from source
        FileUtil::copyFile($elpSourceFilePath, $elpDestinationPath);
        FileUtil::removeFile($elpSourceFilePath);

        // Get ode Platform Id and set, then push to odeResultParameters
        if (!isset($odeResultParameters['odePlatformId'])) {
            $odePlatformId = $this->getOdePlatformIdFromLastOdeId($odeResultParameters['odeId']);
            $odeResultParameters['odePlatformId'] = $odePlatformId;
        }

        // Insert to ode_files
        $this->setOdeFile(
            $odeResultParameters,
            Constants::FILE_EXTENSION_ELP,
            $elpDestinationPath,
            $user->getUsername(),
            $isManualSave
        );

        // If it is an automatic save
        if (!$isManualSave) {
            $this->cleanAutosavedPreviousOdeFiles($odeResultParameters['odeId']);
        }

        $odeResultParameters['elpPath'] = $elpDestinationPath;

        return $odeResultParameters;
    }

    /**
     * Inserts elp data to ode_files.
     *
     * @param array  $odeResultParameters
     * @param string $filenameExt
     * @param string $elpDestinationPath
     * @param string $user
     * @param bool   $isManualSave
     */
    private function setOdeFile(
        $odeResultParameters,
        $filenameExt,
        $elpDestinationPath,
        $user,
        $isManualSave,
    ) {
        $diskFilename = $this->prepareDiskFilenameForSave($elpDestinationPath);
        $odeFilesRepository = $this->entityManager->getRepository(OdeFiles::class);
        $lastOdeFileByOdeId = $odeFilesRepository->getLastFileForOde($odeResultParameters['odeId']);
        if (!empty($lastOdeFileByOdeId)) {
            $userPropietary = $lastOdeFileByOdeId->getUser();
            // Check that last ode file is from another user
            if ($userPropietary == $user) {
                $userPropietary = null;
            }
        }
        // Create new OdeFiles
        $odeFiles = new OdeFiles();
        $odeFiles->setOdeId($odeResultParameters['odeId']);
        $odeFiles->setOdeVersionId($odeResultParameters['odeVersionId']);
        // Case platform upload
        if (isset($odeResultParameters['odePlatformId'])) {
            $odeFiles->setOdePlatformId($odeResultParameters['odePlatformId']);
        } else {
            $odeFiles->setOdePlatformId(null);
        }
        $odeFiles->setFileName($odeResultParameters['elpFileName']);
        $odeFiles->setVersionName($odeResultParameters['odeVersionName']);
        $odeFiles->setTitle($odeResultParameters['odePropertiesName']);
        $odeFiles->setFileType($filenameExt);
        $odeFiles->setDiskFilename($diskFilename);
        $odeFiles->setSize(FileUtil::getFileSize($elpDestinationPath));

        if (isset($userPropietary)) {
            $odeFiles->setUser($userPropietary);
        } else {
            $odeFiles->setUser($user);
        }

        $odeFiles->setIsManualSave($isManualSave);

        $this->entityManager->persist($odeFiles);
        $this->entityManager->flush();
    }

    /**
     * Creates elp file to dist dir.
     *
     * @param string $odeId
     * @param string $odeVersionId
     * @param string $odeSessionId
     * @param User   $user
     *
     * @return string
     */
    private function createElpOdeFilesToDist(
        $odeId,
        $odeVersionId,
        $odeSessionId,
        $user,
    ) {
        $path = $this->fileHelper->getOdeSessionDistDirForUser($odeSessionId, $user);
        $name = self::generateElpName($odeId, $odeVersionId);
        $pathname = $path.$name;

        FileUtil::zipDir($path, $pathname);

        return $name;
    }

    /**
     * Generate id for version, ode and session, then rename path with the new session.
     *
     * @param string $odeSessionId
     * @param User   $user
     *
     * @return bool|array
     */
    public function renameSessionDir($odeSessionId, $user)
    {
        $response = [];

        $odeId = Util::generateId();
        $odeVersionId = Util::generateId();
        $newSessionId = Util::generateId();

        // Get odeProperties
        $databaseOdePropertiesData = $this->getOdePropertiesFromDatabase($odeSessionId, $user);

        foreach (Properties::ODE_PROPERTIES_CONFIG as $category => $properties) {
            foreach ($properties as $odePropertiesConfigKey => $odePropertiesConfigValues) {
                if (isset($databaseOdePropertiesData[$odePropertiesConfigKey])) {
                    // Set value to property from request
                    $odeProperties = $databaseOdePropertiesData[$odePropertiesConfigKey];
                    $odeProperties->setOdeSessionId($newSessionId);
                    // Save
                    $this->entityManager->persist($odeProperties);
                    $propertiesData[$odePropertiesConfigKey] = $odeProperties;
                }
            }
        }

        $this->entityManager->flush();

        // Checks if is the last user and updates currentOdeUser
        $isLastUser = $this->currentOdeUsersService->updateLastUserOdesId(
            $user,
            $odeId,
            $odeVersionId,
            $odeSessionId,
            $newSessionId
        );

        if ($isLastUser) {
            // Update odeSessionId from OdeNavStructureSync and childs
            $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
            $odeNavStructureSyncRepo->updateOdeSessionByLastOdeSessionId($odeSessionId, $newSessionId);

            // Update OdeComponentsSync htmlView
            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);
            $odeComponentsSync = $odeComponentsSyncRepo->findBy(['odeSessionId' => $newSessionId]);

            foreach ($odeComponentsSync as $odeComponentSync) {
                $htmlView = $odeComponentSync->getHtmlView();
                $jsonProperties = $odeComponentSync->getJsonProperties();

                $newOdeSessionHtmlView = str_replace($odeSessionId, $newSessionId, $htmlView);
                $newOdeSessionJsonProperties = str_replace($odeSessionId, $newSessionId, $jsonProperties);

                $odeComponentSync->setHtmlView($newOdeSessionHtmlView);
                $odeComponentSync->setJsonProperties($newOdeSessionJsonProperties);
            }

            // Update odeSessionId from OdePropertiesSync
            $odePropertiesSyncRepo = $this->entityManager->getRepository(OdePropertiesSync::class);
            $odePropertiesSyncRepo->updateByOdeSessionId($odeSessionId, $newSessionId);

            // Get current session path and change to the new
            $sessionDirPath = $this->fileHelper->getOdeSessionDir($odeSessionId);
            $parentSessionDirPath = dirname($sessionDirPath);
            $newSessionDirPath = $parentSessionDirPath.DIRECTORY_SEPARATOR.$newSessionId;

            rename($sessionDirPath, $newSessionDirPath);

            $response['odeId'] = $odeId;
            $response['odeVersionId'] = $odeVersionId;
            $response['odeSessionId'] = $newSessionId;

            return $response;
        } else {
            return false;
        }
    }

    /**
     * Saves OdeComponents in dist dir.
     *
     * @param string $odeSessionId
     * @param User   $user
     * @param string $odeIdeviceId
     * @param string $odeBlockId
     *
     * @return array
     */
    public function saveOdeComponent($odeSessionId, $user, $odeIdeviceId, $odeBlockId)
    {
        $result = [];

        $distDirPath = $this->fileHelper->getOdeSessionDistDirForUser($odeSessionId, $user);

        $odeId = $this->currentOdeUsersService->getOdeIdByOdeSessionId($user, $odeSessionId);
        $odeVersionId = $this->currentOdeUsersService->getOdeVersionIdByOdeSessionId($user, $odeSessionId);

        if (!empty($odeVersionId)) {
            if ($distDirPath && FilePermissionsUtil::isWritable($distDirPath)) {
                // Clear previous dist dir
                FileUtil::removeDir($distDirPath);

                $fileName = Constants::PERMANENT_SAVE_CONTENT_FILENAME;

                $xmlFilePathName = $distDirPath.$fileName;

                FileUtil::createDir($distDirPath);

                $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);
                $odePagStructureSyncRepo = $this->entityManager->getRepository(OdePagStructureSync::class);

                // Get odeNavStructure from idevice or block
                if (!empty($odeIdeviceId) && 'null' !== $odeIdeviceId) {
                    $odePagStructureSync = $odePagStructureSyncRepo->findOneBy(['odeBlockId' => $odeBlockId]);
                    $odeComponentsSync = $odeComponentsSyncRepo->findBy(['odeIdeviceId' => $odeIdeviceId]);
                } else {
                    $odePagStructureSync = $odePagStructureSyncRepo->findOneBy(['odeBlockId' => $odeBlockId]);
                    $odeComponentsSync = $odeComponentsSyncRepo->findBy(['odeBlockId' => $odeBlockId]);
                }

                // Create xml
                $odeSaveDto = OdeXmlUtil::createOdeComponentsXml(
                    $odeSessionId,
                    $odePagStructureSync,
                    $odeComponentsSync
                );

                $fileWritten = $odeSaveDto->getXml()->asXML($xmlFilePathName);

                if ($fileWritten) {
                    // Copy files
                    $this->copyOdeFilesToDist(
                        $odeSessionId,
                        $odeSaveDto->getOdeComponentsMapping(),
                        $user
                    );

                    try {
                        Util::checkPhpZipExtension();

                        // Create elp file
                        $elpFileName = $this->createElpOdeFilesToDist(
                            $odeId,
                            $odeVersionId,
                            $odeSessionId,
                            $user
                        );
                        $result['elpFileName'] = $elpFileName;
                        $result['responseMessage'] = 'OK';

                        // Remove Ode files from dist dir after generating elp
                        $this->cleanOdeFilesFromDist($odeSessionId, $user);
                    } catch (PhpZipExtensionException $e) {
                        $this->logger->error(
                            $e->getDescription(),
                            [
                                'className' => $e->getClassName(),
                                'phpZipExtensionInstalled' => $e->getZipExtensionInstalled(),
                                'odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__,
                            ]
                        );

                        $result['responseMessage'] = 'error: '.$e->getDescription();
                    }
                } else {
                    $this->logger->error(
                        'xml could not be generated',
                        ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
                    );

                    $result['responseMessage'] = 'error: xml could not be generated';
                }
            } else {
                $this->logger->error(
                    'dir could not be created',
                    ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
                );

                $result['responseMessage'] = 'error: dir could not be created';
            }
        } else {
            $this->logger->error(
                'odeVersionId not found',
                ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
            );

            $result['responseMessage'] = 'error: odeVersionId not found';
        }

        return $result;
    }

    /**
     * Saves the Ode in dist dir.
     *
     * @param string $odeSessionId
     * @param User   $user
     * @param bool   $isManualSave
     * @param object $odeProperties
     * @param bool   $isSaveAs
     * @param bool   $isDownload
     * @param object $userPreferencesDtos
     *
     * @return array
     */
    public function saveOde(
        $odeSessionId,
        $user,
        $isManualSave,
        $odeProperties,
        $userPreferencesDtos,
        $isSaveAs = false,
        $isDownload = false,
    ) {
        $result = [];

        $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
        $odeNavStructureSyncs = $odeNavStructureSyncRepo->findByOdeSessionId($odeSessionId);

        $distDirPath = $this->fileHelper->getOdeSessionDistDirForUser($odeSessionId, $user);

        // Get odeVersionId from currentOdeUsers in case of save as or generate a new id
        if (!$isSaveAs) {
            $odeVersionId = Util::generateId();
        } else {
            $odeVersionId = $this->currentOdeUsersService->getOdeVersionIdByOdeSessionId($user, $odeSessionId);
        }
        $result['odeVersionId'] = $odeVersionId;

        // Update ode version id from currentUser
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser(
            $user->getUserIdentifier()
        );

        if (!empty($currentOdeSessionForUser)) {
            $currentOdeSessionForUser->setOdeVersionId($odeVersionId);
        }

        $odeId = $this->currentOdeUsersService->getOdeIdByOdeSessionId($user, $odeSessionId);
        $result['odeId'] = $odeId;

        // Check version id
        if (empty($odeVersionId)) {
            $this->logger->error(
                'odeVersionId not found',
                ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
            );
            $result['responseMessage'] = 'error: odeVersionId not found';

            return $result;
        }

        // Check that the directory can be created
        if (!$distDirPath || !FilePermissionsUtil::isWritable($distDirPath)) {
            $this->logger->error(
                'dir could not be created',
                ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
            );
            $result['responseMessage'] = 'error: dir could not be created';

            return $result;
        }

        // Clear previous dist dir
        FileUtil::removeDir($distDirPath);

        // Make dir
        FileUtil::createDir($distDirPath);

        // If it is an automatic save
        if (!$isManualSave) {
            $this->checkAutosaveOdeSave($odeId);
        }

        // Ode version name
        $odeVersionName = $this->getLastVersionNameOdeFiles($odeId);

        // Ode data
        $odeData = [
            'odeVersionId' => $odeVersionId,
            'odeId' => $odeId,
            'odeVersionName' => $odeVersionName,
            'isDownload' => $isDownload ? 'true' : 'false',
        ];

        // Ode XML structure
        $odeSaveDto = OdeXmlUtil::createOdeXml(
            $odeSessionId,
            $odeNavStructureSyncs,
            $odeProperties,
            $odeData,
            $userPreferencesDtos
        );

        $fileName = Constants::PERMANENT_SAVE_CONTENT_FILENAME;
        $xmlFilePathName = $distDirPath.$fileName;
        $fileWritten = $odeSaveDto->getXml()->asXML($xmlFilePathName);

        // Check that the content.xml file could be generated correctly
        if (!$fileWritten) {
            $this->logger->error(
                'xml could not be generated',
                ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
            );
            $result['responseMessage'] = 'error: xml could not be generated';

            return $result;
        }

        // Copy files
        $this->copyOdeFilesToDist(
            $odeSessionId,
            $odeSaveDto->getOdeComponentsMapping(),
            $user
        );

        // Check if the php zip extension is installed
        try {
            Util::checkPhpZipExtension();
        } catch (PhpZipExtensionException $e) {
            $this->logger->error(
                $e->getDescription(),
                [
                    'className' => $e->getClassName(), 'phpZipExtensionInstalled' => $e->getZipExtensionInstalled(),
                    'odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__,
                ]
            );
            $result['responseMessage'] = 'error: '.$e->getDescription();

            return $result;
        }

        // Generate elp file
        $elpFileName = $this->createElpOdeFilesToDist(
            $odeId,
            $odeVersionId,
            $odeSessionId,
            $user
        );
        $result['elpFileName'] = $elpFileName;
        $result['responseMessage'] = 'OK';

        // Remove Ode files from dist dir after generating elp
        $this->cleanOdeFilesFromDist($odeSessionId, $user);

        return $result;
    }

    /**
     * Performs checks for autosave.
     *
     * @param string $odeId
     */
    private function checkAutosaveOdeSave($odeId)
    {
        // Check if last save time is older than autosave time interval
        $odeFilesRepository = $this->entityManager->getRepository(OdeFiles::class);

        $odeFile = $odeFilesRepository->getLastFileForOde($odeId);

        $lastSaveDateTime = null;

        if (!empty($odeFile)) {
            $lastSaveDateTime = $odeFile->getCreatedAt();
        }

        $intervalDateTime = new \DateTime();
        $interval = DateUtil::getSecondsDateInterval(Settings::PERMANENT_SAVE_AUTOSAVE_TIME_INTERVAL);
        $intervalDateTime->sub($interval);

        // If there is an odeFile more recent than autosave interval don't save
        if ((!empty($lastSaveDateTime)) && ($lastSaveDateTime > $intervalDateTime)) {
            // throw new AutosaveRecentSaveException(); At the moment we avoid that it returns an error
        }
    }

    /**
     * Copies ode files to dist dir.
     *
     * @param string      $odeSessionId
     * @param array       $odeComponentsMapping
     * @param User        $user
     * @param bool|string $dirPath
     *
     * @return array
     */
    public function copyOdeFilesToDist(
        $odeSessionId,
        $odeComponentsMapping,
        $user,
        $dirPath = false,
    ) {
        if ($dirPath) {
            $distDirPath = $dirPath;
        } else {
            $distDirPath = $this->fileHelper->getOdeSessionDistDirForUser($odeSessionId, $user);
        }

        if (!FilePermissionsUtil::isWritable($distDirPath)) {
            return false;
        }

        $odeFileNameMapping = [];

        // Copy odeComponents files
        $odeFileNameMapping['odeComponents'] = $this->copyOdeComponentsFilesToDist(
            $odeSessionId,
            $distDirPath,
            $odeComponentsMapping
        );

        // Copy filemanager files
        $odeFileNameMapping['fileManager'] = $this->copyFileManagerFilesToDist(
            $odeSessionId,
            $distDirPath
        );

        // Copy css files
        $odeFileNameMapping['styles'] = $this->copyOdeContentCssFilesToDist(
            $distDirPath
        );

        return $odeFileNameMapping;
    }

    /**
     * Copies ode components files to dist dir.
     *
     * @param string $odeSessionId
     * @param string $distDirPath
     * @param array  $odeComponentsMapping
     *
     * @return array
     */
    private function copyOdeComponentsFilesToDist(
        $odeSessionId,
        $distDirPath,
        $odeComponentsMapping,
    ) {
        // Create dir structure for ode
        $dirStructureCreated = FileUtil::createDirStructureFromArray(
            $distDirPath,
            Constants::PERMANENT_SAVE_ODE_DIR_STRUCTURE
        );

        $contentResourcesDir = $distDirPath.FileUtil::getPathFromDirStructureArray(
            Constants::PERMANENT_SAVE_ODE_DIR_STRUCTURE,
            Constants::PERMANENT_SAVE_CONTENT_RESOURCES_DIRNAME
        );

        $odeComponentsFileNamesMapping = [];

        // Copy odeComponents files
        foreach ($odeComponentsMapping as $oldOdeIdeviceId => $newOdeIdeviceId) {
            // Modify the dir name format if necessary
            $ideviceDirName = $newOdeIdeviceId;
            $destinationDir = $contentResourcesDir.$ideviceDirName.DIRECTORY_SEPARATOR;

            // Create component dir
            FileUtil::createDir($destinationDir);

            $sourceDir = $this->fileHelper->getOdeComponentsSyncDir($odeSessionId, $oldOdeIdeviceId);

            // Generate an array with the equivalences between the names of the files
            $odeComponentsFileNamesMapping[$newOdeIdeviceId] = [];
            $odeComponentsFileNamesMapping[$newOdeIdeviceId]['dir'] = $ideviceDirName;
            $odeComponentsFileNamesMapping[$newOdeIdeviceId]['files'] = self::copyOdeComponentFilesToDist(
                $sourceDir,
                $destinationDir
            );
        }

        return $odeComponentsFileNamesMapping;
    }

    /**
     * Copies ode component files to dist dir.
     *
     * @param string $destinationDir
     *
     * @return array
     */
    private static function copyOdeComponentFilesToDist(
        $odeComponentFilesDir,
        $destinationDir,
    ) {
        $odeComponentFiles = FileUtil::listFilesByParentFolder($odeComponentFilesDir);

        $odeComponentsFileNameMapping = [];

        foreach ($odeComponentFiles as $odeComponentFile) {
            // Source file
            $sourceFile = $odeComponentFilesDir.DIRECTORY_SEPARATOR.$odeComponentFile;

            // Destination file
            $destinationFile = $destinationDir.DIRECTORY_SEPARATOR.$odeComponentFile;
            FileUtil::copyFile($sourceFile, $destinationFile);
        }

        return $odeComponentsFileNameMapping;
    }

    /**
     * Copies ode filemanager files to dist dir.
     *
     * @param string $odeSessionId
     * @param string $distDirPath
     */
    private function copyFileManagerFilesToDist($odeSessionId, $distDirPath)
    {
        $sourceDir = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);
        $destinationDir = $distDirPath.Constants::PERMANENT_SAVE_CUSTOM_FILES_DIRNAME.DIRECTORY_SEPARATOR;

        $dirCopied = FileUtil::copyDir($sourceDir, $destinationDir);

        if (!$dirCopied) {
            return false;
        }

        $fileManagerFileNamesMapping = [];
        $dirsNameMapping = [];

        $filesCopied = FileUtil::listAllFilesByParentFolder($destinationDir);

        return [];
    }

    /**
     * Copies css files to dist dir.
     *
     * @param string $distDirPath
     */
    private function copyOdeContentCssFilesToDist(
        $distDirPath,
    ) {
        $styleWorkareaSourceDir = $this->fileHelper->getStyleWorkareaDir();

        $cssFilesMapping = [];

        $contentCssDir = FileUtil::getPathFromDirStructureArray(
            Constants::PERMANENT_SAVE_ODE_DIR_STRUCTURE,
            Constants::PERMANENT_SAVE_CONTENT_CSS_DIRNAME
        );

        // base.css
        $sourceDirCss = $styleWorkareaSourceDir.Constants::WORKAREA_STYLE_BASE_CSS_FILENAME;
        $destDirCss = $distDirPath.$contentCssDir.Constants::WORKAREA_STYLE_BASE_CSS_FILENAME;
        $fileCssCopied = FileUtil::copyFile($sourceDirCss, $destDirCss);

        // icons
        $styleImagesDirname = Constants::STYLE_IMAGES_DIR_NAME;
        $iconsDirName = Constants::PERMANENT_SAVE_CONTENT_RESOURCES_ICONS_DIRNAME;
        $sourceDirIcons = $styleWorkareaSourceDir.$styleImagesDirname.DIRECTORY_SEPARATOR.$iconsDirName;
        $destDirIcons = $distDirPath.$contentCssDir.Constants::PERMANENT_SAVE_CONTENT_RESOURCES_ICONS_DIRNAME;
        $dirIconsCopied = FileUtil::copyDir($sourceDirIcons, $destDirIcons);

        return $cssFilesMapping;
    }

    /**
     * Categorizes ode files according to its mime type.
     *
     * @return string
     */
    private static function categorizeOdeFile($filePathName)
    {
        $mimeType = FileUtil::getFileMimeType($filePathName);

        switch (true) {
            case (0 === strpos($mimeType, 'application')) || (0 === strpos($mimeType, 'text')):
                $type = Constants::PERMANENT_SAVE_CONTENT_RESOURCES_DOCUMENTS_DIRNAME;
                break;

            case (0 === strpos($mimeType, 'video')) || (0 === strpos($mimeType, 'audio')):
                $type = Constants::PERMANENT_SAVE_CONTENT_RESOURCES_MEDIA_DIRNAME;
                break;

            case 0 === strpos($mimeType, 'image'):
                $type = Constants::PERMANENT_SAVE_CONTENT_RESOURCES_IMG_DIRNAME;
                break;

            default:
                $type = Constants::PERMANENT_SAVE_CONTENT_RESOURCES_DOCUMENTS_DIRNAME;
                break;
        }

        return $type;
    }

    /**
     * Creates elp filename.
     *
     * @param string $odeId
     * @param string $odeVersionId
     *
     * @return string
     */
    private static function generateElpName($odeId, $odeVersionId)
    {
        $name = $odeId.Constants::ELP_NAME_SEPARATOR.$odeVersionId.
            Constants::FILE_EXTENSION_SEPARATOR.Constants::FILE_EXTENSION_ELP;

        return $name;
    }

    /**
     * Prepares odeFiles diskFileName to save in database.
     *
     * @param string $diskFilename
     *
     * @return string
     */
    private function prepareDiskFilenameForSave($diskFilename)
    {
        $result = str_replace(
            $this->fileHelper->getFilesDir(),
            OdeFiles::ODE_FILES_FILES_DIR.DIRECTORY_SEPARATOR,
            $diskFilename
        );

        return $result;
    }

    /**
     * Removes Ode files from dist dir after generating elp
     * (Remove all directories, not the .elp file).
     *
     * @param string $odeSessionId
     * @param User   $user
     */
    public function cleanOdeFilesFromDist($odeSessionId, $user)
    {
        $distDirPath = $this->fileHelper->getOdeSessionDistDirForUser($odeSessionId, $user);

        // Remove subdirs
        $subdirs = FileUtil::listSubdirs($distDirPath);

        foreach ($subdirs as $subdir) {
            FileUtil::removeDir($distDirPath.$subdir);
        }

        // Remove content file
        FileUtil::removeFile($distDirPath.Constants::PERMANENT_SAVE_CONTENT_FILENAME);
    }

    /**
     * Cleans autosaved odeFiles previous to number of files to maintain
     * (Settings::PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES).
     *
     * @param string $odeId
     */
    private function cleanAutosavedPreviousOdeFiles($odeId)
    {
        $odeFilesRepository = $this->entityManager->getRepository(OdeFiles::class);

        $autosavedOdeFilesToClean = $odeFilesRepository->findAutosavedFilesToCleanByMaxNumberOfFiles(
            $odeId,
            Settings::PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES
        );

        foreach ($autosavedOdeFilesToClean as $autosavedOdeFileToClean) {
            $this->removeElpFromServer($autosavedOdeFileToClean);
        }
    }

    /**
     * Cleans autosaved odeFiles previous to number autosavedSessionOdeFilesToMaintain.
     *
     * @param string $odeId
     * @param int    $autosavedSessionOdeFilesToMaintain
     */
    private function cleanAutosavedSessionOdeFiles($odeId, $autosavedSessionOdeFilesToMaintain)
    {
        $odeFilesRepository = $this->entityManager->getRepository(OdeFiles::class);

        $autosavedOdeFilesToClean = $odeFilesRepository->findAutosavedFilesToCleanByMaxNumberOfFiles(
            $odeId,
            $autosavedSessionOdeFilesToMaintain
        );

        foreach ($autosavedOdeFilesToClean as $autosavedOdeFileToClean) {
            $this->removeElpFromServer($autosavedOdeFileToClean);
        }
    }

    /**
     * Cleans autosaved odeFiles previous to number autosavedSessionOdeFilesToMaintain.
     *
     * @param int $autosavedSessionOdeFilesToMaintain
     */
    private function cleanAutosavedOdeFilesByUser($userName, $autosavedSessionOdeFilesToMaintain)
    {
        $odeFilesRepository = $this->entityManager->getRepository(OdeFiles::class);

        $autosavedOdeFilesToClean = $odeFilesRepository->findUserAutosavedFilesToCleanByMaxNumberOfFiles(
            $userName,
            $autosavedSessionOdeFilesToMaintain
        );

        foreach ($autosavedOdeFilesToClean as $autosavedOdeFileToClean) {
            $this->removeElpFromServer($autosavedOdeFileToClean);
        }
    }

    /**
     * Checks if the user has enough space to save the current Elp.
     *
     * @param User   $user
     * @param string $odeId
     * @param string $currentElpDirPath
     * @param string $currentElpFileName
     * @param bool   $isManualSave
     *
     * @return bool
     *
     * @throws UserInsufficientSpaceException
     */
    private function checkUserUsedSpace($user, $odeId, $currentElpDirPath, $currentElpFileName, $isManualSave)
    {
        $odeFilesRepository = $this->entityManager->getRepository(OdeFiles::class);

        $onlyManualSave = !Settings::COUNT_USER_AUTOSAVE_SPACE_ODE_FILES;

        $userOdeFiles = $odeFilesRepository->listOdeFilesByUser($user->getUsername(), $onlyManualSave);

        // If its autosave previous OdeFiles will be cleaned
        if (!$isManualSave) {
            $maxNumberOfFiles = Settings::PERMANENT_SAVE_AUTOSAVE_MAX_NUMBER_OF_FILES;

            // Discard another OdeFile because current Elp will be added
            if ($maxNumberOfFiles >= 1) {
                --$maxNumberOfFiles;
            }

            // Get OdeFiles
            $autosavedOdeFilesToClean = $odeFilesRepository->findAutosavedFilesToCleanByMaxNumberOfFiles(
                $odeId,
                $maxNumberOfFiles
            );

            if (!empty($autosavedOdeFilesToClean)) {
                $userOdeFilesIdsToClean = [];

                foreach ($autosavedOdeFilesToClean as $userOdeFileToClean) {
                    $userOdeFilesIdsToClean[$userOdeFileToClean->getId()] = true;
                }

                // OdeFiles that will be cleaned don't count in user space
                foreach ($userOdeFiles as $key => $userOdeFile) {
                    if (isset($userOdeFilesIdsToClean[$userOdeFile->getId()])) {
                        unset($userOdeFiles[$key]);
                    }
                }
            }
        }

        // Get user OdeFiles used space
        $odeFilesDiskSpace = FileUtil::getOdeFilesDiskSpace(
            $userOdeFiles,
            Settings::COUNT_USER_AUTOSAVE_SPACE_ODE_FILES
        );

        // Add current elp size
        $currentElp = $currentElpDirPath.$currentElpFileName;
        $currentElpSize = 0;

        // If it's manual save or is autosave and autosaved files count on the user
        //  storage quota count current Elp size
        if ($isManualSave || ((!$isManualSave) && Settings::COUNT_USER_AUTOSAVE_SPACE_ODE_FILES)) {
            $currentElpSize = FileUtil::getFileSize($currentElp);
        }

        // Total used space by user after saving current Elp
        $userUsedSpace = $odeFilesDiskSpace['usedSpace'] + $currentElpSize;

        if ($userUsedSpace > SettingsUtil::getUserStorageMaxDiskSpaceInBytes()) {
            throw new UserInsufficientSpaceException();
        }

        return true;
    }

    /**
     * Closes the ode session.
     *
     * @param string $odeSessionId
     * @param int    $autosavedSessionOdeFilesToMaintain
     * @param User   $user
     *
     * @return array
     */
    public function closeOdeSession($odeSessionId, $autosavedSessionOdeFilesToMaintain, $user)
    {
        $result = [];

        // if $odeSessionId is set load data from database
        if (!empty($odeSessionId)) {
            $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);

            // Check if there are other CurrentOdeUsers editing the content
            $isLastUser = $this->currentOdeUsersService->isLastUser($user, null, null, $odeSessionId);

            $odeNavStructureSyncsDeleted = 0;

            // If there aren't other users close ode Session
            if ($isLastUser) {
                $odeId = $this->currentOdeUsersService->getOdeIdByOdeSessionId($user, $odeSessionId);

                if (empty($odeId)) {
                    $this->logger->error(
                        'odeId not found',
                        [
                            'odeSessionId' => $odeSessionId, 'user' => $user->getUsername(),
                            'file:' => $this, 'line' => __LINE__,
                        ]
                    );
                }

                $odeSessionDirPath = $this->fileHelper->getOdeSessionDir($odeSessionId);

                try {
                    $dirRemoved = FileUtil::removeDir($odeSessionDirPath);

                    if (!$dirRemoved) {
                        $this->logger->error(
                            'dir cannot be removed',
                            ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
                        );
                    }
                } catch (\Exception $e) {
                    $this->logger->error(
                        'dir cannot be removed: '.$e->getMessage(),
                        [
                            'file' => $e->getFile(), 'line' => $e->getLine(),
                            'odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__,
                        ]
                    );
                }

                $odeNavStructureSyncsDeleted = $odeNavStructureSyncRepo->removeByOdeSessionId($odeSessionId);

                // Clean autosaved OdeFiles
                if (!empty($odeId)) {
                    $this->cleanAutosavedSessionOdeFiles($odeId, $autosavedSessionOdeFilesToMaintain);
                }
            }

            // Delete from CurrentOdeUsers
            $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
            $currentOdeUsersDeleted = $currentOdeUsersRepository->removeByOdeSessionIdAndUser(
                $odeSessionId,
                $user->getUserIdentifier()
            );

            if (1 == $currentOdeUsersDeleted) {
                $result['responseMessage'] = 'OK';
            } elseif (0 == $currentOdeUsersDeleted) {
                $result['responseMessage'] = 'notice: the session isn\'t active for the user';
            } else {
                $this->logger->error(
                    'invalid active session',
                    ['currentOdeUsersDeleted' => $currentOdeUsersDeleted, 'file:' => $this, 'line' => __LINE__]
                );

                $result['responseMessage'] = 'error: invalid active session';
            }

            // Delete from odeProperties
            $odePropertiesRepository = $this->entityManager->getRepository(OdePropertiesSync::class);
            $odePropertiesDeleted = $odePropertiesRepository->removeByOdeSessionId($odeSessionId);

            $result['odeNavStructureSyncsDeleted'] = $odeNavStructureSyncsDeleted;
            $result['currentOdeUsersDeleted'] = $currentOdeUsersDeleted;
            $result['odePropertiesDeleted'] = $odePropertiesDeleted;
        } else {
            $this->logger->error(
                'invalid data',
                ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
            );

            $result['responseMessage'] = 'error: invalid data';
        }

        return $result;
    }

    /**
     * Removes autosaves by the user.
     *
     * @param string $odeSessionId
     * @param int    $autosavedSessionOdeFilesToMaintain
     * @param User   $user
     *
     * @return array
     */
    public function cleanAutosavesByUser($odeSessionId, $autosavedSessionOdeFilesToMaintain, $user)
    {
        $result = [];

        // if $odeSessionId is set load data from database
        if (!empty($odeSessionId)) {
            // User name
            $userLoggedName = $user->getEmail();

            // Check if there are other CurrentOdeUsers editing the content
            $isLastUser = $this->currentOdeUsersService->isLastUser($user, null, null, $odeSessionId);

            // If there aren't other users close ode Session
            if ($isLastUser) {
                // Clean autosaved OdeFiles
                if (!empty($userLoggedName)) {
                    $this->cleanAutosavedOdeFilesByUser($userLoggedName, $autosavedSessionOdeFilesToMaintain);
                    $result['responseMessage'] = 'OK';
                }
            }
        } else {
            $this->logger->error(
                'invalid data',
                ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
            );

            $result['responseMessage'] = 'error: invalid data';
        }

        return $result;
    }

    /**
     * Set ode platform id to the elp file on perm.
     *
     * @param string $elpFileName
     * @param string $odePlatformId
     */
    public function setOdePlatformId($elpFileName, $odePlatformId)
    {
        $odeFilesRepo = $this->entityManager->getRepository(OdeFiles::class);

        $odeFile = $odeFilesRepo->findByFileName($elpFileName);

        $odeFile->setOdePlatformId($odePlatformId);

        $this->entityManager->persist($odeFile);
        $this->entityManager->flush();
    }

    /**
     * Check if the file exist to close the session.
     *
     * @param string $elpFileName
     *
     * @return array
     */
    private function checkElpFile($elpFileName)
    {
        $result = [];

        $result['elpExist'] = false;

        // if $elpFileName is set load file
        if (!empty($elpFileName)) {
            $odeFilesRepo = $this->entityManager->getRepository(OdeFiles::class);

            $odeFile = $odeFilesRepo->findByFileName($elpFileName);

            if (!empty($odeFile)) {
                $elpFilePathName = $odeFile->getDiskFilenameWithFilesDir($this->fileHelper->getFilesDir());

                if (!empty($elpFilePathName)) {
                    if (file_exists($elpFilePathName)) {
                        $result['elpFilePathName'] = $elpFilePathName;
                        $result['elpExist'] = true;
                    } else {
                        $this->logger->error(
                            'elp file doesn\'t exist',
                            ['elpFilePathName' => $elpFilePathName, 'file:' => $this, 'line' => __LINE__]
                        );

                        $result['responseMessage'] = 'error: elp file doesn\'t exist';
                    }
                } else {
                    $this->logger->error(
                        'elpFilePathName could not be obtained',
                        ['elpFilePathName' => $elpFilePathName, 'file:' => $this, 'line' => __LINE__]
                    );

                    $result['responseMessage'] = 'error: elpFilePathName could not be obtained';
                }
            } else {
                $this->logger->error(
                    'odeFile file not found',
                    ['elpFileName' => $elpFileName, 'file:' => $this, 'line' => __LINE__]
                );

                $result['responseMessage'] = 'error: odeFile file not found';
            }
        } else {
            $this->logger->error(
                'invalid data',
                ['elpFileName' => $elpFileName, 'file:' => $this, 'line' => __LINE__]
            );

            $result['responseMessage'] = 'error: invalid data';
        }

        return $result;
    }

    /**
     * check if the user is in the current session.
     *
     * @param User $user
     * @param bool $forceCloseOdeUserPreviousSession
     */
    private function checkSessionCurrentUser($user, $forceCloseOdeUserPreviousSession, bool $allowParallelSessions = false)
    {
        if ($allowParallelSessions) {
            return;
        }

        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);

        // Check if user has already an open session
        $currentSessionsForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUserIdentifier());
        if (!empty($currentSessionsForUser) && !$forceCloseOdeUserPreviousSession) {
            throw new UserAlreadyOpenSessionException();
        }
    }

    /**
     *  Try to open an elp file.
     *
     * @param string $newOdeSessionId
     * @param string $elpFileName
     * @param array  $checkElpFile
     *
     * @return array
     */
    private function openElp($newOdeSessionId, $elpFileName, $odeSessionDistDirPath, $checkElpFile)
    {
        $isImportIdevices = false;
        $destinationFilePathName = $odeSessionDistDirPath.$elpFileName;
        $elpCopied = FileUtil::copyFile($checkElpFile['elpFilePathName'], $destinationFilePathName);

        try {
            Util::checkPhpZipExtension();
            FileUtil::extractZipTo($destinationFilePathName, $odeSessionDistDirPath);
        } catch (PhpZipExtensionException $e) {
            $this->logger->error(
                $e->getDescription(),
                [
                    'className' => $e->getClassName(), 'phpZipExtensionInstalled' => $e->getZipExtensionInstalled(),
                    'elpFileName' => $elpFileName, 'file:' => $this, 'line' => __LINE__,
                ]
            );
            $result['responseMessage'] = 'error: '.$e->getDescription();

            return $result;
        }

        $fileName = Constants::PERMANENT_SAVE_CONTENT_FILENAME;
        $xmlFilePathName = $odeSessionDistDirPath.$fileName;
        $elpContentFileContent = FileUtil::getFileContent($xmlFilePathName);

        try {
            $odeResponse = OdeXmlUtil::readOdeXml($newOdeSessionId, $elpContentFileContent);

            // Just after reading/parsing the XML and before usar odeResponse
            // Ensure these entries are always arrays
            $odeResponse['odeResources'] = isset($odeResponse['odeResources']) && is_array($odeResponse['odeResources'])
                ? $odeResponse['odeResources'] : [];
            $odeResponse['userPreferences'] = isset($odeResponse['userPreferences']) && is_array($odeResponse['userPreferences'])
                ? $odeResponse['userPreferences'] : [];

            // In case the elp does not have data, we generate it
            if (empty($odeResponse['odeResources'])) {
                $odeResponse['odeVersionId'] = Util::generateId();
                $odeResponse['odeId'] = Util::generateId();
                $odeResponse['odeVersionName'] = 0;
            }

            if (!$isImportIdevices) {
                // Populate odeResources into flat entries
                foreach ($odeResponse['odeResources'] as $odeResource) {
                    /* @var SimpleXMLElement $odeResource */
                    $key = (string) $odeResource->getKey();
                    $value = (string) $odeResource->getValue();
                    $odeResponse[$key] = $value;
                }

                // Populate userPreferences into flat entries
                foreach ($odeResponse['userPreferences'] as $preference) {
                    /* @var SimpleXMLElement $preference */
                    $key = (string) $preference->getKey();
                    $value = (string) $preference->getValue();
                    $odeResponse[$key] = $value;
                }
            }

            // Copy odeComponents files
            $this->copyOdeComponentsFilesToSession($newOdeSessionId, $odeSessionDistDirPath);

            // Copy custom files
            $this->copyFileManagerFilesToSession($newOdeSessionId, $odeSessionDistDirPath);

            // Clear dist dir
            FileUtil::removeDir($odeSessionDistDirPath);

            return $odeResponse;
        } catch (\Exception $e) {
            $this->logger->error(
                'error processing xml: '.$e->getMessage(),
                [
                    'file' => $e->getFile(), 'line' => $e->getLine(),
                    'odeSessionId' => $newOdeSessionId, 'file:' => $this, 'line' => __LINE__,
                ]
            );
        }
    }

    /**
     *  Try to open a zip file and check if is editable.
     *
     * @param string $zipFileName
     * @param array  $checkElpFile
     *
     * @return array
     */
    private function openZip($zipFileName, $odeSessionDistDirPath, $checkElpFile)
    {
        $destinationFilePathName = $odeSessionDistDirPath.$zipFileName;
        $zipCopied = FileUtil::copyFile($checkElpFile, $destinationFilePathName);

        try {
            $zipExtensionInstalled = Util::checkPhpZipExtension();

            if (!$zipExtensionInstalled) {
                $this->logger->error(
                    'zip extension is not installed',
                    ['$zipFileName' => $zipFileName, 'file:' => $this, 'line' => __LINE__]
                );

                $result['responseMessage'] = 'error: zip extension is not installed';

                return $result;
            }

            FileUtil::extractZipTo($destinationFilePathName, $odeSessionDistDirPath);
        } catch (PhpZipExtensionException $e) {
            $this->logger->error(
                $e->getDescription(),
                [
                    'className' => $e->getClassName(),
                    'phpZipExtensionInstalled' => $e->getZipExtensionInstalled(),
                    'scormFileName' => $zipFileName, 'file:' => $this, 'line' => __LINE__,
                ]
            );

            $result['responseMessage'] = 'error: '.$e->getDescription();

            return $result;
        }

        // First check content.xml
        $xmlFileName = Constants::PERMANENT_SAVE_CONTENT_FILENAME;
        $xmlFilePathName = $odeSessionDistDirPath.$xmlFileName;
        $isOdeXml = file_exists($xmlFilePathName);

        if ($isOdeXml) {
            $odeResponse['elpName'] = $zipFileName;
            $odeResponse['elpPath'] = $destinationFilePathName;
            $odeResponse['responseMessage'] = 'OK';

            return $odeResponse;
        } else {
            // Else check contentv3.xml
            $xmlFileName = Constants::OLD_PERMANENT_SAVE_CONTENT_FILENAME_V3;
            $xmlFilePathName = $odeSessionDistDirPath.$xmlFileName;
            $isOdeXml = file_exists($xmlFilePathName);

            if ($isOdeXml) {
                $odeResponse['elpName'] = $zipFileName;
                $odeResponse['elpPath'] = $destinationFilePathName;
                $odeResponse['responseMessage'] = 'OK';

                return $odeResponse;
            }
        }

        // Check content.elp
        $elpFileName = false;

        $zipFilesList = scandir($odeSessionDistDirPath);
        foreach ($zipFilesList as $file) {
            if (Constants::FILE_EXTENSION_ELP == pathinfo($file, PATHINFO_EXTENSION)) {
                $elpFileName = $file;
                break;
            }
        }

        if ($elpFileName) {
            $elpFilePathName = $odeSessionDistDirPath.$elpFileName;
            $isZipEditable = file_exists($elpFilePathName);

            if ($isZipEditable) {
                $odeResponse['elpName'] = $elpFileName;
                $odeResponse['elpPath'] = $elpFilePathName;
                $odeResponse['responseMessage'] = 'OK';
            } else {
                $odeResponse['responseMessage'] = $this->translator->trans('There was a problem opening the file');
            }
        } else {
            $text = $this->translator->trans('the zip does not have the necessary files to be uploaded as a package');
            $odeResponse['responseMessage'] = $text;
        }

        return $odeResponse;
    }

    /**
     * Try to open a local elp file.
     *
     * @param string $newOdeSessionId
     * @param string $elpFileName
     * @param string $elpFilePath
     *
     * @return array
     */
    private function openLocalElp(
        $newOdeSessionId,
        $elpFileName,
        $elpFilePath,
        $odeSessionDistDirPath,
        $isImportIdevices,
        $odeNavStructureSync,
    ) {
        $destinationFilePathName = $odeSessionDistDirPath.$elpFileName;
        FileUtil::copyFile($elpFilePath, $destinationFilePathName);

        try {
            Util::checkPhpZipExtension();
            FileUtil::extractZipTo($destinationFilePathName, $odeSessionDistDirPath);
        } catch (PhpZipExtensionException $e) {
            $this->logger->error(
                $e->getDescription(),
                [
                    'className' => $e->getClassName(),
                    'phpZipExtensionInstalled' => $e->getZipExtensionInstalled(),
                    'elpFileName' => $elpFileName, 'file:' => $this, 'line' => __LINE__,
                ]
            );

            $result['responseMessage'] = 'error: '.$e->getDescription();

            return $result;
        }

        $fileName = Constants::PERMANENT_SAVE_CONTENT_FILENAME;
        $xmlFilePathName = $odeSessionDistDirPath.$fileName;

        // Check if it's new xml or an old version of xml
        $isNewOdeXml = file_exists($xmlFilePathName);
        if (!$isNewOdeXml) {
            $fileName = Constants::OLD_PERMANENT_SAVE_CONTENT_FILENAME_V3;
            $xmlFilePathName = $odeSessionDistDirPath.$fileName;
            // Check if exist file v3
            $isOldOdeXml3 = file_exists($xmlFilePathName);
            // Case not exist, catch file v2
            if (!$isOldOdeXml3) {
                $fileName = Constants::OLD_PERMANENT_SAVE_CONTENT_FILENAME_V2;
                $xmlFilePathName = $odeSessionDistDirPath.$fileName;
            }
        }

        $elpContentFileContent = FileUtil::getFileContent($xmlFilePathName);

        $odeResponse = [];

        try {
            // Read XML
            if (!$isNewOdeXml) {
                $odeResponse = OdeXmlUtil::readOldExeXml($newOdeSessionId, $elpContentFileContent, $this->translator);
            } else {
                if (!$isImportIdevices) {
                    $odeResponse = OdeXmlUtil::readOdeXml($newOdeSessionId, $elpContentFileContent);

                    // Check if the ode has style theme directory
                    $themeDirPath = $odeSessionDistDirPath.Constants::EXPORT_DIR_THEME;
                    if (is_dir($themeDirPath)) {
                        $odeResponse['themeDir'] = true;
                        $themePath = $themeDirPath.DIRECTORY_SEPARATOR.'config.xml';
                        $isInstallable = $this->fileHelper->xmlKeyValue($themePath, Constants::THEME_INSTALLABLE);
                        if ($isInstallable) {
                            $odeResponse['themeInstallable'] = true;
                        } else {
                            $odeResponse['themeInstallable'] = false;
                        }

                        // Copy theme dir to new session dir
                        $this->copyThemeFilesToSession($newOdeSessionId, $odeSessionDistDirPath);
                    }
                } else {
                    $odeResponse = OdeXmlUtil::readOdeComponentsXml(
                        $newOdeSessionId,
                        $odeNavStructureSync,
                        $elpContentFileContent
                    );

                    // Check xml paramater to verify that is an idevice elp
                    if (!isset($odeResponse['odeResources'])) {
                        $result['responseMessage'] = "error: elp content isn't correct";

                        return $result;
                    } else {
                        // Get value of "odeComponentsResources" to verify
                        foreach ($odeResponse['odeResources'] as $odeResource) {
                            $key = (string) $odeResource->getKey();
                            $value = (string) $odeResource->getValue();
                            $odeResponse[$key] = $value;
                        }
                        if (
                            !isset($odeResponse['odeComponentsResources'])
                            || 'true' == !$odeResponse['odeComponentsResources']
                        ) {
                            $result['responseMessage'] = "error: elp content isn't correct";

                            return $result;
                        }
                    }
                }
            }

            if (empty($odeResponse['odeResources']) && !$isImportIdevices) {
                $odeResponse['odeVersionId'] = Util::generateId();
                $odeResponse['odeId'] = Util::generateId();
                $odeResponse['odeVersionName'] = 0;
            }

            if (!$isImportIdevices) {
                // Get odeResources data
                foreach ($odeResponse['odeResources'] as $odeResource) {
                    $key = (string) $odeResource->getKey();
                    $value = (string) $odeResource->getValue();
                    $odeResponse[$key] = $value;
                }
                // Get userPreferences
                foreach ($odeResponse['userPreferences'] as $odeResource) {
                    $key = (string) $odeResource->getKey();
                    $value = (string) $odeResource->getValue();
                    $odeResponse[$key] = $value;
                }
            }

            // If is a local file generate a new ode id
            if (isset($odeResponse['isDownload']) && 'true' == $odeResponse['isDownload']) {
                $odeResponse['odeVersionId'] = Util::generateId();
                $odeResponse['odeId'] = Util::generateId();
                $odeResponse['odeVersionName'] = 0;
            }

            // Send newOdeComponentsId in case of idevices elp
            if ($isImportIdevices) {
                // Copy odeComponents files
                $this->copyOdeComponentsFilesToSession(
                    $newOdeSessionId,
                    $odeSessionDistDirPath,
                    $odeResponse['odeComponentsMapping']
                );
            } else {
                if (!$isNewOdeXml) {
                    // Copy odeComponents files
                    $this->copyOldResourcesFilesToSession(
                        $newOdeSessionId,
                        $odeSessionDistDirPath,
                        $odeResponse['srcRoutes'],
                        $odeResponse['odeComponentsMapping']
                    );
                } else {
                    // Copy odeComponents files
                    $this->copyOdeComponentsFilesToSession($newOdeSessionId, $odeSessionDistDirPath);
                }
            }

            // Copy file manager files in case of actual elp
            if ($isNewOdeXml) {
                // Copy custom files
                $this->copyFileManagerFilesToSession($newOdeSessionId, $odeSessionDistDirPath);
            }

            // Clear dist dir
            FileUtil::removeDir($odeSessionDistDirPath);

            return $odeResponse;
        } catch (\Exception $e) {
            $this->logger->error(
                'error processing xml: '.$e->getMessage(),
                [
                    'file' => $e->getFile(), 'line' => $e->getLine(),
                    'odeSessionId' => $newOdeSessionId, 'file:' => $this, 'line' => __LINE__,
                ]
            );
            if (((Constants::OLD_PERMANENT_SAVE_CONTENT_FILENAME_V2 == $fileName) || (Constants::OLD_PERMANENT_SAVE_CONTENT_FILENAME_V3 == $fileName))
              && ('String could not be parsed as XML' == $e->getMessage())) {
                $result['responseMessage'] = $this->translator->trans('Failed to read the XML content, please open the file in eXeLearning 2.9, save and try to open it here again. Please report if it fails. Thank you.');

                return $result;
            }
        }
    }

    /**
     * Try to open a local elp file for multiple load.
     *
     * @param string              $newOdeSessionId
     * @param string              $elpFileName
     * @param string              $elpFilePath
     * @param string              $odeSessionDistDirPath
     * @param OdeNavStructureSync $odeNavStructureSync
     *
     * @return array|bool
     */
    private function openMultipleLocalElp(
        $newOdeSessionId,
        $elpFileName,
        $elpFilePath,
        $odeSessionDistDirPath,
        $odeNavStructureSync = null,
    ) {
        $destinationFilePathName = $odeSessionDistDirPath.$elpFileName;
        FileUtil::copyFile($elpFilePath, $destinationFilePathName);

        // Check php zip extension
        try {
            Util::checkPhpZipExtension();
            FileUtil::extractZipTo($destinationFilePathName, $odeSessionDistDirPath);
        } catch (PhpZipExtensionException $e) {
            $this->logger->error(
                $e->getDescription(),
                [
                    'className' => $e->getClassName(), 'phpZipExtensionInstalled' => $e->getZipExtensionInstalled(),
                    'elpFileName' => $elpFileName, 'file:' => $this, 'line' => __LINE__,
                ]
            );

            return false;
        }

        $fileName = Constants::PERMANENT_SAVE_CONTENT_FILENAME;
        $xmlFilePathName = $odeSessionDistDirPath.$fileName;
        $elpContentFileContent = FileUtil::getFileContent($xmlFilePathName);

        try {
            // Read ode XML
            $odeResponse = OdeXmlUtil::readMultipleOdeXml(
                $newOdeSessionId,
                $elpContentFileContent,
                $odeNavStructureSync
            );

            // Copy odeComponents files with differents ids
            $this->copyOdeComponentsFilesToSession(
                $newOdeSessionId,
                $odeSessionDistDirPath,
                $odeResponse['odeComponentsMapping']
            );

            // Copy custom files
            $this->copyFileManagerFilesToSession($newOdeSessionId, $odeSessionDistDirPath);

            // Clear dist dir
            FileUtil::removeDir($odeSessionDistDirPath);

            return $odeResponse;
        } catch (\Exception $e) {
            $this->logger->error(
                'error processing xml: '.$e->getMessage(),
                [
                    'file' => $e->getFile(), 'line' => $e->getLine(), 'odeSessionId' => $newOdeSessionId,
                    'file:' => $this, 'line' => __LINE__,
                ]
            );

            return false;
        }
    }

    /**
     * Try to open a local elp file for multiple load.
     *
     * @param string              $newOdeSessionId
     * @param string              $elpFileName
     * @param string              $elpFilePath
     * @param string              $odeSessionDistDirPath
     * @param OdeNavStructureSync $odeNavStructureSync
     *
     * @return array|bool
     */
    private function opeLocalXmlProperties(
        $newOdeSessionId,
        $elpFileName,
        $elpFilePath,
        $odeSessionDistDirPath,
        $odeNavStructureSync = null,
    ) {
        $destinationFilePathName = $odeSessionDistDirPath.$elpFileName;
        FileUtil::copyFile($elpFilePath, $destinationFilePathName);

        $fileName = $elpFileName;
        $xmlFilePathName = $odeSessionDistDirPath.$fileName;
        $elpContentFileContent = FileUtil::getFileContent($xmlFilePathName);

        try {
            // Read ode XML
            $odeResponse = OdeXmlUtil::readPropertiesXml(
                $newOdeSessionId,
                $elpContentFileContent
            );

            // Clear dist dir
            FileUtil::removeDir($odeSessionDistDirPath);
            // Delete file from tmp folder
            FileUtil::removeFile($elpFilePath);

            return $odeResponse;
        } catch (\Exception $e) {
            $this->logger->error(
                'error processing xml: '.$e->getMessage(),
                [
                    'file' => $e->getFile(), 'line' => $e->getLine(), 'odeSessionId' => $newOdeSessionId,
                    'file:' => $this, 'line' => __LINE__,
                ]
            );

            return false;
        }
    }

    /**
     * Check necessary content on the local xml.
     *
     * @param string $elpFileName
     * @param string $elpFilePath
     * @param User   $user
     * @param bool   $forceCloseOdeUserPreviousSession
     *
     * @return array
     */
    public function checkLocalOdeFile(
        $elpFileName,
        $elpFilePath,
        $user,
        $forceCloseOdeUserPreviousSession,
        $isImportIdevices = false,
        $odeNavStructureSync = null,
        bool $allowParallelSessions = false,
    ) {
        $result = [];

        if (empty($elpFilePath)) {
            $result['responseMessage'] = $this->translator->trans('There was a problem retrieving the data of the file');

            return $result;
        }

        // Check extension
        $ext = pathinfo($elpFileName, PATHINFO_EXTENSION);
        if (!in_array($ext, Constants::ELP_LOCAL_FILES_AVAILABLE_EXTS)) {
            $result['responseMessage'] = $this->translator->trans('File extension incorrect');

            return $result;
        }

        // Check if the user is in the session (throw exception)
        $this->checkSessionCurrentUser(
            $user,
            $forceCloseOdeUserPreviousSession,
            $allowParallelSessions
        );

        // Don't create new session in component elp
        if (!$isImportIdevices) {
            // Generate new odeSessionId
            $newOdeSessionId = Util::generateId();
        } else {
            // Get currentOdeUser
            $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
            $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());
            $newOdeSessionId = $currentSessionForUser->getOdeSessionId();
        }

        // Create dist dir
        $odeSessionDistDirPath = $this->fileHelper->getOdeSessionDistDirForUser($newOdeSessionId, $user);

        $result = $this->openLocalElp(
            $newOdeSessionId,
            $elpFileName,
            $elpFilePath,
            $odeSessionDistDirPath,
            $isImportIdevices,
            $odeNavStructureSync
        );

        if (empty($result)) {
            $result['responseMessage'] = $this->translator->trans('There was a problem opening file');

            return $result;
        }

        if (isset($result['responseMessage'])) {
            return $result;
        }

        $result['odeSessionId'] = $newOdeSessionId;
        $result['responseMessage'] = 'OK';

        return $result;
    }

    /**
     * Check necessary content on the local properties xml.
     *
     * @param string $elpFileName
     * @param string $elpFilePath
     * @param User   $user
     * @param bool   $forceCloseOdeUserPreviousSession
     *
     * @return array
     */
    public function checkLocalXmlProperties(
        $elpFileName,
        $elpFilePath,
        $user,
        $forceCloseOdeUserPreviousSession,
        $isImportIdevices = false,
        $odeNavStructureSync = null,
    ) {
        $result = [];

        if (empty($elpFilePath)) {
            $result['responseMessage'] = $this->translator->trans('There was a problem retrieving the data of the file');

            return $result;
        }

        // Check extension
        $ext = pathinfo($elpFileName, PATHINFO_EXTENSION);
        if (!in_array($ext, Constants::ELP_LOCAL_FILES_AVAILABLE_EXTS)) {
            $result['responseMessage'] = $this->translator->trans('File extension incorrect');

            return $result;
        }

        // Check if the user is in the session (throw exception)
        $this->checkSessionCurrentUser($user, $forceCloseOdeUserPreviousSession);

        // Get currentOdeUser
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());
        $newOdeSessionId = $currentSessionForUser->getOdeSessionId();

        // Create dist dir
        $odeSessionDistDirPath = $this->fileHelper->getOdeSessionDistDirForUser($newOdeSessionId, $user);

        $result = $this->opeLocalXmlProperties(
            $newOdeSessionId,
            $elpFileName,
            $elpFilePath,
            $odeSessionDistDirPath,
            $isImportIdevices,
            $odeNavStructureSync
        );

        if (empty($result)) {
            $result['responseMessage'] = $this->translator->trans('There was a problem opening file');

            return $result;
        }

        if (isset($result['responseMessage'])) {
            return $result;
        }

        $result['odeSessionId'] = $newOdeSessionId;
        $result['responseMessage'] = 'OK';

        return $result;
    }

    /**
     * Check necessary content on the local xml.
     *
     * @param string $elpFileName
     * @param string $elpFilePath
     * @param User   $user
     * @param bool   $forceCloseOdeUserPreviousSession
     *
     * @return array
     */
    public function checkMultipleLocalOdeFile(
        $elpFileName,
        $elpFilePath,
        $user,
        $forceCloseOdeUserPreviousSession,
        $isImportIdevices = false,
        $odeNavStructureSync = null,
    ) {
        $result = [];

        if (empty($elpFilePath)) {
            $result['responseMessage'] = $this->translator->trans('There was a problem retrieving the data of the file');

            return $result;
        }

        $ext = pathinfo($elpFileName, PATHINFO_EXTENSION);

        if (in_array($ext, Constants::ELP_FILES_AVAILABLE_EXTS)) {
            // Get currentOdeUser
            $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
            $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());
            $newOdeSessionId = $currentSessionForUser->getOdeSessionId();

            // Create dist dir
            $odeSessionDistDirPath = $this->fileHelper->getOdeSessionDistDirForUser($newOdeSessionId, $user);

            try {
                $result = $this->openMultipleLocalElp(
                    $newOdeSessionId,
                    $elpFileName,
                    $elpFilePath,
                    $odeSessionDistDirPath,
                    $odeNavStructureSync
                );
            } catch (\Exception $e) {
                $result['responseMessage'] = $this->translator->trans('There was a problem opening the elp file');

                return $result;
            }

            if (empty($result)) {
                $result['responseMessage'] = $this->translator->trans('There was a problem opening the elp file');

                return $result;
            }

            $result['odeSessionId'] = $newOdeSessionId;
            $result['responseMessage'] = 'OK';
        } else {
            $result['responseMessage'] = $this->translator->trans('File extension incorrect');

            return $result;
        }

        return $result;
    }

    /**
     * Check if zip content is editable.
     *
     * @param string $zipFileName
     * @param string $zipFilePath
     * @param User   $user
     *
     * @return array
     */
    public function checkEditableZipFile($zipFileName, $zipFilePath, $user)
    {
        $result = [];

        if (empty($zipFilePath)) {
            $result['responseMessage'] = $this->translator->trans('There was a problem retrieving the data of the file');

            return $result;
        }

        // Check if it's a zip file
        $isZip = $this->isZip($zipFileName);

        if (!$isZip) {
            $result['responseMessage'] = $this->translator->trans('There was a problem opening the file');

            return $result;
        }

        // Get currentOdeUser
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());
        $newOdeSessionId = $currentSessionForUser->getOdeSessionId();

        // Create dist dir
        $odeSessionDistDirPath = $this->fileHelper->getOdeSessionDistDirForUser($newOdeSessionId, $user);

        $result = $this->openZip($zipFileName, $odeSessionDistDirPath, $zipFilePath);

        if (empty($result)) {
            $result['responseMessage'] = $this->translator->trans('There was a problem opening the file');

            return $result;
        }

        if (isset($result['responseMessage'])) {
            return $result;
        }

        return $result;
    }

    /**
     * Check if is a compressed file by filename.
     *
     * @param string $zipFileName
     */
    private function isZip($zipFileName)
    {
        // Check if its a zip by filename of archive
        $ext = pathinfo($zipFileName, PATHINFO_EXTENSION);
        $zipArchive = in_array($ext, Constants::ELP_FILES_AVAILABLE_EXTS);

        return $zipArchive;
    }

    /**
     * Check necessary content on the xml.
     *
     * @param string $odeSessionId
     * @param string $elpFileName
     * @param User   $user
     * @param bool   $forceCloseOdeUserPreviousSession
     *
     * @return array
     */
    public function checkContentXmlAndCurrentUser(
        $odeSessionId,
        $elpFileName,
        $user,
        $forceCloseOdeUserPreviousSession,
        bool $allowParallelSessions = false,
    ) {
        $result = [];

        // Check if the user is in the session (throw exception)
        $this->checkSessionCurrentUser($user, $forceCloseOdeUserPreviousSession, $allowParallelSessions);

        // Determine if the file exist
        $checkElpFile = $this->checkElpFile($elpFileName);

        if ($checkElpFile['elpExist']) {
            // Generate new odeSessionId
            $newOdeSessionId = Util::generateId();

            // Create dist dir for the fresh session (avoids falling back to the public dir)
            $odeSessionDistDirPath = $this->fileHelper->getOdeSessionDistDirForUser($newOdeSessionId, $user);
            if (!$odeSessionDistDirPath) {
                $result['responseMessage'] = 'error: unable to create session dist directory';

                return $result;
            }

            $result = $this->openElp($newOdeSessionId, $elpFileName, $odeSessionDistDirPath, $checkElpFile);

            // Check if the elp file could be opened correctly
            if (empty($result)) {
                $result['responseMessage'] = $this->translator->trans('There was a problem opening the elp file');

                return $result;
            }
            if (isset($result['responseMessage'])) {
                return $result;
            }

            $result['odeSessionId'] = $newOdeSessionId;
            $result['responseMessage'] = 'OK';
        } else {
            $result['responseMessage'] = $checkElpFile['responseMessage'];
        }

        return $result;
    }

    /**
     * Opens an elp from OdeFiles.
     *
     * @param string        $elpFileName
     * @param UserInterface $user
     * @param User          $dbUser
     * @param string        $clientIp
     * @param bool          $forceCloseOdeUserPreviousSession
     *
     * @return array
     */
    public function createElpStructureAndCurrentOdeUser(
        $elpFileName,
        $user,
        $dbUser,
        $clientIp,
        $forceCloseOdeUserPreviousSession,
        $odeValues,
        bool $allowParallelSessions = false,
    ) {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);

        if ($forceCloseOdeUserPreviousSession) {
            $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser(
                $dbUser->getUserIdentifier()
            );
            if ((!empty($currentSessionForUser)) && (!empty($currentSessionForUser->getOdeSessionId()))) {
                // The user had the opportunity to save previously, therefore delete all autosaved files
                $autosavedSessionOdeFilesToMaintain = 0;

                // close previous session
                $this->closeOdeSession(
                    $currentSessionForUser->getOdeSessionId(),
                    $autosavedSessionOdeFilesToMaintain,
                    $user
                );
            }
        }

        // Check if user has already an open session
        if (!$allowParallelSessions) {
            $currentSessionsForUser = $currentOdeUsersRepository->getCurrentSessionForUser(
                $dbUser->getUserIdentifier()
            );
            if (!empty($currentSessionsForUser)) {
                throw new UserAlreadyOpenSessionException();
            }
        }

        // Insert into current_ode_users
        $this->currentOdeUsersService->createCurrentOdeUsers(
            $odeValues['odeId'],
            $odeValues['odeVersionId'],
            $odeValues['odeSessionId'],
            $dbUser,
            $clientIp
        );

        $result = $this->processContentXml($odeValues, $user);

        return $result;
    }

    /**
     * Only apply structure of elp, without session change.
     *
     * @param UserInterface $user
     * @param array         $odeValues
     *
     * @return array
     */
    public function createElpStructure($user, $odeValues, $isImportIdevices, $odeNavStructureSync = null, $isImportProperties = false)
    {
        if ($isImportIdevices) {
            $result = $this->processContentXml($odeValues, $user, $isImportIdevices, $odeNavStructureSync);
        } else {
            if ($isImportProperties) {
                $result = $this->processContentXml($odeValues, $user, $isImportIdevices, $odeNavStructureSync);
            } else {
                $result = $this->processMultipleContentXml($odeValues, $odeNavStructureSync);
            }
        }

        return $result;
    }

    /**
     * Removes elp from files and database.
     *
     * @param OdeFiles $odeFile
     *
     * @return array
     */
    public function removeElpFromServer($odeFile)
    {
        $filesDir = $this->fileHelper->getFilesDir();

        $odeFilePath = $odeFile->getDiskFilenameWithFilesDir($filesDir);

        $removeOdeFile = FileUtil::removeFile($odeFilePath);

        if (true == $removeOdeFile) {
            $this->entityManager->remove($odeFile);
            $this->entityManager->flush();
            $responseData = ['responseMessage' => 'OK'];
        } else {
            $responseData = ['responseMessage' => 'error deleting file in local path'];
        }

        return $responseData;
    }

    /**
     * Copies ode components files to ode session dir.
     *
     * @param string $odeSessionId
     * @param string $distDirPath
     * @param array  $odeComponentsMapping
     */
    private function copyOdeComponentsFilesToSession($odeSessionId, $distDirPath, $odeComponentsMapping = null)
    {
        $contentResourcesDir = $distDirPath.FileUtil::getPathFromDirStructureArray(
            Constants::PERMANENT_SAVE_ODE_DIR_STRUCTURE,
            Constants::PERMANENT_SAVE_CONTENT_RESOURCES_DIRNAME
        );

        $odeComponents = FileUtil::listSubdirs($contentResourcesDir);

        // Case is an idevice elp
        if (!empty($odeComponentsMapping[0])) {
            foreach ($odeComponentsMapping[0] as $oldOdeIdeviceId => $newOdeIdeviceId) {
                $sourcePath = $contentResourcesDir. /* DIRECTORY_SEPARATOR. */ $oldOdeIdeviceId;

                $destinationPath = $this->fileHelper->getOdeComponentsSyncDir($odeSessionId, $newOdeIdeviceId);

                // Create component dir
                FileUtil::createDir($destinationPath);

                self::copyOdeComponentFilesToDist($sourcePath, $destinationPath);
            }
        } else {
            // Copy odeComponents files
            foreach ($odeComponents as $odeComponent) {
                $sourcePath = $contentResourcesDir. /* DIRECTORY_SEPARATOR. */ $odeComponent;

                $destinationPath = $this->fileHelper->getOdeComponentsSyncDir($odeSessionId, $odeComponent);

                FileUtil::copyDir($sourcePath, $destinationPath);
            }
        }
    }

    /**
     * Copies ode components files to ode session dir.
     *
     * @param string $odeSessionId
     * @param string $distDirPath
     * @param array  $odeComponentsMapping
     */
    private function copyOldResourcesFilesToSession($odeSessionId, $distDirPath, $srcRoutes, $odeComponentsMapping)
    {
        $contentResourcesDir = $distDirPath;

        // Create odeComponents directory
        foreach ($odeComponentsMapping as $odeComponentMapping) {
            $this->fileHelper->getOdeComponentsSyncDir($odeSessionId, $odeComponentMapping);
        }

        // Copy odeComponents files
        foreach ($srcRoutes as $srcRoute) {
            if ('' !== $srcRoute) {
                // Get the file position to obtain the name of the file
                $srcRouteFilePos = strrpos($srcRoute, '/');
                $resource = substr($srcRoute, $srcRouteFilePos + 1);

                // Get the constant name to change to the route where the directory is located
                $srcRouteConstantPos = explode(Constants::FILES_DIR_NAME.'/', $srcRoute);
                if (!empty($srcRouteConstantPos[1])) {
                    // Get the second value of array to obtain the route
                    $routeWithoutConstant = $srcRouteConstantPos[1];

                    $sourcePath = $contentResourcesDir.$resource;
                    $destinationPath = $this->fileHelper->getFilesDir().$routeWithoutConstant;

                    FileUtil::copyFile($sourcePath, $destinationPath);
                }
            }
        }
    }

    /**
     * Copies ode filemanager files to ode session dir.
     *
     * @param string $odeSessionId
     * @param string $distDirPath
     */
    private function copyFileManagerFilesToSession($odeSessionId, $distDirPath)
    {
        $sourceDir = $distDirPath.Constants::PERMANENT_SAVE_CUSTOM_FILES_DIRNAME.DIRECTORY_SEPARATOR;
        $destinationDir = $this->fileHelper->getOdeFilemanagerDir($odeSessionId);

        $dirCopied = FileUtil::copyDir($sourceDir, $destinationDir);
    }

    /**
     * Copies theme files to ode session dir.
     *
     * @param string $odeSessionId
     * @param string $distDirPath
     */
    private function copyThemeFilesToSession($odeSessionId, $distDirPath)
    {
        $sourceDir = $distDirPath.Constants::EXPORT_DIR_THEME.DIRECTORY_SEPARATOR;
        $destinationDir = $this->fileHelper->getOdeSessionDir($odeSessionId).DIRECTORY_SEPARATOR.
            Constants::EXPORT_DIR_THEME;

        $dirCopied = FileUtil::copyDir($sourceDir, $destinationDir);
    }

    /**
     * Process Ode Xml and saves data to database.
     *
     * @param array               $odeValues
     * @param UserInterface       $user
     * @param bool                $isImportIdevices
     * @param OdeNavStructureSync $odeNavStructureSync
     *
     * @return string
     */
    private function processContentXml(
        $odeValues,
        $user,
        $isImportIdevices = false,
        $odeNavStructureSync = null,
    ) {
        // Check that nav structure is not null
        if (!empty($odeNavStructureSync)) {
            $maxOdePagStructureSyncOrder = 1;
        }

        // In case of idevices elp don't have properties
        if (!$isImportIdevices) {
            foreach ($odeValues['odeProperties'] as $odeProperty) {
                if (preg_match('/lom_metaMetadata_contribute\d*_role_value/i', $odeProperty->getKey()) && is_null($odeProperty->getValue())) {
                    $odeProperty->setValue('creator');
                }
                $this->entityManager->persist($odeProperty);
            }
        }
        if (!empty($odeValues['odeNavStructureSyncs'])) {
            foreach ($odeValues['odeNavStructureSyncs'] as $odeNavStructureSync) {
                $this->entityManager->persist($odeNavStructureSync);

                foreach ($odeNavStructureSync->getOdeNavStructureSyncProperties() as $odeNavStructureSyncProperty) {
                    $this->entityManager->persist($odeNavStructureSyncProperty);
                }

                foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                    // Set block order if import idevice (added one is last)
                    if ($isImportIdevices) {
                        $odePagStructureSync->setOdePagStructureSyncOrder($maxOdePagStructureSyncOrder);
                    }
                    $this->entityManager->persist($odePagStructureSync);
                    // Increase block order if import idevice (added one is last)
                    if ($isImportIdevices) {
                        ++$maxOdePagStructureSyncOrder;
                    }
                    foreach ($odePagStructureSync->getOdePagStructureSyncProperties() as $odePagStructureSyncProperty) {
                        $this->entityManager->persist($odePagStructureSyncProperty);
                    }

                    foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                        $this->entityManager->persist($odeComponentsSync);

                        foreach ($odeComponentsSync->getOdeComponentsSyncProperties() as $odeComponentsSyncProperty) {
                            $this->entityManager->persist($odeComponentsSyncProperty);
                        }
                    }
                }
            }
        }

        $this->entityManager->flush();

        return $odeValues;
    }

    /**
     * Process Ode Xml and saves data to database.
     *
     * @param odeNavStructureSyncs $odeNavStructureSync
     *
     * @return string
     */
    private function processMultipleContentXml($odeMultipleValues, $odeNavStructureSync = null)
    {
        // Get max order on the parent ode nav, if it isn't parent set to null
        $odeParentPageId = $odeNavStructureSync ? $odeNavStructureSync->getOdePageId() : null;

        $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
        $maxOdeNavStructureSyncOrder = $odeNavStructureSyncRepo->findMaxOrderByParentId($odeParentPageId);

        // Catch the next order position
        if (isset($maxOdeNavStructureSyncOrder[1])) {
            $maxOdeNavStructureSyncOrder = $maxOdeNavStructureSyncOrder[1];
            ++$maxOdeNavStructureSyncOrder;
        } else {
            $maxOdeNavStructureSyncOrder = 1;
        }

        // Look number of odeValues
        foreach ($odeMultipleValues as $odeValues) {
            // Apply odeValues
            foreach ($odeValues['odeNavStructureSyncs'] as $odeNavStructureSync) {
                $odeNavStructureSync->setOdeNavStructureSyncOrder($maxOdeNavStructureSyncOrder);
                $this->entityManager->persist($odeNavStructureSync);

                // Increase order to 1
                ++$maxOdeNavStructureSyncOrder;
                foreach ($odeNavStructureSync->getOdeNavStructureSyncProperties() as $odeNavStructureSyncProperty) {
                    $this->entityManager->persist($odeNavStructureSyncProperty);
                }

                foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                    $this->entityManager->persist($odePagStructureSync);

                    foreach ($odePagStructureSync->getOdePagStructureSyncProperties() as $odePagStructureSyncProperty) {
                        $this->entityManager->persist($odePagStructureSyncProperty);
                    }

                    foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                        $this->entityManager->persist($odeComponentsSync);

                        foreach ($odeComponentsSync->getOdeComponentsSyncProperties() as $odeComponentsSyncProperty) {
                            $this->entityManager->persist($odeComponentsSyncProperty);
                        }
                    }
                }
            }
        }

        $this->entityManager->flush();

        return $odeMultipleValues;
    }

    /**
     * Get last version name in ode files.
     *
     * @param string $odeId
     *
     * @return string
     */
    public function getLastVersionNameOdeFiles($odeId)
    {
        $odeFilesRepository = $this->entityManager->getRepository(OdeFiles::class);

        $odeFile = $odeFilesRepository->getLastFileForOde($odeId);
        if (!empty($odeFile)) {
            $odeFileVersionName = $odeFile->getVersionName();
            if ('' == $odeFileVersionName) {
                $odeFileVersionName = '0';
            }
        } else {
            $odeFileVersionName = '0';
        }

        return $odeFileVersionName;
    }

    /**
     * Get last version name in ode files.
     *
     * @param string $odeId
     *
     * @return string
     */
    public function getOdePlatformIdFromLastOdeId($odeId)
    {
        $odeFilesRepository = $this->entityManager->getRepository(OdeFiles::class);

        $odeFile = $odeFilesRepository->getLastFileForOde($odeId);
        if (!empty($odeFile)) {
            $odePlatformId = $odeFile->getOdePlatformId();
            if ('' == $odePlatformId) {
                $odePlatformId = null;
            }
        } else {
            $odePlatformId = null;
        }

        return $odePlatformId;
    }

    /**
     * Get ode config properties array.
     *
     * @param string $odeSessionId
     *
     * @return array
     */
    public function getConfigOdeProperties($odeSessionId)
    {
        $odePropertiesList = [];

        // Metadata properties
        foreach (Properties::ODE_PROPERTIES_CONFIG as $category => $properties) {
            foreach ($properties as $odePropertiesConfigKey => $odePropertiesConfigValues) {
                $odeProperties = new OdePropertiesSync();
                $odeProperties->loadFromPropertiesConfig(
                    $odeSessionId,
                    $odePropertiesConfigKey,
                    $odePropertiesConfigValues
                );
                $odePropertiesList[$odePropertiesConfigKey] = $odeProperties;
            }
        }

        // Metadata cataloguing
        foreach (Properties::ODE_CATALOGUING_CONFIG as $category => $properties) {
            foreach ($properties as $odePropertiesConfigKey => $odePropertiesConfigValues) {
                $odeProperties = new OdePropertiesSync();
                $odeProperties->loadFromPropertiesConfig(
                    $odeSessionId,
                    $odePropertiesConfigKey,
                    $odePropertiesConfigValues
                );
                $odePropertiesList[$odePropertiesConfigKey] = $odeProperties;
            }
        }

        return $odePropertiesList;
    }

    /**
     * Get ode properties array.
     *
     * @param string             $odeSessionId
     * @param UserInterface|bool $user
     *
     * @return array
     */
    public function getOdePropertiesFromDatabase($odeSessionId, $user = false)
    {
        // User preferences
        $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
        $userPreferencesDtos = [];
        foreach ($databaseUserPreferences as $userPreference) {
            $userPreferencesDto = new UserPreferencesDto();
            $userPreferencesDto->loadFromEntity($userPreference);
            $userPreferencesDtos[$userPreferencesDto->getKey()] = $userPreferencesDto;
        }

        // Database properties
        $repository = $this->entityManager->getRepository(OdePropertiesSync::class);
        $databaseOdePropertiesList = $repository->findBy(['odeSessionId' => $odeSessionId]);
        $databaseOdePropertiesData = [];
        foreach ($databaseOdePropertiesList as $property) {
            $databaseOdePropertiesData[$property->getKey()] = $property;
        }

        // Config properties
        $configOdePropertiesData = $this->getConfigOdeProperties($odeSessionId);

        // Merge metadata properties
        $odePropertiesData = [];
        foreach (Properties::ODE_PROPERTIES_CONFIG as $category => $properties) {
            foreach ($properties as $odePropertiesConfigKey => $odePropertiesConfigValues) {
                // Exist value in database
                if (isset($databaseOdePropertiesData[$odePropertiesConfigKey])) {
                    $odePropertiesData[$odePropertiesConfigKey] = $databaseOdePropertiesData[$odePropertiesConfigKey];
                    $cat = isset($odePropertiesConfigValues['category']) ? $odePropertiesConfigValues['category'] : '';
                    $groups = isset($odePropertiesConfigValues['groups']) ? $odePropertiesConfigValues['groups'] : [];
                    $odePropertiesData[$odePropertiesConfigKey]->setCategory($cat);
                    $odePropertiesData[$odePropertiesConfigKey]->setGroups($groups);
                    continue;
                }

                // Get the default value
                $odePropertiesData[$odePropertiesConfigKey] = $configOdePropertiesData[$odePropertiesConfigKey];

                // Replace the default language with the user's language
                if (
                    isset($userPreferencesDtos['locale'])
                    && Settings::DEFAULT_LOCALE == $odePropertiesData[$odePropertiesConfigKey]->getValue()
                ) {
                    $odePropertiesData[$odePropertiesConfigKey]->setValue($userPreferencesDtos['locale']->getValue());
                }

                // Check preferences -> properties relationship
                // - Set default license by user license preference
                if (
                    $userPreferencesDtos
                    && isset(Properties::USER_PREFERENCES_DEFAULT_PROPERTIES_RELATION[$odePropertiesConfigKey])
                ) {
                    $prefKey = Properties::USER_PREFERENCES_DEFAULT_PROPERTIES_RELATION[$odePropertiesConfigKey];
                    $prefValue = $userPreferencesDtos[$prefKey];
                    if ($prefValue) {
                        $odePropertiesData[$odePropertiesConfigKey]->setValue($prefValue->getValue());
                    }
                }

                // Save in database
                $this->entityManager->persist($odePropertiesData[$odePropertiesConfigKey]);
            }
        }

        // Merge metadata cataloguing
        foreach (Properties::ODE_CATALOGUING_CONFIG as $category => $properties) {
            foreach ($properties as $odePropertiesConfigKey => $odePropertiesConfigValues) {
                // Exist value in database
                if (isset($databaseOdePropertiesData[$odePropertiesConfigKey])) {
                    $odePropertiesData[$odePropertiesConfigKey] = $databaseOdePropertiesData[$odePropertiesConfigKey];
                    $cat = isset($odePropertiesConfigValues['category']) ? $odePropertiesConfigValues['category'] : '';
                    $groups = isset($odePropertiesConfigValues['groups']) ? $odePropertiesConfigValues['groups'] : [];
                    $odePropertiesData[$odePropertiesConfigKey]->setCategory($cat);
                    $odePropertiesData[$odePropertiesConfigKey]->setGroups($groups);

                    // Check if multiple property
                    if (isset($odePropertiesConfigValues['multiple']) && $odePropertiesConfigValues['multiple']) {
                        // Try to get values ​​from the database
                        $prefixKeyProperty = end($odePropertiesConfigValues['groups']);
                        $sufixKeyProperty = str_replace($prefixKeyProperty, '', $odePropertiesConfigKey);
                        $i = 2;
                        while (true) {
                            $propertyMultipleKey = $prefixKeyProperty.$i.$sufixKeyProperty;
                            if (!isset($databaseOdePropertiesData[$propertyMultipleKey])) {
                                break;
                            }
                            $odePropertyMultipleDto = $databaseOdePropertiesData[$propertyMultipleKey];
                            $odePropertyMultipleDto->setCategory($cat);
                            $odePropertyMultipleDto->setGroups($groups);
                            $odePropertyMultipleDto->setMultipleId($odePropertiesConfigKey);
                            $odePropertyMultipleDto->setMultipleIndex($i);
                            $odePropertiesData[$propertyMultipleKey] = $odePropertyMultipleDto;
                            ++$i;
                        }
                    }

                    continue;
                }

                // Get the default value
                $odePropertiesData[$odePropertiesConfigKey] = $configOdePropertiesData[$odePropertiesConfigKey];

                // Replace the default language with the user's preference language
                if (
                    isset($userPreferencesDtos['locale'])
                    && Settings::DEFAULT_LOCALE == $odePropertiesData[$odePropertiesConfigKey]->getValue()
                ) {
                    $odePropertiesData[$odePropertiesConfigKey]->setValue($userPreferencesDtos['locale']->getValue());
                }

                // In some properties the value is generated
                if (isset($odePropertiesConfigValues['generated']) && $odePropertiesConfigValues['generated']) {
                    $value = $odePropertiesData[$odePropertiesConfigKey]->getValue();
                    $value = str_replace('{odeSessionId}', $odeSessionId, $value);
                    $odePropertiesData[$odePropertiesConfigKey]->setValue($value);
                }

                // Check preferences -> properties relationship
                // - Set default license by user license preference
                if (
                    $userPreferencesDtos
                    && isset(Properties::USER_PREFERENCES_DEFAULT_PROPERTIES_RELATION[$odePropertiesConfigKey])
                ) {
                    $prefKey = Properties::USER_PREFERENCES_DEFAULT_PROPERTIES_RELATION[$odePropertiesConfigKey];
                    $prefValue = $userPreferencesDtos[$prefKey];
                    if ($prefValue) {
                        $odePropertiesData[$odePropertiesConfigKey]->setValue($prefValue->getValue());
                    }
                }

                // Save in database
                $this->entityManager->persist($odePropertiesData[$odePropertiesConfigKey]);
            }
        }

        $this->entityManager->flush();

        return $odePropertiesData;
    }

    /**
     * Save ode property and all the multiple properties that depend on it.
     *
     * @param EntityManagerInterface $entityManager
     * @param Request                $request
     * @param string                 $odeSessionId
     * @param array                  $databaseOdePropertiesData
     * @param array                  $odePropertiesConfigValues
     * @param string                 $odePropertiesConfigKey
     *
     * @return array
     */
    public function saveOdeProperty(
        &$entityManager,
        $request,
        $odeSessionId,
        $databaseOdePropertiesData,
        $odePropertiesConfigValues,
        $odePropertiesConfigKey,
    ) {
        $propertiesData = [];

        // Set value to property from request
        $odeProperty = $databaseOdePropertiesData[$odePropertiesConfigKey];
        $odePropertyNewValue = $request->get($odePropertiesConfigKey);
        if (null !== $odePropertyNewValue) {
            $odeProperty->setValue($odePropertyNewValue);
        }

        // Save
        $entityManager->persist($odeProperty);
        $propertiesData[$odePropertiesConfigKey] = $odeProperty;

        // If the property is multiple
        // we must get all the values ​​sent for this key and store them in the database
        if (isset($odePropertiesConfigValues['multiple']) && $odePropertiesConfigValues['multiple']) {
            foreach ($odePropertiesConfigValues['groups'] as $group) {
                $prefixKeyProperty = $group;
                $sufixKeyProperty = str_replace($prefixKeyProperty, '', $odePropertiesConfigKey);
                $i = 2;
                while (true) {
                    $propertyMultipleKey = $prefixKeyProperty.$i.$sufixKeyProperty;
                    // PUT request property
                    $propertyMultipleValueRequest = $request->get($propertyMultipleKey);
                    // Database property
                    $propertyMultipleValueDb = null;
                    if (isset($databaseOdePropertiesData[$propertyMultipleKey])) {
                        $propertyMultipleValueDb = $databaseOdePropertiesData[$propertyMultipleKey];
                    }
                    // Manage multiple properties according to the data we have and those we have received
                    if (!is_null($propertyMultipleValueRequest) && !is_null($propertyMultipleValueDb)) {
                        // 1. Exists in the database and has been sent in the request
                        // Update database value
                        $propertyMultipleValueDb->setValue($propertyMultipleValueRequest);
                        $entityManager->persist($propertyMultipleValueDb);
                        $propertiesData[$propertyMultipleKey] = $propertyMultipleValueDb;
                    } elseif (!is_null($propertyMultipleValueRequest)) {
                        // 2. Has been sent in the request but it does not exist in the database
                        // We need to create it in the database
                        $propertyMultipleValueDb = new OdePropertiesSync();
                        $propertyMultipleValueDb->loadFromPropertiesConfig(
                            $odeSessionId,
                            $propertyMultipleKey,
                            $odePropertiesConfigValues
                        );
                        $propertyMultipleValueDb->setValue($propertyMultipleValueRequest);
                        $entityManager->persist($propertyMultipleValueDb);
                        $propertiesData[$propertyMultipleKey] = $propertyMultipleValueDb;
                    } elseif ($propertyMultipleValueDb) {
                        // 3. Exists in the database but it has not been sent in the request
                        // In this case we remove it from the database
                        $entityManager->remove($propertyMultipleValueDb);
                    } else {
                        // 4. Does not exist in the database or in the request
                        break;
                    }
                    ++$i;
                }
            }
        }

        return $propertiesData;
    }
}
