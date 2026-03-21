#!/bin/bash

# After-install script for Debian/Ubuntu (DEB).
# Merges the standard electron-builder post-install logic with
# the eXeLearning APT repository setup.

# ── Standard electron-builder post-install logic ──────────────────────────────

# Create /usr/bin symlink via update-alternatives
if type update-alternatives >/dev/null 2>&1; then
    # Remove previous link if it doesn't use update-alternatives
    if [ -L '/usr/bin/exelearning' -a -e '/usr/bin/exelearning' -a "$(readlink '/usr/bin/exelearning')" != '/etc/alternatives/exelearning' ]; then
        rm -f '/usr/bin/exelearning'
    fi
    update-alternatives --install '/usr/bin/exelearning' 'exelearning' '/opt/eXeLearning/exelearning' 100 || ln -sf '/opt/eXeLearning/exelearning' '/usr/bin/exelearning'
else
    ln -sf '/opt/eXeLearning/exelearning' '/usr/bin/exelearning'
fi

# Set chrome-sandbox permissions
if ! { [[ -L /proc/self/ns/user ]] && unshare --user true; }; then
    chmod 4755 '/opt/eXeLearning/chrome-sandbox' || true
else
    chmod 0755 '/opt/eXeLearning/chrome-sandbox' || true
fi

# Activate MIME type recognition for .elpx/.elp files
if hash update-mime-database 2>/dev/null; then
    update-mime-database /usr/share/mime || true
fi

# Activate .desktop file association
if hash update-desktop-database 2>/dev/null; then
    update-desktop-database /usr/share/applications || true
fi

# Install AppArmor profile (Ubuntu 24+)
if apparmor_status --enabled > /dev/null 2>&1; then
  APPARMOR_PROFILE_SOURCE='/opt/eXeLearning/resources/apparmor-profile'
  APPARMOR_PROFILE_TARGET='/etc/apparmor.d/exelearning'
  if apparmor_parser --skip-kernel-load --debug "$APPARMOR_PROFILE_SOURCE" > /dev/null 2>&1; then
    cp -f "$APPARMOR_PROFILE_SOURCE" "$APPARMOR_PROFILE_TARGET"

    if ! { [ -x '/usr/bin/ischroot' ] && /usr/bin/ischroot; } && hash apparmor_parser 2>/dev/null; then
      apparmor_parser --replace --write-cache --skip-read-cache "$APPARMOR_PROFILE_TARGET"
    fi
  else
    echo "Skipping the installation of the AppArmor profile as this version of AppArmor does not seem to support the bundled profile"
  fi
fi

# ── eXeLearning APT repository setup ─────────────────────────────────────────

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
