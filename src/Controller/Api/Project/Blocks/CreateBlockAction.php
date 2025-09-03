<?php

namespace App\Controller\Api\Project\Blocks;

use App\Service\Project\BlockService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages/{pageId}/blocks', name: 'api_v2_projects_pages_blocks_create', methods: ['POST'])]
class CreateBlockAction extends AbstractController
{
    public function __construct(private readonly BlockService $service)
    {
    }

    public function __invoke(string $projectId, Request $request)
    {
        $payload = json_decode($request->getContent(), true) ?? [];
        $pageId = (string) ($request->attributes->get('pageId') ?? $request->attributes->get('nodeId'));
        $blockId = $payload['blockId'] ?? null;
        $initial = $payload['initialIdevice'] ?? null;
        if (!$initial) {
            $initial = [
                'type' => (string) ($payload['type'] ?? 'text'),
                'html' => $payload['data']['html'] ?? null,
                'props' => $payload['data']['props'] ?? null,
                'order' => $payload['data']['order'] ?? null,
            ];
        }
        try {
            $block = $this->service->createBlock($projectId, $pageId, $blockId, $initial);
            $location = sprintf('/api/v2/projects/%s/pages/%s/blocks/%s', $projectId, $pageId, $block['blockId']);

            return $this->json($block, 201, ['Location' => $location]);
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
