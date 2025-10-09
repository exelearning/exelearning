<?php
declare(strict_types=1);

namespace App\Tests\E2E\Model;

use App\Tests\E2E\PageObjects\WorkareaPage;
use App\Tests\E2E\Factory\NodeFactory;

/**
 * Class Node
 * 
 * Represents a node in the eXeLearning navigation tree.
 * This class facilitates interaction with nodes from E2E tests.
 */
class Block
{
    private string $title;
    private ?int $nodeId = null;
    private ?Node $parent = null;
    private WorkareaPage $workareaPage;
    
    /**
     * Constructor
     *
     * @param string $title Title of the node
     * @param WorkareaPage $workareaPage Workarea page instance
     * @param int|null $nodeId Optional node ID
     * @param Node|null $parent Optional parent node
     */
    public function __construct(
        string $title, 
        WorkareaPage $workareaPage, 
        ?int $nodeId = null,
        ?Node $parent = null,
    ) {
        $this->title = $title;
        $this->workareaPage = $workareaPage;
        $this->nodeId = $nodeId;
        $this->parent = $parent;
    }
    
    /**
     * Get the node title
     *
     * @return string
     */
    public function getTitle(): string
    {
        return $this->title;
    }
    
    /**
     * Get the node ID
     *
     * @return int|null
     */
    public function getId(): ?int
    {
        return $this->nodeId;
    }
    
    /**
     * Set the node ID
     *
     * @param int $nodeId
     * @return self
     */
    public function setId(int $nodeId): self
    {
        $this->nodeId = $nodeId;
        return $this;
    }
    
    /**
     * Get the parent node
     *
     * @return Node|null
     */
    public function getParent(): ?Node
    {
        return $this->parent;
    }
    
    /**
     * Set the parent node
     *
     * @param Node $parent
     * @return self
     */
    public function setParent(Node $parent): self
    {
        $this->parent = $parent;
        return $this;
    }
    
    /**
     * Get the associated workarea page
     *
     * @return WorkareaPage
     */
    public function getWorkareaPage(): WorkareaPage
    {
        return $this->workareaPage;
    }
    
    /**
     * Select this node in the interface
     *
     * @return self
     */
    public function select(): self
    {   
        return $this->workareaPage->selectNode($this);
    }
    
    /**
     * Delete this node
     *
     * @return bool Success of the operation
     */
    public function delete(): bool
    {        
        $this->select();
        $this->workareaPage->deleteSelectedNode();
        
        return true;
    }
    
    /**
     * Duplicate this node
     *
     * @return bool Success of the operation
     */
    public function duplicate(): bool
    {
        $this->select();
        $this->workareaPage->duplicateSelectedNode();
        
        return true;
    }
    
    /**
     * Create a child node
     *
     * @param string $title Title of the child node
     * @return Node The new child node
     */
    public function createChild(string $title): Node
    {
        // Select this node as parent
        $this->select();
        
        // Create the new node
        $this->workareaPage->createNewNode($this, $title);
        
        // Create and return Node object for the child
        $childNode = new Node(
            $title,
            $this->workareaPage,
            null, // nodeId not yet available
            $this,
            $this->factory
        );
        
        return $childNode;
    }
    
    /**
     * Static method to create a root node
     *
     * @param WorkareaPage $workareaPage
     * @return Node
     */
    public static function createRoot(WorkareaPage $workareaPage): Node
    {
        return new Node(
            'root',
            $workareaPage,
            0, // nodeId 0 for root
            null
        );
    }
    
    /**
     * Check if this node is the root
     *
     * @return bool
     */
    public function isRoot(): bool
    {
        return !$this->parent;
    }
}