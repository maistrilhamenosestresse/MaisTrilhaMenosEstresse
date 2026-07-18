# Mais Trilha — Operações offline

Aplicativo nativo compartilhado em duas versões:

- **Mais Trilha**: participante, com mapa, localização do grupo, descanso, ajuda, SOS e relatórios.
- **Mais Trilha Guia**: guia, com controle da operação, situação dos participantes, bateria, último contato e tratamento de alertas.

O painel web em `/admin/operacoes` cria e acompanha as operações.

## Como a conexão offline funciona

Os aparelhos formam uma rede local usando Bluetooth e Wi‑Fi Direct/Nearby Connections. As mensagens podem saltar entre telefones:

```text
Participante A  →  Participante B  →  Participante C  →  Guia
```

Cada mensagem é assinada, criptografada, tem identificador único, prazo de validade e limite de saltos. Mensagens de SOS têm prioridade sobre localização comum. Quando algum aparelho recupera internet, os eventos pendentes são sincronizados com o servidor.

Isso exige uma corrente física de aparelhos dentro do alcance uns dos outros. Se houver um trecho sem nenhum telefone intermediário, o painel mostra a última posição e o horário do último contato. Bluetooth/Wi‑Fi não substitui rádio, LoRa ou comunicador por satélite em áreas remotas.

## Preparação local

Na raiz do projeto:

```powershell
npm run mobile:env
cd mobile
npm install
npm run typecheck
npm run test
```

O script copia para `mobile/.env.local` somente valores públicos necessários ao aplicativo. Chaves administrativas, AWS, Gmail, banco e service role nunca entram no binário.

O recurso de rede mesh usa código nativo e não funciona no Expo Go. Use um development build:

```powershell
npm run prebuild -- --platform android --clean
npm run android
```

No Windows é necessário instalar o Android Studio/JDK e configurar `JAVA_HOME`.

## Builds

Depois de autenticar o EAS e definir `EXPO_PUBLIC_EAS_PROJECT_ID`:

```powershell
npm run build:participant:android
npm run build:guide:android
npm run build:participant:ios
npm run build:guide:ios
```

Os perfis `preview` geram APKs Android para teste interno. As versões iOS precisam de uma conta Apple Developer e são compiladas no EAS.

## Teste obrigatório antes de uma trilha real

1. Crie uma operação no painel e faça o check-in.
2. Conecte ao menos três celulares com o QR Code da operação.
3. Desligue dados móveis e Wi‑Fi com internet, mantendo Bluetooth e Wi‑Fi dos aparelhos ligados.
4. Afaste A do guia, mantendo A perto de B e B perto de C/guia.
5. Envie descanso, ajuda e SOS a partir de A.
6. Confirme que o guia recebe os eventos por múltiplos saltos.
7. Interrompa a corrente e confirme que aparece “último contato”.
8. Reconecte a corrente e confirme a sincronização.
9. Baixe o mapa offline antes da saída e teste com o aparelho em modo avião.
10. Valide consumo de bateria durante uma caminhada piloto com a duração prevista.

## Limites importantes

- O mapa e o GPS continuam disponíveis sem internet quando o pacote da trilha foi baixado antes.
- No Android, o rastreamento usa serviço em primeiro plano.
- No iPhone, o sistema pode suspender descoberta Bluetooth em segundo plano; a localização autorizada continua, mas a retransmissão mesh é “melhor esforço”. Durante a operação, mantenha o app aberto quando possível.
- Para segurança de vida em locais sem cobertura e com grandes distâncias, mantenha o protocolo operacional com rádio/LoRa/satélite e pontos de reagrupamento.
