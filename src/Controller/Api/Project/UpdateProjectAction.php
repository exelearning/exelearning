<?php

namespace App\Controller\Api\Project;

use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\Project\ProjectProperty;
use App\Helper\net\exelearning\Helper\UserHelper;
use App\Service\Project\ProjectPropertiesBuilder;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;

#[AsController]
class UpdateProjectAction extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly ProjectPropertiesBuilder $propsBuilder,
        private readonly UserHelper $userHelper,
    ) {
    }

    /**
     * Update project title and/or properties; returns updated item with properties.
     */
    public function __invoke(string $projectId, Request $request)
    {
        try {
            $data = json_decode($request->getContent() ?: '[]', true);
            if (!is_array($data)) {
                $data = [];
            }
            $title = $data['title'] ?? null;
            $propertiesToUpdate = isset($data['properties']) && is_array($data['properties']) ? $data['properties'] : [];

            $repo = $this->em->getRepository(OdeFiles::class);
            $last = $repo->getLastFileForOde($projectId);
            if (!$last) {
                return $this->json([
                    'title' => 'Project not found',
                    'detail' => 'No project exists with the given id',
                    'type' => '/errors/404',
                ], 404);
            }

            // Reflect title from explicit field or from properties.pp_title
            $titleToSet = null;
            if (null !== $title) {
                $titleToSet = (string) $title;
            } elseif (isset($propertiesToUpdate['pp_title'])) {
                $titleToSet = (string) $propertiesToUpdate['pp_title'];
            }
            if (null !== $titleToSet) {
                $last->setTitle($titleToSet);
                $this->em->persist($last);
            }

            // Upsert provided properties into v2 store
            if ($propertiesToUpdate) {
                $ppRepo = $this->em->getRepository(ProjectProperty::class);
                foreach ($propertiesToUpdate as $key => $value) {
                    if (is_bool($value)) {
                        $storedValue = $value ? 'true' : 'false';
                    } elseif (is_scalar($value)) {
                        $storedValue = (string) $value;
                    } else {
                        $storedValue = json_encode($value, JSON_UNESCAPED_UNICODE);
                    }
                    $ppRepo->upsert($projectId, (string) $key, (string) $storedValue);
                }
            }

            $this->em->flush();

            // Recalculate properties and return full payload
            $username = $this->userHelper->getLoggedUserName($this->getUser());
            $properties = $this->propsBuilder->build($projectId, $username);

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
