<?php

namespace App\Security;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Log\LoggerInterface;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Http\AccessToken\AccessTokenHandlerInterface;
use Symfony\Component\Security\Http\Authenticator\FallbackUserLoader;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;

class JwtTokenHandler implements AccessTokenHandlerInterface
{
    public function __construct(
        private string $secretKey,
        private array $allowedAlgs = ['HS256'],
        private ?string $issuer = null,
        private ?string $audience = null,
        private ?LoggerInterface $logger = null,
    ) {
    }

    public function getUserBadgeFrom(string $accessToken): UserBadge
    {
        try {
            $decoded = (array) JWT::decode($accessToken, new Key($this->secretKey, $this->allowedAlgs[0]));

            if ($this->issuer && (($decoded['iss'] ?? null) !== $this->issuer)) {
                throw new BadCredentialsException('Invalid token issuer.');
            }
            if ($this->audience && (($decoded['aud'] ?? null) !== $this->audience)) {
                throw new BadCredentialsException('Invalid token audience.');
            }

            $identifier = $decoded['sub'] ?? ($decoded['email'] ?? null);
            if (!$identifier) {
                throw new BadCredentialsException('Missing sub/email claim in JWT.');
            }

            return new UserBadge(
                (string) $identifier,
                new FallbackUserLoader(fn () => null),
                $decoded
            );
        } catch (\Throwable $e) {
            $this->logger?->warning('JWT decode failed: '.$e->getMessage());
            throw new BadCredentialsException('Invalid JWT token.', previous: $e);
        }
    }
}
