<?php
declare(strict_types=1);

namespace App\Tests\E2E\RealTime;

use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\Factory\NodeFactory;
use App\Tests\E2E\Model\Document;
use App\Tests\E2E\Model\Node;
use App\Tests\E2E\PageObject\WorkareaPage;
use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;
use App\Tests\E2E\Support\RealTimeCollaborationTrait;

/**
 * Real-time collaboration test for Node operations (create/rename/delete).
 *
 * Scenario:
 *  - Two users join the same session.
 *  - Client A creates and edits nodes; Client B sees the changes live.
 *  - Client B creates and edits nodes; Client A sees the changes live.
 */
final class NodeRealTimeTest extends BaseE2ETestCase
{
    use RealTimeCollaborationTrait;

    public function test_nodes_changes_propagate_between_two_clients(): void
    {
        // 1) Open two logged-in browsers
        $clientA = $this->openWorkareaInNewBrowser('A');
        $clientB = $this->openWorkareaInNewBrowser('B');

        // Ensure the workarea is ready in A
        $workareaA = DocumentFactory::open($clientA);

        // 2) Share session from A and join with B
        $shareUrl = $this->getMainShareUrl($clientA);
        $this->assertNotEmpty($shareUrl, 'A share URL must be available to start collaboration.');
        $clientB->request('GET', $shareUrl);

        // Wait both see two connected users
        $clientA->getWebDriver()->navigate()->refresh();
        $this->assertSelectorExistsIn($clientA, '#exe-concurrent-users[num="2"]', 'Client A should see 2 connected users.');
        $this->assertSelectorExistsIn($clientB, '#exe-concurrent-users[num="2"]', 'Client B should see 2 connected users.');

        // Wrap B workarea after joining
        $workareaB = new WorkareaPage($clientB);

        // Build Document models bound to each client
        $docA = Document::fromWorkarea($workareaA);
        $docB = Document::fromWorkarea($workareaB);
        $rootA = $docA->getRootNode();
        $rootB = $docB->getRootNode();

        $factory = new NodeFactory();

        // -----------------------
        // A → B propagation
        // -----------------------

        // A creates a node
        $a1Title   = 'RT A1 ' . uniqid();
        $a1        = $factory->createAndGet([
            'document' => $docA,
            'parent'   => $rootA,
            'title'    => $a1Title,
        ]);

        // B sees it (allow extra time for initial propagation)
        (new Node($a1Title, $workareaB, $a1->getId(), $rootB))->assertVisible($a1Title, 60, true);

        // A renames the node
        $a1Renamed = $a1Title . ' (renamed)';
        $a1->rename($a1Renamed);
        // B sees rename
        (new Node($a1Renamed, $workareaB, $a1->getId(), $rootB))->assertVisible($a1Renamed, 60, true);
        (new Node($a1Title, $workareaB, null, $rootB))->assertNotVisible($a1Title, 60, true);

        // A creates and then deletes another node
        $a2Title = 'RT A2 ' . uniqid();
        $a2      = $factory->createAndGet([
            'document' => $docA,
            'parent'   => $rootA,
            'title'    => $a2Title,
        ]);
        (new Node($a2Title, $workareaB, $a2->getId(), $rootB))->assertVisible($a2Title, 60, true);
        $a2->delete();
        (new Node($a2Title, $workareaB, $a2->getId(), $rootB))->assertNotVisible($a2Title, 60, true);

        // -----------------------
        // B → A propagation
        // -----------------------

        // B creates a node
        $b1Title = 'RT B1 ' . uniqid();
        $b1      = $factory->createAndGet([
            'document' => $docB,
            'parent'   => $rootB,
            'title'    => $b1Title,
        ]);
        // A sees it (allow extra time for propagation)
        (new Node($b1Title, $workareaA, $b1->getId(), $rootA))->assertVisible($b1Title, 60, true);

        // B renames
        $b1Renamed = $b1Title . ' (renamed)';
        $b1->rename($b1Renamed);
        // A sees rename
        (new Node($b1Renamed, $workareaA, $b1->getId(), $rootA))->assertVisible($b1Renamed, 60, true);
        (new Node($b1Title, $workareaA, null, $rootA))->assertNotVisible($b1Title, 60, true);

        // B deletes
        $b1->delete();
        (new Node($b1Renamed, $workareaA, $b1->getId(), $rootA))->assertNotVisible($b1Renamed, 60, true);

        // Final console checks
        Console::assertNoBrowserErrors($clientA);
        Console::assertNoBrowserErrors($clientB);
    }
}
