<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\GetCollection;
use App\Controller\Api\Template\ListTemplatesAction;
use Symfony\Component\Serializer\Annotation\Groups;

#[ApiResource(
    shortName: 'Template',
    operations: [
        new GetCollection(
            uriTemplate: '/templates',
            controller: ListTemplatesAction::class,
            security: 'is_granted("ROLE_USER")'
        ),
    ]
)]
class TemplateItem
{
    #[Groups(['template:read'])]
    public string $name;

    #[Groups(['template:read'])]
    public string $filename;

    #[Groups(['template:read'])]
    public string $path;

    #[Groups(['template:read'])]
    public string $locale;
}
