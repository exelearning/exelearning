<?php

namespace App\Controller;

use App\Constants;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Repository\net\exelearning\Repository\CurrentOdeUsersRepository;
use App\Service\net\exelearning\Service\Api\OdeExportServiceInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

class ExportController extends AbstractController
{
    private const UNSAVED_SENTINELS = ['default', 'unsaved', 'null', ''];

    public function __construct(
        private readonly CurrentOdeUsersRepository $currentOdeUsersRepository,
        private readonly OdeExportServiceInterface $odeExportService,
        private readonly UserHelper $userHelper,
    ) {
    }

    #[Route(
        '/project/{projectId}/export/single-page-preview',
        name: 'project_export_single_page_preview',
        requirements: ['projectId' => '.+'],
        methods: ['GET']
    )]
    #[IsGranted('ROLE_USER')]
    public function singlePagePreview(Request $request, string $projectId): JsonResponse
    {
        $user = $this->getUser();
        $username = $this->userHelper->getLoggedUserName($user);

        $sessionId = (string) $request->query->get('sessionId', '');
        if ('' === $sessionId) {
            $sessionId = $this->resolveSessionId($projectId, $username);
        }

        if ('' === $sessionId) {
            throw new NotFoundHttpException('Unable to resolve project session.');
        }

        $session = $this->currentOdeUsersRepository->findOneBy(['odeSessionId' => $sessionId]);
        if (null === $session) {
            throw new NotFoundHttpException(sprintf('Session "%s" not found.', $sessionId));
        }

        if (
            !$this->isGranted('ROLE_ADMIN')
            && $session->getUser() !== $username
        ) {
            throw new AccessDeniedHttpException('You do not have access to this project.');
        }

        $sessionProjectId = (string) $session->getOdeId();
        if (
            !$this->isUnsavedProjectToken($projectId)
            && '' !== $sessionProjectId
            && $sessionProjectId !== $projectId
        ) {
            throw new AccessDeniedHttpException('The session does not belong to the requested project.');
        }

        $dbUser = $this->userHelper->getDatabaseUser($user);
        $baseUrl = $request->getBaseURL();
        $tempSuffix = bin2hex(random_bytes(3)).DIRECTORY_SEPARATOR;

        $result = $this->odeExportService->export(
            $user,
            $dbUser,
            $sessionId,
            $baseUrl,
            Constants::EXPORT_TYPE_HTML5_SP,
            true,
            false,
            $tempSuffix
        );

        if (($result['responseMessage'] ?? '') !== 'OK') {
            $message = $result['responseMessage'] ?? 'Unknown error';

            return new JsonResponse(['message' => $message], Response::HTTP_BAD_REQUEST);
        }

        $previewUrl = (string) ($result['urlPreviewIndex'] ?? '');
        if ('' === $previewUrl) {
            return new JsonResponse(['message' => 'Preview URL not available'], Response::HTTP_INTERNAL_SERVER_ERROR);
        }

        $url = $previewUrl.(str_contains($previewUrl, '?') ? '&' : '?').'print=1';

        return new JsonResponse(['url' => $url], Response::HTTP_OK);
    }

    private function resolveSessionId(string $projectId, string $username): string
    {
        if ($this->isUnsavedProjectToken($projectId)) {
            $session = $this->currentOdeUsersRepository->getCurrentSessionForUser($username);

            return $session?->getOdeSessionId() ?? '';
        }

        $sessions = $this->currentOdeUsersRepository->getCurrentUsers($projectId, null, null);
        if (empty($sessions)) {
            return '';
        }
        foreach ($sessions as $session) {
            if ($session->getUser() === $username) {
                return (string) $session->getOdeSessionId();
            }
        }

        $first = $sessions[0];

        return (string) ($first?->getOdeSessionId() ?? '');
    }

    private function isUnsavedProjectToken(string $projectId): bool
    {
        return in_array(strtolower($projectId), self::UNSAVED_SENTINELS, true);
    }
}
