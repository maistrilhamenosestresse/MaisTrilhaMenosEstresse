# Importação do Google Fotos para AWS

O painel usa a Google Photos Picker API. O administrador conecta sua conta, pesquisa o álbum pelo nome no seletor oficial do Google e seleciona as mídias. O sistema pagina a seleção, registra um job no Supabase e envia cada item para uma fila SQS. Uma função Lambda transfere os bytes para o S3, indexa rostos nas imagens compatíveis e atualiza o progresso no painel.

Não é usada raspagem de links compartilhados. Esse formato não possui API pública estável para importar todos os arquivos de um álbum e é especialmente frágil para vídeos.

## 1. Configurar o Google Cloud

1. Crie ou selecione um projeto no Google Cloud Console.
2. Ative **Google Photos Picker API**.
3. Configure a tela de consentimento OAuth.
4. Crie um cliente OAuth do tipo **Aplicativo da Web**.
5. Cadastre os redirecionamentos:
   - Produção: `https://www.maistrilhasmenosestresse.com/api/admin/albums/google/callback`
   - Teste local: `http://localhost:3100/api/admin/albums/google/callback`
6. No período de testes, inclua os e-mails administrativos como usuários de teste.

Nunca envie o Client Secret ao Git. Configure apenas em `.env.local` e nas variáveis protegidas da Vercel.

## 2. Variáveis obrigatórias

```env
GOOGLE_PHOTOS_CLIENT_ID=
GOOGLE_PHOTOS_CLIENT_SECRET=
GOOGLE_PHOTOS_REDIRECT_URI=https://www.maistrilhasmenosestresse.com/api/admin/albums/google/callback
GOOGLE_PHOTOS_IMPORT_QUEUE_URL=
GOOGLE_PHOTOS_TOKEN_ENCRYPTION_KEY=
```

`GOOGLE_PHOTOS_TOKEN_ENCRYPTION_KEY` é obrigatória e deve ser exatamente a mesma na Vercel e na Lambda. Use 32 bytes aleatórios em base64url. O script de infraestrutura valida o tamanho antes de atualizar o worker.

## 3. Banco e worker AWS

As migrations necessárias são:

- `supabase/migrations/202608050002_google_photos_import.sql`
- `supabase/migrations/202608050003_google_photos_token_cleanup.sql`

Depois de preencher as credenciais Google em `.env.local`, execute:

```powershell
npm run google-photos:setup-worker
```

O comando cria ou atualiza:

- fila SQS criptografada;
- fila de mensagens mortas para três falhas consecutivas;
- função Lambda com concorrência controlada;
- permissões mínimas para S3, Rekognition, SQS e logs.

Copie a `GOOGLE_PHOTOS_IMPORT_QUEUE_URL` exibida pelo comando para `.env.local` e para a Vercel.

## 4. Comportamento e segurança

- OAuth usa `state`, PKCE e cookie `HttpOnly` de curta duração.
- Tokens Google são criptografados com AES-256-GCM.
- Tokens são apagados do banco ao terminar o job.
- Fotos preservam o original. HEIC/HEIF também ganham uma cópia JPEG de exibição; o download continua usando o original.
- Vídeos usam a versão de alta qualidade disponibilizada pela Picker API.
- Base URLs expiradas são renovadas enquanto a sessão do Google permanecer válida.
- Cada item possui até três tentativas e processamento idempotente.
- As tabelas de importação fazem parte do backup automático do servidor.

## 5. Teste recomendado

Comece com um álbum de 5 fotos e 1 vídeo. Confirme no painel que o progresso chega a 100%, abra o álbum do cliente, faça o reconhecimento facial e baixe uma foto individual. Depois valide um lote maior antes de liberar a importação de centenas de itens.

Documentação oficial:

- https://developers.google.com/photos/picker/guides/get-started-picker
- https://developers.google.com/photos/picker/guides/media-items
- https://developers.google.com/photos/picker/reference/rest/v1/mediaItems/list
