<?php

namespace App\Controller\Api\Project;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;

class UpdateDocumentStructureAction extends AbstractController
{
    public function __invoke(string $projectId, string $documentId, Request $request): array
    {
        $payload = json_decode($request->getContent(), true) ?? [];
        $structure = $payload;
        $saved = $this->service->setDocumentStructure($projectId, $documentId, $structure);

        return [
            'projectId' => $projectId,
            'documentId' => $documentId,
            'structure' => $saved,
            'status' => 'updated',
        ];
    }
}
