<?php

namespace App\Tests\Controller\Api;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Tests for CurrentOdeUsersApiController
 *
 * Verifies:
 * - Update/flag endpoint with null odeSessionId doesn't crash
 * - Update/flag endpoint works with valid odeSessionId
 * - publishOdeBlockStatusEvent handles null odeSessionId gracefully
 */
class CurrentOdeUsersApiControllerTest extends WebTestCase
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
        $this->userEmail = 'current_ode_test_'.uniqid().'@example.com';
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

    private function createSession(?string $odeId = null): array
    {
        $client = static::createClient();
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();

        $user = $em->getRepository(User::class)->findOneBy(['email' => $this->userEmail]);

        $odeId = $odeId ?? 'ODE'.uniqid();
        $odeVersionId = 'v'.uniqid();
        $odeSessionId = 'sess'.uniqid();

        // Create CurrentOdeUsers
        $currentOdeUser = new CurrentOdeUsers();
        $currentOdeUser->setOdeId($odeId);
        $currentOdeUser->setOdeVersionId($odeVersionId);
        $currentOdeUser->setOdeSessionId($odeSessionId);
        $currentOdeUser->setUser($user->getUserIdentifier());
        $currentOdeUser->setLastAction(new \DateTime());
        $currentOdeUser->setLastSync(new \DateTime());
        $currentOdeUser->setSyncSaveFlag(false);
        $currentOdeUser->setSyncNavStructureFlag(false);
        $currentOdeUser->setSyncPagStructureFlag(false);
        $currentOdeUser->setSyncComponentsFlag(false);
        $currentOdeUser->setSyncUpdateFlag(false);
        $currentOdeUser->setNodeIp('127.0.0.1');
        $em->persist($currentOdeUser);

        // Create Project
        $project = new Project();
        $project->setId($odeId);
        $project->setTitle('Test Update Flag Project');
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

        return [
            'odeId' => $odeId,
            'odeVersionId' => $odeVersionId,
            'odeSessionId' => $odeSessionId,
        ];
    }

    public function testUpdateFlagWithNullOdeSessionIdDoesNotCrash(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Try to update flag with null odeSessionId
        // This should NOT crash with 500 error (type error)
        $client->request('POST', '/api/current-ode-users-management/current-ode-user/current/ode/users/update/flag', [
            'odeSessionId' => null,
            'odeIdeviceId' => 'idev123',
            'blockId' => 'block123',
            'odePageId' => null,
            'destinationPageId' => null,
            'actionType' => 'edit',
            'odeComponentFlag' => null,
            'timeIdeviceEditing' => null,
            'pageId' => null,
        ]);

        // Should return 200 (not crash with 500)
        $statusCode = $client->getResponse()->getStatusCode();
        $this->assertSame(200, $statusCode, 'Should return 200, not crash with 500 due to null odeSessionId');

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertIsArray($response, 'Should return valid JSON response');
        $this->assertArrayHasKey('responseMessage', $response);
        $this->assertSame('OK', $response['responseMessage']);
    }

    public function testUpdateFlagWithValidOdeSessionIdWorksCorrectly(): void
    {
        $session = $this->createSession();

        $client = static::createClient();
        $this->loginClient($client);

        // Update flag with valid odeSessionId
        $client->request('POST', '/api/current-ode-users-management/current-ode-user/current/ode/users/update/flag', [
            'odeSessionId' => $session['odeSessionId'],
            'odeIdeviceId' => 'idev456',
            'blockId' => 'block456',
            'odePageId' => null,
            'destinationPageId' => null,
            'actionType' => 'update',
            'odeComponentFlag' => 'someFlag',
            'timeIdeviceEditing' => '1000',
            'pageId' => 'page1',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertIsArray($response);
        $this->assertArrayHasKey('responseMessage', $response);
        $this->assertSame('OK', $response['responseMessage']);
    }

    public function testUpdateFlagWithMinimalParametersDoesNotCrash(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Try to update flag with minimal parameters
        // Most parameters are optional, so this should work
        $client->request('POST', '/api/current-ode-users-management/current-ode-user/current/ode/users/update/flag', [
            'odeSessionId' => null,
            'actionType' => 'test',
        ]);

        // Should return 200 (not crash)
        $statusCode = $client->getResponse()->getStatusCode();
        $this->assertSame(200, $statusCode, 'Should handle minimal parameters without crashing');

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertIsArray($response);
        $this->assertArrayHasKey('responseMessage', $response);
    }

    public function testPublishOdeBlockStatusEventSkipsPublishWhenOdeSessionIdIsNull(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // This test verifies that the publishOdeBlockStatusEvent method
        // gracefully handles null odeSessionId by skipping the publish() call
        // without throwing a type error

        $client->request('POST', '/api/current-ode-users-management/current-ode-user/current/ode/users/update/flag', [
            'odeSessionId' => null,
            'odeIdeviceId' => 'idev789',
            'blockId' => 'block789',
            'actionType' => 'delete',
        ]);

        // Should return 200 (publish was skipped, not attempted with null)
        $statusCode = $client->getResponse()->getStatusCode();
        $this->assertSame(200, $statusCode, 'publishOdeBlockStatusEvent should skip publish when odeSessionId is null');

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertSame('OK', $response['responseMessage']);
    }

    public function testUpdateFlagWithPageSynchronization(): void
    {
        $session = $this->createSession();

        $client = static::createClient();
        $this->loginClient($client);

        // Test with odePagId (page synchronization case)
        $client->request('POST', '/api/current-ode-users-management/current-ode-user/current/ode/users/update/flag', [
            'odeSessionId' => $session['odeSessionId'],
            'odeIdeviceId' => null,
            'blockId' => null,
            'odePageId' => 'page123',  // When set, activates page sync
            'destinationPageId' => null,
            'actionType' => 'reloadNav',
            'odeComponentFlag' => null,
            'timeIdeviceEditing' => null,
            'pageId' => null,
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('responseMessage', $response);
        $this->assertSame('OK', $response['responseMessage']);
    }

    public function testUpdateFlagWithNullValuesDoesNotCauseTypeErrors(): void
    {
        $session = $this->createSession();

        $client = static::createClient();
        $this->loginClient($client);

        // Test with explicitly null values for all optional parameters
        // This verifies that the method signature correctly uses nullable types
        $client->request('POST', '/api/current-ode-users-management/current-ode-user/current/ode/users/update/flag', [
            'odeSessionId' => $session['odeSessionId'],
            'odeIdeviceId' => null,
            'blockId' => null,
            'odePageId' => null,
            'destinationPageId' => null,
            'actionType' => null,
            'odeComponentFlag' => null,
            'timeIdeviceEditing' => null,
            'pageId' => null,
        ]);

        // Should not throw type errors
        $this->assertSame(200, $client->getResponse()->getStatusCode());

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('responseMessage', $response);
    }

    public function testCreatesProjectEntityWhenCreatingCurrentOdeUsers(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Request to create new session (via getCurrentOdeUsersForUserAction)
        $client->request('GET', '/api/current-ode-users-management/current-ode-user/user/get', [], [], [
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $this->assertSame(200, $client->getResponse()->getStatusCode());
        $response = json_decode($client->getResponse()->getContent(), true);

        // Verify CurrentOdeUsers was created
        $this->assertArrayHasKey('currentOdeUsers', $response);
        $this->assertIsArray($response['currentOdeUsers']);
        $odeId = $response['currentOdeUsers']['odeId'];

        // Verify Project entity was also created
        $container = $client->getContainer();
        $em = $container->get('doctrine')->getManager();
        $projectRepo = $em->getRepository(\App\Entity\Project\Project::class);
        $project = $projectRepo->find($odeId);

        $this->assertNotNull($project, 'Project entity should be created when CurrentOdeUsers is created');
        $this->assertSame($odeId, $project->getId());
        $this->assertSame('New Project', $project->getTitle());
        $this->assertSame('private', $project->getVisibility());

        // Verify ProjectCollaborator was created
        $collaboratorRepo = $em->getRepository(\App\Entity\Project\ProjectCollaborator::class);
        $collaborators = $collaboratorRepo->findBy(['project' => $project]);

        $this->assertCount(1, $collaborators, 'Should have exactly one collaborator (owner)');
        $this->assertSame(\App\Entity\Project\ProjectCollaborator::ROLE_OWNER, $collaborators[0]->getRole());
    }
}
