<?php

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ProjectItemApiTest extends WebTestCase
{
    private string $email;
    private string $password;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        $u = new User();
        $this->email = 'proj_item_'.uniqid().'@example.com';
        $this->password = 'PropsPwd123!';
        $u->setEmail($this->email);
        $u->setUserId('usr_'.uniqid());
        $u->setPassword($hasher->hashPassword($u, $this->password));
        $u->setIsLopdAccepted(true);
        $u->setRoles(['ROLE_USER']);
        $em->persist($u);
        $em->flush();
        static::ensureKernelShutdown();
    }

    private function login(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client): void
    {
        $client->request('POST', '/login_check', [ 'email' => $this->email, 'password' => $this->password ]);
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    public function testGetProjectIncludesProperties(): void
    {
        $client = static::createClient();
        $this->login($client);

        // Create project
        $client->request('POST', '/api/v2/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => 'P1']));
        $this->assertSame(201, $client->getResponse()->getStatusCode());
        $created = json_decode($client->getResponse()->getContent(), true);
        $projectId = $created['id'];

        // Patch some properties (including nested JSON)
        $client->request('PATCH', '/api/v2/projects/'.$projectId, [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/merge-patch+json',
        ], json_encode([
            'properties' => [
                'pp_title' => 'New Title',
                'pp_lang' => 'es',
                'custom_json' => [ 'a' => 1, 'b' => true ],
            ],
        ]));
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        // GET project item
        $client->request('GET', '/api/v2/projects/'.$projectId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('properties', $data);
        $this->assertSame('New Title', $data['properties']['pp_title']);
        $this->assertSame('es', $data['properties']['pp_lang']);
        $this->assertSame(['a' => 1, 'b' => true], $data['properties']['custom_json']);
    }

    public function testPatchTitleAndProperties(): void
    {
        $client = static::createClient();
        $this->login($client);

        // Create project
        $client->request('POST', '/api/v2/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => 'Before']));
        $this->assertSame(201, $client->getResponse()->getStatusCode());
        $created = json_decode($client->getResponse()->getContent(), true);
        $projectId = $created['id'];

        // PATCH: change title and some properties
        $client->request('PATCH', '/api/v2/projects/'.$projectId, [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/merge-patch+json',
        ], json_encode([
            'title' => 'After',
            'properties' => [ 'pp_license' => 'CC-BY-4.0' ],
        ]));
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('After', $data['title']);
        $this->assertSame('CC-BY-4.0', $data['properties']['pp_license']);

        // Idempotence: patch again with same body
        $client->request('PATCH', '/api/v2/projects/'.$projectId, [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/merge-patch+json',
        ], json_encode([
            'title' => 'After',
            'properties' => [ 'pp_license' => 'CC-BY-4.0' ],
        ]));
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $data2 = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('After', $data2['title']);
        $this->assertSame('CC-BY-4.0', $data2['properties']['pp_license']);
    }

    public function testPatchPersistsToProjectPropertiesStore(): void
    {
        $client = static::createClient();
        $this->login($client);

        // Create project
        $client->request('POST', '/api/v2/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => 'Persist Test']));
        $this->assertSame(201, $client->getResponse()->getStatusCode());
        $created = json_decode($client->getResponse()->getContent(), true);
        $projectId = $created['id'];

        // PATCH properties with mixed types
        $payload = [
            'properties' => [
                'pp_license' => 'CC0-1.0',
                'flag' => true,
                'nested' => [ 'a' => 1, 'b' => ['x' => 2] ],
            ],
        ];
        $client->request('PATCH', '/api/v2/projects/'.$projectId, [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/merge-patch+json',
        ], json_encode($payload));
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        // Verify persisted values in repository
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $repo = $em->getRepository(\App\Entity\Project\ProjectProperty::class);
        $rows = $repo->findBy(['odeId' => $projectId]);
        $map = [];
        foreach ($rows as $r) { $map[$r->getKey()] = $r->getValue(); }
        $this->assertSame('CC0-1.0', $map['pp_license'] ?? null);
        $this->assertSame('true', $map['flag'] ?? null, 'Booleans stored as string scalars');
        $this->assertSame(json_encode(['a'=>1,'b'=>['x'=>2]], JSON_UNESCAPED_UNICODE), $map['nested'] ?? null);
    }

    public function testGetDefaultsWhenNoProperties(): void
    {
        $client = static::createClient();
        $this->login($client);

        // Create project
        $title = 'Defaults Title';
        $client->request('POST', '/api/v2/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => $title]));
        $this->assertSame(201, $client->getResponse()->getStatusCode());
        $created = json_decode($client->getResponse()->getContent(), true);
        $projectId = $created['id'];

        // GET item (no properties patched yet)
        $client->request('GET', '/api/v2/projects/'.$projectId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('properties', $data);
        $this->assertSame($title, $data['properties']['pp_title'] ?? null);
        $this->assertNotEmpty($data['properties']['pp_lang'] ?? null);
    }

    public function testGetFromLegacySessionWhenNoV2Properties(): void
    {
        $client = static::createClient();
        $this->login($client);

        // Create project to get a valid odeId
        $client->request('POST', '/api/v2/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => 'Legacy Source']));
        $this->assertSame(201, $client->getResponse()->getStatusCode());
        $created = json_decode($client->getResponse()->getContent(), true);
        $projectId = $created['id'];

        // Seed a CurrentOdeUsers session and legacy properties for this user
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        $sessionId = substr(md5(uniqid()), 0, 20);
        $versionId = substr(md5(uniqid('v')), 0, 20);

        $cu = new \App\Entity\net\exelearning\Entity\CurrentOdeUsers();
        $cu->setOdeId($projectId);
        $cu->setOdeVersionId($versionId);
        $cu->setOdeSessionId($sessionId);
        $cu->setUser($this->email);
        $cu->setLastAction(new \DateTime());
        $cu->setLastSync(new \DateTime());
        $cu->setSyncSaveFlag(false);
        $cu->setSyncNavStructureFlag(false);
        $cu->setSyncPagStructureFlag(false);
        $cu->setSyncComponentsFlag(false);
        $cu->setSyncUpdateFlag(false);
        $cu->setNodeIp('127.0.0.1');
        $em->persist($cu);

        $legacy1 = new \App\Entity\net\exelearning\Entity\OdePropertiesSync();
        $legacy1->setOdeSessionId($sessionId);
        $legacy1->setKey('pp_author');
        $legacy1->setValue('Author From Legacy');
        $em->persist($legacy1);

        $legacy2 = new \App\Entity\net\exelearning\Entity\OdePropertiesSync();
        $legacy2->setOdeSessionId($sessionId);
        $legacy2->setKey('pp_addExeLink');
        $legacy2->setValue('true');
        $em->persist($legacy2);

        $em->flush();

        // GET item should reflect legacy properties
        $client->request('GET', '/api/v2/projects/'.$projectId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('Author From Legacy', $data['properties']['pp_author'] ?? null);
        $this->assertSame(true, $data['properties']['pp_addExeLink'] ?? null);
    }
}
