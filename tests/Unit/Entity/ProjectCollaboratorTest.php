<?php

declare(strict_types=1);

namespace App\Tests\Unit\Entity;

use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use PHPUnit\Framework\TestCase;

/**
 * Unit tests for ProjectCollaborator entity business logic.
 *
 * Coverage:
 * - Role validation (only 'owner' or 'editor' allowed)
 * - isOwner()/isEditor() helpers
 * - Timestamp management (grantedAt)
 * - grantedBy relationship
 */
class ProjectCollaboratorTest extends TestCase
{
    private function createMockUser(int $id = 1): User
    {
        $user = $this->createMock(User::class);
        $user->method('getId')->willReturn($id);
        $user->method('getEmail')->willReturn("user{$id}@example.com");

        return $user;
    }

    private function createMockProject(): Project
    {
        $project = $this->createMock(Project::class);
        $project->method('getId')->willReturn('PROJ001');

        return $project;
    }

    public function testConstructorSetsGrantedAtAutomatically(): void
    {
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($this->createMockProject());
        $collaborator->setUser($this->createMockUser());
        $collaborator->setRole(ProjectCollaborator::ROLE_EDITOR);

        $this->assertInstanceOf(\DateTime::class, $collaborator->getGrantedAt());
        $this->assertEqualsWithDelta(time(), $collaborator->getGrantedAt()->getTimestamp(), 2);
    }

    public function testSetRoleToOwner(): void
    {
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($this->createMockProject());
        $collaborator->setUser($this->createMockUser());
        $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);

        $this->assertSame(ProjectCollaborator::ROLE_OWNER, $collaborator->getRole());
        $this->assertTrue($collaborator->isOwner());
        $this->assertFalse($collaborator->isEditor());
    }

    public function testSetRoleToEditor(): void
    {
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($this->createMockProject());
        $collaborator->setUser($this->createMockUser());
        $collaborator->setRole(ProjectCollaborator::ROLE_EDITOR);

        $this->assertSame(ProjectCollaborator::ROLE_EDITOR, $collaborator->getRole());
        $this->assertTrue($collaborator->isEditor());
        $this->assertFalse($collaborator->isOwner());
    }

    public function testSetRoleRejectsInvalidValue(): void
    {
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($this->createMockProject());
        $collaborator->setUser($this->createMockUser());

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Role must be either "owner" or "editor"');

        $collaborator->setRole('viewer');
    }

    public function testSetRoleRejectsEmptyString(): void
    {
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($this->createMockProject());
        $collaborator->setUser($this->createMockUser());

        $this->expectException(\InvalidArgumentException::class);

        $collaborator->setRole('');
    }

    public function testSetRoleRejectsMixedCase(): void
    {
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($this->createMockProject());
        $collaborator->setUser($this->createMockUser());

        $this->expectException(\InvalidArgumentException::class);

        $collaborator->setRole('Owner');
    }

    public function testRoleConstantsAreCorrect(): void
    {
        $this->assertSame('owner', ProjectCollaborator::ROLE_OWNER);
        $this->assertSame('editor', ProjectCollaborator::ROLE_EDITOR);
    }

    public function testSetAndGetProject(): void
    {
        $collaborator = new ProjectCollaborator();
        $project = $this->createMockProject();

        $collaborator->setProject($project);

        $this->assertSame($project, $collaborator->getProject());
    }

    public function testSetAndGetUser(): void
    {
        $collaborator = new ProjectCollaborator();
        $user = $this->createMockUser(42);

        $collaborator->setUser($user);

        $this->assertSame($user, $collaborator->getUser());
        $this->assertSame(42, $collaborator->getUser()->getId());
    }

    public function testSetAndGetGrantedBy(): void
    {
        $collaborator = new ProjectCollaborator();
        $grantor = $this->createMockUser(1);

        $collaborator->setGrantedBy($grantor);

        $this->assertSame($grantor, $collaborator->getGrantedBy());
    }

    public function testGrantedByCanBeNull(): void
    {
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($this->createMockProject());
        $collaborator->setUser($this->createMockUser());
        $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);

        // grantedBy is not set
        $this->assertNull($collaborator->getGrantedBy());

        // Can be explicitly set to null
        $collaborator->setGrantedBy($this->createMockUser());
        $collaborator->setGrantedBy(null);
        $this->assertNull($collaborator->getGrantedBy());
    }

    public function testGetIdReturnsNullBeforePersistence(): void
    {
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($this->createMockProject());
        $collaborator->setUser($this->createMockUser());
        $collaborator->setRole(ProjectCollaborator::ROLE_EDITOR);

        $this->assertNull($collaborator->getId());
    }

    public function testSwitchingRoleFromOwnerToEditor(): void
    {
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($this->createMockProject());
        $collaborator->setUser($this->createMockUser());
        $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);

        $this->assertTrue($collaborator->isOwner());

        $collaborator->setRole(ProjectCollaborator::ROLE_EDITOR);

        $this->assertTrue($collaborator->isEditor());
        $this->assertFalse($collaborator->isOwner());
    }

    public function testSwitchingRoleFromEditorToOwner(): void
    {
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($this->createMockProject());
        $collaborator->setUser($this->createMockUser());
        $collaborator->setRole(ProjectCollaborator::ROLE_EDITOR);

        $this->assertTrue($collaborator->isEditor());

        $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);

        $this->assertTrue($collaborator->isOwner());
        $this->assertFalse($collaborator->isEditor());
    }
}
