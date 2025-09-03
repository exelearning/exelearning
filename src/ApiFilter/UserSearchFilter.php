<?php

namespace App\ApiFilter;

use ApiPlatform\Doctrine\Orm\Filter\AbstractFilter;
use ApiPlatform\Doctrine\Orm\Util\QueryNameGeneratorInterface;
use ApiPlatform\Metadata\Operation;
use Doctrine\ORM\QueryBuilder;

/**
 * Adds a simple global search (?search=term) across email and userId.
 * Intended for admins; non-admins will still be restricted by the Doctrine extension.
 */
final class UserSearchFilter extends AbstractFilter
{
    public function getDescription(string $resourceClass): array
    {
        return [
            'search' => [
                'property' => null,
                'type' => 'string',
                'required' => false,
                'description' => 'Global search in email and userId (admin only effectively).',
            ],
        ];
    }

    protected function filterProperty(string $property, $value, QueryBuilder $queryBuilder, QueryNameGeneratorInterface $queryNameGenerator, string $resourceClass, ?Operation $operation = null, array $context = []): void
    {
        if ('search' !== $property || null === $value || '' === trim((string) $value)) {
            return;
        }

        $alias = $queryBuilder->getRootAliases()[0];
        $param = $queryNameGenerator->generateParameterName('search');
        $expr = $queryBuilder->expr()->orX(
            $queryBuilder->expr()->like("$alias.email", ":$param"),
            $queryBuilder->expr()->like("$alias.userId", ":$param")
        );
        $queryBuilder->andWhere($expr)->setParameter($param, '%'.trim((string) $value).'%');
    }
}
