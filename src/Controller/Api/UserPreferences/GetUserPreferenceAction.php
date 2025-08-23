<?php

namespace App\Controller\Api\UserPreferences;

use App\Entity\net\exelearning\Entity\UserPreferences;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpKernel\Attribute\AsController;

#[AsController]
class GetUserPreferenceAction extends AbstractController
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function __invoke(string $userId, string $key)
    {
        $current = $this->getUser();
        $isAdmin = $this->isGranted('ROLE_ADMIN');
        if (!$isAdmin && method_exists($current, 'getUserId') && $current->getUserId() !== $userId) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $repo = $this->em->getRepository(UserPreferences::class);
        $pref = $repo->findOneBy(['userId' => $userId, 'key' => $key]);
        if (!$pref) {
            return $this->json(['error' => 'Not found'], 404);
        }

        return $this->json([
            'userId' => $pref->getUserId(),
            'key' => $pref->getKey(),
            'value' => $pref->getValue(),
            'description' => $pref->getDescription(),
        ], 200);
    }
}
