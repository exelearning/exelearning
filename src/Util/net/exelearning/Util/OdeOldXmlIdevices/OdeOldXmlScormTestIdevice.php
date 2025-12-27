<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\JsonSanitizer;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlScormTestIdevice.
 */
class OdeOldXmlScormTestIdevice
{
    public const JSON_QUESTIONS = [
        'activityType' => 'selection',
        'selectionType' => 'single',
        'baseText' => '',
        'answers' => ['{{selectionAnswers}}'],
    ];

    // Create jsonProperties for idevice
    public const JSON_PROPERTIES = [
        'ideviceId' => '',
        'eXeFormInstructions' => '',
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

    public static function oldElpScormTestStructure($odeSessionId, $odePageId, $caseStudyNodes, $generatedIds, $xpathNamespace)
    {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];

        foreach ($caseStudyNodes as $caseStudyNode) {
            $fullHtmlView = [];
            $fullHtmlFeedbackView = [];
            $nodeQuestions = [];
            $nodeTasks = [];
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

            $nodeIdevices = $caseStudyNode->xpath("f:dictionary/f:list/f:instance[@class='exe.engine.quiztestidevice.TestQuestion']");

            $nodeIdeviceQuestions = $caseStudyNode->xpath("f:dictionary/f:list/
            f:instance[@class='exe.engine.truefalseidevice.TrueFalseQuestion']");
            $nodeIdevicesFeedback = $caseStudyNode->xpath(
                "f:dictionary/f:list/f:instance[@class='exe.engine.casestudyidevice.Question']/f:dictionary/f:string[@value='feedbackTextArea']/following-sibling::
                f:instance[1][@class='exe.engine.field.TextAreaField']"
            );

            foreach ($nodeIdevices as $nodeIdevice) {
                $questionAnswers = [];
                $nodeIdevice->registerXPathNamespace('f', $xpathNamespace);
                $nodeIdeviceQuestionTextAreaHtmlContent = $nodeIdevice->xpath("f:dictionary/f:string[@value='questionTextArea']/
                following-sibling::f:instance[1]")[0];
                $nodeIdeviceQuestionAnswers = $nodeIdevice->xpath("f:dictionary/f:string[@value='options']/
                following-sibling::f:list/f:instance[@class='exe.engine.quiztestidevice.AnswerOption']");

                $nodeIdeviceQuestionTextAreaHtmlContent->registerXPathNamespace('f', $xpathNamespace);
                $textAreaHtmlContent = $nodeIdeviceQuestionTextAreaHtmlContent->xpath("f:dictionary/f:string[@value='content_w_resourcePaths']/
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
                        (string) $textAreaHtmlContent[0]['value']
                    );
                    array_push($fullHtmlView, $odeComponentsSyncHtmlView);
                } else {
                    $odeComponentsSyncHtmlView = (string) $textAreaHtmlContent[0]['value'];
                    array_push($fullHtmlView, $odeComponentsSyncHtmlView);
                }

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

                foreach ($fullHtmlView as $htmlView) {
                    $truefalseIdeviceHtmlIstructions = JsonSanitizer::sanitizeHtmlForJson($htmlView);
                }

                // Answers
                foreach ($nodeIdeviceQuestionAnswers as $nodeIdeviceQuestionAnswer) {
                    $nodeIdeviceQuestionAnswer->registerXPathNamespace('f', $xpathNamespace);

                    $nodeIdeviceQuestionAnswerHtmlContent = $nodeIdeviceQuestionAnswer->xpath("f:dictionary/f:string[@value='answerTextArea']/following-sibling::f:instance[1]/
                    f:dictionary/f:string[@value='content_w_resourcePaths']/following-sibling::f:unicode[@content='true']")[0];

                    $nodeIdeviceQuestionAnswersIsCorrect = $nodeIdeviceQuestionAnswer->xpath("f:dictionary/f:string[@value='isCorrect']/
                    following-sibling::f:bool/@value")[0];

                    if ('0' == (string) $nodeIdeviceQuestionAnswersIsCorrect) {
                        $nodeIdeviceQuestionAnswersIsCorrect = 'false';
                    } else {
                        $nodeIdeviceQuestionAnswersIsCorrect = 'true';
                    }

                    $answerContent = JsonSanitizer::sanitizeValue((string) $nodeIdeviceQuestionAnswerHtmlContent['value']);
                    $questionsAnswerArrayStructure = [$nodeIdeviceQuestionAnswersIsCorrect, $answerContent];
                    array_push($questionAnswers, $questionsAnswerArrayStructure);
                }

                // Apply changes to json properties to add questions - Construir answers como array PHP
                $answersArray = [];
                foreach ($questionAnswers as $questionAnswer) {
                    $answerValue = strip_tags($questionAnswer[1]);
                    $answersArray[] = ['true' === $questionAnswer[0], $answerValue];
                }

                $jsonQuestions = self::JSON_QUESTIONS;
                $jsonQuestions['baseText'] = $truefalseIdeviceHtmlIstructions;
                $jsonQuestions['answers'] = $answersArray;

                $jsonQuestionsEncoded = JsonSanitizer::safeJsonEncode($jsonQuestions);

                array_push($nodeTasks, $jsonQuestionsEncoded);
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

                $subOdePagStructureSync->setBlockName((string) $blockNameNode[0]);

                $orderPage = (string) $nodeIdevice['reference'];
                $subOdePagStructureSync->setOdePagStructureSyncOrder(intval($orderPage));

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
                $odeComponentsSync->setOdeIdeviceTypeName('form');

                $jsonProperties = self::JSON_PROPERTIES;
                $jsonProperties['ideviceId'] = $odeIdeviceId;
                $truefalseIdeviceHtmlIstructions = strip_tags($truefalseIdeviceHtmlIstructions);

                $jsonProperties = JsonSanitizer::safeJsonEncode($jsonProperties);

                $fullJsonQuestions = '';
                foreach ($nodeTasks as $nodeTask) {
                    $fullJsonQuestions .= $nodeTask.',';
                }
                $fullJsonQuestions = rtrim($fullJsonQuestions, ',');
                $changesJson = ['"{{addQuestions}}"' => $fullJsonQuestions];
                $jsonProperties = self::applyHtmlChange($changesJson, $jsonProperties);

                if (!JsonSanitizer::isValidJson($jsonProperties)) {
                    $jsonProperties = JsonSanitizer::repairJson($jsonProperties);
                }

                // Create jsonProperties for idevice
                $odeComponentsSync->setJsonProperties($jsonProperties);

                // OdeComponentsSync property fields
                $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

                $subOdePagStructureSync->addOdeComponentsSync($odeComponentsSync);

                array_push($result['odeComponentsSync'], $subOdePagStructureSync);
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

    /**
     * Change correct value to "True" or "False".
     *
     * @param string $trueFalseCorrectValue
     *
     * @return string
     */
    private static function transformTrueFalseCorrectValue($trueFalseCorrectValue)
    {
        if (empty($trueFalseCorrectValue)) {
            return 'False';
        }

        if ('0' == $trueFalseCorrectValue) {
            return 'False';
        } else {
            return 'True';
        }
    }
}
