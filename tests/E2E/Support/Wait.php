<?php
declare(strict_types=1);

namespace App\Tests\E2E\Support;

use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverExpectedCondition;
use Facebook\WebDriver\WebDriverWait;
use Symfony\Component\Panther\Client;

/**
 * Tiny waiting helpers around WebDriverWait.
 */
final class Wait
{
    private static ?float $factor = null; // scale factor for timeouts

    private static function factor(): float
    {
        if (self::$factor === null) {
            $raw = getenv('E2E_WAIT_FACTOR');
            $val = is_string($raw) && is_numeric($raw) ? (float) $raw : 1.0;
            self::$factor = max(0.25, min($val, 4.0));
        }
        return self::$factor;
    }

    public static function ms(int $ms): int
    {
        return (int) max(1, round($ms * self::factor()));
    }

    public static function seconds(int $seconds): int
    {
        return (int) max(1, ceil($seconds * self::factor()));
    }
    public static function css(Client $client, string $selector, int $timeoutMs = 5000): void
    {
        self::wd($client, self::ms($timeoutMs))->until(
            WebDriverExpectedCondition::presenceOfElementLocated(WebDriverBy::cssSelector($selector))
        );
    }

    public static function xpath(Client $client, string $xpath, int $timeoutMs = 5000): void
    {
        self::wd($client, self::ms($timeoutMs))->until(
            WebDriverExpectedCondition::presenceOfElementLocated(WebDriverBy::xpath($xpath))
        );
    }

    public static function textInCss(Client $client, string $selector, string $needle, int $timeoutMs = 5000): void
    {
        self::wd($client, self::ms($timeoutMs))->until(function () use ($client, $selector, $needle) {
            $els = $client->getWebDriver()->findElements(WebDriverBy::cssSelector($selector));
            foreach ($els as $el) {
                if (str_contains((string) trim($el->getText()), $needle)) {
                    return true;
                }
            }
            return false;
        });
    }

    public static function short(int $ms = 100): void
    {
        usleep($ms * 1000);
    }

    public static function settleDom(int $ms = 250): void
    {
        usleep($ms * 1000);
    }

    private static function wd(Client $client, int $timeoutMs): WebDriverWait
    {
        return new WebDriverWait($client->getWebDriver(), max(1, (int) ceil($timeoutMs / 1000)));
    }
}
