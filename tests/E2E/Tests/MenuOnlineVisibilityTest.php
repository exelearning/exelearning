<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use Facebook\WebDriver\WebDriverBy;
use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;

final class MenuOnlineVisibilityTest extends BaseE2ETestCase
{
    public function testFileMenuItemsVisibleInOnlineMode(): void
    {
        $client = $this->login($this->makeClient());

        // Open File dropdown
        $client->waitForVisibility('#dropdownFile', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();

        // Helper to check visibility from the browser context
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

        // Online-only should be visible
        $this->assertTrue($client->executeScript("return ($jsIsVisible)('#navbar-button-openuserodefiles');"), 'Open (online) should be visible');
        $this->assertTrue($client->executeScript("return ($jsIsVisible)('#navbar-button-save');"), 'Save (online) should be visible');
        $this->assertTrue($client->executeScript("return ($jsIsVisible)('#dropdownExportAs');"), 'Download As (online) should be visible');
        $this->assertTrue($client->executeScript("return ($jsIsVisible)('#navbar-button-dropdown-recent-projects');"), 'Recents should be visible');

        // Offline-only should be hidden in online mode
        $this->assertFalse($client->executeScript("return ($jsIsVisible)('#navbar-button-open-offline');"), 'Open (offline) should be hidden');
        $this->assertFalse($client->executeScript("return ($jsIsVisible)('#navbar-button-save-offline');"), 'Save (offline) should be hidden');
        $this->assertFalse($client->executeScript("return ($jsIsVisible)('#navbar-button-save-as-offline');"), 'Save As (offline) should be hidden');
        $this->assertFalse($client->executeScript("return ($jsIsVisible)('#dropdownExportAsOffline');"), 'Export As (offline) should be hidden');

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);
    }
}

