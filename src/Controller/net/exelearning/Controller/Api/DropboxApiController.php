<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;
use App\Entity\net\exelearning\Dto\UserPreferencesDto;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Util\net\exelearning\Util\DropboxUtil;
use App\Util\net\exelearning\Util\FileUtil;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Routing\Generator\UrlGenerator;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/dropbox')]
class DropboxApiController extends DefaultApiController
{
    public const PROJECT_NAME = 'Untitled document';
    public const DATA_CONTENT_IS_FOLDER = 'folder';

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

    #[Route('/oauth/login/url/get', methods: ['GET'], name: 'api_dropbox_oauth_login_url_get')]
    public function getDropboxOauthLoginAction(Request $request)
    {
        $redirectUri = $this->getRedirectUri();
        $dropboxClientId = $this->getParameter('dropbox_client_id');

        // Dropbox OAuth URL
        $dropboxOAuthURL = DropboxUtil::DROPBOX_API_OAUTH2_URL.'?client_id='
            .$dropboxClientId.'&redirect_uri='.$redirectUri.'&response_type=code';

        $data = [
            'url' => $dropboxOAuthURL,
        ];

        $jsonData = $this->getJsonSerialized($data);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/dropbox/folders/list', methods: ['GET'], name: 'api_dropbox_folders_list')]
    public function listDropboxFoldersAction(Request $request)
    {
        $session = $request->getSession();
        $code = $session->get(Constants::SESSION_DROPBOX_CODE);

        $redirectUri = $this->getRedirectUri();

        // Get the access token
        if (!empty($session->get(Constants::SESSION_DROPBOX_ACCESS_TOKEN))) {
            // If the session has not expired, the access token will be stored
            $access_token = $session->get(Constants::SESSION_DROPBOX_ACCESS_TOKEN);
        } else {
            // if the curl response is not correct, we generate a "Failed to generate token" message
            $data = DropboxUtil::getAccessDropboxToken($redirectUri, $code);

            if (is_array($data)) {
                $access_token = $data['access_token'];
                $session->set(Constants::SESSION_DROPBOX_ACCESS_TOKEN, $access_token);
            } else {
                $jsonData = $this->getJsonSerialized($data);

                return new JsonResponse($jsonData, $this->status, [], true);
            }
        }

        // list of folders
        $folders = DropboxUtil::listDropboxFolders($access_token);

        $data = $this->getDropboxFoldersDataStructure($folders);

        $jsonData = $this->getJsonSerialized($data);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/dropbox/file/upload', methods: ['POST'], name: 'api_dropbox_file_upload')]
    public function uploadFileToDropboxAction(Request $request)
    {
        // collect parameters
        $odeSessionId = $request->get('odeSessionId');
        $odeId = $request->get('odeId');
        $odeVersion = $request->get('odeVersion');

        // Get user
        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        // Save actual ode session to upload
        $saveOdeResult = $this->getElpFile($odeSessionId, $databaseUser, $user);

        // Path to local file
        $fileName = $saveOdeResult['elpFileName'];
        $filePath = $this->fileHelper->getOdeSessionDistDirForUser($odeSessionId, $databaseUser).$fileName;

        $status = 'danger';
        $statusMsg = '';

        // Get dropbox session
        $session = $request->getSession();
        $code = $session->get(Constants::SESSION_DROPBOX_CODE);

        if (isset($code)) {
            if (!empty($fileName)) {
                // Get the access token
                if (!empty($session->get(Constants::SESSION_DROPBOX_ACCESS_TOKEN))) {
                    $access_token = $session->get(Constants::SESSION_DROPBOX_ACCESS_TOKEN);
                } else {
                    $redirectUri = $this->getRedirectUri();
                    $code = $request->get('code');

                    $data = DropboxUtil::getAccessDropboxToken($redirectUri, $code);

                    if (is_array($data)) {
                        $access_token = $data['access_token'];
                        $session->set(Constants::SESSION_DROPBOX_ACCESS_TOKEN, $access_token);
                    } else {
                        $jsonData = $this->getJsonSerialized($data);

                        return new JsonResponse($jsonData, $this->status, [], true);
                    }
                }

                if (!empty($access_token)) {
                    // Get the folder id that was selected
                    $file_id = $request->get('folder');

                    if ('null' != $file_id) {
                        // Add the folder path to the file
                        $folder_metadata = DropboxUtil::updateFileMetaToDropbox($access_token, $file_id);

                        if (is_object($folder_metadata)) {
                            $folder_name = $folder_metadata->{'path_display'};
                        } else {
                            $folder_name = $folder_metadata['path_display'];
                        }
                    } else {
                        // In case the folder selected was root
                        $folder_name = null;
                    }

                    // Dropbox elp file name
                    $odeProperties = $this->odeService->getOdePropertiesFromDatabase($odeId, $user);
                    $odePropertiesName = $odeProperties['pp_title']->getValue();

                    // Check value property name
                    if ('' == $odePropertiesName) {
                        $odePropertiesName = self::PROJECT_NAME.Constants::FILE_EXTENSION_SEPARATOR.Constants::FILE_EXTENSION_ELP;
                    } else {
                        $odePropertiesName = $odePropertiesName.Constants::FILE_EXTENSION_SEPARATOR.Constants::FILE_EXTENSION_ELP;
                    }

                    // Upload file to dropbox
                    $dropbox_id = DropboxUtil::uploadFileToDropbox($access_token, $odePropertiesName, $filePath, $folder_name);

                    if ($dropbox_id) {
                        $status = 'Success';
                        $statusMsg = 'The file has been uploaded';
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

        // Clear elp file after upload
        FileUtil::removeFile($filePath);

        $data = [
            'status' => $status,
            'statusMsg' => $statusMsg,
        ];

        $jsonData = $this->getJsonSerialized($data);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/redirect/close', methods: ['GET'], name: 'api_dropbox_redirect_close')]
    public function redirectAndCloseActionDropbox(Request $request)
    {
        $code = $request->get('code');
        $session = $request->getSession();
        $session->set(Constants::SESSION_DROPBOX_CODE, $code);

        $jsScript = '';
        $arrayJs = '{ element: "navbar-button-uploadtodropbox", event: "click"}';
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
            'api_dropbox_redirect_close',
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

    /**
     * Create folder array structure.
     *
     * @param array|object $dropboxData
     *
     * @return array
     */
    private function getDropboxFoldersDataStructure($dropboxData)
    {
        // If the curl response is not correct, we generate a "Failed to access generated token" message
        if (false == is_object($dropboxData)) {
            if (is_array($dropboxData)) {
                // Variable to check if the data has any folder
                $isFolders = false;

                // Change array structure
                foreach ($dropboxData['entries'] as $dir) {
                    if (self::DATA_CONTENT_IS_FOLDER == $dir['.tag']) {
                        $dir['tag'] = $dir['.tag'];
                        unset($dir['.tag']);
                        $names[] = $dir;
                        $isFolders = true;
                    }
                }
                // If there are files but no folders, the folders names is NULL
                if (false == $isFolders) {
                    $names[] = null;
                }

                $data = [
                    'folders' => ['files' => $names],
                ];

                return $data;
            } else {
                $data = $dropboxData;

                return $data;
            }
        } else {
            // Variable to check if the data has any folder
            $isFolders = false;

            // Change object structure
            if ($dropboxData->entries) {
                foreach ($dropboxData->entries as $ae) {
                    if (self::DATA_CONTENT_IS_FOLDER == $ae->{'.tag'}) {
                        $ae->{'tag'} = $ae->{'.tag'};
                        unset($ae->{'.tag'});
                        $names[] = $ae;
                        $isFolders = true;
                    }
                }

                // If there are files but no folders, the folders names is NULL
                if (false == $isFolders) {
                    $names[] = null;
                }

            // If there are no files or folders, the folders names is NULL
            } else {
                $names[] = null;
            }

            $data = [
                'folders' => ['files' => $names],
            ];

            return $data;
        }
    }
}
