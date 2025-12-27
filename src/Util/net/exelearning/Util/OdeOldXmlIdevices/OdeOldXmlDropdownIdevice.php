<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\JsonSanitizer;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlDropdownIdevice.
 */
class OdeOldXmlDropdownIdevice
{
    // Create questions json
    public const JSON_QUESTIONS = [
        'activityType' => 'dropdown',
        'baseText' => '',
        'wrongAnswersValue' => '',
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

    public static function oldElpDropdownIdeviceStructure($odeSessionId, $odePageId, $fillNode, $generatedIds, $xpathNamespace)
    {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];

        $fillNode->registerXPathNamespace('f', $xpathNamespace);
        // Get blockName
        $blockNameNode = $fillNode->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");

        $nodeIdevices = $fillNode->xpath("f:dictionary/f:instance[@class='exe.engine.listaidevice.ListaField']");
        $instructionsIdevice = $fillNode->xpath("f:dictionary/f:string[@value='instructionsForLearners']/following-sibling::f:instance[1]")[0];

        $instructionsIdevice->registerXPathNamespace('f', $xpathNamespace);
        $instructionsIdeviceContent = $instructionsIdevice->xpath("f:dictionary/f:string[@value='content_w_resourcePaths']/
        following-sibling::f:unicode[@content='true']");

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

                $subOdePagStructureSync->setBlockName((string) $blockNameNode[0]);

                $orderPage = (string) $nodeIdevice['reference'];
                $subOdePagStructureSync->setOdePagStructureSyncOrder(intval($orderPage));

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

                    if (isset($baseTextHtmlContent)) {
                        if (isset($commonReplaces)) {
                            $odeComponentsSyncHtmlView = self::applyReplaces($commonReplaces, (string) $baseTextHtmlContent[0]['value']);
                        } else {
                            $odeComponentsSyncHtmlView = (string) $baseTextHtmlContent[0]['value'];
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

                        $jsonQuestion = self::JSON_QUESTIONS;
                        $jsonQuestion['baseText'] = $odeComponentsSyncHtmlView;

                        $otherOptions = (string) $oldXmlListDictListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}[5]['value'];
                        $jsonQuestion['wrongAnswersValue'] = JsonSanitizer::sanitizeValue($otherOptions);

                        $jsonQuestion = JsonSanitizer::safeJsonEncode($jsonQuestion);

                        $jsonProperties = self::JSON_PROPERTIES;
                        $jsonProperties['ideviceId'] = $odeIdeviceId;
                        $jsonProperties['eXeFormInstructions'] = JsonSanitizer::sanitizeHtmlForJson(
                            (string) $instructionsIdeviceContent[0]['value']
                        );

                        $jsonProperties = JsonSanitizer::safeJsonEncode($jsonProperties);

                        $changesJson = ['"{{addQuestions}}"' => $jsonQuestion];
                        $jsonProperties = self::applyHtmlChange($changesJson, $jsonProperties);

                        if (!JsonSanitizer::isValidJson($jsonProperties)) {
                            $jsonProperties = JsonSanitizer::repairJson($jsonProperties);
                        }

                        // Create jsonProperties for idevice
                        $odeComponentsSync->setJsonProperties($jsonProperties);

                        // OdeComponentsSync property fields
                        $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

                        $subOdePagStructureSync->addOdeComponentsSync($odeComponentsSync);
                    }
                }
            }
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
