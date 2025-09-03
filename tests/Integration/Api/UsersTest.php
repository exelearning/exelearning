<?php

namespace App\Tests\Integration\Api;

use App\Entity\net\exelearning\Entity\User;
use App\Settings;
use Firebase\JWT\JWT;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

class UsersTest extends WebTestCase
{
    private int $adminId;
    private string $adminEmail;

    private int $userId;
    private string $userEmail;

    private int $otherUserId;
    private string $otherUserEmail;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Admin
        $admin = new User();
        $this->adminEmail = 'admin_int_'.uniqid().'@example.com';
        $admin->setEmail($this->adminEmail);
        $admin->setUserId('adm_'.uniqid());
        $admin->setPassword($hasher->hashPassword($admin, 'x'));
        $admin->setIsLopdAccepted(true);
        $admin->setRoles(['ROLE_ADMIN']);
        $em->persist($admin);

        // Regular A
        $u = new User();
        $this->userEmail = 'user_int_'.uniqid().'@example.com';
        $u->setEmail($this->userEmail);
        $u->setUserId('usr_'.uniqid());
        $u->setPassword($hasher->hashPassword($u, 'x'));
        $u->setIsLopdAccepted(true);
        $u->setRoles(['ROLE_USER']);
        $em->persist($u);

        // Regular B
        $o = new User();
        $this->otherUserEmail = 'other_int_'.uniqid().'@example.com';
        $o->setEmail($this->otherUserEmail);
        $o->setUserId('usr_'.uniqid());
        $o->setPassword($hasher->hashPassword($o, 'x'));
        $o->setIsLopdAccepted(true);
        $o->setRoles(['ROLE_USER']);
        $em->persist($o);

        $em->flush();

        $this->adminId = (int) $admin->getId();
        $this->userId = (int) $u->getId();
        $this->otherUserId = (int) $o->getId();

        static::ensureKernelShutdown();
    }

    /**
     * Extract users array from ApiPlatform response supporting plain-array or hydra format.
     *
     * @param array $payload decoded JSON
     *
     * @return array<int,array<string,mixed>> list of user rows
     */
    private function extractUsers(array $payload): array
    {
        // Plain array of users
        if ($payload === [] || (isset($payload[0]) && is_array($payload[0]) && array_key_exists('email', $payload[0]))) {
            return $payload;
        }
        // Hydra format
        if (isset($payload['hydra:member']) && is_array($payload['hydra:member'])) {
            return $payload['hydra:member'];
        }

        return $payload; // fallback
    }

    private function jwtFor(string $email): string
    {
        $secret = (string) ($_ENV['API_JWT_SECRET'] ?? 'test_secret');
        $issuer = (string) ($_ENV['API_JWT_ISSUER'] ?? 'exelearning');
        $aud = (string) ($_ENV['API_JWT_AUDIENCE'] ?? 'clients');

        return JWT::encode([
            'sub' => $email,
            'email' => $email,
            'iss' => $issuer,
            'aud' => $aud,
            'iat' => time(),
            'exp' => time() + 3600,
        ], $secret, Settings::JWT_SECRET_HASH);
    }

    public function testAdminUserGetsFullUsersList(): void
    {
        $client = static::createClient();
        $jwt = $this->jwtFor($this->adminEmail);
        // Basic access works
        $client->request('GET', '/api/v2/users', server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());

        // Admin should be able to filter and find specific users created in this test
        $client->request('GET', '/api/v2/users?email='.urlencode($this->userEmail), server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $listRaw = json_decode($client->getResponse()->getContent(), true);
        $list = $this->extractUsers($listRaw);
        $this->assertCount(1, $list);
        $this->assertSame($this->userEmail, $list[0]['email']);

        $client->request('GET', '/api/v2/users?email='.urlencode($this->otherUserEmail), server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $listRaw = json_decode($client->getResponse()->getContent(), true);
        $list = $this->extractUsers($listRaw);
        $this->assertCount(1, $list);
        $this->assertSame($this->otherUserEmail, $list[0]['email']);
    }

    public function testRegularUserGetsOnlySelfInList(): void
    {
        $client = static::createClient();
        $jwt = $this->jwtFor($this->userEmail);
        // Base the assertion only on what we created: filter by own email
        $client->request('GET', '/api/v2/users?email='.urlencode($this->userEmail), server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $listRaw = json_decode($client->getResponse()->getContent(), true);
        $list = $this->extractUsers($listRaw);
        $this->assertCount(1, $list);
        $this->assertSame($this->userEmail, $list[0]['email']);
    }

    public function testAdminCanGetAnyUserById(): void
    {
        $client = static::createClient();
        $jwt = $this->jwtFor($this->adminEmail);
        $client->request('GET', '/api/v2/users/'.$this->otherUserId, server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
    }

    public function testRegularCanGetOwnUserByIdOnly(): void
    {
        $client = static::createClient();
        $jwt = $this->jwtFor($this->userEmail);
        // Own
        $client->request('GET', '/api/v2/users/'.$this->userId, server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());

        // Other => 403
        $client->request('GET', '/api/v2/users/'.$this->otherUserId, server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(403, $client->getResponse()->getStatusCode());
    }

    public function testAdminFilteringOnUsers(): void
    {
        $client = static::createClient();
        $jwt = $this->jwtFor($this->adminEmail);

        // Filter by email
        $client->request('GET', '/api/v2/users?email='.urlencode($this->userEmail), server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $listRaw = json_decode($client->getResponse()->getContent(), true);
        $list = $this->extractUsers($listRaw);
        $this->assertCount(1, $list);
        $this->assertSame($this->userEmail, $list[0]['email']);

        // Filter by role (alias query param)
        $client->request('GET', '/api/v2/users?role=ROLE_ADMIN', server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $list = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($list);

        // Global search
        $needle = substr($this->otherUserEmail, 0, 5);
        $client->request('GET', '/api/v2/users?search='.urlencode($needle), server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $list = json_decode($client->getResponse()->getContent(), true);
        $this->assertNotEmpty($list);
    }

    public function testRegularFilteringStillReturnsOnlySelf(): void
    {
        $client = static::createClient();
        $jwt = $this->jwtFor($this->userEmail);
        // Use a filter that matches the current user and assert it only returns self
        $client->request('GET', '/api/v2/users?email='.urlencode($this->userEmail), server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $listRaw = json_decode($client->getResponse()->getContent(), true);
        $list = $this->extractUsers($listRaw);
        $this->assertCount(1, $list);
        $this->assertSame($this->userEmail, $list[0]['email']);
    }

    public function testRegularListWithoutFilterReturnsOne(): void
    {
        $client = static::createClient();
        $jwt = $this->jwtFor($this->userEmail);
        $client->request('GET', '/api/v2/users', server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $listRaw = json_decode($client->getResponse()->getContent(), true);
        $this->assertIsArray($listRaw);
        $list = $this->extractUsers($listRaw);
        $this->assertCount(1, $list, 'Regular must see exactly 1 user without filter');
        $this->assertSame($this->userEmail, $list[0]['email']);
    }

    public function testAdminListWithoutFilterIsMany(): void
    {
        $client = static::createClient();
        $jwt = $this->jwtFor($this->adminEmail);
        $client->request('GET', '/api/v2/users', server: [
            'HTTP_Authorization' => 'Bearer '.$jwt,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $listRaw = json_decode($client->getResponse()->getContent(), true);
        $this->assertIsArray($listRaw);
        $list = $this->extractUsers($listRaw);
        $this->assertGreaterThanOrEqual(2, count($list), 'Admin must see 2 or more users without filter');
    }

    public function testPreferencesAccessAdminAndRegular(): void
    {
        // Admin can fetch any user's preferences
        $client = static::createClient();
        $jwtAdmin = $this->jwtFor($this->adminEmail);
        $client->request('GET', '/api/v2/users/'.$this->userId.'/preferences', server: [
            'HTTP_Authorization' => 'Bearer '.$jwtAdmin,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());

        // Regular can fetch own preferences
        $jwtUser = $this->jwtFor($this->userEmail);
        $client->request('GET', '/api/v2/users/'.$this->userId.'/preferences', server: [
            'HTTP_Authorization' => 'Bearer '.$jwtUser,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());

        // Regular cannot fetch other user's preferences
        $client->request('GET', '/api/v2/users/'.$this->otherUserId.'/preferences', server: [
            'HTTP_Authorization' => 'Bearer '.$jwtUser,
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(403, $client->getResponse()->getStatusCode());
    }

    public function testUnauthorizedRequestsReturn401(): void
    {
        $client = static::createClient();

        // Invalid token -> 401
        $client->request('GET', '/api/v2/users', server: [
            'HTTP_Authorization' => 'Bearer invalid',
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(401, $client->getResponse()->getStatusCode());

        $client->request('GET', '/api/v2/users/'.$this->userId, server: [
            'HTTP_Authorization' => 'Bearer invalid',
            'HTTP_ACCEPT' => 'application/json',
        ]);
        $this->assertSame(401, $client->getResponse()->getStatusCode());
    }
}
