"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plus, DollarSign, Trash2, Sparkles, FileUp, Printer, CalendarDays, ChevronUp, ChevronDown, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import CobrancasDashboard from "@/components/admin/CobrancasDashboard";

interface AdminFinancesTabProps {
  financasTab: 'asaas' | 'despesas' | 'receitas' | 'relatorios';
  setFinancasTab: (tab: 'asaas' | 'despesas' | 'receitas' | 'relatorios') => void;
  selectedAgendaId: string;
  setSelectedAgendaId: (id: string) => void;
  agendas: any[];
  formatDateDisplay: (date: string) => string;
  isFetchingDetails: boolean;
  novoCustoNome: string;
  setNovoCustoNome: (name: string) => void;
  novoCustoValor: string;
  setNovoCustoValor: (val: string) => void;
  handleAddCusto: (e: React.FormEvent) => void;
  handleDeleteCusto: (id: string) => void;
  custos: any[];
  totalCosts: number;
  formatCurrency: (val: number | string) => string;
  totalRevenue: number;
  reservas: any[];
  selectedAgendaData: any;
  getReservaNetProfit: (reserva: any, agenda: any) => number;
  isFetchingGlobalFinances: boolean;
  allReservas: any[];
  allCustos: any[];
  reportYear: number;
  setReportYear: (y: number) => void;
  reportMonth: number;
  setReportMonth: (m: number) => void;
  expandedReportId: string | null;
  setExpandedReportId: (id: string | null) => void;
  handleGenerateCFOAdvice: (payload: any) => void;
  handleExportCSV: (type: 'reservas' | 'relatorios') => void;
}

export function AdminFinancesTab({
  financasTab,
  setFinancasTab,
  selectedAgendaId,
  setSelectedAgendaId,
  agendas,
  formatDateDisplay,
  isFetchingDetails,
  novoCustoNome,
  setNovoCustoNome,
  novoCustoValor,
  setNovoCustoValor,
  handleAddCusto,
  handleDeleteCusto,
  custos,
  totalCosts,
  formatCurrency,
  totalRevenue,
  reservas,
  selectedAgendaData,
  getReservaNetProfit,
  isFetchingGlobalFinances,
  allReservas,
  allCustos,
  reportYear,
  setReportYear,
  reportMonth,
  setReportMonth,
  expandedReportId,
  setExpandedReportId,
  handleGenerateCFOAdvice,
  handleExportCSV
}: AdminFinancesTabProps) {
  return (
    <div className="space-y-4">
      {/* Abas Superiores de Finanças (Scroll Horizontal) */}
      <div className="mt-2 grid shrink-0 grid-cols-2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm sm:grid-cols-4">
        <button type="button" onClick={() => setFinancasTab('asaas')} className={`min-w-0 px-2 py-3 text-xs font-bold border-b-2 transition-all ${financasTab === 'asaas' ? 'border-[#0B2540] text-[#0B2540] bg-[#E7EEF6]' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Asaas</button>
        <button type="button" onClick={() => setFinancasTab('despesas')} className={`min-w-0 px-2 py-3 text-xs font-bold border-b-2 transition-all ${financasTab === 'despesas' ? 'border-red-500 text-red-600 bg-red-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Custos</button>
        <button type="button" onClick={() => setFinancasTab('receitas')} className={`min-w-0 px-2 py-3 text-xs font-bold border-b-2 transition-all ${financasTab === 'receitas' ? 'border-green-500 text-green-600 bg-green-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Receitas</button>
        <button type="button" onClick={() => setFinancasTab('relatorios')} className={`min-w-0 px-2 py-3 text-xs font-bold border-b-2 transition-all ${financasTab === 'relatorios' ? 'border-[#D96224] text-[#D96224] bg-[#FFF0E6]' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}>Relatório</button>
      </div>

      {/* CONTEÚDO: ASAAS */}
      {financasTab === 'asaas' && (
        <div className="pt-2">
          <CobrancasDashboard />
        </div>
      )}

      {financasTab !== 'relatorios' && financasTab !== 'asaas' && (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
          <label className="text-sm font-bold text-gray-700">Selecione a Trilha:</label>
          <select 
            value={selectedAgendaId} 
            onChange={(e) => setSelectedAgendaId(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 focus:ring-2 focus:ring-[#25D366] outline-none"
          >
            {agendas.map(a => (
              <option key={a.id} value={a.id}>{a.title} - {formatDateDisplay(a.date)}</option>
            ))}
          </select>
        </div>
      )}

      {/* CONTEÚDO: DESPESAS */}
      {financasTab === 'despesas' && (
        <div className="space-y-4">
          {isFetchingDetails ? (
            <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div>
          ) : (
            <>
              <form onSubmit={handleAddCusto} className="bg-red-50/50 p-5 rounded-2xl border border-red-100 shadow-sm flex flex-col gap-3">
                <h4 className="font-bold text-red-900 flex items-center gap-2 text-sm"><Plus className="h-4 w-4"/> Registrar Nova Despesa</h4>
                <div className="flex gap-3">
                  <input type="text" placeholder="Nome do gasto (Ex: Van, Guia)" value={novoCustoNome} onChange={e => setNovoCustoNome(e.target.value)} className="flex-[2] p-3 bg-white border border-red-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-400" required />
                  <input type="text" placeholder="R$ 150.00" inputMode="decimal" value={novoCustoValor} onChange={e => setNovoCustoValor(e.target.value)} className="flex-1 p-3 bg-white border border-red-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-400" required />
                </div>
                <button type="submit" className="w-full bg-red-500 text-white p-3 rounded-xl font-bold shadow-sm hover:bg-red-600 transition">Salvar Despesa</button>
              </form>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-100 p-4 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2"><DollarSign className="h-5 w-5 text-red-500"/> Gastos Registrados</h3>
                  <span className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-bold">Total: {formatCurrency(totalCosts)}</span>
                </div>
                <div className="space-y-3 p-4">
                  {custos.length === 0 ? (
                    <p className="text-center text-gray-400 py-4 text-sm font-medium">Nenhum custo registrado.</p>
                  ) : (
                    custos.map(custo => (
                      <div key={custo.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50">
                        <p className="font-bold text-gray-700 text-sm">{custo.item_nome}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-red-500 font-bold text-sm">- {formatCurrency(Number(custo.valor_custo))}</span>
                          <button onClick={() => handleDeleteCusto(custo.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4"/></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CONTEÚDO: RECEITAS */}
      {financasTab === 'receitas' && (
        <div className="space-y-4">
          {isFetchingDetails ? (
            <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>
          ) : (
            <>
              <div className="bg-[#25D366] text-white p-6 rounded-2xl shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-[60px] opacity-20" />
                  <p className="text-green-100 text-sm font-bold uppercase tracking-wider mb-1">Receita Confirmada</p>
                  <p className="text-4xl font-black">{formatCurrency(totalRevenue)}</p>
                  <p className="text-green-100 text-xs mt-2">Soma exata do valor pago por todos os clientes.</p>
                </div>
              
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-100 p-4">
                  <h3 className="font-bold text-gray-800 text-sm">Origem das Receitas (Passageiros Pagos)</h3>
                </div>
                <div className="space-y-2 p-4">
                  {reservas.filter(r => r.status_pagamento === 'pago').length === 0 ? (
                    <p className="text-center text-gray-400 py-4 text-sm font-medium">Nenhum pagamento confirmado.</p>
                  ) : (
                    reservas.filter(r => r.status_pagamento === 'pago').map(reserva => (
                      <div key={reserva.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
                        <p className="font-bold text-gray-700 text-sm">{reserva.clients?.full_name}</p>
                        <span className="text-green-600 font-bold text-sm">+ {formatCurrency(getReservaNetProfit(reserva, selectedAgendaData))}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CONTEÚDO: RELATÓRIOS */}
      {financasTab === 'relatorios' && (
        <div className="space-y-6 pb-6">
          {isFetchingGlobalFinances ? (
            <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-[#1D2A3A]" /></div>
          ) : (
            <div className="space-y-6 print:m-0 print:p-0">
              
              {/* Header do Relatório */}
              <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 print:shadow-none print:border-none flex-col sm:flex-row gap-4">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2 w-full sm:w-auto">
                  <DollarSign className="h-6 w-6 text-[#25D366]" /> Dashboard Financeiro
                </h3>
                <div className="flex flex-wrap gap-2 print:hidden justify-start sm:justify-end w-full sm:w-auto">
                  <button 
                    onClick={() => {
                      const payload = { agendas, allReservas, allCustos, year: reportYear };
                      handleGenerateCFOAdvice(payload);
                    }}
                    className="bg-purple-50 text-purple-600 hover:bg-purple-100 p-2 rounded-xl transition flex gap-2 text-sm font-bold flex-1 sm:flex-none justify-center"
                  >
                    <Sparkles className="h-4 w-4" /> IA CFO
                  </button>
                  <button onClick={() => handleExportCSV('relatorios')} className="bg-blue-50 text-blue-600 hover:bg-blue-100 p-2 rounded-xl transition flex gap-2 text-sm font-bold flex-1 sm:flex-none justify-center">
                    <FileUp className="h-4 w-4" /> Excel
                  </button>
                  <button onClick={() => window.print()} className="bg-gray-100 text-gray-700 hover:bg-gray-200 p-2 rounded-xl transition flex gap-2 text-sm font-bold flex-1 sm:flex-none justify-center">
                    <Printer className="h-4 w-4" /> Imprimir
                  </button>
                </div>
              </div>

              {/* Filtro de Ano */}
              <div className="flex justify-center gap-2 print:hidden">
                {[2024, 2025, 2026].map(y => (
                  <button key={y} onClick={() => setReportYear(y)} className={`px-4 py-2 rounded-xl text-sm font-bold transition ${reportYear === y ? 'bg-[#1D2A3A] text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
                    {y}
                  </button>
                ))}
              </div>

              {/* Lógica de Dados do Dashboard */}
              {(() => {
                const monthlyData = Array.from({ length: 12 }, (_, i) => {
                  const month = i + 1;
                  const trailsInMonth = agendas.filter(a => {
                    const d = new Date(a.date + 'T12:00:00Z');
                    return d.getFullYear() === reportYear && (d.getMonth() + 1) === month;
                  });
                  let rev = 0; let cst = 0;
                  trailsInMonth.forEach(agenda => {
                    rev += allReservas.filter(r => r.agenda_id === agenda.id && r.status_pagamento === 'pago').reduce((acc, r) => acc + getReservaNetProfit(r, agenda), 0);
                    cst += allCustos.filter(c => c.agenda_id === agenda.id).reduce((acc, curr) => acc + Number(curr.valor_custo), 0);
                  });
                  return { name: new Date(2000, i).toLocaleString('pt-BR', { month: 'short' }).toUpperCase(), lucro: rev - cst, faturamento: rev, despesas: cst };
                });

                const totalRevYear = monthlyData.reduce((sum, d) => sum + d.faturamento, 0);
                const totalCstYear = monthlyData.reduce((sum, d) => sum + d.despesas, 0);
                const yearProfit = totalRevYear - totalCstYear;
                const monthProfit = monthlyData[reportMonth - 1]?.lucro || 0;

                const trailsInSelectedMonth = agendas.filter(a => {
                  const d = new Date(a.date + 'T12:00:00Z');
                  return d.getFullYear() === reportYear && (d.getMonth() + 1) === reportMonth;
                });

                return (
                  <>
                    {/* Cards de Resumo Anual */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-gradient-to-br from-[#1D2A3A] to-gray-900 p-5 rounded-2xl shadow-md text-white overflow-hidden">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Lucro Anual ({reportYear})</p>
                        <p className={`text-2xl sm:text-3xl lg:text-4xl font-black truncate ${yearProfit >= 0 ? 'text-[#25D366]' : 'text-red-500'}`} title={formatCurrency(yearProfit)}>{formatCurrency(yearProfit)}</p>
                      </div>
                      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Faturamento Bruto</p>
                        <p className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-800 truncate" title={formatCurrency(totalRevYear)}>{formatCurrency(totalRevYear)}</p>
                        <p className="text-xs text-gray-500 mt-1 truncate">Custos Totais: <span className="text-red-500 font-bold">- {formatCurrency(totalCstYear)}</span></p>
                      </div>
                    </div>

                    {/* Gráfico Mensal */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mt-4">
                      <h4 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide">Evolução do Lucro (Mensal)</h4>
                      <div className="h-52 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#888' }} tickFormatter={(val) => formatCurrency(val)} />
                            <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                            <Bar dataKey="lucro" radius={[4, 4, 4, 4]}>
                              {monthlyData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.lucro >= 0 ? '#25D366' : '#EF4444'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Seleção do Mês (Calendário) */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                      <h4 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">Extrato Mensal Detalhado</h4>
                      <div className="flex overflow-x-auto gap-2 pb-2 custom-scrollbar print:hidden">
                        {Array.from({ length: 12 }, (_, i) => {
                          const m = i + 1;
                          const mName = new Date(2000, i).toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
                          return (
                            <button 
                              key={m} 
                              onClick={() => setReportMonth(m)}
                              className={`flex-shrink-0 w-16 py-3 rounded-2xl border transition-all flex flex-col items-center justify-center gap-1 ${reportMonth === m ? 'border-[#F17B37] bg-[#F17B37]/10' : 'border-gray-200 bg-gray-50'}`}
                            >
                              <span className={`text-[10px] font-bold ${reportMonth === m ? 'text-[#F17B37]' : 'text-gray-400'}`}>{mName}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                          <h5 className="font-bold text-gray-700">Trilhas de {new Date(2000, reportMonth - 1).toLocaleString('pt-BR', { month: 'long' })}</h5>
                          <span className={`font-black ${monthProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Balanço: {formatCurrency(monthProfit)}</span>
                        </div>

                        {trailsInSelectedMonth.length === 0 ? (
                          <div className="bg-gray-50 rounded-xl p-6 text-center border border-dashed border-gray-200">
                            <CalendarDays className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm font-bold text-gray-500">Nenhuma expedição neste mês.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {trailsInSelectedMonth.map(agenda => {
                              const rev = allReservas.filter(r => r.agenda_id === agenda.id && r.status_pagamento === 'pago').reduce((acc, r) => acc + getReservaNetProfit(r, agenda), 0);
                              const cst = allCustos.filter(c => c.agenda_id === agenda.id).reduce((acc, curr) => acc + Number(curr.valor_custo), 0);
                              const profit = rev - cst;
                              const isPositive = profit >= 0;

                              return (
                                <div key={agenda.id} className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden ${expandedReportId === agenda.id ? 'border-[#1D2A3A] ring-1 ring-[#1D2A3A]/20' : 'border-gray-200 hover:border-gray-300'}`}>
                                  <div onClick={() => setExpandedReportId(expandedReportId === agenda.id ? null : agenda.id)} className="p-4 flex items-center justify-between cursor-pointer">
                                    <div>
                                      <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{agenda.title}</h4>
                                      <p className="text-xs text-gray-500 mt-0.5">{formatDateDisplay(agenda.date)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className={`text-[10px] font-black px-2 py-1 rounded-md ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {formatCurrency(profit)}
                                      </span>
                                      {expandedReportId === agenda.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                                    </div>
                                  </div>

                                  <AnimatePresence>
                                    {expandedReportId === agenda.id && (
                                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-gray-100 bg-gray-50/50">
                                        <div className="p-4 flex justify-between">
                                          <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Receitas</p>
                                            <p className="font-bold text-green-600 text-sm">{formatCurrency(rev)}</p>
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Despesas</p>
                                            <p className="font-bold text-red-500 text-sm">{formatCurrency(cst)}</p>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Margem</p>
                                            <p className="font-bold text-gray-800 text-sm">{rev > 0 ? ((profit / rev) * 100).toFixed(1) : '0'}%</p>
                                          </div>
                                        </div>
                                        {allReservas.filter(r => r.agenda_id === agenda.id && r.status_pagamento === 'pago').length > 0 && (
                                          <div className="p-4 pt-0 mt-2 border-t border-gray-100">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-3">Passageiros Pagos</p>
                                            <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                                              {allReservas.filter(r => r.agenda_id === agenda.id && r.status_pagamento === 'pago').map(reserva => (
                                                <div key={reserva.id} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm">
                                                  <span className="font-bold text-gray-800 truncate pr-2">{reserva.clients?.full_name}</span>
                                                  <div className="flex items-center gap-2 shrink-0">
                                                    {(() => {
                                                      const paymentMethod = String(reserva.metodo_pagamento || '').toUpperCase();
                                                      const isCreditCard = paymentMethod.includes('CREDIT_CARD') || (reserva.valor_pago && (Number(reserva.valor_pago) > Number(agenda.price) + 0.1));
                                                      const methodLabel = paymentMethod.includes('CREDIT_CARD')
                                                        ? 'Cartão'
                                                        : paymentMethod.includes('PIX')
                                                          ? 'Pix'
                                                          : paymentMethod === 'BOLETO'
                                                            ? 'Boleto'
                                                            : 'Saldo / Dinheiro';
                                                      const revenueValue = getReservaNetProfit(reserva, agenda);
                                                      return (
                                                        <>
                                                          <span className={`text-[9px] px-2 py-0.5 rounded border font-bold uppercase ${isCreditCard ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                                                            {methodLabel}
                                                          </span>
                                                          <span className="text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded border border-green-100" title={`Lucro Líquido desta reserva`}>
                                                            {formatCurrency(revenueValue)}
                                                          </span>
                                                        </>
                                                      );
                                                    })()}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
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

                    {/* Ranking dos Top Clientes */}
                    {(() => {
                      const clientRanking = allReservas.reduce((acc, curr) => {
                        if (curr.status_pagamento === 'pago' && curr.clients) {
                          if (!acc[curr.client_id]) {
                            acc[curr.client_id] = { name: curr.clients.full_name, count: 0 };
                          }
                          acc[curr.client_id].count += 1;
                        }
                        return acc;
                      }, {} as Record<string, { name: string, count: number }>);
                      
                      const topClients = Object.values(clientRanking)
                        .sort((a: any, b: any) => b.count - a.count)
                        .slice(0, 10);
                        
                      if (topClients.length === 0) return null;

                      return (
                        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mt-4 print:hidden">
                          <h4 className="font-bold text-gray-800 mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                            <Users className="h-5 w-5 text-[#F17B37]" /> Ranking Top Trilheiros
                          </h4>
                          <div className="space-y-2">
                            {topClients.map((client: any, index: number) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[#1D2A3A] text-white flex items-center justify-center text-xs font-black shrink-0 shadow-md">
                                    #{index + 1}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-900">{client.name}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 bg-orange-100 text-[#F17B37] px-3 py-1 rounded-lg border border-orange-200">
                                  <span className="text-sm font-black">{client.count}</span>
                                  <span className="text-[10px] font-bold uppercase">Trilhas</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
