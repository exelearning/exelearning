<?php
declare(strict_types=1);

namespace App\Tests\E2E\Utils;

use Symfony\Component\Panther\Client;

/**
 * Utility class for handling screenshots in E2E tests.
 */
class ScreenshotUtils
{
    /**
     * Takes a screenshot with a descriptive filename.
     *
     * @param Client $client The Panther client
     * @param string $testName Name of the test
     * @param string $description Description of the screenshot
     * @param string|null $clientType Type of client ('main', 'secondary', or null for current client)
     * @return string|null Path to the saved screenshot or null if failed
     */
    public static function takeScreenshot(
        Client $client, 
        string $testName, 
        string $description, 
        ?string $clientType = null
    ): ?string {
        $screenshotDir = sys_get_temp_dir() . '/e2e_screenshots';
        if (!is_dir($screenshotDir)) {
            mkdir($screenshotDir, 0777, true);
        }
        
        $clientDescription = '';
        if ($clientType) {
            $clientDescription = $clientType . '_client_';
        }
        
        $filename = sprintf(
            '%s/%s-%s-%s%s.png',
            $screenshotDir,
            date('Ymd-His'),
            str_replace(['\\', ':', ' '], '_', $testName),
            $clientDescription,
            str_replace(['\\', ':', ' ', '/'], '_', $description)
        );
        
        try {
            $client->takeScreenshot($filename);
            
            // Only log if debugging is enabled
            if (isset($_ENV['DEBUG_CONSOLE_OUTPUT']) && $_ENV['DEBUG_CONSOLE_OUTPUT']) {
                echo "\n[Screenshot saved]: $filename\n";
            }
            
            TestLogger::debug("Screenshot saved: $filename");
            return $filename;
        } catch (\Exception $e) {
            TestLogger::error("Failed to take screenshot: " . $e->getMessage());
            return null;
        }
    }
    
    /**
     * Takes screenshots of all open browser windows.
     *
     * @param Client $client The Panther client
     * @param string $testName Name of the test
     * @param string $description Description of the screenshot
     * @return array<string> Paths to the saved screenshots
     */
    public static function takeAllWindowsScreenshots(
        Client $client, 
        string $testName, 
        string $description = 'all_windows'
    ): array {
        $screenshotPaths = [];
        
        try {
            $handles = $client->getWindowHandles();
            $originalHandle = $client->getWindowHandle();
            
            foreach ($handles as $index => $handle) {
                try {
                    $client->switchTo()->window($handle);
                    $windowDescription = $description . '_window' . ($index + 1);
                    $path = self::takeScreenshot($client, $testName, $windowDescription);
                    
                    if ($path) {
                        $screenshotPaths[] = $path;
                    }
                } catch (\Exception $e) {
                    TestLogger::warning("Failed to take screenshot of window {$index}: " . $e->getMessage());
                }
            }
            
            // Switch back to original window
            $client->switchTo()->window($originalHandle);
            
        } catch (\Exception $e) {
            TestLogger::error("Error taking all windows screenshots: " . $e->getMessage());
        }
        
        return $screenshotPaths;
    }
    
    /**
     * Takes a screenshot of a specific element.
     *
     * @param Client $client The Panther client
     * @param string $selector CSS selector for the element
     * @param string $testName Name of the test
     * @param string $description Description of the screenshot
     * @return string|null Path to the saved screenshot or null if failed
     */
    public static function takeElementScreenshot(
        Client $client, 
        string $selector, 
        string $testName, 
        string $description
    ): ?string {
        try {
            // First scroll the element into view
            $client->executeScript("
                const element = document.querySelector('$selector');
                if (element) {
                    element.scrollIntoView({behavior: 'smooth', block: 'center'});
                }
            ");
            
            // Small delay to allow scrolling to complete
            usleep(300000); // 300ms
            
            // Take the screenshot
            return self::takeScreenshot($client, $testName, $description . '_' . str_replace(['>', ' ', '.', '#'], '_', $selector));
            
        } catch (\Exception $e) {
            TestLogger::error("Failed to take element screenshot: " . $e->getMessage());
            return null;
        }
    }
}
