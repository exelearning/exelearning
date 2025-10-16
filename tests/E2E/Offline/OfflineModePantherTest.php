<?php
// tests/E2E/Offline/OfflineModePantherTest.php
declare(strict_types=1);

namespace App\Tests\E2E\Offline;

use App\Tests\E2E\Support\BaseE2ETestCase;
use Symfony\Component\Panther\Client;
use App\Tests\E2E\Support\Console;

class OfflineModePantherTest extends BaseE2ETestCase
{
    // /**
    //  * Override the base URL to point to our local PHP server for offline tests.
    //  */
    // public static function setUpBeforeClass(): void
    // {
    //     // Don't call parent::setUpBeforeClass() as it sets up for Docker.
    //     self::$baseUrl = 'http://127.0.0.1:8088';
    // }

    // /**
    //  * Creates a Panther client without the Docker/Selenium setup.
    //  */
    // protected static function createTestClient(): Client
    // {
    //     // Use the default createPantherClient which will manage a local Chrome instance.
    //     return static::createPantherClient();
    // }

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

    /**
     * Tests that the application loads directly into the workarea in offline mode.
     */
    public function testLoadsWorkareaDirectlyInOfflineMode(): void
    {
        $client = $this->makeClient();
        $client->request('GET', '/workarea');

        // Since APP_ONLINE_MODE=0, it should not redirect to /login
        $this->assertStringContainsString('/workarea', $client->getCurrentURL());
        // $this->assertSelectorExists('#idevice-list', 'iDevice list should be present in the workarea.');

        // IMPORTANT: Inject the mock API after the page has loaded.
        $this->injectMockElectronApi($client);

        // Now you can test UI interactions that would normally call window.electronAPI
        // For example, if you have a "Save" button with id="save-button"
        // $client->click('#save-button');
        // The mock API will console.log("MOCK [save] called...") instead of throwing an error.

        // Assert deterministically that the mock was injected (without relying on console logs)
        $injected = $client->executeScript(
            'return !!(window.__MockElectronLoaded === true && window.electronAPI && typeof window.electronAPI.openElp === "function");'
        );
        $this->assertTrue((bool)$injected, 'Mock Electron API not injected or missing expected methods.');

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);

    }
}
