<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Put;
use ApiPlatform\OpenApi\Model\Operation;
use App\Controller\Api\Project\GetIdeviceAction;
use App\Controller\Api\Project\IDevices\AddIdeviceAction;
use App\Controller\Api\Project\IDevices\ListIdevicesAction;
use App\Controller\Api\Project\UpdateIdeviceAction;
use Symfony\Component\Serializer\Annotation\Groups;

#[ApiResource(
    shortName: 'IDevice',
    operations: [
        new GetCollection(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/blocks/{blockId}/idevices',
            controller: ListIdevicesAction::class,
            read: false,
            output: false,
            openapi: new Operation(
                summary: 'List iDevices',
                description: 'Returns iDevices for a block. Always includes html and props.'
            )
        ),
        new \ApiPlatform\Metadata\Post(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/blocks/{blockId}/idevices',
            controller: AddIdeviceAction::class,
            read: false,
            output: false,
            openapi: new Operation(
                summary: 'Add iDevice',
                description: 'Creates a new iDevice in the block. Response includes html and props.'
            )
        ),
        new Get(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/blocks/{blockId}/idevices/{ideviceId}',
            controller: GetIdeviceAction::class,
            read: false,
            output: false,
            openapi: new Operation(
                summary: 'Get iDevice',
                description: 'Returns an iDevice. Always includes html and props.'
            )
        ),
        new Put(
            uriTemplate: '/projects/{projectId}/pages/{pageId}/blocks/{blockId}/idevices/{ideviceId}',
            controller: UpdateIdeviceAction::class,
            read: false,
            output: false,
            openapi: new Operation(
                summary: 'Update iDevice',
                description: 'Updates an iDevice and returns full details including html and props.'
            )
        ),
    ]
)]
class IDevice
{
    #[Groups(['idevice:read'])]
    public string $projectId;
    #[Groups(['idevice:read'])]
    public string $nodeId;
    #[Groups(['idevice:read'])]
    public string $blockId;
    #[Groups(['idevice:read'])]
    public string $ideviceId;
    #[Groups(['idevice:read'])]
    public array $data = [];
}
