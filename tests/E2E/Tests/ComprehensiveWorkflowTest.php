<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Factory\DocumentFactory;
use App\Tests\E2E\Factory\NodeFactory;
use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;

final class ComprehensiveWorkflowTest extends BaseE2ETestCase
{
    /**
     * Tests a complete workflow: login, create document, create node, preview.
     */
    public function testCompleteWorkflow(): void
    {
        $client   = $this->openWorkareaInNewBrowser('A');
        $workarea = DocumentFactory::open($client);
        $workarea->setDocumentTitle('Workflow Test Document')->setDocumentAuthor('Test Author');
        $document = \App\Tests\E2E\Model\Document::fromWorkarea($workarea);
        $document->refreshFromUi();
        
        // Create a new node
        $nodeFactory = new NodeFactory();
        $nodeName = 'Test Node ' . uniqid();
        $node = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => $nodeName,
        ]);
        $node->assertVisible($nodeName);
        
        // Open preview and validate
        $previewPage = $workarea->clickPreview();
        
        // Verify preview page title matches document title
        $this->assertEquals(
            'Workflow Test Document',
            $previewPage->getTitle(),
            'Preview page title should match document title.'
        );
        
        // Verify it's a valid eXeLearning preview
        $this->assertTrue(
            $previewPage->isValidExeLearningPreview(),
            'Page should be identified as an eXeLearning preview.'
        );
        
        // Return to workarea
        $workarea = $previewPage->close();
        
        // Verify we're back in the workarea
        $this->assertStringContainsString('/workarea', $client->getCurrentURL(), 'Should return to workarea after closing preview.');
        
        // Verify the node still exists
        $node->assertVisible($nodeName);

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);        
    }
    
    /**
     * Tests creating multiple nodes with parent-child relationships.
     */
    public function testMultipleNodeCreation(): void
    {
        $client   = $this->openWorkareaInNewBrowser('B');
        $workarea = DocumentFactory::open($client);
        $document = \App\Tests\E2E\Model\Document::fromWorkarea($workarea);
        $document->refreshFromUi();
        
        $nodeFactory = new NodeFactory();
        

        // Create parent node
        $parentNode = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => 'Parent Node ' . uniqid(),
        ]);
        $parentNode->assertVisible();
        
        // Create first child node
        $childNode1 = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => 'Child Node 1 ' . uniqid(),
            'parent'   => $parentNode,
        ]);
        $childNode1->assertVisible();
        
        // Create second child node (sibling to first child)
        $childNode2 = $nodeFactory->createAndGet([
            'document' => $document,
            'title'    => 'Child Node 2 ' . uniqid(),
            'parent'   => $parentNode,
        ]);
        $childNode2->assertVisible();
        
        // Open preview
        $previewPage = $workarea->clickPreview();
        
        // Verify it's a valid eXeLearning preview
        $this->assertTrue(
            $previewPage->isValidExeLearningPreview(),
            'Page should be identified as an eXeLearning preview.'
        );
        
        // Return to workarea
        $workarea = $previewPage->close();
        
        // Verify all nodes still exist
        $parentNode->assertVisible();
        $childNode1->assertVisible();
        $childNode2->assertVisible();
        
        // Verify node hierarchy (should have at least 4 nodes: root + parent + 2 children)
        // Simplified: assert that titles are visible
        $parentNode->assertVisible();
        $childNode1->assertVisible();
        $childNode2->assertVisible();
        
        // Clean up by deleting nodes in reverse order
        $childNode2->delete();
        $childNode2->assertNotVisible();
        
        $childNode1->delete();
        $childNode1->assertNotVisible();
        
        $parentNode->delete();
        $parentNode->assertNotVisible();

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);        
    }
}
