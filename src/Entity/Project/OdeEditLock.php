<?php

namespace App\Entity\Project;

use App\Repository\Project\OdeEditLockRepository;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Table(name: 'ode_edit_locks')]
#[ORM\UniqueConstraint(
    name: 'uniq_session_resource',
    columns: ['ode_session_id', 'resource_type', 'resource_id']
)]
#[ORM\Index(name: 'idx_ode_session_id', columns: ['ode_session_id'])]
#[ORM\Index(name: 'idx_locked_by', columns: ['locked_by'])]
#[ORM\Index(name: 'idx_expires_at', columns: ['expires_at'])]
#[ORM\Index(name: 'idx_resource_type', columns: ['resource_type'])]
#[ORM\Entity(repositoryClass: OdeEditLockRepository::class)]
class OdeEditLock
{
    // Resource types
    public const RESOURCE_TYPE_PAGE = 'page';
    public const RESOURCE_TYPE_BLOCK = 'block';
    public const RESOURCE_TYPE_IDEVICE = 'idevice';

    // Lock duration in minutes
    public const DEFAULT_LOCK_DURATION_MINUTES = 30;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(name: 'ode_session_id', type: 'string', length: 20, nullable: false)]
    private string $odeSessionId;

    #[ORM\Column(name: 'resource_type', type: 'string', length: 20, nullable: false)]
    private string $resourceType;

    #[ORM\Column(name: 'resource_id', type: 'string', length: 64, nullable: false)]
    private string $resourceId;

    #[ORM\Column(name: 'locked_by', type: 'string', length: 128, nullable: false)]
    private string $lockedBy;

    #[ORM\Column(name: 'locked_at', type: 'datetime', nullable: false)]
    private \DateTime $lockedAt;

    #[ORM\Column(name: 'expires_at', type: 'datetime', nullable: false)]
    private \DateTime $expiresAt;

    public function __construct()
    {
        $this->lockedAt = new \DateTime();
        $this->expiresAt = new \DateTime();
        $this->expiresAt->modify('+' . self::DEFAULT_LOCK_DURATION_MINUTES . ' minutes');
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getOdeSessionId(): string
    {
        return $this->odeSessionId;
    }

    public function setOdeSessionId(string $odeSessionId): self
    {
        $this->odeSessionId = $odeSessionId;

        return $this;
    }

    public function getResourceType(): string
    {
        return $this->resourceType;
    }

    public function setResourceType(string $resourceType): self
    {
        if (!in_array($resourceType, [
            self::RESOURCE_TYPE_PAGE,
            self::RESOURCE_TYPE_BLOCK,
            self::RESOURCE_TYPE_IDEVICE,
        ])) {
            throw new \InvalidArgumentException(sprintf(
                'Resource type must be one of: %s, %s, %s',
                self::RESOURCE_TYPE_PAGE,
                self::RESOURCE_TYPE_BLOCK,
                self::RESOURCE_TYPE_IDEVICE
            ));
        }

        $this->resourceType = $resourceType;

        return $this;
    }

    public function getResourceId(): string
    {
        return $this->resourceId;
    }

    public function setResourceId(string $resourceId): self
    {
        $this->resourceId = $resourceId;

        return $this;
    }

    public function getLockedBy(): string
    {
        return $this->lockedBy;
    }

    public function setLockedBy(string $lockedBy): self
    {
        $this->lockedBy = $lockedBy;

        return $this;
    }

    public function getLockedAt(): \DateTime
    {
        return $this->lockedAt;
    }

    public function setLockedAt(\DateTime $lockedAt): self
    {
        $this->lockedAt = $lockedAt;

        return $this;
    }

    public function getExpiresAt(): \DateTime
    {
        return $this->expiresAt;
    }

    public function setExpiresAt(\DateTime $expiresAt): self
    {
        $this->expiresAt = $expiresAt;

        return $this;
    }

    /**
     * Check if the lock has expired.
     */
    public function isExpired(): bool
    {
        return $this->expiresAt < new \DateTime();
    }

    /**
     * Refresh the lock expiration time.
     */
    public function refresh(int $minutes = self::DEFAULT_LOCK_DURATION_MINUTES): self
    {
        $this->expiresAt = new \DateTime();
        $this->expiresAt->modify("+{$minutes} minutes");

        return $this;
    }

    /**
     * Check if this lock belongs to a specific user.
     */
    public function isLockedBy(string $userEmail): bool
    {
        return $this->lockedBy === $userEmail;
    }

    /**
     * Get a human-readable lock identifier.
     */
    public function getLockIdentifier(): string
    {
        return sprintf('%s:%s', $this->resourceType, $this->resourceId);
    }
}
