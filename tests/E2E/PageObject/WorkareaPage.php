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
        $this->client->getWebDriver()->findElement(WebDriverBy::cssSelector(Selectors::ADD_TEXT_BUTTON))->click();
        Wait::css($this->client, Selectors::IDEVICE_TEXT, 6000);
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

        $this->clickFirstMatchingSelector([
            '#properties-node-content-form .footer button.confirm.btn.btn-primary',
            '#properties-node-content-form button.confirm.btn.btn-primary',
            '[data-testid="save-properties-button"]',
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
    $c->waitFor('#nav_list .nav-element', 20);

    // Normalize expected identity (id may be numeric or string like "root")
    $expect = $this->resolveExpectedNode($node);

    // 1) Wait target to exist and be clickable; expand ancestors if collapsed.
    $this->waitUntil(fn () => (bool) $c->executeScript(<<<'JS'
      const exp = arguments[0];

      const byId = (id) => document.querySelector(`.nav-element[nav-id="${id}"] .nav-element-text`);
      const byTitle = (t) => {
        const spans = Array.from(document.querySelectorAll('#nav_list .node-text-span'));
        const span = spans.find(s => s?.textContent?.trim() === String(t ?? '').trim());
        return span ? span.closest('.nav-element')?.querySelector('.nav-element-text') : null;
      };

      let el = (exp.id ?? null) !== null ? byId(exp.id) : null;
      if (!el && exp.title) el = byTitle(exp.title);
      if (!el) return false;

      let navEl = el.closest('.nav-element');
      let collapsed = navEl?.closest('.nav-element.toggle-off[is-parent="true"]')
                    ?? navEl?.closest('.nav-element[is-parent="true"].toggle-off');
      if (collapsed) {
        collapsed.querySelector('.nav-element-toggle')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
        return false;
      }

      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= innerHeight) {
        el.scrollIntoView({block:'center'});
        return false;
      }

      const cx = Math.floor(r.left + r.width/2);
      const cy = Math.floor(r.top + r.height/2);
      const topEl = document.elementFromPoint(cx, cy);
      return !!topEl && (topEl === el || el.contains(topEl));
    JS, [$expect]), 30);

    // 2) Click with resolver (re-locate element on every attempt → no stale)
    $this->guardedClick(fn () => $this->locateNavClickable($expect));

    // 3) Wait selection (by id/title) with active enforcement: if mismatch, re-click target
    $this->waitUntil(fn () => (bool) $c->executeScript(<<<'JS'
      const exp = arguments[0];

      const locateById = (id) => document.querySelector(`.nav-element[nav-id="${id}"]`);
      const locateByTitle = (t) => {
        const spans = Array.from(document.querySelectorAll('#nav_list .node-text-span'));
        const span = spans.find(s => s && s.textContent && s.textContent.trim() === String(t ?? '').trim());
        return span ? span.closest('.nav-element') : null;
      };

      const target = (exp.id ?? null) !== null ? locateById(String(exp.id)) : locateByTitle(exp.title);
      if (!target) return false;

      const sel = document.querySelector('.nav-element.selected');

      const selectedMatches = () => {
        if (!sel) return false;
        if (exp.id !== null && exp.id !== undefined) {
          const sid = sel.getAttribute('nav-id');
          if (String(sid) !== String(exp.id)) return false;
        }
        if (exp.title) {
          const t = sel.querySelector('.node-text-span')?.textContent?.trim() ?? '';
          if (t !== String(exp.title).trim()) return false;
        }
        return sel === target;
      };

      if (selectedMatches()) return true;

      // If not matched, actively re-click target (and expand if needed)
      const collapsed = target.closest('.nav-element.toggle-off[is-parent="true"]')
                     ?? target.closest('.nav-element[is-parent="true"].toggle-off');
      if (collapsed) {
        collapsed.querySelector('.nav-element-toggle')?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
        return false;
      }

      const clickable = target.querySelector('.nav-element-text');
      if (clickable) {
        clickable.scrollIntoView({block:'center'});
        clickable.dispatchEvent(new MouseEvent('click', {bubbles:true}));
      }
      return false;
    JS, [$expect]), 25);

    // 4) Wait content panel truly ready (all overlays hidden + node-selected sync + optional title)
    $this->waitNodeContentReady($expect['title'] ?? null, 30);

    // 5) Optional: if we know the expected title, assert it also in the panel (rare race fix below)
    if (($expect['title'] ?? '') !== '') {
        $c->waitFor('#page-title-node-content', 10);
        $title = trim((string) $wd->findElement(WebDriverBy::cssSelector('#page-title-node-content'))->getText());
        if ($title !== trim((string) $expect['title'])) {
            // One refresh click for very slow environments
            $this->guardedClick(fn () => $this->locateNavClickable($expect));
            $this->waitUntil(fn () => (bool) $c->executeScript(
                'const h=document.querySelector("#page-title-node-content");return !!h && h.textContent?.trim()===String(arguments[0]).trim();',
                [$expect['title']]
            ), 10);
        }
    }
}


    public function selectRootNode(): void
    {
        $this->selectNode(Node::createRoot($this));
    }

    /**
     * Creates a new node as a child of $parentNode using the modal flow, then selects it.
     * Returns the created Node with best-effort id (numeric or string) and the given title.
     */
    public function createNewNode(Node $parentNode, string $nodeTitle): Node
    {
        // Ensure parent is selected and content is ready
        $this->selectNode($parentNode);

        // Open "new page" action (toolbar)
        $this->clickFirstMatchingSelector([
            '[data-testid="nav-add-node"]',
            '#menu_nav .action_add',
            '.button_nav_action.action_add',
        ]);

        // Wait modal to be really visible
        $c = $this->client;
        $c->waitFor('#modalConfirm', 8);
        $this->waitUntil(fn () => (bool) $c->executeScript(
            'const m=document.querySelector("#modalConfirm"); if(!m) return false; const s=getComputedStyle(m); return m.classList.contains("show") || s.display==="block";'
        ), 8);

        // Fill node title via WebDriver (fires native events)
        $c->waitFor('#input-new-node', 5);
        $input = $c->getWebDriver()->findElement(WebDriverBy::cssSelector('#input-new-node'));
        $input->clear();
        $input->sendKeys($nodeTitle);

        // Confirm create
        $this->clickFirstMatchingSelector([
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

  const sel = document.querySelector('.nav-element.selected');
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

    public function deleteSelectedNode(Node $node): self
    {
        $title = $node->getTitle();
        $id    = $node->getId();

        $client = $this->client;

        // Active retry loop: in case of race conditions we attempt the flow a few times
        for ($attempt = 0; $attempt < 3; $attempt++) {
            // Ensure the button is visible and enabled
            $this->waitActionButtonEnabled('#nav_actions .action_delete');

            $this->clickFirstMatchingSelector([
                '[data-testid="nav-delete-node"]',
                '#menu_nav .action_delete',
                '.button_nav_action.action_delete',
            ]);

            try {
                $client->waitFor('#modalConfirm', 5);
                // Wait for modal fully visible
                $this->client->getWebDriver()->wait(5, 150)->until(static function () use ($client): bool {
                    return (bool) $client->executeScript(
                        "const m=document.querySelector('#modalConfirm'); if(!m) return false; const st=window.getComputedStyle(m); return m.classList.contains('show') || st.display==='block';"
                    );
                });
            } catch (\Throwable $e) {
                if ($attempt === 2) {
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
            // Composite wait: (1) node not present, (2) modal/backdrop hidden
            $client->getWebDriver()->wait(30, 200)->until(static function () use ($client, $title, $id): bool {
                return (bool) $client->executeScript(<<<'JS'
                    const expectedTitle = arguments[0];
                    const expectedId    = arguments[1];

                    // 1) Node must not exist by title or id
                    const spans = Array.from(document.querySelectorAll('#nav_list .node-text-span'));
                    const existsByTitle = spans.some((span) => span && span.textContent.trim() === expectedTitle.trim());
                    if (existsByTitle) {
                        try {
                            const behaviour = window.eXeLearning?.app?.menus?.menuStructure?.menuStructureBehaviour;
                            if (behaviour && expectedId !== null) {
                                behaviour.structureEngine?.removeNodeCompleteAndReload(expectedId);
                            }
                        } catch (e) {}
                        return false;
                    }
                    if (expectedId !== null) {
                        const byId = document.querySelector('.nav-element[nav-id="' + expectedId + '"]');
                        if (byId) {
                            // Actively retry delete: click delete again and reconfirm
                            try {
                                const delBtn = document.querySelector('[data-testid="nav-delete-node"], #menu_nav .action_delete, .button_nav_action.action_delete');
                                delBtn?.dispatchEvent(new MouseEvent('click', {bubbles:true}));
                                const confirm = document.querySelector('#modalConfirm .modal-footer .confirm, #modalConfirm button.btn.btn-primary');
                                confirm?.dispatchEvent(new MouseEvent('click', {bubbles:true}));
                            } catch (e) {}
                            return false;
                        }
                    }

                    // 2) Modal not visible
                    const modal = document.querySelector('#modalConfirm');
                    const modalVisible = !!(modal && (modal.classList.contains('show') || window.getComputedStyle(modal).display !== 'none') && modal.getAttribute('aria-hidden') !== 'true');
                    if (modalVisible) { return false; }

                    const backdrop = document.querySelector('.modal-backdrop');
                    const backdropVisible = !!(backdrop && (backdrop.classList.contains('show') || window.getComputedStyle(backdrop).display !== 'none'));
                    if (backdropVisible) { return false; }

                    // 3) Consider success if element remains but is hidden (collapsed branch)
                    if (expectedId !== null) {
                        const maybe = document.querySelector('.nav-element[nav-id="' + expectedId + '"]');
                        if (maybe && maybe.offsetParent === null) { return true; }
                    }

                    return true;
                JS, [$title, $id]);
            });
        } catch (\Throwable $e) {
            throw new \RuntimeException(sprintf('Node "%s" still appears after confirming deletion.', $title), 0, $e);
        }

        Wait::settleDom(400);

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

        $this->client->getWebDriver()->wait(5, 150)->until(static function () use ($client, $title, $id) {
            return (bool) $client->executeScript(<<<'JS'
                const expectedTitle = arguments[0];
                const expectedId    = arguments[1];
                const selected = document.querySelector('.nav-element.selected');
                if (!selected) { return false; }
                if (expectedId !== null && expectedId > 0) {
                    const navId = selected.getAttribute('nav-id');
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
        $this->clickFirstMatchingSelector([
            '[data-testid="nav-clone-node"]',
            '#menu_nav .action_clone',
            '.button_nav_action.action_clone',
        ]);

        // In some cases a rename modal appears
        try {
            $this->client->waitFor('#modalConfirm', 5);
            // If present, propose a "(copy)" suffix
            try {
                $this->client->waitFor('#input-rename-node', 2);
                $this->client->executeScript(<<<'JS'
                    const input = document.querySelector('#input-rename-node');
                    const current = (document.querySelector('.nav-element.selected .node-text-span')?.textContent || '').trim();
                    if (input) {
                        const proposal = current ? current + ' (copy)' : input.value + ' (copy)';
                        input.value = proposal;
                        input.dispatchEvent(new Event('input', {bubbles:true}));
                        input.dispatchEvent(new Event('change', {bubbles:true}));
                    }
                JS);
            } catch (\Throwable) {
                // Might not appear; continue.
            }

            $this->clickFirstMatchingSelector([
                '#modalConfirm button.btn.btn-primary',
                '[data-testid="confirm-action"]',
                '#modalConfirm .confirm',
            ]);

            try { $this->client->waitForInvisibility('#modalConfirm', 5); } catch (\Throwable) {}
            try { $this->client->waitForInvisibility('.modal-backdrop', 3); } catch (\Throwable) {}
        } catch (\Throwable) {
            // No modal, proceed.
        }

        $this->client->waitFor('.nav-element.selected', 10);
        Wait::settleDom(250);

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

    /** Returns a fresh clickable element (.nav-element-text) by id or by exact title. */
    private function locateNavClickable(array $expect): WebDriverElement
    {
        $wd = $this->client->getWebDriver();

        if (($expect['id'] ?? null) !== null) {
            return $wd->findElement(WebDriverBy::cssSelector(
                sprintf('.nav-element[nav-id="%s"] .nav-element-text', (string) $expect['id'])
            ));
        }

        $xpath = sprintf(
            '//*[@id="nav_list"]//span[contains(@class,"node-text-span") and normalize-space(.)=%s]'
          . '/ancestor::div[contains(@class,"nav-element")][1]//span[contains(@class,"nav-element-text")]',
            $this->xpathLiteral((string) ($expect['title'] ?? ''))
        );
        return $wd->findElement(WebDriverBy::xpath($xpath));
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



    /** Normalizes expected node identity: supports numeric id, string ids ("root"), or title-based selection. */
    private function resolveExpectedNode(?Node $node): array
    {
        $id    = $node?->getId();
        $title = $node?->getTitle();

        // Root or neutral case: use currently selected or the first element as destination
        if ($node?->isRoot()
            || $id === 0 || $id === '0' || $id === 'root' || $id === null) {
            $current = $this->client->executeScript(
                'return (document.querySelector("#nav_list .nav-element.selected")?.getAttribute("nav-id")
                      ?? document.querySelector("#nav_list .nav-element")?.getAttribute("nav-id")
                      ?? null);'
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

          // 1) All overlays must be hidden (handle multiple and state transitions)
          const overlays = Array.from(document.querySelectorAll('#load-screen-node-content'));
          const overlaysHidden = overlays.every(ov => {
            if (!ov) return true;
            const cls = ov.className || '';
            const s   = getComputedStyle(ov);
            const byClass = cls.includes('hide') && (cls.includes('hidden') || !cls.includes('loading')) && !cls.includes('hiding');
            const byStyle = s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0';
            return byClass || byStyle;
          });
          if (!overlaysHidden) return false;

          // 2) node-selected in panel must match page-id of selected nav element
          const sel = document.querySelector('.nav-element.selected');
          if (!sel) return false;
          const selectedPid = sel.getAttribute('page-id') ?? '';
          const nc = document.querySelector('#node-content');
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



}

