<?php

namespace App\Controller\Api\Elp;

use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\Elp\ElpConversionService;
use App\Service\Elp\EphemeralUserManager;
use App\Service\Elp\UploadedElpStorage;
use Psr\Log\LoggerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\HttpKernel\Attribute\AsController;

/**
 * Controller for POST /api/v2/convert/elp endpoint.
 *
 * Converts old ELP files (contentv2/v3) to the current format (contentv4/elpx).
 */
#[AsController]
class ConvertElpAction extends AbstractController
{
    public function __construct(
        private readonly UserHelper $userHelper,
        private readonly ElpConversionService $conversionService,
        private readonly UploadedElpStorage $storage,
        private readonly EphemeralUserManager $userManager,
        private readonly LoggerInterface $logger,
    ) {
    }

    /**
     * Convert an uploaded ELP file to the current format.
     *
     * Accepts multipart/form-data with 'file' field.
     * Supports ?download=1 query parameter to stream the converted file directly.
     */
    public function __invoke(Request $request): Response
    {
        $correlationId = uniqid('convert_', true);

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

            // Create ephemeral user for conversion (to avoid conflicts with user's session)
            $ephemeralUser = $this->userManager->createEphemeralUser();

            // Prepare output path
            $outputPath = sys_get_temp_dir().DIRECTORY_SEPARATOR.'exe_convert_'.uniqid().'.elpx';

            try {
                // Perform conversion
                $this->logger->info('Starting ELP conversion', [
                    'correlation_id' => $correlationId,
                    'user' => $user->getUserIdentifier(),
                    'input_file' => basename($inputPath),
                ]);

                $result = $this->conversionService->convert($inputPath, $outputPath, $ephemeralUser);

                if (!$result['success']) {
                    $this->logger->error('ELP conversion failed', [
                        'correlation_id' => $correlationId,
                        'error' => $result['message'],
                    ]);

                    $errorCode = 'CONVERSION_FAILED';
                    if (str_contains($result['message'], 'Invalid ELP')) {
                        $errorCode = 'INVALID_ELP';
                    }

                    return $this->json([
                        'code' => $errorCode,
                        'detail' => $result['message'],
                    ], str_contains($result['message'], 'Invalid ELP') ? 422 : 500);
                }

                // Check if download mode is requested
                $download = (bool) $request->query->get('download', false);

                if ($download) {
                    // Stream file directly
                    $response = new BinaryFileResponse($outputPath);
                    $response->setContentDisposition(
                        ResponseHeaderBag::DISPOSITION_ATTACHMENT,
                        'converted_'.basename($file->getClientOriginalName() ?: 'file.elpx')
                    );
                    $response->deleteFileAfterSend(true);

                    $this->logger->info('ELP conversion successful (download)', [
                        'correlation_id' => $correlationId,
                    ]);

                    return $response;
                } else {
                    // Return JSON with download URL
                    // In a production environment, you would store this file and generate a signed URL
                    // For now, we'll return metadata
                    $fileName = basename($outputPath);
                    $fileSize = file_exists($outputPath) ? filesize($outputPath) : 0;

                    $this->logger->info('ELP conversion successful', [
                        'correlation_id' => $correlationId,
                        'output_size' => $fileSize,
                    ]);

                    $response = $this->json([
                        'status' => 'success',
                        'fileName' => $fileName,
                        'size' => $fileSize,
                        'message' => 'Conversion completed. Use ?download=1 to download the file directly.',
                    ], 201);

                    // Clean up output file if not downloading
                    if (file_exists($outputPath)) {
                        @unlink($outputPath);
                    }

                    return $response;
                }
            } finally {
                // Clean up uploaded file and ephemeral user
                $this->storage->remove($inputPath);
                $this->userManager->removeEphemeralUser($ephemeralUser);
            }
        } catch (\Throwable $e) {
            $this->logger->error('Unexpected error during ELP conversion', [
                'correlation_id' => $correlationId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return $this->json([
                'code' => 'INTERNAL_ERROR',
                'detail' => 'An unexpected error occurred',
            ], 500);
        }
    }
}
