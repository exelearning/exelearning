<?php

namespace App\Controller\Api\User;

use App\Entity\net\exelearning\Entity\User;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class UserStatsAction extends AbstractController
{
    public function __invoke(User $data): JsonResponse
    {
        $current = $this->getUser();
        $isAdmin = $this->isGranted('ROLE_ADMIN');
        $isOwner = $current instanceof User && $current->getId() === $data->getId();
        if (!$isAdmin && !$isOwner) {
            throw new AccessDeniedHttpException();
        }
        $projectsCount = 0;
        $usedSpaceMb = 0;

        return $this->json([
            'projectsCount' => $projectsCount,
            'usedSpaceMb' => $usedSpaceMb,
            'quotaMb' => $data->getQuotaMb(),
        ]);
    }
}
