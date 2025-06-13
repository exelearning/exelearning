<?php

namespace App\Util\net\exelearning\Util;

use App\Constants;
use App\Entity\net\exelearning\Dto\ThemeDto;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Properties;
use App\Settings;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * ExportXmlUtil.
 *
 * Utility functions for working with xml of Odes
 */
class ExportXmlUtil
{
    // ///////////////////////////////////////////////////////////////////////////////////
    // XML
    // ///////////////////////////////////////////////////////////////////////////////////

    /**
     * Generate SCORM 1.2 imsmanifest.xml file.
     *
     * @param string              $odeId
     * @param OdeNavStructureSync $odeNavStructureSyncs
     * @param array               $pagesFileData
     * @param array               $odeProperties
     * @param string              $elpFileName
     * @param string              $resourcesPrefix
     * @param string              $exportType
     * @param string              $exportDirPath
     * @param array               $idevicesMapping
     * @param array               $idevicesByPage
     *
     * @return SimpleXMLElement
     */
    public static function createSCORM12imsmanifest(
        $odeId,
        $odeNavStructureSyncs,
        $pagesFileData,
        $odeProperties,
        $elpFileName,
        $resourcesPrefix,
        $exportType,
        $exportDirPath,
        $idevicesMapping,
        $idevicesByPage,
    ) {
        $manifest = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><manifest></manifest>');

        // manifest attributes
        $manifest->addAttribute('identifier', 'eXe-MANIFEST-'.$odeId);
        $manifest->addAttribute('xmlns', 'http://www.imsproject.org/xsd/imscp_rootv1p1p2');
        $manifest->addAttribute('xmlns:xmlns:adlcp', 'http://www.adlnet.org/xsd/adlcp_rootv1p2');
        $manifest->addAttribute('xmlns:xmlns:imsmd', 'http://www.imsglobal.org/xsd/imsmd_v1p2');
        $manifest->addAttribute('xmlns:xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
        $schemaLocation = '';
        $schemaLocation .= 'http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd ';
        $schemaLocation .= 'http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd ';
        $schemaLocation .= 'http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd';
        $manifest->addAttribute('xsi:xsi:schemaLocation', $schemaLocation);

        // manifest -> metadata
        $metadata = $manifest->addChild('metadata');
        $schema = $metadata->addChild('schema', 'ADL SCORM');
        $schemaversion = $metadata->addChild('schemaversion', '1.2');
        $adclLocation = $metadata->addChild('adlcp:adlcp:location', 'imslrm.xml');

        // manifest -> organization
        self::addImsmanifestOrganization(
            $manifest,
            $odeId,
            $odeProperties,
            $odeNavStructureSyncs,
            $pagesFileData,
            $exportType
        );

        // manifest -> resources
        self::addImsmanifestResources(
            $manifest,
            $exportDirPath,
            $odeNavStructureSyncs,
            $pagesFileData,
            $exportType,
            $idevicesMapping,
            $idevicesByPage,
            $odeProperties
        );

        return $manifest;
    }

    /**
     * Generate SCORM 2004 imsmanifest.xml file.
     *
     * @param string              $odeId
     * @param OdeNavStructureSync $odeNavStructureSyncs
     * @param array               $pagesFileData
     * @param array               $odeProperties
     * @param string              $elpFileName
     * @param string              $resourcesPrefix
     * @param string              $exportType
     * @param string              $exportDirPath
     * @param array               $idevicesMapping
     * @param array               $idevicesByPage
     *
     * @return SimpleXMLElement
     */
    public static function createSCORM2004imsmanifest(
        $odeId,
        $odeNavStructureSyncs,
        $pagesFileData,
        $odeProperties,
        $elpFileName,
        $resourcesPrefix,
        $exportType,
        $exportDirPath,
        $idevicesMapping,
        $idevicesByPage,
    ) {
        $manifest = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><manifest></manifest>');

        // manifest attributes
        $manifest->addAttribute('identifier', 'eXe-MANIFEST-'.$odeId);
        $manifest->addAttribute('xmlns', 'http://www.imsglobal.org/xsd/imscp_v1p1');
        $manifest->addAttribute('xmlns:xmlns:adlcp', 'http://www.adlnet.org/xsd/adlcp_v1p3');
        $manifest->addAttribute('xmlns:xmlns:adlseq', 'http://www.adlnet.org/xsd/adlseq_v1p3');
        $manifest->addAttribute('xmlns:xmlns:imsss', 'http://www.imsglobal.org/xsd/imsss');
        $manifest->addAttribute('xmlns:xmlns:lom', 'http://ltsc.ieee.org/xsd/LOM');
        $manifest->addAttribute('xmlns:xmlns:lomes', 'http://ltsc.ieee.org/xsd/LOM');
        $manifest->addAttribute('xmlns:xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
        $schemaLocation = '';
        $schemaLocation .= 'http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd ';
        $schemaLocation .= 'http://ltsc.ieee.org/xsd/LOM lomCustom.xsd ';
        $schemaLocation .= 'http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd ';
        $schemaLocation .= 'http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd ';
        $schemaLocation .= 'http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd';
        $manifest->addAttribute('xsi:xsi:schemaLocation', $schemaLocation);

        // manifest -> metadata
        $metadata = $manifest->addChild('metadata');
        $schema = $metadata->addChild('schema', 'ADL SCORM');
        $schemaversion = $metadata->addChild('schemaversion', '2004 4th Edition');
        $adclLocation = $metadata->addChild('adlcp:adlcp:location', 'imslrm.xml');

        // manifest -> organization
        self::addImsmanifestOrganization(
            $manifest,
            $odeId,
            $odeProperties,
            $odeNavStructureSyncs,
            $pagesFileData,
            $exportType
        );

        // manifest -> resources
        self::addImsmanifestResources(
            $manifest,
            $exportDirPath,
            $odeNavStructureSyncs,
            $pagesFileData,
            $exportType,
            $idevicesMapping,
            $idevicesByPage,
            $odeProperties
        );

        return $manifest;
    }

    /**
     * Generate IMS CP imsmanifest.xml file.
     *
     * @param string              $odeId
     * @param OdeNavStructureSync $odeNavStructureSyncs
     * @param array               $pagesFileData
     * @param array               $odeProperties
     * @param string              $elpFileName
     * @param string              $resourcesPrefix
     * @param string              $exportType
     * @param string              $exportDirPath
     * @param array               $idevicesMapping
     * @param array               $idevicesByPage
     *
     * @return SimpleXMLElement
     */
    public static function createIMSimsmanifest(
        $odeId,
        $odeNavStructureSyncs,
        $pagesFileData,
        $odeProperties,
        $elpFileName,
        $resourcesPrefix,
        $exportType,
        $exportDirPath,
        $idevicesMapping,
        $idevicesByPage,
    ) {
        $manifest = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><manifest></manifest>');

        // manifest attributes
        $manifest->addAttribute('identifier', 'eXe-MANIFEST-'.$odeId);
        $manifest->addAttribute('xmlns', 'http://www.imsglobal.org/xsd/imscp_v1p1');
        $manifest->addAttribute('xmlns:xmlns:imsmd', 'http://www.imsglobal.org/xsd/imsmd_v1p2');
        $manifest->addAttribute('xmlns:xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
        $manifest->addAttribute('xmlns:xmlns:lom', 'http://ltsc.ieee.org/xsd/LOM');
        $schemaLocation = '';
        $schemaLocation .= 'http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd ';
        $schemaLocation .= 'http://www.imsglobal.org/xsd/imsmd_v1p2 imsmd_v1p2p2.xsd';
        $manifest->addAttribute('xsi:xsi:schemaLocation', $schemaLocation);

        // manifest -> metadata
        $metadata = $manifest->addChild('metadata');
        $schema = $metadata->addChild('schema', 'IMS Content');
        $schemaversion = $metadata->addChild('schemaversion', '1.1.3');

        // manifest -> metadata -> lom
        self::addImsmanifestMetadataLOM(
            $metadata,
            $odeId,
            $odeProperties
        );

        // manifest -> organization
        self::addImsmanifestOrganization(
            $manifest,
            $odeId,
            $odeProperties,
            $odeNavStructureSyncs,
            $pagesFileData,
            $exportType
        );

        // manifest -> resources
        self::addImsmanifestResources(
            $manifest,
            $exportDirPath,
            $odeNavStructureSyncs,
            $pagesFileData,
            $exportType,
            $idevicesMapping,
            $idevicesByPage,
            $odeProperties
        );

        return $manifest;
    }

    /**
     * Add lom metadata to manifest xml.
     *
     * @param SimpleXMLElement $metadata
     * @param string           $odeId
     * @param array            $odeProperties
     *
     * @return void
     */
    private static function addImsmanifestMetadataLOM(
        &$metadata,
        $odeId,
        $odeProperties,
    ) {
        // manifest -> metadata -> lom
        $lom = $metadata->addChild('lom:lom:lom', '');

        // manifest -> metadata -> lom -> general
        $general = $lom->addChild('lom:lom:general', '');
        $general->addAttribute('uniqueElementName', 'general');

        // manifest -> metadata -> lom -> general -> identifier
        $identifier = $general->addChild('lom:lom:identifier', '');

        $catalogNameValue = isset($odeProperties['lom_general_identifier_catalog'])
            ? $odeProperties['lom_general_identifier_catalog']->getValue() : Constants::ELP_PROPERTIES_NO_CATALOG_NAME;
        $catalog = $identifier->addChild('lom:lom:catalog', $catalogNameValue);
        $catalog->addAttribute('uniqueElementName', 'catalog');

        $catalogEntryValue = isset($odeProperties['lom_general_identifier_entry'])
            ? $odeProperties['lom_general_identifier_entry']->getValue() : 'ODE-'.$odeId;
        $entry = $identifier->addChild('lom:lom:entry', $catalogEntryValue);
        $entry->addAttribute('uniqueElementName', 'entry');

        // manifest -> metadata -> lom -> general -> title
        $title = $general->addChild('lom:lom:title', '');

        $titleElement = $odeProperties['pp_title'];
        $titleValue = isset($titleElement) ? $titleElement->getValue() : 'eXe-p-'.$odeId;
        $titleString = $title->addChild('lom:lom:string', $titleValue);

        $titleLang = $odeProperties['pp_lang']; // todo -> title lang property
        $titleLang = isset($titleLang) ? $titleLang->getValue() : Settings::DEFAULT_LOCALE;
        $titleString->addAttribute('language', $titleLang);

        // manifest -> metadata -> lom -> general -> language
        $generalLang = $odeProperties['pp_lang'];
        $generalLang = isset($generalLang) ? $generalLang->getValue() : Settings::DEFAULT_LOCALE;
        $language = $general->addChild('lom:lom:language', $generalLang);
    }

    /**
     * Add pages organization to manifest xml.
     *
     * @param SimpleXMLElement    $manifest
     * @param string              $odeId
     * @param array               $odeProperties
     * @param OdeNavStructureSync $odeNavStructureSyncs
     * @param array               $pagesFileData
     * @param string              $exportType
     *
     * @return void
     */
    private static function addImsmanifestOrganization(
        &$manifest,
        $odeId,
        $odeProperties,
        $odeNavStructureSyncs,
        $pagesFileData,
        $exportType,
    ) {
        $organizations = $manifest->addChild('organizations');
        $organizations->addAttribute('default', 'eXe-'.$odeId);

        $organization = $organizations->addChild('organization');
        $organization->addAttribute('identifier', 'eXe-'.$odeId);
        $organization->addAttribute('structure', 'hierarchical');

        $titleElement = $odeProperties['pp_title'];
        $titleValue = isset($titleElement) ? $titleElement->getValue() : 'eXe-p-'.$odeId;
        $title = $organization->addChild('title', $titleValue);

        $visiblesPages = [];
        $indexNode = 0;

        foreach ($pagesFileData as $key => $pageData) {
            if (self::isVisibleExport($odeNavStructureSyncs, $indexNode)) {
                $url = $pageData['fileUrl'];
                // Add the page to the visibles pages and link it with the previous page and the next page
                $visiblesPages[$key] = ['url' => $url];
            }
            ++$indexNode;
        }

        // Pages organization
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            if (isset($visiblesPages[$odeNavStructureSync->getOdePageId()])) {
                // Page properties
                $pageProperties = $odeNavStructureSync->getOdeNavStructureSyncProperties();
                $pagePropertiesDict = [];
                foreach ($pageProperties as $property) {
                    if ($property->getValue()) {
                        $pagePropertiesDict[$property->getKey()] = $property->getValue();
                    }
                }

                // Page data
                $odePageId = $odeNavStructureSync->getOdePageId();
                $odePageName = $odeNavStructureSync->getPageName();
                $pageData = $pagesFileData[$odePageId];

                // Add item to XML manifest

                $odeParentPageId = $odeNavStructureSync->getOdeParentPageId();
                // If it has no parent node, it is first-level
                if (null == $odeParentPageId) {
                    $item = $organization->addChild('item');
                } else {
                    //  Search for the parent node of the current one
                    $parentNodes = $organization->xpath('//item[@identifier="ITEM-'.$odeParentPageId.'"]');
                    $parentNode = $parentNodes[0];
                    $item = $parentNode->addChild('item');
                }

                $item->addAttribute('identifier', 'ITEM-'.$odePageId);
                $item->addAttribute('identifierref', 'RES-'.$odePageId);

                $visible = 'true';
                if (
                    isset($pagePropertiesDict['visibility'])
                    && 'false' === $pagePropertiesDict['visibility']
                ) {
                    $visible = 'false';
                }

                $item->addAttribute('isvisible', $visible);

                $title = $item->addChild('title', $odePageName);
            }
        }

        if (Constants::EXPORT_TYPE_SCORM2004 == $exportType) {
            $sequencing = $organization->addChild('imsss:sequencing');
            $controlMode = $sequencing->addChild('imsss:controlMode');
            $controlMode->addAttribute('choice', 'true');
            $controlMode->addAttribute('choiceExit', 'true');
            $controlMode->addAttribute('flow', 'true');
            $controlMode->addAttribute('forwardOnly', 'false');
        }
    }

    /**
     * Add pages resources to manifest xml.
     *
     * @param SimpleXMLElement    $manifest
     * @param string              $exportDirPath
     * @param OdeNavStructureSync $odeNavStructureSyncs
     * @param array               $pagesFileData
     * @param string              $exportType
     * @param array               $idevicesMapping
     * @param array               $idevicesByPage
     * @param array               $odeProperties
     *
     * @return void
     */
    private static function addImsmanifestResources(
        &$manifest,
        $exportDirPath,
        $odeNavStructureSyncs,
        $pagesFileData,
        $exportType,
        $idevicesMapping,
        $idevicesByPage,
        $odeProperties,
    ) {
        $resources = $manifest->addChild('resources');

        // Pages resources
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            // Page data
            $odePageId = $odeNavStructureSync->getOdePageId();
            $odePageName = $odeNavStructureSync->getPageName();
            $pageData = $pagesFileData[$odePageId];

            $resource = $resources->addChild('resource');
            $resource->addAttribute('identifier', 'RES-'.$odePageId);
            $resource->addAttribute('type', 'webcontent');

            if (in_array($exportType, [Constants::EXPORT_TYPE_SCORM12, Constants::EXPORT_TYPE_SCORM2004])) {
                // The next code is an example of how to add a namespace to the attribute
                // $adlcp_ns = 'http://www.adlnet.org/xsd/adlcp_rootv1p2'; // Ejemplo de URI de namespace
                // $resource->addAttribute('scormtype', 'sco', $adlcp_ns);
                $resource->addAttribute('adlcp:adlcp:scormtype', 'sco');
            }

            $resource->addAttribute('href', $pageData['fileUrl']);

            $filesUrl = [$pageData['fileUrl']];
            foreach ($filesUrl as $url) {
                $file = $resource->addChild('file');
                $file->addAttribute('href', $url);
            }

            // add libraries in iDevices
            list($librariesToCopy, $librariesFileToCopy) = ExportXmlUtil::getPathForLibrariesInIdevices($odeNavStructureSync, $odeProperties, null);

            // add files libraries in directories libs from iDevices
            foreach ($librariesToCopy as $lib) {
                // $resourcesDir = $exportDirPath . 'libs';
                if (is_dir($lib)) {
                    $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($lib));
                    foreach ($iterator as $file) {
                        if ($file->isFile()) {
                            $relativePath = str_replace($lib.'/', '', $file->getPathname());
                            $relativePath = basename(rtrim($lib, DIRECTORY_SEPARATOR)).'/'.$relativePath;
                            $fileElement = $resource->addChild('file');
                            $fileElement->addAttribute('href', 'libs/'.$relativePath);
                        }
                    }
                }
            }

            $iDevicesType = [];
            // add all references iDevices in blocks in $pageFilesData
            foreach ($pageData['blocks'] as $blocks) {
                foreach ($blocks['idevices'] as $iDeviceId => $iDevice) {
                    // Export content/resources has a different IDs because saveOde function  maps
                    // between original ID resources and the ones save in export dir
                    $iDeviceExport = $idevicesMapping[$iDeviceId];

                    // add all resources in export iDevice
                    $resourcesDir = $exportDirPath.'content/resources/'.$iDeviceExport;
                    if (is_dir($resourcesDir)) {
                        $files = scandir($resourcesDir);
                        foreach ($files as $file) {
                            if ('.' !== $file && '..' !== $file) {
                                $filePath = $resourcesDir.'/'.$file;
                                if (is_file($filePath)) {
                                    $fileElement = $resource->addChild('file');
                                    $fileElement->addAttribute('href', 'content/resources/'.$iDeviceExport.'/'.$file);
                                }
                            }
                        }
                    }
                }
            }

            // add all iDevices types in page
            $iDevicesType = $idevicesByPage[$odePageId];
            foreach ($iDevicesType as $iDeviceId => $iDevice) {
                $resourcesDir = $exportDirPath.'idevices/'.$iDeviceId;
                if (is_dir($resourcesDir)) {
                    $files = scandir($resourcesDir);
                    foreach ($files as $file) {
                        if ('.' !== $file && '..' !== $file) {
                            $filePath = $resourcesDir.'/'.$file;
                            if (is_file($filePath)) {
                                $fileElement = $resource->addChild('file');
                                $fileElement->addAttribute('href', 'idevices/'.$iDeviceId.'/'.$file);
                            }
                        }
                    }
                }
            }

            $commonFiles = $resource->addChild('dependency');
            $commonFiles->addAttribute('identifierref', 'COMMON_FILES');
        }

        // Search for exported libraries
        $resource = $resources->addChild('resource');
        $resource->addAttribute('identifier', 'COMMON_FILES');
        $resource->addAttribute('type', 'webcontent');
        if (in_array($exportType, [Constants::EXPORT_TYPE_SCORM12, Constants::EXPORT_TYPE_SCORM2004])) {
            // The next code is an example of how to add a namespace to the attribute
            // $adlcp_ns = 'http://www.adlnet.org/xsd/adlcp_rootv1p2'; // Ejemplo de URI de namespace
            // $resource->addAttribute('scormtype', 'sco', $adlcp_ns);
            $resource->addAttribute('adlcp:adlcp:scormtype', 'asset');
        }
        // add all commons exported files
        $directoriesToCopy = ['libs', 'content/css', 'content/img', 'theme', 'custom', 'common', 'extend', 'unique', 'vocab'];
        foreach ($directoriesToCopy as $directory) {
            ExportXmlUtil::addCommonExportedFilesToImsManifest($resource, $exportDirPath, $directory);
        }

        // add all files in root directory exept index.html
        $files = scandir($exportDirPath);
        foreach ($files as $file) {
            if ('.' !== $file && '..' !== $file) {
                $filePath = $exportDirPath.'/'.$file;
                if (is_file($filePath) && !preg_match('/index\.html$/', $file)) {
                    $fileElement = $resource->addChild('file');
                    $fileElement->addAttribute('href', $file);
                }
            }
        }

        // TODO, a parte del anterior hay mas directorios "raros"

        // ¿Dónde podemos crear directorios?
        // Hay que procesar los HTML de los idevices y mirar los que hagan referencia a custom/ porque son los del file manager
        // TODO ver quee mas hay que meter como lo del file manger y de libs hay que quitar los que están en los idevices
        // TODO deberíamos añadir los archivos de math que se cargan solos? en commun resourse?
    }

    /**
     * Generate imslrm.xml file xml.
     *
     * @param array $odeProperties
     *
     * @return SimpleXMLElement
     */
    public static function createSCORMimslrm($odeId, $odeProperties)
    {
        $lom = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><lom></lom>');

        $lom->addAttribute('xmlns', 'http://ltsc.ieee.org/xsd/LOM');
        $lom->addAttribute('xmlns:xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
        $lom->addAttribute('xsi:xsi:schemaLocation', 'http://ltsc.ieee.org/xsd/LOM lomCustom.xsd');

        $general = $lom->addChild('general');
        $general->addAttribute('uniqueElementName', 'general');

        $identifier = $general->addChild('identifier');

        $catalogNameValue = isset($odeProperties['lom_general_identifier_catalog'])
            ? $odeProperties['lom_general_identifier_catalog']->getValue() : Constants::ELP_PROPERTIES_NO_CATALOG_NAME;
        $catalog = $identifier->addChild('catalog', $catalogNameValue);
        $catalog->addAttribute('uniqueElementName', 'catalog');

        $catalogEntryValue = isset($odeProperties['lom_general_identifier_entry'])
            ? $odeProperties['lom_general_identifier_entry']->getValue() : 'ODE-'.$odeId;
        $entry = $identifier->addChild('entry', $catalogEntryValue);
        $entry->addAttribute('uniqueElementName', 'entry');

        $title = $general->addChild('title');

        $titleValue = isset($odeProperties['pp_title']) ? $odeProperties['pp_title']->getValue() : 'eXe-p-'.$odeId;
        $langValue = isset($odeProperties['pp_lang']) ? $odeProperties['pp_lang']->getValue() : Settings::DEFAULT_LOCALE;

        $titleString = $title->addChild('string', $titleValue);
        $titleString->addAttribute('language', $langValue);

        $language = $general->addChild('language', $langValue);

        $description = $general->addChild('description');
        $descriptionValue = isset($odeProperties['pp_description']) ? $odeProperties['pp_description']->getValue() : '';
        $descriptionString = $description->addChild('string', $descriptionValue);
        $descriptionString->addAttribute('language', $langValue);

        $aggregationLevel = $general->addChild('aggregationLevel');
        $aggregationLevel->addAttribute('uniqueElementName', 'aggregationLevel');

        $sourceAggregation = $aggregationLevel->addChild('source', 'LOM-ESv1.0');
        $sourceAggregation->addAttribute('uniqueElementName', 'source');

        $valueAggregation = $aggregationLevel->addChild('value', '2');
        $valueAggregation->addAttribute('uniqueElementName', 'value');

        $lifeCycle = $lom->addChild('lifeCycle');

        $contribute = $lifeCycle->addChild('contribute');

        $role = $contribute->addChild('role');
        $role->addAttribute('uniqueElementName', 'role');

        $sourceRole = $role->addChild('source', 'LOM-ESv1.0');
        $sourceRole->addAttribute('uniqueElementName', 'source');

        $valueRole = $role->addChild('value', 'author');
        $valueRole->addAttribute('uniqueElementName', 'value');

        $author = isset($odeProperties['pp_author']) ? $odeProperties['pp_author']->getValue() : '';
        $entityContribute = $contribute->addChild('entity', 'BEGIN:VCARD VERSION:3.0 FN:'.$author.' EMAIL;TYPE=INTERNET: ORG: END:VCARD');

        $date = $contribute->addChild('date');
        date_default_timezone_set(date_default_timezone_get());
        $formatted = (new \DateTime('now'))->format('Y-m-d\TH:i:s').'.00'.(new \DateTime('now'))->format('P');
        $dateTime = $date->addChild('dateTime', $formatted);
        $dateTime->addAttribute('uniqueElementName', 'dateTime');
        $description = $date->addChild('description');
        // TODO cambiar la frase al idioma del ODE
        $descriptionString = $description->addChild('string', 'Fecha de creación de los metadatos');
        $descriptionString->addAttribute('language', $langValue);

        $metaMetadata = $lom->addChild('metaMetadata');
        $metaMetadata->addAttribute('uniqueElementName', 'metaMetadata');

        $contribute = $metaMetadata->addChild('contribute');
        $role = $contribute->addChild('role');
        $role->addAttribute('uniqueElementName', 'role');

        $source = $role->addChild('source', 'LOM-ESv1.0');
        $source->addAttribute('uniqueElementName', 'source');

        $value = $role->addChild('value', 'creator');
        $value->addAttribute('uniqueElementName', 'value');

        $entity = $contribute->addChild('entity', 'BEGIN:VCARD VERSION:3.0 FN:'.$author.' EMAIL;TYPE=INTERNET: ORG: END:VCARD');

        $date = $contribute->addChild('date');
        $dateTime = $date->addChild('dateTime', $formatted);
        $dateTime->addAttribute('uniqueElementName', 'dateTime');

        $description = $date->addChild('description');

        // TODO cambiar la frase al idioma del ODE
        $string = $description->addChild('string', 'Fecha de creación de los metadatos');
        $string->addAttribute('language', $langValue);

        $metadataSchema = $metaMetadata->addChild('metadataSchema', 'LOM-ESv1.0');
        $language = $metaMetadata->addChild('language', $langValue);

        $technical = $lom->addChild('technical');
        $technical->addAttribute('uniqueElementName', 'technical');

        $otherPlatformRequirements = $technical->addChild('otherPlatformRequirements');
        $string = $otherPlatformRequirements->addChild('string', 'editor: eXe Learning');
        $string->addAttribute('language', $langValue);

        $educational = $lom->addChild('educational');
        $languageEd = $educational->addChild('language', $langValue);

        $rights = $lom->addChild('rights');
        $rights->addAttribute('uniqueElementName', 'rights');

        $copyright = $rights->addChild('copyrightAndOtherRestrictions');
        $copyright->addAttribute('uniqueElementName', 'copyrightAndOtherRestrictions');

        $sourceCopyright = $copyright->addChild('source', 'LOM-ESv1.0');
        $sourceCopyright->addAttribute('uniqueElementName', 'source');

        $license = isset($odeProperties['license']) ? $odeProperties['license']->getValue() : '';
        $valueRole = $copyright->addChild('value', $license);
        $valueRole->addAttribute('uniqueElementName', 'value');

        $access = $rights->addChild('access');
        $access->addAttribute('uniqueElementName', 'access');

        $accessType = $access->addChild('accessType');
        $accessType->addAttribute('uniqueElementName', 'accessType');

        $sourceAccessType = $accessType->addChild('source', 'LOM-ESv1.0');
        $sourceAccessType->addAttribute('uniqueElementName', 'source');

        $valueAccessType = $accessType->addChild('value', 'universal');
        $valueAccessType->addAttribute('uniqueElementName', 'value');

        $descriptionRights = $access->addChild('description');
        $stringDescriptionRights = $descriptionRights->addChild('string', 'Default');
        $stringDescriptionRights->addAttribute('language', 'en');

        return $lom;
    }

    /**
     * Generate ePub3 package.opf file.
     *
     * @param string              $odeId
     * @param OdeNavStructureSync $odeNavStructureSyncs
     * @param array               $pagesFileData
     * @param array               $odeProperties
     * @param string              $resourcesPrefix
     * @param string              $exportType
     *
     * @return SimpleXMLElement
     */
    public static function createEPUB3PackageOPF(
        $odeId,
        $odeNavStructureSyncs,
        $pagesFileData,
        $odeProperties,
        $exportDirPath,
        $resourcesPrefix,
        $exportType,
    ) {
        $exportDirPath = $exportDirPath.Constants::EXPORT_EPUB3_EXPORT_DIR_EPUB.DIRECTORY_SEPARATOR;

        $package = new \SimpleXMLElement('<?xml version="1.0" encoding="utf-8"?><package></package>');

        // package attributes
        $package->addAttribute('version', '3.0');
        $package->addAttribute('unique-identifier', 'pub-id');
        $package->addAttribute('xmlns', 'http://www.idpf.org/2007/opf');

        // metadata
        $metadata = $package->addChild('metadata', '');
        $metadata->addAttribute('xmlns:xmlns:dc', 'http://purl.org/dc/elements/1.1/');

        // metadata -> language
        $lang = isset($odeProperties['pp_lang']) ? $odeProperties['pp_lang']->getValue() : Settings::DEFAULT_LOCALE;
        $languageDC = $metadata->addChild('dc:dc:language', $lang);

        // metadata -> identifier
        $id = isset($odeProperties['lom_general_identifier_entry']) ? $odeProperties['lom_general_identifier_entry']->getValue() : 'ODE-'.$odeId;
        $identifierDC = $metadata->addChild('dc:dc:identifier', $id);
        $identifierDC->addAttribute('id', 'pub-id');

        // metadata -> title
        $title = isset($odeProperties['pp_title']) ? $odeProperties['pp_title']->getValue() : 'eXe-p-'.$odeId;
        $titleDC = $metadata->addChild('dc:dc:title', $title);
        $titleDC->addAttribute('xml:lang', $lang);

        // metadata -> description
        $descriptionValue = isset($odeProperties['pp_description']) ? $odeProperties['pp_description']->getValue() : '';
        $descriptionDC = $metadata->addChild('dc:dc:description', $descriptionValue);
        $descriptionDC->addAttribute('xml:lang', $lang);

        // metadata -> license
        $licenseValue = isset($odeProperties['license']) ? $odeProperties['license']->getValue() : '';
        $licenseDC = $metadata->addChild('dc:dc:license', $licenseValue);
        $licenseDC->addAttribute('xml:lang', $lang);

        // metadata -> creator
        $authorValue = isset($odeProperties['pp_author']) ? $odeProperties['pp_author']->getValue() : '';
        $creatorDC = $metadata->addChild('dc:dc:creator', $authorValue);

        // metadata -> meta
        $date = new \DateTime('now');
        $meta = $metadata->addChild('meta', $date->format('Y-m-d\TH:i:s\Z'));
        $meta->addAttribute('property', 'dcterms:modified');

        // manifest
        $manifest = $package->addChild('manifest', '');

        // manifest -> item [nav]
        $item = $manifest->addChild('item', ' ');
        $item->addAttribute('id', 'nav');
        $item->addAttribute('href', Constants::EPUB3_NAV_XHTML);
        $item->addAttribute('properties', 'nav');
        $item->addAttribute('media-type', 'application/xhtml+xml');

        $visiblesPages = [];
        $indexNode = 0;

        foreach ($pagesFileData as $key => $pageData) {
            if (self::isVisibleExport($odeNavStructureSyncs, $indexNode)) {
                $url = $pageData['fileUrl'];
                // Add the page to the visibles pages and link it with the previous page and the next page
                $visiblesPages[$key] = ['url' => $url];
            }
            ++$indexNode;
        }

        // manifest -> item [pages]
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            $odePageId = $odeNavStructureSync->getOdePageId();
            $pageData = $pagesFileData[$odePageId];
            $item = $manifest->addChild('item', ' ');
            $item->addAttribute('id', 'PAGE-'.$odePageId);
            $item->addAttribute('href', $pageData['fileUrl']);
            $item->addAttribute('media-type', 'application/xhtml+xml');

            if (isset($visiblesPages[$odePageId])) {
                $item->addAttribute('properties', 'scripted');
            } else {
                $item->addAttribute('fallback', 'fallback');
            }
        }

        $directoriesToCopy = ['content', 'custom', 'idevices', 'libs', 'theme'];
        foreach ($directoriesToCopy as $directory) {
            ExportXmlUtil::addCommonExportedFilesToOpfManifest($manifest, $exportDirPath, $directory);
        }

        // add all files in root directory exept index.html
        $files = scandir($exportDirPath);
        foreach ($files as $file) {
            if ('.' !== $file && '..' !== $file) {
                $filePath = $exportDirPath.'/'.$file;
                if (is_file($filePath) && !preg_match('/index\.html$/', $file)) {
                    $item = $manifest->addChild('item', ' ');
                    $item->addAttribute('id', $file);
                    $item->addAttribute('href', $file);
                    $item->addAttribute('media-type', mime_content_type($filePath));
                    $item->addAttribute('fallback', 'fallback');
                }
            }
        }

        // spine
        $spine = $package->addChild('spine', '');

        // spine -> itemref [pages]
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            $odePageId = $odeNavStructureSync->getOdePageId();
            if (isset($visiblesPages[$odePageId])) {
                $itemref = $spine->addChild('itemref', ' ');
                $itemref->addAttribute('idref', 'PAGE-'.$odePageId);
            }
        }

        return $package;
    }

    /**
     * Generate ePub3 package.opf file.
     *
     * @param string              $odeId
     * @param OdeNavStructureSync $odeNavStructureSyncs
     * @param array               $pagesFileData
     * @param array               $odeProperties
     * @param string              $elpFileName
     * @param string              $resourcesPrefix
     * @param string              $exportType
     *
     * @return SimpleXMLElement
     */
    public static function createEPUB3NavXHTML(
        $odeId,
        $odeNavStructureSyncs,
        $pagesFileData,
        $odeProperties,
        $elpFileName,
        $resourcesPrefix,
        $exportType,
    ) {
        $title = $odeProperties['pp_title'] ? $odeProperties['pp_title']->getValue() : '';
        $lang = $odeProperties['pp_lang'] ? $odeProperties['pp_lang']->getValue() : 'es';

        $html = '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="'.$lang.'" lang="'.$lang.'">';
        $html .= "<head><title>{$title}</title></head>";
        $html .= '<body><nav epub:type="toc" id="toc"><ol>';

        $visiblesPages = [];
        $indexNode = 0;

        foreach ($pagesFileData as $key => $pageData) {
            if (self::isVisibleExport($odeNavStructureSyncs, $indexNode)) {
                $url = $pageData['fileUrl'];
                // Add the page to the visibles pages and link it with the previous page and the next page
                $visiblesPages[$key] = ['url' => $url];
            }
            ++$indexNode;
        }

        // Build a tree from the flat list
        $tree = [];
        $nodes = [];
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            $odePageId = $odeNavStructureSync->getOdePageId();
            if (isset($visiblesPages[$odePageId])) {
                $nodes[$odePageId] = [
                    'id' => $odePageId,
                    'parent' => $odeNavStructureSync->getOdeParentPageId(),
                    'name' => $odeNavStructureSync->getPageName(),
                    'children' => [],
                ];
            }
        }

        foreach ($nodes as $nodeId => &$node) {
            if (null !== $node['parent'] && isset($nodes[$node['parent']])) {
                $nodes[$node['parent']]['children'][] = &$node;
            } else {
                $tree[] = &$node;
            }
        }

        $html .= self::buildEpub3NavList($tree, $pagesFileData);

        $html .= '</ol></nav></body></html>';

        // Convert the HTML string to a SimpleXMLElement before returning
        libxml_use_internal_errors(true);
        $simpleXml = simplexml_load_string($html);
        libxml_clear_errors();

        return $simpleXml;
    }

    private static function buildEpub3NavList($nodes, $pagesFileData)
    {
        $html = '';
        foreach ($nodes as $node) {
            $pageFile = $pagesFileData[$node['id']]['fileUrl'];
            $html .= "<li><a href=\"{$pageFile}\">{$node['name']}</a>";
            if (!empty($node['children'])) {
                $html .= '<ol>';
                $html .= self::buildEpub3NavList($node['children'], $pagesFileData);
                $html .= '</ol>';
            }
            $html .= '</li>';
        }

        return $html;
    }

    /**
     * Generates html of page.
     *
     * @param string              $odeSessionId
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param array               $odeProperties
     * @param array               $libsResourcesPath
     * @param array               $idevicesMapping
     * @param array               $idevicesByPage
     * @param array               $idevicesTypesData
     * @param array               $userPreferencesDtos
     * @param ThemeDto            $theme
     * @param string              $resourcesPrefix
     * @param string              $exportType
     * @param string              $isPreview
     * @param TranslatorInterface $translator
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLPage(
        $odeSessionId,
        $odeNavStructureSync,
        $pagesFileData,
        $odeProperties,
        $libsResourcesPath,
        $idevicesMapping,
        $idevicesByPage,
        $idevicesTypesData,
        $userPreferencesDtos,
        $theme,
        $resourcesPrefix,
        $exportType,
        $isPreview,
        $translator,
        $odeNavStructureSyncs = null, // export HTML5 need all node structure for navigatation menu
    ) {
        // Page XML
        $parent = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><export></export>');

        $exportDynamicPage = true;
        if (Constants::EXPORT_TYPE_EPUB3 == $exportType) {
            $exportDynamicPage = false;
        }

        // lang
        $lang = isset($odeProperties['pp_lang']) ? $odeProperties['pp_lang']->getValue() : Settings::DEFAULT_LOCALE;

        // html
        $html = $parent->addChild('html');
        $html->addAttribute('lang', $lang);
        // $html->addAttribute('class', $exportType);

        // html attributes
        if (!$exportDynamicPage) {
            $html->addAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        }

        // Idevices in this page
        $pageIdevices = array_keys($idevicesByPage[$odeNavStructureSync->getOdePageId()]);

        // head
        $head = $html->addChild('head');
        $headContent = self::createHTMLHead(
            $odeSessionId,
            $odeNavStructureSync,
            $odeProperties,
            $libsResourcesPath,
            $pagesFileData,
            $pageIdevices,
            $idevicesTypesData,
            $userPreferencesDtos,
            $theme,
            $resourcesPrefix,
            $exportDynamicPage
        );

        self::appendSimpleXml($head, $headContent);

        // body
        $body = $html->addChild('body');

        // body class
        $bodyClass = $isPreview ? 'exe-export exe-preview' : 'exe-export';
        if (in_array($exportType, [Constants::EXPORT_TYPE_SCORM12, Constants::EXPORT_TYPE_SCORM2004])) {
            $bodyClass .= ' exe-scorm';
            $bodyClass .= ' exe-'.$exportType;
        } elseif (Constants::EXPORT_TYPE_HTML5 == $exportType) {
            $bodyClass .= ' exe-web-site';
        } elseif (Constants::EXPORT_TYPE_HTML5_SP == $exportType) {
            $bodyClass .= ' exe-single-page';
        } elseif (Constants::EXPORT_TYPE_IMS == $exportType) {
            $bodyClass .= ' exe-ims';
        } elseif (Constants::EXPORT_TYPE_EPUB3 == $exportType) {
            $bodyClass .= ' exe-epub';
        }

        // body class
        $body->addAttribute('class', $bodyClass);
        if ($pagesFileData[$odeNavStructureSync->getOdePageId()]['isIndex']) {
            $html->addAttribute('id', 'exe-index');
        } else {
            $html->addAttribute('id', 'exe-node-'.$odeNavStructureSync->getOdePageId());
        }

        // body attributes
        if ($exportDynamicPage) {
            if (isset($odeProperties['pp_lang']) && '' != $odeProperties['pp_lang']->getValue()) {
                $body->addAttribute('lang', $odeProperties['pp_lang']->getValue());
            }
            /* To review
            if (isset($odeProperties['pp_title'])) {
                $body->addAttribute('title', $odeProperties['pp_title']->getValue());
            }
            if (isset($odeProperties['license'])) {
                $body->addAttribute('data-license', $odeProperties['pp_license']->getValue());
            }
            */
        }

        // body content
        $bodyContent = self::createHTMLBody(
            $odeSessionId,
            $odeNavStructureSync,
            $pagesFileData,
            $odeProperties,
            $idevicesMapping,
            $idevicesTypesData,
            $userPreferencesDtos,
            $theme,
            $resourcesPrefix,
            $exportDynamicPage,
            $exportType,
            $isPreview,
            $translator,
            $odeNavStructureSyncs
        );
        self::appendSimpleXml($body, $bodyContent);

        return $html;
    }

    /**
     *  Generates html of head.
     *
     * @param string              $odeSessionId
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param array               $odeProperties
     * @param array               $libsResourcesPath
     * @param array               $pageIdevices
     * @param array               $idevicesTypesData,
     * @param userPreferencesDtos $userPreferencesDtos
     * @param ThemeDto            $theme
     * @param string              $resourcesPrefix
     * @param bool                $exportDynamicPage
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLHead(
        $odeSessionId,
        $odeNavStructureSync,
        $odeProperties,
        $libsResourcesPath,
        $pagesFileData,
        $pageIdevices,
        $idevicesTypesData,
        $userPreferencesDtos,
        $theme,
        $resourcesPrefix,
        $exportDynamicPage,
    ) {
        $head = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><head></head>');

        // Meta: charset (see DOMDocument in Export*Service.php)
        // $metaCharset = $head->addChild('meta');
        // $metaCharset->addAttribute('charset', 'utf-8');

        // Meta: generator
        $metaGenerator = $head->addChild('meta');
        $metaGenerator->addAttribute('name', 'generator');
        $metaGenerator->addAttribute('content', 'eXeLearning '.Constants::APP_VERSION);

        // Meta: viewport
        $metaViewport = $head->addChild('meta');
        $metaViewport->addAttribute('name', 'viewport');
        $metaViewport->addAttribute('content', 'width=device-width, initial-scale=1');

        // License
        if (isset($odeProperties['license'])) {
            $license = $odeProperties['license']->getValue();
            $licensesLinks = Properties::LICENSES_LINKS;
            if (array_key_exists($license, $licensesLinks)) {
                $licenseLink = $licensesLinks[$license];
                $metaLicense = $head->addChild('link');
                $metaLicense->addAttribute('rel', 'license');
                $metaLicense->addAttribute('type', 'text/html');
                $metaLicense->addAttribute('href', $licenseLink);
            }
        }

        if (!empty($odeProperties['pp_title']) && '' != $odeProperties['pp_title']->getValue()) {
            $titleValueText = $odeProperties['pp_title']->getValue();

            // HTML title for any html page apart from index.html
            if (!$pagesFileData[$odeNavStructureSync->getOdePageId()]['isIndex']) {
                $pageProperties = $odeNavStructureSync->getOdeNavStructureSyncProperties();
                $pagePropertiesDict = [];
                foreach ($pageProperties as $property) {
                    if ($property->getValue()) {
                        $pagePropertiesDict[$property->getKey()] = $property->getValue();
                    }
                }
                if (isset($pagePropertiesDict['titlePage'])) {
                    // HTML title: Page title | Package title
                    $titleValueText = $pagePropertiesDict['titlePage'].' | '.$titleValueText;
                }
            }
        } else {
            $titleValueText = Constants::ELP_PROPERTIES_NO_TITLE_NAME;
        }

        if ($exportDynamicPage) {
            $head->addChild('title', $titleValueText);
        }

        // Script JS class
        $scriptJs = $head->addChild('script', 'document.querySelector("html").classList.add("js");');

        // Libs
        $libsTags = self::createHTMLHeadLibs($libsResourcesPath, $resourcesPrefix);
        self::appendSimpleXml($head, $libsTags);

        // Idevices
        $idevicesTags = self::createHTMLHeadIdevices($pageIdevices, $idevicesTypesData, $resourcesPrefix);
        self::appendSimpleXml($head, $idevicesTags);

        // Content css
        $contentCss = self::createHTMLHeadContentCSS($resourcesPrefix);
        self::appendSimpleXml($head, $contentCss);

        // Theme
        $themeTags = self::createHTMLHeadTheme($theme, $resourcesPrefix);
        self::appendSimpleXml($head, $themeTags);

        $extraHead = $odeProperties['pp_extraHeadContent']->getValue();
        if ('' != $extraHead) {
            // convert $head to DOMDocument to add new node easily
            $domHead = dom_import_simplexml($head)->ownerDocument;
            $customCode = new \DOMDocument();
            $wrapper = '<wrapper>'.$extraHead.'</wrapper>';
            libxml_use_internal_errors(true); // removes errors due to malformed html
            $customCode->loadHTML('<?xml encoding="utf-8" ?>'.$wrapper, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
            libxml_clear_errors();

            foreach ($customCode->documentElement->childNodes as $node) {
                $import = $domHead->importNode($node, true);
                $domHead->documentElement->appendChild($import);
            }

            // simplexml load the DOM but introduce scaping characters
            // so we need to convert it back to SimpleXMLElement
            // $domHead->formatOutput = true; // format output
            // $domHead->preserveWhiteSpace = false; // remove unnecessary white spaces
            // $domHead->encoding = 'UTF-8'; // set encoding
            // $domHead->normalizeDocument(); // normalize the document
            // $domHead->removeChild($domHead->doctype); // remove doctype
            $head = simplexml_import_dom($domHead);
        }

        return $head;
    }

    /**
     * Generates html of head libs links.
     *
     * @param array  $libsResourcesPath
     * @param string $resourcesPrefix
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLHeadLibs(
        $libsResourcesPath,
        $resourcesPrefix,
    ) {
        $headLibs = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><head-libs></head-libs>');

        $scriptFiles = [];
        $styleFiles = [];

        // js
        foreach ($libsResourcesPath['js'] as $resource) {
            $scriptFiles[] = $resourcesPrefix.$resource;
        }

        // css
        foreach ($libsResourcesPath['css'] as $resource) {
            $styleFiles[] = $resourcesPrefix.$resource;
        }

        // Scripts js files
        foreach ($scriptFiles as $scriptFile) {
            $jsScript = $headLibs->addChild('script', ' ');
            $jsScript->addAttribute('src', $scriptFile);
        }
        // Links to css files
        foreach ($styleFiles as $styleUrl) {
            $styleLink = $headLibs->addChild('link', '');
            $styleLink->addAttribute('rel', 'stylesheet');
            $styleLink->addAttribute('href', $styleUrl);
        }

        return $headLibs;
    }

    /**
     *  Generates html of head idevices links.
     *
     * @param array  $pageIdevices
     * @param array  $idevicesTypesData
     * @param string $resourcesPrefix
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLHeadIdevices(
        $pageIdevices,
        $idevicesTypesData,
        $resourcesPrefix,
    ) {
        $headIdevice = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><head-idevice></head-idevice>');

        $scriptFiles = [];
        $styleFiles = [];

        foreach ($pageIdevices as $ideviceName) {
            // Idevices js
            if (isset($idevicesTypesData[$ideviceName]['js'])) {
                foreach ($idevicesTypesData[$ideviceName]['js'] as $jsFile) {
                    $scriptFiles[] = $resourcesPrefix.Constants::EXPORT_DIR_IDEVICES.Constants::SLASH.
                        $ideviceName.Constants::SLASH.$jsFile;
                }
            }
            // Idevices css
            if (isset($idevicesTypesData[$ideviceName]['css'])) {
                foreach ($idevicesTypesData[$ideviceName]['css'] as $cssFile) {
                    $styleFiles[] = $resourcesPrefix.Constants::EXPORT_DIR_IDEVICES.Constants::SLASH.
                        $ideviceName.Constants::SLASH.$cssFile;
                }
            }
        }

        // Scripts js files
        foreach ($scriptFiles as $scriptFile) {
            $jsScript = $headIdevice->addChild('script', ' ');
            $jsScript->addAttribute('src', $scriptFile);
        }
        // Links to css files
        foreach ($styleFiles as $styleUrl) {
            $styleLink = $headIdevice->addChild('link', '');
            $styleLink->addAttribute('rel', 'stylesheet');
            $styleLink->addAttribute('href', $styleUrl);
        }

        return $headIdevice;
    }

    /**
     * Generates html of head resources theme links.
     *
     * @param ThemeDto $theme
     * @param string   $resourcesPrefix
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLHeadTheme(
        $theme,
        $resourcesPrefix,
    ) {
        $headCss = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><head-theme></head-theme>');

        $styleJsFiles = [];
        $styleCssFiles = [];

        // Theme js
        foreach ($theme->getJsFiles() as $jsFile) {
            $themeJsPath = Constants::EXPORT_DIR_THEME.Constants::SLASH.$jsFile;
            $styleJsFiles[] = $resourcesPrefix.$themeJsPath;
        }

        // SCRIPT tags
        foreach ($styleJsFiles as $styleJsUrl) {
            $styleJsLink = $headCss->addChild('script', ' ');
            $styleJsLink->addAttribute('src', $styleJsUrl);
        }

        // Theme css
        foreach ($theme->getCssFiles() as $cssFile) {
            $themeCssPath = Constants::EXPORT_DIR_THEME.Constants::SLASH.$cssFile;
            $styleCssFiles[] = $resourcesPrefix.$themeCssPath;
        }

        // Links to css files
        foreach ($styleCssFiles as $styleUrl) {
            $styleLink = $headCss->addChild('link', '');
            $styleLink->addAttribute('rel', 'stylesheet');
            $styleLink->addAttribute('href', $styleUrl);
        }

        return $headCss;
    }

    /**
     * Generates html of head css content links.
     *
     * @param string $resourcesPrefix
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLHeadContentCSS(
        $resourcesPrefix,
    ) {
        $headCss = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><head-content-css></head-content-css>');

        $styleFiles = [];

        $contentCssUrl = Constants::PERMANENT_SAVE_CONTENT_DIRNAME.Constants::SLASH.
            Constants::PERMANENT_SAVE_CONTENT_CSS_DIRNAME.Constants::SLASH;

        // Base css
        $baseCssPath = $contentCssUrl.Constants::WORKAREA_STYLE_BASE_CSS_FILENAME;
        $styleFiles[] = $resourcesPrefix.$baseCssPath;

        // Links to css files
        foreach ($styleFiles as $styleUrl) {
            $styleLink = $headCss->addChild('link', '');
            $styleLink->addAttribute('rel', 'stylesheet');
            $styleLink->addAttribute('href', $styleUrl);
        }

        return $headCss;
    }

    /**
     *  Generates html of body.
     *
     * @param string              $odeSessionId
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param array               $odeProperties
     * @param array               $idevicesMapping
     * @param array               $idevicesTypesData
     * @param userPreferencesDtos $userPreferencesDtos
     * @param ThemeDto            $theme
     * @param string              $resourcesPrefix
     * @param bool                $exportDynamicPage
     * @param string              $exportType
     * @param string              $isPreview
     * @param TranslatorInterface $translator
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLBody(
        $odeSessionId,
        $odeNavStructureSync,
        $pagesFileData,
        $odeProperties,
        $idevicesMapping,
        $idevicesTypesData,
        $userPreferencesDtos,
        $theme,
        $resourcesPrefix,
        $exportDynamicPage,
        $exportType,
        $isPreview,
        $translator,
        $odeNavStructureSyncs = null, // export HTML5 need all node structure for navigatation menu
    ) {
        $body = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><body></body>');

        // Page properties
        $pageProperties = $odeNavStructureSync->getOdeNavStructureSyncProperties();
        $pagePropertiesDict = [];
        foreach ($pageProperties as $property) {
            if ($property->getValue()) {
                $pagePropertiesDict[$property->getKey()] = $property->getValue();
            }
        }

        // eXe content
        $exe = $body->addChild('div', ' ');
        $exe->addAttribute('class', 'exe-content exe-export pre-js siteNav-hidden');

        // search inside the structure for visible pages and keep the $visiblesPages array to
        // generate the page, navigation menu, page counters, etc.
        $visiblesPages = [];
        $indexNode = 0;

        if (null === $odeNavStructureSyncs) {
            $odeNavStructureSyncs = [$odeNavStructureSync];
        }

        foreach ($pagesFileData as $key => $pageData) {
            if (self::isVisibleExport($odeNavStructureSyncs, $indexNode)) {
                $url = $pageData['fileUrl'];
                // Add the page to the visibles pages and link it with the previous page and the next page
                $visiblesPages[$key] = ['url' => $url, 'previousPage' => null, 'nextPage' => null];
            }
            ++$indexNode;
        }

        // Nav menu
        if (in_array($exportType, [Constants::EXPORT_TYPE_HTML5])) {
            $navContent = self::createHTMLPageMenuNav(
                $odeNavStructureSync,
                $odeNavStructureSyncs,
                $pagesFileData,
                $visiblesPages,
                $resourcesPrefix,
                $isPreview
            );
            self::appendSimpleXml($exe, $navContent);
        }

        // Page
        $page = $exe->addChild('main', ' ');
        $page->addAttribute('id', $odeNavStructureSync->getOdePageId());
        $page->addAttribute('class', 'page');

        /* To review
        if ($exportDynamicPage) {
            foreach ($pagePropertiesDict as $key => $value) {
                $page->addAttribute('data-'.$key, $value);
            }
        }
        */

        // Search input
        if (
            isset($odeProperties['pp_addSearchBox'])
            && 'true' == $odeProperties['pp_addSearchBox']->getValue()
            && in_array(
                $exportType,
                [Constants::EXPORT_TYPE_HTML5]
            )
        ) {
            $clientSearch = self::createHTMLClientSearch(
                $pagesFileData,
                $visiblesPages,
                $odeProperties,
                $translator
            );
            self::appendSimpleXml($page, $clientSearch);
        }

        // Page header
        $pageHeader = self::createHTMLPageHeader(
            $odeNavStructureSync,
            $visiblesPages,
            $odeProperties,
            $translator,
            $theme,
            $pagePropertiesDict,
            $exportType,
            $resourcesPrefix
        );
        self::appendSimpleXml($page, $pageHeader);

        // Page content
        $pageContent = self::createHTMLPageContent(
            $odeNavStructureSync,
            $odeProperties,
            $idevicesMapping,
            $idevicesTypesData,
            $userPreferencesDtos,
            $theme,
            $resourcesPrefix,
            $exportDynamicPage,
            $translator
        );
        self::appendSimpleXml($page, $pageContent);

        // Page nav buttons
        if (
            $exportDynamicPage && in_array(
                $exportType,
                [Constants::EXPORT_TYPE_HTML5, Constants::EXPORT_TYPE_EPUB3]
            )
        ) {
            // $visiblesPages
            $navButtons = self::createHTMLNavButtons(
                $odeNavStructureSync,
                $pagesFileData,
                $visiblesPages,
                $odeProperties,
                $resourcesPrefix,
                $isPreview,
                $translator
            );
            self::appendSimpleXml($exe, $navButtons);
        }

        $pageFooter = $exe->addChild('footer', '');
        $pageFooter->addAttribute('id', 'siteFooter');

        // Page license and custom code
        $pageLicense = self::createHTMLPageFooter(
            $odeProperties,
            $exportDynamicPage,
        );

        self::appendSimpleXml($pageFooter, $pageLicense);

        // Made with eXe
        if (
            isset($odeProperties['pp_addExeLink'])
            && 'true' == $odeProperties['pp_addExeLink']->getValue()
        ) {
            $madeWitheXe = self::createMadeWithExeLink($translator);
            self::appendSimpleXml($body, $madeWitheXe);
        }

        return $body;
    }

    /**
     *  Generates html of page content.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param array               $odeProperties
     * @param array               $idevicesMapping
     * @param array               $idevicesTypesData
     * @param ThemeDto            $theme
     * @param array               $userPreferencesDtos
     * @param bool                $exportDynamicPage
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLPageContent(
        $odeNavStructureSync,
        $odeProperties,
        $idevicesMapping,
        $idevicesTypesData,
        $userPreferencesDtos,
        $theme,
        $resourcesPrefix,
        $exportDynamicPage,
        $translator,
    ) {
        $pageContentMain = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><page-content></page-content>');

        $pageContent = $pageContentMain->addChild('div', ' ');
        $pageContent->addAttribute('id', 'page-content-'.$odeNavStructureSync->getOdePageId());
        $pageContent->addAttribute('class', 'page-content'); // To review now (see empty pages)

        foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
            $block = self::createHTMLBlock(
                $odePagStructureSync,
                $odeProperties,
                $idevicesMapping,
                $idevicesTypesData,
                $userPreferencesDtos,
                $theme,
                $resourcesPrefix,
                $exportDynamicPage,
                $translator,
            );
            self::appendSimpleXml($pageContent, $block);
        }

        return $pageContentMain;
    }

    /**
     *  Generates page license (package license).
     *
     * @param array $odeProperties
     * @param bool  $exportDynamicPage
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLPageFooter(
        $odeProperties,
        $exportDynamicPage,
    ) {
        $pageFooterWrapper = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><footer></footer>');

        $pageFooterContent = $pageFooterWrapper->addChild('div', ' ');
        $pageFooterContent->addAttribute('id', 'siteFooterContent');

        $pageFooterLicense = $pageFooterContent->addChild('div', ' ');
        $pageFooterLicense->addAttribute('id', 'packageLicense');
        $pageFooterLicenseP = $pageFooterLicense->addChild('p', ' ');
        $pageFooterLicenseTitle = $pageFooterLicenseP->addChild('span', 'Licencia: ');
        $pageFooterLicenseTitle->addAttribute('class', 'license-label');

        // License
        if (isset($odeProperties['license'])) {
            $license = $odeProperties['license']->getValue();
            $licensesLinks = Properties::LICENSES_LINKS;
            if (array_key_exists($license, $licensesLinks)) {
                $licenseLink = $licensesLinks[$license];
                $pageFooterLicenseClass = str_replace('https://creativecommons.org/licenses/', '', $licenseLink);
                $pageFooterLicenseClass = explode('/', $pageFooterLicenseClass);
                $pageFooterLicenseClass = 'cc cc-'.$pageFooterLicenseClass[0];
                $pageFooterLicense->addAttribute('class', $pageFooterLicenseClass);
                $pageFooterLicenseA = $pageFooterLicenseP->addChild('a', $license);
                $pageFooterLicenseA->addAttribute('href', $licenseLink);
                $pageFooterLicenseA->addAttribute('class', 'license');
            } else {
                $pageFooterLicenseText = $pageFooterLicenseP->addChild('span', $license);
                $pageFooterLicenseText->addAttribute('class', 'license');
            }
        }

        $siteUserFooter = $pageFooterContent->addChild('div', ' ');
        $siteUserFooter->addAttribute('id', 'siteUserFooter');

        $extraFooter = $odeProperties['footer']->getValue();
        if ('' != $extraFooter) {
            $siteExtra = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><footer></footer>');
            // convert $head to DOMDocument to add new node easily
            $domExtra = dom_import_simplexml($siteExtra)->ownerDocument;
            $customCode = new \DOMDocument();
            $wrapper = '<wrapper>'.$extraFooter.'</wrapper>';
            libxml_use_internal_errors(true); // removes errors due to malformed html
            $customCode->loadHTML('<?xml encoding="utf-8" ?>'.$wrapper, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
            libxml_clear_errors();

            foreach ($customCode->documentElement->childNodes as $node) {
                $import = $domExtra->importNode($node, true);
                $domExtra->documentElement->appendChild($import);
            }

            $siteExtra = simplexml_import_dom($domExtra);
            self::appendSimpleXml($siteUserFooter, $siteExtra);
        }

        return $pageFooterWrapper;
    }

    /**
     * Generates html of search input.
     *
     * @param array $pagesFileData
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLClientSearch(
        $pagesFileData,
        $visiblesPages,
        $odeProperties,
        $translator,
    ) {
        $pagesFileDataAux = [];
        foreach ($pagesFileData as $pageId => $pageData) {
            if (isset($visiblesPages[$pageId])) {
                $pagesFileDataAux[$pageId] = $pageData;
            }
        }

        $localeODE = isset($odeProperties['pp_lang']) ? $odeProperties['pp_lang']->getValue() : '';

        try {
            // Change to locale of ODE
            $translator->switchTemporaryLocale($localeODE);
            $search = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><search></search>');
            $searchContainer = $search->addChild('div', ' ');
            $searchContainer->addAttribute('id', 'exe-client-search');
            $searchContainer->addAttribute('data-block-order-string', $translator->trans('Block %e'));
            $searchContainer->addAttribute('data-no-results-string', $translator->trans('No results.'));
            $searchContainer->addAttribute('data-pages', json_encode($pagesFileDataAux));
        } finally {
            // Restore locale GUI
            $translator->restorePreviousLocale();
        }

        return $search;
    }

    /**
     *  Generates html of menu nav.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param array               $pagesFileData
     * @param string              $resourcesPrefix
     * @param bool                $isPreview
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLPageMenuNav(
        $odeNavStructureSync,
        $odeNavStructureSyncs,
        $pagesFileData,
        &$visiblesPages,
        $resourcesPrefix,
        $isPreview,
    ) {
        $navMain = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><nav-main></nav-main>');

        $nav = $navMain->addChild('nav', ' ');
        $nav->addAttribute('id', 'siteNav');

        // Pages
        $currentOdePageId = $odeNavStructureSync->getOdePageId();
        $navUl = $nav->addChild('ul', ' ');
        $navLi = null;
        $indexNode = 0;
        $previousPage = null;

        foreach ($pagesFileData as $key => $pageData) {
            if (isset($visiblesPages[$key])) {
                $name = $pageData['name'];
                $url = $pageData['fileUrl'];

                // Add the page to the visibles pages and link it with the previous page and the next page
                $visiblesPages[$key] = ['url' => $url, 'previousPage' => $previousPage, 'nextPage' => null];
                if (null != $previousPage) {
                    $visiblesPages[$previousPage]['nextPage'] = $key;
                }

                $previousPage = $key;

                $odeParentPageId = $odeNavStructureSyncs[$indexNode]->getOdeParentPageId();
                // If it has no parent node, it is first-level
                if (null == $odeParentPageId) {
                    $navLi = $navUl->addChild('li', ' ');
                } else {
                    //  Search for the parent node of the current one
                    $items = $navUl->xpath('//li[@odePageId="'.$odeParentPageId.'"]');
                    $item = $items[0];
                    // If it is the first child add a ul tag and a child li tag
                    $liChildrens = $item->count();
                    if ($liChildrens < 2) {
                        $navLi = $item->addChild('ul', ' ')->addChild('li', ' ');
                    } else {
                        $navLi = $item->ul->addChild('li', ' ');
                    }
                }
                $navLi->addAttribute('odePageId', $key);
                $navLink = $navLi->addChild('a', $name);
                $navLink->addAttribute('href', !$isPreview ? $resourcesPrefix.$url : $url);
                $class = '';
                if ($currentOdePageId == $key) {
                    $class .= 'active';
                }
                if (0 == $indexNode) {
                    $class .= $class ? ' main-node' : 'main-node';
                }
                if (!empty($class)) {
                    $navLink->addAttribute('class', $class);
                }
            }
            ++$indexNode;
        }

        // Add class active to the current page except
        $navLiActive = $navUl->xpath('//li[@odePageId="'.$currentOdePageId.'"]');
        if (isset($navLiActive[0])) {
            $navLiActive[0]['class'] = $navLiActive[0]['class'] ? $navLiActive[0]['class'].' active' : 'active';
        }
        // Add class current-page-parent to all ancestors of the current page
        $liAncestors = $navMain->xpath('//li[@odePageId="'.$currentOdePageId.'"]/ancestor::li');
        foreach ($liAncestors as $item) {
            $item['class'] = $item['class'] ? $item['class'].' current-page-parent' : 'current-page-parent';
        }

        // Add class no-ch to all links which first sibling is not a ul
        $navLinks = $navUl->xpath('//li/a[not(following-sibling::ul)]');
        foreach ($navLinks as $link) {
            $link['class'] = isset($link['class']) ? $link['class'].' no-ch' : 'no-ch';
        }

        // Add class daddy to all links which first sibling is a ul
        $navLinks = $navUl->xpath('//li/a[following-sibling::ul]');
        foreach ($navLinks as $link) {
            $link['class'] = isset($link['class']) ? $link['class'].' daddy' : 'daddy';
        }

        // Add class other-section to all ul which first child is a li ant li class is not active
        $ulNodesCounter = 0;
        $ulNodes = $navUl->xpath('//ul');
        foreach ($ulNodes as $ulNode) {
            // Check the ancestors
            $liNodes = $ulNode->xpath('./li/ancestor::li');
            $allInactive = true;
            foreach ($liNodes as $liNode) {
                if (isset($liNode['class']) && false !== strpos($liNode['class'], 'active')) {
                    $allInactive = false;
                    break;
                }
            }
            // Check a.active in descendants
            $liNodes = $ulNode->xpath('./li/descendant::a');
            foreach ($liNodes as $liNode) {
                if (isset($liNode['class']) && false !== strpos($liNode['class'], 'active')) {
                    $allInactive = false;
                    break;
                }
            }
            // Add the other-section, but not in the first UL
            if (0 != $ulNodesCounter && $allInactive) {
                $ulNode['class'] = isset($ulNode['class']) ? $ulNode['class'].' other-section' : 'other-section';
            }
            ++$ulNodesCounter;
        }

        // Delete all odePageId attributes becuase they aren't neccesary
        $liNodes = $navUl->xpath('//li/@odePageId');
        foreach ($liNodes as $node) {
            unset($node[0]);
        }

        return $navMain;
    }

    /**
     *  Generates html of page header.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param ThemeDto            $theme
     * @param array               $pagePropertiesDict
     * @param string              $resourcesPrefix
     * @param string              $exportType
     * @param bool                $showHeaderImgs
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLPageHeader(
        $odeNavStructureSync,
        $visiblesPages,
        $odeProperties,
        $translator,
        $theme,
        $pagePropertiesDict,
        $exportType,
        $resourcesPrefix,
        $showHeaderImgs = true,
    ) {
        // Page header
        $pageHeaderMain = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><header-main></header-main>');
        $pageHeader = $pageHeaderMain->addChild('header', ' ');
        $pageHeader->addAttribute('id', 'header-'.$odeNavStructureSync->getOdePageId());
        $headerEmpty = true;
        $titlePage = isset($pagePropertiesDict['titlePage']) ? $pagePropertiesDict['titlePage'] : '';

        // Page header imgs container
        if ($showHeaderImgs) {
            $themeHeaderLogo = $theme->getLogoImg();
            $themeHeaderImg = $theme->getHeaderImg();
            if ($themeHeaderLogo || $themeHeaderImg) {
                $headerEmpty = false;
                $pageHeaderContainer = $pageHeader->addChild('div', ' ');
                $pageHeaderContainer->addAttribute('id', 'header-node-content');
                $pageHeaderContainer->addAttribute('class', 'header');
                // Page logo img
                if ($themeHeaderLogo) {
                    $themeLogoPath = Constants::EXPORT_DIR_THEME.Constants::SLASH.$themeHeaderLogo;
                    $themeLogoPath = $resourcesPrefix.$themeLogoPath;
                    $pageLogo = $pageHeaderContainer->addChild('div', ' ');
                    $pageLogo->addAttribute('class', 'img logo-img-container');
                    $pageLogo->addAttribute('style', 'background-image: url('.$themeLogoPath.')');
                }
                // Page header img
                if ($themeHeaderImg) {
                    $themeHeaderPath = Constants::EXPORT_DIR_THEME.Constants::SLASH.$themeHeaderImg;
                    $themeHeaderPath = $resourcesPrefix.$themeHeaderPath;
                    $pageHeaderImg = $pageHeaderContainer->addChild('div', ' ');
                    $pageHeaderImg->addAttribute('class', 'img header-img-container');
                    $pageHeaderImg->addAttribute('style', 'background-image: url('.$themeHeaderPath.')');
                }
            }
        }

        // Page number
        if (
            isset($odeProperties['pp_addPagination'])
            && 'true' == $odeProperties['pp_addPagination']->getValue()
            && Constants::EXPORT_TYPE_HTML5_SP != $exportType
        ) {
            $pageNumber = self::createHTMLPageNumber(
                $odeNavStructureSync,
                $visiblesPages,
                $translator
            );
            self::appendSimpleXml($pageHeader, $pageNumber);
        }

        // Page title
        if ('' != $titlePage) {
            $headerEmpty = false;
            $pageTitle = $pageHeader->addChild('h1', $titlePage);
            $pageTitle->addAttribute('class', 'page-title');
        }

        if ($headerEmpty) {
            $pageHeader->addAttribute('class', 'sr-av');
            $pageTitle = $pageHeader->addChild('h1', $odeNavStructureSync->getPageName());
            $pageTitle->addAttribute('id', 'page-title-node-content');
            $pageTitle->addAttribute('class', 'page-title');
        }

        return $pageHeaderMain;
    }

    /**
     * Generates html of nav buttons.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param array               $pagesFileData
     * @param array               $visiblesPages
     * @param array               $odeProperties
     * @param string              $resourcesPrefix
     * @param string              $isPreview
     * @param TranslatorInterface $translator
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLNavButtons(
        $odeNavStructureSync,
        $pagesFileData,
        $visiblesPages,
        $odeProperties,
        $resourcesPrefix,
        $isPreview,
        $translator,
    ) {
        $navButtons = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><nav-button></nav-button>');

        $localeODE = isset($odeProperties['pp_lang']) ? $odeProperties['pp_lang']->getValue() : '';

        try {
            // Change locale (eXe and elp in a different language)
            $translator->switchTemporaryLocale($localeODE);
            $previousButtonText = $translator->trans('Previous');
            $nextButtonText = $translator->trans('Next');
        } catch (\Exception $e) {
            error_log('Error changing locale: '.$e->getMessage());
            throw $e;
        } finally {
            // Restore locale GUI
            $translator->restorePreviousLocale();
        }

        $navButtonsContainer = $navButtons->addChild('div', ' ');
        $navButtonsContainer->addAttribute('class', 'nav-buttons');

        $prePageData = $visiblesPages[$odeNavStructureSync->getOdePageId()]['previousPage'];

        if ($prePageData) {
            $leftLink = !$isPreview ? $resourcesPrefix.$visiblesPages[$prePageData]['url'] : $visiblesPages[$prePageData]['url'];
            $navButtonLeft = $navButtonsContainer->addChild('a', ' ');
            $navButtonLeft->addAttribute('href', $leftLink);
            $navButtonLeft->addAttribute('title', $previousButtonText);
            $navButtonLeft->addAttribute('class', 'nav-button nav-button-left');
            $navButtonLeft->addChild('span', $previousButtonText);
        } else {
            $navButtonLeft = $navButtonsContainer->addChild('span', ' ');
            $navButtonLeft->addAttribute('class', 'nav-button nav-button-left');
            $navButtonLeft->addAttribute('aria-hidden', 'true');
            $navButtonLeft->addChild('span', $previousButtonText);
        }

        $nextPageData = $visiblesPages[$odeNavStructureSync->getOdePageId()]['nextPage'];
        if ($nextPageData) {
            $rightLink = !$isPreview ? $resourcesPrefix.$visiblesPages[$nextPageData]['url'] : $visiblesPages[$nextPageData]['url'];
            $navButtonRight = $navButtonsContainer->addChild('a', ' ');
            $navButtonRight->addAttribute('href', $rightLink);
            $navButtonRight->addAttribute('title', $nextButtonText);
            $navButtonRight->addAttribute('class', 'nav-button nav-button-right');
            $navButtonRight->addChild('span', $nextButtonText);
        } else {
            $navButtonRight = $navButtonsContainer->addChild('span', ' ');
            $navButtonRight->addAttribute('class', 'nav-button nav-button-right');
            $navButtonRight->addAttribute('aria-hidden', 'true');
            $navButtonRight->addChild('span', $nextButtonText);
        }

        return $navButtons;
    }

    /**
     * Generates html of page number.
     *
     * @param OdeNavStructureSync $odeNavStructureSync
     * @param array               $visiblesPages
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLPageNumber(
        $odeNavStructureSync,
        $visiblesPages,
        $translator,
    ) {
        $pageNumber = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><page-number></page-number>');

        $pageNumberContainer = $pageNumber->addChild('p', ' ');
        $pageNumberContainer->addAttribute('class', 'page-counter');

        $currentPage = array_search($odeNavStructureSync->getOdePageId(), array_keys($visiblesPages)) + 1;
        $totalPages = count($visiblesPages);

        $pageNumberLabelText = $translator->trans('Page').' ';
        $pageNumberLabel = $pageNumberContainer->addChild('span', $pageNumberLabelText);
        $pageNumberLabel->addAttribute('class', 'page-counter-label');

        $pageNumberContent = $pageNumberContainer->addChild('span', ' ');
        $pageNumberContent->addAttribute('class', 'page-counter-content');

        $pageNumberCurrentPageSpan = $pageNumberContent->addChild('strong', $currentPage);
        $pageNumberCurrentPageSpan->addAttribute('class', 'page-counter-current-page');

        $pageNumberSlashSpan = $pageNumberContent->addChild('span', '/');
        $pageNumberSlashSpan->addAttribute('class', 'page-counter-sep');

        $pageNumberTotalPageSpan = $pageNumberContent->addChild('strong', $totalPages);
        $pageNumberTotalPageSpan->addAttribute('class', 'page-counter-total');

        return $pageNumber;
    }

    /**
     * Generates html of block.
     *
     * @param OdePagStructureSync $odePagStructureSync
     * @param array               $odeProperties
     * @param array               $idevicesMapping
     * @param array               $idevicesTypesData
     * @param ThemeDto            $theme
     * @param array               $userPreferencesDtos
     * @param bool                $exportDynamicPage
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLBlock(
        $odePagStructureSync,
        $odeProperties,
        $idevicesMapping,
        $idevicesTypesData,
        $userPreferencesDtos,
        $theme,
        $resourcesPrefix,
        $exportDynamicPage,
        $translator,
    ) {
        $block = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><block></block>');

        // Block properties
        $blockProperties = $odePagStructureSync->getOdePagStructureSyncProperties();
        $blockPropertiesDict = [];
        foreach ($blockProperties as $property) {
            if ($property->getValue()) {
                $blockPropertiesDict[$property->getKey()] = $property->getValue();
            }
        }

        $blockContainer = $block->addChild('article', ' ');

        $class = 'box';

        // Check if the block has an icon and/or a title
        $boxHasHeader = false;
        $themeIcons = $theme->getIcons();
        $iconId = $odePagStructureSync->getIconName();
        $iconFilePath = isset($themeIcons[$iconId]['value']) ? $themeIcons[$iconId]['value'] : false;
        if ($iconFilePath && '' != $iconFilePath) {
            $boxHasHeader = true;
        }
        $titleText = $odePagStructureSync->getBlockName() ? $odePagStructureSync->getBlockName() : ' ';
        if ($exportDynamicPage) {
            if (' ' != $titleText) {
                $boxHasHeader = true;
            }
        }
        // Add a CSS class if not
        if (!$boxHasHeader) {
            $class .= ' no-header';
        }

        if (isset($blockPropertiesDict['minimized']) && 'true' == $blockPropertiesDict['minimized']) {
            $class .= ' minimized';
        }

        if (isset($blockPropertiesDict['cssClass'])) {
            $class .= ' '.$blockPropertiesDict['cssClass'];
        }

        $blockContainer->addAttribute('id', $odePagStructureSync->getOdeBlockId());
        $blockContainer->addAttribute('class', $class);

        /* To review
        if ($exportDynamicPage) {
            foreach ($blockPropertiesDict as $key => $value) {
                $blockContainer->addAttribute('data-'.$key, $value);
            }
        }
        */

        // Block head
        $blockHead = self::createHTMLBlockHead(
            $odePagStructureSync,
            $blockPropertiesDict,
            $odeProperties,
            $userPreferencesDtos,
            $theme,
            $resourcesPrefix,
            $exportDynamicPage,
            $boxHasHeader,
            $translator,
        );
        self::appendSimpleXml($blockContainer, $blockHead);

        // Block content
        $blockContent = $blockContainer->addChild('div', ' ');
        $blockContent->addAttribute('class', 'box-content');

        foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
            $idevice = self::createHTMLIdevice(
                $odeComponentsSync,
                $odeProperties,
                $idevicesMapping,
                $idevicesTypesData,
                $userPreferencesDtos,
                $resourcesPrefix,
                $exportDynamicPage
            );
            self::appendSimpleXml($blockContent, $idevice);
        }

        return $block;
    }

    /**
     * Generates html of block head.
     *
     * @param OdePagStructureSync $odePagStructureSync
     * @param array               $blockPropertiesDict
     * @param array               $odeProperties
     * @param array               $userPreferencesDtos
     * @param ThemeDto            $theme,
     * @param string              $resourcesPrefix
     * @param bool                $exportDynamicPage
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLBlockHead(
        $odePagStructureSync,
        $blockPropertiesDict,
        $odeProperties,
        $userPreferencesDtos,
        $theme,
        $resourcesPrefix,
        $exportDynamicPage,
        $boxHasHeader,
        $translator,
    ) {
        $blockHead = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><block-head></block-head>');

        if ($boxHasHeader) {
            $blockHeadContainer = $blockHead->addChild('header', ' ');
            $boxHeadClass = 'box-head';
            // Icon
            if ($exportDynamicPage) {
                $themeIcons = $theme->getIcons();
                $iconId = $odePagStructureSync->getIconName();
                $iconFilePath = isset($themeIcons[$iconId]['value']) ? $themeIcons[$iconId]['value'] : false;

                if ($iconFilePath && '' != $iconFilePath) {
                    $blockHeadIconContainer = $blockHeadContainer->addChild('div', ' ');
                    $blockHeadIconContainer->addAttribute('class', 'box-icon exe-icon');

                    $iconFilePathExplode = explode(Constants::SLASH, $iconFilePath);
                    $iconFile = end($iconFilePathExplode);
                    $themeIconPath = Constants::EXPORT_DIR_THEME.Constants::SLASH.'icons'.Constants::SLASH.$iconFile;
                    $themeIconPath = $resourcesPrefix.$themeIconPath;
                    $blockHeadIcon = $blockHeadIconContainer->addChild('img', ' ');
                    $blockHeadIcon->addAttribute('src', $themeIconPath);
                    $blockHeadIcon->addAttribute('alt', '');
                } else {
                    $boxHeadClass .= ' no-icon';
                }
            }
            $blockHeadContainer->addAttribute('class', $boxHeadClass);

            // Title
            $titleText = $odePagStructureSync->getBlockName() ? $odePagStructureSync->getBlockName() : '';
            if ('' != $titleText) {
                $blockHeadTitle = $blockHeadContainer->addChild('h1', $titleText);
                $blockHeadTitle->addAttribute('class', 'box-title');
            }
        } else {
            $blockHeadContainer = $blockHead->addChild('div', ' ');
            $blockHeadContainer->addAttribute('class', 'box-head');
        }

        // Toggle
        $allowToggle = isset($blockPropertiesDict['allowToggle']) && 'true' == $blockPropertiesDict['allowToggle'];

        if ($exportDynamicPage && $allowToggle) {
            $minimizedByDefault = isset($blockPropertiesDict['minimized']) && 'true' == $blockPropertiesDict['minimized'];
            $class = 'box-toggle ';
            $class .= $minimizedByDefault ? 'box-toggle-off' : 'box-toggle-on';

            $blockHeadTogglerText = $translator->trans('Toggle content');
            $blockHeadToggle = $blockHeadContainer->addChild('button', ' ');
            $blockHeadToggle->addAttribute('class', $class);
            $blockHeadToggle->addAttribute('title', $blockHeadTogglerText);
            $blockHeadToggleSpan = $blockHeadToggle->addChild('span', $blockHeadTogglerText);
        }

        return $blockHead;
    }

    /**
     * Generates html of idevice.
     *
     * @param OdeComponentsSync $odeComponentsSync
     * @param array             $odeProperties
     * @param array             $idevicesMapping
     * @param array             $idevicesTypesData
     * @param array             $userPreferencesDtos
     * @param bool              $exportDynamicPage
     *
     * @return SimpleXMLElement
     */
    public static function createHTMLIdevice(
        $odeComponentsSync,
        $odeProperties,
        $idevicesMapping,
        $idevicesTypesData,
        $userPreferencesDtos,
        $resourcesPrefix,
        $exportDynamicPage,
    ) {
        $idevice = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><idevice></idevice>');

        // Idevice properties
        $ideviceProperties = $odeComponentsSync->getOdeComponentsSyncProperties();
        $idevicePropertiesDict = [];

        if ($exportDynamicPage) {
            foreach ($ideviceProperties as $property) {
                if ($property->getValue()) {
                    $idevicePropertiesDict[$property->getKey()] = $property->getValue();
                }
            }
        }

        $ideviceTypeName = $odeComponentsSync->getOdeIdeviceTypeName();

        if (isset($idevicesTypesData[$ideviceTypeName])) {
            $ideviceTypeData = $idevicesTypesData[$ideviceTypeName];
        } else {
            $ideviceTypeData = false;
        }

        $idevicesTypeDirUrl = $resourcesPrefix.Constants::EXPORT_DIR_IDEVICES.Constants::SLASH;
        $ideviceTypeDirUrl = $idevicesTypeDirUrl.$ideviceTypeName.Constants::SLASH;

        $ideviceContentKey = 'IDEVICE_CONTENT_KEY_'.$odeComponentsSync->getOdeIdeviceId();
        $ideviceContainer = $idevice->addChild('div', $ideviceContentKey);

        $class = 'idevice_node';
        if ($ideviceTypeData) {
            $class .= ' '.$ideviceTypeData['class'];
        }
        if (!$odeComponentsSync->getHtmlView()) {
            $class .= ' db-no-data';
        }
        if (isset($idevicePropertiesDict['cssClass'])) {
            $class .= ' '.$idevicePropertiesDict['cssClass'];
        }

        $ideviceContainer->addAttribute('id', $odeComponentsSync->getOdeIdeviceId());
        $ideviceContainer->addAttribute('class', $class);

        if ($exportDynamicPage && $ideviceTypeData) {
            $typeComponent = $ideviceTypeData['component-type'] ? $ideviceTypeData['component-type'] : 'js';
            // data-idevice-path is required by some iDevices to load images and other files
            $ideviceContainer->addAttribute('data-idevice-path', $ideviceTypeDirUrl);
            // data-idevice-type is required by the initScorm method of exe_export.js.
            $ideviceContainer->addAttribute('data-idevice-type', $ideviceTypeName);
            // JSON iDevices need some extra attributes
            if ('json' == $typeComponent) {
                $ideviceContainer->addAttribute('data-idevice-component-type', $typeComponent);
                $ideviceContainer->addAttribute('data-idevice-json-data', $odeComponentsSync->getJsonProperties());
                $ideviceContainer->addAttribute('data-idevice-template', $ideviceTypeData['template']);
                // Properties
                /* To review:
                foreach ($idevicePropertiesDict as $key => $value) {
                    $ideviceContainer->addAttribute('data-'.$key, $value);
                }
                */
            }
        }

        return $idevice;
    }

    // //////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Insert one xml into another as a child.
     *
     * @param SimpleXMLElement $simplexmlTo
     * @param SimpleXMLElement $simplexmlFrom
     * @param bool             $copyParent
     *
     * @return void
     */
    public static function appendSimpleXml(
        &$simplexmlTo,
        &$simplexmlFrom,
        $copyParent = false,
    ) {
        if ($copyParent) {
            $simplexmlTemp = $simplexmlTo->addChild($simplexmlFrom->getName(), (string) $simplexmlFrom);
            foreach ($simplexmlFrom->attributes() as $attr_key => $attr_value) {
                $simplexmlTemp->addAttribute($attr_key, $attr_value);
            }
        }
        foreach ($simplexmlFrom->children() as $simplexmlChild) {
            $simplexmlTemp = $simplexmlTo->addChild($simplexmlChild->getName(), (string) $simplexmlChild);
            foreach ($simplexmlChild->attributes() as $attr_key => $attr_value) {
                $simplexmlTemp->addAttribute($attr_key, $attr_value);
            }
            self::appendSimpleXml($simplexmlTemp, $simplexmlChild);
        }
    }

    /**
     * insert a SimpleXMLElement after some other SimpleXMLElement.
     *
     * @param SimpleXMLElement $insert
     * @param SimpleXMLElement $target
     *
     * @return void
     */
    public static function insertAfterSimpleXml($insert, $target)
    {
        $target_dom = dom_import_simplexml($target);
        $insert_dom = $target_dom->ownerDocument->importNode(dom_import_simplexml($insert), true);

        return $target_dom->parentNode->appendChild($insert_dom);
    }

    /**
     * add a SimpleXMLElement as a child of another SimpleXMLElement.
     *
     * @return void
     */
    public static function addChildSimpleXMLElement($father, $childToAdd)
    {
        $newChild = $father->addChild($childToAdd->getName());

        // copy attributes
        foreach ($childToAdd->attributes() as $attribute => $value) {
            $newChild->addAttribute($attribute, $value);
        }

        // Copy child nodes (recursively if necessary)
        foreach ($childToAdd->children() as $child) {
            self::addChildSimpleXMLElement($newChild, $child); // Recursion for grandchildren, etc.
        }

        // If the child to add has direct text content (not just nested children)
        $textValue = (string) $childToAdd;
        if ('' !== trim($textValue) && 0 == count($childToAdd->children())) {
            $newChild[0] = $textValue; // Assign the text value
        }
    }

    /**
     * Search for libraries paths in idevices to add to head and copy libraries.
     *
     * @param OdeNavStructureSyncs $odeNavStructureSyncs
     * @param array                $odeProperties
     * @param string               $exportType
     *
     * @return array
     */
    public static function getPathForLibrariesInIdevices($odeNavStructureSyncs, $odeProperties, $exportType = null)
    {
        $dm = '/exe_math/';
        $commonPath = Constants::JS_APP_NAME.DIRECTORY_SEPARATOR.Constants::COMMON_NAME.DIRECTORY_SEPARATOR;
        $libsPath = Constants::LIBS_DIR.DIRECTORY_SEPARATOR;
        $librariesToCopy = [];
        $filesToCopy = [];
        $libsToSearch = [
            // the following library may not be mandatory
            // [constants::JS_APP_NAME.DIRECTORY_SEPARATOR.Constants::COMMON_NAME.DIRECTORY_SEPARATOR.'exe_export.js',"clas=xxxx"], //lleva SCORM y parece obligatorio para exportación web
            [$commonPath.'exe_effects', 'class', 'exe-fx', ['/exe_effects/exe_effects.js', '/exe_effects/exe_effects.css']],
            [$commonPath.'exe_games', 'class', 'exe-game', ['/exe_games/exe_games.js', '/exe_games/exe_games.css']],
            [$commonPath.'exe_highlighter', 'class', 'highlighted-code', ['/exe_highlighter/exe_highlighter.js', '/exe_highlighter/exe_highlighter.css']],
            [$commonPath.'exe_lightbox', 'rel', 'lightbox', ['/exe_lightbox/exe_lightbox.js', '/exe_lightbox/exe_lightbox.css']],
            [$commonPath.'exe_tooltips', 'class', 'exe-tooltip', ['/exe_tooltips/exe_tooltips.js']],
            [$commonPath.'exe_magnify', 'class', 'ImageMagnifierIdevice', ['/exe_magnify/mojomagnify.js']],
            [$commonPath.'exe_lightbox', 'class', 'imageGallery', ['/exe_lightbox/exe_lightbox.js', '/exe_lightbox/exe_lightbox.css']],
            [$commonPath.'exe_wikipedia', 'class', 'exe-wikipedia-content', ['/exe_wikipedia/exe_wikipedia.css']],
            [$commonPath.'exe_media', 'class', 'mediaelement', ['/exe_media/exe_media.js', '/exe_media/exe_media.css']],
            [$commonPath.'exe_media', 'regex', '/href=".*?\.(mp3|mp4|flv|ogg|ogv)" rel="lightbox.*?"/', ['/exe_media/exe_media.js', '/exe_media/exe_media.css']],
            [$libsPath.'abcjs', 'class', 'abc-music', ['/abcjs/abcjs-basic-min.js', '/abcjs/exe_abc_music.js', '/abcjs/abcjs-audio.css']],
            [$commonPath.'exe_math', 'regex', '/\\\((.*?)\\\)|\\\[(.*?)\\\]/', [$dm.'tex-mml-svg.js']],
            [$commonPath.'exe_math', 'class', 'DataGame', [$dm.'tex-mml-svg.js']],
        ];

        if (!is_array($odeNavStructureSyncs)) {
            $odeNavStructureSyncs = [$odeNavStructureSyncs];
        }

        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                    $htmlView = $odeComponentsSync->getHtmlView(); // ? $odeComponentsSync->getHtmlView() : $odeComponentsSync->getJsonProperties();
                    if ((null != $htmlView) && (!empty($htmlView))) {
                        foreach ($libsToSearch as $libToSearch) {
                            if (!in_array($libToSearch[0], $librariesToCopy)) {
                                // search for math expressions - LaTeX
                                if ($commonPath.'exe_math' === $libToSearch[0] && 'regex' === $libToSearch[1]) {
                                    if (preg_match($libToSearch[2], $htmlView)) {
                                        $position = 0;
                                        foreach ($libsToSearch as $index => $lib) {
                                            if ($lib[0] === $commonPath.'exe_wikipedia') {
                                                $position = $index;
                                                break;
                                            }
                                        }
                                        if (!preg_match('/'.$libsToSearch[$position][1].'="[^"]*'.$libsToSearch[$position][2].'[^"]*"/', $htmlView)) {
                                            $librariesToCopy[] = $libToSearch[0];
                                            $filesToCopy[] = $libToSearch[3];
                                        }
                                    }
                                } elseif ($commonPath.'exe_media' === $libToSearch[0] && 'regex' === $libToSearch[1]) {
                                    // search for media expressions - LaTeX
                                    if (preg_match($libToSearch[2], $htmlView)) {
                                        $librariesToCopy[] = $libToSearch[0];
                                        $filesToCopy[] = $libToSearch[3];
                                    }
                                } else {
                                    // regular expression that searches for effect, math, ..classes in the html view
                                    if (preg_match('/'.$libToSearch[1].'="[^"]*'.$libToSearch[2].'[^"]*"/', $htmlView)) {
                                        if ($commonPath.'exe_math' === $libToSearch[0] && 'class' === $libToSearch[1]) {
                                            // obtain text of that div, decrypt it and search for latex expressions in it
                                            $text = '';
                                            if (preg_match('/<div[^>]*class="[^"]*DataGame[^"]*"[^>]*>(.*?)<\/div>/s', $htmlView, $matches)) {
                                                $text = $matches[1];
                                            }
                                            $text = ExportXmlUtil::decrypt($text);
                                            if (preg_match('/\\\((.*?)\\\)|\\\[(.*?)\\\]/', $text)) {
                                                $librariesToCopy[] = $libToSearch[0];
                                                $filesToCopy[] = $libToSearch[3];
                                            }
                                        } else {
                                            $librariesToCopy[] = $libToSearch[0];
                                            $filesToCopy[] = $libToSearch[3];
                                        }
                                    }
                                }
                            }
                        }
                        // exits the loop if all libraries have already been included
                        if (count($libsToSearch) === count($librariesToCopy)) {
                            break 3;
                        }
                    }
                }
            }
        }

        if (null !== $exportType) {
            // Get resources url
            $libsResourcesUrlPath = ['js' => [], 'css' => []];
            $exportScriptsBase = [
                '/jquery/jquery.min.js',
                '/common_i18n.js',
                '/common.js',
                '/exe_export.js',
                '/bootstrap/bootstrap.bundle.min.js',
                '/bootstrap/bootstrap.min.css',
            ];

            if ('true' == $odeProperties['pp_addAccessibilityToolbar']->getValue()) {
                $filesAToolbar = [
                    '/exe_atools/exe_atools.js',
                    '/exe_atools/exe_atools.css',
                ];
                $exportScriptsBase = array_merge($exportScriptsBase, $filesAToolbar);
            }

            // Base files to link
            $exportScripts = [];
            $exportScripts = array_merge($exportScriptsBase, ...$filesToCopy);

            // Extra files to link by export type
            if (isset(Constants::EXPORT_SYMFONY_SCRIPTS_LOADING_BY_EXPORT[$exportType])) {
                $exportScriptsExtra = Constants::EXPORT_SYMFONY_SCRIPTS_LOADING_BY_EXPORT[$exportType];
                $exportScripts = array_merge($exportScripts, $exportScriptsExtra);
            }

            // Group by file type
            foreach ($exportScripts as $file) {
                $ext = pathinfo($file, PATHINFO_EXTENSION);
                switch ($ext) {
                    case 'js':
                        $libsResourcesUrlPath['js'][] = Constants::EXPORT_DIR_PUBLIC_LIBS.$file;
                        break;
                    case 'css':
                        $libsResourcesUrlPath['css'][] = Constants::EXPORT_DIR_PUBLIC_LIBS.$file;
                        break;
                    default:
                        break;
                }
            }

            return $libsResourcesUrlPath;
        }

        // copy exe_powered_logo
        if ('true' == $odeProperties['pp_addExeLink']->getValue()) {
            $librariesToCopy[] = $commonPath.'/exe_powered_logo/exe_powered_logo.png';
        }

        if ('true' == $odeProperties['pp_addAccessibilityToolbar']->getValue()) {
            $librariesToCopy[] = $commonPath.'exe_atools';
            $filesToCopy[] = [
                '/exe_atools/exe_atools.js',
                '/exe_atools/exe_atools.css',
            ];
        }

        // TODO issue 315
        // if ('true' == $odeProperties['pp_addSearchBox']->getValue()) {
        //    Aquí añadimos los ficheros de búsqueda
        // }

        return [$librariesToCopy, $filesToCopy];
    }

    /**
     * Decrypts a given string.
     *
     * @param string $str
     *
     * @return string
     */
    public static function decrypt($str)
    {
        $str = $str ?? '';
        $str = ('undefined' === $str || 'null' === $str) ? '' : $str;
        $str = urldecode($str);
        try {
            $key = 146;
            $pos = 0;
            $ostr = '';
            while ($pos < strlen($str)) {
                $ostr .= chr($key ^ ord($str[$pos]));
                ++$pos;
            }

            return $ostr;
        } catch (\Exception $ex) {
            return '';
        }
    }

    /**
     * Creates the eXe link for the footer.
     *
     * @param TranslatorInterface $translator
     *
     * @return SimpleXMLElement
     */
    public static function createMadeWithExeLink($translator)
    {
        $eXeLink = new \SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><made-with-exe-link></made-with-exe-link>');

        $eXeLinkP = $eXeLink->addChild('p', ' ');
        $eXeLinkP->addAttribute('id', 'made-with-eXe');

        $eXeLinkA = $eXeLinkP->addChild('a', ' ');
        $eXeLinkA->addAttribute('href', 'https://exelearning.net/');
        $eXeLinkA->addAttribute('target', '_blank');
        $eXeLinkA->addAttribute('rel', 'noopener');

        $eXeLinkSpan1 = $eXeLinkA->addChild('span', $translator->trans('Made with eXeLearning').' ');
        $eXeLinkSpan2 = $eXeLinkSpan1->addChild('span', $translator->trans('(new window)'));

        return $eXeLink;
    }

    /**
     * Adds common exported files to the IMS manifest.
     *
     * @param SimpleXMLElement $resource      the XML resource to add files to
     * @param string           $exportDirPath the path to the export directory
     * @param string           $dir           the directory to add files from
     */
    public static function addCommonExportedFilesToImsManifest($resource, $exportDirPath, $dir)
    {
        $resourcesDir = $exportDirPath.$dir;
        if (is_dir($resourcesDir)) {
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($resourcesDir));
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $relativePath = str_replace($resourcesDir.'/', '', $file->getPathname());
                    $fileElement = $resource->addChild('file');
                    $fileElement->addAttribute('href', $dir.'/'.$relativePath);
                }
            }
        }
    }

    /**
     * Adds exported files to the OPF manifest.
     *
     * @param string $exportDirPath the path to the export directory
     * @param string $dir           the directory to add files from
     */
    public static function addCommonExportedFilesToOpfManifest($manifest, $exportDirPath, $dir)
    {
        $resourcesDir = $exportDirPath.$dir;
        if (is_dir($resourcesDir)) {
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($resourcesDir));
            foreach ($iterator as $file) {
                if ($file->isFile()) {
                    $relativePath = str_replace($resourcesDir.'/', '', $file->getPathname());
                    $item = $manifest->addChild('item', ' ');
                    $item->addAttribute('id', $dir.'/'.$relativePath);
                    $item->addAttribute('href', $dir.'/'.$relativePath);
                    $item->addAttribute('media-type', mime_content_type($file->getPathname()));
                    $item->addAttribute('fallback', 'fallback');
                }
            }
        }
    }

    /**
     * Determines if a page should be visible in the export.
     *
     * @param array $odeNavStructureSyncs Collection of OdeNavStructureSyncs
     * @param int   $indexNode            Index of the current page in $odeNavStructureSyncs
     *
     * @return bool
     */
    public static function isVisibleExport($odeNavStructureSyncs, $indexNode)
    {
        // Get the current OdeNavStructureSync
        if (!isset($odeNavStructureSyncs[$indexNode])) {
            return false;
        }
        $currentNavSync = $odeNavStructureSyncs[$indexNode];

        // Get properties of the current page
        $pageProperties = $currentNavSync->getOdeNavStructureSyncProperties();
        unset($pagePropertiesDict);
        $pagePropertiesDict = [];
        foreach ($pageProperties as $property) {
            if ($property->getKey()) {
                $pagePropertiesDict[$property->getKey()] = $property;
            }
        }

        // If the current page is not visible, return false
        if (
            isset($pagePropertiesDict['visibility'])
            && method_exists($pagePropertiesDict['visibility'], 'getValue')
            && 'false' === $pagePropertiesDict['visibility']->getValue()
        ) {
            return false;
        }

        // Check visibility of parent pages recursively
        $odeParentPageId = $currentNavSync->getOdeParentPageId();
        if (null !== $odeParentPageId) {
            // Find the index of the parent in $odeNavStructureSyncs
            foreach ($odeNavStructureSyncs as $parentIndex => $navSync) {
                if ($navSync->getOdePageId() == $odeParentPageId) {
                    // Recursive call for the parent
                    return self::isVisibleExport($odeNavStructureSyncs, $parentIndex);
                }
            }
        }

        // If there are no restrictions, it is visible
        return true;
    }
}
