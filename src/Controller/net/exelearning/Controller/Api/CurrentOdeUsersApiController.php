<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;
use App\Entity\net\exelearning\Dto\CurrentOdeUsersDto;
use App\Entity\net\exelearning\Dto\OdePagStructureSyncDto;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\CurrentOdeUsersSyncChanges;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Entity\Project\OdeEditLock;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersSyncChangesServiceInterface;
use App\Service\Project\OdeEditLockService;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

#[Route('/api/current-ode-users-management/current-ode-user')]
class CurrentOdeUsersApiController extends DefaultApiController
{
    public const SESSION_ID_URL_PARAMETER = '?shareCode=';
    public const URL_WORKAREA_ROUTE = 'workarea';

    private $userHelper;
    private $translator;
    private $currentOdeUsersService;
    private $currentOdeUsersSyncChangesService;
    private $lockService;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        UserHelper $userHelper,
        TranslatorInterface $translator,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        CurrentOdeUsersSyncChangesServiceInterface $currentOdeUsersSyncChangesService,
        SerializerInterface $serializer,
        HubInterface $hub,
        OdeEditLockService $lockService,
    ) {
        $this->userHelper = $userHelper;
        $this->translator = $translator;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->currentOdeUsersSyncChangesService = $currentOdeUsersSyncChangesService;
        $this->lockService = $lockService;

        parent::__construct($entityManager, $logger, $serializer, $hub);
    }

    #[Route('/user/get', methods: ['GET'], name: 'api_current_ode_users_for_user_get')]
    public function getCurrentOdeUsersForUserAction(Request $request)
    {
        $responseData = [];
        $responseData['isAlreadyLoggedAndLastUser'] = false;

        $isNewSession = false;

        $user = $this->getUser();

        $databaseUser = $this->userHelper->getDatabaseUser($user);

        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);

        $this->userHelper->saveUserTheme($user, Constants::THEME_DEFAULT);

        // Get client IP for session tracking
        $clientIp = $request->getClientIp();

        // Check if user has already an open session
        $requestedSessionId = $request->query->get('odeSessionId');
        $requestedProjectId = $request->query->get('projectId') ?? $request->query->get('project');
        $forceNewSession = filter_var(
            $request->query->get('forceNewSession'),
            FILTER_VALIDATE_BOOL
        );

        $currentOdeUserForUser = null;

        // MULTI-USER COLLABORATION: If specific sessionId is provided, try to join that session
        if ($requestedSessionId && !$forceNewSession) {
            // First check if this session exists (regardless of owner)
            $existingSession = $currentOdeUsersRepository->findOneBy(['odeSessionId' => $requestedSessionId]);

            if ($existingSession) {
                // Check if user is already in this session
                $userSessionInExisting = $currentOdeUsersRepository->isUserInSession(
                    $requestedSessionId,
                    $databaseUser->getUserIdentifier()
                );

                if ($userSessionInExisting) {
                    // User already has a session entry - use it
                    $currentOdeUserForUser = $currentOdeUsersRepository->getCurrentSessionForUser(
                        $databaseUser->getUserIdentifier(),
                        $requestedSessionId
                    );
                } else {
                    // Session exists but user is not in it yet - join it
                    $sessionData = $this->currentOdeUsersService->joinExistingSession(
                        $requestedSessionId,
                        $existingSession->getOdeId(),
                        $existingSession->getOdeVersionId(),
                        $databaseUser,
                        $clientIp
                    );

                    $currentOdeUserForUser = $sessionData['session'];
                    $isNewSession = false; // Joining existing session
                }
            } else {
                // Session doesn't exist
                return new JsonResponse([
                    'responseMessage' => 'SESSION_NOT_FOUND',
                ], JsonResponse::HTTP_NOT_FOUND);
            }
        }
        // MULTI-USER COLLABORATION: If projectId is provided, get or create shared session for that project
        elseif ($requestedProjectId && !$forceNewSession) {
            $this->logger->info('Handling projectId request', [
                'projectId' => $requestedProjectId,
                'user' => $databaseUser->getUserIdentifier(),
            ]);

            // Use the shared session logic - all users on same project share same session
            $sessionData = $this->currentOdeUsersService->getOrCreateSessionForProject(
                $requestedProjectId,
                $databaseUser,
                $clientIp
            );

            $currentOdeUserForUser = $sessionData['session'];
            $isNewSession = $sessionData['isNewSession'];

            // Ensure Project entity exists for this projectId
            $projectRepo = $this->entityManager->getRepository(Project::class);
            $existingProject = $projectRepo->find($requestedProjectId);

            if (!$existingProject) {
                // Create new Project entity
                $project = new Project();
                $project->setId($requestedProjectId);
                $project->setTitle('New Project');
                $project->setOwner($databaseUser);
                $project->setVisibility('private');
                $project->setArchived(false);

                $this->entityManager->persist($project);

                // Create ProjectCollaborator entry for the owner
                $collaborator = new ProjectCollaborator();
                $collaborator->setProject($project);
                $collaborator->setUser($databaseUser);
                $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
                $collaborator->setGrantedBy($databaseUser);

                $this->entityManager->persist($collaborator);
                $this->entityManager->flush();

                $this->logger->info('Created Project entity for projectId', [
                    'projectId' => $requestedProjectId,
                ]);
            }

            $this->logger->info('Session obtained for projectId', [
                'projectId' => $requestedProjectId,
                'sessionId' => $currentOdeUserForUser->getOdeSessionId(),
                'isNewSession' => $isNewSession,
            ]);
        }
        // LEGACY: Check if user already has their own session
        elseif (!$forceNewSession) {
            $currentOdeUserForUser = $currentOdeUsersRepository->getCurrentSessionForUser(
                $databaseUser->getUserIdentifier(),
                null
            );
        }

        // If there isn't currentOdeUser for user create a new session
        if (empty($currentOdeUserForUser)) {
            $odeId = Util::generateId();
            $odeVersionId = Util::generateId();
            $odeSessionId = Util::generateId();

            $currentOdeUserForUser = $this->currentOdeUsersService->createCurrentOdeUsers($odeId, $odeVersionId, $odeSessionId, $databaseUser, $clientIp);

            // Create corresponding Project entity for the new session
            $projectRepo = $this->entityManager->getRepository(Project::class);
            $existingProject = $projectRepo->find($odeId);

            if (!$existingProject) {
                $project = new Project();
                $project->setId($odeId);
                $project->setTitle('New Project'); // Default title, will be updated on first save
                $project->setOwner($databaseUser);
                $project->setVisibility('private');
                $project->setArchived(false);

                $this->entityManager->persist($project);

                // Create ProjectCollaborator entry for the owner
                $collaborator = new ProjectCollaborator();
                $collaborator->setProject($project);
                $collaborator->setUser($databaseUser);
                $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
                $collaborator->setGrantedBy($databaseUser);

                $this->entityManager->persist($collaborator);
                $this->entityManager->flush();
            }

            $isNewSession = true;
        } else {
            // Check if it's last user to show modal to the already logged user
            $isLastUser = $this->currentOdeUsersService->isLastUser($user, null, null, $currentOdeUserForUser->getOdeSessionId());
            if ($isLastUser) {
                // get time now and compare to date in BBDD
                $userLastAction = $currentOdeUserForUser->getLastAction();
                $userLastAction = $userLastAction->format('Y-m-d H:i:s');
                $userLastAction = strtotime($userLastAction);
                $timenow = time();
                $userTimeBetween = $timenow - $userLastAction;

                // Compare user time between to the seconds established in constants
                $modalClientAlreadyLoggedUserTime = Constants::MODAL_CLIENT_ALREADY_LOGGED_USER_TIME;
                if ($modalClientAlreadyLoggedUserTime <= $userTimeBetween) {
                    $responseData['isAlreadyLoggedAndLastUser'] = true;
                }
            }
        }

        $currentOdeUsersDto = null;
        if (!empty($currentOdeUserForUser)) {
            $currentOdeUsersDto = new CurrentOdeUsersDto();
            $currentOdeUsersDto->loadFromEntity($currentOdeUserForUser);
        }

        $responseData['responseMessage'] = 'OK';
        $responseData['currentOdeUsers'] = $currentOdeUsersDto;
        $responseData['isNewSession'] = $isNewSession;

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/update/api/current/ode/user/flag', methods: ['POST'], name: 'update_api_current_ode_user_flag')]
    public function updateCurrentOdeUserFlagAction(Request $request)
    {
        $responseData = [];

        // Debug the incoming request
        $this->logger->info('Force Unlock Debug - Request payload: '.json_encode($request->request->all()));

        // Get parameters with proper type casting
        $odeComponentFlag = $request->get('odeComponentFlag');

        // Get parameters
        $odeSessionId = $request->get('odeSessionId');
        $odeNavStructureSyncId = $request->get('odeNavStructureSyncId');
        $odeBlockId = $request->get('blockId');
        $odeIdeviceId = $request->get('odeIdeviceId');
        $actionType = $request->get('actionType');
        $pageId = $request->get('pageId');

        // Active or deactive flags
        $odePagStructureFlag = $request->get('odePagStructureFlag');
        $odeNavStructureFlag = $request->get('odeNavStructureFlag');

        // Create flag array
        $odeCurrentUsersFlags = [
            'odeComponentFlag' => $odeComponentFlag,
            'odePagStructureFlag' => $odePagStructureFlag,
            'odeNavStructureFlag' => $odeNavStructureFlag,
        ];

        $user = $this->getUser();

        $databaseUser = $this->userHelper->getDatabaseUser($user);

        // Validate odeNavStructureSyncId is not empty
        if (empty($odeNavStructureSyncId)) {
            $responseData['responseMessage'] = 'Missing navigation node identifier';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, JsonResponse::HTTP_BAD_REQUEST, [], true);
        }

        // Get odeNav
        $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
        $odeNavStructureSync = $odeNavStructureSyncRepo->find($odeNavStructureSyncId);

        if (!$odeNavStructureSync instanceof OdeNavStructureSync) {
            $responseData['responseMessage'] = 'Invalid navigation node identifier';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, JsonResponse::HTTP_BAD_REQUEST, [], true);
        }

        try {
            $userEmail = $databaseUser->getUserIdentifier();

            // PESSIMISTIC LOCKING: Check/acquire lock before allowing edit
            if ('true' === $odeComponentFlag) {
                // User wants to START editing - acquire lock
                $lockResult = $this->lockService->acquireLock(
                    $odeSessionId,
                    OdeEditLock::RESOURCE_TYPE_IDEVICE,
                    $odeIdeviceId,
                    $userEmail
                );

                if (!$lockResult['success']) {
                    $responseData['responseMessage'] = $this->translator->trans(
                        'Another user is editing this iDevice: %user%',
                        ['%user%' => $lockResult['lockedBy']]
                    );
                    $responseData['lockedBy'] = $lockResult['lockedBy'];
                    $jsonData = $this->getJsonSerialized($responseData);

                    return new JsonResponse($jsonData, JsonResponse::HTTP_LOCKED, [], true);
                }

                $this->logger->info('Lock acquired for iDevice editing', [
                    'odeSessionId' => $odeSessionId,
                    'odeIdeviceId' => $odeIdeviceId,
                    'user' => $userEmail,
                ]);
            } else {
                // User wants to STOP editing - release lock
                if (null !== $odeIdeviceId) {
                    $this->lockService->releaseLock(
                        $odeSessionId,
                        OdeEditLock::RESOURCE_TYPE_IDEVICE,
                        $odeIdeviceId,
                        $userEmail
                    );

                    $this->logger->info('Lock released for iDevice', [
                        'odeSessionId' => $odeSessionId,
                        'odeIdeviceId' => $odeIdeviceId,
                        'user' => $userEmail,
                    ]);
                }
            }

            // LEGACY: Also check using old flag system (backward compatibility)
            $isIdeviceFree = $this->currentOdeUsersService->checkIdeviceCurrentOdeUsers(
                $odeSessionId,
                $odeIdeviceId,
                $odeBlockId,
                $user
            );

            if ($isIdeviceFree) {
                // Update CurrentOdeUsers flags
                $updated = $this->currentOdeUsersService->updateCurrentIdevice(
                    $odeNavStructureSync,
                    $odeBlockId,
                    $odeIdeviceId,
                    $databaseUser,
                    $odeCurrentUsersFlags
                );

                if (null === $updated) {
                    // Failed to update - release lock we just acquired
                    if ('true' === $odeComponentFlag && null !== $odeIdeviceId) {
                        $this->lockService->releaseLock(
                            $odeSessionId,
                            OdeEditLock::RESOURCE_TYPE_IDEVICE,
                            $odeIdeviceId,
                            $userEmail
                        );
                    }

                    $responseData['responseMessage'] = 'Unable to register the current edition session';
                    $jsonData = $this->getJsonSerialized($responseData);

                    return new JsonResponse($jsonData, JsonResponse::HTTP_CONFLICT, [], true);
                }

                $expiresAt = (new \DateTime())->modify('+'.Constants::RESOURCE_LOCK_TIMEOUT_SECONDS.' seconds')->getTimestamp();

                $message = 'blockId:'.$odeBlockId.
                            ',odeIdeviceId:'.$odeIdeviceId.
                            ',odeComponentFlag:'.$odeComponentFlag.
                            ',user:'.$databaseUser->getUserIdentifier().
                            ',editing:true'.
                            ',timeIdeviceEditing:'.time().
                            ',actionType:'.$actionType.
                            ',pageId:'.$pageId.
                            ',collaborativeMode:'.$this->getParameter('app.collaborative_block_level');

                if ('true' !== $odeComponentFlag) {
                    $message .= ',editing:false';
                }

                $this->publish($odeSessionId, $message);

                $responseData['responseMessage'] = 'OK';
            } else {
                // Legacy check failed - release lock if we acquired it
                if ('true' === $odeComponentFlag && null !== $odeIdeviceId) {
                    $this->lockService->releaseLock(
                        $odeSessionId,
                        OdeEditLock::RESOURCE_TYPE_IDEVICE,
                        $odeIdeviceId,
                        $userEmail
                    );
                }

                $responseData['responseMessage'] = $this->translator->trans('Another user is editing an iDevice on this block.');
            }
        } catch (\Exception $e) {
            // Make sure to release the lock in case of error
            $this->logger->error('Error updating user flag: '.$e->getMessage(), [
                'exception' => $e,
                'odeSessionId' => $odeSessionId ?? 'unknown',
                'odeIdeviceId' => $odeIdeviceId ?? 'unknown',
            ]);

            // Try to release lock on error
            if (isset($userEmail) && isset($odeSessionId) && isset($odeIdeviceId)) {
                try {
                    $this->lockService->releaseLock(
                        $odeSessionId,
                        OdeEditLock::RESOURCE_TYPE_IDEVICE,
                        $odeIdeviceId,
                        $userEmail
                    );
                } catch (\Exception $lockException) {
                    $this->logger->error('Failed to release lock on error: '.$lockException->getMessage());
                }
            }

            return new JsonResponse(
                ['responseMessage' => 'Internal server error'],
                JsonResponse::HTTP_INTERNAL_SERVER_ERROR
            );
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/check/ode/component/flag/current/ode/users', methods: ['POST'], name: 'check_ode_component_flag_current_ode_users')]
    public function checkOdeComponentFlagCurrentOdeUsersAction(Request $request)
    {
        $responseData = [];

        // Get parameters
        $odeSessionId = $request->get('odeSessionId');
        $odeNavStructureSyncId = $request->get('odeNavStructureSyncId');
        $odeBlockId = $request->get('blockId');
        $odeIdeviceId = $request->get('odeIdeviceId');

        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);
        $userEmail = $databaseUser->getUserIdentifier();

        // PESSIMISTIC LOCKING: Check if resource is locked
        $lockStatus = $this->lockService->checkLock(
            $odeSessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $odeIdeviceId,
            $userEmail
        );

        if (!$lockStatus['isLocked'] || $lockStatus['canEdit']) {
            // Resource is free or locked by current user
            $responseData['responseMessage'] = 'OK';
            $responseData['canEdit'] = true;

            if ($lockStatus['isLocked']) {
                $responseData['lockedBy'] = $userEmail;
                $responseData['isOwnLock'] = true;
            }
        } else {
            // Resource is locked by another user
            $responseData['responseMessage'] = $this->translator->trans(
                'Another user is editing this iDevice: %user%',
                ['%user%' => $lockStatus['lockedBy']]
            );
            $responseData['canEdit'] = false;
            $responseData['lockedBy'] = $lockStatus['lockedBy'];
            $responseData['isOwnLock'] = false;
        }

        // LEGACY: Also check using old flag system (for backward compatibility)
        $isIdeviceFree = $this->currentOdeUsersService->checkIdeviceCurrentOdeUsers(
            $odeSessionId,
            $odeIdeviceId,
            $odeBlockId,
            $user
        );

        if (!$isIdeviceFree) {
            // Legacy system says it's locked - override response
            $responseData['responseMessage'] = $this->translator->trans('Another user is editing an iDevice on this block.');
            $responseData['canEdit'] = false;
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/api/current/ode/users/on/page/id', methods: ['POST'], name: 'current_ode_users_on_page_id')]
    public function currentOdeUsersOnPageIdAction(Request $request)
    {
        // Get parameters
        $odeSessionId = $request->get('odeSessionId');

        // Get user
        $user = $this->getUser();

        // Check if any user is on the same page
        $response = $this->currentOdeUsersService->checkCurrentUsersOnSamePage($odeSessionId, $user);

        $responseData = $response;
        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/current/ode/users/update/flag', methods: ['POST'], name: 'current_ode_users_update_flag')]
    public function currentOdeUsersUpdateFlagAction(Request $request)
    {
        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        // Get parameters
        $odeSessionId = $request->get('odeSessionId');
        $odeIdeviceId = $request->get('odeIdeviceId');
        $odeBlockId = $request->get('blockId');
        $odePagId = $request->get('odePageId');
        $destinationPageId = $request->get('destinationPageId');
        $actionType = $request->get('actionType');
        $userEmail = $databaseUser->getUserIdentifier();
        $odeComponentFlag = $request->get('odeComponentFlag');
        $timeIdeviceEditing = $request->get('timeIdeviceEditing');
        $pageId = $request->get('pageId'); // Collaborative

        // Only process sync flags if we have a valid odeSessionId
        if ($odeSessionId) {
            // If not empty odPagId synchronize changes even if you're not on the same page
            if (!empty($odePagId)) {
                // Cases: reloadNav, theme or properties
                $userThemeValue = $this->userHelper->getUserPreferencesFromDatabase($user)['theme']->getValue();
                $this->currentOdeUsersSyncChangesService->activatePageSyncUpdateFlag($odeSessionId, $odePagId, $user, $actionType, $userThemeValue);
            } else {
                $this->currentOdeUsersSyncChangesService->activateSyncUpdateFlag($odeSessionId, $odeIdeviceId, $odeBlockId, $odePagId, $user, $actionType, $destinationPageId);
            }
        }

        $this->publishOdeBlockStatusEvent(
            $odeSessionId,
            $odeBlockId,
            $odeIdeviceId,
            $actionType,
            $userEmail,
            $odeComponentFlag,
            $timeIdeviceEditing,
            $pageId // Collaborative
        );

        $responseData['responseMessage'] = 'OK';
        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/current/ode/user/sync', methods: ['POST'], name: 'current_ode_user_sync')]
    public function currentOdeUserSyncAction(Request $request)
    {
        // Repositories
        $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);

        // Get user
        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        // Get currentOdeUser
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());

        // If no active session exists, return early with "No changes" to avoid triggering logout modal
        if (null === $currentSessionForUser) {
            $responseData['responseMessage'] = 'No changes';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $isOdeUpdate = $currentSessionForUser->getSyncUpdateFlag();

        if ($isOdeUpdate) {
            $responseData['syncChanges'] = [];

            // Get list of sync changes
            $currentOdeUsersSyncChangesRepository = $this->entityManager->getRepository(CurrentOdeUsersSyncChanges::class);
            $currentOdeUsersSyncChangesForUser = $currentOdeUsersSyncChangesRepository->getSyncChangesListByUser($user->getUsername());

            // Get all user synchronize changes from BBDD
            foreach ($currentOdeUsersSyncChangesForUser as $currentOdeUsersSyncChangeForUser) {
                $syncChange = [];

                // Get OdeComponentSyncId
                $odeComponentSyncId = $currentOdeUsersSyncChangeForUser->getOdeComponentIdUpdate();
                $odeBlockId = $currentOdeUsersSyncChangeForUser->getOdeBlockIdUpdate();
                $odePageId = $currentOdeUsersSyncChangeForUser->getOdePageIdUpdate();
                $destinationPageId = $currentOdeUsersSyncChangeForUser->getDestinationPageIdUpdate();
                $actionType = $currentOdeUsersSyncChangeForUser->getActionTypeUpdate();
                $styleThemeValueId = $currentOdeUsersSyncChangeForUser->getStyleThemeIdUpdate();

                if ('DELETE' !== $actionType) {
                    if (!empty($odeComponentSyncId)) {
                        // Get OdeComponentSyncDto
                        $odeComponentSyncDto = $this->currentOdeUsersSyncChangesService->getCurrentIdeviceDto($user, $odeComponentSyncId);
                        $syncChange['odeComponentSync'] = $odeComponentSyncDto;
                    } elseif (!empty($odeBlockId)) {
                        // Get OdeComponentsBlock
                        $odeBlockSyncDto = $this->currentOdeUsersSyncChangesService->getCurrentBlockDto($user, $odeBlockId);
                        $syncChange['odeBlockSync'] = $odeBlockSyncDto;
                    } elseif (!empty($odePageId)) {
                        // Get OdePage
                        $odeNavSyncDto = $this->currentOdeUsersSyncChangesService->getCurrentPageDto($user, $odePageId);
                        $syncChange['odePageSync'] = $odeNavSyncDto;
                    }
                }

                $syncChange['actionType'] = $actionType;
                $syncChange['destinationPageId'] = $destinationPageId;
                $syncChange['odeComponentSyncId'] = $odeComponentSyncId;
                $syncChange['odeBlockId'] = $odeBlockId;
                $syncChange['odePageId'] = $odePageId;
                $syncChange['styleThemeValueId'] = $styleThemeValueId;

                array_push($responseData['syncChanges'], $syncChange);
            }

            $this->currentOdeUsersSyncChangesService->desactivateSyncUpdateFlag($user);
            $responseData['responseMessage'] = 'OK';
        } else {
            $responseData['responseMessage'] = 'No changes';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/get/current/block/update', methods: ['POST'], name: 'get_current_block_update')]
    public function getCurrentBlockUpdateAction(Request $request)
    {
        // Get user
        $user = $this->getUser();

        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUserIdentifier());

        // If no active session exists, return error
        if (null === $currentOdeSessionForUser) {
            $responseData['responseMessage'] = 'no_active_session';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Collect parameters
        $odeBlockId = $request->get('odeBlockId');

        $odeComponentsSyncRepository = $this->entityManager->getRepository(OdePagStructureSync::class);
        $odePagStructureSync = $odeComponentsSyncRepository->findBy(['odeBlockId' => $odeBlockId]);

        $userCurrentOdeBlockDto = new OdePagStructureSyncDto();
        $userCurrentOdeBlockDto->loadFromEntity($odePagStructureSync[0], true, true, true);

        $jsonData = $this->getJsonSerialized($userCurrentOdeBlockDto);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/get/ode/session/id/current/ode/user', methods: ['GET'], name: 'get_ode_session_id_current_ode_user')]
    public function getOdeSessionIdCurrentOdeUser(Request $request)
    {
        $response = [];

        // Get user
        $user = $this->getUser();

        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUserIdentifier());

        // If no active session exists, return error
        if (null === $currentOdeSessionForUser) {
            $response['responseMessage'] = 'no_active_session';
            $jsonData = $this->getJsonSerialized($response);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Get the user odeSessionId
        $currentOdeSessionId = $currentOdeSessionForUser->getOdeSessionId();

        // Base URL
        $symfonyBaseUrl = $request->getSchemeAndHttpHost();
        $symfonyBasePath = $this->getParameter('base_path') ?? '';
        $symfonyFullUrl = $symfonyBaseUrl.$symfonyBasePath;

        $response['shareSessionUrl'] = $symfonyFullUrl.Constants::SLASH.self::URL_WORKAREA_ROUTE.self::SESSION_ID_URL_PARAMETER.$currentOdeSessionId;

        $jsonData = $this->getJsonSerialized($response);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/check/current/users/ode/session/id', methods: ['POST'], name: 'check_current_users_ode_session_id')]
    public function checkCurrentUsersOdeSessionId(Request $request)
    {
        $response = [];

        // Get parameters
        $odeSessionId = $request->get('odeSessionId');

        // Get user
        $user = $this->getUser();

        // Check odeSessionId
        if (!empty($odeSessionId)) {
            $result = $this->currentOdeUsersService->checkOdeSessionIdCurrentUsers($odeSessionId, $user);
            if (!$result) {
                $response['responseMessage'] = 'Problem with session';
            } else {
                $response['responseMessage'] = 'OK';
                $this->currentOdeUsersService->updateSyncCurrentUserOdeId($odeSessionId, $user);
            }
        }

        $jsonData = $this->getJsonSerialized($response);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    private function publishOdeBlockStatusEvent(
        ?string $odeSessionId,
        ?string $odeBlockId,
        ?string $odeIdeviceId,
        ?string $actionType,
        string $userEmail,
        ?string $odeComponentFlag = null,
        ?string $timeIdeviceEditing = null,
        ?string $pageId = null, // Collaborative
    ): void {
        // Only publish if we have a valid odeSessionId
        if ($odeSessionId) {
            $this->publish(
                $odeSessionId,
                'blockId:'.$odeBlockId.
                ',odeIdeviceId:'.$odeIdeviceId.
                ',actionType:'.$actionType.
                ',user:'.$userEmail.
                ',odeComponentFlag:'.$odeComponentFlag.
                ',timeIdeviceEditing:'.$timeIdeviceEditing.
                ',pageId:'.$pageId // Collaborative
            );
        }
    }
}
