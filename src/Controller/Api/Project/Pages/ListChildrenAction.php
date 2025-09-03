<?php

namespace App\Controller\Api\Project\Pages;

use App\Service\Project\PageService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages/{pageId}/children', name: 'api_v2_projects_pages_children', methods: ['GET'])]
class ListChildrenAction extends AbstractController
{
    public function __construct(private readonly PageService $service)
    {
    }

    public function __invoke(string $projectId, string $pageId)
    {
        $children = $this->service->listChildren($projectId, $pageId);

        return $this->json($children, 200);
    }
}
