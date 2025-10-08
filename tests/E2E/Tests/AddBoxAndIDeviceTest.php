<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Factory\BoxFactory;
use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\Factory\NodeFactory;
use App\Tests\E2E\Model\Document;
use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;
use App\Tests\E2E\Support\Selectors;
use App\Tests\E2E\Support\Wait;

/**
 * Adds a Box with a Text iDevice inside a newly created node and verifies it.
 */
final class AddBoxAndIDeviceTest extends BaseE2ETestCase
{
    public function test_add_box_with_text_idevice_via_quick_button(): void
    {
        // 1. Open the workarea and create models for the document and its root node.
        $client   = $this->openWorkareaInNewBrowser('A');
        $page     = DocumentFactory::open($client);
        $document = Document::fromWorkarea($page);
        $root     = $document->getRootNode();

        // 2. Create a new node. Actions will now target this node as it becomes selected.
        $nodeFactory = new NodeFactory();
        $testNode    = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => 'Test Node for iDevice',
            'parent'   => $root,
        ]);
        $testNode->assertVisible('Test Node for iDevice');

        // 3. With the new node selected, use the factory to add a box with a text iDevice.
        BoxFactory::createWithTextIDevice($page);

        // 4. Verify the box and iDevice were created in the new node's content area.
        $this->assertNotSame('', $page->firstBoxTitle(), 'Expected a box with a visible title');
        Wait::css($client, Selectors::IDEVICE_TEXT, 6000);

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);
    }
}