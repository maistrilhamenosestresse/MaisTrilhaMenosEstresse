# Aplicativos Android Mais Trilha

Este projeto gera dois aplicativos Android independentes a partir da mesma base:

## 1. Mais Trilha — cliente

Pacote Android: `com.maistrilhasmenosestresse.app`

O APK do cliente contém:

- telas Android nativas para toda a experiência da Área do Aventureiro;
- login por código enviado ao e-mail, sem senha;
- trilhas, carrinho, checkout, carteira, pontos, loja, ranking, álbuns, perfil e contratos;
- área nativa de Segurança da Trilha;
- GPS em primeiro e segundo plano;
- pedidos de descanso, ajuda e SOS;
- mapa operacional e pacote de mapa offline;
- comunicação entre aparelhos próximos pelo Google Nearby Connections;
- mensagens assinadas, criptografadas e retransmitidas entre os aparelhos do grupo;
- fila local em SQLite para sincronizar quando a internet voltar.

O APK não incorpora o site e não usa WebView. O domínio oficial fornece apenas as APIs seguras de dados e pagamentos. Interface, navegação, mapa, contratos, álbum, GPS em segundo plano, Bluetooth/Nearby, SQLite e notificações são executados pela camada nativa.

## 2. Mais Trilha Guia

Pacote Android: `com.maistrilhasmenosestresse.guia`

O APK do guia contém:

- criação e controle de operações;
- convite do grupo por código e QR Code;
- mapa com participantes e rota;
- status, bateria e último contato de cada integrante;
- alertas locais para SOS, ajuda e descanso;
- relatórios de ocorrência;
- comunicação Nearby e retransmissão em malha;
- sincronização com o servidor quando houver internet.

## Preparação local

Na raiz do projeto:

```powershell
npm run mobile:env
npm run mobile:typecheck
npm run mobile:test
```

O comando `mobile:env` cria `mobile/.env.local` apenas com variáveis públicas necessárias ao aplicativo. Esse arquivo é ignorado pelo Git.

## Gerar APKs de teste

```powershell
npm run mobile:participant:android
npm run mobile:guide:android
```

Os perfis `preview` e `guide-preview` geram APKs instaláveis diretamente. Os perfis de produção geram artefatos para distribuição oficial.

## Limite técnico importante

A rede de aparelhos usa Google Nearby Connections com estratégia `P2P_CLUSTER`. Ela permite saltos entre celulares quando o aplicativo está ativo e cada aparelho recebeu o mesmo convite criptográfico. GPS e fila offline continuam no dispositivo; sincronização com o painel depende de algum aparelho do grupo voltar a ter internet.

iPhone permanece preparado no projeto, mas a distribuição física em iPhone exige uma conta Apple Developer. O foco atual de validação é Android.
