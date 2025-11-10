<?php

namespace App\Repository\net\exelearning\Repository;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @method CurrentOdeUsers|null find($id, $lockMode = null, $lockVersion = null)
 * @method CurrentOdeUsers|null findOneBy(array $criteria, array $orderBy = null)
 * @method CurrentOdeUsers[]    findAll()
 * @method CurrentOdeUsers[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class CurrentOdeUsersRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, CurrentOdeUsers::class);
    }

    public function findByCurrentComponentId(string $currentComponentId): ?CurrentOdeUsers
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.currentComponentId = :currentComponentId')
            ->setParameter('currentComponentId', $currentComponentId)
            ->getQuery()
            ->getOneOrNullResult();
    }
    // /**
    //  * @return CurrentOdeUsers[] Returns an array of CurrentOdeUsers objects
    //  */
    /*
    public function findByExampleField($value)
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.exampleField = :val')
            ->setParameter('val', $value)
            ->orderBy('c.id', 'ASC')
            ->setMaxResults(10)
            ->getQuery()
            ->getResult()
        ;
    }
    */

    /*
    public function findOneBySomeField($value): ?CurrentOdeUsers
    {
        return $this->createQueryBuilder('c')
            ->andWhere('c.exampleField = :val')
            ->setParameter('val', $value)
            ->getQuery()
            ->getOneOrNullResult()
        ;
    }
    */

    /**
     * getCurrentUsers.
     *
     * @param string $odeId
     * @param string $odeVersionId
     * @param string $odeSessionId
     *
     * @return CurrentOdeUsers[]
     */
    public function getCurrentUsers($odeId, $odeVersionId, $odeSessionId)
    {
        $queryBuilder = $this->createQueryBuilder('c');

        if (!empty($odeId)) {
            $queryBuilder
                ->andWhere('c.odeId = :odeId')
                ->setParameter('odeId', $odeId);
        }

        if (!empty($odeVersionId)) {
            $queryBuilder
                ->andWhere('c.odeVersionId = :odeVersionId')
                ->setParameter('odeVersionId', $odeVersionId);
        }

        if (!empty($odeSessionId)) {
            $queryBuilder
                ->andWhere('c.odeSessionId = :odeSessionId')
                ->setParameter('odeSessionId', $odeSessionId);
        }

        $queryBuilder->orderBy('c.lastAction', 'DESC');

        return $queryBuilder
            ->getQuery()
            ->getResult()
        ;
    }

    /**
     * getCurrentSessionForUser.
     *
     * @param string $user
     *
     * @return CurrentOdeUsers
     */
    public function getCurrentSessionForUser($user, ?string $odeSessionId = null)
    {
        $queryBuilder = $this->createQueryBuilder('c')
            ->andWhere('c.user = :user')
            ->setParameter('user', $user)
        ;

        if (!empty($odeSessionId)) {
            $queryBuilder
                ->andWhere('c.odeSessionId = :odeSessionId')
                ->setParameter('odeSessionId', $odeSessionId)
            ;
        } else {
            $queryBuilder->orderBy('c.lastAction', 'DESC');
        }

        return $queryBuilder
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult()
        ;
    }

    /**
     * Removes CurrentOdeUser by odeSessionId and user.
     *
     * @param string $odeSessionId
     * @param string $user
     *
     * @return number
     */
    public function removeByOdeSessionIdAndUser($odeSessionId, $user)
    {
        $queryDeleteCurrentOdeUsers = $this->createQueryBuilder('n')
            ->delete()
            ->where('n.odeSessionId = :odeSessionId')
            ->setParameter('odeSessionId', $odeSessionId)
            ->andWhere('n.user = :user')
            ->setParameter('user', $user)
            ->getQuery();

        $currentOdeUsersDeleted = $queryDeleteCurrentOdeUsers->execute();

        return $currentOdeUsersDeleted;
    }

    // =========================================================================
    // OPTIMIZED QUERIES - Leverage performance indexes created in migration
    // =========================================================================

    /**
     * Find sessions by odeSessionId and user.
     * Uses composite index: idx_current_ode_session_user (ode_session_id, user).
     *
     * @return CurrentOdeUsers[]
     */
    public function findBySessionAndUser(string $odeSessionId, string $user): array
    {
        return $this->createQueryBuilder('cou')
            ->where('cou.odeSessionId = :odeSessionId')
            ->andWhere('cou.user = :user')
            ->setParameter('odeSessionId', $odeSessionId)
            ->setParameter('user', $user)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find inactive sessions (no activity in last N minutes).
     * Uses index: idx_current_ode_last_action (last_action).
     *
     * @param int $inactiveMinutes Minutes of inactivity
     *
     * @return CurrentOdeUsers[]
     */
    public function findInactiveSessions(int $inactiveMinutes = 60): array
    {
        $cutoffTime = new \DateTime();
        $cutoffTime->modify("-{$inactiveMinutes} minutes");

        return $this->createQueryBuilder('cou')
            ->where('cou.lastAction < :cutoffTime')
            ->setParameter('cutoffTime', $cutoffTime)
            ->orderBy('cou.lastAction', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find all sessions for a specific project/ode.
     * Uses index: idx_current_ode_id (ode_id).
     *
     * @return CurrentOdeUsers[]
     */
    public function findByOdeId(string $odeId): array
    {
        return $this->createQueryBuilder('cou')
            ->where('cou.odeId = :odeId')
            ->setParameter('odeId', $odeId)
            ->orderBy('cou.lastAction', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find all sessions for a project.
     * Uses index: idx_current_ode_project (project_id).
     *
     * @return CurrentOdeUsers[]
     */
    public function findByProjectId(string $projectId): array
    {
        return $this->createQueryBuilder('cou')
            ->where('cou.projectId = :projectId')
            ->setParameter('projectId', $projectId)
            ->orderBy('cou.lastAction', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Count active sessions for a project.
     * Uses index: idx_current_ode_project (project_id).
     *
     * @param int $activeWithinMinutes Consider active if action within N minutes
     */
    public function countActiveProjectSessions(string $projectId, int $activeWithinMinutes = 30): int
    {
        $cutoffTime = new \DateTime();
        $cutoffTime->modify("-{$activeWithinMinutes} minutes");

        return (int) $this->createQueryBuilder('cou')
            ->select('COUNT(cou.id)')
            ->where('cou.projectId = :projectId')
            ->andWhere('cou.lastAction >= :cutoffTime')
            ->setParameter('projectId', $projectId)
            ->setParameter('cutoffTime', $cutoffTime)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Get most recently active sessions.
     * Uses index: idx_current_ode_last_action (last_action).
     *
     * @return CurrentOdeUsers[]
     */
    public function getRecentSessions(int $limit = 10): array
    {
        return $this->createQueryBuilder('cou')
            ->orderBy('cou.lastAction', 'DESC')
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();
    }

    /**
     * Find abandoned sessions for cleanup (old and inactive).
     * Uses index: idx_current_ode_last_action (last_action).
     *
     * @param int $hoursInactive Hours without activity to consider abandoned
     *
     * @return CurrentOdeUsers[]
     */
    public function findAbandonedSessions(int $hoursInactive = 24): array
    {
        $cutoffTime = new \DateTime();
        $cutoffTime->modify("-{$hoursInactive} hours");

        return $this->createQueryBuilder('cou')
            ->where('cou.lastAction < :cutoffTime')
            ->setParameter('cutoffTime', $cutoffTime)
            ->orderBy('cou.lastAction', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Get distinct user emails for a project.
     * Uses index: idx_current_ode_project (project_id).
     *
     * @return array Array of user emails
     */
    public function getProjectActiveUsers(string $projectId): array
    {
        $results = $this->createQueryBuilder('cou')
            ->select('DISTINCT cou.user')
            ->where('cou.projectId = :projectId')
            ->setParameter('projectId', $projectId)
            ->getQuery()
            ->getResult();

        return array_column($results, 'user');
    }

    // =========================================================================
    // MULTI-USER COLLABORATION - Shared Session Support
    // =========================================================================

    /**
     * Find an active session for a project (for joining/reusing sessions).
     * Returns the most recently active session within the activity window.
     * Uses index: idx_current_ode_id (ode_id).
     *
     * @param string $odeId The project/ode identifier
     * @param int $activeWithinMinutes Consider active if action within N minutes (default 30)
     *
     * @return CurrentOdeUsers|null The most recent active session, or null if none found
     */
    public function findActiveSessionByOdeId(string $odeId, int $activeWithinMinutes = 30): ?CurrentOdeUsers
    {
        $cutoffTime = new \DateTime();
        $cutoffTime->modify("-{$activeWithinMinutes} minutes");

        return $this->createQueryBuilder('cou')
            ->where('cou.odeId = :odeId')
            ->andWhere('cou.lastAction >= :cutoffTime')
            ->setParameter('odeId', $odeId)
            ->setParameter('cutoffTime', $cutoffTime)
            ->orderBy('cou.lastAction', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Count active users in a specific session.
     * Uses index: idx_current_ode_session_id (ode_session_id).
     *
     * @param string $odeSessionId The session identifier
     * @param int $activeWithinMinutes Consider active if action within N minutes (default 30)
     *
     * @return int Number of active users in the session
     */
    public function countActiveUsersInSession(string $odeSessionId, int $activeWithinMinutes = 30): int
    {
        $cutoffTime = new \DateTime();
        $cutoffTime->modify("-{$activeWithinMinutes} minutes");

        return (int) $this->createQueryBuilder('cou')
            ->select('COUNT(DISTINCT cou.user)')
            ->where('cou.odeSessionId = :odeSessionId')
            ->andWhere('cou.lastAction >= :cutoffTime')
            ->setParameter('odeSessionId', $odeSessionId)
            ->setParameter('cutoffTime', $cutoffTime)
            ->getQuery()
            ->getSingleScalarResult();
    }

    /**
     * Get all users currently active in a session.
     * Uses index: idx_current_ode_session_id (ode_session_id).
     *
     * @param string $odeSessionId The session identifier
     * @param int $activeWithinMinutes Consider active if action within N minutes (default 30)
     *
     * @return CurrentOdeUsers[] Array of active users in the session
     */
    public function getUsersInSession(string $odeSessionId, int $activeWithinMinutes = 30): array
    {
        $cutoffTime = new \DateTime();
        $cutoffTime->modify("-{$activeWithinMinutes} minutes");

        return $this->createQueryBuilder('cou')
            ->where('cou.odeSessionId = :odeSessionId')
            ->andWhere('cou.lastAction >= :cutoffTime')
            ->setParameter('odeSessionId', $odeSessionId)
            ->setParameter('cutoffTime', $cutoffTime)
            ->orderBy('cou.lastAction', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Check if a user is already in a session.
     * Uses composite index: idx_current_ode_session_user (ode_session_id, user).
     *
     * @param string $odeSessionId The session identifier
     * @param string $user The user email
     *
     * @return bool True if user is in session, false otherwise
     */
    public function isUserInSession(string $odeSessionId, string $user): bool
    {
        $count = (int) $this->createQueryBuilder('cou')
            ->select('COUNT(cou.id)')
            ->where('cou.odeSessionId = :odeSessionId')
            ->andWhere('cou.user = :user')
            ->setParameter('odeSessionId', $odeSessionId)
            ->setParameter('user', $user)
            ->getQuery()
            ->getSingleScalarResult();

        return $count > 0;
    }
}
