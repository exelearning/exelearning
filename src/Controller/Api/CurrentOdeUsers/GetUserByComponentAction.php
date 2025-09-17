<?php

namespace App\Controller\Api\CurrentOdeUsers;

use App\Repository\net\exelearning\Repository\CurrentOdeUsersRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class GetUserByComponentAction extends AbstractController
{
    public function __invoke(
        string $currentComponentId,
        CurrentOdeUsersRepository $repository,
    ): JsonResponse {
        // Check JWT authentication
        $currentUser = $this->getUser();
        if (!$currentUser) {
            throw new UnauthorizedHttpException('JWT', 'Valid JWT token required');
        }

        // Verify user has required roles (ROLE_ADMIN or ROLE_USER)
        $isAdmin = $this->isGranted('ROLE_ADMIN');
        $isUser = $this->isGranted('ROLE_USER');

        if (!$isAdmin && !$isUser) {
            throw new AccessDeniedHttpException('Insufficient permissions');
        }

        // Find user by componentId
        $odeUser = $repository->findByCurrentComponentId($currentComponentId);

        if (!$odeUser) {
            throw new NotFoundHttpException('User not found for this component ID');
        }

        // Return only the user field with HTTP 200 OK status
        return $this->json([
            'user' => $odeUser->getUser(),
        ], 200); // HTTP 200 OK
    }
}
