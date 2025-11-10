<?php

namespace App\Service\net\exelearning\Service\Api;

use App\Constants;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\User;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;

class CurrentOdeUsersService implements CurrentOdeUsersServiceInterface
{
    private $entityManager;
    private $logger;

    public function __construct(EntityManagerInterface $entityManager, LoggerInterface $logger)
    {
        $this->entityManager = $entityManager;
        $this->logger = $logger;
    }

    /**
     * Inserts CurrentOdeUsers from its data.
     *
     * @param string $odeId
     * @param string $odeVersionId
     * @param string $odeSessionId
     * @param User   $user
     * @param string $clientIp
     *
     * @return CurrentOdeUsers
     */
    public function createCurrentOdeUsers($odeId, $odeVersionId, $odeSessionId, $user, $clientIp)
    {
        $currentOdeUsers = new CurrentOdeUsers();
        $currentOdeUsers->setOdeId($odeId);
        $currentOdeUsers->setOdeVersionId($odeVersionId);
        $currentOdeUsers->setOdeSessionId($odeSessionId);
        $currentOdeUsers->setUser($user->getUserIdentifier());
        $currentOdeUsers->setLastAction(new \DateTime());
        $currentOdeUsers->setLastSync(new \DateTime());
        $currentOdeUsers->setSyncSaveFlag(false);
        $currentOdeUsers->setSyncNavStructureFlag(false);
        $currentOdeUsers->setSyncPagStructureFlag(false);
        $currentOdeUsers->setSyncComponentsFlag(false);
        $currentOdeUsers->setSyncUpdateFlag(false);
        $currentOdeUsers->setNodeIp($clientIp);

        $this->entityManager->persist($currentOdeUsers);
        $this->entityManager->flush();

        return $currentOdeUsers;
    }

    /**
     * Inserts or updates CurrentOdeUsers from OdeNavStructureSync data.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param User                $user
     * @param string              $clientIp
     *
     * @return CurrentOdeUsers
     */
    public function insertOrUpdateFromOdeNavStructureSync($odeNavStructureSync, $user, $clientIp)
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);

        if (null === $odeNavStructureSync) {
            $this->logger->warning(
                'updateCurrentIdevice: missing OdeNavStructureSync entity',
                [
                    'user' => $user->getUserIdentifier(),
                    'odeSessionId' => null,
                    'odeNavStructureSyncId' => null,
                ]
            );

            return null;
        }

        $currentOdeSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser(
            $user->getUserIdentifier(),
            $odeNavStructureSync->getOdeSessionId()
        );

        if (!empty($currentOdeSessionForUser)) {
            $currentOdeSessionForUser->setCurrentPageId($odeNavStructureSync->getOdePageId());
            $currentOdeSessionForUser->setLastSync(new \DateTime());
        } else {
            $odeId = Util::generateId();

            $odeVersionId = Util::generateId();
            $odeSessionId = $odeNavStructureSync->getOdeSessionId();

            // Insert into current_ode_users
            $currentOdeSessionForUser = new CurrentOdeUsers();
            $currentOdeSessionForUser->setOdeId($odeId);
            $currentOdeSessionForUser->setOdeVersionId($odeVersionId);
            $currentOdeSessionForUser->setOdeSessionId($odeSessionId);
            $currentOdeSessionForUser->setUser($user->getUserIdentifier());
            $currentOdeSessionForUser->setLastAction(new \DateTime());
            $currentOdeSessionForUser->setLastSync(new \DateTime());
            $currentOdeSessionForUser->setSyncSaveFlag(false);
            $currentOdeSessionForUser->setSyncNavStructureFlag(false);
            $currentOdeSessionForUser->setSyncPagStructureFlag(false);
            $currentOdeSessionForUser->setSyncComponentsFlag(false);
            $currentOdeSessionForUser->setNodeIp($clientIp);

            $currentOdeSessionForUser->setCurrentPageId($odeNavStructureSync->getOdePageId());
            $currentOdeSessionForUser->setCurrentBlockId(null);
            $currentOdeSessionForUser->setCurrentComponentId(null);
        }

        $this->entityManager->persist($currentOdeSessionForUser);
        $this->entityManager->flush();

        return $currentOdeSessionForUser;
    }

    /**
     * Updates current idevice CurrentOdeUser.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param string              $blockId
     * @param string              $odeIdeviceId
     * @param User                $user
     * @param array               $odeCurrentUsersFlags
     *
     * @return CurrentOdeUsers|null
     */
    public function updateCurrentIdevice($odeNavStructureSync, $blockId, $odeIdeviceId, $user, $odeCurrentUsersFlags)
    {
        if (!$odeNavStructureSync instanceof OdeNavStructureSync) {
            $this->logger->warning('updateCurrentIdevice: invalid OdeNavStructureSync payload', [
                'user' => $user->getUserIdentifier(),
                'receivedType' => is_object($odeNavStructureSync) ? get_class($odeNavStructureSync) : gettype($odeNavStructureSync),
            ]);

            return null;
        }

        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeSessionForUser = null;
        if ($odeNavStructureSync->getOdeSessionId()) {
            $currentOdeSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser(
                $user->getUserIdentifier(),
                $odeNavStructureSync->getOdeSessionId()
            );
        }

        if (null === $currentOdeSessionForUser) {
            // Fallback for legacy flows where the DTO still carries the previous session identifier
            $currentOdeSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser(
                $user->getUserIdentifier()
            );
        }

        if (null === $currentOdeSessionForUser) {
            $this->logger->warning('updateCurrentIdevice: no current_ode_users row found for user/session', [
                'user' => $user->getUserIdentifier(),
                'odeSessionId' => $odeNavStructureSync->getOdeSessionId(),
                'nodeSessionIdFallback' => $currentOdeUsersRepository->getCurrentSessionForUser($user->getUserIdentifier())?->getOdeSessionId(),
                'odeNavStructureSyncId' => $odeNavStructureSync->getId(),
            ]);

            return null;
        }

        if (null === $currentOdeSessionForUser) {
            $this->logger->info('Current session for user not found when updating current idevice', [
                'user' => $user->getUserIdentifier(),
                'odeIdeviceId' => $odeIdeviceId,
                'method' => __METHOD__,
            ]);

            return null;
        }

        // Transform flags to boolean number
        $odeCurrentUsersFlags = $this->currentOdeUsersFlagsToBoolean($odeCurrentUsersFlags);

        // Update current user
        $currentOdeSessionForUser->setLastSync(new \DateTime());

        if (!empty($odeCurrentUsersFlags['odeComponentFlag'])) {
            $currentOdeSessionForUser->setSyncComponentsFlag($odeCurrentUsersFlags['odeComponentFlag']);
            $currentOdeSessionForUser->setCurrentComponentId($odeIdeviceId);
            $currentOdeSessionForUser->setCurrentBlockId($blockId);
            $currentOdeSessionForUser->setCurrentPageId($odeNavStructureSync->getOdePageId());
        } elseif (!empty($odeCurrentUsersFlags['odePagStructureFlag'])) {
            $currentOdeSessionForUser->setSyncPagStructureFlag($odeCurrentUsersFlags['odePagStructureFlag']);
            $currentOdeSessionForUser->setCurrentBlockId($blockId);
            $currentOdeSessionForUser->setCurrentPageId($odeNavStructureSync->getOdePageId());
        } elseif (!empty($odeCurrentUsersFlags['odeNavStructureFlag'])) {
            $currentOdeSessionForUser->setSyncNavStructureFlag($odeCurrentUsersFlags['odeNavStructureFlag']);
        } else {
            $currentOdeSessionForUser->setSyncComponentsFlag($odeCurrentUsersFlags['odeComponentFlag']);
            $currentOdeSessionForUser->setCurrentComponentId(null);
            $currentOdeSessionForUser->setCurrentBlockId(null);
            $currentOdeSessionForUser->setCurrentPageId($odeNavStructureSync->getOdePageId());
        }

        $this->entityManager->persist($currentOdeSessionForUser);
        $this->entityManager->flush();

        return $currentOdeSessionForUser;
    }

    /**
     * Convert the values ​​to booleans.
     *
     * @param array $odeCurrentUsersFlags
     *
     * @return array
     */
    private function currentOdeUsersFlagsToBoolean($odeCurrentUsersFlags)
    {
        foreach ($odeCurrentUsersFlags as $key => $odeCurrentUsersFlag) {
            if ('true' == $odeCurrentUsersFlag) {
                $odeCurrentUsersFlags[$key] = 1;
            } else {
                $odeCurrentUsersFlags[$key] = 0;
            }
        }

        return $odeCurrentUsersFlags;
    }

    /**
     * Inserts or updates CurrentOdeUsers from root node data.
     *
     * @param User   $user
     * @param string $clientIp
     *
     * @return CurrentOdeUsers
     */
    public function insertOrUpdateFromRootNode($user, $clientIp)
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUserIdentifier());

        if (!empty($currentOdeSessionForUser)) {
            $currentOdeSessionForUser->setCurrentPageId(Constants::ROOT_NODE_IDENTIFIER);
            $currentOdeSessionForUser->setCurrentBlockId(null);
            $currentOdeSessionForUser->setCurrentComponentId(null);
            $currentOdeSessionForUser->setLastSync(new \DateTime());
        }

        if (!empty($currentOdeSessionForUser)) {
            $this->entityManager->persist($currentOdeSessionForUser);

            $this->entityManager->flush();
        }

        return $currentOdeSessionForUser;
    }

    /**
     * Checks if the user passed as param is the only one who is editing the content and updates CurrentOdeUser.
     *
     * @param User   $user
     * @param string $odeId
     * @param string $odeVersionId
     * @param string $odeSessionId
     * @param string $newOdeSessionId
     *
     * @return bool
     */
    public function updateLastUserOdesId($user, $odeId, $odeVersionId, $odeSessionId, $newOdeSessionId)
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);

        $currentOdeUsers = $currentOdeUsersRepository->getCurrentUsers(null, null, $odeSessionId);

        $userIsEditing = false;
        foreach ($currentOdeUsers as $currentOdeUser) {
            if ($currentOdeUser->getUser() == $user->getUserName()) {
                $userIsEditing = true;
                if ($userIsEditing && (1 == count($currentOdeUsers))) {
                    $isLastUser = true;
                    $currentOdeUser->setOdeId($odeId);
                    $currentOdeUser->setOdeVersionId($odeVersionId);
                    $currentOdeUser->setOdeSessionId($newOdeSessionId);
                } else {
                    $isLastUser = false;
                }
            } else {
                $this->logger->error('User is not editing', ['user' => $user->getUsername(), 'odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]);
            }
        }

        return $isLastUser;
    }

    /**
     * Update current user odeId, only for users who join (shared session).
     *
     * @param string $odeSessionId
     * @param User   $user
     */
    public function updateSyncCurrentUserOdeId($odeSessionId, $user)
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);

        // Get current user
        $currentUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUserName());

        if (null === $currentUser) {
            $this->logger->info('Current session for user not found when updating sync current user ode id', [
                'user' => $user->getUserIdentifier(),
                'odeSessionId' => $odeSessionId,
                'method' => __METHOD__,
            ]);

            return;
        }

        // Users with the same sessionId
        $currentOdeUsers = $currentOdeUsersRepository->getCurrentUsers(null, null, $odeSessionId);

        foreach ($currentOdeUsers as $currentOdeUser) {
            // Case session is the same and other user
            if ($currentOdeUser->getUser() !== $user->getUserName() && $currentOdeUser->getOdeSessionId() == $currentUser->getOdeSessionId()) {
                $currentUser->setOdeId($currentOdeUser->getOdeId());
                break;
            }
        }

        $this->entityManager->persist($currentOdeUser);
        $this->entityManager->flush();
    }

    /**
     * Checks if the user passed as param is the only one who is editing the content.
     *
     * @param User   $user
     * @param string $odeId
     * @param string $odeVersionId
     * @param string $odeSessionId
     *
     * @return bool
     */
    public function isLastUser($user, $odeId, $odeVersionId, $odeSessionId)
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);

        $currentOdeUsers = $currentOdeUsersRepository->getCurrentUsers(null, null, $odeSessionId);

        $userIsEditing = false;
        foreach ($currentOdeUsers as $currentOdeUser) {
            if ($currentOdeUser->getUser() == $user->getUserName()) {
                $userIsEditing = true;
                break;
            }
        }

        if (!$userIsEditing) {
            $this->logger->error('User is not editing', ['user' => $user->getUsername(), 'odeSessionId' => $odeSessionId, 'file:' => $this, 'line' => __LINE__]);
        }

        if ($userIsEditing && (1 == count($currentOdeUsers))) {
            $isLastUser = true;
        } else {
            $isLastUser = false;
        }

        return $isLastUser;
    }

    /**
     * Returns OdeId from CurrentOdeUsers for user and odeSessionId.
     *
     * @param User   $user
     * @param string $odeSessionId
     *
     * @return string
     */
    public function getOdeIdByOdeSessionId($user, $odeSessionId)
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);

        $odeId = null;

        $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser(
            $user->getUsername(),
            $odeSessionId
        );

        if ((!empty($currentSessionForUser)) && ($currentSessionForUser->getOdeSessionId() == $odeSessionId)) {
            $odeId = $currentSessionForUser->getOdeId();
        }

        return $odeId;
    }

    /**
     * Returns OdeVersionId from CurrentOdeUsers for user and odeSessionId.
     *
     * @param User   $user
     * @param string $odeSessionId
     *
     * @return string
     */
    public function getOdeVersionIdByOdeSessionId($user, $odeSessionId)
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);

        $odeVersionId = null;

        $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser(
            $user->getUsername(),
            $odeSessionId
        );

        if ((!empty($currentSessionForUser)) && ($currentSessionForUser->getOdeSessionId() == $odeSessionId)) {
            $odeVersionId = $currentSessionForUser->getOdeVersionId();
        }

        return $odeVersionId;
    }

    /**
     * Checks SyncSaveFlag state on CurrentOdeUsers.
     *
     * @return bool
     */
    public function checkSyncSaveFlag(?string $odeId, string $odeSessionId)
    {
        // If no odeId is available, we assume there is no concurrent saving.
        if (empty($odeId)) {
            return false;
        }

        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeUsers = $currentOdeUsersRepository->getCurrentUsers($odeId, null, $odeSessionId);

        foreach ($currentOdeUsers as $currentOdeUser) {
            $syncSaveFlag = $currentOdeUser->getSyncSaveFlag();
            if (true == $syncSaveFlag) {
                return true;
            }
        }

        // Case syncSaveFlag isn't true
        return false;
    }

    /**
     * Checks if another user in the session has the idevice open.
     *
     * @param string $odeSessionId
     * @param string $odeIdeviceId
     * @param string $odeBlockId
     * @param User   $user
     *
     * @return bool
     */
    public function checkIdeviceCurrentOdeUsers($odeSessionId, $odeIdeviceId, $odeBlockId, $user)
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeUsers = $currentOdeUsersRepository->getCurrentUsers(null, null, $odeSessionId);
        $user = $user->getUsername();
        foreach ($currentOdeUsers as $currentOdeUser) {
            $concurrentUser = $currentOdeUser->getUser();
            $currentComponentId = $currentOdeUser->getCurrentComponentId();
            $currentBlockId = $currentOdeUser->getCurrentBlockId();
            if (!empty($odeIdeviceId)) {
                if ($concurrentUser !== $user && $currentComponentId == $odeIdeviceId) {
                    return false;
                }
            } else {
                if ($concurrentUser !== $user && $currentBlockId == $odeBlockId) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Check if any current user has the session id and set to the respective user.
     *
     * @param string $odeSessionId
     * @param User   $user
     *
     * @return bool
     */
    public function checkOdeSessionIdCurrentUsers($odeSessionId, $user)
    {
        // Check current users with the sessionId
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentUsers = $currentOdeUsersRepository->getCurrentUsers(null, null, $odeSessionId);

        // Set odeSessionId to the user
        if (!empty($currentUsers)) {
            $currentUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());

            if (null === $currentUser) {
                $this->logger->info('Current session for user not found when checking ode session id', [
                    'user' => $user->getUserIdentifier(),
                    'odeSessionId' => $odeSessionId,
                    'method' => __METHOD__,
                ]);

                return false;
            }

            $currentUser->setOdeSessionId($odeSessionId);

            $this->entityManager->persist($currentUser);

            $this->entityManager->flush();

            return true;
        } else {
            return false;
        }
    }

    /**
     * Removes the user syncSaveFlag activated value.
     *
     * @param User $user
     */
    public function removeActiveSyncSaveFlag($user)
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());

        if (null === $currentOdeUser) {
            $this->logger->info('Current session for user not found when removing sync save flag', [
                'user' => $user->getUserIdentifier(),
                'method' => __METHOD__,
            ]);

            return;
        }

        // Set 0 to syncSaveFlag
        $currentOdeUser->setSyncSaveFlag(0);

        $this->entityManager->persist($currentOdeUser);
        $this->entityManager->flush();
    }

    /**
     * Activate the user syncSaveFlag.
     *
     * @param User $user
     */
    public function activateSyncSaveFlag($user)
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());

        if (null === $currentOdeUser) {
            $this->logger->info('Current session for user not found when activating sync save flag', [
                'user' => $user->getUserIdentifier(),
                'method' => __METHOD__,
            ]);

            return;
        }

        // Set 1 to syncSaveFlag
        $currentOdeUser->setSyncSaveFlag(1);

        $this->entityManager->persist($currentOdeUser);
        $this->entityManager->flush();
    }

    /**
     * Removes the user syncSaveFlag activated value.
     *
     * @param User $user
     */
    public function removeActiveSyncComponentsFlag($user)
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentOdeUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());

        if (null === $currentOdeUser) {
            $this->logger->info('Current session for user not found when removing sync components flag', [
                'user' => $user->getUserIdentifier(),
                'method' => __METHOD__,
            ]);

            return;
        }

        // Set 0 to syncSaveFlag and remove block/idevice
        $currentOdeUser->setSyncComponentsFlag(0);
        $currentOdeUser->setCurrentComponentId(null);
        $currentOdeUser->setCurrentBlockId(null);

        $this->entityManager->persist($currentOdeUser);
        $this->entityManager->flush();
    }

    /**
     * Examines number of current users on page.
     *
     * @param string $odeSessionId
     * @param User   $user
     */
    public function checkCurrentUsersOnSamePage($odeSessionId, $user)
    {
        $response = [];
        // Get currentOdeUser
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $currentSessionForUser = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUsername());

        if (null === $currentSessionForUser) {
            $this->logger->info('Current session for user not found when checking current users on same page', [
                'user' => $user->getUserIdentifier(),
                'odeSessionId' => $odeSessionId,
                'method' => __METHOD__,
            ]);

            $response['responseMessage'] = 'Page without users';
            $response['isAvailable'] = true;

            return $response;
        }

        // Get currentPageId
        $currentPageId = $currentSessionForUser->getCurrentPageId();

        // Check if any user is on the same page
        $currentOdeUsers = $currentOdeUsersRepository->getCurrentUsers(null, null, $odeSessionId);

        foreach ($currentOdeUsers as $currentOdeUser) {
            $concurrentUser = $currentOdeUser->getUser();
            if ($concurrentUser !== $user->getUsername()) {
                // Current user on same page
                if ($currentOdeUser->getCurrentPageId() == $currentPageId) {
                    $response['responseMessage'] = 'There are more users on the page';
                    $response['isAvailable'] = false;

                    return $response;
                }
            }
        }

        $response['responseMessage'] = 'Page without users';
        $response['isAvailable'] = true;

        return $response;
    }

    // =========================================================================
    // MULTI-USER COLLABORATION - Shared Session Support
    // =========================================================================

    /**
     * Get or create a session for a project (enabling shared sessions).
     * If an active session exists for the project, joins it. Otherwise creates new.
     *
     * @param string $odeId               The project/ode identifier
     * @param User   $user                The user joining/creating the session
     * @param string $clientIp            Client IP address
     * @param int    $activeWithinMinutes Consider session active if activity within N minutes (default 30)
     *
     * @return array ['session' => CurrentOdeUsers, 'isNewSession' => bool, 'usersInSession' => CurrentOdeUsers[]]
     */
    public function getOrCreateSessionForProject(string $odeId, User $user, string $clientIp, int $activeWithinMinutes = 30): array
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);

        // Check if user already has an active session for this project
        $existingUserSession = $currentOdeUsersRepository->getCurrentSessionForUser($user->getUserIdentifier());

        if ($existingUserSession && $existingUserSession->getOdeId() === $odeId) {
            // User already in a session for this project - update activity and return
            $existingUserSession->setLastAction(new \DateTime());
            $this->entityManager->flush();

            $usersInSession = $currentOdeUsersRepository->getUsersInSession(
                $existingUserSession->getOdeSessionId(),
                $activeWithinMinutes
            );

            $this->logger->info('User already has active session for project', [
                'user' => $user->getUserIdentifier(),
                'odeId' => $odeId,
                'odeSessionId' => $existingUserSession->getOdeSessionId(),
                'usersCount' => count($usersInSession),
            ]);

            return [
                'session' => $existingUserSession,
                'isNewSession' => false,
                'usersInSession' => $usersInSession,
            ];
        }

        // Look for any active session for this project
        $activeSession = $currentOdeUsersRepository->findActiveSessionByOdeId($odeId, $activeWithinMinutes);

        if ($activeSession) {
            // Active session found - join it
            $this->logger->info('Joining existing active session for project', [
                'user' => $user->getUserIdentifier(),
                'odeId' => $odeId,
                'odeSessionId' => $activeSession->getOdeSessionId(),
            ]);

            return $this->joinExistingSession(
                $activeSession->getOdeSessionId(),
                $activeSession->getOdeId(),
                $activeSession->getOdeVersionId(),
                $user,
                $clientIp,
                $activeWithinMinutes
            );
        }

        // No active session found - create new one
        $newOdeSessionId = Util::generateId();
        $newOdeVersionId = Util::generateId();

        $this->logger->info('Creating new session for project', [
            'user' => $user->getUserIdentifier(),
            'odeId' => $odeId,
            'odeSessionId' => $newOdeSessionId,
        ]);

        $newSession = $this->createCurrentOdeUsers(
            $odeId,
            $newOdeVersionId,
            $newOdeSessionId,
            $user,
            $clientIp
        );

        return [
            'session' => $newSession,
            'isNewSession' => true,
            'usersInSession' => [$newSession],
        ];
    }

    /**
     * Join an existing session (for collaborative editing).
     * Adds the user to an existing session, enabling shared file access.
     *
     * @param string $odeSessionId        The session to join
     * @param string $odeId               The project identifier
     * @param string $odeVersionId        The version identifier
     * @param User   $user                The user joining
     * @param string $clientIp            Client IP address
     * @param int    $activeWithinMinutes Activity window for counting users (default 30)
     *
     * @return array ['session' => CurrentOdeUsers, 'isNewSession' => bool, 'usersInSession' => CurrentOdeUsers[]]
     */
    public function joinExistingSession(
        string $odeSessionId,
        string $odeId,
        string $odeVersionId,
        User $user,
        string $clientIp,
        int $activeWithinMinutes = 30,
    ): array {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);

        // Check if user already in this session
        $isAlreadyInSession = $currentOdeUsersRepository->isUserInSession($odeSessionId, $user->getUserIdentifier());

        if ($isAlreadyInSession) {
            // User already in session - just update activity timestamp
            $existingSession = $currentOdeUsersRepository->getCurrentSessionForUser(
                $user->getUserIdentifier(),
                $odeSessionId
            );

            if ($existingSession) {
                $existingSession->setLastAction(new \DateTime());
                $this->entityManager->flush();

                $usersInSession = $currentOdeUsersRepository->getUsersInSession($odeSessionId, $activeWithinMinutes);

                $this->logger->info('User rejoining session (updating activity)', [
                    'user' => $user->getUserIdentifier(),
                    'odeSessionId' => $odeSessionId,
                    'usersCount' => count($usersInSession),
                ]);

                return [
                    'session' => $existingSession,
                    'isNewSession' => false,
                    'usersInSession' => $usersInSession,
                ];
            }
        }

        // User not in session - create new entry with SHARED session ID
        $this->logger->info('Adding user to existing session', [
            'user' => $user->getUserIdentifier(),
            'odeSessionId' => $odeSessionId,
            'odeId' => $odeId,
        ]);

        $newUserSession = $this->createCurrentOdeUsers(
            $odeId,
            $odeVersionId,
            $odeSessionId, // Same session ID = shared session
            $user,
            $clientIp
        );

        $usersInSession = $currentOdeUsersRepository->getUsersInSession($odeSessionId, $activeWithinMinutes);

        return [
            'session' => $newUserSession,
            'isNewSession' => false,
            'usersInSession' => $usersInSession,
        ];
    }

    /**
     * Check if a session can be safely cleaned up (no active users).
     * Used by cleanup service to avoid deleting files while users are active.
     *
     * @param string $odeSessionId        The session to check
     * @param int    $activeWithinMinutes Activity window (default 30)
     *
     * @return bool True if session can be cleaned (no active users), false otherwise
     */
    public function canCleanupSession(string $odeSessionId, int $activeWithinMinutes = 30): bool
    {
        $currentOdeUsersRepository = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $activeUsersCount = $currentOdeUsersRepository->countActiveUsersInSession($odeSessionId, $activeWithinMinutes);

        $this->logger->debug('Checking if session can be cleaned up', [
            'odeSessionId' => $odeSessionId,
            'activeUsersCount' => $activeUsersCount,
            'canCleanup' => 0 === $activeUsersCount,
        ]);

        return 0 === $activeUsersCount;
    }
}
