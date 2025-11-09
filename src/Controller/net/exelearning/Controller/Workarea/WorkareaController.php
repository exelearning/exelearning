<?php

namespace App\Controller\net\exelearning\Controller\Workarea;

use App\Constants;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Repository\net\exelearning\Repository\OdeFilesRepository;
use App\Repository\net\exelearning\Repository\UserRepository;
use App\Repository\Project\ProjectCollaboratorRepository;
use App\Repository\Project\ProjectRepository;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersSyncChangesServiceInterface;
use App\Service\net\exelearning\Service\FilesDir\FilesDirServiceInterface;
use App\Translation\net\exelearning\Translation\Translator;
use App\Util\net\exelearning\Util\SettingsUtil;
use App\Util\net\exelearning\Util\Util;
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
    private ProjectRepository $projectRepo;
    private ProjectCollaboratorRepository $collaboratorRepo;
    private OdeFilesRepository $odeFilesRepo;
    private UserRepository $userRepo;
    private readonly bool $countUserAutosaveSpace;
    private readonly int $userRecentOdeFilesAmount;

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
        ProjectRepository $projectRepo,
        ProjectCollaboratorRepository $collaboratorRepo,
        OdeFilesRepository $odeFilesRepo,
        UserRepository $userRepo,
        HubInterface $hubInterface,
        bool $countUserAutosaveSpace,
        int $userRecentOdeFilesAmount,
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
        $this->projectRepo = $projectRepo;
        $this->collaboratorRepo = $collaboratorRepo;
        $this->odeFilesRepo = $odeFilesRepo;
        $this->userRepo = $userRepo;
        $this->countUserAutosaveSpace = $countUserAutosaveSpace;
        $this->userRecentOdeFilesAmount = $userRecentOdeFilesAmount;
    }

    #[Route('/workarea', name: 'workarea')]
    public function workareaAction(Request $request)
    {
        // Get projectId (primary parameter)
        $requestedProjectId = $request->query->get('projectId') ?? $request->query->get('project');

        // Legacy support: Get odeSessionId and redirect to project URL if needed
        $requestedOdeSessionId = $request->query->get('odeSessionId');
        $odeSessionId = $requestedOdeSessionId ?? $request->get('shareCode');

        // If odeSessionId is provided but no projectId, try to find the project
        if ($odeSessionId && !$requestedProjectId) {
            $currentOdeUsersRepo = $this->entityManager->getRepository(CurrentOdeUsers::class);
            $session = $currentOdeUsersRepo->findOneBy(['odeSessionId' => $odeSessionId]);

            if ($session) {
                // Redirect to project-based URL
                return $this->redirectToRoute('workarea', [
                    'projectId' => $session->getOdeId(),
                ], 301);
            }
        }

        // Project access control
        $project = null;
        if ($requestedProjectId) {
            $project = $this->projectRepo->find($requestedProjectId);

            // Backwards compatibility: auto-create from OdeFiles if not exists
            if (!$project) {
                $project = $this->createProjectFromOdeFile($requestedProjectId);
            }

            // If still no project, check if we have a CurrentOdeUsers session for it
            // This handles the case where the project was created but not yet persisted
            if (!$project) {
                $currentOdeUsersRepo = $this->entityManager->getRepository(CurrentOdeUsers::class);
                $user = $this->getUser();
                $currentSession = $currentOdeUsersRepo->findOneBy([
                    'odeId' => $requestedProjectId,
                    'user' => $user->getUserIdentifier(),
                ]);

                // If user has a session for this project, create the Project entity
                if ($currentSession) {
                    $project = new Project();
                    $project->setId($requestedProjectId);
                    $project->setTitle('New Project'); // Will be updated on first save
                    $project->setOwner($user);
                    $project->setVisibility('private');
                    $project->setArchived(false);

                    $this->entityManager->persist($project);

                    // Create ProjectCollaborator entry for the owner
                    $collaborator = new ProjectCollaborator();
                    $collaborator->setProject($project);
                    $collaborator->setUser($user);
                    $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
                    $collaborator->setGrantedBy($user);

                    $this->entityManager->persist($collaborator);
                    $this->entityManager->flush();

                    $this->logger->info('Created Project entity for existing CurrentOdeUsers session', [
                        'projectId' => $requestedProjectId,
                        'userId' => $user->getUserIdentifier(),
                    ]);
                }
            }

            if (!$project) {
                throw $this->createNotFoundException('Project not found');
            }

            // Check access using ProjectVoter
            if (!$this->isGranted('PROJECT_VIEW', $project)) {
                throw $this->createAccessDeniedException('You do not have access to this project');
            }

            // Update last accessed timestamp
            $project->updateLastAccessedAt();
            $this->entityManager->flush();

            // Ensure we have an odeSessionId for this project
            // This is needed for backwards compatibility with save/load operations
            if (!$odeSessionId) {
                $currentOdeUsersRepo = $this->entityManager->getRepository(CurrentOdeUsers::class);
                $user = $this->getUser();

                // Try to find existing session for this user and project
                $currentSession = $currentOdeUsersRepo->getCurrentSessionForUser($user->getUserIdentifier());

                if ($currentSession && $currentSession->getOdeId() === $requestedProjectId) {
                    // Use existing session
                    $odeSessionId = $currentSession->getOdeSessionId();
                } else {
                    // Create new session for this project
                    $odeVersionId = Util::generateId();
                    $odeSessionId = Util::generateId();
                    $clientIp = $request->getClientIp() ?? '127.0.0.1';

                    $this->currentOdeUsersService->createCurrentOdeUsers(
                        $requestedProjectId,  // odeId = projectId
                        $odeVersionId,
                        $odeSessionId,
                        $user,
                        $clientIp
                    );
                }
            }
        }

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

        // Allow user styles
        $userStyles = $this->getParameter('app.online_themes_install');
        // Allow user iDevices
        // $userIdevices = $this->getParameter('app.online_idevices_install');
        $userIdevices = 0; // To do (see #381)

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
                    'userStyles' => $userStyles,
                    'userIdevices' => $userIdevices,
                    'countUserAutosaveSpace' => $this->countUserAutosaveSpace,
                    'userStorageMaxDiskSpaceBytes' => SettingsUtil::getUserStorageMaxDiskSpaceInBytes(),
                    'userRecentOdeFilesAmount' => $this->userRecentOdeFilesAmount,
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
                    'ideviceTypeBase' => $ideviceTypeBase,
                    'ideviceTypeUser' => $ideviceTypeUser,
                    'ideviceVisibilityPreferencePre' => $ideviceVisibilityPreferencePre,
                    'requestedProjectId' => $requestedProjectId,
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

    /**
     * Backwards compatibility: Create a Project entity from an existing OdeFile.
     * This allows seamless migration from the old ode_files system to the new projects system.
     *
     * @param string $odeId The ODE ID to search for
     *
     * @return Project|null The created Project or null if OdeFile not found
     */
    private function createProjectFromOdeFile(string $odeId): ?Project
    {
        // Find the most recent OdeFile for this odeId
        $odeFile = $this->odeFilesRepo->getLastFileForOde($odeId);

        if (!$odeFile) {
            $this->logger->info('Cannot create Project from OdeFile: OdeFile not found', [
                'odeId' => $odeId,
            ]);

            return null;
        }

        // Find the User entity for the owner
        $ownerUser = $this->userRepo->findOneBy(['email' => $odeFile->getUser()]);

        if (!$ownerUser) {
            $this->logger->warning('Cannot create Project from OdeFile: user not found', [
                'odeId' => $odeId,
                'ownerEmail' => $odeFile->getUser(),
            ]);

            return null;
        }

        // Create new Project entity
        $project = new Project();
        $project->setId($odeId);
        $project->setTitle($odeFile->getTitle());
        $project->setOwner($ownerUser);
        $project->setVisibility('private'); // Default to private for security
        $project->setArchived(false);

        // Set timestamps from OdeFile if available
        if ($odeFile->getCreatedAt()) {
            $project->setCreatedAt($odeFile->getCreatedAt());
        }
        if ($odeFile->getUpdatedAt()) {
            $project->setLastAccessedAt($odeFile->getUpdatedAt());
        }

        $this->entityManager->persist($project);

        // Create a ProjectCollaborator entry for the owner
        $ownerCollab = new ProjectCollaborator();
        $ownerCollab->setProject($project);
        $ownerCollab->setUser($ownerUser);
        $ownerCollab->setRole(ProjectCollaborator::ROLE_OWNER);
        $ownerCollab->setGrantedBy($ownerUser);

        $this->entityManager->persist($ownerCollab);
        $this->entityManager->flush();

        $this->logger->info('Auto-created Project from OdeFile for backwards compatibility', [
            'odeId' => $odeId,
            'projectId' => $project->getId(),
            'ownerId' => $ownerUser->getId(),
            'title' => $project->getTitle(),
        ]);

        return $project;
    }
}
