<?php

declare(strict_types=1);

namespace App\Tests\Unit\Service;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\User;
use App\Repository\net\exelearning\Repository\CurrentOdeUsersRepository;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersService;
use Doctrine\ORM\EntityManagerInterface;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\MockObject\MockObject;
use Psr\Log\LoggerInterface;

/**
 * Unit tests for CurrentOdeUsersService multi-user collaboration logic.
 *
 * Tests the session sharing functionality:
 * - getOrCreateSessionForProject() finds existing sessions correctly
 * - Uses findActiveSessionByOdeId() to locate the oldest (owner's) session
 * - Joins users to existing sessions instead of creating duplicates
 */
class CurrentOdeUsersServiceTest extends TestCase
{
    private CurrentOdeUsersService $service;
    private EntityManagerInterface|MockObject $entityManager;
    private CurrentOdeUsersRepository|MockObject $repository;
    private LoggerInterface|MockObject $logger;
    private User|MockObject $mockUser;

    protected function setUp(): void
    {
        $this->entityManager = $this->createMock(EntityManagerInterface::class);
        $this->repository = $this->createMock(CurrentOdeUsersRepository::class);
        $this->logger = $this->createMock(LoggerInterface::class);
        $this->mockUser = $this->createMock(User::class);

        $this->entityManager
            ->method('getRepository')
            ->willReturnCallback(function ($entityClass) {
                if ($entityClass === CurrentOdeUsers::class) {
                    return $this->repository;
                }
                return null;
            });

        $this->service = new CurrentOdeUsersService(
            $this->entityManager,
            $this->logger
        );
    }

    /**
     * Test: getOrCreateSessionForProject finds and joins existing session
     *
     * Scenario:
     * 1. User1 creates project and has active session
     * 2. User2 accesses same project via projectId
     * 3. Service should find User1's session (oldest one)
     * 4. Service should join User2 to User1's session
     * 5. Both users should share the same odeSessionId
     */
    public function testGetOrCreateSessionForProjectJoinsExistingSession(): void
    {
        $projectId = 'TEST_PROJECT_123';
        $ownerSessionId = 'SESSION_OWNER_456';
        $userEmail = 'newuser@example.com';
        $nodeIp = '192.168.1.100';

        // Mock user
        $user = $this->createMock(User::class);
        $user->method('getUserIdentifier')->willReturn($userEmail);

        // Mock owner's existing session
        $ownerSession = $this->createMock(CurrentOdeUsers::class);
        $ownerSession->method('getOdeSessionId')->willReturn($ownerSessionId);
        $ownerSession->method('getOdeId')->willReturn($projectId);
        $ownerSession->method('getOdeVersionId')->willReturn('VER_456');
        $ownerSession->method('getUser')->willReturn('owner@example.com');

        // CRITICAL: Verify findActiveSessionByOdeId is called (uses the fixed ordering)
        $this->repository
            ->expects($this->once())
            ->method('findActiveSessionByOdeId')
            ->with($projectId, 30)
            ->willReturn($ownerSession);

        // Verify user is NOT already in session
        // Note: isUserInSession is called twice - once in getOrCreateSessionForProject
        // and once inside joinExistingSession
        $this->repository
            ->expects($this->exactly(2))
            ->method('isUserInSession')
            ->with($ownerSessionId, $userEmail)
            ->willReturn(false);

        // Mock getUsersInSession to return active users
        $this->repository
            ->method('getUsersInSession')
            ->willReturn([$ownerSession]);

        // Expect new CurrentOdeUsers entity to be persisted
        $this->entityManager
            ->expects($this->once())
            ->method('persist')
            ->with($this->isInstanceOf(CurrentOdeUsers::class));

        $this->entityManager
            ->expects($this->once())
            ->method('flush');

        // Execute
        $result = $this->service->getOrCreateSessionForProject(
            $projectId,
            $user,
            $nodeIp
        );

        // Verify result
        $this->assertIsArray($result);
        $this->assertArrayHasKey('session', $result);
        $this->assertInstanceOf(CurrentOdeUsers::class, $result['session']);
        $this->assertArrayHasKey('isNewSession', $result);
        $this->assertFalse($result['isNewSession']);
        $this->assertArrayHasKey('usersInSession', $result);
    }

    /**
     * Test: getOrCreateSessionForProject creates new session when none exists
     *
     * Scenario:
     * 1. User accesses project via projectId
     * 2. No active session exists for this project
     * 3. Service should create new session for the user
     */
    public function testGetOrCreateSessionForProjectCreatesNewSessionWhenNoneExists(): void
    {
        $projectId = 'NEW_PROJECT_789';
        $userEmail = 'creator@example.com';
        $nodeIp = '192.168.1.200';

        // Mock user
        $user = $this->createMock(User::class);
        $user->method('getUserIdentifier')->willReturn($userEmail);

        // No active session found
        $this->repository
            ->expects($this->once())
            ->method('findActiveSessionByOdeId')
            ->with($projectId, 30)
            ->willReturn(null);

        // Expect CurrentOdeUsers entity to be persisted
        $this->entityManager
            ->expects($this->once())
            ->method('persist')
            ->with($this->isInstanceOf(CurrentOdeUsers::class));

        $this->entityManager
            ->expects($this->once())
            ->method('flush');

        // Execute
        $result = $this->service->getOrCreateSessionForProject(
            $projectId,
            $user,
            $nodeIp
        );

        // Verify result structure
        $this->assertIsArray($result);
        $this->assertArrayHasKey('session', $result);
        $this->assertInstanceOf(CurrentOdeUsers::class, $result['session']);
        $this->assertArrayHasKey('isNewSession', $result);
        $this->assertTrue($result['isNewSession']);
        $this->assertArrayHasKey('usersInSession', $result);
    }

    /**
     * Test: getOrCreateSessionForProject doesn't duplicate when user already in session
     *
     * Scenario:
     * 1. User1 is already in an active session
     * 2. User1 makes another request with same projectId (e.g., page refresh)
     * 3. Service should detect user is already in session
     * 4. Service should update lastAction and NOT create duplicate entry
     */
    public function testGetOrCreateSessionForProjectDoesNotDuplicateExistingUser(): void
    {
        $projectId = 'TEST_PROJECT_123';
        $sessionId = 'SESSION_456';
        $userEmail = 'user@example.com';
        $nodeIp = '192.168.1.100';

        // Mock user
        $user = $this->createMock(User::class);
        $user->method('getUserIdentifier')->willReturn($userEmail);

        // Mock existing session
        $existingSession = $this->createMock(CurrentOdeUsers::class);
        $existingSession->method('getOdeSessionId')->willReturn($sessionId);
        $existingSession->method('getOdeId')->willReturn($projectId);
        $existingSession->method('getOdeVersionId')->willReturn('VER_123');

        // Mock user's session
        $userSession = $this->createMock(CurrentOdeUsers::class);
        $userSession->method('getOdeSessionId')->willReturn($sessionId);
        $userSession->method('getOdeId')->willReturn($projectId);
        $userSession->expects($this->once())->method('setLastAction');

        $this->repository
            ->expects($this->once())
            ->method('findActiveSessionByOdeId')
            ->with($projectId, 30)
            ->willReturn($existingSession);

        // User is ALREADY in this session
        $this->repository
            ->expects($this->once())
            ->method('isUserInSession')
            ->with($sessionId, $userEmail)
            ->willReturn(true);

        // Get the user's session
        $this->repository
            ->expects($this->once())
            ->method('getCurrentSessionForUser')
            ->with($userEmail, $sessionId)
            ->willReturn($userSession);

        // Mock getUsersInSession
        $this->repository
            ->method('getUsersInSession')
            ->willReturn([$userSession]);

        // Should NOT persist a new entity (only flush to update lastAction)
        $this->entityManager
            ->expects($this->never())
            ->method('persist');

        // Should flush to update lastAction
        $this->entityManager
            ->expects($this->once())
            ->method('flush');

        // Execute
        $result = $this->service->getOrCreateSessionForProject(
            $projectId,
            $user,
            $nodeIp
        );

        // Verify result (should return existing session info)
        $this->assertIsArray($result);
        $this->assertArrayHasKey('session', $result);
        $this->assertSame($userSession, $result['session']);
        $this->assertArrayHasKey('isNewSession', $result);
        $this->assertFalse($result['isNewSession']);
        $this->assertArrayHasKey('usersInSession', $result);
    }

    /**
     * Test: Multiple users joining same project all get same session
     *
     * Scenario:
     * 1. User1 creates project (session1)
     * 2. User2 joins via projectId -> should get session1
     * 3. User3 joins via projectId -> should get session1
     * 4. All three users share the same odeSessionId
     */
    public function testMultipleUsersJoinSameSession(): void
    {
        $projectId = 'SHARED_PROJECT_999';
        $ownerSessionId = 'SESSION_OWNER_999';
        $nodeIp = '192.168.1.50';

        // Mock users
        $user2 = $this->createMock(User::class);
        $user2->method('getUserIdentifier')->willReturn('user2@example.com');

        $user3 = $this->createMock(User::class);
        $user3->method('getUserIdentifier')->willReturn('user3@example.com');

        // Mock owner's session
        $ownerSession = $this->createMock(CurrentOdeUsers::class);
        $ownerSession->method('getOdeSessionId')->willReturn($ownerSessionId);
        $ownerSession->method('getOdeId')->willReturn($projectId);
        $ownerSession->method('getOdeVersionId')->willReturn('VER_999');

        $this->repository
            ->method('findActiveSessionByOdeId')
            ->with($projectId, 30)
            ->willReturn($ownerSession);

        // Simulate User2 and User3 joining (not in session)
        // Note: isUserInSession is called twice per user (once in getOrCreateSessionForProject,
        // once inside joinExistingSession), so 4 calls total for 2 users
        $this->repository
            ->expects($this->exactly(4))
            ->method('isUserInSession')
            ->willReturnOnConsecutiveCalls(false, false, false, false);

        // Mock getUsersInSession
        $this->repository
            ->method('getUsersInSession')
            ->willReturn([$ownerSession]);

        $this->entityManager
            ->expects($this->exactly(2))
            ->method('persist');

        $this->entityManager
            ->expects($this->exactly(2))
            ->method('flush');

        // User2 joins
        $resultUser2 = $this->service->getOrCreateSessionForProject(
            $projectId,
            $user2,
            $nodeIp
        );

        // User3 joins
        $resultUser3 = $this->service->getOrCreateSessionForProject(
            $projectId,
            $user3,
            $nodeIp
        );

        // Both should get sessions and not be new sessions (they joined existing)
        $this->assertIsArray($resultUser2);
        $this->assertArrayHasKey('session', $resultUser2);
        $this->assertInstanceOf(CurrentOdeUsers::class, $resultUser2['session']);
        $this->assertFalse($resultUser2['isNewSession']);

        $this->assertIsArray($resultUser3);
        $this->assertArrayHasKey('session', $resultUser3);
        $this->assertInstanceOf(CurrentOdeUsers::class, $resultUser3['session']);
        $this->assertFalse($resultUser3['isNewSession']);
    }

    /**
     * Test: findActiveSessionByOdeId is called with correct parameters
     *
     * Verifies that the service uses the repository method that was fixed
     * to order by id ASC (oldest first) instead of lastAction DESC
     */
    public function testServiceUsesFixedRepositoryMethod(): void
    {
        $projectId = 'TEST_PROJECT_888';
        $userEmail = 'test@example.com';
        $nodeIp = '192.168.1.1';

        // Mock user
        $user = $this->createMock(User::class);
        $user->method('getUserIdentifier')->willReturn($userEmail);

        // CRITICAL VERIFICATION: Ensure findActiveSessionByOdeId is called
        // This method was fixed to use ORDER BY id ASC instead of ORDER BY lastAction DESC
        $this->repository
            ->expects($this->once())
            ->method('findActiveSessionByOdeId')
            ->with(
                $this->equalTo($projectId),
                $this->equalTo(30) // 30 minutes activity window
            )
            ->willReturn(null);

        $this->entityManager
            ->expects($this->once())
            ->method('persist');

        $this->entityManager
            ->expects($this->once())
            ->method('flush');

        // Execute
        $this->service->getOrCreateSessionForProject(
            $projectId,
            $user,
            $nodeIp
        );

        // Expectations verified by PHPUnit mock framework
    }
}
