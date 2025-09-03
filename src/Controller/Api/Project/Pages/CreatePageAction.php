<?php

namespace App\Controller\Api\Project\Pages;

use App\Service\Project\PageService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages', name: 'api_v2_projects_pages_create', methods: ['POST'])]
class CreatePageAction extends AbstractController
{
    public function __construct(private readonly PageService $service)
    {
    }

    public function __invoke(string $projectId, Request $request)
    {
        $payload = json_decode($request->getContent(), true) ?? [];
        $title = (string) ($payload['title'] ?? 'Untitled');
        $parentId = $payload['parentId'] ?? null;
        $order = isset($payload['order']) ? (int) $payload['order'] : null;
        try {
            $node = $this->service->createNode($projectId, $parentId, $title, $order);

            $res = [
                'id' => $node['id'],
                'title' => $node['title'],
                'parentId' => $node['parentId'],
                'childrenCount' => count($node['children'] ?? []),
            ];
            $location = sprintf('/api/v2/projects/%s/pages/%s', $projectId, $node['id']);

            return $this->json($res, 201, ['Location' => $location]);
        } catch (\InvalidArgumentException $e) {
            return $this->json([
                'title' => 'Validation error',
                'detail' => $e->getMessage(),
                'type' => '/errors/400',
            ], 400);
        }
    }
}
