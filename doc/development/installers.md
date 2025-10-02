# Installers & Executables

This page explains what we ship for desktop users and how installers are produced. If you just want to install eXeLearning on your computer, start with Install: [install.md](../install.md).

In addition to Docker deployment, our GitHub Actions pipeline builds and publishes native desktop installers for all major platforms. Installers are built with [`electron-builder`](https://www.electron.build/) and embed a static PHP runtime via [`nativePHP/php-bin`](https://github.com/crazywhalecc/static-php-cli).

---

## Automatic Updates

The application includes built-in support for **automatic updates** via [`electron-updater`](https://www.electron.build/auto-update). Once a new release is published, users will receive an update notification the next time they launch the app. The download and installation process is handled transparently in the background.

> Note: Updates are delivered only for official releases published on GitHub Releases.

---

## Installer Formats

Each production release generates and publishes the following installers:

### Linux

* `.deb` (Debian/Ubuntu)
* `.rpm` (RedHat, Fedora)

### macOS

* `.dmg` (universal build for Intel + Apple Silicon)
* `.zip` (universal portable archive)

### Windows

* `.nsis` (classic installer)
* `.msi` (wrapped NSIS, suitable for enterprise)

All artifacts are uploaded to the **GitHub Releases** page.


---

## Linux Package Repositories

In addition to downloading `.deb` and `.rpm` installers from GitHub Releases,  
we publish package repositories so you can install and keep eXeLearning up to date using your system package manager.

### Debian/Ubuntu (APT)

Add the official eXeLearning APT repository:

```bash
# Import the GPG key
curl -fsSL https://exelearning.github.io/exelearning/deb/public.key \
  | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/exelearning.gpg

# Add the repository
echo "deb [arch=amd64] https://exelearning.github.io/exelearning/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/exelearning.list

# Update and install
sudo apt update
sudo apt install exelearning
```

Future stable releases are delivered automatically via `apt upgrade`.

### Fedora / RHEL / openSUSE (YUM/DNF)

We also provide a YUM/DNF repository.
Download the `.repo` file and enable it:

```bash
sudo curl -o /etc/yum.repos.d/exelearning.repo \
  https://exelearning.github.io/exelearning/rpm/exelearning.repo

sudo rpm --import https://exelearning.github.io/exelearning/rpm/public.key

# Install the app
sudo dnf install exelearning
```

This configures your system to receive eXeLearning updates automatically with `dnf upgrade` (or `yum update`).

---

## Local Build (for developers)

### Prerequisites

* **Node.js** – [nodejs.org](https://nodejs.org/)
* **Composer** – [getcomposer.org](https://getcomposer.org/)
* **Yarn & dependencies**:

```bash
npm install --global yarn
yarn install
composer install
```

---

### Build locally

```bash
yarn build
```

The resulting installers are saved in the `dist/` directory.

You can also:

* Run the app in development mode:

  ```bash
  make run-app
  ```

* Enable debug mode:

  ```bash
  make run-app DEBUG=1
  ```

* Build a versioned package manually:

  ```bash
  make package VERSION=1.2.3
  ```

---

## See Also

- End‑user installation steps: [getting-started/install.md](../install.md)
- Server deployment options: [deployment/overview.md](../deployment.md)


