<?php

namespace App\Repository\net\exelearning\Repository;

use App\Entity\net\exelearning\Entity\OdeFiles;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @method OdeFiles|null find($id, $lockMode = null, $lockVersion = null)
 * @method OdeFiles|null findOneBy(array $criteria, array $orderBy = null)
 * @method OdeFiles[]    findAll()
 * @method OdeFiles[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class OdeFilesRepository extends ServiceEntityRepository
{
    public function __construct(
        ManagerRegistry $registry,
        private readonly int $userRecentOdeFilesAmount,
        private readonly int $autosaveMaxFiles,
    ) {
        parent::__construct($registry, OdeFiles::class);
    }

    // /**
    //  * @return OdeFiles[] Returns an array of OdeFiles objects
    //  */
    /*
    public function findByExampleField($value)
    {
        return $this->createQueryBuilder('o')
            ->andWhere('o.exampleField = :val')
            ->setParameter('val', $value)
            ->orderBy('o.id', 'ASC')
            ->setMaxResults(10)
            ->getQuery()
            ->getResult()
        ;
    }
    */

    /*
    public function findOneBySomeField($value): ?OdeFiles
    {
        return $this->createQueryBuilder('o')
            ->andWhere('o.exampleField = :val')
            ->setParameter('val', $value)
            ->getQuery()
            ->getOneOrNullResult()
        ;
    }
    */

    /**
     * getLastFileForOde.
     *
     * @param string $odeId
     */
    public function getLastFileForOde($odeId): ?OdeFiles
    {
        return $this->createQueryBuilder('a')
            ->andWhere('a.odeId = :odeId')
            ->setParameter('odeId', $odeId)
            ->orderBy('a.updatedAt', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * getLastFileForOdeVersion.
     *
     * @param string $odeVersionId
     *
     * @return OdeFiles
     */
    public function getLastFileForOdeVersion($odeVersionId)
    {
        return $this->createQueryBuilder('a')
            ->andWhere('a.odeVersionId = :odeVersionId')
            ->setParameter('odeVersionId', $odeVersionId)
            ->orderBy('a.updatedAt', 'DESC')
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Finds OdeFiles by fileName.
     *
     * @param string $fileName
     *
     * @return OdeFiles
     */
    public function findByFileName($fileName)
    {
        return $this->createQueryBuilder('a')
            ->andWhere('a.fileName = :fileName')
            ->setParameter('fileName', $fileName)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Finds OdeFiles by username and date.
     *
     * @param DateTime $date
     *
     * @return OdeFiles
     */
    public function listOdeFilesByDate($userName, $date)
    {
        return $this->createQueryBuilder('a')
            ->andWhere('a.user = :userName')
            ->setParameter('userName', $userName)
            ->andWhere('a.createdAt <= :date')
            ->setParameter('date', $date)
            ->getQuery()
            ->getResult();
    }

    /**
     * List OdeFiles by user and order by most recent updated date.
     *
     * @param string $userName
     * @param bool   $onlyManualSave
     *
     * @return OdeFiles
     */
    public function listOdeFilesByUser($userName, $onlyManualSave)
    {
        $queryBuilder = $this->createQueryBuilder('a')
            ->andWhere('a.user = :userName')
            ->setParameter('userName', $userName);

        if ($onlyManualSave) {
            $queryBuilder
                ->andWhere('a.isManualSave = :isManualSave')
                ->setParameter('isManualSave', $onlyManualSave);
        }

        $queryBuilder
            ->orderBy('a.updatedAt', 'DESC');

        return $queryBuilder
            ->getQuery()
            ->getResult();
    }

    /**
     * List of 3 manual save OdeFiles by user and order by most recent updated date.
     *
     * @param string $userName
     *
     * @return OdeFiles
     */
    public function listRecentOdeFilesByUser($userName)
    {
        $queryBuilder = $this->createQueryBuilder('a')
            ->andWhere('a.user = :userName')
            ->setParameter('userName', $userName);

        $queryBuilder
            ->andWhere('a.isManualSave = :isManualSave')
            ->setParameter('isManualSave', true);

        $queryBuilder
            ->orderBy('a.updatedAt', 'DESC');

        $results = $queryBuilder
            ->getQuery()
            ->getResult();

        $unique = [];
        foreach ($results as $odeFile) {
            $odeId = $odeFile->getOdeId();
            if (!isset($unique[$odeId])) {
                $unique[$odeId] = $odeFile;
            }
            if (count($unique) >= $this->userRecentOdeFilesAmount) {
                break;
            }
        }

        return array_values($unique);
    }

    /**
     * Finds autosaved odeFiles previous to number of files to maintain.
     *
     * @param string $odeId
     *
     * @return OdeFiles[]
     */
    public function findAutosavedFilesToCleanByMaxNumberOfFiles($odeId, $maxNumberOfFiles)
    {
        if (!isset($maxNumberOfFiles)) {
            $maxNumberOfFiles = $this->autosaveMaxFiles;
        }

        return $this->createQueryBuilder('a')
            ->andWhere('a.odeId = :odeId')
            ->setParameter('odeId', $odeId)
            ->andWhere('a.isManualSave = :isManualSave')
            ->setParameter('isManualSave', false)
            ->orderBy('a.updatedAt', 'DESC')
            ->setFirstResult($maxNumberOfFiles)
            ->getQuery()
            ->getResult();
    }

    /**
     * Finds autosaved odeFiles previous by user.
     *
     * @param string $userName
     *
     * @return OdeFiles[]
     */
    public function findUserAutosavedFilesToCleanByMaxNumberOfFiles($userName, $maxNumberOfFiles)
    {
        if (!isset($maxNumberOfFiles)) {
            $maxNumberOfFiles = $this->autosaveMaxFiles;
        }

        return $this->createQueryBuilder('a')
            ->andWhere('a.user = :userName')
            ->setParameter('userName', $userName)
            ->andWhere('a.isManualSave = :isManualSave')
            ->setParameter('isManualSave', false)
            ->orderBy('a.updatedAt', 'DESC')
            ->setFirstResult($maxNumberOfFiles)
            ->getQuery()
            ->getResult();
    }

    // =========================================================================
    // OPTIMIZED QUERIES - Leverage performance indexes created in migration
    // =========================================================================

    /**
     * Find all files by project_id.
     * Uses index: idx_ode_files_project.
     *
     * @param string|null $orderBy Field to order by (updatedAt, createdAt)
     * @param string      $order   ASC or DESC
     *
     * @return OdeFiles[]
     */
    public function findByProjectId(string $projectId, ?string $orderBy = 'updatedAt', string $order = 'DESC'): array
    {
        $qb = $this->createQueryBuilder('of')
            ->where('of.projectId = :projectId')
            ->setParameter('projectId', $projectId);

        if ($orderBy) {
            $qb->orderBy("of.{$orderBy}", $order);
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * Get the latest version of a project.
     * Uses index: idx_ode_files_ode_updated (ode_id, updated_at).
     *
     * @param bool|null $onlyManualSave true=only manual saves, false=only autosaves, null=all
     */
    public function getLatestProjectVersion(string $projectId, ?bool $onlyManualSave = null): ?OdeFiles
    {
        $qb = $this->createQueryBuilder('of')
            ->where('of.odeId = :projectId')
            ->setParameter('projectId', $projectId)
            ->orderBy('of.updatedAt', 'DESC')
            ->setMaxResults(1);

        if (null !== $onlyManualSave) {
            $qb->andWhere('of.isManualSave = :isManualSave')
                ->setParameter('isManualSave', $onlyManualSave);
        }

        return $qb->getQuery()->getOneOrNullResult();
    }

    /**
     * Get recent files by user with efficient ordering.
     * Uses index: idx_ode_files_user_updated (user, updated_at).
     *
     * @return OdeFiles[]
     */
    public function getRecentFilesByUser(string $userName, int $limit = 10, ?bool $onlyManualSave = true): array
    {
        $qb = $this->createQueryBuilder('of')
            ->where('of.user = :userName')
            ->setParameter('userName', $userName)
            ->orderBy('of.updatedAt', 'DESC')
            ->setMaxResults($limit);

        if (null !== $onlyManualSave) {
            $qb->andWhere('of.isManualSave = :isManualSave')
                ->setParameter('isManualSave', $onlyManualSave);
        }

        return $qb->getQuery()->getResult();
    }

    /**
     * Get files by ode_id, user, and manual save status.
     * Uses composite index: idx_ode_files_user_manual (ode_id, user, is_manual_save).
     *
     * @return OdeFiles[]
     */
    public function findByOdeUserAndType(string $odeId, string $userName, bool $isManualSave): array
    {
        return $this->createQueryBuilder('of')
            ->where('of.odeId = :odeId')
            ->andWhere('of.user = :userName')
            ->andWhere('of.isManualSave = :isManualSave')
            ->setParameter('odeId', $odeId)
            ->setParameter('userName', $userName)
            ->setParameter('isManualSave', $isManualSave)
            ->orderBy('of.updatedAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Count total files by project.
     * Uses index: idx_ode_files_project.
     */
    public function countProjectFiles(string $projectId, ?bool $onlyManualSave = null): int
    {
        $qb = $this->createQueryBuilder('of')
            ->select('COUNT(of.id)')
            ->where('of.projectId = :projectId')
            ->setParameter('projectId', $projectId);

        if (null !== $onlyManualSave) {
            $qb->andWhere('of.isManualSave = :isManualSave')
                ->setParameter('isManualSave', $onlyManualSave);
        }

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    /**
     * Get distinct project IDs for a user ordered by most recent activity.
     * Uses index: idx_ode_files_user_updated (user, updated_at).
     *
     * @return array Array of project IDs
     */
    public function getUserProjectIds(string $userName, ?int $limit = null): array
    {
        // Get distinct ode_ids with their latest updated_at
        $qb = $this->createQueryBuilder('of')
            ->select('of.odeId, MAX(of.updatedAt) as lastUpdate')
            ->where('of.user = :userName')
            ->setParameter('userName', $userName)
            ->groupBy('of.odeId')
            ->orderBy('lastUpdate', 'DESC');

        if ($limit) {
            $qb->setMaxResults($limit);
        }

        $results = $qb->getQuery()->getResult();

        return array_column($results, 'odeId');
    }

    /**
     * Get old autosave versions for cleanup.
     * Optimized version using indexes.
     *
     * @param int $keepVersions Number of recent versions to keep
     *
     * @return OdeFiles[]
     */
    public function getOldAutosavesForCleanup(string $odeId, int $keepVersions = 5): array
    {
        return $this->createQueryBuilder('of')
            ->where('of.odeId = :odeId')
            ->andWhere('of.isManualSave = :isManualSave')
            ->setParameter('odeId', $odeId)
            ->setParameter('isManualSave', false)
            ->orderBy('of.updatedAt', 'DESC')
            ->setFirstResult($keepVersions)
            ->getQuery()
            ->getResult();
    }

    /**
     * Get files updated within a date range for a user.
     * Uses index: idx_ode_files_user_updated (user, updated_at).
     *
     * @return OdeFiles[]
     */
    public function findByUserAndDateRange(string $userName, \DateTime $startDate, \DateTime $endDate): array
    {
        return $this->createQueryBuilder('of')
            ->where('of.user = :userName')
            ->andWhere('of.updatedAt BETWEEN :startDate AND :endDate')
            ->setParameter('userName', $userName)
            ->setParameter('startDate', $startDate)
            ->setParameter('endDate', $endDate)
            ->orderBy('of.updatedAt', 'DESC')
            ->getQuery()
            ->getResult();
    }
}
