const fs = require('fs');
const path = require('path');
const pngToIcoModule = require('png-to-ico');

const pngToIco =
  (typeof pngToIcoModule === 'function' && pngToIcoModule) ||
  pngToIcoModule.default;

const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');
const INSTALLER_DIR = path.join(BUILD_DIR, 'installer');

const APPLE_TOUCH_ICON_PNG = path.join(ROOT, 'public', 'apple-touch-icon.png');
const LEGACY_EXE_ICON_PNG = path.join(ROOT, 'public', 'exeicon.png');
const EXE_ICON_ICO = path.join(BUILD_DIR, 'exeicon.ico');
const PUBLIC_FAVICON_ICO = path.join(ROOT, 'public', 'favicon.ico');
const WIZARD_BMP = path.join(INSTALLER_DIR, 'wizard.bmp');
const WIZARD_SMALL_BMP = path.join(INSTALLER_DIR, 'wizardsmall.bmp');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureFileExists(filePath, message) {
  if (!fs.existsSync(filePath)) {
    throw new Error(message);
  }
}

async function ensureExeIco() {
  const sourcePng = fs.existsSync(APPLE_TOUCH_ICON_PNG)
    ? APPLE_TOUCH_ICON_PNG
    : LEGACY_EXE_ICON_PNG;

  if (!fs.existsSync(sourcePng)) {
    throw new Error(`Fonte do icone nao encontrada: ${APPLE_TOUCH_ICON_PNG} (fallback: ${LEGACY_EXE_ICON_PNG})`);
  }

  const icoBuffer = await pngToIco(sourcePng);
  fs.writeFileSync(EXE_ICON_ICO, icoBuffer);
  fs.writeFileSync(PUBLIC_FAVICON_ICO, icoBuffer);
}

function removeLegacyInstallerAssets() {
  const legacyFiles = ['sidebar.bmp', 'sidebar-uninstall.bmp', 'header.bmp', 'header-small.bmp'];

  for (const fileName of legacyFiles) {
    const filePath = path.join(INSTALLER_DIR, fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

async function main() {
  ensureDir(BUILD_DIR);
  ensureDir(INSTALLER_DIR);

  ensureFileExists(WIZARD_BMP, 'Ficheiro obrigatorio em falta: build/installer/wizard.bmp');
  ensureFileExists(WIZARD_SMALL_BMP, 'Ficheiro obrigatorio em falta: build/installer/wizardsmall.bmp');

  await ensureExeIco();
  fs.copyFileSync(EXE_ICON_ICO, path.join(INSTALLER_DIR, 'exeicon.ico'));

  removeLegacyInstallerAssets();

  console.log('[prepare-installer-assets] Assets validados com sucesso sem substituir wizard.bmp/wizardsmall.bmp.');
}

main().catch((error) => {
  console.error('[prepare-installer-assets] Falha:', error);
  process.exit(1);
});


