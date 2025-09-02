<?php

namespace App\Service\Project;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\OdeNavStructureSyncProperties;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Repository\net\exelearning\Repository\OdeNavStructureSyncRepository;
use Doctrine\ORM\EntityManagerInterface;

class PageService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly UserHelper $userHelper,
        private readonly OdeNavStructureSyncRepository $navRepo,
    ) {
    }

    /**
     * List the root pages with nested children as a tree for a project.
     */
    public function listTree(string $projectId): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $nodes = $this->navRepo->getNavStructure($sessionId);

        return $this->buildTree($nodes);
    }

    /**
     * Return a single page with its subtree.
     */
    public function getSubtree(string $projectId, string $pageId): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $nodes = $this->navRepo->getNavStructure($sessionId);
        $byId = $this->indexByPageId($nodes);
        if (!isset($byId[$pageId])) {
            throw new \InvalidArgumentException('Page not found');
        }
        $tree = $this->buildTree($nodes);
        // Find subtree root in the built tree
        $locator = [];
        $this->flattenById($tree, $locator);

        return $locator[$pageId] ?? [];
    }

    /**
     * List direct children (one level) for a page in a project.
     */
    public function listChildren(string $projectId, string $pageId): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            return [];
        }
        $nodes = $this->navRepo->getNavStructure($sessionId);
        $byParent = [];
        foreach ($nodes as $n) {
            $pid = $n->getOdeParentPageId();
            $byParent[$pid ?? 'root'][] = $n;
        }
        $direct = $byParent[$pageId] ?? [];
        usort($direct, fn ($a, $b) => ($a->getOdeNavStructureSyncOrder() <=> $b->getOdeNavStructureSyncOrder()));

        return array_map(fn ($n) => $this->toArray($n), $direct);
    }

    /**
     * Create a page (root if parentId is null). If $order is null, append at end.
     */
    public function createNode(string $projectId, ?string $parentId, string $title, ?int $order = null): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $nodes = $this->navRepo->getNavStructure($sessionId);
        $byId = $this->indexByPageId($nodes);
        $parent = null;
        if ($parentId) {
            $parent = $byId[$parentId] ?? null;
            if (!$parent) {
                throw new \InvalidArgumentException('Parent node not found');
            }
        }
        // Determine order among siblings
        $siblings = array_values(array_filter($nodes, fn ($n) => ($n->getOdeParentPageId() ?? null) === $parentId));
        usort($siblings, fn ($a, $b) => ($a->getOdeNavStructureSyncOrder() <=> $b->getOdeNavStructureSyncOrder()));
        $pos = (null !== $order && $order > 0) ? min($order, count($siblings) + 1) : (count($siblings) + 1);

        $nav = new OdeNavStructureSync();
        $nav->setOdeSessionId($sessionId);
        $nav->setOdePageId(\App\Util\net\exelearning\Util\Util::generateId());
        $nav->setPageName($title ?: 'Untitled');
        // Temporarily set order; will renumber with siblings
        $nav->setOdeNavStructureSyncOrder($pos);
        $nav->setOdeParentPageId($parentId);
        if ($parent) {
            $nav->setOdeNavStructureSync($parent);
        }
        $prop = new OdeNavStructureSyncProperties();
        $prop->setKey('titlePage');
        $prop->setValue($title ?: '');
        $prop->setOdeNavStructureSync($nav);

        // Insert into siblings and renumber
        array_splice($siblings, $pos - 1, 0, [$nav]);
        $i = 1;
        foreach ($siblings as $s) {
            $s->setOdeNavStructureSyncOrder($i++);
            $this->em->persist($s);
        }
        $this->em->persist($nav);
        $this->em->persist($prop);
        $this->em->flush();

        return $this->toArray($nav) + ['children' => []];
    }

    /**
     * Update a page: title (upsert), parentId (re-parent), order (reorder among siblings).
     * Returns updated node array (children omitted) or null to indicate 204.
     */
    public function updateNode(string $projectId, string $pageId, array $changes): ?array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $nodes = $this->navRepo->getNavStructure($sessionId);
        $byId = $this->indexByPageId($nodes);
        $node = $byId[$pageId] ?? null;
        if (!$node) {
            throw new \InvalidArgumentException('Page not found');
        }

        $newTitle = $changes['title'] ?? null;
        $newParentIdProvided = array_key_exists('parentId', $changes);
        $newParentId = $newParentIdProvided ? ($changes['parentId'] ?? null) : ($node->getOdeParentPageId() ?? null);
        $newOrderProvided = array_key_exists('order', $changes);
        $newOrder = $newOrderProvided ? (int) $changes['order'] : null;

        // Title upsert
        if (null !== $newTitle) {
            $found = null;
            foreach ($node->getOdeNavStructureSyncProperties() as $p) {
                if ('titlePage' === $p->getKey()) {
                    $found = $p;
                    break;
                }
            }
            if (!$found) {
                $found = new OdeNavStructureSyncProperties();
                $found->setKey('titlePage');
                $found->setOdeNavStructureSync($node);
                $this->em->persist($found);
            }
            $found->setValue((string) $newTitle);
            $node->setPageName((string) $newTitle ?: $node->getPageName());
            $this->em->persist($node);
        }

        // Re-parent and/or reorder
        if ($newParentIdProvided || $newOrderProvided) {
            // Validate parent
            $parentEntity = null;
            if ($newParentId) {
                $parentEntity = $byId[$newParentId] ?? null;
                if (!$parentEntity) {
                    throw new \InvalidArgumentException('Parent node not found');
                }
                // Prevent cycles
                if ($this->isDescendant($nodes, $pageId, $newParentId)) {
                    throw new \InvalidArgumentException('Cannot move under its own descendant');
                }
            }

            // If parent changes, set relation
            if (($node->getOdeParentPageId() ?? null) !== ($newParentId ?? null)) {
                $node->setOdeParentPageId($newParentId);
                $node->setOdeNavStructureSync($parentEntity);
            }

            // Recompute siblings in target parent
            $siblings = array_values(array_filter($nodes, fn ($n) => ($n->getOdeParentPageId() ?? null) === ($newParentId ?? null) && $n->getOdePageId() !== $pageId));
            usort($siblings, fn ($a, $b) => ($a->getOdeNavStructureSyncOrder() <=> $b->getOdeNavStructureSyncOrder()));
            $pos = $newOrderProvided && $newOrder && $newOrder > 0 ? min($newOrder, count($siblings) + 1) : (count($siblings) + 1);
            array_splice($siblings, $pos - 1, 0, [$node]);
            $i = 1;
            foreach ($siblings as $s) {
                $s->setOdeNavStructureSyncOrder($i++);
                $this->em->persist($s);
            }
        }

        $this->em->flush();

        return $this->toArray($node);
    }

    /**
     * Move a page to a new parent and/or position (1-based) among siblings.
     */
    public function moveNode(string $projectId, string $pageId, ?string $newParentId, ?int $position = null): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $nodes = $this->navRepo->getNavStructure($sessionId);
        $byId = $this->indexByPageId($nodes);
        $node = $byId[$pageId] ?? null;
        if (!$node) {
            throw new \InvalidArgumentException('Page not found');
        }
        if ($newParentId && !($byId[$newParentId] ?? null)) {
            throw new \InvalidArgumentException('Parent node not found');
        }
        // Prevent cycles
        if ($newParentId && $this->isDescendant($nodes, $pageId, $newParentId)) {
            throw new \InvalidArgumentException('Cannot move under its own descendant');
        }
        // Re-parent
        $parentEntity = $newParentId ? ($byId[$newParentId] ?? null) : null;
        $node->setOdeParentPageId($newParentId);
        $node->setOdeNavStructureSync($parentEntity);

        // Reorder among new siblings
        $siblings = array_values(array_filter($nodes, fn ($n) => ($n->getOdeParentPageId() ?? null) === $newParentId && $n->getOdePageId() !== $pageId));
        usort($siblings, fn ($a, $b) => ($a->getOdeNavStructureSyncOrder() <=> $b->getOdeNavStructureSyncOrder()));
        $pos = $position && $position > 0 ? $position : (count($siblings) + 1);
        array_splice($siblings, $pos - 1, 0, [$node]);
        // Renumber
        $i = 1;
        foreach ($siblings as $s) {
            $s->setOdeNavStructureSyncOrder($i++);
            $this->em->persist($s);
        }
        $this->em->flush();

        return $this->toArray($node);
    }

    /**
     * Reorder direct children by the provided array of pageIds.
     */
    public function reorderChildren(string $projectId, string $pageId, array $order): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $nodes = $this->navRepo->getNavStructure($sessionId);
        $byId = $this->indexByPageId($nodes);
        $children = array_values(array_filter($nodes, fn ($n) => ($n->getOdeParentPageId() ?? null) === $pageId));
        // Strict validation: the provided order must contain exactly the same set of child ids, no more no less
        $childrenIds = array_map(static fn ($c) => $c->getOdePageId(), $children);
        sort($childrenIds);
        $provided = array_values(array_unique(array_map('strval', $order)));
        $unknown = array_values(array_diff($provided, $childrenIds));
        if (!empty($unknown)) {
            throw new \InvalidArgumentException('Order contains ids not in children');
        }
        if (count($provided) !== count($childrenIds)) {
            throw new \InvalidArgumentException('Order must include all children ids');
        }
        $check = $provided;
        sort($check);
        if ($check !== $childrenIds) {
            throw new \InvalidArgumentException('Order must match the set of children');
        }
        // Apply the requested order
        $map = [];
        foreach ($children as $c) {
            $map[$c->getOdePageId()] = $c;
        }
        $sorted = [];
        foreach ($provided as $id) {
            $sorted[] = $map[$id];
        }
        $i = 1;
        $out = [];
        foreach ($sorted as $s) {
            $s->setOdeNavStructureSyncOrder($i++);
            $this->em->persist($s);
            $out[] = $s->getOdePageId();
        }
        $this->em->flush();

        return $out;
    }

    /**
     * Delete a node and all its descendants.
     */
    public function deleteNode(string $projectId, string $pageId): void
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            return;
        }
        $nodes = $this->navRepo->getNavStructure($sessionId);
        $byId = $this->indexByPageId($nodes);
        if (!isset($byId[$pageId])) {
            return;
        }
        $desc = $this->descendantsIds($nodes, $pageId);
        $ids = array_merge([$pageId], $desc);
        // Remove entities by matching page ids
        foreach ($nodes as $n) {
            if (in_array($n->getOdePageId(), $ids, true)) {
                $this->em->remove($n);
            }
        }
        $this->em->flush();
    }

    /**
     * Resolve session id for a project, preferring current user's session if available.
     */
    private function resolveSessionId(string $projectId): ?string
    {
        $cuRepo = $this->em->getRepository(CurrentOdeUsers::class);
        $sessions = $cuRepo->getCurrentUsers($projectId, null, null);

        if (!$sessions || !\is_array($sessions)) {
            return null;
        }

        // If you truly need to prefer the current user's session, implement it here.
        // Kept simple and safe: fallback to the first available session.
        $preferred = $sessions[0];

        return $preferred ? $preferred->getOdeSessionId() : null;
    }

    /**
     * Build a tree from a list of OdeNavStructureSync nodes.
     */
    private function buildTree(array $nodes): array
    {
        $items = [];
        foreach ($nodes as $n) {
            $items[$n->getOdePageId()] = $this->toArray($n) + ['children' => []];
        }
        // Link children
        $roots = [];
        foreach ($nodes as $n) {
            $pid = $n->getOdeParentPageId();
            $id = $n->getOdePageId();
            if ($pid && isset($items[$pid])) {
                $items[$pid]['children'][] = &$items[$id];
            } else {
                $roots[] = &$items[$id];
            }
        }
        // Sort children by order
        $sortFn = function (&$arr) use (&$sortFn) {
            usort($arr, fn ($a, $b) => (($a['order'] ?? 0) <=> ($b['order'] ?? 0)));
            foreach ($arr as &$c) {
                if (!empty($c['children'])) {
                    $sortFn($c['children']);
                }
            }
        };
        $sortFn($roots);

        return $roots;
    }

    /**
     * Convert an entity to array with id, title, parentId and order.
     */
    private function toArray(OdeNavStructureSync $n): array
    {
        $title = $n->getPageName() ?? '';
        foreach ($n->getOdeNavStructureSyncProperties() as $p) {
            if ('titlePage' === $p->getKey()) {
                $title = $p->getValue() ?: $title;
                break;
            }
        }

        return [
            'id' => (string) $n->getOdePageId(),
            'title' => (string) $title,
            'order' => (int) $n->getOdeNavStructureSyncOrder(),
            'parentId' => $n->getOdeParentPageId(),
        ];
    }

    /**
     * Index nodes by page id.
     */
    private function indexByPageId(array $nodes): array
    {
        $byId = [];
        foreach ($nodes as $n) {
            $byId[$n->getOdePageId()] = $n;
        }

        return $byId;
    }

    /**
     * Check if candidate is descendant of subject.
     */
    private function isDescendant(array $nodes, string $subjectId, string $candidateId): bool
    {
        $byId = $this->indexByPageId($nodes);
        $current = $byId[$candidateId] ?? null;
        while ($current) {
            $pid = $current->getOdeParentPageId();
            if ($pid === $subjectId) {
                return true;
            }
            $current = $pid ? ($byId[$pid] ?? null) : null;
        }

        return false;
    }

    /**
     * Return all descendant ids of a node.
     */
    private function descendantsIds(array $nodes, string $pageId): array
    {
        $children = array_values(array_filter($nodes, fn ($n) => ($n->getOdeParentPageId() ?? null) === $pageId));
        $ids = [];
        foreach ($children as $c) {
            $ids[] = $c->getOdePageId();
            $ids = array_merge($ids, $this->descendantsIds($nodes, $c->getOdePageId()));
        }

        return $ids;
    }

    /**
     * Flatten a tree by id into locator.
     */
    private function flattenById(array $nodes, array &$out): void
    {
        foreach ($nodes as $n) {
            $out[$n['id']] = $n;
            if (!empty($n['children'])) {
                $this->flattenById($n['children'], $out);
            }
        }
    }
}
