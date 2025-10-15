<?php

namespace App\Command\net\exelearning\Command;

use App\Service\net\exelearning\Service\Maintenance\TmpFilesCleanupResult;
use App\Service\net\exelearning\Service\Maintenance\TmpFilesCleanupService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(name: 'app:tmp-files:cleanup', description: 'Remove temporary files older than the configured threshold.')]
class TmpFilesCleanupCommand extends Command
{
    public function __construct(private readonly TmpFilesCleanupService $cleanupService)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption(
            'max-age',
            mode: InputOption::VALUE_REQUIRED,
            description: 'Maximum age in seconds. Files older than this will be deleted.',
            default: TmpFilesCleanupService::DEFAULT_MAX_AGE_SECONDS
        );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $maxAge = (int) $input->getOption('max-age');

        try {
            $result = $this->cleanupService->cleanup($maxAge);
        } catch (\InvalidArgumentException $exception) {
            $io->error($exception->getMessage());

            return Command::INVALID;
        }

        $this->renderSummary($io, $result, $maxAge);

        if ($result->hasFailures()) {
            $io->warning(sprintf('Failed to delete %d paths.', \count($result->getFailures())));
            foreach ($result->getFailures() as $path) {
                $io->text(' - '.$path);
            }

            return Command::FAILURE;
        }

        $io->success('Temporary files cleanup finished successfully.');

        return Command::SUCCESS;
    }

    private function renderSummary(SymfonyStyle $io, TmpFilesCleanupResult $result, int $maxAge): void
    {
        $io->writeln(sprintf('Temporary directory: %s', $result->getTmpDirectory()));
        $io->writeln(sprintf('Threshold (max age %d seconds): %s', $maxAge, $result->getThreshold()->format(DATE_ATOM)));

        $io->table(
            ['Metric', 'Value'],
            [
                ['Files removed', (string) $result->getRemovedFiles()],
                ['Directories removed', (string) $result->getRemovedDirectories()],
                ['Entries skipped', (string) $result->getSkipped()],
                ['Failures', (string) \count($result->getFailures())],
            ]
        );
    }
}
