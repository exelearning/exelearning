<?php

namespace App\State\User;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProviderInterface;
use App\Entity\net\exelearning\Entity\User;
use App\Repository\net\exelearning\Repository\UserRepository;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Filters the /users collection so non-admins only see their own user.
 * Admins get the full collection.
 */
class UserCollectionProvider implements ProviderInterface
{
    public function __construct(
        private readonly Security $security,
        private readonly UserRepository $userRepository,
    ) {
    }

    /**
     * @return iterable<User>|User[]|null
     */
    public function provide(Operation $operation, array $uriVariables = [], array $context = []): iterable|object|null
    {
        // If admin, return the full list
        if ($this->security->isGranted('ROLE_ADMIN')) {
            return $this->userRepository->findAll();
        }

        // Otherwise, return only the currently authenticated user (if any)
        $user = $this->security->getUser();
        if ($user instanceof User) {
            return [$user];
        }

        // Not authenticated or not our User implementation
        return [];
    }
}
