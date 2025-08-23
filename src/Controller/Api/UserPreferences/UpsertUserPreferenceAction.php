<?php

namespace App\Controller\Api\UserPreferences;

use App\Entity\net\exelearning\Entity\UserPreferences;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;

#[AsController]
class UpsertUserPreferenceAction extends AbstractController
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    public function __invoke(string $userId, string $key, Request $request)
    {
        $current = $this->getUser();
        $isAdmin = $this->isGranted('ROLE_ADMIN');
        if (!$isAdmin && method_exists($current, 'getUserId') && $current->getUserId() !== $userId) {
            return $this->json(['error' => 'Forbidden'], 403);
        }

        $data = json_decode($request->getContent() ?: '[]', true);
        $value = (string) ($data['value'] ?? '');
        $description = $data['description'] ?? null;

        $repo = $this->em->getRepository(UserPreferences::class);
        $pref = $repo->findOneBy(['userId' => $userId, 'key' => $key]);
        if (!$pref) {
            $pref = new UserPreferences();
            $pref->setUserId($userId)->setKey($key);
        }
        $pref->setValue($value)->setDescription($description);
        $this->em->persist($pref);
        $this->em->flush();

        return $this->json([
            'userId' => $pref->getUserId(),
            'key' => $pref->getKey(),
            'value' => $pref->getValue(),
            'description' => $pref->getDescription(),
        ], 200);
    }
}
