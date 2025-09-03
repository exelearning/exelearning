<?php

namespace App\Controller\Api\Project\IDevices;

use App\Service\Project\BlockService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class ListIdevicesAction extends AbstractController
{
    public function __construct(private readonly BlockService $service)
    {
    }

    #[Route('/api/v2/projects/{projectId}/pages/{pageId}/blocks/{blockId}/idevices', name: 'api_v2_projects_pages_blocks_idevices_list', methods: ['GET'])]
    public function __invoke(string $projectId, string $pageId, string $blockId, Request $request)
    {
        try {
            $list = $this->service->listIdevices($projectId, $pageId, $blockId);

            return $this->json($list, 200);
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
