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


// File: tests/E2E/Factory/IDeviceFactory.php

public static function editAndSaveTextAt(WorkareaPage $workarea, int $index1, string $text): void
{
    self::ensureReadyForNewAction($workarea);
    $idevice = self::findTextIdeviceAt($workarea, $index1);
    $driver = $workarea->client()->getWebDriver(); // Define $driver upfront

    // Click "Edit"
    self::clickIn(Selectors::IDEVICE_BTN_EDIT, $idevice, $workarea);

    // [Improved robust wait]
    // Wait until iDevice enters edition mode AND the save button is visible.
    $driver->wait(20, 200)->until(function () use ($idevice): bool {
        try {
            $inEditionMode = $idevice->getAttribute('mode') === 'edition';
            // Most reliable condition: save button exists and is visible.
            $saveButton = $idevice->findElement(WebDriverBy::cssSelector(Selectors::IDEVICE_BTN_SAVE));
            return $inEditionMode && $saveButton->isDisplayed();
        } catch (\Throwable) {
            return false;
        }
    });

    // Editor ready, set content
    $ok = (bool) $driver->executeScript(<<<'JS'
        try {
          const container = arguments[0];
          const html = String(arguments[1] ?? '');
          if (window.tinymce && Array.isArray(tinymce.editors)) {
            for (const ed of tinymce.editors) {
              const el = ed.getElement();
              if (el && container.contains(el)) {
                ed.setContent(html); ed.fire('change'); return true;
              }
            }
            if (tinymce.activeEditor) { tinymce.activeEditor.setContent(html); tinymce.activeEditor.fire('change'); return true; }
          }
        } catch (e) {}
        return false;
    JS, [$idevice, $text]);

    if (!$ok) {
        // Fallback if TinyMCE API fails
        try {
            $iframe = self::findWithin($idevice, Selectors::TINYMCE_IFRAME, true);
            $driver->switchTo()->frame($iframe);
            $body = $driver->findElement(WebDriverBy::cssSelector('body'));
            $body->clear();
            $body->sendKeys($text);
        } finally {
            $driver->switchTo()->defaultContent();
        }
    }

    // Save iDevice (save button is present now)
    self::clickIn(Selectors::IDEVICE_BTN_SAVE, $idevice, $workarea);

    // Wait until editor closes
    $driver->wait(10, 200)->until(function () use ($idevice): bool {
        try {
            return $idevice->getAttribute('mode') !== 'edition';
        } catch (\Throwable) {
            return true; // If the element becomes stale, assume it was saved and closed.
        }
    });

    Wait::settleDom(300);
}


    /** Opens editor for the i-th Text iDevice, updates plain text, and saves. */
    public static function editAndSaveTextAt2(WorkareaPage $workarea, int $index1, string $text): void
    {
        self::ensureReadyForNewAction($workarea);
        $idevice = self::findTextIdeviceAt($workarea, $index1);

        // Click Edit and wait editor to initialize
        self::clickIn(Selectors::IDEVICE_BTN_EDIT, $idevice, $workarea);


        // [Improved robust wait]
        // Wait until iDevice enters edition mode AND the save button is visible.
        $driver->wait(15)->until(function () use ($idevice): bool {
            try {
                $inEditionMode = $idevice->getAttribute('mode') === 'edition';
                // La condición más fiable es que el botón de guardar exista y sea visible.
                $saveButton = $idevice->findElement(WebDriverBy::cssSelector(Selectors::IDEVICE_BTN_SAVE));
                return $inEditionMode && $saveButton->isDisplayed();
            } catch (\Throwable) {
                return false;
            }
        });



        $driver = $workarea->client()->getWebDriver();
        // Wait for edit mode or TinyMCE container to be present
        $driver->wait(10)->until(function () use ($workarea, $idevice): bool {
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

// File: tests/E2E/Factory/IDeviceFactory.php

    /**
     * Finds the iDevice at position $index1, clicks its move-up button,
     * and waits until it appears at position $index1 - 1.
     */
    public static function moveUpAt(WorkareaPage $workarea, int $index1): void
    {
        // Cannot move the first iDevice up.
        if ($index1 <= 1) {
            return;
        }

        self::ensureReadyForNewAction($workarea);
        
        // 1) Before acting, capture the text of the iDevice at $index1 (e.g., "Second content").
        $textOfMovingDevice = self::visibleTextAt($workarea, $index1);

        // 2) Locate that iDevice.
        $ideviceToMove = self::findTextIdeviceAt($workarea, $index1);

        // 3) Click the ".btn-move-up" button inside that specific iDevice.
        self::clickIn(Selectors::IDEVICE_BTN_MOVE_UP, $ideviceToMove, $workarea);

        // 4) Wait and verify the result. Expected new position is $index1 - 1.
        $newIndex = $index1 - 1;
        $workarea->client()->getWebDriver()->wait(15, 200)->until(
            function () use ($workarea, $newIndex, $textOfMovingDevice): bool {
                try {
                    // On each retry, re-read the iDevice text now at the new position and match it.
                    return self::visibleTextAt($workarea, $newIndex) === $textOfMovingDevice;
                } catch (\Throwable) {
                    // If DOM is updating, keep waiting.
                    return false;
                }
            },
            // Failure message if no movement after 15 seconds.
            sprintf("Error: iDevice with text '%s' did not move to position %d.", $textOfMovingDevice, $newIndex)
        );
    }

    /**
     * Finds the iDevice at position $index1, clicks its move-down button,
     * and waits until it appears at position $index1 + 1.
     */
    public static function moveDownAt(WorkareaPage $workarea, int $index1): void
    {
        self::ensureReadyForNewAction($workarea);
        // Cannot move the last iDevice down.
        if ($index1 >= self::countText($workarea)) {
            return;
        }

        // 1) Capture the text of the iDevice that will be moved.
        $textOfMovingDevice = self::visibleTextAt($workarea, $index1);

        // 2) Locate that iDevice.
        $ideviceToMove = self::findTextIdeviceAt($workarea, $index1);

        // 3) Click its "move down" button.
        self::clickIn(Selectors::IDEVICE_BTN_MOVE_DOWN, $ideviceToMove, $workarea);

        // 4) Wait until the captured text appears at the new position ($index1 + 1).
        $newIndex = $index1 + 1;
        $workarea->client()->getWebDriver()->wait(15, 200)->until(
            function () use ($workarea, $newIndex, $textOfMovingDevice): bool {
                try {
                    return self::visibleTextAt($workarea, $newIndex) === $textOfMovingDevice;
                } catch (\Throwable) {
                    return false;
                }
            },
            sprintf("Error: iDevice with text '%s' did not move to position %d.", $textOfMovingDevice, $newIndex)
        );
    }

    // /** Moves the i-th Text iDevice one position up. */
    // public static function moveUpAt(WorkareaPage $workarea, int $index1): void
    // {
    //     self::ensureReadyForNewAction($workarea);
    //     $idevice = self::findTextIdeviceAt($workarea, $index1);
    //     self::clickIn(Selectors::IDEVICE_BTN_MOVE_UP, $idevice, $workarea);
    //     // Wait for content to settle (overlay off + data-ready=true)
    //     self::waitContentReady($workarea, 10);

    // }

    // /** Moves the i-th Text iDevice one position down. */
    // public static function moveDownAt(WorkareaPage $workarea, int $index1): void
    // {
    //     self::ensureReadyForNewAction($workarea);
    //     $idevice = self::findTextIdeviceAt($workarea, $index1);
    //     self::clickIn(Selectors::IDEVICE_BTN_MOVE_DOWN, $idevice, $workarea);
    //     self::waitContentReady($workarea, 10);
    // }

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
        self::clickIn(Selectors::IDEVICE_MENU_CLONE, $idevice, $workarea);
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
    // Box-scoped iDevice helpers
    // ------------------------------------------------------------------

    /** Returns how many Text iDevices are inside the N-th box (1-based). */
    public static function countTextInBox(WorkareaPage $workarea, int $boxIndex1): int
    {
        $box = self::findBoxAt($workarea, $boxIndex1);
        return \count($box->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_TEXT)));
    }

    /** Returns the visible text for the i-th Text iDevice inside the N-th box (1-based). */
    public static function visibleTextAtInBox(WorkareaPage $workarea, int $boxIndex1, int $ideviceIndex1): string
    {
        $idev = self::findTextIdeviceAtInBox($workarea, $boxIndex1, $ideviceIndex1);
        $content = self::findWithin($idev, Selectors::IDEVICE_TEXT_CONTENT, false);
        return $content ? trim((string) $content->getText()) : '';
    }

    /** Moves the i-th iDevice up within the specified box. */
    public static function moveUpAtInBox(WorkareaPage $workarea, int $boxIndex1, int $ideviceIndex1): void
    {
        self::ensureReadyForNewAction($workarea);
        if ($ideviceIndex1 <= 1) {
            throw new \RuntimeException('Cannot move the first iDevice up in its box.');
        }
        $count = self::countTextInBox($workarea, $boxIndex1);
        if ($count === 1) {
            throw new \RuntimeException('Cannot move iDevice within a box that contains only one iDevice.');
        }
        $text = self::visibleTextAtInBox($workarea, $boxIndex1, $ideviceIndex1);
        $idevice = self::findTextIdeviceAtInBox($workarea, $boxIndex1, $ideviceIndex1);
        self::clickIn(Selectors::IDEVICE_BTN_MOVE_UP, $idevice, $workarea);
        $targetIndex = $ideviceIndex1 - 1;
        $driver = $workarea->client()->getWebDriver();
        $driver->wait(15, 200)->until(function () use ($workarea, $boxIndex1, $targetIndex, $text): bool {
            try {
                return self::visibleTextAtInBox($workarea, $boxIndex1, $targetIndex) === $text;
            } catch (\Throwable) { return false; }
        }, sprintf("Error: iDevice with text '%s' did not move up to index %d within its box.", $text, $targetIndex));
    }

    /** Moves the i-th iDevice down within the specified box. */
    public static function moveDownAtInBox(WorkareaPage $workarea, int $boxIndex1, int $ideviceIndex1): void
    {
        self::ensureReadyForNewAction($workarea);
        $count = self::countTextInBox($workarea, $boxIndex1);
        if ($count === 1) {
            throw new \RuntimeException('Cannot move iDevice within a box that contains only one iDevice.');
        }
        if ($ideviceIndex1 >= $count) {
            throw new \RuntimeException('Cannot move the last iDevice down in its box.');
        }
        $text = self::visibleTextAtInBox($workarea, $boxIndex1, $ideviceIndex1);
        $idevice = self::findTextIdeviceAtInBox($workarea, $boxIndex1, $ideviceIndex1);
        self::clickIn(Selectors::IDEVICE_BTN_MOVE_DOWN, $idevice, $workarea);
        $targetIndex = $ideviceIndex1 + 1;
        $driver = $workarea->client()->getWebDriver();
        $driver->wait(15, 200)->until(function () use ($workarea, $boxIndex1, $targetIndex, $text): bool {
            try {
                return self::visibleTextAtInBox($workarea, $boxIndex1, $targetIndex) === $text;
            } catch (\Throwable) { return false; }
        }, sprintf("Error: iDevice with text '%s' did not move down to index %d within its box.", $text, $targetIndex));
    }

    /** Duplicates the i-th iDevice within the specified box. */
    public static function duplicateAtInBox(WorkareaPage $workarea, int $boxIndex1, int $ideviceIndex1): void
    {
        self::ensureReadyForNewAction($workarea);
        $before = self::countTextInBox($workarea, $boxIndex1);
        $idevice = self::findTextIdeviceAtInBox($workarea, $boxIndex1, $ideviceIndex1);
        // Ensure read mode
        try {
            $btns = $idevice->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_BTN_SAVE));
            if (\count($btns) > 0) {
                self::clickIn(Selectors::IDEVICE_BTN_SAVE, $idevice, $workarea);
                Wait::settleDom(250);
            }
        } catch (\Throwable) {}
        self::clickIn(Selectors::IDEVICE_BTN_MORE_ACTIONS, $idevice, $workarea);
        Wait::settleDom(150);
        self::clickIn(Selectors::IDEVICE_MENU_CLONE, $idevice, $workarea);
        $workarea->client()->getWebDriver()->wait(6, 150)->until(function () use ($workarea, $boxIndex1, $before) {
            return self::countTextInBox($workarea, $boxIndex1) > $before;
        });
    }

    /** Deletes the i-th iDevice within the specified box. */
    public static function deleteAtInBox(WorkareaPage $workarea, int $boxIndex1, int $ideviceIndex1): void
    {
        self::ensureReadyForNewAction($workarea);
        $before = self::countTextInBox($workarea, $boxIndex1);
        $idevice = self::findTextIdeviceAtInBox($workarea, $boxIndex1, $ideviceIndex1);
        self::clickIn(Selectors::IDEVICE_BTN_DELETE, $idevice, $workarea);

        $driver = $workarea->client()->getWebDriver();
        // Confirm delete (may show two confirms if box becomes empty)
        for ($i = 0; $i < 2; $i++) {
            try {
                $driver->wait(3, 150)->until(function () use ($workarea): bool {
                    return (bool) $workarea->client()->executeScript(<<<'JS'
                        const m = document.querySelector('[data-testid="modal-confirm"][data-open="true"], #modalConfirm.show');
                        return !!m;
                    JS);
                });
                $btns = $driver->findElements(WebDriverBy::cssSelector(Selectors::MODAL_CONFIRM_ACTION));
                if (\count($btns) > 0) { self::safeClick($btns[0], $workarea); }
                Wait::settleDom(150);
            } catch (\Throwable) { break; }
        }
        // Wait count decreases within the box
        $driver->wait(8, 150)->until(function () use ($workarea, $boxIndex1, $before): bool {
            try { return self::countTextInBox($workarea, $boxIndex1) < $before; } catch (\Throwable) { return false; }
        });
    }

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    /** Finds the N-th box container (1-based). */
    private static function findBoxAt(WorkareaPage $workarea, int $boxIndex1): WebDriverElement
    {
        if ($boxIndex1 < 1) { throw new \InvalidArgumentException('Box index must be 1-based.'); }
        $driver = $workarea->client()->getWebDriver();
        $boxes = $driver->findElements(WebDriverBy::cssSelector(Selectors::BOX_ARTICLE));
        if (($boxIndex1 - 1) >= \count($boxes)) {
            throw new \OutOfBoundsException(sprintf('Requested box #%d but only %d available', $boxIndex1, \count($boxes)));
        }
        return $boxes[$boxIndex1 - 1];
    }

    /** Locates the i-th Text iDevice within the given box (1-based). */
    private static function findTextIdeviceAtInBox(WorkareaPage $workarea, int $boxIndex1, int $ideviceIndex1): WebDriverElement
    {
        $box = self::findBoxAt($workarea, $boxIndex1);
        if ($ideviceIndex1 < 1) { throw new \InvalidArgumentException('iDevice index must be 1-based.'); }
        $els = $box->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_TEXT));
        if (($ideviceIndex1 - 1) >= \count($els)) {
            throw new \OutOfBoundsException(sprintf('Requested iDevice #%d in box #%d but only %d available', $ideviceIndex1, $boxIndex1, \count($els)));
        }
        return $els[$ideviceIndex1 - 1];
    }

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

    /** Clicks a selector inside a container with retries and fallbacks. */
    private static function clickIn(string $css, WebDriverElement $scope, WorkareaPage $workarea): void
    {
        $driver = $workarea->client()->getWebDriver();
        for ($attempt = 0; $attempt < 3; $attempt++) {
            try {
                $el = self::findWithin($scope, $css, true);
                self::safeClick($el, $workarea);
                return;
            } catch (\Facebook\WebDriver\Exception\StaleElementReferenceException|\RuntimeException|\Throwable $e) {
                // Try global lookup as a fallback (scope might have gone stale)
                try {
                    $candidates = $driver->findElements(WebDriverBy::cssSelector($css));
                    if (\count($candidates) > 0) {
                        self::safeClick($candidates[0], $workarea);
                        return;
                    }
                } catch (\Throwable) {
                    // ignore and retry
                }
                usleep(150_000);
            }
        }
        throw new \RuntimeException("Unable to click selector '$css' after retries.");
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
