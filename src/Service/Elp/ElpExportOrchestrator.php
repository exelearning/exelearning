<?php

namespace App\Service\Elp;

use App\Entity\net\exelearning\Entity\User;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Service\net\exelearning\Service\Api\OdeExportServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Service\net\exelearning\Service\FilesDir\FilesDirServiceInterface;
use App\Util\net\exelearning\Util\FileUtil;
use Symfony\Component\Filesystem\Exception\IOExceptionInterface;
use Symfony\Component\Filesystem\Filesystem;

/**
 * Service to orchestrate ELP file exports.
 *
 * Extracted from ElpExportCommand to allow in-process use by REST API.
 */
class ElpExportOrchestrator
{
    public function __construct(
        private readonly OdeServiceInterface $odeService,
        private readonly OdeExportServiceInterface $odeExportService,
        private readonly FileHelper $fileHelper,
        private readonly FilesDirServiceInterface $filesDirService,
    ) {
    }

    /**
     * Export an ELP file to the specified format.
     *
     * @param string      $inputPath Path to input ELP file
     * @param string      $outputDir Directory where export should be saved
     * @param string      $format    Export format (elp, html5, html5-sp, scorm12, scorm2004, ims, epub3)
     * @param User        $user      User context for the export
     * @param string|bool $baseUrl   Optional base URL for links
     *
     * @return array{success: bool, message: string, exportPath?: string, files?: array}
     */
    public function export(
        string $inputPath,
        string $outputDir,
        string $format,
        User $user,
        $baseUrl = false,
    ): array {
        // Validate input file
        if (!file_exists($inputPath)) {
            return ['success' => false, 'message' => 'Input file not found'];
        }

        // Ensure output directory exists
        if (!file_exists($outputDir)) {
            if (!mkdir($outputDir, 0755, true)) {
                return ['success' => false, 'message' => 'Failed to create output directory'];
            }
        } elseif (!is_dir($outputDir) || !is_writable($outputDir)) {
            return ['success' => false, 'message' => 'Output path is not a writable directory'];
        }

        // Generate FILES_DIR directory structure
        $this->filesDirService->checkFilesDir();

        // Generate session ID
        $sessionId = $this->generateSessionId();
        $sessionDir = $this->fileHelper->getOdeSessionDir($sessionId);
        $sessionDistDir = $sessionDir.'dist/';

        // Ensure directories exist
        FileUtil::ensureDirectoryExists($sessionDir);
        FileUtil::ensureDirectoryExists($sessionDistDir);

        try {
            // Copy input file to session directory
            $inputFileName = basename($inputPath);
            $sessionFilePath = $sessionDistDir.$inputFileName;
            FileUtil::copyFile($inputPath, $sessionFilePath);

            // Validate ELP file
            $checkResult = $this->odeService->checkLocalOdeFile(
                $inputFileName,
                $sessionFilePath,
                $user,
                true
            );

            if ('OK' !== $checkResult['responseMessage']) {
                throw new \RuntimeException('Invalid ELP file: '.$checkResult['responseMessage']);
            }

            // Create ELP structure
            $this->odeService->createElpStructureAndCurrentOdeUser(
                $inputFileName,
                $user,
                $user,
                '127.0.0.1',
                true,
                $checkResult
            );

            // Export to requested format
            $exportResult = $this->odeExportService->export(
                $user,
                $user,
                $checkResult['odeSessionId'],
                $baseUrl,
                $format,
                false,
                false
            );

            if ('OK' !== $exportResult['responseMessage']) {
                throw new \RuntimeException('Export failed: '.$exportResult['responseMessage']);
            }

            // Copy export result to output directory
            $exportDirPath = $this->fileHelper->getOdeSessionUserTmpExportDir($checkResult['odeSessionId'], $user);

            $filesystem = new Filesystem();
            try {
                // mirror() is the optimized way to copy a complete directory.
                $filesystem->mirror($exportDirPath, $outputDir);
            } catch (IOExceptionInterface $e) {
                throw new \RuntimeException('Failed to copy export result: '.$e->getMessage());
            }

            // List files in output directory
            $files = $this->listDirectory($outputDir);

            return [
                'success' => true,
                'message' => 'Export successful',
                'exportPath' => $outputDir,
                'files' => $files,
            ];
        } catch (\Throwable $e) {
            return [
                'success' => false,
                'message' => $e->getMessage(),
            ];
        } finally {
            // Always clean up: close ODE session and remove temp files
            try {
                if (isset($checkResult['odeSessionId'])) {
                    $this->odeService->closeOdeSession($checkResult['odeSessionId'], 0, $user);
                }
            } catch (\Throwable $e) {
                // Swallow cleanup errors
            }

            $this->cleanupSession($sessionDir);
        }
    }

    /**
     * Generate a unique session ID.
     */
    private function generateSessionId(): string
    {
        $timestamp = date('YmdHis');
        $suffix = substr(str_shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), 0, 5);

        return $timestamp.$suffix;
    }

    /**
     * Clean up the temporary session directory.
     */
    private function cleanupSession(string $sessionDir): void
    {
        if (file_exists($sessionDir)) {
            FileUtil::removeDir($sessionDir);
        }
    }

    /**
     * List files in a directory recursively.
     *
     * @return array<string>
     */
    private function listDirectory(string $dir, string $prefix = ''): array
    {
        $files = [];
        $items = scandir($dir);

        if (false === $items) {
            return $files;
        }

        foreach ($items as $item) {
            if ('.' === $item || '..' === $item) {
                continue;
            }

            $path = $dir.DIRECTORY_SEPARATOR.$item;
            $relativePath = $prefix.$item;

            if (is_file($path)) {
                $files[] = $relativePath;
            } elseif (is_dir($path)) {
                $files = array_merge($files, $this->listDirectory($path, $relativePath.'/'));
            }
        }

        return $files;
    }
}
