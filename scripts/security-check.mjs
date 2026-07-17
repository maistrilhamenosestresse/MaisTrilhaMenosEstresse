import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourceFiles = (await walk(path.join(root, 'src'))).filter((file) => /\.(?:ts|tsx|js|jsx)$/i.test(file));
const source = (await Promise.all(sourceFiles.map(async (file) => `${file}\n${await readFile(file, 'utf8')}`))).join('\n');
const failures = [];

for (const [label, pattern] of [
  ['integração InfinitePay remanescente', /infinitepay/i],
  ['URL antiga do projeto Supabase', /yslikzkgiaxafcgrqvzh/i],
  ['chave Supabase hardcoded', /sb_(?:publishable|secret)_[A-Za-z0-9_-]+/],
  ['fallback inseguro da service role', /SUPABASE_SERVICE_ROLE_KEY\s*\|\|/],
  ['fallback inseguro de bucket AWS', /AWS_S3_BUCKET_NAME\s*\|\|/],
  ['PIN padrão 1234', /(?:pin|senha)[^\n]{0,30}1234/i],
]) {
  if (pattern.test(source)) failures.push(label);
}

const publicFiles = await walk(path.join(root, 'public'));
const srcFiles = await walk(path.join(root, 'src'));
const localMedia = [...publicFiles, ...srcFiles].filter((file) => /\.(?:jpe?g|png|webp|heic|mp4|mov)$/i.test(file));
if (localMedia.length) failures.push(`${localMedia.length} mídias binárias ainda estão em src/ ou public/`);

for (const requiredPath of [
  'src/app/api/webhooks/asaas/route.ts',
  'src/app/api/cron/asaas-reconcile/route.ts',
  'src/app/api/cron/backup/route.ts',
  'src/proxy.ts',
  'supabase/migrations/202607160001_security_and_finance_foundation.sql',
]) {
  try { await readFile(path.join(root, requiredPath)); } catch { failures.push(`arquivo obrigatório ausente: ${requiredPath}`); }
}

for (const forbiddenPath of [
  'supabase_setup.sql',
  'fix_supabase.sql',
  'fix_supabase_final.sql',
  'fix_supabase_flyer.sql',
  'src/app/api/admin/migrate/route.ts',
]) {
  try {
    await readFile(path.join(root, forbiddenPath));
    failures.push(`script SQL legado inseguro presente: ${forbiddenPath}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

if (failures.length) {
  process.stderr.write(`Falhas de segurança:\n- ${failures.join('\n- ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write('Verificações estáticas de segurança concluídas sem falhas.\n');
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
