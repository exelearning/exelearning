// packaging/afterPack.js
// Put one PHP at Contents/Resources/php/mac/php in each partial (x64/arm64)
// so @electron/universal can lipo them. Do not touch the final universal pass.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch {} }
function ensureExec(p) { try { fs.chmodSync(p, 0o755); } catch {} }
function dequarantine(p) { try { execFileSync('xattr', ['-cr', p], { stdio: 'ignore' }); } catch {} }

module.exports = async (context) => {
  if (context.electronPlatformName !== 'darwin') return;

  const out = context.appOutDir || '';
  const isX64   = /mac-universal-x64-temp/i.test(out);
  const isARM64 = /mac-universal-arm64-temp/i.test(out);
  if (!isX64 && !isARM64) return; // don't touch the final universal

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const resources = path.join(context.appOutDir, appName, 'Contents', 'Resources');
  const macRoot = path.join(resources, 'php', 'mac');

  const arch = isARM64 ? 'arm64' : 'x64';
  const src = path.join(macRoot, arch, 'php');
  const dst = path.join(macRoot, 'php');

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    ensureExec(dst);
    dequarantine(dst);
    // remove arch folders -> ambos parciales quedan con el MISMO set de Mach-O
    rmrf(path.join(macRoot, 'arm64'));
    rmrf(path.join(macRoot, 'x64'));
    console.log(`[afterPack] ${arch}: staged ${dst} and removed arch folders`);
  } else {
    console.log(`[afterPack] ${arch}: php not found at ${src}`);
  }
};
