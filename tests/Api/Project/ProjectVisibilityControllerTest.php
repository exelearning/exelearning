<?php

declare(strict_types=1);

namespace App\Tests\Api\Project;

use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * API tests for PATCH /api/projects/{id}/visibility endpoint.
 *
 * Coverage:
 * - Owner can change visibility from private to public
 * - Owner can change visibility from public to private
 * - Editor cannot change visibility (403)
 * - Non-collaborator cannot change visibility (403)
 * - Invalid visibility value returns 400
 * - Empty/malformed request returns 400
 */
class ProjectVisibilityControllerTest extends WebTestCase
{
    private string $ownerEmail;
    private string $ownerPassword;
    private string $editorEmail;
    private string $editorPassword;
    private string $otherEmail;
    private string $otherPassword;
    private string $projectId;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create owner
        $owner = new User();
        $this->ownerEmail = 'owner_vis_' . uniqid() . '@example.com';
        $this->ownerPassword = 'OwnerPwd123!';
        $owner->setEmail($this->ownerEmail);
        $owner->setUserId('owner_' . uniqid());
        $owner->setPassword($hasher->hashPassword($owner, $this->ownerPassword));
        $owner->setIsLopdAccepted(true);
        $owner->setRoles(['ROLE_USER']);
        $em->persist($owner);

        // Create editor
        $editor = new User();
        $this->editorEmail = 'editor_vis_' . uniqid() . '@example.com';
        $this->editorPassword = 'EditorPwd123!';
        $editor->setEmail($this->editorEmail);
        $editor->setUserId('editor_' . uniqid());
        $editor->setPassword($hasher->hashPassword($editor, $this->editorPassword));
        $editor->setIsLopdAccepted(true);
        $editor->setRoles(['ROLE_USER']);
        $em->persist($editor);

        // Create other user (not a collaborator)
        $other = new User();
        $this->otherEmail = 'other_vis_' . uniqid() . '@example.com';
        $this->otherPassword = 'OtherPwd123!';
        $other->setEmail($this->otherEmail);
        $other->setUserId('other_' . uniqid());
        $other->setPassword($hasher->hashPassword($other, $this->otherPassword));
        $other->setIsLopdAccepted(true);
        $other->setRoles(['ROLE_USER']);
        $em->persist($other);

        $em->flush();

        // Create project
        $this->projectId = 'VIS_TEST_' . uniqid();
        $project = new Project();
        $project->setId($this->projectId);
        $project->setTitle('Visibility Test Project');
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

    public function testOwnerCanChangeVisibilityToPublic(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('PATCH', "/api/projects/{$this->projectId}/visibility", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['visibility' => 'public']));

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
        $this->assertArrayHasKey('project', $response);
        $this->assertSame('public', $response['project']['visibility']);
        $this->assertTrue($response['project']['isPublic']);

        // Verify in database
        $em = $client->getContainer()->get('doctrine')->getManager();
        $project = $em->find(Project::class, $this->projectId);
        $this->assertSame('public', $project->getVisibility());
        $this->assertTrue($project->isPublic());
    }

    public function testOwnerCanChangeVisibilityToPrivate(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        // First set to public
        $client->request('PATCH', "/api/projects/{$this->projectId}/visibility", [], [], [
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['visibility' => 'public']));
        $this->assertSame(200, $client->getResponse()->getStatusCode());

        // Then set back to private
        $client->request('PATCH', "/api/projects/{$this->projectId}/visibility", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['visibility' => 'private']));

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('private', $response['project']['visibility']);
        $this->assertFalse($response['project']['isPublic']);

        // Verify in database
        $em = $client->getContainer()->get('doctrine')->getManager();
        $project = $em->find(Project::class, $this->projectId);
        $this->assertSame('private', $project->getVisibility());
        $this->assertTrue($project->isPrivate());
    }

    public function testEditorCannotChangeVisibility(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->editorEmail, $this->editorPassword);

        $client->request('PATCH', "/api/projects/{$this->projectId}/visibility", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['visibility' => 'public']));

        $this->assertSame(403, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('ACCESS_DENIED', $response['responseMessage']);
        $this->assertStringContainsString('owner', strtolower($response['detail']));
    }

    public function testNonCollaboratorCannotChangeVisibility(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->otherEmail, $this->otherPassword);

        $client->request('PATCH', "/api/projects/{$this->projectId}/visibility", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['visibility' => 'public']));

        $this->assertSame(403, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('ACCESS_DENIED', $response['responseMessage']);
    }

    public function testInvalidVisibilityValueReturns400(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('PATCH', "/api/projects/{$this->projectId}/visibility", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['visibility' => 'invalid']));

        $this->assertSame(400, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('INVALID_VISIBILITY', $response['responseMessage']);
        $this->assertStringContainsString('public', $response['detail']);
        $this->assertStringContainsString('private', $response['detail']);
    }

    public function testEmptyVisibilityReturns400(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('PATCH', "/api/projects/{$this->projectId}/visibility", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['visibility' => '']));

        $this->assertSame(400, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('INVALID_VISIBILITY', $response['responseMessage']);
    }

    public function testMissingVisibilityFieldReturns400(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('PATCH', "/api/projects/{$this->projectId}/visibility", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode([]));

        $this->assertSame(400, $client->getResponse()->getStatusCode());
    }

    public function testMixedCaseVisibilityReturns400(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('PATCH', "/api/projects/{$this->projectId}/visibility", [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['visibility' => 'Public']));

        $this->assertSame(400, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('INVALID_VISIBILITY', $response['responseMessage']);
    }

    public function testNonExistentProjectReturns404(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->ownerEmail, $this->ownerPassword);

        $client->request('PATCH', '/api/projects/NONEXISTENT/visibility', [], [], [
            'HTTP_ACCEPT' => 'application/json',
            'CONTENT_TYPE' => 'application/json',
        ], json_encode(['visibility' => 'public']));

        $this->assertSame(404, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('PROJECT_NOT_FOUND', $response['responseMessage']);
    }
}
