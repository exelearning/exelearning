<?php
declare(strict_types=1);

namespace App\Tests\E2E\Factory;

use App\Tests\E2E\PageObject\WorkareaPage;
use App\Tests\E2E\Support\Selectors;
use App\Tests\E2E\Support\Wait;
use Symfony\Component\Panther\Client;

/**
 * UI-first document "factory".
 * In many flows, the document already exists when you open the workarea.
 */
final class DocumentFactory
{
    /** Opens the workarea and returns the Page Object. */
    public static function open(Client $client): WorkareaPage
    {
        Wait::css($client, Selectors::WORKAREA, 8000);
        Wait::css($client, Selectors::NODE_CONTENT, 8000);
        try {
            Wait::css($client, '#properties-node-content-form', 8000);
        } catch (\Throwable) {
            // Properties form loads asynchronously; proceed and let callers retry via WorkareaPage helpers.
        }
        return new WorkareaPage($client);
    }
}
