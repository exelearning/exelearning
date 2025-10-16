<?php
declare(strict_types=1);

namespace App\Tests\E2E\Tests;

use App\Tests\E2E\Support\BaseE2ETestCase;
use App\Tests\E2E\Support\Console;

final class LoginTest extends BaseE2ETestCase
{
    public function test_guest_login_reaches_workarea(): void
    {
        $client = $this->login($this->makeClient());
        $this->assertStringContainsString('/workarea', $client->getCurrentURL());
        $this->assertGreaterThan(0, $client->getCrawler()->filter('#menu_nav')->count());

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);        
    }

    public function test_failed_login_stays_in_login(): void
    {
        $client = $this->makeClient();
        $client->request('GET', '/login');
        $client->waitFor('#login-form', 10);
        // Submit empty form as a minimal invalid attempt
        $client->executeScript("document.querySelector('#login-form')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");
        $this->assertStringContainsString('/login', $client->getCurrentURL());

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);        
    }

    public function test_logout_redirects_to_login(): void
    {
        $client = $this->login($this->makeClient());
        $this->assertStringContainsString('/workarea', $client->getCurrentURL());
        $client->executeScript("window.location.href='/logout'");
        $client->waitFor('#login-form', 10);
        $this->assertStringContainsString('/login', $client->getCurrentURL());

        // Check browser console for errors
        Console::assertNoBrowserErrors($client);        
    }
}
