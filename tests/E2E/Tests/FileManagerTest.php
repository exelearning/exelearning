<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Factory\DocumentFactory;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\Remote\LocalFileDetector;
use App\Tests\E2E\Support\Console;

final class FileManagerTest extends BaseE2ETestCase
{   
    public function test_open_file_manager_modal(): void
    {
        $client = $this->openWorkareaInNewBrowser('A');
        DocumentFactory::open($client);

        // Open Utilities -> File Manager
        $client->waitForVisibility('#dropdownUtilities', 10);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownUtilities'))->click();
        $client->waitForVisibility('#navbar-button-filemanager', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-filemanager'))->click();

        // Wait for modal to be visible
        $client->waitForVisibility('#modalFileManager', 20);
        $this->assertSelectorIsVisible('#modalFileManager');

        // Assert iframe presence and its src
        $client->waitFor('#filemanageriframe', 10);
        $this->assertSelectorAttributeContains('#filemanageriframe', 'src', '/filemanager/index/');

        // Close modal without JS: click on the close button and wait for invisibility
        $client->waitForVisibility('#modalFileManager .close', 5);
        $client->getWebDriver()
            ->findElement(WebDriverBy::cssSelector('#modalFileManager .close'))
            ->click();
        $client->waitForInvisibility('#modalFileManager.show', 10);


        // Check browser console for errors
        Console::assertNoBrowserErrors($client);
    }

    public function test_try_upload_file_in_filemanager(): void
    {
        $client = $this->openWorkareaInNewBrowser('B');
        DocumentFactory::open($client);

        // Open Utilities -> File Manager
        $client->waitForVisibility('#dropdownUtilities', 10);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownUtilities'))->click();
        $client->waitForVisibility('#navbar-button-filemanager', 5);
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-filemanager'))->click();

        // Wait for modal to be visible
        $client->waitForVisibility('#modalFileManager', 20);
        $this->assertSelectorIsVisible('#modalFileManager');

        // Assert iframe presence and its src
        $client->waitFor('#filemanageriframe', 10);
        $this->assertSelectorAttributeContains('#filemanageriframe', 'src', '/filemanager/index/');

        // Switch to the file manager iframe
        $iframe = $client->getWebDriver()->findElement(WebDriverBy::cssSelector('#filemanageriframe'));
        $client->getWebDriver()->switchTo()->frame($iframe);

        // Wait for upload input field to be available inside the iframe
        $client->waitFor('input[type="file"]', 15);
        $inputs = $client->getWebDriver()->findElements(WebDriverBy::cssSelector('input[type="file"]'));

        // Assert that at least one input[type=file] exists
        $this->assertNotEmpty(
            $inputs,
            'Expected a file input element in the File Manager iframe, but none was found.'
        );

        // Prepare temporary file and send it to the input
        $input = $inputs[0];
        $input->setFileDetector(new LocalFileDetector());

        $tmpFile = sys_get_temp_dir() . '/e2e-upload-' . uniqid('', true) . '.txt';
        file_put_contents($tmpFile, 'Hello from E2E at ' . date('c'));
        $input->sendKeys($tmpFile);

        // Wait until the uploaded filename is visible inside the iframe
        $filename = basename($tmpFile);
        $client->waitForElementToContain('body', $filename, 15);

        // Confirm the upload was detected
        // Heuristic: check the uploaded file name appears somewhere in the listing (inside the iframe)
        $this->assertTrue(
            (bool) $client->executeScript(
                'const name = arguments[0]; return document.body && document.body.textContent.includes(name);',
                // 'const name = arguments[0]; return document.body && document.body.textContent && document.body.textContent.indexOf(name) !== -1;',
                [$filename]
            ),
            sprintf('The uploaded file "%s" was not found in the File Manager listing.', $filename)
        );

        // Switch back to the main document
        $client->getWebDriver()->switchTo()->defaultContent();


        // Close the modal and wait for invisibility
        $client->waitForVisibility('#modalFileManager .close', 5);
        $client->getWebDriver()
            ->findElement(WebDriverBy::cssSelector('#modalFileManager .close'))
            ->click();
        $client->waitForInvisibility('#modalFileManager.show', 10);

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);        
    }
}
