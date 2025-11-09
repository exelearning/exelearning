<?php

namespace App\Repository\Project;

use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use App\Entity\net\exelearning\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<ProjectCollaborator>
 */
class ProjectCollaboratorRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, ProjectCollaborator::class);
    }

    /**
     * Find all collaborators for a project.
     *
     * @return ProjectCollaborator[]
     */
    public function findByProject(Project $project): array
    {
        return $this->createQueryBuilder('pc')
            ->where('pc.project = :project')
            ->setParameter('project', $project)
            ->orderBy('pc.grantedAt', 'ASC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find all projects where user is a collaborator.
     *
     * @return ProjectCollaborator[]
     */
    public function findByUser(User $user): array
    {
        return $this->createQueryBuilder('pc')
            ->where('pc.user = :user')
            ->setParameter('user', $user)
            ->orderBy('pc.grantedAt', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * Find collaborator record for a specific user in a specific project.
     */
    public function findCollaborator(Project $project, User $user): ?ProjectCollaborator
    {
        return $this->createQueryBuilder('pc')
            ->where('pc.project = :project')
            ->andWhere('pc.user = :user')
            ->setParameter('project', $project)
            ->setParameter('user', $user)
            ->getQuery()
            ->getOneOrNullResult();
    }

    /**
     * Check if a user is a collaborator on a project.
     */
    public function isCollaborator(Project $project, User $user): bool
    {
        return $this->findCollaborator($project, $user) !== null;
    }

    /**
     * Get the user's role in a project, or null if not a collaborator.
     */
    public function getUserRole(Project $project, User $user): ?string
    {
        $collaborator = $this->findCollaborator($project, $user);

        return $collaborator?->getRole();
    }

    /**
     * Check if a user is the owner of a project.
     */
    public function isOwner(Project $project, User $user): bool
    {
        $role = $this->getUserRole($project, $user);

        return $role === ProjectCollaborator::ROLE_OWNER;
    }

    /**
     * Check if a user is an editor (or owner) of a project.
     */
    public function canEdit(Project $project, User $user): bool
    {
        $role = $this->getUserRole($project, $user);

        return in_array($role, [ProjectCollaborator::ROLE_OWNER, ProjectCollaborator::ROLE_EDITOR]);
    }

    /**
     * Get all owners of a project.
     *
     * @return ProjectCollaborator[]
     */
    public function findOwners(Project $project): array
    {
        return $this->createQueryBuilder('pc')
            ->where('pc.project = :project')
            ->andWhere('pc.role = :role')
            ->setParameter('project', $project)
            ->setParameter('role', ProjectCollaborator::ROLE_OWNER)
            ->getQuery()
            ->getResult();
    }

    /**
     * Count collaborators for a project.
     */
    public function countCollaborators(Project $project): int
    {
        return (int) $this->createQueryBuilder('pc')
            ->select('COUNT(pc.id)')
            ->where('pc.project = :project')
            ->setParameter('project', $project)
            ->getQuery()
            ->getSingleScalarResult();
    }

    public function save(ProjectCollaborator $collaborator, bool $flush = false): void
    {
        $this->getEntityManager()->persist($collaborator);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }

    public function remove(ProjectCollaborator $collaborator, bool $flush = false): void
    {
        $this->getEntityManager()->remove($collaborator);

        if ($flush) {
            $this->getEntityManager()->flush();
        }
    }
}
