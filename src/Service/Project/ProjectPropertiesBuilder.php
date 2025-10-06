<?php

namespace App\Service\Project;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\OdePropertiesSync;
use App\Entity\Project\ProjectProperty;
use App\Entity\Project\ProjectPropertyRepository;
use App\Repository\net\exelearning\Repository\OdeFilesRepository;
use App\Settings;
use Doctrine\ORM\EntityManagerInterface;

class ProjectPropertiesBuilder
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
    }

    /**
     * Build the properties map for a project.
     * Prefer v2 store; fallback to legacy sync table using most recent session.
     * If a username is provided, prefer that user's current session for the project.
     */
    public function build(string $projectId, ?string $username = null): array
    {
        $props = [];

        /** @var OdeFilesRepository $odeRepo */
        $odeRepo = $this->em->getRepository(OdeFiles::class);
        $last = $odeRepo->getLastFileForOde($projectId);
        if (null === $last) {
            throw new \RuntimeException('Project not found');
        }

        /** @var ProjectPropertyRepository $ppRepo */
        $ppRepo = $this->em->getRepository(ProjectProperty::class);
        $stored = $ppRepo->findBy(['odeId' => $projectId]);
        if ($stored) {
            foreach ($stored as $p) {
                $val = $p->getValue();
                $decoded = json_decode($val, true);
                $props[$p->getKey()] = (JSON_ERROR_NONE === json_last_error()) ? $decoded : $val;
            }
        } else {
            // Fallback to legacy session-scope table using most recent session id
            $sessionId = null;
            $cuRepo = $this->em->getRepository(CurrentOdeUsers::class);
            $sessions = $cuRepo->getCurrentUsers($projectId, null, null);
            if ($sessions) {
                if ($username) {
                    foreach ($sessions as $s) {
                        if ($s->getUser() === $username) {
                            $sessionId = $s->getOdeSessionId();
                            break;
                        }
                    }
                }
                if (!$sessionId) {
                    $sessionId = $sessions[0]->getOdeSessionId();
                }
            }
            if ($sessionId) {
                $opsRepo = $this->em->getRepository(OdePropertiesSync::class);
                $legacy = $opsRepo->findBy(['odeSessionId' => $sessionId]);
                foreach ($legacy as $p) {
                    $val = $p->getValue();
                    $decoded = json_decode($val, true);
                    $props[$p->getKey()] = (JSON_ERROR_NONE === json_last_error()) ? $decoded : $val;
                }
            }
        }

        // Title and language defaults
        if (!isset($props['pp_title'])) {
            $props['pp_title'] = $last->getTitle() ?: 'Untitled document';
        }
        if (!isset($props['pp_lang'])) {
            $props['pp_lang'] = Settings::DEFAULT_LOCALE;
        }

        // Ensure common defaults exist
        $defaults = [
            'pp_author' => '',
            'pp_license' => '',
            'pp_description' => '',
            'exportSource' => false,
            'pp_addExeLink' => false,
            'pp_exportElp' => false,
            'pp_addPagination' => false,
            'pp_addSearchBox' => false,
            'pp_addAccessibilityToolbar' => false,
            'pp_extraHeadContent' => '',
            'footer' => '',
        ];
        foreach ($defaults as $k => $v) {
            if (!array_key_exists($k, $props)) {
                $props[$k] = $v;
            }
        }

        return $props;
    }
}
