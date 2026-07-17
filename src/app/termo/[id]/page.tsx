"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import type { Client } from "@/types";

export default function TermoPrintPage() {
  const { id } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadClient() {
      if (!id) return;
      const response = await fetch(`/api/clients/${encodeURIComponent(String(id))}/term`, { cache: 'no-store' });
      if (response.ok) {
        const { client: clientData } = await response.json();
        setClient(clientData);
      }
      setIsLoading(false);
    }
    loadClient();
  }, [id]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-gray-400" /></div>;
  }

  if (!client) {
    return <div className="min-h-screen flex items-center justify-center text-red-500 font-bold">Cliente não encontrado.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8 print:p-0 print:bg-white text-black font-sans">
      <div className="max-w-[800px] mx-auto mb-6 print:hidden flex justify-end items-center">
        <button 
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
        </button>
      </div>

      <div className="max-w-[800px] mx-auto bg-white p-6 md:p-12 shadow-lg print:shadow-none print:p-0 text-base md:text-sm print:text-sm">
        
        <div className="text-center mb-8 border-b-2 border-black pb-6">
          <h1 className="text-2xl font-black text-[#113a5d] mb-4 uppercase">TERMO DE RECONHECIMENTO DE RISCO E ISENÇÃO DE RESPONSABILIDADE</h1>
          <p className="text-gray-600 text-sm">Expedição: Trilha Mais Trilha • Organizadora: Mais Trilha Menos Estresse</p>
        </div>

        <div className="mb-8">
          <div className="bg-[#eef5fa] p-2 mb-4 border-l-4 border-[#113a5d]">
            <h2 className="font-bold text-[#113a5d]">1. Dados do Participante</h2>
          </div>
          
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-base md:text-sm print:text-sm min-w-[300px]">
            <tbody>
              <tr>
                <td className="py-2 font-bold w-32">Nome Completo:</td>
                <td colSpan={3} className="py-2 border-b border-gray-300">{client.full_name}</td>
              </tr>
              <tr>
                <td className="py-2 font-bold">CPF:</td>
                <td className="py-2 border-b border-gray-300 w-[30%]">{client.cpf}</td>
                <td className="py-2 font-bold w-16 pl-4">RG:</td>
                <td className="py-2 border-b border-gray-300">{client.rg}</td>
              </tr>
              <tr>
                <td className="py-2 font-bold">Data de Nasc.:</td>
                <td className="py-2 border-b border-gray-300">{new Date(client.birth_date).toLocaleDateString('pt-BR')}</td>
                <td className="py-2 font-bold pl-4">WhatsApp:</td>
                <td className="py-2 border-b border-gray-300">{client.phone}</td>
              </tr>
              <tr>
                <td className="py-2 font-bold">Contato Emerg.:</td>
                <td colSpan={3} className="py-2 border-b border-gray-300">{client.emergency_contact_name} ({client.emergency_contact_phone})</td>
              </tr>
              <tr>
                <td className="py-2 font-bold align-top">Condição Médica:</td>
                <td colSpan={3} className="py-2 border-b border-gray-300">
                  <p className="text-xs text-gray-500 mb-1">Possui alergias, asma, problemas cardíacos ou faz uso de medicamento contínuo?</p>
                  <strong>{client.health_notes && client.health_notes !== 'Nenhuma' ? 'Sim' : 'Não'}</strong>
                  {client.health_notes && client.health_notes !== 'Nenhuma' && (
                    <div className="mt-2 text-xs bg-red-50 text-red-700 p-2 border border-red-200 rounded whitespace-pre-wrap">
                      {client.health_notes}
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>

        <div className="mb-6">
          <div className="bg-[#eef5fa] p-2 mb-4 border-l-4 border-[#113a5d]">
            <h2 className="font-bold text-[#113a5d]">2. Natureza da Atividade e Riscos Inerentes</h2>
          </div>
          <p className="text-base md:text-sm print:text-sm text-justify mb-4">
            Declaro estar ciente de que a expedição é uma atividade de turismo de aventura e montanhismo, realizada em ambiente natural, estando sujeita a riscos inerentes que não podem ser totalmente eliminados, mesmo com o planejamento e a intervenção dos guias. Compreendo e aceito que os riscos incluem, mas não se limitam a:
          </p>
          <ul className="text-base md:text-sm print:text-sm list-disc pl-8 space-y-2 md:space-y-1">
            <li>Temperaturas extremas (frio intenso, ventos fortes e risco real de hipotermia);</li>
            <li>Mal da montanha ou desconfortos decorrentes dos efeitos de altitude elevada;</li>
            <li>Terreno irregular, escorregadio, rochoso e íngreme, com riscos de quedas, torções, fraturas ou escoriações;</li>
            <li>Condições climáticas adversas, severas e de rápida mudança (chuva, raios, neblina densa);</li>
            <li>Encontros com animais silvestres, peçonhentos ou insetos;</li>
            <li>Fadiga extrema, exaustão física e desgaste muscular.</li>
          </ul>
        </div>

        <div className="mb-6">
          <div className="bg-[#eef5fa] p-2 mb-4 border-l-4 border-[#113a5d]">
            <h2 className="font-bold text-[#113a5d]">3. Condições de Saúde e Aptidão Física</h2>
          </div>
          <p className="text-base md:text-sm print:text-sm text-justify">
            Declaro voluntariamente que gozo de boa saúde física e mental e que não possuo nenhuma contraindicação médica que me impeça de realizar esforços físicos de intensidade severa. Assumo total e exclusiva responsabilidade pela minha integridade e condição física antes, durante e após a realização da atividade.
          </p>
        </div>

        <div className="mb-6 print:break-before-page">
          <div className="bg-[#eef5fa] p-2 mb-4 border-l-4 border-[#113a5d]">
            <h2 className="font-bold text-[#113a5d]">4. Equipamentos e Vestuário</h2>
          </div>
          <p className="text-base md:text-sm print:text-sm text-justify">
            Estou ciente de que é minha estrita obrigação portar e utilizar os equipamentos e vestuários recomendados e exigidos pela organização Mais Trilha Menos Estresse. A organização reserva-se o direito de vetar a minha participação, sem direito a reembolso, caso seja constatada a ausência de itens essenciais para a minha própria segurança.
          </p>
        </div>

        <div className="mb-6">
          <div className="bg-[#eef5fa] p-2 mb-4 border-l-4 border-[#113a5d]">
            <h2 className="font-bold text-[#113a5d]">5. Regras de Conduta e Segurança</h2>
          </div>
          <p className="text-base md:text-sm print:text-sm text-justify mb-2">Comprometo-me formalmente a:</p>
          <ul className="text-base md:text-sm print:text-sm list-disc pl-8 space-y-2 md:space-y-1">
            <li>Seguir rigorosamente todas as instruções, orientações técnicas e decisões emitidas pelos guias e líderes da Mais Trilha Menos Estresse durante todo o percurso;</li>
            <li>Respeitar integralmente as normas do Parque ou local da trilha, zelando pela preservação ambiental;</li>
            <li>Compreender e aceitar que o guia líder detém autoridade total para alterar, interromper ou cancelar a subida ou o cronograma caso julgue que as condições ambientais, climáticas ou de saúde configurem risco à segurança geral.</li>
          </ul>
        </div>

        <div className="mb-6">
          <div className="bg-[#eef5fa] p-2 mb-4 border-l-4 border-[#113a5d]">
            <h2 className="font-bold text-[#113a5d]">6. Isenção de Responsabilidade</h2>
          </div>
          <p className="text-base md:text-sm print:text-sm text-justify">
            Ao assinar este termo de livre e espontânea vontade, assumo integralmente todos os riscos associados à expedição. Isento expressamente a organização Mais Trilha Menos Estresse de qualquer responsabilidade civil ou criminal por eventuais danos físicos, morais, materiais, lesões, invalidez ou acidentes que possam ocorrer comigo durante o evento, decorrentes de minha própria imprudência.
          </p>
        </div>

        <div className="mb-6">
          <div className="bg-[#eef5fa] p-2 mb-4 border-l-4 border-[#113a5d]">
            <h2 className="font-bold text-[#113a5d]">7. Atendimento de Emergência</h2>
          </div>
          <p className="text-base md:text-sm print:text-sm text-justify">
            Autorizo a equipe da Mais Trilha Menos Estresse a tomar todas as medidas cabíveis de primeiros socorros e, se necessário, acionar serviços oficiais de resgate. Fica estipulado que eventuais custos médicos adicionais serão de minha inteira e exclusiva responsabilidade.
          </p>
        </div>

        <div className="mb-6">
          <div className="bg-[#eef5fa] p-2 mb-4 border-l-4 border-[#113a5d]">
            <h2 className="font-bold text-[#113a5d]">8. Autorização de Uso de Imagem</h2>
          </div>
          <p className="text-base md:text-sm print:text-sm text-justify mb-2">Declaro minha preferência quanto ao uso de registros audiovisuais coletados durante a expedição:</p>
          <div className="text-base md:text-sm print:text-sm pl-4">
            <p>
              <strong>{client.image_authorization ? '[ X ]' : '[   ]'} AUTORIZO</strong> o uso de minha imagem e voz para fins de divulgação e marketing em redes sociais de forma gratuita e por prazo indeterminado.
            </p>
            <p className="mt-2">
              <strong>{!client.image_authorization ? '[ X ]' : '[   ]'} NÃO AUTORIZO</strong> o uso de minha imagem para fins promocionais comerciais.
            </p>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-300 print:break-before-page">
          <p className="text-base md:text-sm print:text-sm text-center mb-8">
            Por estar de pleno e mútuo acordo com todos os termos e condições aqui estabelecidos, assinei digitalmente o presente documento.
          </p>

          <div className="flex flex-col md:flex-row justify-between items-center md:items-end mt-16 px-4 md:px-8 gap-8 md:gap-0">
            <div className="text-base md:text-sm print:text-sm w-full md:w-1/3 text-center md:text-left">
              <p>Data: {client.created_at ? new Date(client.created_at).toLocaleDateString('pt-BR') : 'Data não registrada'}</p>
            </div>
            
            <div className="w-full md:w-1/2 flex flex-col items-center">
              {client.signature_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={client.signature_url} alt="Assinatura" className="h-24 object-contain mb-2 mix-blend-multiply" />
              ) : (
                <div className="h-24 flex items-center justify-center text-gray-300 italic text-sm">Sem assinatura digital</div>
              )}
              <div className="border-t border-black w-full text-center pt-2 text-base md:text-sm print:text-sm font-bold">
                Assinatura Digital do Participante<br/>
                <span className="font-normal text-xs text-gray-500">Aceite registrado no sistema online</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 mt-16 pb-8">
          Mais Trilha e Menos Estresse © {client.created_at ? new Date(client.created_at).getFullYear() : '2026'} • Turismo de Aventura e Montanhismo Responsável
        </div>

      </div>
    </div>
  );
}
