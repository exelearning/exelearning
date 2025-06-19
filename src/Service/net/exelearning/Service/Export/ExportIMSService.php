<?php

namespace App\Service\net\exelearning\Service\Export;

use App\Constants;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\ThemeHelper;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Util\net\exelearning\Util\ExportXmlUtil;
use Symfony\Contracts\Translation\TranslatorInterface;

class ExportIMSService implements ExportServiceInterface
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
        $this->exportType = Constants::EXPORT_TYPE_IMS;
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
        // Generate xml file
        $this->generateExportXMLFiles(
            $user,
            $odeSessionId,
            $odeNavStructureSyncs,
            $pagesFileData,
            $odeProperties,
            $elpFileName,
            $resourcesPrefix,
            $idevicesMapping,
            $idevicesByPage
        );

        // Generate html files
        $this->generateExportPagesHTMLFiles(
            $odeSessionId,
            $odeNavStructureSyncs,
            $pagesFileData,
            $odeProperties,
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
     * Create xml files.
     *
     * @param odeNavStructureSyncs $odeNavStructureSyncs
     * @param array                $pagesFileData
     * @param array                $odeProperties
     * @param string               $elpFileName
     * @param string               $resourcesPrefix
     * @param array                $idevicesMapping
     * @param array                $idevicesByPage
     *
     * @return bool
     */
    private function generateExportXMLFiles(
        $user,
        $odeSessionId,
        $odeNavStructureSyncs,
        $pagesFileData,
        $odeProperties,
        $elpFileName,
        $resourcesPrefix,
        $idevicesMapping,
        $idevicesByPage,
    ) {
        $exportDirPath = $this->fileHelper->getOdeSessionUserTmpExportDir($odeSessionId, $user);

        $odeId = $this->currentOdeUsersService->getOdeIdByOdeSessionId($user, $odeSessionId);

        // ismanifest.xml
        $imsmanifest = ExportXmlUtil::createIMSimsmanifest(
            $odeId,
            $odeNavStructureSyncs,
            $pagesFileData,
            $odeProperties,
            $elpFileName,
            $resourcesPrefix,
            $this->exportType,
            $exportDirPath,
            $idevicesMapping,
            $idevicesByPage
        );
        $imsmanifest->saveXML($exportDirPath.Constants::SCORM_IMSMANIFEST_NAME);

        return true;
    }

    /**
     * Generate HTML pages.
     *
     * @param string               $odeSessionId
     * @param odeNavStructureSyncs $odeNavStructureSyncs
     * @param array                $pagesFileData
     * @param array                $odeProperties
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
        // Generate a html file by page
        foreach ($odeNavStructureSyncs as $odeNavStructureSync) {
            // Page file path/url
            $pageData = $pagesFileData[$odeNavStructureSync->getOdePageId()];
            $pageFile = $pageData['filePath'];

            // In case it is not a preview we need to adjust the url of the links since we will be in a subfolder
            $modifyPrefix = (!$pageData['isIndex'] && !$isPreview);
            $newResourcesPrefix = ($modifyPrefix) ? '..'.Constants::SLASH.$resourcesPrefix : $resourcesPrefix;

            // Search for libraries in idevices
            $libsResourcesPath = ExportXmlUtil::getPathForLibrariesInIdevices($odeNavStructureSync, $odeProperties, $this->exportType);

            // Generate XML page
            $pageExportHTML = ExportXmlUtil::createHTMLPage(
                $odeSessionId,
                $odeNavStructureSync,
                $pagesFileData,
                $odeProperties,
                $libsResourcesPath,
                $idevicesMapping,
                $idevicesByPage,
                $idevicesTypesData,
                $userPreferencesDtos,
                $theme,
                $newResourcesPrefix,
                $this->exportType,
                $isPreview,
                $translator,
                $odeNavStructureSyncs
            );

            // convert SimpleXMLElement to string
            $pageExportHTMLString = $pageExportHTML->asXML();

            // Convert HTML entities to their corresponding characters
            // Decode HTML entities inside the <head> section
            $pageExportHTMLString = preg_replace_callback(
                '/(<head[^>]*>)(.*?)(<\/head>)/is',
                function ($matches) {
                    return $matches[1] . html_entity_decode($matches[2], ENT_QUOTES | ENT_HTML5, 'UTF-8') . $matches[3];
                },
                $pageExportHTMLString
            );

            // Decode HTML entities inside <div id="siteUserFooter">
            $pageExportHTMLString = preg_replace_callback(
                '/(<div\s+id="siteUserFooter"[^>]*>)(.*?)(<\/div>)/is',
                function ($matches) {
                    return $matches[1] . html_entity_decode($matches[2], ENT_QUOTES | ENT_HTML5, 'UTF-8') . $matches[3];
                },
                $pageExportHTMLString
            );

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

        return true;
    }
}
