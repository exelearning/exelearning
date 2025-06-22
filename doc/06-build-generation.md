# Executable Generation

In addition to Docker container deployment, the GitHub Actions pipeline also builds and publishes native desktop installers for all major platforms. These installers package the application using [`electron-builder`](https://www.electron.build/), embedding a static PHP runtime through [`nativePHP/php-bin`](https://github.com/crazywhalecc/static-php-cli).

---

## Automatic Updates

The application includes built-in support for **automatic updates** via [`electron-updater`](https://www.electron.build/auto-update). Once a new release is published, users will receive an update notification the next time they launch the app. The download and installation process is handled transparently in the background.

> ⚠️ Updates are delivered only for **official releases** published in GitHub Releases.

---

## Virus Scanning

As part of the `app.yml` build pipeline, **all generated binaries are automatically uploaded to [VirusTotal](https://www.virustotal.com/)** for malware scanning. This provides an extra layer of security and trust for end users.

The scan report is generated during the build process, and if any threat is detected, the release is flagged before publication.

---

## Generated Installer Formats

Each production release generates and publishes the following installers:

### **Linux**

* `.deb` (Debian/Ubuntu)
* `.rpm` (RedHat, Fedora)

### **macOS**

* `.dmg` (universal build for Intel + Apple Silicon)
* `.zip` (universal portable archive)

### **Windows**

* `.nsis` (classic installer)
* `.msi` (wrapped NSIS, suitable for enterprise)

All artifacts are uploaded to the **GitHub Releases** page.

---

## Local Build Instructions

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

### Build Locally

```bash
yarn build
```

The resulting installers will be saved in the `dist/` directory.

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

