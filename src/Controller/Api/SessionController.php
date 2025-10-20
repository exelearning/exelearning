<?php

namespace App\Controller\Api;

use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

class SessionController
{
    public function __construct(private readonly Security $security)
    {
    }

    #[Route('/api/session/check', name: 'api_session_check', methods: ['GET'])]
    public function __invoke(): JsonResponse
    {
        $isAuthenticated = null !== $this->security->getUser()
            && $this->security->isGranted('IS_AUTHENTICATED_FULLY');

        return new JsonResponse(
            [
                'authenticated' => $isAuthenticated,
            ],
            JsonResponse::HTTP_OK,
            [
                'Cache-Control' => 'no-store, private',
            ]
        );
    }
}
