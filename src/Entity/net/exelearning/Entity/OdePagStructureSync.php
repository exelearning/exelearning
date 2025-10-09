<?php

namespace App\Entity\net\exelearning\Entity;

use App\Properties;
use App\Repository\net\exelearning\Repository\OdePagStructureSyncRepository;
use App\Util\net\exelearning\Util\Util;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Doctrine\ORM\Mapping\OrderBy;

#[ORM\Table(name: 'ode_pag_structure_sync')]
#[ORM\Index(name: 'fk_ode_pag_structure_sync_1_idx', columns: ['ode_pag_structure_sync_id'])]
#[ORM\Index(name: 'fk_ode_pag_structure_sync_2_idx', columns: ['ode_nav_structure_sync_id'])]
#[ORM\Entity(repositoryClass: OdePagStructureSyncRepository::class)]
class OdePagStructureSync extends BaseEntity
{
    #[ORM\Column(name: 'ode_session_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeSessionId;

    #[ORM\Column(name: 'ode_page_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odePageId;

    #[ORM\Column(name: 'ode_block_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeBlockId;

    #[ORM\Column(name: 'ode_parent_block_id', type: 'string', length: 20, nullable: true, options: ['fixed' => true])]
    protected ?string $odeParentBlockId = null;

    #[ORM\Column(name: 'block_name', type: 'string', length: 255, nullable: false)]
    protected string $blockName;

    #[ORM\Column(name: 'icon_name', type: 'string', length: 255, nullable: true)]
    protected ?string $iconName = null;

    #[ORM\Column(name: 'ode_pag_structure_sync_order', type: 'integer', nullable: false)]
    protected int $odePagStructureSyncOrder;

    #[ORM\ManyToOne(targetEntity: 'OdePagStructureSync')]
    #[ORM\JoinColumn(name: 'ode_pag_structure_sync_id', referencedColumnName: 'id', onDelete: 'CASCADE')]
    protected ?self $odePagStructureSync = null;

    #[ORM\ManyToOne(targetEntity: 'OdeNavStructureSync', inversedBy: 'odePagStructureSyncs')]
    #[ORM\JoinColumn(name: 'ode_nav_structure_sync_id', referencedColumnName: 'id', onDelete: 'CASCADE')]
    protected OdeNavStructureSync $odeNavStructureSync;

    #[ORM\OneToMany(targetEntity: 'OdeComponentsSync', mappedBy: 'odePagStructureSync', orphanRemoval: true)]
    #[OrderBy(['odeComponentsSyncOrder' => 'ASC'])]
    protected Collection $odeComponentsSyncs;

    #[ORM\OneToMany(targetEntity: 'OdePagStructureSyncProperties', mappedBy: 'odePagStructureSync', orphanRemoval: true, fetch: 'EAGER')]
    protected Collection $odePagStructureSyncProperties;

    public function __construct()
    {
        $this->odeComponentsSyncs = new ArrayCollection();
        $this->odePagStructureSyncProperties = new ArrayCollection();
    }

    public function getOdeSessionId(): ?string
    {
        return $this->odeSessionId;
    }

    public function setOdeSessionId(string $odeSessionId): self
    {
        $this->odeSessionId = $odeSessionId;

        return $this;
    }

    public function getOdePageId(): ?string
    {
        return $this->odePageId;
    }

    public function setOdePageId(string $odePageId): self
    {
        $this->odePageId = $odePageId;

        return $this;
    }

    public function getOdeBlockId(): ?string
    {
        return $this->odeBlockId;
    }

    public function setOdeBlockId(string $odeBlockId): self
    {
        $this->odeBlockId = $odeBlockId;

        return $this;
    }

    public function getOdeParentBlockId(): ?string
    {
        return $this->odeParentBlockId;
    }

    public function setOdeParentBlockId(?string $odeParentBlockId): self
    {
        $this->odeParentBlockId = $odeParentBlockId;

        return $this;
    }

    public function getBlockName(): ?string
    {
        return $this->blockName;
    }

    public function setBlockName(string $blockName): self
    {
        $this->blockName = $blockName;

        return $this;
    }

    public function getIconName(): ?string
    {
        return $this->iconName;
    }

    public function setIconName(string $iconName): self
    {
        $this->iconName = $iconName;

        return $this;
    }

    public function getOdePagStructureSyncOrder(): ?int
    {
        return $this->odePagStructureSyncOrder;
    }

    public function setOdePagStructureSyncOrder(int $odePagStructureSyncOrder): self
    {
        $this->odePagStructureSyncOrder = $odePagStructureSyncOrder;

        return $this;
    }

    public function getOdePagStructureSync(): ?self
    {
        return $this->odePagStructureSync;
    }

    public function setOdePagStructureSync(?self $odePagStructureSync): self
    {
        $this->odePagStructureSync = $odePagStructureSync;

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

    public function addOdeComponentsSync(?OdeComponentsSync $odeComponentsSync): self
    {
        $odeComponentsSync->setOdePagStructureSync($this);
        $this->odeComponentsSyncs[] = $odeComponentsSync;

        return $this;
    }

    public function removeOdeComponentsSync(?OdeComponentsSync $odeComponentsSync): self
    {
        $this->odeComponentsSyncs->removeElement($odeComponentsSync);

        return $this;
    }

    public function getOdeComponentsSyncs(): Collection
    {
        return $this->odeComponentsSyncs;
    }

    public function setOdeComponentsSyncs(?Collection $odeComponentsSyncs): self
    {
        if (!empty($odeComponentsSyncs)) {
            $this->odeComponentsSyncs = $odeComponentsSyncs;
        } else {
            $this->odeComponentsSyncs = new ArrayCollection();
        }

        return $this;
    }

    public function addOdePagStructureSyncProperties(?OdePagStructureSyncProperties $odePagStructureSyncProperties): self
    {
        $odePagStructureSyncProperties->setOdePagStructureSync($this);
        $this->odePagStructureSyncProperties[] = $odePagStructureSyncProperties;

        return $this;
    }

    public function removeOdePagStructureSyncProperties(?OdePagStructureSyncProperties $odePagStructureSyncProperties): self
    {
        $this->odePagStructureSyncProperties->removeElement($odePagStructureSyncProperties);

        return $this;
    }

    public function getOdePagStructureSyncProperties(): Collection
    {
        return $this->odePagStructureSyncProperties;
    }

    public function setOdePagStructureSyncProperties(?Collection $odePagStructureSyncProperties): self
    {
        if (!empty($odePagStructureSyncProperties)) {
            $this->odePagStructureSyncProperties = $odePagStructureSyncProperties;
        } else {
            $this->odePagStructureSyncProperties = new ArrayCollection();
        }

        return $this;
    }

    /**
     * Returns max order value for all of the siblings of the OdePagStructureSync.
     */
    public function getMaxOrder(): ?int
    {
        $maxOrder = null;

        foreach ($this->getOdeNavStructureSync()->getOdePagStructureSyncs() as $odePagStructureSyncSibling) {
            if (!isset($maxOrder)) {
                $maxOrder = $odePagStructureSyncSibling->getOdePagStructureSyncOrder();
            } elseif ($odePagStructureSyncSibling->getOdePagStructureSyncOrder() >= $maxOrder) {
                $maxOrder = $odePagStructureSyncSibling->getOdePagStructureSyncOrder();
            }
        }

        return $maxOrder;
    }

    /**
     * Checks if all OdePagStructureSyncProperties are initialized.
     */
    public function areAllOdePagStructureSyncPropertiesInitialized(): bool
    {
        if ($this->getOdePagStructureSyncProperties()->count() == count(Properties::ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG)) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Loads OdePagStructureSyncProperties from database and from config those that aren't in the database.
     */
    public function loadOdePagStructureSyncPropertiesFromConfig(): self
    {
        if (!$this->areAllOdePagStructureSyncPropertiesInitialized()) {
            // check initialized properties
            $initializedProperties = [];
            foreach ($this->getOdePagStructureSyncProperties() as $odePagStructureSyncProperties) {
                $initializedProperties[$odePagStructureSyncProperties->getKey()] = true;
            }

            foreach (Properties::ODE_PAG_STRUCTURE_SYNC_PROPERTIES_CONFIG as $odePagStructureSyncPropertiesConfigKey => $odePagStructureSyncPropertiesConfigValues) {
                if (!isset($initializedProperties[$odePagStructureSyncPropertiesConfigKey])) {
                    // create OdePagStructureSyncProperties
                    $odePagStructureSyncProperties = new OdePagStructureSyncProperties();
                    $odePagStructureSyncProperties->loadFromPropertiesConfig($this, $odePagStructureSyncPropertiesConfigKey, $odePagStructureSyncPropertiesConfigValues);

                    $this->addOdePagStructureSyncProperties($odePagStructureSyncProperties);
                }
            }
        }

        return $this;
    }

    /**
     * Loads OdePagStructureSyncProperties from OdeNavStructureSync.
     */
    public function loadOdePagStructureSyncPropertiesFromOdeNavStructureSync(): self
    {
        $odeNavStructureSync = $this->getOdeNavStructureSync();

        if (!empty($odeNavStructureSync)) {
            foreach ($this->getOdePagStructureSyncProperties() as $odePagStructureSyncProperty) {
                // If property is heritable
                if ($odePagStructureSyncProperty->isHeritable()) {
                    foreach ($odeNavStructureSync->getOdeNavStructureSyncProperties() as $odeNavStructureSyncProperty) {
                        // if $odeNavStructureSyncProperty is saved and key is the same
                        if ((!empty($odeNavStructureSyncProperty->getId())) && ($odePagStructureSyncProperty->getkey() == $odeNavStructureSyncProperty->getKey())) {
                            $odePagStructureSyncProperty->setValue($odeNavStructureSyncProperty->getValue());
                        }
                    }
                }
            }
        }

        return $this;
    }

    /**
     * Creates a copy of OdePagStructureSync.
     */
    public function duplicate(): OdePagStructureSync
    {
        $copy = clone $this;

        if (isset($copy->id)) {
            $copy->id = null;
        }

        $copy->setOdeBlockId(Util::generateId());

        // $copy->setOdePagStructureSyncOrder($this->getOdePagStructureSyncOrder() + 1);

        // copy iDevices
        /* iDevices are duplicated outside to allow dir duplication
        $copy->setOdeComponentsSyncs(null);
        foreach ($this->getOdeComponentsSyncs() as $odeComponentsSync) {
            $odeComponentsSyncCopy = $odeComponentsSync->duplicate();

            $copy->addOdeComponentsSync($odeComponentsSyncCopy);
        }*/

        // copy properties
        // $copy->setOdePagStructureSyncProperties(null);

        foreach ($this->getOdePagStructureSyncProperties() as $odePagStructureSyncPropertiesElem) {
            $odePagStructureSyncPropertiesCopy = $odePagStructureSyncPropertiesElem->duplicate();

            $copy->addOdePagStructureSyncProperties($odePagStructureSyncPropertiesCopy);
        }

        return $copy;
    }
}
