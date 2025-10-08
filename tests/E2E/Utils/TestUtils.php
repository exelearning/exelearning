<?php
declare(strict_types=1);

namespace App\Tests\E2E\Utils;

use Symfony\Component\Panther\Client;
use App\Tests\E2E\PageObjects\AbstractPageObject;
use App\Tests\E2E\PageObjects\WorkareaPage;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverExpectedCondition;
use Facebook\WebDriver\WebDriverElement;

/**
 * Utility class for common operations in E2E tests.
 */
class TestUtils
{
    /**
     * Gets the Panther Client from various possible inputs.
     *
     * @param Client|AbstractPageObject|WorkareaPage $clientOrPage The client or page object
     * @return Client
     * @throws \InvalidArgumentException If the input is not a valid client or page object
     */
    private static function getClient($clientOrPage): Client
    {
        if ($clientOrPage instanceof Client) {
            return $clientOrPage;
        } else if ($clientOrPage instanceof AbstractPageObject || $clientOrPage instanceof WorkareaPage) {
            // Access the client property through reflection
            $reflection = new \ReflectionClass($clientOrPage);
            $property = $reflection->getProperty('client');
            $property->setAccessible(true);
            $client = $property->getValue($clientOrPage);
            
            if ($client instanceof Client) {
                return $client;
            }
        }
        
        throw new \InvalidArgumentException('Expected Client, AbstractPageObject or WorkareaPage');
    }
    
    /**
     * Waits for all AJAX requests to complete.
     * Delegates to the centralized WaitUtils class.
     *
     * @param Client|AbstractPageObject $clientOrPage The client or page object
     * @param int $timeout Timeout in seconds
     * @return bool True if all AJAX requests completed
     */
    public static function waitForAjax($clientOrPage, int $timeout = 10): bool
    {
        $client = self::getClient($clientOrPage);
        return WaitUtils::waitForAjax($client, $timeout);
    }
    
    /**
     * Dismisses all visible modals using the centralized AbstractPageObject method.
     *
     * @param Client|AbstractPageObject $clientOrPage The client or page object
     * @param bool $takeScreenshot Whether to take a screenshot before dismissal
     * @return void
     */
    public static function dismissAllModals($clientOrPage, bool $takeScreenshot = false): void
    {
        TestLogger::debug("Dismissing all modals via TestUtils");
        
        if ($clientOrPage instanceof AbstractPageObject) {
            // If we already have a page object, use it directly
            $clientOrPage->dismissModals($takeScreenshot);
        } else {
            // Otherwise, create a temporary page object
            $client = self::getClient($clientOrPage);
            $tempPageObject = new class($client) extends AbstractPageObject {};
            $tempPageObject->dismissModals($takeScreenshot);
        }
    }
    
    /**
     * Takes a screenshot with a descriptive filename.
     * Delegates to the centralized ScreenshotUtils class.
     *
     * @param Client|AbstractPageObject $clientOrPage The client or page object
     * @param string $testName Name of the test
     * @param string $description Description of the screenshot
     * @param string|null $clientType Type of client ('main', 'secondary', or null for current client)
     * @return string|null Path to the saved screenshot or null if failed
     */
    public static function takeScreenshot($clientOrPage, string $testName, string $description, ?string $clientType = null): ?string
    {
        $client = self::getClient($clientOrPage);
        return ScreenshotUtils::takeScreenshot($client, $testName, $description, $clientType);
    }
    
    /**
     * Scrolls to an element to ensure it's in view.
     *
     * @param Client|AbstractPageObject $clientOrPage The client or page object
     * @param string $selector CSS selector
     * @return void
     */
    public static function scrollToElement($clientOrPage, string $selector): void
    {
        $client = self::getClient($clientOrPage);
        $client->executeScript(
            'document.querySelector("' . addslashes($selector) . '").scrollIntoView({behavior: "smooth", block: "center"});'
        );
        
        // Small pause to allow scrolling to complete
        usleep(500000); // 500ms
    }
    
    /**
     * Waits for a selector with better error handling.
     * Delegates to the centralized WaitUtils class.
     *
     * @param Client|AbstractPageObject $clientOrPage The client or page object
     * @param string $selector CSS selector
     * @param int $timeout Timeout in seconds
     * @param string $errorMessage Custom error message
     * @return bool True if element was found
     */
    public static function waitForSelectorSafely($clientOrPage, string $selector, int $timeout = 10, string $errorMessage = ''): bool
    {
        $client = self::getClient($clientOrPage);
        return WaitUtils::waitForSelector($client, $selector, $timeout, $errorMessage);
    }
    
    /**
     * Waits for an element with specific wait type.
     * Delegates to the centralized WaitUtils class.
     *
     * @param Client|AbstractPageObject $clientOrPage The client or page object
     * @param string $selector CSS selector
     * @param string $waitType Type of wait: 'visibility', 'invisibility', 'presence', 'clickable'
     * @param int $timeout Timeout in seconds
     * @return bool True if the condition was met
     */
    public static function waitForElement($clientOrPage, string $selector, string $waitType = 'visibility', int $timeout = 10): bool
    {
        $client = self::getClient($clientOrPage);
        return WaitUtils::waitForElement($client, $selector, $waitType, $timeout);
    }
    
    /**
     * Executes JavaScript in the browser with error handling.
     *
     * @param Client|AbstractPageObject $clientOrPage The client or page object
     * @param string $script JavaScript code to execute
     * @param array $arguments Arguments to pass to the script
     * @return mixed Result of the script execution
     */
    public static function executeScript($clientOrPage, string $script, array $arguments = [])
    {
        $client = self::getClient($clientOrPage);
        try {
            return $client->executeScript($script, $arguments);
        } catch (\Exception $e) {
            TestLogger::error("JavaScript execution error: " . $e->getMessage());
            TestLogger::debug("Failed script: " . $script);
            throw $e;
        }
    }
    
    /**
     * Waits for loading screen to completely disappear.
     * Delegates to the centralized WaitUtils class.
     *
     * @param Client|AbstractPageObject $clientOrPage The client or page object
     * @param string $selector CSS selector for the loading screen
     * @param int $timeout Timeout in seconds
     * @return bool True if loading screen disappeared
     */
    public static function waitForLoadingScreenToDisappear($clientOrPage, string $selector = '#load-screen-main', int $timeout = 15): bool
    {
        $client = self::getClient($clientOrPage);
        return WaitUtils::waitForLoadingScreenToDisappear($client, $selector, $timeout);
    }
    
    /**
     * Gets current DOM structure for debugging.
     *
     * @param Client|AbstractPageObject $clientOrPage The client or page object
     * @param string $selector Optional selector to focus on a specific part
     * @return string HTML structure
     */
    public static function getDomStructure($clientOrPage, string $selector = 'body'): string
    {
        $client = self::getClient($clientOrPage);
        try {
            return self::executeScript($client, "
                const element = document.querySelector('$selector');
                if (!element) return 'Element not found: $selector';
                
                function getStructure(el, level = 0) {
                    const indent = '  '.repeat(level);
                    let result = indent + '<' + el.tagName.toLowerCase();
                    
                    // Add id if exists
                    if (el.id) {
                        result += ' id=\"' + el.id + '\"';
                    }
                    
                    // Add class if exists
                    if (el.className && typeof el.className === 'string') {
                        result += ' class=\"' + el.className + '\"';
                    }
                    
                    result += '>';
                    
                    // Skip text nodes with just whitespace
                    const textContent = Array.from(el.childNodes)
                        .filter(node => node.nodeType === 3)
                        .map(node => node.textContent.trim())
                        .filter(text => text.length > 0)
                        .join(' ');
                    
                    if (textContent) {
                        result += ' ' + (textContent.length > 50 ? textContent.substring(0, 47) + '...' : textContent);
                    }
                    
                    // Recursively process child elements
                    const children = Array.from(el.children);
                    if (children.length > 0) {
                        result += '\\n';
                        children.forEach(child => {
                            result += getStructure(child, level + 1);
                        });
                        result += indent;
                    }
                    
                    result += '</' + el.tagName.toLowerCase() + '>\\n';
                    return result;
                }
                
                return getStructure(element);
            ");
        } catch (\Exception $e) {
            return "Error getting DOM structure: " . $e->getMessage();
        }
    }
    
    /**
     * Safely clicks an element with retries and improved error handling.
     *
     * @param Client|AbstractPageObject $clientOrPage The client or page object
     * @param string $selector CSS selector
     * @param int $timeoutSeconds Timeout in seconds
     * @param int $maxAttempts Maximum number of attempts
     * @return bool True if click was successful
     */
    public static function safeClick($clientOrPage, string $selector, int $timeoutSeconds = 10, int $maxAttempts = 3): bool
    {
        $client = self::getClient($clientOrPage);
        $attempts = 0;
        $lastException = null;
        
        while ($attempts < $maxAttempts) {
            $attempts++;
            TestLogger::debug("Click attempt $attempts for selector: $selector");
            
            try {
                $element = $client->wait($timeoutSeconds, 250)->until(
                    WebDriverExpectedCondition::elementToBeClickable(
                        WebDriverBy::cssSelector($selector)
                    )
                );
                
                $element->click();
                TestLogger::debug("Successfully clicked element: $selector");
                return true;
                
            } catch (\Facebook\WebDriver\Exception\ElementClickInterceptedException $e) {
                $lastException = $e;
                TestLogger::warning("Click intercepted on attempt $attempts for $selector: " . $e->getMessage());
                
                // Try to scroll the element into view
                try {
                    self::executeScript($client, "
                        const element = document.querySelector('$selector');
                        if (element) {
                            element.scrollIntoView({behavior: 'smooth', block: 'center'});
                        }
                    ");
                    sleep(1); // Wait for scroll
                } catch (\Exception $scrollError) {
                    TestLogger::debug("Error scrolling to element: " . $scrollError->getMessage());
                }
                
                // Check if loading screen is intercepting and try to remove it
                if (strpos($e->getMessage(), 'load-screen') !== false) {
                    TestLogger::debug("Loading screen is intercepting click, trying to force hide it");
                    self::waitForLoadingScreenToDisappear($client);
                }
                
            } catch (\Exception $e) {
                $lastException = $e;
                TestLogger::warning("Error clicking $selector on attempt $attempts: " . $e->getMessage());
                
                // Try JavaScript click as fallback
                if ($attempts == $maxAttempts - 1) {
                    try {
                        TestLogger::debug("Trying JavaScript click as fallback");
                        self::executeScript($client, "
                            const element = document.querySelector('$selector');
                            if (element) {
                                element.click();
                            }
                        ");
                        TestLogger::debug("JavaScript click successful");
                        return true;
                    } catch (\Exception $jsError) {
                        TestLogger::warning("JavaScript click failed: " . $jsError->getMessage());
                    }
                }
                
                sleep(1); // Brief pause before retry
            }
        }
        
        if ($lastException) {
            TestLogger::error("All click attempts failed for selector: $selector");
            throw $lastException;
        }
        
        return false;
    }
}
