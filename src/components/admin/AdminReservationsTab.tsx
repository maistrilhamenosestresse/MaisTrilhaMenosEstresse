"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { CheckCircle2, ChevronDown, DownloadCloud, Eye, MapPin, Printer, Search, Trash2, X, Plus, Edit2, Copy, DollarSign, Image as ImageIcon, AlertCircle, User, Users, FileUp } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Utilizaremos props para injetar o estado gerenciado no componente pai (page.tsx)
// No futuro, isso pode ser movido para o Zustand ou React Query.

interface AdminReservationsTabProps {
  agendas: any[];
  selectedAgendaId: string;
  setSelectedAgendaId: (id: string) => void;
  reservas: any[];
  reservaFilter: 'ALL' | 'pago' | 'pendente' | 'atrasado';
  setReservaFilter: (filter: 'ALL' | 'pago' | 'pendente' | 'atrasado') => void;
  formatCurrency: (val: number | string) => string;
  formatDateDisplay: (dateString: string) => string;
  formatPaymentMethod: (method?: string) => string;
  isFetchingDetails: boolean;
  detailsError: string;
  requirePin: (actionName: string) => Promise<boolean>;
  setReservas: React.Dispatch<React.SetStateAction<any[]>>;
  handleExportCSV: (type: 'reservas' | 'relatorios') => void;
  handlePrint: (mode: 'todos' | 'van' | 'seguro') => void;
  generateWhatsAppVan: () => Promise<void>;
  generateWhatsAppSeguro: () => Promise<void>;
  clients: any[];
  novaReservaClientId: string;
  setNovaReservaClientId: (id: string) => void;
  novaReservaClientSearch: string;
  setNovaReservaClientSearch: (search: string) => void;
  isNovaReservaSearchFocused: boolean;
  setIsNovaReservaSearchFocused: (focused: boolean) => void;
  novaReservaStatus: string;
  setNovaReservaStatus: (status: string) => void;
  novaReservaValorPago: string;
  setNovaReservaValorPago: (valor: string) => void;
  handleAddReserva: (e: React.FormEvent) => Promise<void>;
  setEditingReservationPayment: (reservation: any) => void;
}

export function AdminReservationsTab({
  agendas,
  selectedAgendaId,
  setSelectedAgendaId,
  reservas,
  reservaFilter,
  setReservaFilter,
  formatCurrency,
  formatDateDisplay,
  formatPaymentMethod,
  isFetchingDetails,
  detailsError,
  requirePin,
  setReservas,
  handleExportCSV,
  handlePrint,
  generateWhatsAppVan,
  generateWhatsAppSeguro,
  clients,
  novaReservaClientId,
  setNovaReservaClientId,
  novaReservaClientSearch,
  setNovaReservaClientSearch,
  isNovaReservaSearchFocused,
  setIsNovaReservaSearchFocused,
  novaReservaStatus,
  setNovaReservaStatus,
  novaReservaValorPago,
  setNovaReservaValorPago,
  handleAddReserva,
  setEditingReservationPayment
}: AdminReservationsTabProps) {

  const normalizeString = (str: string) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

  // Filtra clientes para o combobox
  const filteredClientsForSearch = useMemo(() => {
    if (!novaReservaClientSearch.trim()) return clients.slice(0, 50);
    const searchNormalized = normalizeString(novaReservaClientSearch);
    return clients.filter(c => 
      normalizeString(c.full_name).includes(searchNormalized) || 
      (c.cpf && c.cpf.includes(novaReservaClientSearch))
    ).slice(0, 50);
  }, [clients, novaReservaClientSearch]);

  const selectedClient = clients.find(c => c.id === novaReservaClientId);

  const handleDeleteReserva = async (id: string) => {
    if (!(await requirePin('Excluir Reserva'))) return;
    try {
      await supabase.from('reservas').delete().eq('id', id);
      setReservas(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      alert("Erro ao excluir reserva.");
    }
  };

  const selectedAgendaObj = agendas.find(a => a.id === selectedAgendaId);
  const totalPagoRes = reservas.filter(r => r.status_pagamento === 'pago').reduce((acc, curr) => acc + Number(curr.valor_pago || 0), 0);
  const vagasOcupadas = reservas.filter(r => r.status_pagamento === 'pago' || r.status_pagamento === 'pendente').length;
  const filteredReservas = reservas.filter(r => reservaFilter === 'ALL' ? true : r.status_pagamento === reservaFilter);

  return (
    <div className="space-y-6">
      {/* Seletor de Trilha */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 print:hidden">
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

      {detailsError && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-bold">{detailsError}</p>
        </div>
      )}

      {selectedAgendaId && !isFetchingDetails && !detailsError && (
        <div className="space-y-6">
          
          {/* Header Dashboard: Totais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Receita Bruta</p>
              <p className="text-xl font-black text-gray-900 mt-1">{formatCurrency(totalPagoRes)}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Vagas Preenchidas</p>
              <p className="text-xl font-black text-gray-900 mt-1">{vagasOcupadas} / {selectedAgendaObj?.max_capacity || 15}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Lista de Van</p>
              <button onClick={generateWhatsAppVan} className="text-sm font-bold text-[#F17B37] mt-1 flex items-center gap-1 hover:underline">
                <Copy className="h-4 w-4" /> Copiar para WA
              </button>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase">Lista p/ Seguro</p>
              <button onClick={generateWhatsAppSeguro} className="text-sm font-bold text-[#F17B37] mt-1 flex items-center gap-1 hover:underline">
                <Copy className="h-4 w-4" /> Copiar para WA
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden mb-4">
            <button onClick={() => setReservaFilter('ALL')} className={`px-4 py-2 text-xs font-bold rounded-xl transition ${reservaFilter === 'ALL' ? 'bg-gray-800 text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>Todos</button>
            <button onClick={() => setReservaFilter('pago')} className={`px-4 py-2 text-xs font-bold rounded-xl transition ${reservaFilter === 'pago' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-green-700 border border-green-200 hover:bg-green-50'}`}>Pagos ({reservas.filter(r => r.status_pagamento === 'pago').length})</button>
            <button onClick={() => setReservaFilter('pendente')} className={`px-4 py-2 text-xs font-bold rounded-xl transition ${reservaFilter === 'pendente' ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'}`}>Pendentes ({reservas.filter(r => r.status_pagamento === 'pendente').length})</button>
            <button onClick={() => setReservaFilter('atrasado')} className={`px-4 py-2 text-xs font-bold rounded-xl transition ${reservaFilter === 'atrasado' ? 'bg-red-600 text-white shadow-md' : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'}`}>Atrasados/Expirados</button>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 print:hidden">
            <h3 className="font-bold text-gray-900 text-lg">Lista de Passageiros</h3>
            <div className="flex gap-2">
              <button onClick={() => handlePrint('van')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition"><Printer className="w-4 h-4"/> Van</button>
              <button onClick={() => handlePrint('seguro')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition"><Printer className="w-4 h-4"/> Seguro</button>
              <button onClick={() => handleExportCSV('reservas')} className="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition"><DownloadCloud className="w-4 h-4"/> Excel/CSV</button>
            </div>
          </div>

          {/* Adição manual de reserva com Combobox customizado */}
          <div className="bg-gradient-to-br from-[#1D2A3A] to-[#0d1622] rounded-3xl p-6 shadow-xl print:hidden">
            <h4 className="text-white font-black mb-4 flex items-center gap-2"><Plus className="h-5 w-5 text-[#F17B37]" /> Adicionar Reserva Manualmente</h4>
            <form onSubmit={handleAddReserva} className="flex flex-col md:flex-row gap-4 items-start">
              
              <div className="flex-1 w-full relative" style={{ zIndex: 50 }}>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Digite o nome ou CPF para buscar..."
                    value={novaReservaClientSearch}
                    onChange={(e) => {
                      setNovaReservaClientSearch(e.target.value);
                      if (novaReservaClientId) setNovaReservaClientId("");
                    }}
                    onFocus={() => setIsNovaReservaSearchFocused(true)}
                    className="w-full pl-10 pr-10 py-3 bg-white/10 border border-white/20 text-white rounded-xl focus:ring-2 focus:ring-[#F17B37] focus:border-transparent outline-none placeholder-gray-400 font-medium transition-all"
                  />
                  {novaReservaClientId && (
                    <div className="absolute right-3 top-3 bg-green-500 rounded-full p-0.5">
                      <CheckCircle2 className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {isNovaReservaSearchFocused && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsNovaReservaSearchFocused(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 max-h-64 overflow-y-auto"
                      >
                        {filteredClientsForSearch.length === 0 ? (
                          <div className="p-4 text-center text-gray-500 text-sm font-medium">Nenhum cliente encontrado.</div>
                        ) : (
                          filteredClientsForSearch.map(client => (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => {
                                setNovaReservaClientId(client.id);
                                setNovaReservaClientSearch(client.full_name || "");
                                setIsNovaReservaSearchFocused(false);
                              }}
                              className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-center justify-between group transition-colors"
                            >
                              <div>
                                <p className="font-bold text-gray-900 group-hover:text-[#F17B37] transition-colors">{client.full_name}</p>
                                <p className="text-xs text-gray-500">{client.cpf || 'Sem CPF'}</p>
                              </div>
                              <CheckCircle2 className={`h-5 w-5 ${novaReservaClientId === client.id ? 'text-[#F17B37] opacity-100' : 'opacity-0'} transition-opacity`} />
                            </button>
                          ))
                        )}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <select
                value={novaReservaStatus}
                onChange={(e) => setNovaReservaStatus(e.target.value)}
                className="w-full md:w-auto p-3 bg-white/10 border border-white/20 text-white rounded-xl focus:ring-2 focus:ring-[#F17B37] outline-none font-bold [&>option]:text-gray-900"
              >
                <option value="pago">Já está Pago</option>
                <option value="pendente">Pendente / Cortesia</option>
              </select>
              <input
                type="text"
                placeholder="R$ Valor Ex: 150.00"
                value={novaReservaValorPago}
                onChange={(e) => setNovaReservaValorPago(e.target.value)}
                className="w-full md:w-32 p-3 bg-white/10 border border-white/20 text-white rounded-xl focus:ring-2 focus:ring-[#F17B37] outline-none placeholder-gray-400 font-bold"
              />
              <button 
                type="submit" 
                className="w-full md:w-auto bg-[#F17B37] text-white px-6 py-3 rounded-xl font-black hover:bg-[#e06925] transition shadow-lg shrink-0"
              >
                Incluir na Trilha
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {filteredReservas.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Nenhuma reserva encontrada neste status.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredReservas.map(reserva => (
                  <div key={reserva.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <div className="h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 truncate">
                          {reserva.clients?.full_name || 'Cliente deletado'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{reserva.clients?.cpf || 'Sem CPF'}</span>
                          <span>•</span>
                          <span>{formatPaymentMethod(reserva.metodo_pagamento)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between w-full md:w-auto gap-4 print:hidden">
                      <div className="text-right">
                        <p className="font-black text-gray-900">{formatCurrency(reserva.valor_pago || 0)}</p>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          reserva.status_pagamento === 'pago' ? 'bg-green-100 text-green-700' :
                          reserva.status_pagamento === 'pendente' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {reserva.status_pagamento}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 border-l border-gray-200 pl-4 shrink-0">
                        <button onClick={() => setEditingReservationPayment(reserva)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar Pagamento"><Edit2 className="h-4 w-4" /></button>
                        <button onClick={() => handleDeleteReserva(reserva.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
