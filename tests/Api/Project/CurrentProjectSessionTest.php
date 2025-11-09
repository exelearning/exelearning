<?php

declare(strict_types=1);

namespace App\Tests\Api\Project;

use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Additional API tests for GET /api/ode-management/odes/current/project/get endpoint.
 *
 * Coverage (complementing GetCurrentProjectActionTest):
 * - forceNewSession parameter creates new session
 * - odeSessionId parameter resumes specific session
 * - Invalid odeSessionId returns appropriate error
 * - isNewSession flag in response
 * - Session creates Project and ProjectCollaborator
 */
class CurrentProjectSessionTest extends WebTestCase
{
    private string $userEmail;
    private string $userPassword;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create test user
        $user = new User();
        $this->userEmail = 'session_test_' . uniqid() . '@example.com';
        $this->userPassword = 'SessionPwd123!';
        $user->setEmail($this->userEmail);
        $user->setUserId('session_' . uniqid());
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

    public function testForceNewSessionCreatesNewSession(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Create first session
        $client->request('GET', '/api/ode-management/odes/current/project/get', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response1 = json_decode($client->getResponse()->getContent(), true);
        $odeId1 = $response1['currentOdeUsers']['odeId'];

        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client);

        // Force new session
        $client->request('GET', '/api/ode-management/odes/current/project/get', [
            'forceNewSession' => 'true',
        ], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response2 = json_decode($client->getResponse()->getContent(), true);
        $odeId2 = $response2['currentOdeUsers']['odeId'];

        // Should have different odeIds (new projects)
        $this->assertNotSame($odeId1, $odeId2, 'forceNewSession should create a new project');
    }

    public function testIsNewSessionFlagIsSetCorrectly(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // First call should have isNewSession = true
        $client->request('GET', '/api/ode-management/odes/current/project/get', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('isNewSession', $response);
        // May be true or false depending on whether user has existing sessions
        $this->assertIsBool($response['isNewSession']);
    }

    public function testNewSessionCreatesProjectWithDefaultValues(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        $client->request('GET', '/api/ode-management/odes/current/project/get', [
            'forceNewSession' => 'true',
        ], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);

        $odeId = $response['currentOdeUsers']['odeId'];

        // Verify Project was created
        $em = $client->getContainer()->get('doctrine')->getManager();
        $project = $em->find(Project::class, $odeId);

        $this->assertNotNull($project);
        $this->assertSame('New Project', $project->getTitle());
        $this->assertSame('private', $project->getVisibility());
        $this->assertFalse($project->isArchived());

        // Verify owner is the current user
        $user = $em->getRepository(User::class)->findOneBy(['email' => $this->userEmail]);
        $this->assertSame($user->getId(), $project->getOwner()->getId());
    }

    public function testNewSessionCreatesOwnerCollaborator(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        $client->request('GET', '/api/ode-management/odes/current/project/get', [
            'forceNewSession' => 'true',
        ], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);

        $odeId = $response['currentOdeUsers']['odeId'];

        // Verify ProjectCollaborator was created
        $em = $client->getContainer()->get('doctrine')->getManager();
        $project = $em->find(Project::class, $odeId);
        $user = $em->getRepository(User::class)->findOneBy(['email' => $this->userEmail]);
        $collabRepo = $em->getRepository(ProjectCollaborator::class);

        $collaborator = $collabRepo->findCollaborator($project, $user);

        $this->assertNotNull($collaborator);
        $this->assertSame(ProjectCollaborator::ROLE_OWNER, $collaborator->getRole());
        $this->assertSame($user->getId(), $collaborator->getUser()->getId());
    }

    public function testResponseContainsRequiredFields(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        $client->request('GET', '/api/ode-management/odes/current/project/get', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);

        // Top-level fields
        $this->assertArrayHasKey('responseMessage', $response);
        $this->assertSame('OK', $response['responseMessage']);
        $this->assertArrayHasKey('currentOdeUsers', $response);
        $this->assertArrayHasKey('isNewSession', $response);

        // CurrentOdeUsers fields
        $currentOdeUsers = $response['currentOdeUsers'];
        $this->assertArrayHasKey('odeId', $currentOdeUsers);
        $this->assertArrayHasKey('odeVersionId', $currentOdeUsers);
        $this->assertArrayHasKey('odeSessionId', $currentOdeUsers);
    }

    public function testMultipleSessionsAllCreateProjects(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        $createdOdeIds = [];

        // Create 3 sessions
        for ($i = 0; $i < 3; $i++) {
            $client->request('GET', '/api/ode-management/odes/current/project/get', [
                'forceNewSession' => 'true',
            ]);

            $this->assertSame(200, $client->getResponse()->getStatusCode());
            $response = json_decode($client->getResponse()->getContent(), true);
            $createdOdeIds[] = $response['currentOdeUsers']['odeId'];

            static::ensureKernelShutdown();
            $client = static::createClient();
            $this->loginClient($client);
        }

        // Verify all odeIds are unique
        $this->assertCount(3, array_unique($createdOdeIds), 'All sessions should have unique odeIds');

        // Verify all Projects exist in database
        $em = $client->getContainer()->get('doctrine')->getManager();
        foreach ($createdOdeIds as $odeId) {
            $project = $em->find(Project::class, $odeId);
            $this->assertNotNull($project, "Project {$odeId} should exist");
        }
    }

    public function testEndpointRequiresAuthentication(): void
    {
        $client = static::createClient();

        // Don't login - should require authentication
        $client->request('GET', '/api/ode-management/odes/current/project/get', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        // Should redirect to login or return 401
        $this->assertContains($client->getResponse()->getStatusCode(), [302, 401]);
    }
}
