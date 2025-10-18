<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;
use Facebook\WebDriver\WebDriverExpectedCondition;

final class PrintViewTest extends BaseE2ETestCase
{
    public function testPrintPreviewOpensNewTabAndIsReachable(): void
    {
        // 1) Open a logged-in workarea and load a basic document
        $client = $this->openWorkareaInNewBrowser('A');
        DocumentFactory::open($client);

        // 2) Remember current window and trigger the Print action
        $originalHandle = $client->getWindowHandle();
        $client->waitFor('#navbar-button-export-print', 10);
        $client->executeScript('document.getElementById("navbar-button-export-print")?.click();');

        // 3) Wait for a new window (print preview) and switch to it
        $client->wait()->until(
            WebDriverExpectedCondition::numberOfWindowsToBe(2),
            'Expected a new print preview window to open'
        );

        $handles = $client->getWindowHandles();
        $previewHandle = (function(array $handles, string $orig) {
            foreach ($handles as $h) { if ($h !== $orig) { return $h; } }
            return $orig; // fallback (assert below will fail if not found)
        })($handles, $originalHandle);
        self::assertNotSame($originalHandle, $previewHandle, 'Unable to identify preview window handle.');

        $client->switchTo()->window($previewHandle);

        // 4) Wait for the preview tab to navigate away from about:blank and include print=1
        $client->wait()->until(
            WebDriverExpectedCondition::not(WebDriverExpectedCondition::urlIs('about:blank')),
            'Preview did not navigate away from about:blank'
        );
        $client->wait()->until(
            WebDriverExpectedCondition::urlContains('print=1'),
            'Preview URL does not contain print=1'
        );
        self::assertStringContainsString('print=1', $client->getCurrentURL());

        // Heuristic: exported HTML usually includes a generator meta tag starting with "eXe"
        $generator = (string) ($client->executeScript(<<<'JS'
            return document.querySelector('meta[name="generator"]')?.getAttribute('content');
        JS
        ) ?? '');
        self::assertTrue($generator === '' || str_starts_with($generator, 'eXe'), 'Expected generator meta to start with "eXe" or be absent');

        // 5) Check browser console for errors while the preview window is still open
        Console::assertNoBrowserErrors($client);

        // 6) Close preview and return to the main workarea window
        try { $client->close(); } catch (\Throwable) {}
        $client->switchTo()->window($originalHandle);
    }
}
