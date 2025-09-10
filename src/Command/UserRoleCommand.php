<?php

namespace App\Command;

use App\Entity\net\exelearning\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:user:role',
    description: 'Manage roles for a user (add/remove/list by email)',
    aliases: ['app:user:promote', 'app:user:demote']
)]
class UserRoleCommand extends Command
{
    public function __construct(private readonly EntityManagerInterface $em)
    {
        parent::__construct();
    }

    /**
     * Configure console arguments and options.
     */
    protected function configure(): void
    {
        $this
            ->addArgument('email', InputArgument::REQUIRED, 'User email')
            ->addOption('add', null, InputOption::VALUE_REQUIRED | InputOption::VALUE_IS_ARRAY, 'Role(s) to add (repeat to add multiple)')
            ->addOption('remove', null, InputOption::VALUE_REQUIRED | InputOption::VALUE_IS_ARRAY, 'Role(s) to remove (repeat to remove multiple)')
            ->addOption('list', null, InputOption::VALUE_NONE, 'List current roles and exit')
            ->addOption('dry-run', null, InputOption::VALUE_NONE, 'Show resulting roles but do not persist');
    }

    /**
     * Execute command to add/remove/list roles for a user.
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $email = (string) $input->getArgument('email');

        /** @var User|null $user */
        $user = $this->em->getRepository(User::class)->findOneBy(['email' => $email]);
        if (!$user) {
            $io->error(sprintf('User not found: %s', $email));

            return Command::FAILURE;
        }

        $roles = array_values(array_unique($user->getRoles()));

        // --list: print and exit early
        if ((bool) $input->getOption('list')) {
            sort($roles);
            $io->writeln(implode("\n", $roles));

            return Command::SUCCESS;
        }

        /** @var string[] $adds */
        $adds = array_map([$this, 'normalizeRole'], (array) $input->getOption('add'));
        /** @var string[] $removes */
        $removes = array_map([$this, 'normalizeRole'], (array) $input->getOption('remove'));

        if (empty($adds) && empty($removes)) {
            $io->error('Provide at least one option: --add ROLE_X or --remove ROLE_Y (or use --list).');

            return Command::INVALID;
        }

        $original = $roles;
        $added = [];
        $removed = [];

        // Apply removals (protect ROLE_USER)
        foreach ($removes as $role) {
            if ('ROLE_USER' === $role) {
                $io->warning('ROLE_USER cannot be removed; skipping.');
                continue;
            }
            if (in_array($role, $roles, true)) {
                $roles = array_values(array_diff($roles, [$role]));
                $removed[] = $role;
            } else {
                $io->note(sprintf('User %s does not have role %s; skipping.', $email, $role));
            }
        }

        // Apply additions
        foreach ($adds as $role) {
            if (!in_array($role, $roles, true)) {
                $roles[] = $role;
                $added[] = $role;
            } else {
                $io->note(sprintf('User %s already has role %s; skipping.', $email, $role));
            }
        }

        // No changes?
        if ($original === $roles) {
            $io->writeln('No changes.');

            return Command::SUCCESS;
        }

        sort($roles);

        if ((bool) $input->getOption('dry-run')) {
            $io->writeln('Dry-run: changes not persisted.');
            $io->writeln('Resulting roles:');
            $io->writeln(implode("\n", $roles));

            return Command::SUCCESS;
        }

        $user->setRoles($roles);
        $this->em->persist($user);
        $this->em->flush();

        if ($added) {
            $io->success(sprintf('Added: %s', implode(', ', $added)));
        }
        if ($removed) {
            $io->success(sprintf('Removed: %s', implode(', ', $removed)));
        }

        return Command::SUCCESS;
    }

    /**
     * Normalize an input into a valid role name.
     * Ensures uppercase and ROLE_ prefix. Strips invalid chars.
     */
    private function normalizeRole(string $role): string
    {
        $role = strtoupper(trim($role));
        if (!str_starts_with($role, 'ROLE_')) {
            $role = 'ROLE_'.$role;
        }
        // Keep only A-Z, 0-9 and underscore
        $role = preg_replace('/[^A-Z0-9_]/', '', $role) ?: 'ROLE_';

        return $role;
    }
}
