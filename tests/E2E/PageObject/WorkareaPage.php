<?php
declare(strict_types=1);

namespace App\Tests\E2E\PageObject;

use App\Tests\E2E\Model\Node;
use App\Tests\E2E\Support\Selectors;
use App\Tests\E2E\Support\Wait;
use Facebook\WebDriver\Exception\ElementClickInterceptedException;
use Facebook\WebDriver\Exception\TimeoutException;
use Facebook\WebDriver\Exception\StaleElementReferenceException;
use Facebook\WebDriver\Interactions\WebDriverActions;
use Facebook\WebDriver\WebDriverBy;
use Facebook\WebDriver\WebDriverElement;
use Symfony\Component\Panther\Client;

/**
 * Page Object for the main Workarea (editor) window.
 * Centralizes all DOM interactions for navigation tree and content panel.
 *
 * Notes:
 * - Prefer Panther's built-in waits for selectors (waitFor, waitForVisibility).
 * - For arbitrary predicates, use the private waitUntil() helper (WebDriverWait).
 * - Always re-locate elements right before clicking to avoid stale references.
 */
final class WorkareaPage
{
    public function __construct(private Client $client)
    {
    }

    public function client(): Client
    {
        return $this->client;
    }

    /** Backwards compatible alias retained for legacy helpers. */
    public function getClient(): Client
    {
        return $this->client;
    }

    /** Returns the current page title text (e.g., "Nodo 2"). */
    public function currentPageTitle(): string
    {
        Wait::css($this->client, Selectors::PAGE_TITLE);
        return trim((string) $this->client->getCrawler()->filter(Selectors::PAGE_TITLE)->text());
    }

    /** Clicks the "Add Text" convenience button inside the node content. */
    public function clickAddTextButton(): void
    {
        $wd = $this->client->getWebDriver();
        $c  = $this->client;

        // 1) Preferred: bottom quickbar button (data-testid)
        try {
            $c->waitFor(Selectors::QUICK_IDEVICE_TEXT, 2);
            $el = $wd->findElement(WebDriverBy::cssSelector(Selectors::QUICK_IDEVICE_TEXT));
            try {
                $wd->executeScript('arguments[0].scrollIntoView({block:"center"});', [$el]);
            } catch (\Throwable) {}
            try {
                $el->click();
            } catch (\Facebook\WebDriver\Exception\ElementNotInteractableException|\Facebook\WebDriver\Exception\ElementClickInterceptedException) {
                $wd->executeScript('arguments[0].click();', [$el]);
            }
            Wait::css($c, Selectors::IDEVICE_TEXT, 6000);
            return;
        } catch (\Throwable) {
            // not present, continue
        }

        // 2) Content convenience button (if present on empty pages)
        $quick = $wd->findElements(WebDriverBy::cssSelector(Selectors::ADD_TEXT_BUTTON));
        if (\count($quick) > 0) {
            try {
                $quick[0]->click();
            } catch (\Facebook\WebDriver\Exception\ElementClickInterceptedException|\Facebook\WebDriver\Exception\ElementNotInteractableException) {
                $wd->executeScript('arguments[0].click();', [$quick[0]]);
            }
            Wait::css($c, Selectors::IDEVICE_TEXT, 6000);
            return;
        }

        // 3) Fallback: use left iDevices menu (prefer testid if available)
        try {
            $c->waitFor(Selectors::IDEVICE_TEXT_TESTID, 2);
            $el = $wd->findElement(WebDriverBy::cssSelector(Selectors::IDEVICE_TEXT_TESTID));
            try { $wd->executeScript('arguments[0].scrollIntoView({block:"center"});', [$el]); } catch (\Throwable) {}
            try { $el->click(); } catch (\Throwable) { $wd->executeScript('arguments[0].click();', [$el]); }
            Wait::css($c, Selectors::IDEVICE_TEXT, 6000);
            return;
        } catch (\Throwable) {}

        // 4) Legacy fallback method (original left menu selector)
        $this->addTextIDeviceViaMenu();
    }

    /** Fallback flow: add Text iDevice using the iDevices menu on the left. */
    private function addTextIDeviceViaMenu(): void
    {
        $c  = $this->client;
        $wd = $this->client->getWebDriver();

        // Count before to assert an insertion actually occurred
        $before = \count($wd->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_TEXT)));

        // Ensure the menu is present and menu list is attached
        try { $c->waitFor(Selectors::IDEVICES_MENU, 8); } catch (\Throwable) {}
        try { $c->waitFor(Selectors::IDEVICES_MENU_LIST, 8); } catch (\Throwable) {}

        $items = $wd->findElements(WebDriverBy::cssSelector(Selectors::IDEVICES_MENU_TEXT));
        if (\count($items) === 0) {
            throw new \RuntimeException('Unable to locate "Text" iDevice in the iDevices menu');
        }

        $el = $items[0];
        try {
            $wd->executeScript('arguments[0].scrollIntoView({block:"center"});', [$el]);
            usleep(120_000);
            $el->click();
        } catch (\Facebook\WebDriver\Exception\ElementClickInterceptedException|\Facebook\WebDriver\Exception\ElementNotInteractableException) {
            $wd->executeScript('arguments[0].click();', [$el]);
        }

        // Wait until we detect one more Text iDevice than before
        $wd->wait(6, 150)->until(function () use ($wd, $before) {
            return \count($wd->findElements(WebDriverBy::cssSelector(Selectors::IDEVICE_TEXT))) > $before;
        });
        Wait::settleDom(200);
    }

    /** Returns the title of the first box present in node content. */
    public function firstBoxTitle(): string
    {
        Wait::css($this->client, Selectors::BOX_ARTICLE);
        $el = $this->client->getWebDriver()->findElement(WebDriverBy::cssSelector(Selectors::BOX_TITLE));
        return trim((string) $el->getText());
    }

    public function setDocumentTitle(string $title): self
    {
        $this->ensurePropertiesFormReady();

        $input = $this->findElementByCss([
            '#properties-node-content-form input[property="pp_title"]',
            'input[id^="pp_title-"]',
        ]);

        $input->clear();
        $input->sendKeys($title);

        // Click the "Save" button in properties modal/form (not the nav add page)
        $this->clickFirstMatchingSelector([
            '[data-testid="save-properties-button"]',
            '#properties-node-content-form .footer button.confirm.btn.btn-primary',
            '#properties-node-content-form button.confirm.btn.btn-primary',
        ]);


        $this->dismissPropertiesAlertIfPresent();
        $this->waitForLoadingScreenToDisappear();

        return $this;
    }

    public function getDocumentTitle(): string
    {
        $this->ensurePropertiesFormReady();

        return trim((string) $this->findElementByCss([
            '#properties-node-content-form input[property="pp_title"]',
            'input[id^="pp_title-"]',
        ])->getAttribute('value'));
    }

    public function setDocumentAuthor(string $author): self
    {
        $this->ensurePropertiesFormReady();

        $input = $this->findElementByCss([
            '#properties-node-content-form input[property="pp_author"]',
            'input[id^="pp_author-"]',
        ]);

        $input->clear();
        $input->sendKeys($author);

        $this->clickFirstMatchingSelector([
            '#properties-node-content-form .footer button.confirm.btn.btn-primary',
            '#properties-node-content-form button.confirm.btn.btn-primary',
            '[data-testid="save-properties-button"]',
        ]);

        $this->dismissPropertiesAlertIfPresent();
        $this->waitForLoadingScreenToDisappear();

        return $this;
    }

    public function getDocumentAuthor(): string
    {
        $this->ensurePropertiesFormReady();

        return trim((string) $this->findElementByCss([
            '#properties-node-content-form input[property="pp_author"]',
            'input[id^="pp_author-"]',
        ])->getAttribute('value'));
    }

    /**
     * Selects a node in the tree and waits until the content panel is truly ready.
     * - If $node is null/root: uses current selected or the first nav-element.
     * - If $node has id: selects by [nav-id] clicking ".nav-element-text".
     * - Otherwise selects by exact title.
     * Then:
     * - Waits selection (id/title) and content readiness (overlay(s) hidden + node-selected sync + optional title).
     */
    public function selectNode(?Node $node = null): void
    {
        $c  = $this->client;
        $wd = $c->getWebDriver();

        $this->waitForLoadingScreenToDisappear();
        $c->waitFor('[data-testid="nav-node"]', 20);
        // Ensure no modals/backdrops/overlays are blocking interactions
        $this->waitUiQuiescent(30);

    $expect = $this->resolveExpectedNode($node);

    // If we only got a title, resolve id once.
    if (($expect['id'] ?? null) === null && ($expect['title'] ?? '') !== '') {
        $resolved = $this->findNodeIdByTitle((string) $expect['title']);
        if ($resolved === null) {
            throw new \RuntimeException(sprintf('Node "%s" not found.', (string) $expect['title']));
        }
        $expect['id'] = $resolved;
    }

    // Ensure in viewport and clickable; try a few strategies if selection doesn't stick on the first try
    $attempts = [
        $this->selNodeTextById($expect['id']), // span inside the text button
        sprintf('[data-testid="nav-node-text"][data-node-id="%s"]', (string) $expect['id']),
        sprintf('[data-testid="nav-node"][data-node-id="%s"] .nav-element-text', (string) $expect['id']),
    ];

    $selectedOk = false;
    foreach ($attempts as $trySel) {
        try {
            $c->waitFor($trySel, 20);
            $this->guardedClick(fn () => $wd->findElement(WebDriverBy::cssSelector($trySel)));
        } catch (\Throwable) {
            // Try next selector
        }

        // Wait until selected nav matches expected id
        try {
            $this->waitUntil(fn () => (bool) $c->executeScript(<<<'JS'
                const id = String(arguments[0]);
                let sel = document.querySelector('[data-testid="nav-node"][data-selected="true"]');
                if (!sel) {
                    const inner = document.querySelector('.nav-element .nav-element-text.selected');
                    if (inner) sel = inner.closest('.nav-element');
                }
                if (!sel) sel = document.querySelector('.nav-element.selected');
                if (!sel) return false;
                const current = sel.getAttribute('data-node-id') || sel.getAttribute('nav-id');
                return String(current) === id;
            JS, [(string) $expect['id']]), 16);
            $selectedOk = true;
            break;
        } catch (\Throwable) {
            // Not selected yet; continue with next strategy
        }
    }

        // Content panel ready (reuse your robust method)
        $this->waitNodeContentReady($expect['title'] ?? null, 40);
    }


    public function selectRootNode(): void
    {
        $this->selectNode(Node::createRoot($this));
    }

// File: tests/E2E/PageObject/WorkareaPage.php

public function createNewNode(Node $parentNode, string $nodeTitle): Node
{
    $c = $this->client;
    
    // 1) Ensure the UI is stable before starting
    $this->waitUiQuiescent(15);
    if ($parentNode->isRoot()) {
        $this->openProjectSettings();
    } else {
        $this->selectNode($parentNode);
    }

    // 2) Open the dialog to add a new page
    $this->clickFirstMatchingSelector([
        '[data-testid="nav-add-page"]',
        '#menu_nav .action_add',
    ]);

    // 3) Wait for the modal to be visible and fill the title
    $this->waitUntil(fn () => (bool) $c->executeScript(<<<'JS'
        const m=document.querySelector('[data-testid="modal-confirm"], #modalConfirm');
        if(!m) return false; const s=getComputedStyle(m);
        return (m.getAttribute('data-open')==='true') || m.classList.contains('show') || s.display==='block';
    JS), 8);
    $c->waitFor('#input-new-node', 5);
    $input = $c->getWebDriver()->findElement(WebDriverBy::cssSelector('#input-new-node'));
    $input->clear();
    $input->sendKeys($nodeTitle);

    // 4) Confirm creation
    $this->clickFirstMatchingSelector([
        '[data-testid="confirm-action"]',
        '#modalConfirm .modal-footer .confirm',
    ]);

    // 5) [ROBUST WAIT 1] Wait until the node appears in the navigation tree.
    // This is the most important wait. Only verify its existence.
    $this->waitUntil(function () use ($c, $nodeTitle) {
        return $this->findNodeIdByTitle($nodeTitle) !== null;
    }, 30);

    // 6) Now that we know it exists, explicitly select it.
    // Use the existing robust `selectNode` method.
    $newNode = new Node($nodeTitle, $this);
    $this->selectNode($newNode);
    
    // 7. [ESPERA ROBUSTA 2] `selectNode` ya contiene `waitNodeContentReady`, 
    // so we are guaranteed the UI is fully synchronized.

    // 8. Recuperar el ID asignado para devolver un objeto Node completo.
    $id = $this->findNodeIdByTitle($nodeTitle);
    
    return new Node(
        $nodeTitle,
        $this,
        is_numeric($id) ? (int) $id : null,
        $parentNode
    );
}

    /**
     * Creates a new node as a child of $parentNode using the modal flow, then selects it.
     * Returns the created Node with best-effort id (numeric or string) and the given title.
     */
    public function createNewNode2(Node $parentNode, string $nodeTitle): Node
    {
        // Ensure appropriate context: if "root", open project settings instead of selecting a tree node
        if ($parentNode->isRoot()) {
            $this->openProjectSettings();
        } else {
            $this->selectNode($parentNode);
        }

        // Open "new page" action (toolbar)
        $this->clickFirstMatchingSelector([
            '[data-testid="nav-add-page"]',
            '#menu_nav .action_add',
            '.button_nav_action.action_add',
        ]);

        // Wait modal to be really visible
        $c = $this->client;
        try { $c->waitFor('[data-testid="modal-confirm"][data-open="true"]', 8); }
        catch (\Throwable) { $c->waitFor('#modalConfirm', 8); }
        $this->waitUntil(fn () => (bool) $c->executeScript(<<<'JS'
            const m=document.querySelector('[data-testid="modal-confirm"], #modalConfirm');
            if(!m) return false; const s=getComputedStyle(m);
            return (m.getAttribute('data-open')==='true') || m.classList.contains('show') || s.display==='block';
        JS), 8);

        // Fill node title via WebDriver (fires native events)
        $c->waitFor('#input-new-node', 5);
        $input = $c->getWebDriver()->findElement(WebDriverBy::cssSelector('#input-new-node'));
        $input->clear();
        $input->sendKeys($nodeTitle);

        // Confirm create
        $this->clickFirstMatchingSelector([
            '[data-testid="confirm-action"]',
            '#modalConfirm .modal-footer .confirm',
            '#modalConfirm button.btn.btn-primary',
            '#modalConfirm .confirm',
        ]);

        // Wait until the new node appears in the tree and is visible (expand if necessary)
        $this->waitUntil(fn () => (bool) $c->executeScript(<<<'JS'
          const t = String(arguments[0] ?? '').trim();
          const spans = Array.from(document.querySelectorAll('#nav_list .node-text-span'));
          const span  = spans.find(s => s?.textContent?.trim() === t);
          if (!span) return false;
          const nav   = span.closest('.nav-element');
          if (!nav) return false;

          const collapsed = nav.closest('.nav-element.toggle-off[is-parent="true"]')
                           ?? nav.closest('.nav-element[is-parent="true"].toggle-off');
          if (collapsed) {
            collapsed.querySelector('.nav-element-toggle')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
            return false;
          }
          nav.querySelector('.nav-element-text')?.scrollIntoView({block:'center'});
          return true;
JS, [$nodeTitle]), 20);

// Select the created node explicitly (click on ".nav-element-text")
$this->guardedClick(fn () => $this->locateNavClickable(['id' => null, 'title' => $nodeTitle]));

// Wait until the created node is actually selected; if not, actively select it.
$this->waitUntil(fn () => (bool) $c->executeScript(<<<'JS'
  const t = String(arguments[0]).trim();
  const findTarget = () => {
    const spans = Array.from(document.querySelectorAll('#nav_list .node-text-span'));
    const span  = spans.find(s => s && s.textContent && s.textContent.trim() === t);
    return span ? span.closest('.nav-element') : null;
  };
  const target = findTarget();
  if (!target) return false;

  // If target is collapsed within a parent, expand it
  const collapsed = target.closest('.nav-element.toggle-off[is-parent="true"]')
                 ?? target.closest('.nav-element[is-parent="true"].toggle-off');
  if (collapsed) {
    collapsed.querySelector('.nav-element-toggle')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
    return false;
  }

  let sel = document.querySelector('[data-testid="nav-node"][data-selected="true"]');
  if (!sel) {
    const inner = document.querySelector('.nav-element .nav-element-text.selected');
    if (inner) sel = inner.closest('.nav-element');
  }
  if (!sel) sel = document.querySelector('.nav-element.selected');
  if (sel !== target) {
    target.querySelector('.nav-element-text')?.scrollIntoView({block:'center'});
    target.querySelector('.nav-element-text')?.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    return false;
  }

  // Double-check label matches, then success
  const label = sel?.querySelector('.node-text-span')?.textContent?.trim() ?? '';
  return label === t;
JS, [$nodeTitle]), 60,60);

// Content panel synchronized (overlays + node-selected + title)
$this->waitNodeContentReady($nodeTitle, 30);

        // Read the assigned id (numeric or string like "root")
        $id = $c->executeScript(<<<'JS'
            const t = String(arguments[0]).trim();
            const span = Array.from(document.querySelectorAll('#nav_list .node-text-span'))
                         .find(s => s?.textContent?.trim() === t);
            if (!span) return null;
            const nav = span.closest('.nav-element');
            const val = nav?.getAttribute('nav-id');
            if (!val) return null;
            const n = parseInt(val, 10);
            return Number.isNaN(n) ? val : n;
        JS, [$nodeTitle]);

        return new Node(
            $nodeTitle,
            $this,
            is_numeric($id) ? (int) $id : (is_string($id) ? $id : null),
            $parentNode
        );
    }


/**
     * Waits until the given node is really gone from the tree (by id or by title)
     * and no blocking UI remains. Also ensures the selected item is not the deleted one.
     */
    private function waitNodeDeleted(string|int|null $id, ?string $title, int $timeoutSec): void
    {
        $c = $this->client;

        // First make sure the UI is not blocked
        $this->waitUiQuiescent(min($timeoutSec, 12));

        $this->client->getWebDriver()->wait($timeoutSec, 200)->until(function () use ($c, $id, $title): bool {
            return (bool) $c->executeScript(<<<'JS'
                const expectedId = arguments[0] == null ? null : String(arguments[0]);
                const expectedTitle = String(arguments[1] ?? '').trim();

                // 1) Node by id not present
                let byId = null;
                if (expectedId !== null) {
                    byId = document.querySelector('[data-testid="nav-node"][data-node-id="' + expectedId + '"]')
                        || document.querySelector('.nav-element[nav-id="' + expectedId + '"]');
                }

                // 2) Node by exact title not present
                let byTitle = false;
                if (expectedTitle) {
                    const spans = Array.from(document.querySelectorAll('#nav_list .node-text-span'));
                    byTitle = spans.some(s => (s.textContent || '').trim() === expectedTitle);
                }

                // 3) Selected node isn't the one we are deleting
                let sel = document.querySelector('[data-testid="nav-node"][data-selected="true"]');
                if (!sel) {
                    const inner = document.querySelector('.nav-element .nav-element-text.selected');
                    if (inner) sel = inner.closest('.nav-element');
                }
                if (!sel) sel = document.querySelector('.nav-element.selected');

                let selectedIsDeleted = false;
                if (sel && expectedId !== null) {
                    const sid = sel.getAttribute('data-node-id') || sel.getAttribute('nav-id');
                    selectedIsDeleted = String(sid) === expectedId;
                }
                if (sel && !selectedIsDeleted && expectedTitle) {
                    const label = sel.querySelector('.node-text-span');
                    if (label && label.textContent) {
                        selectedIsDeleted = label.textContent.trim() === expectedTitle;
                    }
                }

                // 4) No modal/backdrop visible
                const modal = document.querySelector('#modalConfirm, [data-testid="modal-confirm"][data-open="true"]');
                const modalVisible =
                    !!(modal && ((modal.getAttribute('data-open') === 'true') ||
                                 modal.classList.contains('show') ||
                                 getComputedStyle(modal).display !== 'none'));
                const backdrop = document.querySelector('.modal-backdrop.show');
                const backdropVisible = !!backdrop;

                return !byId && !byTitle && !selectedIsDeleted && !modalVisible && !backdropVisible;
            JS, [$id, $title]);
        });
        Wait::settleDom(300);
    }

// File: tests/E2E/PageObject/WorkareaPage.php

    public function deleteSelectedNode(Node $node): self
    {
        $title = $node->getTitle();
        $id    = $node->getId();
        $client = $this->client;

        // Retry loop for the click flow:
        // 1) Click the delete button
        // 2) Wait and verify that the confirmation modal appears
        // 3) Click the confirm button in the modal
        for ($attempt = 0; $attempt < 3; $attempt++) {
            try {
                // Ensure the delete button is visible and enabled
                $this->waitActionButtonEnabled('[data-testid="nav-delete"]');
                $this->clickFirstMatchingSelector([
                    '[data-testid="nav-delete"]',
                    '#menu_nav .action_delete',
                    '.button_nav_action.action_delete',
                ]);

                // Wait until the confirmation modal is fully visible
                $this->waitUntil(static function () use ($client): bool {
                    return (bool) $client->executeScript(<<<'JS'
                        const m = document.querySelector('[data-testid="modal-confirm"], #modalConfirm');
                        if (!m) return false;
                        const opened = m.getAttribute('data-open') === 'true';
                        const st = getComputedStyle(m);
                        const legacy = (m.classList.contains('show') || st.display === 'block') && m.getAttribute('aria-hidden') !== 'true';
                        return opened || legacy;
                    JS);
                }, 15);

                // Click the final confirmation button
                $this->waitActionButtonEnabled('#modalConfirm .modal-footer .confirm');
                $this->clickFirstMatchingSelector([
                    '[data-testid="confirm-action"]',
                    '#modalConfirm .modal-footer .confirm',
                    '#modalConfirm button.btn.btn-primary',
                ]);

                // If all clicks succeeded, exit the retry loop
                break;

            } catch (\Throwable $e) {
                if ($attempt === 2) { // If it fails on the last attempt, throw the exception
                    throw new \RuntimeException(sprintf('Unable to complete delete flow for node "%s".', $title), 0, $e);
                }
                // Wait briefly before retrying to let the UI stabilize
                usleep(300_000);
            }
        }

        // Now perform a single robust wait to verify that the node has disappeared.
        try {
            // Use the existing `waitNodeDeleted` helper with a generous timeout.
            $this->waitNodeDeleted($id, $title, 60);
        } catch (\Throwable $e) {
            // If after 60 seconds the node still exists, consider it a real error.
            $errorMessage = sprintf('Node "%s" (ID: %s) still appears after confirming deletion.', $title, (string)$id);
            throw new \RuntimeException($errorMessage, 0, $e);
        }

        return $this;
    }

    public function deleteSelectedNode2(Node $node): self
    {
        $title = $node->getTitle();
        $id    = $node->getId();

        $client = $this->client;

        // Active retry loop: in case of race conditions we attempt the flow a few times
        for ($attempt = 0; $attempt < 3; $attempt++) {
            // Ensure the button is visible and enabled
            $this->waitActionButtonEnabled('[data-testid="nav-delete"]');
            $this->clickFirstMatchingSelector([
                '[data-testid="nav-delete"]',
                '#menu_nav .action_delete',
                '.button_nav_action.action_delete',
            ]);


        try {
            // Prefer explicit state via data-open
            try { $client->waitFor('[data-testid="modal-confirm"][data-open="true"]', 5); } catch (\Throwable) { $client->waitFor('#modalConfirm', 5); }
            // Wait for modal fully visible (data-open or legacy .show)
            $this->client->getWebDriver()->wait(15, 150)->until(static function () use ($client): bool {
                return (bool) $client->executeScript(<<<'JS'
                    const m = document.querySelector('[data-testid="modal-confirm"], #modalConfirm');
                    if (!m) return false;
                    const opened = m.getAttribute('data-open') === 'true';
                    const st = getComputedStyle(m);
                    const legacy = (m.classList.contains('show') || st.display === 'block') && m.getAttribute('aria-hidden') !== 'true';
                    return opened || legacy;
                JS);
            });
        } catch (\Throwable $e) {
            if ($attempt === 3) {
                throw new \RuntimeException(sprintf('Delete confirmation modal did not appear for node "%s".', $title), 0, $e);
            }
            continue; // retry flow
        }

            // Confirm delete (wait and click)
            $this->waitActionButtonEnabled('#modalConfirm .modal-footer .confirm');
            $this->clickFirstMatchingSelector([
                '#modalConfirm .modal-footer .confirm',
                '#modalConfirm button.btn.btn-primary',
                '[data-testid="confirm-delete-node-button"]',
                '[data-testid="confirm-action"]',
            ]);

            // Break retry loop; success condition is verified below
            break;
        }

        try {
            // Composite wait based on node id only: (1) node with id no longer present, (2) modal/backdrop hidden
            $client->getWebDriver()->wait(60, 200)->until(static function () use ($client, $id): bool {
                return (bool) $client->executeScript(<<<'JS'
                    const expectedId = arguments[0];
                    // 1) Node by id should not exist in the nav
                    if (expectedId !== null) {
                        const byId = document.querySelector('[data-testid="nav-node"][data-node-id="' + expectedId + '"]')
                                   || document.querySelector('.nav-element[nav-id="' + expectedId + '"]');
                        if (byId) {
                            // Ensure target is selected, then retry delete
                            try {
                                // Select the target node by dispatching a click on its text
                                const textBtn = byId.querySelector('.nav-element-text');
                                if (textBtn) {
                                    textBtn.dispatchEvent(new MouseEvent('click', {bubbles:true}));
                                }
                                const delBtn = document.querySelector('[data-testid="nav-delete"], #menu_nav .action_delete, .button_nav_action.action_delete');
                                delBtn?.dispatchEvent(new MouseEvent('click', {bubbles:true}));
                                const confirm = document.querySelector('#modalConfirm .modal-footer .confirm, #modalConfirm button.btn.btn-primary');
                                confirm?.dispatchEvent(new MouseEvent('click', {bubbles:true}));
                            } catch (e) {}
                            return false;
                        }
                    }

                    // 2) Modal/backdrop closed
                    const modal = document.querySelector('#modalConfirm');
                    const modalVisible = !!(modal && (modal.classList.contains('show') || window.getComputedStyle(modal).display !== 'none') && modal.getAttribute('aria-hidden') !== 'true');
                    if (modalVisible) return false;
                    const backdrop = document.querySelector('.modal-backdrop');
                    const backdropVisible = !!(backdrop && (backdrop.classList.contains('show') || window.getComputedStyle(backdrop).display !== 'none'));
                    if (backdropVisible) return false;

                    return true;
                JS, [$id]);
            });
        } catch (\Throwable $e) {
            throw new \RuntimeException(sprintf('Node "%s" still appears after confirming deletion.', $title), 0, $e);
        }


        try {
            $this->waitNodeDeleted($id, $title, 400);
        } catch (\Throwable $e) {
            throw new \RuntimeException(sprintf('Node "%s" still appears after confirming deletion.', $title), 0, $e);
        }

        // Wait::settleDom(400);

        return $this;
    }

    public function renameNode(Node $node, string $newTitle): void
    {
        $this->selectNode($node);

        $this->clickFirstMatchingSelector([
            '#menu_nav .button_nav_action.action_properties',
            '[data-testid="nav-properties-button"]',
            '.action_properties',
        ]);

        $this->client->waitFor('#modalProperties', 5);
        $this->client->waitFor('.property-value[property="titleNode"]', 5);

        $this->client->executeScript(
            "const input=document.querySelector('.property-value[property=\"titleNode\"]');" .
            "if(input){input.value=arguments[0];input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}",
            [$newTitle]
        );

        $this->clickFirstMatchingSelector([
            '#modalProperties .modal-footer .confirm.btn.btn-primary',
            '#modalProperties button.confirm.btn.btn-primary',
            '#modalProperties button.btn.btn-primary',
        ]);

        try {
            $this->client->waitForInvisibility('#modalProperties', 10);
        } catch (\Throwable) {
            // Modal might linger slightly longer; proceed regardless.
        }

        Wait::settleDom(300);
    }

    /**
     * Ensures the selected nav element belongs to the expected node (legacy helper).
     */
    private function waitForSelectionToMatchNode(?Node $expectedNode): void
    {
        if ($expectedNode === null || $expectedNode->isRoot()) {
            return;
        }

        $title = $expectedNode->getTitle();
        $id    = $expectedNode->getId();

        $client = $this->client;

        $this->client->getWebDriver()->wait(10, 150)->until(static function () use ($client, $title, $id) {
            return (bool) $client->executeScript(<<<'JS'
                const expectedTitle = arguments[0];
                const expectedId    = arguments[1];
                let selected = document.querySelector('[data-testid="nav-node"][data-selected="true"]');
                if (!selected) {
                    const inner = document.querySelector('.nav-element .nav-element-text.selected');
                    if (inner) selected = inner.closest('.nav-element');
                }
                if (!selected) selected = document.querySelector('.nav-element.selected');
                if (!selected) { return false; }
                if (expectedId !== null && expectedId > 0) {
                    const navId = selected.getAttribute('nav-id') || selected.getAttribute('data-node-id');
                    if (!navId || parseInt(navId, 10) !== expectedId) {
                        return false;
                    }
                }
                const label = selected.querySelector('.node-text-span');
                return label && label.textContent && label.textContent.trim() === expectedTitle.trim();
            JS, [$title, $id]);
        });
    }

    public function duplicateSelectedNode(): self
    {
        // 1) Trigger clone action
        $this->clickFirstMatchingSelector([
            '[data-testid="nav-clone"]',
            '#menu_nav .action_clone',
            '.button_nav_action.action_clone',
        ]);

        $c = $this->client;

        // 2) Handle the two-step modal flow robustly:
        //    a) Clone confirmation (content-id: clone-node-modal)
        //    b) Rename modal (content-id: rename-node-modal)

        // Small helper to detect current modal content-id
        $currentModalId = fn() => (string) $c->executeScript(<<<'JS'
            const m = document.querySelector('#modalConfirm[data-open="true"]');
            if (!m) return '';
            return m.querySelector('.modal-header')?.getAttribute('modal-content-id') || '';
        JS);

        // Wait until any confirm modal opens
        try { $c->waitFor('[data-testid="modal-confirm"][data-open="true"]', 6); } catch (\Throwable) {}

        // If the first modal is the clone confirmation, confirm it
        try {
            $id = $currentModalId();
            if ($id === 'clone-node-modal' || $id === '') {
                $this->clickFirstMatchingSelector([
                    '[data-testid="confirm-action"]',
                    '#modalConfirm .confirm',
                    '#modalConfirm button.btn.button-primary',
                ]);
            }
        } catch (\Throwable) {
            // ignore and continue to rename step
        }

        // 3) Wait for the rename modal and set a disambiguating name
        try {
            // Wait until the rename modal is visible
            $c->getWebDriver()->wait(10, 150)->until(function () use ($currentModalId) {
                return $currentModalId() === 'rename-node-modal';
            });

            // Fill input with "+ (copy)" suffix and confirm
            $c->waitFor('#input-rename-node', 5);
            $c->executeScript(<<<'JS'
                const input = document.querySelector('#input-rename-node');
                let sel = document.querySelector('[data-testid="nav-node"][data-selected="true"]');
                if (!sel) {
                    const inner = document.querySelector('.nav-element .nav-element-text.selected');
                    if (inner) sel = inner.closest('.nav-element');
                }
                if (!sel) sel = document.querySelector('.nav-element.selected');
                const current = (sel?.querySelector('.node-text-span')?.textContent || '').trim();
                if (input) {
                    const proposal = current ? current + ' (copy)' : (input.value || 'Page') + ' (copy)';
                    input.value = proposal;
                    input.dispatchEvent(new Event('input', {bubbles:true}));
                    input.dispatchEvent(new Event('change', {bubbles:true}));
                }
            JS);
            $this->clickFirstMatchingSelector([
                '[data-testid="confirm-action"]',
                '#modalConfirm .confirm',
                '#modalConfirm button.btn.button-primary',
            ]);
        } catch (\Throwable) {
            // If the rename modal never appeared, proceed — duplicate may keep the same title.
        }

        // 4) Ensure no confirm modal/backdrop remains visible
        try { $c->waitForInvisibility('#modalConfirm', 8); } catch (\Throwable) {}
        try { $c->waitForInvisibility('.modal-backdrop', 4); } catch (\Throwable) {}

        // 5) Wait for selection and a short settle
        $c->waitFor('.nav-element.selected', 10);
        Wait::settleDom(300);

        return $this;
    }

    public function clickPreview(): PreviewPage
    {
        return PreviewPage::openFrom($this->client);
    }

    /** Dismisses the "properties saved" alert if present. */
    private function dismissPropertiesAlertIfPresent(): void
    {
        try {
            $this->client->waitForVisibility('[data-testid="dismiss-modal-alert"]', 5);
            $this->clickFirstMatchingSelector(['[data-testid="dismiss-modal-alert"]']);
        } catch (\Throwable) {
            // Alert might not appear; nothing to do.
        }
    }

    /** Ensures the properties form is ready to be used. */
    private function ensurePropertiesFormReady(): void
    {
        try {
            Wait::css($this->client, '#properties-node-content-form', 8000);
            Wait::css($this->client, '#properties-node-content-form input[property="pp_title"]', 8000);
        } catch (\Throwable) {
            // Last attempt before callers query the field.
        }

        $this->waitForLoadingScreenToDisappear();
    }

    /**
     * Waits for the global loading screen to disappear (keeps your working version, which is stable).
     */
    private function waitForLoadingScreenToDisappear(int $timeout = 30): void
    {
        $client = $this->client;

        try {
            $this->client->getWebDriver()->wait($timeout)->until(static function () use ($client): bool {
                return (bool) $client->executeScript(
                    "const loading = document.querySelector('#load-screen-main');" .
                    "if (!loading) { return true; }" .
                    "const style = window.getComputedStyle(loading);" .
                    "return loading.classList.contains('hide') || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';"
                );
            });
        } catch (TimeoutException) {
            // Continue even if the loading overlay lingered longer than expected.
        }
    }

    /**
     * Waits until there is no blocking UI: no open modals/backdrops and content overlay not visible.
     */
    private function waitUiQuiescent(int $timeoutSec): void
    {
        $c = $this->client;
        $this->waitUntil(static function () use ($c): bool {
            return (bool) $c->executeScript(<<<'JS'
                // Best-effort: close any open modals politely
                const openModals = Array.from(document.querySelectorAll('.modal[data-open="true"]'));
                for (const m of openModals) {
                    // Try cancel/close buttons
                    const btn = m.querySelector('.modal-footer .cancel, .modal-header .close, .modal-footer .close');
                    if (btn) { btn.dispatchEvent(new MouseEvent('click', {bubbles:true})); }
                    // Fallback to Bootstrap hide API
                    try { const inst = bootstrap?.Modal?.getOrCreateInstance?.(m); inst?.hide?.(); } catch(e) {}
                }
                if (openModals.length > 0) return false;

                // No modal backdrop visible and body not locked
                const backdrop = document.querySelector('.modal-backdrop.show');
                if (backdrop) return false;
                if (document.body.classList.contains('modal-open')) return false;

                // Content overlay not visible (if present)
                const contentOverlay = document.querySelector('[data-testid="loading-content"]');
                if (contentOverlay && contentOverlay.getAttribute('data-visible') === 'true') return false;

                return true;
            JS);
        }, $timeoutSec, 150);
    }

    /**
     * Small helper to wait arbitrary predicates using WebDriverWait.
     * Use this for JS-based conditions; Panther's waitFor() only accepts selectors.
     */
    private function waitUntil(callable $predicate, int $timeoutSec = 20, int $intervalMs = 200): void
    {
        $this->client->getWebDriver()
            ->wait($timeoutSec, $intervalMs)
            ->until(static function () use ($predicate): bool {
                return (bool) $predicate();
            });
    }

    /** Opens project settings (root-level context) and waits until properties form is ready. */
    private function openProjectSettings(): void
    {
        // Click the top settings button
        $this->clickFirstMatchingSelector([
            '#head-top-settings-button',
        ]);

        // Wait for settings/properties to load in the content panel
        try {
            $this->client->waitFor('#properties-node-content-form', 8);
        } catch (\Throwable) {
            // Fallback: wait until content overlay is hidden and node-content is ready
            try { $this->client->waitFor('[data-testid="loading-content"][data-visible="false"]', 8); } catch (\Throwable) {}
            try { $this->client->waitFor('[data-testid="node-content"][data-ready="true"]', 8); } catch (\Throwable) {}
        }
        // Ensure no blocking UI remains
        $this->waitUiQuiescent(30);
    }

    /**
     * Find the first matching element by a list of CSS selectors.
     *
     * @param list<string> $selectors
     */
    private function findElementByCss(array $selectors): WebDriverElement
    {
        $driver = $this->client->getWebDriver();

        foreach ($selectors as $selector) {
            try {
                Wait::css($this->client, $selector, 6000);
                return $driver->findElement(WebDriverBy::cssSelector($selector));
            } catch (\Throwable) {
                // Try next selector.
            }
        }

        throw new \RuntimeException(sprintf(
            'Unable to locate element. Tried selectors: %s',
            implode(', ', $selectors)
        ));
    }

    /**
     * Clicks the first element that matches any of the given selectors.
     * Scrolls into view and uses DOM click as fallback if intercepted.
     *
     * @param list<string> $selectors
     */
    private function clickFirstMatchingSelector(array $selectors): void
    {
        $element = $this->findElementByCss($selectors);
        $driver  = $this->client->getWebDriver();

        try {
            $driver->executeScript('arguments[0].scrollIntoView({block:"center"});', [$element]);
        } catch (\Throwable) {
        }

        try {
            $element->click();
        } catch (\Facebook\WebDriver\Exception\ElementNotInteractableException|ElementClickInterceptedException|StaleElementReferenceException) {
            $driver->executeScript('arguments[0].click();', [$element]);
        }
    }

    /** Waits until a button (by CSS selector) is enabled and visible. */
    private function waitActionButtonEnabled(string $selector, int $timeoutSeconds = 5): void
    {
        $client = $this->client;
        $client->getWebDriver()->wait($timeoutSeconds)->until(static function () use ($client, $selector): bool {
            return (bool) $client->executeScript(
                'const el=document.querySelector(arguments[0]); return !!(el && !el.disabled && el.offsetParent!==null);',
                [$selector]
            );
        });
    }

    /** Waits until at least one of the selectors becomes visible. */
    private function waitForVisibilityOfAny(array $selectors, int $timeout): void
    {
        foreach ($selectors as $selector) {
            try {
                $this->client->waitForVisibility($selector, $timeout);
                return;
            } catch (\Throwable) {
                // try next selector
            }
        }

        throw new \RuntimeException(sprintf(
            'Unable to locate visible element for selectors: %s',
            implode(', ', $selectors)
        ));
    }

/** Returns clickable ".nav-element-text" using data-testid. */
private function locateNavClickable(array $expect): WebDriverElement
{
    $wd = $this->client->getWebDriver();

    // Prefer id path
    if (($expect['id'] ?? null) !== null) {
        return $wd->findElement(WebDriverBy::cssSelector(
            $this->selNodeTextById($expect['id'])
        ));
    }

    // Title → resolve to id once, then click by id selector
    $title = (string) ($expect['title'] ?? '');
    $id = $this->findNodeIdByTitle($title);
    if ($id === null) {
        throw new \RuntimeException(sprintf('Node with title "%s" not found.', $title));
    }

    return $wd->findElement(WebDriverBy::cssSelector(
        $this->selNodeTextById($id)
    ));
}


/**
 * Click with retries and re-location to defeat stale/intercepted issues.
 * Pass a resolver that returns a fresh clickable element on every attempt.
 *
 * @param callable():WebDriverElement $resolver
 */
private function guardedClick(callable $resolver, int $maxTries = 8): void
{
    $wd = $this->client->getWebDriver();

    for ($i = 0; $i < $maxTries; $i++) {
        try {
            $el = $resolver(); // always re-locate fresh element
            try { (new WebDriverActions($wd))->moveToElement($el)->perform(); } catch (\Throwable) {}
            $el->click();
            return;
        } catch (StaleElementReferenceException|ElementClickInterceptedException) {
            try {
                $el = $resolver();
                $wd->executeScript('arguments[0].click();', [$el]);
                return;
            } catch (\Throwable $e) {
                if ($i === $maxTries - 1) { throw $e; }
            }
        }
    }
}

/** Normalizes expected node identity using data-node-id first. */
private function resolveExpectedNode(?Node $node): array
{
    $id    = $node?->getId();
    $title = $node?->getTitle();

    // Root or null → use selected or the first rendered node
    if ($node?->isRoot() || $id === null || $id === 0 || $id === '0' || $id === 'root') {
        $current = $this->client->executeScript(
            'return (document.querySelector(".nav-element.selected")?.getAttribute("data-node-id")
                  ?? document.querySelector("[data-testid=\'nav-node\']")?.getAttribute("data-node-id")
                  ?? "root");'
        );
        return ['id' => $current, 'title' => null];
    }

    return ['id' => $id, 'title' => $title];
}

    /** Escapes a literal for XPath (handles both single and double quotes). */
    private function xpathLiteral(string $s): string
    {
        if (!str_contains($s, "'")) { return "'{$s}'"; }
        if (!str_contains($s, '"')) { return "\"{$s}\""; }
        $parts = preg_split('/(\'|")/', $s, -1, PREG_SPLIT_DELIM_CAPTURE);
        $out = 'concat(';
        $first = true;
        foreach ($parts as $p) {
            $piece = $p === "'" ? "\"'\"" : ($p === '"' ? '\'"\''
                     : "'" . $p . "'");
            if (!$first) { $out .= ','; }
            $out .= $piece;
            $first = false;
        }
        return $out . ')';
    }


/**
 * Wait until the content panel is truly ready:
 *  - ALL #load-screen-node-content overlays are hidden (no "loading"/"hiding"; display:none or class hide/hidden),
 *  - #node-content[node-selected] matches the selected nav-element page-id,
 *  - AND (optional) #page-title-node-content equals $expectedTitle.
 */
private function waitNodeContentReady(?string $expectedTitle, int $timeoutSec = 30): void
{
    $c = $this->client;

    $this->waitUntil(static function () use ($c, $expectedTitle): bool {
        return (bool) $c->executeScript(<<<'JS'
          const t = (arguments[0] ?? '').trim();

          // 1) Content overlay must not be visible; content should be ready
          const ov = document.querySelector('[data-testid="loading-content"]');
          if (ov && ov.getAttribute('data-visible') === 'true') return false;
          const nc = document.querySelector('[data-testid="node-content"]') || document.querySelector('#node-content');
          if (!nc) return false;
          if (nc.getAttribute('data-ready') && nc.getAttribute('data-ready') !== 'true') return false;

          // 2) node-selected in panel must match page-id of selected nav element
          let sel = document.querySelector('[data-testid="nav-node"][data-selected="true"]');
          if (!sel) {
            const inner = document.querySelector('.nav-element .nav-element-text.selected');
            if (inner) sel = inner.closest('.nav-element');
          }
          if (!sel) sel = document.querySelector('.nav-element.selected');
          if (!sel) return false;
          const selectedPid = sel.getAttribute('page-id') ?? '';
          const panelPid = nc?.getAttribute('node-selected') ?? '';
          if (!selectedPid || !panelPid || String(selectedPid) !== String(panelPid)) return false;

          // 3) Optional: content title
          if (t) {
            const h = document.querySelector('#page-title-node-content');
            if (!h || (h.textContent?.trim() !== t)) return false;
          }
          return true;
        JS, [$expectedTitle]);
    }, $timeoutSec);
}


/** Builds stable selectors for nav nodes by id (click on inner span to avoid nested button issues). */
private function selNodeTextById(string|int $id): string
{
    // before: [data-testid="nav-node-text"][data-node-id="%s"]
    return sprintf('[data-testid="nav-node-text"][data-node-id="%s"] .node-text-span', (string) $id);
}

private function selNodeById(string|int $id): string
{
    return sprintf('[data-testid="nav-node"][data-node-id="%s"]', (string) $id);
}

private function selNodeMenuById(string|int $id): string
{
    return sprintf('[data-testid="nav-node-menu"][data-node-id="%s"]', (string) $id);
}

private function selNodeToggleById(string|int $id): string
{
    return sprintf('[data-testid="nav-node-toggle"][data-node-id="%s"]', (string) $id);
}

/**
 * Finds a node-id by exact title text using the rendered tree.
 * Returns string|int node-id or null if not found.
 */
private function findNodeIdByTitle(string $title): string|int|null
{
    $id = $this->client->executeScript(<<<'JS'
        const t = String(arguments[0] ?? '').trim();
        const nodes = Array.from(document.querySelectorAll('[data-testid="nav-node"]'));
        for (const nav of nodes) {
          const span = nav.querySelector('.node-text-span');
          if (span && span.textContent && span.textContent.trim() === t) {
            return nav.getAttribute('data-node-id') ?? nav.getAttribute('nav-id') ?? null;
          }
        }
        return null;
    JS, [$title]);

    // normalize numeric ids
    if (is_string($id) && ctype_digit($id)) {
        return (int) $id;
    }
    return $id ?: null;
}

}
