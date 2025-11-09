<?php

namespace App\Command\net\exelearning\Command;

use App\Settings;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\Process\Process;

#[AsCommand(
    name: 'app:translations:extract',
    description: 'Extracts translations and post-processes the XLF files.')]
class ExtractTranslationsCommand extends Command
{
    protected static string $defaultName = 'app:translations:extract';

    private $projectDir;

    public function __construct(ParameterBagInterface $params)
    {
        $this->projectDir = $params->get('kernel.project_dir'); // Get the project directory
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->setDescription('Extracts translations and post-processes the XLF files.')
            ->setHelp('This command extracts translations for all locales defined in Settings and cleans the specified XLF file.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        // Loop through locales defined in Settings::LOCALES
        foreach (Settings::LOCALES as $locale => $language) {
            $io->section("Processing locale: $locale");

            // Run translation:extract command
            $process = new Process(['php', 'bin/console', 'translation:extract', '--domain=messages', '--force', $locale]);
            // Increasing the process time to 120 seconds for slow machines
            $process->setTimeout(120);
            $process->run();

            if (!$process->isSuccessful()) {
                $io->error("Error extracting translations for locale $locale");

                return Command::FAILURE;
            }

            $io->success("Translations extracted successfully for locale $locale.");

            // Handle potential renaming of +intl-icu files
            $this->handleIntlIcuFile($locale, 'messages', $io);

            // Clean the specific .xlf file after extraction
            $this->cleanXlfFile($locale, 'messages', $io);
        }

        return Command::SUCCESS;
    }

    private function handleIntlIcuFile(string $locale, string $domain, SymfonyStyle $io): void
    {
        // Define the potential +intl-icu file
        $intlIcuFile = $this->projectDir.'/translations/'.$domain.'+intl-icu.'.$locale.'.xlf';
        $standardFile = $this->projectDir.'/translations/'.$domain.'.'.$locale.'.xlf';

        // Check if the intl-icu file exists
        if (file_exists($intlIcuFile)) {
            // Rename the +intl-icu file to the standard format
            rename($intlIcuFile, $standardFile);
            $io->success("Renamed file: $domain+intl-icu.$locale.xlf to $domain.$locale.xlf");
        }
    }

    private function cleanXlfFile(string $locale, string $domain, SymfonyStyle $io): void
    {
        // Define the specific file to clean (messages.{locale}.xlf)
        $file = $this->projectDir.'/translations/'.$domain.'.'.$locale.'.xlf';

        if (!file_exists($file)) {
            $io->warning("File not found: translations/$domain.$locale.xlf");

            return;
        }

        $content = file_get_contents($file);

        // Replace <target>__...</target> with <target></target>
        $updatedContent = preg_replace('/<target>__([^<]*)<\/target>/', '<target></target>', $content);

        // Remove all strings that start with \\, like \\xrightarrow{\\text{text}}
        $updatedContent = preg_replace_callback(
            '/<trans-unit\b[^>]*>.*?<source>(.*?)<\/source>.*?<\/trans-unit>/s',
            function ($matches) {
                $source = $matches[1];
                if (str_starts_with($source, '\\\\')) {
                    return '';
                }

                return $matches[0]; // conservar el trans-unit
            },
            $updatedContent
        );

        // Remove empty lines between trans-unit elements
        $updatedContent = str_replace("      \n", '', $updatedContent);

        // Save the updated content back to the file
        file_put_contents($file, $updatedContent);

        // Show relative path
        $relativePath = 'translations/'.$domain.'.'.$locale.'.xlf';
        $io->success("Cleaned file: $relativePath");
    }
}
