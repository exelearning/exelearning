# Shared location rules for both the :80 and :443 server blocks.
# X-Forwarded-Proto uses $scheme, so the backend sees http on :80 and https
# on :443 automatically.

# --- WebSocket: Yjs realtime collaboration ----------------------------------
# Must come before the plain app location so the longer prefix wins.
location /apps/education/exelearning/yjs/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400; # keep the WebSocket alive
    proxy_pass http://host.docker.internal:8080/apps/education/exelearning/yjs/;
}

# --- App namespace ----------------------------------------------------------
location /apps/education/exelearning {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://host.docker.internal:8080/apps/education/exelearning;
}

# --- Everything else --------------------------------------------------------
# Bare root and any non-BASE_PATH request: hard 502 (Bad Gateway).
location / {
    return 502;
}
