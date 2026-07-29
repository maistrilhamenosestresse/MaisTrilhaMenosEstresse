import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, Cookie, Database, ShieldCheck, SlidersHorizontal } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de Cookies | Mais Trilha Menos Estresse",
  description: "Saiba como cookies e armazenamento local são utilizados e controle suas preferências.",
};

const VERSION = "2026.07.29";

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

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
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
            dispositivo. Sinais de publicidade e personalização de anúncios ficam desativados. Os
            cookies analíticos são configurados por até 180 dias, sujeitos às regras do fornecedor e
            à eliminação quando a permissão é retirada.
          </TextSection>

          <TextSection title="4. Como controlar ou retirar o consentimento">
            Use o botão “Cookies”, disponível no canto da tela após a primeira escolha. É possível
            recusar todos os itens opcionais, ativar somente medição ou revogar o aceite a qualquer
            momento. Ao recusar, o sistema comunica a negativa e tenta remover os cookies analíticos
            acessíveis no domínio. O navegador também permite apagar cookies e dados de sites.
          </TextSection>

          <TextSection title="5. Base legal, fornecedores e contato">
            Tecnologias estritamente necessárias são usadas para executar o serviço, prevenir fraude
            e manter a segurança. A medição opcional depende de consentimento. O Google e os
            fornecedores de infraestrutura podem tratar dados fora do Brasil com as salvaguardas
            aplicáveis. Dúvidas e solicitações podem ser enviadas para
            {" "}maistrilhamenosestresse@gmail.com.
          </TextSection>
        </div>

        <section className="mt-6 rounded-3xl border border-orange-300/20 bg-orange-300/10 p-5">
          <div className="flex items-start gap-3">
            <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-orange-300" />
            <div>
              <h2 className="font-black text-white">Sua escolha permanece disponível</h2>
              <p className="mt-1 text-sm leading-relaxed text-orange-50/70">
                Feche esta página e use o botão “Cookies” no canto inferior para abrir a central de
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
