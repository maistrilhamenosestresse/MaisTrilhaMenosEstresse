# Relatório de Segurança, Privacidade e UX

**Sistema:** Mais Trilha Menos Estresse

**Data:** 29 de julho de 2026
**Escopo:** site público, área administrativa, PWA do cliente, APIs, integrações, armazenamento local e política de cookies.

## 1. Resumo executivo

O sistema possui uma base técnica consistente para testes integrados: build de produção aprovado, dependências de produção sem vulnerabilidades conhecidas pelo `npm audit`, RLS e privilégios do Supabase validados, backup AWS privado e versionado, e conectividade confirmada com Supabase, AWS, Asaas sandbox, InfinitePay e Web Push.

As correções desta revisão eliminaram os riscos mais imediatos encontrados no navegador:

- Google Analytics não é mais carregado antes do consentimento;
- CPF, telefone e nome de dependentes não persistem no carrinho;
- a cópia offline do perfil foi reduzida e não guarda documento, saúde ou endereço;
- dados locais antigos e mais amplos são eliminados na inicialização;
- ações manuais de backup agora verificam a origem da requisição;
- o endpoint legado do bolão recebeu limitação de tentativas e respostas de erro genéricas;
- foram adicionadas restrições de permissões do navegador;
- o bloqueio de zoom foi removido para melhorar acessibilidade no celular.
- respostas públicas de erro foram padronizadas para não expor detalhes internos;
- uploads administrativos de produtos passaram a validar tipo, tamanho e assinatura real da imagem;
- uma Content Security Policy foi implantada em `Report-Only` para observação segura;
- a agenda móvel foi simplificada e ganhou alvos de toque e textos maiores;
- a PWA ganhou uma central de mapas offline com espaço usado e exclusão individual ou total.

Durante a auditoria foi encontrada uma branch local antiga do Git com um commit contendo `backup_maistrilha.json` e dados de clientes. A verificação de todas as branches atuais dos repositórios oficial e de teste confirmou que o commit não estava alcançável nos remotos. O `main` local foi alinhado ao oficial, os reflogs foram expirados e o objeto sensível foi eliminado por coleta imediata. Se houver evidência independente de que o arquivo foi compartilhado no passado, ainda será necessária avaliação de incidente.

## 2. Método e limitações

Foram realizadas:

- revisão estática de rotas, autenticação, RLS, service role, webhooks, uploads, pagamentos e backups;
- busca de segredos e arquivos sensíveis rastreados pelo Git;
- análise de cookies, Analytics, `localStorage`, cache offline e service worker;
- build de produção, TypeScript, ESLint, verificação estática de segurança e readiness dos serviços;
- revisão estrutural de responsividade, densidade, tipografia, navegação e acessibilidade.

Não foi possível abrir um navegador visual automatizado neste ambiente. Portanto, as conclusões de UX são baseadas no código responsivo, estrutura das telas, imagens já fornecidas durante o projeto e resultados de build. Antes da próxima publicação, recomenda-se um teste manual em aparelhos reais com Android, iPhone, tela pequena e desktop.

## 3. Achados de segurança e privacidade

| Prioridade | Achado | Situação |
|---|---|---|
| Crítica | Backup histórico com dados pessoais em branch local antiga do Git: 53 ocorrências de CPF, e-mail e telefone | Corrigido localmente; não alcançável nas branches remotas verificadas |
| Alta | Analytics era carregado antes do consentimento | Corrigido |
| Alta | Carrinho persistia dados de dependentes no `localStorage` sem prazo | Corrigido |
| Alta | Cache offline guardava o objeto completo do cliente | Corrigido com minimização e limpeza da versão anterior |
| Média | POST de backup e teste de restauração não verificavam origem | Corrigido |
| Média | Endpoint público legado do bolão não possuía rate limit e devolvia erro interno | Corrigido |
| Média | Não havia Content Security Policy global aplicada | Corrigido inicialmente em `Report-Only`; falta validar relatórios no navegador e então aplicar bloqueio |
| Média | Rotas públicas devolviam `error.message` em fluxos de falha | Corrigido; mensagens de negócio explícitas permanecem somente onde são seguras |
| Média | Arquivo do painel administrativo possui 3.034 linhas e concentra muitas responsabilidades | Pendente; aumenta risco de regressão e dificulta revisão de autorização |
| Baixa | ESLint terminou sem erros, mas ainda encontrou 68 avisos, principalmente imagens sem otimização e código legado não utilizado | Parcialmente corrigido |

### Controles positivos verificados

- todas as rotas em `/api/admin` revisadas usam autenticação administrativa;
- tabelas sensíveis, privilégios e RLS do Supabase passaram na verificação;
- chaves de service role, AWS e banco são lidas apenas no servidor;
- `.env.local` e `.env.vercel.production` estão ignorados e não aparecem no histórico Git analisado;
- backups AWS estão em bucket privado e versionado;
- webhooks e fluxos financeiros possuem estrutura de idempotência no banco;
- trilhas encerradas possuem bloqueio no servidor e liberação administrativa auditável;
- cabeçalhos HSTS, `nosniff`, proteção de frame, política de referência e política de permissões estão configurados;
- dependências de produção: 0 vulnerabilidades conhecidas na auditoria executada.

### Ações urgentes recomendadas

1. Registrar que o commit local `f6cb11f` foi eliminado e que não estava alcançável nas branches remotas verificadas em 29/07/2026.
2. Se surgir evidência de publicação ou compartilhamento anterior, preservar evidências, conter cópias e avaliar comunicação de incidente conforme risco ou dano relevante.
3. Rotacionar chaves administrativas, banco, AWS, Gmail, GitHub, Gemini, pagamentos e webhooks que tenham sido compartilhadas fora dos cofres oficiais.

## 4. Cookies e LGPD

### Implementado

- banner de primeiro nível com `Recusar opcionais`, `Personalizar` e `Aceitar opcionais`;
- opcionais desativados por padrão;
- cookies necessários separados da medição;
- central de preferências acessível permanentemente pelo botão `Cookies`;
- revogação simples a qualquer momento;
- tentativa de remoção de `_ga` e `_ga_*` após recusa;
- Google Analytics carregado somente depois do aceite;
- sinais de publicidade e personalização do Google desativados;
- áreas sensíveis excluídas da medição: admin, PWA, checkout, cadastro, login e contratos;
- política dedicada em `/politica-de-cookies`;
- Termos de Uso atualizados com cookies, armazenamento local e funcionamento offline.

### Tecnologias necessárias documentadas

- sessão/autenticação;
- escolha de cookies;
- carrinho sem persistência de dados de dependentes;
- versão e atualização do PWA;
- cache offline minimizado;
- mapas/trilhas baixados por ação do usuário.

### Base de referência

- Guia Orientativo da ANPD sobre Cookies e Proteção de Dados Pessoais;
- recomendações da ANPD para botão visível de rejeição, opcionais desativados por padrão e controles por categoria;
- direitos dos titulares, incluindo revogação simples do consentimento;
- Lei Geral de Proteção de Dados.

Esta implementação melhora a conformidade técnica, mas não substitui validação jurídica da operação, dos contratos, do encarregado/canal de privacidade e dos prazos reais de retenção de cada fornecedor.

## 5. Avaliação de UX

### Site público — desktop

**Avaliação estrutural: 7,5/10**

Pontos positivos:

- identidade visual consistente, premium e alinhada a natureza/aventura;
- hierarquia forte no topo e chamadas para agenda;
- navegação principal clara;
- imagens e vídeo transmitem confiança e experiência real.

Melhorias prioritárias:

- a página inicial possui várias seções de tela cheia, vídeo e muitas imagens; a jornada fica longa e pesada;
- reduzir movimentos decorativos para usuários com `prefers-reduced-motion`;
- transformar depoimentos, diferenciais e agenda em blocos mais objetivos;
- medir LCP, INP e peso total em conexão móvel real;
- converter o `img` restante e mídias críticas para componentes/formatos otimizados.

### Site público — celular

**Avaliação estrutural: 6,5/10**

Pontos positivos:

- menu móvel possui alvos de toque adequados;
- layouts principais evitam estouro horizontal;
- formulários e botões usam tamanhos majoritariamente confortáveis;
- zoom do navegador voltou a ser permitido nesta revisão.

Problemas:

- a agenda foi corrigida para uma coluna nas telas menores, mas ainda precisa de validação visual em aparelhos reais;
- cards ficam visualmente apertados e dificultam leitura rápida;
- o vídeo e seções altas aumentam rolagem, dados consumidos e tempo até a ação principal;
- banner/avisos devem ser testados com teclado aberto e safe areas.

Recomendação: uma coluna entre 320 e 430 px, cartão horizontal compacto ou carrossel com texto mínimo de 12–14 px, preço/data com maior contraste e CTA de pelo menos 44 px.

### PWA do cliente — celular

**Avaliação estrutural: 8/10**

Pontos positivos:

- linguagem visual coerente e navegação inferior apropriada;
- dashboard com saldo, pontos, experiência e atalhos;
- modo offline, cache de rotas e mapas baixáveis;
- cabeçalhos e áreas seguras usam `safe-area`;
- áreas sensíveis não entram no Analytics.

Melhorias implementadas nesta revisão:

- manter um aviso global de modo offline e data de atualização nas telas de trilha que possuem dados salvos;
- oferecer tela de gestão dos mapas baixados, tamanho ocupado e botão de exclusão;
- identificar os downloads pelo nome da trilha e permitir limpeza total com confirmação.

Melhorias pendentes:

- impedir que dados financeiros em cache pareçam atuais quando estiverem desatualizados;
- testar navegação fria: abrir o PWA sem internet depois de fechar completamente o navegador;
- adicionar confirmação clara antes de limpar dados offline.

### Painel administrativo — desktop

**Avaliação estrutural: 7/10**

Pontos positivos:

- boa cobertura funcional;
- menus laterais e áreas financeiras bem segmentadas;
- estados de carregamento e mensagens de falha existem em fluxos importantes.

Problemas:

- a tela principal com 3.034 linhas concentra agenda, clientes, finanças, reservas, upload e relatórios;
- avisos de hooks indicam risco de tela não atualizar quando a seleção muda;
- muitas informações usam 10 px;
- tabelas densas dificultam escaneamento e aumentam erros operacionais.

Recomendação: dividir em módulos por domínio, manter filtros na URL, usar painéis laterais para edição, padronizar status e criar uma barra de ações fixa.

### Painel administrativo — celular

**Avaliação estrutural: 6/10**

O sistema tenta adaptar o painel, mas o volume de campos e tabelas não é adequado para operação contínua em tela pequena. Priorizar no celular:

- localizar cliente/reserva;
- alterar status/valor com confirmação;
- enviar cobrança/contrato;
- publicar notificação;
- consultar saldo e alertas.

Cadastros longos, upload em massa e relatórios completos devem ter fluxo específico ou recomendação explícita de desktop.

## 6. Acessibilidade

Corrigido:

- remoção de `maximumScale: 1`, permitindo zoom;
- botões do consentimento com alvos mínimos e textos explícitos;
- diálogo e controles de cookies com rótulos acessíveis.

Pendente:

- elevar textos de 8–10 px;
- auditar contraste em laranja claro sobre fundos;
- aplicar `prefers-reduced-motion`;
- executar navegação somente por teclado e leitor de tela;
- garantir foco preso e restaurado nos modais complexos.

## 7. Evidências de validação

- `npm run build`: aprovado, 66 páginas estáticas geradas e TypeScript concluído;
- `npm run security:check`: aprovado;
- `npm run lint`: 0 erros e 68 avisos;
- `npm audit --omit=dev`: 0 vulnerabilidades em 194 dependências de produção;
- `npm run readiness:test`: Supabase, AWS, Asaas sandbox, InfinitePay e Web Push aprovados;
- `git diff --check`: sem erros de whitespace;
- `.env.local` e `.env.vercel.production`: ignorados pelo Git.

## 8. Plano recomendado

### Imediato

1. Publicar e testar o consentimento em celular e desktop.
2. Confirmar no DevTools que nenhuma requisição ao Google ocorre antes do aceite.
3. Testar aceite, recusa, revogação e limpeza de cookies em Chrome, Safari e navegador Samsung.

### Próximo ciclo

1. Dividir o painel administrativo em módulos menores.
2. Continuar removendo código legado e migrar imagens críticas para otimização do Next.
3. Medir Core Web Vitals e otimizar vídeo/imagens da página inicial.
4. Validar CSP, cookies, foco, mapas e checkout em navegador conectado e aparelhos reais.

### Endurecimento

1. Observar a Content Security Policy em `Report-Only` e, após validar os domínios, transformá-la em política de bloqueio.
2. Adicionar testes automatizados de autorização, CSRF, webhooks e idempotência financeira.
3. Criar inventário formal de dados, retenção, operadores e bases legais.
4. Fazer teste de restauração de backup periódico e registrar resultado.
5. Contratar teste de intrusão antes de migrar pagamentos e credenciais do sandbox para produção.
