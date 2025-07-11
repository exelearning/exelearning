<?php

namespace App\Controller\net\exelearning\Controller\Api;

use App\Constants;

/*
use App\Service\net\exelearning\Service\Api\ResourceLockService;
use Doctrine\ORM\EntityManagerInterface;
use Psr\Log\LoggerInterface;
use Symfony\Component\Mercure\Update;
use Symfony\Component\HttpFoundation\Request;
*/

use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;

// ResourceLockApiController.
#[Route('/api/resource-lock')]
class ResourceLockApiController extends DefaultApiController
{
    /*
    private ResourceLockService $resourceLockService;

    public function __construct(
        EntityManagerInterface $entityManager,
        LoggerInterface $logger,
        ResourceLockService $resourceLockService
    ) {
        parent::__construct($entityManager, $logger);

        $this->resourceLockService = $resourceLockService;
    }
    */

    /**
     * GET /api/resource-lock/get/timeout
     * Returns the resource lock timeout duration in seconds
     */
    #[Route('/get/timeout', methods: ['GET'], name: 'api_resource_lock_timeout')]
    public function getResourceLockTimeout(): Response
    {
        return new Response(
            (string) Constants::RESOURCE_LOCK_TIMEOUT_SECONDS,
            Response::HTTP_OK,
            ['Content-Type' => 'text/plain']
        );
    }
}