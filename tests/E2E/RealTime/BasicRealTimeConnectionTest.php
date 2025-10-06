<?php
declare(strict_types=1);

namespace App\Tests\E2E\RealTime;

use Symfony\Component\Panther\PantherTestCase;

/**
 * Example test that uses two real-time clients.
 */
class BasicRealTimeConnectionTest extends ExelearningRealTimeE2EBase
{
    public function testBasicRealTimeConnection(): void
    {
        // $this->markTestSkipped('disabled until we release the new test sysstem');

        // 1) Create both browsers and log them in
        $this->createRealTimeClients();

        // 2) Main client navigates somewhere
        $this->mainClient->request('GET', '/workarea');

        // 3) Get share URL and navigate the secondary client
        $shareUrl = $this->getMainShareUrl();
        $this->assertNotEmpty($shareUrl, 'Expected a share URL from main client.');
        $this->secondaryClient->request('GET', $shareUrl);

        // 4) Wait until the concurrent users container appears in both clients
        $this->mainClient->waitFor('#exe-concurrent-users');
        $this->secondaryClient->waitFor('#exe-concurrent-users');

        // Capture the javascript console for debugging
        // $this->captureBrowserConsoleLogs($this->mainClient);

        // Refresh the main client (otherwise, the logged-in users do not appear)
        $this->mainClient->getWebDriver()->navigate()->refresh();


        // 5) Assert that both clients see two users connected
        $this->assertSelectorExistsIn($this->mainClient, '#exe-concurrent-users[num="2"]', "Main client should see 2 connected users.");
        $this->assertSelectorExistsIn($this->secondaryClient, '#exe-concurrent-users[num="2"]', "Secondary client should see 2 connected users.");

        // 6) Verify both users appear in the main client
        // $this->assertSelectorExistsIn($this->mainClient, '.user-current-letter-icon[title="user@exelearning.net"]', "Main client should see user1.");
        // $this->assertSelectorExistsIn($this->mainClient, '.user-current-letter-icon[title="user2@exelearning.net"]', "Main client should see user2.");

        // 7) Verify both users appear in the secondary client
        // $this->assertSelectorExistsIn($this->secondaryClient, '.user-current-letter-icon[title="user@exelearning.net"]', "Secondary client should see user1.");
        // $this->assertSelectorExistsIn($this->secondaryClient, '.user-current-letter-icon[title="user2@exelearning.net"]', "Secondary client should see user2.");

        $this->assertSelectorExistsIn(
            $this->mainClient,
            sprintf('.user-current-letter-icon[title="%s@guest.local"]', $this->currentUserId),
            "Primary client should see its own userId."
        );


        $this->assertSelectorExistsIn(
            $this->secondaryClient,
            sprintf('.user-current-letter-icon[title="%s@guest.local"]', $this->currentUserId),
            "Secondary client should see its own userId."
        );

    }

}
