<?php
declare(strict_types=1);

namespace App\Tests\E2E\Offline;

use App\Tests\E2E\Support\BaseE2ETestCase;
use Symfony\Component\Panther\Client;

class MenuOfflineExportsPackagesTest extends BaseE2ETestCase
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
                window.__MockElectronCalls = { saveAs:0 };
                const wrap = (name) => {
                    if (!window.electronAPI || typeof window.electronAPI[name] !== 'function') return;
                    const orig = window.electronAPI[name];
                    window.electronAPI[name] = async function(...args){
                        try { window.__MockElectronCalls[name] = (window.__MockElectronCalls[name]||0) + 1; } catch(e) {}
                        return await orig.apply(this, args);
                    };
                };
                ['saveAs'].forEach(wrap);
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

    private function waitSaveAs(Client $client): void
    {
        $elapsed = 0; $interval = 100;
        do {
            $n = (int) $client->executeScript('return (window.__MockElectronCalls && window.__MockElectronCalls.saveAs) || 0;');
            if ($n >= 1) return;
            usleep($interval * 1000); $elapsed += $interval;
        } while ($elapsed < 5000);
        $this->fail('Timed out waiting for saveAs');
    }

    public function testExportAsScorm12OfflineUsesElectronSaveAs(): void
    {
        $client = $this->client();
        $this->openOfflineExportMenu($client);
        $this->clickMenuItem($client, '#navbar-button-exportas-scorm12');
        $this->waitSaveAs($client);
    }

    public function testExportAsScorm2004OfflineUsesElectronSaveAs(): void
    {
        /* To review (SCORM 2004 export is currently hidden)
        $client = $this->client();
        $this->openOfflineExportMenu($client);
        $this->clickMenuItem($client, '#navbar-button-exportas-scorm2004');
        $this->waitSaveAs($client);
        */
    }

    public function testExportAsImsOfflineUsesElectronSaveAs(): void
    {
        $client = $this->client();
        $this->openOfflineExportMenu($client);
        $this->clickMenuItem($client, '#navbar-button-exportas-ims');
        $this->waitSaveAs($client);
    }

    public function testExportAsEpub3OfflineUsesElectronSaveAs(): void
    {
        $client = $this->client();
        $this->openOfflineExportMenu($client);
        $this->clickMenuItem($client, '#navbar-button-exportas-epub3');
        $this->waitSaveAs($client);
    }

    public function testExportAsXmlOfflineUsesElectronSaveAs(): void
    {
        $client = $this->client();
        $this->openOfflineExportMenu($client);
        $this->clickMenuItem($client, '#navbar-button-exportas-xml-properties');
        $this->waitSaveAs($client);
    }
}
