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
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersSyncChangesServiceInterface;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/current-ode-users-management/current-ode-user')]
class CurrentOdeUsersApiController extends DefaultApiController
{
    public const SESSION_ID_URL_PARAMETER = '?shareCode=';
    public const URL_WORKAREA_ROUTE = 'workarea';

    private $userHelper;
    private $currentOdeUsersService;
    private $currentOdeUsersSyncChangesService;

    public function __construct(EntityManagerInterface $entityManager, LoggerInterface $logger, UserHelper $userHelper, CurrentOdeUsersServiceInterface $currentOdeUsersService, CurrentOdeUsersSyncChangesServiceInterface $currentOdeUsersSyncChangesService)
    {
        $this->userHelper = $userHelper;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->currentOdeUsersSyncChangesService = $currentOdeUsersSyncChangesService;

        parent::__construct($entityManager, $logger);
    }

    #[Route('/get/user/by/current/component/id', methods: ['GET'], name: 'get_user_by_current_component_id')]
    public function getUserByCurrentComponentId(Request $request)
    {
        $currentComponentId = $request->query->get('current_component_id');
        $userData = $this->entityManager->createQuery(
            'SELECT c.user FROM App\Entity\net\exelearning\Entity\CurrentOdeUsers c 
         WHERE c.currentComponentId = :componentId'
        )
            ->setParameter('componentId', $currentComponentId)
            ->setMaxResults(1)
            ->getOneOrNullResult(\Doctrine\ORM\Query::HYDRATE_SCALAR); // Solo datos escalares
        $jsonData = $this->getJsonSerialized($userData);

        return new JsonResponse($jsonData, $this->status, [], true);
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

        // Check if user has already an open session
        $currentOdeUserForUser = $currentOdeUsersRepository->getCurrentSessionForUser($databaseUser->getUserIdentifier());

        // If there isn't currentOdeUser for user create a new session
        if (empty($currentOdeUserForUser)) {
            $odeId = Util::generateId();
            $odeVersionId = Util::generateId();
            $odeSessionId = Util::generateId();

            $clientIp = $request->getClientIp();

            $currentOdeUserForUser = $this->currentOdeUsersService->createCurrentOdeUsers($odeId, $odeVersionId, $odeSessionId, $databaseUser, $clientIp);
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

        // Get parameters
        $odeSessionId = $request->get('odeSessionId');
        $odeNavStructureSyncId = $request->get('odeNavStructureSyncId');
        $odeBlockId = $request->get('blockId');
        $odeIdeviceId = $request->get('odeIdeviceId');
        // Active or deactive flags
        $odeComponentFlag = $request->get('odeComponentFlag');
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

        // Get odeNav
        $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
        $odeNavStructureSync = $odeNavStructureSyncRepo->find($odeNavStructureSyncId);

        // Check current_idevice of concurrent users
        $isIdeviceFree = $this->currentOdeUsersService->checkIdeviceCurrentOdeUsers($odeSessionId, $odeIdeviceId, $odeBlockId, $user);

        if ($isIdeviceFree) {
            // Update CurrentOdeUsers
            $this->currentOdeUsersService->updateCurrentIdevice($odeNavStructureSync, $odeBlockId, $odeIdeviceId, $databaseUser, $odeCurrentUsersFlags);

            $responseData['responseMessage'] = 'OK';
        } else {
            $responseData['responseMessage'] = 'An user has an idevice open on this block';
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

        // Check current_idevice of concurrent users
        $isIdeviceFree = $this->currentOdeUsersService->checkIdeviceCurrentOdeUsers($odeSessionId, $odeIdeviceId, $odeBlockId, $user);

        if ($isIdeviceFree) {
            $responseData['responseMessage'] = 'OK';
        } else {
            $responseData['responseMessage'] = 'An user has an idevice open on this block';
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
        // Get parameters
        $odeSessionId = $request->get('odeSessionId');
        $odeIdeviceId = $request->get('odeIdeviceId');
        $odeBlockId = $request->get('blockId');
        $odePagId = $request->get('odePageId');
        $destinationPageId = $request->get('destinationPageId');
        $actionType = $request->get('actionType');

        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        // If not empty odPagId synchronize changes even if you're not on the same page
        if (!empty($odePagId)) {
            // Cases: reloadNav, theme or properties
            $userThemeValue = $this->userHelper->getUserPreferencesFromDatabase($user)['theme']->getValue();
            $this->currentOdeUsersSyncChangesService->activatePageSyncUpdateFlag($odeSessionId, $odePagId, $user, $actionType, $userThemeValue);
        } else {
            $this->currentOdeUsersSyncChangesService->activateSyncUpdateFlag($odeSessionId, $odeIdeviceId, $odeBlockId, $odePagId, $user, $actionType, $destinationPageId);
        }
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
        // Get the user odeSessionId
        $currentOdeSessionId = $currentOdeSessionForUser->getOdeSessionId();

        // Base URL
        $symfonyBaseUrl = $request->getSchemeAndHttpHost();
        $symfonyBasePath = $request->getBaseURL();
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
}
