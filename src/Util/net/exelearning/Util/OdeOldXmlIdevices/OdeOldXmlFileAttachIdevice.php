<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\JsonSanitizer;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlFileAttachIdevice.
 *
 * Handles import of File Attachment iDevice content from legacy ELP XML files.
 */
class OdeOldXmlFileAttachIdevice
{
    // Old Xml idevice content
    public const OLD_ODE_XML_INSTANCE = 'instance';
    public const OLD_ODE_XML_DICTIONARY = 'dictionary';
    public const OLD_ODE_XML_LIST = 'list';
    public const OLD_ODE_XML_UNICODE = 'unicode';
    public const OLD_ODE_XML_ATTRIBUTES = '@attributes';
    public const OLD_ODE_XML_IDEVICE_TEXT_CONTENT = 'string role="key" value="content_w_resourcePaths"';

    // Create jsonProperties for idevice
    public const JSON_PROPERTIES = [
        'ideviceId' => '',
        'textInfoDurationInput' => '',
        'textInfoParticipantsInput' => '',
        'textInfoDurationTextInput' => 'Duration:',
        'textInfoParticipantsTextInput' => 'Grouping:',
        'textTextarea' => '',
        'textFeedbackInput' => 'Show Feedback',
        'textFeedbackTextarea' => '',
    ];

    /**
     * Processes File Attachment iDevice structure from legacy ELP XML.
     *
     * @param string $odeSessionId      The session ID
     * @param string $odePageId         The page ID
     * @param array  $galleryImageNodes XML nodes containing file attachment data
     * @param array  $generatedIds      Array of already generated IDs to avoid duplicates
     * @param string $xpathNamespace    XML namespace for XPath queries
     *
     * @return array Result containing odeComponentsSync and srcRoutes
     */
    public static function oldElpFileAttachIdeviceStructure($odeSessionId, $odePageId, $galleryImageNodes, $generatedIds, $xpathNamespace)
    {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];
        $jsonImages = [];

        foreach ($galleryImageNodes as $galleryImageNode) {
            // Count images to set in json
            $imageCount = 0;
            // Get Images
            $galleryImageNode->registerXPathNamespace('f', $xpathNamespace);
            $files = $galleryImageNode->xpath("f:dictionary/f:string[@value='fileAttachmentFields']/
            following-sibling::f:list[1]/f:instance[@class='exe.engine.extendedfieldengine.FileField']");

            // Get blockName
            $blockNameNode = $galleryImageNode->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");

            $odeIdeviceId = Util::generateIdCheckUnique($generatedIds);
            $generatedIds[] = $odeIdeviceId;
            $odeComponentsMapping[] = $odeIdeviceId;

            foreach ($files as $file) {
                $fileInfo = [];
                // Get Image and thumbnail path
                $file->registerXPathNamespace('f', $xpathNamespace);
                $filePath = $file->xpath("f:dictionary/f:string[@value='fileResource']/
                following-sibling::f:instance[1]/f:dictionary/f:string[@value='_storageName']/following-sibling::f:string[1]");
                $fileDescription = $file->xpath("f:dictionary/f:string[@value='fileDescription']/
                following-sibling::f:instance[1]/f:dictionary/f:string[@value='content']/following-sibling::f:unicode[1]");

                $sessionPath = null;

                if (!empty($odeSessionId)) {
                    $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
                }

                // Safe extraction of file path
                $filePathValue = !empty($filePath) && isset($filePath[0]['value'])
                    ? (string) $filePath[0]['value']
                    : '';

                $fullImagePath = $sessionPath.$odeIdeviceId.Constants::SLASH.$filePathValue;

                // Common replaces for all OdeComponents
                $commonReplaces = [
                    '{{image_path}}' => $fullImagePath,
                ];

                $fileInfo['path'] = $fullImagePath;

                // Safe extraction and sanitization of file description
                $descriptionValue = !empty($fileDescription) && isset($fileDescription[0]['value'])
                    ? JsonSanitizer::sanitizeValue((string) $fileDescription[0]['value'])
                    : '';

                $fileInfo['description'] = $descriptionValue;

                // Use filename as description if description is empty
                if ('' === $fileInfo['description']) {
                    $fileInfo['description'] = $filePathValue;
                }

                array_push($jsonImages, $fileInfo);
                array_push($result['srcRoutes'], $fullImagePath);

                ++$imageCount;
            }

            $subOdePagStructureSync = new OdePagStructureSync();
            $odeBlockId = Util::generateIdCheckUnique($generatedIds);
            $generatedIds[] = $odeBlockId;

            // OdePagStructureSync fields
            $subOdePagStructureSync->setOdeSessionId($odeSessionId);
            $subOdePagStructureSync->setOdePageId($odePageId);
            $subOdePagStructureSync->setOdeBlockId($odeBlockId);

            // Sanitize block name from XML with null check
            $blockName = !empty($blockNameNode)
                ? JsonSanitizer::sanitizeValue((string) $blockNameNode[0])
                : '';
            $subOdePagStructureSync->setBlockName($blockName);

            // Handle missing reference attribute safely
            $orderPage = isset($galleryImageNode['reference']) && !empty((string) $galleryImageNode['reference'])
                ? intval((string) $galleryImageNode['reference'])
                : 0;
            $subOdePagStructureSync->setOdePagStructureSyncOrder($orderPage);

            // Get pagStructureSync properties
            $subOdePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();

            $odeComponentsSync = new OdeComponentsSync();

            // OdeComponentsSync fields
            $odeComponentsSync->setOdeSessionId($odeSessionId);
            $odeComponentsSync->setOdePageId($odePageId);
            $odeComponentsSync->setOdeBlockId($odeBlockId);
            $odeComponentsSync->setOdeIdeviceId($odeIdeviceId);

            $odeComponentsSync->setOdeComponentsSyncOrder(intval(1));
            // Set type
            $odeComponentsSync->setOdeIdeviceTypeName('text');

            $sessionPath = null;

            if (!empty($odeSessionId)) {
                $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
            }

            // Common replaces for all OdeComponents
            $commonReplaces = [
                'resources'.Constants::SLASH => $sessionPath.$odeIdeviceId.Constants::SLASH,
            ];

            $odeComponentsSyncHtmlView = '';

            $jsonProperties = self::JSON_PROPERTIES;
            $jsonProperties['ideviceId'] = $odeIdeviceId;

            // Build HTML view with proper escaping for security
            foreach ($jsonImages as $key => $jsonImage) {
                $safePath = htmlspecialchars($jsonImage['path'], ENT_QUOTES, 'UTF-8');
                $safeDescription = htmlspecialchars($jsonImage['description'], ENT_QUOTES, 'UTF-8');
                $odeComponentsSyncHtmlView .= '<p><a href="'.$safePath.'" target="_blank">'.$safeDescription.'</a></p>';
            }

            $odeComponentsSync->setHtmlView($odeComponentsSyncHtmlView);

            // Sanitize HTML content for JSON
            $jsonProperties['textTextarea'] = JsonSanitizer::sanitizeHtmlForJson($odeComponentsSyncHtmlView);

            // Create jsonProperties for idevice with safe encoding
            $jsonPropertiesEncoded = JsonSanitizer::safeJsonEncode($jsonProperties);

            // Validate and repair JSON if needed
            if (!JsonSanitizer::isValidJson($jsonPropertiesEncoded)) {
                $jsonPropertiesEncoded = JsonSanitizer::repairJson($jsonPropertiesEncoded);
            }

            $odeComponentsSync->setJsonProperties($jsonPropertiesEncoded);

            // OdeComponentsSync property fields
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
     * Applies replacements to text (used for HTML/JSON manipulation).
     *
     * @param array  $replaces Key-value pairs of search => replace
     * @param string $text     The text to process
     *
     * @return string Text with replacements applied
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
