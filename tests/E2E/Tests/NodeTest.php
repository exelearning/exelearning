<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\Factory\NodeFactory;
use App\Tests\E2E\Model\Document;
use App\Tests\E2E\Model\Node;
use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;

/**
 * E2E: Node creation and operations in a single scenario to reduce E2E overhead.
 *
 * This test:
 *  - Creates a primary node and performs basic move/rename/duplicate/delete ops.
 *  - Creates multiple child nodes and deletes them in reverse order.
 *  - Creates a node with special characters in the title and deletes it.
 *  - Creates a node with a very long title and deletes it.
 *  - Builds a deep nested structure (level 1 -> level 2 -> level 3) and deletes bottom-up.
 */
final class NodeTest extends BaseE2ETestCase
{
    /**
     * Runs a comprehensive end-to-end flow exercising all node types and operations.
     */
    public function test_create_node_all_in_one(): void
    {
        // 1) Open logged-in workarea (already loads an "Untitled document")
        $client   = $this->openWorkareaInNewBrowser('A');
        $workarea = DocumentFactory::open($client);

        // 2) Wrap current workarea into a Document model (no UI create)
        $document = Document::fromWorkarea($workarea);
        $document->refreshFromUi();


        $root     = $document->getRootNode();

        $nodeFactory = new NodeFactory();

        // ---------------------------
        // A) BASIC OPERATIONS
        // ---------------------------

        /** @var Node $primary */
        $primary = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => 'Primary Test Node',
            'parent'   => $root,
        ]);
        $primary->assertVisible('Primary Test Node');

        // Movement operations (tolerant if already at extremes)
        $primary->moveDown()->moveUp()->moveRight()->moveLeft();

        // Create a child, rename, duplicate, then delete the renamed one
        $childA = $primary->createChild('Child A');
        $childA->assertVisible('Child A');

        $childA->rename('Child A (renamed)');
        $childA->assertVisible('Child A (renamed)');

        $childA->duplicate();
        // We keep the duplicate in the tree; delete the renamed original
        $childA->delete();
        $childA->assertNotVisible('Child A (renamed)');

        // ---------------------------
        // B) MULTIPLE CHILD NODES + REVERSE DELETE
        // ---------------------------

        $createdChildren = [];
        for ($i = 1; $i <= 3; $i++) {
            $title = sprintf('Child Node %d %s', $i, uniqid());
            $child = $nodeFactory->createAndGet([
                'document' => $document,
                'title'    => $title,
                'parent'   => $primary,
            ]);
            $child->assertVisible($title);
            $createdChildren[] = [$child, $title];
        }

        // Delete in reverse order
        for ($i = count($createdChildren) - 1; $i >= 0; $i--) {
            /** @var Node $toDelete */
            [$toDelete, $title] = $createdChildren[$i];
            $toDelete->delete();
            $toDelete->assertNotVisible($title);
        }

        // ---------------------------
        // C) SPECIAL CHARACTERS TITLE
        // ---------------------------

        $specialTitle = 'Special & <> " \' % $ # @ ! ?';
        /** @var Node $specialNode */
        $specialNode = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => $specialTitle,
            'parent'   => $root,
        ]);
        $specialNode->assertVisible($specialTitle);

        $specialNode->delete();
        $specialNode->assertNotVisible($specialTitle);

        // ---------------------------
        // D) VERY LONG TITLE
        // ---------------------------

        $longTitle = 'This is a very long node title that exceeds the typical length of node names ' .
            'to test how the system handles long text in the navigation tree ' . uniqid();
        /** @var Node $longNode */
        $longNode = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => $longTitle,
            'parent'   => $root,
        ]);
        $longNode->assertVisible($longTitle);

        $longNode->delete();
        $longNode->assertNotVisible($longTitle);

        // ---------------------------
        // E) DEEP NESTED HIERARCHY (L1 -> L2 -> L3)
        // ---------------------------

        /** @var Node $level1 */
        $level1 = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => 'Level 1 Node',
            'parent'   => $root,
        ]);
        $level1->assertVisible('Level 1 Node');

        /** @var Node $level2 */
        $level2 = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => 'Level 2 Node',
            'parent'   => $level1,
        ]);
        $level2->assertVisible('Level 2 Node');

        /** @var Node $level3 */
        $level3 = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => 'Level 3 Node',
            'parent'   => $level2,
        ]);
        $level3->assertVisible('Level 3 Node');

        // Delete deepest to root
        $level3->delete();
        $level3->assertNotVisible('Level 3 Node');

        $level2->delete();
        $level2->assertNotVisible('Level 2 Node');

        $level1->delete();
        $level1->assertNotVisible('Level 1 Node');

        // ---------------------------
        // F) CLEANUP: remove the primary node created at the beginning
        // ---------------------------

        $primary->delete();
        $primary->assertNotVisible('Primary Test Node');

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);
    }
}
