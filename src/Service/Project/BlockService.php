<?php

namespace App\Service\Project;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeComponentsSync;
use App\Helper\net\exelearning\Helper\UserHelper;
use Doctrine\ORM\EntityManagerInterface;

class BlockService
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly UserHelper $userHelper,
    ) {
    }

    public function listBlocks(string $projectId, string $pageId, ?int $limit = null, ?int $offset = null): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $rows = $this->em->getRepository(OdeComponentsSync::class)->findBy([
            'odeSessionId' => $sessionId,
            'odePageId' => $pageId,
            'isActive' => true,
        ], ['odeComponentsSyncOrder' => 'ASC']);

        // Group by blockId
        $byBlock = [];
        foreach ($rows as $r) {
            $bid = $r->getOdeBlockId();
            if (!isset($byBlock[$bid])) {
                $byBlock[$bid] = [
                    'blockId' => $bid,
                    'order' => $r->getOdeComponentsSyncOrder(),
                    'createdAt' => $r->getCreatedAt()?->format('Y-m-d H:i:s'),
                    'updatedAt' => $r->getUpdatedAt()?->format('Y-m-d H:i:s'),
                    'rows' => [],
                ];
            }
            $b = &$byBlock[$bid];
            $b['order'] = min($b['order'], (int) $r->getOdeComponentsSyncOrder());
            $b['createdAt'] = min($b['createdAt'], $r->getCreatedAt()?->format('Y-m-d H:i:s'));
            $b['updatedAt'] = max($b['updatedAt'], $r->getUpdatedAt()?->format('Y-m-d H:i:s'));
            $b['rows'][] = $r;
        }
        // Sort blocks by order
        $blocks = array_values($byBlock);
        usort($blocks, fn ($a, $b) => ($a['order'] <=> $b['order']));

        // Pagination after grouping
        if ($offset) {
            $blocks = array_slice($blocks, $offset);
        }
        if ($limit) {
            $blocks = array_slice($blocks, 0, $limit);
        }

        $out = [];
        // Always include full details
        $withIdevices = true;
        $withHtml = true;
        $withProps = true;
        foreach ($blocks as $b) {
            $row = [
                'blockId' => $b['blockId'],
                'order' => (int) $b['order'],
                'idevicesCount' => count($b['rows']),
                'createdAt' => $b['createdAt'],
                'updatedAt' => $b['updatedAt'],
                'links' => [
                    'self' => sprintf('/api/v2/projects/%s/pages/%s/blocks/%s', $projectId, $pageId, $b['blockId']),
                    'idevices' => sprintf('/api/v2/projects/%s/pages/%s/blocks/%s/idevices', $projectId, $pageId, $b['blockId']),
                ],
            ];
            if ($withIdevices) {
                $row['idevices'] = array_map(fn ($r) => $this->mapIdevice($r, $withHtml, $withProps), $b['rows']);
            }
            $out[] = $row;
        }

        return [
            'pageId' => $pageId,
            'blocks' => $out,
        ];
    }

    public function getBlock(string $projectId, string $pageId, string $blockId): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $rows = $this->em->getRepository(OdeComponentsSync::class)->findBy([
            'odeSessionId' => $sessionId,
            'odePageId' => $pageId,
            'odeBlockId' => $blockId,
            'isActive' => true,
        ], ['odeComponentsSyncOrder' => 'ASC']);
        if (!$rows) {
            throw new \InvalidArgumentException('Block not found');
        }
        $minOrder = min(array_map(fn ($r) => (int) $r->getOdeComponentsSyncOrder(), $rows));
        // Always include full details
        $withIdevices = true;
        $withHtml = true;
        $withProps = true;

        $out = [
            'pageId' => $pageId,
            'blockId' => $blockId,
            'order' => $minOrder,
            'idevicesCount' => count($rows),
            'links' => [
                'self' => sprintf('/api/v2/projects/%s/pages/%s/blocks/%s', $projectId, $pageId, $blockId),
                'idevices' => sprintf('/api/v2/projects/%s/pages/%s/blocks/%s/idevices', $projectId, $pageId, $blockId),
            ],
        ];
        if ($withIdevices) {
            $out['idevices'] = array_map(fn ($r) => $this->mapIdevice($r, $withHtml, $withProps), $rows);
        }

        return $out;
    }

    public function listIdevices(string $projectId, string $pageId, string $blockId): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $rows = $this->em->getRepository(OdeComponentsSync::class)->findBy([
            'odeSessionId' => $sessionId,
            'odePageId' => $pageId,
            'odeBlockId' => $blockId,
            'isActive' => true,
        ], ['odeComponentsSyncOrder' => 'ASC']);
        if (!$rows) {
            return ['blockId' => $blockId, 'idevices' => []];
        }
        // Always include full details
        $withHtml = true;
        $withProps = true;

        return [
            'blockId' => $blockId,
            'idevices' => array_map(fn ($r) => $this->mapIdevice($r, $withHtml, $withProps), $rows),
        ];
    }

    public function createBlock(string $projectId, string $pageId, ?string $blockId, array $initial): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        if (!$initial) {
            throw new \InvalidArgumentException('initialIdevice is required');
        }
        $type = (string) ($initial['type'] ?? 'text');
        $html = $initial['html'] ?? null;
        $props = $initial['props'] ?? null;
        $order = isset($initial['order']) ? (int) $initial['order'] : null;
        $ideviceId = (string) ($initial['ideviceId'] ?? \App\Util\net\exelearning\Util\Util::generateId());
        $blockId = $blockId ?: \App\Util\net\exelearning\Util\Util::generateId();

        $repo = $this->em->getRepository(OdeComponentsSync::class);
        $siblings = $repo->findBy(['odeSessionId' => $sessionId, 'odePageId' => $pageId, 'isActive' => true], ['odeComponentsSyncOrder' => 'ASC']);
        $max = 0;
        foreach ($siblings as $s) {
            $max = max($max, (int) $s->getOdeComponentsSyncOrder());
        }
        $finalOrder = null !== $order ? $order : ($max + 10);

        $row = new OdeComponentsSync();
        $row->setOdeSessionId($sessionId);
        $row->setOdePageId($pageId);
        $row->setOdeBlockId($blockId);
        $row->setOdeIdeviceId($ideviceId);
        $row->setOdeIdeviceTypeName($type);
        if (null !== $html) {
            $row->setHtmlView($html);
        }
        if (null !== $props) {
            $row->setJsonProperties(is_array($props) ? json_encode($props, JSON_UNESCAPED_UNICODE) : (string) $props);
        }
        $row->setOdeComponentsSyncOrder($finalOrder);

        $this->em->persist($row);
        $this->em->flush();

        // Return full block details including idevices with html and props
        $block = $this->getBlock($projectId, $pageId, $blockId);

        return $block;
    }

    public function addIdevice(string $projectId, string $pageId, string $blockId, array $data): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $type = (string) ($data['type'] ?? 'text');
        $html = $data['html'] ?? null;
        $props = $data['props'] ?? null;
        $order = isset($data['order']) ? (int) $data['order'] : null;
        $ideviceId = (string) ($data['ideviceId'] ?? \App\Util\net\exelearning\Util\Util::generateId());

        $repo = $this->em->getRepository(OdeComponentsSync::class);
        $siblings = $repo->findBy([
            'odeSessionId' => $sessionId,
            'odePageId' => $pageId,
            'odeBlockId' => $blockId,
            'isActive' => true,
        ], ['odeComponentsSyncOrder' => 'ASC']);
        $max = 0;
        foreach ($siblings as $s) {
            $max = max($max, (int) $s->getOdeComponentsSyncOrder());
        }
        $finalOrder = null !== $order ? $order : ($max + 10);

        $row = new OdeComponentsSync();
        $row->setOdeSessionId($sessionId);
        $row->setOdePageId($pageId);
        $row->setOdeBlockId($blockId);
        $row->setOdeIdeviceId($ideviceId);
        $row->setOdeIdeviceTypeName($type);
        if (null !== $html) {
            $row->setHtmlView($html);
        }
        if (null !== $props) {
            $row->setJsonProperties(is_array($props) ? json_encode($props, JSON_UNESCAPED_UNICODE) : (string) $props);
        }
        $row->setOdeComponentsSyncOrder($finalOrder);

        $this->em->persist($row);
        $this->em->flush();

        return $this->mapIdevice($row, true, true);
    }

    public function getIdevice(string $projectId, string $pageId, string $blockId, string $ideviceId): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $row = $this->em->getRepository(OdeComponentsSync::class)->findOneBy([
            'odeSessionId' => $sessionId,
            'odePageId' => $pageId,
            'odeBlockId' => $blockId,
            'odeIdeviceId' => $ideviceId,
            'isActive' => true,
        ]);
        if (!$row) {
            throw new \InvalidArgumentException('iDevice not found');
        }

        // Always include full details
        return $this->mapIdevice($row, true, true);
    }

    public function setIdevice(string $projectId, string $pageId, string $blockId, string $ideviceId, array $changes): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $row = $this->em->getRepository(OdeComponentsSync::class)->findOneBy([
            'odeSessionId' => $sessionId,
            'odePageId' => $pageId,
            'odeBlockId' => $blockId,
            'odeIdeviceId' => $ideviceId,
            'isActive' => true,
        ]);
        if (!$row) {
            throw new \InvalidArgumentException('iDevice not found');
        }
        if (isset($changes['type'])) {
            $row->setOdeIdeviceTypeName((string) $changes['type']);
        }
        if (array_key_exists('html', $changes)) {
            $row->setHtmlView((string) ($changes['html'] ?? ''));
        }
        if (array_key_exists('props', $changes)) {
            $row->setJsonProperties(is_array($changes['props']) ? json_encode($changes['props'], JSON_UNESCAPED_UNICODE) : (string) $changes['props']);
        }
        if (isset($changes['order'])) {
            $row->setOdeComponentsSyncOrder((int) $changes['order']);
        }
        if (isset($changes['isActive'])) {
            $row->setIsActive((bool) $changes['isActive']);
        }
        $this->em->persist($row);
        $this->em->flush();

        return $this->mapIdevice($row, true, true);
    }

    public function deleteIdevice(string $projectId, string $pageId, string $blockId, string $ideviceId, bool $soft = true): void
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $row = $this->em->getRepository(OdeComponentsSync::class)->findOneBy([
            'odeSessionId' => $sessionId,
            'odePageId' => $pageId,
            'odeBlockId' => $blockId,
            'odeIdeviceId' => $ideviceId,
            'isActive' => true,
        ]);
        if ($row) {
            if ($soft) {
                $row->setIsActive(false);
                $this->em->persist($row);
            } else {
                $this->em->remove($row);
            }
            $this->em->flush();
        }
    }

    public function deleteBlock(string $projectId, string $pageId, string $blockId, bool $soft = true): void
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $rows = $this->em->getRepository(OdeComponentsSync::class)->findBy([
            'odeSessionId' => $sessionId,
            'odePageId' => $pageId,
            'odeBlockId' => $blockId,
            'isActive' => true,
        ]);
        foreach ($rows as $r) {
            if ($soft) {
                $r->setIsActive(false);
                $this->em->persist($r);
            } else {
                $this->em->remove($r);
            }
        }
        $this->em->flush();
    }

    public function reorderIdevices(string $projectId, string $pageId, string $blockId, array $order, int $step = 10): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $repo = $this->em->getRepository(OdeComponentsSync::class);
        $rows = $repo->findBy([
            'odeSessionId' => $sessionId,
            'odePageId' => $pageId,
            'odeBlockId' => $blockId,
            'isActive' => true,
        ], ['odeComponentsSyncOrder' => 'ASC']);
        $map = [];
        foreach ($rows as $r) {
            $map[$r->getOdeIdeviceId()] = $r;
        }
        $seq = [];
        foreach ($order as $id) {
            if (isset($map[$id])) {
                $seq[] = $map[$id];
            }
        }
        // Append remaining in current order
        foreach ($rows as $r) {
            if (!in_array($r, $seq, true)) {
                $seq[] = $r;
            }
        }
        // Assign orders
        $i = 0;
        $applied = [];
        foreach ($seq as $r) {
            $r->setOdeComponentsSyncOrder(++$i * $step);
            $this->em->persist($r);
            $applied[] = $r->getOdeIdeviceId();
        }
        $this->em->flush();

        return $applied;
    }

    public function reorderBlocks(string $projectId, string $pageId, array $blockOrder, int $step = 100): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        $rows = $this->em->getRepository(OdeComponentsSync::class)->findBy([
            'odeSessionId' => $sessionId,
            'odePageId' => $pageId,
            'isActive' => true,
        ], ['odeComponentsSyncOrder' => 'ASC']);
        if (!$rows) {
            return [];
        }
        // Group rows by block
        $byBlock = [];
        foreach ($rows as $r) {
            $byBlock[$r->getOdeBlockId()][] = $r;
        }
        // Normalize intra-block order to gaps of 1
        foreach ($byBlock as $bid => &$list) {
            usort($list, fn ($a, $b) => ($a->getOdeComponentsSyncOrder() <=> $b->getOdeComponentsSyncOrder()));
            $k = 1;
            foreach ($list as $r) {
                $r->setOdeComponentsSyncOrder($k++);
                $this->em->persist($r);
            }
        }
        // Determine final sequence of blocks
        $sequence = [];
        foreach ($blockOrder as $bid) {
            if (isset($byBlock[$bid])) {
                $sequence[] = $bid;
            }
        }
        foreach (array_keys($byBlock) as $bid) {
            if (!in_array($bid, $sequence, true)) {
                $sequence[] = $bid;
            }
        }
        // Offset blocks preserving intra-block ordering
        $applied = [];
        $index = 0;
        foreach ($sequence as $bid) {
            $offset = ++$index * $step;
            foreach ($byBlock[$bid] as $r) {
                $r->setOdeComponentsSyncOrder($offset + $r->getOdeComponentsSyncOrder());
                $this->em->persist($r);
            }
            $applied[] = $bid;
        }
        $this->em->flush();

        return $applied;
    }

    /**
     * Move a whole block (all its idevices) to another page and position.
     * If position is null, appends at the end. Position 0 places it at the top.
     */
    public function moveBlock(string $projectId, string $blockId, string $newPageId, ?int $position = null): array
    {
        $sessionId = $this->resolveSessionId($projectId);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found');
        }
        // Validate target page exists in navigation for this project
        $navExists = $this->em->createQueryBuilder()
            ->select('COUNT(n.id)')
            ->from(\App\Entity\net\exelearning\Entity\OdeNavStructureSync::class, 'n')
            ->where('n.odeSessionId = :sid AND n.odePageId = :pid')
            ->setParameter('sid', $sessionId)
            ->setParameter('pid', $newPageId)
            ->getQuery()->getSingleScalarResult();
        if (0 === (int) $navExists) {
            throw new \InvalidArgumentException('Parent page not found');
        }
        $repo = $this->em->getRepository(OdeComponentsSync::class);
        $rows = $repo->findBy([
            'odeSessionId' => $sessionId,
            'odeBlockId' => $blockId,
            'isActive' => true,
        ]);
        if (!$rows) {
            throw new \InvalidArgumentException('Block not found');
        }
        // Change page for all rows in the block
        foreach ($rows as $r) {
            $r->setOdePageId($newPageId);
            $this->em->persist($r);
        }
        $this->em->flush();

        // Compute desired block order on destination page
        $listing = $this->listBlocks($projectId, $newPageId);
        $ids = array_map(static fn ($b) => $b['blockId'], $listing['blocks']);
        // Remove moved block if present, then insert at desired position
        $ids = array_values(array_filter($ids, static fn ($id) => $id !== $blockId));
        $index = null === $position ? count($ids) : max(0, min((int) $position, count($ids)));
        array_splice($ids, $index, 0, [$blockId]);
        $this->reorderBlocks($projectId, $newPageId, $ids);

        return $this->getBlock($projectId, $newPageId, $blockId);
    }

    private function mapIdevice(OdeComponentsSync $r, bool $withHtml, bool $withProps): array
    {
        $out = [
            'ideviceId' => $r->getOdeIdeviceId(),
            'type' => $r->getOdeIdeviceTypeName(),
            'order' => (int) $r->getOdeComponentsSyncOrder(),
            'isActive' => (bool) $r->getIsActive(),
            'createdAt' => $r->getCreatedAt()?->format('Y-m-d H:i:s'),
            'updatedAt' => $r->getUpdatedAt()?->format('Y-m-d H:i:s'),
        ];
        if ($withHtml) {
            $out['html'] = $r->getHtmlView();
        }
        if ($withProps) {
            $raw = $r->getJsonProperties();
            if (null === $raw || '' === $raw) {
                $out['props'] = (object) [];
            } else {
                $decoded = json_decode($raw, true);
                if (JSON_ERROR_NONE === json_last_error()) {
                    $out['props'] = $decoded;
                } else {
                    $out['props'] = $raw;
                    $out['propsParseError'] = true;
                }
            }
        }

        return $out;
    }

    private function resolveSessionId(string $projectId): ?string
    {
        $cuRepo = $this->em->getRepository(CurrentOdeUsers::class);
        $sessions = $cuRepo->getCurrentUsers($projectId, null, null);
        if (!$sessions || !\is_array($sessions)) {
            return null;
        }
        $preferred = $sessions[0];

        return $preferred ? $preferred->getOdeSessionId() : null;
    }
}
