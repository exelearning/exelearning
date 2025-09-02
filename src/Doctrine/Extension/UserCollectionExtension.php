<?php

namespace App\Doctrine\Extension;

use ApiPlatform\Doctrine\Orm\Extension\QueryCollectionExtensionInterface;
use ApiPlatform\Doctrine\Orm\Util\QueryNameGeneratorInterface;
use App\Entity\net\exelearning\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\QueryBuilder;
use Symfony\Bundle\SecurityBundle\Security;

/**
 * Restrict /users collection for non-admins to their own record.
 * Keeps default Doctrine provider behavior (filters, pagination) for admins.
 */
class UserCollectionExtension implements QueryCollectionExtensionInterface
{
    public function __construct(
        private readonly Security $security,
        private readonly EntityManagerInterface $em,
    ) {
    }

    public function applyToCollection(
        QueryBuilder $queryBuilder,
        QueryNameGeneratorInterface $queryNameGenerator,
        string $resourceClass,
        ?\ApiPlatform\Metadata\Operation $operation = null,
        array $context = [],
    ): void {
        if (User::class !== $resourceClass) {
            return;
        }

        if ($this->security->isGranted('ROLE_ADMIN')) {
            return; // no restriction for admins
        }

        $tokenUser = $this->security->getUser();
        $alias = $queryBuilder->getRootAliases()[0];

        // Try to resolve admin by token roles first, then by DB
        $currentId = null;
        $currentEmail = null;

        if ($tokenUser instanceof \Symfony\Component\Security\Core\User\UserInterface) {
            // If it's our entity, use id; otherwise grab identifier (email)
            if (method_exists($tokenUser, 'getRoles') && in_array('ROLE_ADMIN', (array) $tokenUser->getRoles(), true)) {
                return; // token user exposes admin role
            }
            if ($tokenUser instanceof User) {
                if (in_array('ROLE_ADMIN', $tokenUser->getRoles(), true)) {
                    return; // entity says admin
                }
                $currentId = $tokenUser->getId();
            } else {
                $currentEmail = $tokenUser->getUserIdentifier();
                if ($currentEmail) {
                    $dbUser = $this->em->getRepository(User::class)->findOneBy(['email' => $currentEmail]);
                    if ($dbUser) {
                        if (in_array('ROLE_ADMIN', $dbUser->getRoles(), true)) {
                            return; // treat as admin
                        }
                        $currentId = $dbUser->getId();
                    }
                }
            }
        }

        // Ignore any filters for non-admins: force WHERE to only current user
        $queryBuilder->resetDQLPart('where');
        if (null !== $currentId) {
            $queryBuilder
                ->andWhere($queryBuilder->expr()->eq("$alias.id", ':currentUserId'))
                ->setParameter('currentUserId', $currentId);
        } elseif (null !== $currentEmail) {
            $queryBuilder
                ->andWhere($queryBuilder->expr()->eq("$alias.email", ':currentUserEmail'))
                ->setParameter('currentUserEmail', $currentEmail);
        } else {
            // No user -> always-empty predicate
            $queryBuilder->andWhere($queryBuilder->expr()->eq("$alias.id", -1));
        }
    }
}
