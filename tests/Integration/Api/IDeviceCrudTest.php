<?php

namespace App\Tests\Integration\Api;

use Firebase\JWT\JWT;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class IDeviceCrudTest extends WebTestCase
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

    public function testPutThenGetIdevice(): void
    {
        $client = static::createClient();
        $jwt = JWT::encode([
            'sub' => 'user@example.com',
            'iss' => $this->issuer,
            'aud' => $this->audience,
            'exp' => time() + 300,
        ], $this->secret, 'HS256');

        // Create a project with session
        $dst = self::putFixtureUnderFilesDir($client, 'basic-example.elp');
        $client->request('POST', '/api/v2/projects', server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT'  => 'application/json',
        ], content: json_encode(['path' => $dst]));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $project = json_decode($client->getResponse()->getContent(), true);
        $projectId = $project['id'];

        // Use first page
        $client->request('GET', "/api/v2/projects/{$projectId}/pages", server: [ 'HTTP_Authorization' => 'Bearer '.$jwt, 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $pages = json_decode($client->getResponse()->getContent(), true);
        $nodeId = $pages[0]['id'];

        // Create a block and an idevice
        $client->request('POST', "/api/v2/projects/{$projectId}/pages/{$nodeId}/blocks", server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], content: json_encode(['type' => 'text']));
        $this->assertSame(201, $client->getResponse()->getStatusCode());
        $block = json_decode($client->getResponse()->getContent(), true);
        $blockId = $block['blockId'];

        $client->request('POST', "/api/v2/projects/{$projectId}/pages/{$nodeId}/blocks/{$blockId}/idevices", server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], content: json_encode(['type' => 'text', 'html' => '<p>Hi</p>', 'props' => ['k' => 'v'] ]));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $idevice = json_decode($client->getResponse()->getContent(), true);
        $ideviceId = $idevice['ideviceId'];

        // Update via PATCH and then GET
        $path = sprintf('/api/v2/projects/%s/pages/%s/blocks/%s/idevices/%s', $projectId, $nodeId, $blockId, $ideviceId);
        $client->request('PATCH', $path, server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], content: json_encode(['html' => '<p>Hello World</p>', 'props' => ['type' => 'richText'] ]));
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('<p>Hello World</p>', $data['html'] ?? null);
        $this->assertSame(['type' => 'richText'], $data['props'] ?? null);

        $client->request('GET', $path, server: [ 'HTTP_Authorization' => 'Bearer '.$jwt, 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $gdata = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('<p>Hello World</p>', $gdata['html'] ?? null);
        $this->assertSame(['type' => 'richText'], $gdata['props'] ?? null);
    }
}
