const fs = require('fs');
const path = require('path');

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const rceditModule = require('rcedit');
  const rcedit =
    (typeof rceditModule === 'function' && rceditModule) ||
    rceditModule.rcedit ||
    rceditModule.default;

  if (typeof rcedit !== 'function') {
    throw new Error('Nao foi possivel resolver a funcao rcedit.');
  }

  const unpackedDir = path.resolve(__dirname, '..', 'release', 'win-unpacked');
  const preferredExePath = path.join(unpackedDir, 'ALGARTEMPO.exe');
  let exePath = preferredExePath;

  if (!fs.existsSync(exePath)) {
    const fallbackExe = fs
      .readdirSync(unpackedDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.exe'))
      .map((entry) => entry.name)
      .find((name) => name.toLowerCase() === 'electron.exe')
      || fs
        .readdirSync(unpackedDir, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.exe'))
        .map((entry) => entry.name)[0];

    if (fallbackExe) {
      exePath = path.join(unpackedDir, fallbackExe);
      console.warn('[set-exe-icon] Exe esperado nao encontrado. A usar fallback:', exePath);
    }
  }
  const iconPath = path.resolve(__dirname, '..', 'build', 'exeicon.ico');

  if (!fs.existsSync(exePath)) {
    console.warn('[set-exe-icon] Exe nao encontrado:', exePath);
    process.exit(0);
  }

  if (!fs.existsSync(iconPath)) {
    console.warn('[set-exe-icon] Icone nao encontrado:', iconPath);
    process.exit(0);
  }

  const maxAttempts = 5;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await rcedit(exePath, { icon: iconPath });
      console.log(`[set-exe-icon] Icone aplicado com sucesso em ${exePath} (tentativa ${attempt}/${maxAttempts})`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        console.warn(`[set-exe-icon] Tentativa ${attempt} falhou. A tentar novamente...`);
        await wait(1200);
      }
    }
  }

  throw lastError;
}

main().catch((error) => {
  console.error('[set-exe-icon] Falha ao aplicar icone:', error);
  process.exit(1);
});
