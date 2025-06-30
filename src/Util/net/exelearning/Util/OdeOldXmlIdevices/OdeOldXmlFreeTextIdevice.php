<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlFreeTextIdevice.
 */
class OdeOldXmlFreeTextIdevice
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
    // const OLD_ODE_XML_IDEVICE_TEXT = 'instance';
    public const OLD_ODE_XML_IDEVICE_TEXT_CONTENT = 'string role="key" value="content_w_resourcePaths"';

    public static function oldElpFreeTextIdeviceStructure($odeSessionId, $odePageId, $freeTextNodes, $generatedIds, $xpathNamespace)
    {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];

        foreach ($freeTextNodes as $freeTextNode) {
            $freeTextNode->registerXPathNamespace('f', $xpathNamespace);
            // Get blockName
            $blockNameNode = $freeTextNode->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");

            $nodeIdevices = $freeTextNode->xpath("f:dictionary/f:string[@value='activityTextArea']/following-sibling::f:instance[1]");
            $nodeFeedbackIdevice = $freeTextNode->xpath('f:dictionary/f:string[@value="answerTextArea"]/following-sibling::f:instance[1]');

            // In case empty $nodeIdevices get by value "content"
            if (empty($nodeIdevices)) {
                $nodeIdevices = $freeTextNode->xpath("f:dictionary/f:string[@value='content']/following-sibling::f:instance[1]");
            }

            // Get first value of feedback node
            if (!empty($nodeFeedbackIdevice)) {
                $nodeFeedbackIdevice = $nodeFeedbackIdevice[0];
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

                    $blockName = (string) $blockNameNode[0];
                    if (in_array($blockName, ['Free Text', 'FPD - Free Text'], true)) {
                        $blockName = '';
                    }
                    $subOdePagStructureSync->setBlockName($blockName);

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
                    $odeComponentsSync->setOdeIdeviceTypeName('text');

                    foreach ($nodeIdevice->{self::OLD_ODE_XML_DICTIONARY} as $oldXmlListDictListInstDictListInstDict) {
                        $sessionPath = null;
                        if (!empty($odeSessionId)) {
                            $sessionPath = UrlUtil::getOdeSessionUrl($odeSessionId);
                        }

                        // Common replaces for all OdeComponents
                        $commonReplaces = [
                            'resources'.Constants::SLASH => $sessionPath.$odeIdeviceId.Constants::SLASH,
                        ];

                        if (
                            isset($oldXmlListDictListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}[2]['content'])
                            && $oldXmlListDictListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}[2]['content'] == 'true'
                        ) {
                            $odeComponentsSyncHtmlView = self::applyReplaces(
                                $commonReplaces,
                                $oldXmlListDictListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}[2]['value']
                            );

                            $prologue = '<?xml encoding="UTF-8">';
                            $html = $prologue.$odeComponentsSyncHtmlView;
                            $doc = new \DOMDocument();
                            @$doc->loadHTML($html);
                            $xpath = new \DOMXPath($doc);
                            $src = $xpath->evaluate('//img/@src', $doc);
                            foreach ($src as $srcValue) {
                                $result['srcRoutes'][] = (string) $srcValue->value;
                            }

                            $odeComponentsSync->setHtmlView($odeComponentsSyncHtmlView);

                            // Create json properties
                            $jsonProperties = self::JSON_PROPERTIES;
                            $jsonProperties['ideviceId'] = $odeIdeviceId;
                            $jsonProperties['textTextarea'] = $odeComponentsSyncHtmlView;

                            // Get feedback and button caption from idevice (only one)
                            if (!empty($nodeFeedbackIdevice)) {
                                $nodeFeedbackIdevice->registerXPathNamespace('f', $xpathNamespace);

                                // Extract feedback HTML
                                $nodeHtmltextFeedback = $nodeFeedbackIdevice->xpath(
                                    'f:dictionary/f:string[@value="content_w_resourcePaths"]/following-sibling::f:unicode[1]/@value'
                                )[0];
                                $odeComponentsSyncFeedbackHtmlView = self::applyReplaces(
                                    $commonReplaces,
                                    (string) $nodeHtmltextFeedback
                                );

                                // Extract button caption text
                                $buttonCaptionNode = $nodeFeedbackIdevice->xpath(
                                    'f:dictionary/f:string[@value="buttonCaption"]/following-sibling::f:unicode[1]/@value'
                                );
                                if (!empty($buttonCaptionNode)) {
                                    $jsonProperties['textFeedbackInput'] = (string) $buttonCaptionNode[0];
                                }

                                // Update srcRoutes for feedback
                                $prologue = '<?xml encoding="UTF-8">';
                                $docFb = new \DOMDocument();
                                @$docFb->loadHTML($prologue.$odeComponentsSyncFeedbackHtmlView);
                                $xpathFb = new \DOMXPath($docFb);
                                $srcFb = $xpathFb->evaluate('//img/@src', $docFb);
                                foreach ($srcFb as $srcValue) {
                                    $result['srcRoutes'][] = (string) $srcValue->value;
                                }

                                // Set feedback in properties json
                                $jsonProperties['textFeedbackTextarea'] = $odeComponentsSyncFeedbackHtmlView;
                            }

                            // Finalize jsonProperties
                            $odeComponentsSync->setJsonProperties(json_encode($jsonProperties));
                            $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();
                            $subOdePagStructureSync->addOdeComponentsSync($odeComponentsSync);
                        }
                    }
                    $result['odeComponentsSync'][] = $subOdePagStructureSync;
                }
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
}
