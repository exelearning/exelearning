<?php

namespace App\Tests\Controller\Project;

use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Tests for ProjectApiController
 *
 * Verifies:
 * - GET /api/projects/{id} returns correct data
 * - Backwards compatibility with OdeFiles
 * - 404 handling
 */
class ProjectApiControllerTest extends WebTestCase
{
    private string $userEmail;
    private string $userPassword;
    private User $testUser;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create test user
        $user = new User();
        $this->userEmail = 'project_test_'.uniqid().'@example.com';
        $this->userPassword = 'TestPwd123!';
        $user->setEmail($this->userEmail);
        $user->setUserId('usr_'.uniqid());
        $user->setPassword($hasher->hashPassword($user, $this->userPassword));
        $user->setIsLopdAccepted(true);
        $user->setRoles(['ROLE_USER']);
        $em->persist($user);
        $em->flush();

        $this->testUser = $user;

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

    public function testGetProjectReturnsCorrectData(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();

        // Reload user in current entity manager
        $user = $em->getRepository(User::class)->findOneBy(['email' => $this->userEmail]);

        // Create a test project
        $projectId = 'TEST'.uniqid();
        $project = new Project();
        $project->setId($projectId);
        $project->setTitle('Test Project');
        $project->setOwner($user);
        $project->setVisibility('private');
        $project->setArchived(false);
        $em->persist($project);

        // Create collaborator
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($project);
        $collaborator->setUser($user);
        $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
        $collaborator->setGrantedBy($user);
        $em->persist($collaborator);
        $em->flush();

        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client);

        // Request project
        $client->request('GET', "/api/projects/{$projectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);

        // Assert structure
        $this->assertArrayHasKey('responseMessage', $response);
        $this->assertSame('OK', $response['responseMessage']);
        $this->assertArrayHasKey('project', $response);

        $projectData = $response['project'];
        $this->assertSame($projectId, $projectData['id']);
        $this->assertSame('Test Project', $projectData['title']);
        $this->assertSame('private', $projectData['visibility']);
        $this->assertArrayHasKey('owner', $projectData);
        $this->assertArrayHasKey('collaborators', $projectData);

        // Verify collaborators
        $this->assertIsArray($projectData['collaborators']);
        $this->assertCount(1, $projectData['collaborators']);
        $this->assertSame(ProjectCollaborator::ROLE_OWNER, $projectData['collaborators'][0]['role']);
    }

    public function testGetProjectCreatesFromOdeFileWhenNotExists(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();

        // Reload user
        $user = $em->getRepository(User::class)->findOneBy(['email' => $this->userEmail]);

        // Create an OdeFile without corresponding Project
        $odeId = 'ODE'.uniqid();
        $odeFile = new OdeFiles();
        $odeFile->setOdeId($odeId);
        $odeFile->setOdeVersionId('v1');
        $odeFile->setVersionName('1');
        $odeFile->setUser($user->getUserIdentifier());
        $odeFile->setTitle('Legacy ODE Project');
        $odeFile->setFileName('test.elp');
        $odeFile->setFileType('elp');
        $odeFile->setDiskFilename('test_'.uniqid().'.elp');
        $odeFile->setSize('1024');
        $odeFile->setIsManualSave(true);
        $em->persist($odeFile);
        $em->flush();

        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client);

        // Request project - should auto-create from OdeFile
        $client->request('GET', "/api/projects/{$odeId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);

        $this->assertSame('OK', $response['responseMessage']);
        $this->assertSame($odeId, $response['project']['id']);
        $this->assertSame('Legacy ODE Project', $response['project']['title']);

        // Verify Project was created in database
        $em = $client->getContainer()->get('doctrine')->getManager();
        $projectRepo = $em->getRepository(Project::class);
        $project = $projectRepo->find($odeId);

        $this->assertNotNull($project, 'Project should have been auto-created from OdeFile');
        $this->assertSame('Legacy ODE Project', $project->getTitle());
    }

    public function testGetProjectReturns404WhenNotFound(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        $nonExistentId = 'NONEXISTENT'.uniqid();

        $client->request('GET', "/api/projects/{$nonExistentId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(404, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);

        $this->assertArrayHasKey('responseMessage', $response);
        $this->assertSame('PROJECT_NOT_FOUND', $response['responseMessage']);
    }

    public function testGetProjectDeniesAccessToNonCollaborators(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create another user (owner)
        $owner = new User();
        $ownerEmail = 'owner_'.uniqid().'@example.com';
        $owner->setEmail($ownerEmail);
        $owner->setUserId('usr_'.uniqid());
        $owner->setPassword($hasher->hashPassword($owner, 'OwnerPwd123!'));
        $owner->setIsLopdAccepted(true);
        $owner->setRoles(['ROLE_USER']);
        $em->persist($owner);

        // Create a private project owned by the other user
        $projectId = 'PRIVATE'.uniqid();
        $project = new Project();
        $project->setId($projectId);
        $project->setTitle('Private Project');
        $project->setOwner($owner);
        $project->setVisibility('private');
        $project->setArchived(false);
        $em->persist($project);

        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($project);
        $collaborator->setUser($owner);
        $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
        $collaborator->setGrantedBy($owner);
        $em->persist($collaborator);
        $em->flush();

        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client); // Login as testUser (not owner)

        // Try to access - should be denied
        $client->request('GET', "/api/projects/{$projectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(403, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('responseMessage', $response);
        $this->assertSame('ACCESS_DENIED', $response['responseMessage']);
    }
}
