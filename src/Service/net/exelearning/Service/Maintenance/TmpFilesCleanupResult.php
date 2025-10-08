<?php

namespace App\Service\net\exelearning\Service\Maintenance;

final class TmpFilesCleanupResult
{
    public function __construct(
        private readonly string $tmpDirectory,
        private readonly \DateTimeImmutable $threshold,
        private readonly int $removedFiles,
        private readonly int $removedDirectories,
        private readonly int $skipped,
        private readonly array $failures,
    ) {
    }

    public function getTmpDirectory(): string
    {
        return $this->tmpDirectory;
    }

    public function getThreshold(): \DateTimeImmutable
    {
        return $this->threshold;
    }

    public function getRemovedFiles(): int
    {
        return $this->removedFiles;
    }

    public function getRemovedDirectories(): int
    {
        return $this->removedDirectories;
    }

    public function getSkipped(): int
    {
        return $this->skipped;
    }

    /**
     * @return array<int, string>
     */
    public function getFailures(): array
    {
        return $this->failures;
    }

    public function hasFailures(): bool
    {
        return [] !== $this->failures;
    }
}
