<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\JsonSanitizer;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlGalleryImageIdevice.
 *
 * Handles import of Image Gallery iDevice content from legacy ELP XML files.
 */
class OdeOldXmlGalleryImageIdevice
{
    // Old Xml idevice content
    public const OLD_ODE_XML_INSTANCE = 'instance';
    public const OLD_ODE_XML_DICTIONARY = 'dictionary';
    public const OLD_ODE_XML_LIST = 'list';
    public const OLD_ODE_XML_UNICODE = 'unicode';
    public const OLD_ODE_XML_ATTRIBUTES = '@attributes';
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
    ];

    /**
     * Processes Image Gallery iDevice structure from legacy ELP XML.
     *
     * @param string $odeSessionId      The session ID
     * @param string $odePageId         The page ID
     * @param array  $galleryImageNodes XML nodes containing gallery images
     * @param array  $generatedIds      Array of already generated IDs to avoid duplicates
     * @param string $xpathNamespace    XML namespace for XPath queries
     *
     * @return array Result containing odeComponentsSync and srcRoutes
     */
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

                // Safe extraction of image paths with null checks
                $imagePathValue = isset($imagePath[0]['value']) ? (string) $imagePath[0]['value'] : '';
                $thumbPathValue = isset($imagePath[1]['value']) ? (string) $imagePath[1]['value'] : '';

                $fullImagePath = $sessionPath.$odeIdeviceId.Constants::SLASH.$imagePathValue;
                $fullThumbnailPath = $sessionPath.$odeIdeviceId.Constants::SLASH.$thumbPathValue;

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

                // Sanitize title from XML to ensure valid UTF-8 for JSON encoding
                $jsonImg['title'] = !empty($titleNodes)
                    ? JsonSanitizer::sanitizeValue((string) $titleNodes[0])
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

            // Sanitize block name from XML
            $blockName = !empty($blockNameNode)
                ? JsonSanitizer::sanitizeValue((string) $blockNameNode[0])
                : '';
            $subOdePagStructureSync->setBlockName($blockName);

            // Handle missing reference attribute safely
            $orderPage = isset($galleryImageNode['reference']) && !empty((string) $galleryImageNode['reference'])
                ? intval((string) $galleryImageNode['reference'])
                : 0;
            $subOdePagStructureSync->setOdePagStructureSyncOrder($orderPage);

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

            // Use safe JSON encoding to handle any remaining encoding issues
            $jsonPropertiesEncoded = JsonSanitizer::safeJsonEncode($finalJson);

            // Validate and repair JSON if needed
            if (!JsonSanitizer::isValidJson($jsonPropertiesEncoded)) {
                $jsonPropertiesEncoded = JsonSanitizer::repairJson($jsonPropertiesEncoded);
            }

            $odeComponentsSync->setJsonProperties($jsonPropertiesEncoded);
            $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

            $subOdePagStructureSync->addOdeComponentsSync($odeComponentsSync);
            array_push($result['odeComponentsSync'], $subOdePagStructureSync);
        }

        return $result;
    }

    /**
     * Applies string replacements to text.
     *
     * @param array  $replaces Key-value pairs of search => replace
     * @param string $text     The text to process
     *
     * @return string Text with replacements applied
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
     * Applies replacements to text or array values.
     *
     * @param array        $replaces Key-value pairs of search => replace
     * @param string|array $text     The text or array to process
     *
     * @return string|array Processed text or array with replacements applied
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
