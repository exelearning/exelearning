<?php
declare(strict_types=1);

namespace App\Tests\E2E\Offline;

use App\Tests\E2E\ExelearningE2EBase;
use Facebook\WebDriver\WebDriverBy;
use Symfony\Component\Panther\Client;

class MenuOfflineToolbarAndSaveFlowTest extends ExelearningE2EBase
{
    private function inject(Client $client): void
    {
        $mockApiPath = __DIR__ . '/../../../public/app/workarea/mock-electron-api.js';
        $this->assertFileExists($mockApiPath);
        $client->executeScript(file_get_contents($mockApiPath));
        $this->assertTrue((bool) $client->executeScript('return !!(window.__MockElectronLoaded && window.electronAPI);'));
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
        $client->executeScript(<<<'JS'
            (function(){
                window.__MockElectronCalls = { save:0, saveAs:0 };
                window.__MockArgsLog = { save:[], saveAs:[] };
                const wrap = (name) => {
                    if (!window.electronAPI || typeof window.electronAPI[name] !== 'function') return;
                    const orig = window.electronAPI[name];
                    window.electronAPI[name] = async function(...args){
                        try { window.__MockElectronCalls[name] = (window.__MockElectronCalls[name]||0) + 1; } catch(e) {}
                        try { (window.__MockArgsLog[name] = window.__MockArgsLog[name] || []).push(args); } catch(e) {}
                        return await orig.apply(this, args);
                    };
                };
                ['save','saveAs'].forEach(wrap);
                // Speed export API for toolbar download test
                let patched = false;
                const tryPatch = function(){
                    try {
                        if (patched) return;
                        if (window.eXeLearning && window.eXeLearning.app && window.eXeLearning.app.api) {
                            window.eXeLearning.app.api.getOdeExportDownload = async function(odeSessionId, type){
                                return { responseMessage: 'OK', urlZipFile: '/fake/download/url', exportProjectName: 'export-'+type+'.zip' };
                            };
                            patched = true; clearInterval(iv);
                        }
                    } catch (e) {}
                };
                const iv = setInterval(tryPatch, 50); tryPatch();
            })();
        JS);
    }

    private function client(): Client
    {
        $c = $this->createTestClient();
        $c->request('GET', '/workarea');
        $c->waitForInvisibility('#load-screen-main', 30);
        $this->inject($c);
        return $c;
    }

    private function waitCall(Client $client, string $name, int $count = 1, int $timeoutMs = 5000): void
    {
        $elapsed = 0; $interval = 100;
        do {
            $n = (int) $client->executeScript(sprintf('return (window.__MockElectronCalls && window.__MockElectronCalls["%s"]) || 0;', $name));
            if ($n >= $count) return;
            usleep($interval * 1000); $elapsed += $interval;
        } while ($elapsed < $timeoutMs);
        $this->fail(sprintf('Timed out waiting for %s >= %d', $name, $count));
    }

    public function testToolbarSaveUsesElectronSave(): void
    {
        $client = $this->client();
        $client->waitForVisibility('#head-top-save-button', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('head-top-save-button'))->click();
        $this->waitCall($client, 'save');
    }

    public function testDownloadButtonExportsThenAsksLocation(): void
    {
        $client = $this->client();
        $client->waitFor('#head-top-download-button', 10);
        $client->executeScript("document.querySelector('#head-top-download-button')?.click();");
        $this->waitCall($client, 'save');
    }

    public function testSaveFirstTimeAsksLocationAndSubsequentSavesOverwrite(): void
    {
        $client = $this->client();
        $client->waitForVisibility('#head-top-save-button', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('head-top-save-button'))->click();
        $this->waitCall($client, 'save', 1);
        $client->getWebDriver()->findElement(WebDriverBy::id('head-top-save-button'))->click();
        $this->waitCall($client, 'save', 2);
        $firstKey = (string) $client->executeScript('return (window.__MockArgsLog && window.__MockArgsLog.save && window.__MockArgsLog.save[0] && window.__MockArgsLog.save[0][1]) || "";');
        $secondKey = (string) $client->executeScript('return (window.__MockArgsLog && window.__MockArgsLog.save && window.__MockArgsLog.save[1] && window.__MockArgsLog.save[1][1]) || "";');
        $this->assertNotSame('', $firstKey);
        $this->assertSame($firstKey, $secondKey);
        $saveAsCalls = (int) $client->executeScript('return (window.__MockElectronCalls && window.__MockElectronCalls.saveAs) || 0;');
        $this->assertSame(0, $saveAsCalls);
    }

    public function testSaveAsAlwaysAsksForLocation(): void
    {
        $client = $this->client();
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-save-as-offline'))->click();
        $this->waitCall($client, 'saveAs', 1);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-save-as-offline'))->click();
        $this->waitCall($client, 'saveAs', 2);
        $saveCalls = (int) $client->executeScript('return (window.__MockElectronCalls && window.__MockElectronCalls.save) || 0;');
        $this->assertSame(0, $saveCalls);
    }
}

