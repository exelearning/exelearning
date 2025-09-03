<?php

namespace App\Command;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:jwt:validate',
    description: 'Validates/decodes a local JWT (HS256) and shows its claims',
)]
class ValidateJwtCommand extends Command
{
    public function __construct(
        private readonly string $secret,
        private readonly ?string $issuer = null,
        private readonly ?string $audience = null,
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->addArgument('jwt', InputArgument::REQUIRED, 'JWT token to validate')
            ->addOption('alg', null, InputOption::VALUE_REQUIRED, 'Algorithm', 'HS256')
            ->addOption('no-verify', null, InputOption::VALUE_NONE, 'Do not verify iss/aud (only signature/exp)')
            ->addOption('json', null, InputOption::VALUE_NONE, 'Output in JSON');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);
        $jwt = (string) $input->getArgument('jwt');
        $alg = (string) $input->getOption('alg');
        $noVerify = (bool) $input->getOption('no-verify');

        try {
            $decoded = (array) JWT::decode($jwt, new Key($this->secret, $alg));
        } catch (\Throwable $e) {
            $io->error('Invalid token: '.$e->getMessage());

            return Command::FAILURE;
        }

        if (!$noVerify) {
            if ($this->issuer && (($decoded['iss'] ?? null) !== $this->issuer)) {
                $io->error('Issuer inválido');

                return Command::FAILURE;
            }
            if ($this->audience && (($decoded['aud'] ?? null) !== $this->audience)) {
                $io->error('Audience inválido');

                return Command::FAILURE;
            }
        }

        if ($input->getOption('json')) {
            $output->writeln(json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        } else {
            $io->success('Valid token');
            foreach ($decoded as $k => $v) {
                $output->writeln(sprintf('%s: %s', $k, is_scalar($v) ? (string) $v : json_encode($v)));
            }
        }

        return Command::SUCCESS;
    }
}
