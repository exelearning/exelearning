<?php
declare(strict_types=1);

namespace App\Tests\E2E\Offline;

use App\Tests\E2E\ExelearningE2EBase;
use Facebook\WebDriver\WebDriverBy;
use Symfony\Component\Panther\Client;

class MenuOfflineVisibilityTest extends ExelearningE2EBase
{
    /**
     * Injects the mock Electron API into the browser window.
     */
    private function injectMockElectronApi(Client $client): void
    {
        // CORRECTED PATH: Go up three levels to the project root.
        $mockApiPath = __DIR__ . '/../../../public/app/workarea/mock-electron-api.js';

        // Add a check to ensure the file was loaded correctly.
        $this->assertFileExists($mockApiPath, 'The mock Electron API file could not be found.');
        
        $mockApiScript = file_get_contents($mockApiPath);

        // This assertion will give a much clearer error if file_get_contents fails.
        $this->assertIsString($mockApiScript, 'Failed to read the mock Electron API script file.');

        $client->executeScript($mockApiScript);
    }

    public function testFileMenuItemsVisibleInOfflineMode(): void
    {
        // In offline suite, backend should start in offline mode (APP_ONLINE_MODE=0)
        $client = $this->createTestClient();
        $client->request('GET', '/workarea');
        // Wait for the loading overlay to disappear before interacting
        $client->waitForInvisibility('#load-screen-main', 30);

        // Inject mock Electron API so any offline handlers referencing window.electronAPI don't fail in CI
        $this->injectMockElectronApi($client);

        // Open File dropdown
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();

        $jsIsVisible = <<<'JS'
            (sel) => {
                const el = document.querySelector(sel);
                if (!el) return false;
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') return false;
                const rect = el.getBoundingClientRect();
                return !!(rect.width || rect.height);
            }
        JS;

        // Offline-specific entries should be visible
        $this->assertTrue($client->executeScript("return ($jsIsVisible)('#navbar-button-open-offline');"), 'Open (offline) should be visible');
        $this->assertTrue($client->executeScript("return ($jsIsVisible)('#navbar-button-save-offline');"), 'Save (offline) should be visible');
        $this->assertTrue($client->executeScript("return ($jsIsVisible)('#navbar-button-save-as-offline');"), 'Save As (offline) should be visible');
        $this->assertTrue($client->executeScript("return ($jsIsVisible)('#dropdownExportAsOffline');"), 'Export As (offline) should be visible');

        // Online-only entries should be hidden in offline mode
        $this->assertFalse($client->executeScript("return ($jsIsVisible)('#navbar-button-openuserodefiles');"), 'Open (online) should be hidden');
        $this->assertFalse($client->executeScript("return ($jsIsVisible)('#navbar-button-save');"), 'Save (online) should be hidden');
        $this->assertFalse($client->executeScript("return ($jsIsVisible)('#dropdownExportAs');"), 'Download As (online) should be hidden');
        $this->assertFalse($client->executeScript("return ($jsIsVisible)('#navbar-button-dropdown-recent-projects');"), 'Recents should be hidden');

        // Ensure ELP option is NOT listed in offline Export As submenu
        $this->assertNull(
            $client->executeScript("return document.querySelector('#navbar-button-download-project-as');"),
            'ELP option should not be present in offline Export As menu'
        );
    }
}
