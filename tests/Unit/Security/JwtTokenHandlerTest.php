<?php

namespace App\Tests\Unit\Security;

use App\Security\JwtTokenHandler;
use Firebase\JWT\JWT;
use PHPUnit\Framework\TestCase;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;

class JwtTokenHandlerTest extends TestCase
{
    private string $secret = 'test_secret';

    public function testDecodesValidTokenAndReturnsUserBadge(): void
    {
        $handler = new JwtTokenHandler($this->secret, ['HS256'], 'exelearning', 'clients');

        $payload = [
            'sub' => 'user@example.com',
            'iss' => 'exelearning',
            'aud' => 'clients',
            'exp' => time() + 300,
        ];
        $jwt = JWT::encode($payload, $this->secret, 'HS256');

        $badge = $handler->getUserBadgeFrom($jwt);
        $this->assertSame('user@example.com', $badge->getUserIdentifier());
        $attrs = $badge->getAttributes();
        $this->assertSame('user@example.com', $attrs['sub'] ?? null);
        $this->assertSame('exelearning', $attrs['iss'] ?? null);
    }

    public function testInvalidIssuerThrowsException(): void
    {
        $handler = new JwtTokenHandler($this->secret, ['HS256'], 'expected', 'aud');
        $payload = [
            'sub' => 'user@example.com',
            'iss' => 'wrong',
            'aud' => 'aud',
            'exp' => time() + 300,
        ];
        $jwt = JWT::encode($payload, $this->secret, 'HS256');

        $this->expectException(BadCredentialsException::class);
        $handler->getUserBadgeFrom($jwt);
    }
}

