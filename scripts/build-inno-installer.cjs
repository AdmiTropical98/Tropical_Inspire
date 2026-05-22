const {
  existsSync,
  readFileSync,
  openSync,
  writeFileSync,
  closeSync,
  unlinkSync,
  mkdirSync,
  copyFileSync,
  rmSync
} = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ISS_FILE = path.join(ROOT, 'build', 'installer', 'ALGARTEMPO.iss');
const BUILD_LOCK = path.join(ROOT, '.inno-build.lock');

function acquireBuildLock() {
  const clearStaleLock = () => {
    if (!existsSync(BUILD_LOCK)) {
      return false;
    }

    try {
      const raw = readFileSync(BUILD_LOCK, 'utf8').trim();
      const lockPid = Number.parseInt(raw, 10);

      if (!Number.isFinite(lockPid) || lockPid <= 0) {
        unlinkSync(BUILD_LOCK);
        return true;
      }

      try {
        process.kill(lockPid, 0);
        return false;
      } catch {
        unlinkSync(BUILD_LOCK);
        return true;
      }
    } catch {
      try {
        unlinkSync(BUILD_LOCK);
      } catch {
        // Ignorar erros de limpeza de lock invalido.
      }
      return true;
    }
  };

  clearStaleLock();

  try {
    const fd = openSync(BUILD_LOCK, 'wx');
    writeFileSync(fd, `${process.pid}\n`, 'utf8');
    closeSync(fd);
    return;
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      if (clearStaleLock()) {
        const retryFd = openSync(BUILD_LOCK, 'wx');
        writeFileSync(retryFd, `${process.pid}\n`, 'utf8');
        closeSync(retryFd);
        return;
      }

      throw new Error('Ja existe uma compilacao Inno em execucao. Fecha a outra compilacao e tenta novamente.');
    }
    throw error;
  }
}

function releaseBuildLock() {
  if (existsSync(BUILD_LOCK)) {
    unlinkSync(BUILD_LOCK);
  }
}

function resolveIscc() {
  const userProfile = process.env.USERPROFILE || os.homedir() || '';
  const localAppData =
    process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local');

  const candidates = [
    process.env.ISCC_PATH,
    path.join(localAppData, 'Programs', 'Inno Setup 6', 'ISCC.exe'),
    path.join(userProfile, 'AppData', 'Local', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe'
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const whereIscc = spawnSync('where', ['iscc'], {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
    shell: true
  });

  if (whereIscc.status === 0) {
    return 'iscc';
  }

  return null;
}

function run() {
  acquireBuildLock();

  if (!existsSync(ISS_FILE)) {
    throw new Error(`Script Inno nao encontrado: ${ISS_FILE}`);
  }

  const iscc = resolveIscc();
  if (!iscc) {
    throw new Error(
      'Inno Setup Compiler nao encontrado. Instala o Inno Setup 6 ou define ISCC_PATH para o caminho do ISCC.exe.'
    );
  }

  const pkgPath = path.join(ROOT, 'package.json');
  const pkgVersion = JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  const outputBaseName = `ALGARTEMPO-Setup-${pkgVersion}-Inno`;
  const outputFileName = `${outputBaseName}.exe`;
  const tempOutputDir = path.join(os.tmpdir(), 'algartempo-inno-output');
  const finalOutputPath = path.join(ROOT, 'release', outputFileName);
  const tempOutputPath = path.join(tempOutputDir, outputFileName);

  mkdirSync(tempOutputDir, { recursive: true });
  try {
    rmSync(tempOutputPath, { force: true });
  } catch {
    // Ignorar limpeza inicial.
  }

  const result = spawnSync(iscc, [`/O${tempOutputDir}`, `/F${outputBaseName}`, `/DMyAppVersion=${pkgVersion}`, ISS_FILE], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: iscc.toLowerCase() === 'iscc'
  });

  if (result.status !== 0) {
    throw new Error(`ISCC terminou com codigo ${result.status || 1}.`);
  }

  if (!existsSync(tempOutputPath)) {
    throw new Error(`Instalador nao foi gerado no caminho esperado: ${tempOutputPath}`);
  }

  let copied = false;
  let copyError = null;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      copyFileSync(tempOutputPath, finalOutputPath);
      copied = true;
      break;
    } catch (error) {
      copyError = error;
      const waitUntil = Date.now() + attempt * 300;
      while (Date.now() < waitUntil) {
        // Busy wait curto para evitar falha intermitente por lock externo.
      }
    }
  }

  if (!copied) {
    throw new Error(`Falha ao copiar instalador final para release: ${copyError && copyError.message ? copyError.message : copyError}`);
  }

  console.log(`[build-inno-installer] Instalador Inno gerado com sucesso: ${finalOutputPath}`);
}

try {
  run();
} catch (error) {
  console.error('[build-inno-installer] Falha:', error.message || error);
  process.exit(1);
} finally {
  try {
    releaseBuildLock();
  } catch {
    // Nao interromper o fluxo se falhar a limpeza do lock.
  }
}
