<?php
declare(strict_types=1);

namespace App\Tests\E2E;

use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverExpectedCondition;

use Symfony\Component\Panther\PantherTestCase;

/**
 * End-to-end test fot create new document
 */
class CreateNewDocumentTest extends ExelearningE2EBase
{
    /**
     * Tests the preview functionality and new window validation.
     */
    public function testCreateNewDocument(): void
    {

        sleep(3);
        // $this->markTestSkipped('disabled until we release the new test sysstem');


    	// Call the base class login method that gets the PantherClient object
        $client = $this->login();

        // Wait for the interface to fully load
        $client->waitForInvisibility('#load-screen-main');

        // Close any confirmation modals
        $this->closeConfirmationModals($client);

        $this->createNewDocument($client);

        $this->assertSelectorExists('#properties-node-content-form');

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

