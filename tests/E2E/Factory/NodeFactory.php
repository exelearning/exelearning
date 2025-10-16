<?php
declare(strict_types=1);

namespace App\Tests\E2E\Factory;

use App\Tests\E2E\Model\Document;
use App\Tests\E2E\Model\Node;

/**
 * UI-first Node factory.
 * Uses WorkareaPage's createNewNode() under the hood and keeps track of created nodes.
 */
final class NodeFactory
{
    /** @var array<string, Node> */
    private array $createdNodes = [];

    public function create(array $args = [])
    {
        return $this->createAndGet($args)->getId();
    }

    public function createMany(int $count, array $args = []): array
    {
        $ids = [];
        for ($i = 0; $i < $count; $i++) {
            $iteration = $args;
            if (isset($iteration['title']) && is_string($iteration['title'])) {
                $iteration['title'] = sprintf('%s_%d', $iteration['title'], $i + 1);
            }
            $ids[] = $this->create($iteration);
        }
        return $ids;
    }

    public function createAndGet(array $args = []): Node
    {
        if (!isset($args['document']) || !$args['document'] instanceof Document) {
            throw new \InvalidArgumentException('NodeFactory::createAndGet requires a Document instance in "document".');
        }

        /** @var Document $document */
        $document = $args['document'];
        unset($args['document']);

        $parent = $args['parent'] ?? null;
        if ($parent !== null && !$parent instanceof Node) {
            throw new \InvalidArgumentException('The "parent" option must be an instance of ' . Node::class);
        }

        $title = isset($args['title']) && is_string($args['title'])
            ? $args['title']
            : TestDataFactory::generateNodeName();

        $parentNode = $parent instanceof Node ? $parent : $document->getRootNode();

        // Ensure both refer to the same WorkareaPage
        if ($parentNode->getWorkareaPage() !== $document->getWorkareaPage()) {
            throw new \InvalidArgumentException('Parent node and document do not share the same WorkareaPage.');
        }

        // Create via UI
        $node = $document->getWorkareaPage()->createNewNode($parentNode, $title);

        $this->registerNode($node);
        return $node;
    }

    public function findOrCreate(array $criteria, array $args = []): Node
    {
        $node = $this->findTrackedNode($criteria);
        if ($node instanceof Node) {
            return $node;
        }

        $arguments = array_merge($args, $criteria);
        if (!isset($arguments['document']) || !$arguments['document'] instanceof Document) {
            throw new \InvalidArgumentException('Unable to create node – missing "document" argument.');
        }

        return $this->createAndGet($arguments);
    }

    public function exists(array $criteria): bool
    {
        return $this->findTrackedNode($criteria) instanceof Node;
    }

    public function delete($identifier): bool
    {
        $node = $this->resolveNode($identifier);
        if (!$node instanceof Node || $node->isRoot()) {
            return false;
        }

        $success = $node->delete();
        if ($success) {
            $this->unregisterNode($node);
        }
        return $success;
    }

    public function duplicate($identifier): bool
    {
        $node = $this->resolveNode($identifier);
        if (!$node instanceof Node) {
            return false;
        }
        return $node->duplicate();
    }

    public function cleanup(): void
    {
        foreach ($this->createdNodes as $hash => $node) {
            if ($node->isRoot() || $node->isDeleted()) {
                unset($this->createdNodes[$hash]);
                continue;
            }
            try { $node->delete(); } catch (\Throwable) {}
            unset($this->createdNodes[$hash]);
        }
    }

    // ---------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------

    /** @param array<string,mixed> $criteria */
    private function findTrackedNode(array $criteria): ?Node
    {
        foreach ($this->createdNodes as $node) {
            $matches = true;

            foreach ($criteria as $field => $value) {
                switch ($field) {
                    case 'id':
                        $matches = $node->getId() !== null && $node->getId() === (int)$value;
                        break;
                    case 'title':
                        $matches = $node->getTitle() === (string)$value;
                        break;
                    case 'parent':
                        $matches = $value instanceof Node
                            ? $node->getParent()?->getId() === $value->getId()
                            : false;
                        break;
                    case 'document':
                        $matches = $value instanceof Document
                            ? $node->getWorkareaPage() === $value->getWorkareaPage()
                            : false;
                        break;
                    default:
                        $matches = false;
                }
                if (!$matches) { break; }
            }

            if ($matches) {
                return $node;
            }
        }
        return null;
    }

    private function resolveNode($identifier): ?Node
    {
        if ($identifier instanceof Node) {
            return $identifier;
        }
        if (is_int($identifier) || (is_string($identifier) && ctype_digit($identifier))) {
            return $this->findTrackedNode(['id' => (int)$identifier]);
        }
        if (is_string($identifier)) {
            return $this->findTrackedNode(['title' => $identifier]);
        }
        return null;
    }

    private function registerNode(Node $node): void
    {
        $this->createdNodes[spl_object_hash($node)] = $node;
    }

    private function unregisterNode(Node $node): void
    {
        unset($this->createdNodes[spl_object_hash($node)]);
    }
}

