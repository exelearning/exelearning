<?php
declare(strict_types=1);

namespace App\Tests\E2E\Support;

use Symfony\Component\Panther\Client;

/**
 * Utility to capture browser screenshots for diagnostics.
 *
 * Typical usage inside BaseE2ETestCase::onNotSuccessfulTest():
 *
 *   ScreenshotCapture::allWindows($client, 'main');
 */
final class ScreenshotCapture
{
    private static ?string $currentTestName = null;

    /**
     * Capture screenshots for all open windows of a given Panther Client.
     *
     * @param Client      $client      The Panther client whose windows to capture
     * @param string|null $clientName  Optional label to include in the filename
     */
    public static function allWindows(?Client $client, ?string $clientName = 'browser'): void
    {
        if (!$client instanceof Client) {
            fwrite(STDERR, "[ScreenshotCapture] Invalid client provided.\n");
            return;
        }

        $dir = sys_get_temp_dir() . '/e2e_screenshots';
        if (!is_dir($dir) && !mkdir($dir, 0777, true) && !is_dir($dir)) {
            fwrite(STDERR, "[ScreenshotCapture] Failed to create directory: $dir\n");
            return;
        }

        $timestamp = date('Ymd-His');
        $testName  = self::$currentTestName ?? self::detectTestName();
        $testName  = $testName ?: 'unknown_test';

        $handles = [];
        try {
            $handles = $client->getWindowHandles();
        } catch (\Throwable $e) {
            fwrite(STDERR, "[ScreenshotCapture] Could not get window handles: {$e->getMessage()}\n");
            return;
        }

        foreach ($handles as $index => $handle) {
            try {
                $client->switchTo()->window($handle);
                $file = sprintf(
                    '%s/%s-%s-w%d-%s.png',
                    $dir,
                    $timestamp,
                    $testName,
                    $index + 1,
                    $clientName ?? 'browser'
                );
                $client->takeScreenshot($file);
                fwrite(STDERR, "[ScreenshotCapture] Saved: $file\n");
            } catch (\Throwable $e) {
                fwrite(STDERR, "[ScreenshotCapture] Failed: {$e->getMessage()}\n");
            }
        }
    }

    /**
     * Capture a single screenshot from the active window.
     *
     * @param Client      $client
     * @param string|null $clientName
     */
    public static function single(?Client $client, ?string $clientName = 'browser'): void
    {
        if (!$client instanceof Client) {
            fwrite(STDERR, "[ScreenshotCapture] Invalid client provided.\n");
            return;
        }

        $dir = sys_get_temp_dir() . '/e2e_screenshots';
        if (!is_dir($dir) && !mkdir($dir, 0777, true) && !is_dir($dir)) {
            fwrite(STDERR, "[ScreenshotCapture] Failed to create directory: $dir\n");
            return;
        }

        $timestamp = date('Ymd-His');
        $testName  = self::$currentTestName ?? self::detectTestName() ?: 'unknown_test';

        $file = sprintf(
            '%s/%s-%s-%s.png',
            $dir,
            $timestamp,
            $testName,
            $clientName ?? 'browser'
        );

        try {
            $client->takeScreenshot($file);
            fwrite(STDERR, "[ScreenshotCapture] Saved single: $file\n");
        } catch (\Throwable $e) {
            fwrite(STDERR, "[ScreenshotCapture] Failed: {$e->getMessage()}\n");
        }
    }

    /**
     * Try to infer the current PHPUnit test name.
     */
    private static function detectTestName(): ?string
    {
        // Best-effort heuristic using debug_backtrace()
        foreach (debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS) as $frame) {
            if (isset($frame['object']) && is_object($frame['object'])) {
                $obj = $frame['object'];
                if (method_exists($obj, 'name')) {
                    return str_replace(['\\', ':', ' '], '_', (string) $obj->name());
                }
            }
        }
        return null;
    }

    public static function setTestName(?string $name): void
    {
        if ($name === null) {
            self::$currentTestName = null;
            return;
        }

        self::$currentTestName = str_replace(
            ['\\', ':', ' ', '/'],
            '_',
            trim($name)
        );
    }
}
