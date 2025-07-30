<?php

declare(strict_types=1);

namespace App\Tests\Integration;

use App\Constants;
use App\Settings;
use App\Util\net\exelearning\Util\IntegrationUtil;
use Firebase\JWT\JWT;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/**
 * Extended tests for the refactored IntegrationUtil with multiple provider support.
 */
final class IntegrationUtilMultiProviderTest extends TestCase
{
    private const SECRET = 'test_secret';
    private const PROVIDER_SECRET = 'provider_secret';

    private IntegrationUtil $util;

    protected function setUp(): void
    {
        // Set up multiple provider environment for testing
        $_ENV['APP_SECRET'] = self::SECRET;
        $_ENV['PROVIDER_URLS'] = 'https://moodle.example.com';
        $_ENV['PROVIDER_TOKENS'] = self::PROVIDER_SECRET;
        $_ENV['PROVIDER_IDS'] = 'moodle_main';

        $this->util = new IntegrationUtil(new NullLogger());
    }

    protected function tearDown(): void
    {
        // Clean up environment variables
        unset($_ENV['PROVIDER_URLS'], $_ENV['PROVIDER_TOKENS'], $_ENV['PROVIDER_IDS']);
    }

    private static function createJwt(array $payload, string $secret = self::SECRET): string
    {
        return JWT::encode(
            $payload + ['iat' => time(), 'exp' => time() + 3600],
            $secret,
            Settings::JWT_SECRET_HASH
        );
    }

    /* ------------------------------------------------------------------ */
    /* Provider Management Tests                                          */
    /* ------------------------------------------------------------------ */

    public function testGetProviderIds(): void
    {
        $ids = $this->util->getProviderIds();
        self::assertSame(['moodle_main'], $ids);
    }

    public function testGetProviderUrl(): void
    {
        self::assertSame('https://moodle.example.com', $this->util->getProviderUrl('moodle_main'));
        self::assertNull($this->util->getProviderUrl('nonexistent'));
    }

    public function testValidateProviderConfiguration(): void
    {
        $errors = $this->util->validateProviderConfiguration();
        self::assertEmpty($errors, 'Configuration should be valid');
    }

    public function testValidateProviderConfigurationWithMismatch(): void
    {
        // Set mismatched configuration
        $_ENV['PROVIDER_URLS'] = 'https://example.com';
        $_ENV['PROVIDER_TOKENS'] = 'token1,token2';
        $_ENV['PROVIDER_IDS'] = 'id1';

        $util = new IntegrationUtil(new NullLogger());
        $errors = $util->validateProviderConfiguration();

        self::assertNotEmpty($errors);
        self::assertStringContainsString('configuration mismatch', $errors[0]);
    }

    /* ------------------------------------------------------------------ */
    /* JWT Generation Tests                                               */
    /* ------------------------------------------------------------------ */

    public function testGenerateProviderJWT(): void
    {
        $payload = ['test' => 'data'];
        $jwt = $this->util->generateProviderJWT($payload, 'moodle_main');

        self::assertNotNull($jwt);
        self::assertIsString($jwt);

        // Verify the token can be decoded with the correct secret
        $decoded = JWT::decode($jwt, new \Firebase\JWT\Key(self::PROVIDER_SECRET, Settings::JWT_SECRET_HASH));
        $decodedArray = (array) $decoded;

        self::assertSame('data', $decodedArray['test']);
        self::assertSame('moodle_main', $decodedArray['provider_id']);
    }

    public function testGenerateProviderJWTWithInvalidProvider(): void
    {
        $jwt = $this->util->generateProviderJWT(['test' => 'data'], 'invalid_provider');
        self::assertNull($jwt);
    }

    /* ------------------------------------------------------------------ */
    /* JWT Decoding with Provider Tests                                   */
    /* ------------------------------------------------------------------ */

    public function testDecodeJWTWithProviderToken(): void
    {
        $payload = ['test' => 'value'];
        $jwt = self::createJwt($payload, self::PROVIDER_SECRET);

        // Should fail with default secret but succeed with provider token
        self::assertNull($this->util->decodeJWT($jwt));

        $decoded = $this->util->decodeJWT($jwt, 'moodle_main');
        self::assertNotNull($decoded);
        self::assertSame('value', $decoded['test']);
    }

    /* ------------------------------------------------------------------ */
    /* Platform Integration Tests                                         */
    /* ------------------------------------------------------------------ */

    public function testGetPlatformIntegrationParamsWithProvider(): void
    {
        $payload = [
            'pkgtype' => 'scorm',
            'returnurl' => 'https://moodle.example.com/mod/exescorm/view.php?id=99',
            'provider_id' => 'moodle_main'
        ];

        $jwt = self::createJwt($payload);
        $params = $this->util->getPlatformIntegrationParams($jwt, 'set');

        self::assertNotNull($params);
        self::assertSame(Constants::EXPORT_TYPE_SCORM12, $params['exportType']);
        self::assertStringContainsString('set_ode.php', $params['platformIntegrationUrl']);
    }

    public function testGetPlatformIntegrationParamsWithInvalidProvider(): void
    {
        $payload = [
            'pkgtype' => 'scorm',
            'returnurl' => 'https://moodle.example.com/mod/exescorm/view.php?id=99',
            'provider_id' => 'invalid_provider'
        ];

        $jwt = self::createJwt($payload);
        $params = $this->util->getPlatformIntegrationParams($jwt, 'set');

        self::assertNull($params);
    }

    public function testGetPlatformIntegrationParamsWithDisallowedUrl(): void
    {
        $payload = [
            'pkgtype' => 'scorm',
            'returnurl' => 'https://forbidden.example.com/mod/exescorm/view.php?id=99'
        ];

        $jwt = self::createJwt($payload);
        $params = $this->util->getPlatformIntegrationParams($jwt, 'set');

        self::assertNull($params);
    }

    /* ------------------------------------------------------------------ */
    /* Backwards Compatibility Tests                                      */
    /* ------------------------------------------------------------------ */

    public function testBackwardsCompatibilityMethod(): void
    {
        $payload = [
            'pkgtype' => 'webzip',
            'returnurl' => 'https://moodle.example.com/mod/exeweb/view.php?id=7'
        ];

        $jwt = self::createJwt($payload);
        $params = $this->util->getParamsMoodleIntegration($jwt, 'get');

        self::assertNotNull($params);
        self::assertSame(Constants::EXPORT_TYPE_HTML5, $params['exportType']);
    }

    /* ------------------------------------------------------------------ */
    /* Provider URL Validation Tests                                      */
    /* ------------------------------------------------------------------ */

    #[DataProvider('allowedUrlCases')]
    public function testUrlValidation(string $url, bool $shouldBeAllowed): void
    {
        $payload = [
            'pkgtype' => 'scorm',
            'returnurl' => $url
        ];

        $jwt = self::createJwt($payload);
        $params = $this->util->getPlatformIntegrationParams($jwt, 'set');

        if ($shouldBeAllowed) {
            self::assertNotNull($params, "URL {$url} should be allowed");
        } else {
            self::assertNull($params, "URL {$url} should not be allowed");
        }
    }

    public static function allowedUrlCases(): iterable
    {
        yield ['https://moodle.example.com/course/view.php', true];
        yield ['https://forbidden.site.com/course/view.php', false];
        yield ['http://malicious.com/mod/exescorm/view.php', false];
    }

    /* ------------------------------------------------------------------ */
    /* Integration URL Building Tests                                     */
    /* ------------------------------------------------------------------ */

    #[DataProvider('integrationUrlCases')]
    public function testIntegrationUrlBuilding(
        string $returnUrl,
        string $pkgType,
        string $operation,
        string $expectedPath
    ): void {
        $payload = [
            'pkgtype' => $pkgType,
            'returnurl' => $returnUrl
        ];

        $jwt = self::createJwt($payload);
        $params = $this->util->getPlatformIntegrationParams($jwt, $operation);

        if ($expectedPath) {
            self::assertNotNull($params);
            self::assertStringContainsString($expectedPath, $params['platformIntegrationUrl']);
        } else {
            self::assertArrayNotHasKey('platformIntegrationUrl', $params ?? []);
        }
    }

    public static function integrationUrlCases(): iterable
    {
        yield ['https://moodle.example.com/mod/exescorm/view.php?id=1', 'scorm', 'set', '/mod/exescorm/set_ode.php'];
        yield ['https://moodle.example.com/mod/exescorm/view.php?id=1', 'scorm', 'get', '/mod/exescorm/get_ode.php'];
        yield ['https://moodle.example.com/course/section.php?id=3', 'scorm', 'set', '/mod/exescorm/set_ode.php'];
        yield ['https://moodle.example.com/some/unknown/path.php', 'unknown_type', 'set', ''];
    }
}
