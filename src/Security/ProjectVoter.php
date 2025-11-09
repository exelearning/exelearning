<?php

namespace App\Security;

use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use App\Repository\Project\ProjectCollaboratorRepository;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

class ProjectVoter extends Voter
{
    public const VIEW = 'PROJECT_VIEW';
    public const EDIT = 'PROJECT_EDIT';
    public const DELETE = 'PROJECT_DELETE';
    public const SHARE = 'PROJECT_SHARE';

    private ProjectCollaboratorRepository $collaboratorRepo;

    public function __construct(ProjectCollaboratorRepository $collaboratorRepo)
    {
        $this->collaboratorRepo = $collaboratorRepo;
    }

    protected function supports(string $attribute, mixed $subject): bool
    {
        // Only handle these specific attributes
        if (!in_array($attribute, [self::VIEW, self::EDIT, self::DELETE, self::SHARE])) {
            return false;
        }

        // Only handle Project entities
        if (!$subject instanceof Project) {
            return false;
        }

        return true;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        $user = $token->getUser();

        // If the user is not authenticated, they can only view/edit public projects
        if (!$user instanceof User) {
            /** @var Project $project */
            $project = $subject;

            // Anonymous users can only view and edit public projects
            if ($project->isPublic()) {
                return in_array($attribute, [self::VIEW, self::EDIT]);
            }

            return false;
        }

        /** @var Project $project */
        $project = $subject;

        // Admins can do everything
        if (in_array('ROLE_ADMIN', $user->getRoles())) {
            return true;
        }

        // Check if user is the project owner
        if ($project->getOwner()->getId() === $user->getId()) {
            return true; // Owners can do everything
        }

        // Public projects: anyone can view and edit
        if ($project->isPublic()) {
            return in_array($attribute, [self::VIEW, self::EDIT]);
        }

        // Private projects: check collaborator status
        $collaborator = $this->collaboratorRepo->findCollaborator($project, $user);

        if (!$collaborator) {
            return false; // Not a collaborator, no access to private project
        }

        // Determine access based on attribute and role
        return match ($attribute) {
            self::VIEW => true, // All collaborators can view
            self::EDIT => in_array($collaborator->getRole(), [
                ProjectCollaborator::ROLE_OWNER,
                ProjectCollaborator::ROLE_EDITOR,
            ]),
            self::DELETE => ProjectCollaborator::ROLE_OWNER === $collaborator->getRole(),
            self::SHARE => in_array($collaborator->getRole(), [
                ProjectCollaborator::ROLE_OWNER,
                ProjectCollaborator::ROLE_EDITOR,
            ]),
            default => false,
        };
    }
}
