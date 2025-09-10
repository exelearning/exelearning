<?php

namespace App\Entity\net\exelearning\Entity;

use Doctrine\ORM\Event\PrePersistEventArgs;
use Doctrine\ORM\Event\PreUpdateEventArgs;
use Doctrine\ORM\Mapping as ORM;

#[ORM\MappedSuperclass]
#[ORM\HasLifecycleCallbacks]
class BaseEntity
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(name: 'id', type: 'integer')]
    protected ?int $id = null;

    #[ORM\Column(name: 'is_active', type: 'boolean', nullable: false, options: ['default' => true])]
    protected bool $isActive;

    #[ORM\Column(name: 'created_at', type: 'datetime', nullable: true)]
    protected ?\DateTime $createdAt = null;

    #[ORM\Column(name: 'updated_at', type: 'datetime', nullable: true)]
    protected ?\DateTime $updatedAt = null;

    protected ?string $master_field = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    /**
     * Replicates an object, setting the id attribute to null in the copy.
     */
    public function __clone(): void
    {
        $this->id = null;
    }

    public function setCreatedAt(\DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getCreatedAt(): ?\DateTime
    {
        return $this->createdAt;
    }

    public function setUpdatedAt(\DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getUpdatedAt(): ?\DateTime
    {
        return $this->updatedAt;
    }

    #[ORM\PrePersist]
    public function prePersist(PrePersistEventArgs $args): void
    {
        $this->createdAt = new \DateTime();
        $this->updatedAt = new \DateTime();
        $this->isActive = true;
    }

    #[ORM\PreUpdate]
    public function preUpdate(PreUpdateEventArgs $args): void
    {
        $this->updatedAt = new \DateTime();
    }

    /**
     * Performs a logical delete by setting the isActive flag to false.
     */
    public function borradoLogico(): void
    {
        $this->isActive = false;
    }

    public function setIsActive(bool $isActive): self
    {
        $this->isActive = $isActive;

        return $this;
    }

    public function getIsActive(): bool
    {
        return $this->isActive;
    }

    public function setMasterField(string $master_field): void
    {
        $this->master_field = $master_field;
    }

    public function getMasterField(): ?string
    {
        return $this->master_field;
    }

    public function setMasterEntity($master_entity): void
    {
        if (null !== $this->master_field) {
            $this->{$this->master_field} = $master_entity;
        }
    }

    public function getMasterEntity()
    {
        return null !== $this->master_field ? $this->{$this->master_field} : null;
    }
}
