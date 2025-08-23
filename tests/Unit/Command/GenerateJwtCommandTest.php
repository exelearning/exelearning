<?php

namespace App\Tests\Unit\Command;

use App\Command\GenerateJwtCommand;
use Firebase\JWT\JWT;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;

class GenerateJwtCommandTest extends TestCase
{
    public function testGenerateJwtCommandOutputsValidToken(): void
    {
        $secret = 'test_secret';
        $issuer = 'exelearning';
        $audience = 'clients';

        $app = new Application();
        $app->add(new GenerateJwtCommand($secret, $issuer, $audience));
        $command = $app->find('app:jwt:generate');
        $tester = new CommandTester($command);

        $exit = $tester->execute([
            'sub' => 'user@example.com',
            '--ttl' => '60',
        ]);

        $this->assertSame(0, $exit);
        $output = trim($tester->getDisplay());
        $this->assertNotEmpty($output);

        $decoded = (array) JWT::decode($output, new \Firebase\JWT\Key($secret, 'HS256'));
        $this->assertSame('user@example.com', $decoded['sub'] ?? null);
        $this->assertSame($issuer, $decoded['iss'] ?? null);
        $this->assertSame($audience, $decoded['aud'] ?? null);
        $this->assertGreaterThan(time(), (int) $decoded['exp']);
    }
}

