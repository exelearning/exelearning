<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Post;
use App\Controller\Api\Elp\ConvertElpAction;

/**
 * API Resource for converting ELP files.
 *
 * Provides POST /api/v2/convert/elp endpoint.
 * Converts legacy ELP files (contentv2/v3) to the current format (elpx).
 * Accepts multipart/form-data with 'file' parameter.
 * Optional query parameter: download=1 to stream the file directly.
 */
#[ApiResource(
    shortName: 'ConvertElp',
    operations: [
        new Post(
            uriTemplate: '/convert/elp',
            controller: ConvertElpAction::class,
            security: 'is_granted("ROLE_USER")',
            status: 201
        ),
    ]
)]
class ConvertElpResource
{
    // This is a non-entity resource used only for API Platform operation registration
}
