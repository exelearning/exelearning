<?php

namespace App\Util\net\exelearning\Util\OdeOldXmlIdevices;

use App\Constants;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Util\net\exelearning\Util\UrlUtil;
use App\Util\net\exelearning\Util\Util;

/**
 * OdeOldXmlCaseStudyIdevice.
 */
class OdeOldXmlCaseStudyIdevice
{
    // Create jsonProperties for idevice
    public const JSON_PROPERTIES = [
        'ideviceId' => '',
        'textInfoDurationInput' => '',
        'textInfoParticipantsInput' => '',
        'textInfoDurationTextInput' => 'Duration:',
        'textInfoParticipantsTextInput' => 'Grouping:',
        'history' => '',
        'activities' => [],
        'title' => '',
    ];

    public static function oldElpCaseStudyStructure($odeSessionId, $odePageId, $caseStudyNodes, $generatedIds, $xpathNamespace)
    {
        $result['odeComponentsSync'] = [];
        $result['srcRoutes'] = [];

        foreach ($caseStudyNodes as $caseStudyNode) {
            $caseStudyNode->registerXPathNamespace('f', $xpathNamespace);

            // Generate unique idevice ID
            $odeIdeviceId = Util::generateIdCheckUnique($generatedIds);
            $generatedIds[] = $odeIdeviceId;

            // --- Extract history (single) ---
            $history = '';
            $storyNode = $caseStudyNode->xpath(
                "f:dictionary/f:string[@value='storyTextArea']"
                ."/following-sibling::f:instance[@class='exe.engine.field.TextAreaField'][1]"
                ."/f:dictionary/f:string[@value='content_w_resourcePaths']"
                ."/following-sibling::f:unicode[@content='true']/@value"
            );
            if (!empty($storyNode)) {
                $htmlHistory = (string) $storyNode[0];
                // apply session path replacement
                $sessionPath = $odeSessionId ? UrlUtil::getOdeSessionUrl($odeSessionId) : '';
                $htmlHistory = str_replace(
                    'resources'.Constants::SLASH,
                    $sessionPath.$odeIdeviceId.Constants::SLASH,
                    $htmlHistory
                );
                $history = $htmlHistory;
                // collect images
                $doc = new \DOMDocument();
                @$doc->loadHTML('<?xml encoding="UTF-8">'.$history);
                $xp = new \DOMXPath($doc);
                foreach ($xp->evaluate('//img/@src') as $src) {
                    $result['srcRoutes'][] = (string) $src->value;
                }
            }

            // --- Extract activities ---
            $activities = [];
            $questionInstances = $caseStudyNode->xpath(
                "f:dictionary/f:list/f:instance[@class='exe.engine.casestudyidevice.Question']"
            );
            foreach ($questionInstances as $qNode) {
                $qNode->registerXPathNamespace('f', $xpathNamespace);
                // Activity content
                $activityNode = $qNode->xpath(
                    "f:dictionary/f:string[@value='questionTextArea']"
                    ."/following-sibling::f:instance[@class='exe.engine.field.TextAreaField'][1]"
                    ."/f:dictionary/f:string[@value='content_w_resourcePaths']"
                    ."/following-sibling::f:unicode[@content='true']/@value"
                );
                $activityHtml = !empty($activityNode) ? (string) $activityNode[0] : '';
                // Feedback button caption
                $btnNode = $qNode->xpath(
                    "f:dictionary/f:instance[@class='exe.engine.field.Feedback2Field']"
                    ."/f:dictionary/f:string[@value='buttonCaption']"
                    .'/following-sibling::f:unicode[1]/@value'
                );
                $btnCaption = !empty($btnNode) ? (string) $btnNode[0] : '';
                // Feedback content
                $fbNode = $qNode->xpath(
                    "f:dictionary/f:instance[@class='exe.engine.field.Feedback2Field']"
                    ."/f:dictionary/f:string[@value='content_w_resourcePaths']"
                    ."/following-sibling::f:unicode[@content='true']/@value"
                );
                $feedbackHtml = !empty($fbNode) ? (string) $fbNode[0] : '';
                // Apply replaces and collect images
                $sessionPath = $odeSessionId ? UrlUtil::getOdeSessionUrl($odeSessionId) : '';
                foreach (['activityHtml' => 'questionTextArea', 'feedbackHtml' => 'feedbackTextArea'] as $key => $val) {
                    // replace resource paths
                    ${$key} = str_replace(
                        'resources'.Constants::SLASH,
                        $sessionPath.$odeIdeviceId.Constants::SLASH,
                        ${$key}
                    );
                    // collect images
                    $doc = new \DOMDocument();
                    @$doc->loadHTML('<?xml encoding="UTF-8">'.${$key});
                    $xp = new \DOMXPath($doc);
                    foreach ($xp->evaluate('//img/@src') as $src) {
                        $result['srcRoutes'][] = (string) $src->value;
                    }
                }
                $activities[] = [
                    'activity' => $activityHtml,
                    'buttonCaption' => $btnCaption,
                    'feedback' => $feedbackHtml,
                ];
            }

            // --- Build sync objects ---
            $subPag = new OdePagStructureSync();
            $blockId = Util::generateIdCheckUnique($generatedIds);
            $generatedIds[] = $blockId;

            $subPag->setOdeSessionId($odeSessionId);
            $subPag->setOdePageId($odePageId);
            $subPag->setOdeBlockId($blockId);
            $titleNode = $caseStudyNode->xpath(
                "f:dictionary/f:string[@value='_title']"
                .'/following-sibling::f:unicode[1]/@value'
            );
            $title = !empty($titleNode) ? (string) $titleNode[0] : '';
            $subPag->setBlockName($title);
            $subPag->setOdePagStructureSyncOrder(1);
            $subPag->loadOdePagStructureSyncPropertiesFromConfig();

            $comp = new OdeComponentsSync();
            $comp->setOdeSessionId($odeSessionId);
            $comp->setOdePageId($odePageId);
            $comp->setOdeBlockId($blockId);
            $comp->setOdeIdeviceId($odeIdeviceId);
            $comp->setOdeComponentsSyncOrder(1);
            $comp->setOdeIdeviceTypeName('casestudy');

            $jsonProps = self::JSON_PROPERTIES;
            $jsonProps['ideviceId'] = $odeIdeviceId;
            $jsonProps['history'] = $history;
            $jsonProps['activities'] = $activities;
            $jsonProps['title'] = $title;

            $comp->setJsonProperties(json_encode($jsonProps));
            $comp->loadOdeComponentsSyncPropertiesFromConfig();
            $subPag->addOdeComponentsSync($comp);
            $result['odeComponentsSync'][] = $subPag;
        }

        return $result;
    }
}
