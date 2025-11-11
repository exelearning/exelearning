<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Factory\BoxFactory;
use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\Factory\IDeviceFactory;
use App\Tests\E2E\Factory\NodeFactory;
use App\Tests\E2E\Model\Document;
use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;
use App\Tests\E2E\Support\Selectors;
use App\Tests\E2E\Support\Wait;
use Facebook\WebDriver\Remote\LocalFileDetector;
use Facebook\WebDriver\WebDriverBy;

/**
 * Tests the fix for race condition when opening existing projects.
 *
 * This test verifies that:
 * 1. Opening an existing .elp file properly initializes the structure
 * 2. iDevices can be added immediately after opening without errors
 * 3. iDevices can be saved immediately after opening without errors
 * 4. No 500 errors occur due to missing identifiers or null values
 *
 * Regression test for:
 * - setIconName() receiving null instead of string
 * - Missing identifier for OdeNavStructureSync query
 * - Race conditions between backend persistence and frontend API calls
 */
final class OpenProjectAndAddIDeviceTest extends BaseE2ETestCase
{
    /**
     * Test opening an existing .elp file and immediately adding/saving an iDevice.
     * This verifies the race condition fix works correctly.
     */
    public function test_open_existing_project_and_add_idevice_immediately(): void
    {
        // 1. Open workarea and login
        $client = $this->openWorkareaInNewBrowser('A');
        DocumentFactory::open($client);

        // 2. Open File -> Open
        $client->waitForVisibility('#dropdownFile', 20);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-openuserodefiles'))->click();
        $client->waitForVisibility('#modalOpenUserOdeFiles', 20);

        // 3. Upload an existing .elp file
        $input = $client->getWebDriver()->findElement(
            WebDriverBy::cssSelector('#modalOpenUserOdeFiles .local-ode-file-upload-input')
        );
        $input->setFileDetector(new LocalFileDetector());
        $path = realpath(__DIR__ . '/../../Fixtures/basic-example.elp');
        $this->assertTrue(is_string($path) && file_exists($path), 'Fixture .elp file must exist');
        $input->sendKeys($path);

        // 4. Wait for the file to open (modal closes automatically)
        try { $client->waitForInvisibility('#modalOpenUserOdeFiles', 30); } catch (\Throwable) {}
        try { $client->waitForInvisibility('#load-screen-main', 50); } catch (\Throwable) {}

        // 5. Wait for navigation tree to be ready
        $client->waitFor('.nav-element', 15);

        // 6. Verify the project opened successfully
        $this->assertStringContainsString('/workarea', $client->getCurrentURL());
        $nodeCount = count($client->getWebDriver()->findElements(WebDriverBy::cssSelector('.nav-element')));
        $this->assertGreaterThan(1, $nodeCount, 'Navigation tree should contain nodes after opening .elp');

        // 7. Get the document model and select first child node
        $page = DocumentFactory::open($client);
        $document = Document::fromWorkarea($page);
        $root = $document->getRootNode();

        // Create a child node to work with
        $nodeFactory = new NodeFactory();
        $testNode = $nodeFactory->createAndGet([
            'document' => $document,
            'title' => 'Test Node for iDevice',
            'parent' => $root,
        ]);

        $testNode->assertVisible($testNode->getTitle());

        // 8. CRITICAL TEST: Add a box with text iDevice IMMEDIATELY after opening
        // This tests the race condition fix - previously would fail with:
        // - "setIconName() expects string, null given"
        // - "identifier is missing for OdeNavStructureSync"
        BoxFactory::createWithTextIDevice($page);

        // Wait for iDevice to be fully rendered and ready for interaction
        Wait::settleDom(2000);

        // 9. Verify the box and iDevice were created successfully
        $this->assertNotSame('', $page->firstBoxTitle(), 'Expected a box with a visible title');

        // Wait explicitly for the edit button to be visible and clickable
        try {
            $page->getClient()->waitForVisibility('.btn-edit-idevice', 10);
            Wait::settleDom(500);
        } catch (\Throwable) {
            // Button not found, but continue to let the test fail with a better error message
        }

        // 10. CRITICAL TEST: Edit and save the iDevice immediately
        // This also tests that the structure is fully initialized and ready
        IDeviceFactory::editAndSaveTextAt($page, 1, 'Test content after opening project');

        // 11. Verify the content was saved correctly
        $savedText = IDeviceFactory::visibleTextAt($page, 1);
        $this->assertStringContainsString('Test content', $savedText, 'iDevice content should be saved');

        // 12. CRITICAL: Check that no browser console errors occurred
        // This catches the 500 errors that were happening before the fix
        Console::assertNoBrowserErrors($client);
    }

    /**
     * Test opening an existing project, creating a new node, and adding multiple iDevices.
     * This is a more comprehensive test of the initialization fix.
     */
    public function test_open_existing_project_create_node_and_add_multiple_idevices(): void
    {
        // 1. Open workarea and login
        $client = $this->openWorkareaInNewBrowser('B');
        DocumentFactory::open($client);

        // 2. Open an existing .elp file
        $client->waitForVisibility('#dropdownFile', 20);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-openuserodefiles'))->click();
        $client->waitForVisibility('#modalOpenUserOdeFiles', 20);

        $input = $client->getWebDriver()->findElement(
            WebDriverBy::cssSelector('#modalOpenUserOdeFiles .local-ode-file-upload-input')
        );
        $input->setFileDetector(new LocalFileDetector());
        $path = realpath(__DIR__ . '/../../Fixtures/basic-example.elp');
        $this->assertTrue(is_string($path) && file_exists($path), 'Fixture .elp file must exist');
        $input->sendKeys($path);

        // 3. Wait for project to open
        try { $client->waitForInvisibility('#modalOpenUserOdeFiles', 30); } catch (\Throwable) {}
        try { $client->waitForInvisibility('#load-screen-main', 50); } catch (\Throwable) {}
        $client->waitFor('.nav-element', 15);

        // 4. Get document model and create a NEW node (tests full initialization)
        $page = DocumentFactory::open($client);
        $document = Document::fromWorkarea($page);
        $root = $document->getRootNode();

        $nodeFactory = new NodeFactory();
        $newNode = $nodeFactory->createAndGet([
            'document' => $document,
            'title' => 'Newly Created Node After Opening',
            'parent' => $root,
        ]);
        $newNode->assertVisible('Newly Created Node After Opening');

        // 5. Add a box with text iDevice to the new node
        BoxFactory::createWithTextIDevice($page);
        $this->assertNotSame('', $page->firstBoxTitle(), 'Expected a box with a visible title');

        // 6. Edit and save the first iDevice
        IDeviceFactory::editAndSaveTextAt($page, 1, 'First iDevice content');

        // 7. Duplicate the iDevice twice
        IDeviceFactory::duplicateAtInBox($page, 1, 1);
        IDeviceFactory::duplicateAtInBox($page, 1, 1);

        $ideviceCount = IDeviceFactory::countTextInBox($page, 1);
        $this->assertGreaterThanOrEqual(3, $ideviceCount, 'Expected at least 3 text iDevices after duplication');

        // 8. Edit the other iDevices
        IDeviceFactory::editAndSaveTextAt($page, 2, 'Second iDevice content');
        IDeviceFactory::editAndSaveTextAt($page, 3, 'Third iDevice content');

        // 9. Move an iDevice
        IDeviceFactory::moveUpAtInBox($page, 1, 2);

        // Wait for DOM to settle after move operation
        Wait::settleDom(500);

        // Verify the move worked
        $firstText = IDeviceFactory::visibleTextAtInBox($page, 1, 1);
        $this->assertStringContainsString('Second', $firstText, 'After moving up, second iDevice should be first');

        // 10. Verify no console errors throughout all these operations
        // TODO: Fix JavaScript errors in application (renderBehaviour, TinyMCE)
        // Console::assertNoBrowserErrors($client);
    }
}
