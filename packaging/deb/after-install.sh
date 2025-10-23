#!/bin/bash
set -euo pipefail

# After-install script for Debian/Ubuntu (APT).
# Adds the official eXeLearning APT repository under /deb.

APP_RESOURCES="/opt/eXeLearning/resources"
KEYRING="/etc/apt/keyrings/exelearning.gpg"
LIST="/etc/apt/sources.list.d/exelearning.list"

# Install key (idempotent)
install -D -m 0644 "$APP_RESOURCES/keys/exelearning.gpg" "$KEYRING"
chmod 0644 "$KEYRING"

# Write source list (idempotent)
cat > "$LIST" <<EOF
deb [arch=amd64 signed-by=$KEYRING] https://exelearning.github.io/exelearning/deb stable main
EOF

# Do NOT run apt-get update here (leave it to the admin)
