<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\JsonSanitizer;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlFpdFillSecondTypeIdevice.
 *
 * Handles import of FPD Fill (Second Type) iDevice content from legacy ELP XML files.
 */
class OdeOldXmlFpdFillSecondTypeIdevice
{
    public const JSON_QUESTIONS = [
        'activityType' => 'fill',
        'baseText' => '',
        'capitalization' => '',
        'strict' => '',
    ];

    // Create jsonProperties for idevice
    public const JSON_PROPERTIES = [
        'ideviceId' => '',
        'eXeFormInstructions' => '',
        'questionsData' => ['{{addQuestions}}'],
        'formPreview' => '',
        'dropdownPassRate' => '50',
        'checkAddBtnAnswers' => true,
        'userTranslations' => [
            'langTrueFalseHelp' => 'Select whether the statement is true or false',
            'langDropdownHelp' => 'Choose the correct answer among the options proposed',
            'langSingleSelectionHelp' => 'Multiple choice with only one correct answer',
            'langMultipleSelectionHelp' => 'Multiple choice with multiple corrects answers',
            'langFillHelp' => 'Fill in the blanks with the appropriate word',
        ],
    ];

    // Old Xml idevice content
    public const OLD_ODE_XML_INSTANCE = 'instance';
    public const OLD_ODE_XML_DICTIONARY = 'dictionary';
    public const OLD_ODE_XML_LIST = 'list';
    public const OLD_ODE_XML_UNICODE = 'unicode';
    public const OLD_ODE_XML_ATTRIBUTES = '@attributes';
    public const OLD_ODE_XML_IDEVICE_TEXT_CONTENT = 'string role="key" value="content_w_resourcePaths"';

    /**
     * Processes FPD Fill Second Type iDevice structure from legacy ELP XML.
     *
     * @param string $odeSessionId   The session ID
     * @param string $odePageId      The page ID
     * @param array  $fillNodes      XML nodes containing fill exercise data
     * @param array  $generatedIds   Array of already generated IDs to avoid duplicates
     * @param string $xpathNamespace XML namespace for XPath queries
     *
     * @return array Result containing odeComponentsSync and srcRoutes
     */
    public static function oldElpFpdFillSecondTypeIdeviceStructure($odeSessionId, $odePageId, $fillNodes, $generatedIds, $xpathNamespace)
    {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];

        foreach ($fillNodes as $fillNode) {
            $fillNode->registerXPathNamespace('f', $xpathNamespace);
            $nodeIdevices = $fillNode->xpath("f:dictionary/f:instance[@class='exe.engine.field.ClozelangField']");

            // Safe extraction of instructions idevice
            $instructionsIdeviceResult = $fillNode->xpath("f:dictionary/f:string[@value='instructionsForLearners']/following-sibling::f:instance[1]");
            $instructionsIdevice = !empty($instructionsIdeviceResult) ? $instructionsIdeviceResult[0] : null;

            // Get blockName
            $blockNameNode = $fillNode->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");

            // Safe extraction of instructions content
            $instructionsIdeviceContent = null;
            if (null !== $instructionsIdevice) {
                $instructionsIdevice->registerXPathNamespace('f', $xpathNamespace);
                $instructionsIdeviceContent = $instructionsIdevice->xpath("f:dictionary/f:string[@value='content_w_resourcePaths']/
                following-sibling::f:unicode[@content='true']");
            }

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

                    // Sanitize block name from XML with null check
                    $blockName = !empty($blockNameNode)
                        ? JsonSanitizer::sanitizeValue((string) $blockNameNode[0])
                        : '';
                    $subOdePagStructureSync->setBlockName($blockName);

                    // Handle missing reference attribute safely
                    $orderPage = isset($nodeIdevice['reference']) && !empty((string) $nodeIdevice['reference'])
                        ? intval((string) $nodeIdevice['reference'])
                        : 0;
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
                    $odeComponentsSync->setOdeIdeviceTypeName('form');

                    foreach ($nodeIdevice->{self::OLD_ODE_XML_DICTIONARY} as $oldXmlListDictListInstDictListInstDict) {
                        $oldXmlListDictListInstDictListInstDict->registerXPathNamespace('f', $xpathNamespace);
                        $checkCaps = $oldXmlListDictListInstDictListInstDict->xpath("f:string[@value='checkCaps']/
                        following-sibling::f:bool[1]/@value");
                        $strictText = $oldXmlListDictListInstDictListInstDict->xpath("f:string[@value='strictMarking']/
                        following-sibling::f:bool[1]/@value");
                        $baseTextHtmlContent = $oldXmlListDictListInstDictListInstDict->xpath("f:string[@value='_encodedContent']/
                        following-sibling::f:unicode[1]");

                        $sessionPath = null;

                        if (!empty($odeSessionId)) {
                            $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
                        }

                        // Common replaces for all OdeComponents
                        $commonReplaces = [
                            'resources'.Constants::SLASH => $sessionPath.$odeIdeviceId.Constants::SLASH,
                        ];

                        if (isset($baseTextHtmlContent) && !empty($baseTextHtmlContent)) {
                            // Safe extraction of base text HTML content
                            $rawBaseText = isset($baseTextHtmlContent[0]['value'])
                                ? (string) $baseTextHtmlContent[0]['value']
                                : '';

                            if (isset($commonReplaces)) {
                                $odeComponentsSyncHtmlView = self::applyReplaces($commonReplaces, $rawBaseText);
                            } else {
                                $odeComponentsSyncHtmlView = $rawBaseText;
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

                            // Change "0/1" to "false/true"
                            $booleanChanges = [
                                '0' => 'false',
                                '1' => 'true',
                            ];

                            // Safe extraction and conversion of boolean values
                            $checkCapsValue = !empty($checkCaps) ? (string) $checkCaps[0] : '0';
                            $strictTextValue = !empty($strictText) ? (string) $strictText[0] : '0';

                            $checkCapsValue = self::applyReplaces($booleanChanges, $checkCapsValue);
                            $strictTextValue = self::applyReplaces($booleanChanges, $strictTextValue);

                            $jsonQuestions = self::JSON_QUESTIONS;
                            $jsonQuestions['baseText'] = $odeComponentsSyncHtmlView;
                            $jsonQuestions['capitalization'] = $checkCapsValue;
                            $jsonQuestions['strict'] = $strictTextValue;

                            // Safe JSON encoding for questions
                            $jsonQuestionsEncoded = JsonSanitizer::safeJsonEncode($jsonQuestions);

                            // Safe extraction of instructions content
                            $instructionsContent = '';
                            if (!empty($instructionsIdeviceContent) && isset($instructionsIdeviceContent[0]['value'])) {
                                $instructionsContent = JsonSanitizer::sanitizeHtmlForJson(
                                    (string) $instructionsIdeviceContent[0]['value']
                                );
                            }

                            $jsonProperties = self::JSON_PROPERTIES;
                            $jsonProperties['ideviceId'] = $odeIdeviceId;
                            $jsonProperties['eXeFormInstructions'] = $instructionsContent;

                            // Safe JSON encoding for properties
                            $jsonPropertiesEncoded = JsonSanitizer::safeJsonEncode($jsonProperties);

                            $changesJson = ['"{{addQuestions}}"' => $jsonQuestionsEncoded];
                            $jsonPropertiesEncoded = self::applyHtmlChange($changesJson, $jsonPropertiesEncoded);

                            // Validate and repair JSON if needed
                            if (!JsonSanitizer::isValidJson($jsonPropertiesEncoded)) {
                                $jsonPropertiesEncoded = JsonSanitizer::repairJson($jsonPropertiesEncoded);
                            }

                            // Create jsonProperties for idevice
                            $odeComponentsSync->setJsonProperties($jsonPropertiesEncoded);

                            // OdeComponentsSync property fields
                            $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

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
     * Applies replacements to text (used for JSON manipulation).
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
