<?php

namespace App\Tests\Integration\Api;

use Firebase\JWT\JWT;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class DocumentStructureTest extends WebTestCase
{
    private string $secret;
    private string $issuer;
    private string $audience;

    protected function setUp(): void
    {
        self::ensureKernelShutdown();
        $this->secret = (string) ($_ENV['API_JWT_SECRET'] ?? 'test_secret');
        $this->issuer = (string) ($_ENV['API_JWT_ISSUER'] ?? 'exelearning');
        $this->audience = (string) ($_ENV['API_JWT_AUDIENCE'] ?? 'clients');
    }

    private static function fx(string $name): string
    {
        $p = __DIR__ . '/../../Fixtures/' . $name;
        self::assertFileExists($p, 'Fixture not found: '.$name);
        $real = realpath($p);
        self::assertNotFalse($real);
        return $real;
    }

    private static function putFixtureUnderFilesDir(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client, string $fixtureName): string
    {
        $container = $client->getContainer();
        $filesDir  = (string) $container->getParameter('filesdir');
        $targetDir = rtrim($filesDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'apitests' . DIRECTORY_SEPARATOR;
        if (!is_dir($targetDir)) {
            @mkdir($targetDir, 0777, true);
        }
        $src = self::fx($fixtureName);
        $dst = $targetDir . $fixtureName;
        copy($src, $dst);
        return $dst;
    }

    public function testCreateAndGetPage(): void
    {
        $client = static::createClient();
        $jwt = JWT::encode([
            'sub' => 'user@example.com',
            'iss' => $this->issuer,
            'aud' => $this->audience,
            'exp' => time() + 300,
        ], $this->secret, 'HS256');

        // Create a project from a small fixture to ensure session exists
        $dst = self::putFixtureUnderFilesDir($client, 'basic-example.elp');
        $client->request('POST', '/api/v2/projects', server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT'  => 'application/json',
        ], content: json_encode(['path' => $dst]));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $createdProject = json_decode($client->getResponse()->getContent(), true);
        $projectId = $createdProject['id'];
        // Create a single page and fetch it
        $client->request('POST', "/api/v2/projects/$projectId/pages", [], [], [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], json_encode(['title' => 'Chapter 1']));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $created = json_decode($client->getResponse()->getContent(), true);

        $client->request('GET', "/api/v2/projects/$projectId/pages/{$created['id']}", [], [], [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('Chapter 1', $data['title'] ?? null);
    }
}
