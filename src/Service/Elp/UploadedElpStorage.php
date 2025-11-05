<?php

namespace App\Service\Elp;

use App\Entity\net\exelearning\Entity\User;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Service for safely handling uploaded ELP file storage and cleanup.
 */
class UploadedElpStorage
{
    private const ALLOWED_EXTENSIONS = ['elp', 'elpx', 'zip'];
    private const ALLOWED_MIME_TYPES = [
        'application/zip',
        'application/x-zip-compressed',
        'application/octet-stream',
    ];

    private string $uploadDir;
    private int $maxUploadSizeMb;

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        ?string $uploadDir = null,
        int $maxUploadSizeMb = 100
    ) {
        $this->uploadDir = $uploadDir ?? sys_get_temp_dir().DIRECTORY_SEPARATOR.'exe_api_uploads';
        $this->maxUploadSizeMb = $maxUploadSizeMb;

        // Ensure upload directory exists
        if (!is_dir($this->uploadDir)) {
            @mkdir($this->uploadDir, 0777, true);
        }
    }

    /**
     * Store an uploaded file safely with validation.
     *
     * @param UploadedFile $file         The uploaded file
     * @param User         $user         User context for the upload
     * @param bool         $validateSize Whether to validate file size
     *
     * @throws \RuntimeException If validation fails
     *
     * @return string Path to the stored file
     */
    public function store(UploadedFile $file, User $user, bool $validateSize = true): string
    {
        // Validate size
        if ($validateSize && $file->getSize() > $this->maxUploadSizeMb * 1024 * 1024) {
            throw new \RuntimeException(sprintf(
                'File too large. Maximum size is %d MB',
                $this->maxUploadSizeMb
            ));
        }

        // Validate extension
        $originalName = $file->getClientOriginalName() ?: 'upload.elp';
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if (!in_array($ext, self::ALLOWED_EXTENSIONS, true)) {
            throw new \RuntimeException(sprintf(
                'Invalid file extension. Allowed: %s',
                implode(', ', self::ALLOWED_EXTENSIONS)
            ));
        }

        // Validate MIME type (basic check)
        $mimeType = $file->getMimeType();
        if ($mimeType && !in_array($mimeType, self::ALLOWED_MIME_TYPES, true)) {
            throw new \RuntimeException(sprintf(
                'Invalid MIME type: %s. Expected ZIP archive.',
                $mimeType
            ));
        }

        // Generate safe filename
        $safeFileName = $this->generateSafeFileName($originalName, $user);
        $targetPath = $this->uploadDir.DIRECTORY_SEPARATOR.$safeFileName;

        // Move file
        try {
            $file->move($this->uploadDir, $safeFileName);
        } catch (\Exception $e) {
            throw new \RuntimeException('Failed to store uploaded file: '.$e->getMessage(), 0, $e);
        }

        return $targetPath;
    }

    /**
     * Remove a stored file.
     *
     * @param string $path Path to the file to remove
     */
    public function remove(string $path): void
    {
        if (file_exists($path) && is_file($path)) {
            @unlink($path);
        }
    }

    /**
     * Clean up old files from the upload directory.
     *
     * @param int $olderThanSeconds Files older than this will be removed
     */
    public function cleanupOldFiles(int $olderThanSeconds = 3600): void
    {
        if (!is_dir($this->uploadDir)) {
            return;
        }

        $now = time();
        $files = scandir($this->uploadDir);

        if (false === $files) {
            return;
        }

        foreach ($files as $file) {
            if ('.' === $file || '..' === $file) {
                continue;
            }

            $path = $this->uploadDir.DIRECTORY_SEPARATOR.$file;
            if (is_file($path)) {
                $mtime = filemtime($path);
                if ($mtime && ($now - $mtime) > $olderThanSeconds) {
                    @unlink($path);
                }
            }
        }
    }

    /**
     * Generate a safe filename for storage.
     */
    private function generateSafeFileName(string $originalName, User $user): string
    {
        $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        $userId = $user->getUserId() ?? 'anonymous';
        $timestamp = date('YmdHis');
        $random = substr(Util::generateId(), 0, 8);

        return sprintf('%s_%s_%s.%s', $userId, $timestamp, $random, $ext);
    }

    /**
     * Get the upload directory path.
     */
    public function getUploadDir(): string
    {
        return $this->uploadDir;
    }

    /**
     * Get the maximum upload size in MB.
     */
    public function getMaxUploadSizeMb(): int
    {
        return $this->maxUploadSizeMb;
    }
}
