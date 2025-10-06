<?php

namespace App\Util\net\exelearning\Util;

use App\Constants;
use App\Settings;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Log\LoggerInterface;

/**
 * Generic platform integration utility for eXeLearning.
 *
 * This utility handles integration with multiple educational platforms (LMS)
 * in a platform-agnostic way, supporting multiple providers through environment configuration.
 *
 * @author eXeLearning
 */
class IntegrationUtil
{
    private LoggerInterface $logger;
    private array $providerUrls;
    private array $providerTokens;
    private array $providerIds;

    public function __construct(LoggerInterface $logger)
    {
        $this->logger = $logger;
        $this->initializeProviders();
    }

    /**
     * Initialize provider configurations from environment variables.
     */
    private function initializeProviders(): void
    {
        $this->providerUrls = $this->parseEnvArray($_ENV['PROVIDER_URLS'] ?? '');
        $this->providerTokens = $this->parseEnvArray($_ENV['PROVIDER_TOKENS'] ?? '');
        $this->providerIds = $this->parseEnvArray($_ENV['PROVIDER_IDS'] ?? '');

        // Log configuration status
        $providerCount = count($this->providerIds);
        $this->logger->info("Initialized {$providerCount} platform providers");
    }

    /**
     * Parse comma-separated environment variable values.
     */
    private function parseEnvArray(string $envValue): array
    {
        if (empty($envValue)) {
            return [];
        }

        return array_map('trim', explode(',', $envValue));
    }

    /**
     * Decode a JSON Web Token using the appropriate provider token.
     *
     * @param string      $jwtToken   The JWT token to decode
     * @param string|null $providerId Optional provider ID for token validation
     *
     * @return array|null Decoded payload or null on failure
     */
    public function decodeJWT(string $jwtToken, ?string $providerId = null): ?array
    {
        try {
            // If provider ID is specified, use its token; otherwise use default APP_SECRET
            $secret = $this->getProviderToken($providerId) ?? $_ENV['APP_SECRET'];

            $decoded = (array) JWT::decode($jwtToken, new Key($secret, Settings::JWT_SECRET_HASH));

            return $decoded;
        } catch (\Throwable $e) {
            $this->logger->error('JWT decode error: '.$e->getMessage(), [
                'provider_id' => $providerId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Generate a JWT token for a specific provider.
     *
     * @param array  $payload    The payload to encode
     * @param string $providerId The provider ID to use for token generation
     *
     * @return string|null The generated JWT token or null on failure
     */
    public function generateProviderJWT(array $payload, string $providerId): ?string
    {
        try {
            $token = $this->getProviderToken($providerId);
            if (!$token) {
                $this->logger->error("Provider token not found for ID: {$providerId}");

                return null;
            }

            // Add standard JWT claims
            $payload = array_merge($payload, [
                'iat' => time(),
                'exp' => time() + 3600, // 1 hour expiration
                'provider_id' => $providerId,
            ]);

            return JWT::encode($payload, $token, Settings::JWT_SECRET_HASH);
        } catch (\Throwable $e) {
            $this->logger->error('JWT generation error: '.$e->getMessage(), [
                'provider_id' => $providerId,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Process platform integration parameters in a generic way.
     *
     * @param string $jwtToken  The JWT token containing integration parameters
     * @param string $operation The operation type ('set' or 'get')
     *
     * @return array|null Integration parameters or null on failure
     */
    public function getPlatformIntegrationParams(string $jwtToken, string $operation): ?array
    {
        $exportParams = $this->decodeJWT($jwtToken);
        if (!$exportParams) {
            return null;
        }

        // Extract provider information from payload (support both new and legacy formats)
        $providerId = $this->extractProviderId($exportParams);

        // Validate provider if specified (only for new format with provider_id)
        if ($providerId && !empty($this->providerIds) && !$this->isValidProvider($providerId)) {
            $this->logger->warning("Invalid provider ID in JWT: {$providerId}");

            return null;
        }

        // Replace localhost with actual client IP if needed
        $returnUrl = $exportParams['returnurl'] ?? '';
        if (!empty($returnUrl) && str_contains($returnUrl, 'localhost')) {
            $clientIP = $this->getClientIP();
            $returnUrl = str_replace('localhost', $clientIP, $returnUrl);
            $exportParams['returnurl'] = $returnUrl;
        }

        // Validate return URL against allowed providers (only if providers are configured)
        if (!empty($this->providerUrls) && !$this->isAllowedUrl($returnUrl)) {
            $this->logger->warning("Return URL not in allowed providers: {$returnUrl}");

            return null;
        }

        // Generate platform integration URL and export type based on package type
        $this->enrichWithPlatformData($exportParams, $operation, $returnUrl);

        return $exportParams;
    }

    /**
     * Legacy method name for backwards compatibility.
     *
     * @deprecated Use getPlatformIntegrationParams() instead
     */
    public function getParamsMoodleIntegration(string $jwtToken, string $setOp): ?array
    {
        return $this->getPlatformIntegrationParams($jwtToken, $setOp);
    }

    /**
     * Enrich export parameters with platform-specific integration data.
     */
    private function enrichWithPlatformData(array &$exportParams, string $operation, string $returnUrl): void
    {
        $op = ('set' === $operation) ? 's' : 'g';
        $pkgType = $exportParams['pkgtype'] ?? '';

        switch ($pkgType) {
            case 'scorm':
                $exportParams['platformIntegrationUrl'] = $this->buildIntegrationUrl(
                    $returnUrl,
                    ['/mod/exescorm', '/course/section'],
                    '/mod/exescorm/'.$op.'et_ode.php'
                );
                $exportParams['exportType'] = Constants::EXPORT_TYPE_SCORM12;
                break;

            case 'webzip':
                $exportParams['platformIntegrationUrl'] = $this->buildIntegrationUrl(
                    $returnUrl,
                    ['/mod/exeweb', '/course/section'],
                    '/mod/exeweb/'.$op.'et_ode.php'
                );
                $exportParams['exportType'] = Constants::EXPORT_TYPE_HTML5;
                break;

            default:
                // For unknown package types, don't add platform-specific URLs
                $this->logger->info("Unknown package type: {$pkgType}");
                break;
        }
    }

    /**
     * Build integration URL based on return URL patterns.
     */
    private function buildIntegrationUrl(string $returnUrl, array $patterns, string $endpoint): ?string
    {
        foreach ($patterns as $pattern) {
            if (str_contains($returnUrl, $pattern)) {
                $baseUrl = strstr($returnUrl, $pattern, true);

                return $baseUrl.$endpoint;
            }
        }

        return null;
    }

    /**
     * Check if a provider ID is valid.
     */
    private function isValidProvider(string $providerId): bool
    {
        return in_array($providerId, $this->providerIds, true);
    }

    /**
     * Check if a URL is allowed by any configured provider.
     */
    private function isAllowedUrl(string $url): bool
    {
        if (empty($url) || empty($this->providerUrls)) {
            return true; // Allow if no restrictions configured
        }

        foreach ($this->providerUrls as $allowedUrl) {
            if (str_starts_with($url, $allowedUrl)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get provider token by ID.
     */
    private function getProviderToken(?string $providerId): ?string
    {
        if (!$providerId) {
            return null;
        }

        $index = array_search($providerId, $this->providerIds, true);
        if (false === $index) {
            return null;
        }

        return $this->providerTokens[$index] ?? null;
    }

    /**
     * Get provider URL by ID.
     */
    public function getProviderUrl(string $providerId): ?string
    {
        $index = array_search($providerId, $this->providerIds, true);
        if (false === $index) {
            return null;
        }

        return $this->providerUrls[$index] ?? null;
    }

    /**
     * Get all configured provider IDs.
     */
    public function getProviderIds(): array
    {
        return $this->providerIds;
    }

    /**
     * Validate provider configuration consistency.
     */
    public function validateProviderConfiguration(): array
    {
        $errors = [];

        $urlCount = count($this->providerUrls);
        $tokenCount = count($this->providerTokens);
        $idCount = count($this->providerIds);

        if ($urlCount !== $tokenCount || $urlCount !== $idCount) {
            $errors[] = "Provider configuration mismatch: URLs({$urlCount}), Tokens({$tokenCount}), IDs({$idCount})";
        }

        // Check for duplicate IDs
        if (count($this->providerIds) !== count(array_unique($this->providerIds))) {
            $errors[] = 'Duplicate provider IDs found';
        }

        return $errors;
    }

    /**
     * Extract provider ID from JWT payload, supporting both legacy and new formats.
     *
     * @param array $payload JWT payload
     *
     * @return string|null Provider ID or null if not found
     */
    private function extractProviderId(array $payload): ?string
    {
        // New format: direct provider_id field
        if (isset($payload['provider_id'])) {
            return $payload['provider_id'];
        }

        // Legacy format: provider object with name
        if (isset($payload['provider']['name'])) {
            // Convert provider name to a normalized ID
            $providerName = strtolower($payload['provider']['name']);

            return $providerName.'_legacy';
        }

        // No provider information found
        return null;
    }

    /**
     * Get client IP address from server variables.
     *
     * @return string IP address of the client
     */
    private function getClientIP(): string
    {
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
            // Use X-Forwarded-For if available (for proxy setups)
            $ip = $_SERVER['HTTP_X_FORWARDED_FOR'];
        } elseif (!empty($_SERVER['REMOTE_ADDR'])) {
            // Otherwise, use REMOTE_ADDR
            $ip = $_SERVER['REMOTE_ADDR'];
        } else {
            $ip = 'UNKNOWN';
        }

        return $ip;
    }
}
