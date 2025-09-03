<?php

namespace App\Controller\Api;

use Firebase\JWT\JWT;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

class AuthController extends AbstractController
{
    public function __construct(
        private readonly string $jwtSecret,
        private readonly ?string $jwtIssuer = null,
        private readonly ?string $jwtAudience = null,
    ) {
    }

    public function __invoke(Request $request): JsonResponse
    {
        $user = $this->getUser();
        if (!$user) {
            return new JsonResponse(['error' => 'Unauthorized'], 401);
        }

        $now = time();
        $ttl = (int) $request->query->get('ttl', 3600); // default 1h

        $payload = [
            'sub' => $user->getUserIdentifier(),
            'exp' => $now + max(1, $ttl),
            'iat' => $now,
            'nbf' => $now,
        ];

        if ($this->jwtIssuer) {
            $payload['iss'] = $this->jwtIssuer;
        }
        if ($this->jwtAudience) {
            $payload['aud'] = $this->jwtAudience;
        }

        $jwt = JWT::encode($payload, $this->jwtSecret, 'HS256');

        return new JsonResponse([
            'token' => $jwt,
            'ttl' => $ttl,
        ]);
    }
}
