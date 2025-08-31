<?php

declare(strict_types=1);

namespace App\Tests\E2E\RealTime;

use App\Tests\E2E\ExelearningE2EBase;
use Symfony\Component\Panther\Client;
use Symfony\Component\Panther\PantherTestCase;
use Facebook\WebDriver\WebDriverBy;

/**
 * Base class for real-time (Mercure/WebSocket/etc.) end-to-end tests.
 * It provides two separate browser sessions: "main" and "secondary".
 */
abstract class ExelearningRealTimeE2EBase extends ExelearningE2EBase
{
    protected ?Client $secondaryClient  = null;

    /**
     * Creates two logged-in browser clients, each possibly with distinct credentials.
     *
     * @return void
     */
    protected function createRealTimeClients(): void
    {
        // 1) Main client, default user
        $this->mainClient = $this->login(); // uses $this->createTestClient()

        // 2) Create and log in the secondary client
        //    This is an *isolated* browser that can interact with the main client in real time.
        $this->secondaryClient = static::createAdditionalPantherClient();

        // By default createAdditionalPantherClient() reuses the same "base URI" as the first.
        // If needed, confirm you have the same environment or you can override the trait code.
        $this->login($this->secondaryClient);
    }

    /**
     * Example method to retrieve a share URL from the main client.
     * 
     * The mainClient is returning a web page with the content <html>
     * <head><meta name="color-scheme" content="light dark"><meta cha
     * rset="utf-8"></head><body><pre>{"shareSessionUrl":"http:\/\/ex
     * elearning-web:8080\/workarea?shareCode=xxxxxxx"}</pre><div cla
     * ss="json-formatter-container"></div></body></html>
     * thats why we are parsing it and extracting from PRE, we can do
     * this better in the future.
     *
     * @return string
     */
    protected function getMainShareUrl(): string
    {
        if (null === $this->mainClient) {
            return '';
        }

        $this->mainClient->waitForVisibility('#head-top-share-button');

        $apiUrl = '/api/current-ode-users-management/current-ode-user/get/ode/session/id/current/ode/user';

        // Execute this request by means of AJAX to avoid (in some cases)
        // `\Facebook\WebDriver\Exception\UnexpectedAlertOpenException`
        $shareSessionUrl = $this->mainClient->executeScript("return (async () => { const response = await fetch('$apiUrl'); if (!response.ok) { return ''; } const data = await response.json(); return data.shareSessionUrl ? data.shareSessionUrl : ''; })();");

        if (!$shareSessionUrl) {
            return '';
        }

        return htmlspecialchars_decode($shareSessionUrl);
    }


    /**
     * Helper method to assert the existence of a selector in a given client.
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


    /**
     * Helper method to assert the existence of a selector in a given client.
     */
    protected function assertSelectorTextContainsIn(Client $client, string $selector, string $message = ''): void
    {
        // Wait for the selector to be present in the DOM
        $crawler = $client->waitFor($selector);

        // Get the text of the selected element
        $elementText = $crawler->filter($selector)->text();

        // Verify that the element's text contains the expected message
        $this->assertStringContainsString($message, $elementText, sprintf(
            'Failed asserting that selector "%s" contains the text "%s".',
            $selector,
            $message
        ));
    }

    /**
     * Called automatically when a test fails or throws an exception.
     */
    protected function onNotSuccessfulTest(\Throwable $t): never
    {
        if ($this->secondaryClient instanceof Client) {
            try {
                $this->captureAllWindowsScreenshots($this->secondaryClient, 'secondary_fail');
            } catch (\Throwable $e) {
                // Avoid masking the original error if screenshot fails
                fwrite(STDERR, "[Screenshot failed]: " . $e->getMessage() . "\n");
            }
        }

        // Re-throw so PHPUnit marks the test as failed
        parent::onNotSuccessfulTest($t);
    }


}
