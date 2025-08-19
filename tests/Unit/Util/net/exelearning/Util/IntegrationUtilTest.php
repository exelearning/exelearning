<?php

namespace App\Tests\Unit\Util\net\exelearning\Util;

use App\Util\net\exelearning\Util\IntegrationUtil;
use App\Settings;
use Firebase\JWT\JWT;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class IntegrationUtilTest extends TestCase
{
    private $logger;

    protected function setUp(): void
    {
        $this->logger = $this->createMock(LoggerInterface::class);
        $_ENV['PROVIDER_URLS'] = 'https://moodle.com,https://other.com';
        $_ENV['PROVIDER_TOKENS'] = 'moodle_token,other_token';
        $_ENV['PROVIDER_IDS'] = 'moodle,other';
        $_ENV['APP_SECRET'] = 'test_secret';
    }

    public function test_generateAndDecodeJwt()
    {
        $integrationUtil = new IntegrationUtil($this->logger);
        $payload = ['user' => 'testuser'];
        $providerId = 'moodle';

        $jwt = $integrationUtil->generateProviderJWT($payload, $providerId);
        $this->assertIsString($jwt);

        $decoded = $integrationUtil->decodeJWT($jwt, $providerId);
        $this->assertIsArray($decoded);
        $this->assertEquals('testuser', $decoded['user']);
        $this->assertEquals($providerId, $decoded['provider_id']);
    }

    public function test_validateProviderConfiguration()
    {
        $integrationUtil = new IntegrationUtil($this->logger);
        $this->assertEmpty($integrationUtil->validateProviderConfiguration());

        $_ENV['PROVIDER_TOKENS'] = 'moodle_token';
        $integrationUtil = new IntegrationUtil($this->logger);
        $this->assertNotEmpty($integrationUtil->validateProviderConfiguration());
    }

    public function test_getPlatformIntegrationParams()
    {
        $integrationUtil = new IntegrationUtil($this->logger);
        $payload = [
            'returnurl' => 'https://moodle.com/mod/exescorm/view.php?id=1',
            'pkgtype' => 'scorm',
            'user' => 'testuser',
            'provider_id' => 'moodle',
            'iat' => time(),
            'exp' => time() + 3600,
        ];

        $jwt = JWT::encode($payload, $_ENV['APP_SECRET'], Settings::JWT_SECRET_HASH);

        $params = $integrationUtil->getPlatformIntegrationParams($jwt, 'set');
        $this->assertIsArray($params);
        $this->assertEquals('https://moodle.com/mod/exescorm/set_ode.php', $params['platformIntegrationUrl']);
        $this->assertEquals('scorm12', $params['exportType']);
    }
}
