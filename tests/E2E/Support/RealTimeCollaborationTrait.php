<?php
declare(strict_types=1);

namespace App\Tests\E2E\Support;

use Symfony\Component\Panther\Client;

/**
 * Provides helper methods for multi-client, real-time collaboration tests.
 *
 * Use this trait in any test class extending BaseE2ETestCase that needs
 * to manage shared sessions between multiple browsers.
 */
trait RealTimeCollaborationTrait
{
    /**
     * Retrieves the current page URL after saving the document.
     *
     * The URL returned by this method is the same as the current one,
     * but the document must be saved first to ensure that all related
     * data (such as the session or project state) has been persisted.
     * 
     * This method simulates a real user action by clicking the "Save"
     * button (#head-top-save-button) before returning the current URL.
     */
    protected function getMainShareUrl(Client $client): string
    {
        // Wait for the share button to be available, ensuring the UI is ready.
        $client->waitForVisibility('#head-top-share-button');

        // Wait until the save button is visible and clickableAdd a comment on line R59Add diff commentMarkdown input:  edit mode selected.WritePreviewAdd a suggestionHeadingBoldItalicQuoteCodeLinkUnordered listNumbered listTask listMentionReferenceSaved repliesAdd FilesPaste, drop, or click to add filesCancelCommentStart a reviewReturn to code
        $this->client->waitFor('#head-top-save-button');
        $button->click();

        // Return the full URL currently in the browser
        return (string) $this->client->getCurrentURL();
    }

    /**
     * Asserts that a given CSS selector exists in the DOM of a specific client.
     */
    protected function assertSelectorExistsIn(Client $client, string $selector, string $message = ''): void
    {
        $client->waitFor($selector);
        $this->assertGreaterThan(
            0,
            $client->getCrawler()->filter($selector)->count(),
            $message ?: sprintf('Expected selector "%s" not found for the given client.', $selector)
        );
    }
}
