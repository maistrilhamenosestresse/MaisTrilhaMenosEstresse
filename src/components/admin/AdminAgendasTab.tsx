"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Send, Loader2, CheckCircle2, ShieldCheck, LockKeyhole, Eye, ChevronDown, ChevronUp, Edit2, Trash2 } from "lucide-react";

interface AdminAgendasTabProps {
  agendas: any[];
  whatsappLink: string;
  isMaintenance: boolean;
  isTogglingMaintenance: boolean;
  handleToggleMaintenance: () => void;
  isArchivedTrailDate: (date: string) => boolean;
  globalViews: number;
  isFetching: boolean;
  expandedAgendaId: string | null;
  setExpandedAgendaId: (id: string | null) => void;
  formatDateDisplay: (date: string) => string;
  handleEdit: (agenda: any) => void;
  deleteAgenda: (id: string) => void;
}

export function AdminAgendasTab({
  agendas,
  whatsappLink,
  isMaintenance,
  isTogglingMaintenance,
  handleToggleMaintenance,
  isArchivedTrailDate,
  globalViews,
  isFetching,
  expandedAgendaId,
  setExpandedAgendaId,
  formatDateDisplay,
  handleEdit,
  deleteAgenda
}: AdminAgendasTabProps) {
  return (
    <div className="space-y-6">
      {/* Banner de Enviar Calendário e Modo Manutenção */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-[#1D2A3A] to-gray-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#25D366] rounded-full blur-[60px] opacity-20" />
          <h3 className="font-bold text-lg mb-1">Enviar Calendário</h3>
          <p className="text-sm text-gray-300 mb-5 max-w-[80%]">Compartilhe as próximas aventuras.</p>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:scale-105 transition">
            <Send className="h-4 w-4" /> Enviar no Grupo
          </a>
        </div>
        
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-[60px] opacity-20" />
          <h3 className="font-bold text-lg mb-1">Controle do Site</h3>
          <p className="text-sm text-white/80 mb-5 max-w-[80%]">{isMaintenance ? 'O site está pausado. Ninguém pode comprar.' : 'Pause o site para edição.'}</p>
          <button 
            onClick={handleToggleMaintenance} 
            disabled={isTogglingMaintenance}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold shadow-lg hover:scale-105 transition ${isMaintenance ? 'bg-green-500 text-white' : 'bg-red-600 text-white'}`}
          >
            {isTogglingMaintenance ? <Loader2 className="h-4 w-4 animate-spin" /> : (isMaintenance ? <CheckCircle2 className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />)}
            {isMaintenance ? 'Colocar Site Online' : 'Pausar Site'}
          </button>
        </div>
      </div>

      {/* Lista de Trilhas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-gray-800">
              Trilhas cadastradas
              <span className="rounded-full bg-[#F17B37]/10 px-3 py-1 text-xs font-black text-[#F17B37]">{agendas.length}</span>
            </h3>
            <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wider">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                {agendas.filter((agenda) => !isArchivedTrailDate(agenda.date)).length} próximas
              </span>
              <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-gray-500">
                <LockKeyhole className="h-3 w-3" />
                {agendas.filter((agenda) => isArchivedTrailDate(agenda.date)).length} encerradas
              </span>
            </div>
          </div>
          {globalViews > 0 && (
            <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-xl border border-green-200 shadow-sm">
              <Eye className="h-4 w-4" />
              <span className="text-xs font-extrabold uppercase tracking-wide">Acessos: {globalViews}</span>
            </div>
          )}
        </div>
        
        {isFetching ? (
          <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-[#F17B37]" /></div>
        ) : agendas.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
            <CalendarDays className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhuma aventura planejada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {agendas.map((agenda) => {
              const occupied = agenda.reservas ? agenda.reservas.filter((r: any) => r.status_pagamento === 'pago' || r.status_pagamento === 'pendente').length : 0;
              const maxCap = agenda.max_capacity || 15;
              const isFull = occupied >= maxCap;
              const isArchived = isArchivedTrailDate(agenda.date);

              return (
                <div key={agenda.id} className={`rounded-2xl border transition-all duration-300 overflow-hidden shadow-sm ${isArchived ? 'bg-gray-100/80 opacity-55 saturate-0' : 'bg-white'} ${expandedAgendaId === agenda.id ? 'border-[#F17B37] ring-1 ring-[#F17B37]/20' : 'border-gray-100 hover:shadow-md'} ${isFull && !isArchived ? 'opacity-70 grayscale' : ''}`}>
                  <div 
                    onClick={() => setExpandedAgendaId(expandedAgendaId === agenda.id ? null : agenda.id)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className={`h-14 w-14 rounded-xl flex flex-col items-center justify-center shrink-0 border ${isArchived || isFull ? 'bg-gray-100 border-gray-200' : 'bg-[#F17B37]/10 border-[#F17B37]/20'}`}>
                        {isArchived && <LockKeyhole className="mb-0.5 h-3.5 w-3.5 text-gray-500" />}
                        <span className={`text-xs font-bold ${isArchived || isFull ? 'text-gray-500' : 'text-[#F17B37]'}`}>{formatDateDisplay(agenda.date).substring(0, 5)}</span>
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900 truncate">{agenda.title}</h4>
                          {isArchived
                            ? <span className="flex items-center gap-1 rounded border border-gray-300 bg-gray-200 px-2 py-0.5 text-[9px] font-black uppercase text-gray-600"><LockKeyhole className="h-2.5 w-2.5" /> Encerrada</span>
                            : isFull && <span className="bg-red-100 text-red-600 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-red-200">Esgotado</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-sm font-medium text-green-600">R$ {agenda.price}</p>
                          <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
                            <Eye className="h-3 w-3" /> {agenda.views || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-gray-400">
                      {expandedAgendaId === agenda.id ? <ChevronUp /> : <ChevronDown />}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedAgendaId === agenda.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100 bg-gray-50/50"
                      >
                        <div className="p-4 flex flex-col sm:flex-row items-center justify-end gap-3 flex-wrap">
                          <button onClick={() => handleEdit(agenda)} className={`w-full sm:w-auto py-2.5 px-6 font-bold rounded-xl transition flex items-center justify-center gap-2 ${isArchived ? 'border border-gray-300 bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
                            {isArchived ? <LockKeyhole className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                            {isArchived ? "Desbloquear edição" : "Editar Trilha"}
                          </button>
                          <button onClick={() => deleteAgenda(agenda.id)} className="w-full sm:w-auto py-2.5 px-6 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition flex items-center justify-center gap-2"><Trash2 className="h-4 w-4" /> Excluir</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
