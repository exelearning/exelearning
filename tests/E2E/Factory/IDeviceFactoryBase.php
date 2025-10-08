<?php
declare(strict_types=1);

namespace App\Tests\E2E\Factory;

/**
 * Factory for creating and managing nodes
 */
class IDeviceFactoryBase implements FactoryInterface
{
    private array $createdNodes = [];
    
    /**
     * Create node and return ID
     */
    public function create(array $args = [])
    {
        $node = $this->createAndGet($args);
        return $node->getId();
    }
    
    /**
     * Create multiple nodes
     */
    public function createMany(int $count, array $args = []): array
    {
        $ids = [];
        for ($i = 0; $i < $count; $i++) {
            if (isset($args['title'])) {
                $args['title'] = $args['title'] . '_' . $i;
            }
            $ids[] = $this->create($args);
        }
        return $ids;
    }
    
    /**
     * Create node and return object
     */
    public function createAndGet(array $args = [])
    {
        // Required parameters check
        if (!isset($args['document'])) {
            throw new \InvalidArgumentException('document is required to create a node');
        }
        
        $document = $args['document'];
        $workareaPage = $document->getWorkareaPage();
        
        // Default values
        $defaults = [
            'title' => 'Node ' . uniqid(),
            'parent' => null,
        ];
        
        $data = array_merge($defaults, $args);
        
        // Select parent node if specified
        if ($data['parent']) {
            $workareaPage->selectNode($data['parent']->getTitle());
        }
        
        // Create node
        $workareaPage->createNewNode($data['title']);
        
        // Store reference to created node
        $data['workareaPage'] = $workareaPage;
        $this->createdNodes[$data['title']] = $data;
        
        // Return node object
        return $this->createNodeObject($data);
    }
    
    /**
     * Find or create node
     */
    public function findOrCreate(array $criteria, array $args = [])
    {
        // Check if we have a tracked node with this title
        if (isset($criteria['title']) && isset($this->createdNodes[$criteria['title']])) {
            return $this->createNodeObject($this->createdNodes[$criteria['title']]);
        }
        
        // Merge criteria into args
        foreach ($criteria as $key => $value) {
            if (!isset($args[$key])) {
                $args[$key] = $value;
            }
        }
        
        return $this->createAndGet($args);
    }
    
    /**
     * Check if node exists
     */
    public function exists(array $criteria): bool
    {
        // Simple check if we have tracked a node with this title
        if (isset($criteria['title'])) {
            return isset($this->createdNodes[$criteria['title']]);
        }
        return false;
    }
    
    /**
     * Delete node
     */
    public function delete($identifier): bool
    {
        // Get node title
        $title = is_string($identifier) ? $identifier : $identifier->getTitle();
        
        // Check if we have this node
        if (!isset($this->createdNodes[$title])) {
            return false;
        }
        
        // Get node data
        $data = $this->createdNodes[$title];
        $workareaPage = $data['workareaPage'];
        
        // Select and delete node
        $workareaPage->selectNode($title);
        $workareaPage->deleteSelectedNode();
        
        // Remove from tracking
        unset($this->createdNodes[$title]);
        
        return true;
    }
    
    /**
     * Duplicate node
     */
    public function duplicate($identifier): bool
    {
        // Get node title
        $title = is_string($identifier) ? $identifier : $identifier->getTitle();
        
        // Check if we have this node
        if (!isset($this->createdNodes[$title])) {
            return false;
        }
        
        // Get node data
        $data = $this->createdNodes[$title];
        $workareaPage = $data['workareaPage'];
        
        // Select node
        $workareaPage->selectNode($title);
        
        // Duplicate node
        $workareaPage->duplicateSelectedNode();
        
        // New node will have been created, but we don't have a reliable way
        // to get its title from here, so we can't track it
        
        return true;
    }
    
    /**
     * Cleanup nodes
     */
    public function cleanup(): void
    {
        // Delete all tracked nodes
        foreach (array_keys($this->createdNodes) as $title) {
            $this->delete($title);
        }
        
        $this->createdNodes = [];
    }
    
    /**
     * Create node object
     */
    private function createNodeObject(array $data)
    {
        // Create node object with needed methods
        $self = $this;
        
        return new class($data, $self) {
            private array $data;
            private NodeFactory $factory;
            
            public function __construct(array $data, NodeFactory $factory)
            {
                $this->data = $data;
                $this->factory = $factory;
            }
            
            public function getTitle(): string
            {
                return $this->data['title'];
            }
            
            public function getParent()
            {
                return $this->data['parent'] ?? null;
            }
            
            public function getId()
            {
                return $this->data['nodeId'];
            }
            
            public function delete(): void
            {
                $this->factory->delete($this->data['title']);
            }
        };
    }
}

// <?php
// declare(strict_types=1);

// namespace App\Tests\E2E\Factory;

// use App\Tests\E2E\PageObjects\WorkareaPage;
// use Symfony\Component\Panther\Client;
// use App\Tests\E2E\Utils\TestLogger;
// use App\Tests\E2E\Utils\ScreenshotUtils;
// use App\Tests\E2E\Utils\TestUtils;
// use Facebook\WebDriver\WebDriverBy;

// /**
//  * Factory for node operations in eXeLearning.
//  * Handles creation, deletion, duplication, and assertions for nodes.
//  */
// class NodeFactory
// {
//     /**
//      * @var Client
//      */
//     private Client $client;

//     /**
//      * @var WorkareaPage
//      */
//     private WorkareaPage $workareaPage;

//     /**
//      * Constructor.
//      *
//      * @param Client $client
//      * @param WorkareaPage $workareaPage
//      */
//     public function __construct(Client $client, WorkareaPage $workareaPage)
//     {
//         $this->client = $client;
//         $this->workareaPage = $workareaPage;
//     }

//     /**
//      * Creates a new node with the given name.
//      *
//      * @param string $nodeName Name for the new node
//      * @return self
//      */
//     public function createNode(string $nodeName): self
//     {
//         TestLogger::debug("Creating new node: $nodeName");

//         // Ensure any loading screen is gone before clicking
//         $this->ensureLoadingScreenGone();
            
//         try {
//             // Click the add node button in the navigation toolbar
//             TestLogger::debug("Clicking add node button");
//             $this->client->getCrawler()->filter('[data-testid="nav-add-node"]')->click();
            
//             // Wait for the modal to appear
//             TestLogger::debug("Waiting for node creation modal");
//             $this->client->waitFor('#modalConfirm', 5);
            
//             // Take a screenshot of the modal for debugging
//             ScreenshotUtils::takeScreenshot($this->client, 'NodeFactory', 'node_creation_modal');
            
//             // Find the input field - the actual ID is 'input-new-node'
//             TestLogger::debug("Looking for node name input field");
//             $inputField = $this->client->getCrawler()->filter('#input-new-node');
            
//             if ($inputField->count() > 0) {
//                 // Clear any existing value and set the new node name
//                 TestLogger::debug("Found input field, setting node name: $nodeName");
//                 $inputField->sendKeys($nodeName);
                
//                 // Click the confirm button
//                 TestLogger::debug("Clicking confirm button");
//                 $confirmButton = $this->client->getCrawler()->filter('[data-testid="confirm-action"]');
//                 if ($confirmButton->count() > 0) {
//                     $confirmButton->click();
//                 } else {
//                     // Fallback to other possible selectors
//                     $this->client->getCrawler()->filter('.modal-footer .btn-primary, button.confirm')->click();
//                 }
                
//                 // Wait for the modal to close
//                 TestLogger::debug("Waiting for modal to close");
//                 $this->client->waitForInvisibility('#modalConfirm', 5);
                
//                 // Wait for the node to be created and selected
//                 TestLogger::debug("Waiting for node to be selected");
//                 $this->client->waitFor('.nav-element.selected', 10);
                
//                 // Small delay to ensure UI updates are complete
//                 usleep(500000); // 500ms
                
//                 return $this;
//             } else {
//                 // If we can't find the specific input field, log the modal's HTML structure
//                 $modalHtml = $this->client->executeScript("
//                     return document.querySelector('#modalConfirm') ? 
//                         document.querySelector('#modalConfirm').innerHTML : 
//                         'Modal not found';
//                 ");
                
//                 TestLogger::error("Input field #input-new-node not found. Modal HTML: " . substr($modalHtml, 0, 500) . "...");
                
//                 // Try a more generic approach with JavaScript
//                 TestLogger::debug("Trying JavaScript approach to set node name");
//                 $success = $this->client->executeScript("
//                     // Find any input field in the modal
//                     const modal = document.querySelector('#modalConfirm');
//                     if (!modal) return false;
                    
//                     const inputs = modal.querySelectorAll('input[type=\"text\"]');
//                     if (inputs.length === 0) return false;
                    
//                     // Set the value in the first input field
//                     inputs[0].value = '$nodeName';
                    
//                     // Find and click the confirm button
//                     const confirmBtn = modal.querySelector('.btn-primary, .confirm, [data-testid=\"confirm-action\"]');
//                     if (confirmBtn) {
//                         confirmBtn.click();
//                         return true;
//                     }
                    
//                     return false;
//                 ");
                
//                 if ($success) {
//                     TestLogger::debug("JavaScript approach succeeded");
//                     // Wait for the modal to close
//                     $this->client->waitForInvisibility('#modalConfirm', 5);
//                     // Wait for the node to be created and selected
//                     $this->client->waitFor('.nav-element.selected', 10);
//                     usleep(500000); // 500ms
//                     return $this;
//                 }
                
//                 throw new \RuntimeException("Could not find input field for node name");
//             }
//         } catch (\Exception $e) {
//             TestLogger::error("Error creating node: " . $e->getMessage());
            
//             // Fallback to the WorkareaPage method
//             TestLogger::debug("Falling back to WorkareaPage method");
//             $this->workareaPage->createNewNode($nodeName);
            
//             return $this;
//         }
//     }

//     /**
//      * Deletes the currently selected node.
//      *
//      * @return self
//      */
//     public function deleteSelectedNode(): self
//     {
//         TestLogger::debug("Deleting selected node");
        
//         try {
//             // First ensure the node is properly selected
//             $isNodeSelected = $this->client->executeScript("
//                 return document.querySelector('.nav-element.selected') !== null;
//             ");
            
//             if (!$isNodeSelected) {
//                 TestLogger::warning("No node is currently selected for deletion");
//                 throw new \RuntimeException("No node is selected for deletion");
//             }
            
//             // Click the delete button using JavaScript for more reliability
//             $deleteButtonClicked = $this->client->executeScript("
//                 const deleteButton = document.querySelector('[data-testid=\"nav-delete-node\"]');
//                 if (deleteButton) {
//                     deleteButton.click();
//                     return true;
//                 }
//                 return false;
//             ");
            
//             if (!$deleteButtonClicked) {
//                 TestLogger::warning("Could not click delete button");
//                 throw new \RuntimeException("Delete button not found or not clickable");
//             }
            
//             // Wait for confirmation modal to appear
//             $this->client->waitFor('#modalConfirm', 5);
//             TestLogger::debug("Delete confirmation modal appeared");
            
//             // Take a small pause to ensure the modal is fully rendered
//             usleep(300000); // 300ms delay
            
//             // Take a screenshot for debugging
//             \App\Tests\E2E\Utils\ScreenshotUtils::takeScreenshot($this->client, 'NodeFactory', 'before_confirm_delete');
            
//             // Confirm deletion by clicking the confirm/yes button using JavaScript
//             $confirmButtonClicked = $this->client->executeScript("
//                 const confirmButton = document.querySelector('[data-testid=\"confirm-action\"]');
//                 if (confirmButton) {
//                     confirmButton.click();
//                     return true;
//                 }
                
//                 // Fallback to other selectors if needed
//                 const otherButtons = document.querySelectorAll(
//                     '.modal-confirm .btn-primary, .modal-confirm .btn-danger, ' +
//                     '.modal-dialog .btn-primary, .modal-footer .btn-primary'
//                 );
//                 if (otherButtons.length > 0) {
//                     otherButtons[0].click();
//                     return true;
//                 }
                
//                 return false;
//             ");
            
//             if (!$confirmButtonClicked) {
//                 TestLogger::warning("Could not click confirm button");
//                 throw new \RuntimeException("Confirm button not found or not clickable");
//             }
            
//             // Wait for the modal to close
//             $this->client->waitForInvisibility('#modalConfirm', 5);
            
//             // Wait for the deletion to complete
//             usleep(800000); // 800ms delay for DOM updates
            
//             TestLogger::debug("Node deletion completed successfully");
            
//         } catch (\Exception $e) {
//             TestLogger::error("Error during node deletion: " . $e->getMessage());
            
//             // Try to dismiss any modals that might be open
//             \App\Tests\E2E\Utils\ModalUtils::dismissAllModals($this->client);
            
//             // Rethrow the exception
//             throw $e;
//         }
        
//         return $this;
//     }

//     /**
//      * Duplicates the currently selected node.
//      *
//      * @return self
//      */
//     public function duplicateSelectedNode(): self
//     {
//         TestLogger::debug("Duplicating selected node");
        
//         // Get the current node count before duplication
//         $initialNodeCount = $this->countNodes();
//         TestLogger::debug("Initial node count before duplication: $initialNodeCount");
        
//         // Take a screenshot before duplication
//         ScreenshotUtils::takeScreenshot($this->client, 'NodeFactory', 'before_duplication');
        
//         // Click the clone button in the navigation toolbar
//         TestUtils::safeClick($this->client, '[data-testid="nav-clone-node"]', 10);
        
//         // Wait for confirmation modal if it appears
//         try {
//             $this->client->waitFor('#modalConfirm', 2);
//             TestLogger::debug("Clone confirmation modal appeared");
            
//             // Take a small pause to ensure the modal is fully rendered
//             usleep(300000); // 300ms
            
//             // Confirm cloning by clicking the confirm button
//             TestUtils::safeClick($this->client, '[data-testid="confirm-action"], .modal-footer .btn-primary', 5);
            
//         } catch (\Exception $e) {
//             // No confirmation modal appeared, which is fine
//             TestLogger::debug("No confirmation modal appeared for cloning");
//         }
        
//         // Wait for the duplication to complete and new node to be selected
//         $this->client->waitFor('.nav-element.selected', 10);
        
//         // Wait a bit longer to ensure all DOM updates are complete
//         usleep(1000000); // 1 second
        
//         // Take a screenshot after duplication
//         ScreenshotUtils::takeScreenshot($this->client, 'NodeFactory', 'after_duplication');
        
//         // Get the new node count and verify it increased
//         $newNodeCount = $this->countNodes();
//         TestLogger::debug("New node count after duplication: $newNodeCount");
        
//         if ($newNodeCount <= $initialNodeCount) {
//             TestLogger::warning("Node count did not increase after duplication. Before: $initialNodeCount, After: $newNodeCount");
//         }
        
//         return $this;
//     }

//     /**
//      * Renames the currently selected node.
//      *
//      * @param string $newName New name for the node
//      * @return self
//      */
//     public function renameSelectedNode(string $newName): self
//     {
//         TestLogger::debug("Renaming selected node to: $newName");
        
//         // Click the properties button to open node properties
//         $this->client->getCrawler()->filter('[data-testid="nav-node-properties"]')
//             ->click();
        
//         // Wait for the properties modal to appear
//         $this->client->waitFor('.modal-dialog, .modal-content', 5);
//         TestLogger::debug("Node properties modal appeared");
        
//         // Take a small pause to ensure the modal is fully rendered
//         usleep(300000); // 300ms delay
        
//         // Find the title input field in the properties modal
//         $titleInput = $this->client->getCrawler()->filter(
//             '.modal-dialog input[name="title"], ' .
//             '.modal-content input[name="title"], ' .
//             '.modal-body input[name="title"], ' .
//             'input.node-title-input'
//         );
        
//         if ($titleInput->count() > 0) {
//             // Clear the input and type new name
//             TestLogger::debug("Found title input field, setting new name");
//             $titleInput->sendKeys($newName);
            
//             // Click the save/apply button
//             $saveButtons = $this->client->getCrawler()->filter(
//                 '.modal-dialog .btn-primary, ' .
//                 '.modal-footer .btn-primary, ' .
//                 'button[data-testid="save-properties"], ' .
//                 'button[type="submit"]'
//             );
            
//             if ($saveButtons->count() > 0) {
//                 TestLogger::debug("Clicking save button to apply new name");
//                 $saveButtons->click();
//             } else {
//                 TestLogger::warning("Could not find save button, trying JavaScript submission");
//                 // Fallback: Use JavaScript to find and click the save button
//                 $this->client->executeScript('
//                     const saveButtons = document.querySelectorAll(
//                         ".modal-dialog .btn-primary, " +
//                         ".modal-footer .btn-primary, " +
//                         "button[data-testid=\'save-properties\'], " +
//                         "button[type=\'submit\']"
//                     );
//                     if (saveButtons.length > 0) {
//                         saveButtons[0].click();
//                     } else {
//                         // If no button found, try to submit the form
//                         const form = document.querySelector("form");
//                         if (form) form.submit();
//                     }
//                 ');
//             }
//         } else {
//             TestLogger::error("Could not find title input field in properties modal");
//             throw new \RuntimeException("Could not find title input field in properties modal");
//         }
        
//         // Wait for the modal to close and changes to apply
//         usleep(800000); // 800ms delay
        
//         return $this;
//     }

//     /**
//      * Gets the text of the currently selected node.
//      *
//      * @return string|null Node text or null if not found
//      */
//     public function getSelectedNodeText(): ?string
//     {
//         $nodeTextElement = $this->client->getCrawler()->filter('.nav-element.selected .node-text-span');
        
//         if ($nodeTextElement->count() > 0) {
//             return $nodeTextElement->text();
//         }
        
//         return null;
//     }

//     /**
//      * Asserts that a node with the given name exists.
//      *
//      * @param \PHPUnit\Framework\TestCase $testCase Test case for assertions
//      * @param string $nodeName Expected node name
//      * @return void
//      */
//     public function assertNodeExists(\PHPUnit\Framework\TestCase $testCase, string $nodeName): void
//     {
//         TestLogger::debug("Asserting node exists with name: $nodeName");
        
//         // Get all node text spans
//         $allNodeTexts = $this->client->getCrawler()->filter('.nav-element .node-text-span');
        
//         // Look for a node with matching text
//         $found = false;
//         foreach ($allNodeTexts as $element) {
//             if ($element->textContent === $nodeName) {
//                 $found = true;
//                 TestLogger::debug("Found node with text: $nodeName");
//                 break;
//             }
//         }
        
//         // Assert that we found a node with the expected name
//         $testCase->assertTrue(
//             $found,
//             "Could not find any node with name: $nodeName"
//         );
//     }

//     /**
//      * Asserts that the currently selected node has the expected name.
//      *
//      * @param \PHPUnit\Framework\TestCase $testCase Test case for assertions
//      * @param string $expectedNodeName Expected node name
//      * @return void
//      */
//     public function assertSelectedNodeName(\PHPUnit\Framework\TestCase $testCase, string $expectedNodeName): void
//     {
//         TestLogger::debug("Asserting selected node has name: $expectedNodeName");
        
//         // First, check if the selected node selector exists
//         $testCase->assertSelectorExists('.nav-element.selected', 'Selected node element should exist');
        
//         // Get the text of the currently selected node
//         $nodeTextElement = $this->client->getCrawler()->filter('.nav-element.selected .node-text-span');
        
//         if ($nodeTextElement->count() > 0) {
//             $foundNodeName = $nodeTextElement->text();
//             TestLogger::debug("Found selected node with text: $foundNodeName");
            
//             $testCase->assertEquals(
//                 $expectedNodeName,
//                 $foundNodeName,
//                 'The node name does not match the expected value'
//             );
//         } else {
//             TestLogger::warning("Selected node element exists but couldn't get text");
//             $testCase->fail("Could not get text of selected node");
//         }
//     }

//     /**
//      * Counts the total number of nodes in the navigation.
//      *
//      * @return int Number of nodes
//      */
//     public function countNodes(): int
//     {
//         try {
//             // Use JavaScript for more reliable node counting
//             $count = $this->client->executeScript("
//                 // Get all node elements, excluding the root node if needed
//                 const allNodes = document.querySelectorAll('.nav-element');
//                 return allNodes.length;
//             ");
            
//             TestLogger::debug("Node count: $count");
//             return (int)$count;
//         } catch (\Exception $e) {
//             TestLogger::warning("Error counting nodes: " . $e->getMessage());
            
//             // Fallback to crawler approach
//             $allNodes = $this->client->getCrawler()->filter('.nav-element');
//             $count = $allNodes->count();
//             TestLogger::debug("Node count (fallback method): $count");
//             return $count;
//         }
//     }
    
//     /**
//      * Moves the currently selected node up in the navigation tree.
//      *
//      * @return self
//      */
//     public function moveNodeUp(): self
//     {
//         TestLogger::debug("Moving node up");
        
//         // Click the move up button
//         $this->client->getCrawler()->filter('[data-testid="nav-move-up"]')
//             ->click();
        
//         // Wait for any potential confirmation modal
//         $this->handleConfirmationModalIfPresent();
        
//         // Wait for the move to complete
//         usleep(500000); // 500ms delay
        
//         return $this;
//     }
    
//     /**
//      * Moves the currently selected node down in the navigation tree.
//      *
//      * @return self
//      */
//     public function moveNodeDown(): self
//     {
//         TestLogger::debug("Moving node down");
        
//         // Click the move down button
//         $this->client->getCrawler()->filter('[data-testid="nav-move-down"]')
//             ->click();
        
//         // Wait for any potential confirmation modal
//         $this->handleConfirmationModalIfPresent();
        
//         // Wait for the move to complete
//         usleep(500000); // 500ms delay
        
//         return $this;
//     }
    
//     /**
//      * Moves the currently selected node left in the hierarchy (up one level).
//      *
//      * @return self
//      */
//     public function moveNodeLeft(): self
//     {
//         TestLogger::debug("Moving node left (up in hierarchy)");
        
//         // Click the move left button
//         $this->client->getCrawler()->filter('[data-testid="nav-move-left"]')
//             ->click();
        
//         // Wait for any potential confirmation modal
//         $this->handleConfirmationModalIfPresent();
        
//         // Wait for the move to complete
//         usleep(500000); // 500ms delay
        
//         return $this;
//     }
    
//     /**
//      * Moves the currently selected node right in the hierarchy (down one level).
//      *
//      * @return self
//      */
//     public function moveNodeRight(): self
//     {
//         TestLogger::debug("Moving node right (down in hierarchy)");
        
//         // Click the move right button
//         $this->client->getCrawler()->filter('[data-testid="nav-move-right"]')
//             ->click();
        
//         // Wait for any potential confirmation modal
//         $this->handleConfirmationModalIfPresent();
        
//         // Wait for the move to complete
//         usleep(500000); // 500ms delay
        
//         return $this;
//     }
    
//     /**
//      * Handles a confirmation modal if it appears.
//      *
//      * @return void
//      */
//     private function handleConfirmationModalIfPresent(): void
//     {
//         try {
//             // Check if a modal appears within a short timeout
//             $this->client->waitFor('.modal-confirm, .modal-dialog', 2);
//             TestLogger::debug("Confirmation modal appeared");
            
//             // Take a small pause to ensure the modal is fully rendered
//             usleep(300000); // 300ms delay
            
//             // Click the confirm button
//             $confirmButtons = $this->client->getCrawler()->filter(
//                 '.modal-confirm .btn-primary, .modal-dialog .btn-primary, ' .
//                 '.modal-footer .btn-primary, button[data-testid="confirm-action"]'
//             );
            
//             if ($confirmButtons->count() > 0) {
//                 TestLogger::debug("Clicking confirm button");
//                 $confirmButtons->click();
//             } else {
//                 TestLogger::warning("Could not find confirmation button, trying JavaScript confirmation");
//                 // Fallback: Use JavaScript to find and click the confirmation button
//                 $this->client->executeScript('
//                     const confirmButtons = document.querySelectorAll(
//                         ".modal-confirm .btn-primary, .modal-dialog .btn-primary, " +
//                         ".modal-footer .btn-primary, button[data-testid=\'confirm-action\']"
//                     );
//                     if (confirmButtons.length > 0) {
//                         confirmButtons[0].click();
//                     }
//                 ');
//             }
//         } catch (\Exception $e) {
//             // No confirmation modal appeared, which is fine
//             TestLogger::debug("No confirmation modal appeared");
//         }
//     }



//   /**
//      * Ensures loading screen is completely gone before proceeding.
//      * Delegates to the centralized WaitUtils class.
//      * 
//      * @return void
//      */
//     private function ensureLoadingScreenGone(): void
//     {
//         \App\Tests\E2E\Utils\WaitUtils::waitForLoadingScreenToDisappear($this->client);
        
//         // Give the browser a moment to process
//         usleep(500000); // 500ms
//     }

// }
