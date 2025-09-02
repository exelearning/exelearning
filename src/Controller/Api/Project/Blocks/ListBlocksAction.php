<?php

namespace App\Controller\Api\Project\Blocks;

use App\Service\Project\BlockService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages/{pageId}/blocks', name: 'api_v2_projects_pages_blocks_list', methods: ['GET'])]
class ListBlocksAction extends AbstractController
{
    public function __construct(private readonly BlockService $service)
    {
    }

    public function __invoke(string $projectId, Request $request)
    {
        $pageId = (string) ($request->attributes->get('pageId') ?? $request->attributes->get('nodeId'));
        $limit = $request->query->get('limit');
        $offset = $request->query->get('offset');
        try {
            $res = $this->service->listBlocks(
                $projectId,
                $pageId,
                null !== $limit ? (int) $limit : null,
                null !== $offset ? (int) $offset : null
            );

            return $this->json($res, 200);
        } catch (\InvalidArgumentException $e) {
            $notFound = str_contains(strtolower($e->getMessage()), 'project not found');

            return $this->json([
                'title' => $notFound ? 'Not Found' : 'Validation error',
                'detail' => $e->getMessage(),
                'type' => $notFound ? '/errors/404' : '/errors/400',
            ], $notFound ? 404 : 400);
        } catch (\Throwable $e) {
            return $this->json([
                'title' => 'Unexpected error',
                'detail' => $e->getMessage(),
                'type' => '/errors/500',
            ], 500);
        }
    }
}
