<?php
declare(strict_types=1);

namespace App\Tests\E2E;

use App\Kernel;
use Facebook\WebDriver\Chrome\ChromeOptions;
use Facebook\WebDriver\Remote\DesiredCapabilities;
use Facebook\WebDriver\WebDriverBy;
use Symfony\Component\Panther\Client;
use Symfony\Component\Panther\PantherTestCase;
use DAMA\DoctrineTestBundle\Doctrine\DBAL\StaticDriver;
use Symfony\Component\HttpClient\HttpClient;

use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Input\StringInput;

use Symfony\Component\Filesystem\Filesystem;


/**
 * Base class for eXeLearning end-to-end tests.
 *
 * Creates a Panther client and auto-provisions an ephemeral user per test when calling login().
 */
abstract class ExelearningE2EBase extends PantherTestCase
{

    protected ?Client $mainClient = null;

    protected ?string $currentUserId = null;

    /** @var int The unique port for the web server of this test process. */
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

        // ParaTest provides a unique token for each process. Fallback to 0 if not running in parallel.
        $paratestToken = (int) (getenv('TEST_TOKEN') ?: 0);

        // 1. Calculate a unique port for this test process
        $basePort = (int)($_ENV['PANTHER_WEB_SERVER_PORT'] ?? 9080);
        $this->currentPort = $basePort + $paratestToken;

    }

    /**
     * Returns the application Kernel class name.
     *
     * @return string
     */
    protected static function getKernelClass(): string
    {
        return Kernel::class;
    }

    /**
     * Creates a Panther Client with defaults.
     *
     * @return Client
     */
    protected function createTestClient(): Client
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
                'webServerDir'      => __DIR__ . '/../../public',
                'router'            => __DIR__ . '/../../public/router.php',
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
     * Logs into the application, auto-creating an ephemeral user with random password if not provided.
     *
     * @param Client|null  $client
     * @param string|null  $email
     * @param string|null  $password
     *
     * @return Client
     */
    protected function login(?Client $client = null): Client {
        if (null === $client) {
            $client = $this->createTestClient();
            $this->mainClient = $client; // assign only when creating the main one     
        }

        // 1. Navigate directly to the guest login endpoint.
        $client->request('GET', '/login/guest');

        // 2. The backend handles user creation, login, and redirection automatically.
        //    Wait for the workarea to load to confirm success.
        $this->assertStringContainsString('/workarea', $client->getCurrentURL());
        $client->waitForInvisibility('#load-screen-main', 30);

        // 3. Extract the user's email from the UI to determine the userId for other tests.
        $client->waitFor('.user-current-letter-icon');
        $email = $client->executeScript("return document.querySelector('.user-current-letter-icon').getAttribute('title');");

        // The guest userId is the part of the email before "@guest.local"
        if ($email && str_ends_with($email, '@guest.local')) {
            $this->currentUserId = str_replace('@guest.local', '', $email);
        }

        return $client;
    }

    /**
     * Opens the "new document" flow and returns the same client.
     *
     * @param Client $client
     * @return Client
     */
    public function createNewDocument(Client $client): Client
    {
        $client->waitForVisibility('#dropdownFile', 2);
        $client->getWebDriver()->findElement(WebDriverBy::id('dropdownFile'))->click();
        $client->getWebDriver()->findElement(WebDriverBy::id('navbar-button-new'))->click();

        // Confirm "create without save" if the modal shows up
        try {
            $client->waitForVisibility('#modalSessionLogout .session-logout-without-save.btn.btn-primary', 2);
            $client->getWebDriver()->findElement(
                WebDriverBy::cssSelector('#modalSessionLogout .session-logout-without-save.btn.btn-primary')
            )->click();
        } catch (\Throwable $e) {
            // No modal, continue
        }

        // Small pause to allow UI to settle
        usleep(300_000);

        return $client;
    }

    /**
     * Captures screenshots of all open windows (diagnostics).
     *
     * @param Client $client
     * @param string $clientName
     *
     * @return void
     */
    protected function captureAllWindowsScreenshots(Client $client, string $clientName = 'c1'): void
    {
        $screenshotDir = sys_get_temp_dir() . '/e2e_screenshots';
        if (!is_dir($screenshotDir)) {
            mkdir($screenshotDir, 0777, true);
        }

        $timestamp = date('Ymd-His');
        $testName  = str_replace(['\\', ':', ' '], '_', $this->name());
        $handles   = $client->getWindowHandles();

        foreach ($handles as $index => $handle) {
            $client->switchTo()->window($handle);
            $filename = sprintf(
                '%s/%s-%s-w%d-%s.png',
                $screenshotDir,
                $timestamp,
                $testName,
                $index + 1,
                $clientName
            );
            $client->takeScreenshot($filename);
        }
    }

    /**
     * Dumps browser console logs (diagnostics).
     *
     * @param Client $client
     * @param string|null $logFile Optional file path to save logs
     *
     * @return void
     */
    protected function captureBrowserConsoleLogs(Client $client, ?string $logFile = null): void
    {
        $logs = $client->getWebDriver()->manage()->getLog('browser');
        $lines = [];

        foreach ($logs as $entry) {
            $level   = strtoupper($entry['level']);
            $message = $entry['message'];
            $time    = date('H:i:s', $entry['timestamp'] / 1000);
            $line    = sprintf("[%s] [%s] %s", $time, $level, $message);
            $lines[] = $line;

            echo "\n[Browser Console][$level]: $message\n";
        }

        if ($logFile && !empty($lines)) {
            file_put_contents($logFile, implode(PHP_EOL, $lines) . PHP_EOL, FILE_APPEND);
        }
    }

    /**
     * Called automatically when a test fails or throws an exception.
     */
    protected function onNotSuccessfulTest(\Throwable $t): never
    {
        if ($this->mainClient instanceof Client) {
            try {
                $this->captureAllWindowsScreenshots($this->mainClient, 'fail');
            } catch (\Throwable $e) {
                // Avoid masking the original error if screenshot fails
                fwrite(STDERR, "[Screenshot failed]: " . $e->getMessage() . "\n");
            }
        }

        // Re-throw so PHPUnit marks the test as failed
        parent::onNotSuccessfulTest($t);
    }

}
