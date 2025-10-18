<?php
declare(strict_types=1);

namespace App\Tests\E2E\Model;

use App\Tests\E2E\PageObject\WorkareaPage;
use App\Tests\E2E\Support\Wait;
use Facebook\WebDriver\Exception\TimeoutException;

/**
 * Value object representing a navigation node inside the workarea tree.
 * Provides high-level actions that internally use WorkareaPage.
 */
final class Node
{
    private string $title;
    private ?int $nodeId;
    private ?Node $parent;
    private WorkareaPage $workareaPage;
    private bool $deleted = false;

    public function __construct(
        string $title,
        WorkareaPage $workareaPage,
        ?int $nodeId = null,
        ?Node $parent = null
    ) {
        $this->title        = $title;
        $this->workareaPage = $workareaPage;
        $this->nodeId       = $nodeId;
        $this->parent       = $parent;
    }

    public function getTitle(): string { return $this->title; }
    public function getId(): ?int { return $this->nodeId; }
    public function getParent(): ?Node { return $this->parent; }
    public function isRoot(): bool { return $this->nodeId === 0; }
    public function isDeleted(): bool { return $this->deleted; }
    public function getWorkareaPage(): WorkareaPage { return $this->workareaPage; }

    public function setId(int $nodeId): self { $this->nodeId = $nodeId; return $this; }
    public function setParent(Node $parent): self { $this->parent = $parent; return $this; }

    /** Selects the node in the navigation panel. */
    public function select(): self
    {
        if ($this->deleted) {
            throw new \RuntimeException('Cannot select a node that has been deleted.');
        }
        $this->workareaPage->selectNode($this);
        return $this;
    }

    /** Deletes the node using the toolbar button. */
    public function delete(): bool
    {
        if ($this->isRoot() || $this->deleted) {
            return false;
        }
        $this->select();
        try {
            $this->workareaPage->deleteSelectedNode($this);
            $this->deleted = true;
            return true;
        } catch (\Throwable $e) {
            throw new \RuntimeException(sprintf('Unable to delete node "%s": %s', $this->title, $e->getMessage()), 0, $e);
        }
    }

    /** Duplicates the node using the toolbar button. */
    public function duplicate(): bool
    {
        if ($this->isRoot() || $this->deleted) {
            return false;
        }
        $this->select();
        $this->workareaPage->duplicateSelectedNode();

        // It's a complicated task, we should wait
        Wait::settleDom(500);

        return true;
    }

    /** Creates a child node via the standard UI flow. */
    public function createChild(string $title): Node
    {
        if ($this->deleted) {
            throw new \RuntimeException('Cannot create a child from a deleted node.');
        }
        return $this->workareaPage->createNewNode($this, $title);
    }

    /** Renames node by opening properties, changing title input and saving. */
    public function rename(string $newTitle): self
    {
        $this->select();
        $this->workareaPage->renameNode($this, $newTitle);

        // Update local cache
        $this->title = $newTitle;
        $this->workareaPage->selectNode($this);

        return $this;
    }

    /** Moves node up (previous sibling). */
    public function moveUp(): self
    {
        $this->select();
        $this->clickAndSettle('#menu_nav .action_move_prev');
        return $this;
    }

    /** Moves node down (next sibling). */
    public function moveDown(): self
    {
        $this->select();
        $this->clickAndSettle('#menu_nav .action_move_next');
        return $this;
    }

    /** Promotes node one level (left). */
    public function moveLeft(): self
    {
        $this->select();
        $this->clickAndSettle('#menu_nav .action_move_up');
        return $this;
    }

    /** Demotes node one level (right). */
    public function moveRight(): self
    {
        $this->select();
        $this->clickAndSettle('#menu_nav .action_move_down');
        return $this;
    }


  // /**
  //    * Helper: Clicks a navigation action and waits for the UI to stabilize.
  //    * Selects the node first, performs the click, and then waits for any loading screens.
  //    */
  //   private function clickNavActionAndWait(array $selectors): void
  //   {
  //       try {
  //           // Use WorkareaPage's robust click helper
  //           $this->workareaPage->clickFirstMatchingSelector($selectors);

  //           // Movement actions can reload parts of the UI.
  //           // Wait for any loading screen to disappear and the UI to be idle.
  //           $this->workareaPage->waitForLoadingScreenToDisappear(15);
  //           $this->workareaPage->waitUiQuiescent(15);
  //       } catch (\Throwable) {
  //           // Ignore the error if the button is disabled 
  //           // (e.g., trying to move the first node up).
  //       }
  //   }
    
  //   /** Moves node up one position (previous sibling). */
  //   public function moveUp(): self
  //   {
  //       $this->select();
  //       $this->clickNavActionAndWait(['#menu_nav .action_move_prev']);
  //       return $this;
  //   }

  //   /** Moves node down one position (next sibling). */
  //   public function moveDown(): self
  //   {
  //       $this->select();
  //       $this->clickNavActionAndWait(['#menu_nav .action_move_next']);
  //       return $this;
  //   }

  //   /** Promotes node one level (outdent/move left). */
  //   public function moveLeft(): self
  //   {
  //       $this->select();
  //       // Note: CSS class '.action_move_up' corresponds to the left arrow (promote)
  //       $this->clickNavActionAndWait(['#menu_nav .action_move_up']);
  //       return $this;
  //   }

  //   /** Demotes node one level (indent/move right). */
  //   public function moveRight(): self
  //   {
  //       $this->select();
  //       // Note: CSS class '.action_move_down' corresponds to the right arrow (demote)
  //       $this->clickNavActionAndWait(['#menu_nav .action_move_down']);
  //       return $this;
  //   }



    /** Helper: safe click with small settle time. */
    private function clickAndSettle(string $css): void
    {
        $driver = $this->workareaPage->getClient()->getWebDriver();
        try {
            $el = $driver->findElement(\Facebook\WebDriver\WebDriverBy::cssSelector($css));
            $driver->executeScript('arguments[0].scrollIntoView({block:"center"});', [$el]);
            usleep(150_000);
            try {
                $el->click();
            } catch (\Facebook\WebDriver\Exception\ElementClickInterceptedException) {
                $driver->executeScript('arguments[0].click();', [$el]);
            }
            usleep(250_000);
        } catch (\Throwable) {
            // ignore
        }
    }

    /** Factory helper to represent the root node in this workarea. */
    public static function createRoot(WorkareaPage $workareaPage): self
    {
        return new self('root', $workareaPage, 0, null);
    }


    /**
     * Assert that a node title is visible in the nav tree (exact match).
     * Optional $title to override the current node title (e.g., after rename).
     * $timeoutSeconds controls how long we wait for eventual consistency (e.g., real-time propagation).
     * When $refreshOnTimeout is true we will refresh the page once if the first wait expires.
     */
    public function assertVisible(?string $title = null, int $timeoutSeconds = 30, bool $refreshOnTimeout = false): void
    {
        $title   ??= $this->title;
        $client    = $this->workareaPage->getClient();

        $waitForPresence = function (int $seconds) use ($client, $title): void {
            $client->getWebDriver()
                ->wait($seconds, 250)
                ->until(fn (): bool => $this->nodeExistsInTree($title, $this->nodeId));
        };

        try {
            $waitForPresence(max(1, $timeoutSeconds));
        } catch (TimeoutException $first) {
            if (!$refreshOnTimeout) {
                throw $first;
            }

            $client->getWebDriver()->navigate()->refresh();
            Wait::settleDom(400);

            try {
                $waitForPresence(max(5, (int) ceil($timeoutSeconds / 2)));
            } catch (TimeoutException $second) {
                // Allow final assertion below to surface a clear failure message.
            }
        }

        $found = $this->nodeExistsInTree($title, $this->nodeId);

        \PHPUnit\Framework\Assert::assertTrue(
            $found,
            sprintf(
                'Expected node "%s"%s to be visible in the tree',
                $title,
                $this->nodeId !== null ? sprintf(' (id %s)', (string) $this->nodeId) : ''
            )
        );
    }

    /**
     * Assert that a node title is NOT visible in the nav tree (exact match).
     * $timeoutSeconds allows waiting for eventual disappearance (e.g., after remote rename/delete).
     * When $refreshWhileWaiting is true we refresh once if the first wait expires.
     */
    public function assertNotVisible(?string $title = null, int $timeoutSeconds = 1, bool $refreshWhileWaiting = false): void
    {
        $title   ??= $this->title;
        $client    = $this->workareaPage->getClient();

        $waitForAbsence = function (int $seconds) use ($client, $title): void {
            $client->getWebDriver()
                ->wait($seconds, 200)
                ->until(fn (): bool => !$this->nodeExistsInTree($title, $this->nodeId));
        };

        if ($timeoutSeconds > 0) {
            try {
                $waitForAbsence(max(1, $timeoutSeconds));
            } catch (TimeoutException $first) {
                if ($refreshWhileWaiting) {
                    $client->getWebDriver()->navigate()->refresh();
                    Wait::settleDom(400);

                    try {
                        $waitForAbsence(max(5, (int) ceil($timeoutSeconds / 2)));
                    } catch (TimeoutException $second) {
                        // Let the final assertion report the failure.
                    }
                }
            }
        } else {
            \usleep(200_000);
        }

        $stillThere = $this->nodeExistsInTree($title, $this->nodeId);

        \PHPUnit\Framework\Assert::assertFalse(
            $stillThere,
            sprintf(
                'Node "%s"%s should not be visible in the tree',
                $title,
                $this->nodeId !== null ? sprintf(' (id %s)', (string) $this->nodeId) : ''
            )
        );
    }

    private function nodeExistsInTree(?string $title, ?int $nodeId): bool
    {
        $client = $this->workareaPage->getClient();

        return (bool) $client->executeScript(
            "const expectedTitle = String(arguments[0] ?? '').trim();
             const expectedId = arguments[1] === null ? null : String(arguments[1]);
             const nodes = Array.from(document.querySelectorAll('[data-testid=\"nav-node\"], .nav-element[nav-id]'));
             for (const nav of nodes) {
                 const idAttr = nav.getAttribute('data-node-id') ?? nav.getAttribute('nav-id');
                 const span = nav.querySelector('.node-text-span');
                 const text = span && span.textContent ? span.textContent.trim() : '';
                 if (expectedId !== null && idAttr !== null && String(idAttr) === expectedId) {
                     return true;
                 }
                 if (expectedTitle && text === expectedTitle) {
                     return true;
                 }
             }
             return false;
            ",
            [$title, $nodeId]
        );
    }
    
}
