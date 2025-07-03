<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Entity\net\exelearning\Entity\User;
use App\Repository\net\exelearning\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Validator\ValidatorInterface;

#[Route('/apiRest/users')]
class UserApiControllerRest extends AbstractController
{
    public function __construct(
        private UserRepository $userRepository,
        private EntityManagerInterface $em,
        private SerializerInterface $serializer,
        private ValidatorInterface $validator
    ) {}

    #[Route('', name: 'api_users_index', methods: ['GET'])]
    public function index(): JsonResponse
    {
        $users = $this->userRepository->findAll();

        return $this->json([
            'data' => $users, Response::HTTP_OK
        ]);
    }

    #[Route('/{id}', name: 'api_users_show', methods: ['GET'])]
    public function show(User $user): JsonResponse
    {
        return $this->json([
            'data' => $user, Response::HTTP_OK
        ]);
    }

    #[Route('', name: 'api_users_create', methods: ['POST'])]
    public function create(Request $request): JsonResponse
    {
        try {
            $user = $this->serializer->deserialize($request->getContent(), User::class, 'json');

            $errors = $this->validator->validate($user);
            if (count($errors) > 0) {
                return $this->json(['errors' => $errors], Response::HTTP_BAD_REQUEST);
            }

            $this->em->persist($user);
            $this->em->flush();

            return $this->json([
                'data' => $user,
            ], Response::HTTP_CREATED);
        } catch (\Exception $e) {
            return $this->json([
                'error' => $e->getMessage(),
            ], Response::HTTP_BAD_REQUEST);
        }
    }

    #[Route('/{id}', name: 'api_users_update', methods: ['PUT', 'PATCH'])]
    public function update(User $user, Request $request): JsonResponse
    {
        try {
            $this->serializer->deserialize(
                $request->getContent(),
                User::class,
                'json',
                ['object_to_populate' => $user]
            );

            $errors = $this->validator->validate($user);
            if (count($errors) > 0) {
                return $this->json(['errors' => $errors], Response::HTTP_BAD_REQUEST);
            }

            $this->em->flush();

            return $this->json([
                'data' => $user, Response::HTTP_OK
            ]);
        } catch (\Exception $e) {
            return $this->json([
                'error' => $e->getMessage(),
            ], Response::HTTP_BAD_REQUEST);
        }
    }

    #[Route('/{id}', name: 'api_users_delete', methods: ['DELETE'])]
    public function delete(User $user): JsonResponse
    {
        $this->em->remove($user);
        $this->em->flush();

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/{id}/block', name: 'api_users_block', methods: ['PUT'])]
    public function blockUser(User $user): JsonResponse
    {
        try {
            if (!$user->getIsActive()) {
                return $this->json([
                    'status' => 'info',
                    'message' => 'User was already blocked',
                    'data' => [
                        'user_id' => $user->getId(),
                        'is_active' => false
                    ]
                ], Response::HTTP_OK);
            }

            $user->setIsActive(false);
            $this->em->flush();

            return $this->json([
                'status' => 'success',
                'message' => 'User blocked successfully',
                'data' => [
                    'user_id' => $user->getId(),
                    'is_active' => $user->getIsActive()
                ]
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            $this->logger->error('Block user error: ' . $e->getMessage());

            return $this->json([
                'status' => 'error',
                'message' => 'Failed to block user',
                'system_message' => $e->getMessage(), // Solo para desarrollo
                'code' => 'USER_BLOCK_FAILED'
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    #[Route('/{id}/unblock', name: 'api_users_unblock', methods: ['PUT'])]
    public function unblockUser(User $user): JsonResponse
    {
        try {
            if ($user->getIsActive()) {
                return $this->json([
                    'status' => 'info',
                    'message' => 'User was already active',
                    'data' => [
                        'user_id' => $user->getId(),
                        'is_active' => true
                    ]
                ], Response::HTTP_OK);
            }

            $user->setIsActive(true);
            $this->em->flush();

            return $this->json([
                'status' => 'success',
                'message' => 'User unblocked successfully',
                'data' => [
                    'user_id' => $user->getId(),
                    'is_active' => $user->getIsActive()
                ]
            ], Response::HTTP_OK);
        } catch (\Exception $e) {
            $this->logger->error('Unblock user error: ' . $e->getMessage());

            return $this->json([
                'status' => 'error',
                'message' => 'Failed to unblock user',
                'system_message' => $e->getMessage(), // Solo para desarrollo
                'code' => 'USER_UNBLOCK_FAILED'
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }
}
