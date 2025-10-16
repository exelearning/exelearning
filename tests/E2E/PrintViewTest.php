<?php

declare(strict_types=1);

namespace App\Tests\E2E;

final class PrintViewTest extends ExelearningE2EBase
{
    public function testPrintPreviewOpensNewTabAndTriggersPrintDialog(): void
    {
        if (!getenv('SELENIUM_HOST')) {
            $this->markTestSkipped('Panther/Selenium environment not available.');
        }

        $client = $this->login();
        $this->createNewDocument($client);

        $client->waitFor('#navbar-button-export-print');

        $initialHandles = $client->getWindowHandles();
        $mainHandle = $initialHandles[0] ?? null;
        self::assertNotNull($mainHandle, 'Main window handle not available.');

        // Trigger the Print / PDF action
        $client->executeScript('document.getElementById("navbar-button-export-print").click();');

        // Wait until the preview window is opened
        $handles = $client->getWindowHandles();
        $attempts = 0;
        while (count($handles) < 2 && $attempts < 40) {
            usleep(50_000);
            $handles = $client->getWindowHandles();
            ++$attempts;
        }
        self::assertGreaterThanOrEqual(2, count($handles), 'Print preview window did not open.');

        $previewCandidates = array_values(array_diff($handles, [$mainHandle]));
        self::assertNotEmpty($previewCandidates, 'Unable to identify preview window handle.');
        $previewHandle = $previewCandidates[0];

        // Switch to the preview tab and stub window.print
        $client->switchToWindow($previewHandle);
        $client->executeScript(<<<'JS'
            window.print = function () {
                if (document.body) {
                    document.body.setAttribute('data-print-called', 'true');
                }
            };
        JS);

        // Wait until the export content is loaded and the print stub is invoked
        $printMarker = $client->waitFor('body[data-print-called]');
        self::assertSame('true', $printMarker->getAttribute('data-print-called'));

        self::assertStringContainsString('print=1', $client->getCurrentURL());

        // Return focus to the main tab to keep the session consistent
        $client->switchToWindow($mainHandle);
    }
}
