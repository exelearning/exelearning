<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;
use App\Entity\net\exelearning\Dto\UserPreferencesDto;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Util\net\exelearning\Util\FileUtil;
use App\Util\net\exelearning\Util\GoogleUtil;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Routing\Generator\UrlGenerator;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/google')]
class GoogleApiController extends DefaultApiController
{
    public const PROJECT_NAME = 'Untitled document';

    private $router;
    private $fileHelper;
    private $odeService;
    private $userHelper;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        UrlGeneratorInterface $router,
        FileHelper $fileHelper,
        OdeServiceInterface $odeService,
        UserHelper $userHelper,
        SerializerInterface $serializer,
    ) {
        $this->router = $router;
        $this->fileHelper = $fileHelper;
        $this->odeService = $odeService;
        $this->userHelper = $userHelper;

        parent::__construct($entityManager, $logger, $serializer);
    }

    #[Route('/oauth/login/url/get', methods: ['GET'], name: 'api_google_oauth_login_url_get')]
    public function getGoogleOauthLoginAction(Request $request)
    {
        $redirectUri = $this->getRedirectUri();
        $googleClientId = $this->getParameter('google_client_id');

        // Google OAuth URL
        $googleOauthURL = GoogleUtil::GOOGLE_OAUTH_URL.'?scope='.urlencode(GoogleUtil::GOOGLE_DRIVE_OAUTH_SCOPE).
            '&redirect_uri='.$redirectUri.'&response_type=code&client_id='.$googleClientId
            .'&access_type=online';

        $data = [
            'url' => $googleOauthURL,
        ];

        $jsonData = $this->getJsonSerialized($data);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/drive/folders/list', methods: ['GET'], name: 'api_google_drive_folders_list')]
    public function listGoogleDriveFoldersAction(Request $request)
    {
        $session = $request->getSession();
        $code = $session->get(Constants::SESSION_GOOGLE_CODE);

        $redirectUri = $this->getRedirectUri();

        // Get the access token
        if (!empty($session->get(Constants::SESSION_GOOGLE_ACCESS_TOKEN))) {
            $access_token = $session->get(Constants::SESSION_GOOGLE_ACCESS_TOKEN);
        } else {
            $googleClientId = $this->getParameter('google_client_id');
            $googleClientSecret = $this->getParameter('google_client_secret');

            $data = GoogleUtil::getAccessToken($googleClientId, $googleClientSecret, $redirectUri, $code);
            if (is_array($data)) {
                $access_token = $data['access_token'];
                $session->set(Constants::SESSION_GOOGLE_ACCESS_TOKEN, $access_token);
            } else {
                $jsonData = $this->getJsonSerialized($data);

                return new JsonResponse($jsonData, $this->status, [], true);
            }
        }

        // list of folders
        $folders = GoogleUtil::listDriveFolders($access_token);
        $data = [
            'folders' => $folders,
        ];

        $jsonData = $this->getJsonSerialized($data);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/drive/file/upload', methods: ['POST'], name: 'api_google_drive_file_upload')]
    public function uploadFileToGoogleDriveAction(Request $request)
    {
        // collect parameters
        $odeSessionId = $request->get('odeSessionId');
        $odeId = $request->get('odeId');
        $odeVersion = $request->get('odeVersion');

        // Get user
        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        $saveOdeResult = $this->getElpFile($odeSessionId, $databaseUser, $user);

        // Path to the file and name
        $fileDir = $this->fileHelper->getOdeSessionDistDirForUser($odeSessionId, $databaseUser);
        $fileName = $saveOdeResult['elpFileName'];

        $status = 'danger';
        $statusMsg = '';
        $link = null;
        $linkName = null;

        $session = $request->getSession();
        $code = $session->get(Constants::SESSION_GOOGLE_CODE);

        if (isset($code)) {
            if (!empty($fileName)) {
                $target_file = $fileDir.$fileName;
                $file_content = file_get_contents($target_file);
                $mime_type = mime_content_type($target_file);

                // Get the access token
                if (!empty($session->get(Constants::SESSION_GOOGLE_ACCESS_TOKEN))) {
                    $access_token = $session->get(Constants::SESSION_GOOGLE_ACCESS_TOKEN);
                } else {
                    $redirectUri = $this->getRedirectUri();

                    $googleClientId = $this->getParameter('google_client_id');
                    $googleClientSecret = $this->getParameter('google_client_secret');

                    $code = $request->get('code');

                    $data = GoogleUtil::getAccessToken($googleClientId, $googleClientSecret, $redirectUri, $code);
                    if (is_array($data)) {
                        $access_token = $data['access_token'];
                        $session->set(Constants::SESSION_GOOGLE_ACCESS_TOKEN, $access_token);
                    } else {
                        $jsonData = $this->getJsonSerialized($data);

                        return new JsonResponse($jsonData, $this->status, [], true);
                    }
                }

                if (!empty($access_token)) {
                    // Upload to drive
                    $drive_file_id = GoogleUtil::uploadFileToDrive($access_token, $file_content, $mime_type);

                    // Drive file name
                    $odeProperties = $this->odeService->getOdePropertiesFromDatabase($odeId, $user);
                    $odePropertiesName = $odeProperties['pp_title']->getValue();

                    // Check value property name
                    if ('' == $odePropertiesName) {
                        $odePropertiesName = self::PROJECT_NAME.Constants::FILE_EXTENSION_SEPARATOR.Constants::FILE_EXTENSION_ELP;
                    } else {
                        $odePropertiesName = $odePropertiesName.Constants::FILE_EXTENSION_SEPARATOR.Constants::FILE_EXTENSION_ELP;
                    }

                    if ($drive_file_id) {
                        $file_meta = [
                            'name' => basename($odePropertiesName),
                        ];

                        // Update the metadata of the file and sets the folder of the upload
                        $addParents = $request->get('folder');
                        $drive_file_meta = GoogleUtil::updateFileMetaToDrive($access_token, $drive_file_id, $file_meta, $addParents);

                        $status = 'Success';
                        $statusMsg = 'The file has been uploaded';
                        $link = GoogleUtil::GOOGLE_DRIVE_FILE_OPEN_URL.'?id='.$drive_file_id;
                        $linkName = $drive_file_meta['name'];
                    }
                } else {
                    $statusMsg = 'The token is missing';
                }
            } else {
                $statusMsg = 'The file is missing';
            }
        } else {
            $statusMsg = 'File reference missing';
        }

        // Clear file after upload
        FileUtil::removeFile($fileDir.$fileName);

        $data = [
            'status' => $status,
            'statusMsg' => $statusMsg,
            'link' => $link,
            'linkName' => $linkName,
        ];

        $jsonData = $this->getJsonSerialized($data);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/redirect/close', methods: ['GET'], name: 'api_google_drive_redirect_close')]
    public function redirectAndCloseAction(Request $request)
    {
        $code = $request->get('code');
        $session = $request->getSession();
        $session->set(Constants::SESSION_GOOGLE_CODE, $code);

        $jsScript = '';
        $arrayJs = '{ element: "navbar-button-uploadtodrive", event: "click"}';
        $jsScript .= 'window.opener.eXeLearning.app.actions.addPendingAction('.$arrayJs.');';
        $jsScript .= 'window.close();';

        return new Response(
            '<html><head><script type="text/javascript">'.$jsScript.'</script></head></html>'
        );
    }

    /**
     * Returns redirect uri for services.
     *
     * @return string
     */
    private function getRedirectUri()
    {
        return $this->router->generate(
            'api_google_drive_redirect_close',
            [],
            UrlGenerator::ABSOLUTE_URL
        );
    }

    /**
     * Create and get elp name.
     *
     * @param string $odeSessionId
     * @param object $databaseUser
     *
     * @return array
     */
    private function getElpFile($odeSessionId, $databaseUser, $user)
    {
        // if $odeSessionId is set load data from database
        if (!empty($odeSessionId)) {
            $isManualSave = true;

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

            $saveOdeResult = $this->odeService->saveOde($odeSessionId, $databaseUser, $isManualSave, $odeProperties, $userPreferencesDtos);

            return $saveOdeResult;
        } else {
            $this->logger->error('invalid data', ['odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]);
        }
    }
}
