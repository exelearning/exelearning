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

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create test user
        $user = new User();
        $this->userEmail = 'test_'.uniqid().'@example.com';
        $this->userPassword = 'TestPwd123!';
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
}
