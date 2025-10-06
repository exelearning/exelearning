## Install

This guide helps end users (educators) download, install, and update eXeLearning on Windows, macOS, and Linux.

> Tip: If you are deploying eXeLearning for multiple users on a server, skip to Deployment: [deploy/overview.md](deploy/overview.md)

### Download

- Official releases: [https://github.com/exelearning/exelearning/releases](https://github.com/exelearning/exelearning/releases)
- Installer types by OS:
  - Windows: `.exe` (NSIS) and `.msi`
  - macOS: `.dmg` and `.zip` (universal: Intel + Apple Silicon)
  - Linux: `.deb` (Debian/Ubuntu) and `.rpm` (Fedora/RHEL/openSUSE)

### Windows

1) Download the `.exe` (installer) or `.msi` (enterprise-friendly) from Releases.
2) Double‑click and follow the installer steps.
3) Launch eXeLearning from the Start Menu.

Notes

- SmartScreen: If Windows warns about an unknown publisher, choose “More info” → “Run anyway”.
- Updates: eXeLearning auto‑updates in the background when new releases are published.
- Uninstall: Settings → Apps → Installed apps → eXeLearning → Uninstall.

### macOS

1) Download the `.dmg` from Releases and open it.
2) Drag the eXeLearning app into the Applications folder.
3) Open eXeLearning from Applications or Spotlight.

Gatekeeper

- If macOS blocks the app, right‑click the app in Applications and select “Open” to approve it.

Updates

- eXeLearning auto‑updates after you install the `.dmg` version.
- To remove, move the app from Applications to Trash.

### Linux

Option A — Use our package repositories (recommended)

- Debian/Ubuntu (APT):

```bash
# Import GPG key
sudo curl -fsSL https://exelearning.github.io/exelearning/deb/public.gpg \
  -o /usr/share/keyrings/exelearning.gpg

# Add the repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/exelearning.gpg] https://exelearning.github.io/exelearning/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/exelearning.list >/dev/null 

# Update metadata and install eXeLearning
sudo apt update
sudo apt install -y exelearning
```

- Fedora/RHEL/openSUSE (DNF/YUM):

```bash
# Import GPG key
sudo curl -fsSL https://exelearning.github.io/exelearning/rpm/public.key \
  -o /etc/pki/rpm-gpg/RPM-GPG-KEY-exelearning

# Add the repository
sudo tee /etc/yum.repos.d/exelearning.repo >/dev/null <<'EOF'
[exelearning]
name=Exelearning Repository
baseurl=https://exelearning.github.io/exelearning/rpm
enabled=1
gpgcheck=1
gpgkey=file:///etc/pki/rpm-gpg/RPM-GPG-KEY-exelearning
EOF

# Update metadata and install eXeLearning
sudo dnf makecache
sudo dnf install -y exelearning
```

Option B — Download a `.deb` or `.rpm`

- Download the package from Releases and install with your package manager:

```bash
# Debian/Ubuntu
sudo apt install ./exelearning_<version>_amd64.deb

# Fedora/RHEL/openSUSE
sudo rpm -Uvh exelearning-<version>.x86_64.rpm
```

Updates

- Using repositories keeps eXeLearning updated automatically via `apt upgrade` or `dnf upgrade`.

### Security & Updates

- Auto‑updates: Windows and macOS installers include automatic updates. Linux updates flow via your package manager if you enable our repository.
- Malware scanning: As part of our release process, generated installers are automatically scanned via VirusTotal before publication. See [development/installers.md](development/installers.md) for details.

### Troubleshooting

- The app does not start: Reboot, then try launching from the Start Menu (Windows) or Applications (macOS). On Linux, run `exelearning` from a terminal to see messages.
- Network is blocked by a firewall/proxy: Ask your IT admin to allow the app or update URLs used by auto‑update.
- Install conflicts: Remove older versions before installing a new major version.

### Next Steps

- Installers (advanced topics): [development/installers.md](development/installers.md)
- Server deployment for multiple users: [deployment/overview.md](deploy/overview.md)
- Contributing or running from source: [development/environment.md](development/environment.md)
