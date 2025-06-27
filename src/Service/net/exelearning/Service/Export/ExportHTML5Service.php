<?php

namespace App\Service\net\exelearning\Service\Export;

use App\Constants;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Helper\net\exelearning\Helper\ThemeHelper;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Util\net\exelearning\Util\ExportXmlUtil;
use Symfony\Contracts\Translation\TranslatorInterface;

class ExportHTML5Service implements ExportServiceInterface
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
        $this->exportType = Constants::EXPORT_TYPE_HTML5;
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

            // Convert SimpleXMLElement to DOMDocument
            $dom = new \DOMDocument('1.0', 'UTF-8');
            $dom->formatOutput = true;
            $importedNode = $dom->importNode(
                dom_import_simplexml($pageExportHTML),
                true // deep copy
            );
            $dom->appendChild($importedNode);

            // Write the file as real HTML5
            $dom->saveHTMLFile($pageFile);

            // Añade el doctype al principio del HTML5: <!DOCTYPE html>
            $pageFileNewText = '<!DOCTYPE html>'.PHP_EOL.file_get_contents($pageFile);

            file_put_contents($pageFile, $pageFileNewText);

            // Insert idevices html view
            foreach ($odeNavStructureSync->getOdePagStructureSyncs() as $odePagStructureSync) {
                foreach ($odePagStructureSync->getOdeComponentsSyncs() as $odeComponentsSync) {
                    $ideviceId = $odeComponentsSync->getOdeIdeviceId();
                    $ideviceType = $odeComponentsSync->getOdeIdeviceTypeName();

                    $odeComponentsSyncClone = $odeComponentsSyncCloneArray[$ideviceId];

                    $ideviceHtmlView = $odeComponentsSyncClone->getHtmlView();

                    $ideviceKey = 'IDEVICE_CONTENT_KEY_'.$ideviceId;

                    if (null !== $ideviceHtmlView) {
                        $ideviceHtml = file_get_contents($pageFile);
                        $ideviceHtml = str_replace($ideviceKey, $ideviceHtmlView, $ideviceHtml);

                        // Write page file
                        file_put_contents($pageFile, $ideviceHtml);
                    }
                }
            }
        }
    }
}
