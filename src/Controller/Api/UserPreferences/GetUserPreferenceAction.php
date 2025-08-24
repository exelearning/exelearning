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

        $targetUser = null;
        if (ctype_digit($userId)) {
            $targetUser = $this->em->getRepository(\App\Entity\net\exelearning\Entity\User::class)->find((int) $userId);
            if (!$targetUser) {
                return $this->json(['error' => 'Not found'], 404);
            }
        } else {
            $targetUser = $this->em->getRepository(\App\Entity\net\exelearning\Entity\User::class)->findOneBy(['userId' => $userId]);
            if (!$targetUser) {
                return $this->json(['error' => 'Not found'], 404);
            }
        }

        if (!$isAdmin && $current && method_exists($current, 'getId')) {
            if (!$targetUser || $current->getId() !== $targetUser->getId()) {
                return $this->json(['error' => 'Forbidden'], 403);
            }
        }

        $repo = $this->em->getRepository(UserPreferences::class);
        $pref = $repo->findOneBy(['userId' => (string) $targetUser->getId(), 'key' => $key]);
        if (!$pref) {
            return $this->json(['error' => 'Not found'], 404);
        }

        return $this->json([
            'id' => $pref->getId(),
            'userId' => $pref->getUserId(),
            'key' => $pref->getKey(),
            'value' => $pref->getValue(),
            'description' => $pref->getDescription(),
        ], 200);
    }
}
