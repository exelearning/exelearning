<?php

namespace App\Controller\net\exelearning\Controller\Maintenance;

use App\Service\net\exelearning\Service\Maintenance\TmpFilesCleanupService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class TmpCleanupController extends AbstractController
{
    public function __construct(
        private readonly TmpFilesCleanupService $cleanupService,
        #[Autowire('%app.tmp_cleanup_key%')] private readonly string $cleanupKey
    ) {
    }

    #[Route('/maintenance/tmp/cleanup', name: 'maintenance_tmp_cleanup', methods: ['POST'])]
    public function __invoke(Request $request): JsonResponse
    {
        if ('' === trim($this->cleanupKey)) {
            return $this->json(
                ['error' => 'Cleanup key is not configured.'],
                Response::HTTP_SERVICE_UNAVAILABLE
            );
        }

        $providedKey = (string) $request->query->get('key', '');

        if ('' === $providedKey || !hash_equals($this->cleanupKey, $providedKey)) {
            return $this->json(
                ['error' => 'Invalid cleanup key.'],
                Response::HTTP_FORBIDDEN
            );
        }

        $result = $this->cleanupService->cleanup();

        $responseData = [
            'tmp_directory' => $result->getTmpDirectory(),
            'threshold' => $result->getThreshold()->format(DATE_ATOM),
            'removed_files' => $result->getRemovedFiles(),
            'removed_directories' => $result->getRemovedDirectories(),
            'skipped' => $result->getSkipped(),
            'failures' => $result->getFailures(),
        ];

        $status = $result->hasFailures() ? Response::HTTP_MULTI_STATUS : Response::HTTP_OK;

        return $this->json($responseData, $status);
    }
}
