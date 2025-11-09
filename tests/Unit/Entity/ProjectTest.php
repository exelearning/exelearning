<?php

declare(strict_types=1);

namespace App\Tests\Unit\Entity;

use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for Project entity business logic.
 *
 * Coverage:
 * - Visibility validation (only 'public' or 'private' allowed)
 * - isPublic()/isPrivate() helpers
 * - Timestamp management (createdAt, lastAccessedAt)
 * - Default values
 */
class ProjectTest extends TestCase
{
    private function createMockUser(): User
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn(1);
        $user->method('getEmail')->willReturn('test@example.com');

        return $user;
    }

    public function testConstructorSetsCreatedAtAutomatically(): void
    {
        $project = new Project();
        $project->setId('TEST001');
        $project->setTitle('Test Project');
        $project->setOwner($this->createMockUser());

        $this->assertInstanceOf(\DateTime::class, $project->getCreatedAt());
        $this->assertEqualsWithDelta(time(), $project->getCreatedAt()->getTimestamp(), 2);
    }

    public function testDefaultVisibilityIsPrivate(): void
    {
        $project = new Project();
        $project->setId('TEST002');
        $project->setTitle('Test Project');
        $project->setOwner($this->createMockUser());

        $this->assertSame('private', $project->getVisibility());
        $this->assertTrue($project->isPrivate());
        $this->assertFalse($project->isPublic());
    }

    public function testDefaultIsArchivedIsFalse(): void
    {
        $project = new Project();
        $project->setId('TEST003');
        $project->setTitle('Test Project');
        $project->setOwner($this->createMockUser());

        $this->assertFalse($project->isArchived());
    }

    public function testSetVisibilityToPublic(): void
    {
        $project = new Project();
        $project->setId('TEST004');
        $project->setTitle('Test Project');
        $project->setOwner($this->createMockUser());

        $project->setVisibility('public');

        $this->assertSame('public', $project->getVisibility());
        $this->assertTrue($project->isPublic());
        $this->assertFalse($project->isPrivate());
    }

    public function testSetVisibilityToPrivate(): void
    {
        $project = new Project();
        $project->setId('TEST005');
        $project->setTitle('Test Project');
        $project->setOwner($this->createMockUser());

        $project->setVisibility('public');
        $project->setVisibility('private');

        $this->assertSame('private', $project->getVisibility());
        $this->assertTrue($project->isPrivate());
        $this->assertFalse($project->isPublic());
    }

    public function testSetVisibilityRejectsInvalidValue(): void
    {
        $project = new Project();
        $project->setId('TEST006');
        $project->setTitle('Test Project');
        $project->setOwner($this->createMockUser());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Visibility must be either "public" or "private"');

        $project->setVisibility('invalid');
    }

    public function testSetVisibilityRejectsEmptyString(): void
    {
        $project = new Project();
        $project->setId('TEST007');
        $project->setTitle('Test Project');
        $project->setOwner($this->createMockUser());

        $this->expectException(\InvalidArgumentException::class);

        $project->setVisibility('');
    }

    public function testSetVisibilityRejectsMixedCase(): void
    {
        $project = new Project();
        $project->setId('TEST008');
        $project->setTitle('Test Project');
        $project->setOwner($this->createMockUser());

        $this->expectException(\InvalidArgumentException::class);

        $project->setVisibility('Public');
    }

    public function testUpdateLastAccessedAt(): void
    {
        $project = new Project();
        $project->setId('TEST009');
        $project->setTitle('Test Project');
        $project->setOwner($this->createMockUser());

        $this->assertNull($project->getLastAccessedAt());

        $project->updateLastAccessedAt();

        $this->assertInstanceOf(\DateTime::class, $project->getLastAccessedAt());
        $this->assertEqualsWithDelta(time(), $project->getLastAccessedAt()->getTimestamp(), 2);
    }

    public function testUpdateLastAccessedAtUpdatesExistingTimestamp(): void
    {
        $project = new Project();
        $project->setId('TEST010');
        $project->setTitle('Test Project');
        $project->setOwner($this->createMockUser());

        $project->updateLastAccessedAt();
        $firstTimestamp = $project->getLastAccessedAt();

        sleep(1);
        $project->updateLastAccessedAt();
        $secondTimestamp = $project->getLastAccessedAt();

        $this->assertGreaterThan($firstTimestamp->getTimestamp(), $secondTimestamp->getTimestamp());
    }

    public function testSetAndGetId(): void
    {
        $project = new Project();
        $project->setId('CUSTOM_ID_123');
        $project->setTitle('Test Project');
        $project->setOwner($this->createMockUser());

        $this->assertSame('CUSTOM_ID_123', $project->getId());
    }

    public function testSetAndGetTitle(): void
    {
        $project = new Project();
        $project->setId('TEST011');
        $project->setTitle('My Custom Title');
        $project->setOwner($this->createMockUser());

        $this->assertSame('My Custom Title', $project->getTitle());
    }

    public function testSetAndGetOwner(): void
    {
        $project = new Project();
        $project->setId('TEST012');
        $project->setTitle('Test Project');

        $user = $this->createMockUser();
        $project->setOwner($user);

        $this->assertSame($user, $project->getOwner());
    }

    public function testSetAndGetIsArchived(): void
    {
        $project = new Project();
        $project->setId('TEST013');
        $project->setTitle('Test Project');
        $project->setOwner($this->createMockUser());

        $project->setArchived(true);
        $this->assertTrue($project->isArchived());

        $project->setArchived(false);
        $this->assertFalse($project->isArchived());
    }
}
