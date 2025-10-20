<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use App\Controller\Api\Project\GetCurrentProjectAction;

#[ApiResource(
    shortName: 'CurrentProject',
    operations: [
        new Get(
            uriTemplate: '/me/current-project',
            controller: GetCurrentProjectAction::class,
            security: 'is_granted("ROLE_USER")',
            read: false,
            deserialize: false,
        ),
    ]
)]
class CurrentProject
{
}
