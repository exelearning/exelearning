<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use ApiPlatform\OpenApi\Model\Operation;
use App\Controller\Api\Project\Blocks\CreateBlockAction;
use App\Controller\Api\Project\Blocks\DeleteBlockAction;
use App\Controller\Api\Project\Blocks\GetBlockAction;
use App\Controller\Api\Project\Blocks\ListBlocksAction;
use App\Controller\Api\Project\Blocks\MoveBlockAction;
use App\Controller\Api\Project\Blocks\ReorderBlocksAction;
use Symfony\Component\Serializer\Annotation\Groups;

#[ApiResource(
    shortName: 'Block',
    operations: [
        new Post(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/blocks',
            controller: CreateBlockAction::class,
            read: false,
            output: false,
            openapi: new Operation(
                summary: 'Create block',
                description: 'Creates a new block. Response includes full block details, with iDevices including html and props.'
            )
        ),
        new GetCollection(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/blocks',
            controller: ListBlocksAction::class,
            read: false,
            output: false,
            openapi: new Operation(
                summary: 'List blocks',
                description: 'Returns all blocks for the page. Always includes iDevices with html and props.'
            )
        ),
        new Get(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/blocks/{blockId}',
            controller: GetBlockAction::class,
            read: false,
            output: false,
            openapi: new Operation(
                summary: 'Get block',
                description: 'Returns a single block. Always includes iDevices with html and props.'
            )
        ),
        new Patch(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/blocks/{blockId}/move',
            controller: MoveBlockAction::class,
            read: false,
            output: false
        ),
        new Delete(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/blocks/{blockId}',
            controller: DeleteBlockAction::class,
            read: false,
            output: false
        ),
        new Patch(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/blocks',
            controller: ReorderBlocksAction::class,
            read: false,
            output: false
        ),
    ]
)]
class BlockItem
{
    #[Groups(['block:read'])]
    public string $id;
    #[Groups(['block:read'])]
    public string $nodeId;
    #[Groups(['block:read'])]
    public string $type;
    #[Groups(['block:read'])]
    public array $data = [];
}
