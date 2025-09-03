<?php

namespace App\Controller\Api\Project\Blocks;

use App\Service\Project\BlockService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages/{pageId}/blocks/{blockId}', name: 'api_v2_projects_pages_blocks_get', methods: ['GET'])]
class GetBlockAction extends AbstractController
{
    public function __construct(private readonly BlockService $service)
    {
    }

    public function __invoke(string $projectId, Request $request)
    {
        $pageId = (string) ($request->attributes->get('pageId') ?? $request->attributes->get('nodeId'));
        $blockId = (string) $request->attributes->get('blockId');
        try {
            $block = $this->service->getBlock($projectId, $pageId, $blockId);

            return $this->json($block, 200);
        } catch (\InvalidArgumentException $e) {
            return $this->json([
                'title' => str_contains($e->getMessage(), 'not found') ? 'Not Found' : 'Validation error',
                'detail' => $e->getMessage(),
                'type' => str_contains($e->getMessage(), 'not found') ? '/errors/404' : '/errors/400',
            ], str_contains($e->getMessage(), 'not found') ? 404 : 400);
        } catch (\Throwable $e) {
            return $this->json([
                'title' => 'Unexpected error',
                'detail' => $e->getMessage(),
                'type' => '/errors/500',
            ], 500);
        }
    }
}
