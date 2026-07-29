import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, Cookie, Database, Globe2, Radio, ShieldCheck, SlidersHorizontal } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de Cookies | Mais Trilha Menos Estresse",
  description: "Saiba como cookies e armazenamento local são utilizados e controle suas preferências.",
};

const VERSION = "2026.07.29-2";

export default function PoliticaDeCookiesPage() {
  return (
    <main className="min-h-screen bg-[#071421] px-4 py-10 text-slate-200 sm:px-6 md:py-16">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao site
        </Link>

        <header className="rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,#0B2540,#102F4D)] p-6 shadow-2xl sm:p-9">
          <div className="flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-orange-300/15 text-orange-300">
              <Cookie className="h-7 w-7" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-300">
                Transparência e controle
              </p>
              <h1 className="mt-2 text-3xl font-black text-white sm:text-5xl">Política de Cookies</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-blue-100/75 sm:text-base">
                Esta política explica quais tecnologias ficam no seu aparelho, por que são usadas e
                como você pode aceitar, recusar ou retirar sua escolha.
              </p>
              <p className="mt-4 text-xs font-bold text-blue-100/55">Versão {VERSION}</p>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <PolicyCard
            icon={ShieldCheck}
            title="Necessários"
            status="Sempre ativos"
            text="Viabilizam login, proteção da sessão, segurança, carrinho, preferência de cookies, atualização do PWA e funcionamento offline solicitado pelo usuário."
          />
          <PolicyCard
            icon={BarChart3}
            title="Medição e desempenho"
            status="Somente com aceite"
            text="O Google Analytics ajuda a entender visitas às páginas públicas. Não é carregado antes do consentimento e não mede admin, aplicativo, checkout, cadastro ou contratos."
          />
          <PolicyCard
            icon={Radio}
            title="Sinais do navegador"
            status="GPC e DNT"
            text="A central identifica sinais Global Privacy Control e Do Not Track. Quando o GPC está ativo, a medição opcional permanece bloqueada neste aparelho."
          />
        </section>

        <div className="mt-6 space-y-4">
          <TextSection title="1. O que são cookies e armazenamento local?">
            Cookies são pequenos registros associados ao navegador. Armazenamento local, cache e
            IndexedDB são tecnologias do aparelho usadas para guardar preferências ou disponibilizar
            recursos offline. Nem todo armazenamento é cookie, mas todos são tratados aqui com
            transparência.
          </TextSection>

          <TextSection title="2. Tecnologias necessárias">
            A autenticação do Supabase utiliza dados de sessão necessários para manter o usuário
            conectado com segurança. O site também conserva a escolha de privacidade por até 180
            dias. O carrinho guarda apenas dados da atividade; nomes, CPF e telefone de dependentes
            não são mantidos depois do fechamento da página. No aplicativo, cópias mínimas de perfil,
            trilhas e mapas podem ser salvas para uso offline, sem documentos, dados de saúde ou
            endereço.
          </TextSection>

          <TextSection title="3. Google Analytics">
            Quando autorizado, o Google Analytics recebe informações técnicas e de navegação das
            páginas públicas, como página visitada, horário, navegador e características gerais do
            dispositivo. A implementação usa o modo básico do Google Consent Mode v2: a tag não é
            carregada e nenhum dado é enviado ao Google antes do aceite. Os sinais de publicidade,
            dados para anúncios e personalização permanecem negados em qualquer escolha. Os cookies
            analíticos são configurados por até 180 dias, sujeitos às regras do fornecedor e à
            eliminação quando a permissão é retirada.
          </TextSection>

          <TextSection title="4. Como controlar ou retirar o consentimento">
            Use o botão “Privacidade”, disponível no canto da tela após a primeira escolha. É
            possível recusar todos os itens opcionais, ativar somente medição ou revogar o aceite a
            qualquer momento e com a mesma facilidade. Cada escolha gera um comprovante local
            versionado, com identificador, data e versão desta política. Ao recusar, o sistema
            comunica a negativa ao Consent Mode e remove os cookies analíticos acessíveis no
            domínio. O navegador também permite apagar cookies e dados de sites.
          </TextSection>

          <TextSection title="5. Global Privacy Control e Do Not Track">
            O Global Privacy Control (GPC) e o Do Not Track (DNT) são sinais enviados por alguns
            navegadores e extensões. A Mais Trilha não vende dados pessoais nem utiliza publicidade
            personalizada. Como proteção adicional, quando o GPC é detectado, a medição opcional é
            mantida desativada. O sinal detectado fica registrado apenas no comprovante local da
            preferência.
          </TextSection>

          <TextSection title="6. Base legal, fornecedores e contato">
            Tecnologias estritamente necessárias são usadas para executar o serviço, prevenir fraude
            e manter a segurança. A medição opcional depende de consentimento. O Google e os
            fornecedores de infraestrutura podem tratar dados fora do Brasil com as salvaguardas
            aplicáveis. Dúvidas e solicitações podem ser enviadas para
            {" "}maistrilhamenosestresse@gmail.com.
          </TextSection>
        </div>

        <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055]">
          <div className="flex items-start gap-3 border-b border-white/10 p-6">
            <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" />
            <div>
              <h2 className="font-black text-white">Inventário de tecnologias</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                Relação objetiva do que pode permanecer no navegador. A duração efetiva pode ser
                menor se o usuário sair da conta, limpar o aparelho ou remover os downloads.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-xs">
              <thead className="bg-white/[0.045] text-blue-100">
                <tr>
                  <th className="px-5 py-3 font-black">Tecnologia</th>
                  <th className="px-5 py-3 font-black">Fornecedor</th>
                  <th className="px-5 py-3 font-black">Categoria</th>
                  <th className="px-5 py-3 font-black">Finalidade</th>
                  <th className="px-5 py-3 font-black">Prazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-slate-300">
                <InventoryRow name="mt_cookie_consent" provider="Mais Trilha" category="Necessário" purpose="Preferências e comprovante local" duration="Até 180 dias" />
                <InventoryRow name="sb-… / sessão" provider="Supabase" category="Necessário" purpose="Login, sessão e segurança" duration="Sessão/renovação técnica" />
                <InventoryRow name="mt-pwa-version" provider="Mais Trilha" category="Necessário" purpose="Atualização segura do PWA" duration="Até substituição da versão" />
                <InventoryRow name="mt-offline:v3" provider="Mais Trilha" category="Necessário solicitado" purpose="Dados mínimos para uso offline" duration="Até sair/limpar dados" />
                <InventoryRow name="IndexedDB de mapas" provider="Mais Trilha" category="Necessário solicitado" purpose="Mapas e rotas baixados pelo usuário" duration="Até exclusão pelo usuário" />
                <InventoryRow name="_ga / _ga_*" provider="Google Analytics" category="Opcional" purpose="Medição das páginas públicas" duration="Até 180 dias" />
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-orange-300/20 bg-orange-300/10 p-5">
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" />
            <div>
              <h2 className="font-black text-white">Sua escolha permanece disponível</h2>
              <p className="mt-1 text-sm leading-relaxed text-orange-50/70">
                Feche esta página e use o botão “Privacidade” no canto inferior para abrir a central de
                preferências.
              </p>
            </div>
          </div>
        </section>

        <footer className="py-10 text-center text-xs text-slate-500">
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/termos-de-uso" className="font-bold text-blue-100/70 underline underline-offset-4">
              Termos de Uso e Privacidade
            </Link>
            <Link href="/" className="font-bold text-blue-100/70 underline underline-offset-4">
              Página inicial
            </Link>
          </div>
          <p className="mt-4">© {new Date().getFullYear()} Mais Trilha Menos Estresse.</p>
        </footer>
      </div>
    </main>
  );
}

function PolicyCard({
  icon: Icon,
  title,
  status,
  text,
}: {
  icon: typeof Cookie;
  title: string;
  status: string;
  text: string;
}) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.055] p-5">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-orange-300" />
        <span className="rounded-full bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-wide text-blue-100">
          {status}
        </span>
      </div>
      <h2 className="mt-4 text-lg font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{text}</p>
    </article>
  );
}

function TextSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.055] p-6">
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" />
        <div>
          <h2 className="font-black text-white">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{children}</p>
        </div>
      </div>
    </section>
  );
}

function InventoryRow({
  name,
  provider,
  category,
  purpose,
  duration,
}: {
  name: string;
  provider: string;
  category: string;
  purpose: string;
  duration: string;
}) {
  return (
    <tr>
      <td className="px-5 py-3 font-mono text-[11px] text-orange-200">{name}</td>
      <td className="px-5 py-3">{provider}</td>
      <td className="px-5 py-3">{category}</td>
      <td className="px-5 py-3">{purpose}</td>
      <td className="px-5 py-3">{duration}</td>
    </tr>
  );
}
