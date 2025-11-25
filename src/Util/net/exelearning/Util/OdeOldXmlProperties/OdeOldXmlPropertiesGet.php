<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlProperties;

use App\Entity\net\exelearning\Entity\OdePropertiesSync;

/**
 * OdeOldXmlPropertiesGet.
 */
class OdeOldXmlPropertiesGet
{
    // metadata entity values tag name
    public const ENTITY_METADATA_TAG_VALUES =
        [
            'organization' => 'ORG',
            'name' => 'FN',
            'email' => 'EMAIL;TYPE=INTERNET',
        ];
    // duration values tag name
    public const DURATION_DATE_TAG_VALUES =
        [
            'years' => 'Y',
            'months' => 'M',
            'days' => 'D',
        ];
    public const DURATION_TIME_TAG_VALUES =
        [
            'hours' => 'H',
            'minutes' => 'M',
            'seconds' => 'S',
        ];
    // metadata schema values tag name
    public const METADATA_SCHEMA_VALUES =
        [
            'LOM' => 'LOMv1.0',
            'LOM-ES' => 'LOM-ESv1.0',
        ];
    // Old Xml idevice content
    public const ODE_XML_PROPERTIES_BOOLEAN =
        [
            'pp_intendedEndUserRoleGroup',
            'pp_intendedEndUserRoleTutor',
            'exportSource',
            'pp_addSearchBox',
            'pp_addPagination',
            'pp_addAccessibilityToolbar',
            'pp_addExeLink',
        ];
    public const ODE_XML_KEY_UNDERSCORE_POSITION = 0;
    public const ODE_XML_KEY_UNDERSCORE = '_';
    public const ODE_XML_KEY_PREFIX = 'pp';
    public const ODE_XML_TAG_FIELD_KEY = 'key';
    public const ODE_XML_TAG_FIELD_VALUE = 'value';
    public const OLD_ODE_XML_INSTANCE = 'instance';
    public const OLD_ODE_XML_DICTIONARY = 'dictionary';
    public const OLD_ODE_XML_LIST = 'list';
    public const OLD_ODE_XML_UNICODE = 'unicode';
    public const OLD_ODE_XML_ATTRIBUTES = '@attributes';
    // const OLD_ODE_XML_IDEVICE_TEXT = 'instance';
    public const OLD_ODE_XML_IDEVICE_TEXT_CONTENT = 'string role="key" value="content_w_resourcePaths"';

    public static function oldElpGeneralPropertiesGet($odeSessionId, $nodeGeneralProperties, $xpathNamespace)
    {
        $result = [];
        $result['exportMetadata'] = '';

        $nodeGeneralProperties->registerXPathNamespace('f', $xpathNamespace);
        $nodePropertiesKey = $nodeGeneralProperties->xpath("f:string[@role='key']");
        $result['odeProperties'] = [];

        foreach ($nodePropertiesKey as $xmlOdePropertyKey) {
            $xmlOdePropertyKey->registerXPathNamespace('f', $xpathNamespace);
            $nodePropertyValue = $xmlOdePropertyKey->xpath('./following-sibling::f:*[1]/@value');
            $propertyKey = $xmlOdePropertyKey['value'];
            $propertyKeyUnderscorePos = strpos($propertyKey, self::ODE_XML_KEY_UNDERSCORE);
            if (self::ODE_XML_KEY_UNDERSCORE_POSITION === $propertyKeyUnderscorePos) {
                $propertyKey = self::ODE_XML_KEY_PREFIX.$propertyKey;
            }

            // Change property if necessary
            $propertyChanges = self::generalPropertiesChange($propertyKey, $nodePropertyValue);
            $propertyKey = $propertyChanges['propertyKey'];
            $nodePropertyValue = $propertyChanges['nodePropertyValue'];

            if (!empty($nodePropertyValue)) {
                // Get exportMetadata type
                if ('exportMetadataType' == $propertyKey) {
                    $result['exportMetadata'] = $nodePropertyValue[0];
                }

                $odeProperties = new OdePropertiesSync();
                $odeProperties->setOdeSessionId($odeSessionId);
                $odeProperties->setKey($propertyKey);
                $odeProperties->setValue($nodePropertyValue[0]);
            }

            if (isset($odeProperties)) {
                array_push($result['odeProperties'], $odeProperties);
            }
        }

        return $result;
    }

    public static function oldElpCatalogPropertiesGet($odeSessionId, $nodeCatalogProperties, $propertyCatalogKey, $xpathNamespace)
    {
        $result = [];
        $result['odeProperties'] = [];

        $oldElpCatalogGeneralPropertiesGet = OdeOldXmlCatalogPropertiesGeneralGet::oldElpCatalogGeneralPropertiesGet($odeSessionId, $nodeCatalogProperties, $propertyCatalogKey, $xpathNamespace);

        $oldElpCatalogMetadataPropertiesGet = OdeOldXmlCatalogPropertiesMetadataGet::oldElpCatalogMetadataPropertiesGet($odeSessionId, $nodeCatalogProperties, $propertyCatalogKey, $xpathNamespace);

        $oldElpCatalogLifeCyclePropertiesGet = OdeOldXmlCatalogPropertiesLifeCycleGet::oldElpCatalogLifeCyclePropertiesGet($odeSessionId, $nodeCatalogProperties, $propertyCatalogKey, $xpathNamespace);

        $oldElpCatalogRightsPropertiesGet = OdeOldXmlCatalogPropertiesRightsGet::oldElpCatalogRightsPropertiesGet($odeSessionId, $nodeCatalogProperties, $propertyCatalogKey, $xpathNamespace);

        $oldElpCatalogAnnotationPropertiesGet = OdeOldXmlCatalogPropertiesAnnotationGet::oldElpCatalogAnnotationPropertiesGet($odeSessionId, $nodeCatalogProperties, $propertyCatalogKey, $xpathNamespace);

        $oldElpCatalogRelationPropertiesGet = OdeOldXmlCatalogPropertiesRelationGet::oldElpCatalogRelationPropertiesGet($odeSessionId, $nodeCatalogProperties, $propertyCatalogKey, $xpathNamespace);

        $oldElpCatalogTechnicalPropertiesGet = OdeOldXmlCatalogPropertiesTechnicalGet::oldElpCatalogTechnicalPropertiesGet($odeSessionId, $nodeCatalogProperties, $propertyCatalogKey, $xpathNamespace);

        $oldElpCatalogEducationalPropertiesGet = OdeOldXmlCatalogPropertiesEducationalGet::oldElpCatalogEducationalPropertiesGet($odeSessionId, $nodeCatalogProperties, $propertyCatalogKey, $xpathNamespace);

        $result['odeProperties'] = array_merge(
            $result['odeProperties'],
            $oldElpCatalogGeneralPropertiesGet['odeProperties'],
            $oldElpCatalogLifeCyclePropertiesGet['odeProperties'],
            $oldElpCatalogMetadataPropertiesGet['odeProperties'],
            $oldElpCatalogRightsPropertiesGet['odeProperties'],
            $oldElpCatalogAnnotationPropertiesGet['odeProperties'],
            $oldElpCatalogRelationPropertiesGet['odeProperties'],
            $oldElpCatalogTechnicalPropertiesGet['odeProperties'],
            $oldElpCatalogEducationalPropertiesGet['odeProperties'],
        );

        return $result;
    }

    private static function generalPropertiesChange($propertyKey, $nodePropertyValue)
    {
        $result = [];

        // Change value to true or false if boolean property
        if (in_array($propertyKey, self::ODE_XML_PROPERTIES_BOOLEAN)) {
            $nodePropertyValue[0] = str_replace('0', 'false', $nodePropertyValue[0]);
            $nodePropertyValue[0] = str_replace('1', 'true', $nodePropertyValue[0]);
        }

        $result['propertyKey'] = $propertyKey;
        $result['nodePropertyValue'] = $nodePropertyValue;

        return $result;
    }

    /**
     * Applies the replaces passed as param.
     *
     * @param array  $replaces
     * @param string $text
     */
    private static function applyReplaces($replaces, $text)
    {
        $result = $text;

        foreach ($replaces as $search => $replace) {
            $result = str_replace($search, $replace, $result);
        }

        return $result;
    }
}
