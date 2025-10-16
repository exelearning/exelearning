<?php
declare(strict_types=1);

namespace App\Tests\E2E\RealTime;

use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\RealTimeCollaborationTrait;
use App\Tests\E2E\Support\Console;

/**
 * Smoke test for establishing a real-time session between two clients.
 */
final class BasicRealTimeConnectionTest extends BaseE2ETestCase
{
    use RealTimeCollaborationTrait;

    public function testBasicRealTimeConnection(): void
    {
        // A) Abrir dos navegadores logueados en el workarea
        $a = $this->openWorkareaInNewBrowser('A');
        $b = $this->openWorkareaInNewBrowser('B');

        // B) Get share URL from A and let B join the session
        $shareUrl = $this->getMainShareUrl($a);
        $this->assertNotEmpty($shareUrl, 'Expected a share URL from main client.');
        $b->request('GET', $shareUrl);

        // C) Verificar que ambos ven 2 usuarios conectados
        $a->getWebDriver()->navigate()->refresh();
        $this->assertSelectorExistsIn($a, '#exe-concurrent-users[num="2"]', 'Client A should see 2 connected users.');
        $this->assertSelectorExistsIn($b, '#exe-concurrent-users[num="2"]', 'Client B should see 2 connected users.');

        // Final check for any browser console errors in both clients.
        Console::assertNoBrowserErrors($a);
        Console::assertNoBrowserErrors($b);        
    }
}
