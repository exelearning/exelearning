<?php

namespace App\Entity\net\exelearning\Entity;

use App\Constants;
use App\Properties;
use App\Repository\net\exelearning\Repository\OdeComponentsSyncRepository;
use App\Util\net\exelearning\Util\Util;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Table(name: 'ode_components_sync')]
#[ORM\Index(name: 'fk_ode_components_sync_1_idx', columns: ['ode_pag_structure_sync_id'])]
#[ORM\Entity(repositoryClass: OdeComponentsSyncRepository::class)]
class OdeComponentsSync extends BaseEntity
{
    #[ORM\Column(name: 'ode_session_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeSessionId;

    #[ORM\Column(name: 'ode_page_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odePageId;

    #[ORM\Column(name: 'ode_block_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeBlockId;

    #[ORM\Column(name: 'ode_idevice_id', type: 'string', length: 20, nullable: false, options: ['fixed' => true])]
    protected string $odeIdeviceId;

    #[ORM\Column(name: 'ode_idevice_type_name', type: 'string', length: 255, nullable: false)]
    protected string $odeIdeviceTypeName;

    #[ORM\ManyToOne(targetEntity: 'OdePagStructureSync', inversedBy: 'odeComponentsSyncs')]
    #[ORM\JoinColumn(name: 'ode_pag_structure_sync_id', referencedColumnName: 'id')]
    protected OdePagStructureSync $odePagStructureSync;

    #[ORM\Column(name: 'html_view', type: 'text', nullable: true)]
    protected ?string $htmlView = null;

    #[ORM\Column(name: 'json_properties', type: 'text', nullable: true)]
    protected ?string $jsonProperties = null;

    #[ORM\Column(name: 'ode_components_sync_order', type: 'integer', nullable: false)]
    protected int $odeComponentsSyncOrder;

    #[ORM\OneToMany(targetEntity: 'OdeComponentsSyncProperties', mappedBy: 'odeComponentsSync', orphanRemoval: true, fetch: 'EAGER', cascade: ['persist', 'remove'])]
    protected Collection $odeComponentsSyncProperties;

    public function __construct()
    {
        $this->odeComponentsSyncProperties = new ArrayCollection();
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

    public function getOdeIdeviceId(): ?string
    {
        return $this->odeIdeviceId;
    }

    public function setOdeIdeviceId(string $odeIdeviceId): self
    {
        $this->odeIdeviceId = $odeIdeviceId;

        return $this;
    }

    public function getOdeIdeviceTypeName()
    {
        return $this->odeIdeviceTypeName;
    }

    public function setOdeIdeviceTypeName(string $odeIdeviceTypeName)
    {
        $this->odeIdeviceTypeName = $odeIdeviceTypeName;
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

    public function getHtmlView(): ?string
    {
        return $this->htmlView;
    }

    public function setHtmlView(string $htmlView): self
    {
        $this->htmlView = $htmlView;

        return $this;
    }

    public function getJsonProperties(): ?string
    {
        return $this->jsonProperties;
    }

    public function setJsonProperties(string $jsonProperties): self
    {
        $this->jsonProperties = $jsonProperties;

        return $this;
    }

    public function getOdeComponentsSyncOrder(): ?int
    {
        return $this->odeComponentsSyncOrder;
    }

    public function setOdeComponentsSyncOrder(int $odeComponentsSyncOrder): self
    {
        $this->odeComponentsSyncOrder = $odeComponentsSyncOrder;

        return $this;
    }

    public function addOdeComponentsSyncProperties(?OdeComponentsSyncProperties $odeComponentsSyncProperties): self
    {
        $odeComponentsSyncProperties->setOdeComponentsSync($this);
        $this->odeComponentsSyncProperties[] = $odeComponentsSyncProperties;

        return $this;
    }

    public function removeOdeComponentsSyncProperties(?OdeComponentsSyncProperties $odeComponentsSyncProperties): self
    {
        $this->odeComponentsSyncProperties->removeElement($odeComponentsSyncProperties);

        return $this;
    }

    public function getOdeComponentsSyncProperties(): Collection
    {
        return $this->odeComponentsSyncProperties;
    }

    public function setOdeComponentsSyncProperties(?Collection $odeComponentsSyncProperties): self
    {
        if (!empty($odeComponentsSyncProperties)) {
            $this->odeComponentsSyncProperties = $odeComponentsSyncProperties;
        } else {
            $this->odeComponentsSyncProperties = new ArrayCollection();
        }

        return $this;
    }

    /**
     * Returns max order value for all of the siblings of the OdeComponentsSync.
     */
    public function getMaxOrder(): ?int
    {
        $maxOrder = null;

        foreach ($this->getOdePagStructureSync()->getOdeComponentsSyncs() as $odeComponentsSyncSibling) {
            if (!isset($maxOrder)) {
                $maxOrder = $odeComponentsSyncSibling->getOdeComponentsSyncOrder();
            } elseif ($odeComponentsSyncSibling->getOdeComponentsSyncOrder() >= $maxOrder) {
                $maxOrder = $odeComponentsSyncSibling->getOdeComponentsSyncOrder();
            }
        }

        return $maxOrder;
    }

    /**
     * Checks if all OdeComponentsSyncProperties are initialized.
     */
    public function areAllOdeComponentsSyncPropertiesInitialized(): bool
    {
        if ($this->getOdeComponentsSyncProperties()->count() == count(Properties::ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG)) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Loads OdeComponentsSyncProperties from database and from config those that aren't in the database.
     */
    public function loadOdeComponentsSyncPropertiesFromConfig(): self
    {
        if (!$this->areAllOdeComponentsSyncPropertiesInitialized()) {
            // check initialized properties
            $initializedProperties = [];
            foreach ($this->getOdeComponentsSyncProperties() as $odeComponentsSyncProperties) {
                $initializedProperties[$odeComponentsSyncProperties->getKey()] = true;
            }

            foreach (Properties::ODE_COMPONENTS_SYNC_PROPERTIES_CONFIG as $odeComponentsSyncPropertiesConfigKey => $odeComponentsSyncPropertiesConfigValues) {
                if (!isset($initializedProperties[$odeComponentsSyncPropertiesConfigKey])) {
                    // create OdeComponentsSyncProperties
                    $odeComponentsSyncProperties = new OdeComponentsSyncProperties();
                    $odeComponentsSyncProperties->loadFromPropertiesConfig($this, $odeComponentsSyncPropertiesConfigKey, $odeComponentsSyncPropertiesConfigValues);

                    $this->addOdeComponentsSyncProperties($odeComponentsSyncProperties);
                }
            }
        }

        return $this;
    }

    /**
     * Loads OdeComponentsSyncProperties from OdePagStructureSync.
     */
    public function loadOdeComponentsSyncPropertiesFromOdePagStructureSync(): self
    {
        $odePagStructureSync = $this->getOdePagStructureSync();

        if (!empty($odePagStructureSync)) {
            foreach ($this->getOdeComponentsSyncProperties() as $odeComponentsSyncProperty) {
                // If property is heritable
                if ($odeComponentsSyncProperty->isHeritable()) {
                    foreach ($odePagStructureSync->getOdePagStructureSyncProperties() as $odePagStructureSyncProperty) {
                        // if odePagStructureSyncProperty is saved and key is the same
                        if (
                            ((!empty($odePagStructureSyncProperty->getId())) || ((empty($odePagStructureSync->getId())) && (empty($odePagStructureSyncProperty->getId()))))
                            && ($odeComponentsSyncProperty->getkey() == $odePagStructureSyncProperty->getKey())
                        ) {
                            $odeComponentsSyncProperty->setValue($odePagStructureSyncProperty->getValue());
                        }
                    }
                }
            }
        }

        return $this;
    }

    /**
     * Creates a copy of OdeComponentsSync.
     *
     * This method clones the current instance and generates a new unique ID for the copy.
     * It also updates the HTML view and duplicates all associated properties.
     *
     * @return OdeComponentsSync a new instance with duplicated data
     */
    public function duplicate(): OdeComponentsSync
    {
        $copy = clone $this;

        // Reset the ID if it exists, to ensure uniqueness
        if (isset($copy->id)) {
            $copy->id = null;
        }

        // Generate a new unique ID for the duplicated object
        $copy->setOdeIdeviceId(Util::generateId());

        // Update the HTML view with the new ID
        $copyHtmlView = $copy->getHtmlView();
        $copyHtmlView = str_replace($this->getOdeIdeviceId(), $copy->getOdeIdeviceId(), $copyHtmlView);

        $copy->setHtmlView($copyHtmlView);

        // Reset the property collection
        $copy->odeComponentsSyncProperties = new ArrayCollection();

        // Clone and associate each property with the new OdeComponentsSync instance
        foreach ($this->getOdeComponentsSyncProperties() as $property) {
            $propertyCopy = clone $property;
            $propertyCopy->setOdeComponentsSync($copy); // Critical assignment!
            $copy->addOdeComponentsSyncProperties($propertyCopy);
        }

        return $copy;
    }

    /**
     * Replace ODE old format internal links.
     *
     * @param string $fullPathPag
     */
    public function replaceOldInternalLinks($fullPathPag): bool
    {
        $prefixPageNodeLink = Constants::IDEVICE_NODE_LINK_NAME_IN_EXE;
        $html = $this->htmlView;
        $json = $this->jsonProperties;
        $linksHref = [];
        preg_match_all('/<a\s+[^>]*href=(["\'])(.*?)\1[^>]*>/i', $html, $matches);
        if (isset($matches[2]) && !empty($matches[2])) {
            $linksHref = $matches[2];
        }
        foreach ($linksHref as $originalLinkHref) {
            if (str_starts_with($originalLinkHref, $prefixPageNodeLink)) {
                $cleanedLinkHref = str_replace('#auto_top', '', $originalLinkHref);
                $cleanedLinkHref = urldecode($cleanedLinkHref);
                $pathOnly = str_replace($prefixPageNodeLink, '', $cleanedLinkHref);
                $estnodes = explode(':', $pathOnly);
                if (count($estnodes) > 1) {
                    array_shift($estnodes);
                    $pathOnly = implode(':', $estnodes);
                }
                if (isset($fullPathPag[$pathOnly])) {
                    $newId = $fullPathPag[$pathOnly];
                    $newFormattedLink = $prefixPageNodeLink.$newId;
                    if (null !== $this->htmlView) {
                        $this->htmlView = str_replace($originalLinkHref, $newFormattedLink, $this->htmlView);
                    }
                    if (null !== $this->jsonProperties) {
                        $this->jsonProperties = str_replace($originalLinkHref, $newFormattedLink, $this->jsonProperties);
                    }
                }
            }
        }

        return true;
    }

    /**
     * Replace resource urls.
     *
     * @param string $ideviceNewId
     * @param array  $ideviceResourcesMapping
     * @param array  $filemanagerResourcesMapping
     * @param array  $pagesFileData
     * @param array  $userPreferencesDtos
     * @param string $elpFileName
     * @param string $resourcesPrefix
     * @param string $exportType
     * @param string $isIndex
     *
     * @return void
     */
    public function replaceLinksHtml(
        $ideviceNewId,
        $ideviceResourcesMapping,
        $filemanagerResourcesMapping,
        $pagesFileData,
        $userPreferencesDtos,
        $elpFileName,
        $resourcesPrefix,
        $exportType,
        $isIndex,
    ) {
        // Replace idevice resources links
        $this->replaceIdeviceResourcesLinks(
            $ideviceNewId,
            $ideviceResourcesMapping,
            $resourcesPrefix
        );

        // Replace filemanager resources links
        $this->replaceFilemanagerResourcesLinks(
            $filemanagerResourcesMapping,
            $resourcesPrefix
        );

        // Replace "exe-package:elp-name"
        if (null !== $this->htmlView) {
            $this->htmlView = str_replace(Constants::IDEVICE_ELP_NAME_IN_EXE, $elpFileName, $this->htmlView);
        }
        // Replace "exe-package:elp"
        $elpLinkUrl = $resourcesPrefix.str_replace(' ', '%20', $elpFileName);
        if (null !== $this->htmlView) {
            $this->htmlView = str_replace(Constants::IDEVICE_ELP_LINK_IN_EXE, $elpLinkUrl, $this->htmlView);
        }
        // Replace "exe-node"
        $prefixPageNodeLink = Constants::IDEVICE_NODE_LINK_NAME_IN_EXE;
        if (null !== $this->htmlView) {
            if (str_contains($this->htmlView, $prefixPageNodeLink)) {
                foreach ($pagesFileData as $key => $data) {
                    $pageLinkString = $prefixPageNodeLink.$key;
                    if (str_contains($this->htmlView, $pageLinkString)) {
                        if (Constants::EXPORT_TYPE_HTML5_SP == $exportType) {
                            $pageUrl = '#page-content-'.$key;
                        } else {
                            if (!$isIndex) {
                                $pageUrl = '..'.Constants::SLASH.$data['fileUrl'];
                            } else {
                                $pageUrl = $data['fileUrl'];
                            }
                        }

                        $this->htmlView = str_replace($pageLinkString, $pageUrl, $this->htmlView);
                    }
                }
            }
        }
    }

    /**
     * Replace idevice resources links.
     *
     * @param string $ideviceNewId
     * @param array  $ideviceResourcesMapping
     * @param string $resourcesPrefix
     *
     * @return void
     */
    public function replaceIdeviceResourcesLinks(
        $ideviceNewId,
        $ideviceResourcesMapping,
        $resourcesPrefix,
    ) {
        $srcFilesTmp = Constants::FILES_DIR_NAME.Constants::SLASH.Constants::TEMPORARY_CONTENT_STORAGE_DIRECTORY;

        // - Idevice old resources url
        $odeSessionId = $this->getOdeSessionId();
        $ideviceId = $this->getOdeIdeviceId();
        $ideviceResourceUrl = self::getIdeviceResourcesUrl($odeSessionId, $ideviceId);
        $srcResourceOld = $srcFilesTmp.Constants::SLASH.$ideviceResourceUrl;

        // - Idevice new resources url
        $exportIdeviceSrcParamFile = Constants::PERMANENT_SAVE_CONTENT_DIRNAME.Constants::SLASH.
            Constants::PERMANENT_SAVE_CONTENT_RESOURCES_DIRNAME.Constants::SLASH.$ideviceNewId;
        $srcResourceNew = $resourcesPrefix.$exportIdeviceSrcParamFile;

        // - Replace filepaths in idevice html
        if (null !== $this->htmlView) {
            $this->htmlView = str_replace($srcResourceOld, $srcResourceNew, $this->htmlView);
        }
        if (null !== $this->jsonProperties) {
            $this->jsonProperties = str_replace($srcResourceOld, $srcResourceNew, $this->jsonProperties);
        }
    }

    /**
     * Replace filemanager resources links.
     *
     * @param array  $filemanagerResourcesMapping
     * @param string $resourcesPrefix
     *
     * @return void
     */
    public function replaceFilemanagerResourcesLinks(
        $filemanagerResourcesMapping,
        $resourcesPrefix,
    ) {
        // Replace filemanager files
        $srcFilesTmp = Constants::FILES_DIR_NAME.Constants::SLASH.Constants::TEMPORARY_CONTENT_STORAGE_DIRECTORY;

        // - Filemanager old resources url
        $filemanagerSrcUrl = $srcFilesTmp.Constants::SLASH.self::getFileManagerResourcesUrl();

        // - Filemanager new resources url
        $exportFilemanagerSrcParamFile = Constants::PERMANENT_SAVE_CUSTOM_FILES_DIRNAME;
        $exportFilemanagerSrcUrl = $resourcesPrefix.$exportFilemanagerSrcParamFile;

        // - Replace filepaths in idevice html
        $srcFilemanagerResourceOld = $filemanagerSrcUrl;
        $srcFilemanagerResourceNew = $exportFilemanagerSrcUrl;
        if (null !== $this->htmlView) {
            $this->htmlView = str_replace($srcFilemanagerResourceOld, $srcFilemanagerResourceNew, $this->htmlView);
        }
    }

    /**
     * Get idevice resources url.
     *
     * @return string
     */
    public function getIdeviceResourcesUrl()
    {
        $odeSessionId = $this->getOdeSessionId();
        $ideviceId = $this->getOdeIdeviceId();

        $idevicesResourcesUrl = self::getExportResourcesUrl($odeSessionId).Constants::SLASH.$ideviceId;

        return $idevicesResourcesUrl;
    }

    /**
     * Get filemanager resources url.
     *
     * @return string
     */
    public function getFileManagerResourcesUrl()
    {
        $filemanagerResourcesUrl = self::getExportResourcesUrl().Constants::SLASH.Constants::FILEMANAGER_DIRECTORY;

        return $filemanagerResourcesUrl;
    }

    /**
     * Get resources url.
     *
     * @return string
     */
    public function getExportResourcesUrl()
    {
        $odeSessionId = $this->getOdeSessionId();

        $year = substr($odeSessionId, 0, 4);
        $month = substr($odeSessionId, 4, 2);
        $day = substr($odeSessionId, 6, 2);

        $resourcesUrl = $year.Constants::SLASH.$month.Constants::SLASH.$day.Constants::SLASH.$odeSessionId;

        return $resourcesUrl;
    }
}
