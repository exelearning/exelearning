<?php

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class CurrentOdeUserGetUserTest extends WebTestCase
{
    private string $userEmail;
    private string $userPassword;
    private string $adminEmail;
    private string $adminPassword;
    private string $testComponentId;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        //Normal User
        $user = new User();
        $this->userEmail = 'user_' . uniqid() . '@example.com';
        $this->userPassword = 'UserPwd123!';
        $user->setEmail($this->userEmail);
        $user->setUserId('u' . uniqid());
        $user->setPassword($hasher->hashPassword($user, $this->userPassword));
        $user->setIsLopdAccepted(true);
        $user->setRoles(['ROLE_USER']);
        $em->persist($user);

        // Admin user
        $admin = new User();
        $this->adminEmail = 'admin_' . uniqid() . '@example.com';
        $this->adminPassword = 'AdminPwd123!';
        $admin->setEmail($this->adminEmail);
        $admin->setUserId('adm' . uniqid());
        $admin->setPassword($hasher->hashPassword($admin, $this->adminPassword));
        $admin->setIsLopdAccepted(true);
        $admin->setRoles(['ROLE_ADMIN']);
        $em->persist($admin);

        // Create test data for CurrentOdeUsers
        $this->testComponentId = 'comp_' . uniqid();
        $odeUser = new CurrentOdeUsers();
        $odeUser->setUser('test_user');
        $odeUser->setOdeId('ode_123');
        $odeUser->setOdeVersionId('v1');
        $odeUser->setOdeSessionId('session_123');
        $odeUser->setLastAction(new \DateTime());
        $odeUser->setLastSync(new \DateTime());
        $odeUser->setSyncSaveFlag(false);
        $odeUser->setSyncNavStructureFlag(false);
        $odeUser->setSyncPagStructureFlag(false);
        $odeUser->setSyncComponentsFlag(false);
        $odeUser->setSyncUpdateFlag(false);
        $odeUser->setNodeIp('127.0.0.1');
        $odeUser->setCurrentComponentId($this->testComponentId);
        $em->persist($odeUser);

        $em->flush();
        static::ensureKernelShutdown();
    }

    private function login(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client, string $email, string $password): void
    {
        $client->request('POST', '/login_check', ['email' => $email, 'password' => $password]);
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    public function testGetUserByComponentId(): void
    {
        // Normal user can access
        $clientUser = static::createClient();
        $this->login($clientUser, $this->userEmail, $this->userPassword);

        $clientUser->request(
            'GET',
            '/api/v2/current_ode_users/by_component/' . $this->testComponentId,
            server: ['HTTP_ACCEPT' => 'application/json']
        );

        $this->assertSame(200, $clientUser->getResponse()->getStatusCode(), $clientUser->getResponse()->getContent());
        $data = json_decode($clientUser->getResponse()->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('test_user', $data['user'] ?? null);
    }

    public function testUserNotFound(): void
    {
        $clientUser = static::createClient();
        $this->login($clientUser, $this->userEmail, $this->userPassword);

        $clientUser->request(
            'GET',
            '/api/v2/current_ode_users/by_component/non-existent-id',
            server: ['HTTP_ACCEPT' => 'application/json']
        );

        $this->assertSame(404, $clientUser->getResponse()->getStatusCode());
    }

    public function testAdminCanAccess(): void
    {
        // Admin can also access
        $clientAdmin = static::createClient();
        $this->login($clientAdmin, $this->adminEmail, $this->adminPassword);

        $clientAdmin->request(
            'GET',
            '/api/v2/current_ode_users/by_component/' . $this->testComponentId,
            server: ['HTTP_ACCEPT' => 'application/json']
        );

        $this->assertSame(200, $clientAdmin->getResponse()->getStatusCode());
    }

    public function testAccessDeniedWithoutAuth(): void
    {
        // Without authentication it should fail
        $client = static::createClient();

        $client->request(
            'GET',
            '/api/v2/current_ode_users/by_component/' . $this->testComponentId,
            server: ['HTTP_ACCEPT' => 'application/json']
        );

        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }
}
