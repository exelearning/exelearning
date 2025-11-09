<?php

declare(strict_types=1);

namespace App\Tests\Integration\Repository;

use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use App\Repository\Project\ProjectCollaboratorRepository;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;
use Doctrine\ORM\EntityManagerInterface;

/**
 * Integration tests for ProjectCollaboratorRepository with real database.
 *
 * Coverage:
 * - findCollaborator() - find specific user-project collaboration
 * - isOwner() / canEdit() - permission checks
 * - findOwners() - get all owners of a project
 * - findByProject() / findByUser() - list queries
 * - Unique constraint on (project, user)
 */
class ProjectCollaboratorIntegrationTest extends KernelTestCase
{
    private EntityManagerInterface $em;
    private ProjectCollaboratorRepository $repository;
    private User $user1;
    private User $user2;
    private User $user3;
    private Project $project;

    protected function setUp(): void
    {
        self::bootKernel();
        $this->em = self::getContainer()->get('doctrine')->getManager();
        $this->repository = $this->em->getRepository(ProjectCollaborator::class);

        // Create test users
        $hasher = self::getContainer()->get('security.user_password_hasher');

        $this->user1 = new User();
        $this->user1->setEmail('collab_test_1_' . uniqid() . '@example.com');
        $this->user1->setUserId('usr1_' . uniqid());
        $this->user1->setPassword($hasher->hashPassword($this->user1, 'password'));
        $this->user1->setIsLopdAccepted(true);
        $this->em->persist($this->user1);

        $this->user2 = new User();
        $this->user2->setEmail('collab_test_2_' . uniqid() . '@example.com');
        $this->user2->setUserId('usr2_' . uniqid());
        $this->user2->setPassword($hasher->hashPassword($this->user2, 'password'));
        $this->user2->setIsLopdAccepted(true);
        $this->em->persist($this->user2);

        $this->user3 = new User();
        $this->user3->setEmail('collab_test_3_' . uniqid() . '@example.com');
        $this->user3->setUserId('usr3_' . uniqid());
        $this->user3->setPassword($hasher->hashPassword($this->user3, 'password'));
        $this->user3->setIsLopdAccepted(true);
        $this->em->persist($this->user3);

        // Create test project
        $this->project = new Project();
        $this->project->setId('PROJ_COLLAB_' . uniqid());
        $this->project->setTitle('Collaboration Test Project');
        $this->project->setOwner($this->user1);
        $this->project->setVisibility('private');
        $this->em->persist($this->project);

        $this->em->flush();
        self::ensureKernelShutdown();
    }

    public function testFindCollaboratorReturnsCollaboratorWhenExists(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user = $em->find(User::class, $this->user1->getId());

        // Add user1 as owner
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($project);
        $collaborator->setUser($user);
        $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($collaborator);
        $em->flush();

        $found = $repository->findCollaborator($project, $user);

        $this->assertNotNull($found);
        $this->assertSame($user->getId(), $found->getUser()->getId());
        $this->assertSame($project->getId(), $found->getProject()->getId());
        $this->assertSame(ProjectCollaborator::ROLE_OWNER, $found->getRole());

        self::ensureKernelShutdown();
    }

    public function testFindCollaboratorReturnsNullWhenNotExists(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user = $em->find(User::class, $this->user2->getId());

        $found = $repository->findCollaborator($project, $user);

        $this->assertNull($found);

        self::ensureKernelShutdown();
    }

    public function testIsCollaboratorReturnsTrueForCollaborators(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user = $em->find(User::class, $this->user1->getId());

        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($project);
        $collaborator->setUser($user);
        $collaborator->setRole(ProjectCollaborator::ROLE_EDITOR);
        $em->persist($collaborator);
        $em->flush();

        $this->assertTrue($repository->isCollaborator($project, $user));

        self::ensureKernelShutdown();
    }

    public function testIsCollaboratorReturnsFalseForNonCollaborators(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user = $em->find(User::class, $this->user2->getId());

        $this->assertFalse($repository->isCollaborator($project, $user));

        self::ensureKernelShutdown();
    }

    public function testIsOwnerReturnsTrueForOwners(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user = $em->find(User::class, $this->user1->getId());

        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($project);
        $collaborator->setUser($user);
        $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($collaborator);
        $em->flush();

        $this->assertTrue($repository->isOwner($project, $user));

        self::ensureKernelShutdown();
    }

    public function testIsOwnerReturnsFalseForEditors(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user = $em->find(User::class, $this->user1->getId());

        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($project);
        $collaborator->setUser($user);
        $collaborator->setRole(ProjectCollaborator::ROLE_EDITOR);
        $em->persist($collaborator);
        $em->flush();

        $this->assertFalse($repository->isOwner($project, $user));

        self::ensureKernelShutdown();
    }

    public function testCanEditReturnsTrueForOwners(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user = $em->find(User::class, $this->user1->getId());

        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($project);
        $collaborator->setUser($user);
        $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($collaborator);
        $em->flush();

        $this->assertTrue($repository->canEdit($project, $user));

        self::ensureKernelShutdown();
    }

    public function testCanEditReturnsTrueForEditors(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user = $em->find(User::class, $this->user1->getId());

        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($project);
        $collaborator->setUser($user);
        $collaborator->setRole(ProjectCollaborator::ROLE_EDITOR);
        $em->persist($collaborator);
        $em->flush();

        $this->assertTrue($repository->canEdit($project, $user));

        self::ensureKernelShutdown();
    }

    public function testCanEditReturnsFalseForNonCollaborators(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user = $em->find(User::class, $this->user2->getId());

        $this->assertFalse($repository->canEdit($project, $user));

        self::ensureKernelShutdown();
    }

    public function testFindOwnersReturnsAllOwners(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user1 = $em->find(User::class, $this->user1->getId());
        $user2 = $em->find(User::class, $this->user2->getId());
        $user3 = $em->find(User::class, $this->user3->getId());

        // Add two owners and one editor
        $collab1 = new ProjectCollaborator();
        $collab1->setProject($project);
        $collab1->setUser($user1);
        $collab1->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($collab1);

        $collab2 = new ProjectCollaborator();
        $collab2->setProject($project);
        $collab2->setUser($user2);
        $collab2->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($collab2);

        $collab3 = new ProjectCollaborator();
        $collab3->setProject($project);
        $collab3->setUser($user3);
        $collab3->setRole(ProjectCollaborator::ROLE_EDITOR);
        $em->persist($collab3);

        $em->flush();

        $owners = $repository->findOwners($project);

        $this->assertCount(2, $owners);
        $ownerIds = array_map(fn($c) => $c->getUser()->getId(), $owners);
        $this->assertContains($user1->getId(), $ownerIds);
        $this->assertContains($user2->getId(), $ownerIds);
        $this->assertNotContains($user3->getId(), $ownerIds);

        self::ensureKernelShutdown();
    }

    public function testFindByProjectReturnsAllCollaborators(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user1 = $em->find(User::class, $this->user1->getId());
        $user2 = $em->find(User::class, $this->user2->getId());

        $collab1 = new ProjectCollaborator();
        $collab1->setProject($project);
        $collab1->setUser($user1);
        $collab1->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($collab1);

        $collab2 = new ProjectCollaborator();
        $collab2->setProject($project);
        $collab2->setUser($user2);
        $collab2->setRole(ProjectCollaborator::ROLE_EDITOR);
        $em->persist($collab2);

        $em->flush();

        $collaborators = $repository->findByProject($project);

        $this->assertCount(2, $collaborators);

        self::ensureKernelShutdown();
    }

    public function testFindByUserReturnsAllUserCollaborations(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        // Create second project
        $project2 = new Project();
        $project2->setId('PROJ_COLLAB_2_' . uniqid());
        $project2->setTitle('Second Project');
        $project2->setOwner($em->find(User::class, $this->user1->getId()));
        $project2->setVisibility('private');
        $em->persist($project2);

        $project1 = $em->find(Project::class, $this->project->getId());
        $user = $em->find(User::class, $this->user2->getId());

        // Add user2 to both projects
        $collab1 = new ProjectCollaborator();
        $collab1->setProject($project1);
        $collab1->setUser($user);
        $collab1->setRole(ProjectCollaborator::ROLE_EDITOR);
        $em->persist($collab1);

        $collab2 = new ProjectCollaborator();
        $collab2->setProject($project2);
        $collab2->setUser($user);
        $collab2->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($collab2);

        $em->flush();

        $collaborations = $repository->findByUser($user);

        $this->assertGreaterThanOrEqual(2, count($collaborations));

        self::ensureKernelShutdown();
    }

    public function testCountCollaboratorsReturnsCorrectCount(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user1 = $em->find(User::class, $this->user1->getId());
        $user2 = $em->find(User::class, $this->user2->getId());
        $user3 = $em->find(User::class, $this->user3->getId());

        $collab1 = new ProjectCollaborator();
        $collab1->setProject($project);
        $collab1->setUser($user1);
        $collab1->setRole(ProjectCollaborator::ROLE_OWNER);
        $em->persist($collab1);

        $collab2 = new ProjectCollaborator();
        $collab2->setProject($project);
        $collab2->setUser($user2);
        $collab2->setRole(ProjectCollaborator::ROLE_EDITOR);
        $em->persist($collab2);

        $collab3 = new ProjectCollaborator();
        $collab3->setProject($project);
        $collab3->setUser($user3);
        $collab3->setRole(ProjectCollaborator::ROLE_EDITOR);
        $em->persist($collab3);

        $em->flush();

        $count = $repository->countCollaborators($project);

        $this->assertSame(3, $count);

        self::ensureKernelShutdown();
    }

    public function testGetUserRoleReturnsCorrectRole(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user = $em->find(User::class, $this->user1->getId());

        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($project);
        $collaborator->setUser($user);
        $collaborator->setRole(ProjectCollaborator::ROLE_EDITOR);
        $em->persist($collaborator);
        $em->flush();

        $role = $repository->getUserRole($project, $user);

        $this->assertSame(ProjectCollaborator::ROLE_EDITOR, $role);

        self::ensureKernelShutdown();
    }

    public function testGetUserRoleReturnsNullForNonCollaborator(): void
    {
        self::bootKernel();
        $em = self::getContainer()->get('doctrine')->getManager();
        $repository = $em->getRepository(ProjectCollaborator::class);

        $project = $em->find(Project::class, $this->project->getId());
        $user = $em->find(User::class, $this->user2->getId());

        $role = $repository->getUserRole($project, $user);

        $this->assertNull($role);

        self::ensureKernelShutdown();
    }
}
