<?php

namespace App\Controller\Api\Project;

use App\Service\Project\BlockService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages/{pageId}/blocks/{blockId}/idevices/{ideviceId}', name: 'api_v2_projects_pages_blocks_idevices_get', methods: ['GET'])]
class GetIdeviceAction extends AbstractController
{
    public function __construct(private readonly BlockService $service)
    {
    }

    public function __invoke(string $projectId, Request $request, string $ideviceId)
    {
        $nodeId = (string) ($request->attributes->get('pageId') ?? $request->attributes->get('nodeId'));
        $blockId = (string) $request->attributes->get('blockId');
        try {
            $data = $this->service->getIdevice($projectId, $nodeId, $blockId, $ideviceId);

            return $this->json($data, 200);
        } catch (\InvalidArgumentException $e) {
            $notFound = str_contains(strtolower($e->getMessage()), 'not found');

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
