<?php

namespace App\Controller\Api\Project\Pages;

use App\Service\Project\PageService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages/{pageId}/move', name: 'api_v2_projects_pages_move', methods: ['PATCH'])]
class MovePageAction extends AbstractController
{
    public function __construct(private readonly PageService $service)
    {
    }

    public function __invoke(string $projectId, string $pageId, Request $request)
    {
        $payload = json_decode($request->getContent(), true) ?? [];
        $parentId = $payload['parentId'] ?? null;
        $position = isset($payload['position']) ? (int) $payload['position'] : null;
        try {
            $node = $this->service->moveNode($projectId, $pageId, $parentId, $position);

            return $this->json([
                'id' => $node['id'] ?? null,
                'title' => $node['title'] ?? null,
                'parentId' => $node['parentId'] ?? null,
                'childrenCount' => isset($node['children']) ? count($node['children']) : 0,
            ], 200);
        } catch (\InvalidArgumentException $e) {
            $status = str_contains($e->getMessage(), 'descendant') ? 409 : 400;

            return $this->json([
                'title' => 409 === $status ? 'Conflict' : 'Validation error',
                'detail' => $e->getMessage(),
                'type' => 409 === $status ? '/errors/409' : '/errors/400',
            ], $status);
        } catch (\Throwable $e) {
            return $this->json([
                'title' => 'Unexpected error',
                'detail' => $e->getMessage(),
                'type' => '/errors/500',
            ], 500);
        }
    }
}
