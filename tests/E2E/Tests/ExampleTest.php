<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\Factory\NodeFactory;
use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;

final class ExampleTest extends BaseE2ETestCase
{
    public function test_guest_session_create_document_and_nodes(): void
    {
        $client   = $this->openWorkareaInNewBrowser('A');
        $workarea = DocumentFactory::open($client);
        $document = \App\Tests\E2E\Model\Document::fromWorkarea($workarea);

        $nodeFactory = new NodeFactory();
        $parent = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => 'New Example Node',
        ]);
        $parent->assertVisible('New Example Node');

        $child = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => 'Child Example Node',
            'parent'   => $parent,
        ]);
        $child->assertVisible('Child Example Node');

        // Preview roundtrip
        $preview = $workarea->clickPreview();
        $this->assertNotEmpty($preview->getTitle());
        $workarea = $preview->close();

        // Clean up
        $child->delete();
        $child->assertNotVisible('Child Example Node');
        $parent->delete();
        $parent->assertNotVisible('New Example Node');

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);        
    }
}
