<?php

namespace App\Util;

use App\Constants;

final class GravatarUrlGenerator
{
    private const DEFAULT_SIZE = 96;
    private const DEFAULT_RATING = 'g';
    private const MAX_INITIALS_LENGTH = 4;

    private function __construct()
    {
    }

    public static function createFromIdentifier(?string $identifier, ?string $initials = null, ?string $displayName = null): ?string
    {
        $baseUrl = trim(Constants::GRAVATAR_BASE_URL);
        if ('' === $baseUrl) {
            return null;
        }

        $normalizedIdentifier = trim((string) $identifier);
        $defaultImage = self::resolveDefaultImage($normalizedIdentifier);

        $parameters = [
            's' => (string) self::DEFAULT_SIZE,
            'd' => $defaultImage,
            'r' => self::DEFAULT_RATING,
        ];

        if ('initials' === $defaultImage) {
            $resolvedInitials = self::resolveInitials($normalizedIdentifier, $initials, $displayName);
            if ('' !== $resolvedInitials) {
                $parameters['initials'] = $resolvedInitials;
            }
        }

        $queryString = http_build_query($parameters, '', '&', PHP_QUERY_RFC3986);

        if ('' === $normalizedIdentifier) {
            return sprintf('%s?%s', $baseUrl, $queryString);
        }

        $hash = md5(strtolower($normalizedIdentifier));

        return sprintf('%s%s?%s', $baseUrl, $hash, $queryString);
    }

    private static function resolveDefaultImage(string $identifier): string
    {
        $default = trim(Constants::GRAVATAR_DEFAULT_IMAGE);

        if ('' !== $identifier && self::isGuestAccount($identifier)) {
            $guestDefault = trim(Constants::GRAVATAR_GUEST_DEFAULT_IMAGE);

            if ('' !== $guestDefault) {
                return $guestDefault;
            }
        }

        return $default;
    }

    private static function resolveInitials(string $identifier, ?string $initials, ?string $displayName): string
    {
        $sanitizedInitials = self::sanitizeInitials($initials);
        if ('' !== $sanitizedInitials) {
            return $sanitizedInitials;
        }

        $fromDisplayName = self::initialsFromText($displayName ?? '');
        if ('' !== $fromDisplayName) {
            return $fromDisplayName;
        }

        return self::initialsFromIdentifier($identifier);
    }

    private static function sanitizeInitials(?string $initials): string
    {
        if (null === $initials) {
            return '';
        }

        $filtered = preg_replace('/[^\p{L}\p{N}]+/u', '', trim($initials));
        if (null === $filtered || '' === $filtered) {
            return '';
        }

        $filtered = mb_strtoupper($filtered);

        return mb_substr($filtered, 0, self::MAX_INITIALS_LENGTH);
    }

    private static function initialsFromText(string $text): string
    {
        $parts = preg_split('/[^\p{L}\p{N}]+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY);
        if (empty($parts)) {
            return '';
        }

        $initials = '';

        foreach ($parts as $part) {
            $initials .= mb_strtoupper(mb_substr($part, 0, 1));

            if (mb_strlen($initials) >= self::MAX_INITIALS_LENGTH) {
                break;
            }
        }

        return $initials;
    }

    private static function initialsFromIdentifier(string $identifier): string
    {
        if ('' === $identifier) {
            return '';
        }

        $localPart = strtolower($identifier);
        if (false !== ($atPosition = strpos($localPart, '@'))) {
            $localPart = substr($localPart, 0, $atPosition);
        }

        $localPart = str_replace(['.', '-', '_'], ' ', $localPart);

        return self::initialsFromText($localPart);
    }

    private static function isGuestAccount(string $identifier): bool
    {
        $guestDomain = trim(strtolower(Constants::GRAVATAR_GUEST_ACCOUNT_DOMAIN));
        if ('' === $guestDomain) {
            return false;
        }

        return str_ends_with(strtolower($identifier), $guestDomain);
    }
}
