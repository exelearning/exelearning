# Real-Time Communication

eXeLearning includes real-time features (e.g., collaborative editing) powered by Mercure using Server‑Sent Events (SSE).

## Real-Time Architecture

Real-time communication relies on:

1. **Mercure Hub**: Uses Server-Sent Events (SSE) to push updates from the server to subscribed clients.
2. **JWT**: Authorizes who can publish/subscribe to topics.

### Integrated Mercure Hub

The Docker image includes an integrated Mercure Hub via Nginx. This setup has several advantages:

* **No CORS issues**: The app and the hub are served from the same domain.
* **Simplified deployment**: No need for additional services.
* **Developer-friendly**: No extra ports or configurations required.

## Mercure Configuration

### Nginx Configuration

Nginx is configured to proxy requests to the Mercure Hub:

> Important: The directive `proxy_buffering off;` is essential for Server‑Sent Events (SSE). Without it, Nginx buffers the stream and clients won’t receive live events.

```nginx
location ^~ /.well-known/mercure {
    proxy_pass http://127.0.0.1:80;
    proxy_read_timeout 24h;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off; # <-- THIS LINE IS CRITICAL FOR SSE TO WORK!
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    error_page 502 503 504 =400 /mercure_400.html;
}

location = /healthz {
    proxy_pass http://127.0.0.1:80;
    error_page 502 503 504 =400 /mercure_400.html;
}

location = /mercure_400.html {
    return 400 "Bad Request";
}
```

> **In summary:**  
> If you experience issues with real-time updates or SSE connections hanging, the **first thing to check** is that `proxy_buffering off;` is set in your Nginx configuration for Mercure.

### `.env` Configuration

The `.env.dist` file includes the basic Mercure secret configuration:

```env
###> Mercure ###
MERCURE_JWT_SECRET_KEY=!ChangeThisMercureHubJWTSecretKey!
###< Mercure ###
```

This key signs the JWT tokens that authorize clients to publish and subscribe to Mercure topics.

### Docker Compose Configuration

The Docker Compose file passes the JWT secret to Mercure:

```yaml
environment:
  MERCURE_PUBLISHER_JWT_KEY: ${MERCURE_JWT_SECRET_KEY}
  MERCURE_SUBSCRIBER_JWT_KEY: ${MERCURE_JWT_SECRET_KEY}
```

## Usage in the Application

### Publishing Updates

From the Symfony backend, you can publish updates via the `mercure.hub` service:

```php
$update = new Update(
    'https://example.com/document/123',
    json_encode(['status' => 'updated', 'by' => 'user1']),
    true
);
$hub->publish($update);
```

### Subscribing from the Frontend

In JavaScript, use the `EventSource` API to subscribe to updates:

```javascript
const url = new URL('/.well-known/mercure', window.location.href);
url.searchParams.append('topic', 'https://example.com/document/123');

const eventSource = new EventSource(url);
eventSource.onmessage = event => {
    const data = JSON.parse(event.data);
    console.log(data);
    // Update the UI accordingly
};
```

## External Mercure Hub (optional)

While the integrated Mercure Hub suffices for most scenarios, a separate Mercure Hub may be used for high-load environments. To configure it:

1. Update the Nginx config to point to the external hub
2. Set the JWT environment variables to match the external hub's settings
3. Ensure the hub accepts connections from your domain

## Testing Real-Time Features

Two default users are created for testing collaborative features:

* User 1: `user@exelearning.net` / `1234`
* User 2: `user2@exelearning.net` / `1234`

Open the app in two browsers or tabs to test collaboration.

To run automated tests for real-time features:

```bash
make test-shell
composer phpunit tests/E2E/RealTime/
```

See the Testing docs: [development/testing.md](testing.md).

## Troubleshooting

- SSE not updating: Ensure `proxy_buffering off;` for the Mercure location in any reverse proxy.
- 401/403 subscribing: The subscriber JWT must include allowed topics; check `MERCURE_SUBSCRIBER_JWT_KEY` and claims.
- Mixed content over HTTPS: Ensure the Mercure URL matches your site scheme/host.
- Timeouts: Increase `proxy_read_timeout` for the Mercure location.
