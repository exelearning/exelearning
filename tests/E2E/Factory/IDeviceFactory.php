<?php
declare(strict_types=1);

namespace App\Tests\E2E\Factory;

use App\Tests\E2E\PageObject\WorkareaPage;
use App\Tests\E2E\Support\Selectors;
use App\Tests\E2E\Support\Wait;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverElement;

/**
 * High-level iDevice helpers focused on Text iDevices.
 *
 * Works directly through the WorkareaPage and WebDriver and keeps the
 * interaction logic centralized and resilient to small UI changes.
 */
final class IDeviceFactory
{
    /** Adds a new Text iDevice via the quick button. */
    public static function addText(WorkareaPage $workarea): void
    {
        self::ensureReadyForNewAction($workarea);
        $workarea->clickAddTextButton();
        Wait::settleDom(200);
    }

    /** Returns the current number of Text iDevices in the content panel. */
    public static function countText(WorkareaPage $workarea): int
    {
        $driver = $workarea->client()->getWebDriver();
        return \count($driver->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_TEXT)));
    }

    /** Returns the visible text content for the i-th Text iDevice (1-based). */
    public static function visibleTextAt(WorkareaPage $workarea, int $index1): string
    {
        $el = self::findTextIdeviceAt($workarea, $index1);
        $content = self::findWithin($el, Selectors::IDEVICE_TEXT_CONTENT, false);
        return $content ? trim((string) $content->getText()) : '';
    }

    /** Opens editor for the i-th Text iDevice, updates plain text, and saves. */
    public static function editAndSaveTextAt(WorkareaPage $workarea, int $index1, string $text): void
    {
        self::ensureReadyForNewAction($workarea);
        $idevice = self::findTextIdeviceAt($workarea, $index1);

        // Click Edit and wait editor to initialize
        self::clickIn(Selectors::IDEVICE_BTN_EDIT, $idevice, $workarea);

        $driver = $workarea->client()->getWebDriver();
        // Wait for edit mode or TinyMCE container to be present
        $driver->wait(8, 150)->until(function () use ($workarea, $idevice): bool {
            try {
                // Edition attribute present or a TinyMCE container appears inside this iDevice
                $mode = $idevice->getAttribute('mode');
                if ($mode === 'edition') { return true; }
                $tox = $idevice->findElements(WebDriverBy::cssSelector(Selectors::TINYMCE_CONTAINER));
                return \count($tox) > 0;
            } catch (\Throwable) {
                return false;
            }
        });

        // Try TinyMCE API scoped to this iDevice
        $ok = (bool) $driver->executeScript(<<<'JS'
            try {
              const container = arguments[0];
              const html = String(arguments[1] ?? '');
              if (window.tinymce && Array.isArray(tinymce.editors)) {
                for (const ed of tinymce.editors) {
                  const ifr = (ed.iframeElement) ? ed.iframeElement : document.getElementById(ed.id + '_ifr');
                  const target = ed.targetElm || null;
                  const within = (ifr && container.contains(ifr)) || (target && container.contains(target));
                  if (within) { ed.setContent(html); ed.fire('change'); return true; }
                }
                // Fallback: activeEditor
                if (tinymce.activeEditor) { tinymce.activeEditor.setContent(html); tinymce.activeEditor.fire('change'); return true; }
              }
            } catch (e) {}
            return false;
        JS, [$idevice, $text]);

        if (!$ok) {
            // Fallback: type directly inside the iframe editable body (scoped to this iDevice)
            $iframe = null;
            // Wait for iframe within this iDevice up to 6s
            try {
                $driver->wait(6, 150)->until(function () use ($idevice): bool {
                    return \count($idevice->findElements(WebDriverBy::cssSelector(Selectors::TINYMCE_IFRAME))) > 0;
                });
                $iframe = self::findWithin($idevice, Selectors::TINYMCE_IFRAME, true);
            } catch (\Throwable) {
                // As a last resort search globally
                $iframes = $driver->findElements(WebDriverBy::cssSelector(Selectors::TINYMCE_IFRAME));
                if (\count($iframes) > 0) { $iframe = $iframes[0]; }
            }

            if ($iframe) {
                $driver->switchTo()->frame($iframe);
                try {
                    $body = $driver->findElement(WebDriverBy::cssSelector('body'));
                    $body->click();
                    $driver->executeScript('document.body.innerHTML = "";');
                    $body->sendKeys($text);
                } finally {
                    $driver->switchTo()->defaultContent();
                }
            } else {
                // No iframe found; keep going to save to avoid stalling the test
            }
        }

        // Save iDevice
        self::clickIn(Selectors::IDEVICE_BTN_SAVE, $idevice, $workarea);

        // Wait editor to disappear within this iDevice
        $driver->wait(8, 150)->until(function () use ($idevice): bool {
            try { return $idevice->getAttribute('mode') !== 'edition'; } catch (\Throwable) { return true; }
        });
        Wait::settleDom(250);
    }

    /** Moves the i-th Text iDevice one position up. */
    public static function moveUpAt(WorkareaPage $workarea, int $index1): void
    {
        self::ensureReadyForNewAction($workarea);
        $idevice = self::findTextIdeviceAt($workarea, $index1);
        self::clickIn(Selectors::IDEVICE_BTN_MOVE_UP, $idevice, $workarea);
        // Wait for content to settle (overlay off + data-ready=true)
        self::waitContentReady($workarea, 10);
    }

    /** Moves the i-th Text iDevice one position down. */
    public static function moveDownAt(WorkareaPage $workarea, int $index1): void
    {
        self::ensureReadyForNewAction($workarea);
        $idevice = self::findTextIdeviceAt($workarea, $index1);
        self::clickIn(Selectors::IDEVICE_BTN_MOVE_DOWN, $idevice, $workarea);
        self::waitContentReady($workarea, 10);
    }

    /** Duplicates the i-th Text iDevice using the overflow menu. */
    public static function duplicateAt(WorkareaPage $workarea, int $index1): void
    {
        self::ensureReadyForNewAction($workarea);
        $before = self::countText($workarea);
        $idevice = self::findTextIdeviceAt($workarea, $index1);

        // Ensure read mode (if in edit mode, save first)
        $saveBtns = [];
        try { $saveBtns = $idevice->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_BTN_SAVE)); } catch (\Throwable) {}
        if (\count($saveBtns) > 0) {
            self::safeClick($saveBtns[0], $workarea);
            Wait::settleDom(250);
        }
        // Open more actions dropdown
        self::clickIn(Selectors::IDEVICE_BTN_MORE_ACTIONS, $idevice, $workarea);
        Wait::settleDom(150);
        // Click clone option
        $menuItem = self::findWithin($idevice, Selectors::IDEVICE_MENU_CLONE, true);
        self::safeClick($menuItem, $workarea);
        // Wait count increases
        $workarea->client()->getWebDriver()->wait(5, 150)->until(function () use ($workarea, $before) {
            return self::countText($workarea) > $before;
        });
    }

    /** Deletes the i-th Text iDevice. */
    public static function deleteAt(WorkareaPage $workarea, int $index1): void
    {
        self::ensureReadyForNewAction($workarea);
        $before = self::countText($workarea);
        $idevice = self::findTextIdeviceAt($workarea, $index1);
        self::clickIn(Selectors::IDEVICE_BTN_DELETE, $idevice, $workarea);

        $driver = $workarea->client()->getWebDriver();

        // If a confirmation modal appears, confirm deletion (may appear twice)
        for ($i = 0; $i < 2; $i++) {
            $confirmShown = false;
            try {
                $driver->wait(2, 150)->until(function () use ($workarea): bool {
                    return (bool) $workarea->client()->executeScript(<<<'JS'
                        const m = document.querySelector('[data-testid="modal-confirm"][data-open="true"], #modalConfirm.show');
                        return !!m;
                    JS);
                });
                $confirmShown = true;
            } catch (\Throwable) {
                // no modal currently shown
            }

            if ($confirmShown) {
                // Click confirm
                try {
                    $btns = $driver->findElements(WebDriverBy::cssSelector('[data-testid="confirm-action"], #modalConfirm .confirm'));
                    if (\count($btns) > 0) {
                        self::safeClick($btns[0], $workarea);
                        Wait::settleDom(150);
                    }
                } catch (\Throwable) {}
            } else {
                // No confirm visible; break
                break;
            }
        }

        // Wait until one Text iDevice less is visible
        $driver->wait(8, 150)->until(function () use ($workarea, $before): bool {
            return self::countText($workarea) < $before;
        });

        // If a second confirm (delete empty box) still lingers, confirm it and continue
        try {
            $driver->wait(2, 150)->until(function () use ($workarea): bool {
                return (bool) $workarea->client()->executeScript(<<<'JS'
                    const m = document.querySelector('[data-testid="modal-confirm"][data-open="true"], #modalConfirm.show');
                    return !!m;
                JS);
            });
            $btns = $driver->findElements(WebDriverBy::cssSelector('[data-testid="confirm-action"], #modalConfirm .confirm'));
            if (\count($btns) > 0) { self::safeClick($btns[0], $workarea); }
        } catch (\Throwable) {}

        // Content settles
        self::waitContentReady($workarea, 10);
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    /** Locates the i-th Text iDevice (1-based). */
    private static function findTextIdeviceAt(WorkareaPage $workarea, int $index1): WebDriverElement
    {
        if ($index1 < 1) {
            throw new \InvalidArgumentException('Index must be 1-based.');
        }
        $driver = $workarea->client()->getWebDriver();
        $els = $driver->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_TEXT));
        if (($index1 - 1) >= \count($els)) {
            throw new \OutOfBoundsException(sprintf('Requested iDevice #%d but only %d available', $index1, \count($els)));
        }
        return $els[$index1 - 1];
    }

    /** Finds a descendant element under a container. */
    private static function findWithin(WebDriverElement $scope, string $css, bool $required = true): ?WebDriverElement
    {
        try {
            $el = $scope->findElement(WebDriverBy::cssSelector($css));
            return $el;
        } catch (\Throwable) {
            if ($required) {
                throw $scope->getId() ? new \RuntimeException("Unable to find '$css' within the iDevice container") : new \RuntimeException("Element not found: $css");
            }
            return null;
        }
    }

    /** Clicks a selector inside a container, with scroll + JS fallback. */
    private static function clickIn(string $css, WebDriverElement $scope, WorkareaPage $workarea): void
    {
        $el = self::findWithin($scope, $css, true);
        self::safeClick($el, $workarea);
    }

    private static function safeClick(WebDriverElement $el, WorkareaPage $workarea): void
    {
        $driver = $workarea->client()->getWebDriver();
        try {
            $driver->executeScript('arguments[0].scrollIntoView({block:"center"});', [$el]);
            usleep(120_000);
            $el->click();
        } catch (\Facebook\WebDriver\Exception\ElementClickInterceptedException|\Facebook\WebDriver\Exception\ElementNotInteractableException) {
            try {
                $driver->executeScript('arguments[0].scrollIntoView({block:"center"}); arguments[0].click();', [$el]);
            } catch (\Throwable) {
                // Last resort: synthesize a click event
                $driver->executeScript('try{ arguments[0].dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true,view:window})); }catch(e){}', [$el]);
            }
        }
    }

    /** Ensures no editing iDevice or alert modal is blocking next actions. */
    private static function ensureReadyForNewAction(WorkareaPage $workarea): void
    {
        $driver = $workarea->client()->getWebDriver();

        // Close alert modal if present (prefer JS to avoid focus/overlay issues)
        try {
            $closed = $driver->executeScript(<<<'JS'
                const modal = document.querySelector('.modal-alert, .modal-dialog.modal-alert');
                if (!modal) return false;
                const btn = modal.querySelector('.modal-footer .btn, .modal-header .close, .close, [data-dismiss="modal"]');
                if (btn) { btn.click(); return true; }
                // Force-dismiss as a last resort
                const m = modal.closest('.modal') || modal;
                m.classList.remove('show'); m.style.display='none';
                const backdrop = document.querySelector('.modal-backdrop'); if (backdrop) backdrop.remove();
                return true;
            JS);
            if ($closed) { usleep(200_000); }
        } catch (\Throwable) {}

        // If any iDevice is in edition mode, save it to return to read mode
        $editing = $driver->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_NODE_EDITING));
        if (\count($editing) > 0) {
            try {
                $save = $editing[0]->findElement(WebDriverBy::cssSelector(Selectors::IDEVICE_BTN_SAVE));
                self::safeClick($save, $workarea);
                // Wait edition mode to disappear
                $driver->wait(6, 150)->until(function () use ($driver): bool {
                    return \count($driver->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_NODE_EDITING))) === 0;
                });
            } catch (\Throwable) {
                // Fallback: try a global Save button
                $saveAll = $driver->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_BTN_SAVE));
                if (\count($saveAll) > 0) {
                    self::safeClick($saveAll[0], $workarea);
                    usleep(200_000);
                }
            }
        }
    }

    /** Waits for content overlay to be hidden and node-content to be ready. */
    private static function waitContentReady(WorkareaPage $workarea, int $timeoutSec = 8): void
    {
        $driver = $workarea->client()->getWebDriver();
        try {
            $driver->wait($timeoutSec, 150)->until(function () use ($workarea): bool {
                return (bool) $workarea->client()->executeScript(<<<'JS'
                    const ov = document.querySelector('[data-testid="loading-content"]');
                    if (ov && ov.getAttribute('data-visible') === 'true') return false;
                    const nc = document.querySelector('[data-testid="node-content"]') || document.querySelector('#node-content');
                    if (!nc) return false;
                    const ready = nc.getAttribute('data-ready');
                    if (ready && ready !== 'true') return false;
                    return true;
                JS);
            });
        } catch (\Throwable) {
            // soft-fail, continue
        }
        Wait::settleDom(200);
    }
}
