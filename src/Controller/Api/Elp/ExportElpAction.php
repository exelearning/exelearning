<?php

namespace App\Controller\Api\Elp;

use App\Constants;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\Elp\ElpExportOrchestrator;
use App\Service\Elp\EphemeralUserManager;
use App\Service\Elp\UploadedElpStorage;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\AsController;

/**
 * Controller for POST /api/v2/export/{format} endpoints.
 *
 * Exports ELP files to various formats: elp, html5, html5-sp, scorm12, scorm2004, ims, epub3.
 */
#[AsController]
class ExportElpAction extends AbstractController
{
    private const FORMAT_CONSTANTS = [
        'elp' => Constants::EXPORT_TYPE_ELP,
        'elpx' => Constants::EXPORT_TYPE_ELP,
        'html5' => Constants::EXPORT_TYPE_HTML5,
        'html5-sp' => Constants::EXPORT_TYPE_HTML5_SP,
        'scorm12' => Constants::EXPORT_TYPE_SCORM12,
        'scorm2004' => Constants::EXPORT_TYPE_SCORM2004,
        'ims' => Constants::EXPORT_TYPE_IMS,
        'epub3' => Constants::EXPORT_TYPE_EPUB3,
    ];

    public function __construct(
        private readonly UserHelper $userHelper,
        private readonly ElpExportOrchestrator $exportOrchestrator,
        private readonly UploadedElpStorage $storage,
        private readonly EphemeralUserManager $userManager,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * Export an uploaded ELP file to the specified format.
     *
     * Accepts multipart/form-data with 'file' field and optional 'baseUrl' field.
     * The format is determined by the route (e.g., /api/v2/export/html5).
     */
    public function __invoke(Request $request, string $format): Response
    {
        $correlationId = uniqid('export_', true);

        try {
            // Get authenticated user
            $user = $this->getUser();
            if (!$user) {
                return $this->json([
                    'code' => 'UNAUTHORIZED',
                    'detail' => 'Authentication required',
                ], 401);
            }

            $dbUser = $this->userHelper->getDatabaseUser($user);

            // Validate format
            if (!isset(self::FORMAT_CONSTANTS[$format])) {
                return $this->json([
                    'code' => 'INVALID_FORMAT',
                    'detail' => sprintf(
                        'Invalid export format: %s. Valid formats: %s',
                        $format,
                        implode(', ', array_keys(self::FORMAT_CONSTANTS))
                    ),
                ], 400);
            }

            $exportFormat = self::FORMAT_CONSTANTS[$format];

            // Validate Content-Type
            $contentType = (string) ($request->headers->get('Content-Type') ?? '');
            if (!str_starts_with($contentType, 'multipart/form-data')) {
                return $this->json([
                    'code' => 'UNSUPPORTED_MEDIA_TYPE',
                    'detail' => 'Expected multipart/form-data',
                ], 415);
            }

            // Get uploaded file
            $file = $request->files->get('file');
            if (!$file) {
                return $this->json([
                    'code' => 'MISSING_FILE',
                    'detail' => 'No file uploaded. Expected field name: file',
                ], 400);
            }

            // Check if file was uploaded successfully
            if (!$file->isValid()) {
                return $this->json([
                    'code' => 'UPLOAD_ERROR',
                    'detail' => 'File upload failed: '.$file->getErrorMessage(),
                ], 400);
            }

            // Get optional baseUrl parameter
            $baseUrl = $request->request->get('baseUrl', false);
            if (is_string($baseUrl) && '' === trim($baseUrl)) {
                $baseUrl = false;
            }

            // Store uploaded file
            try {
                $inputPath = $this->storage->store($file, $dbUser);
            } catch (\RuntimeException $e) {
                $errorCode = 'UPLOAD_TOO_LARGE';
                if (str_contains($e->getMessage(), 'extension') || str_contains($e->getMessage(), 'MIME')) {
                    $errorCode = 'INVALID_FILE_TYPE';
                }

                return $this->json([
                    'code' => $errorCode,
                    'detail' => $e->getMessage(),
                ], str_contains($e->getMessage(), 'too large') ? 413 : 422);
            }

            // Create ephemeral user for export (to avoid conflicts with user's session)
            $ephemeralUser = $this->userManager->createEphemeralUser();

            // Prepare output directory
            $outputDir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'exe_export_'.uniqid();

            try {
                // Perform export
                $this->logger->info('Starting ELP export', [
                    'correlation_id' => $correlationId,
                    'user' => $user->getUserIdentifier(),
                    'format' => $format,
                    'input_file' => basename($inputPath),
                ]);

                $result = $this->exportOrchestrator->export(
                    $inputPath,
                    $outputDir,
                    $exportFormat,
                    $ephemeralUser,
                    $baseUrl
                );

                if (!$result['success']) {
                    $this->logger->error('ELP export failed', [
                        'correlation_id' => $correlationId,
                        'format' => $format,
                        'error' => $result['message'],
                    ]);

                    $errorCode = 'EXPORT_FAILED';
                    if (str_contains($result['message'], 'Invalid ELP')) {
                        $errorCode = 'INVALID_ELP';
                    }

                    return $this->json([
                        'code' => $errorCode,
                        'detail' => $result['message'],
                    ], str_contains($result['message'], 'Invalid ELP') ? 422 : 500);
                }

                $this->logger->info('ELP export successful', [
                    'correlation_id' => $correlationId,
                    'format' => $format,
                    'files_count' => count($result['files'] ?? []),
                ]);

                // Build response
                $response = [
                    'status' => 'success',
                    'format' => $format,
                    'exportPath' => $result['exportPath'] ?? null,
                    'files' => $result['files'] ?? [],
                    'filesCount' => count($result['files'] ?? []),
                ];

                // Clean up output directory after sending response
                // In a production environment, you would keep these files and generate signed URLs
                // For now, we'll just return the file list and clean up
                register_shutdown_function(function () use ($outputDir) {
                    if (is_dir($outputDir)) {
                        $this->removeDirectory($outputDir);
                    }
                });

                return $this->json($response, 201);
            } finally {
                // Clean up uploaded file and ephemeral user
                $this->storage->remove($inputPath);
                $this->userManager->removeEphemeralUser($ephemeralUser);
            }
        } catch (\Throwable $e) {
            $this->logger->error('Unexpected error during ELP export', [
                'correlation_id' => $correlationId,
                'format' => $format ?? 'unknown',
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->json([
                'code' => 'INTERNAL_ERROR',
                'detail' => 'An unexpected error occurred',
            ], 500);
        }
    }

    /**
     * Recursively remove a directory and its contents.
     */
    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $items = scandir($dir);
        if (false === $items) {
            return;
        }

        foreach ($items as $item) {
            if ('.' === $item || '..' === $item) {
                continue;
            }

            $path = $dir.DIRECTORY_SEPARATOR.$item;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }

        @rmdir($dir);
    }
}
