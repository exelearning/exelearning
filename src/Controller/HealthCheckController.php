<?php

namespace App\Controller;

use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Annotation\Route;

/**
 * HealthCheckController provides a health check endpoint.
 */
class HealthCheckController extends AbstractController
{
    #[Route('/healthcheck', name: 'healthcheck', methods: ['GET'])]
    public function check(EntityManagerInterface $entityManager): JsonResponse
    {
        // Check database connection
        try {
            $connection = $entityManager->getConnection();
            // Make a simple call to just verify connection
            $connection->getDatabasePlatform();
        } catch (\Exception $e) {
            return new JsonResponse([
                'status' => 'error',
                'message' => 'Database connection failed',
            ], 500);
        }

        // Add other checks as needed
        return new JsonResponse(['status' => 'ok']);
    }
}
