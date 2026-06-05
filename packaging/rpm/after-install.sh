#!/bin/bash

# After-install script for Fedora/RHEL/openSUSE (RPM).
# Merges the standard electron-builder post-install logic with
# the eXeLearning YUM/DNF repository setup.

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

# ── eXeLearning YUM/DNF repository setup ─────────────────────────────────────

APP_RESOURCES="/opt/eXeLearning/resources"

# Copy bundled GPG key into rpm keyring directory
install -D -m 644 "$APP_RESOURCES/keys/exelearning.key" /etc/pki/rpm-gpg/RPM-GPG-KEY-exelearning

# Create YUM/DNF repo file
cat > /etc/yum.repos.d/exelearning.repo <<EOF
[exelearning]
name=eXeLearning Repository
baseurl=https://exelearning.github.io/exelearning/rpm
enabled=1
gpgcheck=1
gpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-exelearning
EOF

# Do NOT run 'dnf makecache' or 'yum check-update' here,
# leave it to the system administrator
