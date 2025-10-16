<?php
declare(strict_types=1);

namespace App\Tests\E2E\RealTime;

use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\RealTimeCollaborationTrait;
use App\Tests\E2E\Support\Console;

/**
 * Example real-time test aligned with the new BaseE2ETestCase.
 */
final class SomeRealTimeFeatureTest extends BaseE2ETestCase
{
    use RealTimeCollaborationTrait;

    public function testTwoClientsSeeSameDocument(): void
    {
        $a = $this->openWorkareaInNewBrowser('A');
        $b = $this->openWorkareaInNewBrowser('B');

        $shareUrl = $this->getMainShareUrl($a);
        $this->assertNotEmpty($shareUrl, 'Expected a share URL from main client.');
        $b->request('GET', $shareUrl);

        $a->getWebDriver()->navigate()->refresh();
        $this->assertSelectorExistsIn($a, '#exe-concurrent-users[num="2"]');
        $this->assertSelectorExistsIn($b, '#exe-concurrent-users[num="2"]');

        // Final check for any browser console errors in both clients.
        Console::assertNoBrowserErrors($a);
        Console::assertNoBrowserErrors($b);
    }
}
