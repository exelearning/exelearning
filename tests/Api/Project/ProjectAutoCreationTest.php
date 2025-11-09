<?php

declare(strict_types=1);

namespace App\Tests\Api\Project;

use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * API tests for project auto-creation from OdeFiles (backwards compatibility).
 *
 * Coverage:
 * - GET /api/projects/{id} creates Project from OdeFiles when Project doesn't exist
 * - Creates ProjectCollaborator with ROLE_OWNER
 * - Maps fields correctly (title, owner, visibility=private)
 * - Subsequent calls return existing Project (idempotent)
 * - Auto-creation only happens when OdeFiles exists
 */
class ProjectAutoCreationTest extends WebTestCase
{
    private string $userEmail;
    private string $userPassword;
    private string $odeId;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create user
        $user = new User();
        $this->userEmail = 'autocreate_' . uniqid() . '@example.com';
        $this->userPassword = 'AutoPwd123!';
        $user->setEmail($this->userEmail);
        $user->setUserId('auto_' . uniqid());
        $user->setPassword($hasher->hashPassword($user, $this->userPassword));
        $user->setIsLopdAccepted(true);
        $user->setRoles(['ROLE_USER']);
        $em->persist($user);
        $em->flush();

        // Create OdeFiles entry (without corresponding Project)
        $this->odeId = 'ODE_AUTO_' . uniqid();
        $odeFile = new OdeFiles();
        $odeFile->setOdeId($this->odeId);
        $odeFile->setOdeVersionId('VER_' . uniqid());
        $odeFile->setTitle('Legacy ODE Project Title');
        $odeFile->setFileName('project.elp');
        $odeFile->setFileType('elp');
        $odeFile->setDiskFilename('disk_' . uniqid() . '.elp');
        $odeFile->setSize(1024);
        $odeFile->setUser($user->getEmail());
        $odeFile->setIsManualSave(true);
        $em->persist($odeFile);
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

    public function testGetProjectAutoCreatesFromOdeFileWhenProjectDoesNotExist(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Verify Project doesn't exist yet
        $em = $client->getContainer()->get('doctrine')->getManager();
        $project = $em->find(Project::class, $this->odeId);
        $this->assertNull($project, 'Project should not exist before GET request');

        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client);

        // Request project - should auto-create from OdeFile
        $client->request('GET', "/api/projects/{$this->odeId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
        $this->assertArrayHasKey('project', $response);

        // Verify fields mapped correctly
        $this->assertSame($this->odeId, $response['project']['id']);
        $this->assertSame('Legacy ODE Project Title', $response['project']['title']);
        $this->assertSame('private', $response['project']['visibility']);
        $this->assertFalse($response['project']['isPublic']);
        $this->assertFalse($response['project']['isArchived']);

        // Verify Project was created in database
        $em = $client->getContainer()->get('doctrine')->getManager();
        $project = $em->find(Project::class, $this->odeId);
        $this->assertNotNull($project, 'Project should be auto-created from OdeFile');
        $this->assertSame('Legacy ODE Project Title', $project->getTitle());
        $this->assertSame('private', $project->getVisibility());
    }

    public function testAutoCreatedProjectHasOwnerCollaborator(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        $client->request('GET', "/api/projects/{$this->odeId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);

        // Verify collaborators were created
        $this->assertArrayHasKey('collaborators', $response['project']);
        $this->assertArrayHasKey('collaboratorsCount', $response['project']);
        $this->assertSame(1, $response['project']['collaboratorsCount']);
        $this->assertCount(1, $response['project']['collaborators']);

        $collaborator = $response['project']['collaborators'][0];
        $this->assertSame('owner', $collaborator['role']);
        $this->assertSame($this->userEmail, $collaborator['user']['email']);

        // Verify in database
        $em = $client->getContainer()->get('doctrine')->getManager();
        $project = $em->find(Project::class, $this->odeId);
        $collabRepo = $em->getRepository(ProjectCollaborator::class);
        $collaborators = $collabRepo->findByProject($project);

        $this->assertCount(1, $collaborators);
        $this->assertSame(ProjectCollaborator::ROLE_OWNER, $collaborators[0]->getRole());
    }

    public function testAutoCreatedProjectOwnerMatchesOdeFileUser(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        $client->request('GET', "/api/projects/{$this->odeId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame($this->userEmail, $response['project']['owner']['email']);

        // Verify in database
        $em = $client->getContainer()->get('doctrine')->getManager();
        $project = $em->find(Project::class, $this->odeId);
        $this->assertSame($this->userEmail, $project->getOwner()->getEmail());
    }

    public function testSubsequentGetProjectCallsAreIdempotent(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // First call - auto-creates
        $client->request('GET', "/api/projects/{$this->odeId}");
        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response1 = json_decode($client->getResponse()->getContent(), true);

        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client);

        // Second call - returns existing
        $client->request('GET', "/api/projects/{$this->odeId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response2 = json_decode($client->getResponse()->getContent(), true);

        // Both responses should be the same
        $this->assertSame($response1['project']['id'], $response2['project']['id']);
        $this->assertSame($response1['project']['title'], $response2['project']['title']);
        $this->assertSame($response1['project']['visibility'], $response2['project']['visibility']);

        // Verify still only one collaborator (not duplicated)
        $em = $client->getContainer()->get('doctrine')->getManager();
        $project = $em->find(Project::class, $this->odeId);
        $collabRepo = $em->getRepository(ProjectCollaborator::class);
        $collaborators = $collabRepo->findByProject($project);

        $this->assertCount(1, $collaborators, 'Should still have only one collaborator');
    }

    public function testGetProjectReturns404WhenNeitherProjectNorOdeFileExists(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        $client->request('GET', '/api/projects/NONEXISTENT_ID', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(404, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('PROJECT_NOT_FOUND', $response['responseMessage']);
    }

    public function testAutoCreatedProjectCanBeModified(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Auto-create project
        $client->request('GET', "/api/projects/{$this->odeId}");
        $this->assertSame(200, $client->getResponse()->getStatusCode());

        // Now modify visibility
        $client->request('PATCH', "/api/projects/{$this->odeId}/visibility", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['visibility' => 'public']));

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('public', $response['project']['visibility']);

        // Verify persistence
        $em = $client->getContainer()->get('doctrine')->getManager();
        $em->clear();
        $project = $em->find(Project::class, $this->odeId);
        $this->assertSame('public', $project->getVisibility());
    }

    public function testAutoCreationWorksWithMultipleOdeFilesForSameOdeId(): void
    {
        $client = static::createClient();
        $em = $client->getContainer()->get('doctrine')->getManager();

        // Create second OdeFile with same odeId (different version)
        $odeFile2 = new OdeFiles();
        $odeFile2->setOdeId($this->odeId);
        $odeFile2->setOdeVersionId('VER_2_' . uniqid());
        $odeFile2->setTitle('Updated Title');
        $odeFile2->setFileName('project_v2.elp');
        $odeFile2->setFileType('elp');
        $odeFile2->setDiskFilename('disk_v2_' . uniqid() . '.elp');
        $odeFile2->setSize(2048);
        $odeFile2->setUser($this->userEmail);
        $odeFile2->setIsManualSave(true);
        $em->persist($odeFile2);
        $em->flush();

        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client);

        // Request project - should use most recent OdeFile
        $client->request('GET', "/api/projects/{$this->odeId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);

        // The controller should create from the most recent OdeFile
        // (implementation detail - may use first or last, just verify it works)
        $this->assertNotNull($response['project']['title']);
        $this->assertSame($this->odeId, $response['project']['id']);
    }
}
