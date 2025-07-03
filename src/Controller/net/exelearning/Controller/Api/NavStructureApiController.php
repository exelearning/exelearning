<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Entity\net\exelearning\Dto\OdeNavStructureSyncDataSaveDto;
use App\Entity\net\exelearning\Dto\OdeNavStructureSyncDto;
use App\Entity\net\exelearning\Dto\OdeNavStructureSyncListDto;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Properties;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Util\net\exelearning\Util\FileUtil;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

#[Route('/api/nav-structure-management/nav-structures')]
class NavStructureApiController extends DefaultApiController
{
    private $fileHelper;
    private $userHelper;
    private $translator;
    private $currentOdeUsersService;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        FileHelper $fileHelper,
        UserHelper $userHelper,
        TranslatorInterface $translator,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        HubInterface $hub,
    ) {
        $this->fileHelper = $fileHelper;
        $this->userHelper = $userHelper;
        $this->translator = $translator;
        $this->currentOdeUsersService = $currentOdeUsersService;
        parent::__construct($entityManager, $logger, $hub);
    }

    #[Route('/{odeVersionId}/{odeSessionId}/nav/structure/get', methods: ['GET'], name: 'api_nav_structures_nav_structure_get')]
    public function getOdeNavStructureSyncAction(Request $request, $odeVersionId, $odeSessionId)
    {
        $responseData = null;

        $repo = $this->entityManager->getRepository(OdeNavStructureSync::class);

        $navStructure = $repo->getNavStructure($odeSessionId);

        if (!empty($navStructure)) {
            // Get user
            $user = $this->getUser();

            // Remove save flag active
            $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);

            // Remove flag syncComponentsFlag
            $this->currentOdeUsersService->removeActiveSyncComponentsFlag($user);

            $loadOdePagStructureSyncs = false;
            $loadOdeComponentsSync = false;
            $loadOdeNavStructureSyncProperties = true;
            $loadOdePagStructureSyncProperties = false;
            $loadOdeComponentsSyncProperties = false;

            $responseData = new OdeNavStructureSyncListDto();
            $responseData->setOdeSessionId($odeSessionId);

            foreach ($navStructure as $navStructureElem) {
                $structure = new OdeNavStructureSyncDto();

                $structure->loadFromEntity($navStructureElem, $loadOdePagStructureSyncs, $loadOdeComponentsSync, $loadOdeNavStructureSyncProperties, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);

                $responseData->addStructure($structure);
            }
        } else {
            $navStructure = $this->saveOdeNavStructureSyncDataAction($request);

            $responseData = new OdeNavStructureSyncListDto();
            $responseData->setOdeSessionId($odeSessionId);

            $loadOdePagStructureSyncs = false;
            $loadOdeComponentsSync = false;
            $loadOdeNavStructureSyncProperties = true;
            $loadOdePagStructureSyncProperties = false;
            $loadOdeComponentsSyncProperties = false;

            $structure = new OdeNavStructureSyncDto();
            $structure->loadFromEntity($navStructure, $loadOdePagStructureSyncs, $loadOdeComponentsSync, $loadOdeNavStructureSyncProperties, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);
            $responseData->addStructure($structure);
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/nav/structure/data/save', methods: ['PUT'], name: 'api_nav_structures_nav_structure_data_save')]
    public function saveOdeNavStructureSyncDataAction(Request $request)
    {
        $responseData = new OdeNavStructureSyncDataSaveDto();

        $odeNavStructureSyncId = $request->get('odeNavStructureSyncId');
        $isDefinedOdeNavStructureSyncId = $request->request->has('odeNavStructureSyncId');

        // required if $odeNavStructureSyncId is not received
        $odeVersionId = $request->get('odeVersionId');
        $odeSessionId = $request->get('odeSessionId');
        $odePageId = $request->get('odePageId');

        $odeNavStructureSyncIdParent = $request->get('odeNavStructureSyncIdParent');
        $isDefinedOdeNavStructureSyncIdParent = $request->request->has('odeNavStructureSyncIdParent');

        $odeParentPageId = $request->get('odeParentPageId');

        $pageName = $request->get('pageName');
        $isDefinedPageName = $request->request->has('pageName');

        $order = $request->get('order');
        if (isset($order)) {
            $order = intval($order);
        }
        $isDefinedOrder = $request->request->has('order');

        $orderDefault = 1;

        $isNewOdeNavStructureSync = false;

        $isPageChange = false;

        $firstNode = false;
        if ((false == $isDefinedPageName) && (empty($odePageId) || (null == $odePageId) || ('' == $odePageId)) && (null == $odeNavStructureSyncId)) {
            $odePageId = Util::generateId();
            if (empty($pageName) || (null == $pageName) || ('' == $pageName)) {
                // Set locale on request by user preferences (by default request->locale is null)
                $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($this->getUser());
                $localeUserPreferences = $databaseUserPreferences['locale']->getValue();
                $request->setLocale($localeUserPreferences);
                $request->setDefaultLocale($localeUserPreferences);
                $this->translator->setLocale($request->getLocale());
                $pageName = $this->translator->trans('New page');
                $firstNode = true;
                if (empty($odeNavStructureSyncIdParent) || (null == $odeNavStructureSyncIdParent) || ('' == $odeNavStructureSyncIdParent)) {
                    $odeNavStructureSyncIdParent = 'root';
                    $isDefinedOdeNavStructureSyncIdParent = true;
                }
            }
            $odeNavStructureSyncId = '';
        }

        // Validate received data
        if (
            (empty($odeNavStructureSyncId))
                && (
                    (empty($odeVersionId))
                    || (empty($odeSessionId))
                    || (empty($odePageId))
                    || (empty($pageName)))
        ) {
            $this->logger->error(
                'invalid data',
                ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]
            );

            $responseData->setResponseMessage('error: invalid data');

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);

        // if $odeNavStructureSyncIdParent is set load data from database
        if (!empty($odeNavStructureSyncIdParent)) {
            $odeNavStructureSyncParent = $odeNavStructureSyncRepo->find($odeNavStructureSyncIdParent);

            if ((!empty($odeNavStructureSyncParent)) && (empty($odeParentPageId))) {
                $odeParentPageId = $odeNavStructureSyncParent->getOdePageId();
            }
        }

        // if $odeNavStructureSyncId is set load data from database
        if ($isDefinedOdeNavStructureSyncId && (!empty($odeNavStructureSyncId))) {
            $odeNavStructureSync = $odeNavStructureSyncRepo->find($odeNavStructureSyncId);
        }

        // if there isn't odeNavStructureSync or data was not found on database
        if (empty($odeNavStructureSync)) {
            // create new OdeNavStructureSync
            $odeNavStructureSync = new OdeNavStructureSync();

            if (!empty($odeNavStructureSyncParent)) {
                $odeNavStructureSync->setOdeNavStructureSync($odeNavStructureSyncParent);
                $odeNavStructureSync->setOdeParentPageId($odeParentPageId);
            }

            $odeNavStructureSync->setOdeSessionId($odeSessionId);
            $odeNavStructureSync->setOdePageId($odePageId);

            $odeNavStructureSync->setPageName($pageName);

            if ($isDefinedOrder) {
                $odeNavStructureSync->setOdeNavStructureSyncOrder($order);
            } else {
                // Look for the last order in the structure sync
                $newOrder = $this->getOdeNavStructureSyncsMaxOrder($odeNavStructureSync);
                ++$newOrder;
                $odeNavStructureSync->setOdeNavStructureSyncOrder($newOrder);
            }

            $isNewOdeNavStructureSync = true;
        } else {
            if (!empty($odeNavStructureSyncParent)) {
                if (
                    (null != $odeNavStructureSync)
                    && (null != $odeNavStructureSyncParent)
                    && (
                        ((null != $odeNavStructureSync->getOdeNavStructureSync())
                            && ($odeNavStructureSync->getOdeNavStructureSync()->getId()
                                != $odeNavStructureSyncParent->getId()))
                        || ((null == $odeNavStructureSync->getOdeNavStructureSync())
                            && (null != $odeNavStructureSyncParent))
                    )
                ) {
                    $isPageChange = true;

                    // Move element to delete to the last position
                    $newOrder = $this->getOdeNavStructureSyncsMaxOrder($odeNavStructureSync);
                    ++$newOrder;

                    $this->reorderOdeNavStructureSync($odeNavStructureSync, $newOrder);
                }

                $odeNavStructureSync->setOdeNavStructureSync($odeNavStructureSyncParent);
                $odeNavStructureSync->setOdeParentPageId($odeParentPageId);
            } elseif ($isDefinedOdeNavStructureSyncIdParent && (empty($odeNavStructureSyncParent))) { // remove parent
                if ((null != $odeNavStructureSync) && (null != $odeNavStructureSync->getOdeNavStructureSync())) {
                    $isPageChange = true;

                    // Move element to delete to the last position
                    $newOrder = $this->getOdeNavStructureSyncsMaxOrder($odeNavStructureSync);
                    ++$newOrder;

                    $this->reorderOdeNavStructureSync($odeNavStructureSync, $newOrder);
                }

                $odeNavStructureSync->setOdeNavStructureSync(null);
                $odeNavStructureSync->setOdeParentPageId(null);
            }

            if ($isDefinedPageName) {
                $odeNavStructureSync->setPageName($pageName);
            }

            if ($isDefinedOrder) {
                $odeNavStructureSync->setOdeNavStructureSyncOrder($order);
            }
        }

        $this->entityManager->persist($odeNavStructureSync);

        if (!$odeNavStructureSync->areAllodeNavStructureSyncPropertiesInitialized()) {
            // initialize odeNavStructureSyncProperties
            $userLogged = $this->getUser();
            $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($userLogged);
            $odeNavStructureSync->loadOdeNavStructureSyncPropertiesFromConfig($databaseUserPreferences);

            foreach ($odeNavStructureSync->getodeNavStructureSyncProperties() as $odeNavStructureSyncProperties) {
                $this->entityManager->persist($odeNavStructureSyncProperties);
            }
        }

        // Store all properties in an array indexed by key for quick access
        $properties = [];
        foreach ($odeNavStructureSync->getOdeNavStructureSyncProperties() as $property) {
            $properties[$property->getKey()] = $property;
        }

        // If "titlePage" exists and is empty, set its value to "pageName"
        if (isset($properties['titlePage']) && empty($properties['titlePage']->getValue())) {
            $properties['titlePage']->setValue($pageName);
            $this->entityManager->persist($properties['titlePage']);
        }

        $this->entityManager->flush();

        if ($isPageChange) {
            if ($isDefinedOrder) {
                $newOrder = $order;
            } else {
                // Move element to the last position in the destination page
                $newOrder = $this->getOdeNavStructureSyncsMaxOrder($odeNavStructureSync);
                ++$newOrder;
            }

            $this->reorderOdeNavStructureSync($odeNavStructureSync, $newOrder);
        } elseif ($isNewOdeNavStructureSync || $isDefinedOrder) {
            $modifiedOdeNavStructureSyncs = $this->reorderOdeNavStructureSync($odeNavStructureSync, $odeNavStructureSync->getOdeNavStructureSyncOrder());
        }

        $this->entityManager->flush();

        $responseData->setIsNewOdeNavStructureSync($isNewOdeNavStructureSync);

        if (!empty($modifiedOdeNavStructureSyncs)) {
            $modifiedOdeNavStructureSyncDtos = [];
            $loadOdePagStructureSyncs = false;
            $loadOdeComponentsSync = false;
            $loadOdeNavStructureSyncProperties = true;
            $loadOdePagStructureSyncProperties = false;
            $loadOdeComponentsSyncProperties = false;

            foreach ($modifiedOdeNavStructureSyncs as $modifiedOdeNavStructureSync) {
                $odeNavStructureSyncDto = new OdeNavStructureSyncDto();
                $odeNavStructureSyncDto->loadFromEntity($modifiedOdeNavStructureSync, $loadOdePagStructureSyncs, $loadOdeComponentsSync, $loadOdeNavStructureSyncProperties, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);
                $modifiedOdeNavStructureSyncDtos[$modifiedOdeNavStructureSync->getId()] = $odeNavStructureSyncDto;
            }

            $responseData->setOdeNavStructureSyncs($modifiedOdeNavStructureSyncDtos);
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

        if ($firstNode) {
            return $odeNavStructureSync;
        }

        $responseData->setResponseMessage('OK');

        $jsonData = $this->getJsonSerialized($responseData);
        $this->publish($odeNavStructureSync->getOdeSessionId(), 'structure-changed');

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/reorder/save', methods: ['PUT'], name: 'api_nav_structures_nav_structure_reorder')]
    public function reorderOdeNavStructureSyncAction(Request $request)
    {
        $responseData = [];

        $responseData['odeNavStructureSyncs'] = [];

        $modifiedOdeNavStructureSyncs = [];

        $odeNavStructureSyncId = $request->get('odeNavStructureSyncId');
        $isDefinedOdeNavStructureSyncId = $request->request->has('odeNavStructureSyncId');

        $newOrder = $request->get('order');
        if ((!empty($newOrder)) && (!is_int($newOrder))) {
            $newOrder = intval($newOrder);
        }
        $isDefinedOrder = $request->request->has('order');

        // Validate received data
        if (!$isDefinedOdeNavStructureSyncId || !$isDefinedOrder) {
            $this->logger->error('invalid data', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);
            $responseData['responseMessage'] = 'error: invalid data';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // if $odeNavStructureSyncId is set load data from database
        if (!empty($odeNavStructureSyncId)) {
            $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
            $odeNavStructureSync = $odeNavStructureSyncRepo->find($odeNavStructureSyncId);

            if (!empty($odeNavStructureSync)) {
                $modifiedOdeNavStructureSyncs = $this->reorderOdeNavStructureSync($odeNavStructureSync, $newOrder);
                $this->entityManager->flush();

                $modifiedOdeNavStructureSyncDtos = [];
                $loadOdePagStructureSyncs = false;
                $loadOdeComponentsSync = false;
                $loadOdeNavStructureSyncProperties = true;
                $loadOdePagStructureSyncProperties = false;
                $loadOdeComponentsSyncProperties = false;

                foreach ($modifiedOdeNavStructureSyncs as $modifiedOdeNavStructureSync) {
                    $odeNavStructureSyncDto = new OdeNavStructureSyncDto();
                    $odeNavStructureSyncDto->loadFromEntity($modifiedOdeNavStructureSync, $loadOdePagStructureSyncs, $loadOdeComponentsSync, $loadOdeNavStructureSyncProperties, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);
                    $modifiedOdeNavStructureSyncDtos[$modifiedOdeNavStructureSync->getId()] = $odeNavStructureSyncDto;
                }

                $responseData['responseMessage'] = 'OK';
                $responseData['odeNavStructureSyncs'] = $modifiedOdeNavStructureSyncDtos;

                $this->publish($odeNavStructureSync->getOdeSessionId(), 'structure-changed');
            } else {
                $this->logger->error('data not found', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    /**
     * Reorders the OdeNavStructureSync and its siblings.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param int                 $newOrder
     *
     * @return OdeNavStructureSync[]
     */
    private function reorderOdeNavStructureSync($odeNavStructureSync, $newOrder)
    {
        // Process node
        $auxNewOrder = [];
        $previousOrder = $odeNavStructureSync->getOdeNavStructureSyncOrder();
        $auxNewOrder[$odeNavStructureSync->getId()] = $newOrder;
        $modifiedOdeNavStructureSyncs[$odeNavStructureSync->getId()] = $odeNavStructureSync;

        // Process siblings
        $odeNavStructureSyncSiblings = $this->getOdeNavStructureSyncsSyblings($odeNavStructureSync);
        $modifiedNodesById = [];

        foreach ($odeNavStructureSyncSiblings as $odeNavStructureSyncSibling) {
            $siblingId = $odeNavStructureSyncSibling->getId();
            $modifiedNodesById[$siblingId] = $odeNavStructureSyncSibling;
            $siblingOrder = $odeNavStructureSyncSibling->getOdeNavStructureSyncOrder();
            if ($siblingId != $odeNavStructureSync->getId()) {
                if ($siblingOrder == $newOrder) {
                    if ($newOrder > $previousOrder) {
                        $auxNewOrder[$siblingId] = $siblingOrder - 1;
                    } else {
                        $auxNewOrder[$siblingId] = $siblingOrder + 1;
                    }
                } elseif ($siblingOrder > $newOrder) {
                    $auxNewOrder[$siblingId] = $siblingOrder + 1;
                } elseif ($siblingOrder < $newOrder) {
                    $auxNewOrder[$siblingId] = $siblingOrder - 1;
                }
            }
        }

        // Fix order
        asort($auxNewOrder, SORT_NUMERIC);
        $sortNodesIds = [];
        foreach ($auxNewOrder as $key => $value) {
            $sortNodesIds[] = $key;
        }

        $order = 1;
        foreach ($sortNodesIds as $nodeId) {
            $node = isset($modifiedNodesById[$nodeId]) ? $modifiedNodesById[$nodeId] : false;
            if ($node) {
                $node->setOdeNavStructureSyncOrder($order);
                $this->entityManager->persist($node);
                ++$order;
            }
        }

        return $modifiedNodesById;
    }

    #[Route('/{odeNavStructureSyncId}/delete', methods: ['DELETE'], name: 'api_nav_structures_nav_structure_delete')]
    public function deleteOdeNavStructureSyncAction(Request $request, $odeNavStructureSyncId)
    {
        $responseData = [];

        // if $odeNavStructureSyncId is set load data from database
        if (!empty($odeNavStructureSyncId)) {
            $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);

            $odeNavStructureSync = $odeNavStructureSyncRepo->find($odeNavStructureSyncId);

            if (!empty($odeNavStructureSync)) {
                $anyError = false;

                $deletedPageIds = [];
                foreach ($nodesToDeleteEntities as $nodeEntity) {
                    if (null !== $nodeEntity->getOdePageId()) {
                        $deletedPageIds[] = (int) $nodeEntity->getOdePageId();
                    }
                }

                if (!empty($deletedPageIds)) {
                    $this->cleanCrossReferencesForDeletedNodes($deletedPageIds, $odeNavStructureSync->getOdeSessionId());
                }

                // Get OdeNavStructureSync to delete
                $odeNavStructureSyncsToDelete = $this->getOdeNavStructureSyncsToDelete($odeNavStructureSync);

                foreach ($odeNavStructureSyncsToDelete as $odeNavStructureSync) {
                    foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
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
                            $this->entityManager->remove($odePagStructureSync);
                        }
                    }

                    if (!$anyError) {
                        if ($odeNavStructureSync->getId() == $odeNavStructureSyncId) {
                            // Move element to delete to the last position
                            $newOrder = $this->getOdeNavStructureSyncsMaxOrder($odeNavStructureSync);
                            ++$newOrder;

                            $modifiedOdeNavStructureSyncs = $this->reorderOdeNavStructureSync($odeNavStructureSync, $newOrder);
                        }

                        $this->entityManager->remove($odeNavStructureSync);
                    }
                }

                if (!$anyError) {
                    $modifiedOdeNavStructureSyncDtos = [];

                    if (!empty($modifiedOdeNavStructureSyncs)) {
                        $loadOdePagStructureSyncs = false;
                        $loadOdeComponentsSync = false;
                        $loadOdeNavStructureSyncProperties = false;
                        $loadOdePagStructureSyncProperties = false;
                        $loadOdeComponentsSyncProperties = false;

                        foreach ($modifiedOdeNavStructureSyncs as $modifiedOdeNavStructureSync) {
                            if ($modifiedOdeNavStructureSync->getId() != $odeNavStructureSyncId) {
                                $odeNavStructureSyncDto = new OdeNavStructureSyncDto();
                                $odeNavStructureSyncDto->loadFromEntity($modifiedOdeNavStructureSync, $loadOdePagStructureSyncs, $loadOdeComponentsSync, $loadOdeNavStructureSyncProperties, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);
                                $modifiedOdeNavStructureSyncDtos[$modifiedOdeNavStructureSync->getId()] = $odeNavStructureSyncDto;
                            }
                        }
                    }

                    $this->entityManager->flush();

                    $responseData['responseMessage'] = 'OK';
                    $responseData['odeNavStructureSyncs'] = $modifiedOdeNavStructureSyncDtos;
                    $this->publish($odeNavStructureSync->getOdeSessionId(), 'structure-changed');
                } else {
                    $this->logger->error('some dir cannot be removed', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                    $responseData['responseMessage'] = 'error: some dir cannot be removed';
                }
            } else {
                $this->logger->error('data not found', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/properties/save', methods: ['PUT'], name: 'api_nav_structures_nav_structure_properties_save')]
    public function saveOdeNavStructureSyncPropertiesAction(Request $request)
    {
        $responseData = [];
        $responseData['odeNavStructureSync'] = null;

        // collect parameters
        $odeNavStructureSyncId = $request->get('odeNavStructureSyncId');
        $isDefinedOdeNavStructureSyncId = $request->request->has('odeNavStructureSyncId');

        $updateChildsPropertiesParam = $request->get('updateChildsProperties');
        if ((!empty($updateChildsPropertiesParam)) && ('true' == $updateChildsPropertiesParam)) {
            $updateChildsProperties = true;
        } else {
            $updateChildsProperties = false;
        }

        // Validate received data
        if (!$isDefinedOdeNavStructureSyncId) {
            $this->logger->error('invalid data', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // if $odeNavStructureSyncId is set load data from database
        if (!empty($odeNavStructureSyncId)) {
            $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);

            $odeNavStructureSync = $odeNavStructureSyncRepo->find($odeNavStructureSyncId);

            if (!empty($odeNavStructureSync)) {
                // initialize OdeNavStructureSyncProperties
                $userLogged = $this->getUser();
                $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($userLogged);
                $odeNavStructureSync->loadOdeNavStructureSyncPropertiesFromConfig($databaseUserPreferences);

                foreach ($odeNavStructureSync->getOdeNavStructureSyncProperties() as $odeNavStructureSyncProperty) {
                    if (null != $odeNavStructureSyncProperty->getKey()) {
                        $value = $request->get($odeNavStructureSyncProperty->getKey());
                        $isDefinedValue = $request->request->has($odeNavStructureSyncProperty->getKey());

                        // set received value for property
                        if ($isDefinedValue && (isset($value))) {
                            $odeNavStructureSyncProperty->setValue($value);

                            if ($odeNavStructureSyncProperty->isTitleNode()) {
                                $odeNavStructureSync->setPageName($value);

                                $this->entityManager->persist($odeNavStructureSync);
                            }

                            if ($updateChildsProperties) {
                                // update OdePagStructureSyncs
                                foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                                    // update OdePagStructureSyncProperties
                                    foreach ($odePagStructureSync->getOdePagStructureSyncProperties() as $odePagStructureSyncProperty) {
                                        if ($odePagStructureSyncProperty->getKey() == $odeNavStructureSyncProperty->getKey()) {
                                            $odePagStructureSyncProperty->setValue($value);

                                            $this->entityManager->persist($odePagStructureSyncProperty);

                                            break;
                                        }
                                    }

                                    // update OdeComponentsSyncs
                                    foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                                        // update OdeComponentsSyncProperties
                                        foreach ($odeComponentsSync->getOdeComponentsSyncProperties() as $odeComponentsSyncProperty) {
                                            if ($odeComponentsSyncProperty->getKey() == $odeNavStructureSyncProperty->getKey()) {
                                                $odeComponentsSyncProperty->setValue($value);

                                                $this->entityManager->persist($odeComponentsSyncProperty);

                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            // restore to defaults
                            $odeNavStructureSyncProperty->loadFromPropertiesConfig(
                                $odeNavStructureSync,
                                $odeNavStructureSyncProperty->getKey(),
                                Properties::ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG[$odeNavStructureSyncProperty->getKey()]
                            );
                        }

                        $this->entityManager->persist($odeNavStructureSyncProperty);
                    }
                }

                $this->entityManager->flush();

                $responseData['responseMessage'] = 'OK';

                $loadOdePagStructureSyncs = $updateChildsProperties;
                $loadOdeComponentsSync = $updateChildsProperties;
                $loadOdeNavStructureSyncProperties = true;
                $loadOdePagStructureSyncProperties = $updateChildsProperties;
                $loadOdeComponentsSyncProperties = $updateChildsProperties;

                $odeNavStructureSyncDto = new OdeNavStructureSyncDto();
                $odeNavStructureSyncDto->loadFromEntity($odeNavStructureSync, $loadOdePagStructureSyncs, $loadOdeComponentsSync, $loadOdeNavStructureSyncProperties, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);

                $responseData['odeNavStructureSync'] = $odeNavStructureSyncDto;
            } else {
                $this->logger->error('data not found', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/duplicate', methods: ['POST'], name: 'api_nav_structures_nav_structure_duplicate')]
    public function duplicateOdeNavStructureSyncDataAction(Request $request)
    {
        $responseData = [];
        $responseData['odeNavStructureSync'] = null;
        $responseData['odeNavStructureSyncs'] = null;

        // collect parameters
        $odeNavStructureSyncId = $request->get('odeNavStructureSyncId');
        $isDefinedOdeNavStructureSyncId = $request->request->has('odeNavStructureSyncId');

        // Set locale on request by user preferences (by default request->locale is null)
        $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($this->getUser());
        $localeUserPreferences = $databaseUserPreferences['locale']->getValue();
        $request->setLocale($localeUserPreferences);
        $request->setDefaultLocale($localeUserPreferences);
        $this->translator->setLocale($request->getLocale());

        // Validate received data
        if (!$isDefinedOdeNavStructureSyncId) {
            $this->logger->error('invalid data', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // if $odeNavStructureSyncId is set load data from database
        if (!empty($odeNavStructureSyncId)) {
            $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);

            $odeNavStructureSync = $odeNavStructureSyncRepo->find($odeNavStructureSyncId);

            if (!empty($odeNavStructureSync)) {
                $anyError = false;

                // Duplicate odeNavStructureSync
                $newOdeNavStructureSync = $odeNavStructureSync->duplicate();

                // $newPageName = $this->translator->trans('Copy of %s', ['%s' => $newOdeNavStructureSync->getPageName()]);
                // To do (make translations does not extract these strings);
                $newPageName = $newOdeNavStructureSync->getPageName();
                $newOdeNavStructureSync->setPageName($newPageName);

                $newOdeNavStructureSync->setOdeNavStructureSyncOrder($newOdeNavStructureSync->getOdeNavStructureSyncOrder() + 1);

                foreach ($newOdeNavStructureSync->getOdeNavStructureSyncProperties() as $odeNavStructureSyncPropertiesElem) {
                    $this->entityManager->persist($odeNavStructureSyncPropertiesElem);
                }

                $this->entityManager->persist($newOdeNavStructureSync);

                foreach ($newOdeNavStructureSync->getOdePagStructureSyncs() as $newOdePagStructureSync) {
                    foreach ($newOdePagStructureSync->getOdePagStructureSyncProperties() as $odePagStructureSyncPropertiesElem) {
                        $this->entityManager->persist($odePagStructureSyncPropertiesElem);
                    }

                    $previousIdevices = $newOdePagStructureSync->getOdeComponentsSyncs();

                    $newOdePagStructureSync->setOdeComponentsSyncs(null);

                    $this->entityManager->persist($newOdePagStructureSync);

                    // Duplicate iDevices
                    foreach ($previousIdevices as $odeComponentsSync) {
                        $newOdeComponentsSync = $odeComponentsSync->duplicate();

                        // don't change OdeComponentsSyncOrder because it's the same for all elements

                        // set newOdePagStructureSync
                        $newOdeComponentsSync->setOdePagStructureSync($newOdePagStructureSync);
                        $newOdeComponentsSync->setOdeBlockId($newOdePagStructureSync->getOdeBlockId());

                        $newOdeComponentsSync->setOdePageId($newOdePagStructureSync->getOdePageId());

                        foreach ($newOdeComponentsSync->getOdeComponentsSyncProperties() as $odeComponentsSyncPropertiesElem) {
                            $this->entityManager->persist($odeComponentsSyncPropertiesElem);
                        }

                        $newOdePagStructureSync->addOdeComponentsSync($newOdeComponentsSync);

                        $this->entityManager->persist($newOdeComponentsSync);

                        // Duplicate dir
                        $sourcePath = $this->fileHelper->getOdeComponentsSyncDir($odeComponentsSync->getOdeSessionId(), $odeComponentsSync->getOdeIdeviceId());

                        $destinationPath = $this->fileHelper->getOdeComponentsSyncDir($newOdeComponentsSync->getOdeSessionId(), $newOdeComponentsSync->getOdeIdeviceId());

                        $dirCopied = FileUtil::copyDir($sourcePath, $destinationPath);

                        if (!$dirCopied) {
                            $anyError = true;
                        }
                    }
                }

                if (!$anyError) {
                    // Reorder odeNavStructureSyncs
                    $modifiedOdeNavStructureSyncs = $this->reorderOdeNavStructureSync($newOdeNavStructureSync, $newOdeNavStructureSync->getOdeNavStructureSyncOrder());

                    $this->entityManager->flush();

                    $responseData['responseMessage'] = 'OK';

                    $loadOdePagStructureSyncs = false;
                    $loadOdeComponentsSync = false;
                    $loadOdeNavStructureSyncProperties = true;
                    $loadOdePagStructureSyncProperties = false;
                    $loadOdeComponentsSyncProperties = false;

                    $newOdeNavStructureSyncDto = new OdeNavStructureSyncDto();
                    $newOdeNavStructureSyncDto->loadFromEntity($newOdeNavStructureSync, $loadOdePagStructureSyncs, $loadOdeComponentsSync, $loadOdeNavStructureSyncProperties, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);

                    $responseData['odeNavStructureSync'] = $newOdeNavStructureSyncDto;

                    if (!empty($modifiedOdeNavStructureSyncs)) {
                        $modifiedOdeNavStructureSyncDtos = [];
                        $loadOdePagStructureSyncs = false;
                        $loadOdeComponentsSync = false;
                        $loadOdeNavStructureSyncProperties = true;
                        $loadOdePagStructureSyncProperties = false;
                        $loadOdeComponentsSyncProperties = false;

                        foreach ($modifiedOdeNavStructureSyncs as $modifiedOdeNavStructureSync) {
                            $odeNavStructureSyncDto = new OdeNavStructureSyncDto();
                            $odeNavStructureSyncDto->loadFromEntity($modifiedOdeNavStructureSync, $loadOdePagStructureSyncs, $loadOdeComponentsSync, $loadOdeNavStructureSyncProperties, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);
                            $modifiedOdeNavStructureSyncDtos[$modifiedOdeNavStructureSync->getId()] = $odeNavStructureSyncDto;
                        }

                        $responseData['odeNavStructureSyncs'] = $modifiedOdeNavStructureSyncDtos;
                    }
                } else {
                    $this->logger->error('some dir could not be duplicated', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                    $responseData['responseMessage'] = 'error: some dir could not be duplicated';
                }
            } else {
                $this->logger->error('data not found', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    /**
     * Returns an array with the OdeNavStructureSync elements to delete.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     *
     * @return array
     */
    private function getOdeNavStructureSyncsToDelete($odeNavStructureSync)
    {
        $odeNavStructureSyncsToDelete = [];
        $odeNavStructureSyncsToDelete[] = $odeNavStructureSync;

        foreach ($odeNavStructureSync->getOdeNavStructureSyncs() as $childOdeNavStructureSync) {
            if (!$childOdeNavStructureSync->getOdeNavStructureSyncs()->isEmpty()) {
                $odeNavStructureSyncsToDelete = array_merge($odeNavStructureSyncsToDelete, $this->getOdeNavStructureSyncsToDelete($childOdeNavStructureSync));
            } else {
                $odeNavStructureSyncsToDelete[] = $childOdeNavStructureSync;
            }
        }

        return $odeNavStructureSyncsToDelete;
    }

    /**
     * Returns an array with the siblings of the OdeNavStructureSync passed as param.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     *
     * @return array
     */
    private function getOdeNavStructureSyncsSyblings($odeNavStructureSync)
    {
        $odeNavStructureSyncSiblings = [];

        if (null != $odeNavStructureSync->getOdeNavStructureSync()) {
            // If $odeNavStructureSync has parent
            $odeNavStructureSyncSiblings = $odeNavStructureSync->getOdeNavStructureSync()->getOdeNavStructureSyncs();
        } elseif (null == $odeNavStructureSync->getOdeNavStructureSync()) {
            // Find odeNavStructureSyncs without parents
            $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);
            $odeNavStructureSyncSiblings = $odeNavStructureSyncRepo->findBy(
                [
                    'odeSessionId' => $odeNavStructureSync->getOdeSessionId(),
                    'odeNavStructureSync' => null,
                ]
            );
        }

        return $odeNavStructureSyncSiblings;
    }

    /**
     * Returns the highest order of the sibling elements of the OdeNavStructureSync.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     *
     * @return int
     */
    private function getOdeNavStructureSyncsMaxOrder($odeNavStructureSync)
    {
        $odeNavStructureSyncSiblings = $this->getOdeNavStructureSyncsSyblings($odeNavStructureSync);

        $maxOrder = null;

        foreach ($odeNavStructureSyncSiblings as $odeNavStructureSyncSibling) {
            if (!isset($maxOrder)) {
                $maxOrder = $odeNavStructureSyncSibling->getOdeNavStructureSyncOrder();
            } elseif ($odeNavStructureSyncSibling->getOdeNavStructureSyncOrder() >= $maxOrder) {
                $maxOrder = $odeNavStructureSyncSibling->getOdeNavStructureSyncOrder();
            }
        }

        return $maxOrder;
    }

    /**
     * Processes an HTML string to clean exe-links pointing to a specific page.
     */
    private function processAndCleanHtmlInternalLinks(string $htmlContent, string $targetHref): string|false
    {
        if (empty($htmlContent)) {
            return $htmlContent;
        }

        if (!str_contains($htmlContent, $targetHref)) {
            return $htmlContent;
        }

        $dom = new \DOMDocument();
        if (!@$dom->loadHTML($htmlContent, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NOERROR | LIBXML_NOWARNING)) {
            return false;
        }

        $xpath = new \DOMXPath($dom);
        $nodesToModify = $xpath->query("//a[contains(@href, '{$targetHref}')]");
        $modified = false;

        if ($nodesToModify->length > 0) {
            for ($i = $nodesToModify->length - 1; $i >= 0; --$i) {
                $node = $nodesToModify->item($i);

                if ($node && $node->parentNode) {
                    $linkText = $node->nodeValue;
                    $textNode = $dom->createTextNode($linkText);
                    $node->parentNode->replaceChild($textNode, $node);
                    $modified = true;
                }
            }
        }

        if ($modified) {
            $newHtmlContent = $dom->saveHTML();
            if (false === $newHtmlContent) {
                return false;
            }

            return $newHtmlContent;
        } else {
            return $htmlContent;
        }
    }

    /**
     * Recursively traverses a decoded JSON array/object and applies HTML link cleaning to any string value found.
     */
    private function recursivelyCleanJsonHtml(array $data, array $targetHrefs, int $componentId, bool &$modifiedGlobalFlag): array
    {
        foreach ($data as $key => &$value) {
            if (is_array($value)) {
                // If the value is an array (or JSON sub-object), recursively call this function
                $value = $this->recursivelyCleanJsonHtml($value, $targetHrefs, $componentId, $modifiedGlobalFlag);
            } elseif (is_string($value)) {
                // If the value is a string, attempt to clean it as HTML
                $currentContent = $value;
                $updatedContentForField = $currentContent;

                // Loop through each targetHref to apply cleaning
                foreach ($targetHrefs as $singleTargetHref) {
                    $tempContent = $this->processAndCleanHtmlInternalLinks($updatedContentForField, $singleTargetHref);
                    if (false === $tempContent) {
                        // Revert to original for this field if error
                        $updatedContentForField = $currentContent;
                        break;
                    } elseif ($tempContent !== $updatedContentForField) {
                        $updatedContentForField = $tempContent;
                        $modifiedGlobalFlag = true;
                    }
                }
                // Assign the fully processed content back to the value (even if it's the original because of an error or no changes)
                if ($updatedContentForField !== $currentContent) {
                    $value = $updatedContentForField;
                }
            }
        }

        return $data;
    }

    /**
     * Cleans cross-references of links within session iDevices that point to any of the deleted page IDs.
     */
    private function cleanCrossReferencesForDeletedNodes(array $deletedPageIds, string $sessionId): void
    {
        // Build a collection of all target href patterns
        $targetHrefs = array_map(fn ($id) => 'exe-node:'.$id, $deletedPageIds);

        $componentRepo = $this->entityManager->getRepository(\App\Entity\net\exelearning\Entity\OdeComponentsSync::class);
        $allComponentsInSession = $componentRepo->findBy(['odeSessionId' => $sessionId]);

        foreach ($allComponentsInSession as $component) {
            $componentId = $component->getId();
            $anyComponentContentModified = false;

            // Process html_view
            $currentHtmlView = $component->getHtmlView();
            if (!empty($currentHtmlView)) {
                $newHtmlView = $currentHtmlView;
                $htmlViewModified = false;

                // Loop through each targetHref to apply cleaning
                foreach ($targetHrefs as $singleTargetHref) {
                    $tempNewHtmlView = $this->processAndCleanHtmlInternalLinks($newHtmlView, $singleTargetHref);
                    if (false === $tempNewHtmlView) {
                        $newHtmlView = $currentHtmlView;
                        $htmlViewModified = false;
                        continue 2;
                    } elseif ($tempNewHtmlView !== $newHtmlView) {
                        $newHtmlView = $tempNewHtmlView;
                        $htmlViewModified = true;
                    }
                }
                if ($htmlViewModified) {
                    $component->setHtmlView($newHtmlView);
                    $anyComponentContentModified = true;
                }
            }

            // Process json_properties (any string field within)
            $originalJsonProperties = $component->getJsonProperties();
            if (!empty($originalJsonProperties)) {
                try {
                    $decodedJson = json_decode($originalJsonProperties, true);

                    if (is_array($decodedJson)) {
                        $jsonModifiedFlag = false;
                        // Pass ALL targetHrefs to the recursive function
                        $newDecodedJson = $this->recursivelyCleanJsonHtml($decodedJson, $targetHrefs, $componentId, $jsonModifiedFlag);

                        if ($jsonModifiedFlag) {
                            $component->setJsonProperties(json_encode($newDecodedJson));
                            $anyComponentContentModified = true;
                        }
                    } else {
                        // JSON decoding failed or resulted in non-array (e.g., null)
                    }
                } catch (\Exception $e) {
                    // Catching exceptions during JSON processing
                }
            }

            // If something in the component (HTML_VIEW or JSON_PROPERTIES) was modified, mark it for persistence
            if ($anyComponentContentModified) {
                $this->entityManager->persist($component);
            }
        }
    }
}
