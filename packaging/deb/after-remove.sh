#!/bin/bash

# After-remove script for Debian/Ubuntu (DEB).
# Merges standard electron-builder cleanup with APT repository removal.

# ── Standard electron-builder cleanup ─────────────────────────────────────────

# Remove /usr/bin symlink
if type update-alternatives >/dev/null 2>&1; then
    update-alternatives --remove 'exelearning' '/usr/bin/exelearning'
else
    rm -f '/usr/bin/exelearning'
fi

# Remove AppArmor profile
APPARMOR_PROFILE_DEST='/etc/apparmor.d/exelearning'
if [ -f "$APPARMOR_PROFILE_DEST" ]; then
  rm -f "$APPARMOR_PROFILE_DEST"
fi

# ── eXeLearning APT repository cleanup ───────────────────────────────────────

# Remove APT source list
rm -f /etc/apt/sources.list.d/exelearning.list

# Remove GPG key
rm -f /usr/share/keyrings/exelearning.gpg
rm -f /etc/apt/keyrings/exelearning.gpg
