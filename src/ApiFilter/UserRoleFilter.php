<?php

namespace App\ApiFilter;

use ApiPlatform\Doctrine\Orm\Filter\AbstractFilter;
use ApiPlatform\Doctrine\Orm\Util\QueryNameGeneratorInterface;
use ApiPlatform\Metadata\Operation;
use Doctrine\ORM\QueryBuilder;

/**
 * Provides ?role=ROLE_ADMIN filtering mapped to roles column (partial LIKE).
 * This is primarily for admins; non-admins remain restricted by the collection extension.
 */
final class UserRoleFilter extends AbstractFilter
{
    public function getDescription(string $resourceClass): array
    {
        return [
            'role' => [
                'property' => null,
                'type' => 'string',
                'required' => false,
                'description' => 'Filter users by role (e.g., ROLE_ADMIN).',
            ],
        ];
    }

    protected function filterProperty(string $property, $value, QueryBuilder $queryBuilder, QueryNameGeneratorInterface $queryNameGenerator, string $resourceClass, ?Operation $operation = null, array $context = []): void
    {
        if ('role' !== $property || null === $value || '' === trim((string) $value)) {
            return;
        }

        $alias = $queryBuilder->getRootAliases()[0];
        $param = $queryNameGenerator->generateParameterName('role');
        $queryBuilder
            ->andWhere($queryBuilder->expr()->like("$alias.roles", ":$param"))
            ->setParameter($param, '%'.trim((string) $value).'%');
    }
}
