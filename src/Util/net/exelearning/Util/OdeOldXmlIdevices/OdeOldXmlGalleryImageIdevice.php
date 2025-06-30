<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlGalleryImageIdevice.
 */
class OdeOldXmlGalleryImageIdevice
{
    // Old Xml idevice content
    public const OLD_ODE_XML_INSTANCE = 'instance';
    public const OLD_ODE_XML_DICTIONARY = 'dictionary';
    public const OLD_ODE_XML_LIST = 'list';
    public const OLD_ODE_XML_UNICODE = 'unicode';
    public const OLD_ODE_XML_ATTRIBUTES = '@attributes';
    // const OLD_ODE_XML_IDEVICE_TEXT = 'instance';
    public const OLD_ODE_XML_IDEVICE_TEXT_CONTENT = 'string role="key" value="content_w_resourcePaths"';
    // json Structure
    public const JSON_STRUCTURE = [
        'ideviceId' => '',
    ];
    // Images structure to add in json structure
    public const IMAGES_JSON_STRUCTURE = [
        'img' => '{{image_path}}',
        'thumbnail' => '{{thumb_path}}',
        'title' => '',
        'linktitle' => '',
        'author' => '',
        'linkauthor' => '',
        'license' => '',
        // "{'img':'{{image_path}}', 'thumbnail':'{{thumb_path}}', 'title':'', 'linktitle':'', 'author':'', 'linkauthor':'', 'license':''}"
    ];

    public static function oldElpGalleryImageIdeviceStructure($odeSessionId, $odePageId, $galleryImageNodes, $generatedIds, $xpathNamespace)
    {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];
        $jsonImages = [];

        foreach ($galleryImageNodes as $galleryImageNode) {
            // Count images to set in json
            $imageCount = 0;
            // Register namespace and read block title
            $galleryImageNode->registerXPathNamespace('f', $xpathNamespace);
            $blockNameNode = $galleryImageNode
                ->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");

            // Get all GalleryImage nodes
            $images = $galleryImageNode
                ->xpath("f:dictionary/f:instance/f:dictionary/f:list/f:instance[@class='exe.engine.galleryidevice.GalleryImage']");

            // Generate idevice ID
            $odeIdeviceId = Util::generateIdCheckUnique($generatedIds);
            $generatedIds[] = $odeIdeviceId;
            $odeComponentsMapping[] = $odeIdeviceId;

            foreach ($images as $image) {
                // Register namespace and read resource paths
                $image->registerXPathNamespace('f', $xpathNamespace);
                $imagePath = $image->xpath(
                    "f:dictionary
                     /f:instance[@class='exe.engine.resource.Resource']
                     /f:dictionary
                     /f:string[@value='_storageName']
                     /following-sibling::f:string[1]"
                );

                $sessionPath = !empty($odeSessionId)
                    ? UrlUtil::getOdeSessionUrl($odeSessionId)
                    : '';

                $fullImagePath = $sessionPath.$odeIdeviceId.Constants::SLASH.(string) $imagePath[0]['value'];
                $fullThumbnailPath = $sessionPath.$odeIdeviceId.Constants::SLASH.(string) $imagePath[1]['value'];

                // Common replacements for JSON paths
                $commonReplaces = [
                    '{{image_path}}' => $fullImagePath,
                    '{{thumb_path}}' => $fullThumbnailPath,
                ];

                $jsonProperties = self::IMAGES_JSON_STRUCTURE;
                $jsonImg = self::applyHtmlChange($commonReplaces, $jsonProperties);

                $titleNodes = $image->xpath(
                    "f:dictionary
                     /f:instance[@class='exe.engine.field.TextField']
                     /f:dictionary
                     /f:string[@role='key' and @value='content']
                     /following-sibling::f:unicode[1]/@value"
                );
                $jsonImg['title'] = !empty($titleNodes)
                    ? (string) $titleNodes[0]
                    : '';

                array_push($jsonImages, $jsonImg);
                array_push($result['srcRoutes'], $fullImagePath);
                array_push($result['srcRoutes'], $fullThumbnailPath);

                ++$imageCount;
            }

            $subOdePagStructureSync = new OdePagStructureSync();
            $odeBlockId = Util::generateIdCheckUnique($generatedIds);
            $generatedIds[] = $odeBlockId;

            $subOdePagStructureSync->setOdeSessionId($odeSessionId);
            $subOdePagStructureSync->setOdePageId($odePageId);
            $subOdePagStructureSync->setOdeBlockId($odeBlockId);
            $subOdePagStructureSync->setBlockName((string) $blockNameNode[0]);
            $subOdePagStructureSync->setOdePagStructureSyncOrder(intval($galleryImageNode['reference']));
            $subOdePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();

            $odeComponentsSync = new OdeComponentsSync();
            $odeComponentsSync->setOdeSessionId($odeSessionId);
            $odeComponentsSync->setOdePageId($odePageId);
            $odeComponentsSync->setOdeBlockId($odeBlockId);
            $odeComponentsSync->setOdeIdeviceId($odeIdeviceId);
            $odeComponentsSync->setOdeComponentsSyncOrder(1);
            $odeComponentsSync->setOdeIdeviceTypeName('image-gallery');

            $finalJson = self::JSON_STRUCTURE;
            $finalJson['ideviceId'] = $odeIdeviceId;
            foreach ($jsonImages as $idx => $imgData) {
                $finalJson['img_'.$idx] = $imgData;
            }
            $odeComponentsSync->setJsonProperties(json_encode($finalJson));
            $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

            $subOdePagStructureSync->addOdeComponentsSync($odeComponentsSync);
            array_push($result['odeComponentsSync'], $subOdePagStructureSync);
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
