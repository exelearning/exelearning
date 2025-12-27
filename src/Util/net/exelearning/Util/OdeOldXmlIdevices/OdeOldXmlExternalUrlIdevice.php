<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlExternalUrlIdevice.
 */
class OdeOldXmlExternalUrlIdevice
{
    // Old Xml idevice content
    public const OLD_ODE_XML_INSTANCE = 'instance';
    public const OLD_ODE_XML_DICTIONARY = 'dictionary';
    public const OLD_ODE_XML_LIST = 'list';
    public const OLD_ODE_XML_UNICODE = 'unicode';
    public const OLD_ODE_XML_ATTRIBUTES = '@attributes';
    // const OLD_ODE_XML_IDEVICE_TEXT = 'instance';
    public const OLD_ODE_XML_IDEVICE_TEXT_CONTENT = 'string role="key" value="content_w_resourcePaths"';
    // Create div external url
    public const SET_EXTERNAL_URL_DIV = '
        <div id="iframeWebsiteIdevice">
            <iframe src="{{changeUrl}}" size="2" width="600" height="{{changeHeight}}" style="width:100%;"></iframe>
            <div class="iframe-error-message" style="display:none;">Unable to display an iframe loaded over HTTP on a website that uses HTTPS.</div>
        </div>';

    public static function oldElpExternalUrlIdeviceStructure($odeSessionId, $odePageId, $externalUrlNodes, $generatedIds, $xpathNamespace)
    {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];

        $orderCounter = 1;

        foreach ($externalUrlNodes as $externalUrlNode) {
            $externalUrlNode->registerXPathNamespace('f', $xpathNamespace);

            // Get blockName using XPath
            $blockNameNode = $externalUrlNode->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");

            // Get URL using XPath - this is the correct way to get the url field
            $urlNode = $externalUrlNode->xpath("f:dictionary/f:string[@value='url']/following-sibling::f:unicode[1]/@value");

            // Get height using XPath
            $heightNode = $externalUrlNode->xpath("f:dictionary/f:string[@value='height']/following-sibling::f:unicode[1]/@value");

            // Check if we have a valid URL
            if (!empty($urlNode) && isset($urlNode[0])) {
                $subOdePagStructureSync = new OdePagStructureSync();
                $odeBlockId = Util::generateIdCheckUnique($generatedIds);
                $generatedIds[] = $odeBlockId;

                // OdePagStructureSync fields
                $subOdePagStructureSync->setOdeSessionId($odeSessionId);
                $subOdePagStructureSync->setOdePageId($odePageId);
                $subOdePagStructureSync->setOdeBlockId($odeBlockId);

                $blockName = !empty($blockNameNode) ? (string) $blockNameNode[0] : 'External Web Site';
                $subOdePagStructureSync->setBlockName($blockName);

                // Get order from reference attribute, or use counter if not available
                $orderPage = isset($externalUrlNode['reference']) && !empty((string) $externalUrlNode['reference'])
                    ? intval((string) $externalUrlNode['reference'])
                    : $orderCounter;
                $subOdePagStructureSync->setOdePagStructureSyncOrder($orderPage);

                // Get pagStructureSync properties
                $subOdePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();

                $odeComponentsSync = new OdeComponentsSync();
                $odeIdeviceId = Util::generateIdCheckUnique($generatedIds);
                $generatedIds[] = $odeIdeviceId;
                $odeComponentsMapping[] = $odeIdeviceId;

                // OdeComponentsSync fields
                $odeComponentsSync->setOdeSessionId($odeSessionId);
                $odeComponentsSync->setOdePageId($odePageId);
                $odeComponentsSync->setOdeBlockId($odeBlockId);
                $odeComponentsSync->setOdeIdeviceId($odeIdeviceId);

                $odeComponentsSync->setOdeComponentsSyncOrder(intval(1));
                // Set type
                $odeComponentsSync->setOdeIdeviceTypeName('external-website');

                $sessionPath = null;

                if (!empty($odeSessionId)) {
                    $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
                }

                // Common replaces for all OdeComponents
                $commonReplaces = [
                    'resources'.Constants::SLASH => $sessionPath.$odeIdeviceId.Constants::SLASH,
                ];

                // Get URL value from XPath result
                $externalUrl = (string) $urlNode[0];

                if (isset($commonReplaces)) {
                    $odeComponentsSyncHtmlView = self::applyReplaces(
                        $commonReplaces,
                        $externalUrl
                    );
                } else {
                    $odeComponentsSyncHtmlView = $externalUrl;
                }

                // Get height value, default to 300 if not found
                $height = !empty($heightNode) && isset($heightNode[0]) ? (string) $heightNode[0] : '300';

                $externalUrlDiv = self::SET_EXTERNAL_URL_DIV;

                $htmlReplace = [
                    '{{changeUrl}}' => $odeComponentsSyncHtmlView,
                    '{{changeHeight}}' => $height,
                ];
                $externalUrlDiv = self::applyHtmlChange($htmlReplace, $externalUrlDiv);

                $odeComponentsSync->setHtmlView($externalUrlDiv);

                // OdeComponentsSync property fields
                $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

                $subOdePagStructureSync->addOdeComponentsSync($odeComponentsSync);

                array_push($result['odeComponentsSync'], $subOdePagStructureSync);

                ++$orderCounter;
            }
        }

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

    /**
     * Applies the replaces passed as param.
     *
     * @param array  $replaces
     * @param string $text
     */
    private static function applyHtmlChange($replaces, $text)
    {
        $result = $text;

        foreach ($replaces as $search => $replace) {
            $result = str_replace($search, $replace, $result);
        }

        return $result;
    }
}
