<?php

namespace App\Controller\Api\Project;

use App\Constants;
use App\Entity\net\exelearning\Dto\CurrentOdeUsersDto;
use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\net\exelearning\Service\Api\CurrentOdeUsersServiceInterface;
use App\Util\net\exelearning\Util\Util;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;

#[AsController]
class GetCurrentProjectAction extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly UserHelper $userHelper,
        private readonly CurrentOdeUsersServiceInterface $currentOdeUsersService,
    ) {
    }

    public function __invoke(Request $request)
    {
        $user = $this->getUser();
        $databaseUser = $this->userHelper->getDatabaseUser($user);

        $repo = $this->entityManager->getRepository(CurrentOdeUsers::class);

        // Ensure we persist the default theme for first time users (legacy behaviour).
        $this->userHelper->saveUserTheme($user, Constants::THEME_DEFAULT);

        $requestedSessionId = $request->query->get('odeSessionId');
        $forceNewSession = filter_var(
            $request->query->get('forceNewSession'),
            FILTER_VALIDATE_BOOL
        );

        $currentSession = null;
        if (!$forceNewSession || $requestedSessionId) {
            $currentSession = $repo->getCurrentSessionForUser(
                $databaseUser->getUserIdentifier(),
                $requestedSessionId
            );
        }
        $isNewSession = false;
        $isAlreadyLoggedAndLastUser = false;

        if (!$currentSession) {
            if ($requestedSessionId) {
                return $this->json([
                    'responseMessage' => 'SESSION_NOT_FOUND',
                    'detail' => 'No active session matches the requested identifier',
                ], 404);
            }
            $odeId = Util::generateId();
            $odeVersionId = Util::generateId();
            $odeSessionId = Util::generateId();

            $clientIp = $request->getClientIp() ?? '127.0.0.1';

            $currentSession = $this->currentOdeUsersService->createCurrentOdeUsers(
                $odeId,
                $odeVersionId,
                $odeSessionId,
                $databaseUser,
                $clientIp
            );
            $isNewSession = true;
        } else {
            $isLastUser = $this->currentOdeUsersService->isLastUser(
                $user,
                null,
                null,
                $currentSession->getOdeSessionId()
            );

            if ($isLastUser && $currentSession->getLastAction()) {
                $userLastAction = $currentSession->getLastAction()->getTimestamp();
                $timeNow = time();
                $elapsed = $timeNow - $userLastAction;

                if (Constants::MODAL_CLIENT_ALREADY_LOGGED_USER_TIME <= $elapsed) {
                    $isAlreadyLoggedAndLastUser = true;
                }
            }
        }

        $payload = [
            'responseMessage' => 'OK',
            'currentOdeUsers' => null,
            'isNewSession' => $isNewSession,
            'isAlreadyLoggedAndLastUser' => $isAlreadyLoggedAndLastUser,
        ];

        if ($currentSession) {
            $dto = new CurrentOdeUsersDto();
            $dto->loadFromEntity($currentSession);
            $payload['currentOdeUsers'] = $dto->toArray();
        }

        return $this->json($payload, 200);
    }
}
