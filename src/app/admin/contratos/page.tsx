"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ChevronLeft, FileSignature, CheckCircle2, XCircle, Send, Printer, FileDown, ShieldCheck } from "lucide-react";
import { PinModal } from "@/components/PinModal";
import { toast } from "sonner";

export default function ContratosAdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const agendaId = searchParams?.get('agendaId');

  const [isLoading, setIsLoading] = useState(true);
  const [agenda, setAgenda] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  
  // PIN Security
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinAction, setPinAction] = useState<{ name: string; onConfirm: () => void } | null>(null);

  const [selectedClientForModal, setSelectedClientForModal] = useState<any>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const [isPrintingAll, setIsPrintingAll] = useState(false);

  const requirePin = (actionName: string, actionFn: () => void) => {
    setPinAction({ name: actionName, onConfirm: actionFn });
    setIsPinModalOpen(true);
  };

  useEffect(() => {
    if (!agendaId) {
      router.push('/admin');
      return;
    }

    const fetchData = async () => {
      try {
        const { data: agendaData } = await supabase.from('agendas').select('*').eq('id', agendaId).single();
        if (agendaData) setAgenda(agendaData);

        const { data: reservas } = await supabase.from('reservas').select('*, clients(*)').eq('agenda_id', agendaId);
        
        if (reservas) {
          // Filter to only approved/pending payments
          const validReservations = reservas.filter(r => r.status_pagamento === 'pago' || r.status_pagamento === 'pendente');
          const clientsData = validReservations.map(r => r.clients).filter(Boolean);
          
          // Sort alphabetically
          clientsData.sort((a, b) => a.full_name.localeCompare(b.full_name));
          setClients(clientsData);
        }
      } catch (err) {
        console.error("Erro ao carregar contratos:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [agendaId, router]);

  const handleCobrarWhatsApp = (client: any) => {
    const link = `https://www.maistrilhasmenosestresse.com/cadastro?cpf=${client.cpf.replace(/[^0-9]/g, '')}`;
    const text = `Oi ${client.full_name.split(' ')[0]}, vi que você já garantiu sua vaga para a trilha *${agenda?.title}*, mas falta você preencher o seguro e *assinar o contrato digital*!\n\nPor favor, acesse o link abaixo para regularizar rapidinho (leva menos de 1 minuto): 👇\n${link}`;
    window.open(`https://wa.me/55${client.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrintAll = () => {
    setIsPrintingAll(true);
    setTimeout(() => {
      window.print();
      setIsPrintingAll(false);
    }, 500);
  };

  const handlePrintSingle = (client: any) => {
    setSelectedClientForModal(client);
    setIsPrintingAll(true);
    setTimeout(() => {
      window.print();
      setIsPrintingAll(false);
      setSelectedClientForModal(null);
    }, 500);
  };

  const clientsSigned = clients.filter(c => c.contract_signature);
  const clientsPending = clients.filter(c => !c.contract_signature);

  if (isLoading) {
    return <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">Carregando Contratos...</div>;
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] pb-24">
      {/* HEADER */}
      <header className="bg-[#1D2A3A] px-6 pt-12 pb-24 relative overflow-hidden print:hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
        <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-start gap-4">
          <button onClick={() => router.push('/admin')} className="text-white/70 hover:text-white flex items-center gap-2 text-sm font-bold bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition">
            <ChevronLeft className="h-4 w-4" /> Voltar ao Painel
          </button>
          
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <FileSignature className="h-8 w-8 text-[#F17B37]" />
            Gestão de Contratos
          </h1>
          <p className="text-gray-300 font-medium">Trilha: <span className="text-white font-bold">{agenda?.title}</span></p>
        </div>
      </header>

      {/* DASHBOARD STATS */}
      <div className="max-w-4xl mx-auto px-6 -mt-12 relative z-20 print:hidden">
        <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100 flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="flex gap-8 items-center w-full md:w-auto">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Assinados</p>
              <p className="text-3xl font-black text-emerald-500">{clientsSigned.length}</p>
            </div>
            <div className="w-px h-12 bg-gray-200"></div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Pendentes</p>
              <p className="text-3xl font-black text-red-500">{clientsPending.length}</p>
            </div>
          </div>
          
          <button 
            onClick={() => requirePin('Baixar Todos os Contratos', handlePrintAll)}
            className="w-full md:w-auto bg-[#F17B37] text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#d6672c] transition shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <Printer className="h-5 w-5" /> Baixar Todos os Contratos PDF
          </button>
        </div>
      </div>

      {/* CLIENTS LIST */}
      <div className="max-w-4xl mx-auto px-6 mt-12 print:hidden">
        <h3 className="text-lg font-black text-gray-900 mb-6">Lista de Passageiros</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map(client => (
            <div key={client.id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <div className="flex items-center gap-4">
                {client.photo_url ? (
                  <img src={client.photo_url} className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 shadow-sm" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200 shadow-sm text-gray-400 font-black text-xl">
                    {client.full_name.charAt(0)}
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 truncate">{client.full_name}</h4>
                  <p className="text-xs text-gray-500 font-mono">{client.cpf}</p>
                </div>
                
                {client.contract_signature ? (
                  <div className="bg-emerald-50 text-emerald-600 p-2 rounded-full" title="Assinado">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="bg-red-50 text-red-500 p-2 rounded-full" title="Pendente">
                    <XCircle className="w-6 h-6" />
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-2 border-t border-gray-100 pt-4">
                {client.contract_signature ? (
                  <>
                    <button 
                      onClick={() => requirePin('Ver Contrato de ' + client.full_name, () => setSelectedClientForModal(client))}
                      className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-gray-200"
                    >
                      <FileSignature className="w-4 h-4" /> Ver Contrato
                    </button>
                    <button 
                      onClick={() => requirePin('Baixar Contrato de ' + client.full_name, () => handlePrintSingle(client))}
                      className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-emerald-200"
                    >
                      <FileDown className="w-4 h-4" /> Baixar (PDF)
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => requirePin('Cobrar ' + client.full_name + ' no WhatsApp', () => handleCobrarWhatsApp(client))}
                    className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-[#25D366]/30"
                  >
                    <Send className="w-4 h-4" /> Cobrar Assinatura via WhatsApp
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL VER CONTRATO (VISUAL) */}
      {selectedClientForModal && !isPrintingAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-black text-gray-800 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-500"/> Contrato Assinado</h2>
              <button onClick={() => setSelectedClientForModal(null)} className="text-gray-400 hover:text-gray-800 p-2 bg-white rounded-full shadow-sm"><XCircle className="w-5 h-5"/></button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar">
               <ContractContent client={selectedClientForModal} agenda={agenda} />
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
              <button onClick={() => handlePrintSingle(selectedClientForModal)} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 hover:bg-emerald-700 transition">
                <Printer className="w-5 h-5" /> Imprimir Contrato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÁREA DE IMPRESSÃO - A4 */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .page-break { page-break-after: always; }
        }
      `}} />
      
      {isPrintingAll && (
        <div className="print-area hidden print:block text-black bg-white" style={{ fontFamily: 'Arial, sans-serif' }}>
          {selectedClientForModal ? (
            <div className="p-10">
              <ContractContent client={selectedClientForModal} agenda={agenda} />
            </div>
          ) : (
            clientsSigned.map((client, index) => (
              <div key={client.id} className={`p-10 ${index !== clientsSigned.length - 1 ? 'page-break' : ''}`}>
                <ContractContent client={client} agenda={agenda} />
              </div>
            ))
          )}
        </div>
      )}

      <PinModal 
        isOpen={isPinModalOpen} 
        onClose={() => setIsPinModalOpen(false)} 
        onSuccess={() => {
          if (pinAction) pinAction.onConfirm();
        }} 
        actionName={pinAction?.name} 
      />
    </main>
  );
}

// Componente do Texto do Contrato para Reuso
function ContractContent({ client, agenda }: { client: any, agenda: any }) {
  const getAge = (birthDate: string) => {
    if (!birthDate) return 'N/A';
    const ageDifMs = Date.now() - new Date(birthDate).getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  return (
    <div className="text-justify text-sm leading-relaxed text-gray-800" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-black uppercase mb-1">CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TURISMO DE AVENTURA</h1>
        <p className="text-gray-500 font-bold">MAIS TRILHA MENOS ESTRESSE</p>
      </div>

      <p className="mb-4">
        Pelo presente instrumento particular, de um lado, <strong>MAIS TRILHA MENOS ESTRESSE</strong>, empresa prestadora de serviços turísticos, e de outro lado:
      </p>

      <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl mb-6">
        <p><strong>NOME DO CONTRATANTE:</strong> {client.full_name}</p>
        <p><strong>CPF:</strong> {client.cpf} &nbsp;&nbsp;&nbsp; <strong>RG:</strong> {client.rg || 'Não informado'}</p>
        <p><strong>DATA DE NASCIMENTO:</strong> {client.birth_date ? new Date(client.birth_date).toLocaleDateString('pt-BR') : 'Não informado'} ({getAge(client.birth_date)} anos)</p>
        <p><strong>CONTATO:</strong> {client.phone}</p>
        <p><strong>CONTATO DE EMERGÊNCIA:</strong> {client.emergency_contact_phone || 'Não informado'}</p>
      </div>

      <p className="mb-4">
        Têm justo e contratado o presente, que se regerá pelas seguintes cláusulas e condições descritas abaixo para a trilha/evento:
      </p>

      <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl mb-6 text-center">
        <h3 className="font-black text-lg">{agenda?.title}</h3>
        <p>Data do Evento: {agenda?.date ? new Date(agenda.date).toLocaleDateString('pt-BR') : 'A definir'}</p>
      </div>

      <h3 className="font-bold mb-2 uppercase">1. Do Objeto e dos Riscos Inerentes</h3>
      <p className="mb-4">O CONTRATANTE declara ter ciência de que as atividades de ecoturismo e turismo de aventura envolvem riscos à integridade física, como lesões, torções, fraturas, picadas de insetos e animais peçonhentos, alterações climáticas bruscas, além dos riscos inerentes a ambientes naturais remotos de difícil acesso ou resgate.</p>

      <h3 className="font-bold mb-2 uppercase">2. Das Declarações de Saúde</h3>
      <p className="mb-4">O CONTRATANTE declara estar em perfeitas condições físicas e de saúde mental compatíveis para participar das atividades do evento mencionado acima. Qualquer problema de saúde (ex: asma, diabetes, hipertensão, alergias crônicas) ou uso de medicação controlada foi previamente informado no cadastro do site. A omissão destas informações isenta a contratada de quaisquer responsabilidades advindas do fato.</p>

      <h3 className="font-bold mb-2 uppercase">3. Condições de Cancelamento e Reembolso</h3>
      <p className="mb-4">O cancelamento por parte do CONTRATANTE segue a deliberação normativa da Embratur nº 161/85. Caso o contratante não compareça (No-Show) no horário de embarque ou abandone a viagem após iniciada, perderá o valor integral pago, sem direito a qualquer tipo de restituição ou crédito para viagens futuras. A contratada reserva-se o direito de alterar ou cancelar a viagem caso o número mínimo de participantes não seja atingido, garantindo o reembolso integral.</p>

      <h3 className="font-bold mb-2 uppercase">4. Do Comportamento e Orientações</h3>
      <p className="mb-4">O CONTRATANTE se compromete a seguir as orientações dos guias e condutores em todos os momentos, não ultrapassar o líder do grupo ou ficar atrás do guia "fecha", respeitar as normas ambientais (não jogar lixo na trilha, não alimentar animais silvestres) e zelar pelo bom convívio com os demais participantes. O não cumprimento das regras de segurança pode acarretar no imediato desligamento do passageiro, sem direito a reembolso.</p>

      <h3 className="font-bold mb-2 uppercase">5. Direito de Imagem</h3>
      <p className="mb-6">O CONTRATANTE autoriza o uso gratuito de sua imagem e voz captadas durante a viagem, em fotografias e vídeos, para fins de divulgação, marketing e publicidade da MAIS TRILHA MENOS ESTRESSE em redes sociais e websites, por prazo indeterminado.</p>

      <div className="mt-12 flex flex-col items-center border-t-2 border-dashed border-gray-300 pt-8">
        <p className="mb-8 font-bold text-gray-500 uppercase tracking-wider text-xs">ASSINATURA DIGITAL DO CONTRATANTE</p>
        {client.contract_signature ? (
          <img src={client.contract_signature} alt="Assinatura" className="h-32 object-contain" />
        ) : (
          <div className="h-32 flex items-center justify-center text-red-500 font-bold border-2 border-red-200 border-dashed w-full max-w-sm rounded-xl bg-red-50">
            NÃO ASSINADO
          </div>
        )}
        <div className="w-80 h-px bg-black mt-2 mb-2"></div>
        <p className="font-bold">{client.full_name}</p>
        <p className="text-xs text-gray-500">CPF: {client.cpf}</p>
        <p className="text-xs text-gray-400 mt-4">Documento gerado eletronicamente em {new Date().toLocaleDateString('pt-BR')} com validade jurídica conforme MP nº 2.200-2/2001 e Código Civil Brasileiro.</p>
      </div>
    </div>
  );
}
