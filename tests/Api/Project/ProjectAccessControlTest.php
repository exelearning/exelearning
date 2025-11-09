<?php

declare(strict_types=1);

namespace App\Tests\Api\Project;

use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * API tests for GET /api/projects/{id} authorization matrix.
 *
 * Permission matrix (Project View):
 * - Public projects: Everyone can view (owner, collaborator, other users, anonymous)
 * - Private projects: Only owner, collaborators, and admins can view
 * - Non-collaborators on private projects: 403
 * - Anonymous on private projects: 403/401
 */
class ProjectAccessControlTest extends WebTestCase
{
    private string $ownerEmail;
    private string $ownerPassword;
    private string $editorEmail;
    private string $editorPassword;
    private string $otherEmail;
    private string $otherPassword;
    private string $adminEmail;
    private string $adminPassword;
    private string $publicProjectId;
    private string $privateProjectId;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create owner
        $owner = new User();
        $this->ownerEmail = 'access_owner_' . uniqid() . '@example.com';
        $this->ownerPassword = 'OwnerPwd123!';
        $owner->setEmail($this->ownerEmail);
        $owner->setUserId('owner_' . uniqid());
        $owner->setPassword($hasher->hashPassword($owner, $this->ownerPassword));
        $owner->setIsLopdAccepted(true);
        $owner->setRoles(['ROLE_USER']);
        $em->persist($owner);

        // Create editor
        $editor = new User();
        $this->editorEmail = 'access_editor_' . uniqid() . '@example.com';
        $this->editorPassword = 'EditorPwd123!';
        $editor->setEmail($this->editorEmail);
        $editor->setUserId('editor_' . uniqid());
        $editor->setPassword($hasher->hashPassword($editor, $this->editorPassword));
        $editor->setIsLopdAccepted(true);
        $editor->setRoles(['ROLE_USER']);
        $em->persist($editor);

        // Create other user (not a collaborator)
        $other = new User();
        $this->otherEmail = 'access_other_' . uniqid() . '@example.com';
        $this->otherPassword = 'OtherPwd123!';
        $other->setEmail($this->otherEmail);
        $other->setUserId('other_' . uniqid());
        $other->setPassword($hasher->hashPassword($other, $this->otherPassword));
        $other->setIsLopdAccepted(true);
        $other->setRoles(['ROLE_USER']);
        $em->persist($other);

        // Create admin
        $admin = new User();
        $this->adminEmail = 'access_admin_' . uniqid() . '@example.com';
        $this->adminPassword = 'AdminPwd123!';
        $admin->setEmail($this->adminEmail);
        $admin->setUserId('admin_' . uniqid());
        $admin->setPassword($hasher->hashPassword($admin, $this->adminPassword));
        $admin->setIsLopdAccepted(true);
        $admin->setRoles(['ROLE_ADMIN']);
        $em->persist($admin);

        $em->flush();

        // Create public project
        $this->publicProjectId = 'PUBLIC_ACCESS_' . uniqid();
        $publicProject = new Project();
        $publicProject->setId($this->publicProjectId);
        $publicProject->setTitle('Public Access Test');
        $publicProject->setOwner($owner);
        $publicProject->setVisibility('public');
        $em->persist($publicProject);

        $publicOwnerCollab = new ProjectCollaborator();
        $publicOwnerCollab->setProject($publicProject);
        $publicOwnerCollab->setUser($owner);
        $publicOwnerCollab->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($publicOwnerCollab);

        $publicEditorCollab = new ProjectCollaborator();
        $publicEditorCollab->setProject($publicProject);
        $publicEditorCollab->setUser($editor);
        $publicEditorCollab->setRole(ProjectCollaborator::ROLE_EDITOR);
        $em->persist($publicEditorCollab);

        // Create private project
        $this->privateProjectId = 'PRIVATE_ACCESS_' . uniqid();
        $privateProject = new Project();
        $privateProject->setId($this->privateProjectId);
        $privateProject->setTitle('Private Access Test');
        $privateProject->setOwner($owner);
        $privateProject->setVisibility('private');
        $em->persist($privateProject);

        $privateOwnerCollab = new ProjectCollaborator();
        $privateOwnerCollab->setProject($privateProject);
        $privateOwnerCollab->setUser($owner);
        $privateOwnerCollab->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($privateOwnerCollab);

        $privateEditorCollab = new ProjectCollaborator();
        $privateEditorCollab->setProject($privateProject);
        $privateEditorCollab->setUser($editor);
        $privateEditorCollab->setRole(ProjectCollaborator::ROLE_EDITOR);
        $em->persist($privateEditorCollab);

        $em->flush();
        static::ensureKernelShutdown();
    }

    private function loginClient(\Symfony\Bundle\FrameworkBundle\KernelBrowser $client, string $email, string $password): void
    {
        $client->request('POST', '/login_check', [
            'email' => $email,
            'password' => $password,
        ]);
        $this->assertSame(302, $client->getResponse()->getStatusCode());
    }

    // Public Project Tests

    public function testOwnerCanViewPublicProject(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('GET', "/api/projects/{$this->publicProjectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
        $this->assertSame($this->publicProjectId, $response['project']['id']);
        $this->assertSame('public', $response['project']['visibility']);
    }

    public function testEditorCanViewPublicProject(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->editorEmail, $this->editorPassword);

        $client->request('GET', "/api/projects/{$this->publicProjectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
    }

    public function testNonCollaboratorCanViewPublicProject(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->otherEmail, $this->otherPassword);

        $client->request('GET', "/api/projects/{$this->publicProjectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
    }

    public function testAdminCanViewPublicProject(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->adminEmail, $this->adminPassword);

        $client->request('GET', "/api/projects/{$this->publicProjectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
    }

    // Private Project Tests

    public function testOwnerCanViewPrivateProject(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('GET', "/api/projects/{$this->privateProjectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
        $this->assertSame($this->privateProjectId, $response['project']['id']);
        $this->assertSame('private', $response['project']['visibility']);
    }

    public function testEditorCanViewPrivateProject(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->editorEmail, $this->editorPassword);

        $client->request('GET', "/api/projects/{$this->privateProjectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
    }

    public function testNonCollaboratorCannotViewPrivateProject(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->otherEmail, $this->otherPassword);

        $client->request('GET', "/api/projects/{$this->privateProjectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(403, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('ACCESS_DENIED', $response['responseMessage']);
    }

    public function testAdminCanViewPrivateProject(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->adminEmail, $this->adminPassword);

        $client->request('GET', "/api/projects/{$this->privateProjectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
    }

    // Response includes collaborators

    public function testGetProjectIncludesCollaboratorsList(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('GET', "/api/projects/{$this->privateProjectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('collaborators', $response['project']);
        $this->assertArrayHasKey('collaboratorsCount', $response['project']);
        $this->assertSame(2, $response['project']['collaboratorsCount']);
        $this->assertCount(2, $response['project']['collaborators']);
    }

    public function testGetProjectUpdatesLastAccessedAt(): void
    {
        $client = static::createClient();
        $em = $client->getContainer()->get('doctrine')->getManager();

        // Get initial lastAccessedAt
        $project = $em->find(Project::class, $this->publicProjectId);
        $initialLastAccessed = $project->getLastAccessedAt();

        static::ensureKernelShutdown();
        sleep(1); // Ensure time difference

        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('GET', "/api/projects/{$this->publicProjectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        // Verify lastAccessedAt was updated
        $em = $client->getContainer()->get('doctrine')->getManager();
        $em->clear();
        $project = $em->find(Project::class, $this->publicProjectId);
        $updatedLastAccessed = $project->getLastAccessedAt();

        if ($initialLastAccessed === null) {
            $this->assertNotNull($updatedLastAccessed);
        } else {
            $this->assertGreaterThan($initialLastAccessed->getTimestamp(), $updatedLastAccessed->getTimestamp());
        }
    }

    public function testNonExistentProjectReturns404(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('GET', '/api/projects/NONEXISTENT', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(404, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('PROJECT_NOT_FOUND', $response['responseMessage']);
    }

    public function testGetProjectIncludesOwnerInformation(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('GET', "/api/projects/{$this->publicProjectId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('owner', $response['project']);
        $this->assertArrayHasKey('id', $response['project']['owner']);
        $this->assertArrayHasKey('email', $response['project']['owner']);
        $this->assertArrayHasKey('userId', $response['project']['owner']);
        $this->assertSame($this->ownerEmail, $response['project']['owner']['email']);
    }
}
