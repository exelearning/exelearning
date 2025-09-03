<?php

namespace App\Command;

use Firebase\JWT\JWT;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputArgument;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:jwt:generate',
    description: 'Generates a local JWT (HS256) for the API',
)]
class GenerateJwtCommand extends Command
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
            ->addArgument('sub', InputArgument::REQUIRED, 'Token subject (usually email or user id)')
            ->addOption('ttl', null, InputOption::VALUE_REQUIRED, 'Time to live in seconds', '3600')
            ->addOption('issuer', null, InputOption::VALUE_REQUIRED, 'Issuer (iss). Default: configured one')
            ->addOption('audience', null, InputOption::VALUE_REQUIRED, 'Audience (aud). Default: configured one')
            ->addOption('claim', 'c', InputOption::VALUE_REQUIRED | InputOption::VALUE_IS_ARRAY, 'Additional claims (k=v). Can be repeated')
            ->addOption('alg', null, InputOption::VALUE_REQUIRED, 'Signing algorithm', 'HS256')
            ->addOption('no-iat', null, InputOption::VALUE_NONE, 'Do not include automatic iat/nbf');
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $sub = (string) $input->getArgument('sub');
        $ttl = (int) $input->getOption('ttl');
        $alg = (string) $input->getOption('alg');
        $issuer = $input->getOption('issuer') ?? $this->issuer;
        $audience = $input->getOption('audience') ?? $this->audience;

        $now = time();
        $payload = [
            'sub' => $sub,
            'exp' => $now + max(1, $ttl),
        ];

        if (!$input->getOption('no-iat')) {
            $payload['iat'] = $now;
            $payload['nbf'] = $now;
        }

        if ($issuer) {
            $payload['iss'] = $issuer;
        }
        if ($audience) {
            $payload['aud'] = $audience;
        }

        // Parse extra claims k=v
        /** @var array<string> $claims */
        $claims = $input->getOption('claim') ?? [];
        foreach ($claims as $kv) {
            if (!str_contains($kv, '=')) {
                $io->warning(sprintf('Claim ignored (format k=v required): %s', $kv));
                continue;
            }
            [$k, $v] = explode('=', $kv, 2);
            $k = trim($k);
            $v = trim($v);
            if ('' === $k || 'exp' === $k || 'iat' === $k || 'nbf' === $k) {
                $io->warning(sprintf('Reserved or empty claim ignored: %s', $k));
                continue;
            }
            // Try to cast numeric/bool
            if (is_numeric($v)) {
                $v = str_contains($v, '.') ? (float) $v : (int) $v;
            } elseif (in_array(strtolower($v), ['true', 'false'], true)) {
                $v = 'true' === strtolower($v);
            }
            $payload[$k] = $v;
        }

        try {
            $jwt = JWT::encode($payload, $this->secret, $alg);
        } catch (\Throwable $e) {
            $io->error('Error signing the token: '.$e->getMessage());

            return Command::FAILURE;
        }

        // Output only the raw JWT as expected by tests/consumers
        $output->writeln($jwt);

        return Command::SUCCESS;
    }
}
