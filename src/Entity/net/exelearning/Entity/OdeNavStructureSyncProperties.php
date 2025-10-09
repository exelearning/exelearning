<?php

namespace App\Entity\net\exelearning\Entity;

use Doctrine\ORM\Mapping as ORM;

#[ORM\Table(name: 'ode_nav_structure_sync_properties')]
#[ORM\Index(name: 'fk_ode_nav_structure_sync_properties_1_idx', columns: ['ode_nav_structure_sync_id'])]
#[ORM\Entity(repositoryClass: OdeNavStructureSyncPropertiesRepository::class)]
class OdeNavStructureSyncProperties extends BaseEntity
{
    #[ORM\Column(name: 'ode_nav_structure_sync_properties_key', type: 'string', length: 255, nullable: false)]
    protected string $key;

    #[ORM\Column(name: 'ode_nav_structure_sync_properties_value', type: 'text', nullable: false)]
    protected string $value;

    #[ORM\Column(name: 'description', type: 'text', nullable: true)]
    protected ?string $description = null;

    #[ORM\ManyToOne(targetEntity: 'OdeNavStructureSync', inversedBy: 'odeNavStructureSyncProperties')]
    #[ORM\JoinColumn(name: 'ode_nav_structure_sync_id', referencedColumnName: 'id', onDelete: 'CASCADE')]
    protected OdeNavStructureSync $odeNavStructureSync;

    public function getKey(): ?string
    {
        return $this->key;
    }

    public function setKey(string $key): self
    {
        $this->key = $key;

        return $this;
    }

    public function getValue(): ?string
    {
        return $this->value;
    }

    public function setValue(string $value): self
    {
        $this->value = $value;

        return $this;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function setDescription(?string $description): self
    {
        $this->description = $description;

        return $this;
    }

    public function getOdeNavStructureSync(): ?OdeNavStructureSync
    {
        return $this->odeNavStructureSync;
    }

    public function setOdeNavStructureSync(?OdeNavStructureSync $odeNavStructureSync): self
    {
        $this->odeNavStructureSync = $odeNavStructureSync;

        return $this;
    }

    /**
     * Checks if property is titleNode.
     *
     * @return bool
     */
    public function isTitleNode()
    {
        if ('titleNode' == $this->getKey()) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Loads key and value from properties constants config.
     *
     * @param string propertiesConfigKey
     */
    public function loadFromPropertiesConfig(
        ?OdeNavStructureSync $odeNavStructureSync,
        string $propertiesConfigKey,
        array $propertiesConfigValues,
    ): self {
        $this->setOdeNavStructureSync($odeNavStructureSync);

        $this->setKey($propertiesConfigKey);

        $value = isset($propertiesConfigValues['value']) ? $propertiesConfigValues['value'] : '';
        $this->setValue($value);

        return $this;
    }

    /**
     * Creates a copy of OdeNavStructureSyncProperties.
     */
    public function duplicate(): OdeNavStructureSyncProperties
    {
        $copy = clone $this;

        if (isset($copy->id)) {
            $copy->id = null;
        }

        $copy->setOdeNavStructureSync($this->getOdeNavStructureSync());

        return $copy;
    }
}
