<?php

namespace App\Controller\Api\Project\IDevices;

use App\Service\Project\BlockService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class DeleteIdeviceAction extends AbstractController
{
    public function __construct(private readonly BlockService $service)
    {
    }

    #[Route('/api/v2/projects/{projectId}/pages/{pageId}/blocks/{blockId}/idevices/{ideviceId}', name: 'api_v2_projects_pages_blocks_idevices_delete', methods: ['DELETE'])]
    public function __invoke(string $projectId, string $pageId, string $blockId, string $ideviceId, Request $request)
    {
        $soft = ('false' !== $request->query->get('soft', 'true'));
        try {
            $this->service->deleteIdevice($projectId, $pageId, $blockId, $ideviceId, $soft);

            return new JsonResponse(null, 204);
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
