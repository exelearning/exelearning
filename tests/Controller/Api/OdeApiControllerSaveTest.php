<?php

namespace App\Tests\Controller\Api;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

/**
 * Tests for OdeApiController save functionality
 *
 * Verifies:
 * - Manual save with valid odeSessionId works
 * - Save without odeSessionId returns error
 * - No crash when odeSessionId is null
 */
class OdeApiControllerSaveTest extends WebTestCase
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
        $this->userEmail = 'save_test_'.uniqid().'@example.com';
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
        $project->setTitle('Test Save Project');
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

    public function testManualSaveWithNullOdeSessionIdReturnsError(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Try to save without odeSessionId
        $client->request('POST', '/api/ode-management/odes/ode/save/manual', [
            'odeSessionId' => null, // Null session ID
        ]);

        // Should return 400 Bad Request
        $this->assertSame(400, $client->getResponse()->getStatusCode(), 'Should return 400 for missing odeSessionId');

        $response = json_decode($client->getResponse()->getContent(), true);

        // Should return specific error message
        $this->assertArrayHasKey('responseMessage', $response);
        $this->assertStringContainsString('odeSessionId is required', $response['responseMessage']);
        $this->assertArrayHasKey('detail', $response);
    }

    public function testManualSaveWithoutOdeSessionIdReturnsError(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // Try to save without odeSessionId parameter
        $client->request('POST', '/api/ode-management/odes/ode/save/manual');

        // Should return 400 Bad Request
        $this->assertSame(400, $client->getResponse()->getStatusCode(), 'Should return 400 for missing odeSessionId parameter');

        $response = json_decode($client->getResponse()->getContent(), true);

        // Should return specific error message
        $this->assertArrayHasKey('responseMessage', $response);
        $this->assertStringContainsString('odeSessionId is required', $response['responseMessage']);
    }

    public function testPublishIsNotCalledWhenOdeSessionIdIsNull(): void
    {
        $client = static::createClient();
        $this->loginClient($client);

        // This test verifies that the application doesn't crash
        // when publish() is skipped due to null odeSessionId
        $client->request('POST', '/api/ode-management/odes/ode/save/manual', [
            'odeSessionId' => null,
        ]);

        // Should return 400 Bad Request (not 500 crash)
        $statusCode = $client->getResponse()->getStatusCode();
        $this->assertSame(400, $statusCode, 'Should return 400 Bad Request, not crash with 500');

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertIsArray($response, 'Should return valid JSON response');
        $this->assertArrayHasKey('responseMessage', $response);
    }

    /**
     * Note: Testing successful save requires complex setup with XML structure,
     * properties, and file system. This is better suited for integration tests.
     * Here we focus on the error handling and null safety.
     */
    public function testSaveDoesNotCrashWithValidSession(): void
    {
        $session = $this->createSession();

        $client = static::createClient();
        $this->loginClient($client);

        // Try to save with valid odeSessionId
        // Note: This may fail with other errors (missing XML, properties, etc.)
        // but it should NOT crash with type error on odeSessionId
        $client->request('POST', '/api/ode-management/odes/ode/save/manual', [
            'odeSessionId' => $session['odeSessionId'],
        ]);

        $statusCode = $client->getResponse()->getStatusCode();

        // Should be 200 (even if save fails for other reasons)
        // What we're testing is that it doesn't crash with 500 due to type error
        $this->assertSame(200, $statusCode, 'Should not crash with 500 error');

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertIsArray($response);
        $this->assertArrayHasKey('responseMessage', $response);
    }

    public function testSaveWithFormDataWorks(): void
    {
        $session = $this->createSession();

        $client = static::createClient();
        $this->loginClient($client);

        // Send FormData like the frontend actually does (not JSON)
        // POST requests use FormData to avoid session cleanup issues that cause duplicate ODE components
        $client->request(
            'POST',
            '/api/ode-management/odes/ode/save/manual',
            [
                'odeSessionId' => $session['odeSessionId'],
                'odeVersion' => $session['odeVersionId'],
                'odeId' => $session['odeId'],
            ]
        );

        $statusCode = $client->getResponse()->getStatusCode();

        // Should be 200 (even if save fails for other reasons)
        // What we're testing is that it correctly reads FormData parameters
        $this->assertSame(200, $statusCode, 'Should accept FormData and not return 400');

        $response = json_decode($client->getResponse()->getContent(), true);
        $this->assertIsArray($response);
        $this->assertArrayHasKey('responseMessage', $response);

        // Should NOT return the "odeSessionId is required" error
        $this->assertNotEquals('error: odeSessionId is required for saving', $response['responseMessage']);
    }
}
