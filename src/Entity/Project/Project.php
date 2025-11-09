<?php

namespace App\Entity\Project;

use App\Entity\net\exelearning\Entity\User;
use App\Repository\Project\ProjectRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Table(name: 'projects')]
#[ORM\Index(name: 'idx_owner', columns: ['owner_id'])]
#[ORM\Index(name: 'idx_visibility', columns: ['visibility'])]
#[ORM\Index(name: 'idx_created_at', columns: ['created_at'])]
#[ORM\Entity(repositoryClass: ProjectRepository::class)]
class Project
{
    #[ORM\Id]
    #[ORM\Column(type: 'string', length: 20)]
    private string $id;

    #[ORM\Column(type: 'string', length: 255)]
    private string $title;

    #[ORM\Column(type: 'string', length: 10)]
    private string $visibility = 'private'; // 'public' or 'private'

    #[ORM\ManyToOne(targetEntity: User::class)]
    #[ORM\JoinColumn(name: 'owner_id', referencedColumnName: 'id', nullable: false)]
    private User $owner;

    #[ORM\Column(name: 'created_at', type: 'datetime')]
    private \DateTime $createdAt;

    #[ORM\Column(name: 'last_accessed_at', type: 'datetime', nullable: true)]
    private ?\DateTime $lastAccessedAt = null;

    #[ORM\Column(name: 'is_archived', type: 'boolean')]
    private bool $isArchived = false;

    public function __construct()
    {
        $this->createdAt = new \DateTime();
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(string $id): self
    {
        $this->id = $id;

        return $this;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): self
    {
        $this->title = $title;

        return $this;
    }

    public function getVisibility(): string
    {
        return $this->visibility;
    }

    public function setVisibility(string $visibility): self
    {
        if (!in_array($visibility, ['public', 'private'])) {
            throw new \InvalidArgumentException('Visibility must be either "public" or "private"');
        }

        $this->visibility = $visibility;

        return $this;
    }

    public function isPublic(): bool
    {
        return 'public' === $this->visibility;
    }

    public function isPrivate(): bool
    {
        return 'private' === $this->visibility;
    }

    public function getOwner(): User
    {
        return $this->owner;
    }

    public function setOwner(User $owner): self
    {
        $this->owner = $owner;

        return $this;
    }

    public function getCreatedAt(): \DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(\DateTime $createdAt): self
    {
        $this->createdAt = $createdAt;

        return $this;
    }

    public function getLastAccessedAt(): ?\DateTime
    {
        return $this->lastAccessedAt;
    }

    public function setLastAccessedAt(?\DateTime $lastAccessedAt): self
    {
        $this->lastAccessedAt = $lastAccessedAt;

        return $this;
    }

    public function updateLastAccessedAt(): self
    {
        $this->lastAccessedAt = new \DateTime();

        return $this;
    }

    public function isArchived(): bool
    {
        return $this->isArchived;
    }

    public function setArchived(bool $isArchived): self
    {
        $this->isArchived = $isArchived;

        return $this;
    }
}
