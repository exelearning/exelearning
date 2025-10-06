<?php

namespace App\ApiResource;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Post;
use ApiPlatform\OpenApi\Model\Operation;
use ApiPlatform\OpenApi\Model\Parameter;
use App\Controller\Api\AuthController;

#[ApiResource(
    shortName: 'Auth',
    operations: [
        new Post(
            uriTemplate: '/auth/token',
            controller: AuthController::class,
            name: 'api_auth_token',
            read: false,
            deserialize: false,
            validate: false,
            paginationEnabled: false,
            openapi: new Operation(
                summary: 'Generate JWT token (firebase/jwt)',
                tags: ['Authentication'],
                parameters: [
                    new Parameter(
                        name: 'ttl',
                        in: 'query',
                        description: 'Time-to-live of the token in seconds (default 3600 = 1h)',
                        required: false,
                        schema: ['type' => 'integer', 'default' => 3600, 'example' => 7200]
                    ),
                ],
                responses: [
                    '200' => [
                        'description' => 'JWT successfully generated',
                        'content' => [
                            'application/json' => [
                                'schema' => [
                                    'type' => 'object',
                                    'properties' => [
                                        'token' => ['type' => 'string', 'example' => 'eyJhbGciOi...'],
                                        'ttl' => ['type' => 'integer', 'example' => 3600],
                                    ],
                                ],
                            ],
                        ],
                    ],
                    '401' => ['description' => 'Unauthorized'],
                ],
            ),
        ),
    ],
)]
final class AuthToken
{
}
