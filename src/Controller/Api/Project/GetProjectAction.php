<?php

namespace App\Controller\Api\Project;

use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\User;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\Project\ProjectPropertiesBuilder;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpKernel\Attribute\AsController;

#[AsController]
class GetProjectAction extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ProjectPropertiesBuilder $propsBuilder,
        private readonly UserHelper $userHelper,
    ) {
    }

    /**
     * Return a project item with embedded properties.
     */
    public function __invoke(string $projectId)
    {
        try {
            $repo = $this->em->getRepository(OdeFiles::class);
            $last = $repo->getLastFileForOde($projectId);
            if (!$last) {
                return $this->json([
                    'title' => 'Project not found',
                    'detail' => 'No project exists with the given id',
                    'type' => '/errors/404',
                ], 404);
            }

            $username = $this->userHelper->getLoggedUserName($this->getUser());
            // Non-admins cannot access others' projects
            if (!$this->isGranted('ROLE_ADMIN') && $last->getUser() !== $username) {
                return $this->json([
                    'title' => 'Forbidden',
                    'detail' => 'You do not have access to this project',
                    'type' => '/errors/403',
                ], 403);
            }
            $properties = $this->propsBuilder->build($projectId, $username);

            // Resolve owner info
            $ownerEmail = (string) $last->getUser();
            $ownerId = null;
            if ('' !== $ownerEmail) {
                $userRepo = $this->em->getRepository(User::class);
                $owner = $userRepo->findOneBy(['email' => $ownerEmail]);
                $ownerId = $owner?->getUserId();
            }

            $payload = [
                'id' => $projectId,
                'odeFilesId' => $last->getId(),
                'odeId' => $projectId,
                'odeVersionId' => $last->getOdeVersionId(),
                'title' => (string) ($last->getTitle() ?? ''),
                'versionName' => $last->getVersionName(),
                'fileName' => (string) ($last->getFileName() ?? ''),
                'size' => (string) $last->getSize(),
                'isManualSave' => (bool) $last->getIsManualSave(),
                'updatedAt' => ['timestamp' => $last->getUpdatedAt()?->getTimestamp()],
                'owner_id' => $ownerId,
                'owner_email' => $ownerEmail,
                'properties' => $properties,
            ];

            return $this->json($payload, 200);
        } catch (\Throwable $e) {
            return $this->json([
                'title' => 'Unexpected error',
                'detail' => $e->getMessage(),
                'type' => '/errors/500',
            ], 500);
        }
    }
}
