<?php

namespace App\Entity\Project;

use App\Entity\net\exelearning\Entity\User;
use App\Repository\Project\ProjectCollaboratorRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Table(name: 'project_collaborators')]
#[ORM\UniqueConstraint(name: 'uniq_project_user', columns: ['project_id', 'user_id'])]
#[ORM\Index(name: 'idx_project', columns: ['project_id'])]
#[ORM\Index(name: 'idx_user', columns: ['user_id'])]
#[ORM\Index(name: 'idx_role', columns: ['role'])]
#[ORM\Entity(repositoryClass: ProjectCollaboratorRepository::class)]
class ProjectCollaborator
{
    public const ROLE_OWNER = 'owner';
    public const ROLE_EDITOR = 'editor';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\ManyToOne(targetEntity: Project::class)]
    #[ORM\JoinColumn(name: 'project_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private Project $project;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'user_id', referencedColumnName: 'id', nullable: false, onDelete: 'CASCADE')]
    private User $user;

    #[ORM\Column(type: 'string', length: 20)]
    private string $role;

    #[ORM\Column(name: 'granted_at', type: 'datetime')]
    private \DateTime $grantedAt;

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'granted_by_id', referencedColumnName: 'id', nullable: true, onDelete: 'SET NULL')]
    private ?User $grantedBy = null;

    public function __construct()
    {
        $this->grantedAt = new \DateTime();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getProject(): Project
    {
        return $this->project;
    }

    public function setProject(Project $project): self
    {
        $this->project = $project;

        return $this;
    }

    public function getUser(): User
    {
        return $this->user;
    }

    public function setUser(User $user): self
    {
        $this->user = $user;

        return $this;
    }

    public function getRole(): string
    {
        return $this->role;
    }

    public function setRole(string $role): self
    {
        if (!in_array($role, [self::ROLE_OWNER, self::ROLE_EDITOR])) {
            throw new \InvalidArgumentException(sprintf('Role must be either "%s" or "%s"', self::ROLE_OWNER, self::ROLE_EDITOR));
        }

        $this->role = $role;

        return $this;
    }

    public function isOwner(): bool
    {
        return self::ROLE_OWNER === $this->role;
    }

    public function isEditor(): bool
    {
        return self::ROLE_EDITOR === $this->role;
    }

    public function getGrantedAt(): \DateTime
    {
        return $this->grantedAt;
    }

    public function setGrantedAt(\DateTime $grantedAt): self
    {
        $this->grantedAt = $grantedAt;

        return $this;
    }

    public function getGrantedBy(): ?User
    {
        return $this->grantedBy;
    }

    public function setGrantedBy(?User $grantedBy): self
    {
        $this->grantedBy = $grantedBy;

        return $this;
    }
}
