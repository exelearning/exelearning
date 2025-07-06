<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlImageMagnifierIdevice.
 */
class OdeOldXmlImageMagnifierIdevice
{
    // Old Xml idevice content
    public const OLD_ODE_XML_INSTANCE = 'instance';
    public const OLD_ODE_XML_DICTIONARY = 'dictionary';
    public const OLD_ODE_XML_LIST = 'list';
    public const OLD_ODE_XML_UNICODE = 'unicode';
    public const OLD_ODE_XML_ATTRIBUTES = '@attributes';
    // const OLD_ODE_XML_IDEVICE_TEXT = 'instance';
    public const OLD_ODE_XML_IDEVICE_TEXT_CONTENT = 'string role="key" value="content_w_resourcePaths"';
    // Create jsonProperties for idevice
    public const JSON_PROPERTIES = [
        'ideviceId' => '',
        'textTextarea' => '',
    ];

    public static function oldElpImageMagnifierIdeviceStructure($odeSessionId, $odePageId, $galleryImageNodes, $generatedIds, $xpathNamespace)
    {
        $result = [
            'odeComponentsSync' => [],
            'srcRoutes' => [],
        ];

        foreach ($galleryImageNodes as $galleryImageNode) {
            $galleryImageNode->registerXPathNamespace('f', $xpathNamespace);
            $odeIdeviceId = Util::generateIdCheckUnique($generatedIds);
            $generatedIds[] = $odeIdeviceId;

            $def = (string) ($galleryImageNode->xpath(
                "f:dictionary
             /f:instance[@class='exe.engine.field.MagnifierField']
             /f:dictionary
             /f:string[@value='defaultImage']
             /following-sibling::f:unicode[1]"
            )[0]['value'] ?? '');

            $glass = (string) ($galleryImageNode->xpath(
                "f:dictionary
             /f:instance[@class='exe.engine.field.MagnifierField']
             /f:dictionary
             /f:string[@value='glassSize']
             /following-sibling::f:unicode[1]"
            )[0]['value'] ?? '');

            $init = (string) ($galleryImageNode->xpath(
                "f:dictionary
             /f:instance[@class='exe.engine.field.MagnifierField']
             /f:dictionary
             /f:string[@value='initialZSize']
             /following-sibling::f:unicode[1]"
            )[0]['value'] ?? '');

            $max = (string) ($galleryImageNode->xpath(
                "f:dictionary
             /f:instance[@class='exe.engine.field.MagnifierField']
             /f:dictionary
             /f:string[@value='maxZSize']
             /following-sibling::f:unicode[1]"
            )[0]['value'] ?? '');

            $w = (string) ($galleryImageNode->xpath(
                "f:dictionary
             /f:instance[@class='exe.engine.field.MagnifierField']
             /f:dictionary
             /f:string[@value='width']
             /following-sibling::f:unicode[1]"
            )[0]['value'] ?? '');

            $h = (string) ($galleryImageNode->xpath(
                "f:dictionary
             /f:instance[@class='exe.engine.field.MagnifierField']
             /f:dictionary
             /f:string[@value='height']
             /following-sibling::f:unicode[1]"
            )[0]['value'] ?? '');

            $width = $w;
            $height = $h;

            $imageResource = (string) ($galleryImageNode->xpath(
                "f:dictionary
             /f:instance[@class='exe.engine.field.MagnifierField']
             /f:dictionary
             /f:instance[@class='exe.engine.resource.Resource']
             /f:dictionary
             /f:string[@value='_storageName']
             /following-sibling::f:string[1]"
            )[0]['value'] ?? '');
            $imageResource = basename($imageResource);
            $filenames = [];

            if (!empty($imageResource)) {
                $filenames[] = $imageResource;
            }

            $isDefaultImage = (string) ($galleryImageNode->xpath(
                "f:dictionary
             /f:instance[@class='exe.engine.field.MagnifierField']
             /f:dictionary
             /f:string[@value='isDefaultImage']
             /following-sibling::f:bool[1]"
            )[0]['value'] ?? '');

            $message = (string) ($galleryImageNode->xpath(
                "f:dictionary
             /f:instance[@class='exe.engine.field.MagnifierField']
             /f:dictionary
             /f:string[@value='message']
             /following-sibling::f:string[1]"
            )[0]['value'] ?? '');

            $lupaGlobals = [];
            $globalKeys = [
                '_title', '_alignInstruc', '_author', '_captionInstruc',
                '_dimensionInstruc', '_glassSizeInstruc', '_initialZoomInstruc',
                '_maxZoomInstruc', '_purpose', '_tip', '_typeName',
            ];
            foreach ($globalKeys as $key) {
                $node = $galleryImageNode->xpath(
                    "f:dictionary/f:string[@value='{$key}']/following-sibling::f:unicode[1]"
                );
                $lupaGlobals[$key] = isset($node[0]) ? (string) $node[0]['value'] : '';
            }

            $filenames = [];

            if (!empty($imageResource)) {
                $filenames[] = $imageResource;
            }

            $defaults = $galleryImageNode->xpath(
                ".//f:instance[@class='exe.engine.field.MagnifierField']
              /f:dictionary
              /f:string[@value='defaultImage']
              /following-sibling::f:unicode[1]"
            );
            foreach ($defaults as $d) {
                $filenames[] = basename((string) $d['value']);
            }

            $resources = $galleryImageNode->xpath(".//f:instance[@class='exe.engine.resource.Resource']");
            foreach ($resources as $res) {
                $path = $res->xpath(
                    "f:dictionary
                 /f:string[@value='_storageName']
                 /following-sibling::f:string[1]"
                );
                if (!empty($path)) {
                    $filenames[] = basename((string) $path[0]['value']);
                }
            }

            $textAreas = $galleryImageNode->xpath(
                ".//f:instance[@class='exe.engine.field.TextAreaField']
              /f:dictionary
              /f:unicode"
            );
            foreach ($textAreas as $htmlNode) {
                $html = (string) $htmlNode['value'];
                if (preg_match_all('/<img[^>]+src="resources\\/([^"]+)"/', $html, $m)) {
                    foreach ($m[1] as $img) {
                        $filenames[] = basename($img);
                    }
                }
            }

            $filenames = array_unique($filenames);
            $sessionPath = !empty($odeSessionId) ? UrlUtil::getOdeSessionUrl($odeSessionId) : '';
            $jsonImages = [];

            foreach ($filenames as $file) {
                $fullImagePath = $sessionPath.$odeIdeviceId.Constants::SLASH.$file;
                $jsonImages[] = $fullImagePath;
                $result['srcRoutes'][] = $fullImagePath;
            }

            $subOdePagStructureSync = new OdePagStructureSync();
            $odeBlockId = Util::generateIdCheckUnique($generatedIds);
            $generatedIds[] = $odeBlockId;

            $subOdePagStructureSync->setOdeSessionId($odeSessionId);
            $subOdePagStructureSync->setOdePageId($odePageId);
            $subOdePagStructureSync->setOdeBlockId($odeBlockId);

            $blockNameNode = $galleryImageNode->xpath(
                "f:dictionary/f:string[@value='caption']/following-sibling::f:unicode[1]/@value"
            );
            $subOdePagStructureSync->setBlockName((string) $blockNameNode[0]);

            $orderPage = intval($galleryImageNode['reference']);
            $subOdePagStructureSync->setOdePagStructureSyncOrder($orderPage);
            $subOdePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();

            $odeComponentsSync = new OdeComponentsSync();
            $odeComponentsSync->setOdeSessionId($odeSessionId);
            $odeComponentsSync->setOdePageId($odePageId);
            $odeComponentsSync->setOdeBlockId($odeBlockId);
            $odeComponentsSync->setOdeIdeviceId($odeIdeviceId);
            $odeComponentsSync->setOdeComponentsSyncOrder(1);
            $odeComponentsSync->setOdeIdeviceTypeName('magnifier');

            $htmlContentNode = $galleryImageNode->xpath(
                "f:dictionary
             /f:instance[@class='exe.engine.field.TextAreaField']
             /f:dictionary
             /f:string[@value='content_w_resourcePaths']
             /following-sibling::f:unicode[1]"
            );
            $originalHtml = isset($htmlContentNode[0]) ? (string) $htmlContentNode[0]['value'] : '';
            $originalHtml = preg_replace(
                '#(<img[^>]+src=["\'])resources/([^"\']+)#',
                '$1'.$sessionPath.$odeIdeviceId.Constants::SLASH.'$2',
                $originalHtml
            );

            //$odeComponentsSync->setHtmlView($originalHtml);

            $jsonProperties = self::JSON_PROPERTIES;
            $jsonProperties['ideviceId'] = $odeIdeviceId;
            $jsonProperties['textTextarea'] = $originalHtml;
            $jsonProperties += [
                'defaultImage' => $sessionPath.$odeIdeviceId.Constants::SLASH.basename($def),
                'glassSize' => $glass,
                'initialZSize' => $init,
                'maxZSize' => $max,
                'width' => $width,
                'height' => $height,
                'imageResource' => $sessionPath.$odeIdeviceId.Constants::SLASH.$imageResource,
                'isDefaultImage' => $isDefaultImage,
                'message' => $message,
            ];
            $jsonProperties += $lupaGlobals;

            $odeComponentsSync->setJsonProperties(json_encode($jsonProperties));
            $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();
            $subOdePagStructureSync->addOdeComponentsSync($odeComponentsSync);
            $result['odeComponentsSync'][] = $subOdePagStructureSync;
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
