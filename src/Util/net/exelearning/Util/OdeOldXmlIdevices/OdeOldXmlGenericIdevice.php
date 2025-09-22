<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * OdeOldXmlGenericIdevice.
 */
class OdeOldXmlGenericIdevice
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

    public static function oldElpGenericIdeviceStructure($odeSessionId, $odePageId, $genericNodes, $generatedIds, $xpathNamespace, TranslatorInterface $translator)
    {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];
        $fullHtmlView = [];
        $fullHtmlFeedbackView = [];

        foreach ($genericNodes as $genericNode) {
            $odeIdeviceId = Util::generateIdCheckUnique($generatedIds);
            $generatedIds[] = $odeIdeviceId;
            $odeComponentsMapping[] = $odeIdeviceId;

            $genericNode->registerXPathNamespace('f', $xpathNamespace);
            // Get blockName
            $blockNameNode = $genericNode->xpath("f:dictionary/f:string[@value='_title']/following-sibling::f:unicode[1]/@value");

            $nodeIdevices = $genericNode->xpath("f:dictionary/f:list/f:instance[@class='exe.engine.field.TextAreaField']");
            $nodeIdevicesFeedback = $genericNode->xpath("f:dictionary/f:list/f:instance[@class='exe.engine.field.FeedbackField']");

            foreach ($nodeIdevicesFeedback as $nodeIdeviceFeedback) {
                $nodeIdeviceFeedback->registerXPathNamespace('f', $xpathNamespace);
                $nodeIdeviceFeedbackContent = $nodeIdeviceFeedback->xpath("f:dictionary/f:string[@value='content_w_resourcePaths']/following-sibling::f:unicode[@content='true']");

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
                        (string) $nodeIdeviceFeedbackContent[0]['value']
                    );
                    array_push($fullHtmlFeedbackView, $odeComponentsSyncHtmlView);
                } else {
                    $odeComponentsSyncHtmlView = (string) $nodeIdeviceFeedbackContent[0]['value'];
                    array_push($fullHtmlFeedbackView, $odeComponentsSyncHtmlView);
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

                $fullOdeComponentsSyncHtmlFeedbackView = '';
                foreach ($fullHtmlFeedbackView as $htmlView) {
                    $fullOdeComponentsSyncHtmlFeedbackView .= $htmlView;
                }
            }

            foreach ($nodeIdevices as $nodeIdevice) {
                $nodeIdevice->registerXPathNamespace('f', $xpathNamespace);
                $nodeIdeviceHtmlContent = $nodeIdevice->xpath("f:dictionary/f:string[@value='content_w_resourcePaths']/following-sibling::f:unicode[@content='true']");

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
                        (string) $nodeIdeviceHtmlContent[0]['value']
                    );
                    array_push($fullHtmlView, $odeComponentsSyncHtmlView);
                } else {
                    $odeComponentsSyncHtmlView = (string) $nodeIdeviceHtmlContent[0]['value'];
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

                $fullOdeComponentsSyncHtmlView = '';
                foreach ($fullHtmlView as $htmlView) {
                    $fullOdeComponentsSyncHtmlView .= $htmlView;
                }
            }
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
            // $odePagStructureSync->setIconName($xmlOdePagStructure->{self::ODE_XML_TAG_FIELD_ICON_NAME});

            // $odeBlockTitle = $oldXmlListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}["value"][0];
            $subOdePagStructureSync->setBlockName((string) $blockNameNode[0]);

            $orderPage = (string) $nodeIdevice['reference'];
            $subOdePagStructureSync->setOdePagStructureSyncOrder(intval($orderPage));

            // Get pagStructureSync properties
            $subOdePagStructureSync->loadOdePagStructureSyncPropertiesFromConfig();
            // foreach($oldXmlListInstDict->{self::OLD_ODE_XML_UNICODE} as $oldXmlListInstDictUnicode){
            //     // array_push($odeResponse, $oldXmlListInstDictUnicode);
            //     if($oldXmlListInstDictUnicode["value"]) {
            //         $odePagStructureSync->setBlockName($oldXmlListInstDictUnicode["value"]);
            //     }

            // }

            $odeComponentsSync = new OdeComponentsSync();

            // OdeComponentsSync fields
            $odeComponentsSync->setOdeSessionId($odeSessionId);
            $odeComponentsSync->setOdePageId($odePageId);
            $odeComponentsSync->setOdeBlockId($odeBlockId);
            $odeComponentsSync->setOdeIdeviceId($odeIdeviceId);

            $odeComponentsSync->setJsonProperties('');

            $odeComponentsSync->setOdeComponentsSyncOrder(intval(1));
            // Set type
            $odeComponentsSync->setOdeIdeviceTypeName('text');

            $jsonProperties = self::JSON_PROPERTIES;
            $jsonProperties['ideviceId'] = $odeIdeviceId;
            if (!empty($fullOdeComponentsSyncHtmlView)) {
                $jsonProperties['textTextarea'] = $fullOdeComponentsSyncHtmlView;
            }
            if (!empty($fullOdeComponentsSyncHtmlFeedbackView)) {
                $jsonProperties['textFeedbackTextarea'] = $fullOdeComponentsSyncHtmlFeedbackView;
                // Add button to show feedback
                $textButtonCaption = $translator->trans('Show Feedback');

                $fullOdeComponentsSyncHtmlView .=
                '<div class="iDevice_buttons feedback-button js-required">
                <input type="button" class="feedbacktooglebutton" value="'.$textButtonCaption.'" 
                data-text-a="'.$textButtonCaption.'" data-text-b="'.$textButtonCaption.'">
                </div>';

                // Add feedback div
                $fullOdeComponentsSyncHtmlView .= '<div class="feedback js-feedback js-hidden" style="display: none;">'.$fullOdeComponentsSyncHtmlFeedbackView.'</div>';
            }

            // Add a div class wrapper
            $fullOdeComponentsSyncHtmlView = '<div class="textIdeviceContent"><div class="exe-text-activity">'.$fullOdeComponentsSyncHtmlView.'</div></div>';

            $odeComponentsSync->setHtmlView($fullOdeComponentsSyncHtmlView);

            // Create jsonProperties for idevice
            $jsonProperties = json_encode($jsonProperties);
            $odeComponentsSync->setJsonProperties($jsonProperties);

            // OdeComponentsSync property fields
            $odeComponentsSync->loadOdeComponentsSyncPropertiesFromConfig();

            // $oldXmlListDictListInstDictListInstDict->{self::OLD_ODE_XML_UNICODE}[1]["value"];
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
}
