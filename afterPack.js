// afterPack.js
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

exports.default = async function (context) {
  // Platform mapping
  const platform = context.electronPlatformName; // 'win32' | 'darwin' | 'linux'
  const platDir = platform === 'win32' ? 'win' : platform === 'darwin' ? 'mac' : 'linux';

  // Arch mapping (electron-builder: ia32=1, x64=2, armv7l=3, arm64=4, universal=5)
  const arch = context.arch;
  const archName = arch === 4 ? 'arm64' : 'x64';

  // Use packager.projectDir (projectDir no existe en context)
  const projectDir = (context.packager && context.packager.projectDir) || process.cwd();

  // Paths
  const zipPath = path.join(projectDir, 'vendor', 'nativephp', 'php-bin', 'bin', platDir, archName, 'php-8.4.zip');
  const outDir  = path.join(context.appOutDir, 'resources', 'php-bin', 'php-8.4');

  // Skip if the PHP bundle for this platform/arch is not present
  if (!fs.existsSync(zipPath)) {
    console.warn('[afterPack] php-bin zip not found, skipping:', zipPath);
    return;
  }

  // Extract PHP runtime
  fs.mkdirSync(outDir, { recursive: true });
  new AdmZip(zipPath).extractAllTo(outDir, true);

  // Make PHP binary executable on unix
  if (platform !== 'win32') {
    const phpBin = path.join(outDir, 'php');
    if (fs.existsSync(phpBin)) fs.chmodSync(phpBin, 0o755);
  }

  console.log('[afterPack] PHP pre-extracted to', outDir);
};
