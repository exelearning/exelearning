<?php
declare(strict_types=1);

namespace App\Tests\E2E\PageObject;

use App\Tests\E2E\Support\Wait;
use Facebook\WebDriver\WebDriverExpectedCondition;
use Symfony\Component\Panther\Client;
use App\Tests\E2E\PageObject\WorkareaPage;

/**
 * Represents the Preview window opened from the workarea.
 */
final class PreviewPage
{
    private Client $client;
    private string $originalHandle;
    private string $previewHandle;

    private function __construct(Client $client, string $originalHandle, string $previewHandle)
    {
        $this->client = $client;
        $this->originalHandle = $originalHandle;
        $this->previewHandle  = $previewHandle;
    }

    /**
     * Opens the preview window and returns a PreviewPage model.
     */
    public static function openFrom(Client $client, int $timeout = 10): self
    {
        // Save current handle
        $originalHandle = $client->getWindowHandle();

        // Click preview button
        $client->getCrawler()->filter('#head-bottom-preview')->click();

        // Wait for new window
        $client->wait()->until(
            WebDriverExpectedCondition::numberOfWindowsToBe(2),
            'Expected a new preview window to open'
        );

        // Identify the new handle
        $handles = $client->getWindowHandles();
        $previewHandle = end($handles);
        $client->switchTo()->window($previewHandle);

        return new self($client, $originalHandle, $previewHandle);
    }

    /**
     * Asserts that the preview page has the expected title and meta generator.
     */
    public function assertValid(string $expectedTitle = 'Untitled document', string $expectedGeneratorPrefix = 'eXeLearning'): void
    {
        // Wait for title
        $this->client->wait()->until(
            WebDriverExpectedCondition::titleIs($expectedTitle),
            'Preview title not loaded or mismatch'
        );

        // Title assert
        \PHPUnit\Framework\Assert::assertEquals(
            $expectedTitle,
            $this->client->getTitle(),
            'Preview page title mismatch'
        );

        // Generator meta tag
        $generator = $this->client->executeScript(
            "return document.querySelector('meta[name=\"generator\"]')?.getAttribute('content');"
        );
        \PHPUnit\Framework\Assert::assertStringStartsWith(
            $expectedGeneratorPrefix,
            (string)$generator,
            'Generator meta tag must start with ' . $expectedGeneratorPrefix
        );
    }

    /**
     * Asserts that the preview URL matches the expected pattern.
     */
    public function assertUrlMatches(string $userId): void
    {
        $pattern = sprintf(
            '/\/files\/tmp\/\d{4}\/\d{2}\/\d{2}\/[A-Za-z0-9]+\/tmp\/%s\/export\/[A-Za-z0-9]+\/index\.html$/',
            preg_quote($userId, '/')
        );

        \PHPUnit\Framework\Assert::assertMatchesRegularExpression(
            $pattern,
            $this->client->getCurrentURL(),
            'Preview URL does not match expected pattern'
        );
    }

    /**
     * Captures a screenshot of the current preview window (optional).
     */
    public function captureScreenshot(string $label = 'preview'): void
    {
        $dir = sys_get_temp_dir() . '/e2e_screenshots';
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $file = sprintf('%s/%s-%s.png', $dir, date('Ymd-His'), $label);
        try {
            $this->client->takeScreenshot($file);
            fwrite(STDERR, "[PreviewPage] Screenshot saved: $file\n");
        } catch (\Throwable $e) {
            fwrite(STDERR, "[PreviewPage] Screenshot failed: {$e->getMessage()}\n");
        }
    }

    /** Returns the current preview URL. */
    public function getUrl(): string
    {
        return (string) $this->client->getCurrentURL();
    }

    /** Heuristic check that this looks like an eXeLearning preview. */
    public function isValidExeLearningPreview(): bool
    {
        try {
            $generator = (string) ($this->client->executeScript(
                'return document.querySelector("meta[name=\\"generator\\"]")?.getAttribute("content") || "";'
            ) ?? '');

            $hasExeContent = (bool) $this->client->executeScript(
                'return !!(document.querySelector(".exe-content") || document.querySelector("#exe-index") || document.querySelector("section.exe-content") || document.querySelector("[class^=\\"exe-\\"]"));'
            );

            $looksLikeExport = (bool) preg_match('#/export/.*(index\\.html)?$#', $this->getUrl());

            return ($generator !== '' && str_starts_with($generator, 'eXe')) || $hasExeContent || $looksLikeExport;
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Returns current title of the preview page.
     */
    public function getTitle(): string
    {
        return (string) $this->client->getTitle();
    }

    /**
     * Closes the preview window and switches back to the main editor, returning the WorkareaPage.
     */
    public function close(): WorkareaPage
    {
        try {
            $this->client->close();
        } catch (\Throwable) {
        }
        $this->client->switchTo()->window($this->originalHandle);
        return new WorkareaPage($this->client);
    }

    /**
     * Returns the underlying Panther client (for chaining or console assertions).
     */
    public function client(): Client
    {
        return $this->client;
    }
}
