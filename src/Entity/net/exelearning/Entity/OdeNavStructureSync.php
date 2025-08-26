<?php

namespace App\Entity\net\exelearning\Entity;

use App\Properties;
use App\Repository\net\exelearning\Repository\OdeNavStructureSyncRepository;
use App\Util\net\exelearning\Util\Util;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Doctrine\ORM\Mapping\OrderBy;

#[ORM\Table(name: 'ode_nav_structure_sync')]
#[ORM\Index(name: 'fk_ode_nav_structure_sync_1_idx', columns: ['ode_nav_structure_sync_id'])]
#[ORM\Entity(repositoryClass: OdeNavStructureSyncRepository::class)]
class OdeNavStructureSync extends BaseEntity
{
    #[ORM\Column(name: 'ode_session_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeSessionId;

    #[ORM\Column(name: 'ode_page_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odePageId;

    #[ORM\Column(name: 'page_name', type: 'string', length: 255, nullable: false)]
    protected string $pageName;

    #[ORM\Column(name: 'ode_nav_structure_sync_order', type: 'integer', nullable: false)]
    protected int $odeNavStructureSyncOrder;

    #[ORM\ManyToOne(targetEntity: 'OdeNavStructureSync', inversedBy: 'odeNavStructureSyncs')]
    #[ORM\JoinColumn(name: 'ode_nav_structure_sync_id', referencedColumnName: 'id', nullable: true)]
    protected ?self $odeNavStructureSync = null;

    #[ORM\OneToMany(targetEntity: 'OdePagStructureSync', mappedBy: 'odeNavStructureSync', orphanRemoval: true)]
    #[OrderBy(['odePagStructureSyncOrder' => 'ASC'])]
    protected Collection $odePagStructureSyncs;

    #[ORM\OneToMany(targetEntity: self::class, mappedBy: 'odeNavStructureSync', orphanRemoval: true, cascade: ['persist', 'remove'])]
    protected Collection $odeNavStructureSyncs;

    #[ORM\OneToMany(targetEntity: 'OdeNavStructureSyncProperties', mappedBy: 'odeNavStructureSync', orphanRemoval: true, fetch: 'EAGER')]
    protected Collection $odeNavStructureSyncProperties;

    #[ORM\Column(name: 'ode_parent_page_id', type: 'string', length: 20, nullable: true)]
    protected ?string $odeParentPageId = null;

    public function __construct()
    {
        $this->odePagStructureSyncs = new ArrayCollection();
        // Initialize children collection to avoid uninitialized typed property access
        $this->odeNavStructureSyncs = new ArrayCollection();
        $this->odeNavStructureSyncProperties = new ArrayCollection();
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

    public function getOdeParentPageId(): ?string
    {
        return $this->odeParentPageId;
    }

    public function setOdeParentPageId(?string $odeParentPageId): self
    {
        $this->odeParentPageId = $odeParentPageId;

        return $this;
    }

    public function getPageName(): ?string
    {
        return $this->pageName;
    }

    public function setPageName(string $pageName): self
    {
        $this->pageName = $pageName;

        $this->setPropertyTitleNode($pageName);

        return $this;
    }

    public function getOdeNavStructureSyncOrder(): ?int
    {
        return $this->odeNavStructureSyncOrder;
    }

    public function setOdeNavStructureSyncOrder(int $odeNavStructureSyncOrder): self
    {
        $this->odeNavStructureSyncOrder = $odeNavStructureSyncOrder;

        return $this;
    }

    public function getOdeNavStructureSync(): ?self
    {
        return $this->odeNavStructureSync;
    }

    public function setOdeNavStructureSync(?self $odeNavStructureSync): self
    {
        $this->odeNavStructureSync = $odeNavStructureSync;

        return $this;
    }

    /**
     * Return true if it is the first page.
     *
     * @return bool
     */
    public function isIndex()
    {
        return !$this->getOdeParentPageId() && 1 == $this->getOdeNavStructureSyncOrder();
    }

    /**
     * Add odePagStructureSync.
     *
     * @return OdeNavStructureSync
     */
    public function addOdePagStructureSync(OdePagStructureSync $odePagStructureSync)
    {
        $odePagStructureSync->setOdeNavStructureSync($this);
        $this->odePagStructureSyncs[] = $odePagStructureSync;

        return $this;
    }

    /**
     * Remove odePagStructureSync.
     */
    public function removeOdePagStructureSync(OdePagStructureSync $odePagStructureSync)
    {
        $this->odePagStructureSyncs->removeElement($odePagStructureSync);
    }

    /**
     * Get odePagStructureSyncs.
     *
     * @return Collection
     */
    public function getOdePagStructureSyncs()
    {
        return $this->odePagStructureSyncs;
    }

    public function setOdePagStructureSyncs(?Collection $odePagStructureSyncs): self
    {
        if (!empty($odePagStructureSyncs)) {
            $this->odePagStructureSyncs = $odePagStructureSyncs;
        } else {
            $this->odePagStructureSyncs = new ArrayCollection();
        }

        return $this;
    }

    /**
     * Add odeNavStructureSync.
     *
     * @return OdeNavStructureSync
     */
    public function addOdeNavStructureSync(OdeNavStructureSync $odeNavStructureSync)
    {
        $odeNavStructureSync->setOdeNavStructureSync($this);
        $this->odeNavStructureSyncs[] = $odeNavStructureSync;

        return $this;
    }

    /**
     * Remove odeNavStructureSync.
     */
    public function removeOdeNavStructureSync(OdeNavStructureSync $odeNavStructureSync)
    {
        $this->odeNavStructureSyncs->removeElement($odeNavStructureSync);
    }

    /**
     * Get odeNavStructureSyncs.
     *
     * @return Collection
     */
    public function getOdeNavStructureSyncs()
    {
        return $this->odeNavStructureSyncs;
    }

    public function addOdeNavStructureSyncProperties(?OdeNavStructureSyncProperties $odeNavStructureSyncProperties): self
    {
        $odeNavStructureSyncProperties->setOdeNavStructureSync($this);
        $this->odeNavStructureSyncProperties[] = $odeNavStructureSyncProperties;

        return $this;
    }

    public function removeOdeNavStructureSyncProperties(?OdeNavStructureSyncProperties $odeNavStructureSyncProperties): self
    {
        $this->odeNavStructureSyncProperties->removeElement($odeNavStructureSyncProperties);

        return $this;
    }

    public function getOdeNavStructureSyncProperties(): Collection
    {
        return $this->odeNavStructureSyncProperties;
    }

    public function setOdeNavStructureSyncProperties(?Collection $odeNavStructureSyncProperties): self
    {
        if (!empty($odeNavStructureSyncProperties)) {
            $this->odeNavStructureSyncProperties = $odeNavStructureSyncProperties;
        } else {
            $this->odeNavStructureSyncProperties = new ArrayCollection();
        }

        return $this;
    }

    /**
     * Checks if all OdePagStructureSyncProperties are initialized.
     */
    public function areAllOdeNavStructureSyncPropertiesInitialized(): bool
    {
        if ($this->getOdeNavStructureSyncProperties()->count() == count(Properties::ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG)) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Loads OdeNavStructureSyncProperties from database and from config those that aren't in the database.
     *
     * @param array $userPreferences
     */
    public function loadOdeNavStructureSyncPropertiesFromConfig($userPreferences = []): self
    {
        if (!$this->areAllOdeNavStructureSyncPropertiesInitialized()) {
            // check initialized properties
            $initializedProperties = [];
            foreach ($this->getOdeNavStructureSyncProperties() as $odeNavStructureSyncProperties) {
                $initializedProperties[$odeNavStructureSyncProperties->getKey()] = true;
            }

            foreach (Properties::ODE_NAV_STRUCTURE_SYNC_PROPERTIES_CONFIG as $odeNavStructureSyncPropertiesConfigKey => $odeNavStructureSyncPropertiesConfigValues) {
                if (!isset($initializedProperties[$odeNavStructureSyncPropertiesConfigKey])) {
                    // create OdeNavStructureSyncProperties
                    $odeNavStructureSyncProperties = new OdeNavStructureSyncProperties();
                    $odeNavStructureSyncProperties->loadFromPropertiesConfig($this, $odeNavStructureSyncPropertiesConfigKey, $odeNavStructureSyncPropertiesConfigValues);

                    $this->addOdeNavStructureSyncProperties($odeNavStructureSyncProperties);
                }
            }
        }

        return $this;
    }

    /**
     * Changes titleNode property.
     *
     * @param string $pageName
     */
    public function setPropertyTitleNode($pageName)
    {
        foreach ($this->getOdeNavStructureSyncProperties() as $odeNavStructureSyncPropertiesElem) {
            if ($odeNavStructureSyncPropertiesElem->isTitleNode()) {
                $odeNavStructureSyncPropertiesElem->setValue($pageName);
            }
        }
    }

    /**
     * Creates a copy of OdeComponentsSync.
     */
    public function duplicate(): OdeNavStructureSync
    {
        $copy = clone $this;

        if (isset($copy->id)) {
            $copy->id = null;
        }

        $copy->setOdePageId(Util::generateId());

        // $copy->setOdeNavStructureSyncOrder($this->getOdeNavStructureSyncOrder() + 1);

        // copy odePagStructureSyncs
        $copy->setOdePagStructureSyncs(null);

        foreach ($this->getOdePagStructureSyncs() as $odePagStructureSync) {
            $odePagStructureSyncCopy = $odePagStructureSync->duplicate();

            $odePagStructureSyncCopy->setOdePageId($copy->getOdePageId());

            $copy->addOdePagStructureSync($odePagStructureSyncCopy);
        }

        // copy properties
        $copy->setOdeNavStructureSyncProperties(null);

        foreach ($this->getOdeNavStructureSyncProperties() as $odeNavStructureSyncPropertiesElem) {
            $odeNavStructureSyncPropertiesCopy = $odeNavStructureSyncPropertiesElem->duplicate();

            $copy->addOdeNavStructureSyncProperties($odeNavStructureSyncPropertiesCopy);
        }

        return $copy;
    }
}
