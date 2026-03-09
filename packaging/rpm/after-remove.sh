#!/bin/bash

# After-remove script for Fedora/RHEL/openSUSE (RPM).
# Merges standard electron-builder cleanup with RPM repository removal.

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

# ── eXeLearning RPM repository cleanup ───────────────────────────────────────

# Remove repo file
rm -f /etc/yum.repos.d/exelearning.repo

# Remove GPG key
rm -f /etc/pki/rpm-gpg/RPM-GPG-KEY-exelearning
