<?php

namespace App\Service;

use App\Dto\PrintDocument;
use App\Dto\PrintPage;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeNavStructureSync;
use App\Entity\net\exelearning\Entity\OdePagStructureSync;
use App\Repository\net\exelearning\Repository\CurrentOdeUsersRepository;
use App\Repository\net\exelearning\Repository\OdeNavStructureSyncRepository;
use App\Repository\net\exelearning\Repository\OdePagStructureSyncRepository;
use App\Service\Project\ProjectPropertiesBuilder;
use App\Settings;

class PrintDocumentBuilder
{
    public function __construct(
        private readonly CurrentOdeUsersRepository $currentUsersRepository,
        private readonly OdeNavStructureSyncRepository $navRepository,
        private readonly OdePagStructureSyncRepository $pageRepository,
        private readonly ProjectPropertiesBuilder $propertiesBuilder,
    ) {
    }

    public function build(string $projectId, ?string $username = null): PrintDocument
    {
        $sessionId = $this->resolveSessionId($projectId, $username);
        if (!$sessionId) {
            throw new \InvalidArgumentException('Project not found or session unavailable');
        }

        $navNodes = $this->navRepository->getNavStructure($sessionId);
        if (empty($navNodes)) {
            throw new \InvalidArgumentException('No pages found for project');
        }

        $tree = $this->buildTree($navNodes);
        $flatPages = $this->flattenTree($tree);

        $blocksByPage = $this->loadBlocksByPage($sessionId);

        $properties = $this->propertiesBuilder->build($projectId, $username);
        $title = (string) ($properties['pp_title'] ?? '');
        $author = trim((string) ($properties['pp_author'] ?? ''));
        $description = $properties['pp_description'] ?? null;
        if (\is_array($description)) {
            $description = $description['text'] ?? json_encode($description, JSON_THROW_ON_ERROR);
        }
        $language = (string) ($properties['pp_lang'] ?? Settings::DEFAULT_LOCALE);

        $pages = [];
        foreach ($flatPages as $pageInfo) {
            $pageId = $pageInfo['id'];
            $content = $this->renderPageContent($blocksByPage[$pageId] ?? []);
            $pages[] = new PrintPage(
                $pageId,
                $pageInfo['title'],
                $pageInfo['level'],
                $content,
                $this->buildAnchor($pageId, $pageInfo['title']),
                $pageInfo['ancestors'],
            );
        }

        return new PrintDocument(
            $projectId,
            $title,
            $author,
            $description ? (string) $description : null,
            $language ?: Settings::DEFAULT_LOCALE,
            new \DateTimeImmutable(),
            $pages,
        );
    }

    private function resolveSessionId(string $projectId, ?string $username = null): ?string
    {
        $sessions = $this->currentUsersRepository->getCurrentUsers($projectId, null, null);
        if (empty($sessions)) {
            return null;
        }

        if ($username) {
            foreach ($sessions as $session) {
                if ($session->getUser() === $username) {
                    return $session->getOdeSessionId();
                }
            }
        }

        /** @var CurrentOdeUsers $first */
        $first = $sessions[0];

        return $first->getOdeSessionId();
    }

    /**
     * @param OdeNavStructureSync[] $nodes
     */
    private function buildTree(array $nodes): array
    {
        $items = [];
        foreach ($nodes as $node) {
            $id = $node->getOdePageId();
            $items[$id] = [
                'id' => $id,
                'title' => $node->getPageName() ?? '',
                'order' => $node->getOdeNavStructureSyncOrder() ?? 0,
                'parent' => $node->getOdeParentPageId(),
                'entity' => $node,
                'children' => [],
            ];
        }

        $roots = [];
        foreach ($items as $id => &$item) {
            $parentId = $item['parent'];
            if ($parentId && isset($items[$parentId])) {
                $items[$parentId]['children'][] = &$item;
            } else {
                $roots[] = &$item;
            }
        }

        $this->sortRecursively($roots);

        return $roots;
    }

    private function sortRecursively(array &$nodes): void
    {
        usort($nodes, static fn (array $a, array $b) => ($a['order'] <=> $b['order']));
        foreach ($nodes as &$child) {
            if (!empty($child['children'])) {
                $this->sortRecursively($child['children']);
            }
        }
    }

    private function flattenTree(array $tree, int $level = 0, array $ancestors = []): array
    {
        $flat = [];
        foreach ($tree as $node) {
            $currentAncestors = $ancestors;
            if (!empty($ancestors)) {
                $currentAncestors = array_values($ancestors);
            }
            $flat[] = [
                'id' => $node['id'],
                'title' => $node['title'] ?: 'Untitled',
                'level' => $level,
                'ancestors' => $currentAncestors,
            ];
            if (!empty($node['children'])) {
                $flat = array_merge(
                    $flat,
                    $this->flattenTree($node['children'], $level + 1, array_merge($ancestors, [$node['id']]))
                );
            }
        }

        return $flat;
    }

    /**
     * @return array<string, OdePagStructureSync[]>
     */
    private function loadBlocksByPage(string $sessionId): array
    {
        $qb = $this->pageRepository->createQueryBuilder('pag');
        $qb
            ->leftJoin('pag.odeComponentsSyncs', 'comp')
            ->addSelect('comp')
            ->andWhere('pag.odeSessionId = :session')
            ->setParameter('session', $sessionId)
            ->orderBy('pag.odePageId', 'ASC')
            ->addOrderBy('pag.odePagStructureSyncOrder', 'ASC')
            ->addOrderBy('comp.odeComponentsSyncOrder', 'ASC');

        /** @var OdePagStructureSync[] $results */
        $results = $qb->getQuery()->getResult();

        $grouped = [];
        foreach ($results as $block) {
            $grouped[$block->getOdePageId()][] = $block;
        }

        return $grouped;
    }

    /**
     * @param OdePagStructureSync[] $blocks
     */
    private function renderPageContent(array $blocks): string
    {
        $buffer = '';
        foreach ($blocks as $block) {
            $buffer .= '<div class="print-block">';
            foreach ($block->getOdeComponentsSyncs() as $component) {
                $html = (string) ($component->getHtmlView() ?? '');
                // Normalize resource URLs so they resolve within the app.
                // In DB, media often uses relative paths like "files/tmp/...".
                // Our router exposes them at "/files/tmp/...", so prefix a leading slash
                // for common attributes and CSS url() usages.
                $html = $this->fixRelativeTempFilesUrls($html);
                // Remove interactive close buttons from UDL alt content in print view
                $html = (string) preg_replace(
                    '/<button[^>]*class=["\']?[^>]*exe-udlContent-alt-content-hide[^>]*["\']?[^>]*>.*?<\\/button>/is',
                    '',
                    $html
                );
                $buffer .= $html;
            }
            $buffer .= '</div>';
        }

        return $buffer;
    }

    private function buildAnchor(string $pageId, string $title): string
    {
        $slug = preg_replace('/[^a-z0-9]+/i', '-', strtolower($title)) ?: 'page';
        $slug = trim($slug, '-');
        if ('' === $slug) {
            $slug = 'page';
        }

        return sprintf('page-%s-%s', $pageId, $slug);
    }

    /**
     * Ensure media URLs that point to temporary session files resolve correctly.
     * Transforms attribute values like src="files/tmp/..." to src="/files/tmp/...".
     */
    private function fixRelativeTempFilesUrls(string $html): string
    {
        // src|href|srcset attributes
        $html = (string) preg_replace(
            '/\b(src|href|srcset)=([\"\'])files\/tmp\//i',
            '$1=$2/files/tmp/',
            $html
        );

        // CSS url() usages
        $html = (string) preg_replace(
            "/url\\(([\"' ]?)files\/tmp\//i",
            'url($1/files/tmp/',
            $html
        );

        return $html;
    }
}
