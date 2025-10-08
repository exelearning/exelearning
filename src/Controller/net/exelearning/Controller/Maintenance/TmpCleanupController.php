<?php

namespace App\Controller\net\exelearning\Controller\Maintenance;

use App\Service\net\exelearning\Service\Maintenance\TmpFilesCleanupService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

class TmpCleanupController extends AbstractController
{
    private readonly string $cleanupKey;

    public function __construct(
        private readonly TmpFilesCleanupService $cleanupService,
        #[Autowire('%app.tmp_cleanup_key%')] ?string $cleanupKey = null,
    ) {
        // Normalize configured key; prefer first non-empty among DI param, getenv, then $_SERVER
        $normalized = is_string($cleanupKey) ? trim($cleanupKey) : '';
        if ('' === $normalized) {
            $fromGetenv = getenv('TMP_CLEANUP_KEY');
            if (is_string($fromGetenv) && '' !== trim($fromGetenv)) {
                $normalized = trim($fromGetenv);
            }
        }
        if ('' === $normalized && isset($_ENV['TMP_CLEANUP_KEY']) && '' !== trim((string) $_ENV['TMP_CLEANUP_KEY'])) {
            $normalized = trim((string) $_ENV['TMP_CLEANUP_KEY']);
        }
        if ('' === $normalized && isset($_SERVER['TMP_CLEANUP_KEY']) && '' !== trim((string) $_SERVER['TMP_CLEANUP_KEY'])) {
            $normalized = trim((string) $_SERVER['TMP_CLEANUP_KEY']);
        }

        $this->cleanupKey = $normalized;
    }

    #[Route('/maintenance/tmp/cleanup', name: 'maintenance_tmp_cleanup', methods: ['POST', 'GET'])]
    public function __invoke(Request $request): Response
    {
        // If no key is configured, exit quietly with no error
        if ('' === trim($this->cleanupKey)) {
            return new Response('', Response::HTTP_NO_CONTENT);
        }

        // Accept key from query string (GET) or request body (POST)
        $providedKey = (string) ($request->query->get('key', '') ?: $request->request->get('key', ''));

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
