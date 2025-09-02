<?php

namespace App\Controller\Api\Project;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;

class GetDocumentStructureAction extends AbstractController
{
    public function __invoke(string $projectId, string $documentId): array
    {
        return [
            'projectId' => $projectId,
            'documentId' => $documentId,
            'structure' => $this->service->getDocumentStructure($projectId, $documentId),
        ];
    }
}
