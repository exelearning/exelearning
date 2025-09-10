<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\OpenApi\Model\Operation;
use Symfony\Component\Serializer\Annotation\Groups;

#[ApiResource(
    shortName: 'Page',
    normalizationContext: ['groups' => ['page:read']],
    operations: [
        // TREE (whole project)
        new GetCollection(
            uriTemplate: '/projects/{projectId}/pages',
            security: 'is_granted("ROLE_USER")',
            // Controller returns array<PageNode> (tree)
            controller: \App\Controller\Api\Project\Pages\ListPagesAction::class,
            read: false,
            openapi: new Operation(
                summary: 'List pages tree',
                description: 'Returns the full pages tree for the project.'
            )
        ),
        // CREATE
        new Post(
            uriTemplate: '/projects/{projectId}/pages',
            security: 'is_granted("ROLE_USER")',
            controller: \App\Controller\Api\Project\Pages\CreatePageAction::class,
            read: false,
            output: false,
            openapi: new Operation(
                summary: 'Create page',
                description: 'Creates a new page. If parentId is omitted, the page is created at root level.'
            )
        ),
        // SUBTREE (one page)
        new Get(
            uriTemplate: '/projects/{projectId}/pages/{pageId}',
            security: 'is_granted("ROLE_USER")',
            controller: \App\Controller\Api\Project\Pages\GetPageAction::class,
            read: false,
            openapi: new Operation(
                summary: 'Get page',
                description: 'Returns a page with its subtree by default. Use children=direct to include only direct children.'
            )
        ),
        // UPDATE (partial)
        new Patch(
            uriTemplate: '/projects/{projectId}/pages/{pageId}',
            security: 'is_granted("ROLE_USER")',
            controller: \App\Controller\Api\Project\Pages\UpdatePageAction::class,
            read: false,
            output: false,
            openapi: new Operation(
                summary: 'Update page',
                description: 'Updates page properties such as title, parentId and order.'
            )
        ),
        // MOVE (explicit)
        new Patch(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/move',
            security: 'is_granted("ROLE_USER")',
            controller: \App\Controller\Api\Project\Pages\MovePageAction::class,
            read: false,
            output: false,
            openapi: new Operation(
                summary: 'Move page',
                description: 'Moves a page under a new parent and/or to a specific position among siblings.'
            )
        ),
        // CHILDREN (flat)
        new GetCollection(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/children',
            security: 'is_granted("ROLE_USER")',
            controller: \App\Controller\Api\Project\Pages\ListChildrenAction::class,
            read: false,
            openapi: new Operation(
                summary: 'List children',
                description: 'Returns direct children of a page.'
            )
        ),
        // REORDER CHILDREN
        new Patch(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/children',
            security: 'is_granted("ROLE_USER")',
            controller: \App\Controller\Api\Project\Pages\ReorderChildrenAction::class,
            read: false,
            output: false,
            openapi: new Operation(
                summary: 'Reorder children',
                description: 'Reorders direct children of a page by the provided array of page IDs.'
            )
        ),
        // DELETE
        new Delete(
            uriTemplate: '/projects/{projectId}/pages/{pageId}',
            security: 'is_granted("ROLE_USER")',
            controller: \App\Controller\Api\Project\Pages\DeletePageAction::class,
            read: false,
            output: false,
            openapi: new Operation(
                summary: 'Delete page',
                description: 'Deletes a page and all its descendants.'
            )
        ),
    ]
)]
class PageNode
{
    #[Groups(['page:read'])]
    public string $id;

    #[Groups(['page:read'])]
    public string $title;

    #[Groups(['page:read'])]
    public ?string $parentId = null;

    #[Groups(['page:read'])]
    public int $order = 0;

    /** @var PageNode[] */
    #[Groups(['page:read'])]
    public array $children = [];
}
