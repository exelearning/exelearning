<?php

namespace App\Controller\Api\Project;

use App\Constants;
use App\Entity\net\exelearning\Dto\CurrentOdeUsersDto;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/ode-management/odes/current/project/get', name: 'api_get_current_project', methods: ['GET'])]
class GetCurrentProjectAction extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly UserHelper $userHelper,
        private readonly CurrentOdeUsersServiceInterface $currentOdeUsersService,
    ) {
    }

    public function __invoke(Request $request)
    {
        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        $repo = $this->entityManager->getRepository(CurrentOdeUsers::class);

        // Ensure we persist the default theme for first time users (legacy behaviour).
        $this->userHelper->saveUserTheme($user, Constants::THEME_DEFAULT);

        $requestedSessionId = $request->query->get('odeSessionId');
        $requestedProjectId = $request->query->get('projectId') ?? $request->query->get('project');
        $forceNewSession = filter_var(
            $request->query->get('forceNewSession'),
            FILTER_VALIDATE_BOOL
        );

        $clientIp = $request->getClientIp() ?? '127.0.0.1';

        $currentSession = null;
        $usersInSession = [];
        $isNewSession = false;
        $isAlreadyLoggedAndLastUser = false;

        // MULTI-USER COLLABORATION: If specific sessionId is provided, try to join that session
        if ($requestedSessionId && $requestedProjectId && !$forceNewSession) {
            // User wants to join a specific existing session (shared URL scenario)
            $existingSession = $repo->findOneBy(['odeSessionId' => $requestedSessionId]);

            if ($existingSession && $existingSession->getOdeId() === $requestedProjectId) {
                // Valid session found - join it
                $sessionData = $this->currentOdeUsersService->joinExistingSession(
                    $requestedSessionId,
                    $requestedProjectId,
                    $existingSession->getOdeVersionId(),
                    $databaseUser,
                    $clientIp
                );

                $currentSession = $sessionData['session'];
                $isNewSession = $sessionData['isNewSession'];
                $usersInSession = $sessionData['usersInSession'];

                // Ensure Project entity exists
                $projectRepo = $this->entityManager->getRepository(Project::class);
                $existingProject = $projectRepo->find($requestedProjectId);

                if (!$existingProject) {
                    $project = new Project();
                    $project->setId($requestedProjectId);
                    $project->setTitle('New Project');
                    $project->setOwner($databaseUser);
                    $project->setVisibility('private');
                    $project->setArchived(false);

                    $this->entityManager->persist($project);

                    $collaborator = new ProjectCollaborator();
                    $collaborator->setProject($project);
                    $collaborator->setUser($databaseUser);
                    $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
                    $collaborator->setGrantedBy($databaseUser);

                    $this->entityManager->persist($collaborator);
                    $this->entityManager->flush();
                }
            } elseif ($existingSession) {
                // Session exists but belongs to different project
                return $this->json([
                    'responseMessage' => 'SESSION_PROJECT_MISMATCH',
                    'detail' => 'The requested session belongs to a different project',
                ], 400);
            } else {
                // Session not found
                return $this->json([
                    'responseMessage' => 'SESSION_NOT_FOUND',
                    'detail' => 'No active session matches the requested identifier',
                ], 404);
            }
        }
        // MULTI-USER COLLABORATION: If projectId is provided, use shared session logic
        elseif ($requestedProjectId && !$forceNewSession) {
            $sessionData = $this->currentOdeUsersService->getOrCreateSessionForProject(
                $requestedProjectId,
                $databaseUser,
                $clientIp
            );

            $currentSession = $sessionData['session'];
            $isNewSession = $sessionData['isNewSession'];
            $usersInSession = $sessionData['usersInSession'];

            // Ensure Project entity exists (might have been created separately)
            $projectRepo = $this->entityManager->getRepository(Project::class);
            $existingProject = $projectRepo->find($requestedProjectId);

            if (!$existingProject) {
                $project = new Project();
                $project->setId($requestedProjectId);
                $project->setTitle('New Project'); // Default title, will be updated on first save
                $project->setOwner($databaseUser);
                $project->setVisibility('private');
                $project->setArchived(false);

                $this->entityManager->persist($project);

                // Create ProjectCollaborator entry for the owner
                $collaborator = new ProjectCollaborator();
                $collaborator->setProject($project);
                $collaborator->setUser($databaseUser);
                $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
                $collaborator->setGrantedBy($databaseUser);

                $this->entityManager->persist($collaborator);
                $this->entityManager->flush();
            }
        }
        // LEGACY: Support odeSessionId parameter (for backward compatibility)
        elseif (!$forceNewSession && ($requestedSessionId || !$requestedProjectId)) {
            $currentSession = $repo->getCurrentSessionForUser(
                $databaseUser->getUserIdentifier(),
                $requestedSessionId
            );

            if (!$currentSession) {
                if ($requestedSessionId) {
                    return $this->json([
                        'responseMessage' => 'SESSION_NOT_FOUND',
                        'detail' => 'No active session matches the requested identifier',
                    ], 404);
                }

                // No session found and no projectId - create brand new session (legacy flow)
                $odeId = Util::generateId();
                $odeVersionId = Util::generateId();
                $odeSessionId = Util::generateId();

                $currentSession = $this->currentOdeUsersService->createCurrentOdeUsers(
                    $odeId,
                    $odeVersionId,
                    $odeSessionId,
                    $databaseUser,
                    $clientIp
                );

                // Create corresponding Project entity
                $projectRepo = $this->entityManager->getRepository(Project::class);
                $existingProject = $projectRepo->find($odeId);

                if (!$existingProject) {
                    $project = new Project();
                    $project->setId($odeId);
                    $project->setTitle('New Project');
                    $project->setOwner($databaseUser);
                    $project->setVisibility('private');
                    $project->setArchived(false);

                    $this->entityManager->persist($project);

                    $collaborator = new ProjectCollaborator();
                    $collaborator->setProject($project);
                    $collaborator->setUser($databaseUser);
                    $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
                    $collaborator->setGrantedBy($databaseUser);

                    $this->entityManager->persist($collaborator);
                    $this->entityManager->flush();
                }

                $isNewSession = true;
            } else {
                // Session found - check if last user
                $isLastUser = $this->currentOdeUsersService->isLastUser(
                    $user,
                    null,
                    null,
                    $currentSession->getOdeSessionId()
                );

                if ($isLastUser && $currentSession->getLastAction()) {
                    $userLastAction = $currentSession->getLastAction()->getTimestamp();
                    $timeNow = time();
                    $elapsed = $timeNow - $userLastAction;

                    if (Constants::MODAL_CLIENT_ALREADY_LOGGED_USER_TIME <= $elapsed) {
                        $isAlreadyLoggedAndLastUser = true;
                    }
                }

                // Get users in session for response
                $usersInSession = $repo->getUsersInSession($currentSession->getOdeSessionId());
            }
        }
        // FORCE NEW SESSION: Create isolated session
        else {
            $odeId = $requestedProjectId ?? Util::generateId();
            $odeVersionId = Util::generateId();
            $odeSessionId = Util::generateId();

            $currentSession = $this->currentOdeUsersService->createCurrentOdeUsers(
                $odeId,
                $odeVersionId,
                $odeSessionId,
                $databaseUser,
                $clientIp
            );

            $projectRepo = $this->entityManager->getRepository(Project::class);
            $existingProject = $projectRepo->find($odeId);

            if (!$existingProject) {
                $project = new Project();
                $project->setId($odeId);
                $project->setTitle('New Project');
                $project->setOwner($databaseUser);
                $project->setVisibility('private');
                $project->setArchived(false);

                $this->entityManager->persist($project);

                $collaborator = new ProjectCollaborator();
                $collaborator->setProject($project);
                $collaborator->setUser($databaseUser);
                $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
                $collaborator->setGrantedBy($databaseUser);

                $this->entityManager->persist($collaborator);
                $this->entityManager->flush();
            }

            $isNewSession = true;
            $usersInSession = [$currentSession];
        }

        $payload = [
            'responseMessage' => 'OK',
            'currentOdeUsers' => null,
            'isNewSession' => $isNewSession,
            'isAlreadyLoggedAndLastUser' => $isAlreadyLoggedAndLastUser,
            'usersInSession' => [],
            'collaborativeSession' => count($usersInSession) > 1,
        ];

        if ($currentSession) {
            $dto = new CurrentOdeUsersDto();
            $dto->loadFromEntity($currentSession);
            $payload['currentOdeUsers'] = $dto->toArray();

            // Add users in session info (for collaborative UI)
            foreach ($usersInSession as $userSession) {
                $userDto = new CurrentOdeUsersDto();
                $userDto->loadFromEntity($userSession);
                $payload['usersInSession'][] = [
                    'user' => $userSession->getUser(),
                    'lastAction' => $userSession->getLastAction()->format('Y-m-d H:i:s'),
                    'currentPageId' => $userSession->getCurrentPageId(),
                    'isEditingComponent' => $userSession->getSyncComponentsFlag(),
                    'currentComponentId' => $userSession->getCurrentComponentId(),
                ];
            }
        }

        return $this->json($payload, 200);
    }
}
