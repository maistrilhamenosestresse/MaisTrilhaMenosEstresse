import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;
await loadEnv(path.join(process.cwd(), '.env.local'));

const connectionString = required('DATABASE_URL');
const requestedMigration = process.argv[2] || 'supabase/migrations/202607160001_security_and_finance_foundation.sql';
const migrationPath = path.isAbsolute(requestedMigration)
  ? requestedMigration
  : path.join(process.cwd(), requestedMigration);
const migration = await readFile(migrationPath, 'utf8');
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
  query_timeout: 120_000,
});

try {
  await client.connect();
  await client.query("select pg_advisory_lock(hashtext('maistrilha-security-finance-migration'))");
  try {
    await client.query(migration);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    await client.query("select pg_advisory_unlock(hashtext('maistrilha-security-finance-migration'))").catch(() => undefined);
  }
  process.stdout.write(`Migration aplicada com sucesso: ${path.relative(process.cwd(), migrationPath)}\n`);
} catch (error) {
  const code = error?.code ? ` (${error.code})` : '';
  const detail = error?.code === '28P01'
    ? 'Senha do banco rejeitada. Copie novamente a URI em Supabase > Connect e substitua [YOUR-PASSWORD] pela senha do banco, codificando caracteres especiais na URL.'
    : String(error?.message || error);
  throw new Error(`Falha ao aplicar migration${code}: ${detail}`);
} finally {
  await client.end().catch(() => undefined);
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
