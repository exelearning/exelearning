<?php

namespace App\EventSubscriber;

use App\Settings;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\RequestStack;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\KernelEvents;

class LocaleSubscriber implements EventSubscriberInterface
{
    private $defaultLocale;
    private $requestStack;

    /**
     * Constructor for the LocaleSubscriber.
     */
    public function __construct(RequestStack $requestStack, string $defaultLocale = 'en')
    {
        $this->requestStack = $requestStack;
        $this->defaultLocale = $defaultLocale;
    }

    /**
     * This method is triggered on the kernel request event to set the locale.
     */
    public function onKernelRequest(RequestEvent $event)
    {
        $request = $event->getRequest();
        $session = $request->getSession();

        // Check if a _locale value exists in the session
        if ($session->has('_locale')) {
            $request->setLocale($session->get('_locale'));
        }
        // Check if a _locale is set in the route attributes
        elseif ($locale = $request->attributes->get('_locale')) {
            $session->set('_locale', $locale);
            $request->setLocale($locale);
        }
        // If neither session nor route has _locale, use the browser's preferred language
        else {
            $preferredLocale = $request->getPreferredLanguage(array_keys(Settings::LOCALES)) ?: $this->defaultLocale;
            $request->setLocale($preferredLocale);
            $session->set('_locale', $preferredLocale);  // Save preferred locale to the session
        }
    }

    /**
     * Returns an array of events this subscriber is interested in.
     *
     * The event is registered before the default Locale listener.
     *
     * @return array
     */
    public static function getSubscribedEvents()
    {
        return [
            KernelEvents::REQUEST => [['onKernelRequest', 20]],
        ];
    }
}
