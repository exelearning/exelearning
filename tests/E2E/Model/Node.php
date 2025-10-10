<?php
declare(strict_types=1);

namespace App\Tests\E2E\Model;

use App\Tests\E2E\PageObject\WorkareaPage;
use App\Tests\E2E\Support\Wait;

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
     */
    public function assertVisible(?string $title = null): void
    {
        $title  ??= $this->title;
        $client   = $this->workareaPage->getClient();

        // Poll until the text appears
        $client->getWebDriver()->wait(30)->until(function () use ($client, $title): bool {
            return (bool) $client->executeScript(
                "const name = arguments[0];
                 const spans = [...document.querySelectorAll('#nav_list .node-text-span')];
                 return spans.some(s => s.textContent.trim() === name);",
                [$title]
            );
        });

        $found = (bool) $client->executeScript(
            "const name = arguments[0];
             const spans = [...document.querySelectorAll('#nav_list .node-text-span')];
             return spans.some(s => s.textContent.trim() === name);",
            [$title]
        );

        \PHPUnit\Framework\Assert::assertTrue(
            $found,
            sprintf('Expected node "%s" to be visible in the tree', $title)
        );
    }

    /**
     * Assert that a node title is NOT visible in the nav tree (exact match).
     */
    public function assertNotVisible(?string $title = null): void
    {
        $title  ??= $this->title;
        $client   = $this->workareaPage->getClient();

        // Small settle
        \usleep(200_000);
        $found = (bool) $client->executeScript(
            "const name = arguments[0];
             const spans = [...document.querySelectorAll('#nav_list .node-text-span')];
             return spans.some(s => s.textContent.trim() === name);",
            [$title]
        );

        \PHPUnit\Framework\Assert::assertFalse(
            $found,
            sprintf('Node "%s" should not be visible in the tree', $title)
        );
    }
    
}
