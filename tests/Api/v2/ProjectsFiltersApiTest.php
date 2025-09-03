<?php

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ProjectsFiltersApiTest extends WebTestCase
{
    private string $userAEmail;
    private string $userAPassword;
    private string $userAId;

    private string $userBEmail;
    private string $userBPassword;
    private string $userBId;

    private string $adminEmail;
    private string $adminPassword;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // User A
        $userA = new User();
        $this->userAEmail = 'filters_a_'.uniqid().'@example.com';
        $this->userAPassword = 'PwdA123!';
        $this->userAId = 'usrA_'.uniqid();
        $userA->setEmail($this->userAEmail);
        $userA->setUserId($this->userAId);
        $userA->setPassword($hasher->hashPassword($userA, $this->userAPassword));
        $userA->setIsLopdAccepted(true);
        $userA->setRoles(['ROLE_USER']);
        $em->persist($userA);

        // User B
        $userB = new User();
        $this->userBEmail = 'filters_b_'.uniqid().'@example.com';
        $this->userBPassword = 'PwdB123!';
        $this->userBId = 'usrB_'.uniqid();
        $userB->setEmail($this->userBEmail);
        $userB->setUserId($this->userBId);
        $userB->setPassword($hasher->hashPassword($userB, $this->userBPassword));
        $userB->setIsLopdAccepted(true);
        $userB->setRoles(['ROLE_USER']);
        $em->persist($userB);

        // Admin
        $admin = new User();
        $this->adminEmail = 'filters_admin_'.uniqid().'@example.com';
        $this->adminPassword = 'AdminPwd123!';
        $admin->setEmail($this->adminEmail);
        $admin->setUserId('usrAdm_'.uniqid());
        $admin->setPassword($hasher->hashPassword($admin, $this->adminPassword));
        $admin->setIsLopdAccepted(true);
        $admin->setRoles(['ROLE_ADMIN']);
        $em->persist($admin);

        $em->flush();

        static::ensureKernelShutdown();
    }

    private function login(
        \Symfony\Bundle\FrameworkBundle\KernelBrowser $client,
        string $email,
        string $password
    ): void {
        $client->request('POST', '/login_check', [
            'email' => $email,
            'password' => $password,
        ]);
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    public function test_non_admin_sees_only_own_projects_and_owner_fields(): void
    {
        $client = static::createClient();
        $this->login($client, $this->userAEmail, $this->userAPassword);

        // Create two projects as user A
        $client->request('POST', '/api/v2/projects', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], content: json_encode(['title' => 'Alpha Project'], JSON_THROW_ON_ERROR));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $proj1 = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        $client->request('POST', '/api/v2/projects', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], content: json_encode(['title' => 'Beta Project'], JSON_THROW_ON_ERROR));
        $this->assertSame(201, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());

        // List
        $client->request('GET', '/api/v2/projects', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode(), $client->getResponse()->getContent());
        $list = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertNotEmpty($list);
        foreach ($list as $row) {
            $this->assertSame($this->userAEmail, $row['owner_email'] ?? null);
            $this->assertSame($this->userAId, $row['owner_id'] ?? null);
        }

        // title exact filter
        $client->request('GET', '/api/v2/projects?title='.urlencode('Alpha Project'), server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $onlyAlpha = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertCount(1, $onlyAlpha);
        $this->assertSame('Alpha Project', $onlyAlpha[0]['title'] ?? null);

        // title_like filter
        $client->request('GET', '/api/v2/projects?title_like=beta', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $onlyBeta = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertCount(1, $onlyBeta);
        $this->assertSame('Beta Project', $onlyBeta[0]['title'] ?? null);

        // id filter
        $id = $proj1['id'] ?? '';
        $client->request('GET', '/api/v2/projects?id='.urlencode($id), server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $byId = json_decode($client->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertCount(1, $byId);
        $this->assertSame($id, $byId[0]['id'] ?? null);
    }

    public function test_updated_after_before_and_search_and_admin_owner_filters(): void
    {
        // Create projects as user B
        $clientB = static::createClient();
        $this->login($clientB, $this->userBEmail, $this->userBPassword);

        $clientB->request('POST', '/api/v2/projects', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], content: json_encode(['title' => 'Gamma Project'], JSON_THROW_ON_ERROR));
        $this->assertSame(201, $clientB->getResponse()->getStatusCode(), $clientB->getResponse()->getContent());
        $pB1 = json_decode($clientB->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        // Create another as user A to have two owners
        static::ensureKernelShutdown();
        $clientA = static::createClient();
        $this->login($clientA, $this->userAEmail, $this->userAPassword);
        $clientA->request('POST', '/api/v2/projects', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], content: json_encode(['title' => 'Delta File'], JSON_THROW_ON_ERROR));
        $this->assertSame(201, $clientA->getResponse()->getStatusCode(), $clientA->getResponse()->getContent());
        $pA1 = json_decode($clientA->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);

        // Admin lists all
        static::ensureKernelShutdown();
        $adminClient = static::createClient();
        $this->login($adminClient, $this->adminEmail, $this->adminPassword);
        $adminClient->request('GET', '/api/v2/projects', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $adminClient->getResponse()->getStatusCode(), $adminClient->getResponse()->getContent());
        $all = json_decode($adminClient->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertGreaterThanOrEqual(2, count($all));

        // Search filter (by fileName contains .elp or Delta/Gamma title)
        $adminClient->request('GET', '/api/v2/projects?search=delta', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $adminClient->getResponse()->getStatusCode());
        $searchDelta = json_decode($adminClient->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertNotEmpty($searchDelta);
        foreach ($searchDelta as $row) {
            $this->assertNotFalse(stripos($row['title'] ?? '', 'delta'));
        }

        // owner_email filter
        $adminClient->request('GET', '/api/v2/projects?owner_email='.urlencode($this->userBEmail), server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $adminClient->getResponse()->getStatusCode());
        $byOwnerEmail = json_decode($adminClient->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertNotEmpty($byOwnerEmail);
        foreach ($byOwnerEmail as $row) {
            $this->assertSame($this->userBEmail, $row['owner_email'] ?? null);
        }

        // owner_id filter
        $adminClient->request('GET', '/api/v2/projects?owner_id='.urlencode($this->userAId), server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $adminClient->getResponse()->getStatusCode());
        $byOwnerId = json_decode($adminClient->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertNotEmpty($byOwnerId);
        foreach ($byOwnerId as $row) {
            $this->assertSame($this->userAId, $row['owner_id'] ?? null);
        }

        // updated_after / updated_before using timestamps from admin list
        $adminClient->request('GET', '/api/v2/projects', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $all2 = json_decode($adminClient->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertNotEmpty($all2);
        $tsList = array_map(static fn($r) => (int)($r['updatedAt']['timestamp'] ?? 0), $all2);
        sort($tsList);
        $minTs = (int) $tsList[0];
        $maxTs = (int) $tsList[count($tsList)-1];

        // updated_after should exclude items at or before minTs when using minTs
        $adminClient->request('GET', '/api/v2/projects?updated_after='.$minTs, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $after = json_decode($adminClient->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        foreach ($after as $row) {
            $this->assertGreaterThan($minTs, (int)($row['updatedAt']['timestamp'] ?? 0));
        }

        // updated_before should exclude items at or after maxTs when using maxTs
        $adminClient->request('GET', '/api/v2/projects?updated_before='.$maxTs, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $before = json_decode($adminClient->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        foreach ($before as $row) {
            $this->assertLessThan($maxTs, (int)($row['updatedAt']['timestamp'] ?? 0));
        }
    }
}
