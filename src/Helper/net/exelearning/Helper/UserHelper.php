<?php

namespace App\Helper\net\exelearning\Helper;

use App\Constants;
use App\Entity\net\exelearning\Entity\User;
use App\Entity\net\exelearning\Entity\UserPreferences;
use App\Properties;
use App\Util\GravatarUrlGenerator;
use App\Util\net\exelearning\Util\FilePermissionsUtil;
use App\Util\net\exelearning\Util\FileUtil;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\Security\Core\User\UserInterface;

/**
 * UserHelper.
 *
 * Utility functions for working with users
 */
class UserHelper
{
    private ContainerInterface $container;
    private FileHelper $fileHelper;
    private IdeviceHelper $ideviceHelper;
    private EntityManagerInterface $entityManager;
    private RequestStack $requestStack;

    public function __construct(
        ContainerInterface $container,
        FileHelper $fileHelper,
        IdeviceHelper $ideviceHelper,
        EntityManagerInterface $entityManager,
        RequestStack $requestStack,
    ) {
        $this->container = $container;
        $this->fileHelper = $fileHelper;
        $this->ideviceHelper = $ideviceHelper;
        $this->entityManager = $entityManager;
        $this->requestStack = $requestStack;
    }

    /**
     * Return database user data.
     *
     * @param UserInterface $userLogged
     * @param array filters
     *
     * @return User
     */
    public function getDatabaseUser($userLogged, $filters = [])
    {
        $userRepo = $this->entityManager->getRepository(User::class);

        // Add email filter
        $userFilters = ['email' => $this->getLoggedUserName($userLogged)];

        // Add other filters
        foreach ($filters as $filter => $value) {
            $userFilters[$filter] = $value;
        }

        $user = $userRepo->findOneBy($userFilters);

        return $user;
    }

    /**
     * Create a new user if necessary.
     *
     * @param UserInterface $userLogged
     *
     * @return User
     */
    public function createNewUserIfNeccessary($userLogged)
    {
        // Get database user
        $dbUser = $this->getDatabaseUser($userLogged);

        // In case the user does not exist, we create it
        if (empty($dbUser)) {
            $dbUser = $this->createNewUserBySessionUser($userLogged, false);
        }

        // In case the user does not have the user_id parameter, we add it
        if (!$dbUser->getUserId()) {
            $dbUser->setUserId(Util::generateId());
            $this->entityManager->persist($dbUser);
            $this->entityManager->flush();
        }

        // Make user themes dir
        $this->makeThemesDirByUser($dbUser);
        // Make user idevices dir
        $this->makeIdevicesDirByUser($dbUser);

        // All user information is inserted into the session
        $session = $this->requestStack->getSession();
        $session->set(Constants::SESSION_USER_DATA, $dbUser);

        return $dbUser;
    }

    /**
     * Create a new user from the logged in user.
     *
     * @param UserInterface $userLogged
     * @param bool          $isLopdAccepted
     *
     * @return User|bool
     */
    public function createNewUserBySessionUser($userLogged, $isLopdAccepted = false)
    {
        $userLoggedName = $this->getLoggedUserName($userLogged);

        if ($userLoggedName) {
            $newUser = new User();
            $newUser->setEmail($userLoggedName);
            $newUser->setPassword(Util::generateId());
            $newUser->setRoles($userLogged->getRoles());
            $newUser->setUserId(Util::generateId());

            if ($isLopdAccepted) {
                $newUser->setIsLopdAccepted(1);
            }

            $this->entityManager->persist($newUser);
            $this->entityManager->flush();

            // Add properties
            // $this->saveDefaultUserPreferences($userLogged);

            return $newUser;
        }

        return false;
    }

    /**
     * Get the name of the logged-in user.
     *
     * This function retrieves the identifier of the currently authenticated user.
     * If the user is not logged in, it returns an empty string.
     *
     * @param UserInterface|null $userLogged The logged-in user instance. Can be null if no user is authenticated.
     *
     * @return string the user identifier or an empty string if no user is logged in
     */
    public function getLoggedUserName($userLogged)
    {
        return $userLogged ? $userLogged->getUserIdentifier() : '';
    }

    /**
     * Get the Gravatar URL for the logged-in user.
     *
     * This function generates a Gravatar URL based on the email identifier of the logged-in user.
     * The email is converted to lowercase, trimmed, and hashed using MD5 to produce the required format.
     * If no user is logged in, it returns the default Gravatar image.
     *
     * Parameters used in the Gravatar URL:
     * - `s=96`: Sets the image size to 96x96 pixels.
     * - `d=` + configured default image: Selects the default avatar style, with a guest-specific override.
     * - `r=g`: Restricts the image to the 'G' rating (safe for all audiences).
     * - `initials=`: When using the "initials" style, sends the initials to display.
     *
     * @param UserInterface|null $userLogged The logged-in user instance. Can be null if no user is authenticated.
     *
     * @return string the Gravatar URL for the user or the default avatar if no email is available
     */
    public function getUserGravatarUrl($userLogged)
    {
        $identifier = $userLogged ? $userLogged->getUserIdentifier() : null;

        $gravatarUrl = GravatarUrlGenerator::createFromIdentifier($identifier);

        return $gravatarUrl ?? '';
    }

    /**
     * Set the user's id parameter.
     *
     * @param User $user
     *
     * @return void
     */
    public function setUserIdToUser($user)
    {
        $user->setUserId(Util::generateId());
        $this->entityManager->persist($user);
        $this->entityManager->flush();
    }

    /**
     * Set the user's is_lopd_accepted parameter to 1.
     *
     * @param User $user
     *
     * @return void
     */
    public function setLopdAcceptedToUser($user)
    {
        $user->setIsLopdAccepted(1);
        $this->entityManager->persist($user);
        $this->entityManager->flush();
    }

    /**
     * Make user themes dir.
     *
     * @param User $user
     *
     * @return bool
     */
    public function makeThemesDirByUser($user)
    {
        $themesDirCreated = false;
        $themesUsersDirBase = $this->fileHelper->getThemesUsersDir();
        $themesUserDir = $themesUsersDirBase.DIRECTORY_SEPARATOR.$user->getUserId().DIRECTORY_SEPARATOR;

        if (FilePermissionsUtil::isWritable($themesUsersDirBase) && !file_exists($themesUserDir)) {
            $mode = 0775;
            $recursive = true;
            $themesDirCreated = FileUtil::createDir($themesUserDir, $mode, $recursive);
        }

        return $themesDirCreated;
    }

    /**
     * Make user idevices dir.
     *
     * @param User $user
     *
     * @return bool
     */
    public function makeIdevicesDirByUser($user)
    {
        $idevicesDirCreated = false;
        $idevicesUsersDirBase = $this->fileHelper->getIdevicesUsersDir();
        $idevicesUserDir = $idevicesUsersDirBase.DIRECTORY_SEPARATOR.$user->getUserId().DIRECTORY_SEPARATOR;

        if (FilePermissionsUtil::isWritable($idevicesUsersDirBase) && !file_exists($idevicesUserDir)) {
            $mode = 0775;
            $recursive = true;
            $idevicesDirCreated = FileUtil::createDir($idevicesUserDir, $mode, $recursive);
        }

        return $idevicesDirCreated;
    }

    /**
     * Get user config preferences array.
     *
     * @param UserInterface $userLogged
     *
     * @return array
     */
    public function getConfigUserPreferences($userLogged)
    {
        $dbUser = $this->getDatabaseUser($userLogged);

        $userPreferencesList = [];
        foreach (Properties::USER_PREFERENCES_CONFIG as $userPreferencesConfigKey => $userPreferencesConfigValues) {
            $userPreferences = new UserPreferences();
            $userPreferences->loadFromPropertiesConfig(
                $dbUser->getId(),
                $userPreferencesConfigKey,
                $userPreferencesConfigValues
            );
            $userPreferencesList[$userPreferencesConfigKey] = $userPreferences;
        }

        return $userPreferencesList;
    }

    /**
     * Get user idevice visibility preferences array.
     *
     * @param UserInterface $userLogged
     *
     * @return array
     */
    public function getIdeviceVisibilityUserPreferences($userLogged)
    {
        $dbUser = $this->getDatabaseUser($userLogged);

        $userPreferencesList = [];
        foreach ($this->ideviceHelper->getInstalledIdevices($userLogged) as $key => $ideviceDto) {
            $userPreferences = new UserPreferences();
            $userPreferencesIdeVisKey = Constants::IDEVICE_VISIBILITY_PREFERENCE_PRE.$key;
            $userPreferences->loadFromPropertiesConfig(
                $dbUser->getId(),
                Constants::IDEVICE_VISIBILITY_PREFERENCE_PRE.$key,
                ['value' => json_encode($ideviceDto->getDefaultVisibility()), 'type' => 'checkbox']
            );
            $userPreferencesList[$userPreferencesIdeVisKey] = $userPreferences;
        }

        return $userPreferencesList;
    }

    /**
     * Get user preferences array.
     *
     * @param UserInterface $userLogged
     *
     * @return array
     */
    public function getUserPreferencesFromDatabase($userLogged)
    {
        $dbUser = $this->getDatabaseUser($userLogged);

        // Database preferences
        $repository = $this->entityManager->getRepository(UserPreferences::class);
        $databaseUserPreferencesList = $repository->findBy(['userId' => $dbUser->getId()]);

        $databaseUserPreferencesData = [];
        foreach ($databaseUserPreferencesList as $preference) {
            $databaseUserPreferencesData[$preference->getKey()] = $preference;
        }

        $userPreferencesData = [];

        // Config properties
        $configUserPreferencesData = $this->getConfigUserPreferences($userLogged);
        // Merge config properties
        foreach ($configUserPreferencesData as $userPreferencesConfigKey => $userPreferencesConfigValues) {
            if (isset($databaseUserPreferencesData[$userPreferencesConfigKey])) {
                $userPreferencesData[$userPreferencesConfigKey] = $databaseUserPreferencesData[$userPreferencesConfigKey];
            } else {
                $userPreferencesData[$userPreferencesConfigKey] = $userPreferencesConfigValues;
            }
        }

        // Idevice visibility properties
        $ideviceVisibilityPreferencesData = $this->getIdeviceVisibilityUserPreferences($userLogged);
        // Merge idevice visibility properties
        foreach ($ideviceVisibilityPreferencesData as $userPreferencesIdeVisKey => $userPreferencesIdeVisValues) {
            if (isset($databaseUserPreferencesData[$userPreferencesIdeVisKey])) {
                $userPreferencesData[$userPreferencesIdeVisKey] = $databaseUserPreferencesData[$userPreferencesIdeVisKey];
            } else {
                $userPreferencesData[$userPreferencesIdeVisKey] = $userPreferencesIdeVisValues;
            }
        }

        return $userPreferencesData;
    }

    /**
     * Get session user database preferences array.
     *
     * @param User $dbUser
     *
     * @return array
     */
    public function getSessionUserPreferencesFromDatabase($dbUser)
    {
        // Database preferences
        $repository = $this->entityManager->getRepository(UserPreferences::class);
        $databaseUserPreferencesList = $repository->findBy(['userId' => $dbUser->getId()]);

        $databaseUserPreferencesData = [];
        foreach ($databaseUserPreferencesList as $preference) {
            $databaseUserPreferencesData[$preference->getKey()] = $preference;
        }

        return $databaseUserPreferencesData;
    }

    /**
     * Save default properties of user in database.
     *
     * @param UserInterface $userLogged
     *
     * @return void
     */
    public function saveDefaultUserPreferences($userLogged)
    {
        $configUserPreferencesData = $this->getUserPreferencesFromDatabase($userLogged);

        foreach ($configUserPreferencesData as $userPreferencesConfigKey => $userPreferencesConfigValues) {
            $userPreferences = $configUserPreferencesData[$userPreferencesConfigKey];
            $this->entityManager->persist($userPreferences);
        }

        $this->entityManager->flush();
    }

    /**
     * Save user preference theme in database.
     *
     * @param $userLogged $theme
     *
     * @return void
     */
    public function saveUserTheme($userLogged, $theme)
    {
        $databaseUserPreferences = $this->getUserPreferencesFromDatabase($userLogged);
        $userPreferences = $databaseUserPreferences['theme'];
        $userPreferences->setValue($theme);
        $this->entityManager->flush();
    }
}
