<?php

namespace App\Controller\Api\Project;

use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\User;
use App\Helper\net\exelearning\Helper\UserHelper;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;

#[AsController]
class ListProjectsAction extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly UserHelper $userHelper,
    ) {
    }

    public function __invoke(Request $request)
    {
        $user = $this->getUser();
        $username = $this->userHelper->getLoggedUserName($user);

        $repo = $this->em->getRepository(OdeFiles::class);
        // If admin, fetch all files; otherwise, only user's files
        if ($this->isGranted('ROLE_ADMIN')) {
            $items = $repo->findBy([], ['updatedAt' => 'DESC']);
        } else {
            // Fetch all user files
            $items = $repo->listOdeFilesByUser($username, false);
        }

        // Group by odeId and pick the most recent record per project
        $byProject = [];
        foreach ($items as $it) {
            $key = $it->getOdeId();
            $current = $byProject[$key] ?? null;
            if (!$current || ($it->getUpdatedAt()?->getTimestamp() ?? 0) > ($current->getUpdatedAt()?->getTimestamp() ?? 0)) {
                $byProject[$key] = $it;
            }
        }

        // Build map email -> ownerId (userId) to enrich results with owner data
        $emails = [];
        foreach ($byProject as $it) {
            $email = (string) $it->getUser();
            if ('' !== $email) {
                $emails[$email] = true;
            }
        }

        $ownerIdByEmail = [];
        if (!empty($emails)) {
            $userRepo = $this->em->getRepository(User::class);
            $dbUsers = $userRepo->findBy(['email' => array_keys($emails)]);
            foreach ($dbUsers as $dbUser) {
                $ownerIdByEmail[$dbUser->getEmail()] = $dbUser->getUserId();
            }
        }

        $projects = [];
        foreach ($byProject as $odeId => $it) {
            $ownerEmail = (string) $it->getUser();
            $projects[] = [
                'id' => $odeId,
                'odeId' => $odeId,
                'odeVersionId' => $it->getOdeVersionId(),
                'title' => (string) $it->getTitle(),
                'versionName' => $it->getVersionName(),
                'fileName' => (string) $it->getFileName(),
                'size' => (string) $it->getSize(),
                'isManualSave' => (bool) $it->getIsManualSave(),
                'updatedAt' => ['timestamp' => $it->getUpdatedAt()?->getTimestamp()],
                // Owner fields to always include for filtering
                'owner_id' => $ownerIdByEmail[$ownerEmail] ?? null,
                'owner_email' => $ownerEmail,
            ];
        }

        // Apply filters from query parameters
        $qp = $request->query;
        $isAdmin = $this->isGranted('ROLE_ADMIN');

        $id = $qp->get('id');
        $title = $qp->get('title');
        $titleLike = $qp->get('title_like');
        $updatedAfter = $qp->get('updated_after');
        $updatedBefore = $qp->get('updated_before');
        $search = $qp->get('search');
        $ownerId = $qp->get('owner_id');
        $ownerEmail = $qp->get('owner_email');

        $projects = array_values(array_filter($projects, function (array $p) use ($id, $title, $titleLike, $updatedAfter, $updatedBefore, $search, $ownerId, $ownerEmail, $isAdmin) {
            // id exact
            if (null !== $id && '' !== $id && ($p['id'] ?? null) !== $id) {
                return false;
            }
            // title exact
            if (null !== $title && '' !== $title && ($p['title'] ?? null) !== $title) {
                return false;
            }
            // title_like contains (case-insensitive)
            if (null !== $titleLike && '' !== $titleLike) {
                $hay = mb_strtolower((string) ($p['title'] ?? ''));
                $nee = mb_strtolower((string) $titleLike);
                if (!str_contains($hay, $nee)) {
                    return false;
                }
            }
            // updated_after
            if (null !== $updatedAfter && '' !== $updatedAfter) {
                $ts = (int) $updatedAfter;
                if ((int) ($p['updatedAt']['timestamp'] ?? 0) <= $ts) {
                    return false;
                }
            }
            // updated_before
            if (null !== $updatedBefore && '' !== $updatedBefore) {
                $ts = (int) $updatedBefore;
                if ((int) ($p['updatedAt']['timestamp'] ?? 0) >= $ts) {
                    return false;
                }
            }
            // search: global in id, title, fileName (case-insensitive)
            if (null !== $search && '' !== $search) {
                $needle = mb_strtolower((string) $search);
                $fields = [
                    mb_strtolower((string) ($p['id'] ?? '')),
                    mb_strtolower((string) ($p['title'] ?? '')),
                    mb_strtolower((string) ($p['fileName'] ?? '')),
                ];
                $ok = false;
                foreach ($fields as $f) {
                    if ('' !== $f && str_contains($f, $needle)) {
                        $ok = true;
                        break;
                    }
                }
                if (!$ok) {
                    return false;
                }
            }
            // owner filters only meaningful for admins; non-admins already restricted
            if ($isAdmin) {
                if (null !== $ownerId && '' !== $ownerId && ($p['owner_id'] ?? null) !== $ownerId) {
                    return false;
                }
                if (null !== $ownerEmail && '' !== $ownerEmail && ($p['owner_email'] ?? null) !== $ownerEmail) {
                    return false;
                }
            }

            return true;
        }));

        usort($projects, fn ($a, $b) => (($b['updatedAt']['timestamp'] ?? 0) <=> ($a['updatedAt']['timestamp'] ?? 0)));

        return $this->json($projects, 200);
    }
}
