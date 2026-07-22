# Mais Trilha Menos Estresse

Plataforma em Next.js 16 com site público, checkout, PWA instalável do cliente, painel administrativo, loja, pagamentos InfinitePay/Asaas, mídia na AWS e dados no Supabase.

## Arquitetura

- **Supabase:** autenticação, clientes, reservas, agenda, loja, carteira, pontos, auditoria e documentos leves.
- **InfinitePay:** checkout hospedado para Pix e cartão, com confirmação pelo `payment_check` oficial antes da liberação.
- **Asaas:** emissão de boleto, confirmação por webhook e reconciliação automática.
- **AWS S3/Rekognition:** imagens, vídeos, fotos de trilhas, assinaturas e reconhecimento facial.
- **Backup:** exportação lógica diária do Supabase, usuários de Auth, manifesto e espelho incremental das mídias para um bucket AWS separado.
- **App do cliente:** todas as rotas `/app` são bloqueadas no servidor para navegadores desktop e exigem autenticação, exceto `/app/login`.
- **PWA e notificações:** app instalável com Web Push para Android, desktop e iPhone/iPad 16.4+ quando adicionado à Tela de Início.

## Configuração

Copie `.env.example` para `.env.local` e preencha todas as variáveis. Em produção, são especialmente obrigatórias:

- `ADMIN_EMAILS`
- `INFINITEPAY_HANDLE=nivea-maria-7en`, `INFINITEPAY_API_URL=https://api.checkout.infinitepay.io` e `INFINITEPAY_PUBLIC_BASE_URL` com o domínio oficial
- `ASAAS_API_URL=https://api.asaas.com/v3`, uma `ASAAS_API_KEY` de produção e `ASAAS_WEBHOOK_TOKEN`
- `AWS_S3_BUCKET_NAME` e um `AWS_BACKUP_BUCKET_NAME` diferente
- `CRON_SECRET`, `RATE_LIMIT_SECRET` e `REGISTRATION_SIGNING_SECRET`
- credenciais Supabase e AWS
- `NEXT_PUBLIC_BASE_URL` e `NEXT_PUBLIC_SITE_URL` com `https://www.maistrilhasmenosestresse.com`
- `WEB_PUSH_VAPID_SUBJECT`, `WEB_PUSH_VAPID_PUBLIC_KEY` e `WEB_PUSH_VAPID_PRIVATE_KEY`

Nunca envie `.env.local`, dumps ou backups para o Git. Como versões antigas continham dados e credenciais, rotacione as chaves Supabase, AWS, Asaas, Gmail, GitHub, WhatsApp e os segredos de sessão antes do deploy.

## Ordem obrigatória do deploy

1. Crie/configure os buckets de mídia e backup na AWS. O bucket de backup deve ser separado.
2. Configure as variáveis de ambiente de produção no provedor de hospedagem. Não reutilize a chave do sandbox da Asaas.
3. Aplique, em ordem, todos os arquivos de [`supabase/migrations`](supabase/migrations). Como alternativa, configure `DATABASE_URL` somente no ambiente local e rode `npm run db:migrate`.
4. A migração `202607170001_backfill_legacy_trail_points.sql` credita, sem duplicação, as trilhas pagas anteriores ao sistema de pontos.
5. Rode `npm run media:sync-manifest` para gravar no Supabase o manifesto já armazenado em `legacy-media/manifest.json` no S3.
6. Configure na Asaas o webhook `https://www.maistrilhasmenosestresse.com/api/webhooks/asaas`, usando exatamente o valor de `ASAAS_WEBHOOK_TOKEN` como token de autenticação (`asaas-access-token`).
7. A InfinitePay receberá callbacks em `https://www.maistrilhasmenosestresse.com/api/webhooks/infinitepay`; a aplicação sempre reconfirma a transação pela API oficial.
8. Faça o deploy e execute `npm run verify`.
9. Execute `npm run readiness:check`. Esse comando consulta os serviços reais sem criar cobranças e falha se migrations, segredos, domínio, AWS, Supabase, InfinitePay ou Asaas não estiverem prontos.
10. Acione `POST /api/admin/backup` autenticado como administrador e depois `POST /api/admin/backup/verify`. Confirme os dois registros no bucket e no Supabase.

Aplicar o código antes da migration fará endpoints públicos retornarem `503`, pois o rate limit e as transações financeiras dependem das novas funções SQL.

## Aplicativo instalável e notificações

- Android: abra o app no navegador, toque em **Instalar app** e depois em **Ativar notificações**.
- iPhone/iPad 16.4 ou superior: use **Compartilhar > Adicionar à Tela de Início**, abra pelo novo ícone e ative as notificações dentro do app.
- O usuário escolhe entre novidades de trilhas, lembretes de reservas e benefícios, podendo desativar o aparelho a qualquer momento.
- Administradores enviam campanhas em `/admin/notificacoes`.
- O cron `/api/cron/trail-reminders` envia um lembrete às 09:30 no dia anterior às trilhas pagas.

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
npm run media:migrate-agendas -- --apply
npm run media:repair
npm run media:sync-manifest
```

Foram migrados **552 arquivos de imagem/vídeo (2.020.671.407 bytes)** para `legacy-media/` no S3. Os binários locais foram removidos depois da confirmação dos uploads.

## Rotinas automáticas

- `/api/cron/asaas-reconcile`: a cada 30 minutos; confirma pagamentos perdidos, processa estornos e libera pedidos/reservas abandonados.
- `/api/cron/backup`: diariamente às 03:30; gera backup lógico comprimido e espelha mídia incrementalmente.
- `/api/cron/backup-verify`: aos domingos às 04:30; baixa o backup mais recente, valida checksums, estrutura e uma amostra do espelho de mídias.
- `/api/cron/birthdays`: diariamente às 10:00.

As rotas de cron exigem `Authorization: Bearer <CRON_SECRET>`.
