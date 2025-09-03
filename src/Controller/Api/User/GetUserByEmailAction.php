<?php

namespace App\Controller\Api\User;

use App\Entity\net\exelearning\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
#[Route('/api/v2/users/by-email/{email}', name: 'api_v2_users_by_email', methods: ['GET'])]
class GetUserByEmailAction extends AbstractController
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function __invoke(string $email, Request $request): JsonResponse
    {
        $repo = $this->em->getRepository(User::class);
        $user = $repo->findOneBy(['email' => $email]);
        if (!$user) {
            return $this->json([
                'title' => 'Not Found',
                'detail' => 'User not found',
                'type' => '/errors/404',
            ], 404);
        }

        // Access control: admin or owner by email/id
        $logged = $this->getUser();
        $isAdmin = $this->isGranted('ROLE_ADMIN');
        $isOwner = false;
        if ($logged instanceof User) {
            $isOwner = $logged->getId() === $user->getId();
        } elseif ($logged) {
            $isOwner = method_exists($logged, 'getUserIdentifier') && $logged->getUserIdentifier() === $user->getEmail();
        }
        if (!$isAdmin && !$isOwner) {
            return $this->json([
                'title' => 'Forbidden',
                'detail' => 'Only admins or the owner can view this user.',
                'type' => '/errors/403',
            ], 403);
        }

        return $this->json([
            'id' => $user->getId(),
            'externalIdentifier' => $user->getExternalIdentifier(),
            'email' => $user->getEmail(),
            'roles' => $user->getRoles(),
            'userId' => $user->getUserId(),
            'isLopdAccepted' => $user->getIsLopdAccepted(),
            'gravatarUrl' => $user->getGravatarUrl(),
        ], 200);
    }
}
