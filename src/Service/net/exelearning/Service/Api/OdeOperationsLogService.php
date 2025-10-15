<?php

namespace App\Service\net\exelearning\Service\Api;

use App\Entity\net\exelearning\Dto\OdeComponentsSyncDto;
use App\Entity\net\exelearning\Dto\OdePagStructureSyncDto;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdeOperationsLog;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Entity\net\exelearning\Entity\User;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

class OdeOperationsLogService implements OdeOperationsLogServiceInterface
{
    private EntityManagerInterface $entityManager;
    private LoggerInterface $logger;
    private FileHelper $fileHelper;
    private CurrentOdeUsersServiceInterface $currentOdeUsersService;
    private UserHelper $userHelper;
    private TranslatorInterface $translator;

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
     * Get data of ode operation log and insert into bbdd.
     *
     * @param string $odeSessionId
     * @param string $user
     * @param string $actionType
     * @param string $sourceId
     * @param string $destinationId
     * @param string $additionalData
     *
     * @return bool
     */
    public function insertOperation($odeSessionId, $user, $actionType, $sourceId, $destinationId, $additionalData)
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUserIdentifier());

        // Odes Id from user
        $currentOdeVersionForUser = $currentOdeSessionForUser->getOdeVersionId();
        $currentOdeIdForUser = $currentOdeSessionForUser->getOdeId();

        // Get all the users from the session
        $currentOdeUsers = $currentOdeUsersRepository->findBy(['odeSessionId' => $odeSessionId]);

        foreach ($currentOdeUsers as $currentOdeUser) {
            if ($currentOdeUser->getUser() == $currentOdeSessionForUser->getUser()) {
                // Insert into ode_operations_log
                $odeOperationLog = new OdeOperationsLog();
                $odeOperationLog->setOdeId($currentOdeIdForUser);
                $odeOperationLog->setOdeVersionId($currentOdeVersionForUser);
                $odeOperationLog->setOdeSessionId($odeSessionId);
                $odeOperationLog->setOperation($actionType);
                $odeOperationLog->setDoneFlag(0);
                $odeOperationLog->setUser($currentOdeUser->getUser());
                $odeOperationLog->setAdditionalData($additionalData);

                // Set source as the element changed
                $odeOperationLog->setIdSource($sourceId);
                // Set destination on the page/block where the element changed
                $odeOperationLog->setIdDestination($destinationId);

                $this->entityManager->persist($odeOperationLog);
                $this->entityManager->flush();
            }
        }

        return true;
    }

    /**
     * Set active flag from last operation to false.
     *
     * @return array $response
     */
    public function setActiveFlagFromLastOdeOperationLog()
    {
        $response = [];
        // last ode log
        $odeOperationLogRepository = $this->entityManager->getRepository(OdeOperationsLog::class);
        $lastOperationLog = $odeOperationLogRepository->getLastOdeOperationLog();

        // Set isActive to false
        $lastOperationLog->setIsActive(0);

        $this->entityManager->persist($lastOperationLog);
        $this->entityManager->flush();

        $response['responseMessage'] = 'OK';

        return $response;
    }

    /**
     * Get last operation action and returns a response depending the action.
     *
     * @param User $user
     *
     * @return array $response
     */
    public function getActionFromLastOdeOperationLogFromUser($user)
    {
        $response = [];
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUserIdentifier());
        $currentOdeSessionId = $currentOdeSessionForUser->getOdeSessionId();

        // last ode log
        $odeOperationLogRepository = $this->entityManager->getRepository(OdeOperationsLog::class);
        $lastOperationLog = $odeOperationLogRepository->getLastOdeOperationLog();

        // Check if there are operations to undo
        if (!empty($lastOperationLog)) {
            $lastOperationLogUser = $lastOperationLog->getUser();
            $lastOperationAction = $lastOperationLog->getOperation();

            if (
                $lastOperationLogUser == $user->getUsername()
                && $lastOperationLog->getIsActive()
                && $lastOperationLog->getOdeSessionId() == $currentOdeSessionId
            ) {
                switch ($lastOperationAction) {
                    case 'ADD_IDEVICE':
                        $response = $this->odeOperationLogRemoveComponent($lastOperationLog);
                        $response['responseMessage'] = 'OK';
                        break;
                    case 'MOVE_BLOCK_TO':
                        $response = $this->odeOperationLogMoveBlockToSource($lastOperationLog);
                        $response['responseMessage'] = 'OK';
                        break;
                    case 'MOVE_IDEVICE_TO':
                        $response = $this->odeOperationLogMoveIdeviceToSource($lastOperationLog);
                        $response['responseMessage'] = 'OK';
                        break;
                    case 'MOVE_BLOCK_ON':
                        $response = $this->odeOperationLogMoveBlockOnPage($lastOperationLog);
                        $response['responseMessage'] = 'OK';
                        break;
                    case 'MOVE_IDEVICE_ON':
                        $response = $this->odeOperationLogMoveIdeviceOnPage($lastOperationLog);
                        $response['responseMessage'] = 'OK';
                        break;
                    case 'CLONE_IDEVICE':
                        $response = $this->odeOperationLogRemoveCloneOdeComponent($lastOperationLog);
                        $response['responseMessage'] = 'OK';
                        break;
                    case 'CLONE_BLOCK':
                        $response = $this->odeOperationLogRemoveCloneBlock($lastOperationLog);
                        $response['responseMessage'] = 'OK';
                        break;
                    case 'CLONE_PAGE':
                        $response = $this->odeOperationLogRemoveClonePage($lastOperationLog);
                        $response['responseMessage'] = 'OK';
                        break;
                    case 'ADD_PAGE':
                        $response = $this->odeOperationLogRemoveAddPage($lastOperationLog);
                        $response['responseMessage'] = 'OK';
                        break;
                    case 'MOVE_PAGE':
                        $response = $this->odeOperationLogMovePage($lastOperationLog);
                        $response['responseMessage'] = 'OK';
                        break;
                    default:
                        $t = $this->translator->trans('Unable to undo last change');
                        $response['responseMessage'] = 'ERROR';
                        $response['responseMessageBody'] = $t;
                        break;
                }
            } else {
                if ($lastOperationLogUser !== $user->getUsername()) {
                    $t1 = $this->translator->trans('Unable to undo last change');
                    $t2 = $this->translator->trans('Last change is from another user');
                    $response['responseMessage'] = 'ERROR';
                    $response['responseMessageBody'] = '<p>'.$t1.'</p><p>'.$t2.'</p>';
                } else {
                    $t1 = $this->translator->trans('Unable to undo last change');
                    $t2 = $this->translator->trans('There are no changes that can be undone');
                    $response['responseMessage'] = 'ERROR';
                    $response['responseMessageBody'] = '<p>'.$t1.'</p><p>'.$t2.'</p>';
                }
            }
        } else {
            $t1 = $this->translator->trans('Unable to undo last change');
            $t2 = $this->translator->trans("There aren't operations to undo");
            $response['responseMessage'] = 'ERROR';
            $response['responseMessageBody'] = '<p>'.$t1.'</p><p>'.$t2.'</p>';
        }

        if ('OK' == $response['responseMessage']) {
            $response['lastOperationAction'] = $lastOperationAction;
        }

        return $response;
    }

    /**
     * Get data from add_idevice action.
     *
     * @param object $lastOperationLog
     *
     * @return array $response
     */
    private function odeOperationLogRemoveComponent($lastOperationLog)
    {
        $response = [];
        $deleteBlockId = $lastOperationLog->getIdDestination();
        $additionalData = json_decode($lastOperationLog->getAdditionalData());
        foreach ($additionalData as $key => $data) {
            $response[$key] = $data;
        }
        $response['isDelete'] = true;
        $response['deleteBlockId'] = $deleteBlockId;

        return $response;
    }

    /**
     * Get data from clone_idevice action.
     *
     * @param object $lastOperationLog
     *
     * @return array $response
     */
    private function odeOperationLogRemoveCloneOdeComponent($lastOperationLog)
    {
        $response = [];
        $moveFrom = $lastOperationLog->getIdSource();
        $additionalData = json_decode($lastOperationLog->getAdditionalData());
        foreach ($additionalData as $key => $data) {
            $response[$key] = $data;
        }

        $response['odeIdeviceDto'] = $this->getIdeviceDto($response['odeIdeviceId']);
        $response['moveFrom'] = $moveFrom;
        $response['isCloneIdeviceDelete'] = true;

        return $response;
    }

    /**
     * Get data from clone_block action.
     *
     * @param object $lastOperationLog
     *
     * @return array $response
     */
    private function odeOperationLogRemoveCloneBlock($lastOperationLog)
    {
        $response = [];
        $additionalData = json_decode($lastOperationLog->getAdditionalData());
        foreach ($additionalData as $key => $data) {
            $response[$key] = $data;
        }

        $response['blockDto'] = $this->getBlockDto($response['blockId']);
        $response['isCloneBlockDelete'] = true;

        return $response;
    }

    /**
     * Retrieve data from clone_page action.
     *
     * @param object $lastOperationLog
     *
     * @return array $response
     */
    private function odeOperationLogRemoveClonePage($lastOperationLog)
    {
        $response = [];
        $additionalData = json_decode($lastOperationLog->getAdditionalData());
        foreach ($additionalData as $key => $data) {
            $response[$key] = $data;
        }

        $response['isClonePageDelete'] = true;

        return $response;
    }

    /**
     * Retrieve data from bbdd to remove added page.
     *
     * @param object $lastOperationLog
     *
     * @return array $response
     */
    private function odeOperationLogRemoveAddPage($lastOperationLog)
    {
        $response = [];
        $additionalData = json_decode($lastOperationLog->getAdditionalData());
        foreach ($additionalData as $key => $data) {
            $response[$key] = $data;
        }

        $response['isAddPageDelete'] = true;

        return $response;
    }

    /**
     * Get data from move_page action.
     *
     * @param object $lastOperationLog
     *
     * @return array $response
     */
    private function odeOperationLogMovePage($lastOperationLog)
    {
        $response = [];
        $additionalData = json_decode($lastOperationLog->getAdditionalData());
        foreach ($additionalData as $key => $data) {
            $response[$key] = $data;
        }

        $response['isMovePage'] = true;

        return $response;
    }

    /**
     * Get data from move_block_to action.
     *
     * @param object $lastOperationLog
     *
     * @return array $response
     */
    private function odeOperationLogMoveBlockToSource($lastOperationLog)
    {
        $response = [];
        $moveFrom = $lastOperationLog->getIdSource();
        $moveTo = $lastOperationLog->getIdDestination();

        $additionalData = json_decode($lastOperationLog->getAdditionalData());
        foreach ($additionalData as $key => $data) {
            $response[$key] = $data;
        }

        $response['blockDto'] = $this->getBlockDto($response['blockId']);

        $response['isMoveTo'] = true;
        $response['moveFrom'] = $moveFrom;
        $response['moveTo'] = $moveTo;

        return $response;
    }

    /**
     * Get data from move_idevice_to action.
     *
     * @param object $lastOperationLog
     *
     * @return array $response
     */
    private function odeOperationLogMoveIdeviceToSource($lastOperationLog)
    {
        $response = [];
        $moveFrom = $lastOperationLog->getIdSource();
        $moveTo = $lastOperationLog->getIdDestination();

        $additionalData = json_decode($lastOperationLog->getAdditionalData());
        foreach ($additionalData as $key => $data) {
            $response[$key] = $data;
        }

        $response['odeIdeviceDto'] = $this->getIdeviceDto($response['odeIdeviceId']);
        $response['odeBlockDto'] = $this->getBlockDto($response['blockId']);
        $response['isMoveIdeviceTo'] = true;
        $response['moveFrom'] = $moveFrom;
        $response['moveTo'] = $moveTo;

        return $response;
    }

    /**
     * Get data from move_block_on action.
     *
     * @param object $lastOperationLog
     *
     * @return array $response
     */
    private function odeOperationLogMoveBlockOnPage($lastOperationLog)
    {
        $response = [];

        $additionalData = json_decode($lastOperationLog->getAdditionalData());
        foreach ($additionalData as $key => $data) {
            $response[$key] = $data;
        }

        $response['odeBlockDto'] = $this->getBlockDto($response['blockId']);
        $response['isMoveBlockOn'] = true;

        return $response;
    }

    /**
     * Get data from move_idevice_on action.
     *
     * @param object $lastOperationLog
     *
     * @return array $response
     */
    private function odeOperationLogMoveIdeviceOnPage($lastOperationLog)
    {
        $response = [];

        $additionalData = json_decode($lastOperationLog->getAdditionalData());
        foreach ($additionalData as $key => $data) {
            $response[$key] = $data;
        }

        $response['odeIdeviceDto'] = $this->getIdeviceDto($response['odeIdeviceId']);
        $response['odeBlockDto'] = $this->getBlockDto($response['blockId']);
        $response['isMoveIdeviceOn'] = true;

        return $response;
    }

    /**
     * Get block dto from block id.
     *
     * @param string $odeBlockId
     *
     * @return object $userCurrentOdeBlockDto
     */
    private function getBlockDto($odeBlockId)
    {
        $odeComponentsSyncRepository = $this->entityManager->getRepository(OdePagStructureSync::class);
        $odePagStructureSync = $odeComponentsSyncRepository->findBy(['odeBlockId' => $odeBlockId]);

        $userCurrentOdeBlockDto = new OdePagStructureSyncDto();
        $userCurrentOdeBlockDto->loadFromEntity($odePagStructureSync[0], true, true, true);

        return $userCurrentOdeBlockDto;
    }

    /**
     * Get idevice dto from idevice id.
     *
     * @param string $odeIdeviceId
     *
     * @return object $userCurrentOdeComponentDto;
     */
    private function getIdeviceDto($odeIdeviceId)
    {
        $odeComponentsSyncRepository = $this->entityManager->getRepository(OdeComponentsSync::class);
        $userCurrentOdeComponentSync = $odeComponentsSyncRepository->findBy(['odeIdeviceId' => $odeIdeviceId]);

        $userCurrentOdeComponentDto = new OdeComponentsSyncDto();
        $userCurrentOdeComponentDto->loadFromEntity($userCurrentOdeComponentSync[0], true);

        return $userCurrentOdeComponentDto;
    }
}
