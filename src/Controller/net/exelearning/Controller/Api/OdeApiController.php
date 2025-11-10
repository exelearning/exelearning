<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;
use App\Entity\net\exelearning\Dto\OdeCurrentUsersDto;
use App\Entity\net\exelearning\Dto\OdeFilesDto;
use App\Entity\net\exelearning\Dto\OdeLastUpdatedDto;
use App\Entity\net\exelearning\Dto\OdeNavStructureSyncDto;
use App\Entity\net\exelearning\Dto\OdeNavStructureSyncListDto;
use App\Entity\net\exelearning\Dto\OdePropertiesSyncDto;
use App\Entity\net\exelearning\Dto\UserPreferencesDto;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Entity\net\exelearning\Entity\OdePropertiesSync;
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
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;
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
        SerializerInterface $serializer,
        HubInterface $hub,
    ) {
        $this->fileHelper = $fileHelper;
        $this->odeService = $odeService;
        $this->odeComponentsSyncService = $odeComponentsSyncService;
        $this->userHelper = $userHelper;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->currentOdeUsersSyncChangesService = $currentOdeUsersSyncChangesService;
        $this->translator = $translator;

        parent::__construct($entityManager, $logger, $serializer, $hub);
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
        if ($this->getParameter('app.version_control')) {
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
                        $this->logger->error(
                            'Insufficient space for manual save',
                            [
                                'usedSpace' => $e->getUsedSpace(),
                                'maxSpace' => $e->getMaxSpace(),
                                'requiredSpace' => $e->getRequiredSpace(),
                                'availableSpace' => $e->getAvailableSpace(),
                                'user' => $user->getUsername(),
                                'file:' => $this,
                                'line' => __LINE__,
                            ]
                        );
                        $responseData['responseMessage'] = 'error: '.$this->formatInsufficientSpaceMessage($e);
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

        $this->publish(
            $odeSessionId,
            'save-menu-head-button'
        );

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
        if ($this->getParameter('app.autosave_ode_files_function')) {
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
                        $this->logger->error(
                            'Insufficient space for autosave',
                            [
                                'usedSpace' => $e->getUsedSpace(),
                                'maxSpace' => $e->getMaxSpace(),
                                'requiredSpace' => $e->getRequiredSpace(),
                                'availableSpace' => $e->getAvailableSpace(),
                                'user' => $user->getUsername(),
                                'file:' => $this,
                                'line' => __LINE__,
                            ]
                        );
                        // Remove save flag active
                        $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);
                        $responseData['responseMessage'] = 'error: '.$this->formatInsufficientSpaceMessage($e);
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
                ['autosaveFunction' => $this->getParameter('app.autosave_ode_files_function'), 'file:' => $this, 'line' => __LINE__]
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
        if ($this->getParameter('app.version_control')) {
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
                            $this->logger->error(
                                'Insufficient space for save as',
                                [
                                    'usedSpace' => $e->getUsedSpace(),
                                    'maxSpace' => $e->getMaxSpace(),
                                    'requiredSpace' => $e->getRequiredSpace(),
                                    'availableSpace' => $e->getAvailableSpace(),
                                    'user' => $user->getUsername(),
                                    'file:' => $this,
                                    'line' => __LINE__,
                                ]
                            );
                            $responseData['responseMessage'] = 'error: '.$this->formatInsufficientSpaceMessage($e);
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

    /**
     * Checks if the user should be asked to save before leaving the ODE session.
     */
    #[Route('/check/before/leave/ode/session', methods: ['POST'], name: 'api_odes_check_before_leave_ode_session')]
    public function checkBeforeLeaveOdeSessionAction(Request $request): JsonResponse
    {
        $odeSessionId = (string) $request->get('odeSessionId');
        $odeVersionId = $request->get('odeVersionId');
        $odeId = $request->get('odeId');

        $responseData = [];

        if ('' === $odeSessionId) {
            $this->logger->error('invalid data', ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]);
            $responseData['responseMessage'] = 'error: invalid data';

            return new JsonResponse($this->getJsonSerialized($responseData), $this->status, [], true);
        }

        $baselineInstant = $this->resolveSessionBaselineInstant($odeId, $odeSessionId);
        $componentCount = $this->countEntitiesForSession(OdeComponentsSync::class, $odeSessionId);
        $navCount = $this->countEntitiesForSession(OdeNavStructureSync::class, $odeSessionId);

        $hasDirtyComponents = $this->hasEntityChangesAfter(OdeComponentsSync::class, $odeSessionId, $baselineInstant);
        $hasDirtyBlocks = $this->hasEntityChangesAfter(OdePagStructureSync::class, $odeSessionId, $baselineInstant);
        $hasDirtyNav = $this->hasEntityChangesAfter(OdeNavStructureSync::class, $odeSessionId, $baselineInstant);
        $hasDirtyProperties = $this->hasTrackedPropertyChanges($odeSessionId, $baselineInstant);

        $hasPendingChanges = $hasDirtyComponents || $hasDirtyBlocks || $hasDirtyNav || $hasDirtyProperties;

        if ($hasPendingChanges) {
            $responseData['askSave'] = true;
        } elseif (0 === $componentCount && $navCount <= 1) {
            $responseData['leaveEmptySession'] = true;
        } else {
            $responseData['leaveSession'] = true;
        }

        return new JsonResponse($this->getJsonSerialized($responseData), $this->status, [], true);
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

        // Collect parameters from both form data and JSON body
        $elpFileName = $request->get('odeFileName') ?? $request->getPayload()->get('odeFileName');
        $elpFilePath = $request->get('odeFilePath') ?? $request->getPayload()->get('odeFilePath');
        $forceCloseOdeUserPreviousSession = $request->get('forceCloseOdeUserPreviousSession') ?? $request->getPayload()->get('forceCloseOdeUserPreviousSession');

        $themesInstallationEnabled = $this->getParameter('app.online_themes_install');
        $isOnline = $this->getParameter('app.online_mode');

        // Convert forceCloseOdeUserPreviousSession to boolean
        // Accept: true (bool), 'true' (string), '1' (string), 1 (int)
        // Reject: false (bool), 'false' (string), '0' (string), 0 (int), null, anything else
        if ((true === $forceCloseOdeUserPreviousSession)
            || ('true' === $forceCloseOdeUserPreviousSession)
            || ('1' === $forceCloseOdeUserPreviousSession)
            || (1 === $forceCloseOdeUserPreviousSession)
        ) {
            $forceCloseOdeUserPreviousSession = true;
        } else {
            $forceCloseOdeUserPreviousSession = false;
        }

        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        $clientIp = $request->getClientIp();

        try {
            // Validate required parameters
            if (empty($elpFileName) || empty($elpFilePath)) {
                $responseData['responseMessage'] = $this->translator->trans('Missing file name or path');
                $jsonData = $this->getJsonSerialized($responseData);

                return new JsonResponse($jsonData, $this->status, [], true);
            }

            // Set locale (TODO: error translator returns to default locale)
            // Get properties of user
            $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
            $localeUserPreferences = $databaseUserPreferences['locale']->getValue();
            $this->translator->setLocale($localeUserPreferences);

            // Validate file size before processing
            if (!empty($elpFilePath) && file_exists($elpFilePath)) {
                $fileSize = filesize($elpFilePath);
                $uploadLimit = $this->getEffectiveUploadLimit();

                if (false !== $fileSize && $fileSize > $uploadLimit['bytes']) {
                    $this->logger->error(
                        'File exceeds PHP upload limit',
                        [
                            'fileName' => $elpFileName,
                            'fileSize' => $fileSize,
                            'fileSizeFormatted' => $this->formatBytes($fileSize),
                            'uploadLimit' => $uploadLimit['bytes'],
                            'uploadLimitFormatted' => $uploadLimit['formatted'],
                            'limitingFactor' => $uploadLimit['limit_name'],
                            'file:' => $this,
                            'line' => __LINE__,
                        ]
                    );

                    $responseData['responseMessage'] = sprintf(
                        'error: File size (%s) exceeds the maximum allowed size (%s). Please increase %s in PHP configuration.',
                        $this->formatBytes($fileSize),
                        $uploadLimit['formatted'],
                        $uploadLimit['limit_name']
                    );
                    $jsonData = $this->getJsonSerialized($responseData);

                    return new JsonResponse($jsonData, $this->status, [], true);
                }
            }

            // Check if it's a zip by filename of archive
            $ext = pathinfo($elpFileName, PATHINFO_EXTENSION);
            $zipArchive = str_contains($ext, Constants::FILE_EXTENSION_ZIP) || str_contains($ext, Constants::FILE_EXTENSION_EPUB);

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
            } catch (UserAlreadyOpenSessionException $e) {
                // Re-throw session exceptions to be handled by outer catch
                throw $e;
            } catch (\Throwable $e) {
                $this->logger->error(
                    'Error checking local ODE file: '.$e->getMessage(),
                    [
                        'exception' => get_class($e),
                        'message' => $e->getMessage(),
                        'elpFileName' => $elpFileName,
                        'elpFilePath' => $elpFilePath,
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                        'trace' => $e->getTraceAsString(),
                        'file:' => $this,
                        'line:' => __LINE__,
                    ]
                );

                $responseData['responseMessage'] = $this->translator->trans('The file content is wrong').': '.$e->getMessage();
                $jsonData = $this->getJsonSerialized($responseData);

                return new JsonResponse($jsonData, $this->status, [], true);
            }

            // Verify that odeValues is not empty
            if (empty($odeValues)) {
                $this->logger->error(
                    'checkLocalOdeFile returned empty result',
                    [
                        'elpFileName' => $elpFileName,
                        'elpFilePath' => $elpFilePath,
                        'file:' => $this,
                        'line' => __LINE__,
                    ]
                );

                $responseData['responseMessage'] = 'error: Failed to process file - empty result from service';
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
        } catch (\Throwable $e) {
            $this->logger->error(
                'Unexpected error in openLocalElpAction: '.$e->getMessage(),
                [
                    'exception' => get_class($e),
                    'message' => $e->getMessage(),
                    'elpFileName' => $elpFileName ?? 'unknown',
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'trace' => $e->getTraceAsString(),
                    'file:' => $this,
                    'line:' => __LINE__,
                ]
            );

            $responseData['responseMessage'] = 'error: Unexpected error while opening file - '.$e->getMessage();
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
        if (!empty($odeValues['themeInstallable'])) {
            $responseData['authorized'] = $odeValues['themeInstallable'];
        } else {
            $responseData['authorized'] = false;
        }

        if ($isOnline && !$themesInstallationEnabled) {
            $responseData['authorized'] = false;
        }

        return $this->json($responseData, $this->status);
    }

    #[Route('/ode/local/elp/import-root', methods: ['POST'], name: 'api_odes_ode_local_elp_import_root')]
    public function importElpToRootAction(Request $request): JsonResponse
    {
        $responseData = [];
        $odeSessionId = $request->request->get('odeSessionId');
        $uploadedFile = $request->files->get('file');

        if (empty($odeSessionId) || empty($uploadedFile)) {
            $responseData['responseMessage'] = 'error: invalid data';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $tempFilePath = null;

        try {
            $tmpDir = $this->fileHelper->getOdeSessionTmpDir($odeSessionId);
            if (false === $tmpDir) {
                throw new \RuntimeException('Unable to access temporary directory');
            }

            $extension = $uploadedFile->guessExtension() ?: $uploadedFile->getClientOriginalExtension() ?: 'zip';
            $tempFileName = 'import-root-'.Util::generateId().'.'.$extension;
            $uploadedFile->move($tmpDir, $tempFileName);
            $tempFilePath = $tmpDir.DIRECTORY_SEPARATOR.$tempFileName;

            $odeNavStructureRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
            $existingRootNodes = $odeNavStructureRepo->findBy(
                [
                    'odeSessionId' => $odeSessionId,
                    'odeNavStructureSync' => null,
                ]
            );

            $maxRootOrder = 0;
            foreach ($existingRootNodes as $rootNode) {
                $maxRootOrder = max($maxRootOrder, (int) $rootNode->getOdeNavStructureSyncOrder());
            }

            $this->odeService->importElpPages($tempFilePath, $odeSessionId, null, $maxRootOrder);

            $responseData['responseMessage'] = 'OK';
            $responseData['structure'] = $this->buildNavStructureListDto($odeSessionId);

            $this->publish($odeSessionId, 'structure-changed');
        } catch (\Throwable $throwable) {
            $this->logger->error(
                'Error importing ELP into root: '.$throwable->getMessage(),
                [
                    'file' => $throwable->getFile(),
                    'line' => $throwable->getLine(),
                    'odeSessionId' => $odeSessionId,
                    'file:' => $this,
                    'line' => __LINE__,
                ]
            );
            $responseData['responseMessage'] = 'error: import failed';
        } finally {
            if (!empty($tempFilePath) && file_exists($tempFilePath)) {
                FileUtil::removeFile($tempFilePath);
            }
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    /**
     * Import a previously uploaded file into the root by server local path.
     * Accepts JSON: { odeSessionId, odeFileName, odeFilePath }.
     */
    #[Route('/ode/import/local/root', methods: ['POST'], name: 'api_odes_ode_local_elp_import_root_from_local')]
    public function importElpToRootFromLocalAction(Request $request): JsonResponse
    {
        $responseData = [];

        // Parse JSON body (relies on DefaultApiController::hydrateRequestBody supporting POST)
        $this->hydrateRequestBody($request);

        $odeSessionId = $request->get('odeSessionId');
        $odeFileName = $request->get('odeFileName');
        $odeFilePath = $request->get('odeFilePath');

        if (empty($odeSessionId) || empty($odeFileName) || empty($odeFilePath)) {
            $responseData['responseMessage'] = $this->translator->trans('Invalid request data');
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, JsonResponse::HTTP_BAD_REQUEST, [], true);
        }

        try {
            // Validate that the file exists and is in the correct temporary directory
            if (!file_exists($odeFilePath)) {
                throw new \RuntimeException($this->translator->trans('Uploaded file not found'));
            }

            // Validate file extension
            $extension = strtolower(pathinfo($odeFileName, PATHINFO_EXTENSION));
            $allowedExtensions = ['elpx', 'elp', 'zip'];
            if (!in_array($extension, $allowedExtensions, true)) {
                throw new \RuntimeException($this->translator->trans('Invalid file type'));
            }

            // Get existing root nodes to calculate max order
            $odeNavStructureRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
            $existingRootNodes = $odeNavStructureRepo->findBy(
                [
                    'odeSessionId' => $odeSessionId,
                    'odeNavStructureSync' => null,
                ]
            );

            $maxRootOrder = 0;
            foreach ($existingRootNodes as $rootNode) {
                $maxRootOrder = max($maxRootOrder, (int) $rootNode->getOdeNavStructureSyncOrder());
            }

            // Import the ELP pages
            $this->odeService->importElpPages($odeFilePath, $odeSessionId, null, $maxRootOrder);

            $responseData['responseMessage'] = 'OK';
            $responseData['structure'] = $this->buildNavStructureListDto($odeSessionId);

            $this->publish($odeSessionId, 'structure-changed');
        } catch (\Throwable $throwable) {
            $this->logger->error(
                'Error importing ELP from local path: '.$throwable->getMessage(),
                [
                    'file' => $throwable->getFile(),
                    'line' => $throwable->getLine(),
                    'odeSessionId' => $odeSessionId,
                    'odeFileName' => $odeFileName,
                    'odeFilePath' => $odeFilePath,
                    'file:' => $this,
                    'line' => __LINE__,
                ]
            );
            $message = $throwable->getMessage();
            $responseData['responseMessage'] = $this->translator->trans('Import error').': '.$message;
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
        $autosave = $this->getParameter('app.count_user_autosave_space_ode_files');

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
        $this->hydrateRequestBody($request);

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
        $this->publish($odeSessionId, 'new-content-published'); // 'structure-changed'

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

        // Get the request size (size of the chunk being uploaded)
        $contentLength = $request->server->get('CONTENT_LENGTH');
        $uploadLimit = $this->getEffectiveUploadLimit();

        $this->logger->info(
            'File upload chunk received',
            [
                'uploadLimitFormatted' => $uploadLimit['formatted'],
                'uploadLimitBytes' => $uploadLimit['bytes'],
                'limitingFactor' => $uploadLimit['limit_name'],
                'chunkSize' => $contentLength,
                'chunkSizeFormatted' => $this->formatBytes((int) $contentLength),
                'file:' => $this,
                'line' => __LINE__,
            ]
        );

        // Check if chunk size exceeds the upload limit
        if ($contentLength && $contentLength > $uploadLimit['bytes']) {
            $this->logger->error(
                'Upload chunk exceeds PHP upload limit',
                [
                    'chunkSize' => $contentLength,
                    'chunkSizeFormatted' => $this->formatBytes((int) $contentLength),
                    'uploadLimit' => $uploadLimit['bytes'],
                    'uploadLimitFormatted' => $uploadLimit['formatted'],
                    'limitingFactor' => $uploadLimit['limit_name'],
                    'file:' => $this,
                    'line' => __LINE__,
                ]
            );

            $responseData['responseMessage'] = sprintf(
                'error: %s. Chunk size (%s) exceeds maximum allowed (%s). Increase %s in PHP configuration.',
                $this->translator->trans('File is too large'),
                $this->formatBytes((int) $contentLength),
                $uploadLimit['formatted'],
                $uploadLimit['limit_name']
            );
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

    /**
     * Gets the effective upload size limit in bytes.
     *
     * Returns the minimum value between:
     * - Application configured limit (FILE_UPLOAD_MAX_SIZE from .env)
     * - PHP upload_max_filesize
     * - PHP post_max_size
     * - PHP memory_limit
     *
     * This ensures the most restrictive limit is enforced.
     *
     * @return array{bytes: int, formatted: string, limit_name: string}
     */
    private function getEffectiveUploadLimit(): array
    {
        // Get PHP limits
        $uploadMaxFilesize = ini_get('upload_max_filesize');
        $postMaxSize = ini_get('post_max_size');
        $memoryLimit = ini_get('memory_limit');

        // Convert PHP ini values to bytes
        $uploadMaxBytes = $this->convertPhpIniToBytes($uploadMaxFilesize);
        $postMaxBytes = $this->convertPhpIniToBytes($postMaxSize);
        $memoryLimitBytes = $this->convertPhpIniToBytes($memoryLimit);

        // Get application configured limit from .env (in MB)
        $appMaxUploadMB = $this->getParameter('app.file_upload_max_size');
        $appMaxUploadBytes = $appMaxUploadMB * 1024 * 1024;

        // Find the minimum (most restrictive) limit
        $limits = [
            'app.file_upload_max_size' => $appMaxUploadBytes,
            'upload_max_filesize' => $uploadMaxBytes,
            'post_max_size' => $postMaxBytes,
            'memory_limit' => $memoryLimitBytes,
        ];

        $minLimit = min($limits);
        $limitName = array_search($minLimit, $limits);

        return [
            'bytes' => $minLimit,
            'formatted' => $this->formatBytes($minLimit),
            'limit_name' => $limitName,
        ];
    }

    /**
     * Converts PHP ini size value (e.g., "512M", "2G") to bytes.
     *
     * @param string $value PHP ini size value
     *
     * @return int Size in bytes
     */
    private function convertPhpIniToBytes(string $value): int
    {
        $value = trim($value);

        // Unlimited
        if ('-1' === $value) {
            return PHP_INT_MAX;
        }

        $unit = strtoupper(substr($value, -1));
        $number = (int) substr($value, 0, -1);

        // If no unit or just a number, return as is
        if (!$unit || is_numeric($unit)) {
            return (int) $value;
        }

        switch ($unit) {
            case 'G':
                return $number * 1024 * 1024 * 1024;
            case 'M':
                return $number * 1024 * 1024;
            case 'K':
                return $number * 1024;
            default:
                return (int) $value;
        }
    }

    /**
     * Formats bytes to human-readable format (KB, MB, GB).
     *
     * @param int $bytes Size in bytes
     *
     * @return string Formatted size (e.g., "512 MB")
     */
    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= (1024 ** $pow);

        return round($bytes, 2).' '.$units[$pow];
    }

    /**
     * Formats a user-friendly error message for insufficient space exceptions.
     *
     * @param UserInsufficientSpaceException $e The exception with space details
     *
     * @return string Formatted error message with space information
     */
    private function formatInsufficientSpaceMessage(UserInsufficientSpaceException $e): string
    {
        $usedSpaceFormatted = $this->formatBytes($e->getUsedSpace());
        $maxSpaceFormatted = $this->formatBytes($e->getMaxSpace());
        $requiredSpaceFormatted = $this->formatBytes($e->getRequiredSpace());
        $availableSpaceFormatted = $this->formatBytes($e->getAvailableSpace());

        return $this->translator->trans(
            'Insufficient storage space. You are using {usedSpace} of {maxSpace}. The file requires {requiredSpace}, but you only have {availableSpace} available. Please delete some files to free up space.',
            [
                '{usedSpace}' => $usedSpaceFormatted,
                '{maxSpace}' => $maxSpaceFormatted,
                '{requiredSpace}' => $requiredSpaceFormatted,
                '{availableSpace}' => $availableSpaceFormatted,
            ]
        );
    }

    /**
     * Determines when the session content last matched the persisted version.
     */
    private function resolveSessionBaselineInstant(?string $odeId, string $odeSessionId): \DateTimeImmutable
    {
        $lastPersistedAt = null;

        if (!empty($odeId)) {
            $lastFile = $this->entityManager->getRepository(OdeFiles::class)->getLastFileForOde($odeId);
            if ($lastFile && $lastFile->getUpdatedAt() instanceof \DateTimeInterface) {
                $lastPersistedAt = \DateTimeImmutable::createFromMutable($lastFile->getUpdatedAt());
            }
        }

        $currentUsersRepo = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $sessionUsers = $currentUsersRepo->findBy(['odeSessionId' => $odeSessionId]);

        $sessionCreatedAt = null;
        foreach ($sessionUsers as $sessionUser) {
            $createdAt = $sessionUser->getCreatedAt();
            if ($createdAt instanceof \DateTimeInterface) {
                $createdImmutable = \DateTimeImmutable::createFromMutable($createdAt);
                if (null === $sessionCreatedAt || $createdImmutable < $sessionCreatedAt) {
                    $sessionCreatedAt = $createdImmutable;
                }
            }
        }

        if ($sessionCreatedAt instanceof \DateTimeImmutable) {
            if (null === $lastPersistedAt || $sessionCreatedAt > $lastPersistedAt) {
                $lastPersistedAt = $sessionCreatedAt;
            }
        }

        return $lastPersistedAt ?? new \DateTimeImmutable();
    }

    /**
     * Counts persisted entities for a given session.
     */
    private function countEntitiesForSession(string $entityClass, string $odeSessionId): int
    {
        return (int) $this->entityManager->createQueryBuilder()
            ->select('COUNT(e.id)')
            ->from($entityClass, 'e')
            ->andWhere('e.odeSessionId = :sid')
            ->setParameter('sid', $odeSessionId)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Checks whether any entity instances were updated after the provided timestamp.
     */
    private function hasEntityChangesAfter(string $entityClass, string $odeSessionId, \DateTimeImmutable $since): bool
    {
        $count = $this->entityManager->createQueryBuilder()
            ->select('COUNT(e.id)')
            ->from($entityClass, 'e')
            ->andWhere('e.odeSessionId = :sid')
            ->andWhere('(e.updatedAt >= :since OR (e.updatedAt IS NULL AND e.createdAt >= :since))')
            ->setParameter('sid', $odeSessionId)
            ->setParameter('since', $since)
            ->getQuery()
            ->getSingleScalarResult();

        return (int) $count > 0;
    }

    /**
     * Checks if tracked project metadata fields changed after the provided timestamp.
     */
    private function hasTrackedPropertyChanges(string $odeSessionId, \DateTimeImmutable $since): bool
    {
        $trackedKeys = ['pp_title', 'pp_author', 'pp_description', 'pp_extraHeadContent', 'footer'];

        $count = $this->entityManager->createQueryBuilder()
            ->select('COUNT(p.id)')
            ->from(OdePropertiesSync::class, 'p')
            ->andWhere('p.odeSessionId = :sid')
            ->andWhere('p.key IN (:keys)')
            ->andWhere('(p.updatedAt >= :since OR (p.updatedAt IS NULL AND p.createdAt >= :since))')
            ->setParameter('sid', $odeSessionId)
            ->setParameter('keys', $trackedKeys)
            ->setParameter('since', $since)
            ->getQuery()
            ->getSingleScalarResult();

        return (int) $count > 0;
    }

    /**
     * Builds a navigation structure DTO list for the requested session.
     */
    private function buildNavStructureListDto(string $odeSessionId): OdeNavStructureSyncListDto
    {
        $repo = $this->entityManager->getRepository(OdeNavStructureSync::class);
        $navStructure = $repo->getNavStructure($odeSessionId);

        $responseData = new OdeNavStructureSyncListDto();
        $responseData->setOdeSessionId($odeSessionId);

        $loadOdePagStructureSyncs = false;
        $loadOdeComponentsSync = false;
        $loadOdeNavStructureSyncProperties = true;
        $loadOdePagStructureSyncProperties = false;
        $loadOdeComponentsSyncProperties = false;

        foreach ($navStructure as $navStructureElem) {
            $structure = new OdeNavStructureSyncDto();
            $structure->loadFromEntity(
                $navStructureElem,
                $loadOdePagStructureSyncs,
                $loadOdeComponentsSync,
                $loadOdeNavStructureSyncProperties,
                $loadOdePagStructureSyncProperties,
                $loadOdeComponentsSyncProperties
            );
            $responseData->addStructure($structure);
        }

        return $responseData;
    }
}
