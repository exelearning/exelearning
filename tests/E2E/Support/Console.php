<?php
declare(strict_types=1);

namespace App\Tests\E2E\Support;

use PHPUnit\Framework\Assert;
use Symfony\Component\Panther\Client;

/**
 * Assert helper for browser console logs.
 */
final class Console
{
    /**
     * Fails the test if browser console has errors (SEVERE) or failed network resources.
     */
    public static function assertNoBrowserErrors(Client $client): void
    {
        try {
            $logs = $client->getWebDriver()->manage()->getLog('browser');
        } catch (\Throwable) {
            // Some drivers may not support browser logs; ignore in that case.
            return;
        }

        $errors = [];
        foreach ($logs as $entry) {
            $level = strtoupper((string) ($entry['level'] ?? ''));
            $message = (string) ($entry['message'] ?? '');
            if ($level === 'SEVERE' || str_contains($message, 'Failed to load resource')) {
                $errors[] = sprintf('[%s] %s', $level, $message);
            }
        }

        if ($errors) {
            Assert::fail("Browser console errors:\n" . implode("\n", $errors));
        }
    }

    /**
     * Dumps the browser console log to a file inside the e2e_screenshots directory.
     *
     * The filename is timestamped and includes the test descriptor and the client label.
     * Returns the saved path or null when no logs were available (or unsupported).
     */
    public static function dumpBrowserLogs(Client $client, string $testDescriptor, ?string $clientLabel = null, bool $onlyIfNotEmpty = true): ?string
    {
        try {
            $entries = $client->getWebDriver()->manage()->getLog('browser');
        } catch (\Throwable $e) {
            // Log not supported by the driver
            return null;
        }

        if ($onlyIfNotEmpty && (empty($entries) || count($entries) === 0)) {
            return null;
        }

        $dir = sys_get_temp_dir() . '/e2e_screenshots';
        if (!is_dir($dir) && !@mkdir($dir, 0777, true) && !is_dir($dir)) {
            return null;
        }

        $timestamp   = date('Ymd-His');
        $safeTest    = str_replace(['\\', ':', ' ', '/', '\\'], '_', trim($testDescriptor));
        $clientLabel = $clientLabel ?: 'browser';
        $file        = sprintf('%s/%s-%s-%s.console.log', $dir, $timestamp, $safeTest, $clientLabel);

        $lines = [];
        foreach ($entries as $entry) {
            $level = strtoupper((string)($entry['level'] ?? ''));
            $msg   = (string)($entry['message'] ?? '');
            $time  = isset($entry['timestamp']) ? date('c', (int)($entry['timestamp'] / 1000)) : date('c');
            $lines[] = sprintf('[%s] %s %s', $level ?: 'LOG', $time, $msg);
        }

        if (empty($lines) && $onlyIfNotEmpty) {
            return null;
        }

        @file_put_contents($file, implode(PHP_EOL, $lines) . PHP_EOL);
        return $file;
    }
}
