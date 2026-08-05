"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Search, Trash2, User, ChevronUp, ChevronDown, Copy, Award, MapPin, FileText, Edit2, X, ShieldCheck, Loader2, Send, Printer, FileSignature, ExternalLink } from "lucide-react";

interface AdminClientsTabProps {
  clients: any[];
  setClients: React.Dispatch<React.SetStateAction<any[]>>;
  clientesTab: 'todos' | 'listas' | 'avaliacoes';
  setClientesTab: (tab: 'todos' | 'listas' | 'avaliacoes') => void;
  clientSortMode: 'recentes' | 'antigos' | 'az' | 'za';
  setClientSortMode: (mode: 'recentes' | 'antigos' | 'az' | 'za') => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  expandedClientId: string | null;
  setExpandedClientId: (id: string | null) => void;
  selectedClients: string[];
  setSelectedClients: (ids: string[]) => void;
  editingClient: any;
  setEditingClient: (client: any) => void;
  expandedTrilhas: string | null;
  setExpandedTrilhas: (id: string | null) => void;
  clientTrails: { [clientId: string]: any[] };
  loadClientTrails: (clientId: string) => Promise<void>;
  requirePin: (actionName: string) => Promise<boolean>;
  handleBulkDelete: () => Promise<void>;
  handleDeleteClient: (id: string) => Promise<void>;
  handleSaveEditedClient: (e: React.FormEvent) => Promise<void>;
  filteredClients: any[];
  isBirthday: (birthDateStr: string | null) => boolean;
  agendas: any[];
  selectedAgendaId: string;
  setSelectedAgendaId: (id: string) => void;
  formatDateDisplay: (dateString: string) => string;
  isFetchingDetails: boolean;
  avaliacoesAdmin: any[];
  avaliacoesError: string;
  toggleAvaliacao: (id: string, currentStatus: boolean) => Promise<void>;
  deleteAvaliacao: (id: string) => Promise<void>;
  reloadAvaliacoes: () => Promise<void>;
  generateWhatsAppVan: () => Promise<void>;
  generateWhatsAppSeguro: () => Promise<void>;
  handlePrint: (mode: 'todos' | 'van' | 'seguro') => void;
}

export function AdminClientsTab({
  clients,
  setClients,
  clientesTab,
  setClientesTab,
  clientSortMode,
  setClientSortMode,
  searchTerm,
  setSearchTerm,
  expandedClientId,
  setExpandedClientId,
  selectedClients,
  setSelectedClients,
  editingClient,
  setEditingClient,
  expandedTrilhas,
  setExpandedTrilhas,
  clientTrails,
  loadClientTrails,
  requirePin,
  handleBulkDelete,
  handleDeleteClient,
  handleSaveEditedClient,
  filteredClients,
  isBirthday,
  agendas,
  selectedAgendaId,
  setSelectedAgendaId,
  formatDateDisplay,
  isFetchingDetails,
  avaliacoesAdmin,
  avaliacoesError,
  toggleAvaliacao,
  deleteAvaliacao,
  reloadAvaliacoes,
  generateWhatsAppVan,
  generateWhatsAppSeguro,
  handlePrint,
}: AdminClientsTabProps) {

  const toggleClientExpand = (id: string) => {
    setExpandedClientId(expandedClientId === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {/* Abas Superiores de Clientes */}
      <div className="flex bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden shrink-0 mb-4 print:hidden">
        <button type="button" onClick={() => setClientesTab('todos')} className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${clientesTab === 'todos' ? 'border-[#F17B37] text-[#F17B37] bg-[#F17B37]/5' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Todos Cadastrados</button>
        <button type="button" onClick={() => setClientesTab('listas')} className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${clientesTab === 'listas' ? 'border-[#1D2A3A] text-[#1D2A3A] bg-[#1D2A3A]/5' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Listas de Embarque/Seguro/Contratos</button>
        <button type="button" onClick={() => setClientesTab('avaliacoes')} className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all ${clientesTab === 'avaliacoes' ? 'border-[#25D366] text-[#25D366] bg-[#25D366]/5' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Avaliações</button>
      </div>

      {clientesTab === 'todos' && (<>
        <div className="flex flex-col md:flex-row gap-2 print:hidden mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
            <input 
              type="search" 
              placeholder="Buscar por nome ou CPF..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#F17B37] outline-none font-medium"
            />
          </div>
          <select 
            value={clientSortMode}
            onChange={(e) => setClientSortMode(e.target.value as any)}
            className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5 font-bold text-sm text-gray-700 outline-none focus:ring-2 focus:ring-[#F17B37] cursor-pointer shadow-sm"
          >
            <option value="recentes">Mais Recentes</option>
            <option value="antigos">Mais Antigos</option>
            <option value="az">Nome (A-Z)</option>
            <option value="za">Nome (Z-A)</option>
          </select>
        </div>

        <div className="print:hidden">
          <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-2">Total: {filteredClients.length} Cadastrados</p>
            {selectedClients.length > 0 && (
              <button 
                onClick={handleBulkDelete}
                className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm transition-all"
              >
                <Trash2 className="w-4 h-4" /> Excluir {selectedClients.length}
              </button>
            )}
          </div>
          
          {filteredClients.length === 0 ? (
            <div className="text-center py-10">
              <User className="h-10 w-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Nenhum cliente encontrado.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {filteredClients.map(client => {
                const isBirthdayClient = isBirthday(client.birth_date);
                return (
                <div key={client.id} className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm ${expandedClientId === client.id ? 'border-[#F17B37] ring-1 ring-[#F17B37]/20' : 'border-gray-200'}`}>
                  
                  {/* Cabeçalho do Card */}
                  <div 
                    onClick={() => toggleClientExpand(client.id)}
                    className={`p-4 flex items-center justify-between cursor-pointer ${isBirthdayClient ? 'bg-gradient-to-r from-yellow-50 to-amber-50 hover:from-yellow-100 hover:to-amber-100' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input 
                        type="checkbox" 
                        checked={selectedClients.includes(client.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) setSelectedClients([...selectedClients, client.id]);
                          else setSelectedClients(selectedClients.filter(id => id !== client.id));
                        }}
                        className="w-5 h-5 rounded border-gray-300 text-[#F17B37] focus:ring-[#F17B37] cursor-pointer"
                      />
                      {client.photo_url ? (
                        <img src={client.photo_url} alt={`Foto de ${client.full_name || "cliente"}`} className="h-12 w-12 rounded-full object-cover shrink-0 border-2 border-gray-100" />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <User className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div className="min-w-0 pr-2">
                        <h4 className="font-bold text-gray-900 truncate">{client.full_name} {isBirthdayClient && <span className="text-xl animate-bounce" title="Aniversariante!">🎁</span>}</h4>
                        <p className="text-sm text-gray-500">{client.phone}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-gray-400">
                      {expandedClientId === client.id ? <ChevronUp /> : <ChevronDown />}
                    </div>
                  </div>

                  {/* Detalhes do Card (Sanfona) */}
                  <AnimatePresence>
                    {expandedClientId === client.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100 bg-gray-50/50"
                      >
                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><p className="text-gray-500 text-xs font-bold uppercase">Nascimento</p><p className="font-medium">{client.birth_date ? client.birth_date.split('-').reverse().join('/') : 'N/A'}</p></div>
                            <div><p className="text-gray-500 text-xs font-bold uppercase">CPF</p><p className="font-medium">{client.cpf}</p></div>
                            <div><p className="text-gray-500 text-xs font-bold uppercase">RG</p><p className="font-medium">{client.rg}</p></div>
                            <div className="col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div><p className="text-gray-500 text-xs font-bold uppercase">Contato Emergência</p><p className="font-medium">{client.emergency_contact_name} - {client.emergency_contact_phone}</p></div>
                              {(!client.rg || !client.birth_date || !client.emergency_contact_name || !client.accepted_terms_at) && (
                                <button 
                                  onClick={() => {
                                    const link = `${window.location.origin}/cadastro?cpf=${client.cpf}`;
                                    navigator.clipboard.writeText(link);
                                    alert("Link copiado: " + link);
                                  }}
                                  className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-blue-200 transition"
                                >
                                  <Copy className="h-3 w-3" /> Copiar link de finalizar cadastro
                                </button>
                              )}
                            </div>
                          </div>
                          
                          <div className="bg-red-50 p-3 rounded-xl border border-red-100">
                            <p className="text-red-800 text-xs font-bold uppercase mb-1">Saúde &amp; Observações</p>
                            <p className="text-sm font-medium text-red-900 whitespace-pre-wrap">{client.health_notes || "Nenhuma anotação."}</p>
                          </div>

                          {/* Área de Membros VIP */}
                          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${client.membro_vip ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-center gap-2">
                              <Award className={`h-5 w-5 ${client.membro_vip ? 'text-amber-500' : 'text-gray-400'}`} />
                              <div>
                                <p className={`text-sm font-black ${client.membro_vip ? 'text-amber-800' : 'text-gray-600'}`}>
                                  Área de Membros VIP
                                </p>
                                <p className="text-xs text-gray-500">
                                  {client.membro_vip ? '✅ Acesso autorizado manualmente' : 'Sem acesso (requer 3+ trilhas ou autorização)'}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                const novoStatus = !client.membro_vip;
                                const res = await fetch('/api/admin/membros', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ clientId: client.id, membro_vip: novoStatus })
                                });
                                if (res.ok) {
                                  setClients(prev => prev.map(c => c.id === client.id ? { ...c, membro_vip: novoStatus } : c));
                                } else {
                                  alert('Erro ao atualizar status de membro.');
                                }
                              }}
                              className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${client.membro_vip ? 'bg-amber-500' : 'bg-gray-300'}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${client.membro_vip ? 'translate-x-6' : 'translate-x-0'}`} />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 pt-2 flex-wrap">
                            <button onClick={() => loadClientTrails(client.id)} className="flex-1 bg-green-50 border border-green-200 text-green-700 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-100 transition shadow-sm" title="Ver Histórico de Trilhas"><MapPin className="h-4 w-4"/> Trilhas</button>
                            <a href={`/admin/contratos?clientId=${client.id}`} className="flex-1 bg-orange-50 border border-orange-200 text-orange-700 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-orange-100 transition shadow-sm"><FileText className="h-4 w-4"/> Contratos atuais</a>
                            <button onClick={() => setEditingClient(client)} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition" title="Editar"><Edit2 className="h-4 w-4"/></button>
                            <button onClick={() => handleDeleteClient(client.id)} className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition" title="Excluir"><Trash2 className="h-4 w-4"/></button>
                          </div>
                          
                          <AnimatePresence>
                            {expandedTrilhas === client.id && (
                              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm p-5 flex flex-col rounded-2xl">
                                <div className="flex justify-between items-center mb-4 shrink-0">
                                  <p className="font-bold text-green-800 text-base flex items-center gap-2"><MapPin className="h-5 w-5" /> Histórico de Trilhas ({clientTrails[client.id]?.length || 0})</p>
                                  <button onClick={() => setExpandedTrilhas(null)} className="p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-red-50 hover:text-red-500 transition"><X className="h-4 w-4" /></button>
                                </div>
                                <div className="space-y-2 md:overflow-y-auto custom-scrollbar flex-1 md:pr-2">
                                  {clientTrails[client.id]?.length > 0 ? (
                                    clientTrails[client.id].map((r: any, idx: number) => (
                                      <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-green-100 shadow-sm">
                                        <span className="font-bold text-gray-800">{r.agendas?.title || 'Trilha desconhecida'}</span>
                                        <div className="flex items-center gap-3">
                                          <span className="text-gray-500 text-xs font-medium bg-gray-50 px-2 py-1 rounded-md">{r.agendas?.date ? r.agendas.date.split('-').reverse().join('/') : ''}</span>
                                          <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${r.status_pagamento === 'pago' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{r.status_pagamento}</span>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                                      <MapPin className="h-8 w-8 opacity-20" />
                                      <p className="text-sm font-bold">Nenhuma trilha encontrada para este cliente.</p>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );})}
            </div>
          )}
        </div>

        {/* Link de Cadastro */}
        <div className="mt-8 bg-blue-50 border border-blue-100 p-5 rounded-2xl print:hidden">
          <ShieldCheck className="h-8 w-8 text-blue-500 mb-2" />
          <p className="font-bold text-blue-900 text-lg">Link Público de Cadastro</p>
          <p className="text-sm text-blue-700 mb-3">Envie este link para preenchimento de formulário e seguro:</p>
          <a href="/cadastro" target="_blank" className="font-mono bg-white text-blue-600 p-3 rounded-xl border border-blue-200 text-sm hover:bg-blue-600 hover:text-white transition block break-all text-center font-bold shadow-sm">
            www.maistrilhasmenosestresse.com/cadastro
          </a>
        </div>
      </>)}

      {clientesTab === 'listas' && (
        <div className="space-y-6 print:hidden">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
            <label className="text-sm font-bold text-gray-700">Selecione a Trilha/Evento:</label>
            <select 
              value={selectedAgendaId} 
              onChange={(e) => setSelectedAgendaId(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-[#1D2A3A] outline-none"
            >
              {agendas.map(a => (
                <option key={a.id} value={a.id}>{a.title} - {formatDateDisplay(a.date)}</option>
              ))}
            </select>
          </div>
          {isFetchingDetails ? (
            <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-[#1D2A3A]" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 shadow-sm">
                <h4 className="font-bold text-blue-900 text-lg flex items-center gap-2 mb-2">🚌 Lista para Van</h4>
                <p className="text-xs text-blue-700 mb-4">Nome completo, CPF e contato dos passageiros.</p>
                <div className="flex gap-2">
                  <button onClick={generateWhatsAppVan} className="flex-1 bg-white text-blue-600 border border-blue-200 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-blue-100 transition shadow-sm"><Send className="h-4 w-4"/> WhatsApp</button>
                  <button onClick={() => handlePrint('van')} className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-blue-700 transition shadow-sm"><Printer className="h-4 w-4"/> Imprimir PDF</button>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 shadow-sm">
                <h4 className="font-bold text-emerald-900 text-lg flex items-center gap-2 mb-2">🛡️ Lista para Seguro</h4>
                <p className="text-xs text-emerald-700 mb-4">Dados pessoais, emergência, saúde e observações.</p>
                <div className="flex gap-2">
                  <button onClick={generateWhatsAppSeguro} className="flex-1 bg-white text-emerald-600 border border-emerald-200 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-emerald-100 transition shadow-sm"><Send className="h-4 w-4"/> WhatsApp</button>
                  <button onClick={() => handlePrint('seguro')} className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 hover:bg-emerald-700 transition shadow-sm"><Printer className="h-4 w-4"/> Imprimir PDF</button>
                </div>
              </div>

              <div className="md:col-span-2 bg-orange-50 border border-orange-100 rounded-2xl p-5 shadow-sm">
                <h4 className="font-bold text-orange-900 text-lg flex items-center gap-2 mb-2"><FileSignature className="h-5 w-5" /> Contratos assinados</h4>
                <p className="text-xs text-orange-700 mb-4">Gere links individuais, acompanhe assinaturas e baixe os contratos de responsabilidade e seguro.</p>
                <a href="/admin/contratos" className="w-full sm:w-auto bg-orange-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 hover:bg-orange-700 transition shadow-sm"><ExternalLink className="h-4 w-4"/> Abrir painel de contratos</a>
              </div>
            </div>
          )}
        </div>
      )}

      {clientesTab === 'avaliacoes' && (
        <div className="space-y-4 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-gray-800">Moderação de avaliações</h3>
              <p className="text-sm text-gray-500">Aprove, oculte ou exclua avaliações enviadas pelo site.</p>
            </div>
            <button onClick={reloadAvaliacoes} className="self-start sm:self-auto rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">Atualizar lista</button>
          </div>

          {avaliacoesError ? (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{avaliacoesError}</div>
          ) : avaliacoesAdmin.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 border border-gray-200 rounded-2xl text-gray-500">Nenhuma avaliação encontrada no banco de dados.</div>
          ) : (
            avaliacoesAdmin.map(av => (
              <div key={av.id} className={`p-4 rounded-xl border ${av.approved ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'} shadow-sm`}>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-gray-800 text-lg">{av.name}</p>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${av.approved ? 'bg-emerald-200 text-emerald-800' : 'bg-orange-200 text-orange-800'}`}>{av.approved ? 'Publicada' : 'Aguardando aprovação'}</span>
                    </div>
                    <div className="flex text-orange-500 text-sm" aria-label={`${av.rating} de 5 estrelas`}>{'★'.repeat(av.rating)}{'☆'.repeat(Math.max(0, 5 - av.rating))}</div>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> {av.agendas?.title || 'Sem trilha vinculada'}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => toggleAvaliacao(av.id, av.approved)} className={`px-3 py-2 rounded-lg text-xs font-bold text-white transition ${av.approved ? 'bg-gray-500 hover:bg-gray-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{av.approved ? 'Ocultar do site' : 'Aprovar no site'}</button>
                    <button onClick={() => deleteAvaliacao(av.id)} className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition">Excluir</button>
                  </div>
                </div>
                <p className="text-gray-700 italic mt-3 bg-white/60 p-3 rounded-lg text-sm break-words">&ldquo;{av.comment}&rdquo;</p>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
}
