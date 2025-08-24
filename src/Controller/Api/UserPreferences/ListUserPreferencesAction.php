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

        // Resolve numeric ID to the user's userId
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
        // IMPORTANT: user_preferences.user_id stores the numeric PK of users.id
        $prefs = $repo->findBy(['userId' => (string) $targetUser->getId()]);
        $rows = array_map(fn (UserPreferences $p) => [
            'id' => $p->getId(),
            'userId' => $p->getUserId(),
            'key' => $p->getKey(),
            'value' => $p->getValue(),
            'description' => $p->getDescription(),
        ], $prefs);

        return $this->json($rows, 200);
    }
}
