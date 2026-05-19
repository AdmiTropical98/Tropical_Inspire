const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const sharp = require('sharp');
const pngToIcoModule = require('png-to-ico');

const pngToIco =
  (typeof pngToIcoModule === 'function' && pngToIcoModule) ||
  pngToIcoModule.default;

const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');
const INSTALLER_DIR = path.join(BUILD_DIR, 'installer');

const EXE_ICON_PNG = path.join(ROOT, 'public', 'exeicon.png');
const EXE_ICON_ICO = path.join(BUILD_DIR, 'exeicon.ico');
const LOGO_IMAGE = path.join(ROOT, 'public', 'LOGO_SIDEBAR.png');
const BG_IMAGE = path.join(ROOT, 'public', 'fleet-bg.png');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toPsLiteral(filePath) {
  return filePath.replace(/'/g, "''");
}

function convertPngToBmp(pngPath, bmpPath) {
  const command = [
    'Add-Type -AssemblyName System.Drawing',
    `$src = "${toPsLiteral(pngPath)}"`,
    `$dst = "${toPsLiteral(bmpPath)}"`,
    '$img = [System.Drawing.Image]::FromFile($src)',
    '$bmp = New-Object System.Drawing.Bitmap $img',
    '$bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Bmp)',
    '$bmp.Dispose()',
    '$img.Dispose()'
  ].join('; ');

  const result = spawnSync('powershell', ['-NoProfile', '-Command', command], {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(`Falha ao converter PNG para BMP: ${result.stderr || result.stdout}`);
  }
}

function svgOverlay(width, height, title, subtitle) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0b1f47" />
          <stop offset="100%" stop-color="#081634" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" rx="0" ry="0" />
      <rect x="0" y="0" width="100%" height="100%" fill="rgba(10, 19, 40, 0.52)" />
      <rect x="16" y="182" width="132" height="96" rx="12" fill="rgba(37, 99, 235, 0.18)" stroke="rgba(147, 197, 253, 0.26)" />
      <text x="24" y="206" fill="#cfe1ff" font-size="10" font-family="Segoe UI, Arial" letter-spacing="1.1">PREMIUM SETUP</text>
      <text x="24" y="228" fill="#ffffff" font-size="15" font-weight="700" font-family="Segoe UI, Arial">${title}</text>
      <text x="24" y="246" fill="#a9bbdc" font-size="10" font-family="Segoe UI, Arial">${subtitle}</text>
      <text x="24" y="263" fill="#8da3c7" font-size="9" font-family="Segoe UI, Arial">Fleet Operations Platform</text>
    </svg>
  `);
}

async function generateSidebar(targetFile, title, subtitle) {
  const width = 164;
  const height = 314;

  const bg = await sharp(BG_IMAGE)
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .modulate({ brightness: 0.62, saturation: 0.74 })
    .toBuffer();

  const logo = await sharp(LOGO_IMAGE)
    .resize({ width: 112, fit: 'inside' })
    .png()
    .toBuffer();

  const canvas = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#0a1b3f',
    },
  });

  const tempPng = targetFile.replace(/\.bmp$/i, '.tmp.png');

  await canvas
    .composite([
      { input: bg, left: 0, top: 0 },
      { input: svgOverlay(width, height, title, subtitle), left: 0, top: 0 },
      { input: logo, left: 26, top: 24 },
    ])
    .png()
    .toFile(tempPng);

  convertPngToBmp(tempPng, targetFile);
  fs.unlinkSync(tempPng);
}

async function generateHeader(targetFile) {
  const width = 150;
  const height = 57;

  const logo = await sharp(LOGO_IMAGE)
    .resize({ width: 56, fit: 'inside' })
    .png()
    .toBuffer();

  const headerSvg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0d2554" />
          <stop offset="100%" stop-color="#17408f" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#h)" />
      <text x="66" y="25" fill="#ffffff" font-size="11" font-weight="700" font-family="Segoe UI, Arial">ALGARTEMPO</text>
      <text x="66" y="40" fill="#c7dbff" font-size="9" font-family="Segoe UI, Arial">FROTA ENTERPRISE</text>
    </svg>
  `);

  const tempPng = targetFile.replace(/\.bmp$/i, '.tmp.png');

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#12346f',
    },
  })
    .composite([
      { input: headerSvg, left: 0, top: 0 },
      { input: logo, left: 8, top: 5 },
    ])
    .png()
    .toFile(tempPng);

  convertPngToBmp(tempPng, targetFile);
  fs.unlinkSync(tempPng);
}

async function generateHeaderSmall(targetFile) {
  const width = 55;
  const height = 55;

  const logo = await sharp(LOGO_IMAGE)
    .resize({ width: 44, fit: 'inside' })
    .png()
    .toBuffer();

  const tempPng = targetFile.replace(/\.bmp$/i, '.tmp.png');

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#0d2554',
    },
  })
    .composite([{ input: logo, left: 5, top: 5 }])
    .png()
    .toFile(tempPng);

  convertPngToBmp(tempPng, targetFile);
  fs.unlinkSync(tempPng);
}

async function ensureExeIco() {
  if (!fs.existsSync(EXE_ICON_PNG)) {
    throw new Error(`Fonte do icone nao encontrada: ${EXE_ICON_PNG}`);
  }

  const icoBuffer = await pngToIco(EXE_ICON_PNG);
  fs.writeFileSync(EXE_ICON_ICO, icoBuffer);
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

  await ensureExeIco();
  fs.copyFileSync(EXE_ICON_ICO, path.join(INSTALLER_DIR, 'exeicon.ico'));
  await generateSidebar(path.join(INSTALLER_DIR, 'wizard.bmp'), 'ALGARTEMPO FROTA', 'Enterprise Installer');
  await generateHeaderSmall(path.join(INSTALLER_DIR, 'wizardsmall.bmp'));
  removeLegacyInstallerAssets();

  console.log('[prepare-installer-assets] Assets do instalador gerados com sucesso.');
}

main().catch((error) => {
  console.error('[prepare-installer-assets] Falha:', error);
  process.exit(1);
});


