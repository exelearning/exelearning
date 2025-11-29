<?php

namespace App\Service\Project;

use App\Constants;
use App\Dto\Project\PageExportOptions;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Repository\net\exelearning\Repository\CurrentOdeUsersRepository;
use App\Service\net\exelearning\Service\Api\OdeExportServiceInterface;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Security\Core\User\UserInterface;

class PageDownloadService
{
    private const UNSAVED_SENTINELS = ['default', 'unsaved', 'null', ''];

    private const FORMAT_MAP = [
        'elpx' => Constants::EXPORT_TYPE_ELP,
        'elp' => Constants::EXPORT_TYPE_ELP,
        'website' => Constants::EXPORT_TYPE_HTML5,
        'html5' => Constants::EXPORT_TYPE_HTML5,
        'single-page' => Constants::EXPORT_TYPE_HTML5_SP,
        'singlepage' => Constants::EXPORT_TYPE_HTML5_SP,
        'html5-sp' => Constants::EXPORT_TYPE_HTML5_SP,
        'scorm12' => Constants::EXPORT_TYPE_SCORM12,
        'scorm2004' => Constants::EXPORT_TYPE_SCORM2004,
        'ims' => Constants::EXPORT_TYPE_IMS,
        'epub3' => Constants::EXPORT_TYPE_EPUB3,
    ];

    public function __construct(
        private readonly CurrentOdeUsersRepository $currentOdeUsersRepository,
        private readonly OdeExportServiceInterface $odeExportService,
        private readonly UserHelper $userHelper,
        private readonly Security $security,
    ) {
    }

    /**
     * Generate an export payload limited to a single page.
     */
    public function generateDownload(
        UserInterface $user,
        string $projectId,
        string $pageId,
        string $format,
        ?string $sessionId,
        string $baseUrl = '',
    ): array {
        $dbUser = $this->userHelper->getDatabaseUser($user);
        $username = (string) $this->userHelper->getLoggedUserName($user);
        $session = $this->resolveSession($projectId, $username, $sessionId);
        $this->assertUserCanAccessProject($session, $projectId, $username);

        $exportType = $this->normalizeFormat($format);
        $tempSuffix = bin2hex(random_bytes(3)).DIRECTORY_SEPARATOR;
        $base = '' !== $baseUrl ? $baseUrl : false;

        return $this->odeExportService->export(
            $user,
            $dbUser,
            (string) $session->getOdeSessionId(),
            $base,
            $exportType,
            false,
            false,
            $tempSuffix,
            new PageExportOptions([$pageId])
        );
    }

    private function resolveSession(string $projectId, string $username, ?string $preferredSessionId): CurrentOdeUsers
    {
        $sessionId = $preferredSessionId ?: $this->determineSessionId($projectId, $username);
        if ('' === $sessionId) {
            throw new NotFoundHttpException('Unable to resolve project session.');
        }

        $session = $this->currentOdeUsersRepository->findOneBy(['odeSessionId' => $sessionId]);
        if (!$session) {
            throw new NotFoundHttpException(sprintf('Session "%s" not found.', $sessionId));
        }

        return $session;
    }

    private function determineSessionId(string $projectId, string $username): string
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

    private function assertUserCanAccessProject(CurrentOdeUsers $session, string $projectId, string $username): void
    {
        if (
            !$this->security->isGranted('ROLE_ADMIN')
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
    }

    private function normalizeFormat(string $format): string
    {
        $key = strtolower(trim($format));
        if (!isset(self::FORMAT_MAP[$key])) {
            throw new \InvalidArgumentException(sprintf('Unsupported export format "%s".', $format));
        }

        return self::FORMAT_MAP[$key];
    }

    private function isUnsavedProjectToken(string $projectId): bool
    {
        return in_array(strtolower($projectId), self::UNSAVED_SENTINELS, true);
    }
}
