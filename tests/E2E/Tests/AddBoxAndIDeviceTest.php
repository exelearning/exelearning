<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Factory\BoxFactory;
use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\Factory\IDeviceFactory;
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

    public function test_add_edit_move_duplicate_and_delete_text_idevices(): void
    {
        // 1) Open a clean workarea and create a node to work with
        $client   = $this->openWorkareaInNewBrowser('B');
        $page     = DocumentFactory::open($client);
        $document = Document::fromWorkarea($page);
        $root     = $document->getRootNode();

        $nodeFactory = new NodeFactory();
        $testNode    = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => 'iDevice playground',
            'parent'   => $root,
        ]);
        $testNode->assertVisible('iDevice playground');

        // 2) Add 3 Text iDevices via quick button
        BoxFactory::createWithTextIDevice($page); // first
        IDeviceFactory::addText($page);           // second
        IDeviceFactory::addText($page);           // third


        // $this->markTestIncomplete('This test is still incomplete.');


        $this->assertGreaterThanOrEqual(3, IDeviceFactory::countText($page), 'Expected at least 3 Text iDevices');


        // 3) Edit each iDevice with distinctive text and save
        IDeviceFactory::editAndSaveTextAt($page, 1, 'First content');
        IDeviceFactory::editAndSaveTextAt($page, 2, 'Second content');
        IDeviceFactory::editAndSaveTextAt($page, 3, 'Third content');

        // 4) Move the 2nd iDevice up -> it should become the first in list
        IDeviceFactory::moveUpAt($page, 2);
        Wait::settleDom(300);
        $firstText = IDeviceFactory::visibleTextAt($page, 1);
        $this->assertStringContainsString('Second content', $firstText, 'After moving up, the second iDevice should be first');

        // 5) Duplicate the first iDevice using overflow menu
        $preCount = IDeviceFactory::countText($page);
        IDeviceFactory::duplicateAt($page, 1);
        $this->assertGreaterThan($preCount, IDeviceFactory::countText($page), 'Cloning should increase the iDevice count');

        // 6) Delete the last iDevice
        $current = IDeviceFactory::countText($page);
        IDeviceFactory::deleteAt($page, $current);
        $this->assertSame($current - 1, IDeviceFactory::countText($page), 'Deleting the last iDevice should reduce the count by 1');

        // 7) Sanity: no console errors
        Console::assertNoBrowserErrors($client);
    }
}
