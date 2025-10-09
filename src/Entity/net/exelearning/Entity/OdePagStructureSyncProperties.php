<?php

namespace App\Entity\net\exelearning\Entity;

use App\Constants;
use App\Properties;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Table(name: 'ode_pag_structure_sync_properties')]
#[ORM\Index(name: 'fk_ode_pag_structure_sync_properties_1_idx', columns: ['ode_pag_structure_sync_id'])]
#[ORM\Entity(repositoryClass: OdePagStructureSyncPropertiesRepository::class)]
class OdePagStructureSyncProperties extends BaseEntity
{
    #[ORM\Column(name: 'ode_pag_structure_sync_properties_key', type: 'string', length: 255, nullable: false)]
    protected string $key;

    #[ORM\Column(name: 'ode_pag_structure_sync_properties_value', type: 'text', nullable: false)]
    protected string $value;

    #[ORM\Column(name: 'description', type: 'text', nullable: true)]
    protected ?string $description = null;

    #[ORM\ManyToOne(targetEntity: 'OdePagStructureSync', inversedBy: 'odePagStructureSyncProperties')]
    #[ORM\JoinColumn(name: 'ode_pag_structure_sync_id', referencedColumnName: 'id', onDelete: 'CASCADE')]
    protected OdePagStructureSync $odePagStructureSync;

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

    public function getOdePagStructureSync(): ?OdePagStructureSync
    {
        return $this->odePagStructureSync;
    }

    public function setOdePagStructureSync(?OdePagStructureSync $odePagStructureSync): self
    {
        $this->odePagStructureSync = $odePagStructureSync;

        return $this;
    }

    /**
     * Loads key and value from properties constants config.
     */
    public function loadFromPropertiesConfig(
        ?OdePagStructureSync $odePagStructureSync,
        string $propertiesConfigKey,
        array $propertiesConfigValues,
    ): self {
        $this->setOdePagStructureSync($odePagStructureSync);

        $this->setKey($propertiesConfigKey);

        $value = isset($propertiesConfigValues['value']) ? $propertiesConfigValues['value'] : '';
        $this->setValue($value);

        return $this;
    }

    /**
     * Checks if current property value is heritable from its parent.
     *
     * @return bool
     */
    public function isHeritable()
    {
        $isHeritable = false;

        if (
            (!empty($this->getKey()))
            && (isset(Properties::ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG[$this->getKey()]))
            && (isset(Properties::ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG[$this->getKey()]['heritable']))
            && (true == Properties::ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG[$this->getKey()]['heritable'])
        ) {
            $isHeritable = true;
        }

        return $isHeritable;
    }

    /**
     * Creates a copy of OdeComponentsSyncProperties.
     */
    public function duplicate(): OdePagStructureSyncProperties
    {
        $copy = clone $this;

        if (isset($copy->id)) {
            $copy->id = null;
        }

        // $copy->setOdePagStructureSync(null);

        return $copy;
    }
}
