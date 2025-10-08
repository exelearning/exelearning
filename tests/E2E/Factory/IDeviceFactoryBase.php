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
