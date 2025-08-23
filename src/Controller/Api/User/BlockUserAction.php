<?php

namespace App\Controller\Api\User;

use App\Entity\net\exelearning\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class BlockUserAction extends AbstractController
{
    public function __invoke(User $data, Request $request, EntityManagerInterface $em): JsonResponse
    {
        if (!$this->isGranted('ROLE_ADMIN')) {
            throw new AccessDeniedHttpException();
        }
        // Logical disable
        $data->setIsActive(false);
        $em->persist($data);
        $em->flush();

        return $this->json($data, 200, [], ['groups' => ['user:read']]);
    }
}
