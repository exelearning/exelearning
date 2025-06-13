<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Exception\net\exelearning\Exception\Logical\UserInsufficientSpaceException;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeComponentsSyncServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeExportServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Service\net\exelearning\Service\Api\PlatformIntegrationServiceInterface;
use App\Util\net\exelearning\Util\IntegrationUtil;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\RedirectController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Contracts\Translation\TranslatorInterface;

class PlatformIntegrationApiController extends DefaultApiController
{
    private $fileHelper;
    private $odeService;
    private $odeComponentsSyncService;
    private $odeExportService;
    private $platformIntegrationService;
    private $userHelper;
    private $currentOdeUsersService;
    private $translator;
    private $redirectController;
    private $integrationUtil;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        FileHelper $fileHelper,
        OdeServiceInterface $odeService,
        OdeComponentsSyncServiceInterface $odeComponentsSyncService,
        UserHelper $userHelper,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        TranslatorInterface $translator,
        RedirectController $redirectController,
        PlatformIntegrationServiceInterface $platformIntegrationService,
        OdeExportServiceInterface $odeExportService,
    ) {
        $this->fileHelper = $fileHelper;
        $this->odeService = $odeService;
        $this->odeComponentsSyncService = $odeComponentsSyncService;
        $this->odeExportService = $odeExportService;
        $this->userHelper = $userHelper;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->translator = $translator;
        $this->redirectController = $redirectController;
        $this->platformIntegrationService = $platformIntegrationService;
        $this->integrationUtil = new IntegrationUtil($logger);
        parent::__construct($entityManager, $logger);
    }

    #[Route('/new_ode', methods: ['GET'], name: 'api_platform_integration_new_ode')]
    public function getPlatformNewOdeAction(Request $request)
    {
        // Base URL
        $symfonyBaseUrl = $request->getSchemeAndHttpHost();
        $symfonyBasePath = $request->getBaseURL();
        $symfonyFullUrl = $symfonyBaseUrl.$symfonyBasePath;

        $jwtToken = $request->get('jwt_token');

        $redirect = new RedirectResponse('/');
        $redirect->setTargetUrl($symfonyFullUrl.'/workarea?newOde=new&jwt_token='.$jwtToken.'');

        // Debug redirect
        $this->logger->debug('redirect to new session:', ['redirect:' => $redirect, 'file:' => $this, 'line' => __LINE__]);

        return $redirect;
    }

    #[Route('/api/platform/integration/set_platform_new_ode', methods: ['POST'], name: 'set_platform_new_ode')]
    public function setPlatformNewOdeAction(Request $request)
    {
        $responseData = [];

        // collect parameters
        $odeSessionId = $request->get('odeSessionId');
        $jwtToken = $request->get('jwt_token');
        $integrationParams = $this->integrationUtil->getParamsMoodleIntegration($jwtToken, 'set');

        // if $odeSessionId is set load data from database
        if (!empty($odeSessionId)) {
            $user = $this->getUser();
            $databaseUser = $this->userHelper->getDatabaseUser($user);

            // Obtain odeId and odeVersionId from currentOdeUsers
            $odeId = $this->currentOdeUsersService->getOdeIdByOdeSessionId($user, $odeSessionId);
            $odeVersion = $this->currentOdeUsersService->getOdeVersionIdByOdeSessionId($user, $odeSessionId);

            // Get the last version_name from ode_files
            $lastOdeVersionName = $this->odeService->getLastVersionNameOdeFiles($odeId);
            $odeVersionName = intval($lastOdeVersionName) + 1;

            $isManualSave = true;

            try {
                // Get user preferences
                $odeProperties = $this->odeService->getOdePropertiesFromDatabase($odeSessionId, $user);

                $odeExportResult = $this->odeExportService->export(
                    $user,
                    $databaseUser,
                    $odeSessionId,
                    false,
                    $integrationParams['exportType'],
                    false,
                    true
                );
                if ('OK' == $odeExportResult['responseMessage']) {
                    // Properties title
                    $odePropertiesName = $odeProperties['pp_title']->getValue();
                    if (empty($odePropertiesName)) {
                        $odePropertiesName = Constants::ELP_PROPERTIES_NO_TITLE_NAME;
                    }

                    $odeResultParameters = [
                        'odeId' => $odeId,
                        'odeVersionId' => $odeVersion,
                        'odeSessionId' => $odeSessionId,
                        'elpFileName' => $odeExportResult['zipFileName'],
                        'odePropertiesName' => $odePropertiesName,
                        'odeVersionName' => $odeVersionName,
                        'exportProjectName' => $odeExportResult['exportProjectName'],
                    ];

                    $filePathName = str_replace('files/', $_ENV['FILES_DIR'], $odeExportResult['urlZipFile']);
                    // Upload file to platform and get ode platform id
                    $platformJsonResponse = $this->platformIntegrationService->platformPetitionSet($user, $odeResultParameters, $integrationParams['platformIntegrationUrl'], $filePathName, $jwtToken);
                    // TO DO redirect to
                    if (isset($platformJsonResponse['error'])) {
                        $responseData['responseMessage'] = $platformJsonResponse['error'];

                        $jsonData = $this->getJsonSerialized($responseData);

                        return new JsonResponse($jsonData, $this->status, [], true);
                    }

                    $responseData['responseMessage'] = $platformJsonResponse['description'];
                    $responseData['returnUrl'] = $integrationParams['returnurl'];
                // TO DO Eliminado por no ser necesario por el JWT
                // $this->odeService->setOdePlatformId($saveOdeResult['elpFileName'], $platformJsonResponse['ode_id']);
                } else {
                    $responseData['responseMessage'] = $odeExportResult['responseMessage'];
                }
            } catch (UserInsufficientSpaceException $e) {
                $responseData['responseMessage'] = 'error: '.$e->getMessage();
            }
        } else {
            $this->logger->error('invalid data', ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]);

            $responseData['responseMessage'] = 'error: invalid data';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/edit_ode', methods: ['GET'], name: 'get_platform_ode')]
    public function getPlatformEditOdeAction(Request $request)
    {
        $responseData = [];

        // collect parameters
        // Get odeId from the platform
        $odeId = $request->get('ode_id');

        $jwtToken = $request->get('jwt_token');
        // TO DO: parar la aplicación si el JWT no es válido porque este es el punto de entrada de la integración

        // Debug redirect
        $this->logger->debug('ode_id to receive from platform:', ['ode_id:' => $odeId, 'file:' => $this, 'line' => __LINE__]);

        if (!empty($odeId)) {
            // Base URL
            $symfonyBaseUrl = $request->getSchemeAndHttpHost();
            $symfonyBasePath = $request->getBaseURL();
            $symfonyFullUrl = $symfonyBaseUrl.$symfonyBasePath;

            $redirect = new RedirectResponse('/');
            $redirect->setTargetUrl($symfonyFullUrl.'/workarea?odeId='.$odeId.'&jwt_token='.$jwtToken.'');

            // Debug redirect
            $this->logger->debug('redirect get platform ode_id:', ['redirect:' => $redirect, 'file:' => $this, 'line' => __LINE__]);

            return $redirect;
        }
    }

    #[Route('/api/platform/integration/openPlatformElp', methods: ['GET', 'POST'], name: 'open_platform_elp')]
    public function openPlatformElpAction(Request $request)
    {
        // Base URL
        $symfonyBaseUrl = $request->getSchemeAndHttpHost();
        $symfonyBasePath = $request->getBaseURL();
        $symfonyFullUrl = $symfonyBaseUrl.$symfonyBasePath;

        $jwtToken = $request->get('jwt_token');
        $integrationParams = $this->integrationUtil->getParamsMoodleIntegration($jwtToken, 'get');

        // Get parameters
        // odeId from platform
        $odePlatformId = $integrationParams['cmid'];

        $odeSessionId = $request->get('odeSessionId');

        // Get user
        $user = $integrationParams['userid'];
        $databaseUser = $this->userHelper->getDatabaseUser($this->getUser());

        // Get ode base 64 and name from petition
        $platformJsonResponse = $this->platformIntegrationService->platformPetitionGet($user, $odePlatformId, $integrationParams['platformIntegrationUrl'], $jwtToken);
        if (isset($platformJsonResponse['error'])) {
            $responseData['responseMessage'] = $platformJsonResponse['error'];

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Save file and open to load in BBDD and set folders
        $elpFilePath = $this->fileHelper->getOdeSessionDistDirForUser($odeSessionId, $databaseUser);
        $elpFileName = $elpFilePath.$platformJsonResponse['ode_filename'];
        $elpName = $platformJsonResponse['ode_filename'];

        // Save in perm
        $ifp = fopen($elpFileName, 'wb');
        $data = explode(',', $platformJsonResponse['ode_file']);
        if (isset($data[0])) {
            fwrite($ifp, base64_decode($data[0]));
        }
        fclose($ifp);

        // Close open session
        $forceCloseOdeUserPreviousSession = true;

        $jsonData = [
            'responseMessage' => 'OK',
            'odeSessionId' => $odeSessionId,
            'elpFileName' => $elpName,
            'elpFilePath' => $elpFileName,
            'forceCloseOdeUserPreviousSession' => $forceCloseOdeUserPreviousSession,
        ];

        $jsonResponse = $this->getJsonSerialized($jsonData);

        return new JsonResponse($jsonResponse, $this->status, [], true);
    }
}
