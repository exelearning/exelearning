<?php

namespace App\Service\net\exelearning\Service\Maintenance;

use App\Helper\net\exelearning\Helper\FileHelper;
use Psr\Log\LoggerInterface;
use Symfony\Component\Filesystem\Filesystem;

class TmpFilesCleanupService
{
    public const DEFAULT_MAX_AGE_SECONDS = 86400; // 24 hours

    public function __construct(
        private readonly FileHelper $fileHelper,
        private readonly Filesystem $filesystem,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function cleanup(int $maxAgeSeconds = self::DEFAULT_MAX_AGE_SECONDS): TmpFilesCleanupResult
    {
        if ($maxAgeSeconds <= 0) {
            throw new \InvalidArgumentException('The maximum age must be greater than zero seconds.');
        }

        $thresholdTimestamp = time() - $maxAgeSeconds;
        $threshold = (new \DateTimeImmutable('@'.$thresholdTimestamp))
            ->setTimezone(new \DateTimeZone(date_default_timezone_get()));

        $tmpDir = $this->fileHelper->getTemporaryContentStorageDir();
        $removedFiles = 0;
        $removedDirectories = 0;
        $skipped = 0;
        $failures = [];

        if (!is_dir($tmpDir)) {
            return new TmpFilesCleanupResult($tmpDir, $threshold, 0, 0, 0, []);
        }

        $flags = \FilesystemIterator::SKIP_DOTS;
        $directoryIterator = new \RecursiveDirectoryIterator($tmpDir, $flags);
        $iterator = new \RecursiveIteratorIterator(
            $directoryIterator,
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($iterator as $item) {
            $path = $item->getPathname();

            if ($item->isDir()) {
                $isOlderThanThreshold = $item->getMTime() <= $thresholdTimestamp;
                $isEmpty = $this->isDirectoryEmpty($path);

                if (!$isOlderThanThreshold && !$isEmpty) {
                    ++$skipped;
                    continue;
                }
            } elseif ($item->getMTime() > $thresholdTimestamp) {
                ++$skipped;
                continue;
            }

            try {
                $this->filesystem->remove($path);
                if ($item->isDir()) {
                    ++$removedDirectories;
                } else {
                    ++$removedFiles;
                }
            } catch (\Throwable $exception) {
                $failures[] = $path;
                $this->logger->warning('Failed to remove temporary path.', [
                    'path' => $path,
                    'exception' => $exception,
                ]);
            }
        }

        return new TmpFilesCleanupResult($tmpDir, $threshold, $removedFiles, $removedDirectories, $skipped, $failures);
    }

    private function isDirectoryEmpty(string $path): bool
    {
        if (!is_dir($path)) {
            return true;
        }

        $handle = opendir($path);
        if (false === $handle) {
            return false;
        }

        try {
            while (false !== ($entry = readdir($handle))) {
                if ('.' === $entry || '..' === $entry) {
                    continue;
                }

                return false;
            }
        } finally {
            closedir($handle);
        }

        return true;
    }
}
