<?php

namespace App\Controller\Api\Project\Pages;

use App\Service\Project\PageService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages/{pageId}', name: 'api_v2_projects_pages_get', methods: ['GET'])]
class GetPageAction extends AbstractController
{
    public function __construct(private readonly PageService $service)
    {
    }

    public function __invoke(string $projectId, string $pageId, Request $request)
    {
        try {
            $childrenMode = (string) ($request->query->get('children') ?? 'subtree');
            if ('direct' === $childrenMode) {
                // Compose the page with direct children only
                $subtree = $this->service->getSubtree($projectId, $pageId);
                $children = $this->service->listChildren($projectId, $pageId);
                $res = [
                    'id' => $subtree['id'] ?? $pageId,
                    'title' => $subtree['title'] ?? null,
                    'order' => $subtree['order'] ?? null,
                    'parentId' => $subtree['parentId'] ?? null,
                    'children' => $children,
                ];
            } else {
                $res = $this->service->getSubtree($projectId, $pageId);
            }

            return $this->json($res, 200);
        } catch (\InvalidArgumentException $e) {
            return $this->json([
                'title' => 'Not Found',
                'detail' => $e->getMessage(),
                'type' => '/errors/404',
            ], 404);
        } catch (\Throwable $e) {
            return $this->json([
                'title' => 'Unexpected error',
                'detail' => $e->getMessage(),
                'type' => '/errors/500',
            ], 500);
        }
    }
}
