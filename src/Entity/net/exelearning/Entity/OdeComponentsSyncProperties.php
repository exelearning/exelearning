<?php

namespace App\Entity\net\exelearning\Entity;

use App\Constants;
use App\Properties;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Table(name: 'ode_components_sync_properties')]
#[ORM\Index(name: 'fk_ode_components_sync_properties_1_idx', columns: ['ode_components_sync_id'])]
#[ORM\Entity(repositoryClass: OdeComponentsSyncPropertiesRepository::class)]
class OdeComponentsSyncProperties extends BaseEntity
{
    #[ORM\Column(name: 'ode_components_sync_properties_key', type: 'string', length: 255, nullable: false)]
    protected string $key;

    #[ORM\Column(name: 'ode_components_sync_properties_value', type: 'text', nullable: false)]
    protected string $value;

    #[ORM\Column(name: 'description', type: 'text', nullable: true)]
    protected ?string $description = null;

    #[ORM\ManyToOne(targetEntity: 'OdeComponentsSync', inversedBy: 'odeComponentsSyncProperties')]
    #[ORM\JoinColumn(name: 'ode_components_sync_id', referencedColumnName: 'id', onDelete: 'CASCADE')]
    protected OdeComponentsSync $odeComponentsSync;

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

    public function getOdeComponentsSync(): ?OdeComponentsSync
    {
        return $this->odeComponentsSync;
    }

    public function setOdeComponentsSync(?OdeComponentsSync $odeComponentsSync): self
    {
        $this->odeComponentsSync = $odeComponentsSync;

        return $this;
    }

    /**
     * Loads key and value from properties constants config.
     */
    public function loadFromPropertiesConfig(
        ?OdeComponentsSync $odeComponentsSync,
        string $propertiesConfigKey,
        array $propertiesConfigValues,
    ): self {
        $this->setOdeComponentsSync($odeComponentsSync);

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
            && (isset(Properties::ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG[$this->getKey()]))
            && (isset(Properties::ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG[$this->getKey()]['heritable']))
            && (true == Properties::ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG[$this->getKey()]['heritable'])
        ) {
            $isHeritable = true;
        }

        return $isHeritable;
    }

    /**
     * Creates a copy of OdeComponentsSyncProperties.
     */
    public function duplicate(): OdeComponentsSyncProperties
    {
        $copy = clone $this;

        if (isset($copy->id)) {
            $copy->id = null;
        }

        $copy->setOdeComponentsSync(null);

        return $copy;
    }
}
