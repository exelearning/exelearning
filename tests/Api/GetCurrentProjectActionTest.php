<?php

namespace App\Tests\Api;

use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Tests for GetCurrentProjectAction
 *
 * Verifies that creating a new project:
 * - Creates CurrentOdeUsers entry
 * - Creates Project entity
 * - Creates ProjectCollaborator with ROLE_OWNER
 */
class GetCurrentProjectActionTest extends WebTestCase
{
    private string $userEmail;
    private string $userPassword;
    private static bool $userCreated = false;

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();

        // Boot kernel once to create test user
        self::bootKernel();
        $container = static::getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create test user
        $user = new User();
        $email = 'test_'.uniqid().'@example.com';
        $user->setEmail($email);
        $user->setUserId('usr_'.uniqid());
        $user->setPassword($hasher->hashPassword($user, 'TestPwd123!'));
        $user->setIsLopdAccepted(true);
        $user->setRoles(['ROLE_USER']);
        $em->persist($user);
        $em->flush();

        // Store credentials in environment for tests to use
        $_ENV['TEST_USER_EMAIL'] = $email;
        $_ENV['TEST_USER_PASSWORD'] = 'TestPwd123!';

        self::ensureKernelShutdown();
    }

    protected function setUp(): void
    {
        $this->userEmail = $_ENV['TEST_USER_EMAIL'] ?? 'test@example.com';
        $this->userPassword = $_ENV['TEST_USER_PASSWORD'] ?? 'TestPwd123!';
    }

    private function loginClient(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client): void
    {
        $client->request('POST', '/login_check', [
            'email' => $this->userEmail,
            'password' => $this->userPassword,
        ]);
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    public function testCreateNewProjectCreatesAllRequiredEntities(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Request to create new project session
        $client->request('GET', '/api/ode-management/odes/current/project/get', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);

        // Assert response structure
        $this->assertArrayHasKey('responseMessage', $response);
        $this->assertSame('OK', $response['responseMessage']);
        $this->assertArrayHasKey('currentOdeUsers', $response);

        $currentOdeUsers = $response['currentOdeUsers'];
        $this->assertArrayHasKey('odeId', $currentOdeUsers);
        $this->assertArrayHasKey('odeSessionId', $currentOdeUsers);
        $this->assertArrayHasKey('odeVersionId', $currentOdeUsers);

        $odeId = $currentOdeUsers['odeId'];

        // Verify Project entity was created
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $projectRepo = $em->getRepository(Project::class);
        $project = $projectRepo->find($odeId);

        $this->assertNotNull($project, 'Project entity should be created');
        $this->assertSame($odeId, $project->getId());
        $this->assertSame('New Project', $project->getTitle());
        $this->assertSame('private', $project->getVisibility());
        $this->assertFalse($project->isArchived());

        // Verify ProjectCollaborator was created with ROLE_OWNER
        $collaboratorRepo = $em->getRepository(ProjectCollaborator::class);
        $collaborators = $collaboratorRepo->findBy(['project' => $project]);

        $this->assertCount(1, $collaborators, 'Should have exactly one collaborator (owner)');

        $collaborator = $collaborators[0];
        $this->assertSame(ProjectCollaborator::ROLE_OWNER, $collaborator->getRole());
        $this->assertSame($project->getOwner()->getId(), $collaborator->getUser()->getId());
    }

    public function testReturnsExistingSessionWhenCalledMultipleTimes(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // First request - creates project and session
        $client->request('GET', '/api/ode-management/odes/current/project/get');
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response1 = json_decode($client->getResponse()->getContent(), true);
        $odeId1 = $response1['currentOdeUsers']['odeId'];

        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client);

        // Second request without forceNewSession - should return existing session
        $client->request('GET', '/api/ode-management/odes/current/project/get');
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response2 = json_decode($client->getResponse()->getContent(), true);
        $odeId2 = $response2['currentOdeUsers']['odeId'];

        // Should return the same session/project
        $this->assertSame($odeId1, $odeId2, 'Should return existing session when called again');
    }

    /**
     * Test: Navigating to /workarea without parameters creates new project
     *
     * Scenario:
     * - User navigates to /workarea in browser (no query params)
     * - System should create brand new project with unique IDs
     */
    public function testWorkareaWithoutParametersCreatesNewProject(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Simulate navigating to /workarea without any parameters
        // The endpoint should detect forceNewSession=true when no sessionId/projectId provided
        $client->request('GET', '/api/ode-management/odes/current/project/get', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);

        $this->assertSame('OK', $response['responseMessage']);
        $this->assertArrayHasKey('currentOdeUsers', $response);
        $this->assertArrayHasKey('odeId', $response['currentOdeUsers']);
        $this->assertArrayHasKey('odeSessionId', $response['currentOdeUsers']);
        $this->assertArrayHasKey('odeVersionId', $response['currentOdeUsers']);

        // Verify all IDs are generated (non-empty)
        $this->assertNotEmpty($response['currentOdeUsers']['odeId']);
        $this->assertNotEmpty($response['currentOdeUsers']['odeSessionId']);
        $this->assertNotEmpty($response['currentOdeUsers']['odeVersionId']);
    }

    /**
     * Test: forceNewSession=true always creates new project
     *
     * Scenario:
     * - User has existing session
     * - User clicks "File → New" which sends forceNewSession=true
     * - System should create DIFFERENT project with NEW IDs
     */
    public function testForceNewSessionCreatesNewProjectWithDifferentIds(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Step 1: Create initial project
        $client->request('GET', '/api/ode-management/odes/current/project/get');
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response1 = json_decode($client->getResponse()->getContent(), true);
        $odeId1 = $response1['currentOdeUsers']['odeId'];
        $sessionId1 = $response1['currentOdeUsers']['odeSessionId'];
        $versionId1 = $response1['currentOdeUsers']['odeVersionId'];

        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client);

        // Step 2: Request new project with forceNewSession=true (simulating "File → New")
        $client->request('GET', '/api/ode-management/odes/current/project/get', [
            'forceNewSession' => 'true',
        ]);
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response2 = json_decode($client->getResponse()->getContent(), true);

        $this->assertSame('OK', $response2['responseMessage']);

        $odeId2 = $response2['currentOdeUsers']['odeId'];
        $sessionId2 = $response2['currentOdeUsers']['odeSessionId'];
        $versionId2 = $response2['currentOdeUsers']['odeVersionId'];

        // CRITICAL: All IDs should be DIFFERENT from the first project
        $this->assertNotSame($odeId1, $odeId2, 'New project should have different odeId');
        $this->assertNotSame($sessionId1, $sessionId2, 'New project should have different sessionId');
        $this->assertNotSame($versionId1, $versionId2, 'New project should have different versionId');

        // Verify isNewSession flag is true
        $this->assertArrayHasKey('isNewSession', $response2);
        $this->assertTrue($response2['isNewSession'], 'isNewSession should be true for forced new session');
    }

    /**
     * Test: Simulating complete "File → New" workflow
     *
     * Scenario:
     * 1. User opens a project
     * 2. Makes some changes (simulated by verifying session exists)
     * 3. Clicks "File → New"
     * 4. Frontend clears requestedProjectId and calls with forceNewSession=true
     * 5. Backend creates entirely new project (not reusing old projectId)
     */
    public function testFileNewWorkflowCreatesCompletelyNewProject(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Step 1: Create initial project
        $client->request('GET', '/api/ode-management/odes/current/project/get');
        $response1 = json_decode($client->getResponse()->getContent(), true);
        $originalOdeId = $response1['currentOdeUsers']['odeId'];

        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client);

        // Step 2: Simulate "File → New" workflow
        // Frontend should call with:
        // - NO projectId parameter (cleared by navbarFile.js fix)
        // - forceNewSession=true
        $client->request('GET', '/api/ode-management/odes/current/project/get', [
            'forceNewSession' => 'true',
            // NOTE: NO projectId parameter - this is the key fix
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response2 = json_decode($client->getResponse()->getContent(), true);

        $newOdeId = $response2['currentOdeUsers']['odeId'];

        // CRITICAL ASSERTION: The new odeId must be different
        // If this fails, it means the old projectId was reused (bug not fixed)
        $this->assertNotSame(
            $originalOdeId,
            $newOdeId,
            'File → New should create project with NEW odeId, not reuse old one'
        );

        // Verify both projects exist in database (old one should still exist)
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $projectRepo = $em->getRepository(Project::class);

        $originalProject = $projectRepo->find($originalOdeId);
        $newProject = $projectRepo->find($newOdeId);

        $this->assertNotNull($originalProject, 'Original project should still exist');
        $this->assertNotNull($newProject, 'New project should be created');
        $this->assertNotSame($originalProject->getId(), $newProject->getId());
    }
}
