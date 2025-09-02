<?php

namespace App\Tests\Integration\Api;

use Firebase\JWT\JWT;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class TreeMoveReorderTest extends WebTestCase
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

    public function testReorderChildrenAndMoveBlock(): void
    {
        $client = static::createClient();
        $jwt = JWT::encode([
            'sub' => 'user@example.com',
            'iss' => $this->issuer,
            'aud' => $this->audience,
            'exp' => time() + 300,
        ], $this->secret, 'HS256');
        $auth = ['HTTP_Authorization' => 'Bearer '.$jwt, 'HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json'];

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
            'HTTP_ACCEPT' => 'application/json',
        ], content: json_encode(['path' => $target]));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $project = json_decode($client->getResponse()->getContent(), true);
        $projectId = $project['id'];

        // Create parent and two children (pages)
        $client->request('POST', "/api/v2/projects/$projectId/pages", [], [], $auth, json_encode(['title' => 'Parent']));        
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $parent = json_decode($client->getResponse()->getContent(), true);

        $client->request('POST', "/api/v2/projects/$projectId/pages", [], [], $auth, json_encode(['title' => 'ChildA', 'parentId' => $parent['id']]));
        $childA = json_decode($client->getResponse()->getContent(), true);
        $client->request('POST', "/api/v2/projects/$projectId/pages", [], [], $auth, json_encode(['title' => 'ChildB', 'parentId' => $parent['id']]));
        $childB = json_decode($client->getResponse()->getContent(), true);

        // Reorder children [B, A]
        $client->request('PATCH', "/api/v2/projects/$projectId/pages/{$parent['id']}/children", [], [], $auth, json_encode(['order' => [$childB['id'], $childA['id']]]));
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        $client->request('GET', "/api/v2/projects/$projectId/pages/{$parent['id']}/children", [], [], ['HTTP_Authorization' => 'Bearer '.$jwt, 'HTTP_ACCEPT' => 'application/json']);
        $children = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame($childB['id'], $children[0]['id']);
        $this->assertSame($childA['id'], $children[1]['id']);

        // Create a block on childA and move to childB at position 0
        $client->request('POST', "/api/v2/projects/$projectId/pages/{$childA['id']}/blocks", [], [], $auth, json_encode(['type' => 'text']));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $block = json_decode($client->getResponse()->getContent(), true);

        $client->request('PATCH', "/api/v2/projects/$projectId/pages/{$childA['id']}/blocks/{$block['blockId']}/move", [], [], $auth, json_encode(['newPageId' => $childB['id'], 'position' => 0]));
        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $client->request('GET', "/api/v2/projects/$projectId/pages/{$childB['id']}/blocks", [], [], ['HTTP_Authorization' => 'Bearer '.$jwt, 'HTTP_ACCEPT' => 'application/json']);
        $blocks = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('blocks', $blocks);
        $this->assertSame($block['blockId'], $blocks['blocks'][0]['blockId']);
    }
}
