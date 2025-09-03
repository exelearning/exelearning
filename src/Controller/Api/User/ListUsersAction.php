<?php

namespace App\Controller\Api\User;

use App\Entity\net\exelearning\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Annotation\Route;

#[AsController]
class ListUsersAction extends AbstractController
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    #[Route('/api/v2/users', name: 'api_v2_users_list_override', methods: ['GET'])]
    public function __invoke(Request $request): JsonResponse
    {
        $repo = $this->em->getRepository(User::class);

        $logged = $this->getUser();
        $isAdmin = $this->isGranted('ROLE_ADMIN');

        if (!$isAdmin) {
            // Resolve current DB user by identifier
            $email = null;
            if ($logged instanceof User) {
                $email = $logged->getEmail();
            } elseif ($logged && method_exists($logged, 'getUserIdentifier')) {
                $email = (string) $logged->getUserIdentifier();
            }
            if (!$email) {
                return $this->json([], 200);
            }
            $user = $repo->findOneBy(['email' => $email]);
            if (!$user) {
                return $this->json([], 200);
            }

            return $this->json([$this->toArray($user)], 200);
        }

        // Admin: support filters similar to ApiFilters used elsewhere
        $qb = $repo->createQueryBuilder('u');

        $email = $request->query->get('email');
        $role = $request->query->get('role');
        $search = $request->query->get('search');

        if (null !== $email && '' !== $email) {
            $qb->andWhere('u.email = :email')->setParameter('email', $email);
        }
        if (null !== $role && '' !== $role) {
            $qb->andWhere('u.roles LIKE :role')->setParameter('role', '%'.$role.'%');
        }
        if (null !== $search && '' !== $search) {
            $qb->andWhere($qb->expr()->orX(
                $qb->expr()->like('u.email', ':q'),
                $qb->expr()->like('u.userId', ':q')
            ))->setParameter('q', '%'.$search.'%');
        }

        $qb->orderBy('u.id', 'ASC');
        $rows = $qb->getQuery()->getResult();

        $out = array_map(fn (User $u) => $this->toArray($u), $rows);

        return $this->json($out, 200);
    }

    private function toArray(User $user): array
    {
        return [
            'externalIdentifier' => $user->getExternalIdentifier(),
            'email' => $user->getEmail(),
            'roles' => $user->getRoles(),
            'userId' => $user->getUserId(),
            'isLopdAccepted' => $user->getIsLopdAccepted(),
            'id' => $user->getId(),
            'gravatarUrl' => $user->getGravatarUrl(),
        ];
    }
}
