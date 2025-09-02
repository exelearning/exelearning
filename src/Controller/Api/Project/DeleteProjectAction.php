<?php

namespace App\Controller\Api\Project;

use App\Entity\net\exelearning\Entity\OdeFiles;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\AsController;

#[AsController]
class DeleteProjectAction extends AbstractController
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function __invoke(string $projectId)
    {
        $repo = $this->em->getRepository(OdeFiles::class);
        $items = $repo->findBy(['odeId' => $projectId]);
        foreach ($items as $it) {
            $this->em->remove($it);
        }
        $this->em->flush();

        return new JsonResponse(null, 204);
    }
}
