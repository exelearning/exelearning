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
    public static function ms(int $ms): int
    {
        return (int) max(1, round($ms));
    }

    public static function seconds(int $seconds): int
    {
        return (int) max(1, ceil($seconds));
    }

    public static function settleDom(int $ms = 250): void
    {
        usleep($ms * 1000);
    }

    public static function css(Client $client, string $selector, int $timeoutMs = 5000): void
    {
        self::wd($client, self::ms($timeoutMs))->until(
            WebDriverExpectedCondition::presenceOfElementLocated(WebDriverBy::cssSelector($selector))
        );
    }

    private static function wd(Client $client, int $timeoutMs): WebDriverWait
    {
        return new WebDriverWait($client->getWebDriver(), max(1, (int) ceil($timeoutMs / 1000)));
    }
}
