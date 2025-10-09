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


        $this->markTestIncomplete('This test is still incomplete.');


        // B sees it
        (new Node($a1Title, $workareaB, null, $rootB))->assertVisible($a1Title);

        // A renames the node
        $a1Renamed = $a1Title . ' (renamed)';
        $a1->rename($a1Renamed);
        // B sees rename
        (new Node($a1Renamed, $workareaB, null, $rootB))->assertVisible($a1Renamed);
        (new Node($a1Title, $workareaB, null, $rootB))->assertNotVisible($a1Title);

        // A creates and then deletes another node
        $a2Title = 'RT A2 ' . uniqid();
        $a2      = $factory->createAndGet([
            'document' => $docA,
            'parent'   => $rootA,
            'title'    => $a2Title,
        ]);
        (new Node($a2Title, $workareaB, null, $rootB))->assertVisible($a2Title);
        $a2->delete();
        // Wait explicitly for disappearance on B (real-time propagation can take a moment)
        $clientB->getWebDriver()->wait(15, 150)->until(function () use ($clientB, $a2Title): bool {
            return !(bool) $clientB->executeScript(
                "const name = arguments[0];\n                 const spans = [...document.querySelectorAll('#nav_list .node-text-span')];\n                 return spans.some(s => s.textContent && s.textContent.trim() === name.trim());",
                [$a2Title]
            );
        });
        (new Node($a2Title, $workareaB, null, $rootB))->assertNotVisible($a2Title);

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
        // A sees it
        (new Node($b1Title, $workareaA, null, $rootA))->assertVisible($b1Title);

        // B renames
        $b1Renamed = $b1Title . ' (renamed)';
        $b1->rename($b1Renamed);
        // A sees rename
        (new Node($b1Renamed, $workareaA, null, $rootA))->assertVisible($b1Renamed);
        (new Node($b1Title, $workareaA, null, $rootA))->assertNotVisible($b1Title);

        // B deletes
        $b1->delete();
        // Wait explicitly for disappearance on A as well
        $clientA->getWebDriver()->wait(15, 150)->until(function () use ($clientA, $b1Renamed): bool {
            return !(bool) $clientA->executeScript(
                "const name = arguments[0];\n                 const spans = [...document.querySelectorAll('#nav_list .node-text-span')];\n                 return spans.some(s => s.textContent && s.textContent.trim() === name.trim());",
                [$b1Renamed]
            );
        });
        (new Node($b1Renamed, $workareaA, null, $rootA))->assertNotVisible($b1Renamed);

        // Final console checks
        Console::assertNoBrowserErrors($clientA);
        Console::assertNoBrowserErrors($clientB);
    }
}
