<?php
declare(strict_types=1);

namespace App\Tests\E2E\Utils;

use Symfony\Component\Panther\Client;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverExpectedCondition;

/**
 * Utility class for logging test events and debug information.
 */
class TestLogger
{    

    /**
     * Logs a message with a specific level.
     *
     * @param string $message Message to log
     * @param string $level Log level (info, debug, error, warning)
     * @param string|null $context Optional context information
     * @return void
     */
    public static function log(string $message, string $level = 'info', ?string $context = null): void
    {

        $timestamp = date('Y-m-d H:i:s');
        $levelUpper = strtoupper($level);
        $contextInfo = $context ? "[$context] " : "";
        
        // Get caller information for better debugging
        $backtrace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2);
        $caller = isset($backtrace[1]) ? basename($backtrace[1]['file']) . ':' . $backtrace[1]['line'] : 'unknown';
        
        $logMessage = "[$timestamp] [$levelUpper] [$caller] {$contextInfo}$message" . PHP_EOL;
        
        // Also echo to console for real-time feedback during test execution
        // Only if console output is enabled or for errors/warnings
        // $shouldOutput = isset($_ENV['DEBUG_CONSOLE_OUTPUT']) && $_ENV['DEBUG_CONSOLE_OUTPUT'];
        $isImportant = in_array($level, ['error', 'warning']);
        
        // if ($isImportant) {
            if ($level === 'error') {
                echo "\033[31m$logMessage\033[0m"; // Red text for errors
            } elseif ($level === 'warning') {
                echo "\033[33m$logMessage\033[0m"; // Yellow text for warnings
            } elseif ($level === 'debug') {
                echo "\033[36m$logMessage\033[0m"; // Cyan text for debug
            } else {
                echo $logMessage;
            }
        // }
    }
    
    /**
     * Logs a debug message.
     *
     * @param string $message Message to log
     * @return void
     */
    public static function debug(string $message): void
    {
        self::log($message, 'debug');
    }
    
    /**
     * Logs an error message.
     *
     * @param string $message Message to log
     * @return void
     */
    public static function error(string $message): void
    {
        self::log($message, 'error');
    }
    
    /**
     * Logs a warning message.
     *
     * @param string $message Message to log
     * @return void
     */
    public static function warning(string $message): void
    {
        self::log($message, 'warning');
    }
    
    /**
     * Logs the current state of a test with additional context.
     *
     * @param Client $client The Panther client
     * @param string $testName Name of the test
     * @param string $context Context information
     * @return void
     */
    public static function logTestState(Client $client, string $testName, string $context): void
    {
        self::log("Test: $testName - Context: $context", 'info');
        self::log("Current URL: " . $client->getCurrentURL(), 'debug');
        
        // Take a screenshot and log its path
        $screenshotPath = TestUtils::takeScreenshot($client, $testName, $context);
        self::log("Screenshot: $screenshotPath", 'debug');
    }
}
