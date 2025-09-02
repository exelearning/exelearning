<?php

namespace App\Tests\Integration\Api;

use App\Entity\net\exelearning\Entity\User;
use Firebase\JWT\JWT;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class JwtAccessTest extends WebTestCase
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

    public function testGetUserWithJwt(): void
    {
        $client = static::createClient();
        $em = $client->getContainer()->get('doctrine')->getManager();

        $user = new User();
        $email = 'user_'.uniqid().'@example.com';
        $user->setEmail($email);
        $user->setUserId('usr_'.uniqid());
        $user->setRoles(['ROLE_USER']);
        $user->setPassword('pass');
        $user->setIsLopdAccepted(true);
        $em->persist($user);
        $em->flush();

        // Use the same email in sub and email to ensure owner checks pass
        $jwt = JWT::encode([
            'sub' => $email,
            'email' => $email,
            'iss' => $this->issuer,
            'aud' => $this->audience,
            'exp' => time() + 300,
        ], $this->secret, 'HS256');

        $client->request('GET', '/api/v2/users/'.$user->getId(), [], [], [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame($email, $data['email'] ?? null);
    }

    public function testNestedIdeviceRouteWithJwt(): void
    {
        $client = static::createClient();
        $jwt = JWT::encode([
            'sub' => 'test@example.com',
            'iss' => $this->issuer,
            'aud' => $this->audience,
            'exp' => time() + 300,
        ], $this->secret, 'HS256');

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

        // Create page/block/idevice
        $client->request('GET', "/api/v2/projects/{$projectId}/pages", server: [ 'HTTP_Authorization' => 'Bearer '.$jwt, 'HTTP_ACCEPT' => 'application/json' ]);
        $pages = json_decode($client->getResponse()->getContent(), true);
        $nodeId = $pages[0]['id'];
        $client->request('POST', "/api/v2/projects/{$projectId}/pages/{$nodeId}/blocks", server: [ 'HTTP_Authorization' => 'Bearer '.$jwt, 'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json' ], content: json_encode(['type' => 'text']));
        $block = json_decode($client->getResponse()->getContent(), true);
        $blockId = $block['blockId'];
        $client->request('POST', "/api/v2/projects/{$projectId}/pages/{$nodeId}/blocks/{$blockId}/idevices", server: [ 'HTTP_Authorization' => 'Bearer '.$jwt, 'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json' ], content: json_encode(['type' => 'text']));
        $idevice = json_decode($client->getResponse()->getContent(), true);
        $ideviceId = $idevice['ideviceId'];

        $path = sprintf('/api/v2/projects/%s/pages/%s/blocks/%s/idevices/%s', $projectId, $nodeId, $blockId, $ideviceId);
        $client->request('GET', $path, [], [], [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame($ideviceId, $data['ideviceId'] ?? null);
    }
}
