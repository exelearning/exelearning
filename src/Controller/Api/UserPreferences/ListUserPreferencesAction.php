<?php

namespace App\Controller\Api\UserPreferences;

use App\Entity\net\exelearning\Entity\UserPreferences;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpKernel\Attribute\AsController;

#[AsController]
class ListUserPreferencesAction extends AbstractController
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function __invoke(string $userId)
    {
        $current = $this->getUser();
        $isAdmin = $this->isGranted('ROLE_ADMIN');
        if (!$isAdmin && method_exists($current, 'getUserId') && $current->getUserId() !== $userId) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $repo = $this->em->getRepository(UserPreferences::class);
        $prefs = $repo->findBy(['userId' => $userId]);
        $rows = array_map(fn (UserPreferences $p) => [
            'userId' => $p->getUserId(),
            'key' => $p->getKey(),
            'value' => $p->getValue(),
            'description' => $p->getDescription(),
        ], $prefs);

        return $this->json($rows, 200);
    }
}
