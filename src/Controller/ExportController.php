<?php

namespace App\Controller;

use App\Helper\net\exelearning\Helper\UserHelper;
use App\Repository\net\exelearning\Repository\OdeFilesRepository;
use App\Service\PrintDocumentBuilder;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

class ExportController extends AbstractController
{
    public function __construct(
        private readonly OdeFilesRepository $odeFilesRepository,
        private readonly PrintDocumentBuilder $builder,
        private readonly UserHelper $userHelper,
    ) {
    }

    #[Route('/project/{projectId}/print', name: 'project_print', requirements: ['projectId' => '.+'], methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function print(string $projectId): Response
    {
        $user = $this->getUser();
        $username = $this->userHelper->getLoggedUserName($user);

        $file = $this->odeFilesRepository->getLastFileForOde($projectId);
        if (!$file) {
            throw new NotFoundHttpException('Project not found');
        }

        if (!$this->isGranted('ROLE_ADMIN') && $file->getUser() !== $username) {
            throw new AccessDeniedHttpException('You do not have access to this project');
        }

        try {
            $document = $this->builder->build($projectId, $username);
        } catch (\InvalidArgumentException $exception) {
            throw new NotFoundHttpException($exception->getMessage(), $exception);
        }

        return $this->render('export/print.html.twig', [
            'document' => $document,
        ]);
    }
}
