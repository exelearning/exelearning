<?php

namespace App\Tests\Integration\Api;

use Firebase\JWT\JWT;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class TreeValidationTest extends WebTestCase
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

    public function testCannotMoveNodeUnderItsDescendant(): void
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
        $this->assertSame(201, $client->getResponse()->getStatusCode());
        $project = json_decode($client->getResponse()->getContent(), true);
        $projectId = $project['id'];

        $client->request('POST', "/api/v2/projects/$projectId/pages", [], [], $auth, json_encode(['title' => 'A']));
 

        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $a = json_decode($client->getResponse()->getContent(), true);
        $client->request('POST', "/api/v2/projects/$projectId/pages", [], [], $auth, json_encode(['title' => 'B', 'parentId' => $a['id']]));
        $b = json_decode($client->getResponse()->getContent(), true);

        // Try to move A under B (cycle)
        $client->request('PATCH', "/api/v2/projects/$projectId/pages/{$a['id']}/move", [], [], $auth, json_encode(['parentId' => $b['id']]));
        $this->assertSame(409, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
    }

    public function testReorderChildrenRequiresSameSet(): void
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
        $container = $client->getContainer();
        $filesDir  = (string) $container->getParameter('filesdir');
        $target = rtrim($filesDir, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'apitests'.DIRECTORY_SEPARATOR.'basic-example.elp';
        @mkdir(dirname($target), 0777, true);
        copy(__DIR__ . '/../../Fixtures/basic-example.elp', $target);
        $client->request('POST', '/api/v2/projects', server: [ 'HTTP_Authorization' => 'Bearer '.$jwt, 'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json' ], content: json_encode(['path' => $target]));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $project = json_decode($client->getResponse()->getContent(), true);
        $projectId = $project['id'];

        $client->request('POST', "/api/v2/projects/$projectId/pages", [], [], $auth, json_encode(['title' => 'P']));
        $p = json_decode($client->getResponse()->getContent(), true);
        $client->request('POST', "/api/v2/projects/$projectId/pages", [], [], $auth, json_encode(['title' => 'C1', 'parentId' => $p['id']]));
        $c1 = json_decode($client->getResponse()->getContent(), true);
        $client->request('POST', "/api/v2/projects/$projectId/pages", [], [], $auth, json_encode(['title' => 'C2', 'parentId' => $p['id']]));
        $c2 = json_decode($client->getResponse()->getContent(), true);

        // Provide different set in order
        $client->request('PATCH', "/api/v2/projects/$projectId/pages/{$p['id']}/children", [], [], $auth, json_encode(['order' => [$c1['id'], 'fake']])) ;

        $this->assertSame(400, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
    }

    public function testMoveBlockToNonExistingNodeFails(): void
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
        $container = $client->getContainer();
        $filesDir  = (string) $container->getParameter('filesdir');
        $target = rtrim($filesDir, DIRECTORY_SEPARATOR).DIRECTORY_SEPARATOR.'apitests'.DIRECTORY_SEPARATOR.'basic-example.elp';
        copy(__DIR__ . '/../../Fixtures/basic-example.elp', $target);
        $client->request('POST', '/api/v2/projects', server: [ 'HTTP_Authorization' => 'Bearer '.$jwt, 'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json' ], content: json_encode(['path' => $target]));
        $project = json_decode($client->getResponse()->getContent(), true);
        $projectId = $project['id'];

        $client->request('POST', "/api/v2/projects/$projectId/pages", [], [], $auth, json_encode(['title' => 'N']));
        $n = json_decode($client->getResponse()->getContent(), true);
        $client->request('POST', "/api/v2/projects/$projectId/pages/{$n['id']}/blocks", [], [], $auth, json_encode(['type' => 'text']));
        $block = json_decode($client->getResponse()->getContent(), true);

        $client->request('PATCH', "/api/v2/projects/$projectId/pages/{$n['id']}/blocks/{$block['blockId']}/move", [], [], $auth, json_encode(['newPageId' => 'missing']));

        $this->assertSame(400, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
    }
}
