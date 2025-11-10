<?php

namespace App\Service\Project;

use App\Entity\Project\OdeEditLock;
use App\Repository\Project\OdeEditLockRepository;
use Psr\Log\LoggerInterface;

/**
 * Service for managing edit locks in collaborative sessions.
 * Provides high-level lock management with business logic.
 */
class OdeEditLockService
{
    public function __construct(
        private readonly OdeEditLockRepository $lockRepository,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * Attempt to acquire a lock for editing a resource.
     * Returns lock info if successful, or details about existing lock if blocked.
     *
     * @return array ['success' => bool, 'lock' => ?OdeEditLock, 'message' => string, 'lockedBy' => ?string]
     */
    public function acquireLock(
        string $odeSessionId,
        string $resourceType,
        string $resourceId,
        string $userEmail,
        int $lockDurationMinutes = OdeEditLock::DEFAULT_LOCK_DURATION_MINUTES,
    ): array {
        $lock = $this->lockRepository->acquireLock(
            $odeSessionId,
            $resourceType,
            $resourceId,
            $userEmail,
            $lockDurationMinutes
        );

        if ($lock) {
            return [
                'success' => true,
                'lock' => $lock,
                'message' => 'Lock acquired successfully',
                'lockedBy' => $userEmail,
            ];
        }

        // Lock failed - get info about who has it
        $existingLock = $this->lockRepository->isLocked($odeSessionId, $resourceType, $resourceId);

        if ($existingLock) {
            return [
                'success' => false,
                'lock' => $existingLock,
                'message' => sprintf('Resource is locked by %s', $existingLock->getLockedBy()),
                'lockedBy' => $existingLock->getLockedBy(),
            ];
        }

        // Race condition or unexpected error
        return [
            'success' => false,
            'lock' => null,
            'message' => 'Unable to acquire lock (race condition)',
            'lockedBy' => null,
        ];
    }

    /**
     * Release a lock on a resource.
     */
    public function releaseLock(
        string $odeSessionId,
        string $resourceType,
        string $resourceId,
        string $userEmail,
    ): bool {
        return $this->lockRepository->releaseLock(
            $odeSessionId,
            $resourceType,
            $resourceId,
            $userEmail
        );
    }

    /**
     * Check if a resource is currently locked.
     *
     * @return array ['isLocked' => bool, 'lock' => ?OdeEditLock, 'lockedBy' => ?string, 'canEdit' => bool]
     */
    public function checkLock(
        string $odeSessionId,
        string $resourceType,
        string $resourceId,
        string $userEmail,
    ): array {
        $lock = $this->lockRepository->isLocked($odeSessionId, $resourceType, $resourceId);

        if (!$lock) {
            return [
                'isLocked' => false,
                'lock' => null,
                'lockedBy' => null,
                'canEdit' => true,
            ];
        }

        $isOwnLock = $lock->isLockedBy($userEmail);

        return [
            'isLocked' => true,
            'lock' => $lock,
            'lockedBy' => $lock->getLockedBy(),
            'canEdit' => $isOwnLock, // Can edit if it's own lock
        ];
    }

    /**
     * Release all locks held by a user in a session.
     * Useful when user disconnects or closes editor.
     */
    public function releaseUserLocks(string $odeSessionId, string $userEmail): int
    {
        $released = $this->lockRepository->releaseAllLocksForUser($odeSessionId, $userEmail);

        $this->logger->info('Released all locks for user', [
            'odeSessionId' => $odeSessionId,
            'userEmail' => $userEmail,
            'locksReleased' => $released,
        ]);

        return $released;
    }

    /**
     * Release all locks in a session.
     * Useful when session is closed.
     */
    public function releaseSessionLocks(string $odeSessionId): int
    {
        $released = $this->lockRepository->releaseAllLocksInSession($odeSessionId);

        $this->logger->info('Released all locks in session', [
            'odeSessionId' => $odeSessionId,
            'locksReleased' => $released,
        ]);

        return $released;
    }

    /**
     * Renew a lock's expiration time (keep-alive).
     * Should be called periodically by the client while editing.
     */
    public function renewLock(
        string $odeSessionId,
        string $resourceType,
        string $resourceId,
        string $userEmail,
        int $extendMinutes = OdeEditLock::DEFAULT_LOCK_DURATION_MINUTES,
    ): bool {
        return $this->lockRepository->renewLock(
            $odeSessionId,
            $resourceType,
            $resourceId,
            $userEmail,
            $extendMinutes
        );
    }

    /**
     * Get all locks in a session (for UI display).
     *
     * @return array Array of lock info for UI display
     */
    public function getSessionLocks(string $odeSessionId): array
    {
        $locks = $this->lockRepository->findLocksInSession($odeSessionId);

        return array_map(function (OdeEditLock $lock) {
            return [
                'resourceType' => $lock->getResourceType(),
                'resourceId' => $lock->getResourceId(),
                'lockedBy' => $lock->getLockedBy(),
                'lockedAt' => $lock->getLockedAt()->format('Y-m-d H:i:s'),
                'expiresAt' => $lock->getExpiresAt()->format('Y-m-d H:i:s'),
                'isExpired' => $lock->isExpired(),
            ];
        }, $locks);
    }

    /**
     * Get all locks held by a specific user (for UI display).
     */
    public function getUserLocks(string $odeSessionId, string $userEmail): array
    {
        $locks = $this->lockRepository->findLocksForUser($odeSessionId, $userEmail);

        return array_map(function (OdeEditLock $lock) {
            return [
                'resourceType' => $lock->getResourceType(),
                'resourceId' => $lock->getResourceId(),
                'lockedAt' => $lock->getLockedAt()->format('Y-m-d H:i:s'),
                'expiresAt' => $lock->getExpiresAt()->format('Y-m-d H:i:s'),
            ];
        }, $locks);
    }

    /**
     * Clean up expired locks (should be called by cron job).
     */
    public function cleanupExpiredLocks(): int
    {
        return $this->lockRepository->cleanExpiredLocks();
    }
}
