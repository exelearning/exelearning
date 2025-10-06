<?php

namespace App\Controller\Api\Project\Blocks;

use App\Service\Project\BlockService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages/{pageId}/blocks', name: 'api_v2_projects_pages_blocks_reorder', methods: ['PATCH'])]
class ReorderBlocksAction extends AbstractController
{
    public function __construct(private readonly BlockService $service)
    {
    }

    public function __invoke(string $projectId, Request $request)
    {
        $payload = json_decode($request->getContent(), true) ?? [];
        $order = (array) ($payload['order'] ?? []);
        $pageId = (string) ($request->attributes->get('pageId') ?? $request->attributes->get('nodeId'));
        try {
            $step = isset($payload['step']) ? (int) $payload['step'] : 100;
            $ordered = $this->service->reorderBlocks($projectId, $pageId, $order, $step);
        } catch (\InvalidArgumentException $e) {
            throw new BadRequestHttpException($e->getMessage());
        }

        return $this->json(['order' => array_values($ordered)], 200);
    }
}
