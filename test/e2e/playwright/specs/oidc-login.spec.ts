import { test, expect } from '@playwright/test';

test('OpenID login leaves consent to the provider', async ({ page, context }) => {
    await page.goto('/login');
    const loginLink = page.locator('#login-link-openid');
    await expect(loginLink).toBeVisible();
    const response = await page.request.get((await loginLink.getAttribute('href'))!, { maxRedirects: 0 });
    expect(response.status()).toBe(302);

    const destination = new URL(response.headers().location);
    expect(destination.origin).toBe('https://oidc.example.test');
    const params = destination.searchParams;
    expect(params.has('prompt')).toBe(false);
    expect(params.get('client_id')).toBe('e2e-client');
    expect(params.get('response_type')).toBe('code');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toBeTruthy();

    const cookies = await context.cookies();
    const stateCookie = cookies.find(cookie => cookie.name === 'oidc_state');
    expect(stateCookie).toBeDefined();
    const oidcState = JSON.parse(decodeURIComponent(stateCookie!.value));
    expect(params.get('state')).toBe(oidcState.state);
    expect(params.get('nonce')).toBe(oidcState.nonce);
});
