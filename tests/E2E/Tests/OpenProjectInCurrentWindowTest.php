<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\Factory\NodeFactory;
use App\Tests\E2E\Model\Document;
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
        $this->waitForLoadingScreenToHide($client);
        $client->waitFor('.nav-element', 15);

        // Make a change to the project (edit title to trigger unsaved changes)
        $this->makeUnsavedChanges($client);

        // Count open window handles before opening another project
        $initialHandles = $client->getWebDriver()->getWindowHandles();
        $initialHandleCount = count($initialHandles);

        // Try to open another project
        // Ensure loading screen is gone before trying to interact
        $this->waitForLoadingScreenToHide($client);
        $this->closeAnyOpenModals($client);
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
            WebDriverBy::cssSelector('[data-testid="session-logout-without-save-btn"]')
        );
        $notSaveButton->click();

        // Wait for dialogs to close and new project to load
        try { $client->waitForInvisibility('#modalSessionLogout', 10); } catch (\Throwable) {}
        try { $client->waitForInvisibility('#modalOpenUserOdeFiles', 10); } catch (\Throwable) {}
        $this->waitForLoadingScreenToHide($client);

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
        $this->waitForLoadingScreenToHide($client);
        $client->waitFor('.nav-element', 15);

        // Make changes
        $this->makeUnsavedChanges($client);

        // Count window handles
        $initialHandles = $client->getWebDriver()->getWindowHandles();
        $initialHandleCount = count($initialHandles);

        // Click File -> New
        // Ensure loading screen is gone before trying to interact
        $this->waitForLoadingScreenToHide($client);
        $this->closeAnyOpenModals($client);
        $client->waitForVisibility('#dropdownFile', 10);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->wait(0.5); // Wait for menu animation
        $client->waitForVisibility('#navbar-button-new', 10);
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-new'))->click();

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
            WebDriverBy::cssSelector('[data-testid="session-logout-without-save-btn"]')
        );
        $notSaveButton->click();

        // Wait for new project to load
        try { $client->waitForInvisibility('#modalSessionLogout', 10); } catch (\Throwable) {}
        $this->waitForLoadingScreenToHide($client);

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
        $this->waitForLoadingScreenToHide($client);
        $client->waitFor('.nav-element', 15);

        // DO NOT make changes - open another project directly
        // Ensure loading screen is gone before trying to interact
        $this->waitForLoadingScreenToHide($client);
        $this->closeAnyOpenModals($client);
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
        $this->waitForLoadingScreenToHide($client);

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

        // Wait for upload progress modal to complete
        $this->waitForUploadProgressModalToHide($client);

        // After uploading, the session logout modal may appear if there's an existing session
        // Check for it and dismiss it if present
        try {
            $client->waitForVisibility('#modalSessionLogout', 3);
            // Modal appeared, click "Open without saving"
            $dismissButton = $client->getWebDriver()->findElement(
                WebDriverBy::cssSelector('[data-testid="session-logout-without-save-btn"]')
            );
            $dismissButton->click();
            $client->waitForInvisibility('#modalSessionLogout', 5);
        } catch (\Throwable) {
            // Modal didn't appear, continue normally
        }

        // Wait for file to upload and modal to close
        try { $client->waitForInvisibility('#modalOpenUserOdeFiles', 30); } catch (\Throwable) {}

        // Wait for loading screen to fully disappear before returning
        $this->waitForLoadingScreenToHide($client);
    }

    /**
     * Helper method to make unsaved changes to the project.
     * Creates a new node which registers a real change in the database.
     */
    private function makeUnsavedChanges(\Symfony\Component\Panther\Client $client): void
    {
        // Close any open modals first
        $this->closeAnyOpenModals($client);

        // Get document model
        $page = DocumentFactory::open($client);
        $document = Document::fromWorkarea($page);
        $root = $document->getRootNode();

        // Create a new node - this creates a real entry in OdeNavStructureSync
        // with a timestamp that will be detected as an unsaved change
        $nodeFactory = new NodeFactory();
        $node = $nodeFactory->createAndGet([
            'document' => $document,
            'title' => 'Unsaved Change Node ' . uniqid(),
            'parent' => $root,
        ]);

        // Wait for change to be synced to database and visible in UI
        $client->wait(2);

        // Verify the node is visible in the tree
        try {
            $client->waitFor('.nav-element', 5);
        } catch (\Throwable) {
            // Node may already exist, continue
        }
    }

    /**
     * Helper method to dismiss any pre-existing session logout modal.
     * This modal may appear on initial load if there's a previous session.
     */
    private function dismissSessionLogoutModal(\Symfony\Component\Panther\Client $client): void
    {
        try {
            // Check if the modal is visible
            $client->waitForVisibility('#modalSessionLogout', 2);

            // Click the "Open without saving" button
            $dismissButton = $client->getWebDriver()->findElement(
                WebDriverBy::cssSelector('[data-testid="session-logout-without-save-btn"]')
            );
            $dismissButton->click();

            // Wait for modal to close
            $client->waitForInvisibility('#modalSessionLogout', 5);
        } catch (\Throwable) {
            // Modal not present, continue normally
        }
    }

    /**
     * Helper method to wait for the upload progress modal to hide.
     * This modal appears when uploading .elp files and shows "Processing file...".
     * We need to wait for it to complete before continuing.
     */
    private function waitForUploadProgressModalToHide(\Symfony\Component\Panther\Client $client, int $timeout = 30): void
    {
        try {
            // Wait for the modal to appear (it may appear very briefly)
            $client->waitForVisibility('#uploadProgressModal', 2);
            // Wait for the modal to disappear
            $client->waitForInvisibility('#uploadProgressModal', $timeout);
        } catch (\Throwable) {
            // Modal didn't appear or already disappeared - this is fine
            // The upload may have been so fast that we missed it
        }
    }

    /**
     * Helper method to close any open blocking modals.
     * This is useful before critical operations to ensure no modals are blocking interaction.
     */
    private function closeAnyOpenModals(\Symfony\Component\Panther\Client $client): void
    {
        // Check for "You are editing an iDevice" alert modal
        try {
            $alertModal = $client->getWebDriver()->findElement(WebDriverBy::cssSelector('#alert-modal'));
            if ($alertModal->isDisplayed()) {
                // Try to click the OK/Close button
                $okButton = $client->getWebDriver()->findElement(
                    WebDriverBy::cssSelector('#alert-modal .btn-primary, #alert-modal [data-dismiss="modal"]')
                );
                if ($okButton->isDisplayed()) {
                    $okButton->click();
                    $client->wait(0.5);
                }
            }
        } catch (\Throwable) {
            // No alert modal found or already closed
        }

        // Check for any open iDevice editor and try to close it properly
        try {
            $ideviceEditor = $client->getWebDriver()->findElement(WebDriverBy::cssSelector('.idevice-edition-modal.show, .idevice-editor.open'));
            if ($ideviceEditor->isDisplayed()) {
                // Look for save button first
                try {
                    $saveButton = $client->getWebDriver()->findElement(
                        WebDriverBy::cssSelector('.idevice-save-button, [data-action="save-idevice"]')
                    );
                    if ($saveButton->isDisplayed()) {
                        $saveButton->click();
                        $client->wait(1); // Wait for save to complete
                    }
                } catch (\Throwable) {
                    // No save button, try close button
                    try {
                        $closeButton = $client->getWebDriver()->findElement(
                            WebDriverBy::cssSelector('.idevice-close-button, [data-dismiss="modal"]')
                        );
                        if ($closeButton->isDisplayed()) {
                            $closeButton->click();
                            $client->wait(0.5);
                        }
                    } catch (\Throwable) {
                        // Could not close iDevice editor
                    }
                }
            }
        } catch (\Throwable) {
            // No iDevice editor open
        }

        // Wait a bit to ensure any closing animations complete
        $client->wait(0.5);
    }

    /**
     * Helper method to wait for loading screen to be fully hidden.
     * Uses explicit data-visible attribute check for more reliable detection.
     */
    private function waitForLoadingScreenToHide(\Symfony\Component\Panther\Client $client, int $timeout = 30): void
    {
        try {
            // Wait for data-visible="false" attribute
            $client->getWebDriver()->wait($timeout, 500)->until(
                WebDriverExpectedCondition::attributeContains(
                    WebDriverBy::id('load-screen-main'),
                    'data-visible',
                    'false'
                )
            );

            // Additional wait for CSS animations to complete
            $client->wait(1);
        } catch (\Throwable) {
            // Fallback: try traditional invisibility check
            try {
                $client->waitForInvisibility('#load-screen-main', 5);
            } catch (\Throwable) {
                // Loading screen may already be hidden
            }
        }
    }
}
