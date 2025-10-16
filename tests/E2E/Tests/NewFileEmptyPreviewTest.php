<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\PageObject\PreviewPage;
use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;
use App\Tests\E2E\Support\Wait;

/**
 * E2E test: preview functionality and validation of the new window (simplified).
 */
final class NewFileEmptyPreviewTest extends BaseE2ETestCase
{
    public function test_new_file_empty_preview(): void
    {
        // 1) Open a logged-in workarea
        $client = $this->openWorkareaInNewBrowser('A');
        DocumentFactory::open($client);

        // 2) Open preview window using the Page Object
        $preview = PreviewPage::openFrom($client);

        // 3) Validate preview URL and contents
        $preview->assertUrlMatches($this->currentUserId);
        $preview->assertValid('Untitled document', 'eXeLearning');

        // 4) Check console while PREVIEW is still open (so screenshots will include both windows if it fails)
        Console::assertNoBrowserErrors($client);

        // 6) Return to the main workarea
        $preview->close();

    }

}
