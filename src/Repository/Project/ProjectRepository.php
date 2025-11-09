<?php

namespace App\Repository\Project;

use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Project>
 */
class ProjectRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Project::class);
    }

    /**
     * Find all projects owned by a user.
     *
     * @return Project[]
     */
    public function findByOwner(User $owner): array
    {
        return $this->createQueryBuilder('p')
            ->where('p.owner = :owner')
            ->andWhere('p.isArchived = :archived')
            ->setParameter('owner', $owner)
            ->setParameter('archived', false)
            ->orderBy('p.lastAccessedAt', 'DESC')
            ->addOrderBy('p.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find all public projects.
     *
     * @return Project[]
     */
    public function findPublicProjects(): array
    {
        return $this->createQueryBuilder('p')
            ->where('p.visibility = :visibility')
            ->andWhere('p.isArchived = :archived')
            ->setParameter('visibility', 'public')
            ->setParameter('archived', false)
            ->orderBy('p.lastAccessedAt', 'DESC')
            ->addOrderBy('p.createdAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find a project by ID if the user has access to it.
     * Returns null if project doesn't exist or user doesn't have access.
     */
    public function findAccessibleProject(string $projectId, ?User $user = null): ?Project
    {
        $qb = $this->createQueryBuilder('p')
            ->where('p.id = :id')
            ->setParameter('id', $projectId);

        // If no user (anonymous), only public projects
        if (!$user) {
            $qb->andWhere('p.visibility = :visibility')
                ->setParameter('visibility', 'public');
        }

        return $qb->getQuery()->getOneOrNullResult();
    }

    /**
     * Check if a project exists.
     */
    public function exists(string $projectId): bool
    {
        return $this->createQueryBuilder('p')
            ->select('COUNT(p.id)')
            ->where('p.id = :id')
            ->setParameter('id', $projectId)
            ->getQuery()
            ->getSingleScalarResult() > 0;
    }

    public function save(Project $project, bool $flush = false): void
    {
        $this->getEntityManager()->persist($project);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(Project $project, bool $flush = false): void
    {
        $this->getEntityManager()->remove($project);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }
}
