<?php
declare(strict_types=1);

namespace App\Tests\E2E\Support;

use PHPUnit\Framework\Attributes\After;
use PHPUnit\Framework\Attributes\Before;
use Symfony\Component\Panther\Client;
use Symfony\Component\Panther\PantherTestCase;

use Facebook\WebDriver\Chrome\ChromeOptions;
use Facebook\WebDriver\Exception\TimeOutException;
use Facebook\WebDriver\Remote\DesiredCapabilities;
use Facebook\WebDriver\WebDriverBy;


/**
 * Base E2E test case with:
 *  - Multiple browser management (PantherBrowserManager)
 *  - Console error assertions (via Console helper)
 *  - Ergonomic "open workarea" helper
 */
abstract class BaseE2ETestCase extends PantherTestCase
{
    protected PantherBrowserManager $browsers;

    /** @var Client|null main logged-in browser */
    protected ?Client $mainClient = null;

    /** @var string|null currently logged userId (guest_xxx) */
    protected ?string $currentUserId = null;

    /** @var int unique webserver port per parallel process */
    protected int $currentPort;

    // /**
    //  * Optional: Disable static connections from DAMA\DoctrineTestBundle.
    //  *
    //  * This forces Doctrine to open a fresh connection per test process
    //  * instead of reusing the same static connection.
    //  *
    //  * In our case this is not required because each E2E test already
    //  * provisions a new ephemeral user via the login flow. Keeping or
    //  * disabling static connections does not affect test isolation.
    //  *
    //  * Uncomment only if you run into issues with shared connections
    //  * while executing tests in parallel (e.g. with ParaTest).
    //  */
    // public static function setUpBeforeClass(): void
    // {
    //     parent::setUpBeforeClass();
    //
    //     StaticDriver::setKeepStaticConnections(false);
    // }
    //
    // public static function tearDownAfterClass(): void
    // {
    //     StaticDriver::setKeepStaticConnections(true);
    //
    //     parent::tearDownAfterClass();
    // }

    /**
     * We use a different port per each parallel test to avoid collisions
     */
    protected function setUp(): void
    {
        parent::setUp();
        $this->browsers = new PantherBrowserManager($this);

        // ParaTest provides a unique token for each process. Fallback to 0 if not running in parallel.
        $paratestToken = (int) (getenv('TEST_TOKEN') ?: 0);

        // 1. Calculate a unique port for this test process
        $basePort = (int)($_ENV['PANTHER_WEB_SERVER_PORT'] ?? 9080);
        $this->currentPort = $basePort + $paratestToken;

        $this->registerScreenshotTestName();
    }

    // /**
    //  * Returns the application Kernel class name.
    //  *
    //  * @return string
    //  */
    // protected static function getKernelClass(): string
    // {
    //     return Kernel::class;
    // }




    // #[Before]
    // protected function baseSetUp(): void
    // {
    //     require_once \dirname(__DIR__) . '/bootstrap.php';
    //     $this->browsers = new PantherBrowserManager($this);
    // }

    // #[After]
    // protected function baseTearDown(): void
    // {
    //     $this->browsers->closeAll();
    // }

    protected function tearDown(): void
    {
        ScreenshotCapture::setTestName(null);
        parent::tearDown();
    }

    /**
     * Opens the workarea (editor) in a fresh browser window and returns the client.
     */
    protected function openWorkareaInNewBrowser(string $name = 'A', ?string $documentId = null): Client
    {
        $client = $this->browsers->new($name);

        // Always login as guest first
        $client = $this->login($client);

        // Wait for workarea elements to confirm readiness        
        Wait::css($client, Selectors::WORKAREA, 8000);
        Wait::css($client, Selectors::NODE_CONTENT, 8000);
        return $client;
    }

    /**
     * Creates a Panther Client compatible with the Docker-based Selenium setup.
     */
    public function makeClient(array $options = []): \Symfony\Component\Panther\Client
    {
        $options = new ChromeOptions();
        $options->addArguments([
            '--headless=new',
            '--no-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-popup-blocking',
            '--window-size=1400,1000',
            '--hide-scrollbars',
        ]);

        // Build W3C capabilities from options
        $caps = $options->toCapabilities();

        // For Selenium Standalone (it usually announces browserName="chrome")
        $caps->setCapability('browserName', 'chrome');

        $port        = (int)($_ENV['PANTHER_WEB_SERVER_PORT'] ?? 9080);
        $visibleHost = $_ENV['PANTHER_VISIBLE_HOST'] ?? 'exelearning';

        return static::createPantherClient(
            options: [
                'browser'           => PantherTestCase::SELENIUM,
                'hostname' => 'exelearning',
                'port' => $this->currentPort, // Use the unique port for this process

                // Docroot and router for the embedded server (php -S)
                'webServerDir'      => __DIR__ . '/../../../public',
                'router'            => __DIR__ . '/../../../public/router.php',
                # IMPORTANT! Never define this var, or phanter will not start internal webserver
                // 'external_base_uri' => null, 
            ],
            kernelOptions: [],
            managerOptions: [
                'host'         => $_ENV['SELENIUM_HOST'] ?? 'http://chrome:9515',
                'capabilities' => $caps,
            ],
        );
    }

   /**
     * Performs a guest login and returns a ready-to-use logged-in client.
     * If no client is passed, a new one is created automatically.
     */
    protected function login(?Client $client = null): Client
    {
        if ($client === null) {
            $client = $this->makeClient();
        }

        // Step 1: load the login page so the backend issues a guest nonce tied to this session
        $client->request('GET', '/login');

        $guestLoginButtonSelector = '#login-form-guest button[type="submit"]';
        try {
            Wait::css($client, $guestLoginButtonSelector, 5000);
        } catch (TimeOutException $exception) {
            $this->fail('Guest login form not available on /login; cannot authenticate as guest for E2E tests.');
        }

        $buttons = $client->getWebDriver()->findElements(WebDriverBy::cssSelector($guestLoginButtonSelector));
        if (count($buttons) === 0) {
            $this->fail('Guest login button not found on /login; cannot authenticate as guest for E2E tests.');
        }
        $buttons[0]->click();

        // Step 2: wait for the workarea to be ready after the redirect
        Wait::css($client, Selectors::WORKAREA, 8000);
        $this->assertStringContainsString('/workarea', $client->getCurrentURL(), 'Expected to reach /workarea after guest login');
        $client->waitForInvisibility('#load-screen-main', 30);

        // Step 3: extract current user ID from data attribute
        $client->waitFor('[data-testid="user-menu"][data-user-email]', 10);
        $crawler = $client->getCrawler();

        $email = $crawler->filter('[data-testid="user-menu"]')->attr('data-user-email');

        if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->fail(sprintf('User email not found or invalid. Got: %s', var_export($email, true)));
        }

        /**
         * Always remove the domain part to get a clean user identifier.
         * Example: "guest_123@guest.local" → "guest_123"
         */
        $this->currentUserId = strstr($email, '@', true);

        return $client;
    }


    /**
     * Called automatically when a test fails or throws an exception.
     * Captures screenshots for all active browser clients.
     */
    protected function onNotSuccessfulTest(\Throwable $t): never
    {
        $descriptor = static::class;
        // Ensure test name for screenshots, compatible with PHPUnit 12
        try {
            $method = null;
            if (method_exists($this, 'name')) {
                $n = $this->name();
                if (is_object($n)) {
                    if (method_exists($n, 'asString')) { $n = $n->asString(); }
                    elseif (method_exists($n, '__toString')) { $n = (string)$n; }
                }
                if (is_string($n) && $n !== '') { $method = $n; }
            }
            if ($method === null && method_exists($this, 'getName')) {
                $n = $this->getName();
                if (is_object($n) && method_exists($n, '__toString')) { $n = (string)$n; }
                if (is_string($n) && $n !== '') { $method = $n; }
            }
            $descriptor = $method ? sprintf('%s::%s', static::class, $method) : static::class;
            ScreenshotCapture::setTestName($descriptor);
        } catch (\Throwable) {
            // ignore
        }

        try {
            if (isset($this->browsers)) {
                foreach ($this->browsers->all() as $name => $client) {
                    // 1) Save screenshots for every open window
                    ScreenshotCapture::allWindows($client, $name);

                    // 2) Save browser console logs next to screenshots
                    try {
                        $saved = \App\Tests\E2E\Support\Console::dumpBrowserLogs($client, $descriptor, (string)$name, true);
                        if ($saved) {
                            fwrite(STDERR, "[ConsoleDump] Saved: {$saved}\n");
                        }
                    } catch (\Throwable $e) {
                        fwrite(STDERR, "[ConsoleDump] Failed: {$e->getMessage()}\n");
                    }
                }
            }
        } catch (\Throwable $e) {
            fwrite(STDERR, "[ScreenshotCapture] Failed during teardown: {$e->getMessage()}]\n");
        }

        parent::onNotSuccessfulTest($t);
    }



    private function registerScreenshotTestName(): void
    {
        $method = null;

        try {
            if ($method === null && method_exists($this, 'name')) {
                $candidate = $this->name();
                if (is_object($candidate)) {
                    if (method_exists($candidate, 'asString')) {
                        $candidate = $candidate->asString();
                    } elseif (method_exists($candidate, '__toString')) {
                        $candidate = (string) $candidate;
                    }
                }
                if (is_string($candidate) && $candidate !== '') {
                    $method = $candidate;
                }
            }
            if ($method === null && method_exists($this, 'getName')) {
                $candidate = $this->getName();
                if (is_object($candidate) && method_exists($candidate, '__toString')) {
                    $candidate = (string) $candidate;
                }
                if (is_string($candidate) && $candidate !== '') {
                    $method = $candidate;
                }
            }
        } catch (\Throwable) {
            $method = null;
        }

        if ((!is_string($method) || $method === '') && class_exists(\PHPUnit\Framework\TestCase::class)) {
            try {
                $ref = new \ReflectionProperty(\PHPUnit\Framework\TestCase::class, 'name');
                $ref->setAccessible(true);
                $raw = $ref->getValue($this);
                if (is_string($raw) && $raw !== '') {
                    $method = $raw;
                }
            } catch (\Throwable) {
                $method = null;
            }
        }

        $descriptor = $method ? sprintf('%s::%s', static::class, $method) : static::class;
        ScreenshotCapture::setTestName($descriptor);
    }
}
