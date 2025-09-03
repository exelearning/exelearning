<?php

namespace App\Controller\Api\Project\Pages;

use App\Service\Project\PageService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages', name: 'api_v2_projects_pages_list', methods: ['GET'])]
class ListPagesAction extends AbstractController
{
    public function __construct(private readonly PageService $service)
    {
    }

    public function __invoke(string $projectId)
    {
        try {
            $tree = $this->service->listTree($projectId);

            return $this->json($tree, 200);
        } catch (\InvalidArgumentException $e) {
            return $this->json([
                'title' => 'Not Found',
                'detail' => $e->getMessage(),
                'type' => '/errors/404',
            ], 404);
        } catch (\Throwable $e) {
            return $this->json([
                'title' => 'Unexpected error',
                'detail' => $e->getMessage(),
                'type' => '/errors/500',
            ], 500);
        }
    }
}
