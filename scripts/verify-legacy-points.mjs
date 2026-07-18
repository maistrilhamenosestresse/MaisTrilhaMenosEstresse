import { readFile } from "node:fs/promises";
import pg from "pg";

const { Client } = pg;
const content = await readFile(".env.local", "utf8");
for (const line of content.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
  if (!match || process.env[match[1]]) continue;
  process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const reconciliation = await client.query(`
    select metadata
    from public.audit_logs
    where action = 'legacy_trail_points_reconciliation'
    order by created_at desc
    limit 1
  `);
  const remaining = await client.query(`
    select count(distinct r.client_id)::integer as clients_without_points
    from public.reservas r
    inner join public.clients c on c.id = r.client_id
    where r.status_pagamento = 'pago'
      and r.created_at < timestamptz '2026-07-17 00:00:00-03'
      and coalesce(c.pontos, 0) = 0
  `);
  process.stdout.write(`${JSON.stringify({
    reconciliation: reconciliation.rows[0]?.metadata || null,
    legacyPaidClientsStillAtZero: remaining.rows[0]?.clients_without_points || 0,
  })}\n`);
} finally {
  await client.end();
}
