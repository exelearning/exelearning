<?php
/**
 * MercureFunctionalTest checks Mercure endpoints.
 *
 * @package App\Tests\Functional\Mercure
 */

namespace App\Tests\Functional\Mercure;

use App\Kernel;
use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpClient\HttpClient;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Firebase\JWT\JWT;

/**
 * Tests for Mercure endpoints and session handling.
 */
class MercureFunctionalTest extends WebTestCase
{
    private $client;
    private $entityManager;
    private $passwordHasher;
    private $testUser;
    private $mercureSecret;
    private $app_port;

    /**
     * Sets up the test environment.
     */
    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->entityManager = $this->client->getContainer()
            ->get('doctrine')
            ->getManager();
        $this->passwordHasher = $this->client->getContainer()
            ->get(UserPasswordHasherInterface::class);

        $this->mercureSecret = $_ENV['MERCURE_JWT_SECRET_KEY'];

        $this->app_port = $_ENV['APP_PORT'] ?? '8080';

    }

    /**
     * Returns the custom Kernel class.
     *
     * @return string
     */
    protected static function getKernelClass(): string
    {
        return Kernel::class;
    }



    /**
     * Checks the healthz endpoint returning status 200.
     */
    public function testMercureHealthCheck(): void
    {
        $jwt = JWT::encode(['mercure' => []], $this->mercureSecret, 'HS256');
        $healthCheckUrl = 'http://localhost:' . $this->app_port . '/healthz';

        $httpClient = HttpClient::create();
        $response = $httpClient->request('GET', $healthCheckUrl, [
            'headers' => [
                'Authorization' => 'Bearer ' . $jwt,
            ],
        ]);

        $this->assertEquals(200, $response->getStatusCode(), 'Health check endpoint failed.');
    }

    /**
     * Sends a request to /.well-known/mercure to verify that it responds.
     * We use topic=test para generar un flujo SSE si está configurado.
     */
    public function testMercureWellKnownEndpoint(): void
    {
        $jwt = JWT::encode(['mercure' => ['subscribe' => ['*']]], $this->mercureSecret, 'HS256');
        $mercureUrl = 'http://localhost:' . $this->app_port . '/.well-known/mercure?topic=test';

        $httpClient = HttpClient::create();
        $response = $httpClient->request('GET', $mercureUrl, [
            'headers' => [
                'Authorization' => 'Bearer ' . $jwt,
                // Normalmente se usa Accept: text/event-stream para SSE
                'Accept' => 'text/event-stream',
            ],
        ]);

        $this->assertEquals(200, $response->getStatusCode(), 'Mercure hub did not return a 200 status.');

        // Comprobamos si Content-Type indica un stream de eventos:
        $headers = $response->getHeaders();
        $contentType = $headers['content-type'][0] ?? '';

        // Depende de tu configuración, puede que sea exactamente 'text/event-stream' o contenga más info
        $this->assertStringContainsString('text/event-stream', $contentType, 'Header should indicate SSE');
    }

}
