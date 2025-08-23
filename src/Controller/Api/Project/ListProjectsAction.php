<?php

namespace App\Controller\Api\Project;

use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Helper\net\exelearning\Helper\UserHelper;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpKernel\Attribute\AsController;

#[AsController]
class ListProjectsAction extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly UserHelper $userHelper,
    ) {
    }

    public function __invoke()
    {
        $user = $this->getUser();
        $username = $this->userHelper->getLoggedUserName($user);

        $repo = $this->em->getRepository(OdeFiles::class);
        // Fetch all user files
        $items = $repo->listOdeFilesByUser($username, false);

        // Group by odeId and pick the most recent record per project
        $byProject = [];
        foreach ($items as $it) {
            $key = $it->getOdeId();
            $current = $byProject[$key] ?? null;
            if (!$current || ($it->getUpdatedAt()?->getTimestamp() ?? 0) > ($current->getUpdatedAt()?->getTimestamp() ?? 0)) {
                $byProject[$key] = $it;
            }
        }

        $projects = [];
        foreach ($byProject as $odeId => $it) {
            $projects[] = [
                'id' => $odeId,
                'odeId' => $odeId,
                'odeVersionId' => $it->getOdeVersionId(),
                'title' => (string) $it->getTitle(),
                'versionName' => $it->getVersionName(),
                'fileName' => (string) $it->getFileName(),
                'size' => (string) $it->getSize(),
                'isManualSave' => (bool) $it->getIsManualSave(),
                'updatedAt' => ['timestamp' => $it->getUpdatedAt()?->getTimestamp()],
            ];
        }

        usort($projects, fn ($a, $b) => (($b['updatedAt']['timestamp'] ?? 0) <=> ($a['updatedAt']['timestamp'] ?? 0)));

        return $this->json($projects, 200);
    }
}
