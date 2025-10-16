<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;
use App\Tests\E2E\Support\Selectors;
use App\Tests\E2E\Support\Wait;

/**
 * Smoke test: workarea renders and has a page title.
 */
final class DocumentStructureTest extends BaseE2ETestCase
{
    public function test_workarea_and_page_title_are_visible(): void
    {
        $client = $this->openWorkareaInNewBrowser('A');
        $page = DocumentFactory::open($client);

        Wait::css($client, Selectors::PAGE_TITLE, 6000);
        $this->assertNotSame('eXeLearning', $page->currentPageTitle(), 'Expected non-empty current page title');

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);
    }
}
