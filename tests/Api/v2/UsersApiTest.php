<?php

namespace App\Tests\Api\v2;

use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class UsersApiTest extends WebTestCase
{
    private int $adminId;
    private string $adminEmail;
    private string $adminPassword;

    private int $userId;
    private string $userUserId;
    private string $userEmail;
    private string $userPassword;
    private int $otherUserId;
    private string $otherUserUserId;
    private string $otherUserEmail;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create admin
        $admin = new User();
        $this->adminEmail = 'admin_'.uniqid().'@example.com';
        $this->adminPassword = 'AdminPwd123!';
        $admin->setEmail($this->adminEmail);
        $admin->setUserId('adm_'.uniqid());
        $admin->setPassword($hasher->hashPassword($admin, $this->adminPassword));
        $admin->setIsLopdAccepted(true);
        $admin->setRoles(['ROLE_ADMIN']);
        $em->persist($admin);

        // Create regular user
        $user = new User();
        $this->userEmail = 'user_'.uniqid().'@example.com';
        $this->userPassword = 'UserPwd123!';
        $user->setEmail($this->userEmail);
        $this->userUserId = 'usr_'.uniqid();
        $user->setUserId($this->userUserId);
        $user->setPassword($hasher->hashPassword($user, $this->userPassword));
        $user->setIsLopdAccepted(true);
        $user->setRoles(['ROLE_USER']);
        $em->persist($user);

        // Create another regular user (to test access control)
        $other = new User();
        $this->otherUserEmail = 'other_'.uniqid().'@example.com';
        $other->setEmail($this->otherUserEmail);
        $this->otherUserUserId = 'usr_'.uniqid();
        $other->setUserId($this->otherUserUserId);
        $other->setPassword($hasher->hashPassword($other, 'OtherPwd123!'));
        $other->setIsLopdAccepted(true);
        $other->setRoles(['ROLE_USER']);
        $em->persist($other);

        $em->flush();

        $this->adminId = (int) $admin->getId();
        $this->userId = (int) $user->getId();
        $this->otherUserId = (int) $other->getId();

        static::ensureKernelShutdown();
    }

    /**
     * Extract users array from ApiPlatform response supporting plain-array or hydra format.
     *
     * @param array $payload decoded JSON
     *
     * @return array<int,array<string,mixed>>
     */
    private function extractUsers(array $payload): array
    {
        if ($payload === [] || (isset($payload[0]) && is_array($payload[0]) && array_key_exists('email', $payload[0]))) {
            return $payload;
        }
        if (isset($payload['hydra:member']) && is_array($payload['hydra:member'])) {
            return $payload['hydra:member'];
        }

        return $payload;
    }

    private function loginClient(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client, string $email, string $password): void
    {
        $client->request('POST', '/login_check', [
            'email' => $email,
            'password' => $password,
        ]);
        // Successful login redirects
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    private function assertStatus(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client, int $expected): void
    {
        $resp = $client->getResponse();
        $body = $resp->getContent();
        $this->assertSame($expected, $resp->getStatusCode(), "HTTP {$resp->getStatusCode()} !== {$expected}. Body:\n".$body);
    }

    public function testRequiresAuthForUsersCollection(): void
    {
        $client = static::createClient();
        $client->request('GET', '/api/v2/users', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        // In session flow, unauthenticated requests redirect to login (302)
        $this->assertStatus($client, 302);
    }

    public function testListUsersAsAdmin(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->adminEmail, $this->adminPassword);
        $client->request('GET', '/api/v2/users', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        // Response should be a JSON array (as configured to return JSON)
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertIsArray($data);
    }

    public function testListUsersAsRegularOnlySelf(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->userEmail, $this->userPassword);
        // Base assertion only on user created by this test; tolerate extra DB data
        $client->request('GET', '/api/v2/users?email='.urlencode($this->userEmail), server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $raw = json_decode($client->getResponse()->getContent(), true);
        $data = $this->extractUsers($raw);
        $this->assertCount(1, $data, 'Regular users must see only themselves');
        $this->assertSame($this->userEmail, $data[0]['email']);
    }

    public function testListSizesAdminVsRegular(): void
    {
        $client = static::createClient();

        // Regular: should see exactly 1 (self) without filters
        $this->loginClient($client, $this->userEmail, $this->userPassword);
        $client->request('GET', '/api/v2/users', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $raw = json_decode($client->getResponse()->getContent(), true);
        $regularList = is_array($raw) ? $raw : [];
        $this->assertCount(1, $regularList, 'Regular must see exactly 1 user (self) without filters');

        // Admin: should see many (>= 2) without filters
        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client, $this->adminEmail, $this->adminPassword);
        $client->request('GET', '/api/v2/users', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $raw = json_decode($client->getResponse()->getContent(), true);
        $adminList = is_array($raw) ? $raw : [];
        $this->assertGreaterThanOrEqual(2, count($adminList), 'Admin must see 2 or more users');
    }

    public function testGetUserByUserIdAndByEmail(): void
    {
        $client = static::createClient();
        // Admin can fetch by userId and by email
        $this->loginClient($client, $this->adminEmail, $this->adminPassword);
        $client->request('GET', '/api/v2/users/by-userid/'.$this->userUserId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame($this->userEmail, $data['email'] ?? null);

        $client->request('GET', '/api/v2/users/by-email/'.urlencode($this->userEmail), server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $data2 = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame($this->userUserId, $data2['userId'] ?? null);

        // Regular can fetch own record via both endpoints, but not others
        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client, $this->userEmail, $this->userPassword);
        $client->request('GET', '/api/v2/users/by-userid/'.$this->userUserId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $client->request('GET', '/api/v2/users/by-email/'.urlencode($this->userEmail), server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $client->request('GET', '/api/v2/users/by-userid/'.$this->otherUserUserId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 403);
        $client->request('GET', '/api/v2/users/by-email/'.urlencode($this->otherUserEmail), server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 403);
    }

    public function testGetOwnUserAsOwner(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->userEmail, $this->userPassword);
        $client->request('GET', '/api/v2/users/'.$this->userId, server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $content = $client->getResponse()->getContent();
        $this->assertStringContainsString($this->userEmail, $content);
        $this->assertStringContainsString('"id":', $content);
    }

    public function testPatchOwnEmailAsOwner(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->userEmail, $this->userPassword);
        $newEmail = 'updated_'.uniqid().'@example.com';
        $client->request('PATCH', '/api/v2/users/'.$this->userId, [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/merge-patch+json',
        ], json_encode(['email' => $newEmail]));
        $this->assertStatus($client, 200);
        $this->assertStringContainsString($newEmail, $client->getResponse()->getContent());
    }

    public function testPatchRolesAsOwnerForbidden(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->userEmail, $this->userPassword);
        $client->request('PATCH', '/api/v2/users/'.$this->userId, [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/merge-patch+json',
        ], json_encode(['roles' => ['ROLE_ADMIN']]));
        $this->assertStatus($client, 403);
    }

    public function testCreateUserAsAdmin(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->adminEmail, $this->adminPassword);
        $email = 'new_'.uniqid().'@example.com';
        $client->request('POST', '/api/v2/users', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $email,
            'userId' => 'usr_'.uniqid(),
            'password' => 'x',
            'isLopdAccepted' => true,
        ]));
        $this->assertStatus($client, 201);
        $this->assertStringContainsString($email, $client->getResponse()->getContent());
    }

    public function testCreateUserAsRegularForbidden(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->userEmail, $this->userPassword);
        $email = 'forbid_'.uniqid().'@example.com';
        $client->request('POST', '/api/v2/users', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $email,
            'userId' => 'usr_'.uniqid(),
            'password' => 'x',
            'isLopdAccepted' => true,
        ]));
        $this->assertStatus($client, 403);
    }

    public function testDeleteUserAsAdmin(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->adminEmail, $this->adminPassword);

        // Create throwaway user
        $em = $client->getContainer()->get('doctrine')->getManager();
        $tmp = new User();
        $tmp->setEmail('tmp_'.uniqid().'@example.com');
        $tmp->setUserId('usr_'.uniqid());
        $tmp->setPassword('x');
        $tmp->setIsLopdAccepted(true);
        $em->persist($tmp);
        $em->flush();

        $client->request('DELETE', '/api/v2/users/'.$tmp->getId(), server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 204);
    }

    public function testOwnerCanManageOwnPreferences(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->userEmail, $this->userPassword);

        // PUT preference
        $client->request('PUT', '/api/v2/users/'.$this->userUserId.'/preferences/locale', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['value' => 'es', 'description' => 'Language']));
        $this->assertStatus($client, 200);

        // GET list
        $client->request('GET', '/api/v2/users/'.$this->userUserId.'/preferences', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $list = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($list);

        // GET single
        $client->request('GET', '/api/v2/users/'.$this->userUserId.'/preferences/locale', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $pref = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('es', $pref['value']);

        // DELETE
        $client->request('DELETE', '/api/v2/users/'.$this->userUserId.'/preferences/locale', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 204);
    }

    public function testOwnerCanManageOwnPreferencesNumericId(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->userEmail, $this->userPassword);

        // PUT preference using numeric id
        $client->request('PUT', '/api/v2/users/'.$this->userId.'/preferences/locale', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['value' => 'en', 'description' => 'Language via numeric id']));
        $this->assertStatus($client, 200);

        // GET list using numeric id
        $client->request('GET', '/api/v2/users/'.$this->userId.'/preferences', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $list = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($list);
    }

    public function testRegularCannotAccessOthersPreferences(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->userEmail, $this->userPassword);
        $client->request('GET', '/api/v2/users/'.$this->otherUserUserId.'/preferences', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 403);
    }

    public function testAdminCanAccessOthersPreferences(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->adminEmail, $this->adminPassword);
        $client->request('GET', '/api/v2/users/'.$this->userUserId.'/preferences', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
    }

    public function testBlockUserAsAdmin(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->adminEmail, $this->adminPassword);
        $client->request('POST', '/api/v2/users/'.$this->userId.'/block', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);

        $em = $client->getContainer()->get('doctrine')->getManager();
        $u = $em->getRepository(User::class)->find($this->userId);
        $this->assertFalse($u->getIsActive());
    }

    public function testGetStatsAsOwner(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->userEmail, $this->userPassword);
        $client->request('GET', '/api/v2/users/'.$this->userId.'/stats', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
        $json = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('projectsCount', $json);
        $this->assertArrayHasKey('usedSpaceMb', $json);
        $this->assertArrayHasKey('quotaMb', $json);
    }

    public function testGetStatsAsAdminForOtherUser(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->adminEmail, $this->adminPassword);
        $client->request('GET', '/api/v2/users/'.$this->otherUserId.'/stats', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 200);
    }

    public function testGetStatsAsDifferentRegularForbidden(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->userEmail, $this->userPassword);
        $client->request('GET', '/api/v2/users/'.$this->otherUserId.'/stats', server: [ 'HTTP_ACCEPT' => 'application/json' ]);
        $this->assertStatus($client, 403);
    }

    public function testPatchQuotaAsAdmin(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->adminEmail, $this->adminPassword);
        $client->request('PATCH', '/api/v2/users/'.$this->userId.'/quota', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['quotaMb' => 2048]));
        $this->assertStatus($client, 200);

        $em = $client->getContainer()->get('doctrine')->getManager();
        $u = $em->getRepository(User::class)->find($this->userId);
        $this->assertSame(2048, $u->getQuotaMb());
    }

    public function testPatchQuotaAsRegularForbidden(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->userEmail, $this->userPassword);
        $client->request('PATCH', '/api/v2/users/'.$this->userId.'/quota', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['quotaMb' => 1024]));
        $this->assertStatus($client, 403);
    }
}
