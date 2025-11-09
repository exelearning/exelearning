<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Post;
use App\Controller\Api\Elp\ExportElpAction;

/**
 * API Resource for exporting ELP files to various formats.
 *
 * Provides POST /api/v2/export/{format} endpoints.
 * Accepts multipart/form-data with 'file' parameter and optional 'baseUrl' parameter.
 * Supported formats: elp, html5, html5-sp, scorm12, scorm2004, ims, epub3.
 */
#[ApiResource(
    shortName: 'ExportElp',
    operations: [
        new Post(
            uriTemplate: '/export/elp',
            controller: ExportElpAction::class,
            security: 'is_granted("ROLE_USER")',
            status: 201,
            defaults: ['format' => 'elp']
        ),
        new Post(
            uriTemplate: '/export/html5',
            controller: ExportElpAction::class,
            security: 'is_granted("ROLE_USER")',
            status: 201,
            defaults: ['format' => 'html5']
        ),
        new Post(
            uriTemplate: '/export/html5-sp',
            controller: ExportElpAction::class,
            security: 'is_granted("ROLE_USER")',
            status: 201,
            defaults: ['format' => 'html5-sp']
        ),
        new Post(
            uriTemplate: '/export/scorm12',
            controller: ExportElpAction::class,
            security: 'is_granted("ROLE_USER")',
            status: 201,
            defaults: ['format' => 'scorm12']
        ),
        new Post(
            uriTemplate: '/export/scorm2004',
            controller: ExportElpAction::class,
            security: 'is_granted("ROLE_USER")',
            status: 201,
            defaults: ['format' => 'scorm2004']
        ),
        new Post(
            uriTemplate: '/export/ims',
            controller: ExportElpAction::class,
            security: 'is_granted("ROLE_USER")',
            status: 201,
            defaults: ['format' => 'ims']
        ),
        new Post(
            uriTemplate: '/export/epub3',
            controller: ExportElpAction::class,
            security: 'is_granted("ROLE_USER")',
            status: 201,
            defaults: ['format' => 'epub3']
        ),
    ]
)]
class ExportElpResource
{
    // This is a non-entity resource used only for API Platform operation registration
}
