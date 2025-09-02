<?php

namespace App\Controller\Api\Project\Pages;

use App\Service\Project\PageService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages/{pageId}', name: 'api_v2_projects_pages_update', methods: ['PATCH'])]
class UpdatePageAction extends AbstractController
{
    public function __construct(private readonly PageService $service)
    {
    }

    public function __invoke(string $projectId, string $pageId, Request $request)
    {
        $payload = json_decode($request->getContent(), true) ?? [];
        try {
            $node = $this->service->updateNode($projectId, $pageId, $payload);
            if (null === $node) {
                return $this->json(null, 204);
            }
            // Return single page (children omitted)
            $res = [
                'id' => $node['id'] ?? $pageId,
                'title' => $node['title'] ?? null,
                'order' => $node['order'] ?? null,
                'parentId' => $node['parentId'] ?? null,
                'children' => [],
            ];

            return $this->json($res, 200);
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
