<?php

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class ProjectItemAccessTest extends WebTestCase
{
    private string $ownerEmail;
    private string $ownerPassword;
    private string $ownerUserId;

    private string $otherEmail;
    private string $otherPassword;

    private string $adminEmail;
    private string $adminPassword;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Owner user
        $u1 = new User();
        $this->ownerEmail = 'owner_'.uniqid().'@example.com';
        $this->ownerPassword = 'OwnerPwd123!';
        $this->ownerUserId = 'uOwn_'.uniqid();
        $u1->setEmail($this->ownerEmail);
        $u1->setUserId($this->ownerUserId);
        $u1->setPassword($hasher->hashPassword($u1, $this->ownerPassword));
        $u1->setIsLopdAccepted(true);
        $u1->setRoles(['ROLE_USER']);
        $em->persist($u1);

        // Other non-admin
        $u2 = new User();
        $this->otherEmail = 'other_'.uniqid().'@example.com';
        $this->otherPassword = 'OtherPwd123!';
        $u2->setEmail($this->otherEmail);
        $u2->setUserId('uOth_'.uniqid());
        $u2->setPassword($hasher->hashPassword($u2, $this->otherPassword));
        $u2->setIsLopdAccepted(true);
        $u2->setRoles(['ROLE_USER']);
        $em->persist($u2);

        // Admin
        $adm = new User();
        $this->adminEmail = 'admin_'.uniqid().'@example.com';
        $this->adminPassword = 'AdminPwd123!';
        $adm->setEmail($this->adminEmail);
        $adm->setUserId('uAdm_'.uniqid());
        $adm->setPassword($hasher->hashPassword($adm, $this->adminPassword));
        $adm->setIsLopdAccepted(true);
        $adm->setRoles(['ROLE_ADMIN']);
        $em->persist($adm);

        $em->flush();
        static::ensureKernelShutdown();
    }

    private function login(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client, string $email, string $password): void
    {
        $client->request('POST', '/login_check', [ 'email' => $email, 'password' => $password ]);
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    public function test_get_project_includes_owner_fields_and_is_access_restricted(): void
    {
        // Owner creates project
        $clientOwner = static::createClient();
        $this->login($clientOwner, $this->ownerEmail, $this->ownerPassword);
        $clientOwner->request('POST', '/api/v2/projects', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
        ], content: json_encode(['title' => 'Access Test'], JSON_THROW_ON_ERROR));
        $this->assertSame(201, $clientOwner->getResponse()->getStatusCode(), $clientOwner->getResponse()->getContent());
        $created = json_decode($clientOwner->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $projectId = $created['id'] ?? '';
        $this->assertNotEmpty($projectId);

        // Owner can GET and sees owner_id and owner_email
        $clientOwner->request('GET', '/api/v2/projects/'.$projectId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $clientOwner->getResponse()->getStatusCode(), $clientOwner->getResponse()->getContent());
        $data = json_decode($clientOwner->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame($this->ownerEmail, $data['owner_email'] ?? null);
        $this->assertSame($this->ownerUserId, $data['owner_id'] ?? null);

        // Other non-admin cannot GET
        static::ensureKernelShutdown();
        $clientOther = static::createClient();
        $this->login($clientOther, $this->otherEmail, $this->otherPassword);
        $clientOther->request('GET', '/api/v2/projects/'.$projectId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(403, $clientOther->getResponse()->getStatusCode(), $clientOther->getResponse()->getContent());

        // Admin can GET
        static::ensureKernelShutdown();
        $clientAdmin = static::createClient();
        $this->login($clientAdmin, $this->adminEmail, $this->adminPassword);
        $clientAdmin->request('GET', '/api/v2/projects/'.$projectId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertSame(200, $clientAdmin->getResponse()->getStatusCode(), $clientAdmin->getResponse()->getContent());
        $dataAdm = json_decode($clientAdmin->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame($this->ownerEmail, $dataAdm['owner_email'] ?? null);
        $this->assertSame($this->ownerUserId, $dataAdm['owner_id'] ?? null);
    }
}

