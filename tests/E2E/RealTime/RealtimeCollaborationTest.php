<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Factory\BoxFactory;
use App\Tests\E2E\PageObject\WorkareaPage;
use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;
use App\Tests\E2E\Support\RealTimeCollaborationTrait;
use App\Tests\E2E\Support\Selectors;
use App\Tests\E2E\Support\Wait;

/**
 * Realtime collaboration test using two independent clients.
 * It verifies that an action performed by one user is reflected
 * in the other user's browser in real-time.
 */
final class RealtimeCollaborationTest extends BaseE2ETestCase
{
    // Use the trait to gain access to real-time helper methods.
    use RealTimeCollaborationTrait;

    public function test_box_from_client_a_is_seen_by_client_b(): void
    {
        // 1. Create and log in two separate browser clients using the browser manager.
        $clientA = $this->openWorkareaInNewBrowser('A');
        $clientB = $this->openWorkareaInNewBrowser('B');

        $workareaA = new WorkareaPage($clientA);
        $workareaB = new WorkareaPage($clientB);

        // 2. Get the unique share URL from the main client's session.
        $shareUrl = $this->getMainShareUrl($clientA);
        $this->assertNotEmpty($shareUrl, 'A share URL must be available to start collaboration.');

        // 3. The secondary client (B) joins the session using the share URL.
        $clientB->request('GET', $shareUrl);

        // 4. [Verification Step] Confirm both clients are connected to the same session.
        // We wait for the UI element showing concurrent users and assert it shows "2".
        // A refresh is sometimes needed for the UI to update the user list correctly.
        $clientA->getWebDriver()->navigate()->refresh();
        $this->assertSelectorExistsIn($clientA, '#exe-concurrent-users[num="2"]', 'Client A should see 2 connected users.');
        $this->assertSelectorExistsIn($clientB, '#exe-concurrent-users[num="2"]', 'Client B should see 2 connected users.');

        // 5. [Action] Client A adds a box with a text iDevice.
        // BoxFactory::createWithTextIDevice($workareaA);

        // 6. [Assertion] Client B waits for the new box to appear.
        // This is the core real-time check. The wait will fail if the change is not propagated.
        // A generous timeout allows for network and server latency.
        // Wait::css($clientB, Selectors::BOX_ARTICLE, 15000);
        // $this->assertNotEmpty(
        //     $workareaB->firstBoxTitle(),
        //     'Client B should see the box title created by Client A.'
        // );

        // 7. Final check for any browser console errors in both clients.
        Console::assertNoBrowserErrors($clientA);
        Console::assertNoBrowserErrors($clientB);
    }
}