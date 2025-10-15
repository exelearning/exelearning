<?php

namespace App\Tests\Unit\Service;

use App\Helper\net\exelearning\Helper\FileHelper;
use App\Service\net\exelearning\Service\Maintenance\TmpFilesCleanupService;
use PHPUnit\Framework\Attributes\CoversClass;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

#[CoversClass(TmpFilesCleanupService::class)]
final class TmpFilesCleanupServiceTest extends KernelTestCase
{
    private TmpFilesCleanupService $cleanupService;
    private FileHelper $fileHelper;

    protected function setUp(): void
    {
        self::bootKernel();
        $container = static::getContainer();
        $this->cleanupService = $container->get(TmpFilesCleanupService::class);
        $this->fileHelper = $container->get(FileHelper::class);
    }

    protected function tearDown(): void
    {
        parent::tearDown();
        static::ensureKernelShutdown();
    }

    public function testCleanupRemovesEntriesOlderThanThreshold(): void
    {
        $tmpDir = $this->fileHelper->getTemporaryContentStorageDir();
        if (!is_dir($tmpDir)) {
            mkdir($tmpDir, 0777, true);
        }

        $oldFile = $tmpDir.'old-file.txt';
        file_put_contents($oldFile, 'old');
        touch($oldFile, time() - TmpFilesCleanupService::DEFAULT_MAX_AGE_SECONDS - 5);

        $recentFile = $tmpDir.'recent-file.txt';
        file_put_contents($recentFile, 'recent');
        touch($recentFile, time());

        $oldDirectory = $tmpDir.'old-directory';
        if (!is_dir($oldDirectory)) {
            mkdir($oldDirectory, 0777, true);
        }
        $nestedOldFile = $oldDirectory.'/nested.txt';
        file_put_contents($nestedOldFile, 'nested');
        $oldTimestamp = time() - TmpFilesCleanupService::DEFAULT_MAX_AGE_SECONDS - 5;
        touch($nestedOldFile, $oldTimestamp);
        touch($oldDirectory, $oldTimestamp);

        $result = $this->cleanupService->cleanup();

        self::assertFileDoesNotExist($oldFile);
        self::assertFileDoesNotExist($nestedOldFile);
        self::assertDirectoryDoesNotExist($oldDirectory);
        self::assertFileExists($recentFile);
        self::assertGreaterThanOrEqual(1, $result->getSkipped());
        self::assertSame([], $result->getFailures());
        self::assertGreaterThanOrEqual(2, $result->getRemovedFiles() + $result->getRemovedDirectories());

        // Clean recent file
        if (is_file($recentFile)) {
            unlink($recentFile);
        }
    }

    public function testCleanupRejectsInvalidAges(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->cleanupService->cleanup(0);
    }
}
