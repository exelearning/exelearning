<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\JsonSanitizer;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlTrueFalseIdevice.
 *
 * Handles import of True/False iDevice content from legacy ELP XML files.
 */
class OdeOldXmlTrueFalseIdevice
{
    // Create json questions
    public const JSON_QUESTIONS = [
        'activityType' => 'true-false',
        'baseText' => '',
        'answer' => '',
        'feedback' => '',
        'solution' => '',
    ];

    // Create jsonProperties for idevice
    public const JSON_PROPERTIES = [
        'ideviceId' => '',
        'questionsData' => ['{{addQuestions}}'],
        'dropdownPassRate' => '',
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
     * Processes True/False iDevice structure from legacy ELP XML.
     *
     * @param string $odeSessionId   The session ID
     * @param string $odePageId      The page ID
     * @param array  $caseStudyNodes XML nodes containing True/False questions
     * @param array  $generatedIds   Array of already generated IDs to avoid duplicates
     * @param string $xpathNamespace XML namespace for XPath queries
     *
     * @return array Result containing odeComponentsSync and srcRoutes
     */
    public static function oldElpTrueFalseStructure($odeSessionId, $odePageId, $caseStudyNodes, $generatedIds, $xpathNamespace)
    {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];

        foreach ($caseStudyNodes as $caseStudyNode) {
            $fullHtmlView = [];
            $fullHtmlFeedbackView = [];
            $nodeQuestions = [];
            $truefalseIdeviceHtmlIstructions = '';
            $fullOdeComponentsSyncHtmlFeedbackView = '';
            $fullOdeComponentsSyncHtmlView = '';
            $truefalseIdeviceHtmlIstructions = '';

            $odeIdeviceId = Util::generateIdCheckUnique($generatedIds);
            $generatedIds[] = $odeIdeviceId;
            $odeComponentsMapping[] = $odeIdeviceId;

            $caseStudyNode->registerXPathNamespace('f', $xpathNamespace);
            // Get blockName
            $blockNameNode = $caseStudyNode->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");

            $nodeIdevices = $caseStudyNode->xpath("f:dictionary/f:instance[@class='exe.engine.field.TextAreaField']");

            $nodeIdeviceQuestions = $caseStudyNode->xpath("f:dictionary/f:list/   f:instance[@class='exe.engine.truefalseidevice.TrueFalseQuestion']");

            // Case empty $nodeIdeviceQuestions, $nodeIdevicesFeedback try with fpd
            if (empty($nodeIdeviceQuestions)) {
                $nodeIdeviceQuestions = $caseStudyNode->xpath(
                    "f:dictionary/f:list/f:instance[@class='exe.engine.verdaderofalsofpdidevice.TrueFalseQuestion']"
                );
            }
            foreach ($nodeIdevices as $nodeIdevice) {
                $nodeIdevice->registerXPathNamespace('f', $xpathNamespace);
                $nodeIdeviceInstructionsHtmlContent = $nodeIdevice->xpath("f:dictionary/f:string[@value='content_w_resourcePaths']/
                following-sibling::f:unicode[@content='true']");

                $sessionPath = null;

                if (!empty($odeSessionId)) {
                    $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
                }
                // Common replaces for all OdeComponents
                $commonReplaces = [
                    'resources'.Constants::SLASH => $sessionPath.$odeIdeviceId.Constants::SLASH,
                ];

                if (isset($commonReplaces)) {
                    $odeComponentsSyncHtmlView = self::applyReplaces(
                        $commonReplaces,
                        (string) $nodeIdeviceInstructionsHtmlContent[0]['value']
                    );
                    array_push($fullHtmlView, $odeComponentsSyncHtmlView);
                } else {
                    $odeComponentsSyncHtmlView = (string) $nodeIdeviceInstructionsHtmlContent[0]['value'];
                    array_push($fullHtmlView, $odeComponentsSyncHtmlView);
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

                foreach ($fullHtmlView as $htmlView) {
                    $truefalseIdeviceHtmlIstructions = $htmlView;
                }
            }

            foreach ($nodeIdeviceQuestions as $nodeIdeviceQuestion) {
                $nodeIdeviceQuestion->registerXPathNamespace('f', $xpathNamespace);
                $nodeIdeviceInstructionsHtmlContent = $nodeIdeviceQuestion->xpath("f:dictionary/f:instance/f:dictionary/f:string[@value='content_w_resourcePaths']/following-sibling::f:unicode[@content='true']");
                $nodeAnswerQuestion = $nodeIdeviceQuestion->xpath("f:dictionary/f:string[@value='isCorrect']/following-sibling::f:bool/@value");
                $nodeAnswerQuestion = !empty($nodeAnswerQuestion) ? (string) $nodeAnswerQuestion[0] : '0';

                $hintHtmlContent = $nodeIdeviceQuestion->xpath("
                f:dictionary/f:string[@value='hintTextArea']/following-sibling::f:instance[@class='exe.engine.field.TextAreaField']
                /f:dictionary/f:string[@value='content_w_resourcePaths']/following-sibling::f:unicode[@content='true']
                ");

                $feedbackHtmlContent = $nodeIdeviceQuestion->xpath("
                f:dictionary/f:string[@value='feedbackTextArea']/following-sibling::f:instance[@class='exe.engine.field.TextAreaField']
                /f:dictionary/f:string[@value='content_w_resourcePaths']/following-sibling::f:unicode[@content='true']
                ");

                $sessionPath = !empty($odeSessionId) ? UrlUtil::getOdeSessionUrl($odeSessionId) : null;

                $commonReplaces = [
                    'resources'.Constants::SLASH => $sessionPath.$odeIdeviceId.Constants::SLASH,
                ];
                $odeComponentsSyncHtmlView = isset($commonReplaces) ?
                    self::applyReplaces($commonReplaces, (string) $nodeIdeviceInstructionsHtmlContent[0]['value']) :
                    (string) $nodeIdeviceInstructionsHtmlContent[0]['value'];
                array_push($fullHtmlView, $odeComponentsSyncHtmlView);
                $feedbackProcessed = isset($commonReplaces) && !empty($feedbackHtmlContent) ?
                    self::applyReplaces($commonReplaces, (string) $feedbackHtmlContent[0]['value']) :
                    (!empty($feedbackHtmlContent) ? (string) $feedbackHtmlContent[0]['value'] : '');

                $hintProcessed = isset($commonReplaces) && !empty($hintHtmlContent) ?
                    self::applyReplaces($commonReplaces, (string) $hintHtmlContent[0]['value']) :
                    (!empty($hintHtmlContent) ? (string) $hintHtmlContent[0]['value'] : '');

                // Build question JSON with sanitized HTML content
                $jsonQuestion = self::JSON_QUESTIONS;
                $jsonQuestion['baseText'] = JsonSanitizer::sanitizeHtmlForJson($odeComponentsSyncHtmlView);
                $jsonQuestion['answer'] = self::transformTrueFalseCorrectValue($nodeAnswerQuestion);
                $jsonQuestion['feedback'] = JsonSanitizer::sanitizeHtmlForJson($feedbackProcessed);
                $jsonQuestion['hint'] = JsonSanitizer::sanitizeHtmlForJson($hintProcessed);

                // Use safe JSON encoding for each question
                array_push($nodeQuestions, JsonSanitizer::safeJsonEncode($jsonQuestion));
            }

            // IDEVICE TEXT CONTENT
            if ($nodeIdevice->{self::OLD_ODE_XML_DICTIONARY}->{self::OLD_ODE_XML_UNICODE}) {
                $subOdePagStructureSync = new OdePagStructureSync();
                $odeBlockId = Util::generateIdCheckUnique($generatedIds);
                $generatedIds[] = $odeBlockId;

                // OdePagStructureSync fields
                $subOdePagStructureSync->setOdeSessionId($odeSessionId);
                $subOdePagStructureSync->setOdePageId($odePageId);
                $subOdePagStructureSync->setOdeBlockId($odeBlockId);

                // Sanitize block name from XML
                $blockName = !empty($blockNameNode) ? JsonSanitizer::sanitizeValue((string) $blockNameNode[0]) : '';
                $subOdePagStructureSync->setBlockName($blockName);

                // Handle missing reference attribute safely
                $orderPage = isset($nodeIdevice['reference']) && !empty((string) $nodeIdevice['reference'])
                    ? intval((string) $nodeIdevice['reference'])
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
                $odeComponentsSync->setOdeIdeviceTypeName('trueorfalse');

                $jsonProperties = self::JSON_PROPERTIES;
                $jsonProperties['ideviceId'] = $odeIdeviceId;
                // Sanitize instructions HTML content
                $jsonProperties['eXeFormInstructions'] = JsonSanitizer::sanitizeHtmlForJson($truefalseIdeviceHtmlIstructions);

                // Build questions JSON string
                $jsonQuestions = '';
                foreach ($nodeQuestions as $nodeQuestion) {
                    $jsonQuestions .= $nodeQuestion.',';
                }
                $jsonQuestions = rtrim($jsonQuestions, ',');

                // Apply changes to json properties to add questions
                $changes = ['"{{addQuestions}}"' => $jsonQuestions];
                $jsonPropertiesEncoded = JsonSanitizer::safeJsonEncode($jsonProperties);
                $jsonPropertiesEncoded = self::applyHtmlChange($changes, $jsonPropertiesEncoded);

                // Validate and repair JSON if needed
                if (!JsonSanitizer::isValidJson($jsonPropertiesEncoded)) {
                    $jsonPropertiesEncoded = JsonSanitizer::repairJson($jsonPropertiesEncoded);
                }

                // Create jsonProperties for idevice
                $odeComponentsSync->setJsonProperties($jsonPropertiesEncoded);

                // OdeComponentsSync property fields
                $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

                $subOdePagStructureSync->addOdeComponentsSync($odeComponentsSync);

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
     * Applies HTML-related string replacements.
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

    /**
     * Transforms boolean value to "True" or "False" string.
     *
     * @param string $trueFalseCorrectValue The value to transform ("0" or "1")
     *
     * @return string "True" or "False"
     */
    private static function transformTrueFalseCorrectValue($trueFalseCorrectValue)
    {
        // By default on empty value we return False as correct value
        if (empty($trueFalseCorrectValue)) {
            return 'False';
        }

        // Check value is "0" or "1" to set "False" or "True"
        if ('0' == $trueFalseCorrectValue) {
            return 'False';
        } else {
            return 'True';
        }
    }
}
