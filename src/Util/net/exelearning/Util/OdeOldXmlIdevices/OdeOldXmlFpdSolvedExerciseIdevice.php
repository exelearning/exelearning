<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\JsonSanitizer;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlFpdSolvedExerciseIdevice.
 *
 * Handles import of FPD Solved Exercise iDevice content from legacy ELP XML files.
 */
class OdeOldXmlFpdSolvedExerciseIdevice
{
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

    // Old Xml idevice content
    public const OLD_ODE_XML_INSTANCE = 'instance';
    public const OLD_ODE_XML_DICTIONARY = 'dictionary';
    public const OLD_ODE_XML_LIST = 'list';
    public const OLD_ODE_XML_UNICODE = 'unicode';
    public const OLD_ODE_XML_ATTRIBUTES = '@attributes';
    public const OLD_ODE_XML_IDEVICE_TEXT_CONTENT = 'string role="key" value="content_w_resourcePaths"';

    /**
     * Processes FPD Solved Exercise iDevice structure from legacy ELP XML.
     *
     * @param string $odeSessionId   The session ID
     * @param string $odePageId      The page ID
     * @param array  $freeTextNodes  XML nodes containing exercise data
     * @param array  $generatedIds   Array of already generated IDs to avoid duplicates
     * @param string $xpathNamespace XML namespace for XPath queries
     *
     * @return array Result containing odeComponentsSync and srcRoutes
     */
    public static function oldElpFpdSolvedExerciseIdeviceStructure($odeSessionId, $odePageId, $freeTextNodes, $generatedIds, $xpathNamespace)
    {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];

        foreach ($freeTextNodes as $freeTextNode) {
            $freeTextNode->registerXPathNamespace('f', $xpathNamespace);
            // Get blockName
            $blockNameNode = $freeTextNode->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");

            $nodeIdevices = $freeTextNode->xpath("f:dictionary/f:string[@value='questions']/following-sibling::f:list[1]/f:instance[@class='exe.engine.ejercicioresueltofpdidevice.Question']");
            $nodeIdeviceStory = $freeTextNode->xpath("f:dictionary/f:string[@value='storyTextArea']/following-sibling::f:instance[1]");
            if (!empty($nodeIdeviceStory)) {
                $nodeIdeviceStory[0]->registerXPathNamespace('f', $xpathNamespace);
                $nodeIdeviceStoryText = $nodeIdeviceStory[0]->xpath("f:dictionary/f:string[@value='content_w_resourcePaths']/
                following-sibling::f:unicode[1]");
            }

            // Get first value of feedback node
            if (!empty($nodeFeedbackIdevice)) {
                $nodeFeedbackIdevice = $nodeFeedbackIdevice[0];
            }

            if (!empty($nodeIdevices)) {
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

                // Get pagStructureSync properties
                $subOdePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();

                // IDEVICE TEXT CONTENT
                if (isset($nodeIdeviceStoryText)) {
                    if (!empty($nodeIdeviceStoryText)) {
                        $contentHtmlText = $nodeIdeviceStoryText[0];
                    }

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
                    $odeComponentsSync->setOdeIdeviceTypeName('text');

                    $sessionPath = null;

                    if (!empty($odeSessionId)) {
                        $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
                    }

                    // Common replaces for all OdeComponents
                    $commonReplaces = [
                        'resources'.Constants::SLASH => $sessionPath.$odeIdeviceId.Constants::SLASH,
                    ];

                    if (!empty($contentHtmlText)) {
                        // Safe extraction of content value
                        $rawHtmlContent = isset($contentHtmlText[0]['value'])
                            ? (string) $contentHtmlText[0]['value']
                            : (string) $contentHtmlText;

                        if (isset($commonReplaces)) {
                            $odeComponentsSyncHtmlView = self::applyReplaces(
                                $commonReplaces,
                                $rawHtmlContent
                            );
                        } else {
                            $odeComponentsSyncHtmlView = $rawHtmlContent;
                        }

                        // Sanitize HTML content for JSON encoding
                        $odeComponentsSyncHtmlView = JsonSanitizer::sanitizeHtmlForJson($odeComponentsSyncHtmlView);

                        $prologue = '<?xml encoding="UTF-8">';
                        $html = $prologue.$odeComponentsSyncHtmlView;
                        $doc = new \DOMDocument();
                        @$doc->loadHTML($html);
                        $xpath = new \DOMXPath($doc);
                        $src = $xpath->evaluate('//img/@src', $doc);
                        foreach ($src as $srcValue) {
                            $srcString = (string) $srcValue->value;
                            array_push($result['srcRoutes'], $srcString);
                        }

                        $odeComponentsSync->setHtmlView($odeComponentsSyncHtmlView);

                        // Create json properties
                        $jsonProperties = self::JSON_PROPERTIES;
                        $jsonProperties['ideviceId'] = $odeIdeviceId;
                        $jsonProperties['textTextarea'] = $odeComponentsSyncHtmlView;

                        // Create jsonProperties for idevice with safe encoding
                        $jsonPropertiesEncoded = JsonSanitizer::safeJsonEncode($jsonProperties);

                        // Validate and repair JSON if needed
                        if (!JsonSanitizer::isValidJson($jsonPropertiesEncoded)) {
                            $jsonPropertiesEncoded = JsonSanitizer::repairJson($jsonPropertiesEncoded);
                        }

                        $odeComponentsSync->setJsonProperties($jsonPropertiesEncoded);

                        $subOdePagStructureSync->addOdeComponentsSync($odeComponentsSync);
                    }
                    array_push($result['odeComponentsSync'], $subOdePagStructureSync);
                }

                foreach ($nodeIdevices as $nodeIdevice) {
                    $nodeIdevice->registerXPathNamespace('f', $xpathNamespace);
                    $nodeIdeviceHtmlText = $nodeIdevice->xpath("f:dictionary/f:string[@value='questionTextArea']/
                    following-sibling::f:instance[1]");
                    if (!empty($nodeIdeviceHtmlText)) {
                        $nodeIdeviceHtmlText = $nodeIdeviceHtmlText[0];
                        $nodeIdeviceHtmlText->registerXPathNamespace('f', $xpathNamespace);
                        $contentHtmlText = $nodeIdeviceHtmlText->xpath("f:dictionary/f:string[@value='content_w_resourcePaths']/
                        following-sibling::f:unicode[1]");
                    }

                    // Handle missing reference attribute safely
                    $orderPage = isset($nodeIdeviceHtmlText['reference']) && !empty((string) $nodeIdeviceHtmlText['reference'])
                        ? intval((string) $nodeIdeviceHtmlText['reference'])
                        : 0;
                    $subOdePagStructureSync->setOdePagStructureSyncOrder($orderPage);

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
                    $odeComponentsSync->setOdeIdeviceTypeName('text');

                    $sessionPath = null;

                    if (!empty($odeSessionId)) {
                        $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
                    }

                    // Common replaces for all OdeComponents
                    $commonReplaces = [
                        'resources'.Constants::SLASH => $sessionPath.$odeIdeviceId.Constants::SLASH,
                    ];

                    if (!empty($contentHtmlText)) {
                        // Safe extraction of content value
                        $rawHtmlContent = isset($contentHtmlText[0]['value'])
                            ? (string) $contentHtmlText[0]['value']
                            : '';

                        if (isset($commonReplaces)) {
                            $odeComponentsSyncHtmlView = self::applyReplaces(
                                $commonReplaces,
                                $rawHtmlContent
                            );
                        } else {
                            $odeComponentsSyncHtmlView = $rawHtmlContent;
                        }

                        // Sanitize HTML content for JSON encoding
                        $odeComponentsSyncHtmlView = JsonSanitizer::sanitizeHtmlForJson($odeComponentsSyncHtmlView);

                        $prologue = '<?xml encoding="UTF-8">';
                        $html = $prologue.$odeComponentsSyncHtmlView;
                        $doc = new \DOMDocument();
                        @$doc->loadHTML($html);
                        $xpath = new \DOMXPath($doc);
                        $src = $xpath->evaluate('//img/@src', $doc);
                        foreach ($src as $srcValue) {
                            $srcString = (string) $srcValue->value;
                            array_push($result['srcRoutes'], $srcString);
                        }

                        $odeComponentsSync->setHtmlView($odeComponentsSyncHtmlView);

                        // Create json properties
                        $jsonProperties = self::JSON_PROPERTIES;
                        $jsonProperties['ideviceId'] = $odeIdeviceId;
                        $jsonProperties['textTextarea'] = $odeComponentsSyncHtmlView;

                        // Get the feedback from idevice (only one)
                        $nodeFeedbackIdevice = $nodeIdevice->xpath('f:dictionary/f:string[@value="feedbackTextArea"]/following-sibling::f:instance[1]');
                        if (!empty($nodeFeedbackIdevice)) {
                            $nodeFeedbackIdevice[0]->registerXPathNamespace('f', $xpathNamespace);
                            $nodeHtmltextFeedbackResult = $nodeFeedbackIdevice[0]->xpath('f:dictionary/f:string[@value="content_w_resourcePaths"]/
                                    following-sibling::f:unicode[1]/@value');

                            // Safe extraction of feedback value
                            $nodeHtmltextFeedback = !empty($nodeHtmltextFeedbackResult)
                                ? (string) $nodeHtmltextFeedbackResult[0]
                                : '';

                            $sessionPath = null;

                            if (!empty($odeSessionId)) {
                                $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
                            }

                            // Common replaces for all OdeComponents
                            $commonReplaces = [
                                'resources'.Constants::SLASH => $sessionPath.$odeIdeviceId.Constants::SLASH,
                            ];

                            if (isset($commonReplaces)) {
                                $odeComponentsSyncFeedbackHtmlView = self::applyReplaces(
                                    $commonReplaces,
                                    $nodeHtmltextFeedback
                                );
                            } else {
                                $odeComponentsSyncFeedbackHtmlView = $nodeHtmltextFeedback;
                            }

                            // Sanitize feedback HTML for JSON encoding
                            $odeComponentsSyncFeedbackHtmlView = JsonSanitizer::sanitizeHtmlForJson($odeComponentsSyncFeedbackHtmlView);

                            $prologue = '<?xml encoding="UTF-8">';
                            $html = $prologue.$odeComponentsSyncFeedbackHtmlView;
                            $doc = new \DOMDocument();
                            @$doc->loadHTML($html);
                            $xpath = new \DOMXPath($doc);
                            $src = $xpath->evaluate('//img/@src', $doc);
                            foreach ($src as $srcValue) {
                                $srcString = (string) $srcValue->value;
                                array_push($result['srcRoutes'], $srcString);
                            }
                            // Set feedback in properties json
                            $jsonProperties['textFeedbackTextarea'] = $odeComponentsSyncFeedbackHtmlView;
                        }

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
                    }

                    array_push($result['odeComponentsSync'], $subOdePagStructureSync);
                }
            }
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
}
