<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;
use App\Tests\E2E\Support\Wait;
use Facebook\WebDriver\WebDriverBy;

/**
 * E2E test for the "Create New Document" flow.
 *
 * This test verifies that a user can successfully create a new, empty
 * document via the main "File -> New" menu.
 */
final class CreateNewDocumentTest extends BaseE2ETestCase
{
    public function test_create_new_document(): void
    {
        // 1. Open a logged-in workarea.
        $client = $this->openWorkareaInNewBrowser('A');
        DocumentFactory::open($client);

        // 2. Open the "File" menu.
        Wait::css($client, '#dropdownFile', 5000);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();

        // 3. Click the "New" button from the dropdown.
        Wait::css($client, '#navbar-button-new', 5000);
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-new'))->click();

        // 4. Verify that the new document is ready by asserting its properties form is visible.
        // This confirms the "new document" action was successful.
        Wait::css($client, '#properties-node-content-form', 8000);
        $this->assertGreaterThan(
            0,
            $client->getCrawler()->filter('#properties-node-content-form')->count(),
            'The properties form for the new document should be visible after clicking "New".'
        );

        // 5. Check for any client-side JavaScript errors.
        Console::assertNoBrowserErrors($client);
    }
}