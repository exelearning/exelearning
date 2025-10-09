<?php
declare(strict_types=1);

namespace App\Tests\E2E\Offline;

use Symfony\Component\Panther\Client;

/**
 * Helper utilities to interact with the File menu in offline mode.
 *
 * The UI recently introduced additional wrappers around the navbar.
 * Relying on plain WebDriver clicks was no longer reliable because
 * Bootstrap collapses/positions the dropdowns differently depending
 * on viewport and layout state. These helpers make the tests resilient
 * by explicitly opening the dropdowns (using Bootstrap when available)
 * and falling back to manual class toggles when needed.
 */
trait OfflineMenuActionsTrait
{
    private function openOfflineFileMenu(Client $client): void
    {
        $this->openDropdown($client, '#dropdownFile');
    }

    private function openOfflineExportMenu(Client $client): void
    {
        $this->openOfflineFileMenu($client);
        $this->openDropdown($client, '#dropdownExportAsOffline');
    }

    protected function allowProjectFileActions(Client $client): void
    {
        $client->executeScript(<<<'JS'
(function(){
    try {
        if (window.eXeLearning?.app?.project) {
            window.eXeLearning.app.project.checkOpenIdevice = function(){ return false; };
            // Stub collaborative notifier in offline runs so toolbar Save click doesn't throw
            if (!window.eXeLearning.app.project.realTimeEventNotifier) {
                window.eXeLearning.app.project.realTimeEventNotifier = {
                    notify: function(){ /* no-op */ },
                    getSubscription: function(){ return { close: function(){} }; }
                };
            }
        }
        const alertModal = document.querySelector('#modalAlert');
        if (alertModal?.classList.contains('show')) {
            const closeBtn =
                alertModal.querySelector('[data-bs-dismiss="modal"]') ||
                alertModal.querySelector('.btn-primary') ||
                alertModal.querySelector('button');
            closeBtn?.click();
            alertModal.classList.remove('show');
        }
    } catch (e) {}
})();
JS);
    }

    protected function clickToolbarButton(Client $client, string $selector): void
    {
        $this->clickElement($client, $selector);
    }

    private function clickMenuItem(Client $client, string $selector): void
    {
        $this->clickElement($client, $selector);
    }

    private function clickElement(Client $client, string $selector): void
    {
        $this->allowProjectFileActions($client);
        $client->waitForVisibility($selector, 5);

        $script = <<<'JS'
(function(sel){
    const el = document.querySelector(sel);
    if (!el) { return false; }
    if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
    el.click();
    return true;
})(%s);
JS;

        $client->executeScript(sprintf(
            $script,
            json_encode($selector, JSON_THROW_ON_ERROR)
        ));
    }

    private function openDropdown(Client $client, string $triggerSelector, ?string $menuSelector = null): void
    {
        $this->allowProjectFileActions($client);
        $client->waitFor($triggerSelector, 5);

        $menuSelector ??= $triggerSelector . ' + .dropdown-menu';

        $script = <<<'JS'
(function(triggerSelector, menuSelector){
    const trigger = document.querySelector(triggerSelector);
    if (!trigger) { return false; }

    if (typeof trigger.scrollIntoView === 'function') {
        trigger.scrollIntoView({ block: 'center', inline: 'nearest' });
    }

    let menu = menuSelector ? document.querySelector(menuSelector) : null;
    if (!menu) {
        const parent = trigger.parentElement;
        if (parent && parent.nodeType === Node.ELEMENT_NODE) {
            menu = parent.querySelector(':scope > .dropdown-menu');
        }
    }
    if (!menu) {
        menu = trigger.nextElementSibling;
    }
    if (!menu) { return false; }

    const ensureShown = () => {
        if (menu.classList.contains('show')) { return true; }

        if (window.bootstrap && window.bootstrap.Dropdown) {
            window.bootstrap.Dropdown.getOrCreateInstance(trigger).show();
            return true;
        }

        const fireEvent = (name, init) => {
            let event;
            if (name.startsWith('pointer') && typeof PointerEvent === 'function') {
                event = new PointerEvent(name, init);
            } else {
                event = new Event(name, init);
            }
            trigger.dispatchEvent(event);
        };

        const baseInit = { bubbles: true, cancelable: true, view: window };
        ['pointerdown', 'pointerup', 'click'].forEach(eventName => fireEvent(eventName, baseInit));

        menu.classList.add('show');
        menu.style.display = 'block';
        trigger.setAttribute('aria-expanded', 'true');

        return true;
    };

    ensureShown();

    return menu.classList.contains('show');
})(%s, %s);
JS;

        $client->executeScript(sprintf(
            $script,
            json_encode($triggerSelector, JSON_THROW_ON_ERROR),
            json_encode($menuSelector, JSON_THROW_ON_ERROR)
        ));

        $client->waitForVisibility($menuSelector, 5);
    }
}
