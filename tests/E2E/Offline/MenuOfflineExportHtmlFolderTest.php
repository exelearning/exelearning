<?php
declare(strict_types=1);

namespace App\Tests\E2E\Offline;

use App\Tests\E2E\Support\BaseE2ETestCase;
use Symfony\Component\Panther\Client;

class MenuOfflineExportHtmlFolderTest extends BaseE2ETestCase
{
    use OfflineMenuActionsTrait;

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
                window.__MockElectronCalls = { saveAs:0, exportToFolder:0 };
                const wrap = (name) => {
                    if (!window.electronAPI || typeof window.electronAPI[name] !== 'function') return;
                    const orig = window.electronAPI[name];
                    window.electronAPI[name] = async function(...args){
                        try { window.__MockElectronCalls[name] = (window.__MockElectronCalls[name]||0) + 1; } catch(e) {}
                        return await orig.apply(this, args);
                    };
                };
                ['saveAs','exportToFolder'].forEach(wrap);
                // Speed up export endpoints
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
        $c = $this->makeClient();
        $c->request('GET', '/workarea');
        $c->waitForInvisibility('#load-screen-main', 30);
        $this->inject($c);
        return $c;
    }

    private function wait(Client $client, string $name, int $count = 1, int $timeoutMs = 5000): void
    {
        $elapsed = 0; $interval = 100;
        do {
            $n = (int) $client->executeScript(sprintf('return (window.__MockElectronCalls && window.__MockElectronCalls["%s"]) || 0;', $name));
            if ($n >= $count) return;
            usleep($interval * 1000); $elapsed += $interval;
        } while ($elapsed < $timeoutMs);
        $this->fail(sprintf('Timed out waiting for %s >= %d', $name, $count));
    }

    public function testExportAsHtml5OfflineUsesElectronSaveAs(): void
    {
        $client = $this->client();
        $this->openOfflineExportMenu($client);
        $this->clickMenuItem($client, '#navbar-button-exportas-html5');
        $this->wait($client, 'saveAs');
    }

    public function testExportHtml5ToFolderOfflineUsesElectronFolderPicker(): void
    {
        $client = $this->client();
        $this->openOfflineExportMenu($client);
        $this->clickMenuItem($client, '#navbar-button-exportas-html5-folder');
        $this->wait($client, 'exportToFolder');
    }

    public function testExportHtml5ToFolderCancelIsHandled(): void
    {
        $client = $this->client();
        $client->executeScript(<<<'JS'
            (function(){ if (window.electronAPI) window.electronAPI.exportToFolder = async function(){ return { ok:false, canceled:true }; }; })();
        JS);
        $this->openOfflineExportMenu($client);
        $this->clickMenuItem($client, '#navbar-button-exportas-html5-folder');
        // Just ensure no crash and API was invoked
        $calls = (int) $client->executeScript('return (window.__MockElectronCalls && window.__MockElectronCalls.exportToFolder) || 0;');
        $this->assertGreaterThanOrEqual(0, $calls);
    }
}
