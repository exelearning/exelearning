#!/bin/bash
set -euo pipefail

# After-install script for Fedora/RHEL/openSUSE (YUM/DNF).
# This script adds the official eXeLearning RPM repository so the app
# can be updated automatically with `dnf upgrade` or `yum update`.

APP_RESOURCES="/opt/eXeLearning/resources"

# Copy bundled GPG key into rpm keyring directory
install -D -m 644 "$APP_RESOURCES/keys/exelearning.gpg" /etc/pki/rpm-gpg/RPM-GPG-KEY-exelearning

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
