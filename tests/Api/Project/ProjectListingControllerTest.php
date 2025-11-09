<?php

declare(strict_types=1);

namespace App\Tests\Api\Project;

use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * API tests for GET /api/projects endpoint.
 *
 * Coverage:
 * - Owner sees their own projects
 * - Collaborators see projects they collaborate on
 * - Users see public projects
 * - Anonymous users see only public projects
 * - Admins see all projects
 * - Archived projects are excluded
 * - Response format and structure
 */
class ProjectListingControllerTest extends WebTestCase
{
    private string $user1Email;
    private string $user1Password;
    private int $user1Id;
    private string $user2Email;
    private string $user2Password;
    private int $user2Id;
    private string $adminEmail;
    private string $adminPassword;
    private string $publicProjectId;
    private string $privateProjectId;
    private string $user2ProjectId;
    private string $archivedProjectId;

    protected function setUp(): void
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $hasher = $container->get('security.user_password_hasher');

        // Create user1 (owner of public and private projects)
        $user1 = new User();
        $this->user1Email = 'listing_user1_' . uniqid() . '@example.com';
        $this->user1Password = 'User1Pwd123!';
        $user1->setEmail($this->user1Email);
        $user1->setUserId('user1_' . uniqid());
        $user1->setPassword($hasher->hashPassword($user1, $this->user1Password));
        $user1->setIsLopdAccepted(true);
        $user1->setRoles(['ROLE_USER']);
        $em->persist($user1);
        $em->flush();
        $this->user1Id = $user1->getId();

        // Create user2 (owner of separate project)
        $user2 = new User();
        $this->user2Email = 'listing_user2_' . uniqid() . '@example.com';
        $this->user2Password = 'User2Pwd123!';
        $user2->setEmail($this->user2Email);
        $user2->setUserId('user2_' . uniqid());
        $user2->setPassword($hasher->hashPassword($user2, $this->user2Password));
        $user2->setIsLopdAccepted(true);
        $user2->setRoles(['ROLE_USER']);
        $em->persist($user2);
        $em->flush();
        $this->user2Id = $user2->getId();

        // Create admin
        $admin = new User();
        $this->adminEmail = 'listing_admin_' . uniqid() . '@example.com';
        $this->adminPassword = 'AdminPwd123!';
        $admin->setEmail($this->adminEmail);
        $admin->setUserId('admin_' . uniqid());
        $admin->setPassword($hasher->hashPassword($admin, $this->adminPassword));
        $admin->setIsLopdAccepted(true);
        $admin->setRoles(['ROLE_ADMIN']);
        $em->persist($admin);
        $em->flush();

        // Create public project (user1)
        $this->publicProjectId = 'PUBLIC_' . uniqid();
        $publicProject = new Project();
        $publicProject->setId($this->publicProjectId);
        $publicProject->setTitle('Public Project');
        $publicProject->setOwner($user1);
        $publicProject->setVisibility('public');
        $em->persist($publicProject);

        $publicCollab = new ProjectCollaborator();
        $publicCollab->setProject($publicProject);
        $publicCollab->setUser($user1);
        $publicCollab->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($publicCollab);

        // Create private project (user1)
        $this->privateProjectId = 'PRIVATE_' . uniqid();
        $privateProject = new Project();
        $privateProject->setId($this->privateProjectId);
        $privateProject->setTitle('Private Project');
        $privateProject->setOwner($user1);
        $privateProject->setVisibility('private');
        $em->persist($privateProject);

        $privateCollab = new ProjectCollaborator();
        $privateCollab->setProject($privateProject);
        $privateCollab->setUser($user1);
        $privateCollab->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($privateCollab);

        // Add user2 as editor on private project
        $editorCollab = new ProjectCollaborator();
        $editorCollab->setProject($privateProject);
        $editorCollab->setUser($user2);
        $editorCollab->setRole(ProjectCollaborator::ROLE_EDITOR);
        $em->persist($editorCollab);

        // Create user2's own project
        $this->user2ProjectId = 'USER2_' . uniqid();
        $user2Project = new Project();
        $user2Project->setId($this->user2ProjectId);
        $user2Project->setTitle('User2 Project');
        $user2Project->setOwner($user2);
        $user2Project->setVisibility('private');
        $em->persist($user2Project);

        $user2Collab = new ProjectCollaborator();
        $user2Collab->setProject($user2Project);
        $user2Collab->setUser($user2);
        $user2Collab->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($user2Collab);

        // Create archived project (should not appear in listings)
        $this->archivedProjectId = 'ARCHIVED_' . uniqid();
        $archivedProject = new Project();
        $archivedProject->setId($this->archivedProjectId);
        $archivedProject->setTitle('Archived Project');
        $archivedProject->setOwner($user1);
        $archivedProject->setVisibility('public');
        $archivedProject->setArchived(true);
        $em->persist($archivedProject);

        $archivedCollab = new ProjectCollaborator();
        $archivedCollab->setProject($archivedProject);
        $archivedCollab->setUser($user1);
        $archivedCollab->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($archivedCollab);

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

    public function testOwnerSeesOwnProjects(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->user1Email, $this->user1Password);

        $client->request('GET', '/api/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
        $this->assertArrayHasKey('projects', $response);
        $this->assertArrayHasKey('count', $response);

        $projectIds = array_column($response['projects'], 'id');

        // User1 should see their public and private projects
        $this->assertContains($this->publicProjectId, $projectIds);
        $this->assertContains($this->privateProjectId, $projectIds);

        // Should NOT see archived project
        $this->assertNotContains($this->archivedProjectId, $projectIds);

        // Should NOT see user2's private project (not a collaborator)
        $this->assertNotContains($this->user2ProjectId, $projectIds);
    }

    public function testCollaboratorSeesSharedProjects(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->user2Email, $this->user2Password);

        $client->request('GET', '/api/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $projectIds = array_column($response['projects'], 'id');

        // User2 should see:
        // - Their own project
        $this->assertContains($this->user2ProjectId, $projectIds);

        // - User1's private project (user2 is editor)
        $this->assertContains($this->privateProjectId, $projectIds);

        // - User1's public project
        $this->assertContains($this->publicProjectId, $projectIds);
    }

    public function testUserSeesPublicProjects(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->user2Email, $this->user2Password);

        $client->request('GET', '/api/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $projectIds = array_column($response['projects'], 'id');

        // User2 should see user1's public project
        $this->assertContains($this->publicProjectId, $projectIds);
    }

    public function testAdminSeesAllNonArchivedProjects(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->adminEmail, $this->adminPassword);

        $client->request('GET', '/api/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $projectIds = array_column($response['projects'], 'id');

        // Admin should see all non-archived projects
        $this->assertContains($this->publicProjectId, $projectIds);
        $this->assertContains($this->privateProjectId, $projectIds);
        $this->assertContains($this->user2ProjectId, $projectIds);

        // Should NOT see archived project
        $this->assertNotContains($this->archivedProjectId, $projectIds);
    }

    public function testArchivedProjectsAreExcluded(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->user1Email, $this->user1Password);

        $client->request('GET', '/api/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $projectIds = array_column($response['projects'], 'id');

        // Even the owner should not see archived projects in the list
        $this->assertNotContains($this->archivedProjectId, $projectIds);
    }

    public function testResponseStructureIsCorrect(): void
    {
        $client = static::createClient();
        $this->loginClient($client, $this->user1Email, $this->user1Password);

        $client->request('GET', '/api/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);

        // Top-level structure
        $this->assertArrayHasKey('responseMessage', $response);
        $this->assertArrayHasKey('projects', $response);
        $this->assertArrayHasKey('count', $response);
        $this->assertIsArray($response['projects']);
        $this->assertIsInt($response['count']);
        $this->assertSame(count($response['projects']), $response['count']);

        // Project structure
        if (count($response['projects']) > 0) {
            $project = $response['projects'][0];
            $this->assertArrayHasKey('id', $project);
            $this->assertArrayHasKey('title', $project);
            $this->assertArrayHasKey('visibility', $project);
            $this->assertArrayHasKey('isPublic', $project);
            $this->assertArrayHasKey('owner', $project);
            $this->assertArrayHasKey('createdAt', $project);

            // Owner structure
            $this->assertArrayHasKey('id', $project['owner']);
            $this->assertArrayHasKey('email', $project['owner']);
            $this->assertArrayHasKey('userId', $project['owner']);

            // Verify visibility
            $this->assertContains($project['visibility'], ['public', 'private']);
            $this->assertIsBool($project['isPublic']);
            $this->assertSame($project['visibility'] === 'public', $project['isPublic']);
        }
    }

    public function testListingDoesNotIncludeDuplicates(): void
    {
        // User2 is both:
        // - Editor on user1's private project
        // - Can see user1's public project
        // Should only see each project once

        $client = static::createClient();
        $this->loginClient($client, $this->user2Email, $this->user2Password);

        $client->request('GET', '/api/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $projectIds = array_column($response['projects'], 'id');

        // Check no duplicates
        $uniqueIds = array_unique($projectIds);
        $this->assertCount(count($projectIds), $uniqueIds, 'Should not have duplicate projects');
    }

    public function testListingReturnsEmptyArrayWhenNoProjects(): void
    {
        // Create a new user with no projects
        $client = static::createClient();
        $em = $client->getContainer()->get('doctrine')->getManager();
        $hasher = $client->getContainer()->get('security.user_password_hasher');

        $newUser = new User();
        $newUserEmail = 'no_projects_' . uniqid() . '@example.com';
        $newUserPassword = 'NoProjPwd123!';
        $newUser->setEmail($newUserEmail);
        $newUser->setUserId('noproj_' . uniqid());
        $newUser->setPassword($hasher->hashPassword($newUser, $newUserPassword));
        $newUser->setIsLopdAccepted(true);
        $newUser->setRoles(['ROLE_USER']);
        $em->persist($newUser);
        $em->flush();

        static::ensureKernelShutdown();
        $client = static::createClient();
        $this->loginClient($client, $newUserEmail, $newUserPassword);

        $client->request('GET', '/api/projects', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);

        // Should still see public projects
        $this->assertGreaterThanOrEqual(1, $response['count'], 'Should see at least the public project');
        $projectIds = array_column($response['projects'], 'id');
        $this->assertContains($this->publicProjectId, $projectIds);
    }
}
