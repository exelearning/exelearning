<?php

declare(strict_types=1);

namespace App\Tests\Integration\Project;

use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Doctrine\ORM\EntityManagerInterface;

/**
 * End-to-end integration test for ownership transfer workflow.
 *
 * Coverage:
 * - Complete ownership transfer from owner A to owner B
 * - Verify Project.owner is updated
 * - Verify old owner is demoted to editor
 * - Verify new owner has owner role
 * - Verify permissions after transfer
 * - Combined with visibility changes
 */
class OwnershipTransferFlowTest extends WebTestCase
{
    private EntityManagerInterface $em;
    private User $originalOwner;
    private User $newOwner;
    private User $editor;
    private Project $project;

    protected function setUp(): void
    {
        $client = static::createClient();
        $this->em = $client->getContainer()->get('doctrine')->getManager();
        $hasher = $client->getContainer()->get('security.user_password_hasher');

        // Create original owner
        $this->originalOwner = new User();
        $this->originalOwner->setEmail('original_owner_' . uniqid() . '@example.com');
        $this->originalOwner->setUserId('orig_owner_' . uniqid());
        $this->originalOwner->setPassword($hasher->hashPassword($this->originalOwner, 'password'));
        $this->originalOwner->setIsLopdAccepted(true);
        $this->em->persist($this->originalOwner);

        // Create new owner (will become owner)
        $this->newOwner = new User();
        $this->newOwner->setEmail('new_owner_' . uniqid() . '@example.com');
        $this->newOwner->setUserId('new_owner_' . uniqid());
        $this->newOwner->setPassword($hasher->hashPassword($this->newOwner, 'password'));
        $this->newOwner->setIsLopdAccepted(true);
        $this->em->persist($this->newOwner);

        // Create editor
        $this->editor = new User();
        $this->editor->setEmail('editor_' . uniqid() . '@example.com');
        $this->editor->setUserId('editor_' . uniqid());
        $this->editor->setPassword($hasher->hashPassword($this->editor, 'password'));
        $this->editor->setIsLopdAccepted(true);
        $this->em->persist($this->editor);

        // Create project
        $this->project = new Project();
        $this->project->setId('TRANSFER_TEST_' . uniqid());
        $this->project->setTitle('Ownership Transfer Test');
        $this->project->setOwner($this->originalOwner);
        $this->project->setVisibility('private');
        $this->em->persist($this->project);

        // Create collaborators
        $ownerCollab = new ProjectCollaborator();
        $ownerCollab->setProject($this->project);
        $ownerCollab->setUser($this->originalOwner);
        $ownerCollab->setRole(ProjectCollaborator::ROLE_OWNER);
        $ownerCollab->setGrantedBy($this->originalOwner);
        $this->em->persist($ownerCollab);

        $newOwnerCollab = new ProjectCollaborator();
        $newOwnerCollab->setProject($this->project);
        $newOwnerCollab->setUser($this->newOwner);
        $newOwnerCollab->setRole(ProjectCollaborator::ROLE_EDITOR);
        $newOwnerCollab->setGrantedBy($this->originalOwner);
        $this->em->persist($newOwnerCollab);

        $editorCollab = new ProjectCollaborator();
        $editorCollab->setProject($this->project);
        $editorCollab->setUser($this->editor);
        $editorCollab->setRole(ProjectCollaborator::ROLE_EDITOR);
        $editorCollab->setGrantedBy($this->originalOwner);
        $this->em->persist($editorCollab);

        $this->em->flush();
        static::ensureKernelShutdown();
    }

    public function testCompleteOwnershipTransferFlow(): void
    {
        // Phase 1: Verify initial state
        $client = static::createClient();
        $em = $client->getContainer()->get('doctrine')->getManager();
        $collabRepo = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $originalOwner = $em->find(User::class, $this->originalOwner->getId());
        $newOwner = $em->find(User::class, $this->newOwner->getId());

        $this->assertSame($originalOwner->getId(), $project->getOwner()->getId(), 'Original owner should own the project');
        $this->assertTrue($collabRepo->isOwner($project, $originalOwner), 'Original owner should have owner role');
        $this->assertFalse($collabRepo->isOwner($project, $newOwner), 'New owner should not have owner role yet');

        // Phase 2: Transfer ownership
        $project->setOwner($newOwner);

        $originalOwnerCollab = $collabRepo->findCollaborator($project, $originalOwner);
        $originalOwnerCollab->setRole(ProjectCollaborator::ROLE_EDITOR);

        $newOwnerCollab = $collabRepo->findCollaborator($project, $newOwner);
        $newOwnerCollab->setRole(ProjectCollaborator::ROLE_OWNER);

        $em->flush();
        $em->clear();

        // Phase 3: Verify post-transfer state
        $project = $em->find(Project::class, $this->project->getId());
        $originalOwner = $em->find(User::class, $this->originalOwner->getId());
        $newOwner = $em->find(User::class, $this->newOwner->getId());
        $editor = $em->find(User::class, $this->editor->getId());

        // Verify Project.owner is updated
        $this->assertSame($newOwner->getId(), $project->getOwner()->getId(), 'New owner should now own the project');

        // Verify collaborator roles
        $this->assertTrue($collabRepo->isOwner($project, $newOwner), 'New owner should have owner role');
        $this->assertFalse($collabRepo->isOwner($project, $originalOwner), 'Original owner should not have owner role');
        $this->assertSame(ProjectCollaborator::ROLE_EDITOR, $collabRepo->getUserRole($project, $originalOwner), 'Original owner should be editor');
        $this->assertSame(ProjectCollaborator::ROLE_EDITOR, $collabRepo->getUserRole($project, $editor), 'Editor role should remain unchanged');

        // Verify permissions
        $this->assertTrue($collabRepo->canEdit($project, $newOwner), 'New owner can edit');
        $this->assertTrue($collabRepo->canEdit($project, $originalOwner), 'Old owner (now editor) can edit');
        $this->assertTrue($collabRepo->canEdit($project, $editor), 'Editor can edit');

        static::ensureKernelShutdown();
    }

    public function testOwnershipTransferWithTwoOwners(): void
    {
        // Create a project with two owners initially
        $client = static::createClient();
        $em = $client->getContainer()->get('doctrine')->getManager();
        $collabRepo = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $originalOwner = $em->find(User::class, $this->originalOwner->getId());
        $newOwner = $em->find(User::class, $this->newOwner->getId());

        // Promote newOwner to owner (so we have 2 owners)
        $newOwnerCollab = $collabRepo->findCollaborator($project, $newOwner);
        $newOwnerCollab->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->flush();

        // Verify we have 2 owners
        $owners = $collabRepo->findOwners($project);
        $this->assertCount(2, $owners, 'Should have 2 owners');

        // Transfer Project.owner field to newOwner
        $project->setOwner($newOwner);
        $em->flush();
        $em->clear();

        // Verify transfer
        $project = $em->find(Project::class, $this->project->getId());
        $newOwner = $em->find(User::class, $this->newOwner->getId());
        $this->assertSame($newOwner->getId(), $project->getOwner()->getId());

        // Verify both still have owner role in collaborators
        $originalOwner = $em->find(User::class, $this->originalOwner->getId());
        $this->assertTrue($collabRepo->isOwner($project, $originalOwner), 'Original owner still has owner role');
        $this->assertTrue($collabRepo->isOwner($project, $newOwner), 'New owner has owner role');

        static::ensureKernelShutdown();
    }

    public function testOwnershipTransferCombinedWithVisibilityChange(): void
    {
        $client = static::createClient();
        $em = $client->getContainer()->get('doctrine')->getManager();
        $collabRepo = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $originalOwner = $em->find(User::class, $this->originalOwner->getId());
        $newOwner = $em->find(User::class, $this->newOwner->getId());

        // Verify initial state
        $this->assertSame('private', $project->getVisibility());
        $this->assertSame($originalOwner->getId(), $project->getOwner()->getId());

        // Transfer ownership AND change visibility
        $project->setOwner($newOwner);
        $project->setVisibility('public');

        $originalOwnerCollab = $collabRepo->findCollaborator($project, $originalOwner);
        $originalOwnerCollab->setRole(ProjectCollaborator::ROLE_EDITOR);

        $newOwnerCollab = $collabRepo->findCollaborator($project, $newOwner);
        $newOwnerCollab->setRole(ProjectCollaborator::ROLE_OWNER);

        $em->flush();
        $em->clear();

        // Verify both changes
        $project = $em->find(Project::class, $this->project->getId());
        $newOwner = $em->find(User::class, $this->newOwner->getId());

        $this->assertSame('public', $project->getVisibility(), 'Visibility should be public');
        $this->assertTrue($project->isPublic());
        $this->assertSame($newOwner->getId(), $project->getOwner()->getId(), 'New owner should own project');
        $this->assertTrue($collabRepo->isOwner($project, $newOwner), 'New owner should have owner role');

        static::ensureKernelShutdown();
    }

    public function testCollaboratorCountRemainsCorrectAfterTransfer(): void
    {
        $client = static::createClient();
        $em = $client->getContainer()->get('doctrine')->getManager();
        $collabRepo = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());

        $initialCount = $collabRepo->countCollaborators($project);
        $this->assertSame(3, $initialCount, 'Should start with 3 collaborators');

        // Transfer ownership (update roles)
        $originalOwner = $em->find(User::class, $this->originalOwner->getId());
        $newOwner = $em->find(User::class, $this->newOwner->getId());

        $project->setOwner($newOwner);

        $originalOwnerCollab = $collabRepo->findCollaborator($project, $originalOwner);
        $originalOwnerCollab->setRole(ProjectCollaborator::ROLE_EDITOR);

        $newOwnerCollab = $collabRepo->findCollaborator($project, $newOwner);
        $newOwnerCollab->setRole(ProjectCollaborator::ROLE_OWNER);

        $em->flush();

        $finalCount = $collabRepo->countCollaborators($project);
        $this->assertSame(3, $finalCount, 'Should still have 3 collaborators after transfer');

        static::ensureKernelShutdown();
    }

    public function testFindOwnersReflectsTransfer(): void
    {
        $client = static::createClient();
        $em = $client->getContainer()->get('doctrine')->getManager();
        $collabRepo = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $originalOwner = $em->find(User::class, $this->originalOwner->getId());
        $newOwner = $em->find(User::class, $this->newOwner->getId());

        // Verify initial owners
        $initialOwners = $collabRepo->findOwners($project);
        $this->assertCount(1, $initialOwners);
        $this->assertSame($originalOwner->getId(), $initialOwners[0]->getUser()->getId());

        // Transfer ownership
        $project->setOwner($newOwner);

        $originalOwnerCollab = $collabRepo->findCollaborator($project, $originalOwner);
        $originalOwnerCollab->setRole(ProjectCollaborator::ROLE_EDITOR);

        $newOwnerCollab = $collabRepo->findCollaborator($project, $newOwner);
        $newOwnerCollab->setRole(ProjectCollaborator::ROLE_OWNER);

        $em->flush();
        $em->clear();

        // Verify post-transfer owners
        $project = $em->find(Project::class, $this->project->getId());
        $newOwner = $em->find(User::class, $this->newOwner->getId());

        $finalOwners = $collabRepo->findOwners($project);
        $this->assertCount(1, $finalOwners);
        $this->assertSame($newOwner->getId(), $finalOwners[0]->getUser()->getId());

        static::ensureKernelShutdown();
    }
}
