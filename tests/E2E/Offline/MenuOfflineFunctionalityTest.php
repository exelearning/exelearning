<?php
declare(strict_types=1);

namespace App\Tests\E2E\Offline;

use App\Tests\E2E\ExelearningE2EBase;
use Facebook\WebDriver\WebDriverBy;
use Symfony\Component\Panther\Client;

class MenuOfflineFunctionalityTest extends ExelearningE2EBase
{
    /**
     * Injects the mock Electron API into the browser window.
     */
    private function injectMockElectronApi(Client $client): void
    {
        $mockApiPath = __DIR__ . '/../../../public/app/workarea/mock-electron-api.js';
        $this->assertFileExists($mockApiPath, 'The mock Electron API file could not be found.');

        $mockApiScript = file_get_contents($mockApiPath);
        $this->assertIsString($mockApiScript, 'Failed to read the mock Electron API script file.');

        $client->executeScript($mockApiScript);

        // Ensure it is available
        $this->assertTrue(
            (bool) $client->executeScript('return !!(window.__MockElectronLoaded && window.electronAPI);')
        );

        // Force offline flag to ensure offline code paths are used and reapply on project if already created
        $client->executeScript(<<<'JS'
            (function(){
                try { if (window.eXeLearning && window.eXeLearning.config) { window.eXeLearning.config.isOfflineInstallation = true; } } catch (e) {}
                try {
                    const tryApply = function(){
                        try {
                            if (window.eXeLearning && window.eXeLearning.app && window.eXeLearning.app.project) {
                                window.eXeLearning.app.project.offlineInstallation = true;
                                if (typeof window.eXeLearning.app.project.setInstallationTypeAttribute === 'function') {
                                    window.eXeLearning.app.project.setInstallationTypeAttribute();
                                }
                                clearInterval(iv);
                            }
                        } catch (e) {}
                    };
                    const iv = setInterval(tryApply, 50);
                    tryApply();
                } catch (e) {}
            })();
        JS);

        // Instrument mock calls to be easily asserted from tests
        $client->executeScript(<<<'JS'
            (function(){
                window.__MockElectronCalls = { openElp:0, readFile:0, save:0, saveAs:0 };
                window.__MockArgsLog = { openElp:[], readFile:[], save:[], saveAs:[] };
                const wrap = (name) => {
                    if (!window.electronAPI || typeof window.electronAPI[name] !== 'function') return;
                    const orig = window.electronAPI[name];
                    window.electronAPI[name] = async function(...args){
                        try { window.__MockElectronCalls[name] = (window.__MockElectronCalls[name]||0) + 1; } catch(e) {}
                        try { (window.__MockArgsLog[name] = window.__MockArgsLog[name] || []).push(args); } catch(e) {}
                        return await orig.apply(this, args);
                    };
                };
                ['openElp','readFile','save','saveAs'].forEach(wrap);
            })();
        JS);

        // Stub slow backend calls to resolve quickly and deterministically for export/save flows
        $client->executeScript(<<<'JS'
            (function(){
                try {
                    let patched = false;
                    window.__MockApiCalls = { getOdeExportDownload: 0 };
                    window.__MockApiArgs = { getOdeExportDownload: [] };
                    const tryPatch = function(){
                        try {
                            if (patched) return;
                            if (window.eXeLearning && window.eXeLearning.app && window.eXeLearning.app.api) {
                                window.eXeLearning.app.api.getOdeExportDownload = async function(odeSessionId, type){
                                    try { window.__MockApiCalls.getOdeExportDownload++; } catch(e) {}
                                    try { (window.__MockApiArgs.getOdeExportDownload = window.__MockApiArgs.getOdeExportDownload || []).push([odeSessionId, type]); } catch(e) {}
                                    const name = (type === 'elp') ? 'document.elp' : `export-${type}.zip`;
                                    return { responseMessage: 'OK', urlZipFile: '/fake/download/url', exportProjectName: name };
                                };
                                window.eXeLearning.app.api.getFileResourcesForceDownload = async function(url){
                                    return { url: url };
                                };
                                patched = true;
                                clearInterval(iv);
                            }
                        } catch (e) {}
                    };
                    const iv = setInterval(tryPatch, 50);
                    tryPatch();
                } catch (e) {}
            })();
        JS);
    }

    private function initOfflineClientWithMock(): Client
    {
        $client = $this->createTestClient();
        $client->request('GET', '/workarea');
        $client->waitForInvisibility('#load-screen-main', 30);
        $this->injectMockElectronApi($client);
        return $client;
    }

    private function waitForMockCall(Client $client, string $method, int $minCalls = 1, int $timeoutMs = 5000): void
    {
        $elapsed = 0;
        $interval = 100; // ms
        do {
            $count = (int) $client->executeScript(sprintf('return (window.__MockElectronCalls && window.__MockElectronCalls["%s"]) || 0;', $method));
            if ($count >= $minCalls) {
                $this->assertGreaterThanOrEqual($minCalls, $count);
                return;
            }
            usleep($interval * 1000);
            $elapsed += $interval;
        } while ($elapsed < $timeoutMs);

        $this->fail(sprintf('Timed out waiting for mock call %s >= %d', $method, $minCalls));
    }

    public function testOpenOfflineUsesElectronDialogs(): void
    {
        $client = $this->initOfflineClientWithMock();

        // Open File dropdown and click Open (offline)
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-open-offline'))->click();

        // Expect native open dialog + readFile to be invoked by the app
        $this->waitForMockCall($client, 'openElp');
        $this->waitForMockCall($client, 'readFile');
    }

    public function testSaveOfflineUsesElectronSave(): void
    {
        $client = $this->initOfflineClientWithMock();

        // Open File dropdown and click Save (offline)
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-save-offline'))->click();

        // Expect native save flow
        $this->waitForMockCall($client, 'save');
    }

    public function testSaveAsOfflineUsesElectronSaveAs(): void
    {
        $client = $this->initOfflineClientWithMock();

        // Open File dropdown and click Save As (offline)
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-save-as-offline'))->click();

        // Expect native save-as flow
        $this->waitForMockCall($client, 'saveAs');
    }

    public function testExportAsHtml5OfflineUsesElectronSaveAs(): void
    {
        $client = $this->initOfflineClientWithMock();

        // Open File dropdown and click Export As (offline) -> Website
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownExportAsOffline'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-exportas-html5'))->click();

        $this->waitForMockCall($client, 'saveAs');
        // Ensure export API was called
        $exportCalls = (int) $client->executeScript('return (window.__MockApiCalls && window.__MockApiCalls.getOdeExportDownload) || 0;');
        $this->assertGreaterThanOrEqual(1, $exportCalls);
    }

    public function testExportAsHtml5SinglePageOfflineUsesElectronSaveAs(): void
    {
        $client = $this->initOfflineClientWithMock();

        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownExportAsOffline'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-exportas-html5-sp'))->click();

        $this->waitForMockCall($client, 'saveAs');
        $exportCalls = (int) $client->executeScript('return (window.__MockApiCalls && window.__MockApiCalls.getOdeExportDownload) || 0;');
        $this->assertGreaterThanOrEqual(1, $exportCalls);
    }

    public function testExportAsScorm12OfflineUsesElectronSaveAs(): void
    {
        $client = $this->initOfflineClientWithMock();

        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownExportAsOffline'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-exportas-scorm12'))->click();

        $this->waitForMockCall($client, 'saveAs');
        $exportCalls = (int) $client->executeScript('return (window.__MockApiCalls && window.__MockApiCalls.getOdeExportDownload) || 0;');
        $this->assertGreaterThanOrEqual(1, $exportCalls);
    }

    public function testExportAsScorm2004OfflineUsesElectronSaveAs(): void
    {
        $client = $this->initOfflineClientWithMock();

        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownExportAsOffline'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-exportas-scorm2004'))->click();

        $this->waitForMockCall($client, 'saveAs');
        $exportCalls = (int) $client->executeScript('return (window.__MockApiCalls && window.__MockApiCalls.getOdeExportDownload) || 0;');
        $this->assertGreaterThanOrEqual(1, $exportCalls);
    }

    public function testExportAsImsOfflineUsesElectronSaveAs(): void
    {
        $client = $this->initOfflineClientWithMock();

        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownExportAsOffline'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-exportas-ims'))->click();

        $this->waitForMockCall($client, 'saveAs');
        $exportCalls = (int) $client->executeScript('return (window.__MockApiCalls && window.__MockApiCalls.getOdeExportDownload) || 0;');
        $this->assertGreaterThanOrEqual(1, $exportCalls);
    }

    public function testExportAsEpub3OfflineUsesElectronSaveAs(): void
    {
        $client = $this->initOfflineClientWithMock();

        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownExportAsOffline'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-exportas-epub3'))->click();

        $this->waitForMockCall($client, 'saveAs');
        $exportCalls = (int) $client->executeScript('return (window.__MockApiCalls && window.__MockApiCalls.getOdeExportDownload) || 0;');
        $this->assertGreaterThanOrEqual(1, $exportCalls);
    }

    public function testExportAsXmlOfflineUsesElectronSaveAs(): void
    {
        $client = $this->initOfflineClientWithMock();

        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownExportAsOffline'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-exportas-xml-properties'))->click();

        $this->waitForMockCall($client, 'saveAs');
        $exportCalls = (int) $client->executeScript('return (window.__MockApiCalls && window.__MockApiCalls.getOdeExportDownload) || 0;');
        $this->assertGreaterThanOrEqual(1, $exportCalls);
    }

    public function testToolbarSaveUsesElectronSave(): void
    {
        $client = $this->initOfflineClientWithMock();

        // Click the toolbar Save button
        $client->waitForVisibility('#head-top-save-button', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('head-top-save-button'))->click();

        $this->waitForMockCall($client, 'save');
    }

    public function testDownloadButtonExportsThenAsksLocation(): void
    {
        $client = $this->initOfflineClientWithMock();

        // Click the toolbar Download button (ELP export)
        $client->waitFor('#head-top-download-button', 10); // wait for presence
        // Use JS click to avoid any transient overlays intercepting the click
        $client->executeScript("document.querySelector('#head-top-download-button')?.click();");

        // Should call export API and then electron save
        $this->waitForMockCall($client, 'save');
        $exportCalls = (int) $client->executeScript('return (window.__MockApiCalls && window.__MockApiCalls.getOdeExportDownload) || 0;');
        $this->assertGreaterThanOrEqual(1, $exportCalls);
    }

    public function testSaveFirstTimeAsksLocationAndSubsequentSavesOverwrite(): void
    {
        $client = $this->initOfflineClientWithMock();

        // Use toolbar Save to exercise common path
        $client->waitForVisibility('#head-top-save-button', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('head-top-save-button'))->click();
        $this->waitForMockCall($client, 'save', 1);

        // Click Save again; should invoke the same save flow (no saveAs)
        $client->getWebDriver()->findElement(WebDriverBy::id('head-top-save-button'))->click();
        $this->waitForMockCall($client, 'save', 2);

        // Check that both calls used the same key (second arg)
        $firstKey = (string) $client->executeScript('return (window.__MockArgsLog && window.__MockArgsLog.save && window.__MockArgsLog.save[0] && window.__MockArgsLog.save[0][1]) || "";');
        $secondKey = (string) $client->executeScript('return (window.__MockArgsLog && window.__MockArgsLog.save && window.__MockArgsLog.save[1] && window.__MockArgsLog.save[1][1]) || "";');
        $this->assertNotSame('', $firstKey);
        $this->assertSame($firstKey, $secondKey, 'Subsequent saves should target the same destination key');

        // Ensure Save As was not triggered implicitly
        $saveAsCalls = (int) $client->executeScript('return (window.__MockElectronCalls && window.__MockElectronCalls.saveAs) || 0;');
        $this->assertSame(0, $saveAsCalls, 'Save As should not be called when clicking Save');
    }

    public function testSaveAsAlwaysAsksForLocation(): void
    {
        $client = $this->initOfflineClientWithMock();

        // Open File dropdown and click Save As (offline) twice
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-save-as-offline'))->click();
        $this->waitForMockCall($client, 'saveAs', 1);

        // Second time: open menu again and click Save As
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-save-as-offline'))->click();
        $this->waitForMockCall($client, 'saveAs', 2);

        // Save (non-As) should not be invoked by Save As
        $saveCalls = (int) $client->executeScript('return (window.__MockElectronCalls && window.__MockElectronCalls.save) || 0;');
        $this->assertSame(0, $saveCalls, 'Save should not be called when clicking Save As');
    }

    public function testNewDocumentThenSavePromptsAndSecondSaveOverwrites(): void
    {
        $client = $this->initOfflineClientWithMock();

        // Create a new document via menu
        $this->createNewDocument($client);

        // First save should prompt (simulated by electronAPI.save call)
        $client->waitForInvisibility('#load-screen-main', 30);
        $client->waitFor('#head-top-save-button', 10);
        // Use JS click to avoid transient overlays/hints
        $client->executeScript("document.querySelector('#head-top-save-button')?.click();");
        $this->waitForMockCall($client, 'save', 1);

        // Second save should target the same key (overwrite)
        $client->waitForInvisibility('#load-screen-main', 30);
        $client->executeScript("document.querySelector('#head-top-save-button')?.click();");
        $this->waitForMockCall($client, 'save', 2);

        $firstKey = (string) $client->executeScript('return (window.__MockArgsLog && window.__MockArgsLog.save && window.__MockArgsLog.save[0] && window.__MockArgsLog.save[0][1]) || "";');
        $secondKey = (string) $client->executeScript('return (window.__MockArgsLog && window.__MockArgsLog.save && window.__MockArgsLog.save[1] && window.__MockArgsLog.save[1][1]) || "";');
        $this->assertNotSame('', $firstKey);
        $this->assertSame($firstKey, $secondKey);
    }
}
