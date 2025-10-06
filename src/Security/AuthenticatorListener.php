<?php

namespace App\Security;

use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\Security\Http\Event\LoginSuccessEvent;

#[AsEventListener(event: LoginSuccessEvent::class, method: 'onLoginSuccessEvent', dispatcher: 'security.event_dispatcher.main')]
class AuthenticatorListener
{
    /**
     * Redirect after login on browser GETs, cleaning sensitive params if present.
     *
     * - Runs only for GET requests.
     * - Skips API routes (/api/*).
     * - Requires a browser-like Accept header (text/html).
     * - Always sets a RedirectResponse on success; if there are no sensitive params,
     *   it redirects to the same URL. This matches test expectations and avoids
     *   leaking tokens in history when present.
     */
    public function onLoginSuccessEvent(LoginSuccessEvent $event): void
    {
        $request = $event->getRequest();

        // Only GET requests
        if ('GET' !== $request->getMethod()) {
            return;
        }

        // Skip API routes
        $path = $request->getPathInfo() ?? '';
        if (str_starts_with($path, '/api')) {
            return;
        }

        // Only browser navigations (avoid JSON/XHR)
        $accept = $request->headers->get('Accept', '');
        if (false === stripos($accept, 'text/html')) {
            return;
        }

        // Build cleaned URL
        $qs = $request->query->all();
        unset($qs['ticket'], $qs['access_token']);

        $cleanUrl = $request->getSchemeAndHttpHost().$request->getBaseUrl().$path;
        if (!empty($qs)) {
            $cleanUrl .= '?'.http_build_query($qs);
        }

        // Always redirect (even if URL didn't change) to finish login flow
        $event->setResponse(new RedirectResponse($cleanUrl, 302));
    }
}
