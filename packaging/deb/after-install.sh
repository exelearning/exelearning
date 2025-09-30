#!/bin/bash
set -euo pipefail

# After-install script for Debian/Ubuntu (APT).
# This script adds the official eXeLearning APT repository so the app
# can be updated automatically with `apt upgrade`.

APP_RESOURCES="/opt/eXeLearning/resources"

# Copy bundled GPG key into system keyring
install -D -m 644 "$APP_RESOURCES/keys/exelearning.gpg" /usr/share/keyrings/exelearning.gpg

# Create the APT source list
cat > /etc/apt/sources.list.d/exelearning.list <<EOF
deb [signed-by=/usr/share/keyrings/exelearning.gpg] https://exelearning.github.io/exelearning stable main
EOF

# Do NOT run apt-get update here (leave it to the admin)
