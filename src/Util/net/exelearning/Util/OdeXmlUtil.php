<?php

namespace App\Util\net\exelearning\Util;

use App\Constants;
use App\Entity\net\exelearning\Dto\Internal\OdeSaveDto;
use App\Entity\net\exelearning\Dto\OdeResourcesDto;
use App\Entity\net\exelearning\Dto\UserPreferencesDto;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdeComponentsSyncProperties;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\OdeNavStructureSyncProperties;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSyncProperties;
use App\Entity\net\exelearning\Entity\OdePropertiesSync;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlCaseStudyIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlDropdownIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlExternalUrlIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlFileAttachIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlFillIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlFpdFillSecondTypeIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlFpdSolvedExerciseIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlFreeTextIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlGalleryImageIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlGenericIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlImageMagnifierIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlJavaAppIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlMultipleAnswerIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlMultipleSelectionIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlRssIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlScormTestIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlTrueFalseIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlIdevices\OdeOldXmlWikipediaIdevice;
use App\Util\net\exelearning\Util\OdeOldXmlProperties\OdeOldXmlPropertiesGet;

/**
 * OdeXmlUtil.
 *
 * Utility functions for working with xml of Odes
 */
class OdeXmlUtil
{
    // Xml tags
    public const ODE_XML_TAG_ROOT = 'ode';
    public const ODE_XML_TAG_USER_PREFERENCES = 'userPreferences';
    public const ODE_XML_TAG_PROPERTIES = 'odeProperties';
    public const ODE_XML_TAG_RESOURCES = 'odeResources';

    // Entities
    public const ODE_XML_TAG_USER_PREFERENCE = 'userPreference';
    public const ODE_XML_TAG_ODE_PROPERTY = 'odeProperty';
    public const ODE_XML_TAG_ODE_RESOURCE = 'odeResource';
    public const ODE_XML_TAG_ODE_NAV_STRUCTURES = 'odeNavStructures';
    public const ODE_XML_TAG_ODE_NAV_STRUCTURE = 'odeNavStructure';
    public const ODE_XML_TAG_ODE_PAG_STRUCTURES = 'odePagStructures';
    public const ODE_XML_TAG_ODE_PAG_STRUCTURE = 'odePagStructure';
    public const ODE_XML_TAG_ODE_COMPONENTS = 'odeComponents';
    public const ODE_XML_TAG_ODE_COMPONENT = 'odeComponent';
    public const ODE_XML_TAG_ODE_NAV_STRUCTURE_PROPERTIES = 'odeNavStructureProperties';
    public const ODE_XML_TAG_ODE_NAV_STRUCTURE_PROPERTY = 'odeNavStructureProperty';
    public const ODE_XML_TAG_ODE_PAG_STRUCTURE_PROPERTIES = 'odePagStructureProperties';
    public const ODE_XML_TAG_ODE_PAG_STRUCTURE_PROPERTY = 'odePagStructureProperty';
    public const ODE_XML_TAG_ODE_COMPONENTS_PROPERTIES = 'odeComponentsProperties';
    public const ODE_XML_TAG_ODE_COMPONENTS_PROPERTY = 'odeComponentsProperty';

    // Fields
    public const ODE_XML_TAG_FIELD_ODE_VERSION_NAME = 'odeVersionName';
    public const ODE_XML_TAG_FIELD_ODE_VERSION_ID = 'odeVersionId';
    public const ODE_XML_TAG_FIELD_ODE_SESSION_ID = 'odeSessionId';
    public const ODE_XML_TAG_FIELD_ODE_PAGE_ID = 'odePageId';
    public const ODE_XML_TAG_FIELD_ODE_BLOCK_ID = 'odeBlockId';
    public const ODE_XML_TAG_FIELD_ODE_IDEVICE_ID = 'odeIdeviceId';
    public const ODE_XML_TAG_FIELD_ODE_IDEVICE_TYPE_NAME = 'odeIdeviceTypeName';
    public const ODE_XML_TAG_FIELD_ODE_PARENT_PAGE_ID = 'odeParentPageId';
    public const ODE_XML_TAG_FIELD_PAGE_NAME = 'pageName';
    public const ODE_XML_TAG_FIELD_ODE_NAV_STRUCTURE_ORDER = 'odeNavStructureOrder';
    public const ODE_XML_TAG_FIELD_BLOCK_NAME = 'blockName';
    public const ODE_XML_TAG_FIELD_ICON_NAME = 'iconName';
    public const ODE_XML_TAG_FIELD_ODE_PAG_STRUCTURE_ORDER = 'odePagStructureOrder';
    public const ODE_XML_TAG_FIELD_HTML_VIEW = 'htmlView';
    public const ODE_XML_TAG_FIELD_JSON_PROPERTIES = 'jsonProperties';
    public const ODE_XML_TAG_FIELD_ODE_COMPONENTS_ORDER = 'odeComponentsOrder';
    public const ODE_XML_TAG_FIELD_KEY = 'key';
    public const ODE_XML_TAG_FIELD_VALUE = 'value';
    public const ODE_XML_TAG_ODE_COMPONENTS_RESOURCES = 'odeComponentsResources';

    // Replacement values
    public const ODE_XML_CONTEXT_PATH = '{{context_path}}';
    public const ODE_XML_EXE_NODE_LINK_PREFIX = 'exe-node:';

    // Old Xml tags
    public const OLD_ODE_XML_TAG_ROOT = 'instance xmlns="http://www.exelearning.org/content/v0.2"';

    // Old Xml idevice content
    public const OLD_ODE_XML_INSTANCE = 'instance';
    public const OLD_ODE_XML_DICTIONARY = 'dictionary';
    public const OLD_ODE_XML_LIST = 'list';
    public const OLD_ODE_XML_UNICODE = 'unicode';
    public const OLD_ODE_XML_ATTRIBUTES = '@attributes';
    // const OLD_ODE_XML_IDEVICE_TEXT = 'instance';
    public const OLD_ODE_XML_IDEVICE_TEXT_CONTENT = 'string role="key" value="content_w_resourcePaths"';

    /**
     * Generates xml of an ode.
     *
     * @param string $odeSessionId
     * @param array  $odeNavStructureSyncs
     * @param object $odeProperties
     * @param array  $odeData
     * @param object $userPreferencesDtos
     *
     * @return SimpleXMLElement
     */
    public static function createOdeXml(
        $odeSessionId,
        $odeNavStructureSyncs,
        $odeProperties,
        $odeData,
        $userPreferencesDtos,
    ) {
        $sessionPath = null;

        if (!empty($odeSessionId)) {
            $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
        }

        // Common replaces for all OdeComponents
        $commonReplaces = [
            $sessionPath => self::ODE_XML_CONTEXT_PATH.Constants::SLASH,
        ];

        $generatedIds = []; // ids array to avoid duplicates
        $odeNavStructuresMapping = []; // OdePageId mapping to maintain OdeParentPageId
        $odeComponentsMapping = []; // OdeIdeviceId to rename dirs

        // Generate new id
        // $newOdeVersionId = Util::generateIdCheckUnique($generatedIds);
        // $generatedIds[] = $newOdeVersionId;

        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="utf-8" ?><'.
                self::ODE_XML_TAG_ROOT.'></'.self::ODE_XML_TAG_ROOT.'>'
        );

        if (!empty($userPreferencesDtos)) {
            $xmlUserPreferencesDtos = $xml->addChild(self::ODE_XML_TAG_USER_PREFERENCES);
            foreach ($userPreferencesDtos as $userPreference) {
                if ('theme' == $userPreference->getKey()) {
                    $xmlOdeProperty = $xmlUserPreferencesDtos->addChild(self::ODE_XML_TAG_USER_PREFERENCE);
                    $xmlOdeProperty->addChild(
                        self::ODE_XML_TAG_FIELD_KEY,
                        self::prepareText($userPreference->getKey())
                    );
                    $xmlOdeProperty->addChild(
                        self::ODE_XML_TAG_FIELD_VALUE,
                        self::prepareText($userPreference->getValue())
                    );
                }
            }
        }

        if (!empty($odeData)) {
            $xmlOdeResources = $xml->addChild(self::ODE_XML_TAG_RESOURCES);
            foreach ($odeData as $key => $value) {
                $xmlOdeResource = $xmlOdeResources->addChild(self::ODE_XML_TAG_ODE_RESOURCE);
                $xmlOdeResource->addChild(
                    self::ODE_XML_TAG_FIELD_KEY,
                    self::prepareText($key)
                );
                $xmlOdeResource->addChild(
                    self::ODE_XML_TAG_FIELD_VALUE,
                    self::prepareText($value)
                );
            }
        }

        if (!empty($odeProperties)) {
            $xmlOdeProperties = $xml->addChild(self::ODE_XML_TAG_PROPERTIES);
            foreach ($odeProperties as $odeProperty) {
                $xmlOdeProperty = $xmlOdeProperties->addChild(self::ODE_XML_TAG_ODE_PROPERTY);
                $xmlOdeProperty->addChild(
                    self::ODE_XML_TAG_FIELD_KEY,
                    self::prepareText($odeProperty->getKey())
                );
                $xmlOdeProperty->addChild(
                    self::ODE_XML_TAG_FIELD_VALUE,
                    self::prepareText($odeProperty->getValue())
                );
            }
        }

        // OdeNavStructureSyncs
        $xmlOdeNavStructures = $xml->addChild(self::ODE_XML_TAG_ODE_NAV_STRUCTURES);

        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            // Generate new ids
            if (isset($odeNavStructuresMapping[$odeNavStructureSync->getOdePageId()])) {
                $newOdePageId = $odeNavStructuresMapping[$odeNavStructureSync->getOdePageId()];
            } else {
                $newOdePageId = Util::generateIdCheckUnique($generatedIds);
                $generatedIds[] = $newOdePageId;
                $odeNavStructuresMapping[$odeNavStructureSync->getOdePageId()] = $newOdePageId;
            }

            $newParentPageId = null;
            if (!empty($odeNavStructureSync->getOdeParentPageId())) {
                if (isset($odeNavStructuresMapping[$odeNavStructureSync->getOdeParentPageId()])) {
                    $newParentPageId = $odeNavStructuresMapping[$odeNavStructureSync->getOdeParentPageId()];
                } else {
                    $newParentPageId = Util::generateIdCheckUnique($generatedIds);
                    $generatedIds[] = $newParentPageId;
                    $odeNavStructuresMapping[$odeNavStructureSync->getOdeParentPageId()] = $newParentPageId;
                }
            }

            // OdeNavStructureSync
            $xmlOdeNavStructure = $xmlOdeNavStructures->addChild(self::ODE_XML_TAG_ODE_NAV_STRUCTURE);

            // OdeNavStructureSync fields
            // $xmlOdeNavStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_VERSION_ID, $newOdeVersionId);
            // $xmlOdeNavStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_SESSION_ID, $odeNavStructureSync->getOdeSessionId());
            $xmlOdeNavStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_PAGE_ID, $newOdePageId);
            $xmlOdeNavStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_PARENT_PAGE_ID, $newParentPageId);
            $xmlOdeNavStructure->addChild(self::ODE_XML_TAG_FIELD_PAGE_NAME, self::prepareText($odeNavStructureSync->getPageName()));
            $xmlOdeNavStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_NAV_STRUCTURE_ORDER, $odeNavStructureSync->getOdeNavStructureSyncOrder());

            // OdeNavStructureSync properties
            $xmlOdeNavStructureProperties = $xmlOdeNavStructure->addChild(self::ODE_XML_TAG_ODE_NAV_STRUCTURE_PROPERTIES);

            foreach ($odeNavStructureSync->getOdeNavStructureSyncProperties() as $odeNavStructureSyncProperty) {
                // OdeNavStructureSync property
                $xmlOdeNavStructureProperty = $xmlOdeNavStructureProperties->addChild(self::ODE_XML_TAG_ODE_NAV_STRUCTURE_PROPERTY);

                // OdeNavStructureSync property fields
                $xmlOdeNavStructureProperty->addChild(self::ODE_XML_TAG_FIELD_KEY, self::prepareText($odeNavStructureSyncProperty->getKey()));
                $xmlOdeNavStructureProperty->addChild(self::ODE_XML_TAG_FIELD_VALUE, self::prepareText($odeNavStructureSyncProperty->getValue()));
            }

            // OdePagStructureSyncs
            $xmlOdePagStructures = $xmlOdeNavStructure->addChild(self::ODE_XML_TAG_ODE_PAG_STRUCTURES);

            foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                // Generate new id
                $newOdeBlockId = Util::generateIdCheckUnique($generatedIds);
                $generatedIds[] = $newOdeBlockId;

                // OdePagStructureSync
                $xmlOdePagStructure = $xmlOdePagStructures->addChild(self::ODE_XML_TAG_ODE_PAG_STRUCTURE);

                // OdePagStructureSync fields
                // $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_VERSION_ID, $newOdeVersionId);
                // $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_SESSION_ID, $odePagStructureSync->getOdeSessionId());
                $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_PAGE_ID, $newOdePageId);
                $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_BLOCK_ID, $newOdeBlockId);
                $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_BLOCK_NAME, self::prepareText($odePagStructureSync->getBlockName()));
                $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_ICON_NAME, self::prepareText($odePagStructureSync->getIconName()));
                $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_PAG_STRUCTURE_ORDER, $odePagStructureSync->getOdePagStructureSyncOrder());

                // OdePagStructureSync properties
                $xmlOdePagStructureProperties = $xmlOdePagStructure->addChild(self::ODE_XML_TAG_ODE_PAG_STRUCTURE_PROPERTIES);

                foreach ($odePagStructureSync->getOdePagStructureSyncProperties() as $odePagStructureSyncProperty) {
                    // OdePagStructureSync property
                    $xmlOdePagStructureProperty = $xmlOdePagStructureProperties->addChild(self::ODE_XML_TAG_ODE_PAG_STRUCTURE_PROPERTY);

                    // OdePagStructureSync property fields
                    $xmlOdePagStructureProperty->addChild(self::ODE_XML_TAG_FIELD_KEY, self::prepareText($odePagStructureSyncProperty->getKey()));
                    $xmlOdePagStructureProperty->addChild(self::ODE_XML_TAG_FIELD_VALUE, self::prepareText($odePagStructureSyncProperty->getValue()));
                }

                // OdeComponentsSyncs
                $xmlOdeComponents = $xmlOdePagStructure->addChild(self::ODE_XML_TAG_ODE_COMPONENTS);

                foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                    // Generate new id
                    $newOdeIdeviceId = Util::generateIdCheckUnique($generatedIds);
                    $generatedIds[] = $newOdeIdeviceId;
                    $odeComponentsMapping[$odeComponentsSync->getOdeIdeviceId()] = $newOdeIdeviceId;

                    // OdeComponentsSync
                    $xmlOdeComponent = $xmlOdeComponents->addChild(self::ODE_XML_TAG_ODE_COMPONENT);

                    // OdeComponentsSync fields
                    // $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_VERSION_ID, $newOdeVersionId);
                    // $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_SESSION_ID, $odeComponentsSync->getOdeSessionId());
                    $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_PAGE_ID, $newOdePageId);
                    $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_BLOCK_ID, $newOdeBlockId);
                    $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_IDEVICE_ID, $newOdeIdeviceId);
                    $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_IDEVICE_TYPE_NAME, $odeComponentsSync->getOdeIdeviceTypeName());

                    // Prepare replaces for this OdeComponent
                    if (!empty($sessionPath)) {
                        // Resources path replaces
                        $currentReplaces = [
                            $odeComponentsSync->getOdeIdeviceId() => $newOdeIdeviceId,
                        ];
                        $replacesToApply = array_merge($commonReplaces, $currentReplaces);
                    }

                    if (isset($replacesToApply)) {
                        $odeComponentsSyncHtmlView = self::applyReplaces($replacesToApply, $odeComponentsSync->getHtmlView());
                    } else {
                        $odeComponentsSyncHtmlView = $odeComponentsSync->getHtmlView();
                    }

                    $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_HTML_VIEW, self::prepareText($odeComponentsSyncHtmlView));

                    if (isset($replacesToApply)) {
                        $odeComponentsSyncJsonProperties = self::applyReplaces($replacesToApply, $odeComponentsSync->getJsonProperties());
                    } else {
                        $odeComponentsSyncJsonProperties = $odeComponentsSync->getJsonProperties();
                    }
                    $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_JSON_PROPERTIES, self::prepareText($odeComponentsSyncJsonProperties));

                    $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_COMPONENTS_ORDER, $odeComponentsSync->getOdeComponentsSyncOrder());

                    // OdeComponentsSync properties
                    $xmlOdeComponentProperties = $xmlOdeComponent->addChild(self::ODE_XML_TAG_ODE_COMPONENTS_PROPERTIES);

                    foreach ($odeComponentsSync->getOdeComponentsSyncProperties() as $odeComponentsSyncProperty) {
                        // OdeComponentsSync property
                        $xmlOdeComponentProperty = $xmlOdeComponentProperties->addChild(self::ODE_XML_TAG_ODE_COMPONENTS_PROPERTY);

                        // OdeComponentsSync property fields
                        $xmlOdeComponentProperty->addChild(self::ODE_XML_TAG_FIELD_KEY, self::prepareText($odeComponentsSyncProperty->getKey()));
                        $xmlOdeComponentProperty->addChild(self::ODE_XML_TAG_FIELD_VALUE, self::prepareText($odeComponentsSyncProperty->getValue()));
                    }
                }
            }
        }

        // eXe node links id replace
        foreach ($xml->xpath('//'.self::ODE_XML_TAG_ODE_COMPONENT) as $xmlOdeComponent) {
            foreach ($odeNavStructuresMapping as $oldPageId => $newPageId) {
                $oldExeNodeLink = self::ODE_XML_EXE_NODE_LINK_PREFIX.$oldPageId;
                $newExeNodeLink = self::ODE_XML_EXE_NODE_LINK_PREFIX.$newPageId;
                $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_HTML_VIEW} = str_replace(
                    $oldExeNodeLink,
                    $newExeNodeLink,
                    $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_HTML_VIEW}
                );
                $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_JSON_PROPERTIES} = str_replace(
                    $oldExeNodeLink,
                    $newExeNodeLink,
                    $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_JSON_PROPERTIES}
                );
            }
        }

        $odeSaveDto = new OdeSaveDto();
        $odeSaveDto->setXml($xml);
        $odeSaveDto->setOdeComponentsMapping($odeComponentsMapping);

        return $odeSaveDto;
    }

    /**
     * Generates xml of an ode.
     *
     * @param string $odeSessionId
     * @param array  $odeNavStructureSyncs
     * @param object $odeProperties
     * @param array  $odeData
     * @param object $userPreferencesDtos
     *
     * @return SimpleXMLElement
     */
    public static function createPropertiesXml(
        $odeSessionId,
        $odeNavStructureSyncs,
        $odeProperties,
        $odeData,
        $userPreferencesDtos,
    ) {
        $sessionPath = null;

        if (!empty($odeSessionId)) {
            $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
        }

        // Common replaces for all OdeComponents
        $commonReplaces = [
            $sessionPath => self::ODE_XML_CONTEXT_PATH.Constants::SLASH,
        ];

        $generatedIds = []; // ids array to avoid duplicates
        $odeNavStructuresMapping = []; // OdePageId mapping to maintain OdeParentPageId
        $odeComponentsMapping = []; // OdeIdeviceId to rename dirs

        // Generate new id
        // $newOdeVersionId = Util::generateIdCheckUnique($generatedIds);
        // $generatedIds[] = $newOdeVersionId;

        $xml = new \SimpleXMLElement(
            '<?xml version="1.0" encoding="utf-8" ?><'.
                self::ODE_XML_TAG_ROOT.'></'.self::ODE_XML_TAG_ROOT.'>'
        );

        if (!empty($odeProperties)) {
            $xmlOdeProperties = $xml->addChild(self::ODE_XML_TAG_PROPERTIES);
            foreach ($odeProperties as $odeProperty) {
                $xmlOdeProperty = $xmlOdeProperties->addChild(self::ODE_XML_TAG_ODE_PROPERTY);
                $xmlOdeProperty->addChild(
                    self::ODE_XML_TAG_FIELD_KEY,
                    self::prepareText($odeProperty->getKey())
                );
                $xmlOdeProperty->addChild(
                    self::ODE_XML_TAG_FIELD_VALUE,
                    self::prepareText($odeProperty->getValue())
                );
            }
        }

        $odeSaveDto = new OdeSaveDto();
        $odeSaveDto->setXml($xml);
        $odeSaveDto->setOdeComponentsMapping($odeComponentsMapping);

        return $odeSaveDto;
    }

    /**
     * Generates xml of odeComponents.
     *
     * @param string $odeSessionId
     *
     * @return \SimpleXMLElement
     */
    public static function createOdeComponentsXml($odeSessionId, $odePagStructureSync, $odeComponentsSyncs)
    {
        $sessionPath = null;
        $isOdeComponents = 'true';

        if (!empty($odeSessionId)) {
            $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
        }

        $odeComponentsMapping = []; // OdeIdeviceId to rename dirs

        $xml = new \SimpleXMLElement('<?xml version="1.0" encoding="utf-8" ?><'.self::ODE_XML_TAG_ROOT.'></'.self::ODE_XML_TAG_ROOT.'>');

        // Put OdeComponentsResources in OdeResources
        $xmlOdeResources = $xml->addChild(self::ODE_XML_TAG_RESOURCES);
        $xmlOdeResource = $xmlOdeResources->addChild(self::ODE_XML_TAG_ODE_RESOURCE);
        $xmlOdeResource->addChild(self::ODE_XML_TAG_FIELD_KEY, self::ODE_XML_TAG_ODE_COMPONENTS_RESOURCES);
        $xmlOdeResource->addChild(self::ODE_XML_TAG_FIELD_VALUE, $isOdeComponents);

        // OdePagStructureSyncs
        $xmlOdePagStructures = $xml->addChild(self::ODE_XML_TAG_ODE_PAG_STRUCTURES);

        // OdePagStructureSync
        $xmlOdePagStructure = $xmlOdePagStructures->addChild(self::ODE_XML_TAG_ODE_PAG_STRUCTURE);

        // OdePagStructureSync fields
        // $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_VERSION_ID, $newOdeVersionId);
        // $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_SESSION_ID, $odePagStructureSync->getOdeSessionId());
        // $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_PAGE_ID, $newOdePageId);
        $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_BLOCK_ID, self::prepareText($odePagStructureSync->getOdeBlockId()));
        $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_BLOCK_NAME, self::prepareText($odePagStructureSync->getBlockName()));
        $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_ICON_NAME, self::prepareText($odePagStructureSync->getIconName()));
        $xmlOdePagStructure->addChild(self::ODE_XML_TAG_FIELD_ODE_PAG_STRUCTURE_ORDER, $odePagStructureSync->getOdePagStructureSyncOrder());

        // OdePagStructureSync properties
        $xmlOdePagStructureProperties = $xmlOdePagStructure->addChild(self::ODE_XML_TAG_ODE_PAG_STRUCTURE_PROPERTIES);

        foreach ($odePagStructureSync->getOdePagStructureSyncProperties() as $odePagStructureSyncProperty) {
            // OdePagStructureSync property
            $xmlOdePagStructureProperty = $xmlOdePagStructureProperties->addChild(self::ODE_XML_TAG_ODE_PAG_STRUCTURE_PROPERTY);

            // OdePagStructureSync property fields
            $xmlOdePagStructureProperty->addChild(self::ODE_XML_TAG_FIELD_KEY, self::prepareText($odePagStructureSyncProperty->getKey()));
            $xmlOdePagStructureProperty->addChild(self::ODE_XML_TAG_FIELD_VALUE, self::prepareText($odePagStructureSyncProperty->getValue()));
        }

        // OdeComponentsSyncs
        $xmlOdeComponents = $xmlOdePagStructure->addChild(self::ODE_XML_TAG_ODE_COMPONENTS);

        foreach ($odeComponentsSyncs as $odeComponentsSync) {
            // Generate new id
            $odeComponentsMapping[$odeComponentsSync->getOdeIdeviceId()] = $odeComponentsSync->getOdeIdeviceId();

            // OdeComponentsSync
            $xmlOdeComponent = $xmlOdeComponents->addChild(self::ODE_XML_TAG_ODE_COMPONENT);

            // OdeComponentsSync fields
            // $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_VERSION_ID, $newOdeVersionId);
            $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_SESSION_ID, $odeComponentsSync->getOdeSessionId());
            $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_PAGE_ID, $odePagStructureSync->getOdePageId());
            $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_BLOCK_ID, $odeComponentsSync->getOdeBlockId());
            $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_IDEVICE_ID, $odeComponentsSync->getOdeIdeviceId());
            $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_IDEVICE_TYPE_NAME, $odeComponentsSync->getOdeIdeviceTypeName());

            $odeComponentsSyncHtmlView = $odeComponentsSync->getHtmlView();
            $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_HTML_VIEW, self::prepareText($odeComponentsSyncHtmlView));

            $odeComponentsSyncJsonProperties = $odeComponentsSync->getJsonProperties();
            $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_JSON_PROPERTIES, self::prepareText($odeComponentsSyncJsonProperties));

            $xmlOdeComponent->addChild(self::ODE_XML_TAG_FIELD_ODE_COMPONENTS_ORDER, $odeComponentsSync->getOdeComponentsSyncOrder());

            // OdeComponentsSync properties
            $xmlOdeComponentProperties = $xmlOdeComponent->addChild(self::ODE_XML_TAG_ODE_COMPONENTS_PROPERTIES);

            foreach ($odeComponentsSync->getOdeComponentsSyncProperties() as $odeComponentsSyncProperty) {
                // OdeComponentsSync property
                $xmlOdeComponentProperty = $xmlOdeComponentProperties->addChild(self::ODE_XML_TAG_ODE_COMPONENTS_PROPERTY);

                // OdeComponentsSync property fields
                $xmlOdeComponentProperty->addChild(self::ODE_XML_TAG_FIELD_KEY, self::prepareText($odeComponentsSyncProperty->getKey()));
                $xmlOdeComponentProperty->addChild(self::ODE_XML_TAG_FIELD_VALUE, self::prepareText($odeComponentsSyncProperty->getValue()));
            }
        }

        $odeSaveDto = new OdeSaveDto();
        $odeSaveDto->setXml($xml);
        $odeSaveDto->setOdeComponentsMapping($odeComponentsMapping);

        return $odeSaveDto;
    }

    /**
     * Prepares text to be added to xml.
     *
     * @param string $text
     *
     * @return string
     */
    private static function prepareText($text)
    {
        if (is_null($text)) {
            return null;
        }

        return htmlspecialchars($text);
    }

    /**
     * Process the xml of an Ode.
     *
     * @param string $odeSessionId
     * @param string $elpContentFileContent
     *
     * @return OdeNavStructureSync[]
     */
    public static function readOdeXml($odeSessionId, $elpContentFileContent)
    {
        // Initialize response arrays
        $odeResponse = [];
        $odeResponse['userPreferences'] = [];
        $odeResponse['odeResources'] = [];
        $odeResponse['odeProperties'] = [];
        $odeResponse['odeNavStructureSyncs'] = [];

        $sessionPath = null;

        if (!empty($odeSessionId)) {
            $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
        }

        // Common replaces for all OdeComponents
        $commonReplaces = [
            self::ODE_XML_CONTEXT_PATH.Constants::SLASH => $sessionPath,
        ];

        $xml = new \SimpleXMLElement($elpContentFileContent);

        if (isset($xml->{self::ODE_XML_TAG_USER_PREFERENCES})) {
            foreach ($xml->{self::ODE_XML_TAG_USER_PREFERENCES}->children() as $xmlUserPreferences) {
                $userPreferences = new UserPreferencesDto();
                $userPreferences->setKey($xmlUserPreferences->{self::ODE_XML_TAG_FIELD_KEY});
                $userPreferences->setValue($xmlUserPreferences->{self::ODE_XML_TAG_FIELD_VALUE});
                $userPreferences->setValue($xmlUserPreferences->{self::ODE_XML_TAG_FIELD_VALUE});

                array_push($odeResponse['userPreferences'], $userPreferences);
            }
        }

        if (isset($xml->{self::ODE_XML_TAG_RESOURCES})) {
            foreach ($xml->{self::ODE_XML_TAG_RESOURCES}->children() as $xmlOdeResource) {
                $odeResources = new OdeResourcesDto();
                $odeResources->setKey($xmlOdeResource->{self::ODE_XML_TAG_FIELD_KEY});
                $odeResources->setValue($xmlOdeResource->{self::ODE_XML_TAG_FIELD_VALUE});

                array_push($odeResponse['odeResources'], $odeResources);
            }
        }

        if (isset($xml->{self::ODE_XML_TAG_PROPERTIES})) {
            foreach ($xml->{self::ODE_XML_TAG_PROPERTIES}->children() as $xmlOdeProperty) {
                $odeProperties = new OdePropertiesSync();
                $odeProperties->setOdeSessionId($odeSessionId);
                $odeProperties->setKey($xmlOdeProperty->{self::ODE_XML_TAG_FIELD_KEY});
                $odeProperties->setValue($xmlOdeProperty->{self::ODE_XML_TAG_FIELD_VALUE});

                array_push($odeResponse['odeProperties'], $odeProperties);
            }
        }

        // OdeNavStructureSyncs
        foreach ($xml->{self::ODE_XML_TAG_ODE_NAV_STRUCTURES}->children() as $xmlOdeNavStructure) {
            $odeNavStructureSync = new OdeNavStructureSync();

            // OdeNavStructureSync fields
            $odeNavStructureSync->setOdeSessionId($odeSessionId);
            $odeNavStructureSync->setOdePageId($xmlOdeNavStructure->{self::ODE_XML_TAG_FIELD_ODE_PAGE_ID});
            $odeNavStructureSync->setOdeParentPageId($xmlOdeNavStructure->{self::ODE_XML_TAG_FIELD_ODE_PARENT_PAGE_ID});
            $odeNavStructureSync->setPageName($xmlOdeNavStructure->{self::ODE_XML_TAG_FIELD_PAGE_NAME});
            $odeNavStructureSync->setOdeNavStructureSyncOrder(intval($xmlOdeNavStructure->{self::ODE_XML_TAG_FIELD_ODE_NAV_STRUCTURE_ORDER}));

            // OdeNavStructureSync properties
            foreach ($xmlOdeNavStructure->{self::ODE_XML_TAG_ODE_NAV_STRUCTURE_PROPERTIES}->children() as $xmlOdeNavStructureProperty) {
                // OdeNavStructureSync property fields
                $odeNavStructureSyncProperty = new OdeNavStructureSyncProperties();
                $odeNavStructureSyncProperty->setKey($xmlOdeNavStructureProperty->{self::ODE_XML_TAG_FIELD_KEY});
                $odeNavStructureSyncProperty->setValue($xmlOdeNavStructureProperty->{self::ODE_XML_TAG_FIELD_VALUE});

                $odeNavStructureSync->addOdeNavStructureSyncProperties($odeNavStructureSyncProperty);
            }

            // OdePagStructureSyncs
            foreach ($xmlOdeNavStructure->{self::ODE_XML_TAG_ODE_PAG_STRUCTURES}->children() as $xmlOdePagStructure) {
                $odePagStructureSync = new OdePagStructureSync();

                // OdePagStructureSync fields
                $odePagStructureSync->setOdeSessionId($odeSessionId);
                $odePagStructureSync->setOdePageId($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ODE_PAGE_ID});
                $odePagStructureSync->setOdeBlockId($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ODE_BLOCK_ID});
                $odePagStructureSync->setBlockName($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_BLOCK_NAME});
                $odePagStructureSync->setIconName($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ICON_NAME});
                $odePagStructureSync->setOdePagStructureSyncOrder(intval($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ODE_PAG_STRUCTURE_ORDER}));

                // OdePagStructureSync properties
                foreach ($xmlOdePagStructure->{self::ODE_XML_TAG_ODE_PAG_STRUCTURE_PROPERTIES}->children() as $xmlOdePagStructureProperty) {
                    // OdePagStructureSync property fields
                    $odePagStructureSyncProperty = new OdePagStructureSyncProperties();
                    $odePagStructureSyncProperty->setKey($xmlOdePagStructureProperty->{self::ODE_XML_TAG_FIELD_KEY});
                    $odePagStructureSyncProperty->setValue($xmlOdePagStructureProperty->{self::ODE_XML_TAG_FIELD_VALUE});

                    $odePagStructureSync->addOdePagStructureSyncProperties($odePagStructureSyncProperty);
                }

                // OdeComponentsSyncs
                foreach ($xmlOdePagStructure->{self::ODE_XML_TAG_ODE_COMPONENTS}->children() as $xmlOdeComponent) {
                    $odeComponentsSync = new OdeComponentsSync();

                    // OdeComponentsSync fields
                    $odeComponentsSync->setOdeSessionId($odeSessionId);
                    $odeComponentsSync->setOdePageId($xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_PAGE_ID});
                    $odeComponentsSync->setOdeBlockId($xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_BLOCK_ID});
                    $odeComponentsSync->setOdeIdeviceId($xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_IDEVICE_ID});
                    $odeComponentsSync->setOdeIdeviceTypeName($xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_IDEVICE_TYPE_NAME});

                    if (isset($commonReplaces)) {
                        $odeComponentsSyncHtmlView = self::applyReplaces($commonReplaces, $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_HTML_VIEW});
                    } else {
                        $odeComponentsSyncHtmlView = $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_HTML_VIEW};
                    }

                    $odeComponentsSync->setHtmlView($odeComponentsSyncHtmlView);

                    if (isset($commonReplaces)) {
                        $odeComponentsSyncJsonProperties = self::applyReplaces($commonReplaces, $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_JSON_PROPERTIES});
                    } else {
                        $odeComponentsSyncJsonProperties = $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_JSON_PROPERTIES};
                    }

                    $odeComponentsSync->setJsonProperties($odeComponentsSyncJsonProperties);

                    $odeComponentsSync->setOdeComponentsSyncOrder(intval($xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_COMPONENTS_ORDER}));

                    // OdeComponentsSync properties
                    foreach ($xmlOdeComponent->{self::ODE_XML_TAG_ODE_COMPONENTS_PROPERTIES}->children() as $xmlOdeComponentProperty) {
                        // OdePagStructureSync property fields
                        $odeComponentsSyncProperty = new OdeComponentsSyncProperties();
                        $odeComponentsSyncProperty->setKey($xmlOdeComponentProperty->{self::ODE_XML_TAG_FIELD_KEY});
                        $odeComponentsSyncProperty->setValue($xmlOdeComponentProperty->{self::ODE_XML_TAG_FIELD_VALUE});

                        $odeComponentsSync->addOdeComponentsSyncProperties($odeComponentsSyncProperty);
                    }

                    $odePagStructureSync->addOdeComponentsSync($odeComponentsSync);
                }

                $odeNavStructureSync->addOdePagStructureSync($odePagStructureSync);
            }

            array_push($odeResponse['odeNavStructureSyncs'], $odeNavStructureSync);
        }

        // Associate $odeNavStructureSync hierarchy
        foreach ($odeResponse['odeNavStructureSyncs'] as $odeNavStructureSync) {
            if (!empty($odeNavStructureSync->getOdeParentPageId())) {
                foreach ($odeResponse['odeNavStructureSyncs'] as $odeNavStructureSyncSearch) {
                    if ($odeNavStructureSyncSearch->getOdePageId() == $odeNavStructureSync->getOdeParentPageId()) {
                        $odeNavStructureSync->setOdeNavStructureSync($odeNavStructureSyncSearch);
                        break;
                    }
                }
            }
        }

        return $odeResponse;
    }

    /**
     * Process the xml of an Ode.
     *
     * @param string $odeSessionId
     * @param string $elpContentFileContent
     *
     * @return OdeNavStructureSync[]
     */
    public static function readPropertiesXml($odeSessionId, $elpContentFileContent)
    {
        $odeResponse = [];
        $odeResponse['userPreferences'] = [];
        $odeResponse['odeResources'] = [];
        $odeResponse['odeProperties'] = [];
        $odeResponse['odeNavStructureSyncs'] = [];

        $xml = new \SimpleXMLElement($elpContentFileContent);

        if (isset($xml->{self::ODE_XML_TAG_PROPERTIES})) {
            foreach ($xml->{self::ODE_XML_TAG_PROPERTIES}->children() as $xmlOdeProperty) {
                $odeProperties = new OdePropertiesSync();
                $odeProperties->setOdeSessionId($odeSessionId);
                $odeProperties->setKey($xmlOdeProperty->{self::ODE_XML_TAG_FIELD_KEY});
                $odeProperties->setValue($xmlOdeProperty->{self::ODE_XML_TAG_FIELD_VALUE});

                array_push($odeResponse['odeProperties'], $odeProperties);
            }
        }

        return $odeResponse;
    }

    /**
     * Process the xml of an Ode.
     *
     * @param string $odeSessionId
     * @param string $elpContentFileContent
     *
     * @return OdeNavStructureSync[]
     */
    public static function readOldExeXml($odeSessionId, $elpContentFileContent)
    {
        // Array structure
        $odeResponse = [];
        $odeResponse['userPreferences'] = [];
        $odeResponse['odeResources'] = [];
        $odeResponse['odeProperties'] = [];
        $odeResponse['odeNavStructureSyncs'] = [];
        $odeResponse['srcRoutes'] = [];
        $odeResponse['odeComponentsMapping'] = [];

        // odeNavSyncs
        $odeNavSyncs = [];
        // references (node => parent)
        $references = [];
        // node references with odePageId
        $referencesPageId = [];

        $generatedIds = []; // ids array to avoid duplicates

        // The next code is used to modify the XML content to be able to be parsed by SimpleXMLElement
        // XML exported by eXe 2 add new lines and indentations  inside attributes, that are not supported by SimpleXMLElement,
        // so we need to remove them
        // First remove any indentations:
        $xml = str_replace('     ', '', $elpContentFileContent);
        $xml = str_replace("\t", '', $xml);

        // Next replace unify all new-lines into unix LF:
        $xml = str_replace("\r", "\n", $xml);
        $xml = str_replace("\n\n", "\n", $xml);

        // Next replace all new lines with the unicode:
        $xml = str_replace("\n", '&#10;', $xml);

        // Finally, replace any new line entities between >< with a new line:
        $elpContentFileContent = str_replace('>&#10;<', ">\n<", $xml);

        // DOM is used to selectively modify exe 2.x XML because it contains three different encodings
        // (Windows-1252, UTF-8 and UNICODE characters). It cannot be modified globally with regular expression
        // because these characters may appear in iDevices and should not be modified.
        $dom = new \DOMDocument();
        $dom->loadXML($elpContentFileContent);

        // Get xmlns from array
        $xpathNamespace = $dom->lookupNamespaceUri($dom->namespaceURI);
        // Need to use xpath
        $xpath = new \DOMXPath($dom);
        $xpath->registerNamespace('f', $xpathNamespace);

        // Process lomSub nodes to remove hexadecimal characters
        $lomSubNodes = $xpath->query("//f:instance[@class='exe.engine.lom.lomsubs.LangStringSub']");
        foreach ($lomSubNodes as $lomSubNode) {
            $lomSubContent = $dom->saveXML($lomSubNode);
            $lomSubContent = preg_replace_callback('/\\\\x([0-9A-Fa-f]{2})/', function ($matches) {
                return chr(hexdec($matches[1]));
            }, $lomSubContent);
            $lomSubContent = str_replace('\n', '&#10;', $lomSubContent);
            $newLomSubNode = $dom->createDocumentFragment();
            $newLomSubNode->appendXML($lomSubContent);
            $lomSubNode->parentNode->replaceChild($newLomSubNode, $lomSubNode);
        }

        $elpContentFileContent_convert = $dom->saveXML();

        // replace all hex entities to characters. This is necessary because the SimpleXMLElement constructor does not support hex entities
        // $elpContentFileContent_convert = preg_replace_callback('/\\\\x([0-9A-Fa-f]{2})/', function ($matches) {
        //      return chr(hexdec($matches[1]));
        // }, $elpContentFileContent);

        // Next convert may be used to avoid the error: Entity 'nbsp' not defined or other similar errors
        // $xml = new \SimpleXMLElement($elpContentFileContent_convert, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD | LIBXML_NOENT | LIBXML_NOERROR | LIBXML_NOWARNING);

        $xml = new \SimpleXMLElement($elpContentFileContent_convert);
        // Get xmlns from array
        $xpathNamespace = $xml->getNamespaces(true)[''];
        // Need to use xpath
        $xml->registerXPathNamespace('f', $xpathNamespace);

        // Get general properties elp
        $elpNodeGeneralProperties = $xml->xpath('f:dictionary')[0];
        $odeGeneralProperties = OdeOldXmlPropertiesGet::oldElpGeneralPropertiesGet($odeSessionId, $elpNodeGeneralProperties, $xpathNamespace);
        $odeCatalogProperties['odeProperties'] = [];

        // Get catalog properties elp
        if ('LOMES' == (string) $odeGeneralProperties['exportMetadata']) {
            // set export metadata
            $odeProperties = new OdePropertiesSync();
            $odeProperties->setOdeSessionId($odeSessionId);
            $odeProperties->setKey('pp_exportMetadataType');
            $odeProperties->setValue('lomes');
            array_push($odeGeneralProperties['odeProperties'], $odeProperties);

            $elpNodeCatalogProperties = $xml->xpath("f:dictionary/f:string[@value='lomEs']/following-sibling::f:instance[1]")[0];
            if (!empty($elpNodeCatalogProperties)) {
                $elpNodeCatalogProperties = $elpNodeCatalogProperties[0];
                $propertyCatalogKey = 'lom';
                $odeCatalogProperties = OdeOldXmlPropertiesGet::oldElpCatalogPropertiesGet($odeSessionId, $elpNodeCatalogProperties, $propertyCatalogKey, $xpathNamespace);
            }
        } else {
            // set export metadata
            $odeProperties = new OdePropertiesSync();
            $odeProperties->setOdeSessionId($odeSessionId);
            $odeProperties->setKey('pp_exportMetadataType');
            $odeProperties->setValue('lom');
            array_push($odeGeneralProperties['odeProperties'], $odeProperties);

            $elpNodeCatalogProperties = $xml->xpath("f:dictionary/f:string[@value='lom']/following-sibling::f:instance[1]");
            if (!empty($elpNodeCatalogProperties)) {
                $elpNodeCatalogProperties = $elpNodeCatalogProperties[0];
                $propertyCatalogKey = 'lom';
                $odeCatalogProperties = OdeOldXmlPropertiesGet::oldElpCatalogPropertiesGet($odeSessionId, $elpNodeCatalogProperties, $propertyCatalogKey, $xpathNamespace);
            }
        }

        $odeResponse['odeProperties'] = array_merge($odeGeneralProperties['odeProperties'], $odeCatalogProperties['odeProperties']);

        // Look for scattered nodes in the contentv3.xml file within iDevices that contain internal links to these nodes. When this happens,
        // the exact node order reference appears in reference tags between two node instance tags.
        $nodesChangeRef = [];
        $countUnorder2 = 0;

        // This loop searches for those nodes whose position in the navigation is determined by the order established by the child - list tag
        // but only refers to its id, since the content (instance) of the node itself is elsewhere in the XML (usually in the first place
        // where it is referenced by internal link).
        $allNodes = $xml->xpath("//f:instance[@class='exe.engine.node.Node']");
        foreach ($allNodes as $node) {
            $node->registerXPathNamespace('f', $xpathNamespace);
            $nodeRef = (string) $node['reference'];
            $childrenList = $node->xpath("//f:instance[@class='exe.engine.node.Node' and @reference='".$nodeRef."']/f:dictionary/f:string[@role='key' and @value='children']/following-sibling::f:list[1]");
            $newPos = (int) $node['reference'];
            //  Store in the associative array the key of the node to be positioned correctly based on its parent or previous sibling
            if (!empty($childrenList)) {
                foreach ($childrenList[0] as $children) {
                    if ('instance' == $children->getName()) {
                        $newPos = (int) $children['reference'];
                    } else {
                        if ('reference' == $children->getName()) {
                            $nodesChangeRef[(int) $children['key']] = (int) $newPos;
                            $newPos = (int) $children['key'];
                            ++$countUnorder2;
                        }
                    }
                }
            }
        }

        // Search if contentv3.xml has not a good structure becasuse some child nodes are using child tag nodes instead of using a number to parent node  reference
        // Current index of each node in the navigation structure
        // pageNodes
        // $unOrderInstances = $xml->xpath("//f:string[@value='parent']/following-sibling::f:instance[@class='exe.engine.node.Node']");
        // $countUnorder may be used to check if the contentv3.xml file has a good structure or not related to the parent-child nesting
        // Actually, that is not used for anything but it could be used to check if the contentv3.xml file has a good structure or not
        // $countUnorder = count($unOrderInstances);

        $nodeOrder = 1;
        $nodes = $xml->xpath("//f:instance[@class='exe.engine.node.Node']");
        foreach ($nodes as $node) {
            // Get navStructure, references and routes to place content
            $subPagesNav = self::oldElpStructureNewPage($odeSessionId, $generatedIds, $node, $xml, $xpathNamespace);
            // Get references to assign the parent
            foreach ($subPagesNav['nodeReferences'] as $key => $parentReference) {
                $references[$key] = $parentReference;
            }
            // reorder the nodes according to the sequential position in the XML, but for those that are nested
            // inside their children instead of the other way around and for those whose content is outside the list
            // of children we reorder them outside this loop and once the actual parent is foundRe order nodes navigation structure
            $subPagesNav['odeNavStructureSyncs'][0]->setOdeNavStructureSyncOrder($nodeOrder);

            // Get routes to place content
            foreach ($subPagesNav['srcRoutes'] as $srcRoute) {
                array_push($odeResponse['srcRoutes'], $srcRoute);
            }

            // Get odeComponentsId to create folder in tmp
            if (isset($subPagesNav['odeComponentsMapping'])) {
                foreach ($subPagesNav['odeComponentsMapping'] as $odeComponentId) {
                    array_push($odeResponse['odeComponentsMapping'], $odeComponentId);
                }
            }

            // Assign odePageId to the node reference
            $nodeReference = (string) $node['reference'];
            foreach ($subPagesNav['odeNavStructureSyncs'] as $subPageNav) {
                // Array to assign navStructure with his node reference
                if ('' != $nodeReference) {
                    $odeNavSyncs[$nodeReference] = $subPageNav;
                    // Put odePageId to each reference
                    $referencesPageId[$nodeReference] = $subPageNav->getOdePageId();
                }
            }
            $nodeOrder = $nodeOrder + 20;
        }
        // Get the ID index node
        // In some malformed contenv3.xml files, the first node isn't the root node
        // Search the parent in another way
        $rootNode = $xml->xpath("//f:none/preceding-sibling::f:string[@value='parent']/parent::f:dictionary/parent::f:instance[@class='exe.engine.node.Node']");
        $odeIndexReferenceId = (int) $rootNode[0]['reference'];
        if (0 == $odeIndexReferenceId) {
            $odeIndexReferenceId = (int) $rootNode[1]['reference'];
        }
        $odeIndexPageId = $odeNavSyncs[$odeIndexReferenceId]->getOdePageId();
        // Set odeParentPageId to each odeNavStructure and assign to odeReponse
        foreach ($odeNavSyncs as $odeNavReference => $odeNavSync) {
            foreach ($references as $node => $parentNode) {
                if (!empty($parentNode) && $node == $odeNavReference) {
                    foreach ($referencesPageId as $nodeReference => $odePageId) {
                        if (($parentNode == $nodeReference) && ($odePageId != $odeIndexPageId)) {
                            $odeNavSync->setOdeParentPageId($odePageId);
                        }
                    }
                }
            }
            // $countUnorder may be deleted in that case becasue it is not used, but it might exist a contentv3.xml than only has a bad structura in the
            // parent-child nesting and not in the order of the nodes
            if (0 == $countUnorder2 /* && 0 == $countUnorder */) {
                array_push($odeResponse['odeNavStructureSyncs'], $odeNavSync);
            }
        }

        // reorder nodes that are incorrectly nested and are outside the child list of their real parent. The array $nodesChageRef is the one that contains the original
        // reference value and the position after which it has to go in the navigation
        if (0 < $countUnorder2) {
            foreach ($nodesChangeRef as $oldkey => $newkey) {
                $odeNavSyncs[$oldkey]->setOdeNavStructureSyncOrder($odeNavSyncs[$newkey]->getOdeNavStructureSyncOrder() + 1);
            }
        }

        foreach ($odeNavSyncs as $odeNavReference => $odeNavSync) {
            array_push($odeResponse['odeNavStructureSyncs'], $odeNavSync);
        }

        // Associate $odeNavStructureSync hierarchy
        foreach ($odeResponse['odeNavStructureSyncs'] as $odeNavStructureSync) {
            if (!empty($odeNavStructureSync->getOdeParentPageId())) {
                foreach ($odeResponse['odeNavStructureSyncs'] as $odeNavStructureSyncSearch) {
                    if ($odeNavStructureSyncSearch->getOdePageId() == $odeNavStructureSync->getOdeParentPageId()) {
                        $odeNavStructureSync->setOdeNavStructureSync($odeNavStructureSyncSearch);
                        break;
                    }
                }
            }
        }

        $odeResponse['odeNavStructureSyncs'] = self::changeOldExeNodeLink($odeResponse['odeNavStructureSyncs']);

        return $odeResponse;
    }

    /**
     * Change old format exe-node links.
     *
     * @param array $odeNavStructureSyncs
     *
     * @return array $odeNavStructureSyncs
     */
    public static function changeOldExeNodeLink($odeNavStructureSyncs): array
    {
        $fullPathMap = [];
        $nodeIdToIndex = [];
        $delimiter = ':';

        foreach ($odeNavStructureSyncs as $node) {
            if ($node->getPageName()) {
                $nodeIdToIndex[$node->getOdePageId()] = [
                    'id' => $node->getOdePageId(),
                    'name' => urldecode($node->getPageName()),
                    'parent_id' => $node->getOdeParentPageId(),
                ];
            }
        }

        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            if (!$odeNavStructureSync->getPageName()) {
                continue;
            }
            $pathParts = [$odeNavStructureSync->getPageName()];
            $currentIdInPath = $odeNavStructureSync->getOdeParentPageId();

            while (null !== $currentIdInPath && isset($nodeIdToIndex[$currentIdInPath])) {
                $dataFromIndex = $nodeIdToIndex[$currentIdInPath];
                array_unshift($pathParts, $dataFromIndex['name']);
                $currentIdInPath = $dataFromIndex['parent_id'];
            }

            $fullPath = implode($delimiter, $pathParts);

            $fullPathMap[$fullPath] = $odeNavStructureSync->getOdePageId();
        }

        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                    $htmlView = $odeComponentsSync->getHtmlView() ?? '';
                    if (str_contains($htmlView, Constants::IDEVICE_NODE_LINK_NAME_IN_EXE)) {
                        $odeComponentsSync->replaceOldInternalLinks($fullPathMap);
                    }
                }
            }
        }

        return $odeNavStructureSyncs;
    }

    /**
     * Create structure from page nodes.
     *
     * @param string $odeSessionId
     * @param object $oldXmlListInst
     * @param object $xml
     *
     * @return array $result
     */
    private static function oldElpStructureNewPage($odeSessionId, $generatedIds, $oldXmlListInst, $xml, $xpathNamespace)
    {
        // params
        $result = [];
        $nodeReferences = [];
        $odeNavStructureSyncs = [];
        $srcRoutes = [];

        foreach ($oldXmlListInst->{self::OLD_ODE_XML_DICTIONARY} as $oldXmlListInstDict) {
            // PAGE TITLE
            if ($oldXmlListInstDict->{self::OLD_ODE_XML_UNICODE}) {
                $oldXmlListInstDict->registerXPathNamespace('f', $xpathNamespace);
                $parentReference = $oldXmlListInstDict->xpath("f:string[@value='parent']/following-sibling::f:reference");
                $nodePagOrder = $oldXmlListInstDict->xpath("f:string[@value='_id']/following-sibling::f:unicode");
                // order can't be 0 so add one to the current value
                $odePagOrder = isset($nodePagOrder[0]) ? (string) $nodePagOrder[0]['value'] + 1 : 1;

                $reference = (string) $oldXmlListInst['reference'];
                // References (node reference->parent reference)
                if (!empty($parentReference)) {
                    $nodeReferences[$reference] = (string) $parentReference[0]['key'];
                } else {
                    // parentReference depends on unorder XML instances
                    $parentReference = $oldXmlListInstDict->xpath("f:string[@value='parent']/following-sibling::f:instance");
                    if (!empty($parentReference)) {
                        $nodeReferences[$reference] = (string) $parentReference[0]['reference'];
                    } else {
                        $nodeReferences[$reference] = null;
                    }
                }
                // Start new ode nav structure sync
                $subOdeNavStructureSync = new OdeNavStructureSync();
                $odePageId = Util::generateIdCheckUnique($generatedIds);
                $generatedIds[] = $odePageId;

                // OdeNavStructureSync fields
                $subOdeNavStructureSync->setOdeSessionId($odeSessionId);
                $subOdeNavStructureSync->setOdePageId($odePageId);
                // $subOdeNavStructureSync->setOdeParentPageId($odeParentPage);
                $subOdeNavStructureSync->setOdeNavStructureSyncOrder(intval($odePagOrder));

                // If the page name is empty, we set the page name to the last on
                if (('' == $oldXmlListInstDict->children()[1]['value']) && ('string' == $oldXmlListInstDict->children()[1]->getName())) {
                    $pageName = '_';
                    $nodePath = $oldXmlListInstDict->xpath("f:string[@role='key' and @value='last_full_node_path']/following-sibling::f:string");
                    if (!empty($nodePath)) {
                        $pageName = $nodePath[0]['value'];
                        preg_match('/^(.*)\:(.*)$/', $pageName, $matches);
                        $pageName = urldecode($matches[2]);
                    }
                } else {
                    if ('string' == $oldXmlListInstDict->children()[1]->getName()) {
                        $pageName = $oldXmlListInstDict->children()[1]['value'];
                    } else {
                        $pageName = $oldXmlListInstDict->{self::OLD_ODE_XML_UNICODE}['value'][0];
                    }
                }
                $subOdeNavStructureSync->setPageName($pageName);

                // Add `titlePage` property as old elp title page is set as page name
                $subOdeNavStructureSyncProperty = new OdeNavStructureSyncProperties();
                $subOdeNavStructureSyncProperty->setKey('titlePage');
                $subOdeNavStructureSyncProperty->setValue($pageName);

                $subOdeNavStructureSync->addOdeNavStructureSyncProperties($subOdeNavStructureSyncProperty);
            }
            foreach ($oldXmlListInstDict->{self::OLD_ODE_XML_LIST} as $oldXmlListInstDictList) {
                if ($oldXmlListInstDictList->{self::OLD_ODE_XML_INSTANCE}) {
                    $oldXmlListInstDictList->registerXPathNamespace('f', $xpathNamespace);

                    // Types idevices
                    $nodeIdevices = $oldXmlListInstDictList->xpath("f:instance[@class='exe.engine.jsidevice.JsIdevice']");
                    $nodeIdevicesListaApartados = $oldXmlListInstDictList->xpath("f:instance[@class='exe.engine.old_idevices.listaapartadosidevice.ListaApartadosIdevice']");
                    $nodeIdevicesTareas = $oldXmlListInstDictList->xpath("f:instance[@class='exe.engine.old_idevices.tareasidevice.TareasIdevice']");
                    $nodeIdevicesComillas = $oldXmlListInstDictList->xpath("f:instance[@class='exe.engine.old_idevices.comillasidevice.ComillasIdevice']");
                    $nodeIdevicesReflexion = $oldXmlListInstDictList->xpath("f:instance[@class='exe.engine.old_idevices.reflexionidevice.ReflexionIdevice']");
                    $nodeIdevicesNotaInfo = $oldXmlListInstDictList->xpath("f:instance[@class='exe.engine.old_idevices.notainformacionidevice.NotaInformacionIdevice']");

                    // Get component sync by node type
                    $types = $oldXmlListInstDictList->xpath('f:instance/@class');
                    $references = $oldXmlListInstDictList->xpath('f:instance/@reference');
                    $results = self::getComponentSyncFromNode($types, $references, $oldXmlListInstDictList, $odeSessionId, $odePageId, $generatedIds, $xpathNamespace);
                    if (!empty($results)) {
                        foreach ($results as $result) {
                            foreach ($result['odeComponentsSync'] as $odeComponentSync) {
                                $subOdeNavStructureSync->addOdePagStructureSync($odeComponentSync);
                            }
                            foreach ($result['srcRoutes'] as $srcRoute) {
                                array_push($srcRoutes, $srcRoute);
                            }
                        }
                    }

                    // Activities
                    $nodeIdevicesNotaInfo = $oldXmlListInstDictList->xpath("f:instance[@class='exe.engine.listaidevice.ListaIdevice']");

                    // Search dropdown activity, process it and exclude from $nodeIdevicesNotaInfo
                    $dropdownResult = self::searchDropdownActivityOldElp($odeSessionId, $odePageId, $nodeIdevicesNotaInfo, $subOdeNavStructureSync, $srcRoutes, $xpathNamespace, $generatedIds);
                    $nodeIdevicesNotaInfo = $dropdownResult['nodeIdevicesNotaInfo'];
                    $subOdeNavStructureSync = $dropdownResult['subOdeNavStructureSync'];

                    $nodeIdevicesTareas = array_merge($nodeIdevicesTareas, $nodeIdevicesNotaInfo);
                    $nodeIdevicesTareas = array_merge($nodeIdevicesTareas, $nodeIdevicesComillas);
                    $nodeIdevicesTareas = array_merge($nodeIdevicesTareas, $nodeIdevicesListaApartados);
                    $nodeIdevicesTareas = array_merge($nodeIdevicesTareas, $nodeIdevicesReflexion);

                    if (!empty($nodeIdevicesTareas)) {
                        $result = self::createIdeviceXmlClassTareas($odeSessionId, $odePageId, $nodeIdevicesTareas, $generatedIds, $xpathNamespace);
                        foreach ($result['odeComponentsSync'] as $odeComponentSync) {
                            $subOdeNavStructureSync->addOdePagStructureSync($odeComponentSync);
                        }
                        foreach ($result['srcRoutes'] as $srcRoute) {
                            array_push($srcRoutes, $srcRoute);
                        }
                    }
                    foreach ($nodeIdevices as $nodeIdevice) {
                        $nodeIdevice->registerXPathNamespace('f', $xpathNamespace);

                        // Search game idevice and process it
                        $gameIdevicesResult = self::searchGameIdeviceOldElp($odeSessionId, $odePageId, $nodeIdevice, $subOdeNavStructureSync, $srcRoutes, $xpathNamespace, $generatedIds);

                        $nodeIdevice = $gameIdevicesResult['nodeIdevice'];
                        $subOdeNavStructureSync = $gameIdevicesResult['subOdeNavStructureSync'];
                        $srcRoutes = $gameIdevicesResult['srcRoutes'];
                        // In case of not be a game idevice
                        if (!empty($nodeIdevice)) {
                            // Process node text idevices
                            $nodeIdevicesTextResult = self::searchTextIdeviceOldElp($odeSessionId, $odePageId, $nodeIdevice, $subOdeNavStructureSync, $srcRoutes, $xpathNamespace, $generatedIds);
                            $subOdeNavStructureSync = $nodeIdevicesTextResult['subOdeNavStructureSync'];
                            $srcRoutes = $nodeIdevicesTextResult['srcRoutes'];
                        }
                    }
                }
            }
        }

        array_push($odeNavStructureSyncs, $subOdeNavStructureSync);

        $result['odeNavStructureSyncs'] = $odeNavStructureSyncs;
        $result['nodeReferences'] = $nodeReferences;
        $result['srcRoutes'] = $srcRoutes;
        if (isset($odeComponentsMapping)) {
            $result['odeComponentsMapping'] = $odeComponentsMapping;
        }

        return $result;
    }

    /**
     * Create structure in case of idevice tareas.
     *
     * @param string $odeSessionId
     * @param string $odePageId
     * @param array  $nodeIdevicesTareas
     * @param array  $generatedIds
     *
     * @return array $result
     */
    private static function createIdeviceXmlClassTareas(
        $odeSessionId,
        $odePageId,
        $nodeIdevicesTareas,
        $generatedIds,
        $xpathNamespace,
    ) {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];

        foreach ($nodeIdevicesTareas as $nodeIdeviceTarea) {
            $nodeIdeviceTarea->registerXPathNamespace('f', $xpathNamespace);

            // Get blockName
            $blockNameNode = $nodeIdeviceTarea->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");
            $nodeIdevices = $nodeIdeviceTarea->xpath("f:dictionary/f:instance[@class='exe.engine.field.TextAreaField']");
            foreach ($nodeIdevices as $nodeIdevice) {
                // IDEVICE TEXT CONTENT
                if ($nodeIdevice->{self::OLD_ODE_XML_DICTIONARY}->{self::OLD_ODE_XML_UNICODE}) {
                    $subOdePagStructureSync = new OdePagStructureSync();
                    $odeBlockId = Util::generateIdCheckUnique($generatedIds);
                    $generatedIds[] = $odeBlockId;

                    // OdePagStructureSync fields
                    $subOdePagStructureSync->setOdeSessionId($odeSessionId);
                    $subOdePagStructureSync->setOdePageId($odePageId);
                    $subOdePagStructureSync->setOdeBlockId($odeBlockId);
                    // $odePagStructureSync->setIconName($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ICON_NAME});

                    // $odeBlockTitle = $oldXmlListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}["value"][0];
                    $subOdePagStructureSync->setBlockName((string) $blockNameNode[0]);

                    $orderPage = (string) $nodeIdevice['reference'];
                    $subOdePagStructureSync->setOdePagStructureSyncOrder(intval($orderPage));

                    // Get pagStructureSync properties
                    $subOdePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();
                    // foreach($oldXmlListInstDict->{self::OLD_ODE_XML_UNICODE} as $oldXmlListInstDictUnicode){
                    //     // array_push($odeResponse, $oldXmlListInstDictUnicode);
                    //     if($oldXmlListInstDictUnicode["value"]) {
                    //         $odePagStructureSync->setBlockName($oldXmlListInstDictUnicode["value"]);
                    //     }

                    // }

                    $odeComponentsSync = new OdeComponentsSync();
                    $odeIdeviceId = Util::generateIdCheckUnique($generatedIds);
                    $generatedIds[] = $odeIdeviceId;
                    $odeComponentsMapping[] = $odeIdeviceId;

                    // OdeComponentsSync fields
                    $odeComponentsSync->setOdeSessionId($odeSessionId);
                    $odeComponentsSync->setOdePageId($odePageId);
                    $odeComponentsSync->setOdeBlockId($odeBlockId);
                    $odeComponentsSync->setOdeIdeviceId($odeIdeviceId);

                    // $odeComponentsSync->setJsonProperties($odeComponentsSyncJsonProperties);

                    $odeComponentsSync->setOdeComponentsSyncOrder(intval(1));
                    // Set type
                    $odeComponentsSync->setOdeIdeviceTypeName('text');

                    foreach ($nodeIdevice->{self::OLD_ODE_XML_DICTIONARY} as $oldXmlListDictListInstDictListInstDict) {
                        // $oldXmlListDictListInstDictListInstDict->registerXPathNamespace('f', $xpathNamespace);
                        // $fileTextPathToChange = $oldXmlListDictListInstDictListInstDict->xpath('//f:unicode[@content="true"]starts-with(@src,"resources/")]');
                        // src="resources/

                        $sessionPath = null;

                        if (!empty($odeSessionId)) {
                            $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
                        }

                        // Common replaces for all OdeComponents
                        $commonReplaces = [
                            'resources'.Constants::SLASH => $sessionPath.$odeIdeviceId.Constants::SLASH,
                        ];

                        if (isset($oldXmlListDictListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}[2]['content']) && $oldXmlListDictListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}[2]['content'] == 'true') {
                            if (isset($commonReplaces)) {
                                $odeComponentsSyncHtmlView = self::applyReplaces($commonReplaces, $oldXmlListDictListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}[2]['value']);
                            } else {
                                $odeComponentsSyncHtmlView = $oldXmlListDictListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}[2]['value'];
                            }

                            $prologue = '<?xml encoding="UTF-8">';
                            $html = $prologue.$odeComponentsSyncHtmlView;
                            $doc = new \DOMDocument();
                            @$doc->loadHTML($html);
                            $xpath = new \DOMXPath($doc);
                            $src = $xpath->evaluate('//img/@src', $doc); // "/images/image.jpg"
                            foreach ($src as $srcValue) {
                                $srcString = (string) $srcValue->value;
                                array_push($result['srcRoutes'], $srcString);
                            }

                            $odeComponentsSync->setHtmlView($odeComponentsSyncHtmlView);

                            // Create jsonProperties for idevice
                            $jsonProperties = [
                                'ideviceId' => $odeIdeviceId,
                                'textInfoDurationInput' => '',
                                'textInfoParticipantsInput' => '',
                                'textInfoDurationTextInput' => 'Duration:',
                                'textInfoParticipantsTextInput' => 'Grouping:',
                                'textTextarea' => $odeComponentsSyncHtmlView,
                                'textFeedbackTextarea' => '',
                            ];

                            $jsonProperties = json_encode($jsonProperties, JSON_UNESCAPED_SLASHES);
                            $odeComponentsSync->setJsonProperties($jsonProperties);

                            // OdeComponentsSync property fields
                            $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

                            // $oldXmlListDictListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}[1]["value"];
                            $subOdePagStructureSync->addOdeComponentsSync($odeComponentsSync);
                        }
                    }
                }
                array_push($result['odeComponentsSync'], $subOdePagStructureSync);
            }
        }

        return $result;
    }

    /**
     * Process the xml of an Ode.
     *
     * @param string $odeSessionId
     * @param string $elpContentFileContent
     *
     * @return OdeNavStructureSync[]
     */
    public static function readMultipleOdeXml(
        $odeSessionId,
        $elpContentFileContent,
        $parentOdeNavStructureSync = null,
    ) {
        $odeResponse = [];
        $odeResponse['odeNavStructureSyncs'] = [];
        $odeResponse['odeComponentsMapping'] = [];

        $generatedIds = []; // ids array to avoid duplicates
        $odeNavStructuresMapping = []; // OdePageId mapping to maintain OdeParentPageId
        $odeComponentsMapping = []; // OdeIdeviceId to rename dirs

        $sessionPath = null;

        if (!empty($odeSessionId)) {
            $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
        }

        // Get parent page id of navs on the current session
        if (!empty($parentOdeNavStructureSync)) {
            $parentOdePageId = $parentOdeNavStructureSync->getOdePageId();
        } else {
            $parentOdePageId = null;
        }

        // Common replaces for all OdeComponents
        $commonReplaces = [self::ODE_XML_CONTEXT_PATH.Constants::SLASH => $sessionPath];

        $xml = new \SimpleXMLElement($elpContentFileContent);

        // OdeNavStructureSyncs
        if (isset($xml->{self::ODE_XML_TAG_ODE_NAV_STRUCTURES})) {
            foreach ($xml->{self::ODE_XML_TAG_ODE_NAV_STRUCTURES}->children() as $xmlOdeNavStructure) {
                $newOdePageId = Util::generateIdCheckUnique($generatedIds);
                $generatedIds[] = $newOdePageId;
                $odeNavStructuresMapping[(string) $xmlOdeNavStructure->{self::ODE_XML_TAG_FIELD_ODE_PAGE_ID}] = $newOdePageId;

                $odeNavStructureSync = new OdeNavStructureSync();

                // OdeNavStructureSync fields
                $odeNavStructureSync->setOdeSessionId($odeSessionId);
                $odeNavStructureSync->setOdePageId($newOdePageId);

                // Add page to parent
                if ($parentOdeNavStructureSync) {
                    $parentOdeNavStructureSync->addOdeNavStructureSync($odeNavStructureSync);
                }

                // If parent null set parent selected page, else maintain structure of pages
                $xmlOdeNavStructureParentPageId = (string) $xmlOdeNavStructure->{self::ODE_XML_TAG_FIELD_ODE_PARENT_PAGE_ID};
                if ('' == $xmlOdeNavStructureParentPageId) {
                    $odeNavStructureSync->setOdeParentPageId($parentOdePageId);
                } else {
                    $odeNavStructureSync->setOdeParentPageId(
                        $odeNavStructuresMapping[(string) $xmlOdeNavStructure->{self::ODE_XML_TAG_FIELD_ODE_PARENT_PAGE_ID}]
                    );
                }
                $odeNavStructureSync->setPageName($xmlOdeNavStructure->{self::ODE_XML_TAG_FIELD_PAGE_NAME});

                // OdeNavStructureSync properties
                foreach ($xmlOdeNavStructure->{self::ODE_XML_TAG_ODE_NAV_STRUCTURE_PROPERTIES}->children() as $xmlOdeNavStructureProperty) {
                    // OdeNavStructureSync property fields
                    $odeNavStructureSyncProperty = new OdeNavStructureSyncProperties();
                    $odeNavStructureSyncProperty->setKey($xmlOdeNavStructureProperty->{self::ODE_XML_TAG_FIELD_KEY});
                    $odeNavStructureSyncProperty->setValue($xmlOdeNavStructureProperty->{self::ODE_XML_TAG_FIELD_VALUE});

                    $odeNavStructureSync->addOdeNavStructureSyncProperties($odeNavStructureSyncProperty);
                }

                // OdePagStructureSyncs
                foreach ($xmlOdeNavStructure->{self::ODE_XML_TAG_ODE_PAG_STRUCTURES}->children() as $xmlOdePagStructure) {
                    // Generate new block and idevice id
                    $newOdeBlockId = Util::generateIdCheckUnique($generatedIds);
                    $generatedIds[] = $newOdeBlockId;

                    $odePagStructureSync = new OdePagStructureSync();

                    // OdePagStructureSync fields
                    $odePagStructureSync->setOdeSessionId($odeSessionId);
                    $odePagStructureSync->setOdePageId($newOdePageId);
                    $odePagStructureSync->setOdeBlockId($newOdeBlockId);
                    $odePagStructureSync->setBlockName($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_BLOCK_NAME});
                    $odePagStructureSync->setIconName($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ICON_NAME});
                    $odePagStructureSync->setOdePagStructureSyncOrder(
                        intval($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ODE_PAG_STRUCTURE_ORDER})
                    );

                    // OdePagStructureSync properties
                    foreach ($xmlOdePagStructure->{self::ODE_XML_TAG_ODE_PAG_STRUCTURE_PROPERTIES}->children() as $xmlOdePagStructureProperty) {
                        // OdePagStructureSync property fields
                        $odePagStructureSyncProperty = new OdePagStructureSyncProperties();
                        $odePagStructureSyncProperty->setKey($xmlOdePagStructureProperty->{self::ODE_XML_TAG_FIELD_KEY});
                        $odePagStructureSyncProperty->setValue($xmlOdePagStructureProperty->{self::ODE_XML_TAG_FIELD_VALUE});

                        $odePagStructureSync->addOdePagStructureSyncProperties($odePagStructureSyncProperty);
                    }

                    // OdeComponentsSyncs
                    foreach ($xmlOdePagStructure->{self::ODE_XML_TAG_ODE_COMPONENTS}->children() as $xmlOdeComponent) {
                        $newOdeIdeviceId = Util::generateIdCheckUnique($generatedIds);
                        $oldOdeIdeviceId = (string) $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_IDEVICE_ID};
                        $generatedIds[] = $newOdeIdeviceId;
                        $odeComponentsMapping[$oldOdeIdeviceId] = $newOdeIdeviceId;

                        $odeComponentsSync = new OdeComponentsSync();

                        // OdeComponentsSync fields
                        $odeComponentsSync->setOdeSessionId($odeSessionId);
                        $odeComponentsSync->setOdePageId($newOdePageId);
                        $odeComponentsSync->setOdeBlockId($newOdeBlockId);
                        $odeComponentsSync->setOdeIdeviceId($newOdeIdeviceId);
                        $odeComponentsSync->setOdeIdeviceTypeName(
                            $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_IDEVICE_TYPE_NAME}
                        );

                        // Prepare replaces for this OdeComponent
                        if (!empty($sessionPath)) {
                            $currentReplaces = [
                                $oldOdeIdeviceId => $newOdeIdeviceId,
                            ];

                            $replacesToApply = array_merge($commonReplaces, $currentReplaces);
                        }

                        if (isset($replacesToApply)) {
                            $odeComponentsSyncHtmlView = self::applyReplaces(
                                $replacesToApply,
                                $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_HTML_VIEW}
                            );
                        } else {
                            $odeComponentsSyncHtmlView = $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_HTML_VIEW};
                        }

                        $odeComponentsSync->setHtmlView($odeComponentsSyncHtmlView);

                        if (isset($replacesToApply)) {
                            $odeComponentsSyncJsonProperties = self::applyReplaces(
                                $replacesToApply,
                                $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_JSON_PROPERTIES}
                            );
                        } else {
                            $odeComponentsSyncJsonProperties = $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_JSON_PROPERTIES};
                        }

                        $odeComponentsSync->setJsonProperties($odeComponentsSyncJsonProperties);

                        $odeComponentsSync->setOdeComponentsSyncOrder(
                            intval($xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_COMPONENTS_ORDER})
                        );

                        // OdeComponentsSync properties
                        foreach ($xmlOdeComponent->{self::ODE_XML_TAG_ODE_COMPONENTS_PROPERTIES}->children() as $xmlOdeComponentProperty) {
                            // OdePagStructureSync property fields
                            $odeComponentsSyncProperty = new OdeComponentsSyncProperties();
                            $odeComponentsSyncProperty->setKey($xmlOdeComponentProperty->{self::ODE_XML_TAG_FIELD_KEY});
                            $odeComponentsSyncProperty->setValue($xmlOdeComponentProperty->{self::ODE_XML_TAG_FIELD_VALUE});

                            $odeComponentsSync->addOdeComponentsSyncProperties($odeComponentsSyncProperty);
                        }

                        $odePagStructureSync->addOdeComponentsSync($odeComponentsSync);
                    }

                    $odeNavStructureSync->addOdePagStructureSync($odePagStructureSync);
                }

                array_push($odeResponse['odeNavStructureSyncs'], $odeNavStructureSync);
            }
        }

        // Associate $odeNavStructureSync hierarchy
        foreach ($odeResponse['odeNavStructureSyncs'] as $odeNavStructureSync) {
            if (!empty($odeNavStructureSync->getOdeParentPageId())) {
                foreach ($odeResponse['odeNavStructureSyncs'] as $odeNavStructureSyncSearch) {
                    if ($odeNavStructureSyncSearch->getOdePageId() == $odeNavStructureSync->getOdeParentPageId()) {
                        $odeNavStructureSync->setOdeNavStructureSync($odeNavStructureSyncSearch);
                        break;
                    }
                }
            }
        }

        array_push($odeResponse['odeComponentsMapping'], $odeComponentsMapping);

        return $odeResponse;
    }

    /**
     * Process the xml of Ode components.
     *
     * @param string $odeSessionId
     * @param object $odeNavStructureSync
     * @param string $elpContentFileContent
     *
     * @return OdeNavStructureSync[]
     */
    public static function readOdeComponentsXml($odeSessionId, $odeNavStructureSync, $elpContentFileContent)
    {
        $odeResponse = [];
        $odeResponse['odeNavStructureSyncs'] = [];
        $odeResponse['odeResources'] = [];
        $odeResponse['odeComponentsMapping'] = [];
        $odeResponse['odeBlocksMapping'] = [];

        $odeComponentsMapping = []; // OdeIdeviceId to rename dirs

        $sessionPath = null;

        if (!empty($odeSessionId)) {
            $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
        }

        $xml = new \SimpleXMLElement($elpContentFileContent);

        if (isset($xml->{self::ODE_XML_TAG_RESOURCES})) {
            foreach ($xml->{self::ODE_XML_TAG_RESOURCES}->children() as $xmlOdeResource) {
                $odeResources = new OdeResourcesDto();
                $odeResources->setKey($xmlOdeResource->{self::ODE_XML_TAG_FIELD_KEY});
                $odeResources->setValue($xmlOdeResource->{self::ODE_XML_TAG_FIELD_VALUE});

                array_push($odeResponse['odeResources'], $odeResources);
            }
        }

        // OdePagStructureSyncs
        foreach ($xml->{self::ODE_XML_TAG_ODE_PAG_STRUCTURES}->children() as $xmlOdePagStructure) {
            // Generate new block and idevice id
            $generatedIds = []; // ids array to avoid duplicates
            $newOdeBlockId = Util::generateIdCheckUnique($generatedIds);
            $oldOdeIdeviceId = (string) $xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ODE_BLOCK_ID};
            $generatedIds[] = $newOdeBlockId;
            // Only generates one id for import idevices
            $odeBlocksMapping = $newOdeBlockId;

            $odePagStructureSync = new OdePagStructureSync();

            // OdePagStructureSync fields
            $odePagStructureSync->setOdeSessionId($odeSessionId);
            $odePagStructureSync->setOdePageId($odeNavStructureSync->getOdePageId());
            $odePagStructureSync->setOdeBlockId($newOdeBlockId);
            $odePagStructureSync->setBlockName($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_BLOCK_NAME});
            $odePagStructureSync->setIconName($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ICON_NAME});
            $odePagStructureSync->setOdePagStructureSyncOrder(intval($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ODE_PAG_STRUCTURE_ORDER}));

            // OdePagStructureSync properties
            foreach ($xmlOdePagStructure->{self::ODE_XML_TAG_ODE_PAG_STRUCTURE_PROPERTIES}->children() as $xmlOdePagStructureProperty) {
                // OdePagStructureSync property fields
                $odePagStructureSyncProperty = new OdePagStructureSyncProperties();
                $odePagStructureSyncProperty->setKey($xmlOdePagStructureProperty->{self::ODE_XML_TAG_FIELD_KEY});
                $odePagStructureSyncProperty->setValue($xmlOdePagStructureProperty->{self::ODE_XML_TAG_FIELD_VALUE});

                $odePagStructureSync->addOdePagStructureSyncProperties($odePagStructureSyncProperty);
            }

            // OdeComponentsSyncs
            foreach ($xmlOdePagStructure->{self::ODE_XML_TAG_ODE_COMPONENTS}->children() as $xmlOdeComponent) {
                $newOdeIdeviceId = Util::generateIdCheckUnique($generatedIds);
                $oldOdeIdeviceId = (string) $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_IDEVICE_ID};
                $oldOdeSessionId = (string) $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_SESSION_ID};
                $generatedIds[] = $newOdeIdeviceId;
                $odeComponentsMapping[$oldOdeIdeviceId] = $newOdeIdeviceId;

                $odeComponentsSync = new OdeComponentsSync();

                // OdeComponentsSync fields
                $odeComponentsSync->setOdeSessionId($odeSessionId);
                $odeComponentsSync->setOdePageId($xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_PAGE_ID});
                $odeComponentsSync->setOdeBlockId($newOdeBlockId);
                $odeComponentsSync->setOdeIdeviceId($newOdeIdeviceId);
                $odeComponentsSync->setOdeIdeviceTypeName($xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_IDEVICE_TYPE_NAME});

                // Prepare replaces for this OdeComponent
                if (!empty($sessionPath)) {
                    $currentReplaces = [
                        $oldOdeIdeviceId => $newOdeIdeviceId,
                        $oldOdeSessionId => $odeSessionId,
                    ];

                    $replacesToApply = $currentReplaces;
                }

                if (isset($replacesToApply)) {
                    $odeComponentsSyncHtmlView = self::applyReplaces($replacesToApply, $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_HTML_VIEW});
                } else {
                    $odeComponentsSyncHtmlView = $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_HTML_VIEW};
                }

                $odeComponentsSync->setHtmlView($odeComponentsSyncHtmlView);

                if (isset($replacesToApply)) {
                    $odeComponentsSyncJsonProperties = self::applyReplaces($replacesToApply, $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_JSON_PROPERTIES});
                } else {
                    $odeComponentsSyncJsonProperties = $xmlOdeComponent->{self::ODE_XML_TAG_FIELD_JSON_PROPERTIES};
                }

                $odeComponentsSync->setJsonProperties($odeComponentsSyncJsonProperties);

                $odeComponentsSync->setOdeComponentsSyncOrder(intval($xmlOdeComponent->{self::ODE_XML_TAG_FIELD_ODE_COMPONENTS_ORDER}));

                // OdeComponentsSync properties
                foreach ($xmlOdeComponent->{self::ODE_XML_TAG_ODE_COMPONENTS_PROPERTIES}->children() as $xmlOdeComponentProperty) {
                    // OdePagStructureSync property fields
                    $odeComponentsSyncProperty = new OdeComponentsSyncProperties();
                    $odeComponentsSyncProperty->setKey($xmlOdeComponentProperty->{self::ODE_XML_TAG_FIELD_KEY});
                    $odeComponentsSyncProperty->setValue($xmlOdeComponentProperty->{self::ODE_XML_TAG_FIELD_VALUE});

                    $odeComponentsSync->addOdeComponentsSyncProperties($odeComponentsSyncProperty);
                }

                $odePagStructureSync->addOdeComponentsSync($odeComponentsSync);
            }

            $odeNavStructureSync->addOdePagStructureSync($odePagStructureSync);
        }
        array_push($odeResponse['odeNavStructureSyncs'], $odeNavStructureSync);

        // Associate $odeNavStructureSync hierarchy
        foreach ($odeResponse['odeNavStructureSyncs'] as $odeNavStructureSync) {
            if (!empty($odeNavStructureSync->getOdeParentPageId())) {
                foreach ($odeResponse['odeNavStructureSyncs'] as $odeNavStructureSyncSearch) {
                    if ($odeNavStructureSyncSearch->getOdePageId() == $odeNavStructureSync->getOdeParentPageId()) {
                        $odeNavStructureSync->setOdeNavStructureSync($odeNavStructureSyncSearch);
                        break;
                    }
                }
            }
        }
        array_push($odeResponse['odeComponentsMapping'], $odeComponentsMapping);
        array_push($odeResponse['odeBlocksMapping'], $odeBlocksMapping);

        return $odeResponse;
    }

    /**
     * Applies the replaces passed as param.
     *
     * @param array       $replaces
     * @param string|null $text
     *
     * @return string|null
     */
    private static function applyReplaces($replaces, $text)
    {
        if (is_null($text)) {
            return null;
        }

        $result = $text;

        foreach ($replaces as $search => $replace) {
            $result = str_replace($search, $replace, $result);
        }

        return $result;
    }

    /**
     * Get text idevice on old elp and create component sync.
     *
     * @param string $odeSessionId
     * @param string $odePageId
     * @param object $nodeIdevice
     * @param object $subOdeNavStructureSync
     * @param array  $srcRoutes
     * @param string $xpathNamespace
     * @param array  $generatedIds
     *
     * @return array $result
     */
    private static function searchTextIdeviceOldElp($odeSessionId, $odePageId, $nodeIdevice, $subOdeNavStructureSync, $srcRoutes, $xpathNamespace, $generatedIds)
    {
        $result = [];

        $type = $nodeIdevice->xpath('f:dictionary/f:list/f:instance/@class');

        // Get blockName
        $blockNameNode = $nodeIdevice->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");
        if (!empty($type)) {
            $type = (string) $type[0];
        }

        switch ($type) {
            case 'exe.engine.field.TextAreaField':
                $nodeIdevicesText = $nodeIdevice->xpath("f:dictionary/f:list/f:instance[@class='exe.engine.field.TextAreaField']");
                foreach ($nodeIdevicesText as $nodeIdeviceText) {
                    // IDEVICE TEXT CONTENT
                    if ($nodeIdeviceText->{self::OLD_ODE_XML_DICTIONARY}->{self::OLD_ODE_XML_UNICODE}) {
                        $subOdePagStructureSync = new OdePagStructureSync();
                        $odeBlockId = Util::generateIdCheckUnique($generatedIds);
                        $generatedIds[] = $odeBlockId;

                        // OdePagStructureSync fields
                        $subOdePagStructureSync->setOdeSessionId($odeSessionId);
                        $subOdePagStructureSync->setOdePageId($odePageId);
                        $subOdePagStructureSync->setOdeBlockId($odeBlockId);
                        // $odePagStructureSync->setIconName($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ICON_NAME});

                        // $odeBlockTitle = $oldXmlListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}["value"][0];
                        $subOdePagStructureSync->setBlockName((string) $blockNameNode[0]);

                        $orderPage = (string) $nodeIdevice['reference'];
                        $subOdePagStructureSync->setOdePagStructureSyncOrder(intval($orderPage));

                        // Get pagStructureSync properties
                        $subOdePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();
                        // foreach($oldXmlListInstDict->{self::OLD_ODE_XML_UNICODE} as $oldXmlListInstDictUnicode){
                        //     // array_push($odeResponse, $oldXmlListInstDictUnicode);
                        //     if($oldXmlListInstDictUnicode["value"]) {
                        //         $odePagStructureSync->setBlockName($oldXmlListInstDictUnicode["value"]);
                        //     }

                        // }

                        $odeComponentsSync = new OdeComponentsSync();
                        $odeIdeviceId = Util::generateIdCheckUnique($generatedIds);
                        $generatedIds[] = $odeIdeviceId;
                        $odeComponentsMapping[] = $odeIdeviceId;

                        // OdeComponentsSync fields
                        $odeComponentsSync->setOdeSessionId($odeSessionId);
                        $odeComponentsSync->setOdePageId($odePageId);
                        $odeComponentsSync->setOdeBlockId($odeBlockId);
                        $odeComponentsSync->setOdeIdeviceId($odeIdeviceId);

                        // $odeComponentsSync->setJsonProperties($odeComponentsSyncJsonProperties);

                        $odeComponentsSync->setOdeComponentsSyncOrder(intval(1));
                        // Set type
                        $odeComponentsSync->setOdeIdeviceTypeName('text');

                        foreach ($nodeIdeviceText->{self::OLD_ODE_XML_DICTIONARY} as $oldXmlListDictListInstDictListInstDict) {
                            // $oldXmlListDictListInstDictListInstDict->registerXPathNamespace('f', $xpathNamespace);
                            // $fileTextPathToChange = $oldXmlListDictListInstDictListInstDict->xpath('//f:unicode[@content="true"]starts-with(@src,"resources/")]');
                            // src="resources/

                            $sessionPath = null;

                            if (!empty($odeSessionId)) {
                                $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
                            }

                            // Common replaces for all OdeComponents
                            $commonReplaces = [
                                'resources'.Constants::SLASH => $sessionPath.$odeIdeviceId.Constants::SLASH,
                            ];

                            $oldXmlListDictListInstDictListInstDict->registerXPathNamespace('f', $xpathNamespace);
                            $contentHtmlNode = $oldXmlListDictListInstDictListInstDict->xpath('f:string[@value="content_w_resourcePaths"]/
                            following-sibling::f:unicode[1]');

                            if (isset($contentHtmlNode)) {
                                if (isset($commonReplaces)) {
                                    $odeComponentsSyncHtmlView = self::applyReplaces($commonReplaces, $contentHtmlNode[0]['value']);
                                } else {
                                    $odeComponentsSyncHtmlView = $contentHtmlNode[0]['value'];
                                }

                                // Set different type if necessary
                                $nodeTextIdeviceType = self::changeTypeNodetextIdeviceOldElp($odeComponentsSync, $odeComponentsSyncHtmlView);
                                $odeComponentsSync = $nodeTextIdeviceType['odeComponentsSync'];
                                $odeComponentsSyncHtmlView = $nodeTextIdeviceType['odeComponentsSyncHtmlView'];
                                $nodeIdeviceTextType = $nodeTextIdeviceType['type'];

                                $prologue = '<?xml encoding="UTF-8">';
                                $html = $prologue.$odeComponentsSyncHtmlView;
                                $doc = new \DOMDocument();
                                @$doc->loadHTML($html);
                                $xpath = new \DOMXPath($doc);
                                $src = $xpath->evaluate('//img/@src', $doc); // "/images/image.jpg"
                                $href = $xpath->evaluate('//a/@href', $doc);
                                if ('scrambled-list' == $nodeIdeviceTextType) {
                                    $scrambleIdeviceElements = self::searchScrambleIdeviceElementsOldElp($xpath, $doc);

                                    $listOptions = $scrambleIdeviceElements['listOptions'];
                                    $scrambleInstructions = $scrambleIdeviceElements['scrambleInstructions'];
                                    $scrambleCorrect = $scrambleIdeviceElements['scrambleCorrect'];
                                    $scrambleWrong = $scrambleIdeviceElements['scrambleWrong'];
                                    $scrambleButton = $scrambleIdeviceElements['scrambleButton'];
                                    $scrambleAfterText = $scrambleIdeviceElements['scrambleAfterText'];
                                    $scrambleAfterElement = $scrambleIdeviceElements['scrambleAfterElement'];
                                }
                                // Get task information if pbl-task-description is in tags
                                $isTaskContent = str_contains($odeComponentsSyncHtmlView, 'pbl-task-description');
                                // task json info
                                $taskDuration = '';
                                $taskParticipants = '';
                                $taskDurationInput = '';
                                $taskParticipantsInput = '';
                                $textButtonFeedback = '';
                                $textFeedback = '';
                                if ($isTaskContent) {
                                    $taskIdeviceElements = self::searchTaskIdeviceElementsOldElp($xpath, $doc, $odeComponentsSyncHtmlView);

                                    $taskDuration = $taskIdeviceElements['taskDuration'];
                                    $taskParticipants = $taskIdeviceElements['taskParticipants'];
                                    $taskDurationInput = $taskIdeviceElements['taskDurationInput'];
                                    $taskParticipantsInput = $taskIdeviceElements['taskParticipantsInput'];
                                    $textButtonFeedback = $taskIdeviceElements['textButtonFeedback'];
                                    $textFeedback = $taskIdeviceElements['textFeedback'];
                                    $odeComponentsSyncHtmlView = $taskIdeviceElements['odeComponentsSyncHtmlView'];
                                }

                                foreach ($src as $srcValue) {
                                    $srcString = (string) $srcValue->value;
                                    array_push($srcRoutes, $srcString);
                                }

                                foreach ($href as $hrefValue) {
                                    $hrefString = (string) $hrefValue->value;
                                    array_push($srcRoutes, $hrefString);
                                }

                                // In case rubric change class exe-rubric to exe-rubrics
                                if ('rubric' == $nodeIdeviceTextType) {
                                    $odeComponentsSyncHtmlView = str_replace('exe-rubric', 'exe-rubrics', $odeComponentsSyncHtmlView);
                                }

                                if ('download-source-file' == $nodeIdeviceTextType) {
                                    $odeComponentsSyncHtmlView = str_replace('a href="exe-package:elp"', 'a download="exe-package:elp-name" href="exe-package:elp"', $odeComponentsSyncHtmlView);
                                }

                                $odeComponentsSync->setHtmlView($odeComponentsSyncHtmlView);
                                // Different json for scrambled list
                                if ('scrambled-list' !== $nodeIdeviceTextType) {
                                    // Rubric and download-source-file don't have json
                                    if ('rubric' !== $nodeIdeviceTextType && 'download-source-file' !== $nodeIdeviceTextType) {
                                        // Create jsonProperties for idevice
                                        $jsonProperties = [
                                            'ideviceId' => $odeIdeviceId,
                                            'textInfoDurationInput' => $taskDuration,
                                            'textInfoParticipantsInput' => $taskParticipants,
                                            'textInfoDurationTextInput' => $taskDurationInput,
                                            'textInfoParticipantsTextInput' => $taskParticipantsInput,
                                            'textTextarea' => $odeComponentsSyncHtmlView,
                                            'textFeedbackInput' => $textButtonFeedback,
                                            'textFeedbackTextarea' => $textFeedback,
                                        ];

                                        $jsonProperties = json_encode($jsonProperties, JSON_UNESCAPED_SLASHES);
                                        $odeComponentsSync->setJsonProperties($jsonProperties);
                                    }
                                } else {
                                    // Create jsonProperties for idevice
                                    $jsonProperties = [
                                        'instructions' => $scrambleInstructions,
                                        'options' => $listOptions,
                                        'buttonText' => $scrambleButton,
                                        'rightText' => $scrambleCorrect,
                                        'wrongText' => $scrambleWrong,
                                        'textAfter' => $scrambleAfterText,
                                        'afterElement' => $scrambleAfterElement,
                                    ];

                                    $jsonProperties = json_encode($jsonProperties, JSON_UNESCAPED_SLASHES);
                                    $odeComponentsSync->setJsonProperties($jsonProperties);
                                }

                                // OdeComponentsSync property fields
                                $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

                                // $oldXmlListDictListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}[1]["value"];
                                $subOdePagStructureSync->addOdeComponentsSync($odeComponentsSync);
                            }
                        }
                    }
                    if (isset($subOdePagStructureSync)) {
                        $subOdeNavStructureSync->addOdePagStructureSync($subOdePagStructureSync);
                    }
                }
                break;
        }

        $result['subOdeNavStructureSync'] = $subOdeNavStructureSync;
        $result['srcRoutes'] = $srcRoutes;

        return $result;
    }

    /**
     * Get elements necessaries to create task json.
     *
     * @param object $xpath
     * @param object $doc
     * @param string $odeComponentsSyncHtmlView
     *
     * @return array $result
     */
    private static function searchTaskIdeviceElementsOldElp($xpath, $doc, $odeComponentsSyncHtmlView)
    {
        $result = [];

        $taskDurationNode = $xpath->query('//dd[@class = "pbl-task-duration"]', $doc);
        $taskDurationInputNode = $xpath->query('//dt[@class = "pbl-task-duration"]', $doc);
        $taskParticipantsNode = $xpath->query('//dd[@class = "pbl-task-participants"]', $doc);
        $taskParticipantsInputNode = $xpath->query('//dt[@class = "pbl-task-participants"]', $doc);
        $taskTextFeedbackNode = $xpath->query('//div[@class = "feedback js-feedback js-hidden"]', $doc);
        $taskTextFeedbackButtonNode = $xpath->query('//input[@class = "feedbackbutton"]/@value', $doc);

        $taskDuration = '';
        $taskParticipants = '';
        $taskDurationInput = '';
        $taskParticipantsInput = '';
        $textButtonFeedback = '';
        $textFeedback = '';

        foreach ($taskDurationNode as $duration) {
            $taskDuration = $duration->nodeValue;
        }
        foreach ($taskDurationInputNode as $durationInput) {
            $taskDurationInput = $durationInput->nodeValue;
        }
        foreach ($taskParticipantsNode as $durationInput) {
            $taskParticipants = $durationInput->nodeValue;
        }
        foreach ($taskParticipantsInputNode as $durationInput) {
            $taskParticipantsInput = $durationInput->nodeValue;
        }
        foreach ($taskTextFeedbackNode as $feedback) {
            $textFeedback = $feedback->nodeValue;
        }
        foreach ($taskTextFeedbackButtonNode as $buttonValue) {
            $textButtonFeedback = $buttonValue->nodeValue;
        }

        // Remove task duration and group info from html
        $taskHtmlPos = strpos($odeComponentsSyncHtmlView, '<div class="pbl-task-description">');
        $odeComponentsSyncHtmlView = substr($odeComponentsSyncHtmlView, $taskHtmlPos);
        // Remove task feedback from html
        $taskHtmlButtonPos = strpos($odeComponentsSyncHtmlView, '<input type="button" class="feedbackbutton"');
        if (false !== $taskHtmlButtonPos) {
            $odeComponentsSyncHtmlView = substr($odeComponentsSyncHtmlView, 0, $taskHtmlButtonPos);
        }

        $result['taskDuration'] = $taskDuration;
        $result['taskParticipants'] = $taskParticipants;
        $result['taskDurationInput'] = $taskDurationInput;
        $result['taskParticipantsInput'] = $taskParticipantsInput;
        $result['textButtonFeedback'] = $textButtonFeedback;
        $result['textFeedback'] = $textFeedback;
        $result['odeComponentsSyncHtmlView'] = $odeComponentsSyncHtmlView;

        return $result;
    }

    /**
     * Get elements necessaries to create scramble list json.
     *
     * @param object $xpath
     * @param object $doc
     *
     * @return array $result
     */
    private static function searchScrambleIdeviceElementsOldElp($xpath, $doc)
    {
        $result = [];

        $instructions = $xpath->query('//div[@class = "exe-sortableList-instructions"]', $doc);
        $scrambleList = $xpath->query('//ul[@class = "exe-sortableList-list"]/li', $doc);
        $scrambleNodeCorrect = $xpath->query('//p[@class = "exe-sortableList-rightText"]', $doc);
        $scrambleNodeWrong = $xpath->query('//p[@class = "exe-sortableList-wrongText"]', $doc);
        $scrambleNodeButton = $xpath->query('//p[@class = "exe-sortableList-buttonText"]', $doc);
        $scrambleNodeAfterText = $xpath->query('//div[@class = "exe-sortableList-textAfter"]', $doc);
        $scrambleNodeAfterElement = $xpath->query('//div[@class = "exe-sortableList-textAfter"]', $doc);

        $listOptions = [];
        $scrambleInstructions = '';
        $scrambleCorrect = '';
        $scrambleWrong = '';
        $scrambleButton = '';
        $scrambleAfterText = '';
        $scrambleAfterElement = '';
        foreach ($instructions as $instruction) {
            $scrambleInstructions = $instruction->nodeValue;
        }
        foreach ($scrambleList as $option) {
            array_push($listOptions, $option->nodeValue);
        }
        foreach ($scrambleNodeCorrect as $node) {
            $scrambleCorrect = $node->nodeValue;
        }
        foreach ($scrambleNodeWrong as $node) {
            $scrambleWrong = $node->nodeValue;
        }
        foreach ($scrambleNodeButton as $node) {
            $scrambleButton = $node->nodeValue;
        }
        foreach ($scrambleNodeAfterElement as $node) {
            $scrambleAfterElement = trim($doc->saveHTML($node));
        }
        foreach ($scrambleNodeAfterText as $node) {
            $scrambleAfterText = $node->nodeValue;
        }

        $result['listOptions'] = $listOptions;
        $result['scrambleInstructions'] = $scrambleInstructions;
        $result['scrambleCorrect'] = $scrambleCorrect;
        $result['scrambleWrong'] = $scrambleWrong;
        $result['scrambleButton'] = $scrambleButton;
        $result['scrambleAfterElement'] = $scrambleAfterElement;
        $result['scrambleAfterText'] = $scrambleAfterText;

        return $result;
    }

    /**
     * Examines text to determine type of component.
     *
     * @param object $odeComponentsSync
     * @param string $odeComponentsSyncHtmlView
     *
     * @return array $result
     */
    private static function changeTypeNodetextIdeviceOldElp($odeComponentsSync, $odeComponentsSyncHtmlView)
    {
        $result = [];
        // Set default value type to text
        $result['type'] = 'text';

        // Ensure haystack is a string
        $haystack = $odeComponentsSyncHtmlView ?? '';

        // Change type to udl if udl-content is in tags
        $isUdlContent = str_contains($haystack, 'exe-udlContent');
        if ($isUdlContent) {
            // Set type
            $result['type'] = 'udl-content';
            $odeComponentsSync->setOdeIdeviceTypeName('udl-content');
        }
        // Change type to scrambled if exe-sortableList is in tags
        $isScrambleContent = str_contains($haystack, 'exe-sortableList');
        if ($isScrambleContent) {
            // Set type
            $result['type'] = 'scrambled-list';
            $odeComponentsSync->setOdeIdeviceTypeName('scrambled-list');
        }
        // Change type to rubric if exe-rubric-strings is in tags
        $isRubricContent = str_contains($haystack, 'exe-rubric-strings');
        if ($isRubricContent) {
            // Set type
            $result['type'] = 'rubric';
            $odeComponentsSync->setOdeIdeviceTypeName('rubric');
        }
        // Change type to download-source-file if exe-download-package-instructions is in tags
        $isDownloadFileContent = str_contains($haystack, 'exe-download-package-instructions');
        if ($isDownloadFileContent) {
            // Set type
            $result['type'] = 'download-source-file';
            $odeComponentsSync->setOdeIdeviceTypeName('download-source-file');
        }
        // Change type to quick-questions-video if vquext-IDevice is in tags
        $isQuickVideoContent = str_contains($haystack, 'vquext-IDevice');
        if ($isQuickVideoContent) {
            // Set type
            $result['type'] = 'quick-questions-video';
            $odeComponentsSync->setOdeIdeviceTypeName('quick-questions-video');
        }
        // Change type to interactive-video if exe-interactive-video is in tags
        $isInteractiveVideoContent = str_contains($haystack, 'exe-interactive-video');
        if ($isInteractiveVideoContent) {
            // Set type
            $odeComponentsSync->setOdeIdeviceTypeName('interactive-video');
            $result['type'] = 'interactive-video';
            // Change html cdata var interactiveVideo
            $originalHtml = $haystack;

            $pattern = '#<script[^>]*>//<!\[CDATA\[\s*var\s+InteractiveVideo\s*=\s*(\{(?:[^{}]|(?1))*\})\s*//\]\]></script>#';

            $replacement = '<div id="exe-interactive-video-contents" style="display: none">$1</div>';

            $new = @preg_replace($pattern, $replacement, $originalHtml);

            $haystack = (null === $new) ? $originalHtml : $new;
        }

        $isGeogebra = str_contains($haystack, 'auto-geogebra');
        if ($isGeogebra) {
            $result['type'] = 'geogebra-activity';
            $odeComponentsSync->setOdeIdeviceTypeName('geogebra-activity');
        }

        $isRoscoContent = str_contains($haystack, 'rosco-IDevice');
        if ($isRoscoContent) {
            $result['type'] = 'az-quiz-game';
            $odeComponentsSync->setOdeIdeviceTypeName('az-quiz-game');
        }

        $isQuickContent = str_contains($haystack, 'quext-IDevice');
        if ($isQuickContent && !$isQuickVideoContent) {
            $result['type'] = 'quick-questions';
            $odeComponentsSync->setOdeIdeviceTypeName('quick-questions');
        }

        $isDesafioContent = str_contains($haystack, 'desafio-IDevice');
        if ($isDesafioContent) {
            $result['type'] = 'challenge';
            $odeComponentsSync->setOdeIdeviceTypeName('challenge');
        }

        $isCandadoContent = str_contains($haystack, 'candado-IDevice');
        if ($isCandadoContent) {
            $result['type'] = 'padlock';
            $odeComponentsSync->setOdeIdeviceTypeName('padlock');
        }

        $isGueesContent = str_contains($haystack, 'adivina-IDevice');
        if ($isGueesContent) {
            $result['type'] = 'guess';
            $odeComponentsSync->setOdeIdeviceTypeName('guess');
        }

        $isSelectContent = str_contains($haystack, 'selecciona-IDevice');
        if ($isSelectContent) {
            $result['type'] = 'quick-questions-multiple-choice';
            $odeComponentsSync->setOdeIdeviceTypeName('quick-questions-multiple-choice');
        }

        $isClassifyContent = str_contains($haystack, 'clasifica-IDevice');
        if ($isClassifyContent) {
            $result['type'] = 'classify';
            $odeComponentsSync->setOdeIdeviceTypeName('classify');
        }

        $isCompleteContent = str_contains($haystack, 'completa-IDevice');
        if ($isCompleteContent) {
            $result['type'] = 'complete';
            $odeComponentsSync->setOdeIdeviceTypeName('complete');
        }

        $isDiscoverContent = str_contains($haystack, 'descubre-IDevice');
        if ($isDiscoverContent) {
            $result['type'] = 'discover';
            $odeComponentsSync->setOdeIdeviceTypeName('discover');
        }

        $isIdentifyContent = str_contains($haystack, 'identifica-IDevice');
        if ($isIdentifyContent) {
            $result['type'] = 'identify';
            $odeComponentsSync->setOdeIdeviceTypeName('identify');
        }

        $isMathproblemsContent = str_contains($haystack, 'mathproblems-IDevice');
        if ($isMathproblemsContent) {
            $result['type'] = 'mathproblems';
            $odeComponentsSync->setOdeIdeviceTypeName('mathproblems');
        }

        $isMathOperationsContent = str_contains($haystack, 'mathoperations-IDevice');
        if ($isMathOperationsContent) {
            $result['type'] = 'mathematicaloperations';
            $odeComponentsSync->setOdeIdeviceTypeName('mathematicaloperations');
        }

        $isFlipCardsContent = str_contains($haystack, 'flipcards-IDevice');
        if ($isFlipCardsContent) {
            $result['type'] = 'flipcards';
            $odeComponentsSync->setOdeIdeviceTypeName('flipcards');
        }

        $isRelateContent = str_contains($haystack, 'relaciona-IDevice');
        if ($isRelateContent) {
            $result['type'] = 'relate';
            $odeComponentsSync->setOdeIdeviceTypeName('relate');
        }

        $isWordSearchContent = str_contains($haystack, 'sopa-IDevice');
        if ($isWordSearchContent) {
            $result['type'] = 'word-search';
            $odeComponentsSync->setOdeIdeviceTypeName('word-search');
        }

        $isTrivilaContent = str_contains($haystack, 'trivial-IDevice');
        if ($isTrivilaContent) {
            $result['type'] = 'trivial';
            $odeComponentsSync->setOdeIdeviceTypeName('trivial');
        }

        $isSortContent = str_contains($haystack, 'ordena-IDevice');
        if ($isSortContent) {
            $result['type'] = 'sort';
            $odeComponentsSync->setOdeIdeviceTypeName('sort');
        }

        $isSelectMediaContent = str_contains($haystack, 'seleccionamedias-IDevice');
        if ($isSelectMediaContent) {
            $result['type'] = 'select-media-files';
            $odeComponentsSync->setOdeIdeviceTypeName('select-media-files');
        }

        $isMapContent = str_contains($haystack, 'mapa-IDevice');
        if ($isMapContent) {
            $result['type'] = 'map';
            $odeComponentsSync->setOdeIdeviceTypeName('map');
        }

        $isCheckListContent = str_contains($haystack, 'listacotejo-IDevice');
        if ($isCheckListContent) {
            $result['type'] = 'checklist';
            $odeComponentsSync->setOdeIdeviceTypeName('checklist');
        }

        $isCheckListContent = str_contains($haystack, 'informe-IDevice');
        if ($isCheckListContent) {
            $result['type'] = 'progress-report';
            $odeComponentsSync->setOdeIdeviceTypeName('progress-report');
        }

        $isPuzzleContent = str_contains($haystack, 'puzzle-IDevice');
        if ($isPuzzleContent) {
            $result['type'] = 'puzzle';
            $odeComponentsSync->setOdeIdeviceTypeName('puzzle');
        }

        $isCrosswordContent = str_contains($haystack, 'crucigrama-IDevice');
        if ($isCrosswordContent) {
            $result['type'] = 'crossword';
            $odeComponentsSync->setOdeIdeviceTypeName('crossword');
        }

        $result['odeComponentsSync'] = $odeComponentsSync;
        $result['odeComponentsSyncHtmlView'] = $haystack;

        return $result;
    }

    /**
     * Get type of game idevice and create component sync.
     *
     * @param string $odeSessionId
     * @param string $odePageId
     * @param object $nodeIdevice
     * @param object $subOdeNavStructureSync
     * @param array  $srcRoutes
     * @param string $xpathNamespace
     * @param array  $generatedIds
     *
     * @return array $result
     */
    private static function searchGameIdeviceOldElp($odeSessionId, $odePageId, $nodeIdevice, $subOdeNavStructureSync, $srcRoutes, $xpathNamespace, $generatedIds)
    {
        $result = [];

        $type = $nodeIdevice->xpath('f:dictionary/f:unicode/@value');
        if (!empty($type)) {
            $type = (string) $type[0];
        }

        if (!empty($gameIdeviceResult)) {
            foreach ($gameIdeviceResult['odeComponentsSync'] as $odeComponentSync) {
                $subOdeNavStructureSync->addOdePagStructureSync($odeComponentSync);
            }
            foreach ($gameIdeviceResult['srcRoutes'] as $srcRoute) {
                array_push($srcRoutes, $srcRoute);
            }
            $nodeIdevice = null;
        }

        $result['subOdeNavStructureSync'] = $subOdeNavStructureSync;
        $result['srcRoutes'] = $srcRoutes;
        $result['nodeIdevice'] = $nodeIdevice;

        return $result;
    }

    /**
     * Create component sync from dropdown idevices.
     *
     * @param string $odeSessionId
     * @param string $odePageId
     * @param object $subOdeNavStructureSync
     * @param array  $srcRoutes
     * @param string $xpathNamespace
     * @param array  $generatedIds
     *
     * @return array $result
     */
    private static function searchDropdownActivityOldElp($odeSessionId, $odePageId, $nodeIdevicesNotaInfo, $subOdeNavStructureSync, $srcRoutes, $xpathNamespace, $generatedIds)
    {
        $result = [];

        // dropdown activity
        foreach ($nodeIdevicesNotaInfo as $nodeIdeviceNotaInfo) {
            $nodeIdeviceNotaInfo->registerXPathNamespace('f', $xpathNamespace);
            $isDropdown = $nodeIdeviceNotaInfo->xpath("f:dictionary/f:unicode[@value='DropDown Activity']");

            // To review mn: If $isDropdown isn’t set, check the XML for a “Dropdown” marker
            if (!$isDropdown || empty($isDropdown)) {
                $isDropdown = $nodeIdeviceNotaInfo->xpath(".//f:unicode[@value='Dropdown']");
            }

            if ($isDropdown) {
                $result = OdeOldXmlDropdownIdevice::oldElpDropdownIdeviceStructure($odeSessionId, $odePageId, $nodeIdeviceNotaInfo, $generatedIds, $xpathNamespace);
                foreach ($result['odeComponentsSync'] as $odeComponentSync) {
                    $subOdeNavStructureSync->addOdePagStructureSync($odeComponentSync);
                }
                foreach ($result['srcRoutes'] as $srcRoute) {
                    array_push($srcRoutes, $srcRoute);
                }
                array_shift($nodeIdevicesNotaInfo);
            }
        }
        $result['subOdeNavStructureSync'] = $subOdeNavStructureSync;
        $result['srcRoutes'] = $srcRoutes;
        $result['nodeIdevicesNotaInfo'] = $nodeIdevicesNotaInfo;

        return $result;
    }

    /**
     * Create component sync from diferent types of idevices.
     *
     * @param array  $types
     * @param object $oldXmlListInstDictList
     * @param string $odeSessionId
     * @param string $odePageId
     * @param array  $generatedIds
     * @param string $xpathNamespace
     *
     * @return array $result
     */
    private static function getComponentSyncFromNode($types, $references, $oldXmlListInstDictList, $odeSessionId, $odePageId, $generatedIds, $xpathNamespace)
    {
        $result = [];

        for ($i = 0; $i < count($types); ++$i) {
            if (!empty($references[$i])) {
                $node = $oldXmlListInstDictList->xpath("f:instance[@class='".$types[$i][0]."'][@reference= '".$references[$i][0]."']");
            } else {
                $node = $oldXmlListInstDictList->xpath("f:instance[@class='".$types[$i][0]."']");
            }

            switch ($types[$i]) {
                // Get fill idevices
                case 'exe.engine.clozeidevice.ClozeIdevice':
                    $odeComponentSyncResult = OdeOldXmlFillIdevice::oldElpFillIdeviceStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get image magnifier idevices
                case 'exe.engine.imagemagnifieridevice.ImageMagnifierIdevice':
                    $odeComponentSyncResult = OdeOldXmlImageMagnifierIdevice::oldElpImageMagnifierIdeviceStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get free text idevices and process
                case 'exe.engine.freetextidevice.FreeTextIdevice':
                    $odeComponentSyncResult = OdeOldXmlFreeTextIdevice::oldElpFreeTextIdeviceStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get generic idevices and process
                case 'exe.engine.genericidevice.GenericIdevice':
                    $odeComponentSyncResult = OdeOldXmlGenericIdevice::oldElpGenericIdeviceStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get case study idevices and process
                case 'exe.engine.casestudyidevice.CasestudyIdevice':
                    $odeComponentSyncResult = OdeOldXmlCaseStudyIdevice::oldElpCaseStudyStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get rss idevices and process
                case 'exe.engine.rssidevice.RssIdevice':
                    $odeComponentSyncResult = OdeOldXmlRssIdevice::oldElpRssStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get wikipedia idevices and process
                case 'exe.engine.wikipediaidevice.WikipediaIdevice':
                    $odeComponentSyncResult = OdeOldXmlWikipediaIdevice::oldElpWikipediaStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get java application idevice
                case 'exe.engine.appletidevice.AppletIdevice':
                    $odeComponentSyncResult = OdeOldXmlJavaAppIdevice::oldElpJavaAppIdeviceStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get true false idevice
                case 'exe.engine.truefalseidevice.TrueFalseIdevice':
                    $odeComponentSyncResult = OdeOldXmlTrueFalseIdevice::oldElpTrueFalseStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get selection multiple idevice
                case 'exe.engine.multichoiceidevice.MultichoiceIdevice':
                    $odeComponentSyncResult = OdeOldXmlMultipleSelectionIdevice::oldElpMultipleSelectionStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get multiple answer idevice
                case 'exe.engine.multiselectidevice.MultiSelectIdevice':
                    $odeComponentSyncResult = OdeOldXmlMultipleAnswerIdevice::oldElpMultipleAnswerStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get File attach idevice
                case 'exe.engine.fileattachidevice.FileAttachIdeviceInc':
                    $odeComponentSyncResult = OdeOldXmlFileAttachIdevice::oldElpFileAttachIdeviceStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get external url idevices
                case 'exe.engine.externalurlidevice.ExternalUrlIdevice':
                    $odeComponentSyncResult = OdeOldXmlExternalUrlIdevice::oldElpExternalUrlIdeviceStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get image gallery idevices
                case 'exe.engine.galleryidevice.GalleryIdevice':
                    $odeComponentSyncResult = OdeOldXmlGalleryImageIdevice::oldElpGalleryImageIdeviceStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get scorm test idevices
                case 'exe.engine.quiztestidevice.QuizTestIdevice':
                    $odeComponentSyncResult = OdeOldXmlScormTestIdevice::oldElpScormTestStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get fill fpd idevice
                case 'exe.engine.clozefpdidevice.ClozefpdIdevice':
                    // Same as fill idevice
                    $odeComponentSyncResult = OdeOldXmlFillIdevice::oldElpFillIdeviceStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get fpd selection multiple idevices
                case 'exe.engine.seleccionmultiplefpdidevice.SeleccionmultiplefpdIdevice':
                    // Same as multiple answer idevice
                    $odeComponentSyncResult = OdeOldXmlMultipleAnswerIdevice::oldElpMultipleAnswerStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get fpd selection multiple idevices
                case 'exe.engine.eleccionmultiplefpdidevice.EleccionmultiplefpdIdevice':
                    // Same as multiple selection idevice
                    $odeComponentSyncResult = OdeOldXmlMultipleSelectionIdevice::oldElpMultipleSelectionStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get fill fpd second type idevice
                case 'exe.engine.clozelangfpdidevice.ClozelangfpdIdevice':
                    $odeComponentSyncResult = OdeOldXmlFpdFillSecondTypeIdevice::oldElpFpdFillSecondTypeIdeviceStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get reflection idevice and situation, quotes to think, must know, highlighted,
                    // guidelines for teacher, guidelines for students, a step ahead,
                    // an advice, think about it, think about it (without feedback), free text fpd idevice
                case 'exe.engine.reflectionidevice.ReflectionIdevice':
                case 'exe.engine.casopracticofpdidevice.CasopracticofpdIdevice':
                case 'exe.engine.citasparapensarfpdidevice.CitasparapensarfpdIdevice':
                case 'exe.engine.debesconocerfpdidevice.DebesconocerfpdIdevice':
                case 'exe.engine.destacadofpdidevice.DestacadofpdIdevice':
                case 'exe.engine.orientacionestutoriafpdidevice.OrientacionestutoriafpdIdevice':
                case 'exe.engine.orientacionesalumnadofpdidevice.OrientacionesalumnadofpdIdevice':
                case 'exe.engine.parasabermasfpdidevice.ParasabermasfpdIdevice':
                case 'exe.engine.recomendacionfpdidevice.RecomendacionfpdIdevice':
                case 'exe.engine.reflectionfpdidevice.ReflectionfpdIdevice':
                case 'exe.engine.reflectionfpdmodifidevice.ReflectionfpdmodifIdevice':
                case 'exe.engine.freetextfpdidevice.FreeTextfpdIdevice':
                    // Same as free text idevice
                    $odeComponentSyncResult = OdeOldXmlFreeTextIdevice::oldElpFreeTextIdeviceStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get true false fpd idevice
                case 'exe.engine.verdaderofalsofpdidevice.VerdaderofalsofpdIdevice':
                    // Same as true false idevice
                    $odeComponentSyncResult = OdeOldXmlTrueFalseIdevice::oldElpTrueFalseStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // Get solved exercises fpd idevice
                case 'exe.engine.ejercicioresueltofpdidevice.EjercicioresueltofpdIdevice':
                    $odeComponentSyncResult = OdeOldXmlFpdSolvedExerciseIdevice::oldElpFpdSolvedExerciseIdeviceStructure($odeSessionId, $odePageId, $node, $generatedIds, $xpathNamespace);
                    array_push($result, $odeComponentSyncResult);
                    break;

                    // In case of default break
                default:
                    break;
            }
        }

        return $result;
    }
}
