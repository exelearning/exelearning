<?php

namespace App\Entity\Project;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Table(name: 'project_properties')]
#[ORM\UniqueConstraint(name: 'uniq_project_prop', columns: ['ode_id', 'prop_key'])]
#[ORM\Entity(repositoryClass: ProjectPropertyRepository::class)]
class ProjectProperty
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column(type: 'integer')]
    private ?int $id = null;

    #[ORM\Column(name: 'ode_id', type: 'string', length: 32)]
    private string $odeId;

    #[ORM\Column(name: 'prop_key', type: 'string', length: 128)]
    private string $key;

    #[ORM\Column(name: 'prop_value', type: 'text')]
    private string $value;

    #[ORM\Column(name: 'updated_at', type: 'datetime', nullable: true)]
    private ?\DateTime $updatedAt = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getOdeId(): string
    {
        return $this->odeId;
    }

    public function setOdeId(string $odeId): self
    {
        $this->odeId = $odeId;

        return $this;
    }

    public function getKey(): string
    {
        return $this->key;
    }

    public function setKey(string $key): self
    {
        $this->key = $key;

        return $this;
    }

    public function getValue(): string
    {
        return $this->value;
    }

    public function setValue(string $value): self
    {
        $this->value = $value;

        return $this;
    }

    public function getUpdatedAt(): ?\DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?\DateTime $dt): self
    {
        $this->updatedAt = $dt;

        return $this;
    }
}
