<?php

namespace App\Controller\Api;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

/**
 * Controller that provides application configuration information to the frontend.
 *
 * This includes upload limits, feature flags, and other settings that the
 * frontend needs to know before making requests.
 */
class ConfigController extends AbstractController
{
    /**
     * Returns the effective file upload size limit.
     *
     * This endpoint allows the frontend to validate file sizes BEFORE attempting
     * to upload, providing better UX and avoiding wasted bandwidth.
     *
     * The returned limit is the most restrictive value among:
     * - Application configured limit (FILE_UPLOAD_MAX_SIZE from .env)
     * - PHP upload_max_filesize
     * - PHP post_max_size
     * - PHP memory_limit
     *
     * @return JsonResponse JSON containing the effective upload limit
     */
    #[Route('/api/config/upload-limits', name: 'api_config_upload_limits', methods: ['GET'])]
    public function getUploadLimits(): JsonResponse
    {
        $uploadLimit = $this->getEffectiveUploadLimit();

        return new JsonResponse(
            [
                'maxFileSize' => $uploadLimit['bytes'],
                'maxFileSizeFormatted' => $uploadLimit['formatted'],
                'limitingFactor' => $uploadLimit['limit_name'],
                'details' => [
                    'appConfigMB' => $this->getParameter('app.file_upload_max_size'),
                    'uploadMaxFilesize' => ini_get('upload_max_filesize'),
                    'postMaxSize' => ini_get('post_max_size'),
                    'memoryLimit' => ini_get('memory_limit'),
                ],
            ],
            JsonResponse::HTTP_OK,
            [
                // Cache for 5 minutes since these values rarely change
                'Cache-Control' => 'public, max-age=300',
            ]
        );
    }

    /**
     * Gets the effective upload size limit in bytes.
     *
     * Returns the minimum value between:
     * - Application configured limit (FILE_UPLOAD_MAX_SIZE from .env)
     * - PHP upload_max_filesize
     * - PHP post_max_size
     * - PHP memory_limit
     *
     * This ensures the most restrictive limit is enforced.
     *
     * @return array{bytes: int, formatted: string, limit_name: string}
     */
    private function getEffectiveUploadLimit(): array
    {
        // Get PHP limits
        $uploadMaxFilesize = ini_get('upload_max_filesize');
        $postMaxSize = ini_get('post_max_size');
        $memoryLimit = ini_get('memory_limit');

        // Convert PHP ini values to bytes
        $uploadMaxBytes = $this->convertPhpIniToBytes($uploadMaxFilesize);
        $postMaxBytes = $this->convertPhpIniToBytes($postMaxSize);
        $memoryLimitBytes = $this->convertPhpIniToBytes($memoryLimit);

        // Get application configured limit from .env (in MB)
        $appMaxUploadMB = $this->getParameter('app.file_upload_max_size');
        $appMaxUploadBytes = $appMaxUploadMB * 1024 * 1024;

        // Find the minimum (most restrictive) limit
        $limits = [
            'app.file_upload_max_size' => $appMaxUploadBytes,
            'upload_max_filesize' => $uploadMaxBytes,
            'post_max_size' => $postMaxBytes,
            'memory_limit' => $memoryLimitBytes,
        ];

        $minLimit = min($limits);
        $limitName = array_search($minLimit, $limits);

        return [
            'bytes' => $minLimit,
            'formatted' => $this->formatBytes($minLimit),
            'limit_name' => $limitName,
        ];
    }

    /**
     * Converts PHP ini size value (e.g., "512M", "2G") to bytes.
     *
     * @param string $value PHP ini size value
     *
     * @return int Size in bytes
     */
    private function convertPhpIniToBytes(string $value): int
    {
        $value = trim($value);
        $unit = strtoupper(substr($value, -1));
        $number = (int) substr($value, 0, -1);

        // If no unit or just a number, return as is
        if (!$unit || is_numeric($unit)) {
            return (int) $value;
        }

        switch ($unit) {
            case 'G':
                return $number * 1024 * 1024 * 1024;
            case 'M':
                return $number * 1024 * 1024;
            case 'K':
                return $number * 1024;
            default:
                return (int) $value;
        }
    }

    /**
     * Formats bytes to human-readable format (KB, MB, GB).
     *
     * @param int $bytes Size in bytes
     *
     * @return string Formatted size (e.g., "512 MB")
     */
    private function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= (1024 ** $pow);

        return round($bytes, 2).' '.$units[$pow];
    }
}
