<?php

namespace App\Tests\Functional\MultiUser;

use App\Entity\Project\OdeEditLock;
use App\Repository\Project\OdeEditLockRepository;
use App\Service\Project\OdeEditLockService;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

/**
 * Functional tests for the OdeEditLock system (pessimistic locking).
 * Tests multi-user collaborative editing scenarios.
 */
class OdeEditLockTest extends KernelTestCase
{
    private OdeEditLockRepository $lockRepository;
    private OdeEditLockService $lockService;

    protected function setUp(): void
    {
        self::bootKernel();

        $this->lockRepository = self::getContainer()->get(OdeEditLockRepository::class);
        $this->lockService = self::getContainer()->get(OdeEditLockService::class);

        // Clean up any existing locks before each test
        $this->lockRepository->createQueryBuilder('l')
            ->delete()
            ->getQuery()
            ->execute();
    }

    public function testUserCanAcquireLockOnFreeResource(): void
    {
        $sessionId = 'test_session_001';
        $resourceId = 'idevice_123';
        $userEmail = 'user1@example.com';

        $result = $this->lockService->acquireLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $userEmail
        );

        $this->assertTrue($result['success'], 'Lock should be acquired successfully');
        $this->assertInstanceOf(OdeEditLock::class, $result['lock']);
        $this->assertEquals($userEmail, $result['lockedBy']);
    }

    public function testSecondUserCannotAcquireSameLock(): void
    {
        $sessionId = 'test_session_002';
        $resourceId = 'idevice_456';
        $user1Email = 'user1@example.com';
        $user2Email = 'user2@example.com';

        // User 1 acquires lock
        $result1 = $this->lockService->acquireLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $user1Email
        );

        $this->assertTrue($result1['success'], 'User 1 should acquire lock');

        // User 2 tries to acquire same lock
        $result2 = $this->lockService->acquireLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $user2Email
        );

        $this->assertFalse($result2['success'], 'User 2 should NOT acquire lock');
        $this->assertEquals($user1Email, $result2['lockedBy'], 'Lock should be held by User 1');
    }

    public function testUserCanRefreshOwnLock(): void
    {
        $sessionId = 'test_session_003';
        $resourceId = 'idevice_789';
        $userEmail = 'user1@example.com';

        // Acquire lock first time
        $result1 = $this->lockService->acquireLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $userEmail
        );

        $this->assertTrue($result1['success']);
        $originalExpiresAt = $result1['lock']->getExpiresAt();

        // Wait a second
        sleep(1);

        // Acquire lock again (refresh)
        $result2 = $this->lockService->acquireLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $userEmail
        );

        $this->assertTrue($result2['success'], 'User should be able to refresh own lock');
        $newExpiresAt = $result2['lock']->getExpiresAt();

        $this->assertGreaterThan(
            $originalExpiresAt,
            $newExpiresAt,
            'Expiration time should be extended'
        );
    }

    public function testUserCanReleaseLock(): void
    {
        $sessionId = 'test_session_004';
        $resourceId = 'idevice_abc';
        $userEmail = 'user1@example.com';

        // Acquire lock
        $acquireResult = $this->lockService->acquireLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $userEmail
        );

        $this->assertTrue($acquireResult['success']);

        // Release lock
        $released = $this->lockService->releaseLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $userEmail
        );

        $this->assertTrue($released, 'Lock should be released successfully');

        // Verify lock is gone
        $checkResult = $this->lockService->checkLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $userEmail
        );

        $this->assertFalse($checkResult['isLocked'], 'Resource should no longer be locked');
        $this->assertTrue($checkResult['canEdit'], 'Resource should be editable');
    }

    public function testSecondUserCanAcquireLockAfterRelease(): void
    {
        $sessionId = 'test_session_005';
        $resourceId = 'idevice_def';
        $user1Email = 'user1@example.com';
        $user2Email = 'user2@example.com';

        // User 1 acquires lock
        $this->lockService->acquireLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $user1Email
        );

        // User 1 releases lock
        $this->lockService->releaseLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $user1Email
        );

        // User 2 can now acquire lock
        $result = $this->lockService->acquireLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $user2Email
        );

        $this->assertTrue($result['success'], 'User 2 should acquire lock after User 1 released it');
        $this->assertEquals($user2Email, $result['lockedBy']);
    }

    public function testReleaseAllLocksForUser(): void
    {
        $sessionId = 'test_session_006';
        $userEmail = 'user1@example.com';

        // User acquires multiple locks
        $this->lockService->acquireLock($sessionId, OdeEditLock::RESOURCE_TYPE_IDEVICE, 'idev1', $userEmail);
        $this->lockService->acquireLock($sessionId, OdeEditLock::RESOURCE_TYPE_IDEVICE, 'idev2', $userEmail);
        $this->lockService->acquireLock($sessionId, OdeEditLock::RESOURCE_TYPE_BLOCK, 'block1', $userEmail);

        // Verify locks exist
        $userLocks = $this->lockService->getUserLocks($sessionId, $userEmail);
        $this->assertCount(3, $userLocks, 'User should have 3 locks');

        // Release all locks
        $released = $this->lockService->releaseUserLocks($sessionId, $userEmail);
        $this->assertEquals(3, $released, 'Should release 3 locks');

        // Verify all locks are gone
        $userLocksAfter = $this->lockService->getUserLocks($sessionId, $userEmail);
        $this->assertCount(0, $userLocksAfter, 'User should have no locks after release');
    }

    public function testReleaseAllLocksInSession(): void
    {
        $sessionId = 'test_session_007';
        $user1Email = 'user1@example.com';
        $user2Email = 'user2@example.com';

        // Two users acquire locks in same session
        $this->lockService->acquireLock($sessionId, OdeEditLock::RESOURCE_TYPE_IDEVICE, 'idev1', $user1Email);
        $this->lockService->acquireLock($sessionId, OdeEditLock::RESOURCE_TYPE_IDEVICE, 'idev2', $user2Email);

        // Verify locks exist
        $sessionLocks = $this->lockService->getSessionLocks($sessionId);
        $this->assertCount(2, $sessionLocks, 'Session should have 2 locks');

        // Release all locks in session
        $released = $this->lockService->releaseSessionLocks($sessionId);
        $this->assertEquals(2, $released, 'Should release 2 locks');

        // Verify all locks are gone
        $sessionLocksAfter = $this->lockService->getSessionLocks($sessionId);
        $this->assertCount(0, $sessionLocksAfter, 'Session should have no locks after release');
    }

    public function testExpiredLocksAreAutomaticallyCleanedUp(): void
    {
        $sessionId = 'test_session_008';
        $resourceId = 'idevice_ghi';
        $userEmail = 'user1@example.com';

        // Create lock manually with expired time
        $expiredLock = new OdeEditLock();
        $expiredLock->setOdeSessionId($sessionId);
        $expiredLock->setResourceType(OdeEditLock::RESOURCE_TYPE_IDEVICE);
        $expiredLock->setResourceId($resourceId);
        $expiredLock->setLockedBy($userEmail);
        $expiredLock->setExpiresAt(new \DateTime('-1 hour')); // Expired 1 hour ago

        $em = self::getContainer()->get('doctrine')->getManager();
        $em->persist($expiredLock);
        $em->flush();

        // Check if locked (should automatically clean expired lock)
        $checkResult = $this->lockService->checkLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $userEmail
        );

        $this->assertFalse($checkResult['isLocked'], 'Expired lock should be automatically cleaned');
        $this->assertTrue($checkResult['canEdit'], 'Resource should be editable after expired lock cleanup');
    }

    public function testCleanupExpiredLocks(): void
    {
        $sessionId = 'test_session_009';

        // Create some active locks
        $this->lockService->acquireLock($sessionId, OdeEditLock::RESOURCE_TYPE_IDEVICE, 'active1', 'user1@example.com');

        // Create expired lock manually
        $expiredLock = new OdeEditLock();
        $expiredLock->setOdeSessionId($sessionId);
        $expiredLock->setResourceType(OdeEditLock::RESOURCE_TYPE_IDEVICE);
        $expiredLock->setResourceId('expired1');
        $expiredLock->setLockedBy('user2@example.com');
        $expiredLock->setExpiresAt(new \DateTime('-1 hour'));

        $em = self::getContainer()->get('doctrine')->getManager();
        $em->persist($expiredLock);
        $em->flush();

        // Run cleanup
        $cleaned = $this->lockService->cleanupExpiredLocks();

        $this->assertGreaterThanOrEqual(1, $cleaned, 'Should clean at least 1 expired lock');

        // Verify active lock still exists
        $checkResult = $this->lockService->checkLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            'active1',
            'user1@example.com'
        );

        $this->assertTrue($checkResult['isLocked'], 'Active lock should still exist');
        $this->assertTrue($checkResult['canEdit'], 'Owner should still be able to edit');
    }

    public function testDifferentResourceTypesCanBeLockedIndependently(): void
    {
        $sessionId = 'test_session_010';
        $resourceId = 'same_id';
        $userEmail = 'user1@example.com';

        // Acquire lock on iDevice
        $result1 = $this->lockService->acquireLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_IDEVICE,
            $resourceId,
            $userEmail
        );

        // Acquire lock on block with same ID
        $result2 = $this->lockService->acquireLock(
            $sessionId,
            OdeEditLock::RESOURCE_TYPE_BLOCK,
            $resourceId,
            $userEmail
        );

        // Both should succeed (different resource types)
        $this->assertTrue($result1['success'], 'iDevice lock should succeed');
        $this->assertTrue($result2['success'], 'Block lock should succeed');

        $userLocks = $this->lockService->getUserLocks($sessionId, $userEmail);
        $this->assertCount(2, $userLocks, 'User should have 2 locks (different types)');
    }
}
