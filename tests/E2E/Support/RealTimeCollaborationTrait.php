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
     * Retrieves the session share URL from the given client's browser context.
     * This URL allows a second client to join the same workarea session.
     */
    protected function getMainShareUrl(Client $client): string
    {
        // Wait for the share button to be available, ensuring the UI is ready.
        $client->waitForVisibility('#head-top-share-button');

        $apiUrl = '/api/current-ode-users-management/current-ode-user/get/ode/session/id/current/ode/user';

        // Execute an AJAX request from the browser to get the share URL.
        // This is more stable than trying to parse it from the page content.
        $shareSessionUrl = $client->executeScript(<<<JS
            return (async () => {
                const response = await fetch('{$apiUrl}');
                if (!response.ok) { return ''; }
                const data = await response.json();
                return data.shareSessionUrl || '';
            })();
        JS);

        if (!$shareSessionUrl || !is_string($shareSessionUrl)) {
            return '';
        }

        return htmlspecialchars_decode($shareSessionUrl);
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
