<?php

declare(strict_types=1);

namespace App\Tests\E2E;

final class PrintViewTest extends ExelearningE2EBase
{
    public function testPrintViewLoadsWithPageBreaks(): void
    {
        if (!getenv('SELENIUM_HOST')) {
            $this->markTestSkipped('Panther/Selenium environment not available.');
        }

        $client = $this->login();
        $this->createNewDocument($client);

        $client->waitFor('#navbar-button-export-print');
        $label = $client->executeScript('return document.getElementById("navbar-button-export-print").textContent.trim();');
        self::assertSame('Print / PDF', $label);

        $projectId = $client->executeScript('return window.__currentProjectId || (window.eXeLearning && window.eXeLearning.app && window.eXeLearning.app.project ? window.eXeLearning.app.project.odeId : null);');
        self::assertNotEmpty($projectId, 'Project id should be available for print view');

        $printUrl = sprintf('http://exelearning:%d/project/%s/print', $this->currentPort, $projectId);
        $client->getWebDriver()->get($printUrl);

        $client->waitFor('#print-layout');
        $breakValue = $client->executeScript('const el = document.querySelector(".print-page"); return el ? window.getComputedStyle(el).breakAfter || window.getComputedStyle(el).webkitColumnBreakAfter || "" : "";');
        self::assertIsString($breakValue);
        self::assertStringContainsString('page', strtolower((string) $breakValue));

        $printType = $client->executeScript('return typeof window.print;');
        self::assertSame('function', $printType);
    }
}
