<?php

namespace App\Command;

use App\Service\ProviderConfigurationService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Console command to validate provider configuration.
 *
 * This command allows administrators to validate their multi-provider
 * configuration from the command line.
 *
 * @author eXeLearning
 */
#[AsCommand(
    name: 'app:validate-providers',
    description: 'Validate the configuration of platform providers'
)]
class ValidateProvidersCommand extends Command
{
    private ProviderConfigurationService $providerConfigService;

    public function __construct(ProviderConfigurationService $providerConfigService)
    {
        parent::__construct();
        $this->providerConfigService = $providerConfigService;
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $io->title('eXeLearning Provider Configuration Validation');

        // Get validation results
        $validation = $this->providerConfigService->validateConfiguration();
        $statistics = $this->providerConfigService->getProviderStatistics();
        $recommendations = $this->providerConfigService->getConfigurationRecommendations();

        // Display statistics
        $io->section('Configuration Overview');
        $io->definitionList(
            ['Total Providers' => $statistics['total_providers']],
            ['Configuration Valid' => $statistics['configuration_valid'] ? 'Yes' : 'No'],
            ['Provider IDs' => implode(', ', $statistics['provider_ids']) ?: 'None']
        );

        // Display provider details
        if (!empty($validation['providers'])) {
            $io->section('Provider Details');
            $headers = ['Provider ID', 'URL', 'Reachable'];
            $rows = [];

            foreach ($validation['providers'] as $provider) {
                $rows[] = [
                    $provider['id'],
                    $provider['url'] ?: 'Not configured',
                    $provider['url_reachable'] ? '✓' : '✗',
                ];
            }

            $io->table($headers, $rows);
        }

        // Display validation results
        if ($validation['valid']) {
            $io->success('Provider configuration is valid!');
        } else {
            $io->error('Provider configuration has issues:');
            foreach ($validation['errors'] as $error) {
                $io->writeln('  • '.$error);
            }
        }

        // Display recommendations
        if (!empty($recommendations)) {
            $io->section('Recommendations');
            foreach ($recommendations as $recommendation) {
                $style = match ($recommendation['type']) {
                    'warning' => 'yellow',
                    'security' => 'red',
                    'info' => 'blue',
                    default => 'white',
                };

                $io->writeln(sprintf(
                    '<fg=%s>[%s]</> %s',
                    $style,
                    strtoupper($recommendation['type']),
                    $recommendation['message']
                ));
            }
        }

        // Return appropriate exit code
        return $validation['valid'] ? Command::SUCCESS : Command::FAILURE;
    }
}
