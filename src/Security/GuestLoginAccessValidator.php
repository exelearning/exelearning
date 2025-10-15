<?php

namespace App\Security;

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpFoundation\Session\SessionInterface;
use Symfony\Component\HttpKernel\KernelInterface;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

class GuestLoginAccessValidator
{
    private const SESSION_KEY = '_guest_login_nonces';

    public function __construct(
        private readonly RequestStack $requestStack,
        private readonly UrlGeneratorInterface $urlGenerator,
        private readonly KernelInterface $kernel,
        private readonly int $nonceTtl = 300,
        private readonly string $nonceSessionKey = self::SESSION_KEY,
    ) {
    }

    public function issueNonce(SessionInterface $session): string
    {
        if (!$session->isStarted()) {
            $session->start();
        }

        $nonce = bin2hex(random_bytes(16));
        $expiresAt = time() + $this->nonceTtl;

        $nonces = $session->get($this->nonceSessionKey, []);
        if (!is_array($nonces)) {
            $nonces = [];
        }

        $nonces = $this->cleanupExpiredNonces($nonces);
        $nonces[$nonce] = $expiresAt;
        $session->set($this->nonceSessionKey, $nonces);

        return $nonce;
    }

    public function isAccessAllowed(?Request $request = null): bool
    {
        if ($this->isTestEnvironment()) {
            return true;
        }

        $request ??= $this->requestStack->getCurrentRequest();

        if (null === $request) {
            return $this->isRunningInConsole();
        }

        if (!$this->isRefererFromLogin($request) || $this->hasSuspiciousFetchSite($request)) {
            return false;
        }

        return $this->isNonceValid($request);
    }

    private function isNonceValid(Request $request): bool
    {
        $session = $request->getSession();

        if (null === $session || !$session->isStarted()) {
            return false;
        }

        $nonce = $request->request->get('guest_login_nonce');

        if (!is_string($nonce) || '' === $nonce) {
            $nonce = $request->headers->get('X-Guest-Login-Nonce');
        }

        if (!is_string($nonce) || '' === $nonce) {
            return false;
        }

        $nonces = $session->get($this->nonceSessionKey, []);
        if (!is_array($nonces)) {
            $nonces = [];
        }

        $nonces = $this->cleanupExpiredNonces($nonces);

        if (!array_key_exists($nonce, $nonces)) {
            $session->set($this->nonceSessionKey, $nonces);

            return false;
        }

        unset($nonces[$nonce]);
        $session->set($this->nonceSessionKey, $nonces);

        return true;
    }

    private function isRefererFromLogin(Request $request): bool
    {
        $referer = $request->headers->get('referer');

        if (!$referer) {
            return false;
        }

        $loginPath = $this->urlGenerator->generate('app_login', [], UrlGeneratorInterface::ABSOLUTE_PATH);
        $refererPath = parse_url($referer, PHP_URL_PATH);

        if (null !== $refererPath && $refererPath === $loginPath) {
            return true;
        }

        $absoluteLoginUrl = $this->urlGenerator->generate('app_login', [], UrlGeneratorInterface::ABSOLUTE_URL);

        return is_string($absoluteLoginUrl) && str_starts_with($referer, $absoluteLoginUrl);
    }

    private function hasSuspiciousFetchSite(Request $request): bool
    {
        $value = $request->headers->get('Sec-Fetch-Site');

        if (null === $value) {
            return false;
        }

        return !in_array(strtolower($value), ['same-origin', 'none'], true);
    }

    private function cleanupExpiredNonces(array $nonces): array
    {
        $now = time();

        foreach ($nonces as $nonce => $expiresAt) {
            if (!is_int($expiresAt) || $expiresAt <= $now) {
                unset($nonces[$nonce]);
            }
        }

        return $nonces;
    }

    private function isTestEnvironment(): bool
    {
        return 'test' === $this->kernel->getEnvironment();
    }

    private function isRunningInConsole(): bool
    {
        return in_array(PHP_SAPI, ['cli', 'phpdbg'], true);
    }
}
