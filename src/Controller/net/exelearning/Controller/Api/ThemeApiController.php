<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;
use App\Entity\net\exelearning\Dto\ThemeListDto;
use App\Exception\net\exelearning\Exception\Logical\PhpZipExtensionException;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\ThemeHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Util\net\exelearning\Util\FileUtil;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/theme-management/themes')]
class ThemeApiController extends DefaultApiController
{
    private ThemeHelper $themeHelper;
    private UserHelper $userHelper;
    private FileHelper $fileHelper;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        ThemeHelper $themeHelper,
        UserHelper $userHelper,
        FileHelper $fileHelper,
        SerializerInterface $serializer,
    ) {
        $this->themeHelper = $themeHelper;
        $this->userHelper = $userHelper;
        $this->fileHelper = $fileHelper;

        parent::__construct($entityManager, $logger, $serializer);
    }

    #[Route('/installed', methods: ['GET'], name: 'api_themes_installed')]
    public function getInstalledThemesAction(Request $request, $jsonResponse = true)
    {
        $session = $request->getSession();
        $data = new ThemeListDto();

        if ($session->has(Constants::SESSION_INSTALLED_THEMES)) {
            // Get themes from session
            $sessionThemes = $session->get(Constants::SESSION_INSTALLED_THEMES);
            foreach ($sessionThemes as $sessionTheme) {
                $data->addTheme($sessionTheme);
            }
        } else {
            // Get installed themes
            $user = $this->getUser();
            $themesInstalledBase = $this->themeHelper->getThemesConfigBase();
            $themesInstalledUser = $this->themeHelper->getThemesConfigUser($user);
            $themesInstalled = array_merge($themesInstalledBase, $themesInstalledUser);
            foreach ($themesInstalled as $theme) {
                if ($theme && $theme->isValid()) {
                    $data->addTheme($theme);
                }
            }
            // Add themes to session
            if (Constants::SAVE_INSTALLED_THEMES_IN_SESSION) {
                $session->set(Constants::SESSION_INSTALLED_THEMES, $themesInstalled);
            }
        }

        if ($jsonResponse) {
            $jsonData = $this->getJsonSerialized($data);

            return new JsonResponse($jsonData, $this->status, [], true);
        } else {
            return $data;
        }
    }

    #[Route('/upload', methods: ['POST'], name: 'api_themes_upload')]
    public function uploadThemeAction(Request $request): JsonResponse
    {
        $UNAUTHORIZED = 'Unauthorized';
        $ERROR_INVALID_DATA = 'Invalid data';
        $ERROR_ZIP_EXTENSION = 'The zip file cannot be unzipped';
        $INSTALL_FAILED = 'Could not install the theme';

        $themesInstallationEnabled = $this->getParameter('app.online_themes_install');
        $isOnline = $this->getParameter('app.online_mode');

        if ($isOnline && !$themesInstallationEnabled) {
            $responseData['responseMessage'] = 'Unauthorized';

            return $this->json($responseData, $this->status);
        }
        try {
            Util::checkPhpZipExtension();
        } catch (PhpZipExtensionException $e) {
            $this->logger->error($ERROR_ZIP_EXTENSION, ['file:' => $this, 'line' => __LINE__]);
            $responseData['error'] = $ERROR_ZIP_EXTENSION;

            return $this->json($responseData, $this->status);
        }

        $user = $this->getUser();

        // Upload zip file parameters
        $base64String = $request->get('file');
        $filename = $request->get('filename');

        // Validate received data
        if ((empty($base64String)) || (empty($filename))) {
            $this->logger->error('invalid data', ['file:' => $this, 'line' => __LINE__]);
            $responseData = ['error' => $ERROR_INVALID_DATA];

            return $this->json($responseData, $this->status);
        }

        // Upload and install theme
        $newTheme = $this->themeHelper->uploadThemeZip($filename, $base64String, $user);

        // Check installed theme
        if ($newTheme && $newTheme['error']) {
            $responseData = ['error' => $newTheme['error']];

            return $this->json($responseData, $this->status);
        } elseif (!isset($newTheme['theme'])) {
            $responseData = ['error' => $INSTALL_FAILED];

            return $this->json($responseData, $this->status);
        }

        // Response
        $responseData = [];
        $responseData['theme'] = $newTheme['theme'];
        $responseData['themes'] = $this->getInstalledThemesAction($request, false);
        $responseData['responseMessage'] = 'OK';

        return $this->json($responseData, $this->status);
    }

    #[Route('/import/odetheme', methods: ['POST'], name: 'api_ode_theme_import')]
    public function importOdeThemeAction(Request $request)
    {
        $responseData = [];
        $isOnline = false;

        $themesInstallationEnabled = $this->getParameter('app.online_themes_install');
        $isOnline = $this->getParameter('app.online_mode');

        if ($isOnline && !$themesInstallationEnabled) {
            $responseData['responseMessage'] = 'Unauthorized';

            return new JsonResponse($this->getJsonSerialized($responseData), $this->status, [], true);
        }

        try {
            Util::checkPhpZipExtension();
        } catch (PhpZipExtensionException $e) {
            $this->logger->error('The zip file cannot be unzipped', ['file:' => $this, 'line' => __LINE__]);
            $responseData['error'] = 'The zip file cannot be unzipped';

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $odeSessionId = $request->get('odeSessionId');
        $themeDirname = $request->get('themeDirname');

        $user = $this->getUser();
        $dbUser = $this->userHelper->getDatabaseUser($user);

        // Copy ode theme in user themes dir
        $odeSessionDir = $this->fileHelper->getOdeSessionDir($odeSessionId);
        $odeSessionThemeDir = $odeSessionDir.DIRECTORY_SEPARATOR.Constants::EXPORT_DIR_THEME;

        $themesDirPath = $this->fileHelper->getThemesUsersDir().$dbUser->getUserId().DIRECTORY_SEPARATOR;
        $themeConfigFile = $odeSessionThemeDir.DIRECTORY_SEPARATOR.'config.xml';
        if (!is_file($themeConfigFile)) {
            $responseData['responseMessage'] = 'Theme configuration not found';

            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $isInstallable = $this->fileHelper->xmlKeyValue($themeConfigFile, Constants::THEME_INSTALLABLE);

        if (!$isInstallable) {
            $responseData['responseMessage'] = 'Unauthorized';

            return new JsonResponse($this->getJsonSerialized($responseData), $this->status, [], true);
        }

        $outputThemePath = $themesDirPath.$themeDirname;
        try {
            FileUtil::copyDir($odeSessionThemeDir, $outputThemePath);

            // Response
            $responseData['themes'] = $this->getInstalledThemesAction($request, false);
            $responseData['responseMessage'] = 'OK';
        } catch (\Exception $e) {
            $this->logger->error('Theme installation failed', [
                'exception' => $e->getMessage(),
                'theme' => $themeDirname,
                'user' => $dbUser->getUserId(),
            ]);
            $responseData['responseMessage'] = 'Could not install the theme';
        }

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/deleteinstaled', methods: ['DELETE'], name: 'api_themes_installed_delete')]
    public function removeThemeInstalledAction(Request $request)
    {
        $responseData = [];

        $user = $this->getUser();

        $themeId = $request->get('id');

        if ($themeId) {
            $themesInstalled = $this->getInstalledThemesAction($request, false);
            $deleted = $themesInstalled->removeTheme($themeId, $user, $this->themeHelper, $this->fileHelper);
            $responseData['deleted'] = $deleted;
        } else {
            $responseData['deleted'] = false;
        }

        $themesNow = $this->getInstalledThemesAction($request, false);

        $responseData['responseMessage'] = 'OK';
        $responseData['themes'] = $themesNow;

        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/{odeSessionId}/{themeDirName}/download', methods: ['GET'], name: 'api_themes_download')]
    public function downloadThemeAction(Request $request, $odeSessionId, $themeDirName)
    {
        $user = $this->getUser();
        $dbUser = $this->userHelper->getDatabaseUser($user);

        // Get theme from base themes
        $type = Constants::IDEVICE_TYPE_BASE;
        $themeDir = $this->themeHelper->getThemeDir($themeDirName, $type);

        // In case you don't find it: get theme from user dir
        if (!file_exists($themeDir)) {
            $type = Constants::IDEVICE_TYPE_USER;
            $themeDir = $this->themeHelper->getThemeDir($themeDirName, $type, $user);
        }

        // Check if theme exists
        if (!file_exists($themeDir)) {
            $responseData = ['error' => 'The theme does not exist'];
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $themeDto = $this->themeHelper->getThemeFromThemeDir($themeDirName, $type, $user);

        // Check if the theme is downloadable
        if (!$themeDto->isDownloadable()) {
            $responseData = ['error' => 'The theme cannot be downloaded'];
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Session user directory
        $sessionTmpUserDir = $this->fileHelper->getOdeSessionUserTmpDir($odeSessionId, $dbUser);
        $tmpThemeZipPath = $sessionTmpUserDir.$themeDirName.'.zip';

        // Generate zip
        FileUtil::zipDir($themeDir, $tmpThemeZipPath);

        // Theme zip base64
        $fpThemeZip = fopen($tmpThemeZipPath, 'rb');
        $binaryThemeZip = fread($fpThemeZip, filesize($tmpThemeZipPath));
        $themeZipBase64 = base64_encode($binaryThemeZip);

        // Response
        $responseData = [];
        $responseData['zipFileName'] = $themeDirName.'.zip';
        $responseData['zipBase64'] = $themeZipBase64;
        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/{themeDirName}/edit', methods: ['PUT'], name: 'api_themes_edit')]
    public function editTheme(Request $request, $themeDirName)
    {
        $this->hydrateRequestBody($request);

        $responseData = [];

        $user = $this->getUser();

        $theme = $this->themeHelper->getThemeFromThemeDir($themeDirName, Constants::THEME_TYPE_USER, $user);
        if (!$theme) {
            $responseData['error'] = 'Could not find the theme';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        $data = $request->get('data');
        if (!$data) {
            $responseData['error'] = 'Invalid data';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Upload image header
        if (isset($data['header-img']) && $data['header-img']) {
            $headerImgName = $theme->uploadImgHeader($this->themeHelper, $user, $data['header-img']);
            $data['header-img'] = $headerImgName;
        }
        // Upload image logo
        if (isset($data['logo-img']) && $data['logo-img']) {
            $logoImgName = $theme->uploadImgLogo($this->themeHelper, $user, $data['logo-img']);
            $data['logo-img'] = $logoImgName;
        }

        // Edit config.xml
        $theme->createConfigXml($this->themeHelper, $data, $user);

        // Edit style css
        $theme->createStyleCss($this->themeHelper, $user);

        $responseData['themes'] = $this->getInstalledThemesAction($request, false);
        $responseData['responseMessage'] = 'OK';
        $jsonData = $this->getJsonSerialized($responseData);

        return new JsonResponse($jsonData, $this->status, [], true);
    }

    #[Route('/new', methods: ['POST'], name: 'api_themes_new')]
    public function newTheme(Request $request)
    {
        $user = $this->getUser();

        $data = $request->get('data');
        if (!$data) {
            $responseData = [];
            $responseData['error'] = 'Invalid data';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }
        if (!$data['title'] || '' === $data['title']) {
            $responseData = [];
            $responseData['error'] = 'Invalid title';
            $jsonData = $this->getJsonSerialized($responseData);

            return new JsonResponse($jsonData, $this->status, [], true);
        }

        // Get dirname based in title
        $dirName = $data['title'];
        $dirName = str_replace(' ', '_', $dirName);
        $dirName = preg_replace("/[^A-Za-z0-9\-]/", '_', $dirName);
        $dirName = Util::generateId().'_'.$dirName;

        // Create directory
        $this->themeHelper->makeEmptyThemes($dirName, $user);

        // Edit theme
        return $this->editTheme($request, $dirName);
    }
}
