<?php

namespace App\Controller\Api\Project\Blocks;

use App\Service\Project\BlockService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages/{pageId}/blocks/{blockId}', name: 'api_v2_projects_pages_blocks_delete', methods: ['DELETE'])]
class DeleteBlockAction extends AbstractController
{
    public function __construct(private readonly BlockService $service)
    {
    }

    public function __invoke(string $projectId, Request $request)
    {
        $pageId = (string) ($request->attributes->get('pageId') ?? $request->attributes->get('nodeId'));
        $blockId = (string) $request->attributes->get('blockId');
        $soft = ('false' !== $request->query->get('soft', 'true'));

        try {
            $this->service->deleteBlock($projectId, $pageId, $blockId, $soft);

            return new JsonResponse(null, 204);
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
