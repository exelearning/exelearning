<?php

namespace App\Tests\Integration\Api;

use Firebase\JWT\JWT;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class TreeNavigationTest extends WebTestCase
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

    public function testCreateNodesBlocksAndIdevices(): void
    {
        $client = static::createClient();
        $jwt = JWT::encode([
            'sub' => 'user@example.com',
            'iss' => $this->issuer,
            'aud' => $this->audience,
            'exp' => time() + 300,
        ], $this->secret, 'HS256');

        $headers = [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ];

        // Create project with session
        $dst = __DIR__ . '/../../Fixtures/basic-example.elp';
        $this->assertFileExists($dst);
        $container = $client->getContainer();
        $filesDir  = (string) $container->getParameter('filesdir');
        $target = rtrim($filesDir, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'apitests'.DIRECTORY_SEPARATOR.'basic-example.elp';
        @mkdir(dirname($target), 0777, true);
        copy($dst, $target);
        $client->request('POST', '/api/v2/projects', server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT'  => 'application/json',
        ], content: json_encode(['path' => $target]));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $project = json_decode($client->getResponse()->getContent(), true);
        $projectId = $project['id'];

        // Create root page
        $client->request('POST', "/api/v2/projects/$projectId/pages", [], [], $headers, json_encode(['title' => 'Root']));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $root = json_decode($client->getResponse()->getContent(), true);

        // Create child under root
        $client->request('POST', "/api/v2/projects/$projectId/pages", [], [], $headers, json_encode(['title' => 'Child 1', 'parentId' => $root['id']]));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $child = json_decode($client->getResponse()->getContent(), true);

        // List children
        $client->request('GET', "/api/v2/projects/$projectId/pages/{$root['id']}/children", [], [], ['HTTP_Authorization' => 'Bearer '.$jwt, 'HTTP_ACCEPT' => 'application/json']);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $children = json_decode($client->getResponse()->getContent(), true);
        $this->assertCount(1, $children);
        $this->assertSame($child['id'], $children[0]['id']);

        // Create a block in child
        $client->request('POST', "/api/v2/projects/$projectId/pages/{$child['id']}/blocks", [], [], $headers, json_encode(['type' => 'text', 'data' => ['html' => '<p>Hello</p>']]));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $block = json_decode($client->getResponse()->getContent(), true);

        // Add iDevice to block
        $client->request('POST', "/api/v2/projects/$projectId/pages/{$child['id']}/blocks/{$block['blockId']}/idevices", [], [], $headers, json_encode(['ideviceId' => 'i-1', 'type' => 'text', 'props' => ['field' => 'value']])) ;
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        // List iDevices
        $client->request('GET', "/api/v2/projects/$projectId/pages/{$child['id']}/blocks/{$block['blockId']}/idevices", [], [], ['HTTP_Authorization' => 'Bearer '.$jwt, 'HTTP_ACCEPT' => 'application/json']);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $list = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('idevices', $list);
        $this->assertGreaterThanOrEqual(1, count($list['idevices']));
    }
}
