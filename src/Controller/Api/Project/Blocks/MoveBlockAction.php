<?php

namespace App\Controller\Api\Project\Blocks;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages/{pageId}/blocks/{blockId}/move', name: 'api_v2_projects_pages_blocks_move', methods: ['PATCH'])]
class MoveBlockAction extends AbstractController
{
    public function __construct(private readonly \App\Service\Project\BlockService $service)
    {
    }

    public function __invoke(string $projectId, Request $request)
    {
        $payload = json_decode($request->getContent(), true) ?? [];
        $blockId = (string) $request->attributes->get('blockId');
        // Accept both newPageId (preferred) and newNodeId for backward compatibility
        $newNodeId = (string) ($payload['newPageId'] ?? $payload['newNodeId'] ?? $request->attributes->get('pageId') ?? $request->attributes->get('nodeId'));
        $position = isset($payload['position']) ? (int) $payload['position'] : null;
        try {
            $block = $this->service->moveBlock($projectId, $blockId, $newNodeId, $position);

            return $this->json($block, 200);
        } catch (\InvalidArgumentException $e) {
            return $this->json([
                'title' => 'Validation error',
                'detail' => $e->getMessage(),
                'type' => '/errors/400',
            ], 400);
        } catch (\Throwable $e) {
            return $this->json([
                'title' => 'Unexpected error',
                'detail' => $e->getMessage(),
                'type' => '/errors/500',
            ], 500);
        }
    }
}
