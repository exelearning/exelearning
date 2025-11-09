<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\Support\Console;
use Facebook\WebDriver\Remote\LocalFileDetector;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverExpectedCondition;

/**
 * E2E test to verify that projects open in the current window
 * instead of a new tab/window.
 *
 * This test verifies:
 * 1. When opening a project with unsaved changes, a save dialog appears
 * 2. After clicking "Don't save", the project opens in the same window
 * 3. No new browser tab/window is created
 * 4. No infinite loop occurs
 */
final class OpenProjectInCurrentWindowTest extends BaseE2ETestCase
{
    public function test_open_project_shows_save_dialog_and_opens_in_current_window(): void
    {
        $client = $this->openWorkareaInNewBrowser('A');
        DocumentFactory::open($client);

        // Open first project
        $this->openElpFile($client, 'basic-example.elp');

        // Wait for project to load
        $client->waitForInvisibility('#load-screen-main', 30);
        $client->waitFor('.nav-element', 15);

        // Make a change to the project (edit title to trigger unsaved changes)
        $this->makeUnsavedChanges($client);

        // Count open window handles before opening another project
        $initialHandles = $client->getWebDriver()->getWindowHandles();
        $initialHandleCount = count($initialHandles);

        // Try to open another project
        $client->waitForVisibility('#dropdownFile', 10);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-openuserodefiles'))->click();
        $client->waitForVisibility('#modalOpenUserOdeFiles', 10);

        // Upload the second file
        $input = $client->getWebDriver()->findElement(
            WebDriverBy::cssSelector('#modalOpenUserOdeFiles .local-ode-file-upload-input')
        );
        $input->setFileDetector(new LocalFileDetector());
        $secondPath = realpath(__DIR__ . '/../../Fixtures/tema-10-ejemplo.elp');
        $this->assertTrue(is_string($secondPath) && file_exists($secondPath), 'Second fixture must exist');
        $input->sendKeys($secondPath);

        // Wait for the save dialog to appear
        try {
            $client->waitForVisibility('#modalSessionLogout', 20);
            $saveDialogAppeared = true;
        } catch (\Throwable $e) {
            $saveDialogAppeared = false;
        }

        $this->assertTrue($saveDialogAppeared, 'Save dialog should appear when there are unsaved changes');

        // Click "Don't save" button
        $notSaveButton = $client->getWebDriver()->findElement(
            WebDriverBy::cssSelector('#modalSessionLogout .btn-dont-save, #modalSessionLogout .not-save-session-button')
        );
        $notSaveButton->click();

        // Wait for dialogs to close and new project to load
        try { $client->waitForInvisibility('#modalSessionLogout', 10); } catch (\Throwable) {}
        try { $client->waitForInvisibility('#modalOpenUserOdeFiles', 10); } catch (\Throwable) {}
        try { $client->waitForInvisibility('#load-screen-main', 30); } catch (\Throwable) {}

        // Wait for the new project to load
        $client->waitFor('.nav-element', 15);

        // Verify NO new window/tab was created
        $finalHandles = $client->getWebDriver()->getWindowHandles();
        $finalHandleCount = count($finalHandles);

        $this->assertSame(
            $initialHandleCount,
            $finalHandleCount,
            'No new browser tab/window should be created. Project should open in current window.'
        );

        // Verify we're still in the workarea URL (not a new tab)
        $this->assertStringContainsString('/workarea', $client->getCurrentURL());

        // Verify the new project loaded (basic check: nav elements present)
        $count = count($client->getWebDriver()->findElements(WebDriverBy::cssSelector('.nav-element')));
        $this->assertGreaterThan(0, $count, 'New project should have navigation elements');

        // Check browser console for errors (no infinite loop warnings)
        Console::assertNoBrowserErrors($client);
    }

    public function test_new_project_opens_in_current_window(): void
    {
        $client = $this->openWorkareaInNewBrowser('B');
        DocumentFactory::open($client);

        // Open first project
        $this->openElpFile($client, 'basic-example.elp');
        $client->waitForInvisibility('#load-screen-main', 30);
        $client->waitFor('.nav-element', 15);

        // Make changes
        $this->makeUnsavedChanges($client);

        // Count window handles
        $initialHandles = $client->getWebDriver()->getWindowHandles();
        $initialHandleCount = count($initialHandles);

        // Click File -> New
        $client->waitForVisibility('#dropdownFile', 10);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-newproject'))->click();

        // Wait for save dialog
        try {
            $client->waitForVisibility('#modalSessionLogout', 20);
            $saveDialogAppeared = true;
        } catch (\Throwable) {
            $saveDialogAppeared = false;
        }

        $this->assertTrue($saveDialogAppeared, 'Save dialog should appear before creating new project');

        // Click "Don't save"
        $notSaveButton = $client->getWebDriver()->findElement(
            WebDriverBy::cssSelector('#modalSessionLogout .btn-dont-save, #modalSessionLogout .not-save-session-button')
        );
        $notSaveButton->click();

        // Wait for new project to load
        try { $client->waitForInvisibility('#modalSessionLogout', 10); } catch (\Throwable) {}
        try { $client->waitForInvisibility('#load-screen-main', 30); } catch (\Throwable) {}

        // Verify NO new window was created
        $finalHandles = $client->getWebDriver()->getWindowHandles();
        $finalHandleCount = count($finalHandles);

        $this->assertSame(
            $initialHandleCount,
            $finalHandleCount,
            'New project should open in current window, not in a new tab'
        );

        // Verify we're in workarea
        $this->assertStringContainsString('/workarea', $client->getCurrentURL());

        Console::assertNoBrowserErrors($client);
    }

    public function test_open_project_without_changes_does_not_show_dialog(): void
    {
        $client = $this->openWorkareaInNewBrowser('C');
        DocumentFactory::open($client);

        // Open first project
        $this->openElpFile($client, 'basic-example.elp');
        $client->waitForInvisibility('#load-screen-main', 30);
        $client->waitFor('.nav-element', 15);

        // DO NOT make changes - open another project directly
        $client->waitForVisibility('#dropdownFile', 10);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-openuserodefiles'))->click();
        $client->waitForVisibility('#modalOpenUserOdeFiles', 10);

        // Upload second file
        $input = $client->getWebDriver()->findElement(
            WebDriverBy::cssSelector('#modalOpenUserOdeFiles .local-ode-file-upload-input')
        );
        $input->setFileDetector(new LocalFileDetector());
        $secondPath = realpath(__DIR__ . '/../../Fixtures/tema-10-ejemplo.elp');
        $input->sendKeys($secondPath);

        // Save dialog should NOT appear (no unsaved changes)
        $client->wait(2); // Brief wait to ensure dialog doesn't appear

        $elements = $client->getWebDriver()->findElements(WebDriverBy::id('modalSessionLogout'));
        $saveDialogVisible = false;
        foreach ($elements as $el) {
            if ($el->isDisplayed()) {
                $saveDialogVisible = true;
                break;
            }
        }

        $this->assertFalse($saveDialogVisible, 'Save dialog should NOT appear when there are no changes');

        // Project should load directly
        try { $client->waitForInvisibility('#modalOpenUserOdeFiles', 10); } catch (\Throwable) {}
        try { $client->waitForInvisibility('#load-screen-main', 30); } catch (\Throwable) {}

        // Verify project loaded
        $this->assertStringContainsString('/workarea', $client->getCurrentURL());
        Console::assertNoBrowserErrors($client);
    }

    /**
     * Helper method to open an ELP file via the File menu.
     */
    private function openElpFile(\Symfony\Component\Panther\Client $client, string $filename): void
    {
        $client->waitForVisibility('#dropdownFile', 20);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-openuserodefiles'))->click();
        $client->waitForVisibility('#modalOpenUserOdeFiles', 20);

        $input = $client->getWebDriver()->findElement(
            WebDriverBy::cssSelector('#modalOpenUserOdeFiles .local-ode-file-upload-input')
        );
        $input->setFileDetector(new LocalFileDetector());
        $path = realpath(__DIR__ . '/../../Fixtures/' . $filename);
        $this->assertTrue(is_string($path) && file_exists($path), "Fixture $filename must exist");
        $input->sendKeys($path);

        // Wait for file to upload and modal to close
        try { $client->waitForInvisibility('#modalOpenUserOdeFiles', 30); } catch (\Throwable) {}
    }

    /**
     * Helper method to make unsaved changes to the project.
     * This edits the project title to trigger the "unsaved changes" state.
     */
    private function makeUnsavedChanges(\Symfony\Component\Panther\Client $client): void
    {
        try {
            // Open properties/settings to edit title
            $client->waitForVisibility('#dropdownProperties', 10);
            $client->getWebDriver()->findElement(WebDriverBy::id('dropdownProperties'))->click();
            $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-properties'))->click();
            $client->waitForVisibility('#modalProperties', 10);

            // Edit title field
            $titleInput = $client->getWebDriver()->findElement(
                WebDriverBy::cssSelector('#modalProperties input[name="pp_title"]')
            );
            $titleInput->clear();
            $titleInput->sendKeys('Modified Title ' . uniqid());

            // Close modal (this should trigger unsaved changes)
            $closeButton = $client->getWebDriver()->findElement(
                WebDriverBy::cssSelector('#modalProperties .btn-close, #modalProperties .modal-header button[data-bs-dismiss="modal"]')
            );
            $closeButton->click();

            try { $client->waitForInvisibility('#modalProperties', 5); } catch (\Throwable) {}
        } catch (\Throwable $e) {
            // If properties modal approach fails, try a simpler approach:
            // Just execute JS to mark the project as having changes
            $client->executeScript('
                if (window.eXeLearning && window.eXeLearning.app && window.eXeLearning.app.project) {
                    window.eXeLearning.app.project.hasChanges = true;
                }
            ');
        }
    }
}
