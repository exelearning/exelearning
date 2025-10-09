<?php
declare(strict_types=1);

namespace App\Tests\E2E\Factory;

use App\Tests\E2E\PageObject\WorkareaPage;
use App\Tests\E2E\Support\Selectors;
use App\Tests\E2E\Support\Wait;
use Facebook\WebDriver\WebDriverBy;

/**
 * Box creation via UI.
 */
final class BoxFactory
{
    /**
     * Creates a new Box with a Text iDevice using the "Add Text" quick button.
     */
    public static function createWithTextIDevice(WorkareaPage $workarea): void
    {
        $workarea->clickAddTextButton();
        // Wait for at least one box to be present
        $workarea->client()->getWebDriver()->findElement(WebDriverBy::cssSelector(Selectors::BOX_ARTICLE));
        Wait::settleDom(200);
    }

    /** Returns how many boxes are currently rendered in the content area. */
    public static function countBoxes(WorkareaPage $workarea): int
    {
        $els = $workarea->client()->getWebDriver()->findElements(WebDriverBy::cssSelector(Selectors::BOX_ARTICLE));
        return \count($els);
    }
}
