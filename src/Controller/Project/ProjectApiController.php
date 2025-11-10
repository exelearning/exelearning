<?php

namespace App\Controller\Project;

use App\Controller\net\exelearning\Controller\Api\DefaultApiController;
use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use App\Repository\net\exelearning\Repository\CurrentOdeUsersRepository;
use App\Repository\net\exelearning\Repository\OdeFilesRepository;
use App\Repository\net\exelearning\Repository\UserRepository;
use App\Repository\Project\ProjectCollaboratorRepository;
use App\Repository\Project\ProjectRepository;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Mercure\HubInterface;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Serializer\SerializerInterface;

#[Route('/api/projects')]
class ProjectApiController extends DefaultApiController
{
    private ProjectRepository $projectRepo;
    private ProjectCollaboratorRepository $collaboratorRepo;
    private UserRepository $userRepo;
    private OdeFilesRepository $odeFilesRepo;
    private CurrentOdeUsersRepository $currentOdeUsersRepo;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        SerializerInterface $serializer,
        HubInterface $hub,
        ProjectRepository $projectRepo,
        ProjectCollaboratorRepository $collaboratorRepo,
        UserRepository $userRepo,
        OdeFilesRepository $odeFilesRepo,
        CurrentOdeUsersRepository $currentOdeUsersRepo,
    ) {
        parent::__construct($entityManager, $logger, $serializer, $hub);
        $this->projectRepo = $projectRepo;
        $this->collaboratorRepo = $collaboratorRepo;
        $this->userRepo = $userRepo;
        $this->odeFilesRepo = $odeFilesRepo;
        $this->currentOdeUsersRepo = $currentOdeUsersRepo;
    }

    /**
     * List all projects accessible by the current user.
     */
    #[Route('', methods: ['GET'], name: 'api_projects_list')]
    public function listProjects(Request $request): JsonResponse
    {
        /** @var User|null $user */
        $user = $this->getUser();

        $projects = [];

        // Admins see all projects
        if ($user && in_array('ROLE_ADMIN', $user->getRoles())) {
            $allProjects = $this->projectRepo->findBy(['isArchived' => false], ['lastAccessedAt' => 'DESC']);
            foreach ($allProjects as $project) {
                $projects[] = $this->formatProjectResponse($project);
            }
        }
        // Authenticated users see their own projects + public projects
        elseif ($user) {
            // Get projects where user is owner
            $ownedProjects = $this->projectRepo->findByOwner($user);

            // Get projects where user is collaborator
            $collaborations = $this->collaboratorRepo->findByUser($user);

            // Get public projects
            $publicProjects = $this->projectRepo->findPublicProjects();

            // Combine and deduplicate
            $projectMap = [];
            foreach ($ownedProjects as $project) {
                $projectMap[$project->getId()] = $project;
            }
            foreach ($collaborations as $collab) {
                $project = $collab->getProject();
                if (!$project->isArchived()) {
                    $projectMap[$project->getId()] = $project;
                }
            }
            foreach ($publicProjects as $project) {
                $projectMap[$project->getId()] = $project;
            }

            foreach ($projectMap as $project) {
                $projects[] = $this->formatProjectResponse($project);
            }
        }
        // Anonymous users see only public projects
        else {
            $publicProjects = $this->projectRepo->findPublicProjects();
            foreach ($publicProjects as $project) {
                $projects[] = $this->formatProjectResponse($project);
            }
        }

        return new JsonResponse([
            'responseMessage' => 'OK',
            'projects' => $projects,
            'count' => count($projects),
        ], 200);
    }

    /**
     * Get a single project by ID.
     * Automatically creates Project from OdeFiles if not exists (backwards compatibility).
     */
    #[Route('/{id}', methods: ['GET'], name: 'api_projects_get')]
    public function getProject(string $id): JsonResponse
    {
        $project = $this->projectRepo->find($id);

        // If project doesn't exist, try to create it from OdeFiles (backwards compatibility)
        if (!$project) {
            $project = $this->createProjectFromOdeFile($id);
        }

        if (!$project) {
            return new JsonResponse([
                'responseMessage' => 'PROJECT_NOT_FOUND',
                'detail' => 'Project not found',
            ], 404);
        }

        // Check access
        if (!$this->isGranted('PROJECT_VIEW', $project)) {
            return new JsonResponse([
                'responseMessage' => 'ACCESS_DENIED',
                'detail' => 'You do not have permission to view this project',
            ], 403);
        }

        // Update last accessed timestamp
        $project->updateLastAccessedAt();
        $this->entityManager->flush();

        return new JsonResponse([
            'responseMessage' => 'OK',
            'project' => $this->formatProjectResponse($project, true),
        ], 200);
    }

    /**
     * Update project visibility (public/private).
     */
    #[Route('/{id}/visibility', methods: ['PATCH'], name: 'api_projects_update_visibility')]
    public function updateVisibility(string $id, Request $request): JsonResponse
    {
        $project = $this->projectRepo->find($id);

        // Auto-create from OdeFiles if not exists (backwards compatibility)
        if (!$project) {
            $project = $this->createProjectFromOdeFile($id);
        }

        if (!$project) {
            return new JsonResponse([
                'responseMessage' => 'PROJECT_NOT_FOUND',
                'detail' => 'Project not found',
            ], 404);
        }

        // Only project owner can change visibility
        $currentUser = $this->getUser();
        if ($project->getOwner()->getId() !== $currentUser->getId()) {
            return new JsonResponse([
                'responseMessage' => 'ACCESS_DENIED',
                'detail' => 'Only the project owner can change visibility',
            ], 403);
        }

        $this->hydrateRequestBody($request);
        $visibility = $request->request->get('visibility');

        if (!in_array($visibility, ['public', 'private'])) {
            return new JsonResponse([
                'responseMessage' => 'INVALID_VISIBILITY',
                'detail' => 'Visibility must be either "public" or "private"',
            ], 400);
        }

        $oldVisibility = $project->getVisibility();
        $project->setVisibility($visibility);
        $this->entityManager->flush();

        // MULTI-USER COLLABORATION: If changing from public to private, notify non-collaborators
        if ('public' === $oldVisibility && 'private' === $visibility) {
            $this->notifyVisibilityChanged($project);
        }

        $this->logger->info('Project visibility changed', [
            'projectId' => $project->getId(),
            'oldVisibility' => $oldVisibility,
            'newVisibility' => $visibility,
            'changedBy' => $currentUser->getEmail(),
        ]);

        return new JsonResponse([
            'responseMessage' => 'OK',
            'project' => $this->formatProjectResponse($project, true),
        ], 200);
    }

    /**
     * List collaborators for a project.
     */
    #[Route('/{id}/collaborators', methods: ['GET'], name: 'api_projects_list_collaborators')]
    public function listCollaborators(string $id): JsonResponse
    {
        $project = $this->projectRepo->find($id);

        // Auto-create from OdeFiles if not exists (backwards compatibility)
        if (!$project) {
            $project = $this->createProjectFromOdeFile($id);
        }

        if (!$project) {
            return new JsonResponse([
                'responseMessage' => 'PROJECT_NOT_FOUND',
                'detail' => 'Project not found',
            ], 404);
        }

        // Check access
        if (!$this->isGranted('PROJECT_VIEW', $project)) {
            return new JsonResponse([
                'responseMessage' => 'ACCESS_DENIED',
                'detail' => 'You do not have permission to view this project',
            ], 403);
        }

        $collaborators = $this->collaboratorRepo->findByProject($project);
        $collaboratorsData = [];

        foreach ($collaborators as $collab) {
            $collaboratorsData[] = $this->formatCollaboratorResponse($collab);
        }

        return new JsonResponse([
            'responseMessage' => 'OK',
            'collaborators' => $collaboratorsData,
            'count' => count($collaboratorsData),
        ], 200);
    }

    /**
     * Add a collaborator to a project.
     */
    #[Route('/{id}/collaborators', methods: ['POST'], name: 'api_projects_add_collaborator')]
    public function addCollaborator(string $id, Request $request): JsonResponse
    {
        $project = $this->projectRepo->find($id);

        // Auto-create from OdeFiles if not exists (backwards compatibility)
        if (!$project) {
            $project = $this->createProjectFromOdeFile($id);
        }

        if (!$project) {
            return new JsonResponse([
                'responseMessage' => 'PROJECT_NOT_FOUND',
                'detail' => 'Project not found',
            ], 404);
        }

        // Only project owner can add collaborators
        $currentUser = $this->getUser();
        if ($project->getOwner()->getId() !== $currentUser->getId()) {
            return new JsonResponse([
                'responseMessage' => 'ACCESS_DENIED',
                'detail' => 'Only the project owner can add collaborators',
            ], 403);
        }

        $data = json_decode($request->getContent(), true);
        $email = $data['email'] ?? null;
        $role = $data['role'] ?? ProjectCollaborator::ROLE_EDITOR;

        if (!$email) {
            return new JsonResponse([
                'responseMessage' => 'EMAIL_REQUIRED',
                'detail' => 'Email is required',
            ], 400);
        }

        if (!in_array($role, [ProjectCollaborator::ROLE_OWNER, ProjectCollaborator::ROLE_EDITOR])) {
            return new JsonResponse([
                'responseMessage' => 'INVALID_ROLE',
                'detail' => 'Role must be either "owner" or "editor"',
            ], 400);
        }

        // Find user by email
        $collaboratorUser = $this->userRepo->findOneBy(['email' => $email]);
        if (!$collaboratorUser) {
            return new JsonResponse([
                'responseMessage' => 'USER_NOT_FOUND',
                'detail' => 'No user found with this email',
            ], 404);
        }

        // Check if already a collaborator
        $existingCollab = $this->collaboratorRepo->findCollaborator($project, $collaboratorUser);
        if ($existingCollab) {
            return new JsonResponse([
                'responseMessage' => 'ALREADY_COLLABORATOR',
                'detail' => 'User is already a collaborator on this project',
            ], 409);
        }

        // Create collaborator
        $collaborator = new ProjectCollaborator();
        $collaborator->setProject($project);
        $collaborator->setUser($collaboratorUser);
        $collaborator->setRole($role);
        $collaborator->setGrantedBy($this->getUser());

        $this->entityManager->persist($collaborator);
        $this->entityManager->flush();

        return new JsonResponse([
            'responseMessage' => 'OK',
            'collaborator' => $this->formatCollaboratorResponse($collaborator),
        ], 201);
    }

    /**
     * Remove a collaborator from a project.
     */
    #[Route('/{id}/collaborators/{userId}', methods: ['DELETE'], name: 'api_projects_remove_collaborator')]
    public function removeCollaborator(string $id, int $userId): JsonResponse
    {
        $project = $this->projectRepo->find($id);

        if (!$project) {
            return new JsonResponse([
                'responseMessage' => 'PROJECT_NOT_FOUND',
                'detail' => 'Project not found',
            ], 404);
        }

        // Only project owner can remove collaborators
        $currentUser = $this->getUser();
        if ($project->getOwner()->getId() !== $currentUser->getId()) {
            return new JsonResponse([
                'responseMessage' => 'ACCESS_DENIED',
                'detail' => 'Only the project owner can remove collaborators',
            ], 403);
        }

        $collaboratorUser = $this->userRepo->find($userId);
        if (!$collaboratorUser) {
            return new JsonResponse([
                'responseMessage' => 'USER_NOT_FOUND',
                'detail' => 'User not found',
            ], 404);
        }

        $collaborator = $this->collaboratorRepo->findCollaborator($project, $collaboratorUser);
        if (!$collaborator) {
            return new JsonResponse([
                'responseMessage' => 'NOT_A_COLLABORATOR',
                'detail' => 'User is not a collaborator on this project',
            ], 404);
        }

        // Prevent removing the last owner
        if (ProjectCollaborator::ROLE_OWNER === $collaborator->getRole()) {
            $owners = $this->collaboratorRepo->findOwners($project);
            if (count($owners) <= 1) {
                return new JsonResponse([
                    'responseMessage' => 'CANNOT_REMOVE_LAST_OWNER',
                    'detail' => 'Cannot remove the last owner from a project',
                ], 400);
            }
        }

        // MULTI-USER COLLABORATION: Notify user if they have active sessions
        $this->notifyUserAccessRevoked($project, $collaboratorUser);

        $this->entityManager->remove($collaborator);
        $this->entityManager->flush();

        $this->logger->info('Collaborator removed from project', [
            'projectId' => $project->getId(),
            'userId' => $collaboratorUser->getId(),
            'userEmail' => $collaboratorUser->getEmail(),
            'removedBy' => $currentUser->getEmail(),
        ]);

        return new JsonResponse([
            'responseMessage' => 'OK',
            'message' => 'Collaborator removed successfully',
        ], 200);
    }

    /**
     * Notify a user via Mercure that their access to a project has been revoked.
     * If the user has active sessions for this project, send ACCESS_REVOKED event.
     */
    private function notifyUserAccessRevoked(Project $project, User $user): void
    {
        // Find all active sessions for this user on this project
        $activeSessions = $this->currentOdeUsersRepo->createQueryBuilder('c')
            ->where('c.odeId = :odeId')
            ->andWhere('c.user = :userEmail')
            ->setParameter('odeId', $project->getId())
            ->setParameter('userEmail', $user->getEmail())
            ->getQuery()
            ->getResult();

        if (empty($activeSessions)) {
            return; // User has no active sessions, nothing to notify
        }

        // Send Mercure event to each active session
        foreach ($activeSessions as $session) {
            $odeSessionId = $session->getOdeSessionId();

            $this->publishWithData($odeSessionId, 'access-revoked', [
                'eventType' => 'ACCESS_REVOKED',
                'projectId' => $project->getId(),
                'projectTitle' => $project->getTitle(),
                'user' => $user->getEmail(),
                'odeSessionId' => $odeSessionId,
                'timestamp' => (new \DateTime())->format('c'),
                'message' => 'Your access to this project has been revoked by the owner',
            ]);

            $this->logger->info('ACCESS_REVOKED event sent via Mercure', [
                'projectId' => $project->getId(),
                'odeSessionId' => $odeSessionId,
                'userEmail' => $user->getEmail(),
            ]);
        }
    }

    /**
     * Notify non-collaborators via Mercure when a project changes from public to private.
     * Users who had the project open because it was public need to be notified they lost access.
     */
    private function notifyVisibilityChanged(Project $project): void
    {
        // Find all active sessions for this project
        $activeSessions = $this->currentOdeUsersRepo->createQueryBuilder('c')
            ->where('c.odeId = :odeId')
            ->setParameter('odeId', $project->getId())
            ->getQuery()
            ->getResult();

        if (empty($activeSessions)) {
            return; // No active sessions, nothing to notify
        }

        // Get list of collaborator emails for this project (including owner)
        $collaborators = $this->collaboratorRepo->findByProject($project);
        $collaboratorEmails = [];
        foreach ($collaborators as $collab) {
            $collaboratorEmails[] = $collab->getUser()->getEmail();
        }
        // Add owner email
        $collaboratorEmails[] = $project->getOwner()->getEmail();

        // Notify users who are NOT collaborators
        $notifiedCount = 0;
        foreach ($activeSessions as $session) {
            $userEmail = $session->getUser();

            // Skip if user is a collaborator or owner
            if (in_array($userEmail, $collaboratorEmails, true)) {
                continue;
            }

            $odeSessionId = $session->getOdeSessionId();

            $this->publishWithData($odeSessionId, 'visibility-changed', [
                'eventType' => 'VISIBILITY_CHANGED',
                'projectId' => $project->getId(),
                'projectTitle' => $project->getTitle(),
                'user' => $userEmail,
                'odeSessionId' => $odeSessionId,
                'oldVisibility' => 'public',
                'newVisibility' => 'private',
                'timestamp' => (new \DateTime())->format('c'),
                'message' => 'This project is now private. You no longer have access.',
            ]);

            $this->logger->info('VISIBILITY_CHANGED event sent via Mercure', [
                'projectId' => $project->getId(),
                'odeSessionId' => $odeSessionId,
                'userEmail' => $userEmail,
            ]);

            ++$notifiedCount;
        }

        if ($notifiedCount > 0) {
            $this->logger->info('Notified users of visibility change', [
                'projectId' => $project->getId(),
                'notifiedUsers' => $notifiedCount,
            ]);
        }
    }

    /**
     * Transfer project ownership to another user.
     */
    #[Route('/{id}/owner', methods: ['PATCH'], name: 'api_projects_transfer_ownership')]
    public function transferOwnership(string $id, Request $request): JsonResponse
    {
        $project = $this->projectRepo->find($id);

        // Auto-create from OdeFiles if not exists (backwards compatibility)
        if (!$project) {
            $project = $this->createProjectFromOdeFile($id);
        }

        if (!$project) {
            return new JsonResponse([
                'responseMessage' => 'PROJECT_NOT_FOUND',
                'detail' => 'Project not found',
            ], 404);
        }

        $currentUser = $this->getUser();

        // Only the current owner can transfer ownership
        if ($project->getOwner()->getId() !== $currentUser->getId()) {
            return new JsonResponse([
                'responseMessage' => 'ACCESS_DENIED',
                'detail' => 'Only the project owner can transfer ownership',
            ], 403);
        }

        $data = json_decode($request->getContent(), true);
        $newOwnerId = $data['newOwnerId'] ?? null;
        $email = $data['email'] ?? null;

        // Find new owner by ID or email
        $newOwnerUser = null;
        if ($newOwnerId) {
            $newOwnerUser = $this->userRepo->find($newOwnerId);
        } elseif ($email) {
            $newOwnerUser = $this->userRepo->findOneBy(['email' => $email]);
        }

        if (!$newOwnerUser) {
            return new JsonResponse([
                'responseMessage' => 'USER_NOT_FOUND',
                'detail' => 'New owner user not found',
            ], 404);
        }

        // Cannot transfer to yourself
        if ($newOwnerUser->getId() === $currentUser->getId()) {
            return new JsonResponse([
                'responseMessage' => 'INVALID_TRANSFER',
                'detail' => 'Cannot transfer ownership to yourself',
            ], 400);
        }

        $oldOwner = $project->getOwner();

        // Update Project.owner
        $project->setOwner($newOwnerUser);

        // Ensure new owner has a ProjectCollaborator entry with role='owner'
        $newOwnerCollab = $this->collaboratorRepo->findCollaborator($project, $newOwnerUser);
        if ($newOwnerCollab) {
            // Update existing collaborator to owner role
            $newOwnerCollab->setRole(ProjectCollaborator::ROLE_OWNER);
        } else {
            // Create new collaborator entry
            $newOwnerCollab = new ProjectCollaborator();
            $newOwnerCollab->setProject($project);
            $newOwnerCollab->setUser($newOwnerUser);
            $newOwnerCollab->setRole(ProjectCollaborator::ROLE_OWNER);
            $newOwnerCollab->setGrantedBy($currentUser);
            $this->entityManager->persist($newOwnerCollab);
        }

        // Update old owner's ProjectCollaborator entry to editor role
        $oldOwnerCollab = $this->collaboratorRepo->findCollaborator($project, $oldOwner);
        if ($oldOwnerCollab) {
            // Update to editor role
            $oldOwnerCollab->setRole(ProjectCollaborator::ROLE_EDITOR);
        } else {
            // Create new collaborator entry for old owner as editor
            $oldOwnerCollab = new ProjectCollaborator();
            $oldOwnerCollab->setProject($project);
            $oldOwnerCollab->setUser($oldOwner);
            $oldOwnerCollab->setRole(ProjectCollaborator::ROLE_EDITOR);
            $oldOwnerCollab->setGrantedBy($currentUser);
            $this->entityManager->persist($oldOwnerCollab);
        }

        $this->entityManager->flush();

        $this->logger->info('Project ownership transferred', [
            'projectId' => $project->getId(),
            'oldOwnerId' => $oldOwner->getId(),
            'newOwnerId' => $newOwnerUser->getId(),
        ]);

        return new JsonResponse([
            'responseMessage' => 'OK',
            'message' => 'Ownership transferred successfully',
            'project' => $this->formatProjectResponse($project, true),
        ], 200);
    }

    /**
     * Create a Project entity from an existing OdeFile (backwards compatibility).
     * This allows existing ode projects to work with the new sharing system.
     *
     * @param string $odeId The ode ID to look for
     *
     * @return Project|null The created project or null if odeFile not found
     */
    private function createProjectFromOdeFile(string $odeId): ?Project
    {
        // Find the most recent OdeFile for this odeId
        $odeFile = $this->odeFilesRepo->getLastFileForOde($odeId);

        if (!$odeFile) {
            return null;
        }

        // Find or create the User entity for the owner
        $ownerUser = $this->userRepo->findOneBy(['email' => $odeFile->getUser()]);

        if (!$ownerUser) {
            // If user doesn't exist in users table, we can't create the project
            $this->logger->warning('Cannot create Project from OdeFile: user not found', [
                'odeId' => $odeId,
                'ownerEmail' => $odeFile->getUser(),
            ]);

            return null;
        }

        // Create new Project entity
        $project = new Project();
        $project->setId($odeId);
        $project->setTitle($odeFile->getTitle());
        $project->setOwner($ownerUser);
        $project->setVisibility('private'); // Default to private
        $project->setArchived(false);

        // Set timestamps from OdeFile
        if ($odeFile->getCreatedAt()) {
            $project->setCreatedAt($odeFile->getCreatedAt());
        }
        if ($odeFile->getUpdatedAt()) {
            $project->setLastAccessedAt($odeFile->getUpdatedAt());
        }

        // Persist the new project
        $this->entityManager->persist($project);

        // Create a ProjectCollaborator entry for the owner
        $ownerCollab = new ProjectCollaborator();
        $ownerCollab->setProject($project);
        $ownerCollab->setUser($ownerUser);
        $ownerCollab->setRole(ProjectCollaborator::ROLE_OWNER);
        $ownerCollab->setGrantedBy($ownerUser); // Owner granted themselves

        $this->entityManager->persist($ownerCollab);
        $this->entityManager->flush();

        $this->logger->info('Created Project from OdeFile', [
            'projectId' => $odeId,
            'title' => $odeFile->getTitle(),
            'owner' => $ownerUser->getEmail(),
        ]);

        return $project;
    }

    /**
     * Format project for API response.
     */
    private function formatProjectResponse(Project $project, bool $includeDetails = false): array
    {
        $data = [
            'id' => $project->getId(),
            'title' => $project->getTitle(),
            'visibility' => $project->getVisibility(),
            'isPublic' => $project->isPublic(),
            'owner' => [
                'id' => $project->getOwner()->getId(),
                'email' => $project->getOwner()->getEmail(),
                'userId' => $project->getOwner()->getUserId(),
            ],
            'createdAt' => $project->getCreatedAt()->format('c'),
            'lastAccessedAt' => $project->getLastAccessedAt()?->format('c'),
        ];

        if ($includeDetails) {
            $collaborators = $this->collaboratorRepo->findByProject($project);
            $data['collaborators'] = array_map(
                fn ($c) => $this->formatCollaboratorResponse($c),
                $collaborators
            );
            $data['collaboratorsCount'] = count($collaborators);
        }

        return $data;
    }

    /**
     * Format collaborator for API response.
     */
    private function formatCollaboratorResponse(ProjectCollaborator $collaborator): array
    {
        return [
            'id' => $collaborator->getId(),
            'user' => [
                'id' => $collaborator->getUser()->getId(),
                'email' => $collaborator->getUser()->getEmail(),
                'userId' => $collaborator->getUser()->getUserId(),
            ],
            'role' => $collaborator->getRole(),
            'grantedAt' => $collaborator->getGrantedAt()->format('c'),
            'grantedBy' => $collaborator->getGrantedBy() ? [
                'id' => $collaborator->getGrantedBy()->getId(),
                'email' => $collaborator->getGrantedBy()->getEmail(),
            ] : null,
        ];
    }
}
