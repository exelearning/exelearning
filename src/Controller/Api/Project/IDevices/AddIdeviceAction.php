<?php

namespace App\Controller\Api\Project\IDevices;

use App\Service\Project\BlockService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class AddIdeviceAction extends AbstractController
{
    public function __construct(private readonly BlockService $service)
    {
    }

    #[Route('/api/v2/projects/{projectId}/pages/{pageId}/blocks/{blockId}/idevices', name: 'api_v2_projects_pages_blocks_idevices_add', methods: ['POST'])]
    public function __invoke(string $projectId, string $pageId, string $blockId, Request $request)
    {
        $payload = json_decode($request->getContent(), true) ?? [];
        $data = [
            'ideviceId' => $payload['ideviceId'] ?? null,
            'type' => $payload['type'] ?? 'text',
            'html' => $payload['html'] ?? ($payload['data']['html'] ?? null),
            'props' => $payload['props'] ?? ($payload['data']['props'] ?? null),
            'order' => $payload['order'] ?? ($payload['data']['order'] ?? null),
        ];

        try {
            $saved = $this->service->addIdevice($projectId, $pageId, $blockId, $data);

            return $this->json($saved, 201);
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
