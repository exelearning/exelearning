<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeComponentsSyncServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeOperationsLogService;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/ode-operations-management/ode-operations')]
class OdeOperationsLogApiController extends DefaultApiController
{
    private FileHelper $fileHelper;
    private OdeServiceInterface $odeService;
    private OdeComponentsSyncServiceInterface $odeComponentsSyncService;
    private UserHelper $userHelper;
    private CurrentOdeUsersServiceInterface $currentOdeUsersService;
    private OdeOperationsLogService $odeOperationsLogService;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        FileHelper $fileHelper,
        OdeServiceInterface $odeService,
        OdeComponentsSyncServiceInterface $odeComponentsSyncService,
        UserHelper $userHelper,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        OdeOperationsLogService $odeOperationsLogService,
        SerializerInterface $serializer,
    ) {
        $this->fileHelper = $fileHelper;
        $this->odeService = $odeService;
        $this->odeComponentsSyncService = $odeComponentsSyncService;
        $this->userHelper = $userHelper;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->odeOperationsLogService = $odeOperationsLogService;

        parent::__construct($entityManager, $logger, $serializer);
    }

    #[Route('/get/ode/operation/log', methods: ['POST'], name: 'api_ode_operations_ode_operation_log_get')]
    public function getOdeOperationLogAction(Request $request)
    {
        // Collect paramaters
        $odeSessionId = $request->get('odeSessionId');
        $odeDestinationId = $request->get('odeDestinationId');
        $odeSourceId = $request->get('odeSourceId');
        $actionType = $request->get('actionType');
        $additionalData = $request->get('additionalData');

        // Get user
        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        // Insert operation on base
        $this->odeOperationsLogService->insertOperation(
            $odeSessionId,
            $user,
            $actionType,
            $odeSourceId,
            $odeDestinationId,
            $additionalData
        );

        $responseData['responseMessage'] = 'OK';

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/send/action/ode/operation', methods: ['GET'], name: 'api_ode_operations_send_action_ode_operation')]
    public function sendActionOdeOperationAction(Request $request)
    {
        // Get user
        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        // Get operation to do
        $odeOperationAction = $this->odeOperationsLogService->getActionFromLastOdeOperationLogFromUser($user);

        $jsonData = $this->getJsonSerialized($odeOperationAction);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/set/active/flag/ode/operation', methods: ['GET'], name: 'api_ode_operations_set_active_flag_ode_operation')]
    public function setActiveFlagAction(Request $request)
    {
        // Get last operation and set active flag to false
        $odeOperationSetActiveFlag = $this->odeOperationsLogService->setActiveFlagFromLastOdeOperationLog();

        $jsonData = $this->getJsonSerialized($odeOperationSetActiveFlag);

        return new JsonResponse($jsonData, $this->status, [], true);
    }
}
