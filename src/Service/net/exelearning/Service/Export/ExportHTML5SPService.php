<?php

namespace App\Service\net\exelearning\Service\Export;

use App\Constants;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\ThemeHelper;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Util\net\exelearning\Util\ExportXmlUtil;
use Symfony\Contracts\Translation\TranslatorInterface;

class ExportHTML5SPService implements ExportServiceInterface
{
    private $exportType;
    private FileHelper $fileHelper;
    private ThemeHelper $themeHelper;
    private CurrentOdeUsersServiceInterface $currentOdeUsersService;
    private TranslatorInterface $translator;

    public function __construct(
        FileHelper $fileHelper,
        ThemeHelper $themeHelper,
        CurrentOdeUsersServiceInterface $currentOdeUsersService,
        TranslatorInterface $translator,
    ) {
        $this->exportType = Constants::EXPORT_TYPE_HTML5_SP;
        $this->fileHelper = $fileHelper;
        $this->themeHelper = $themeHelper;
        $this->currentOdeUsersService = $currentOdeUsersService;
        $this->translator = $translator;
    }

    /**
     * Generate HTML5 export files.
     *
     * @param User                 $user
     * @param string               $odeSessionId
     * @param odeNavStructureSyncs $odeNavStructureSyncs
     * @param array                $pagesFileData
     * @param array                $odeProperties
     * @param array                $libsResourcesPath
     * @param array                $odeComponentsSyncCloneArray
     * @param array                $idevicesMapping
     * @param userPreferencesDtos  $userPreferencesDtos
     * @param ThemeDto             $theme
     * @param string               $elpFileName
     * @param string               $resourcesPrefix
     * @param bool                 $isPreview
     * @param TranslatorInterface  $translator
     *
     * @return bool
     */
    public function generateExportFiles(
        $user,
        $odeSessionId,
        $odeNavStructureSyncs,
        $pagesFileData,
        $odeProperties,
        $libsResourcesPath,
        $odeComponentsSyncCloneArray,
        $idevicesMapping,
        $idevicesByPage,
        $idevicesTypesData,
        $userPreferencesDtos,
        $theme,
        $elpFileName,
        $resourcesPrefix,
        $isPreview,
        $translator,
    ) {
        // Generate html files
        $this->generateExportPagesHTMLFiles(
            $odeSessionId,
            $odeNavStructureSyncs,
            $pagesFileData,
            $odeProperties,
            $libsResourcesPath,
            $odeComponentsSyncCloneArray,
            $idevicesMapping,
            $idevicesByPage,
            $idevicesTypesData,
            $userPreferencesDtos,
            $theme,
            $elpFileName,
            $resourcesPrefix,
            $isPreview,
            $translator
        );

        return true;
    }

    /**
     * Generate HTML pages.
     *
     * @param string               $odeSessionId
     * @param odeNavStructureSyncs $odeNavStructureSyncs
     * @param array                $pagesFileData
     * @param array                $odeProperties
     * @param array                $libsResourcesPath
     * @param array                $odeComponentsSyncCloneArray
     * @param array                $idevicesMapping
     * @param userPreferencesDtos  $userPreferencesDtos
     * @param ThemeDto             $theme
     * @param string               $elpFileName
     * @param string               $resourcesPrefix
     * @param bool                 $isPreview
     * @param TranslatorInterface  $translator
     *
     * @return bool
     */
    private function generateExportPagesHTMLFiles(
        $odeSessionId,
        $odeNavStructureSyncs,
        $pagesFileData,
        $odeProperties,
        $libsResourcesPath,
        $odeComponentsSyncCloneArray,
        $idevicesMapping,
        $idevicesByPage,
        $idevicesTypesData,
        $userPreferencesDtos,
        $theme,
        $elpFileName,
        $resourcesPrefix,
        $isPreview,
        $translator,
    ) {
        $visiblesPages = [];
        $indexNode = 0;

        foreach ($pagesFileData as $key => $pageData) {
            if (ExportXmlUtil::isVisibleExport($odeNavStructureSyncs, $indexNode)) {
                $url = $pageData['fileUrl'];
                // Add the page to the visibles pages and link it with the previous page and the next page
                $visiblesPages[$key] = ['url' => $url];
            }
            ++$indexNode;
        }

        // This export generates a single html page with all the component
        // We separate the index from the rest of the pages
        $otherOdeNavStructureSyncs = [];
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            $pageData = $pagesFileData[$odeNavStructureSync->getOdePageId()];
            if ($pageData['isIndex']) {
                $indexOdeNavStructureSync = $odeNavStructureSync;
            } else {
                if (isset($visiblesPages[$odeNavStructureSync->getOdePageId()])) {
                    $otherOdeNavStructureSyncs[] = $odeNavStructureSync;
                }
            }
        }

        // Add all idevice type references to index
        foreach ($idevicesByPage as $pageId => $idevices) {
            if ($pageId != $indexOdeNavStructureSync->getOdePageId()) {
                foreach ($idevices as $ideviceName => $count) {
                    if (in_array($ideviceName, $idevicesByPage[$indexOdeNavStructureSync->getOdePageId()])) {
                        ++$idevicesByPage[$indexOdeNavStructureSync->getOdePageId()][$ideviceName];
                    } else {
                        $idevicesByPage[$indexOdeNavStructureSync->getOdePageId()][$ideviceName] = 1;
                    }
                }
            }
        }

        // Create an html page based on the index
        $indexPageData = $pagesFileData[$indexOdeNavStructureSync->getOdePageId()];
        $pageFile = $indexPageData['filePath'];
        // Generate XML page
        $pageExportHTML = ExportXmlUtil::createHTMLPage(
            $odeSessionId,
            $indexOdeNavStructureSync,
            $pagesFileData,
            $odeProperties,
            $libsResourcesPath,
            $idevicesMapping,
            $idevicesByPage,
            $idevicesTypesData,
            $userPreferencesDtos,
            $theme,
            $resourcesPrefix,
            $this->exportType,
            $isPreview,
            $translator
        );

        // Set main tag as root content
        $xpathPageContent = '//body[contains(@class, "exe-single-page")]/div[contains(@class,"exe-content")]/main';
        $targetPageContent = current($pageExportHTML->xpath($xpathPageContent));

        // Add a header node as the first child of $targetPageContent
        $headerNode = $targetPageContent->addChild('header');
        $headerNode->addAttribute('class', 'package-header');
        $headerNode->addChild('h1', $odeProperties['pp_title']->getValue('value'));

        // Move the first two nodes of $targetPageContent to the new section node
        $newFirstSection = $targetPageContent->addChild('section');

        $existingClass = (string) $headerNode['class'];

        // Add the class attribute if not yet exists
        $newClass = 'package-node';
        if (empty($existingClass)) {
            $headerNode->addAttribute('class', $newClass);
        } else {
            $headerNode['class'] = trim($existingClass.' '.$newClass);
        }

        // Convert  to DOMDocument
        $dom = dom_import_simplexml($targetPageContent)->ownerDocument;
        $dom->formatOutput = true;

        $domFather = dom_import_simplexml($targetPageContent);
        $domnewFirstSection = dom_import_simplexml($newFirstSection);

        // Traverse the children of the PARENT, and select only the first two (excluding the new node created)
        $nodesToMove = [];
        $cont = 0;
        foreach ($domFather->childNodes as $node) {
            if ('section' === $node->nodeName) {
                continue;
            } // No mover el nuevo nodo
            if (XML_ELEMENT_NODE === $node->nodeType) {
                if ($cont < 2) {
                    $nodesToMove[] = $node;
                    ++$cont;
                } else {
                    break;
                }
            }
        }

        // Move only two first nodes to the new section
        foreach ($nodesToMove as $node) {
            $newNode = $node->cloneNode(true);
            $domnewFirstSection->appendChild($newNode);
            $domFather->removeChild($node);
        }

        $xpathPageContent = '//body[contains(@class, "exe-single-page")]/div[contains(@class,"exe-content")]/main'; // [last()]
        $targetPageContent = current($pageExportHTML->xpath($xpathPageContent));

        // Add all components to index page
        foreach ($otherOdeNavStructureSyncs as $odeNavStructureSync) {
            $section = $targetPageContent->addChild('section');
            // Page header
            $pageProperties = $odeNavStructureSync->getOdeNavStructureSyncProperties();
            $pagePropertiesDict = [];
            foreach ($pageProperties as $property) {
                if ($property->getValue()) {
                    $pagePropertiesDict[$property->getKey()] = $property->getValue();
                }
            }
            $pageHeaderSimpleXML = ExportXmlUtil::createHTMLPageHeader(
                $odeNavStructureSync,
                $pagesFileData,
                $odeProperties,
                $translator,
                $theme,
                $pagePropertiesDict,
                $this->exportType,
                $resourcesPrefix,
                false
            );

            ExportXmlUtil::addChildSimpleXMLElement($section, $pageHeaderSimpleXML->children()[0]);
            // Page content
            $pageContentSimpleXML = ExportXmlUtil::createHTMLPageContent(
                $odeNavStructureSync,
                $odeProperties,
                $idevicesMapping,
                $idevicesTypesData,
                $userPreferencesDtos,
                $theme,
                $resourcesPrefix,
                true,
                $translator
            );
            // Insert page xml into exe-content section
            ExportXmlUtil::addChildSimpleXMLElement($section, $pageContentSimpleXML->children()[0]);
        }

        // convert SimpleXMLElement to string
        $pageExportHTMLString = $pageExportHTML->asXML();

        // Convert HTML entities to their corresponding characters
        $pageExportHTMLString = html_entity_decode($pageExportHTMLString, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        // Remove CDATA sections but keep their content
        $pageExportHTMLString = preg_replace('/<!\[CDATA\[(.*?)\]\]>/s', '$1', $pageExportHTMLString);

        $pageExportHTMLString = preg_replace('/^<\?xml[^>]+>\s*/', '', $pageExportHTMLString);

        // Insert <meta charset="UTF-8"> at the beginning of the <head> section
        $pageExportHTMLString = preg_replace(
            '/<head([^>]*)>/i',
            '<head$1>' . PHP_EOL . '    <meta charset="UTF-8">',
            $pageExportHTMLString,
            1
        );

        // Ensure UTF-8 encoding
        $pageExportHTMLString = mb_convert_encoding($pageExportHTMLString, 'UTF-8', 'auto');

        $pageExportHTMLString = '<!DOCTYPE html>'.PHP_EOL.$pageExportHTMLString;

        file_put_contents($pageFile, $pageExportHTMLString);


        // Insert idevices html view
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                    $ideviceId = $odeComponentsSync->getOdeIdeviceId();
                    $ideviceType = $odeComponentsSync->getOdeIdeviceTypeName();

                    $odeComponentsSyncClone = $odeComponentsSyncCloneArray[$ideviceId];

                    $ideviceHtmlView = $odeComponentsSyncClone->getHtmlView();

                    $ideviceKey = 'IDEVICE_CONTENT_KEY_'.$ideviceId;

                    $ideviceHtml = file_get_contents($pageFile);
                    $ideviceHtmlView = $ideviceHtmlView ?? '';
                    $ideviceHtml = str_replace($ideviceKey, $ideviceHtmlView, $ideviceHtml);

                    // Write page file
                    file_put_contents($pageFile, $ideviceHtml);
                }
            }
        }
    }
}
