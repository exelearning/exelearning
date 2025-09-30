#!/bin/bash
set -euo pipefail

# After-remove script for Fedora/RHEL/openSUSE (YUM/DNF).
# This script removes the eXeLearning repository configuration
# when the application is uninstalled.

# Remove repo file
rm -f /etc/yum.repos.d/exelearning.repo

# Remove GPG key
rm -f /etc/pki/rpm-gpg/RPM-GPG-KEY-exelearning
