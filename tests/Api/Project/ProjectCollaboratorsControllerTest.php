<?php

declare(strict_types=1);

namespace App\Tests\Api\Project;

use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * API tests for collaborator management endpoints.
 *
 * Coverage:
 * - GET /api/projects/{id}/collaborators - list collaborators
 * - POST /api/projects/{id}/collaborators - add collaborator
 * - DELETE /api/projects/{id}/collaborators/{userId} - remove collaborator
 *
 * Test matrix:
 * - Owner can add/remove collaborators
 * - Editor cannot add/remove collaborators (403)
 * - Cannot add user that doesn't exist (404)
 * - Cannot add duplicate collaborator (409)
 * - Cannot remove non-collaborator (404)
 * - Cannot remove last owner (400)
 */
class ProjectCollaboratorsControllerTest extends WebTestCase
{
    private string $ownerEmail;
    private string $ownerPassword;
    private int $ownerId;
    private string $editorEmail;
    private string $editorPassword;
    private int $editorId;
    private string $otherEmail;
    private string $otherPassword;
    private int $otherId;
    private string $projectId;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create owner
        $owner = new User();
        $this->ownerEmail = 'collab_owner_' . uniqid() . '@example.com';
        $this->ownerPassword = 'OwnerPwd123!';
        $owner->setEmail($this->ownerEmail);
        $owner->setUserId('owner_' . uniqid());
        $owner->setPassword($hasher->hashPassword($owner, $this->ownerPassword));
        $owner->setIsLopdAccepted(true);
        $owner->setRoles(['ROLE_USER']);
        $em->persist($owner);
        $em->flush();
        $this->ownerId = $owner->getId();

        // Create editor
        $editor = new User();
        $this->editorEmail = 'collab_editor_' . uniqid() . '@example.com';
        $this->editorPassword = 'EditorPwd123!';
        $editor->setEmail($this->editorEmail);
        $editor->setUserId('editor_' . uniqid());
        $editor->setPassword($hasher->hashPassword($editor, $this->editorPassword));
        $editor->setIsLopdAccepted(true);
        $editor->setRoles(['ROLE_USER']);
        $em->persist($editor);
        $em->flush();
        $this->editorId = $editor->getId();

        // Create other user
        $other = new User();
        $this->otherEmail = 'collab_other_' . uniqid() . '@example.com';
        $this->otherPassword = 'OtherPwd123!';
        $other->setEmail($this->otherEmail);
        $other->setUserId('other_' . uniqid());
        $other->setPassword($hasher->hashPassword($other, $this->otherPassword));
        $other->setIsLopdAccepted(true);
        $other->setRoles(['ROLE_USER']);
        $em->persist($other);
        $em->flush();
        $this->otherId = $other->getId();

        // Create project
        $this->projectId = 'COLLAB_TEST_' . uniqid();
        $project = new Project();
        $project->setId($this->projectId);
        $project->setTitle('Collaborators Test Project');
        $project->setOwner($owner);
        $project->setVisibility('private');
        $em->persist($project);

        // Create collaborators
        $ownerCollab = new ProjectCollaborator();
        $ownerCollab->setProject($project);
        $ownerCollab->setUser($owner);
        $ownerCollab->setRole(ProjectCollaborator::ROLE_OWNER);
        $ownerCollab->setGrantedBy($owner);
        $em->persist($ownerCollab);

        $editorCollab = new ProjectCollaborator();
        $editorCollab->setProject($project);
        $editorCollab->setUser($editor);
        $editorCollab->setRole(ProjectCollaborator::ROLE_EDITOR);
        $editorCollab->setGrantedBy($owner);
        $em->persist($editorCollab);

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

    public function testOwnerCanListCollaborators(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('GET', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
        $this->assertArrayHasKey('collaborators', $response);
        $this->assertArrayHasKey('count', $response);
        $this->assertSame(2, $response['count']);
        $this->assertCount(2, $response['collaborators']);

        // Verify collaborator structure
        foreach ($response['collaborators'] as $collab) {
            $this->assertArrayHasKey('id', $collab);
            $this->assertArrayHasKey('user', $collab);
            $this->assertArrayHasKey('role', $collab);
            $this->assertArrayHasKey('grantedAt', $collab);
            $this->assertArrayHasKey('grantedBy', $collab);
            $this->assertContains($collab['role'], ['owner', 'editor']);
        }
    }

    public function testEditorCanListCollaborators(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->editorEmail, $this->editorPassword);

        $client->request('GET', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
        $this->assertCount(2, $response['collaborators']);
    }

    public function testNonCollaboratorCannotListCollaboratorsOnPrivateProject(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->otherEmail, $this->otherPassword);

        $client->request('GET', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(403, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('ACCESS_DENIED', $response['responseMessage']);
    }

    public function testOwnerCanAddCollaboratorByEmail(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('POST', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $this->otherEmail,
            'role' => 'editor',
        ]));

        $this->assertSame(201, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
        $this->assertArrayHasKey('collaborator', $response);
        $this->assertSame($this->otherEmail, $response['collaborator']['user']['email']);
        $this->assertSame('editor', $response['collaborator']['role']);

        // Verify in database
        $em = $client->getContainer()->get('doctrine')->getManager();
        $project = $em->find(Project::class, $this->projectId);
        $otherUser = $em->getRepository(User::class)->findOneBy(['email' => $this->otherEmail]);
        $collabRepo = $em->getRepository(ProjectCollaborator::class);
        $collaborator = $collabRepo->findCollaborator($project, $otherUser);

        $this->assertNotNull($collaborator);
        $this->assertSame('editor', $collaborator->getRole());
    }

    public function testOwnerCanAddCollaboratorAsOwner(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('POST', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $this->otherEmail,
            'role' => 'owner',
        ]));

        $this->assertSame(201, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('owner', $response['collaborator']['role']);
    }

    public function testAddCollaboratorDefaultsToEditorRole(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('POST', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $this->otherEmail,
            // No role specified
        ]));

        $this->assertSame(201, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('editor', $response['collaborator']['role']);
    }

    public function testEditorCannotAddCollaborator(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->editorEmail, $this->editorPassword);

        $client->request('POST', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $this->otherEmail,
            'role' => 'editor',
        ]));

        $this->assertSame(403, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('ACCESS_DENIED', $response['responseMessage']);
    }

    public function testCannotAddNonExistentUser(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('POST', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => 'nonexistent_' . uniqid() . '@example.com',
            'role' => 'editor',
        ]));

        $this->assertSame(404, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('USER_NOT_FOUND', $response['responseMessage']);
    }

    public function testCannotAddDuplicateCollaborator(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        // Try to add editor again (already a collaborator)
        $client->request('POST', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $this->editorEmail,
            'role' => 'editor',
        ]));

        $this->assertSame(409, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('ALREADY_COLLABORATOR', $response['responseMessage']);
    }

    public function testAddCollaboratorRequiresEmail(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('POST', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'role' => 'editor',
        ]));

        $this->assertSame(400, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('EMAIL_REQUIRED', $response['responseMessage']);
    }

    public function testAddCollaboratorRejectsInvalidRole(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('POST', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $this->otherEmail,
            'role' => 'viewer',
        ]));

        $this->assertSame(400, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('INVALID_ROLE', $response['responseMessage']);
    }

    public function testOwnerCanRemoveCollaborator(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('DELETE', "/api/projects/{$this->projectId}/collaborators/{$this->editorId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
        $this->assertStringContainsString('removed', strtolower($response['message']));

        // Verify in database
        $em = $client->getContainer()->get('doctrine')->getManager();
        $project = $em->find(Project::class, $this->projectId);
        $editor = $em->find(User::class, $this->editorId);
        $collabRepo = $em->getRepository(ProjectCollaborator::class);
        $collaborator = $collabRepo->findCollaborator($project, $editor);

        $this->assertNull($collaborator, 'Collaborator should be removed from database');
    }

    public function testEditorCannotRemoveCollaborator(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->editorEmail, $this->editorPassword);

        $client->request('DELETE', "/api/projects/{$this->projectId}/collaborators/{$this->ownerId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(403, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('ACCESS_DENIED', $response['responseMessage']);
    }

    public function testCannotRemoveNonCollaborator(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('DELETE', "/api/projects/{$this->projectId}/collaborators/{$this->otherId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(404, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('NOT_A_COLLABORATOR', $response['responseMessage']);
    }

    public function testCannotRemoveLastOwner(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        // Try to remove the only owner
        $client->request('DELETE', "/api/projects/{$this->projectId}/collaborators/{$this->ownerId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(400, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('CANNOT_REMOVE_LAST_OWNER', $response['responseMessage']);

        // Verify owner still in database
        $em = $client->getContainer()->get('doctrine')->getManager();
        $project = $em->find(Project::class, $this->projectId);
        $owner = $em->find(User::class, $this->ownerId);
        $collabRepo = $em->getRepository(ProjectCollaborator::class);
        $collaborator = $collabRepo->findCollaborator($project, $owner);

        $this->assertNotNull($collaborator, 'Owner should still be in database');
    }

    public function testCanRemoveOwnerWhenMultipleOwnersExist(): void
    {
        $client = static::createClient();

        // First, add other user as owner
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);
        $client->request('POST', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $this->otherEmail,
            'role' => 'owner',
        ]));
        $this->assertSame(201, $client->getResponse()->getStatusCode());

        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        // Now we have 2 owners, should be able to remove one
        $client->request('DELETE', "/api/projects/{$this->projectId}/collaborators/{$this->ownerId}", [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
    }

    public function testGrantedByIsSetWhenAddingCollaborator(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('POST', "/api/projects/{$this->projectId}/collaborators", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([
            'email' => $this->otherEmail,
            'role' => 'editor',
        ]));

        $this->assertSame(201, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('grantedBy', $response['collaborator']);
        $this->assertNotNull($response['collaborator']['grantedBy']);
        $this->assertSame($this->ownerEmail, $response['collaborator']['grantedBy']['email']);
    }
}
