const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');

exports.default = async function(context) {
  const platform = context.electronPlatformName; // 'win32'|'darwin'|'linux'
  const archName = context.arch === 3 ? 'arm64' : 'x64';
  const platDir  = platform === 'win32' ? 'win' : platform === 'darwin' ? 'mac' : 'linux';

  const zipPath = path.join(context.projectDir, 'vendor','nativephp','php-bin','bin', platDir, archName, 'php-8.4.zip');
  const outDir  = path.join(context.appOutDir, 'resources', 'php-bin', 'php-8.4');

  if (!fs.existsSync(zipPath)) return;
  fs.mkdirSync(outDir, { recursive: true });
  new AdmZip(zipPath).extractAllTo(outDir, true);
  if (platform !== 'win32') fs.chmodSync(path.join(outDir, 'php'), 0o755);
  console.log('[afterPack] PHP pre-extracted to', outDir);
};
