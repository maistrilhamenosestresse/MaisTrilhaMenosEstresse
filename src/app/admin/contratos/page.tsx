"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, FileSignature, CheckCircle2, XCircle, Send, FileDown, Search, Loader2, Copy, ClipboardCheck } from "lucide-react";
import { PinModal } from "@/components/PinModal";

export default function ContratosAdminPage() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<'assinados' | 'pendentes'>('pendentes');
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [groupLinkCopied, setGroupLinkCopied] = useState(false);
  
  // PIN Security
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinAction, setPinAction] = useState<{ name: string; onConfirm: () => void; onCancel: () => void } | null>(null);

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
        const response = await fetch('/api/admin/contracts', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha ao carregar contratos');
        setClients(result.clients || []);
        const requestedClientId = new URLSearchParams(window.location.search).get("clientId");
        const requestedClient = (result.clients || []).find((client: any) => client.id === requestedClientId);
        if (requestedClient) setSearchTerm(requestedClient.full_name);
      } catch (err) {
        console.error("Erro ao carregar clientes para contratos:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCobrarWhatsApp = async (client: any) => {
    if (!(await requirePin(`Cobrar ${client.full_name} no WhatsApp`))) return;
    try {
      const response = await fetch("/api/admin/contracts/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível gerar o link");

      const firstName = client.full_name.split(" ")[0];
      const text = `Oi ${firstName}, atualizamos o termo de responsabilidade e a autorização do seguro da Mais Trilha. Leia e assine os dois documentos neste link individual e seguro, por favor:\n\n${result.signingUrl}`;
      const number = formatWhatsAppNumber(client.phone);
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    } catch (error: any) {
      alert(error.message || "Não foi possível preparar a cobrança de assinatura.");
    }
  };

  const handleDownloadVersionedContracts = async (clientId?: string) => {
    if (!(await requirePin('Baixar arquivo seguro de contratos'))) return;
    setIsDownloadingAll(true);
    try {
      const params = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
      const response = await fetch(`/api/admin/contracts/download${params}`, { cache: 'no-store' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || 'Não foi possível preparar os contratos.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = clientId
        ? `contratos-passageiro-${clientId.slice(0, 8)}.zip`
        : `contratos-assinados-${new Date().toISOString().slice(0, 10)}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error.message || 'Erro ao baixar contratos.');
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const copyGroupContractLink = async () => {
    const link = `${window.location.origin}/contratos`;
    await navigator.clipboard.writeText(link);
    setGroupLinkCopied(true);
    window.setTimeout(() => setGroupLinkCopied(false), 2500);
  };

  const normalizeString = (str: string) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
  
  const filteredClients = clients.filter(c => 
    normalizeString(c.full_name).includes(normalizeString(searchTerm)) || 
    (c.cpf && c.cpf.includes(searchTerm))
  );

  const hasCurrentDocuments = (client: any) =>
    client.contract_current?.responsibility === true &&
    client.contract_current?.insurance === true;
  const clientsSigned = filteredClients.filter(hasCurrentDocuments);
  const clientsPending = filteredClients.filter(c => !hasCurrentDocuments(c));

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
              <p className="text-3xl font-black text-emerald-500">{clients.filter(hasCurrentDocuments).length}</p>
            </div>
            <div className="w-px h-12 bg-gray-200"></div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase">Pendentes</p>
              <p className="text-3xl font-black text-red-500">{clients.filter(c => !hasCurrentDocuments(c)).length}</p>
            </div>
          </div>
          
          <div className="grid w-full gap-2 md:w-auto">
            <button
              type="button"
              onClick={copyGroupContractLink}
              className="w-full rounded-xl border border-[#0B2540] bg-white px-5 py-3 text-sm font-bold text-[#0B2540] transition hover:bg-blue-50 flex items-center justify-center gap-2"
            >
              {groupLinkCopied ? <ClipboardCheck className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
              {groupLinkCopied ? "Link geral copiado" : "Copiar link para o grupo"}
            </button>
            <button
              onClick={() => handleDownloadVersionedContracts()}
              disabled={isDownloadingAll}
              className="w-full bg-[#F17B37] text-white px-5 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#d6672c] transition shadow-lg disabled:opacity-60"
            >
              {isDownloadingAll ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />}
              Baixar todos os contratos atuais
            </button>
          </div>
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
                  <img src={client.photo_url} alt={`Foto de ${client.full_name}`} className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 shadow-sm" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200 shadow-sm text-gray-400 font-black text-xl">
                    {client.full_name.charAt(0)}
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-900 truncate">{client.full_name}</h4>
                  <p className="text-xs text-gray-500 font-mono">{client.cpf}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      client.contract_current?.responsibility ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      Responsabilidade
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      client.contract_current?.insurance ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      Seguro
                    </span>
                  </div>
                </div>
                
                {hasCurrentDocuments(client) ? (
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
                {hasCurrentDocuments(client) ? (
                  <button
                      onClick={() => handleDownloadVersionedContracts(client.id)}
                      className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 border border-gray-200"
                    >
                      <FileDown className="w-4 h-4" /> Baixar os dois contratos em ZIP
                    </button>
                ) : (
                  <div className="w-full">
                    <button 
                      onClick={() => handleCobrarWhatsApp(client)}
                      className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border border-[#25D366]/30"
                    >
                      <Send className="w-4 h-4" /> Gerar link e cobrar via WhatsApp
                    </button>
                  </div>
                )}
              </div>
            </div>
            ))}
          </div>
        )}
      </div>

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

function formatWhatsAppNumber(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}
