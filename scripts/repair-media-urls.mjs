import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
await loadEnv(path.join(root, '.env.local'));
const bucket = required('AWS_S3_BUCKET_NAME');
const region = process.env.AWS_REGION || 'us-east-1';
const base = `https://${bucket}.s3.${region}.amazonaws.com/legacy-media`;
const mediaFiles = (await walk(path.join(root, 'public'))).filter(isMediaFile);
const replacements = new Map();

for (const file of mediaFiles) {
  const relative = path.relative(path.join(root, 'public'), file).split(path.sep).join('/');
  const encoded = relative.split('/').map(encodeURIComponent).join('/');
  const url = `${base}/${encoded}`;
  replacements.set(`/${relative}`, url);
  replacements.set(`/${encoded}`, url);
  if (relative.startsWith('bio/')) {
    replacements.set(relative.slice(4), url);
    replacements.set(encoded.slice(4), url);
  }
}

const textFiles = [
  ...(await walk(path.join(root, 'src'))).filter(isTextFile),
  ...(await walk(path.join(root, 'public'))).filter(isTextFile),
];
let changed = 0;
for (const file of textFiles) {
  const original = await readFile(file, 'utf8');
  let updated = original.replaceAll('/FotosEvideos//', '/FotosEvideos/');
  let previous;
  do {
    previous = updated;
    updated = updated
      .replaceAll(`${base}/images${base}/logo.png`, `${base}/images/logo.png`)
      .replaceAll(`${base}/bio/${base}/bio/`, `${base}/bio/`)
      .replaceAll(`${base}${base}`, base);
  } while (updated !== previous);
  for (const [from, to] of replacements) updated = replaceOutsideHttpUrl(updated, from, to);
  if (updated !== original) {
    await writeFile(file, updated, 'utf8');
    changed++;
  }
}
process.stdout.write(`Referências de mídia normalizadas em ${changed} arquivos.\n`);

function replaceOutsideHttpUrl(text, from, to) {
  let cursor = 0;
  let output = '';
  while (true) {
    const index = text.indexOf(from, cursor);
    if (index < 0) return output + text.slice(cursor);
    const tokenStart = Math.max(
      text.lastIndexOf('"', index - 1), text.lastIndexOf("'", index - 1),
      text.lastIndexOf(' ', index - 1), text.lastIndexOf('\n', index - 1),
      text.lastIndexOf('(', index - 1),
    ) + 1;
    const tokenPrefix = text.slice(tokenStart, index);
    output += text.slice(cursor, index);
    output += /^https?:\/\//i.test(tokenPrefix) ? from : to;
    cursor = index + from.length;
  }
}

async function walk(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return (await Promise.all(entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(target) : [target];
    }))).flat();
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function loadEnv(file) {
  const content = await readFile(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

function isTextFile(file) {
  return /\.(?:js|mjs|cjs|ts|tsx|jsx|json|html|css|md|txt)$/i.test(file) && !file.includes(`${path.sep}fotos_otimizadas${path.sep}`);
}

function isMediaFile(file) {
  return /\.(?:jpe?g|png|webp|heic|mp4|mov)$/i.test(file);
}
