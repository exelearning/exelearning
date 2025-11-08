<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;
use App\Entity\net\exelearning\Dto\IdeviceDataSaveDto;
use App\Entity\net\exelearning\Dto\IdeviceHtmlViewDto;
use App\Entity\net\exelearning\Dto\IdeviceListDto;
use App\Entity\net\exelearning\Dto\OdeComponentsSyncDto;
use App\Entity\net\exelearning\Dto\OdeNavStructureSyncDto;
use App\Entity\net\exelearning\Dto\OdePagStructureSyncDto;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Exception\net\exelearning\Exception\Logical\PhpGdExtensionException;
use App\Exception\net\exelearning\Exception\Logical\PhpZipExtensionException;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\IdeviceHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Properties;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeComponentsSyncServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Service\net\exelearning\Service\Api\PagStructureApiServiceInterface;
use App\Service\net\exelearning\Service\Thumbnail\ThumbnailServiceInterface;
use App\Util\net\exelearning\Util\FileUtil;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

#[Route('/api/idevice-management/idevices')]
class IdeviceApiController extends DefaultApiController
{
    private $fileHelper;
    private $iDeviceHelper;
    private $pagStructureApiService;
    private $odeComponentsSyncService;
    private $currentOdeUsersService;
    private $thumbnailService;
    private $userHelper;
    private $translator;
    private $odeService;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        FileHelper $fileHelper,
        IdeviceHelper $iDeviceHelper,
        PagStructureApiServiceInterface $pagStructureApiService,
        OdeComponentsSyncServiceInterface $odeComponentsSyncService,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        UserHelper $userHelper,
        TranslatorInterface $translator,
        ThumbnailServiceInterface $thumbnailService,
        OdeServiceInterface $odeService,
        HubInterface $hub,
        SerializerInterface $serializer,
    ) {
        $this->fileHelper = $fileHelper;
        $this->iDeviceHelper = $iDeviceHelper;
        $this->pagStructureApiService = $pagStructureApiService;
        $this->odeComponentsSyncService = $odeComponentsSyncService;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->userHelper = $userHelper;
        $this->translator = $translator;
        $this->thumbnailService = $thumbnailService;
        $this->odeService = $odeService;

        parent::__construct($entityManager, $logger, $serializer, $hub);
    }

    #[Route('/installed', methods: ['GET'], name: 'api_idevices_installed')]
    public function getInstalledIdevicesAction(Request $request, $jsonResponse = true)
    {
        $session = $request->getSession();
        $responseData = new IdeviceListDto();

        if (Constants::SAVE_INSTALLED_IDEVICES_IN_SESSION && $session->has(Constants::SESSION_INSTALLED_IDEVICES)) {
            $sessionIdevices = $session->get(Constants::SESSION_INSTALLED_IDEVICES);
            foreach ($sessionIdevices as $sessionIdevice) {
                $responseData->addIdevice($sessionIdevice);
            }
        } else {
            $user = $this->getUser();
            $iDevices = $this->iDeviceHelper->getInstalledIdevices($user);
            $sessionIdevices = [];

            foreach ($iDevices as $iDevice) {
                // Get iDevice visibility from user preferences
                $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($user);
                $pKey = Constants::IDEVICE_VISIBILITY_PREFERENCE_PRE.$iDevice->getName();
                if (isset($databaseUserPreferences[$pKey]) && 'true' == $databaseUserPreferences[$pKey]->getValue()) {
                    $iDevice->setVisible(true);
                } else {
                    $iDevice->setVisible(false);
                }
                // Add idevice if is valid
                if ($iDevice->isValid()) {
                    $responseData->addIdevice($iDevice);
                    $sessionIdevices[$iDevice->getName()] = $iDevice;
                }
            }

            if (Constants::SAVE_INSTALLED_IDEVICES_IN_SESSION) {
                $session->set(Constants::SESSION_INSTALLED_IDEVICES, $sessionIdevices);
            }
        }

        if ($jsonResponse) {
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        } else {
            return $responseData;
        }
    }

    #[Route('/upload', methods: ['POST'], name: 'api_idevices_upload')]
    public function uploadIdeviceAction(Request $request)
    {
        try {
            Util::checkPhpZipExtension();
        } catch (PhpZipExtensionException $e) {
            $this->logger->error('The zip file cannot be unzipped', ['file:' => $this, 'line' => __LINE__]);
            $responseData['error'] = 'The zip file cannot be unzipped';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $user = $this->getUser();

        // Upload zip file parameters
        $base64String = $request->get('file');
        $filename = $request->get('filename');

        // Validate received data
        if ((empty($base64String)) || (empty($filename))) {
            $this->logger->error('invalid data', ['file:' => $this, 'line' => __LINE__]);
            $responseData = ['error' => 'Invalid data'];
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Upload and install idevice
        $newIdevice = $this->iDeviceHelper->uploadIdeviceZip($filename, $base64String, $user);

        // Check installed idevice
        if ($newIdevice && $newIdevice['error']) {
            $responseData = ['error' => $newIdevice['error']];
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        } elseif (!isset($newIdevice['idevice'])) {
            $responseData = ['error' => 'Could not install the idevice'];
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Response
        $responseData = [];
        $responseData['idevice'] = $newIdevice['idevice'];
        $responseData['idevices'] = $this->getInstalledIdevicesAction($request, false);
        $responseData['responseMessage'] = 'OK';

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/deleteinstaled', methods: ['DELETE'], name: 'api_idevices_installed_delete')]
    public function removeIdeviceInstalledAction(Request $request)
    {
        $responseData = [];

        $user = $this->getUser();

        $ideviceId = $request->get('id');

        if ($ideviceId) {
            $idevicesInstalled = $this->getInstalledIdevicesAction($request, false);
            $deleted = $idevicesInstalled->removeIdevice($ideviceId, $user, $this->iDeviceHelper, $this->fileHelper);
            $responseData['deleted'] = $deleted;
        } else {
            $responseData['deleted'] = false;
        }

        $idevicesNow = $this->getInstalledIdevicesAction($request, false);

        $responseData['responseMessage'] = 'OK';
        $responseData['idevices'] = $idevicesNow;

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/{odeSessionId}/{ideviceDirName}/download', methods: ['GET'], name: 'api_idevices_installed_download')]
    public function downloadIdeviceInstalledAction(Request $request, $odeSessionId, $ideviceDirName)
    {
        $user = $this->getUser();
        $dbUser = $this->userHelper->getDatabaseUser($user);

        // Get idevice from base idevices
        $type = Constants::IDEVICE_TYPE_BASE;
        $ideviceDir = $this->iDeviceHelper->getIdeviceDir($ideviceDirName, $type);

        // In case you don't find it: get idevice from user dir
        if (!file_exists($ideviceDir)) {
            $type = Constants::IDEVICE_TYPE_USER;
            $ideviceDir = $this->iDeviceHelper->getIdeviceDir($ideviceDirName, $type, $user);
        }

        // Check if idevice exists
        if (!file_exists($ideviceDir)) {
            $responseData = ['error' => 'The idevice does not exist'];
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $ideviceDto = $this->iDeviceHelper->getIdeviceConfig($ideviceDirName, $type, $user);

        // Check if the idevice is downloadable
        if (!$ideviceDto->isDownloadable()) {
            $responseData = ['error' => 'The idevice cannot be downloaded'];
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Session user directory
        $sessionTmpUserDir = $this->fileHelper->getOdeSessionUserTmpDir($odeSessionId, $dbUser);
        $tmpIdeviceZipPath = $sessionTmpUserDir.$ideviceDirName.'.zip';

        // Generate zip
        FileUtil::zipDir($ideviceDir, $tmpIdeviceZipPath);

        // Idevice zip base64
        $fpIdeviceZip = fopen($tmpIdeviceZipPath, 'rb');
        $binaryIdeviceZip = fread($fpIdeviceZip, filesize($tmpIdeviceZipPath));
        $ideviceZipBase64 = base64_encode($binaryIdeviceZip);

        // Response
        $responseData = [];
        $responseData['zipFileName'] = $ideviceDirName.'.zip';
        $responseData['zipBase64'] = $ideviceZipBase64;
        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/{odeNavStructureSyncId}/list/page', methods: ['GET'], name: 'api_idevices_list_by_page')]
    public function getOdeComponentsSyncListByPageAction(Request $request, $odeNavStructureSyncId)
    {
        $collaborativeBlockLevel = $this->getParameter('app.collaborative_block_level') ?? 'idevice';

        $responseData = null;

        // if odeNavStructureSyncId is set load data from database
        if (!empty($odeNavStructureSyncId)) {
            $user = $this->getUser();
            $databaseUser = $this->userHelper->getDatabaseUser($user);

            $clientIp = $request->getClientIp();

            // removes flag syncComponentsFlag
            $this->currentOdeUsersService->removeActiveSyncComponentsFlag($user);

            // If is root node
            if (Constants::ROOT_NODE_IDENTIFIER == $odeNavStructureSyncId) {
                // Update CurrentOdeUsers
                $this->currentOdeUsersService->insertOrUpdateFromRootNode($databaseUser, $clientIp);
            } else {
                $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);

                $odeNavStructureSync = $odeNavStructureSyncRepo->find($odeNavStructureSyncId);

                if (!empty($odeNavStructureSync)) {
                    // Update CurrentOdeUsers
                    $this->currentOdeUsersService->insertOrUpdateFromOdeNavStructureSync($odeNavStructureSync, $databaseUser, $clientIp);

                    $loadOdePagStructureSyncs = true;
                    $loadOdeComponentsSync = true;
                    $loadOdeNavStructureSyncProperties = true;
                    $loadOdePagStructureSyncProperties = true;
                    $loadOdeComponentsSyncProperties = true;

                    $odeNavStructureSyncDto = new OdeNavStructureSyncDto();
                    $odeNavStructureSyncDto->loadFromEntity($odeNavStructureSync, $loadOdePagStructureSyncs, $loadOdeComponentsSync, $loadOdeNavStructureSyncProperties, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);

                    $responseData = $odeNavStructureSyncDto;
                } else {
                    $this->logger->error('data not found', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

                    $responseData['responseMessage'] = 'error: data not found';
                }
            }
        } else {
            $this->logger->error('invalid data', ['odeNavStructureSyncId' => $odeNavStructureSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/{odeComponentsSyncId}/data/get', methods: ['GET'], name: 'api_idevices_idevice_data_get')]
    public function getOdeComponentsSyncDataAction(Request $request, $odeComponentsSyncId)
    {
        $responseData = null;

        // if $odeComponentsSyncId is set load data from database
        if (!empty($odeComponentsSyncId)) {
            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);

            $odeComponentsSync = $odeComponentsSyncRepo->find($odeComponentsSyncId);

            if (!empty($odeComponentsSync)) {
                $odeComponentsSyncDto = new OdeComponentsSyncDto();
                $loadOdeComponentsSyncProperties = true;
                $odeComponentsSyncDto->loadFromEntity($odeComponentsSync, $loadOdeComponentsSyncProperties);

                $responseData = $odeComponentsSyncDto;
            } else {
                $this->logger->error('data not found', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/{odeComponentsSyncId}/html/view/get', methods: ['GET'], name: 'api_idevices_html_view_get')]
    public function getHtmlViewAction(Request $request, $odeComponentsSyncId)
    {
        $responseData = null;

        // if odeComponentsSyncId is set load data from database
        if (!empty($odeComponentsSyncId)) {
            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);

            $odeComponentsSync = $odeComponentsSyncRepo->find($odeComponentsSyncId);

            if (!empty($odeComponentsSync)) {
                $responseData = new IdeviceHtmlViewDto();
                $responseData->setOdeComponentsSyncId($odeComponentsSyncId);
                $responseData->setHtmlView($odeComponentsSync->getHtmlView());
            } else {
                $this->logger->error('data not found', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/{odeComponentsSyncId}/html/template/get', methods: ['GET'], name: 'api_idevices_html_template_get')]
    public function getHtmlTemplateAction(Request $request, $odeComponentsSyncId)
    {
        $user = $this->getUser();

        $responseData = [];
        $responseData['htmlTemplate'] = '';

        // if odeComponentsSyncId is set load data from database
        if (!empty($odeComponentsSyncId)) {
            // $responseData->setOdeComponentsSyncId($odeComponentsSyncId);
            $responseData['odeComponentsSyncId'] = $odeComponentsSyncId;

            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);

            $odeComponentsSync = $odeComponentsSyncRepo->find($odeComponentsSyncId);

            if (!empty($odeComponentsSync)) {
                $odeIdeviceTypeName = $odeComponentsSync->getOdeIdeviceTypeName();

                $session = $request->getSession();
                if ($session->has(Constants::SESSION_INSTALLED_IDEVICES)) {
                    $sessionIdevices = $session->get(Constants::SESSION_INSTALLED_IDEVICES);
                } else {
                    $sessionIdevices = $this->iDeviceHelper->getIdevicesConfig($user);
                    if (Constants::SAVE_INSTALLED_IDEVICES_IN_SESSION) {
                        $session->set(Constants::SESSION_INSTALLED_IDEVICES, $sessionIdevices);
                    }
                }

                $iDevice = null;
                if (
                    (!empty($sessionIdevices)) && (!empty($odeIdeviceTypeName))
                    && (!empty($sessionIdevices[$odeIdeviceTypeName]))
                ) {
                    $iDevice = $sessionIdevices[$odeIdeviceTypeName];
                }

                if ((!empty($iDevice)) && (!empty($iDevice->getExportTemplateContent()))) {
                    $responseData['htmlTemplate'] = $iDevice->getExportTemplateContent();
                } else {
                    $this->logger->warning(
                        'html template not found',
                        ['$odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]
                    );

                    $responseData['responseMessage'] = 'warning: html template not found';
                }
            } else {
                $this->logger->error(
                    'data not found',
                    ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]
                );

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error(
                'invalid data',
                ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]
            );

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/html/view/save', methods: ['PUT'], name: 'api_idevices_html_view_save')]
    public function saveHtmlViewAction(Request $request)
    {
        // Get user
        $user = $this->getUser();

        // Remove save flag active
        $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);

        $responseData = $this->saveOdeComponentsSync($request, 'saveHtmlView');

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/data/save', methods: ['PUT'], name: 'api_idevices_idevice_data_save')]
    public function saveOdeComponentsSyncDataAction(Request $request)
    {
        // Get user
        $user = $this->getUser();

        // Remove save flag active
        $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);

        $responseData = $this->saveOdeComponentsSync($request, 'saveOdeComponentsSyncData');

        $jsonData = $this->getJsonSerialized($responseData);
        $collaborativeBlockLevel = $this->getParameter('app.collaborative_block_level') ?? 'idevice';
        $odeNavStructureSync = array_values($responseData->getOdeComponentsSyncs());
        if (isset($odeNavStructureSync[0]) && 'idevice' !== $collaborativeBlockLevel) {
            $this->publish(
                $odeNavStructureSync[0]->getOdeSessionId(),
                'actionType:collaborative-page-lock'.
                ',user:'.$user->getEmail().
                ',pageId:'.$odeNavStructureSync[0]->getPageId().
                ',collaborativeMode:'.$collaborativeBlockLevel
            );
        }

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    /**
     * Saves to database the data of the component.
     *
     * @param string $method
     *
     * @return IdeviceDataSaveDto
     */
    private function saveOdeComponentsSync(Request $request, $method)
    {
        $this->hydrateRequestBody($request);

        $user = $this->getUser();

        // collect parameters
        $odeComponentsSyncId = $request->get('odeComponentsSyncId'); // optional, if it is not received a new component is created
        $isDefinedOdeComponentsSyncId = $request->request->has('odeComponentsSyncId');

        // optional, used when odeComponentsSyncId is not received
        $odePagStructureSyncId = $request->get('odePagStructureSyncId');
        $isDefinedOdePagStructureSyncId = $request->request->has('odePagStructureSyncId');
        $odeNavStructureSyncId = $request->get('odeNavStructureSyncId');
        $isDefinedOdeNavStructureSyncId = $request->request->has('odeNavStructureSyncId');

        // required if $odeComponentsSyncId is not received
        $odeVersionId = $request->get('odeVersionId');
        // $isDefinedOdeVersionId = $request->request->has('odeVersionId');
        $odeSessionId = $request->get('odeSessionId');
        // $isDefinedOdeSessionId = $request->request->has('odeSessionId');
        $odePageId = $request->get('odePageId');
        $isDefinedOdePageId = $request->request->has('odePageId');
        $odeBlockId = $request->get('odeBlockId');
        $isDefinedOdeBlockId = $request->request->has('odeBlockId');
        $odeIdeviceId = $request->get('odeIdeviceId');
        // $isDefinedOdeIdeviceId = $request->request->has('odeIdeviceId');
        $odeIdeviceTypeName = $request->get('odeIdeviceTypeName');
        // $isDefinedOdeIdeviceTypeName = $request->request->has('odeIdeviceTypeName');

        $htmlView = $request->get('htmlView'); // required for saveHtmlView
        $isDefinedHtmlView = $request->request->has('htmlView');
        $jsonProperties = $request->get('jsonProperties');
        $isDefinedJsonProperties = $request->request->has('jsonProperties');

        $session = $request->getSession();
        if ($session->has(Constants::SESSION_INSTALLED_IDEVICES)) {
            $sessionIdevices = $session->get(Constants::SESSION_INSTALLED_IDEVICES);
        } else {
            $sessionIdevices = $this->iDeviceHelper->getIdevicesConfig($user);
            if (Constants::SAVE_INSTALLED_IDEVICES_IN_SESSION) {
                $session->set(Constants::SESSION_INSTALLED_IDEVICES, $sessionIdevices);
            }
        }

        $iDevice = null;
        if (
            (!empty($sessionIdevices)) && (!empty($odeIdeviceTypeName))
            && (!empty($sessionIdevices[$odeIdeviceTypeName]))
        ) {
            $iDevice = $sessionIdevices[$odeIdeviceTypeName];
        }

        // optional, used if OdeNavStructureSync or OdePagStructureSync are created
        $isDefinedBlockName = $request->request->has('blockName');
        if ($isDefinedBlockName) {
            $blockName = $request->get('blockName');
        } elseif (!empty($iDevice)) {
            $blockName = $iDevice->getTitle();
        } else {
            $blockName = '';
        }

        $isDefinedIconName = $request->request->has('iconName');
        if ($isDefinedIconName) {
            $iconName = $request->get('iconName');
        } elseif (!empty($iDevice)) {
            $iconName = $iDevice->getIcon();
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

        $odePagStructureSyncOrder = $request->get('odePagStructureSyncOrder');
        if (isset($odePagStructureSyncOrder)) {
            $odePagStructureSyncOrder = intval($odePagStructureSyncOrder);
        }
        $isDefinedOdePagStructureSyncOrder = $request->request->has('odePagStructureSyncOrder');

        $odePagStructureSyncOrderDefault = Constants::ORDER_DEFAULT_VALUE;

        $responseData = new IdeviceDataSaveDto();

        $isNewOdeComponentsSync = false;
        $isNewOdePagStructureSync = false;
        $isNewOdeNavStructureSync = false;

        $isOdeNavStructureSyncChange = false;
        $isOdePagStructureSyncChange = false;

        // Validate received data
        if (
            ('saveHtmlView' == $method && !$isDefinedHtmlView)
            || ((empty($odeComponentsSyncId)) && ((empty($odeVersionId)) || (empty($odeSessionId)) || (empty($odePageId)) || (empty($odeBlockId)) || (empty($odeIdeviceId)) || (empty($odeIdeviceTypeName))))
            || ((Constants::GENERATE_NEW_ITEM_KEY == $odePagStructureSyncId) && ((empty($odeVersionId)) || (empty($odeSessionId)) || (empty($odePageId)) || (empty($odeBlockId))))
        ) {
            $this->logger->error('invalid data', ['file:' => $this, 'line' => __LINE__]);

            $responseData->setResponseMessage('error: invalid data');

            return $responseData;
        }

        // if $odeNavStructureSyncId is set load data from database
        if ($isDefinedOdeNavStructureSyncId && (!empty($odeNavStructureSyncId))) {
            if (Constants::GENERATE_NEW_ITEM_KEY !== $odeNavStructureSyncId) {
                $odeNavStructureSyncRepo = $this->entityManager->getRepository(OdeNavStructureSync::class);

                $odeNavStructureSync = $odeNavStructureSyncRepo->find($odeNavStructureSyncId);
            }

            // if there isn't odeNavStructureSync or data was not found on database
            if ((empty($odeNavStructureSync)) || (Constants::GENERATE_NEW_ITEM_KEY == $odeNavStructureSyncId)) {
                // create new OdeNavStructureSync
                $odeNavStructureSync = new OdeNavStructureSync();
                $odeNavStructureSync->setOdeSessionId($odeSessionId);
                $odeNavStructureSync->setOdePageId($odePageId);
                $odeNavStructureSync->setPageName($pageName);

                if ($isDefinedOrder) {
                    $odeNavStructureSync->setOdeNavStructureSyncOrder($order);
                } else {
                    $odeNavStructureSync->setOdeNavStructureSyncOrder($orderDefault);
                }

                $this->entityManager->persist($odeNavStructureSync);

                $isNewOdeNavStructureSync = true;

                if (!$odeNavStructureSync->areAllodeNavStructureSyncPropertiesInitialized()) {
                    // initialize odeNavStructureSyncProperties
                    $odeNavStructureSync->loadOdeNavStructureSyncPropertiesFromConfig();

                    foreach ($odeNavStructureSync->getodeNavStructureSyncProperties() as $odeNavStructureSyncProperties) {
                        $this->entityManager->persist($odeNavStructureSyncProperties);
                    }
                }
            }
        }

        // if there is odeNavStructureSync ensure that odePageId corresponds to it
        if (
            (!empty($odeNavStructureSync))
            && ((empty($odePageId)) || ($odePageId != $odeNavStructureSync->getOdePageId()))
        ) {
            $odePageId = $odeNavStructureSync->getOdePageId();
        }

        // if odePagStructureSyncId is set load data from database
        if ($isDefinedOdePagStructureSyncId && (!empty($odePagStructureSyncId))) {
            if (Constants::GENERATE_NEW_ITEM_KEY !== $odePagStructureSyncId) {
                $odePagStructureSyncRepo = $this->entityManager->getRepository(OdePagStructureSync::class);

                $odePagStructureSync = $odePagStructureSyncRepo->find($odePagStructureSyncId);
            }

            // if there isn't odePagStructureSync or data was not found on database
            if ((empty($odePagStructureSync)) || (Constants::GENERATE_NEW_ITEM_KEY == $odePagStructureSyncId)) {
                if (empty($odeNavStructureSync)) {
                    $this->logger->error('odeNavStructureSync is empty', ['file:' => $this, 'line' => __LINE__]);

                    $responseData->setResponseMessage('error: odeNavStructureSync is empty');

                    return $responseData;
                }

                // create new OdePagStructureSync
                $odePagStructureSync = new OdePagStructureSync();
                $odePagStructureSync->setOdeNavStructureSync($odeNavStructureSync);
                $odePagStructureSync->setOdeSessionId($odeSessionId);
                $odePagStructureSync->setOdePageId($odePageId);
                $odePagStructureSync->setOdeBlockId($odeBlockId);
                $odePagStructureSync->setBlockName($blockName);
                $odePagStructureSync->setIconName($iconName);

                if ($isDefinedOdePagStructureSyncOrder) {
                    $odePagStructureSync->setOdePagStructureSyncOrder($odePagStructureSyncOrder);
                } else {
                    $odePagStructureSync->setOdePagStructureSyncOrder($odePagStructureSyncOrderDefault);
                }

                $this->entityManager->persist($odePagStructureSync);

                $isNewOdePagStructureSync = true;

                if (!$odePagStructureSync->areAllOdePagStructureSyncPropertiesInitialized()) {
                    // initialize OdePagStructureSyncProperties
                    $odePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();

                    $odePagStructureSync->loadOdePagStructureSyncPropertiesFromOdeNavStructureSync();

                    foreach ($odePagStructureSync->getOdePagStructureSyncProperties() as $odePagStructureSyncProperties) {
                        $this->entityManager->persist($odePagStructureSyncProperties);
                    }
                }
            }
        }

        // if odeComponentsSyncId is set load data from database
        if ($isDefinedOdeComponentsSyncId && (!empty($odeComponentsSyncId))) {
            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);

            $odeComponentsSync = $odeComponentsSyncRepo->find($odeComponentsSyncId);
        }

        // if there isn't odeComponentsSyncId or data was not found on database
        if (empty($odeComponentsSync)) {
            // Validate data
            if ((empty($odeVersionId)) || (empty($odeSessionId)) || (empty($odePageId)) || (empty($odeBlockId)) || (empty($odeIdeviceId)) || (empty($odeIdeviceTypeName))) {
                $this->logger->error('invalid data', ['file:' => $this, 'line' => __LINE__]);

                $responseData->setResponseMessage('error: invalid data');

                return $responseData;
            }

            // if there isn't odePagStructureSync or data was not found on database
            if (empty($odePagStructureSync)) {
                // if there isn't odeNavStructureSync or data was not found on database
                if (empty($odeNavStructureSync)) {
                    // create new OdeNavStructureSync
                    $odeNavStructureSync = new OdeNavStructureSync();
                    $odeNavStructureSync->setOdeSessionId($odeSessionId);
                    $odeNavStructureSync->setOdePageId($odePageId);
                    $odeNavStructureSync->setPageName($pageName);

                    if ($isDefinedOrder) {
                        $odeNavStructureSync->setOdeNavStructureSyncOrder($order);
                    } else {
                        $odeNavStructureSync->setOdeNavStructureSyncOrder($orderDefault);
                    }

                    $this->entityManager->persist($odeNavStructureSync);

                    $isNewOdeNavStructureSync = true;

                    if (!$odeNavStructureSync->areAllodeNavStructureSyncPropertiesInitialized()) {
                        // initialize odeNavStructureSyncProperties
                        $odeNavStructureSync->loadOdeNavStructureSyncPropertiesFromConfig();

                        foreach ($odeNavStructureSync->getodeNavStructureSyncProperties() as $odeNavStructureSyncProperties) {
                            $this->entityManager->persist($odeNavStructureSyncProperties);
                        }
                    }
                }

                // create new OdePagStructureSync
                $odePagStructureSync = new OdePagStructureSync();

                if (!empty($odeNavStructureSync)) {
                    $odePagStructureSync->setOdeNavStructureSync($odeNavStructureSync);
                } else {
                    $this->logger->error('odeNavStructureSync is empty', ['file:' => $this, 'line' => __LINE__]);

                    $responseData->setResponseMessage('error: odeNavStructureSync is empty');

                    return $responseData;
                }

                $odePagStructureSync->setOdeSessionId($odeSessionId);
                $odePagStructureSync->setOdePageId($odePageId);
                $odePagStructureSync->setOdeBlockId($odeBlockId);
                $odePagStructureSync->setBlockName($blockName);
                $odePagStructureSync->setIconName($iconName);

                if ($isDefinedOdePagStructureSyncOrder) {
                    $odePagStructureSync->setOdePagStructureSyncOrder($odePagStructureSyncOrder);
                } else {
                    $odePagStructureSync->setOdePagStructureSyncOrder($odePagStructureSyncOrderDefault);
                }

                $this->entityManager->persist($odePagStructureSync);

                $isNewOdePagStructureSync = true;

                if (!$odePagStructureSync->areAllOdePagStructureSyncPropertiesInitialized()) {
                    // initialize OdePagStructureSyncProperties
                    $odePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();

                    $odePagStructureSync->loadOdePagStructureSyncPropertiesFromOdeNavStructureSync();

                    foreach ($odePagStructureSync->getOdePagStructureSyncProperties() as $odePagStructureSyncProperties) {
                        $this->entityManager->persist($odePagStructureSyncProperties);
                    }
                }
            }

            // create new OdeComponentsSync
            $odeComponentsSync = new OdeComponentsSync();

            if (!empty($odePagStructureSync)) {
                $odeComponentsSync->setOdePagStructureSync($odePagStructureSync);
            } else {
                $this->logger->error('odePagStructureSync is empty', ['file:' => $this, 'line' => __LINE__]);

                $responseData->setResponseMessage('error: odePagStructureSync is empty');

                return $responseData;
            }

            $odeComponentsSync->setOdeSessionId($odeSessionId);
            $odeComponentsSync->setOdePageId($odePageId);
            $odeComponentsSync->setOdeBlockId($odeBlockId);
            $odeComponentsSync->setOdeIdeviceId($odeIdeviceId);
            $odeComponentsSync->setOdeIdeviceTypeName($odeIdeviceTypeName);

            if ($isDefinedHtmlView) {
                $odeComponentsSync->setHtmlView($htmlView);
            }

            if ($isDefinedJsonProperties) {
                $odeComponentsSync->setJsonProperties($jsonProperties);
            }

            if ($isDefinedOrder) {
                $odeComponentsSync->setOdeComponentsSyncOrder($order);
            } else {
                $odeComponentsSync->setOdeComponentsSyncOrder($orderDefault);
            }

            $isNewOdeComponentsSync = true;

            // Create iDevice dir
            $odeComponentsSyncDir = $this->fileHelper->getOdeComponentsSyncDir($odeComponentsSync->getOdeSessionId(), $odeComponentsSync->getOdeIdeviceId());

            if (false !== $odeComponentsSyncDir) {
                $iDeviceDirCreated = true;
            } else {
                $iDeviceDirCreated = false;
            }

            $responseData->setIDeviceDirCreated($iDeviceDirCreated);
        } else { // update odeComponentsSync
            if ('saveHtmlView' == $method) {
                $odeComponentsSync->setHtmlView($htmlView);
            } else {
                if (!empty($odePagStructureSync)) {
                    // if its page change
                    if (
                        (null != $odeComponentsSync) && (null != $odeComponentsSync->getOdePagStructureSync()) && (null != $odeComponentsSync->getOdePagStructureSync()->getOdeNavStructureSync())
                        && (null != $odePagStructureSync) && (null != $odePagStructureSync->getOdeNavStructureSync())
                        && ($odeComponentsSync->getOdePagStructureSync()->getOdeNavStructureSync()->getId() != $odePagStructureSync->getOdeNavStructureSync()->getId())
                    ) {
                        $isOdeNavStructureSyncChange = true;

                        if ($odePageId != $odePagStructureSync->getOdeNavStructureSync()->getOdePageId()) {
                            $odePageId = $odePagStructureSync->getOdeNavStructureSync()->getOdePageId();
                        }
                    }

                    if (
                        (null != $odeComponentsSync) && (null != $odeComponentsSync->getOdePagStructureSync())
                        && (null != $odePagStructureSync)
                        && ($odeComponentsSync->getOdePagStructureSync()->getId() != $odePagStructureSync->getId())
                    ) {
                        $isOdePagStructureSyncChange = true;

                        if ($odeBlockId != $odePagStructureSync->getOdeBlockId()) {
                            $odeBlockId = $odePagStructureSync->getOdeBlockId();
                        }

                        $previousOdePagStructureSync = $odeComponentsSync->getOdePagStructureSync();
                    }

                    $odeComponentsSync->setOdePagStructureSync($odePagStructureSync);
                }

                // Can't be changed
                // if ($isDefinedOdeVersionId) {
                //    $odeComponentsSync->setOdeVersionId($odeVersionId);
                // }

                // Can't be changed
                // if ($isDefinedOdeSessionId) {
                //    $odeComponentsSync->setOdeSessionId($odeSessionId);
                // }

                if ($isDefinedOdePageId || $isOdeNavStructureSyncChange) {
                    $odeComponentsSync->setOdePageId($odePageId);
                }

                if ($isDefinedOdeBlockId || $isOdePagStructureSyncChange) {
                    $odeComponentsSync->setOdeBlockId($odeBlockId);
                }

                // Can't be changed
                // if ($isDefinedOdeIdeviceId) {
                //    $odeComponentsSync->setOdeIdeviceId($odeIdeviceId);
                // }

                // Can't be changed
                // if ($isDefinedOdeIdeviceTypeName) {
                //    $odeComponentsSync->setOdeIdeviceTypeName($odeIdeviceTypeName);
                // }

                if ($isDefinedHtmlView) {
                    $odeComponentsSync->setHtmlView($htmlView);
                }

                if ($isDefinedJsonProperties) {
                    $odeComponentsSync->setJsonProperties($jsonProperties);
                }

                if ($isDefinedOrder) {
                    $odeComponentsSync->setOdeComponentsSyncOrder($order);
                }
            }
        }

        $this->entityManager->persist($odeComponentsSync);

        if (!$odeComponentsSync->areAllOdeComponentsSyncPropertiesInitialized()) {
            // initialize OdeComponentsSyncProperties
            $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

            $odeComponentsSync->loadOdeComponentsSyncPropertiesFromOdePagStructureSync();

            foreach ($odeComponentsSync->getOdeComponentsSyncProperties() as $odeComponentsSyncProperties) {
                $this->entityManager->persist($odeComponentsSyncProperties);
            }
        }

        $this->entityManager->flush();

        // reorder odeComponentsSyncs of the current OdePagStructureSync
        if ($isNewOdeComponentsSync || $isDefinedOrder || $isOdePagStructureSyncChange) {
            $modifiedOdeComponentsSyncs = $this->reorderOdeComponentsSync($odeComponentsSync, $odeComponentsSync->getOdeComponentsSyncOrder());

            // if its page change don't return $modifiedOdeComponentsSyncs
            if ($isOdePagStructureSyncChange && $isOdeNavStructureSyncChange) {
                $modifiedOdeComponentsSyncs = null;
            }
        }

        if ($isNewOdePagStructureSync) {
            if ($isDefinedOdePagStructureSyncOrder) {
                $newOrder = $odePagStructureSyncOrder;
            } elseif ($isOdeNavStructureSyncChange) {
                $newOrder = $odePagStructureSync->getMaxOrder() + 1;
            } else {
                $newOrder = $odePagStructureSyncOrderDefault;
            }

            $modifiedOdePagStructureSyncs = $this->pagStructureApiService->reorderOdePagStructureSync($odePagStructureSync, $newOrder);
        }

        if (($isOdePagStructureSyncChange && (!empty($previousOdePagStructureSync))) && (!$previousOdePagStructureSync->getOdeComponentsSyncs()->isEmpty())) {
            // reorder odeComponentsSyncs of the previous OdePagStructureSync
            $odeComponentsSyncPreviousSibling = $previousOdePagStructureSync->getOdeComponentsSyncs()->first();

            $modifiedOdeComponentsSyncsPreviousSibling = $this->reorderOdeComponentsSync($odeComponentsSyncPreviousSibling, $odeComponentsSyncPreviousSibling->getOdeComponentsSyncOrder());
        }

        $this->entityManager->flush();

        // check if the files are in use
        if (!empty($odeComponentsSync) && !$isNewOdeComponentsSync && null !== $htmlView) {
            $this->cleanUnusedFilesOdeComponentsSync($odeComponentsSync);
        }

        if (!empty($odeComponentsSync)) {
            $responseData->setOdeComponentsSyncId($odeComponentsSync->getId());

            $loadOdeComponentsSyncProperties = true;

            $odeComponentsSyncDto = new OdeComponentsSyncDto();
            $odeComponentsSyncDto->loadFromEntity($odeComponentsSync, $loadOdeComponentsSyncProperties);

            $responseData->setOdeComponentsSync($odeComponentsSyncDto);
        }
        $responseData->setIsNewOdeComponentsSync($isNewOdeComponentsSync);

        if (!empty($modifiedOdeComponentsSyncs)) {
            $modifiedOdeComponentsSyncDtos = [];
            $loadOdeComponentsSyncProperties = true;

            foreach ($modifiedOdeComponentsSyncs as $modifiedOdeComponentsSync) {
                $odeComponentsSyncDto = new OdeComponentsSyncDto();
                $odeComponentsSyncDto->loadFromEntity($modifiedOdeComponentsSync, $loadOdeComponentsSyncProperties);
                $modifiedOdeComponentsSyncDtos[$modifiedOdeComponentsSync->getId()] = $odeComponentsSyncDto;
            }
        }

        if (!empty($modifiedOdeComponentsSyncsPreviousSibling)) {
            if (empty($modifiedOdeComponentsSyncDtos)) {
                $modifiedOdeComponentsSyncDtos = [];
            }

            $loadOdeComponentsSyncProperties = true;

            foreach ($modifiedOdeComponentsSyncsPreviousSibling as $modifiedOdeComponentsSyncPreviousSibling) {
                $odeComponentsSyncDto = new OdeComponentsSyncDto();
                $odeComponentsSyncDto->loadFromEntity($modifiedOdeComponentsSyncPreviousSibling, $loadOdeComponentsSyncProperties);
                $modifiedOdeComponentsSyncDtos[$modifiedOdeComponentsSyncPreviousSibling->getId()] = $odeComponentsSyncDto;
            }
        }

        if (!empty($modifiedOdeComponentsSyncDtos)) {
            $responseData->setOdeComponentsSyncs($modifiedOdeComponentsSyncDtos);
        }

        if ((empty($odePagStructureSync)) && (!empty($odeComponentsSync))) {
            $odePagStructureSync = $odeComponentsSync->getOdePagStructureSync();
        }

        if (!empty($odePagStructureSync)) {
            $responseData->setOdePagStructureSyncId($odePagStructureSync->getId());

            $loadOdeComponentsSync = false;
            $loadOdePagStructureSyncProperties = true;
            $loadOdeComponentsSyncProperties = false;

            $odePagStructureSyncDto = new OdePagStructureSyncDto();
            $odePagStructureSyncDto->loadFromEntity($odePagStructureSync, $loadOdeComponentsSync, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);
            $this->logger->info('publishing in saveOdeComponentsSync');
            $this->publish($odePagStructureSync->getOdeSessionId(), 'new-content-published');
            $responseData->setOdePagStructureSync($odePagStructureSyncDto);
        }

        $responseData->setIsNewOdePagStructureSync($isNewOdePagStructureSync);

        if (!empty($modifiedOdePagStructureSyncs)) {
            $modifiedOdePagStructureSyncDtos = [];

            $loadOdeComponentsSync = false;
            $loadOdePagStructureSyncProperties = true;
            $loadOdeComponentsSyncProperties = false;

            foreach ($modifiedOdePagStructureSyncs as $modifiedOdePagStructureSync) {
                $odePagStructureSyncDto = new OdePagStructureSyncDto();
                $odePagStructureSyncDto->loadFromEntity($modifiedOdePagStructureSync, $loadOdeComponentsSync, $loadOdePagStructureSyncProperties, $loadOdeComponentsSyncProperties);
                $modifiedOdePagStructureSyncDtos[$modifiedOdePagStructureSync->getId()] = $odePagStructureSyncDto;
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

        $responseData->setIsNewOdeNavStructureSync($isNewOdeNavStructureSync);
        $responseData->setResponseMessage('OK');

        return $responseData;
    }

    #[Route('/reorder/save', methods: ['PUT'], name: 'api_idevices_idevice_reorder')]
    public function reorderOdeComponentsSyncAction(Request $request)
    {
        $this->hydrateRequestBody($request);

        $responseData = [];
        $responseData['odeComponentsSyncs'] = [];

        $modifiedOdeComponentsSyncs = [];

        $odeComponentsSyncId = $request->get('odeComponentsSyncId');
        $isDefinedOdeComponentsSyncId = $request->request->has('odeComponentsSyncId');

        $newOrder = $request->get('order');
        if ((!empty($newOrder)) && (!is_int($newOrder))) {
            $newOrder = intval($newOrder);
        }
        $isDefinedOrder = $request->request->has('order');

        // Validate received data
        if (!$isDefinedOdeComponentsSyncId || !$isDefinedOrder) {
            $this->logger->error('invalid data', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // if $odeComponentsSyncId is set load data from database
        if (!empty($odeComponentsSyncId)) {
            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);

            $odeComponentsSync = $odeComponentsSyncRepo->find($odeComponentsSyncId);

            if (!empty($odeComponentsSync)) {
                $modifiedOdeComponentsSyncs = $this->reorderOdeComponentsSync($odeComponentsSync, $newOrder);
                $this->entityManager->flush();

                $modifiedOdeComponentsSyncDtos = [];
                $loadOdeComponentsSyncProperties = true;

                foreach ($modifiedOdeComponentsSyncs as $modifiedOdeComponentsSync) {
                    $odeComponentsSyncDto = new OdeComponentsSyncDto();
                    $odeComponentsSyncDto->loadFromEntity($modifiedOdeComponentsSync, $loadOdeComponentsSyncProperties);
                    $modifiedOdeComponentsSyncDtos[$modifiedOdeComponentsSync->getId()] = $odeComponentsSyncDto;
                }
                $this->publish($odeComponentsSync->getOdeSessionId(), 'new-content-published');
                $responseData['responseMessage'] = 'OK';
                $responseData['odeComponentsSyncs'] = $modifiedOdeComponentsSyncDtos;
            } else {
                $this->logger->error('data not found', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('data not found', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: data not found';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    /**
     * Reorders the odeComponentsSync and its siblings.
     *
     * @param OdeComponentsSync $odeComponentsSync
     * @param int               $newOrder
     *
     * @return OdeComponentsSync[]
     */
    private function reorderOdeComponentsSync($odeComponentsSync, $newOrder)
    {
        $modifiedOdeComponentsSyncs = [];
        $auxNewOrder = [];

        $previousOrder = $odeComponentsSync->getOdeComponentsSyncOrder();

        $auxNewOrder[$odeComponentsSync->getId()] = $newOrder;

        // Process siblings
        foreach ($odeComponentsSync->getOdePagStructureSync()->getOdeComponentsSyncs() as $odeComponentsSyncSibling) {
            if ($odeComponentsSyncSibling->getId() != $odeComponentsSync->getId()) {
                if ($odeComponentsSyncSibling->getOdeComponentsSyncOrder() == $newOrder) {
                    if ($newOrder > $previousOrder) {
                        $auxNewOrder[$odeComponentsSyncSibling->getId()] = $odeComponentsSyncSibling->getOdeComponentsSyncOrder() - 1;
                    } else {
                        $auxNewOrder[$odeComponentsSyncSibling->getId()] = $odeComponentsSyncSibling->getOdeComponentsSyncOrder() + 1;
                    }
                } elseif ($odeComponentsSyncSibling->getOdeComponentsSyncOrder() > $newOrder) {
                    $auxNewOrder[$odeComponentsSyncSibling->getId()] = $odeComponentsSyncSibling->getOdeComponentsSyncOrder() + 1;
                } else {
                    $auxNewOrder[$odeComponentsSyncSibling->getId()] = $odeComponentsSyncSibling->getOdeComponentsSyncOrder() - 1;
                }
            }
        }

        asort($auxNewOrder, SORT_NUMERIC);

        // Process siblings
        foreach ($odeComponentsSync->getOdePagStructureSync()->getOdeComponentsSyncs() as $odeComponentsSyncSibling) {
            $order = array_search($odeComponentsSyncSibling->getId(), array_keys($auxNewOrder));

            if (false !== $order) {
                $odeComponentsSyncSibling->setOdeComponentsSyncOrder($order + 1);
                $this->entityManager->persist($odeComponentsSyncSibling);

                $modifiedOdeComponentsSyncs[$odeComponentsSyncSibling->getId()] = $odeComponentsSyncSibling;
            }
        }

        // Force to process current OdeComponentsSync if it wasn't processed
        if (!isset($modifiedOdeComponentsSyncs[$odeComponentsSync->getId()])) {
            $order = array_search($odeComponentsSync->getId(), array_keys($auxNewOrder));

            if (false !== $order) {
                $odeComponentsSync->setOdeComponentsSyncOrder($order + 1);
                $this->entityManager->persist($odeComponentsSync);

                $modifiedOdeComponentsSyncs[$odeComponentsSync->getId()] = $odeComponentsSync;
            }
        }

        return $modifiedOdeComponentsSyncs;
    }

    #[Route('/{odeComponentsSyncId}/delete', methods: ['DELETE'], name: 'api_idevices_idevice_delete')]
    public function deleteOdeComponentsSyncAction(Request $request, $odeComponentsSyncId)
    {
        $responseData = [];

        // Get user
        $user = $this->getUser();

        // Remove save flag active
        $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);

        // if $odeComponentsSyncId is set load data from database
        if (!empty($odeComponentsSyncId)) {
            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);

            $odeComponentsSync = $odeComponentsSyncRepo->find($odeComponentsSyncId);

            if (!empty($odeComponentsSync)) {
                // Get iDevice dir
                $odeComponentsSyncDir = $this->fileHelper->getOdeComponentsSyncDir($odeComponentsSync->getOdeSessionId(), $odeComponentsSync->getOdeIdeviceId());

                if (!$odeComponentsSyncDir) {
                    $this->logger->error('iDevice dir doesn\'t exist', ['odeSessionId' => $odeComponentsSync->getOdeSessionId(), 'odeIdeviceId' => $odeComponentsSync->getOdeIdeviceId(), 'file:' => $this, 'line' => __LINE__]);
                }

                $dirRemoved = FileUtil::removeDir($odeComponentsSyncDir);

                if ($dirRemoved) {
                    // Move element to delete to the last position
                    $newOrder = $odeComponentsSync->getMaxOrder();
                    ++$newOrder;

                    $modifiedOdeComponentsSyncs = $this->reorderOdeComponentsSync($odeComponentsSync, $newOrder);

                    $this->entityManager->remove($odeComponentsSync);

                    $modifiedOdeComponentsSyncDtos = [];
                    $loadOdeComponentsSyncProperties = false;

                    foreach ($modifiedOdeComponentsSyncs as $modifiedOdeComponentsSync) {
                        if ($modifiedOdeComponentsSync->getId() != $odeComponentsSyncId) {
                            $odeComponentsSyncDto = new OdeComponentsSyncDto();
                            $odeComponentsSyncDto->loadFromEntity($modifiedOdeComponentsSync, $loadOdeComponentsSyncProperties);
                            $modifiedOdeComponentsSyncDtos[$modifiedOdeComponentsSync->getId()] = $odeComponentsSyncDto;
                        }
                    }

                    $this->entityManager->flush();
                    $this->publish($odeComponentsSync->getOdeSessionId(), 'structure-changed');
                    $responseData['responseMessage'] = 'OK';
                    $responseData['odeComponentsSyncs'] = $modifiedOdeComponentsSyncDtos;
                } else {
                    $this->logger->error('dir cannot be removed', ['dir' => $odeComponentsSyncDir, 'file:' => $this, 'line' => __LINE__]);
                    $responseData['responseMessage'] = 'error: dir cannot be removed';
                }
            } else {
                $this->logger->error('data not found', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);
                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);
            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/upload/file/resources', methods: ['POST'], name: 'api_idevices_upload_file_resources')]
    public function uploadFileToResourcesAction(Request $request)
    {
        // collect parameters
        $odeSessionId = $request->get('odeSessionId');
        $odeIdeviceId = $request->get('odeIdeviceId');
        $base64String = $request->get('file');
        $filename = $request->get('filename');
        $createThumbnail = $request->get('createThumbnail');

        // Validate received data
        if (
            (empty($odeIdeviceId))
            || (empty($base64String))
            || (empty($filename))
        ) {
            $this->logger->error('invalid data', ['odeIdeviceId' => $odeIdeviceId, 'file:' => $this, 'line' => __LINE__]);

            $responseData = ['code' => 'error: invalid data'];

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // if odeSessionId is empty load it from database
        if ((empty($odeSessionId)) && (!empty($odeIdeviceId))) {
            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);

            $odeComponentsSync = $odeComponentsSyncRepo->findOneBy(['odeIdeviceId' => $odeIdeviceId]);

            if (!empty($odeComponentsSync)) {
                $odeSessionId = $odeComponentsSync->getOdeSessionId();
            }
        }

        // Validate received data
        if (empty($odeSessionId)) {
            $this->logger->error('invalid data', ['odeIdeviceId' => $odeIdeviceId, 'file:' => $this, 'line' => __LINE__]);

            $responseData = ['code' => 'error: invalid data'];

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $cleanFilename = str_replace(' ', '_', $filename); // replaces all spaces with underscores
        $cleanFilename = preg_replace('/[^A-Za-z0-9_\-\.]/', '', $cleanFilename); // removes special chars

        // generate new filename
        $savedFilename = $cleanFilename;

        $responseData = [];

        $iDeviceDir = $this->fileHelper->getOdeComponentsSyncDir($odeSessionId, $odeIdeviceId);

        $savedFilename = $this->fileHelper->addFilenameSuffix($savedFilename, $iDeviceDir);

        if (!$iDeviceDir) {
            $this->logger->error('iDevice dir doesn\'t exist', ['odeSessionId' => $odeSessionId, 'odeIdeviceId' => $odeIdeviceId, 'file:' => $this, 'line' => __LINE__]);

            $responseData = ['code' => 'error: iDevice dir doesn\'t exist'];

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $output_file = $iDeviceDir.$savedFilename;

        // open the output file for writing
        $ifp = fopen($output_file, 'wb');

        // split the string on commas
        $data = explode(',', $base64String);
        if (isset($data[1])) {
            fwrite($ifp, base64_decode($data[1]));
        }

        // clean up the file resource
        fclose($ifp);

        // File size
        $fileSize = filesize($output_file);
        $fileSizeFormatted = FileUtil::formatFilesize($fileSize);

        // Check allowed mimeTypes
        $isAllowedFile = FileUtil::checkMimeTypeBase64($base64String);
        // Check filesize
        $isBelowMaxFileSize = FileUtil::checkFileSize($fileSize);
        if (!$isAllowedFile || !$isBelowMaxFileSize) {
            $this->logger->error('mime type not allowed or size over limit', ['base64' => $base64String, 'fileSize' => $fileSize, 'odeIdeviceId' => $odeIdeviceId, 'file:' => $this, 'line' => __LINE__]);

            // Delete restricted file
            FileUtil::removeFile($output_file);

            if (!$isAllowedFile) {
                $responseData = ['code' => 'error: mime type not allowed'];
            } else {
                $responseData = ['code' => 'error: file size over limit'];
            }
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Check mimetype to make the thumbnail
        $thumbValidMimeTypes = ['image/jpeg', 'image/gif', 'image/png'];
        $dataMimeType = explode(';', $data[0]);
        $mimeType = explode(':', $dataMimeType[0]);
        if (in_array($mimeType[1], $thumbValidMimeTypes) && 'true' == $createThumbnail) {
            try {
                Util::checkPhpGdExtension();

                // Create thumbnail binary content
                $thumbnailBinary = $this->thumbnailService->getThumbnailBinary($output_file);

                // Create thumbnail
                $data = $this->thumbnailService->createThumbnail($savedFilename, $iDeviceDir, $thumbnailBinary);

                $responseData['savedThumbnailName'] = $data['thumb_name'];
            } catch (PhpGdExtensionException $e) {
                $this->logger->error($e->getDescription(), ['className' => $e->getClassName(), 'phpGdExtensionInstalled' => $e->getGdExtensionInstalled(), 'file:' => $this, 'line' => __LINE__]);

                $responseData['phpThumbnailGdExtensionError'] = $this->translator->trans($e->getDescription());
            }
        }

        $responseData['odeSessionId'] = $odeSessionId;
        $responseData['odeIdeviceId'] = $odeIdeviceId;
        $responseData['originalFilename'] = $filename;
        $responseData['savedPath'] = UrlUtil::getOdeComponentsSyncUrl($odeSessionId, $odeIdeviceId);
        $responseData['savedFilename'] = $savedFilename;
        $responseData['savedFileSize'] = $fileSizeFormatted;

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/upload/large/file/resources', methods: ['POST'], name: 'api_idevices_upload_large_file_resources')]
    public function uploadLargeFileToResourcesAction(Request $request)
    {
        // collect parameters
        $odeSessionId = $request->get('odeSessionId');
        $odeIdeviceId = $request->get('odeIdeviceId');
        $filename = $request->get('filename');
        $createThumbnail = $request->get('createThumbnail');

        $file = $request->files->get('file');

        // Check that file was posted
        if ((empty($file)) || (empty($file->getPathname()))) {
            $this->logger->error('invalid file', ['file' => $file, 'file:' => $this, 'line' => __LINE__]);

            $responseData = ['code' => $this->translator->trans('File is too large')];

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $fileData = file_get_contents($file->getPathname());

        // Validate received data
        if (
            (empty($odeIdeviceId))
            || (empty($fileData))
            || (empty($filename))
        ) {
            $this->logger->error('invalid data', ['odeIdeviceId' => $odeIdeviceId, 'file:' => $this, 'line' => __LINE__]);

            $responseData = ['code' => 'error: invalid data'];

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // if odeSessionId is empty load it from database
        if ((empty($odeSessionId)) && (!empty($odeIdeviceId))) {
            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);

            $odeComponentsSync = $odeComponentsSyncRepo->findOneBy(['odeIdeviceId' => $odeIdeviceId]);

            if (!empty($odeComponentsSync)) {
                $odeSessionId = $odeComponentsSync->getOdeSessionId();
            }
        }

        // Validate received data
        if (empty($odeSessionId)) {
            $this->logger->error('invalid data', ['odeIdeviceId' => $odeIdeviceId, 'file:' => $this, 'line' => __LINE__]);

            $responseData = ['code' => 'error: invalid data'];

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $cleanFilename = str_replace(' ', '_', $filename); // replaces all spaces with underscores
        $cleanFilename = preg_replace('/[^A-Za-z0-9_\-\.]/', '', $cleanFilename); // removes special chars

        // generate new filename
        $savedFilename = $cleanFilename;

        $responseData = [];

        $iDeviceDir = $this->fileHelper->getOdeComponentsSyncDir($odeSessionId, $odeIdeviceId);

        $savedFilename = $this->fileHelper->addFilenameSuffix($savedFilename, $iDeviceDir);

        if (!$iDeviceDir) {
            $this->logger->error('iDevice dir doesn\'t exist', ['odeSessionId' => $odeSessionId, 'odeIdeviceId' => $odeIdeviceId, 'file:' => $this, 'line' => __LINE__]);

            $responseData = ['code' => 'error: iDevice dir doesn\'t exist'];

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $output_file = $iDeviceDir.$savedFilename;

        file_put_contents($output_file, $fileData);

        // File size
        $fileSize = filesize($output_file);
        $fileSizeFormatted = FileUtil::formatFilesize($fileSize);

        // Check allowed mimeTypes
        $mimeType = $file->getMimeType();
        $isAllowedFile = FileUtil::checkMimeTypeFile($file);
        // Check filesize
        $isBelowMaxFileSize = FileUtil::checkFileSize($fileSize);
        if (!$isAllowedFile || !$isBelowMaxFileSize) {
            $this->logger->error('mime type not allowed or size over limit', ['mimeType' => $mimeType, 'fileSize' => $fileSize, 'odeIdeviceId' => $odeIdeviceId, 'file:' => $this, 'line' => __LINE__]);

            // Delete restricted file
            FileUtil::removeFile($output_file);

            if (!$isAllowedFile) {
                $responseData = ['code' => 'error: mime type not allowed'];
            } else {
                $responseData = ['code' => 'error: file size over limit'];
            }
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Check mimetype to make the thumbnail
        $thumbValidMimeTypes = ['image/jpeg', 'image/gif', 'image/png'];
        if (in_array($mimeType[1], $thumbValidMimeTypes) && 'true' == $createThumbnail) {
            try {
                Util::checkPhpGdExtension();

                // Create thumbnail binary content
                $thumbnailBinary = $this->thumbnailService->getThumbnailBinary($output_file);

                // Create thumbnail
                $data = $this->thumbnailService->createThumbnail($savedFilename, $iDeviceDir, $thumbnailBinary);

                $responseData['savedThumbnailName'] = $data['thumb_name'];
            } catch (PhpGdExtensionException $e) {
                $this->logger->error($e->getDescription(), ['className' => $e->getClassName(), 'phpGdExtensionInstalled' => $e->getGdExtensionInstalled(), 'file:' => $this, 'line' => __LINE__]);

                $responseData['phpThumbnailGdExtensionError'] = $this->translator->trans($e->getDescription());
            }
        }

        $responseData['odeSessionId'] = $odeSessionId;
        $responseData['odeIdeviceId'] = $odeIdeviceId;
        $responseData['originalFilename'] = $filename;
        $responseData['savedPath'] = UrlUtil::getOdeComponentsSyncUrl($odeSessionId, $odeIdeviceId);
        $responseData['savedFilename'] = $savedFilename;
        $responseData['savedFileSize'] = $fileSizeFormatted;

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/download/ode/components/{odeSessionId}/{odeBlockId}/{odeIdeviceId}', methods: ['GET'], name: 'api_idevices_download_ode_components')]
    public function downloadOdeComponentsAction(Request $request, $odeSessionId, $odeBlockId, $odeIdeviceId)
    {
        $responseData = [];

        // Get user
        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        $saveOdeResult = $this->odeService->saveOdeComponent($odeSessionId, $databaseUser, $odeIdeviceId, $odeBlockId);
        if ('OK' == $saveOdeResult['responseMessage']) {
            // Remove save flag active
            $this->currentOdeUsersService->removeActiveSyncSaveFlag($user);

            $path = $this->fileHelper->getOdeSessionDistDirForUser($odeSessionId, $databaseUser);

            $filePathName = $path.$saveOdeResult['elpFileName'];

            $response = new BinaryFileResponse($filePathName);
            $response->headers->set('Content-Type', FileUtil::getFileMimeType($filePathName));

            if (!empty($odeIdeviceId) && 'null' !== $odeIdeviceId) {
                $response->setContentDisposition(ResponseHeaderBag::DISPOSITION_ATTACHMENT, $odeIdeviceId.'.'.Constants::IDEVICE_ELP_NAME);
            } else {
                $response->setContentDisposition(ResponseHeaderBag::DISPOSITION_ATTACHMENT, $odeBlockId.'.'.Constants::BLOCK_ELP_NAME);
            }

            $response->deleteFileAfterSend(true);

            return $response;
        }
        $responseData['responseMessage'] = $saveOdeResult['responseMessage'];

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/ode/local/idevices/open', methods: ['POST'], name: 'api_odes_ode_local_idevices_open')]
    public function openLocalIdevicesAction(Request $request)
    {
        $responseData = [];

        // collect parameters
        $elpFileName = $request->get('odeFileName');
        $elpFilePath = $request->get('odeFilePath');
        $odeNavStructureSyncId = $request->get('odeNavStructureSyncId');

        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        $isImportIdevices = true;
        $forceCloseOdeUserPreviousSession = true;

        $odeNavStructureSyncRepository = $this->entityManager->getRepository(OdeNavStructureSync::class);
        $odeNavStructureSync = $odeNavStructureSyncRepository->find($odeNavStructureSyncId);

        // Check content in the xml and return values
        $odeValues = $this->odeService->checkLocalOdeFile($elpFileName, $elpFilePath, $databaseUser, $forceCloseOdeUserPreviousSession, $isImportIdevices, $odeNavStructureSync);

        if ('OK' !== $odeValues['responseMessage']) {
            $responseData['responseMessage'] = $odeValues['responseMessage'];
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Create the structure in database
        $result = $this->odeService->createElpStructure(
            $user,
            $odeValues,
            $isImportIdevices,
            $odeNavStructureSync
        );

        if (!empty($odeValues['responseMessage'])) {
            $responseData['responseMessage'] = $odeValues['responseMessage'];
        }

        // Get first blockId and send on the response
        $responseData['odeBlockId'] = $result['odeBlocksMapping'][0];

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/download/file/resources', methods: ['GET'], name: 'api_idevices_download_file_resources')]
    public function downloadFileFromResourcesAction(Request $request)
    {
        $resource = $request->query->get('resource');
        $filePathName = null;

        // Quick fix to serve "perm" files directly from /app and not from /mnt
        // If resource starts with "perm/", override base directory
        if (0 === strpos($resource, 'perm/')) {
            $base = '/app/public/files/perm/';
            // Remove the "perm/" prefix to avoid duplicating it in the final path
            $resourcePath = substr($resource, strlen('perm/'));
        } else {
            $base = $this->fileHelper->getFilesDir();
            $resourcePath = $resource;
        }

        $filePathName = $base.$resourcePath;

        // If the file does not exist in the original location, try in public/files
        if (!file_exists($filePathName)) {
            $projectDir = $this->getParameter('kernel.project_dir');
            $alternativePath = $projectDir.'/public/files/'.$resource;

            if (file_exists($alternativePath)) {
                $filePathName = $alternativePath;
            }
        }

        if (file_exists($filePathName)) {
            $fileName = basename($filePathName);
            $response = new BinaryFileResponse($filePathName);
            switch (pathinfo($fileName)['extension']) {
                case 'css':
                    $response->headers->set('Content-Type', 'text/css');
                    break;
                case 'js':
                    $response->headers->set('Content-Type', 'text/javascript');
                    break;
                case 'woff2':
                    $response->headers->set('Content-Type', 'font/woff2');
                    break;
                default:
                    $response->headers->set('Content-Type', FileUtil::getFileMimeType($filePathName));
            }

            return $response;
        } else {
            $this->status = self::STATUS_CODE_NOT_FOUND;
            $responseData = [];
            $responseData['responseMessage'] = 'error: file not found';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }
    }

    #[Route('/force/download/file/resources', methods: ['GET'], name: 'api_idevices_force_download_file_resources')]
    public function forceDownloadFileFromResourcesAction(Request $request)
    {
        $resource = $request->get('resource');

        $resource = str_replace('files/', '', $resource);

        $base = $this->fileHelper->getFilesDir();

        $filePathName = $base.$resource;

        if (file_exists($filePathName)) {
            $fileName = basename($filePathName);

            $response = new BinaryFileResponse($filePathName);

            switch (pathinfo($fileName)['extension']) {
                case 'css':
                    $response->headers->set('Content-Type', 'text/css');
                    break;
                case 'js':
                    $response->headers->set('Content-Type', 'text/javascript');
                    break;
                case 'woff2':
                    $response->headers->set('Content-Type', 'font/woff2');
                    break;
                case 'xml':
                    $response->headers->set('Content-Type', 'application/octet-stream');
                    $response->headers->set('Content-Disposition', 'attachment; filename='.$fileName);
                    break;
                default:
                    $response->headers->set('Content-Type', FileUtil::getFileMimeType($filePathName));
            }

            $response->setContentDisposition(ResponseHeaderBag::DISPOSITION_ATTACHMENT, $fileName);

            return $response;
        } else {
            $this->status = self::STATUS_CODE_NOT_FOUND;

            $responseData = [];
            $responseData['responseMessage'] = 'error: file not found';

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }
    }

    #[Route('/properties/save', methods: ['PUT'], name: 'api_idevices_idevice_properties_save')]
    public function saveOdeComponentsSyncPropertiesAction(Request $request)
    {
        $this->hydrateRequestBody($request);

        $responseData = [];
        $responseData['odeComponentsSync'] = null;

        // collect parameters
        $odeComponentsSyncId = $request->get('odeComponentsSyncId');
        $isDefinedOdeComponentsSyncId = $request->request->has('odeComponentsSyncId');

        // Validate received data
        if (!$isDefinedOdeComponentsSyncId) {
            $this->logger->error('invalid data', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // if $odeComponentsSyncId is set load data from database
        if (!empty($odeComponentsSyncId)) {
            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);

            $odeComponentsSync = $odeComponentsSyncRepo->find($odeComponentsSyncId);

            if (!empty($odeComponentsSync)) {
                // initialize OdeComponentsSyncProperties
                $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

                foreach ($odeComponentsSync->getOdeComponentsSyncProperties() as $odeComponentsSyncProperties) {
                    if (null != $odeComponentsSyncProperties->getKey()) {
                        $value = $request->get($odeComponentsSyncProperties->getKey());
                        $isDefinedValue = $request->request->has($odeComponentsSyncProperties->getKey());

                        // set received value for property
                        if ($isDefinedValue && (isset($value))) {
                            $odeComponentsSyncProperties->setValue($value);
                        } else {
                            // restore to defaults
                            $odeComponentsSyncProperties->loadFromPropertiesConfig(
                                $odeComponentsSync,
                                $odeComponentsSyncProperties->getKey(),
                                Properties::ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG[$odeComponentsSyncProperties->getKey()]
                            );
                        }

                        $this->entityManager->persist($odeComponentsSyncProperties);
                    }
                }

                $this->entityManager->flush();

                $responseData['responseMessage'] = 'OK';

                $loadOdeComponentsSyncProperties = true;

                $odeComponentsSyncDto = new OdeComponentsSyncDto();
                $odeComponentsSyncDto->loadFromEntity($odeComponentsSync, $loadOdeComponentsSyncProperties);
                $this->publish($odeComponentsSync->getOdeSessionId(), 'new-content-published');
                $responseData['odeComponentsSync'] = $odeComponentsSyncDto;
            } else {
                $this->logger->error('data not found', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/duplicate', methods: ['POST'], name: 'api_idevices_idevice_duplicate')]
    public function duplicateOdeComponentsSyncDataAction(Request $request)
    {
        $responseData = [];
        $responseData['odeComponentsSync'] = null;
        $responseData['odeComponentsSyncs'] = null;

        // collect parameters
        $odeComponentsSyncId = $request->get('odeComponentsSyncId');
        $isDefinedOdeComponentsSyncId = $request->request->has('odeComponentsSyncId');

        // Validate received data
        if (!$isDefinedOdeComponentsSyncId) {
            $this->logger->error('invalid data', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // if $odeComponentsSyncId is set load data from database
        if (!empty($odeComponentsSyncId)) {
            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);

            $odeComponentsSync = $odeComponentsSyncRepo->find($odeComponentsSyncId);

            if (!empty($odeComponentsSync)) {
                $newOdeComponentsSync = $odeComponentsSync->duplicate();

                $newOdeComponentsSync->setOdeComponentsSyncOrder($newOdeComponentsSync->getOdeComponentsSyncOrder() + 1);

                // Case: image-gallery need to change jsonProperties and HtmlView to the new idevice id
                if ('image-gallery' == $newOdeComponentsSync->getOdeIdeviceTypeName()) {
                    $newJsonProperties = str_replace($odeComponentsSync->getOdeIdeviceId(), $newOdeComponentsSync->getOdeIdeviceId(), $newOdeComponentsSync->getJsonProperties());
                    $newHtmlView = str_replace($odeComponentsSync->getOdeIdeviceId(), $newOdeComponentsSync->getOdeIdeviceId(), $newOdeComponentsSync->getHtmlView());
                    $newOdeComponentsSync->setJsonProperties($newJsonProperties);
                    $newOdeComponentsSync->setHtmlView($newHtmlView);
                }

                foreach ($newOdeComponentsSync->getOdeComponentsSyncProperties() as $odeComponentsSyncPropertiesElem) {
                    $this->entityManager->persist($odeComponentsSyncPropertiesElem);
                }

                $this->entityManager->persist($newOdeComponentsSync);

                $sourcePath = $this->fileHelper->getOdeComponentsSyncDir($odeComponentsSync->getOdeSessionId(), $odeComponentsSync->getOdeIdeviceId());

                $destinationPath = $this->fileHelper->getOdeComponentsSyncDir($newOdeComponentsSync->getOdeSessionId(), $newOdeComponentsSync->getOdeIdeviceId());

                $dirCopied = FileUtil::copyDir($sourcePath, $destinationPath);

                if ($dirCopied) {
                    $modifiedOdeComponentsSyncs = $this->reorderOdeComponentsSync($newOdeComponentsSync, $newOdeComponentsSync->getOdeComponentsSyncOrder());

                    $this->entityManager->flush();

                    $responseData['responseMessage'] = 'OK';

                    $loadOdeComponentsSyncProperties = true;

                    $newOdeComponentsSyncDto = new OdeComponentsSyncDto();
                    $newOdeComponentsSyncDto->loadFromEntity($newOdeComponentsSync, $loadOdeComponentsSyncProperties);

                    $responseData['odeComponentsSync'] = $newOdeComponentsSyncDto;

                    if (!empty($modifiedOdeComponentsSyncs)) {
                        $modifiedOdeComponentsSyncDtos = [];
                        $loadOdeComponentsSyncProperties = true;

                        foreach ($modifiedOdeComponentsSyncs as $modifiedOdeComponentsSync) {
                            $odeComponentsSyncDto = new OdeComponentsSyncDto();
                            $odeComponentsSyncDto->loadFromEntity($modifiedOdeComponentsSync, $loadOdeComponentsSyncProperties);
                            $modifiedOdeComponentsSyncDtos[$modifiedOdeComponentsSync->getId()] = $odeComponentsSyncDto;
                        }
                        $this->publish($odeComponentsSync->getOdeSessionId(), 'new-content-published');
                        $responseData['odeComponentsSyncs'] = $modifiedOdeComponentsSyncDtos;
                    }
                } else {
                    $this->logger->error('dir could not be duplicated', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

                    $responseData['responseMessage'] = 'error: dir could not be duplicated';
                }
            } else {
                $this->logger->error('data not found', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'error: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odeComponentsSyncId' => $odeComponentsSyncId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    /**
     * Clean files in odecomponentdir if unused.
     *
     * @param OdeComponentsSync $odeComponentsSync
     */
    private function cleanUnusedFilesOdeComponentsSync($odeComponentsSync)
    {
        $odeComponentsSyncDir = $this->fileHelper->getOdeComponentsSyncDir($odeComponentsSync->getOdeSessionId(), $odeComponentsSync->getOdeIdeviceId());

        if (false !== $odeComponentsSyncDir) {
            $htmlView = $odeComponentsSync->getHtmlView();

            // List files in array
            $files = FileUtil::listFilesByParentFolder($odeComponentsSyncDir);

            if (!empty($htmlView)) {
                // Check in each file if it's used
                foreach ($files as $file) {
                    if (!str_contains($htmlView, $file)) {
                        FileUtil::removeDir(realpath($odeComponentsSyncDir).DIRECTORY_SEPARATOR.$file);
                    }
                }
            }
        }
    }

    #[Route('/get/ode/idevice/brokenlinks/{odeIdeviceId}', methods: ['GET'], name: 'api_odes_idevice_get_broken_links')]
    public function getOdeIdeviceBrokenLinks(Request $request, $odeIdeviceId)
    {
        if (!empty($odeIdeviceId)) {
            // Base URL
            $symfonyFullUrl = self::getSymfonyUrl($request);

            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);
            $odeComponentsSync = $odeComponentsSyncRepo->findBy(['odeIdeviceId' => $odeIdeviceId]);
            if (!empty($odeComponentsSync)) {
                $responseData = $this->odeComponentsSyncService->getBrokenLinks($symfonyFullUrl, $odeComponentsSync);
            } else {
                $this->logger->notice('data not found', ['odeIdeviceId' => $odeIdeviceId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'notice: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odeIdeviceId' => $odeIdeviceId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/get/ode/block/brokenlinks/{odeBlockId}', methods: ['GET'], name: 'api_odes_block_get_broken_links')]
    public function getOdeBlockBrokenLinks(Request $request, $odeBlockId)
    {
        if (!empty($odeBlockId)) {
            // Base URL
            $symfonyFullUrl = self::getSymfonyUrl($request);

            $odeComponentsSyncRepo = $this->entityManager->getRepository(OdeComponentsSync::class);
            $odeComponentsSync = $odeComponentsSyncRepo->findBy(['odeBlockId' => $odeBlockId]);

            if (!empty($odeComponentsSync)) {
                $responseData = $this->odeComponentsSyncService->getBrokenLinks($symfonyFullUrl, $odeComponentsSync);
            } else {
                $this->logger->notice('data not found', ['odeBlockId' => $odeBlockId, 'file:' => $this, 'line' => __LINE__]);

                $responseData['responseMessage'] = 'notice: data not found';
            }
        } else {
            $this->logger->error('invalid data', ['odeBlockId' => $odeBlockId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }
}
