<?php

namespace App\Controller\net\exelearning\Controller\Workarea;

use App\Constants;
use App\Entity\net\exelearning\Entity\User;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersSyncChangesServiceInterface;
use App\Service\net\exelearning\Service\FilesDir\FilesDirServiceInterface;
use App\Translation\net\exelearning\Translation\Translator;
use App\Util\net\exelearning\Util\SettingsUtil;
use Doctrine\ORM\EntityManagerInterface;
use Firebase\JWT\JWT;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Routing\Annotation\Route;

class WorkareaController extends DefaultWorkareaController
{
    private $security;
    private $entityManager;
    private $userHelper;
    private $fileHelper;
    private $filesDirService;
    private $translator;
    private $currentOdeUsersService;
    private $logger;
    private $currentOdeUsersSyncChangesService;

    /**
     * @param CurrentOdeUsersService $currentOdeUsersService
     */
    public function __construct(
        RequestStack $requeststack,
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        Security $security,
        UserHelper $userHelper,
        FileHelper $fileHelper,
        FilesDirServiceInterface $filesDirService,
        Translator $translator,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        CurrentOdeUsersSyncChangesServiceInterface $currentOdeUsersSyncChangesService,
        HubInterface $hubInterface,
    ) {
        $this->entityManager = $entityManager;
        $this->logger = $logger;
        $this->security = $security;
        $this->userHelper = $userHelper;
        $this->fileHelper = $fileHelper;
        $this->filesDirService = $filesDirService;
        $this->translator = $translator;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->currentOdeUsersSyncChangesService = $currentOdeUsersSyncChangesService;
    }

    #[Route('/workarea', name: 'workarea')]
    public function workareaAction(Request $request)
    {
        // die("hola");
        // Get odeSessionId
        $odeSessionId = $request->get('shareCode');

        // Get elpFileName
        $odePlatformNew = $request->get('newOde');
        $odePlatformId = $request->get('odeId');

        // Check installation type
        $isOfflineInstallation = SettingsUtil::installationTypeIsOffline();

        // Platform selected.
        // If offline mode is activated or integration has not token, $platformIntegration is false
        $platformIntegration = true;
        if (empty($request->query->get('jwt_token')) || $isOfflineInstallation) {
            $platformIntegration = false;
        }

        $platformSelected = SettingsUtil::setPlatform();
        $platformName = $platformSelected['name'];
        $platformUrlGet = $platformSelected['get'];
        $platformUrlSet = $platformSelected['set'];
        $platformType = $platformSelected['type'];

        // Twig template
        $view = 'workarea/workarea.html.twig';

        // Generate FILES_DIR structure
        $filesDirInfo = $this->generateFilesDirStructure();

        // Base URL
        $symfonyBaseUrl = $request->getSchemeAndHttpHost();
        $symfonyBasePath = $this->getParameter('base_path');
        $symfonyFullUrl = $symfonyBaseUrl.$symfonyBasePath;

        // Changelog file
        $changelogFileUrl = $symfonyFullUrl.Constants::SLASH.Constants::CHANGELOG_FILE_NAME;

        // User
        $userLogged = $this->getUser();

        // Check that you do not have a user and that offline mode is activated
        if (empty($userLogged) && $isOfflineInstallation) {
            // If you don't have a user, create an anonymous user
            $userLogged = new User();
            $userLogged->setEmail('anonymous-exe-1@exelearning.net');
        }

        if (empty($userLogged) && !$isOfflineInstallation) {
            $shareCode = $request->query->get('shareCode');
            if ($shareCode) {
                return $this->redirectToRoute('app_login', ['shareCode' => $shareCode]);
            }

            return $this->redirectToRoute('app_login');
        }

        // If it doesn't exist it creates the user in the database, if not it just gets it
        $dbUser = $this->userHelper->createNewUserIfNeccessary($userLogged);
        // Get properties of user
        $databaseUserPreferences = $this->userHelper->getUserPreferencesFromDatabase($userLogged);
        // Lopd
        $acceptedLopd = $this->acceptedLopd($userLogged);
        // User name
        $userLoggedName = $this->userHelper->getLoggedUserName($userLogged);
        // User first letter
        $userLoggedNameFirsLetter = $this->getFirstLetter($userLoggedName);

        // User gravatar url
        $userGravatarUrl = $this->userHelper->getUserGravatarUrl($userLogged);

        // Client config
        $clientCallWaitingTime = Constants::CLIENT_CALL_WAITING_TIME;
        // Client interval get last edition
        $clientIntervalGetLastEdition = Constants::CLIENT_INTERVAL_GET_LAST_EDITION;
        // Client interval get last edition
        $clientIntervalUpdate = Constants::CLIENT_INTERVAL_GET_UPDATES;
        // Default user locale
        $defaultLocale = $this->getParameter('kernel.default_locale');

        // Override the default locale of the application according to the user's language preferences
        $localeUserPreferences = $databaseUserPreferences['locale']->getValue();

        // If the language preference is null use the Symfony detected locale
        if (empty($localeUserPreferences)) {
            $localeUserPreferences = $request->getLocale();
        }

        $request->setLocale($localeUserPreferences);
        $request->setDefaultLocale($localeUserPreferences);
        $this->translator->setLocale($request->getLocale());

        // Themes
        $themeTypeBase = Constants::THEME_TYPE_BASE;
        $themeTypeUser = Constants::THEME_TYPE_USER;
        // Default theme
        $defaultTheme = Constants::THEME_DEFAULT;
        // Themes css file
        $themeDefaultCssFile = Constants::THEME_DEFAULT_CSS_FILE;

        // Idevices
        $ideviceTypeBase = Constants::IDEVICE_TYPE_BASE;
        $ideviceTypeUser = Constants::IDEVICE_TYPE_USER;
        $ideviceVisibilityPreferencePre = Constants::IDEVICE_VISIBILITY_PREFERENCE_PRE;

        // Empty user rows on synchronize table
        $this->currentOdeUsersSyncChangesService->removeSyncActionsByUser($userLogged);

        // Try to set theme of the ode propietary if shareSession
        if (!empty($odeSessionId)) {
            $sessionUser = $this->currentOdeUsersSyncChangesService->getAnotherUserSyncSession($userLogged, $odeSessionId);
            if (!empty($sessionUser)) {
                // Retrieve the session user's preferences
                $sessionUserPreferences = $this->userHelper->getSessionUserPreferencesFromDatabase($sessionUser);
                // Check if the 'theme' key exists in the session user's preferences
                if (isset($sessionUserPreferences['theme'])) {
                    $sessionUserThemePreference = $sessionUserPreferences['theme']->getValue();
                    // Check if the database user preferences contain the 'theme' key
                    if (isset($databaseUserPreferences['theme'])) {
                        $userPreferences = $databaseUserPreferences['theme'];
                        $userPreferences->setValue($sessionUserThemePreference);
                        // Persist changes to the database
                        $this->entityManager->persist($userPreferences);
                        $this->entityManager->flush();
                    } else {
                        // Optionally log that the key 'theme' is missing in $databaseUserPreferences
                    }
                } else {
                    // Optionally log that the key 'theme' is missing in the session user's preferences
                }
            }
        }

        // Check if the application is in online mode
        $appOnlineMode = filter_var($this->getParameter('app.online_mode'), FILTER_VALIDATE_BOOLEAN);
        // Get the Mercure JWT secret key from the environment
        $secretKey = $this->getParameter('mercure_jwt_secret_key');
        $mercure = null;

        // Configure Mercure only if the app is online and the secret key is provided.
        if ($appOnlineMode && !empty($secretKey)) {
            // This Mercure url will be set for clients, so public url is used.
            $mercureUrl = $this->getParameter('mercure_public_url');

            // If left blank, the app will fallback to the current host + '/.well-known/mercure'.
            if (empty($mercureUrl)) {
                $mercureUrl = rtrim($request->getSchemeAndHttpHost(), '/').'/.well-known/mercure';
            }

            $payload = [
                'mercure' => [
                    'subscribe' => ['*'],
                    'publish' => ['*'],
                ],
            ];
            $mercure = [
                'url' => $mercureUrl,
                'jwtSecretKey' => JWT::encode($payload, $secretKey, 'HS256'),
            ];
        }

        // Render
        return $this->render(
            $view,
            [
                'user' => [
                    'username' => $userLoggedName,
                    'usernameFirsLetter' => $userLoggedNameFirsLetter,
                    'acceptedLopd' => $acceptedLopd,
                    'odePlatformId' => $odePlatformId,
                    'newOde' => $odePlatformNew,
                    'gravatarUrl' => $userGravatarUrl,
                ],
                'config' => [
                    'platformName' => $platformName,
                    'platformType' => $platformType,
                    'platformUrlGet' => $platformUrlGet,
                    'platformUrlSet' => $platformUrlSet,
                    'clientCallWaitingTime' => $clientCallWaitingTime,
                    'clientIntervalGetLastEdition' => $clientIntervalGetLastEdition,
                    'clientIntervalUpdate' => $clientIntervalUpdate,
                    'defaultTheme' => $defaultTheme,
                    'isOfflineInstallation' => $isOfflineInstallation,
                    'platformIntegration' => $platformIntegration,
                ],
                'symfony' => [
                    'odeSessionId' => $odeSessionId,
                    'environment' => $_ENV['APP_ENV'],
                    'baseURL' => $symfonyBaseUrl,
                    'basePath' => $symfonyBasePath,
                    'fullURL' => $symfonyFullUrl,
                    'changelogURL' => $changelogFileUrl,
                    'filesDirPermission' => $filesDirInfo,
                    'locale' => $localeUserPreferences,
                    'themeTypeBase' => $themeTypeBase,
                    'themeTypeUser' => $themeTypeUser,
                    'themeDefaultCssFile' => $themeDefaultCssFile,
                    'ideviceTypeBase' => $ideviceTypeBase,
                    'ideviceTypeUser' => $ideviceTypeUser,
                    'ideviceVisibilityPreferencePre' => $ideviceVisibilityPreferencePre,
                ],
                'mercure' => $mercure,
            ]
        );
    }

    /**
     * Get first letter of string.
     *
     * @param string $string
     *
     * @return string
     */
    public function getFirstLetter($string)
    {
        if ($string) {
            $firstLetter = ucfirst(substr($string, 0, 1));
        } else {
            $firstLetter = '';
        }

        return $firstLetter;
    }

    /**
     * Check if user has accepted the LOPD.
     *
     * @param User $userLogged
     *
     * @return bool
     */
    public function acceptedLopd($userLogged)
    {
        $user = $this->userHelper->getDatabaseUser($userLogged);
        if (!empty($user)) {
            return $user->getIsLopdAccepted();
        }

        return false;
    }

    /**
     * Generate FILES_DIR directory structure.
     *
     * @return array
     */
    public function generateFilesDirStructure()
    {
        return $this->filesDirService->checkFilesDir();
    }
}
