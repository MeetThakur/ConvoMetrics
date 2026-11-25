import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

const packageDir = new URL('../node_modules/pyodide/', import.meta.url);
const publicDir = new URL('../public/analysis/', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('package.json', packageDir), 'utf8'));
const lock = JSON.parse(await readFile(new URL('pyodide-lock.json', packageDir), 'utf8'));
const runtimeDir = new URL(`pyodide-${version}/`, publicDir);

async function downloadWheel(url, checksum) {
  const wheel = new URL(url.split('/').pop(), runtimeDir);
  const hash = (contents) => createHash('sha256').update(contents).digest('hex');
  const existing = await readFile(wheel).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing && hash(existing) === checksum) return;

  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Could not download ${url} (HTTP ${response.status})`);
  const contents = Buffer.from(await response.arrayBuffer());
  if (hash(contents) !== checksum) throw new Error(`Checksum mismatch for ${url}`);
  await writeFile(wheel, contents);
}

const packages = new Set();
function includePackage(name) {
  if (packages.has(name)) return;
  packages.add(name);
  for (const dependency of lock.packages[name].depends) includePackage(dependency);
}
includePackage('pandas');

await mkdir(runtimeDir, { recursive: true });
await Promise.all([
  ...['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'pyodide-lock.json', 'python_stdlib.zip']
    .map((file) => copyFile(new URL(file, packageDir), new URL(file, runtimeDir))),
  ...Array.from(packages, (name) => {
    const { file_name: file, sha256 } = lock.packages[name];
    return downloadWheel(`https://cdn.jsdelivr.net/pyodide/v${version}/full/${file}`, sha256);
  }),
  downloadWheel(
    'https://files.pythonhosted.org/packages/fd/8a/75e3177f374877b19dd3112820b071836ad1100f9f58424630b4783519bc/emoji-2.16.0-py3-none-any.whl',
    'c4230d80640def9071599ff56b1b5950fe13a2a94c0da98c5deab12431b24330',
  ),
]);
