<?php
declare(strict_types=1);

namespace App\Tests\E2E;

use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverExpectedCondition;

use Symfony\Component\Panther\PantherTestCase;

/**
 * End-to-end test for preview functionality and new window validation.
 */
class NewFileEmptyPreviewTest extends ExelearningE2EBase
{
    /**
     * Tests the preview functionality and new window validation.
     */
    public function testNewFileEmptyPreview(): void
    {
    	// Call the base class login method that gets the PantherClient object
        $client = $this->login();

        // Wait for the interface to fully load
        $client->waitForInvisibility('#load-screen-main');

        // Close any confirmation modals
        $this->closeConfirmationModals($client);

        // Click the preview button
        $client->getCrawler()->filter('#head-bottom-preview')->click();

        // Get the original window handle
        $originalWindowHandle = $client->getWindowHandle();

        // Wait for the new preview window to open
        $client->wait()->until(
            WebDriverExpectedCondition::numberOfWindowsToBe(2),
            'Additional Preview window not detected'
        );

        // Switch to the new window
        $windowHandles = $client->getWindowHandles();
        $client->switchTo()->window(end($windowHandles));

        // Validate the preview URL format
        // $this->assertMatchesRegularExpression(
        //     '/\/files\/tmp\/\d{4}\/\d{2}\/\d{2}\/[a-zA-Z0-9]+\/tmp\/user\/export\/index\.html$/',
        //     $client->getCurrentURL(),
        //     'The preview URL does not match the expected pattern'
        // );

        $this->assertMatchesRegularExpression(
            sprintf(
                '/\/files\/tmp\/\d{4}\/\d{2}\/\d{2}\/[a-zA-Z0-9]+\/tmp\/%s\/export\/index\.html$/',
                preg_quote($this->currentUserId, '/')
            ),
            $client->getCurrentURL(),
            'The preview URL does not match the expected pattern'
        );

        // Validate the <title> of the preview page
        $client->wait()->until(
            WebDriverExpectedCondition::titleIs('Untitled document'),
            'Please check the page title'
        );
        
        // Validate the <title> of the preview page
        $this->assertEquals(
            'Untitled document',
            $client->getTitle(),
            'Please check the page title'
        );

        // Validate the generator meta tag starts with "eXeLearning"
        $generatorMeta = $client->executeScript("
            return document.querySelector('meta[name=\"generator\"]').getAttribute('content');
        ");
        $this->assertStringStartsWith('eXeLearning', $generatorMeta, 'The generator meta tag does not start with "eXeLearning"');

        // Close the new window and return to the original window
        $client->close();
        $client->switchTo()->window($originalWindowHandle);
    }

    /**
     * Closes the confirmation modal if present.
     */
    private function closeConfirmationModals($client): void
    {
        try {
            $client->executeScript("
                let modal = document.querySelector('.modal-confirm .cancel.btn.btn-secondary');
                if (modal) modal.click();
            ");            
            // Wait for the confirmation modal backdrop to disappear
            $client->waitForInvisibility('.modal-backdrop');
            sleep(1);
        } catch (\Exception $e) {
            // Ignore errors if the modal is not present
        }
    }

}

