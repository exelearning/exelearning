<?php

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ProjectsApiTest extends WebTestCase
{
    private string $userEmail;
    private string $userPassword;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create regular user
        $user = new User();
        $this->userEmail = 'proj_user_'.uniqid().'@example.com';
        $this->userPassword = 'ProjPwd123!';
        $user->setEmail($this->userEmail);
        $user->setUserId('usr_'.uniqid());
        $user->setPassword($hasher->hashPassword($user, $this->userPassword));
        $user->setIsLopdAccepted(true);
        $user->setRoles(['ROLE_USER']);
        $em->persist($user);
        $em->flush();

        static::ensureKernelShutdown();
    }

    private function loginClient(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client): void
    {
        $client->request('POST', '/login_check', [
            'email' => $this->userEmail,
            'password' => $this->userPassword,
        ]);
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    private function assertStatus(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client, int $expected): void
    {
        $resp = $client->getResponse();
        $this->assertSame($expected, $resp->getStatusCode(), $resp->getContent());
    }

    public function testCreateListEditDeleteProject(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Create
        $title = 'My Project '.uniqid();
        $client->request('POST', '/api/v2/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => $title]));
        $this->assertStatus($client, 201); // Api Platform should default to 201 for POST
        $created = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('id', $created);
        $projectId = $created['id'];
        $this->assertSame($title, $created['title']);

        // List (grouped by odeId)
        $client->request('GET', '/api/v2/projects', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $list = json_decode($client->getResponse()->getContent(), true);
        $this->assertIsArray($list);
        $found = null;
        foreach ($list as $row) {
            if (($row['id'] ?? null) === $projectId) { $found = $row; break; }
        }
        $this->assertNotNull($found, 'Project should appear in list');

        // Edit (PATCH project title)
        $newTitle = 'Updated '.uniqid();
        $client->request('PATCH', '/api/v2/projects/'.$projectId, [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/merge-patch+json',
        ], json_encode(['title' => $newTitle]));
        $this->assertStatus($client, 200);
        $patched = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame($newTitle, $patched['title']);

        // Delete
        $client->request('DELETE', '/api/v2/projects/'.$projectId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 204);

        // List again to ensure it is gone
        $client->request('GET', '/api/v2/projects', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $list2 = json_decode($client->getResponse()->getContent(), true);
        foreach ($list2 as $row) {
            $this->assertNotSame($projectId, $row['id'] ?? null);
        }
    }

    public function testTitleSyncViaPropertiesPatch(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Create project
        $client->request('POST', '/api/v2/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['title' => 'Before Sync']));
        $this->assertStatus($client, 201);
        $created = json_decode($client->getResponse()->getContent(), true);
        $projectId = $created['id'];

        // PATCH properties with new title only
        $newTitle = 'Synced Title '.uniqid();
        $client->request('PATCH', '/api/v2/projects/'.$projectId, [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/merge-patch+json',
        ], json_encode(['properties' => ['pp_title' => $newTitle]]));
        $this->assertStatus($client, 200);

        // GET projects and check title updated
        $client->request('GET', '/api/v2/projects', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $list = json_decode($client->getResponse()->getContent(), true);
        $found = null;
        foreach ($list as $row) {
            if (($row['id'] ?? null) === $projectId) { $found = $row; break; }
        }
        $this->assertNotNull($found, 'Project should appear in list');
        $this->assertSame($newTitle, $found['title'] ?? null);
    }
}
