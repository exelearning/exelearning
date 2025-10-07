<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;
use App\Entity\net\exelearning\Dto\OdeNavStructureSyncDto;
use App\Entity\net\exelearning\Dto\OdePagStructureSyncDataSaveDto;
use App\Entity\net\exelearning\Dto\OdePagStructureSyncDto;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Properties;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeComponentsSyncServiceInterface;
use App\Service\net\exelearning\Service\Api\PagStructureApiServiceInterface;
use App\Util\net\exelearning\Util\FileUtil;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/pag-structure-management/pag-structures')]
class PagStructureApiController extends DefaultApiController
{
    private $fileHelper;

    private $pagStructureApiService;

    private $odeComponentsSyncService;

    private $currentOdeUsersService;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        FileHelper $fileHelper,
        PagStructureApiServiceInterface $pagStructureApiService,
        OdeComponentsSyncServiceInterface $odeComponentsSyncService,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        HubInterface $hub,
        SerializerInterface $serializer,
    ) {
        $this->fileHelper = $fileHelper;
        $this->pagStructureApiService = $pagStructureApiService;
        $this->odeComponentsSyncService = $odeComponentsSyncService;
        $this->currentOdeUsersService = $currentOdeUsersService;

        parent::__construct($entityManager, $logger, $serializer, $hub);
    }

    #[Route('/pag/structure/data/save', methods: ['PUT'], name: 'api_pag_structures_pag_structure_data_save')]
    public function saveOdePagStructureSyncDataAction(Request $request)
    {
        $this->hydrateRequestBody($request);

        $responseData = new OdePagStructureSyncDataSaveDto();

        $odePagStructureSyncId = $request->get('odePagStructureSyncId');
        $isDefinedOdePagStructureSyncId = $request->request->has('odePagStructureSyncId');
        $odeNavStructureSyncId = $request->get('odeNavStructureSyncId');
        $isDefinedOdeNavStructureSyncId = $request->request->has('odeNavStructureSyncId');

        // required if $odePagStructureSyncId is not received
        $odeVersionId = $request->get('odeVersionId');
        // $isDefinedOdeVersionId = $request->request->has('odeVersionId');
        $odeSessionId = $request->get('odeSessionId');
        // $isDefinedOdeSessionId = $request->request->has('odeSessionId');
        $odePageId = $request->get('odePageId');
        $isDefinedOdePageId = $request->request->has('odePageId');
        $odeBlockId = $request->get('odeBlockId');
        // $isDefinedOdeBlockId = $request->request->has('odeBlockId');
        $isUndoLastAction = $request->request->has('isUndoLastAction');

        // optional, used if OdeNavStructureSync or OdePagStructureSync are created
        $isDefinedBlockName = $request->request->has('blockName');
        if ($isDefinedBlockName) {
            $blockName = $request->get('blockName');
        } else {
            $blockName = '';
        }

        $isDefinedIconName = $request->request->has('iconName');
        if ($isDefinedIconName) {
            $iconName = $request->get('iconName');
        } else {
            $iconName = null;
        }

        $pageName = $request->get('pageName');
        if (empty($pageName)) {
            $pageName = Constants::ODE_PAGE_NAME;
        }

        $order = $request->get('order');
        if (isset($order)) {
            $order = intval($order);
        }
        $isDefinedOrder = $request->request->has('order');

        $orderDefault = Constants::ORDER_DEFAULT_VALUE;

        $isNewOdePagStructureSync = false;

        $isPageChange = false;

        // Validate received data
        if (
            ((empty($odePagStructureSyncId)) || (Constants::GENERATE_NEW_ITEM_KEY == $odePagStructureSyncId)) && ((empty($odeVersionId)) || (empty($odeSessionId)) || (empty($odePageId)) || (empty($odeBlockId)))
        ) {
            $this->logger->error('invalid data', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData->setResponseMessage('error: invalid data');

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // if $odeNavStructureSyncId is set load data from database
        if ($isDefinedOdeNavStructureSyncId && (!empty($odeNavStructureSyncId))) {
            $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);

            $odeNavStructureSync = $odeNavStructureSyncRepo->find($odeNavStructureSyncId);
        }

        // if odePagStructureSyncId is set load data from database
        if ($isDefinedOdePagStructureSyncId && (!empty($odePagStructureSyncId)) && (Constants::GENERATE_NEW_ITEM_KEY !== $odePagStructureSyncId)) {
            $odePagStructureSyncRepo = $this->entityManager->getRepository(OdePagStructureSync::class);

            $odePagStructureSync = $odePagStructureSyncRepo->find($odePagStructureSyncId);
        }

        // if there isn't odePagStructureSync or data was not found on database
        if (empty($odePagStructureSync)) {
            if (empty($odeNavStructureSync)) {
                $this->logger->error('odeNavStructureSync is empty', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData->setResponseMessage('error: odeNavStructureSync is empty');

                $jsonData = $this->getJsonSerialized($responseData);

                return new JsonResponse($jsonData, $this->status, [], true);
            }

            // create new OdePagStructureSync
            $odePagStructureSync = new OdePagStructureSync();
            $odePagStructureSync->setOdeNavStructureSync($odeNavStructureSync);
            $odePagStructureSync->setOdeSessionId($odeSessionId);
            $odePagStructureSync->setOdePageId($odePageId);
            $odePagStructureSync->setOdeBlockId($odeBlockId);
            $odePagStructureSync->setBlockName($blockName);
            $odePagStructureSync->setIconName($iconName);

            if ($isDefinedOrder) {
                $odePagStructureSync->setOdePagStructureSyncOrder($order);
            } else {
                $odePagStructureSync->setOdePagStructureSyncOrder($orderDefault);
            }

            $isNewOdePagStructureSync = true;
        } else {
            if (!empty($odeNavStructureSync)) {
                // if its page change
                if (
                    (null != $odePagStructureSync) && (null != $odePagStructureSync->getOdeNavStructureSync())
                    && (null != $odeNavStructureSync)
                    && ($odePagStructureSync->getOdeNavStructureSync()->getId() != $odeNavStructureSync->getId())
                ) {
                    $isPageChange = true;
                    if (!$isUndoLastAction) {
                        // Move element to the last position in the origin page
                        $newOrder = $odePagStructureSync->getMaxOrder();
                        ++$newOrder;

                        $modifiedOdePagStructureSyncs = $this->pagStructureApiService->reorderOdePagStructureSync($odePagStructureSync, $newOrder);
                    }

                    if (!$isDefinedOdePageId) {
                        $odePagStructureSync->setOdePageId($odeNavStructureSync->getOdePageId());
                    }
                }

                $odePagStructureSync->setOdeNavStructureSync($odeNavStructureSync);
            }

            if ($isDefinedOdePageId) {
                $odePagStructureSync->setOdePageId($odePageId);
            }

            if ($isDefinedBlockName) {
                $odePagStructureSync->setBlockName($blockName);
            }

            if ($isDefinedIconName) {
                $odePagStructureSync->setIconName($iconName);
            }

            if ($isDefinedOrder) {
                $odePagStructureSync->setOdePagStructureSyncOrder($order);
            }
        }

        $this->entityManager->persist($odePagStructureSync);

        foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
            if ($odeComponentsSync->getOdePageId() != $odePagStructureSync->getOdePageId()) {
                $odeComponentsSync->setOdePageId($odePagStructureSync->getOdePageId());

                $this->entityManager->persist($odeComponentsSync);
            }
        }

        if (!$odePagStructureSync->areAllOdePagStructureSyncPropertiesInitialized()) {
            // initialize OdePagStructureSyncProperties
            $odePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();

            $odePagStructureSync->loadOdePagStructureSyncPropertiesFromOdeNavStructureSync();

            foreach ($odePagStructureSync->getOdePagStructureSyncProperties() as $odePagStructureSyncProperties) {
                $this->entityManager->persist($odePagStructureSyncProperties);
            }
        }

        $this->entityManager->flush();

        if ($isNewOdePagStructureSync || $isDefinedOrder) {
            $modifiedOdePagStructureSyncs = $this->pagStructureApiService->reorderOdePagStructureSync($odePagStructureSync, $odePagStructureSync->getOdePagStructureSyncOrder());
        }

        if ($isPageChange) {
            // Move element to the last position in the destination page
            if (!$isUndoLastAction) {
                $newOrder = $odePagStructureSync->getMaxOrder();
                ++$newOrder;

                $modifiedOdePagStructureSyncsNewPage = $this->pagStructureApiService->reorderOdePagStructureSync($odePagStructureSync, $newOrder);
            }
        }

        $this->entityManager->flush();

        if (!empty($odePagStructureSync)) {
            $responseData->setOdePagStructureSyncId($odePagStructureSync->getId());

            $loadOdeComponentsSync = false;
            $loadOdePagStructureSyncProperties = true;
            $loadOdeComponentsSyncProperties = false;

            $odePagStructureSyncDto = new OdePagStructureSyncDto();
            $odePagStructureSyncDto->loadFromEntity($odePagStructureSync, $loadOdeComponentsSync, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);

            $responseData->setOdePagStructureSync($odePagStructureSyncDto);
            $this->publish($odePagStructureSync->getOdeSessionId(), 'new-content-published');
        }

        $responseData->setIsNewOdePagStructureSync($isNewOdePagStructureSync);

        if (!empty($modifiedOdePagStructureSyncs)) {
            $modifiedOdePagStructureSyncDtos = [];

            $loadOdeComponentsSync = false;
            $loadOdePagStructureSyncProperties = true;
            $loadOdeComponentsSyncProperties = false;

            foreach ($modifiedOdePagStructureSyncs as $modifiedOdePagStructureSync) {
                // If it's page change don't return current odePagStructureSync
                if ($isPageChange && (!empty($odePagStructureSync)) && ($modifiedOdePagStructureSync->getId() != $odePagStructureSync->getId())) {
                    $odePagStructureSyncDto = new OdePagStructureSyncDto();
                    $odePagStructureSyncDto->loadFromEntity($modifiedOdePagStructureSync, $loadOdeComponentsSync, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);
                    $modifiedOdePagStructureSyncDtos[$modifiedOdePagStructureSync->getId()] = $odePagStructureSyncDto;
                }
            }

            $responseData->setOdePagStructureSyncs($modifiedOdePagStructureSyncDtos);
        }

        if ((empty($odeNavStructureSync)) && (!empty($odePagStructureSync))) {
            $odeNavStructureSync = $odePagStructureSync->getOdeNavStructureSync();
        }

        if (!empty($odeNavStructureSync)) {
            $responseData->setOdeNavStructureSyncId($odeNavStructureSync->getId());

            $loadOdePagStructureSyncs = false;
            $loadOdeComponentsSync = false;
            $loadOdeNavStructureSyncProperties = true;
            $loadOdePagStructureSyncProperties = false;
            $loadOdeComponentsSyncProperties = false;

            $odeNavStructureSyncDto = new OdeNavStructureSyncDto();
            $odeNavStructureSyncDto->loadFromEntity($odeNavStructureSync, $loadOdePagStructureSyncs, $loadOdeComponentsSync, $loadOdeNavStructureSyncProperties, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);

            $responseData->setOdeNavStructureSync($odeNavStructureSyncDto);
        }

        $responseData->setResponseMessage('OK');

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/reorder/save', methods: ['PUT'], name: 'api_pag_structures_pag_structure_reorder')]
    public function reorderOdePagStructureSyncAction(Request $request)
    {
        $this->hydrateRequestBody($request);

        $responseData = [];

        $responseData['odePagStructureSyncs'] = [];

        $modifiedOdePagStructureSyncs = [];

        $odePagStructureSyncId = $request->get('odePagStructureSyncId');
        $isDefinedOdePagStructureSyncId = $request->request->has('odePagStructureSyncId');

        $newOrder = $request->get('order');
        if ((!empty($newOrder)) && (!is_int($newOrder))) {
            $newOrder = intval($newOrder);
        }
        $isDefinedOrder = $request->request->has('order');

        // Validate received data
        if (!$isDefinedOdePagStructureSyncId || !$isDefinedOrder) {
            $this->logger->error('invalid data', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // if $odePagStructureSyncId is set load data from database
        if (!empty($odePagStructureSyncId)) {
            $odePagStructureSyncRepo = $this->entityManager->getRepository(OdePagStructureSync::class);

            $odePagStructureSync = $odePagStructureSyncRepo->find($odePagStructureSyncId);

            if (!empty($odePagStructureSync)) {
                $modifiedOdePagStructureSyncs = $this->pagStructureApiService->reorderOdePagStructureSync($odePagStructureSync, $newOrder);
                $this->entityManager->flush();

                $modifiedOdePagStructureSyncDtos = [];
                $loadOdeComponentsSync = false;
                $loadOdePagStructureSyncProperties = true;
                $loadOdeComponentsSyncProperties = false;

                foreach ($modifiedOdePagStructureSyncs as $modifiedOdePagStructureSync) {
                    $odePagStructureSyncDto = new OdePagStructureSyncDto();
                    $odePagStructureSyncDto->loadFromEntity($modifiedOdePagStructureSync, $loadOdeComponentsSync, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);
                    $modifiedOdePagStructureSyncDtos[$modifiedOdePagStructureSync->getId()] = $odePagStructureSyncDto;
                }
                $this->publish($odePagStructureSync->getOdeSessionId(), 'new-content-published');
                $responseData['responseMessage'] = 'OK';
                $responseData['odePagStructureSyncs'] = $modifiedOdePagStructureSyncDtos;
            } else {
                $this->logger->error('data not found', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/{odePagStructureSyncId}/delete', methods: ['DELETE'], name: 'api_pag_structures_pag_structure_delete')]
    public function deleteOdePagStructureSyncAction(Request $request, $odePagStructureSyncId)
    {
        $responseData = [];

        // Get user
        $user = $this->getUser();

        // Remove save flag active
        $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);

        // if $odePagStructureSyncId is set load data from database
        if (!empty($odePagStructureSyncId)) {
            $odePagStructureSyncRepo = $this->entityManager->getRepository(OdePagStructureSync::class);

            $odePagStructureSync = $odePagStructureSyncRepo->find($odePagStructureSyncId);

            if (!empty($odePagStructureSync)) {
                $anyError = false;

                foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                    // Get iDevice dir
                    $odeComponentsSyncDir = $this->fileHelper->getOdeComponentsSyncDir($odeComponentsSync->getOdeSessionId(), $odeComponentsSync->getOdeIdeviceId());

                    $dirRemoved = FileUtil::removeDir($odeComponentsSyncDir);

                    if ($dirRemoved) {
                        $this->entityManager->remove($odeComponentsSync);
                    } else {
                        $anyError = true;
                    }
                }

                if (!$anyError) {
                    // Move element to delete to the last position
                    $newOrder = $odePagStructureSync->getMaxOrder();
                    ++$newOrder;

                    $modifiedOdePagStructureSyncs = $this->pagStructureApiService->reorderOdePagStructureSync($odePagStructureSync, $newOrder);

                    $this->entityManager->remove($odePagStructureSync);

                    $modifiedOdePagStructureSyncDtos = [];
                    $loadOdeComponentsSync = false;
                    $loadOdePagStructureSyncProperties = false;
                    $loadOdeComponentsSyncProperties = false;

                    foreach ($modifiedOdePagStructureSyncs as $modifiedOdePagStructureSync) {
                        if ($modifiedOdePagStructureSync->getId() != $odePagStructureSyncId) {
                            $odePagStructureSyncDto = new OdePagStructureSyncDto();
                            $odePagStructureSyncDto->loadFromEntity($modifiedOdePagStructureSync, $loadOdeComponentsSync, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);
                            $modifiedOdePagStructureSyncDtos[$modifiedOdePagStructureSync->getId()] = $odePagStructureSyncDto;
                        }
                    }

                    $this->entityManager->flush();
                    $this->publish($odePagStructureSync->getOdeSessionId(), 'new-content-published');
                    $responseData['responseMessage'] = 'OK';
                    $responseData['odePagStructureSyncs'] = $modifiedOdePagStructureSyncDtos;
                } else {
                    $this->logger->error('some dir cannot be removed', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                    $responseData['responseMessage'] = 'error: some dir cannot be removed';
                }
            } else {
                $this->logger->error('data not found', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/properties/save', methods: ['PUT'], name: 'api_pag_structures_pag_structure_properties_save')]
    public function saveOdePagStructureSyncPropertiesAction(Request $request)
    {
        $this->hydrateRequestBody($request);

        $responseData = [];
        $responseData['odePagStructureSync'] = null;

        // collect parameters
        $odePagStructureSyncId = $request->get('odePagStructureSyncId');
        $isDefinedOdePagStructureSyncId = $request->request->has('odePagStructureSyncId');

        $updateChildsPropertiesParam = $request->get('updateChildsProperties');
        if ((!empty($updateChildsPropertiesParam)) && ('true' == $updateChildsPropertiesParam)) {
            $updateChildsProperties = true;
        } else {
            $updateChildsProperties = false;
        }

        // Validate received data
        if (!$isDefinedOdePagStructureSyncId) {
            $this->logger->error('invalid data', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // if $odePagStructureSyncId is set load data from database
        if (!empty($odePagStructureSyncId)) {
            $odePagStructureSyncRepo = $this->entityManager->getRepository(OdePagStructureSync::class);

            $odePagStructureSync = $odePagStructureSyncRepo->find($odePagStructureSyncId);

            if (!empty($odePagStructureSync)) {
                // initialize OdePagStructureSyncProperties
                $odePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();

                foreach ($odePagStructureSync->getOdePagStructureSyncProperties() as $odePagStructureSyncProperty) {
                    if (null != $odePagStructureSyncProperty->getKey()) {
                        $value = $request->get($odePagStructureSyncProperty->getKey());
                        $isDefinedValue = $request->request->has($odePagStructureSyncProperty->getKey());

                        // set received value for property
                        if ($isDefinedValue && (isset($value))) {
                            $odePagStructureSyncProperty->setValue($value);

                            if ($updateChildsProperties) {
                                // update OdeComponentsSyncs
                                foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                                    // update OdeComponentsSyncProperties
                                    foreach ($odeComponentsSync->getOdeComponentsSyncProperties() as $odeComponentsSyncProperty) {
                                        if ($odeComponentsSyncProperty->getKey() == $odePagStructureSyncProperty->getKey()) {
                                            $odeComponentsSyncProperty->setValue($value);

                                            $this->entityManager->persist($odeComponentsSyncProperty);

                                            break;
                                        }
                                    }
                                }
                            }
                        } else {
                            // restore to defaults
                            $odePagStructureSyncProperty->loadFromPropertiesConfig(
                                $odePagStructureSync,
                                $odePagStructureSyncProperty->getKey(),
                                Properties::ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG[$odePagStructureSyncProperty->getKey()]
                            );
                        }

                        $this->entityManager->persist($odePagStructureSyncProperty);
                    }
                }

                $this->entityManager->flush();

                $responseData['responseMessage'] = 'OK';

                $loadOdeComponentsSync = $updateChildsProperties;
                $loadOdePagStructureSyncProperties = true;
                $loadOdeComponentsSyncProperties = $updateChildsProperties;

                $odePagStructureSyncDto = new OdePagStructureSyncDto();
                $odePagStructureSyncDto->loadFromEntity($odePagStructureSync, $loadOdeComponentsSync, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);
                $this->publish($odePagStructureSync->getOdeSessionId(), 'new-content-published');
                $responseData['odePagStructureSync'] = $odePagStructureSyncDto;
            } else {
                $this->logger->error('data not found', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/duplicate', methods: ['POST'], name: 'api_pag_structures_pag_structure_duplicate')]
    public function duplicateOdePagStructureSyncDataAction(Request $request)
    {
        $responseData = [];
        $responseData['odePagStructureSync'] = null;
        $responseData['odePagStructureSyncs'] = null;

        // collect parameters
        $odePagStructureSyncId = $request->get('odePagStructureSyncId');
        $isDefinedOdePagStructureSyncId = $request->request->has('odePagStructureSyncId');

        // Validate received data
        if (!$isDefinedOdePagStructureSyncId) {
            $this->logger->error('invalid data', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // if $odePagStructureSyncId is set load data from database
        if (!empty($odePagStructureSyncId)) {
            $odePagStructureSyncRepo = $this->entityManager->getRepository(OdePagStructureSync::class);

            $odePagStructureSync = $odePagStructureSyncRepo->find($odePagStructureSyncId);

            if (!empty($odePagStructureSync)) {
                $anyError = false;

                // Duplicate odePagStructureSync
                $newOdePagStructureSync = $odePagStructureSync->duplicate();

                $newOdePagStructureSync->setOdePagStructureSyncOrder($newOdePagStructureSync->getOdePagStructureSyncOrder() + 1);

                $newOdePagStructureSync->setOdeComponentsSyncs(null);

                foreach ($newOdePagStructureSync->getOdePagStructureSyncProperties() as $odePagStructureSyncPropertiesElem) {
                    $this->entityManager->persist($odePagStructureSyncPropertiesElem);
                }

                $this->entityManager->persist($newOdePagStructureSync);

                // Duplicate iDevices
                foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                    $newOdeComponentsSync = $odeComponentsSync->duplicate();

                    // don't change OdeComponentsSyncOrder because it's the same for all elements

                    // set newOdePagStructureSync
                    $newOdeComponentsSync->setOdePagStructureSync($newOdePagStructureSync);
                    $newOdeComponentsSync->setOdeBlockId($newOdePagStructureSync->getOdeBlockId());

                    foreach ($newOdeComponentsSync->getOdeComponentsSyncProperties() as $odeComponentsSyncPropertiesElem) {
                        $this->entityManager->persist($odeComponentsSyncPropertiesElem);
                    }

                    // Case: image-gallery need to change jsonProperties and HtmlView to the new idevice id
                    if ('image-gallery' == $newOdeComponentsSync->getOdeIdeviceTypeName()) {
                        $newJsonProperties = str_replace($odeComponentsSync->getOdeIdeviceId(), $newOdeComponentsSync->getOdeIdeviceId(), $newOdeComponentsSync->getJsonProperties());
                        $newHtmlView = str_replace($odeComponentsSync->getOdeIdeviceId(), $newOdeComponentsSync->getOdeIdeviceId(), $newOdeComponentsSync->getHtmlView());
                        $newOdeComponentsSync->setJsonProperties($newJsonProperties);
                        $newOdeComponentsSync->setHtmlView($newHtmlView);
                    }

                    $this->entityManager->persist($newOdeComponentsSync);

                    // Duplicate dir
                    $sourcePath = $this->fileHelper->getOdeComponentsSyncDir($odeComponentsSync->getOdeSessionId(), $odeComponentsSync->getOdeIdeviceId());

                    $destinationPath = $this->fileHelper->getOdeComponentsSyncDir($newOdeComponentsSync->getOdeSessionId(), $newOdeComponentsSync->getOdeIdeviceId());

                    $dirCopied = FileUtil::copyDir($sourcePath, $destinationPath);

                    if (!$dirCopied) {
                        $anyError = true;
                    }
                }

                if (!$anyError) {
                    // Reorder odePagStructureSyncs
                    $modifiedOdePagStructureSyncs = $this->pagStructureApiService->reorderOdePagStructureSync($newOdePagStructureSync, $newOdePagStructureSync->getOdePagStructureSyncOrder());

                    $this->entityManager->flush();

                    $responseData['responseMessage'] = 'OK';

                    $loadOdeComponentsSync = false;
                    $loadOdePagStructureSyncProperties = true;
                    $loadOdeComponentsSyncProperties = false;

                    $newOdePagStructureSyncDto = new OdePagStructureSyncDto();
                    $newOdePagStructureSyncDto->loadFromEntity($newOdePagStructureSync, $loadOdeComponentsSync, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);

                    $responseData['odePagStructureSync'] = $newOdePagStructureSyncDto;

                    if (!empty($modifiedOdePagStructureSyncs)) {
                        $modifiedOdePagStructureSyncDtos = [];
                        $loadOdePagStructureSyncProperties = true;

                        foreach ($modifiedOdePagStructureSyncs as $modifiedOdePagStructureSync) {
                            $odePagStructureSyncDto = new OdePagStructureSyncDto();
                            $odePagStructureSyncDto->loadFromEntity($modifiedOdePagStructureSync, $loadOdeComponentsSync, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);
                            $modifiedOdePagStructureSyncDtos[$modifiedOdePagStructureSync->getId()] = $odePagStructureSyncDto;
                        }
                        $this->publish($odePagStructureSync->getOdeSessionId(), 'new-content-published');
                        $responseData['odePagStructureSyncs'] = $modifiedOdePagStructureSyncDtos;
                    }
                } else {
                    $this->logger->error('some dir could not be duplicated', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                    $responseData['responseMessage'] = 'error: some dir could not be duplicated';
                }
            } else {
                $this->logger->error('data not found', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odePagStructureSyncId' => $odePagStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/get/ode/pag/brokenlinks/{odePageId}', methods: ['GET'], name: 'api_odes_pag_get_broken_links')]
    public function getOdePagBrokenLinks(Request $request, $odePageId)
    {
        if (!empty($odePageId)) {
            // Base URL
            $symfonyFullUrl = self::getSymfonyUrl($request);

            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);
            $odeComponentsSync = $odeComponentsSyncRepo->findBy(['odePageId' => $odePageId]);

            if (!empty($odeComponentsSync)) {
                $responseData = $this->odeComponentsSyncService->getBrokenLinks($symfonyFullUrl, $odeComponentsSync);
            } else {
                $this->logger->notice('data not found', ['odePageId' => $odePageId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'notice: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odePageId' => $odePageId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }
}
