<?php

declare(strict_types=1);

namespace App\Tests\Integration\Repository;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\User;
use App\Repository\net\exelearning\Repository\CurrentOdeUsersRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Integration tests for CurrentOdeUsersRepository.
 *
 * Tests the multi-user collaboration fix:
 * - findActiveSessionByOdeId() returns oldest session (not most recent)
 * - Users joining a project get the FIRST created session
 * - Session ordering by id ASC works correctly
 */
class CurrentOdeUsersRepositoryTest extends KernelTestCase
{
    private EntityManagerInterface $em;
    private CurrentOdeUsersRepository $repository;
    private User $user1;
    private User $user2;
    private string $testOdeId;

    protected function setUp(): void
    {
        self::bootKernel();
        $this->em = self::getContainer()->get('doctrine')->getManager();
        $this->repository = $this->em->getRepository(CurrentOdeUsers::class);

        // Create test users
        $hasher = self::getContainer()->get('security.user_password_hasher');

        $this->user1 = new User();
        $this->user1->setEmail('repo_test_owner_' . uniqid() . '@example.com');
        $this->user1->setUserId('owner_' . uniqid());
        $this->user1->setPassword($hasher->hashPassword($this->user1, 'password'));
        $this->user1->setIsLopdAccepted(true);
        $this->em->persist($this->user1);

        $this->user2 = new User();
        $this->user2->setEmail('repo_test_user2_' . uniqid() . '@example.com');
        $this->user2->setUserId('user2_' . uniqid());
        $this->user2->setPassword($hasher->hashPassword($this->user2, 'password'));
        $this->user2->setIsLopdAccepted(true);
        $this->em->persist($this->user2);

        $this->em->flush();
        $this->testOdeId = 'TEST_ODE_' . uniqid();

        self::ensureKernelShutdown();
    }

    /**
     * Test: findActiveSessionByOdeId returns oldest session when multiple active sessions exist
     *
     * Scenario:
     * 1. Create 3 sessions for same odeId (simulating owner + 2 users joining)
     * 2. First session created 20 min ago (owner's session - oldest by ID)
     * 3. Second session created 10 min ago (user joined later)
     * 4. Third session created 5 min ago (another user joined even later)
     * 5. Verify method returns the FIRST session (owner's), not most recent
     */
    public function testFindActiveSessionByOdeIdReturnsOldestSession(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repo = $em->getRepository(CurrentOdeUsers::class);
        $user1 = $em->find(User::class, $this->user1->getId());
        $user2 = $em->find(User::class, $this->user2->getId());

        $now = new \DateTime();

        // Session 1: Owner's session created first (20 minutes ago)
        $session1 = new CurrentOdeUsers();
        $session1->setOdeId($this->testOdeId);
        $session1->setOdeVersionId('VER_' . uniqid());
        $session1->setOdeSessionId('SESSION_OWNER_' . uniqid());
        $session1->setUser($user1->getUserIdentifier());
        $session1->setLastAction((clone $now)->modify('-20 minutes'));
        $session1->setLastSync((clone $now)->modify('-20 minutes'));
        $session1->setSyncSaveFlag(false);
        $session1->setSyncNavStructureFlag(false);
        $session1->setSyncPagStructureFlag(false);
        $session1->setSyncComponentsFlag(false);
        $session1->setSyncUpdateFlag(false);
        $session1->setNodeIp('192.168.1.1');
        $em->persist($session1);
        $em->flush(); // Flush to get ID 1

        // Sleep briefly to ensure different IDs
        usleep(1000);

        // Session 2: User2's old session (10 minutes ago, but MORE RECENT lastAction)
        $session2 = new CurrentOdeUsers();
        $session2->setOdeId($this->testOdeId);
        $session2->setOdeVersionId('VER_' . uniqid());
        $session2->setOdeSessionId('SESSION_USER2_' . uniqid());
        $session2->setUser($user2->getUserIdentifier());
        $session2->setLastAction((clone $now)->modify('-10 minutes')); // More recent!
        $session2->setLastSync((clone $now)->modify('-10 minutes'));
        $session2->setSyncSaveFlag(false);
        $session2->setSyncNavStructureFlag(false);
        $session2->setSyncPagStructureFlag(false);
        $session2->setSyncComponentsFlag(false);
        $session2->setSyncUpdateFlag(false);
        $session2->setNodeIp('192.168.1.2');
        $em->persist($session2);
        $em->flush(); // Flush to get ID 2

        usleep(1000);

        // Session 3: Another user's very recent session (5 minutes ago, MOST RECENT)
        $session3 = new CurrentOdeUsers();
        $session3->setOdeId($this->testOdeId);
        $session3->setOdeVersionId('VER_' . uniqid());
        $session3->setOdeSessionId('SESSION_USER3_' . uniqid());
        $session3->setUser('user3_' . uniqid() . '@example.com');
        $session3->setLastAction((clone $now)->modify('-5 minutes')); // MOST recent!
        $session3->setLastSync((clone $now)->modify('-5 minutes'));
        $session3->setSyncSaveFlag(false);
        $session3->setSyncNavStructureFlag(false);
        $session3->setSyncPagStructureFlag(false);
        $session3->setSyncComponentsFlag(false);
        $session3->setSyncUpdateFlag(false);
        $session3->setNodeIp('192.168.1.3');
        $em->persist($session3);
        $em->flush(); // Flush to get ID 3

        // CRITICAL TEST: Should return session1 (oldest by ID), NOT session3 (most recent by lastAction)
        $result = $repo->findActiveSessionByOdeId($this->testOdeId, 30);

        $this->assertNotNull($result, 'Should find an active session');
        $this->assertSame($session1->getId(), $result->getId(),
            'Should return the FIRST created session (owner session), not the most recent');
        $this->assertSame($session1->getOdeSessionId(), $result->getOdeSessionId(),
            'Should return owner\'s session ID');
        $this->assertSame($user1->getUserIdentifier(), $result->getUser(),
            'Should return owner\'s user identifier');

        // Verify it's NOT returning the most recent session
        $this->assertNotSame($session3->getId(), $result->getId(),
            'Should NOT return the most recently active session');

        self::ensureKernelShutdown();
    }

    /**
     * Test: findActiveSessionByOdeId returns null when no active sessions exist
     */
    public function testFindActiveSessionByOdeIdReturnsNullWhenNoActiveSessions(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repo = $em->getRepository(CurrentOdeUsers::class);

        $nonExistentOdeId = 'NONEXISTENT_' . uniqid();
        $result = $repo->findActiveSessionByOdeId($nonExistentOdeId, 30);

        $this->assertNull($result, 'Should return null when no sessions exist for odeId');

        self::ensureKernelShutdown();
    }

    /**
     * Test: findActiveSessionByOdeId respects activity timeout
     */
    public function testFindActiveSessionByOdeIdRespectsActivityTimeout(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repo = $em->getRepository(CurrentOdeUsers::class);
        $user1 = $em->find(User::class, $this->user1->getId());

        $now = new \DateTime();

        // Create session with activity 45 minutes ago (beyond 30-minute window)
        $oldSession = new CurrentOdeUsers();
        $oldSession->setOdeId($this->testOdeId);
        $oldSession->setOdeVersionId('VER_' . uniqid());
        $oldSession->setOdeSessionId('SESSION_OLD_' . uniqid());
        $oldSession->setUser($user1->getUserIdentifier());
        $oldSession->setLastAction((clone $now)->modify('-45 minutes')); // Too old
        $oldSession->setLastSync((clone $now)->modify('-45 minutes'));
        $oldSession->setSyncSaveFlag(false);
        $oldSession->setSyncNavStructureFlag(false);
        $oldSession->setSyncPagStructureFlag(false);
        $oldSession->setSyncComponentsFlag(false);
        $oldSession->setSyncUpdateFlag(false);
        $oldSession->setNodeIp('192.168.1.1');
        $em->persist($oldSession);
        $em->flush();

        // Should return null because session is beyond activity window
        $result = $repo->findActiveSessionByOdeId($this->testOdeId, 30);

        $this->assertNull($result, 'Should return null when session is beyond activity window');

        self::ensureKernelShutdown();
    }

    /**
     * Test: countActiveUsersInSession correctly counts distinct users
     */
    public function testCountActiveUsersInSessionCountsDistinctUsers(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repo = $em->getRepository(CurrentOdeUsers::class);
        $user1 = $em->find(User::class, $this->user1->getId());
        $user2 = $em->find(User::class, $this->user2->getId());

        $sharedSessionId = 'SHARED_SESSION_' . uniqid();
        $now = new \DateTime();

        // Add user1 to session
        $session1 = new CurrentOdeUsers();
        $session1->setOdeId($this->testOdeId);
        $session1->setOdeVersionId('VER_' . uniqid());
        $session1->setOdeSessionId($sharedSessionId);
        $session1->setUser($user1->getUserIdentifier());
        $session1->setLastAction($now);
        $session1->setLastSync($now);
        $session1->setSyncSaveFlag(false);
        $session1->setSyncNavStructureFlag(false);
        $session1->setSyncPagStructureFlag(false);
        $session1->setSyncComponentsFlag(false);
        $session1->setSyncUpdateFlag(false);
        $session1->setNodeIp('192.168.1.1');
        $em->persist($session1);

        // Add user2 to same session
        $session2 = new CurrentOdeUsers();
        $session2->setOdeId($this->testOdeId);
        $session2->setOdeVersionId('VER_' . uniqid());
        $session2->setOdeSessionId($sharedSessionId);
        $session2->setUser($user2->getUserIdentifier());
        $session2->setLastAction($now);
        $session2->setLastSync($now);
        $session2->setSyncSaveFlag(false);
        $session2->setSyncNavStructureFlag(false);
        $session2->setSyncPagStructureFlag(false);
        $session2->setSyncComponentsFlag(false);
        $session2->setSyncUpdateFlag(false);
        $session2->setNodeIp('192.168.1.2');
        $em->persist($session2);

        $em->flush();

        $count = $repo->countActiveUsersInSession($sharedSessionId, 30);

        $this->assertSame(2, $count, 'Should count 2 active users in session');

        self::ensureKernelShutdown();
    }

    /**
     * Test: isUserInSession correctly identifies user membership
     */
    public function testIsUserInSessionIdentifiesUserMembership(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repo = $em->getRepository(CurrentOdeUsers::class);
        $user1 = $em->find(User::class, $this->user1->getId());
        $user2 = $em->find(User::class, $this->user2->getId());

        $sessionId = 'TEST_SESSION_' . uniqid();

        // Add only user1 to session
        $session = new CurrentOdeUsers();
        $session->setOdeId($this->testOdeId);
        $session->setOdeVersionId('VER_' . uniqid());
        $session->setOdeSessionId($sessionId);
        $session->setUser($user1->getUserIdentifier());
        $session->setLastAction(new \DateTime());
        $session->setLastSync(new \DateTime());
        $session->setSyncSaveFlag(false);
        $session->setSyncNavStructureFlag(false);
        $session->setSyncPagStructureFlag(false);
        $session->setSyncComponentsFlag(false);
        $session->setSyncUpdateFlag(false);
        $session->setNodeIp('192.168.1.1');
        $em->persist($session);
        $em->flush();

        $this->assertTrue($repo->isUserInSession($sessionId, $user1->getUserIdentifier()),
            'Should return true for user in session');
        $this->assertFalse($repo->isUserInSession($sessionId, $user2->getUserIdentifier()),
            'Should return false for user not in session');

        self::ensureKernelShutdown();
    }
}
