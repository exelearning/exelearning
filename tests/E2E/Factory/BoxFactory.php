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

    /** Moves the N-th box up by one position (1-based). No-op if already first. */
    public static function moveUpAt(WorkareaPage $workarea, int $index1): void
    {
        if ($index1 <= 1) { throw new \RuntimeException('Cannot move the first box up.'); }
        self::ensureReadyForAction($workarea);
        $driver = $workarea->client()->getWebDriver();
        $box = self::boxAt($workarea, $index1);
        $boxId = (string) $box->getAttribute('id');
        self::clickIn(Selectors::BOX_BTN_MOVE_UP, $box, $workarea);
        $targetIndex = $index1 - 1;
        $driver->wait(15, 200)->until(function () use ($driver, $boxId, $targetIndex): bool {
            try {
                $els = $driver->findElements(WebDriverBy::cssSelector(Selectors::BOX_ARTICLE));
                return isset($els[$targetIndex - 1]) && (string) $els[$targetIndex - 1]->getAttribute('id') === $boxId;
            } catch (\Throwable) { return false; }
        });
    }

    /** Moves the N-th box down by one position (1-based). No-op if already last. */
    public static function moveDownAt(WorkareaPage $workarea, int $index1): void
    {
        $count = self::countBoxes($workarea);
        if ($index1 >= $count) { throw new \RuntimeException('Cannot move the last box down.'); }
        self::ensureReadyForAction($workarea);
        $driver = $workarea->client()->getWebDriver();
        $box = self::boxAt($workarea, $index1);
        $boxId = (string) $box->getAttribute('id');
        self::clickIn(Selectors::BOX_BTN_MOVE_DOWN, $box, $workarea);
        $targetIndex = $index1 + 1;
        $driver->wait(15, 200)->until(function () use ($driver, $boxId, $targetIndex): bool {
            try {
                $els = $driver->findElements(WebDriverBy::cssSelector(Selectors::BOX_ARTICLE));
                return isset($els[$targetIndex - 1]) && (string) $els[$targetIndex - 1]->getAttribute('id') === $boxId;
            } catch (\Throwable) { return false; }
        });
    }

    /** Duplicates the N-th box via header dropdown; confirms info modal if shown. */
    public static function duplicateAt(WorkareaPage $workarea, int $index1): void
    {
        self::ensureReadyForAction($workarea);
        $driver = $workarea->client()->getWebDriver();
        $before = self::countBoxes($workarea);
        $box = self::boxAt($workarea, $index1);
        self::clickIn(Selectors::BOX_BTN_MORE, $box, $workarea);
        self::clickIn(Selectors::BOX_MENU_CLONE, $box, $workarea);

        // Accept info/modal if needed
        try {
            $driver->wait(5, 200)->until(function () use ($workarea): bool {
                return (bool) $workarea->client()->executeScript(<<<'JS'
                    return !!(document.querySelector('[data-testid="modal-confirm"][data-open="true"]')
                           || document.querySelector('#modalConfirm.show'));
                JS);
            });
            $btns = $driver->findElements(WebDriverBy::cssSelector(Selectors::MODAL_CONFIRM_ACTION));
            if (\count($btns) > 0) { self::safeClick($btns[0], $workarea); }
        } catch (\Throwable) { /* modal not shown */ }

        // Box count should increase
        $driver->wait(10, 200)->until(function () use ($workarea, $before): bool {
            return self::countBoxes($workarea) > $before;
        });
    }

    /** Deletes the N-th box via header dropdown and confirms. */
    public static function deleteAt(WorkareaPage $workarea, int $index1): void
    {
        self::ensureReadyForAction($workarea);
        $driver = $workarea->client()->getWebDriver();
        $before = self::countBoxes($workarea);
        $box = self::boxAt($workarea, $index1);
        $boxId = (string) $box->getAttribute('id');
        self::clickIn(Selectors::BOX_BTN_MORE, $box, $workarea);
        self::clickIn(Selectors::BOX_MENU_DELETE, $box, $workarea);

        // Confirm deletion (single confirmation for box delete)
        try {
            $driver->wait(6, 200)->until(function () use ($workarea): bool {
                return (bool) $workarea->client()->executeScript(<<<'JS'
                    return !!(document.querySelector('[data-testid="modal-confirm"][data-open="true"]')
                           || document.querySelector('#modalConfirm.show'));
                JS);
            });
            $btns = $driver->findElements(WebDriverBy::cssSelector(Selectors::MODAL_CONFIRM_ACTION));
            if (\count($btns) > 0) { self::safeClick($btns[0], $workarea); }
        } catch (\Throwable) {}

        // Wait for removal of the specific box and count decrease
        $driver->wait(12, 200)->until(function () use ($driver, $workarea, $before, $boxId): bool {
            try {
                $els = $driver->findElements(WebDriverBy::cssSelector(Selectors::BOX_ARTICLE));
                $ids = array_map(fn($e) => (string) $e->getAttribute('id'), $els);
                return (\count($els) === ($before - 1)) && !in_array($boxId, $ids, true);
            } catch (\Throwable) { return false; }
        });
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------
    private static function boxAt(WorkareaPage $workarea, int $index1): \Facebook\WebDriver\WebDriverElement
    {
        if ($index1 < 1) { throw new \InvalidArgumentException('Index must be 1-based.'); }
        $driver = $workarea->client()->getWebDriver();
        $els = $driver->findElements(WebDriverBy::cssSelector(Selectors::BOX_ARTICLE));
        if (($index1 - 1) >= \count($els)) {
            throw new \OutOfBoundsException(sprintf('Requested box #%d but only %d available', $index1, \count($els)));
        }
        return $els[$index1 - 1];
    }

    private static function findWithin(\Facebook\WebDriver\WebDriverElement $scope, string $css): \Facebook\WebDriver\WebDriverElement
    {
        return $scope->findElement(WebDriverBy::cssSelector($css));
    }

    private static function clickIn(string $css, \Facebook\WebDriver\WebDriverElement $scope, WorkareaPage $workarea): void
    {
        $el = self::findWithin($scope, $css);
        self::safeClick($el, $workarea);
    }

    private static function safeClick(\Facebook\WebDriver\WebDriverElement $el, WorkareaPage $workarea): void
    {
        $driver = $workarea->client()->getWebDriver();
        try {
            $driver->executeScript('arguments[0].scrollIntoView({block:"center"});', [$el]);
            usleep(120_000);
            $el->click();
        } catch (\Facebook\WebDriver\Exception\ElementClickInterceptedException|\Facebook\WebDriver\Exception\ElementNotInteractableException) {
            try { $driver->executeScript('arguments[0].click();', [$el]); } catch (\Throwable) {}
        }
    }

    /** Close alert and save any iDevice in edit mode to prevent blocking actions. */
    private static function ensureReadyForAction(WorkareaPage $workarea): void
    {
        $driver = $workarea->client()->getWebDriver();
        // Close alert modal if present
        try {
            $closed = $driver->executeScript(<<<'JS'
                const modal = document.querySelector('.modal-alert, .modal-dialog.modal-alert');
                if (!modal) return false;
                const btn = modal.querySelector('.modal-footer .btn, .modal-header .close, .close, [data-dismiss="modal"]');
                if (btn) { btn.click(); return true; }
                const m = modal.closest('.modal') || modal; m.classList.remove('show'); m.style.display='none';
                const backdrop = document.querySelector('.modal-backdrop'); if (backdrop) backdrop.remove();
                return true;
            JS);
            if ($closed) { usleep(150_000); }
        } catch (\Throwable) {}

        // If any iDevice is in edition mode, click its save to exit edition
        try {
            $editing = $driver->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_NODE_EDITING));
            if (\count($editing) > 0) {
                try {
                    $save = $editing[0]->findElement(WebDriverBy::cssSelector(Selectors::IDEVICE_BTN_SAVE));
                    self::safeClick($save, $workarea);
                    $driver->wait(6, 150)->until(function () use ($driver): bool {
                        return \count($driver->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_NODE_EDITING))) === 0;
                    });
                } catch (\Throwable) {}
            }
        } catch (\Throwable) {}
    }
}
