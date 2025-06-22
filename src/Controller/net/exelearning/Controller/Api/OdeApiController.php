<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;
use App\Entity\net\exelearning\Dto\OdeCurrentUsersDto;
use App\Entity\net\exelearning\Dto\OdeFilesDto;
use App\Entity\net\exelearning\Dto\OdeLastUpdatedDto;
use App\Entity\net\exelearning\Dto\OdePropertiesSyncDto;
use App\Entity\net\exelearning\Dto\UserPreferencesDto;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Exception\net\exelearning\Exception\Logical\AutosaveRecentSaveException;
use App\Exception\net\exelearning\Exception\Logical\UserAlreadyOpenSessionException;
use App\Exception\net\exelearning\Exception\Logical\UserInsufficientSpaceException;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Properties;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersSyncChangesServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeComponentsSyncServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Settings;
use App\Util\net\exelearning\Util\FileUtil;
use App\Util\net\exelearning\Util\SettingsUtil;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

#[Route('/api/ode-management/odes')]
class OdeApiController extends DefaultApiController
{
    private $fileHelper;
    private $odeService;
    private $odeComponentsSyncService;
    private $userHelper;
    private $currentOdeUsersService;
    private $currentOdeUsersSyncChangesService;
    private $translator;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        FileHelper $fileHelper,
        OdeServiceInterface $odeService,
        OdeComponentsSyncServiceInterface $odeComponentsSyncService,
        UserHelper $userHelper,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        CurrentOdeUsersSyncChangesServiceInterface $currentOdeUsersSyncChangesService,
        TranslatorInterface $translator,
    ) {
        $this->fileHelper = $fileHelper;
        $this->odeService = $odeService;
        $this->odeComponentsSyncService = $odeComponentsSyncService;
        $this->userHelper = $userHelper;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->currentOdeUsersSyncChangesService = $currentOdeUsersSyncChangesService;
        $this->translator = $translator;

        parent::__construct($entityManager, $logger);
    }

    #[Route('/{odeId}/last-updated', methods: ['GET'], name: 'api_odes_last_updated')]
    public function getOdeLastUpdatedAction(Request $request, $odeId)
    {
        $responseData = new OdeLastUpdatedDto();
        $responseData->setOdeId($odeId);

        $odeFilesRepo = $this->entityManager->getRepository(OdeFiles::class);

        $odeFile = $odeFilesRepo->getLastFileForOde($odeId);

        $timestamp = null;

        if (!empty($odeFile) && $odeFile->getUpdatedAt()) {
            $timestamp = $odeFile->getUpdatedAt()->getTimestamp();
        } else {
            $this->logger->error('data not found', ['odeId' => $odeId, 'file:' => $this, 'line' => __LINE__]);
        }

        $responseData->setLastUpdatedDate($timestamp);

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/{odeId}/{odeVersionId}/{odeSessionId}/current-users', methods: ['GET'], name: 'api_odes_current_users')]
    public function getOdeCurrentUsersAction(Request $request, $odeId, $odeVersionId, $odeSessionId)
    {
        // In offline mode, don't run this action.
        if (SettingsUtil::installationTypeIsOffline()) {
            return new JsonResponse(['error' => 'Offline mode enabled, operation not allowed'], JsonResponse::HTTP_FORBIDDEN);
        }

        $responseData = new OdeCurrentUsersDto();
        $responseData->setOdeSessionId($odeSessionId);

        $repo = $this->entityManager->getRepository(CurrentOdeUsers::class);

        $currentOdeUsers = $repo->getCurrentUsers(null, null, $odeSessionId);

        if (!empty($currentOdeUsers)) {
            foreach ($currentOdeUsers as $currentOdeUser) {
                $responseData->addCurrentUser($currentOdeUser->getUser());
            }
        } else {
            $this->logger->error('data not found', ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]);
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/ode/save/manual', methods: ['POST'], name: 'api_odes_ode_save_manual')]
    public function manualSaveOdeAction(Request $request, $odeSessionIdParam = false)
    {
        $responseData = [];

        // collect parameters
        $odeSessionId = $request->get('odeSessionId');

        // In case version control is active do the save
        if (Settings::VERSION_CONTROL) {
            // if $odeSessionId is set load data from database
            if (!empty($odeSessionId)) {
                $user = $this->getUser();
                $databaseUser = $this->userHelper->getDatabaseUser($user);

                // Set locale (TODO: error translator returns to default locale)
                // Get properties of user
                $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
                $localeUserPreferences = $databaseUserPreferences['locale']->getValue();
                $this->translator->setLocale($localeUserPreferences);

                // Get currentOdeUser
                $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
                $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());

                // Obtain odeId and odeVersionId from currentOdeUsers
                $odeId = $this->currentOdeUsersService->getOdeIdByOdeSessionId($user, $odeSessionId);
                $odeVersion = $this->currentOdeUsersService->getOdeVersionIdByOdeSessionId($user, $odeSessionId);

                // Get the last version_name from ode_files
                $lastOdeVersionName = $this->odeService->getLastVersionNameOdeFiles($odeId);
                $odeVersionName = intval($lastOdeVersionName) + 1;

                $isManualSave = true;

                // Get save flag
                $isConcurrentUserSave = $this->currentOdeUsersService->checkSyncSaveFlag($odeId, $odeSessionId);

                // Get odeComponentFlag
                $isEditingIdevice = $currentSessionForUser->getSyncComponentsFlag();

                // Check flags
                if ($isConcurrentUserSave || $isEditingIdevice) {
                    if ($isConcurrentUserSave) {
                        $error = $this->translator->trans('Other user is saving changes right now');
                        $responseData['responseMessage'] = $error;
                    } else {
                        $error = $this->translator->trans('An iDevice is open');
                        $responseData['responseMessage'] = $error;
                    }
                } else {
                    // Activate flag on user
                    $this->currentOdeUsersService->activateSyncSaveFlag($user);

                    try {
                        // Get ode properties
                        $odeProperties = $this->odeService->getOdePropertiesFromDatabase($odeSessionId, $user);

                        // Get user preferences
                        $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
                        $userPreferencesDtos = [];
                        foreach ($databaseUserPreferences as $userPreference) {
                            $userPreferencesDto = new UserPreferencesDto();
                            $userPreferencesDto->loadFromEntity($userPreference);
                            $userPreferencesDtos[$userPreferencesDto->getKey()] = $userPreferencesDto;
                        }

                        $saveOdeResult = $this->odeService->saveOde(
                            $odeSessionId,
                            $databaseUser,
                            $isManualSave,
                            $odeProperties,
                            $userPreferencesDtos
                        );

                        if ('OK' == $saveOdeResult['responseMessage']) {
                            // Properties title
                            $odePropertiesName = $odeProperties['pp_title']->getValue();
                            if (empty($odePropertiesName)) {
                                $odePropertiesName = Constants::ELP_PROPERTIES_NO_TITLE_NAME;
                            }

                            $odeResultParameters = [
                                'odeId' => $saveOdeResult['odeId'],
                                'odeVersionId' => $saveOdeResult['odeVersionId'],
                                'odeSessionId' => $odeSessionId,
                                'elpFileName' => $saveOdeResult['elpFileName'],
                                'odePropertiesName' => $odePropertiesName,
                                'odeVersionName' => $odeVersionName,
                            ];

                            $this->odeService->moveElpFileToPerm($odeResultParameters, $databaseUser, $isManualSave);
                        }

                        $responseData['responseMessage'] = $saveOdeResult['responseMessage'];
                    } catch (UserInsufficientSpaceException $e) {
                        $responseData['responseMessage'] = 'error: '.$e->getMessage();
                    }

                    // Remove save flag active
                    $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);
                }
            } else {
                $this->logger->error('invalid data', ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: invalid data';
            }
        } else {
            $this->logger->error('version control desactivated', ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: version control desactivated';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/ode/save/auto', methods: ['POST'], name: 'api_odes_ode_save_auto')]
    public function autoSaveOdeAction(Request $request)
    {
        $responseData = [];

        // collect parameters
        $odeId = $request->get('odeId');
        $odeVersion = $request->get('odeVersion');
        $odeSessionId = $request->get('odeSessionId');

        // If the function autosave is active
        if (Settings::AUTOSAVE_ODE_FILES_FUNCTION) {
            // if $odeSessionId is set load data from database
            if (!empty($odeSessionId)) {
                $user = $this->getUser();
                $databaseUser = $this->userHelper->getDatabaseUser($user);

                // Set locale (TODO: error translator returns to default locale)
                // Get properties of user
                $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
                $localeUserPreferences = $databaseUserPreferences['locale']->getValue();
                $this->translator->setLocale($localeUserPreferences);

                // Get currentOdeUser
                $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
                $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());

                $isManualSave = false;

                $odeVersionName = $this->odeService->getLastVersionNameOdeFiles($odeId);

                // Get save flag
                $isConcurrentUserSave = $this->currentOdeUsersService->checkSyncSaveFlag($odeId, $odeSessionId);

                // Get odeComponentFlag
                $isEditingIdevice = $currentSessionForUser->getSyncComponentsFlag();

                // Check flags
                if ($isConcurrentUserSave || $isEditingIdevice) {
                    if ($isConcurrentUserSave) {
                        $error = $this->translator->trans('Other user is saving changes right now');
                        $responseData['responseMessage'] = $error;
                    } else {
                        $error = $this->translator->trans('An iDevice is open');
                        $responseData['responseMessage'] = $error;
                    }
                } else {
                    // Activate flag on user
                    $this->currentOdeUsersService->activateSyncSaveFlag($user);

                    try {
                        // Get ode properties
                        $odeProperties = $this->odeService->getOdePropertiesFromDatabase($odeSessionId, $user);

                        // Get user preferences
                        $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
                        $userPreferencesDtos = [];
                        foreach ($databaseUserPreferences as $userPreference) {
                            $userPreferencesDto = new UserPreferencesDto();
                            $userPreferencesDto->loadFromEntity($userPreference);
                            $userPreferencesDtos[$userPreferencesDto->getKey()] = $userPreferencesDto;
                        }

                        $saveOdeResult = $this->odeService->saveOde(
                            $odeSessionId,
                            $databaseUser,
                            $isManualSave,
                            $odeProperties,
                            $userPreferencesDtos
                        );
                        // Catch error in case empty ode id
                        if (empty($saveOdeResult['odeId'])) {
                            // Remove save flag active
                            $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);
                            $this->logger->error(
                                'empty ode id',
                                ['saveOdeResult' => $saveOdeResult, 'file:' => $this, 'line' => __LINE__]
                            );

                            $responseData['responseMessage'] = 'error: empty odeId';
                            $jsonData = $this->getJsonSerialized($responseData);

                            return new JsonResponse($jsonData, $this->status, [], true);
                        }

                        if ('OK' == $saveOdeResult['responseMessage']) {
                            // Properties title
                            $odePropertiesName = $odeProperties['pp_title']->getValue();
                            if (empty($odePropertiesName)) {
                                $odePropertiesName = Constants::ELP_PROPERTIES_NO_TITLE_NAME;
                            }

                            $odeResultParameters = [
                                'odeId' => $saveOdeResult['odeId'],
                                'odeVersionId' => $saveOdeResult['odeVersionId'],
                                'odeSessionId' => $odeSessionId,
                                'elpFileName' => $saveOdeResult['elpFileName'],
                                'odePropertiesName' => $odePropertiesName,
                                'odeVersionName' => $odeVersionName,
                            ];

                            $this->odeService->moveElpFileToPerm($odeResultParameters, $databaseUser, $isManualSave);
                        }

                        $responseData['responseMessage'] = $saveOdeResult['responseMessage'];
                    } catch (AutosaveRecentSaveException $e) {
                        // Remove save flag active
                        $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);
                        $responseData['responseMessage'] = 'notice: '.$e->getMessage();
                    } catch (UserInsufficientSpaceException $e) {
                        // Remove save flag active
                        $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);
                        $responseData['responseMessage'] = 'error: '.$e->getMessage();
                    }

                    // Remove save flag active
                    $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);
                }
            } else {
                $this->logger->error(
                    'invalid data',
                    ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
                );

                $responseData['responseMessage'] = 'error: invalid data';
            }
        } else {
            $this->logger->notice(
                'autosave desactivated',
                ['autosaveFunction' => Settings::AUTOSAVE_ODE_FILES_FUNCTION, 'file:' => $this, 'line' => __LINE__]
            );

            $responseData['responseMessage'] = 'notice: autosave desactivated';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/ode/save/as', methods: ['POST'], name: 'api_odes_ode_save_as')]
    public function saveAsAction(Request $request)
    {
        $responseData = [];

        // Collect parameters
        $odeSessionId = $request->get('odeSessionId');
        $title = $request->get('title');

        // In case version control is active do the save
        if (Settings::VERSION_CONTROL) {
            // If $odeSessionId is set load data from database
            if (!empty($odeSessionId)) {
                $user = $this->getUser();
                $databaseUser = $this->userHelper->getDatabaseUser($user);

                // Set locale (TODO: error translator returns to default locale)
                // Get properties of user
                $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
                $localeUserPreferences = $databaseUserPreferences['locale']->getValue();
                $this->translator->setLocale($localeUserPreferences);

                $isManualSave = true;
                $isSaveAs = true;

                // Get currentOdeUser
                $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
                $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());

                // Get odeComponentFlag
                $isEditingIdevice = $currentSessionForUser->getSyncComponentsFlag();

                // Check flags
                if ($isEditingIdevice) {
                    $error = $this->translator->trans('An iDevice is open');
                    $responseData['responseMessage'] = $error;
                } else {
                    // Rename the sessionDir and return an array or false
                    $responseSaveAs = $this->odeService->renameSessionDir($odeSessionId, $user);

                    if ($responseSaveAs) {
                        try {
                            $lastOdeVersionName = $this->odeService->getLastVersionNameOdeFiles(
                                $responseSaveAs['odeId']
                            );
                            $odeVersionName = intval($lastOdeVersionName) + 1;

                            // Get ode properties
                            $odeProperties = $this->odeService->getOdePropertiesFromDatabase(
                                $responseSaveAs['odeSessionId'],
                                $user
                            );
                            $odePropertiesName = $odeProperties['pp_title']->setValue($title);
                            $odePropertiesName = $odeProperties['pp_title']->getValue();

                            // Get user preferences
                            $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
                            $userPreferencesDtos = [];
                            foreach ($databaseUserPreferences as $userPreference) {
                                $userPreferencesDto = new UserPreferencesDto();
                                $userPreferencesDto->loadFromEntity($userPreference);
                                $userPreferencesDtos[$userPreferencesDto->getKey()] = $userPreferencesDto;
                            }

                            $saveOdeResult = $this->odeService->saveOde(
                                $responseSaveAs['odeSessionId'],
                                $databaseUser,
                                $isManualSave,
                                $odeProperties,
                                $userPreferencesDtos,
                                $isSaveAs
                            );

                            if ('OK' == $saveOdeResult['responseMessage']) {
                                if (empty($odePropertiesName)) {
                                    $odePropertiesName = Constants::ELP_PROPERTIES_NO_TITLE_NAME;
                                }

                                $odeResultParameters = [
                                    'odeId' => $saveOdeResult['odeId'],
                                    'odeVersionId' => $saveOdeResult['odeVersionId'],
                                    'odeSessionId' => $responseSaveAs['odeSessionId'],
                                    'elpFileName' => $saveOdeResult['elpFileName'],
                                    'odePropertiesName' => $odePropertiesName,
                                    'odeVersionName' => $odeVersionName,
                                ];

                                $this->odeService->moveElpFileToPerm(
                                    $odeResultParameters,
                                    $databaseUser,
                                    $isManualSave
                                );
                            }

                            $responseData['responseMessage'] = $saveOdeResult['responseMessage'];
                            $responseData['odeId'] = $responseSaveAs['odeId'];
                            $responseData['odeVersionId'] = $responseSaveAs['odeVersionId'];
                            $responseData['newSessionId'] = $responseSaveAs['odeSessionId'];
                        } catch (AutosaveRecentSaveException $e) {
                            $responseData['responseMessage'] = 'notice: '.$e->getMessage();
                        } catch (UserInsufficientSpaceException $e) {
                            $responseData['responseMessage'] = 'error: '.$e->getMessage();
                        }
                    } else {
                        $this->logger->error(
                            'There are more users on the session',
                            ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
                        );
                        $responseData['responseMessage'] = 'error: There are more users on the session';
                    }
                }
            } else {
                $this->logger->error(
                    'invalid data',
                    ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
                );
                $responseData['responseMessage'] = 'error: invalid data';
            }
        } else {
            $this->logger->error(
                'version control desactivated',
                ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
            );
            $responseData['responseMessage'] = 'error: version control desactivated';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/get/ode/session/brokenlinks', methods: ['POST'], name: 'api_odes_session_get_broken_links')]
    public function getOdeSessionBrokenLinksAction(Request $request)
    {
        $odeSessionId = $request->get('odeSessionId');
        $csv = $request->get('csv');

        if (!empty($odeSessionId)) {
            // Base URL
            $symfonyFullUrl = self::getSymfonyUrl($request);

            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);
            $odeComponentsSync = $odeComponentsSyncRepo->findBy(['odeSessionId' => $odeSessionId]);

            if (!empty($odeComponentsSync)) {
                $brokenLinks = $this->odeComponentsSyncService->getBrokenLinks(
                    $symfonyFullUrl,
                    $odeComponentsSync,
                    $csv
                );
                $responseData['responseMessage'] = 'OK';
                $responseData['brokenLinks'] = $brokenLinks;
            } else {
                $this->logger->notice(
                    'data not found',
                    ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
                );
                $responseData['responseMessage'] = 'notice: data not found';
            }
        } else {
            $this->logger->error(
                'invalid data',
                ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
            );
            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/get/ode/session/used/files', methods: ['POST'], name: 'api_odes_session_get_used_files')]
    public function getOdeSessionUsedFilesAction(Request $request)
    {
        $odeSessionId = $request->get('odeSessionId');
        $csv = $request->get('csv');
        $resourceReport = $request->get('resourceReport');

        $responseData = [];

        if (!empty($odeSessionId)) {
            // Base URL
            $symfonyFullUrl = self::getSymfonyUrl($request);

            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);
            $odeComponentsSync = $odeComponentsSyncRepo->findBy(['odeSessionId' => $odeSessionId]);

            if (!empty($odeComponentsSync)) {
                $usedFiles = $this->odeComponentsSyncService->getBrokenLinks(
                    $symfonyFullUrl,
                    $odeComponentsSync,
                    $csv,
                    $resourceReport
                );
                $responseData['responseMessage'] = 'OK';
                $responseData['usedFiles'] = $usedFiles;
            } else {
                $this->logger->notice(
                    'data not found',
                    ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
                );
                $responseData['responseMessage'] = 'notice: data not found';
            }
        } else {
            $this->logger->error(
                'invalid data',
                ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]
            );
            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/check/before/leave/ode/session', methods: ['POST'], name: 'api_odes_check_before_leave_ode_session')]
    public function checkBeforeLeaveOdeSessionAction(Request $request)
    {
        $odeSessionId = $request->get('odeSessionId');
        $odeversionId = $request->get('odeVersionId');
        $odeId = $request->get('odeId');

        $responseData = [];

        $currentOdeUserRepo = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeUsers = $currentOdeUserRepo->getCurrentUsers($odeId, $odeversionId, $odeSessionId);
        $totalCurrentOdeUsers = count((array) $currentOdeUsers);

        $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);
        $odeComponentsSync = $odeComponentsSyncRepo->findBy(['odeSessionId' => $odeSessionId]);

        // Check if ode components are empty and number of current users
        if (1 == $totalCurrentOdeUsers && !empty($odeComponentsSync)) {
            $responseData['askSave'] = true;
        } elseif (empty($odeComponentsSync)) {
            $responseData['leaveEmptySession'] = true;
        } else {
            $responseData['leaveSession'] = true;
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/ode/session/close', methods: ['POST'], name: 'api_odes_ode_session_close')]
    public function closeOdeSessionAction(Request $request)
    {
        $responseData = [];

        // collect parameters
        $odeSessionId = $request->get('odeSessionId');

        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        // if $odeSessionId is set load data from database
        if (!empty($odeSessionId)) {
            // The user has had the opportunity to save previously, therefore delete all autosaved files
            $autosavedSessionOdeFilesToMaintain = 0;

            $result = $this->odeService->closeOdeSession($odeSessionId, $autosavedSessionOdeFilesToMaintain, $databaseUser);

            // If it's a shared session remove user sync changes from BBDD
            $this->currentOdeUsersSyncChangesService->removeSyncActionsByUser($databaseUser);

            if (!empty($result['responseMessage'])) {
                $responseData['responseMessage'] = $result['responseMessage'];
            }

            if (isset($result['odeNavStructureSyncsDeleted'])) {
                $responseData['odeNavStructureSyncsDeleted'] = $result['odeNavStructureSyncsDeleted'];
            }

            if (isset($result['currentOdeUsersDeleted'])) {
                $responseData['currentOdeUsersDeleted'] = $result['currentOdeUsersDeleted'];
            }
        } else {
            $this->logger->error('invalid data', ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/ode/elp/open', methods: ['POST'], name: 'api_odes_ode_elp_open')]
    public function openElpAction(Request $request)
    {
        $responseData = [];

        // Collect parameters
        $elpFileName = $request->get('elpFileName');
        $odeSessionId = $request->get('odeSessionId');
        $forceCloseOdeUserPreviousSession = $request->get('forceCloseOdeUserPreviousSession');

        if (
            $request->request->has('forceCloseOdeUserPreviousSession')
            && (('true' == $forceCloseOdeUserPreviousSession) || ('1' == $forceCloseOdeUserPreviousSession))
        ) {
            $forceCloseOdeUserPreviousSession = true;
        } else {
            $forceCloseOdeUserPreviousSession = false;
        }

        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        $clientIp = $request->getClientIp();

        try {
            // Check content in the xml and return values
            $odeValues = $this->odeService->checkContentXmlAndCurrentUser(
                $odeSessionId,
                $elpFileName,
                $databaseUser,
                $forceCloseOdeUserPreviousSession
            );

            if ('OK' !== $odeValues['responseMessage']) {
                $responseData['responseMessage'] = $odeValues['responseMessage'];
                $jsonData = $this->getJsonSerialized($responseData);

                return new JsonResponse($jsonData, $this->status, [], true);
            }

            // Create the structure in database and update current user
            $result = $this->odeService->createElpStructureAndCurrentOdeUser(
                $elpFileName,
                $user,
                $databaseUser,
                $clientIp,
                $forceCloseOdeUserPreviousSession,
                $odeValues
            );
        } catch (UserAlreadyOpenSessionException $e) {
            $result['responseMessage'] = 'error: '.$e->getMessage();
            $responseData['responseMessage'] = $result['responseMessage'];
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        if (!empty($odeValues['responseMessage'])) {
            $responseData['responseMessage'] = $odeValues['responseMessage'];
        }
        if (!empty($odeValues['odeId'])) {
            $responseData['odeId'] = $odeValues['odeId'];
        }
        if (!empty($odeValues['odeVersionId'])) {
            $responseData['odeVersionId'] = $odeValues['odeVersionId'];
        }
        if (!empty($odeValues['odeSessionId'])) {
            $responseData['odeSessionId'] = $odeValues['odeSessionId'];
        }
        if (!empty($odeValues['odeVersionName'])) {
            $responseData['odeVersionName'] = $odeValues['odeVersionName'];
        }
        if (!empty($odeValues['theme'])) {
            $responseData['theme'] = $odeValues['theme'];
        }
        if (!empty($odeValues['themeDir'])) {
            $responseData['themeDir'] = $odeValues['themeDir'];
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/ode/local/elp/open', methods: ['POST'], name: 'api_odes_ode_local_elp_open')]
    public function openLocalElpAction(Request $request)
    {
        $responseData = [];

        // Collect parameters
        $elpFileName = $request->get('odeFileName');
        $elpFilePath = $request->get('odeFilePath');
        $forceCloseOdeUserPreviousSession = $request->get('forceCloseOdeUserPreviousSession');

        if (
            $request->request->has('forceCloseOdeUserPreviousSession')
            && (('true' == $forceCloseOdeUserPreviousSession) || ('1' == $forceCloseOdeUserPreviousSession))
        ) {
            $forceCloseOdeUserPreviousSession = true;
        } else {
            $forceCloseOdeUserPreviousSession = false;
        }

        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        $clientIp = $request->getClientIp();

        try {
            // Set locale (TODO: error translator returns to default locale)
            // Get properties of user
            $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
            $localeUserPreferences = $databaseUserPreferences['locale']->getValue();
            $this->translator->setLocale($localeUserPreferences);

            // Check if it's a zip by filename of archive
            $ext = pathinfo($elpFileName, PATHINFO_EXTENSION);
            $zipArchive = str_contains($ext, Constants::FILE_EXTENSION_ZIP);

            // Check if is a zip and have an elp inside or have a content.xml
            if ($zipArchive) {
                $zipResult = $this->odeService->checkEditableZipFile($elpFileName, $elpFilePath, $databaseUser);

                if ('OK' !== $zipResult['responseMessage']) {
                    $responseData['responseMessage'] = $zipResult['responseMessage'];
                    $jsonData = $this->getJsonSerialized($responseData);

                    return new JsonResponse($jsonData, $this->status, [], true);
                }

                $elpFileName = $zipResult['elpName'];
                $elpFilePath = $zipResult['elpPath'];
            }

            // Check content in the xml and return values
            try {
                $odeValues = $this->odeService->checkLocalOdeFile(
                    $elpFileName,
                    $elpFilePath,
                    $databaseUser,
                    $forceCloseOdeUserPreviousSession
                );
            } catch (\Exception $e) {
                $result['responseMessage'] = $this->translator->trans('The file content is wrong');
                $responseData['responseMessage'] = $result['responseMessage'];

                $jsonData = $this->getJsonSerialized($responseData);

                return new JsonResponse($jsonData, $this->status, [], true);
            }

            if ('OK' !== $odeValues['responseMessage']) {
                $responseData['responseMessage'] = $odeValues['responseMessage'];
                $jsonData = $this->getJsonSerialized($responseData);

                return new JsonResponse($jsonData, $this->status, [], true);
            }

            // Create the structure in database and update current user
            $result = $this->odeService->createElpStructureAndCurrentOdeUser(
                $elpFileName,
                $user,
                $databaseUser,
                $clientIp,
                $forceCloseOdeUserPreviousSession,
                $odeValues
            );
        } catch (UserAlreadyOpenSessionException $e) {
            $result['responseMessage'] = 'error: '.$e->getMessage();
            $responseData['responseMessage'] = $result['responseMessage'];

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        if (!empty($odeValues['responseMessage'])) {
            $responseData['responseMessage'] = $odeValues['responseMessage'];
        }
        if (!empty($odeValues['odeId'])) {
            $responseData['odeId'] = $odeValues['odeId'];
        }
        if (!empty($odeValues['odeVersionId'])) {
            $responseData['odeVersionId'] = $odeValues['odeVersionId'];
        }
        if (!empty($odeValues['odeSessionId'])) {
            $responseData['odeSessionId'] = $odeValues['odeSessionId'];
        }
        if (!empty($odeValues['odeVersionName'])) {
            $responseData['odeVersionName'] = $odeValues['odeVersionName'];
        }
        if (!empty($odeValues['theme'])) {
            $responseData['theme'] = $odeValues['theme'];
        }
        if (!empty($odeValues['themeDir'])) {
            $responseData['themeDir'] = $odeValues['themeDir'];
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/ode/local/xml/properties/open', methods: ['POST'], name: 'api_odes_ode_local_xml_properties_open')]
    public function openLocalXmlPropertiesAction(Request $request)
    {
        $responseData = [];

        // Collect parameters
        $xmlFileName = $request->get('odeFileName');
        $xmlFilePath = $request->get('odeFilePath');
        $forceCloseOdeUserPreviousSession = true;
        $isImportProperties = true;

        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        $clientIp = $request->getClientIp();

        try {
            // Check if it's a xml by filename of archive
            $ext = pathinfo($xmlFileName, PATHINFO_EXTENSION);
            $xmlArchive = str_contains($ext, Constants::FILE_EXTENSION_XML);

            // Check if is a zip and have an elp inside
            if ($xmlArchive) {
                // Check content in the xml and return values
                $odeValues = $this->odeService->checkLocalXmlProperties(
                    $xmlFileName,
                    $xmlFilePath,
                    $databaseUser,
                    $forceCloseOdeUserPreviousSession
                );

                if ('OK' !== $odeValues['responseMessage']) {
                    $responseData['responseMessage'] = $odeValues['responseMessage'];
                    $jsonData = $this->getJsonSerialized($responseData);

                    return new JsonResponse($jsonData, $this->status, [], true);
                }

                // Create the structure in database and update current user
                $result = $this->odeService->createElpStructure(
                    $user,
                    $odeValues,
                    false,
                    null,
                    $isImportProperties
                );
            }
        } catch (UserAlreadyOpenSessionException $e) {
            $result['responseMessage'] = 'error: '.$e->getMessage();
            $responseData['responseMessage'] = $result['responseMessage'];

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        if (!empty($odeValues['responseMessage'])) {
            $responseData['responseMessage'] = $odeValues['responseMessage'];
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/ode/multiple/local/elp/open', methods: ['POST'], name: 'api_odes_ode_multiple_local_elp_open')]
    public function openMultipleLocalElpAction(Request $request)
    {
        $responseData = [];
        $odeValues = [];

        // Collect parameters
        $elpFiles = $request->get('odeFiles');
        $elpFilesNames = $elpFiles['odeFileName'];
        $elpFilesPath = $elpFiles['odeFilePath'];
        $odeNavStructureSyncId = $request->get('odeNavStructureSyncId');

        $odeNavStructureSync = null;
        if (Constants::ROOT_NODE_IDENTIFIER != $odeNavStructureSyncId) {
            $odeNavStructureSyncRepository = $this->entityManager->getRepository(OdeNavStructureSync::class);
            $odeNavStructureSync = $odeNavStructureSyncRepository->find($odeNavStructureSyncId);
        }

        $user = $this->getUser();
        $dbUser = $this->userHelper->getDatabaseUser($user);

        //  Get ode files
        for ($i = 0; $i < count($elpFilesNames); ++$i) {
            // Check if zip have an elp inside
            $zipResult = $this->odeService->checkEditableZipFile(
                $elpFilesNames[$i],
                $elpFilesPath[$i],
                $dbUser
            );

            if ('OK' !== $zipResult['responseMessage']) {
                continue;
            }

            $elpFilesNames[$i] = $zipResult['elpName'];
            $elpFilesPath[$i] = $zipResult['elpPath'];

            // Check content in the xml and return values
            $odeValues[$i] = $this->odeService->checkMultipleLocalOdeFile(
                $elpFilesNames[$i],
                $elpFilesPath[$i],
                $dbUser,
                true,
                false,
                $odeNavStructureSync
            );
        }

        // Create the structure in database
        try {
            $this->odeService->createElpStructure($user, $odeValues, false, $odeNavStructureSync);
        } catch (\Exception $e) {
            $responseData['responseMessage'] = $e->getMessage();
        }

        $responseData['responseMessage'] = 'OK';

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/get/user/ode/list', methods: ['GET'], name: 'api_odes_user_get_ode_list')]
    public function getUserOdeListAction(Request $request)
    {
        $responseData = [];

        $odeFilesSyncRepo = $this->entityManager->getRepository(OdeFiles::class);

        $userLogged = $this->getUser();

        // User name
        $userLoggedName = $this->userHelper->getLoggedUserName($userLogged);

        // Autosave constant
        $autosave = Settings::COUNT_USER_AUTOSAVE_SPACE_ODE_FILES;

        $onlyManualSave = false;

        $odeFilesSync = $odeFilesSyncRepo->listOdeFilesByUser($userLoggedName, $onlyManualSave);

        // Create ode file dto
        $odeFilesDto = [];
        foreach ($odeFilesSync as $odeFileSync) {
            $odeFileDto = new OdeFilesDto();
            $odeFileDto->loadFromEntity($odeFileSync);
            array_push($odeFilesDto, $odeFileDto);
        }

        $responseData['odeFiles'] = FileUtil::getOdeFilesDiskSpace($odeFilesDto, $autosave);

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/get/user/recent/ode/list', methods: ['GET'], name: 'api_odes_get_user_recent_ode_list')]
    public function getUserRecentOdeListAction(Request $request)
    {
        $odeFilesSyncRepo = $this->entityManager->getRepository(OdeFiles::class);

        $userLogged = $this->getUser();

        // User name
        $userLoggedName = $this->userHelper->getLoggedUserName($userLogged);

        $odeFilesSync = $odeFilesSyncRepo->listRecentOdeFilesByUser($userLoggedName);

        // Create ode file dto
        $odeFilesDto = [];
        foreach ($odeFilesSync as $odeFileSync) {
            $odeFileDto = new OdeFilesDto();
            $odeFileDto->loadFromEntity($odeFileSync);
            array_push($odeFilesDto, $odeFileDto);
        }

        $responseData = $odeFilesDto;

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/remove/ode/file', methods: ['POST'], name: 'api_odes_remove_ode_file')]
    public function removeOdeFileAction(Request $request)
    {
        $odeFilesSyncRepo = $this->entityManager->getRepository(OdeFiles::class);

        $odeFileId = $request->get('id');
        $odeFilesId = $request->get('odeFilesId');

        if (!empty($odeFileId)) {
            $odeFileSync = $odeFilesSyncRepo->find($odeFileId);

            if (!empty($odeFileSync)) {
                $responseData = $this->odeService->removeElpFromServer($odeFileSync);
            }

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        } else {
            foreach ($odeFilesId as $odeFileId) {
                $odeFileSync = $odeFilesSyncRepo->find($odeFileId);

                if (!empty($odeFileSync)) {
                    $responseData = $this->odeService->removeElpFromServer($odeFileSync);
                }
            }
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }
    }

    #[Route('/remove/date/ode/files', methods: ['POST'], name: 'api_odes_remove_date_ode_files')]
    public function removeOdeFilesByDateAction(Request $request)
    {
        $odeFilesSyncRepo = $this->entityManager->getRepository(OdeFiles::class);

        // Get parameters
        $msDate = $request->get('date');
        $secondsDate = $msDate / 1000;
        $dateString = date('Y-m-d H:i:s', $secondsDate);
        $date = new \DateTime($dateString);

        // User name
        $userLogged = $this->getUser();
        $userLoggedName = $this->userHelper->getLoggedUserName($userLogged);

        if (!empty($date)) {
            $odeFilesSync = $odeFilesSyncRepo->listOdeFilesByDate($userLoggedName, $date);

            if (!empty($odeFilesSync)) {
                foreach ($odeFilesSync as $odeFileSync) {
                    $responseData = $this->odeService->removeElpFromServer($odeFileSync);
                }
            } else {
                $responseData = 'error';
            }

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }
    }

    #[Route('/properties/{odeSessionId}/get', methods: ['GET'], name: 'api_odes_properties_get')]
    public function getOdePropertiesAction(Request $request, $odeSessionId)
    {
        $responseData = [];

        $user = $this->getUser();

        // Load odeProperties from database
        $databaseOdePropertiesData = $this->odeService->getOdePropertiesFromDatabase($odeSessionId, $user);

        $odePropertiesDtos = [];
        foreach ($databaseOdePropertiesData as $odeProperties) {
            $odePropertiesDto = new OdePropertiesSyncDto();
            $odePropertiesDto->loadFromEntity($odeProperties);
            $odePropertiesDtos[$odePropertiesDto->getKey()] = $odePropertiesDto;
        }

        $responseData['odeProperties'] = $odePropertiesDtos;

        // Detect locale
        $detectedLocale = $request->getLocale();
        $allowedLocales = array_keys(Settings::LOCALES);
        $localeToUse = in_array($detectedLocale, $allowedLocales) ? $detectedLocale : Settings::DEFAULT_LOCALE;

        // Apply locale to all language-related properties
        $languageKeys = [
            'pp_lang',
            'lom_general_title_language',
            'lom_general_language',
            'lom_general_description_string_language',
            'lom_general_keyword_string_language',
            'lom_general_coverage_string_language',
            'lom_lifeCycle_version_string_language',
            'lom_technical_installationRemarks_string_language',
            'lom_metaMetadata_language',
            'lom_technical_otherPlatformRequirements_string_language',
            'lom_educational_typicalAgeRange_string_language',
            'lom_educational_description_string_language',
            'lom_educational_language',
            'lom_rights_description_string_language',
            'lom_annotation_description_string_language',
            'lom_classification_taxonPath_taxon_entry_string_language',
            'lom_classification_description_string_language',
            'lom_classification_keyword_string_language',
        ];

        foreach ($languageKeys as $key) {
            if (isset($responseData['odeProperties'][$key])) {
                if (empty($responseData['odeProperties'][$key]->getValue())) {
                    $responseData['odeProperties'][$key]->setValue($localeToUse);
                }
            }
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/properties/save', methods: ['PUT'], name: 'api_odes_properties_save')]
    public function saveOdePropertiesAction(Request $request)
    {
        $responseData = [];
        $propertiesData = [];

        $user = $this->getUser();

        $odeSessionId = $request->get('odeSessionId');
        $databaseOdePropertiesData = $this->odeService->getOdePropertiesFromDatabase($odeSessionId, $user);

        // Get current database properties values
        $databaseOdePropertiesOldValues = [];
        foreach ($databaseOdePropertiesData as $key => $property) {
            $databaseOdePropertiesOldValues[$key] = $property->getValue();
        }

        // Metada properties
        foreach (Properties::ODE_PROPERTIES_CONFIG as $category => $properties) {
            foreach ($properties as $odePropertiesConfigKey => $odePropertiesConfigValues) {
                if (isset($databaseOdePropertiesData[$odePropertiesConfigKey])) {
                    $propertiesDataProperties = $this->odeService->saveOdeProperty(
                        $this->entityManager,
                        $request,
                        $odeSessionId,
                        $databaseOdePropertiesData,
                        $odePropertiesConfigValues,
                        $odePropertiesConfigKey
                    );
                    $propertiesData += $propertiesDataProperties;
                }
            }
        }

        // Metadata cataloguing
        foreach (Properties::ODE_CATALOGUING_CONFIG as $category => $properties) {
            foreach ($properties as $odePropertiesConfigKey => $odePropertiesConfigValues) {
                if (isset($databaseOdePropertiesData[$odePropertiesConfigKey])) {
                    $propertiesDataCataloguing = $this->odeService->saveOdeProperty(
                        $this->entityManager,
                        $request,
                        $odeSessionId,
                        $databaseOdePropertiesData,
                        $odePropertiesConfigValues,
                        $odePropertiesConfigKey
                    );
                    $propertiesData += $propertiesDataCataloguing;
                }
            }
        }

        $this->entityManager->flush();

        $odePropertiesDtos = [];
        foreach ($propertiesData as $odeProperties) {
            $odePropertiesDto = new OdePropertiesSyncDto();
            $odePropertiesDto->loadFromEntity($odeProperties);
            $odePropertiesDtos[$odePropertiesDto->getKey()] = $odePropertiesDto;
        }

        $responseData['responseMessage'] = 'OK';
        $responseData['odeProperties'] = $odePropertiesDtos;

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/ode/local/large/elp/open', methods: ['POST'], name: 'api_odes_ode_local_large_elp_open')]
    public function uploadLargeOdeFilesAction(Request $request)
    {
        $responseData = [];

        $user = $this->getUser();

        // Set locale (TODO: error translator returns to default locale)
        // Get properties of user
        $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
        $localeUserPreferences = $databaseUserPreferences['locale']->getValue();
        $this->translator->setLocale($localeUserPreferences);

        $odeSessionId = $request->request->get('odeSessionId');

        // Get the request size
        $contentLength = $request->server->get('CONTENT_LENGTH');
        // Get the maximum size allowed in uploading files from the corresponding configuration in php.ini
        $maxFileSize = ini_get('upload_max_filesize');
        $maxFileSizeBytes = false;

        // In case of obtaining the 2 values ​​correctly,
        // we make the necessary checks to be able to know if the size of the file in the request is
        // greater than what is allowed
        if ($contentLength && $maxFileSize) {
            $unit = ['KB', 'MB', 'GB', 'TB', 'PB'];
            $unit_match = array_search(strtoupper(substr($maxFileSize, -2)), $unit);
            if (false === $unit_match) {
                $unit = ['B', 'K', 'M', 'G', 'T', 'P'];
                $unit_match = array_search(strtoupper(substr($maxFileSize, -1)), $unit);
            }
            $maxFileSizeBytes = intval($maxFileSize) * pow(
                1024,
                false === $unit_match ? 0 : $unit_match
            );

            $this->logger->info(
                'file size: large-elp-open',
                [
                    'upload_max_filesize' => $maxFileSize,
                    'upload_max_filesize_bytes' => $maxFileSizeBytes,
                    'file_length' => $contentLength,
                    'file:' => $this,
                    'line' => __LINE__,
                ]
            );
        }
        // Check if size of the file in the request is greater than what is allowed
        if ($contentLength && $maxFileSize && $contentLength > $maxFileSizeBytes) {
            $this->logger->error(
                'file is too large',
                ['file:' => $this, 'line' => __LINE__]
            );
            $responseData['responseMessage'] = $this->translator->trans('File is too large');
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        } else {
            // If the file size is correct, we get the file data
            $odeFile = $request->files->get('odeFilePart');
            // In case there is an error getting the data from the file, return a generic error
            if (null === $odeFile) {
                $this->logger->error(
                    'error uploading file',
                    ['file:' => $this, 'line' => __LINE__]
                );
                $responseData['responseMessage'] = $this->translator->trans('Failed to upload file');
                $jsonData = $this->getJsonSerialized($responseData);

                return new JsonResponse($jsonData, $this->status, [], true);
            }
        }

        // Get data and destination path to the ode file
        $odeSessionTpmDir = $this->fileHelper->getOdeSessionTmpDir($odeSessionId);
        $odeFileDestinationPath = $odeSessionTpmDir.$request->request->get('odeFileName');

        $odeFileData = file_get_contents($odeFile->getPathname());
        file_put_contents($odeFileDestinationPath, $odeFileData, FILE_APPEND);

        $responseData['odeFilePath'] = $odeFileDestinationPath;
        $responseData['odeFileName'] = $request->request->get('odeFileName');
        $responseData['responseMessage'] = 'OK';

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/clean/init/autosave/elp/', methods: ['POST'], name: 'api_odes_clean_init_autosave_elp')]
    public function cleanInitAutosaveElpAction(Request $request)
    {
        $responseData = [];

        // collect parameters
        $odeSessionId = $request->get('odeSessionId');

        // User name
        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        // if $odeSessionId is set load data from database
        if (!empty($odeSessionId)) {
            // The user has had the opportunity to save previously, therefore delete all autosaved files
            $autosavedSessionOdeFilesToMaintain = 0;

            $result = $this->odeService->cleanAutosavesByUser($odeSessionId, $autosavedSessionOdeFilesToMaintain, $databaseUser);

            if (!empty($result['responseMessage'])) {
                $responseData['responseMessage'] = $result['responseMessage'];
            }
        } else {
            $this->logger->error('invalid data', ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }
}
