<?php
declare(strict_types=1);

namespace App\Tests\E2E\Offline;

use App\Tests\E2E\ExelearningE2EBase;
use Facebook\WebDriver\WebDriverBy;
use Symfony\Component\Panther\Client;

class MenuOfflineFileOpsTest extends ExelearningE2EBase
{
    private function injectMockElectronApi(Client $client): void
    {
        $mockApiPath = __DIR__ . '/../../../public/app/workarea/mock-electron-api.js';
        $this->assertFileExists($mockApiPath);
        $mockApiScript = file_get_contents($mockApiPath);
        $this->assertIsString($mockApiScript);
        $client->executeScript($mockApiScript);
        $this->assertTrue((bool) $client->executeScript('return !!(window.__MockElectronLoaded && window.electronAPI);'));

        // Force offline
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

        // Instrument
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
        $elapsed = 0; $interval = 100;
        do {
            $count = (int) $client->executeScript(sprintf('return (window.__MockElectronCalls && window.__MockElectronCalls["%s"]) || 0;', $method));
            if ($count >= $minCalls) { $this->assertGreaterThanOrEqual($minCalls, $count); return; }
            usleep($interval * 1000); $elapsed += $interval;
        } while ($elapsed < $timeoutMs);
        $this->fail(sprintf('Timed out waiting for mock call %s >= %d', $method, $minCalls));
    }

    public function testOpenOfflineUsesElectronDialogs(): void
    {
        $client = $this->initOfflineClientWithMock();
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-open-offline'))->click();
        $this->waitForMockCall($client, 'openElp');
        $this->waitForMockCall($client, 'readFile');
    }

    public function testSaveOfflineUsesElectronSave(): void
    {
        $client = $this->initOfflineClientWithMock();
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-save-offline'))->click();
        $this->waitForMockCall($client, 'save');
    }

    public function testSaveAsOfflineUsesElectronSaveAs(): void
    {
        $client = $this->initOfflineClientWithMock();
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-save-as-offline'))->click();
        $this->waitForMockCall($client, 'saveAs');
    }
}

