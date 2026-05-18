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

  const exePath = path.resolve(__dirname, '..', 'release', 'win-unpacked', 'ALGARTEMPO.exe');
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
