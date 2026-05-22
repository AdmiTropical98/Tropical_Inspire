const { existsSync, readFileSync, readdirSync, statSync, writeFileSync } = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(ROOT, 'release');

function parseArgs(argv) {
  const args = {
    file: null,
    write: false,
    check: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--file') {
      args.file = argv[i + 1] || null;
      i += 1;
    } else if (arg === '--write') {
      args.write = true;
    } else if (arg === '--check') {
      args.check = true;
    }
  }

  if (!args.write && !args.check) {
    args.write = true;
    args.check = true;
  }

  return args;
}

function sha256OfFile(filePath) {
  const buffer = readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function resolveInstallerPath(fileArg) {
  if (fileArg) {
    const absolute = path.isAbsolute(fileArg) ? fileArg : path.join(ROOT, fileArg);
    if (!existsSync(absolute)) {
      throw new Error(`Instalador nao encontrado: ${absolute}`);
    }
    return absolute;
  }

  if (!existsSync(RELEASE_DIR)) {
    throw new Error(`Diretorio release nao encontrado: ${RELEASE_DIR}`);
  }

  const candidates = readdirSync(RELEASE_DIR)
    .filter((name) => /-Setup-.*-Inno\.exe$/i.test(name))
    .map((name) => {
      const fullPath = path.join(RELEASE_DIR, name);
      return {
        fullPath,
        mtime: statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (candidates.length === 0) {
    throw new Error('Nenhum instalador Inno encontrado em release/.');
  }

  return candidates[0].fullPath;
}

function checksumFilePath(installerPath) {
  return `${installerPath}.sha256`;
}

function writeChecksum(installerPath, hash) {
  const checksumPath = checksumFilePath(installerPath);
  const baseName = path.basename(installerPath);
  writeFileSync(checksumPath, `${hash} *${baseName}\n`, 'utf8');
  return checksumPath;
}

function readChecksum(checksumPath) {
  if (!existsSync(checksumPath)) {
    throw new Error(`Checksum nao encontrado: ${checksumPath}`);
  }

  const firstLine = readFileSync(checksumPath, 'utf8').split(/\r?\n/).find(Boolean) || '';
  const [hash] = firstLine.trim().split(/\s+/);

  if (!hash || hash.length < 64) {
    throw new Error(`Formato invalido de checksum em: ${checksumPath}`);
  }

  return hash.toUpperCase();
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const installerPath = resolveInstallerPath(args.file);
  const hash = sha256OfFile(installerPath);
  let checksumPath = checksumFilePath(installerPath);

  console.log(`[release-integrity] Instalador: ${installerPath}`);
  console.log(`[release-integrity] SHA256 atual: ${hash}`);

  if (args.write) {
    checksumPath = writeChecksum(installerPath, hash);
    console.log(`[release-integrity] Checksum gravado: ${checksumPath}`);
  }

  if (args.check) {
    const expected = readChecksum(checksumPath);
    if (expected !== hash) {
      throw new Error(
        `Checksum invalido. Esperado ${expected}, calculado ${hash}.`
      );
    }
    console.log('[release-integrity] Checksum validado com sucesso.');
  }
}

try {
  run();
} catch (error) {
  console.error('[release-integrity] Falha:', error.message || error);
  process.exit(1);
}
