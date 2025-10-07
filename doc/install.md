# Install

This guide helps end users (educators) download, install, and update eXeLearning on Windows, macOS, and Linux.

> **Tip:** For multi-user/server setups, go to **Deployment** → [deploy/deployment.md](deploy/deployment.md)

---

### Download

- Official releases: <https://github.com/exelearning/exelearning/releases>
- Installer types:
  - **Windows:** `.exe` (NSIS) and `.msi`
  - **macOS:** `.dmg` and `.zip` (universal: Intel + Apple Silicon)
  - **Linux:** `.deb` (Debian/Ubuntu) and `.rpm` (Fedora/RHEL/openSUSE)

---

## Windows

#### Option 1 — Package manager

```powershell title="winget (recommended)"
winget install exelearning
```

```powershell title="Chocolatey"
choco install exelearning
```

#### Option 2 — Installer from Releases

1. Download `.exe` (NSIS installer) or `.msi` (enterprise-friendly) from **Releases**.
2. Double-click and follow the steps.
3. Launch eXeLearning from the **Start menu**.

> **SmartScreen:** If Windows warns about an unknown publisher, choose **More info → Run anyway**.

---

## macOS

#### Option 1 — Homebrew (in progress)

```bash title="brew (coming soon)"
brew install --cask exelearning
```

> Until it’s available on Homebrew Cask, use the `.dmg` from Releases.

#### Option 2 — Installer from Releases

1. Download the `.dmg` from **Releases** and open it.
2. Drag **eXeLearning** into **Applications**.
3. Open eXeLearning from **Applications** or **Spotlight**.

> **Gatekeeper:** If macOS blocks the app, right-click it in **Applications** and choose **Open** to approve it.

---

## Linux

#### Option 1 — Official repositories (recommended)

**Debian/Ubuntu (APT)**

```bash title="Add APT repo and install"
# Import GPG key
sudo curl -fsSL https://exelearning.github.io/exelearning/deb/public.gpg \
  -o /usr/share/keyrings/exelearning.gpg

# Add the repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/exelearning.gpg] https://exelearning.github.io/exelearning/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/exelearning.list >/dev/null

# Update metadata and install
sudo apt update
sudo apt install -y exelearning
```

**Fedora/RHEL/openSUSE (DNF/YUM)**

```bash title="Add DNF/YUM repo and install"
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

# Update metadata and install
sudo dnf makecache || sudo yum makecache
sudo dnf install -y exelearning || sudo yum install -y exelearning
```

#### Option 2 — Local package

**Debian/Ubuntu (.deb)**

```bash title="Install local .deb"
sudo apt install ./exelearning_<version>_amd64.deb
```

**Fedora/RHEL/openSUSE (.rpm)**

```bash title="Install local .rpm"
sudo rpm -Uvh exelearning-<version>.x86_64.rpm
```

---

## Security & Updates

* **Auto-updates:** Windows and macOS include automatic updates. On Linux, updates flow via the package manager if the repository is enabled.

---

## Troubleshooting

* **The app does not start:** Reboot, then launch from **Start menu** (Windows) or **Applications** (macOS). On Linux, run `exelearning` in a terminal to inspect messages.
* **Firewall/proxy:** Ask IT to allow the app and the auto-update URLs.

---

## Next steps

* Installers (advanced): [development/installers.md](development/installers.md)
* Server deployment for multiple users: [deploy/deployment.md](deployment.md)
* Contributing / running from source: [development/environment.md](development/environment.md)
