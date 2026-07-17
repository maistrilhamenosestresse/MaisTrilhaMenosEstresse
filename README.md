# Mais Trilha Menos Estresse

Plataforma em Next.js 16 com site público, checkout, app móvel do cliente, painel administrativo, loja, pagamentos Asaas, mídia na AWS e dados no Supabase.

## Arquitetura

- **Supabase:** autenticação, clientes, reservas, agenda, loja, carteira, pontos, auditoria e documentos leves.
- **Asaas:** único provedor de cobrança para PIX, boleto e cartão. A confirmação financeira ocorre por webhook e reconciliação automática.
- **AWS S3/Rekognition:** imagens, vídeos, fotos de trilhas, assinaturas e reconhecimento facial.
- **Backup:** exportação lógica diária do Supabase, usuários de Auth, manifesto e espelho incremental das mídias para um bucket AWS separado.
- **App do cliente:** todas as rotas `/app` são bloqueadas no servidor para navegadores desktop e exigem autenticação, exceto `/app/login`.

## Configuração

Copie `.env.example` para `.env.local` e preencha todas as variáveis. Em produção, são especialmente obrigatórias:

- `ADMIN_EMAILS`
- `ASAAS_API_KEY` e `ASAAS_WEBHOOK_TOKEN`
- `AWS_S3_BUCKET_NAME` e um `AWS_BACKUP_BUCKET_NAME` diferente
- `CRON_SECRET`, `RATE_LIMIT_SECRET` e `REGISTRATION_SIGNING_SECRET`
- credenciais Supabase e AWS

Nunca envie `.env.local`, dumps ou backups para o Git. Como versões antigas continham dados e credenciais, rotacione as chaves Supabase, AWS, Asaas, Gmail, GitHub, WhatsApp e os segredos de sessão antes do deploy.

## Ordem obrigatória do deploy

1. Crie/configure os buckets de mídia e backup na AWS. O bucket de backup deve ser separado.
2. Configure as variáveis de ambiente no provedor de hospedagem.
3. Execute integralmente [`supabase/migrations/202607160001_security_and_finance_foundation.sql`](supabase/migrations/202607160001_security_and_finance_foundation.sql) no SQL Editor do Supabase.
   Como alternativa, configure `DATABASE_URL` somente no ambiente local e rode `npm run db:migrate`.
4. Rode `npm run media:sync-manifest` para gravar no Supabase o manifesto já armazenado em `legacy-media/manifest.json` no S3.
5. Configure na Asaas o webhook `https://SEU_DOMINIO/api/webhooks/asaas`, usando exatamente o valor de `ASAAS_WEBHOOK_TOKEN` como token de autenticação.
6. Faça o deploy e execute `npm run verify`.
7. Execute `npm run readiness:check`. Esse comando consulta os serviços reais sem modificar dados e falha se a migration, os segredos, o manifesto, a AWS ou a Asaas ainda não estiverem prontos.
8. Acione `/api/admin/backup` pelo painel e confirme que o primeiro backup terminou no bucket separado.

Aplicar o código antes da migration fará endpoints públicos retornarem `503`, pois o rate limit e as transações financeiras dependem das novas funções SQL.

## Comandos

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run verify
npm run db:migrate
npm run readiness:check
npm run readiness:test
```

Use `npm run readiness:test` durante a homologação com o sandbox da Asaas. Antes do deploy real, `npm run readiness:check` deve passar sem a opção de sandbox.

Migração de mídia, já executada neste workspace:

```bash
npm run media:migrate
npm run media:repair
npm run media:sync-manifest
```

Foram migrados **552 arquivos de imagem/vídeo (2.020.671.407 bytes)** para `legacy-media/` no S3. Os binários locais foram removidos depois da confirmação dos uploads.

## Rotinas automáticas

- `/api/cron/asaas-reconcile`: a cada 30 minutos; confirma pagamentos perdidos, processa estornos e libera pedidos/reservas abandonados.
- `/api/cron/backup`: diariamente às 03:30; gera backup lógico comprimido e espelha mídia incrementalmente.
- `/api/cron/birthdays`: diariamente às 10:00.

As rotas de cron exigem `Authorization: Bearer <CRON_SECRET>`.
