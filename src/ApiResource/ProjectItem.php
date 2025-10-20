<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Post;
use App\Controller\Api\Project\CreateProjectAction;
use App\Controller\Api\Project\DeleteProjectAction;
use App\Controller\Api\Project\GetProjectAction;
use App\Controller\Api\Project\ListProjectsAction;
use App\Controller\Api\Project\UpdateProjectAction;
use Symfony\Component\Serializer\Annotation\Groups;

#[ApiResource(
    shortName: 'Project',
    operations: [
        new GetCollection(
            uriTemplate: '/projects',
            controller: ListProjectsAction::class,
            security: 'is_granted("ROLE_USER")'
        ),
        new Post(
            uriTemplate: '/projects',
            controller: CreateProjectAction::class,
            security: 'is_granted("ROLE_USER")',
            status: 201,
        ),
        new Get(
            uriTemplate: '/projects/{projectId}',
            controller: GetProjectAction::class,
            security: 'is_granted("ROLE_USER")'
        ),
        new Patch(
            uriTemplate: '/projects/{projectId}',
            controller: UpdateProjectAction::class,
            security: 'is_granted("ROLE_USER")'
        ),
        new Delete(
            uriTemplate: '/projects/{projectId}',
            controller: DeleteProjectAction::class,
            security: 'is_granted("ROLE_USER")'
        ),
    ]
)]
class ProjectItem
{
    #[Groups(['project:read'])]
    public string $id;
    #[Groups(['project:read'])]
    public ?string $odeFilesId = null;
    #[Groups(['project:read'])]
    public string $odeId;
    #[Groups(['project:read'])]
    public ?string $odeVersionId = null;
    #[Groups(['project:read'])]
    public string $title;
    #[Groups(['project:read'])]
    public ?string $versionName = null;
    #[Groups(['project:read'])]
    public string $fileName;
    #[Groups(['project:read'])]
    public string $size;
    #[Groups(['project:read'])]
    public bool $isManualSave = true;
    #[Groups(['project:read'])]
    public array $updatedAt = [];
    #[Groups(['project:read'])]
    public array $properties = [];
}
