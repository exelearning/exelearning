<?php
declare(strict_types=1);

namespace App\Tests\E2E\Support;

use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverExpectedCondition;
use Facebook\WebDriver\WebDriverWait;
use Symfony\Component\Panther\Client;

/**
 * Class Wait
 *
 * Provides small waiting helpers around WebDriverWait to simplify
 * synchronization in end-to-end browser tests.
 *
 * This class helps stabilize tests by waiting for elements to appear,
 * or allowing the DOM to settle after dynamic actions such as AJAX loads
 * or UI animations.
 */
final class Wait
{
    /**
     * Convert milliseconds to a valid integer timeout value.
     *
     * Ensures that the returned value is at least 1 millisecond.
     *
     * @param int $ms Timeout in milliseconds.
     * @return int Sanitized integer value (minimum 1).
     */
    public static function ms(int $ms): int
    {
        return (int) max(1, round($ms));
    }

    /**
     * Convert seconds to a valid integer timeout value.
     *
     * Ensures that the returned value is at least 1 second.
     * Useful when the WebDriver API expects seconds instead of milliseconds.
     *
     * @param int $seconds Timeout in seconds.
     * @return int Sanitized integer value (minimum 1).
     */
    public static function seconds(int $seconds): int
    {
        return (int) max(1, ceil($seconds));
    }

    /**
     * Pause execution briefly to let the DOM settle.
     *
     * Useful after triggering UI changes (clicks, navigation, AJAX)
     * to give the browser time to render or update the DOM
     * before continuing the test.
     *
     * @param int $ms Number of milliseconds to wait (default: 250).
     * @return void
     */
    public static function settleDom(int $ms = 250): void
    {
        usleep($ms * 1000);
    }

    /**
     * Wait until a CSS selector is present in the DOM.
     *
     * This method blocks until an element matching the provided CSS selector
     * exists on the page or the timeout expires.
     *
     * Example usage:
     *   Wait::css($client, '.login-form');
     *
     * @param Client $client   Panther client instance.
     * @param string $selector CSS selector to locate.
     * @param int    $timeoutMs Timeout in milliseconds (default: 5000).
     * @return void
     *
     * @throws \Facebook\WebDriver\Exception\TimeOutException
     */
    public static function css(Client $client, string $selector, int $timeoutMs = 5000): void
    {
        self::wd($client, self::ms($timeoutMs))->until(
            WebDriverExpectedCondition::presenceOfElementLocated(
                WebDriverBy::cssSelector($selector)
            )
        );
    }

    /**
     * Create and configure a WebDriverWait instance.
     *
     * Converts timeout from milliseconds to seconds
     * and returns a WebDriverWait bound to the client's WebDriver.
     *
     * This method is kept private to enforce consistent construction
     * of WebDriverWait objects within this helper class.
     *
     * @param Client $client   Panther client instance.
     * @param int    $timeoutMs Timeout in milliseconds.
     * @return WebDriverWait Configured WebDriverWait instance.
     */
    private static function wd(Client $client, int $timeoutMs): WebDriverWait
    {
        return new WebDriverWait(
            $client->getWebDriver(),
            max(1, (int) ceil($timeoutMs / 1000))
        );
    }
}
