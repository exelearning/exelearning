<?php

namespace App\Command\net\exelearning\Command;

use Doctrine\DBAL\Connection;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

/**
 * Tests database connection.
 */
#[AsCommand(
    name: 'app:database-test',
    description: 'Tests database connection.'
)]
class DatabaseTestCommand extends Command
{
    private $connection;

    /**
     * Constructor.
     */
    public function __construct(Connection $connection)
    {
        $this->connection = $connection;

        parent::__construct();
    }

    /**
     * Configures the command options.
     *
     * {@inheritDoc}
     *
     * @see \Symfony\Component\Console\Command\Command::configure()
     */
    protected function configure(): void
    {
        $this
            ->setDescription('Tests database connection.')
            ->setHelp('This command allows you to test the database connection...');
    }

    /**
     * Executes the command.
     *
     * {@inheritDoc}
     *
     * @see \Symfony\Component\Console\Command\Command::execute()
     */
    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $output->writeln([
            '',
            '<comment>Database Connection Test</comment>',
            '<comment>=========================</comment>',
            '',
        ]);

        try {
            // Check if the connection is established
            if ($this->connection->isConnected() || $this->connection->getNativeConnection()) {
                $output->writeln('<info>Database connection successful!</info>');

                return Command::SUCCESS;
            }
        } catch (\Exception $e) {
            $output->writeln('<error>Database connection failed: '.$e->getMessage().'</error>');

            return Command::FAILURE;
        }

        return Command::FAILURE;
    }
}
