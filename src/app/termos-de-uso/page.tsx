"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Database,
  FileText,
  Mail,
  ReceiptText,
  RefreshCw,
  Scale,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";

const DOCUMENT_VERSION = "2026.07.29";
const CONTACT_EMAIL = "maistrilhamenosestresse@gmail.com";

const TERMS_SECTIONS = [
  {
    title: "1. Identificação, objeto e aceitação",
    paragraphs: [
      "Estes Termos regulam o acesso ao site, ao aplicativo web e aos serviços oferecidos pela Mais Trilha Menos Estresse, identificada também na oferta e nos comprovantes da contratação. Ao criar cadastro, comprar, assinar documentos ou utilizar a plataforma, o usuário declara ter recebido oportunidade de leitura prévia e concorda com as condições aplicáveis.",
      "Integram a contratação a oferta específica da atividade, o comprovante de pagamento, as orientações de segurança, os contratos assinados, a Política de Privacidade e as informações apresentadas antes da confirmação da compra. Nenhuma disposição limita direito obrigatório previsto na legislação brasileira.",
    ],
  },
  {
    title: "2. Cadastro, elegibilidade e segurança da conta",
    paragraphs: [
      "O usuário deve fornecer dados verdadeiros, completos e atualizados, proteger o acesso ao e-mail cadastrado e comunicar uso não autorizado. A conta é pessoal; atos realizados após autenticação poderão ser associados ao respectivo cadastro, sem prejuízo da apuração de fraude ou erro.",
      "O cadastro de criança, adolescente ou dependente deverá ser realizado ou autorizado por responsável legal. A participação poderá exigir idade mínima, aptidão, documentos, equipamentos, autorizações e aceite de condições específicas informadas na oferta.",
    ],
  },
  {
    title: "3. Ofertas, reservas e formação do contrato",
    paragraphs: [
      "Cada oferta deve informar, conforme aplicável, data, local, preço, serviços incluídos, dificuldade, requisitos, capacidade, forma de transporte, hospedagem, alimentação, seguro e condições de cancelamento. A reserva somente será confirmada após a condição indicada no checkout e a validação do pagamento.",
      "Fotos, mapas, tempos e roteiros têm finalidade informativa. Percursos em ambiente natural podem sofrer ajustes razoáveis por clima, segurança, interdição, orientação de autoridades ou condição do grupo.",
    ],
  },
  {
    title: "4. Pagamentos, parcelamento e comprovantes",
    paragraphs: [
      "Pix e cartão poderão ser processados pela InfinitePay; boletos e cobranças compatíveis poderão ser processados pelo Asaas. O checkout deverá exibir o valor total, eventuais juros, quantidade e valor das parcelas antes da confirmação.",
      "A Mais Trilha Menos Estresse não armazena o número completo do cartão. Instituições de pagamento tratam os dados necessários sob suas próprias políticas e obrigações regulatórias. O usuário deverá conservar comprovantes e comunicar divergências pelos canais oficiais.",
    ],
  },
  {
    title: "5. Pontos, descontos e cashback",
    paragraphs: [
      "Pontos são benefícios promocionais destinados exclusivamente a descontos nas condições exibidas no checkout; não constituem moeda, depósito, investimento nem saldo sacável. A conversão, os limites e a validade devem ser informados antes do uso.",
      "Cashback é benefício distinto, registrado na carteira do aplicativo e sujeito às regras da campanha ou transação que o originou. Cancelamento, estorno, fraude, duplicidade ou alteração de uma venda poderá gerar reversão proporcional dos benefícios correspondentes, com registro no extrato.",
    ],
  },
  {
    title: "6. Segurança e participação em turismo de aventura",
    paragraphs: [
      "Atividades em ambientes naturais envolvem riscos inerentes. O participante deve ler as orientações, informar condições de saúde relevantes, utilizar os equipamentos indicados, respeitar guias e permanecer com o grupo.",
      "A equipe poderá adaptar ou interromper a atividade diante de risco concreto. O termo de responsabilidade não exonera a organização por falha do serviço e não representa renúncia do consumidor a direitos legais.",
    ],
  },
  {
    title: "7. Imagens, álbuns e reconhecimento facial opcional",
    paragraphs: [
      "A autorização para uso promocional de imagem será solicitada separadamente e poderá ser alterada para usos futuros. A recusa não impede a participação, ressalvados registros estritamente necessários à segurança, prova contratual ou cumprimento legal.",
      "Quando o usuário optar por localizar fotos por selfie, imagens e características faciais poderão ser processadas para comparação no álbum, com acesso restrito e finalidade específica. O usuário poderá solicitar informações e eliminação quando cabível, preservadas obrigações legais e registros necessários ao exercício de direitos.",
      "O usuário somente deverá enviar conteúdo próprio ou que esteja autorizado a compartilhar, respeitando privacidade, honra, imagem e direitos autorais de terceiros.",
    ],
  },
  {
    title: "8. Propriedade intelectual",
    paragraphs: [
      "Marca, identidade visual, textos, fotografias, vídeos, mapas produzidos, interfaces, ilustrações, bases de dados e software são protegidos pela legislação aplicável. O acesso à plataforma concede licença pessoal, limitada, revogável e não exclusiva para uso regular dos serviços.",
      "É proibido copiar, vender, sublicenciar, extrair dados em massa, contornar controles de acesso, realizar engenharia reversa fora das hipóteses permitidas por lei ou utilizar a marca de forma que gere confusão sobre parceria ou autorização.",
    ],
  },
  {
    title: "9. Uso aceitável e medidas de proteção",
    paragraphs: [
      "É proibido praticar fraude, inserir código malicioso, automatizar requisições abusivas, tentar acessar contas ou áreas restritas, manipular pagamentos, assediar participantes ou utilizar a plataforma para finalidade ilícita.",
      "A organização poderá limitar ou suspender acesso quando houver indício razoável de risco, fraude ou violação, adotando medida proporcional e preservando direito de esclarecimento, acesso a documentos e obrigações contratuais existentes.",
    ],
  },
  {
    title: "10. Disponibilidade, manutenção e serviços de terceiros",
    paragraphs: [
      "A plataforma poderá passar por manutenção, atualização ou indisponibilidade temporária. Serão adotadas medidas razoáveis de continuidade e recuperação, mas não se promete operação ininterrupta em situações fora do controle razoável.",
      "Mapas, pagamentos, mensagens, armazenamento, seguro, transporte, hospedagem e entradas em parques podem depender de terceiros. Isso não transfere ao consumidor responsabilidade que a lei atribua à organizadora.",
    ],
  },
  {
    title: "11. Comunicações e notificações",
    paragraphs: [
      "E-mail, WhatsApp e notificações poderão ser usados para confirmações, segurança, alterações de atividade, documentos e comunicações operacionais. Mensagens promocionais dependerão da base legal aplicável e poderão ser desativadas, sem impedir avisos necessários à execução do serviço.",
    ],
  },
  {
    title: "12. Atualizações, registros e assinatura eletrônica",
    paragraphs: [
      "Alterações materiais serão identificadas por nova versão e poderão exigir novo aceite. A versão aplicável à compra será preservada nos registros ou no documento assinado.",
      "Aceites e assinaturas eletrônicas poderão ser vinculados ao usuário, à versão do documento, à data e a registros técnicos de integridade. O usuário poderá baixar ou solicitar cópia dos contratos assinados.",
    ],
  },
  {
    title: "13. Atendimento, legislação e solução de conflitos",
    paragraphs: [
      `Dúvidas, cancelamentos e solicitações de privacidade podem ser encaminhados para ${CONTACT_EMAIL} ou pelos canais oficiais informados na oferta. O consumidor também poderá utilizar os órgãos de defesa do consumidor e a plataforma Consumidor.gov.br quando aplicável.`,
      "Aplica-se a legislação brasileira. Eventual eleição de foro não afasta o direito do consumidor de utilizar o foro legalmente competente de seu domicílio.",
    ],
  },
] as const;

export default function TermosDeUso() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#071421] px-4 py-10 text-slate-200 sm:px-6 md:py-16">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,#0B2540,#102F4D)] p-6 shadow-2xl sm:p-9"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-300">
                Documento jurídico e transparência
              </p>
              <h1 className="mt-3 text-3xl font-black leading-tight text-white sm:text-5xl">
                Termos de Uso, Privacidade e Cancelamento
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-blue-100/75 sm:text-base">
                Regras aplicáveis ao site, aplicativo, compras, atividades, dados pessoais,
                documentos e benefícios da Mais Trilha Menos Estresse.
              </p>
            </div>
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/10 text-orange-300">
              <Scale className="h-8 w-8" />
            </span>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <InfoCard icon={FileText} label="Versão" value={DOCUMENT_VERSION} />
            <InfoCard icon={CalendarClock} label="Vigência" value="29 de julho de 2026" />
            <InfoCard icon={Mail} label="Canal oficial" value={CONTACT_EMAIL} />
          </div>
        </motion.header>

        <section className="mt-6 rounded-[2rem] border border-orange-300/25 bg-[#FFF4E8] p-6 text-slate-800 shadow-xl sm:p-8">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-100 text-[#B94F1E]">
              <RefreshCw className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B94F1E]">
                Política de desistência
              </p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Cancelamento claro e proporcional</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                A desistência deve ser comunicada assim que conhecida. Nenhum desconto será usado
                como punição ou poderá superar o valor pago.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <CancellationRow
              title="Até 7 dias da compra on-line"
              badge="Direito legal"
              text="Quando aplicável o art. 49 do CDC, cancelamento sem multa e restituição integral, inclusive de contratos acessórios."
            />
            <CancellationRow
              title="Aviso com 7 dias ou mais"
              badge="Antecedência"
              text="Remarcação, quando disponível, ou reembolso, descontando apenas custos diretos já assumidos e que não possam ser recuperados."
            />
            <CancellationRow
              title="Menos de 7 dias, desistência no dia ou ausência sem aviso"
              badge="Última hora"
              text="Podem ser descontados somente gastos reais e não recuperáveis da vaga: hospedagem, logística, transporte, entradas em parques, autorizações, reservas, seguro, alimentação encomendada e terceiros contratados."
            />
            <CancellationRow
              title="Cancelamento ou alteração essencial pela organização"
              badge="Proteção"
              text="O participante poderá escolher remarcação, crédito aceito expressamente ou restituição dos serviços não prestados."
            />
          </div>

          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <ReceiptText className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-xs leading-relaxed">
              Custos descontados deverão ser individualizáveis, proporcionais e comprováveis quando
              solicitados. Se algum fornecedor devolver posteriormente um valor, ele será repassado
              ao participante. Qualquer saldo remanescente será restituído.
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-emerald-300/20 bg-emerald-950/35 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-emerald-300" />
            <div>
              <h2 className="text-xl font-black text-white">Política de Privacidade</h2>
              <p className="mt-2 text-sm leading-relaxed text-emerald-50/75">
                Tratamos dados para cadastro, compra, segurança, seguro, comunicação, documentos,
                álbuns e cumprimento de obrigações. Dados de saúde e características faciais, quando
                usados, recebem tratamento restrito e finalidade específica.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <PrivacyCard
              title="Dados e finalidades"
              text="Identificação, contato, documentos, saúde informada, compras, assinatura, fotos, registros de acesso e dados necessários à experiência contratada."
            />
            <PrivacyCard
              title="Compartilhamento necessário"
              text="Supabase, AWS, processadores de pagamento, seguradora, comunicação, transporte, hospedagem, parques e autoridades quando houver obrigação ou emergência."
            />
            <PrivacyCard
              title="Conservação e segurança"
              text="Os dados são mantidos pelo prazo necessário à finalidade, obrigações legais, prevenção a fraude e exercício regular de direitos, com controles de acesso e cópias de segurança."
            />
            <PrivacyCard
              title="Direitos do titular"
              text="Confirmação, acesso, correção, informação, oposição, revogação de consentimento, revisão e eliminação quando legalmente cabível."
            />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-emerald-50/60">
            Armazenamento e fornecedores de tecnologia podem envolver tratamento fora do Brasil,
            com adoção das salvaguardas exigidas. Solicitações devem ser enviadas ao canal oficial.
          </p>
        </section>

        <div className="mt-6 space-y-4">
          {TERMS_SECTIONS.map((section, index) => (
            <motion.section
              key={section.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ delay: Math.min(index * 0.025, 0.18) }}
              className="rounded-3xl border border-white/10 bg-white/[0.055] p-6"
            >
              <h2 className="text-lg font-black text-white">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-300">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </motion.section>
          ))}
        </div>

        <section className="mt-6 flex gap-3 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-5 text-amber-50">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-xs leading-relaxed">
            Condições específicas de uma atividade devem ser apresentadas antes da compra. Nenhuma
            condição específica poderá reduzir direito obrigatório ou impor perda integral
            automática sem base legal e proporcionalidade.
          </p>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-sm font-black text-white">Referências legais principais</h2>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <a href="https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm" target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-3 py-2 text-blue-100 hover:bg-white/10">Código de Defesa do Consumidor</a>
            <a href="https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm" target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-3 py-2 text-blue-100 hover:bg-white/10">Decreto do Comércio Eletrônico</a>
            <a href="https://planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm" target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-3 py-2 text-blue-100 hover:bg-white/10">Lei Geral de Proteção de Dados</a>
          </div>
        </section>

        <footer className="py-10 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Mais Trilha Menos Estresse. Todos os direitos reservados.</p>
          <p className="mt-2">Versão {DOCUMENT_VERSION} · Legislação brasileira</p>
        </footer>
      </div>
    </main>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
      <Icon className="h-4 w-4 text-orange-300" />
      <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-blue-100/50">{label}</p>
      <p className="mt-1 break-words text-xs font-bold text-white">{value}</p>
    </div>
  );
}

function CancellationRow({ title, badge, text }: { title: string; badge: string; text: string }) {
  return (
    <article className="rounded-2xl border border-orange-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <h3 className="flex-1 text-sm font-black text-slate-900">{title}</h3>
        <span className="rounded-full bg-orange-50 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-[#B94F1E]">
          {badge}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{text}</p>
    </article>
  );
}

function PrivacyCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="rounded-2xl border border-emerald-200/10 bg-black/10 p-4">
      <Database className="h-4 w-4 text-emerald-300" />
      <h3 className="mt-2 text-sm font-black text-white">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-emerald-50/65">{text}</p>
    </article>
  );
}
