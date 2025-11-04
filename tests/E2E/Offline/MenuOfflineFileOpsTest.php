<?php
declare(strict_types=1);

namespace App\Tests\E2E\Offline;

use App\Tests\E2E\Support\BaseE2ETestCase;
use Symfony\Component\Panther\Client;

class MenuOfflineFileOpsTest extends BaseE2ETestCase
{
    use OfflineMenuActionsTrait;

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

        // Speed up export/download API so Save/Save As (offline) reach electronAPI quickly
        $client->executeScript(<<<'JS'
            (function(){
                try {
                    let patched = false;
                    const tryPatch = function(){
                        try {
                            if (patched) return;
                            const api = window.eXeLearning && window.eXeLearning.app && window.eXeLearning.app.api;
                            if (api) {
                                api.getOdeExportDownload = async function(odeSessionId, type){
                                    const name = (type === 'elp') ? 'document.elp' : `export-${type}.zip`;
                                    return { responseMessage: 'OK', urlZipFile: '/fake/download/url', exportProjectName: name };
                                };
                                api.getFileResourcesForceDownload = async function(url){ return { url: url }; };
                                patched = true; clearInterval(iv);
                            }
                        } catch (e) {}
                    };
                    const iv = setInterval(tryPatch, 50); tryPatch();
                } catch (e) {}
            })();
        JS);
    }

    private function initOfflineClientWithMock(): Client
    {
        $client = $this->makeClient();
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
        $this->openOfflineFileMenu($client);
        $this->clickMenuItem($client, '#navbar-button-open-offline');
        $this->waitForMockCall($client, 'openElp');
        $this->waitForMockCall($client, 'readFile');
    }

    public function testSaveOfflineUsesElectronSave(): void
    {
        $client = $this->initOfflineClientWithMock();
        $this->openOfflineFileMenu($client);
        $this->clickMenuItem($client, '#navbar-button-save-offline');
        $this->waitForMockCall($client, 'save');
    }

    public function testSaveAsOfflineUsesElectronSaveAs(): void
    {
        $client = $this->initOfflineClientWithMock();
        $this->openOfflineFileMenu($client);
        $this->clickMenuItem($client, '#navbar-button-save-as-offline');
        $this->waitForMockCall($client, 'saveAs');
    }

    public function testSaveAsOfflineAppendsElpxExtensionForDottedTitle(): void
    {
        $client = $this->initOfflineClientWithMock();
        $client->executeScript(<<<'JS'
            (function(){
                try {
                    const project = window.eXeLearning?.app?.project;
                    if (!project) { return; }
                    project.properties = project.properties || {};
                    project.properties.properties = project.properties.properties || {};
                    const props = project.properties.properties;
                    props.pp_title = props.pp_title || {};
                    props.pp_title.value = 'Offline.Title.v2';
                } catch (e) {}
            })();
        JS);

        $this->openOfflineFileMenu($client);
        $this->clickMenuItem($client, '#navbar-button-save-as-offline');
        $this->waitForMockCall($client, 'saveAs');

        $logs = $client->executeScript(<<<'JS'
            return (function(){
                try { return (window.__MockArgsLog && window.__MockArgsLog.saveAs) || []; }
                catch (e) { return []; }
            })();
        JS);

        $this->assertIsArray($logs, 'Expected saveAs mock log to be an array.');
        $this->assertNotEmpty($logs, 'Expected saveAs mock log to contain at least one entry.');
        $payload = $logs[count($logs) - 1] ?? null;
        $this->assertIsArray($payload, 'Expected last saveAs call payload to be an array.');
        $this->assertGreaterThanOrEqual(3, count($payload), 'Expected saveAs payload to contain URL, key and name.');
        $safeName = $payload[2] ?? null;
        $this->assertIsString($safeName, 'Expected saveAs third argument to be a string.');
        $this->assertStringContainsString('Offline.Title.v2', $safeName, 'Expected suggested name to include project title.');
        $this->assertTrue(
            str_ends_with(strtolower($safeName), '.elpx'),
            sprintf('Expected suggested name to end with .elpx, got "%s".', $safeName)
        );
    }
}
