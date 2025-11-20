<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use Facebook\WebDriver\WebDriverBy;
use Symfony\Component\Panther\Client;

use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;

final class MenuOnlineFunctionalityTest extends BaseE2ETestCase
{
    /**
     * Inject lightweight stubs to avoid real downloads and heavy network.
     */
    private function injectOnlineStubs(Client $client): void
    {
        // Ensure we are in online mode
        $client->executeScript(<<<'JS'
            (function(){
                try { if (window.eXeLearning && window.eXeLearning.config) { window.eXeLearning.config.isOfflineInstallation = false; } } catch (e) {}
            })();
        JS);

        // Track online flows and stub expensive API calls
        $client->executeScript(<<<'JS'
            (function(){
                window.__OnlineCalls = { saveOde: 0, saveAsOde: 0, downloadLink: 0, exportApi: 0 };
                const tryPatch = function(){
                    try {
                        if (window.eXeLearning && window.eXeLearning.app) {
                            // Stub save()
                            if (window.eXeLearning.app.project) {
                                window.eXeLearning.app.project.save = async function(){ window.__OnlineCalls.saveOde++; return true; };
                            }
                            // Stub saveAsOdeEvent()
                            if (window.eXeLearning.app.menus && window.eXeLearning.app.menus.navbar && window.eXeLearning.app.menus.navbar.file) {
                                const fileMenu = window.eXeLearning.app.menus.navbar.file;
                                fileMenu.saveAsOdeEvent = async function(){ window.__OnlineCalls.saveAsOde++; return true; };
                                fileMenu.downloadLink = function(){ window.__OnlineCalls.downloadLink++; };
                            }
                            // Stub export download API
                            if (window.eXeLearning.app.api) {
                                window.eXeLearning.app.api.getOdeExportDownload = async function(odeSessionId, type){
                                    window.__OnlineCalls.exportApi++;
                                    const name = (type === 'elp') ? 'document.elp' : `export-${type}.zip`;
                                    return { responseMessage: 'OK', urlZipFile: '/fake/download/url', exportProjectName: name };
                                };
                            }
                            return true;
                        }
                    } catch (e) {}
                    return false;
                };
                const iv = setInterval(function(){ if (tryPatch()) clearInterval(iv); }, 50);
                tryPatch();
            })();
        JS);
    }

    public function testOnlineSaveCallsBackendNotElectron(): void
    {
        $client = $this->login($this->makeClient());
        $this->injectOnlineStubs($client);

        // Click File -> Save (online)
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-save'))->click();

        // Assert backend save stub was hit; no electron API expected in online tests
        $saveCount = (int) $client->executeScript('return (window.__OnlineCalls && window.__OnlineCalls.saveOde) || 0;');
        $this->assertGreaterThanOrEqual(1, $saveCount);

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);        
    }

    public function testOnlineExportHtml5TriggersApiAndBrowserDownload(): void
    {
        $client = $this->login($this->makeClient());
        $this->injectOnlineStubs($client);

        // Click File -> Download as... -> Website (online)
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownExportAs'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-export-html5'))->click();

        $exportCalls = (int) $client->executeScript('return (window.__OnlineCalls && window.__OnlineCalls.exportApi) || 0;');
        $downloadCalls = (int) $client->executeScript('return (window.__OnlineCalls && window.__OnlineCalls.downloadLink) || 0;');
        $this->assertGreaterThanOrEqual(1, $exportCalls, 'Export API should be called');
        $this->assertGreaterThanOrEqual(1, $downloadCalls, 'Browser download should be triggered');

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);        
    }

    public function testOnlineDownloadProjectTriggersApiAndBrowserDownload(): void
    {
        $client = $this->login($this->makeClient());
        $this->injectOnlineStubs($client);

        // Click File -> Download as... -> eXeLearning content (.elp)
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownExportAs'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-download-project'))->click();

        $exportCalls = (int) $client->executeScript('return (window.__OnlineCalls && window.__OnlineCalls.exportApi) || 0;');
        $downloadCalls = (int) $client->executeScript('return (window.__OnlineCalls && window.__OnlineCalls.downloadLink) || 0;');
        $this->assertGreaterThanOrEqual(1, $exportCalls, 'Export API should be called');
        $this->assertGreaterThanOrEqual(1, $downloadCalls, 'Browser download should be triggered');

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);        
    }


    public function testExportToFolderOptionNotVisibleOnline(): void
    {
        $client = $this->login($this->makeClient());
        $this->injectOnlineStubs($client);

        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        // Ensure the offline-only option is not present
        $present = (bool) $client->executeScript('return !!document.getElementById("navbar-button-exportas-html5-folder");');
        $this->assertFalse($present, 'Export to Folder option must not appear online');

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);        
    }
}
