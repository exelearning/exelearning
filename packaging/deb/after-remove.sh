#!/bin/bash
set -euo pipefail

# After-remove script for Debian/Ubuntu (APT).
# This script cleans up by removing the eXeLearning APT repository
# when the application is uninstalled.

# Remove APT source list
rm -f /etc/apt/sources.list.d/exelearning.list

# Remove GPG key
rm -f /usr/share/keyrings/exelearning.gpg
