<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Factory\DocumentFactory;
use Facebook\WebDriver\Remote\LocalFileDetector;
use Facebook\WebDriver\WebDriverBy;
use App\Tests\E2E\Support\Console;

final class OpenBasicElpTest extends BaseE2ETestCase
{
    public function test_open_basic_elp_minimal(): void
    {
        $client = $this->openWorkareaInNewBrowser('A');
        DocumentFactory::open($client);

        // Open File -> Open
        $client->waitForVisibility('#dropdownFile', 20);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-openuserodefiles'))->click();
        $client->waitForVisibility('#modalOpenUserOdeFiles', 20);

        // File input inside the modal
        $input = $client->getWebDriver()->findElement(
            WebDriverBy::cssSelector('#modalOpenUserOdeFiles .local-ode-file-upload-input')
        );
        $input->setFileDetector(new LocalFileDetector());
        $path = realpath(__DIR__ . '/../../Fixtures/basic-example.elp');
        $this->assertTrue(is_string($path) && file_exists($path), 'Fixture .elp file must exist');
        $input->sendKeys($path);

        // Do NOT click the modal "Open" button here.
        // Uploading a local .elp triggers the app to open it automatically
        // via modalOpenUserOdeFiles.largeFilesUpload() -> openLocalElpFile() -> project.openLoad(),
        // which closes the modal itself. Just wait for the modal and loading screen to finish.
        try { $client->waitForInvisibility('#modalOpenUserOdeFiles', 30); } catch (\Throwable) {}
        try { $client->waitForInvisibility('#load-screen-main', 50); } catch (\Throwable) {}

        // Wait for the modal to close and for nodes to appear
        // The project reload shows the loading screen; wait for it to hide before asserting DOM
        try { $client->waitForInvisibility('#load-screen-main', 30); } catch (\Throwable) {}
        $client->waitFor('.nav-element', 15);

        // Basic assertions: the nav tree has nodes and we remain in workarea
        $this->assertStringContainsString('/workarea', $client->getCurrentURL());
        $count = count($client->getWebDriver()->findElements(WebDriverBy::cssSelector('.nav-element')));
        $this->assertGreaterThan(1, $count, 'Navigation tree should contain nodes after opening .elp');

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);
    }
}
