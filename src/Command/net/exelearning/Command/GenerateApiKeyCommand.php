<?php

namespace App\Command\net\exelearning\Command;

use App\Entity\net\exelearning\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Uid\Uuid;

#[AsCommand(
    name: 'app:generate-api-key',
    description: 'Generates a random API key for the specified user.',
    hidden: false
)]
class GenerateApiKeyCommand extends Command
{
    private EntityManagerInterface $entityManager;
    private UserPasswordHasherInterface $passwordHasher;

    public function __construct(EntityManagerInterface $entityManager, UserPasswordHasherInterface $passwordHasher)
    {
        $this->entityManager = $entityManager;
        $this->passwordHasher = $passwordHasher;

        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('user_id', InputArgument::REQUIRED, 'The ID of the user to generate the API key for.')
            ->addOption('overwrite', null, InputOption::VALUE_NONE, 'Overwrite the API key if it already exists.');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $userId = $input->getArgument('user_id');
        $overwrite = $input->getOption('overwrite');

        $userRepository = $this->entityManager->getRepository(User::class);
        /** @var User|null $user */
        $user = $userRepository->findOneBy(['userId' => $userId]); // Adjusted to find by userId as per CreateUserCommand example context

        if (!$user) {
            // Try finding by email if userId was actually an email
            $user = $userRepository->findOneBy(['email' => $userId]);
            if (!$user) {
                // Try finding by database ID if userId was an integer id
                if (ctype_digit($userId)) {
                    $user = $userRepository->find((int) $userId);
                }
            }
        }

        if (!$user) {
            $io->error(sprintf('User with ID/email "%s" not found.', $userId));

            return Command::FAILURE;
        }

        if ($user->getApiToken() && !$overwrite) {
            $io->error('User already has an API token. Use --overwrite to replace it.');

            return Command::FAILURE;
        }

        $apiKey = Uuid::v4()->toRfc4122();
        $hashedApiKey = $this->passwordHasher->hashPassword($user, $apiKey);
        $user->setApiToken($hashedApiKey);

        $this->entityManager->flush();

        $io->success(sprintf('API key generated for user %s (%s).', $user->getUserIdentifier(), $user->getUserId()));
        $io->writeln('Your API Key (raw UUID - store it securely, it will not be shown again):');
        $io->writeln("<info>$apiKey</info>");

        return Command::SUCCESS;
    }
}
