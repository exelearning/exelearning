<?php

namespace App\Controller\Api\Project\Pages;

use App\Exception\net\exelearning\Exception\Logical\UserInsufficientSpaceException;
use App\Service\Project\PageDownloadService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Core\User\UserInterface;

#[AsController]
#[Route('/api/v2/projects/{projectId}/pages/{pageId}/download', name: 'api_v2_projects_pages_download', methods: ['POST'])]
class DownloadPageAction extends AbstractController
{
    public function __construct(private readonly PageDownloadService $pageDownloadService)
    {
    }

    public function __invoke(string $projectId, string $pageId, Request $request): JsonResponse
    {
        $user = $this->requireUser();

        try {
            $payload = $this->extractPayload($request);
            $format = (string) ($payload['format'] ?? 'elpx');
            $sessionId = isset($payload['sessionId']) ? (string) $payload['sessionId'] : null;

            $result = $this->pageDownloadService->generateDownload(
                $user,
                $projectId,
                $pageId,
                $format,
                $sessionId,
                (string) $request->getBaseURL()
            );

            return $this->json($result, Response::HTTP_OK);
        } catch (BadRequestHttpException $e) {
            return $this->json([
                'title' => 'Bad Request',
                'detail' => $e->getMessage(),
                'type' => '/errors/400',
            ], Response::HTTP_BAD_REQUEST);
        } catch (AccessDeniedHttpException $e) {
            return $this->json([
                'title' => 'Forbidden',
                'detail' => $e->getMessage(),
                'type' => '/errors/403',
            ], Response::HTTP_FORBIDDEN);
        } catch (NotFoundHttpException|\InvalidArgumentException $e) {
            return $this->json([
                'title' => 'Not Found',
                'detail' => $e->getMessage(),
                'type' => '/errors/404',
            ], Response::HTTP_NOT_FOUND);
        } catch (UserInsufficientSpaceException $e) {
            $message = sprintf(
                'Insufficient space for export. Required: %s, available: %s.',
                $e->getRequiredSpace(),
                $e->getAvailableSpace()
            );

            return $this->json([
                'title' => 'Export failed',
                'detail' => $message,
                'type' => '/errors/400',
            ], Response::HTTP_BAD_REQUEST);
        } catch (\Throwable $e) {
            return $this->json([
                'title' => 'Unexpected error',
                'detail' => $e->getMessage(),
                'type' => '/errors/500',
            ], Response::HTTP_INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function extractPayload(Request $request): array
    {
        $data = [];
        if ('' !== (string) $request->getContent()) {
            try {
                $data = $request->toArray();
            } catch (\Throwable $e) {
                throw new BadRequestHttpException('Invalid JSON payload.');
            }
        }

        return array_merge(
            $request->query->all(),
            $request->request->all(),
            $data
        );
    }

    private function toBool(mixed $value): bool
    {
        if (\is_bool($value)) {
            return $value;
        }

        if (null === $value) {
            return false;
        }

        $value = strtolower(trim((string) $value));

        return !in_array($value, ['0', 'false', ''], true);
    }

    private function requireUser(): UserInterface
    {
        $user = $this->getUser();
        if (!$user instanceof UserInterface) {
            throw new AccessDeniedHttpException('Authentication required.');
        }

        return $user;
    }
}
