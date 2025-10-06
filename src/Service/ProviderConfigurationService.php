<?php

namespace App\Service;

use App\Util\net\exelearning\Util\IntegrationUtil;
use Psr\Log\LoggerInterface;

/**
 * Service for managing and validating platform provider configurations.
 *
 * This service provides an interface for validating provider configurations
 * and ensuring that the multi-provider setup is correctly configured.
 *
 * @author eXeLearning
 */
class ProviderConfigurationService
{
    private IntegrationUtil $integrationUtil;
    private LoggerInterface $logger;

    public function __construct(IntegrationUtil $integrationUtil, LoggerInterface $logger)
    {
        $this->integrationUtil = $integrationUtil;
        $this->logger = $logger;
    }

    /**
     * Validate the current provider configuration.
     *
     * @return array Array of validation results with 'valid' boolean and 'errors' array
     */
    public function validateConfiguration(): array
    {
        $errors = $this->integrationUtil->validateProviderConfiguration();
        $providerIds = $this->integrationUtil->getProviderIds();

        $result = [
            'valid' => empty($errors),
            'errors' => $errors,
            'provider_count' => count($providerIds),
            'providers' => [],
        ];

        // Check each provider individually
        foreach ($providerIds as $providerId) {
            $providerUrl = $this->integrationUtil->getProviderUrl($providerId);
            $providerCheck = [
                'id' => $providerId,
                'url' => $providerUrl,
                'url_reachable' => $this->checkUrlReachability($providerUrl),
            ];

            $result['providers'][] = $providerCheck;

            if (!$providerCheck['url_reachable']) {
                $result['errors'][] = "Provider URL not reachable: {$providerUrl}";
                $result['valid'] = false;
            }
        }

        // Log validation results
        if ($result['valid']) {
            $this->logger->info('Provider configuration validation passed', [
                'provider_count' => $result['provider_count'],
            ]);
        } else {
            $this->logger->warning('Provider configuration validation failed', [
                'errors' => $result['errors'],
            ]);
        }

        return $result;
    }

    /**
     * Get provider statistics.
     *
     * @return array Provider statistics
     */
    public function getProviderStatistics(): array
    {
        $providerIds = $this->integrationUtil->getProviderIds();

        return [
            'total_providers' => count($providerIds),
            'provider_ids' => $providerIds,
            'configuration_valid' => empty($this->integrationUtil->validateProviderConfiguration()),
        ];
    }

    /**
     * Check if a provider exists and is configured.
     *
     * @param string $providerId Provider ID to check
     *
     * @return bool True if provider exists and is configured
     */
    public function isProviderConfigured(string $providerId): bool
    {
        $providerIds = $this->integrationUtil->getProviderIds();

        return in_array($providerId, $providerIds, true);
    }

    /**
     * Get configuration recommendations.
     *
     * @return array Array of recommendations for improving configuration
     */
    public function getConfigurationRecommendations(): array
    {
        $recommendations = [];
        $providerIds = $this->integrationUtil->getProviderIds();

        if (empty($providerIds)) {
            $recommendations[] = [
                'type' => 'warning',
                'message' => 'No providers configured. Add PROVIDER_URLS, PROVIDER_TOKENS, '.
                            'and PROVIDER_IDS to environment.',
            ];
        } elseif (1 === count($providerIds)) {
            $recommendations[] = [
                'type' => 'info',
                'message' => 'Single provider configured. Consider adding backup providers for redundancy.',
            ];
        }

        // Check for HTTPS usage
        foreach ($providerIds as $providerId) {
            $url = $this->integrationUtil->getProviderUrl($providerId);
            if ($url && !str_starts_with($url, 'https://')) {
                $recommendations[] = [
                    'type' => 'security',
                    'message' => "Provider {$providerId} uses HTTP instead of HTTPS. Consider upgrading for security.",
                ];
            }
        }

        return $recommendations;
    }

    /**
     * Basic URL reachability check.
     *
     * @param string|null $url URL to check
     *
     * @return bool True if URL appears to be reachable
     */
    private function checkUrlReachability(?string $url): bool
    {
        if (!$url) {
            return false;
        }

        // Basic URL format validation
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            return false;
        }

        // In a production environment, you might want to do actual HTTP checks
        // For now, we just validate the URL format
        return true;
    }
}
