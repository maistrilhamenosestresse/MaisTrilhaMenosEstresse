"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ChevronLeft, FileSignature, CheckCircle2, XCircle, Send, Printer, FileDown, ShieldCheck, Search } from "lucide-react";
import { PinModal } from "@/components/PinModal";
import { toast } from "sonner";
import { createRoot } from "react-dom/client";

export default function ContratosAdminPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'assinados' | 'pendentes'>('pendentes');
  
  // PIN Security
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinAction, setPinAction] = useState<{ name: string; onConfirm: () => void; onCancel: () => void } | null>(null);

  const [selectedClientForModal, setSelectedClientForModal] = useState<any>(null);

  const requirePin = async (actionName: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setPinAction({
        name: actionName,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      });
      setIsPinModalOpen(true);
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: clientsData, error } = await supabase.from('clients').select('*').order('full_name', { ascending: true });
        if (error) throw error;
        if (clientsData) setClients(clientsData);
      } catch (err) {
        console.error("Erro ao carregar clientes para contratos:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleManualSign = async (client: any) => {
    if (!(await requirePin(`Assinar Manualmente ${client.full_name}`))) return;

    try {
      const { error } = await supabase.from('clients').update({ 
        signature_url: 'ASSINATURA MANUAL - ' + new Date().toISOString() 
      }).eq('id', client.id);
      
      if (error) throw error;
      
      setClients(clients.map(c => c.id === client.id ? { ...c, signature_url: 'ASSINATURA MANUAL - ' + new Date().toISOString() } : c));
      alert(`Contrato de ${client.full_name} marcado como assinado manualmente!`);
    } catch (err) {
      alert('Erro ao marcar contrato como assinado.');
    }
  };

  const handleCobrarWhatsApp = async (client: any) => {
    if (!(await requirePin(`Cobrar ${client.full_name} no WhatsApp`))) return;

    const link = `https://www.maistrilhasmenosestresse.com/cadastro?cpf=${client.cpf.replace(/[^0-9]/g, '')}`;
    const text = `Oi ${client.full_name.split(' ')[0]}, vi que você já garantiu sua vaga com a Mais Trilha, mas falta você preencher o seguro e *assinar o contrato digital*!\n\nPor favor, acesse o link abaixo para regularizar rapidinho (leva menos de 1 minuto): 👇\n${link}`;
    window.open(`https://wa.me/55${client.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const executePrintWindow = (htmlContent: string, title: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.5; }
              .page-break { page-break-after: always; }
              .contract-container { max-width: 800px; margin: 0 auto; text-align: justify; font-size: 14px; }
              .header { text-align: center; margin-bottom: 30px; }
              .header h1 { font-size: 24px; margin-bottom: 5px; text-transform: uppercase; }
              .header p { font-weight: bold; color: #666; }
              .client-box { background: #f9f9f9; border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
              .client-box p { margin: 5px 0; }
              h3 { font-size: 16px; margin-top: 20px; margin-bottom: 10px; text-transform: uppercase; }
              .signature-area { margin-top: 50px; text-align: center; border-top: 2px dashed #ccc; padding-top: 30px; }
              .signature-image { max-height: 100px; object-fit: contain; margin-bottom: 10px; }
              .manual-sig { font-weight: bold; padding: 10px; border: 1px solid #4ade80; background: #f0fdf4; color: #166534; display: inline-block; border-radius: 8px; margin-bottom: 10px; }
              .line { width: 300px; height: 1px; background: #000; margin: 10px auto; }
              .footer-text { font-size: 11px; color: #888; margin-top: 15px; }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    } else {
      alert("Por favor, permita pop-ups para imprimir o documento.");
    }
  };

  const getAge = (birthDate: string) => {
    if (!birthDate) return 'N/A';
    const ageDifMs = Date.now() - new Date(birthDate).getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const generateContractHTML = (client: any) => {
    let signatureHTML = `
      <div style="height: 100px; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #ef4444; border: 2px dashed #fca5a5; background: #fef2f2; border-radius: 8px; width: 300px; margin: 0 auto 10px auto;">
        NÃO ASSINADO
      </div>
    `;

    if (client.signature_url) {
      if (client.signature_url.startsWith('ASSINATURA MANUAL')) {
        signatureHTML = `<div class="manual-sig">${client.signature_url}</div>`;
      } else {
        signatureHTML = `<img src="${client.signature_url}" class="signature-image" alt="Assinatura" />`;
      }
    }

    return `
      <div class="contract-container">
        <div class="header">
          <h1>TERMO DE RESPONSABILIDADE E CONTRATO GERAL</h1>
          <p>MAIS TRILHA MENOS ESTRESSE</p>
        </div>

        <p style="margin-bottom: 15px;">Pelo presente instrumento particular, de um lado, <strong>MAIS TRILHA MENOS ESTRESSE</strong>, empresa prestadora de serviços turísticos, e de outro lado:</p>

        <div class="client-box">
          <p><strong>NOME DO CONTRATANTE:</strong> ${client.full_name}</p>
          <p><strong>CPF:</strong> ${client.cpf} &nbsp;&nbsp;&nbsp; <strong>RG:</strong> ${client.rg || 'Não informado'}</p>
          <p><strong>DATA DE NASCIMENTO:</strong> ${client.birth_date ? new Date(client.birth_date).toLocaleDateString('pt-BR') : 'Não informado'} (${getAge(client.birth_date)} anos)</p>
          <p><strong>CONTATO:</strong> ${client.phone}</p>
          <p><strong>CONTATO DE EMERGÊNCIA:</strong> ${client.emergency_contact_phone || 'Não informado'}</p>
        </div>

        <p style="margin-bottom: 15px;">Têm justo e contratado o presente, que se regerá pelas seguintes cláusulas e condições descritas abaixo para qualquer viagem, trilha ou evento fornecido pela Agência.</p>

        <h3>1. Do Objeto e dos Riscos Inerentes</h3>
        <p style="margin-bottom: 15px;">O CONTRATANTE declara ter ciência de que as atividades de ecoturismo e turismo de aventura envolvem riscos à integridade física, como lesões, torções, fraturas, picadas de insetos e animais peçonhentos, alterações climáticas bruscas, além dos riscos inerentes a ambientes naturais remotos de difícil acesso ou resgate.</p>

        <h3>2. Das Declarações de Saúde</h3>
        <p style="margin-bottom: 15px;">O CONTRATANTE declara estar em perfeitas condições físicas e de saúde mental compatíveis para participar das atividades. Qualquer problema de saúde (ex: asma, diabetes, hipertensão, alergias crônicas) ou uso de medicação controlada foi previamente informado no cadastro da agência. A omissão destas informações isenta a contratada de quaisquer responsabilidades advindas do fato.</p>

        <h3>3. Condições de Cancelamento e Reembolso</h3>
        <p style="margin-bottom: 15px;">O cancelamento por parte do CONTRATANTE segue a deliberação normativa da Embratur nº 161/85. Caso o contratante não compareça (No-Show) no horário de embarque ou abandone a viagem após iniciada, perderá o valor integral pago, sem direito a qualquer tipo de restituição ou crédito para viagens futuras. A contratada reserva-se o direito de alterar ou cancelar a viagem caso o número mínimo de participantes não seja atingido, garantindo o reembolso integral.</p>

        <h3>4. Do Comportamento e Orientações</h3>
        <p style="margin-bottom: 15px;">O CONTRATANTE se compromete a seguir as orientações dos guias e condutores em todos os momentos, não ultrapassar o líder do grupo ou ficar atrás do guia "fecha", respeitar as normas ambientais (não jogar lixo na trilha, não alimentar animais silvestres) e zelar pelo bom convívio com os demais participantes. O não cumprimento das regras de segurança pode acarretar no imediato desligamento do passageiro, sem direito a reembolso.</p>

        <h3>5. Direito de Imagem</h3>
        <p style="margin-bottom: 25px;">O CONTRATANTE autoriza o uso gratuito de sua imagem e voz captadas durante as viagens, em fotografias e vídeos, para fins de divulgação, marketing e publicidade da MAIS TRILHA MENOS ESTRESSE em redes sociais e websites, por prazo indeterminado.</p>

        <div class="signature-area">
          <p style="font-size: 10px; color: #888; font-weight: bold; margin-bottom: 15px;">ASSINATURA DIGITAL DO CONTRATANTE</p>
          ${signatureHTML}
          <div class="line"></div>
          <p style="font-weight: bold; margin-top: 5px;">${client.full_name}</p>
          <p style="font-size: 12px; color: #666; margin-top: 2px;">CPF: ${client.cpf}</p>
          <p class="footer-text">Documento validado eletronicamente na plataforma Mais Trilha Menos Estresse.<br/>Tem validade jurídica conforme MP nº 2.200-2/2001 e Código Civil Brasileiro.</p>
        </div>
      </div>
    `;
  };

  const handlePrintAll = async () => {
    if (!(await requirePin('Baixar Todos os Contratos'))) return;
    const signedClients = clients.filter(c => c.signature_url);
    if (signedClients.length === 0) {
      alert("Nenhum contrato assinado encontrado para impressão.");
      return;
    }

    const fullHTML = signedClients.map((client, idx) => 
      `<div class="${idx !== signedClients.length - 1 ? 'page-break' : ''}">
        ${generateContractHTML(client)}
      </div>`
    ).join('');

    executePrintWindow(fullHTML, "Todos os Contratos Assinados");
  };

  const handlePrintSingle = async (client: any) => {
    const html = generateContractHTML(client);
    executePrintWindow(html, `Contrato - ${client.full_name}`);
  };
  
  const handleViewContract = async (client: any) => {
    if (!(await requirePin('Ver Contrato de ' + client.full_name))) return;
    setSelectedClientForModal(client);
  };

  const normalizeString = (str: string) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
  
  const filteredClients = clients.filter(c => 
    normalizeString(c.full_name).includes(normalizeString(searchTerm)) || 
    (c.cpf && c.cpf.includes(searchTerm))
  );

  const clientsSigned = filteredClients.filter(c => c.signature_url);
  const clientsPending = filteredClients.filter(c => !c.signature_url);

  const displayedClients = activeTab === 'assinados' ? clientsSigned : clientsPending;

  if (isLoading) {
    return <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">Carregando Contratos...</div>;
  }

  return (
    <main className="min-h-screen bg-[#f8f9fa] pb-24">
      {/* HEADER */}
      <header className="bg-[#1D2A3A] px-6 pt-12 pb-24 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
        <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-start gap-4">
          <button onClick={() => router.push('/admin')} className="text-white/70 hover:text-white flex items-center gap-2 text-sm font-bold bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition">
            <ChevronLeft className="h-4 w-4" /> Voltar ao Painel
          </button>
          
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <FileSignature className="h-8 w-8 text-[#F17B37]" />
            Gestão Geral de Contratos
          </h1>
          <p className="text-gray-300 font-medium">Todos os passageiros cadastrados na base de dados.</p>
        </div>
      </header>

      {/* DASHBOARD STATS */}
      <div className="max-w-4xl mx-auto px-6 -mt-12 relative z-20">
        <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-100 flex flex-col md:flex-row gap-6 items-center justify-between">
          <div className="flex gap-8 items-center w-full md:w-auto">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Assinados</p>
              <p className="text-3xl font-black text-emerald-500">{clients.filter(c => c.signature_url).length}</p>
            </div>
            <div className="w-px h-12 bg-gray-200"></div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Pendentes</p>
              <p className="text-3xl font-black text-red-500">{clients.filter(c => !c.signature_url).length}</p>
            </div>
          </div>
          
          <button 
            onClick={handlePrintAll}
            className="w-full md:w-auto bg-[#F17B37] text-white px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#d6672c] transition shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <Printer className="h-5 w-5" /> Imprimir Contratos Assinados
          </button>
        </div>
      </div>

      {/* CLIENTS LIST AND TABS */}
      <div className="max-w-4xl mx-auto px-6 mt-12">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex bg-gray-200 p-1 rounded-xl w-full md:w-auto">
            <button 
              onClick={() => setActiveTab('pendentes')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'pendentes' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Pendentes ({clientsPending.length})
            </button>
            <button 
              onClick={() => setActiveTab('assinados')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'assinados' ? 'bg-white text-emerald-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Assinados ({clientsSigned.length})
            </button>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input 
              type="search" 
              placeholder="Buscar Passageiro..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl shadow-sm focus:ring-2 focus:ring-[#F17B37] outline-none font-medium text-sm"
            />
          </div>
        </div>
        
        {displayedClients.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm flex flex-col items-center justify-center">
            <XCircle className="w-16 h-16 text-gray-300 mb-4" />
            <h4 className="text-xl font-bold text-gray-800 mb-2">Nenhum passageiro encontrado</h4>
            <p className="text-gray-500">Não há contratos nesta categoria ou a busca não encontrou resultados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedClients.map(client => (
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
                
                {client.signature_url ? (
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
                {client.signature_url ? (
                  <>
                    <button 
                      onClick={() => handleViewContract(client)}
                      className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-gray-200"
                    >
                      <FileSignature className="w-4 h-4" /> Visualizar
                    </button>
                    <button 
                      onClick={() => handlePrintSingle(client)}
                      className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-emerald-200"
                    >
                      <Printer className="w-4 h-4" /> Imprimir
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col gap-2 w-full">
                    <button 
                      onClick={() => handleManualSign(client)}
                      className="w-full bg-orange-100 hover:bg-orange-200 text-orange-700 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-orange-200"
                    >
                      <ShieldCheck className="w-4 h-4" /> Dar Baixa Manualmente
                    </button>
                    <button 
                      onClick={() => handleCobrarWhatsApp(client)}
                      className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-[#25D366]/30"
                    >
                      <Send className="w-4 h-4" /> Cobrar via WhatsApp
                    </button>
                  </div>
                )}
              </div>
            </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL VER CONTRATO (VISUAL) */}
      {selectedClientForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-black text-gray-800 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-500"/> Contrato Assinado</h2>
              <button onClick={() => setSelectedClientForModal(null)} className="text-gray-400 hover:text-gray-800 p-2 bg-white rounded-full shadow-sm"><XCircle className="w-5 h-5"/></button>
            </div>
            <div className="p-8 overflow-y-auto custom-scrollbar">
               <div dangerouslySetInnerHTML={{ __html: generateContractHTML(selectedClientForModal) }} />
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
              <button onClick={() => handlePrintSingle(selectedClientForModal)} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 hover:bg-emerald-700 transition">
                <Printer className="w-5 h-5" /> Imprimir Contrato
              </button>
            </div>
          </div>
        </div>
      )}

      <PinModal 
        isOpen={isPinModalOpen} 
        onClose={() => {
          setIsPinModalOpen(false);
          if (pinAction && pinAction.onCancel) pinAction.onCancel();
        }} 
        onSuccess={() => {
          if (pinAction) pinAction.onConfirm();
        }} 
        actionName={pinAction?.name} 
      />
    </main>
  );
}
