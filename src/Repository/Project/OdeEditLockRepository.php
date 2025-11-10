<?php

namespace App\Repository\Project;

use App\Entity\Project\OdeEditLock;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Exception\UniqueConstraintViolationException;
use Doctrine\Persistence\ManagerRegistry;
use Psr\Log\LoggerInterface;

/**
 * @extends ServiceEntityRepository<OdeEditLock>
 */
class OdeEditLockRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry, private readonly LoggerInterface $logger)
    {
        parent::__construct($registry, OdeEditLock::class);
    }

    /**
     * Acquire a lock on a resource.
     * Uses pessimistic locking: only one user can lock a resource at a time.
     *
     * @param string $odeSessionId The session identifier
     * @param string $resourceType Resource type (page, block, idevice)
     * @param string $resourceId Resource identifier
     * @param string $userEmail User email
     * @param int $lockDurationMinutes Lock duration in minutes
     *
     * @return OdeEditLock|null Returns the lock if acquired, null if resource is already locked by another user
     */
    public function acquireLock(
        string $odeSessionId,
        string $resourceType,
        string $resourceId,
        string $userEmail,
        int $lockDurationMinutes = OdeEditLock::DEFAULT_LOCK_DURATION_MINUTES
    ): ?OdeEditLock {
        // First, clean expired locks for this resource
        $this->cleanExpiredLocksForResource($odeSessionId, $resourceType, $resourceId);

        // Check if resource is already locked
        $existingLock = $this->isLocked($odeSessionId, $resourceType, $resourceId);

        if ($existingLock) {
            // If locked by same user, refresh the lock
            if ($existingLock->isLockedBy($userEmail)) {
                $existingLock->refresh($lockDurationMinutes);
                $this->getEntityManager()->flush();

                $this->logger->info('Lock refreshed for user', [
                    'odeSessionId' => $odeSessionId,
                    'resourceType' => $resourceType,
                    'resourceId' => $resourceId,
                    'userEmail' => $userEmail,
                ]);

                return $existingLock;
            }

            // Locked by another user - cannot acquire
            $this->logger->warning('Cannot acquire lock - resource already locked by another user', [
                'odeSessionId' => $odeSessionId,
                'resourceType' => $resourceType,
                'resourceId' => $resourceId,
                'requestedBy' => $userEmail,
                'lockedBy' => $existingLock->getLockedBy(),
            ]);

            return null;
        }

        // Resource is free - acquire lock
        try {
            $lock = new OdeEditLock();
            $lock->setOdeSessionId($odeSessionId);
            $lock->setResourceType($resourceType);
            $lock->setResourceId($resourceId);
            $lock->setLockedBy($userEmail);
            $lock->refresh($lockDurationMinutes);

            $this->getEntityManager()->persist($lock);
            $this->getEntityManager()->flush();

            $this->logger->info('Lock acquired successfully', [
                'odeSessionId' => $odeSessionId,
                'resourceType' => $resourceType,
                'resourceId' => $resourceId,
                'userEmail' => $userEmail,
                'expiresAt' => $lock->getExpiresAt()->format('Y-m-d H:i:s'),
            ]);

            return $lock;
        } catch (UniqueConstraintViolationException $e) {
            // Race condition: another process acquired lock between our check and insert
            $this->logger->warning('Lock acquisition race condition', [
                'odeSessionId' => $odeSessionId,
                'resourceType' => $resourceType,
                'resourceId' => $resourceId,
                'userEmail' => $userEmail,
            ]);

            return null;
        }
    }

    /**
     * Release a lock on a resource.
     *
     * @param string $odeSessionId The session identifier
     * @param string $resourceType Resource type
     * @param string $resourceId Resource identifier
     * @param string $userEmail User email (only owner can release)
     *
     * @return bool True if lock was released, false if not locked or locked by another user
     */
    public function releaseLock(
        string $odeSessionId,
        string $resourceType,
        string $resourceId,
        string $userEmail
    ): bool {
        $lock = $this->findLock($odeSessionId, $resourceType, $resourceId);

        if (!$lock) {
            $this->logger->debug('No lock to release', [
                'odeSessionId' => $odeSessionId,
                'resourceType' => $resourceType,
                'resourceId' => $resourceId,
            ]);

            return false;
        }

        // Only the lock owner can release it
        if (!$lock->isLockedBy($userEmail)) {
            $this->logger->warning('Cannot release lock - not the owner', [
                'odeSessionId' => $odeSessionId,
                'resourceType' => $resourceType,
                'resourceId' => $resourceId,
                'requestedBy' => $userEmail,
                'lockedBy' => $lock->getLockedBy(),
            ]);

            return false;
        }

        $this->getEntityManager()->remove($lock);
        $this->getEntityManager()->flush();

        $this->logger->info('Lock released', [
            'odeSessionId' => $odeSessionId,
            'resourceType' => $resourceType,
            'resourceId' => $resourceId,
            'userEmail' => $userEmail,
        ]);

        return true;
    }

    /**
     * Check if a resource is currently locked (non-expired lock).
     *
     * @return OdeEditLock|null The lock if resource is locked, null otherwise
     */
    public function isLocked(string $odeSessionId, string $resourceType, string $resourceId): ?OdeEditLock
    {
        $lock = $this->findLock($odeSessionId, $resourceType, $resourceId);

        if ($lock && $lock->isExpired()) {
            // Lock expired - clean it up
            $this->getEntityManager()->remove($lock);
            $this->getEntityManager()->flush();

            return null;
        }

        return $lock;
    }

    /**
     * Find a lock without checking expiration.
     */
    private function findLock(string $odeSessionId, string $resourceType, string $resourceId): ?OdeEditLock
    {
        return $this->createQueryBuilder('l')
            ->where('l.odeSessionId = :odeSessionId')
            ->andWhere('l.resourceType = :resourceType')
            ->andWhere('l.resourceId = :resourceId')
            ->setParameter('odeSessionId', $odeSessionId)
            ->setParameter('resourceType', $resourceType)
            ->setParameter('resourceId', $resourceId)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Release all locks held by a user in a session.
     * Useful when user disconnects/closes browser.
     */
    public function releaseAllLocksForUser(string $odeSessionId, string $userEmail): int
    {
        $deleted = $this->createQueryBuilder('l')
            ->delete()
            ->where('l.odeSessionId = :odeSessionId')
            ->andWhere('l.lockedBy = :userEmail')
            ->setParameter('odeSessionId', $odeSessionId)
            ->setParameter('userEmail', $userEmail)
            ->getQuery()
            ->execute();

        $this->logger->info('Released all locks for user', [
            'odeSessionId' => $odeSessionId,
            'userEmail' => $userEmail,
            'locksReleased' => $deleted,
        ]);

        return (int) $deleted;
    }

    /**
     * Release all locks in a session.
     * Useful when session is closed/cleaned up.
     */
    public function releaseAllLocksInSession(string $odeSessionId): int
    {
        $deleted = $this->createQueryBuilder('l')
            ->delete()
            ->where('l.odeSessionId = :odeSessionId')
            ->setParameter('odeSessionId', $odeSessionId)
            ->getQuery()
            ->execute();

        $this->logger->info('Released all locks in session', [
            'odeSessionId' => $odeSessionId,
            'locksReleased' => $deleted,
        ]);

        return (int) $deleted;
    }

    /**
     * Clean up all expired locks across all sessions.
     * Should be called by a cron job/scheduled task.
     *
     * @return int Number of locks cleaned
     */
    public function cleanExpiredLocks(): int
    {
        $now = new \DateTime();

        $deleted = $this->createQueryBuilder('l')
            ->delete()
            ->where('l.expiresAt < :now')
            ->setParameter('now', $now)
            ->getQuery()
            ->execute();

        if ($deleted > 0) {
            $this->logger->info('Cleaned expired locks', [
                'locksRemoved' => $deleted,
                'timestamp' => $now->format('Y-m-d H:i:s'),
            ]);
        }

        return (int) $deleted;
    }

    /**
     * Clean expired locks for a specific resource.
     */
    private function cleanExpiredLocksForResource(string $odeSessionId, string $resourceType, string $resourceId): void
    {
        $now = new \DateTime();

        $this->createQueryBuilder('l')
            ->delete()
            ->where('l.odeSessionId = :odeSessionId')
            ->andWhere('l.resourceType = :resourceType')
            ->andWhere('l.resourceId = :resourceId')
            ->andWhere('l.expiresAt < :now')
            ->setParameter('odeSessionId', $odeSessionId)
            ->setParameter('resourceType', $resourceType)
            ->setParameter('resourceId', $resourceId)
            ->setParameter('now', $now)
            ->getQuery()
            ->execute();
    }

    /**
     * Get all locks in a session (for debugging/monitoring).
     *
     * @return OdeEditLock[]
     */
    public function findLocksInSession(string $odeSessionId): array
    {
        return $this->createQueryBuilder('l')
            ->where('l.odeSessionId = :odeSessionId')
            ->setParameter('odeSessionId', $odeSessionId)
            ->orderBy('l.lockedAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Get all locks held by a user.
     *
     * @return OdeEditLock[]
     */
    public function findLocksForUser(string $odeSessionId, string $userEmail): array
    {
        return $this->createQueryBuilder('l')
            ->where('l.odeSessionId = :odeSessionId')
            ->andWhere('l.lockedBy = :userEmail')
            ->setParameter('odeSessionId', $odeSessionId)
            ->setParameter('userEmail', $userEmail)
            ->orderBy('l.lockedAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Renew/extend a lock's expiration time.
     */
    public function renewLock(
        string $odeSessionId,
        string $resourceType,
        string $resourceId,
        string $userEmail,
        int $extendMinutes = OdeEditLock::DEFAULT_LOCK_DURATION_MINUTES
    ): bool {
        $lock = $this->isLocked($odeSessionId, $resourceType, $resourceId);

        if (!$lock || !$lock->isLockedBy($userEmail)) {
            return false;
        }

        $lock->refresh($extendMinutes);
        $this->getEntityManager()->flush();

        $this->logger->debug('Lock renewed', [
            'odeSessionId' => $odeSessionId,
            'resourceType' => $resourceType,
            'resourceId' => $resourceId,
            'newExpiresAt' => $lock->getExpiresAt()->format('Y-m-d H:i:s'),
        ]);

        return true;
    }
}
