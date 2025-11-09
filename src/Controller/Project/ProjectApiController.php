<?php

namespace App\Controller\Project;

use App\Controller\net\exelearning\Controller\Api\DefaultApiController;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use App\Entity\net\exelearning\Entity\User;
use App\Repository\Project\ProjectCollaboratorRepository;
use App\Repository\Project\ProjectRepository;
use App\Repository\net\exelearning\Repository\UserRepository;
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

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        SerializerInterface $serializer,
        HubInterface $hub,
        ProjectRepository $projectRepo,
        ProjectCollaboratorRepository $collaboratorRepo,
        UserRepository $userRepo
    ) {
        parent::__construct($entityManager, $logger, $serializer, $hub);
        $this->projectRepo = $projectRepo;
        $this->collaboratorRepo = $collaboratorRepo;
        $this->userRepo = $userRepo;
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
            'count' => count($projects)
        ], 200);
    }

    /**
     * Get a single project by ID.
     */
    #[Route('/{id}', methods: ['GET'], name: 'api_projects_get')]
    public function getProject(string $id): JsonResponse
    {
        $project = $this->projectRepo->find($id);

        if (!$project) {
            return new JsonResponse([
                'responseMessage' => 'PROJECT_NOT_FOUND',
                'detail' => 'Project not found'
            ], 404);
        }

        // Check access
        if (!$this->isGranted('PROJECT_VIEW', $project)) {
            return new JsonResponse([
                'responseMessage' => 'ACCESS_DENIED',
                'detail' => 'You do not have permission to view this project'
            ], 403);
        }

        // Update last accessed timestamp
        $project->updateLastAccessedAt();
        $this->entityManager->flush();

        return new JsonResponse([
            'responseMessage' => 'OK',
            'project' => $this->formatProjectResponse($project, true)
        ], 200);
    }

    /**
     * Update project visibility (public/private).
     */
    #[Route('/{id}/visibility', methods: ['PATCH'], name: 'api_projects_update_visibility')]
    public function updateVisibility(string $id, Request $request): JsonResponse
    {
        $project = $this->projectRepo->find($id);

        if (!$project) {
            return new JsonResponse([
                'responseMessage' => 'PROJECT_NOT_FOUND',
                'detail' => 'Project not found'
            ], 404);
        }

        // Check access
        if (!$this->isGranted('PROJECT_EDIT', $project)) {
            return new JsonResponse([
                'responseMessage' => 'ACCESS_DENIED',
                'detail' => 'You do not have permission to modify this project'
            ], 403);
        }

        $this->hydrateRequestBody($request);
        $visibility = $request->request->get('visibility');

        if (!in_array($visibility, ['public', 'private'])) {
            return new JsonResponse([
                'responseMessage' => 'INVALID_VISIBILITY',
                'detail' => 'Visibility must be either "public" or "private"'
            ], 400);
        }

        $project->setVisibility($visibility);
        $this->entityManager->flush();

        return new JsonResponse([
            'responseMessage' => 'OK',
            'project' => $this->formatProjectResponse($project, true)
        ], 200);
    }

    /**
     * List collaborators for a project.
     */
    #[Route('/{id}/collaborators', methods: ['GET'], name: 'api_projects_list_collaborators')]
    public function listCollaborators(string $id): JsonResponse
    {
        $project = $this->projectRepo->find($id);

        if (!$project) {
            return new JsonResponse([
                'responseMessage' => 'PROJECT_NOT_FOUND',
                'detail' => 'Project not found'
            ], 404);
        }

        // Check access
        if (!$this->isGranted('PROJECT_VIEW', $project)) {
            return new JsonResponse([
                'responseMessage' => 'ACCESS_DENIED',
                'detail' => 'You do not have permission to view this project'
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
            'count' => count($collaboratorsData)
        ], 200);
    }

    /**
     * Add a collaborator to a project.
     */
    #[Route('/{id}/collaborators', methods: ['POST'], name: 'api_projects_add_collaborator')]
    public function addCollaborator(string $id, Request $request): JsonResponse
    {
        $project = $this->projectRepo->find($id);

        if (!$project) {
            return new JsonResponse([
                'responseMessage' => 'PROJECT_NOT_FOUND',
                'detail' => 'Project not found'
            ], 404);
        }

        // Check access
        if (!$this->isGranted('PROJECT_SHARE', $project)) {
            return new JsonResponse([
                'responseMessage' => 'ACCESS_DENIED',
                'detail' => 'You do not have permission to share this project'
            ], 403);
        }

        $data = json_decode($request->getContent(), true);
        $email = $data['email'] ?? null;
        $role = $data['role'] ?? ProjectCollaborator::ROLE_EDITOR;

        if (!$email) {
            return new JsonResponse([
                'responseMessage' => 'EMAIL_REQUIRED',
                'detail' => 'Email is required'
            ], 400);
        }

        if (!in_array($role, [ProjectCollaborator::ROLE_OWNER, ProjectCollaborator::ROLE_EDITOR])) {
            return new JsonResponse([
                'responseMessage' => 'INVALID_ROLE',
                'detail' => 'Role must be either "owner" or "editor"'
            ], 400);
        }

        // Find user by email
        $collaboratorUser = $this->userRepo->findOneBy(['email' => $email]);
        if (!$collaboratorUser) {
            return new JsonResponse([
                'responseMessage' => 'USER_NOT_FOUND',
                'detail' => 'No user found with this email'
            ], 404);
        }

        // Check if already a collaborator
        $existingCollab = $this->collaboratorRepo->findCollaborator($project, $collaboratorUser);
        if ($existingCollab) {
            return new JsonResponse([
                'responseMessage' => 'ALREADY_COLLABORATOR',
                'detail' => 'User is already a collaborator on this project'
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
            'collaborator' => $this->formatCollaboratorResponse($collaborator)
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
                'detail' => 'Project not found'
            ], 404);
        }

        // Check access
        if (!$this->isGranted('PROJECT_SHARE', $project)) {
            return new JsonResponse([
                'responseMessage' => 'ACCESS_DENIED',
                'detail' => 'You do not have permission to manage collaborators for this project'
            ], 403);
        }

        $collaboratorUser = $this->userRepo->find($userId);
        if (!$collaboratorUser) {
            return new JsonResponse([
                'responseMessage' => 'USER_NOT_FOUND',
                'detail' => 'User not found'
            ], 404);
        }

        $collaborator = $this->collaboratorRepo->findCollaborator($project, $collaboratorUser);
        if (!$collaborator) {
            return new JsonResponse([
                'responseMessage' => 'NOT_A_COLLABORATOR',
                'detail' => 'User is not a collaborator on this project'
            ], 404);
        }

        // Prevent removing the last owner
        if ($collaborator->getRole() === ProjectCollaborator::ROLE_OWNER) {
            $owners = $this->collaboratorRepo->findOwners($project);
            if (count($owners) <= 1) {
                return new JsonResponse([
                    'responseMessage' => 'CANNOT_REMOVE_LAST_OWNER',
                    'detail' => 'Cannot remove the last owner from a project'
                ], 400);
            }
        }

        $this->entityManager->remove($collaborator);
        $this->entityManager->flush();

        return new JsonResponse([
            'responseMessage' => 'OK',
            'message' => 'Collaborator removed successfully'
        ], 200);
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
                'userId' => $project->getOwner()->getUserId()
            ],
            'createdAt' => $project->getCreatedAt()->format('c'),
            'lastAccessedAt' => $project->getLastAccessedAt()?->format('c'),
        ];

        if ($includeDetails) {
            $collaborators = $this->collaboratorRepo->findByProject($project);
            $data['collaborators'] = array_map(
                fn($c) => $this->formatCollaboratorResponse($c),
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
                'userId' => $collaborator->getUser()->getUserId()
            ],
            'role' => $collaborator->getRole(),
            'grantedAt' => $collaborator->getGrantedAt()->format('c'),
            'grantedBy' => $collaborator->getGrantedBy() ? [
                'id' => $collaborator->getGrantedBy()->getId(),
                'email' => $collaborator->getGrantedBy()->getEmail()
            ] : null
        ];
    }
}
