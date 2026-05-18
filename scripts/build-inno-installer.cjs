const { existsSync, readFileSync } = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ISS_FILE = path.join(ROOT, 'build', 'installer', 'ALGARTEMPO.iss');

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

  const result = spawnSync(iscc, [`/DMyAppVersion=${pkgVersion}`, ISS_FILE], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: iscc.toLowerCase() === 'iscc'
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  console.log('[build-inno-installer] Instalador Inno gerado com sucesso.');
}

try {
  run();
} catch (error) {
  console.error('[build-inno-installer] Falha:', error.message || error);
  process.exit(1);
}
