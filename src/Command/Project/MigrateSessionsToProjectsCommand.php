<?php

namespace App\Command\Project;

use App\Entity\net\exelearning\Entity\CurrentOdeUsers;
use App\Entity\net\exelearning\Entity\OdeFiles;
use App\Entity\net\exelearning\Entity\OdePropertiesSync;
use App\Entity\net\exelearning\Entity\User;
use App\Entity\Project\Project;
use App\Entity\Project\ProjectCollaborator;
use App\Entity\Project\ProjectProperty;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

/**
 * Migrates session-based data to project-oriented architecture.
 */
#[AsCommand(
    name: 'app:migrate-sessions-to-projects',
    description: 'Migrates existing session-based data to the new project-oriented architecture',
    hidden: false
)]
class MigrateSessionsToProjectsCommand extends Command
{
    private EntityManagerInterface $entityManager;

    public function __construct(EntityManagerInterface $entityManager)
    {
        $this->entityManager = $entityManager;
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addOption(
                'dry-run',
                null,
                InputOption::VALUE_NONE,
                'Perform a dry run without persisting changes'
            )
            ->addOption(
                'force',
                'f',
                InputOption::VALUE_NONE,
                'Force migration even if projects already exist'
            );
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $dryRun = $input->getOption('dry-run');
        $force = $input->getOption('force');

        $io->title('Migrating Sessions to Projects');

        if ($dryRun) {
            $io->note('DRY RUN MODE - No changes will be persisted');
        }

        // Check if projects already exist
        $projectRepo = $this->entityManager->getRepository(Project::class);
        $existingProjects = $projectRepo->findAll();

        if (count($existingProjects) > 0 && !$force) {
            $io->warning(sprintf(
                'Found %d existing projects. Use --force to re-run migration.',
                count($existingProjects)
            ));

            return Command::FAILURE;
        }

        $odeFilesRepo = $this->entityManager->getRepository(OdeFiles::class);
        $userRepo = $this->entityManager->getRepository(User::class);
        $currentOdeUsersRepo = $this->entityManager->getRepository(CurrentOdeUsers::class);
        $odePropertiesSyncRepo = $this->entityManager->getRepository(OdePropertiesSync::class);
        $projectPropertyRepo = $this->entityManager->getRepository(ProjectProperty::class);

        // Get all OdeFiles and extract unique odeIds
        $allFiles = $odeFilesRepo->findAll();
        $odeIdMap = [];
        foreach ($allFiles as $file) {
            $odeIdMap[$file->getOdeId()] = true;
        }
        $uniqueOdeIds = array_keys($odeIdMap);

        $io->section(sprintf('Found %d unique projects to migrate', count($uniqueOdeIds)));

        $projectsCreated = 0;
        $projectsSkipped = 0;
        $collaboratorsCreated = 0;
        $propertiesMigrated = 0;

        $io->progressStart(count($uniqueOdeIds));

        foreach ($uniqueOdeIds as $odeId) {
            // Check if project already exists
            $existingProject = $projectRepo->find($odeId);
            if ($existingProject) {
                ++$projectsSkipped;
                $io->progressAdvance();
                continue;
            }

            // Get the latest file for this odeId to extract metadata
            $latestFile = $odeFilesRepo->getLastFileForOde($odeId);
            if (!$latestFile) {
                $io->warning("No file found for odeId: $odeId, skipping");
                ++$projectsSkipped;
                $io->progressAdvance();
                continue;
            }

            // Find the owner user
            $ownerEmail = $latestFile->getUser();
            $owner = $userRepo->findOneBy(['email' => $ownerEmail]);

            if (!$owner) {
                $io->warning("Owner not found for email: $ownerEmail (odeId: $odeId), skipping");
                ++$projectsSkipped;
                $io->progressAdvance();
                continue;
            }

            // Create the Project
            $project = new Project();
            $project->setId($odeId);
            $project->setTitle($latestFile->getTitle() ?: 'Untitled Project');
            $project->setVisibility('private'); // Default to private
            $project->setOwner($owner);
            $project->setCreatedAt($latestFile->getCreatedAt() ?: new \DateTime());
            $project->setLastAccessedAt($latestFile->getUpdatedAt());
            $project->setArchived(false);

            if (!$dryRun) {
                $this->entityManager->persist($project);
            }
            ++$projectsCreated;

            // Create owner collaborator record
            $collaborator = new ProjectCollaborator();
            $collaborator->setProject($project);
            $collaborator->setUser($owner);
            $collaborator->setRole(ProjectCollaborator::ROLE_OWNER);
            $collaborator->setGrantedAt($project->getCreatedAt());

            if (!$dryRun) {
                $this->entityManager->persist($collaborator);
            }
            ++$collaboratorsCreated;

            // Migrate properties from session to project scope
            // Find any session for this project
            $sessions = $currentOdeUsersRepo->findBy(['odeId' => $odeId], ['lastAction' => 'DESC'], 1);
            if (count($sessions) > 0) {
                $session = $sessions[0];
                $sessionId = $session->getOdeSessionId();

                // Get session properties
                $sessionProps = $odePropertiesSyncRepo->findBy(['odeSessionId' => $sessionId]);

                foreach ($sessionProps as $prop) {
                    // Check if property already exists in project scope
                    $existingProp = $projectPropertyRepo->findOneBy([
                        'odeId' => $odeId,
                        'key' => $prop->getKey(),
                    ]);

                    if (!$existingProp) {
                        $projectProp = new ProjectProperty();
                        $projectProp->setOdeId($odeId);
                        $projectProp->setKey($prop->getKey());
                        $projectProp->setValue($prop->getValue());
                        $projectProp->setUpdatedAt(new \DateTime());

                        if (!$dryRun) {
                            $this->entityManager->persist($projectProp);
                        }
                        ++$propertiesMigrated;
                    }
                }
            }

            $io->progressAdvance();
        }

        $io->progressFinish();

        if (!$dryRun) {
            $this->entityManager->flush();
        }

        $io->success('Migration completed!');

        $io->table(
            ['Metric', 'Count'],
            [
                ['Projects created', $projectsCreated],
                ['Projects skipped', $projectsSkipped],
                ['Collaborators created', $collaboratorsCreated],
                ['Properties migrated', $propertiesMigrated],
            ]
        );

        if ($dryRun) {
            $io->note('This was a DRY RUN. Run without --dry-run to persist changes.');
        }

        return Command::SUCCESS;
    }
}
