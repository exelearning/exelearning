<?php

namespace App\Tests\Unit\Command;

use App\Command\ValidateJwtCommand;
use Firebase\JWT\JWT;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Console\Application;
use Symfony\Component\Console\Tester\CommandTester;

class ValidateJwtCommandTest extends TestCase
{
    public function testValidateAcceptsValidToken(): void
    {
        $secret = 'test_secret';
        $issuer = 'exelearning';
        $audience = 'clients';
        $payload = [
            'sub' => 'user@example.com',
            'iss' => $issuer,
            'aud' => $audience,
            'exp' => time() + 60,
        ];
        $jwt = JWT::encode($payload, $secret, 'HS256');

        $app = new Application();
        $app->add(new ValidateJwtCommand($secret, $issuer, $audience));
        $command = $app->find('app:jwt:validate');
        $tester = new CommandTester($command);

        $exit = $tester->execute([
            'jwt' => $jwt,
            '--json' => true,
        ]);

        $this->assertSame(0, $exit);
        $out = $tester->getDisplay();
        $this->assertStringContainsString('user@example.com', $out);
    }

    public function testValidateFailsOnWrongAudience(): void
    {
        $secret = 'test_secret';
        $payload = [
            'sub' => 'user@example.com',
            'iss' => 'exelearning',
            'aud' => 'wrong',
            'exp' => time() + 60,
        ];
        $jwt = JWT::encode($payload, $secret, 'HS256');

        $app = new Application();
        $app->add(new ValidateJwtCommand($secret, 'exelearning', 'clients'));
        $command = $app->find('app:jwt:validate');
        $tester = new CommandTester($command);

        $exit = $tester->execute([
            'jwt' => $jwt,
        ]);

        $this->assertSame(1, $exit);
        $this->assertStringContainsString('Audience inválido', $tester->getDisplay());
    }
}

