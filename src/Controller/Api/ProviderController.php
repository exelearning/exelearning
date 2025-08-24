<?php

namespace App\Controller\Api;

use App\Service\ProviderConfigurationService;
use App\Util\net\exelearning\Util\IntegrationUtil;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

/**
 * API controller for provider management and validation.
 *
 * Provides endpoints for validating and managing platform provider configurations.
 *
 * @author eXeLearning
 */
#[Route('/api/providers', name: 'api_providers_')]
class ProviderController extends AbstractController
{
    private ProviderConfigurationService $providerConfigService;
    private IntegrationUtil $integrationUtil;

    public function __construct(
        ProviderConfigurationService $providerConfigService,
        IntegrationUtil $integrationUtil,
    ) {
        $this->providerConfigService = $providerConfigService;
        $this->integrationUtil = $integrationUtil;
    }

    /**
     * Validate provider configuration.
     */
    #[Route('/validate', name: 'validate', methods: ['GET'])]
    public function validateConfiguration(): JsonResponse
    {
        $validation = $this->providerConfigService->validateConfiguration();
        $statistics = $this->providerConfigService->getProviderStatistics();
        $recommendations = $this->providerConfigService->getConfigurationRecommendations();

        return $this->json([
            'validation' => $validation,
            'statistics' => $statistics,
            'recommendations' => $recommendations,
        ]);
    }

    /**
     * Get provider statistics.
     */
    #[Route('/statistics', name: 'statistics', methods: ['GET'])]
    public function getStatistics(): JsonResponse
    {
        $statistics = $this->providerConfigService->getProviderStatistics();

        return $this->json($statistics);
    }

    /**
     * Generate JWT for a specific provider.
     */
    #[Route('/jwt/generate', name: 'generate_jwt', methods: ['POST'])]
    public function generateJWT(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (!isset($data['provider_id']) || !isset($data['payload'])) {
            return $this->json([
                'error' => 'Missing required fields: provider_id and payload',
            ], 400);
        }

        $providerId = $data['provider_id'];
        $payload = $data['payload'];

        // Validate provider exists
        if (!$this->providerConfigService->isProviderConfigured($providerId)) {
            return $this->json([
                'error' => "Provider not configured: {$providerId}",
            ], 404);
        }

        $jwt = $this->integrationUtil->generateProviderJWT($payload, $providerId);

        if (!$jwt) {
            return $this->json([
                'error' => 'Failed to generate JWT token',
            ], 500);
        }

        return $this->json([
            'jwt' => $jwt,
            'provider_id' => $providerId,
            'expires_in' => 3600, // 1 hour
        ]);
    }

    /**
     * Decode JWT and validate provider.
     */
    #[Route('/jwt/decode', name: 'decode_jwt', methods: ['POST'])]
    public function decodeJWT(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (!isset($data['jwt'])) {
            return $this->json([
                'error' => 'Missing required field: jwt',
            ], 400);
        }

        $jwt = $data['jwt'];
        $providerId = $data['provider_id'] ?? null;

        $decoded = $this->integrationUtil->decodeJWT($jwt, $providerId);

        if (!$decoded) {
            return $this->json([
                'error' => 'Invalid or expired JWT token',
            ], 400);
        }

        return $this->json([
            'payload' => $decoded,
            'valid' => true,
        ]);
    }

    /**
     * Process platform integration parameters.
     */
    #[Route('/integration/params', name: 'integration_params', methods: ['POST'])]
    public function getIntegrationParams(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        if (!isset($data['jwt']) || !isset($data['operation'])) {
            return $this->json([
                'error' => 'Missing required fields: jwt and operation',
            ], 400);
        }

        $jwt = $data['jwt'];
        $operation = $data['operation'];

        $params = $this->integrationUtil->getPlatformIntegrationParams($jwt, $operation);

        if (!$params) {
            return $this->json([
                'error' => 'Failed to process integration parameters',
            ], 400);
        }

        return $this->json([
            'params' => $params,
            'operation' => $operation,
        ]);
    }

    /**
     * List all configured providers.
     */
    #[Route('/list', name: 'list', methods: ['GET'])]
    public function listProviders(): JsonResponse
    {
        $providerIds = $this->integrationUtil->getProviderIds();
        $providers = [];

        foreach ($providerIds as $providerId) {
            $providers[] = [
                'id' => $providerId,
                'url' => $this->integrationUtil->getProviderUrl($providerId),
                'configured' => $this->providerConfigService->isProviderConfigured($providerId),
            ];
        }

        return $this->json([
            'providers' => $providers,
            'count' => count($providers),
        ]);
    }
}
