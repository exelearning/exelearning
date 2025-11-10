<?php

namespace App\Service\Elp;

use App\Constants;
use App\Entity\net\exelearning\Entity\User;
use App\Helper\net\exelearning\Helper\FileHelper;
use App\Service\net\exelearning\Service\Api\OdeExportServiceInterface;
use App\Service\net\exelearning\Service\Api\OdeServiceInterface;
use App\Service\net\exelearning\Service\FilesDir\FilesDirServiceInterface;
use App\Util\net\exelearning\Util\FileUtil;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Service to handle ELP file conversion.
 *
 * Extracted from ElpConvertCommand to allow in-process use by REST API.
 */
class ElpConversionService
{
    public function __construct(
        private readonly OdeServiceInterface $odeService,
        private readonly OdeExportServiceInterface $odeExportService,
        private readonly FileHelper $fileHelper,
        private readonly FilesDirServiceInterface $filesDirService,
        private readonly EntityManagerInterface $entityManager,
    ) {
    }

    /**
     * Convert an ELP file from contentv2/v3 to current format.
     *
     * @param string $inputPath  Path to input ELP file
     * @param string $outputPath Path where converted file should be saved
     * @param User   $user       User context for the conversion
     *
     * @return array{success: bool, message: string, outputPath?: string}
     */
    public function convert(string $inputPath, string $outputPath, User $user): array
    {
        // Validate input file
        if (!file_exists($inputPath)) {
            return ['success' => false, 'message' => 'Input file not found'];
        }

        // Generate FILES_DIR directory structure
        $this->filesDirService->checkFilesDir();

        // Generate a unique session ID for this conversion
        $odeSessionId = $this->generateSessionId();

        // Create session directories
        $sessionDir = $this->fileHelper->getOdeSessionDir($odeSessionId);
        $sessionDistDir = $sessionDir.'dist/';

        // Ensure directories exist
        FileUtil::ensureDirectoryExists($sessionDir);
        FileUtil::ensureDirectoryExists($sessionDistDir);

        try {
            // Copy input file to session directory
            $inputFileName = basename($inputPath);
            $sessionFilePath = $sessionDistDir.$inputFileName;
            FileUtil::copyFile($inputPath, $sessionFilePath);

            // Check if the file is a valid ELP file
            $checkResult = $this->odeService->checkLocalOdeFile(
                $inputFileName,
                $sessionFilePath,
                $user,
                true // Force close any previous session
            );

            if ('OK' !== $checkResult['responseMessage']) {
                throw new \RuntimeException('Invalid ELP file: '.$checkResult['responseMessage']);
            }

            // Create ELP structure and process the file
            $this->odeService->createElpStructureAndCurrentOdeUser(
                $inputFileName,
                $user,
                $user,
                '127.0.0.1', // Mock IP address
                true, // Force close any previous session
                $checkResult
            );

            // Export the processed file
            $exportResult = $this->odeExportService->export(
                $user,                  // UserInterface
                $user,                  // dbUser (the same in this case)
                $checkResult['odeSessionId'],
                false,                  // baseUrl (false because it is not a preview)
                Constants::EXPORT_TYPE_ELP,
                false,                  // preview
                false                   // isIntegration
            );

            if ('OK' !== $exportResult['responseMessage']) {
                throw new \RuntimeException('Export failed: '.$exportResult['responseMessage']);
            }

            // Copy the exported file to the output path
            $exportedFilePath = $this->fileHelper->getOdeSessionUserTmpExportDir($checkResult['odeSessionId'], $user).$exportResult['zipFileName'];

            FileUtil::copyFile($exportedFilePath, $outputPath);

            return [
                'success' => true,
                'message' => 'Conversion successful',
                'outputPath' => $outputPath,
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
        // Create timestamp part in format YYYYMMDDHHmmss
        $timestamp = date('YmdHis');

        // Generate random alphanumeric suffix (5 characters)
        $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $suffix = '';
        for ($i = 0; $i < 5; ++$i) {
            $suffix .= $characters[rand(0, strlen($characters) - 1)];
        }

        // Combine timestamp and suffix
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
}
