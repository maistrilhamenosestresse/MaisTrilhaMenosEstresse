"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, FileText, AlertTriangle, ChevronDown, ChevronUp, User, CreditCard, Banknote, QrCode, ArrowUpRight, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AsaasCarteira from "./AsaasCarteira";

export default function CobrancasDashboard() {
  const [activeMainTab, setActiveMainTab] = useState<'carteira' | 'cobrancas'>('carteira');

  // Cobranças State
  const [payments, setPayments] = useState<any[]>([]);
  const [groupedPayments, setGroupedPayments] = useState<{ [key: string]: any[] }>({});
  const [customerNames, setCustomerNames] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL'); // ALL, PIX, BOLETO, CREDIT_CARD
  
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({});
  const [isAnticipating, setIsAnticipating] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [showModalInstallments, setShowModalInstallments] = useState<boolean>(false);

  const openModal = (p: any) => {
    setSelectedPayment(p);
    setShowModalInstallments(false);
  };

  useEffect(() => {
    if (activeMainTab === 'cobrancas') {
      fetchPayments();
    }
  }, [filterStatus, filterType, activeMainTab]);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      let url = '/api/admin/asaas?endpoint=payments&limit=100';
      if (filterStatus !== 'ALL') url += `&status=${filterStatus}`;
      if (filterType !== 'ALL') url += `&billingType=${filterType}`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.data) {
        setPayments(data.data);
        
        // Obter IDs únicos de clientes
        const uniqueIds: string[] = Array.from(new Set(data.data.map((p: any) => p.customer)));
        
        const namesMap: { [key: string]: string } = { ...customerNames };
        const fetchPromises = uniqueIds.map(async (id) => {
          if (!namesMap[id]) {
            try {
              const res = await fetch(`/api/admin/asaas?endpoint=customers/${id}`);
              const customerData = await res.json();
              if (customerData && customerData.name) {
                namesMap[id] = customerData.name;
              }
            } catch (e) {
              console.error(`Erro ao buscar nome do cliente ${id}`, e);
            }
          }
        });
        
        await Promise.all(fetchPromises);
        setCustomerNames(namesMap);

        // AGRUPAMENTO: Agrupa pelo ID do cliente
        const grouped: { [key: string]: any[] } = {};
        data.data.forEach((p: any) => {
          const groupKey = p.customer;
          if (!grouped[groupKey]) grouped[groupKey] = [];
          grouped[groupKey].push(p);
        });
        
        // Ordenar as parcelas dentro de cada grupo por vencimento
        Object.keys(grouped).forEach(k => {
          grouped[k].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        });

        setGroupedPayments(grouped);
      }
    } catch (error) {
      console.error("Erro ao buscar cobranças:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleAnticipate = async (paymentOrInstallmentId: string, type: 'payment' | 'installment') => {
    if (!window.confirm("Deseja simular/solicitar a antecipação deste recebível? (Pode estar sujeito a taxas do Asaas)")) return;
    
    setIsAnticipating(paymentOrInstallmentId);
    try {
      const payload = type === 'payment' ? { payment: paymentOrInstallmentId } : { installment: paymentOrInstallmentId };
      const res = await fetch('/api/admin/asaas?endpoint=anticipations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok && !data.error) {
        alert("Antecipação solicitada com sucesso! O valor será creditado conforme o prazo do Asaas.");
        fetchPayments();
      } else {
        alert("Erro ao solicitar antecipação: " + (data.error || JSON.stringify(data)));
      }
    } catch (e: any) {
      alert("Erro na requisição: " + e.message);
    } finally {
      setIsAnticipating(null);
    }
  };

  const formatCurrency = (val: number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECEIVED':
      case 'CONFIRMED':
        return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3"/> Pago</span>;
      case 'PENDING':
        return <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><Clock className="w-3 h-3"/> Aguardando</span>;
      case 'OVERDUE':
        return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><AlertTriangle className="w-3 h-3"/> Atrasado</span>;
      case 'REFUNDED':
        return <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><XCircle className="w-3 h-3"/> Estornado</span>;
      default:
        return <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold w-fit">{status}</span>;
    }
  };

  const getBillingTypeIcon = (type: string) => {
    if (type === 'PIX') return <span className="text-[#32BCAD] font-bold text-xs bg-[#32BCAD]/10 px-2 py-0.5 rounded flex items-center gap-1"><QrCode className="w-3 h-3"/> PIX</span>;
    if (type === 'BOLETO') return <span className="text-blue-600 font-bold text-xs bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1"><FileText className="w-3 h-3"/> BOLETO</span>;
    if (type === 'CREDIT_CARD') return <span className="text-orange-600 font-bold text-xs bg-orange-50 px-2 py-0.5 rounded flex items-center gap-1"><CreditCard className="w-3 h-3"/> CARTÃO</span>;
    return <span className="text-gray-600 font-bold text-xs bg-gray-50 px-2 py-0.5 rounded">{type}</span>;
  };

  return (
    <div className="bg-white rounded-3xl p-4 md:p-8 shadow-sm border border-gray-100 min-h-[70vh]">
      
      {/* Cabeçalho e Tabs Principais */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 border-b border-gray-100 pb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-800">Financeiro Asaas</h2>
          <p className="text-gray-500 text-sm mt-1">Gerencie seu saldo, extrato e recebimentos do site.</p>
        </div>
        
        <div className="flex bg-gray-100 p-1.5 rounded-2xl w-full md:w-auto">
          <button
            onClick={() => setActiveMainTab('carteira')}
            className={`flex-1 md:px-8 py-3 text-sm font-bold rounded-xl transition-all flex justify-center items-center gap-2 ${activeMainTab === 'carteira' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Banknote className="w-4 h-4" /> Conta Digital
          </button>
          <button
            onClick={() => setActiveMainTab('cobrancas')}
            className={`flex-1 md:px-8 py-3 text-sm font-bold rounded-xl transition-all flex justify-center items-center gap-2 ${activeMainTab === 'cobrancas' ? 'bg-white text-[#F17B37] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <FileText className="w-4 h-4" /> Cobranças
          </button>
        </div>
      </div>

      {activeMainTab === 'carteira' ? (
        <AsaasCarteira />
      ) : (
        <div className="space-y-6">
          
          {/* CARDS DE RESUMO PREMIUM (Glassmorphism) */}
          {!isLoading && payments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 border border-orange-100 rounded-3xl p-6 relative overflow-hidden shadow-sm">
                <div className="absolute right-0 top-0 w-32 h-32 bg-orange-200/40 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-orange-100 p-2 rounded-xl"><Clock className="w-5 h-5 text-orange-600" /></div>
                    <p className="font-bold text-gray-700">A Receber (Futuro)</p>
                  </div>
                  <h3 className="text-3xl font-black text-gray-900">
                    {formatCurrency(payments.filter(p => p.status === 'PENDING').reduce((acc, p) => acc + p.value, 0))}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 font-medium">Soma dos recebimentos pendentes nesta visualização.</p>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 rounded-3xl p-6 relative overflow-hidden shadow-sm">
                <div className="absolute right-0 top-0 w-32 h-32 bg-red-200/40 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-red-100 p-2 rounded-xl"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                    <p className="font-bold text-gray-700">Inadimplência (Atrasados)</p>
                  </div>
                  <h3 className="text-3xl font-black text-red-700">
                    {formatCurrency(payments.filter(p => p.status === 'OVERDUE').reduce((acc, p) => acc + p.value, 0))}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 font-medium">Cobranças vencidas e não pagas nesta visualização.</p>
                </div>
              </div>
            </div>
          )}

          {/* Filtros de Cobrança */}
          <div className="flex flex-col xl:flex-row justify-between gap-4">
            
            <div className="flex bg-gray-50 border border-gray-100 p-1 rounded-xl w-full xl:w-auto">
              {['ALL', 'PIX', 'BOLETO', 'CREDIT_CARD'].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`flex-1 px-3 md:px-5 py-2 text-xs font-bold rounded-lg transition-all ${filterType === type ? 'bg-white text-gray-800 shadow-sm border border-gray-100' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {type === 'ALL' ? 'Todos os Tipos' : type === 'PIX' ? 'Pix' : type === 'BOLETO' ? 'Boletos' : 'Cartões'}
                </button>
              ))}
            </div>

            <div className="flex bg-gray-50 border border-gray-100 p-1 rounded-xl w-full xl:w-auto">
              {['ALL', 'PENDING', 'RECEIVED', 'OVERDUE'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`flex-1 px-3 md:px-5 py-2 text-xs font-bold rounded-lg transition-all ${filterStatus === status ? 'bg-white text-gray-800 shadow-sm border border-gray-100' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {status === 'ALL' ? 'Todos os Status' : status === 'PENDING' ? 'Aguardando' : status === 'RECEIVED' ? 'Pagos' : 'Atrasados'}
                </button>
              ))}
            </div>
            
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-[#F17B37]" /></div>
          ) : Object.keys(groupedPayments).length === 0 ? (
            <div className="text-center py-20 text-gray-500">Nenhuma cobrança encontrada com os filtros atuais.</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedPayments).map(([customerId, groupItems]) => {
                const customerName = customerNames[customerId] || 'Cliente Desconhecido';
                const totalGroupValue = groupItems.reduce((acc, curr) => acc + curr.value, 0);
                
                // Analisar status do grupo
                const paidCount = groupItems.filter(i => i.status === 'RECEIVED' || i.status === 'CONFIRMED').length;
                const overdueCount = groupItems.filter(i => i.status === 'OVERDUE').length;
                // Agrupamento interno por carnê/pedido (installment)
                const displayItems: any[] = [];
                const processedInstallments = new Set();
                
                groupItems.forEach(p => {
                  if (p.installment) {
                    if (!processedInstallments.has(p.installment)) {
                      processedInstallments.add(p.installment);
                      const installments = groupItems.filter(x => x.installment === p.installment);
                      
                      let representedStatus = p.status;
                      if (installments.some(x => x.status === 'OVERDUE')) representedStatus = 'OVERDUE';
                      else if (installments.every(x => x.status === 'RECEIVED' || x.status === 'CONFIRMED')) representedStatus = 'RECEIVED';
                      else if (installments.some(x => x.status === 'PENDING')) representedStatus = 'PENDING';
                      
                      const totalValue = installments.reduce((acc, curr) => acc + curr.value, 0);
                      let cleanDescription = p.description || 'Compra no site';
                      cleanDescription = cleanDescription.replace(/Parcela \d+ de \d+\.\s*/, '');
                      
                      displayItems.push({
                        rawPayment: p,
                        id: p.installment,
                        description: `${cleanDescription} (Carnê - ${installments.length} parcelas)`,
                        billingType: p.billingType,
                        value: totalValue,
                        dueDate: p.dueDate,
                        status: representedStatus,
                        isInstallmentGroup: true,
                        invoiceUrl: p.invoiceUrl
                      });
                    }
                  } else {
                    displayItems.push({
                      rawPayment: p,
                      id: p.id,
                      description: p.description || 'Compra no site',
                      billingType: p.billingType,
                      value: p.value,
                      dueDate: p.dueDate,
                      status: p.status,
                      isInstallmentGroup: false,
                      invoiceUrl: p.invoiceUrl
                    });
                  }
                });

                return (
                  <div key={customerId} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm transition-all hover:border-[#F17B37]/30">
                    
                    {/* Linha Principal (Resumo do Cliente) */}
                    <div 
                      className={`w-full flex flex-col md:flex-row items-start md:items-center justify-between p-4 md:p-5 transition-colors cursor-pointer hover:bg-gray-50`}
                      onClick={() => toggleGroup(customerId)}
                    >
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className={`p-3 rounded-2xl text-white bg-gray-800`}>
                          <User className="w-6 h-6" />
                        </div>
                        <div className="text-left flex-1">
                          <p className="font-black text-gray-900 text-base md:text-lg">{customerName}</p>
                          <p className="text-sm text-gray-500 line-clamp-1">{groupItems.length} {groupItems.length === 1 ? 'cobrança' : 'cobranças'}</p>
                          
                          <div className="flex items-center gap-3 mt-2">
                            <span className="text-xs text-gray-500 font-medium">{paidCount}/{groupItems.length} pagas</span>
                            {overdueCount > 0 && (
                              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-[10px] font-bold">{overdueCount} em atraso</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between w-full md:w-auto mt-4 md:mt-0 gap-6">
                        <div className="text-left md:text-right">
                          <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-0.5">Valor Total</p>
                          <p className="font-black text-xl text-gray-900">{formatCurrency(totalGroupValue)}</p>
                        </div>
                        
                        <div className="bg-white border border-gray-200 p-2 rounded-full">
                          {expandedGroups[customerId] ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                        </div>
                      </div>
                    </div>

                    {/* Expansão das Cobranças do Cliente */}
                    {expandedGroups[customerId] && (
                      <div className="p-4 md:p-6 border-t border-gray-100 bg-gray-50/50">
                        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                          <table className="w-full text-left border-collapse min-w-[600px]">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wider font-bold">
                                <th className="p-3">Descrição</th>
                                <th className="p-3">Tipo</th>
                                <th className="p-3">Valor</th>
                                <th className="p-3">Vencimento</th>
                                <th className="p-3">Status</th>
                                <th className="p-3 text-right">Ação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {displayItems.map((item) => (
                                <tr key={item.id} onClick={() => openModal(item.rawPayment)} className="border-b border-gray-50 hover:bg-gray-100 cursor-pointer transition-colors">
                                  <td className="p-3 text-xs text-gray-700 font-medium max-w-[200px] truncate" title={item.description}>
                                    {item.description}
                                  </td>
                                  <td className="p-3">{getBillingTypeIcon(item.billingType)}</td>
                                  <td className="p-3 font-black text-gray-900">{formatCurrency(item.value)}</td>
                                  <td className="p-3 text-sm text-gray-600">
                                    {format(new Date(item.dueDate), "dd MMM yyyy", { locale: ptBR })}
                                  </td>
                                  <td className="p-3">{getStatusBadge(item.status)}</td>
                                  <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {item.status === 'PENDING' && (item.billingType === 'BOLETO' || item.billingType === 'CREDIT_CARD') && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); handleAnticipate(item.isInstallmentGroup ? item.rawPayment.installment : item.rawPayment.id, item.isInstallmentGroup ? 'installment' : 'payment'); }}
                                          disabled={isAnticipating === (item.isInstallmentGroup ? item.rawPayment.installment : item.rawPayment.id)}
                                          className="text-[10px] font-bold text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-2 py-1.5 rounded-lg transition-colors"
                                        >
                                          {isAnticipating === (item.isInstallmentGroup ? item.rawPayment.installment : item.rawPayment.id) ? '...' : 'Antecipar'}
                                        </button>
                                      )}
                                      <a 
                                        href={item.invoiceUrl} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()} 
                                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors" 
                                      >
                                        <ArrowUpRight className="w-3 h-3" /> Fatura
                                      </a>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalhes do Pagamento */}
      {selectedPayment && (() => {
        const modalInstallments = selectedPayment.installment ? payments.filter(p => p.installment === selectedPayment.installment) : [];
        const totalGross = selectedPayment.installment ? modalInstallments.reduce((acc, curr) => acc + curr.value, 0) : selectedPayment.value;
        const totalNet = selectedPayment.installment ? modalInstallments.reduce((acc, curr) => acc + curr.netValue, 0) : selectedPayment.netValue;
        
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setSelectedPayment(null)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="font-black text-gray-900 text-xl">Detalhes da Cobrança</h3>
                <p className="text-sm text-gray-500 mt-1 font-mono text-xs">{selectedPayment.id}</p>
              </div>
              <button onClick={() => setSelectedPayment(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-3 mb-6">
                {getStatusBadge(selectedPayment.status)}
                {getBillingTypeIcon(selectedPayment.billingType)}
                {selectedPayment.status === 'RECEIVED' || selectedPayment.status === 'CONFIRMED' ? (
                  new Date(selectedPayment.paymentDate) > new Date(selectedPayment.dueDate) ? (
                    <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full border border-red-200">Pago com Atraso</span>
                  ) : (
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full border border-green-200">Pago em Dia</span>
                  )
                ) : null}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Descrição</p>
                    <p className="text-sm font-medium text-gray-800">{selectedPayment.description || 'Sem descrição'}</p>
                    
                    {selectedPayment.installment && (
                      <div className="mt-4">
                        <button 
                          onClick={() => setShowModalInstallments(!showModalInstallments)}
                          className="flex items-center gap-2 text-xs font-bold text-[#F17B37] hover:text-orange-700 transition-colors bg-[#F17B37]/10 hover:bg-[#F17B37]/20 px-3 py-2 rounded-xl w-full justify-center"
                        >
                          {showModalInstallments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {showModalInstallments ? 'Ocultar parcelas do carnê' : 'Ver todas as parcelas do carnê'}
                        </button>
                        
                        {showModalInstallments && (
                          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto custom-scrollbar border-t border-gray-200 pt-3">
                            {payments
                              .filter(p => p.installment === selectedPayment.installment)
                              .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                              .map((inst, idx) => (
                                <div key={inst.id} onClick={() => openModal(inst)} className={`flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-all ${inst.id === selectedPayment.id ? 'bg-[#F17B37]/10 border border-[#F17B37]/30' : 'bg-white border border-gray-200 shadow-sm hover:border-gray-300'}`}>
                                  <div className="flex items-center gap-2 mb-1 sm:mb-0">
                                    <span className="font-bold text-gray-700">{idx + 1}ª</span>
                                    <span className="text-gray-500 font-mono">{format(new Date(inst.dueDate), "dd/MM/yyyy")}</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="font-black text-gray-900">{formatCurrency(inst.value)}</span>
                                    {getStatusBadge(inst.status)}
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">
                      Valor Bruto {selectedPayment.installment && '(Total do Carnê)'}
                    </p>
                    <p className="text-xl font-black text-gray-900">
                      {formatCurrency(totalGross)}
                      {selectedPayment.installment && <span className="text-sm text-gray-500 font-medium ml-2">({formatCurrency(selectedPayment.value)}/parcela)</span>}
                    </p>
                  </div>

                  <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                    <p className="text-xs text-green-600 font-bold uppercase tracking-wider mb-1">
                      Valor Líquido {selectedPayment.installment && '(Total do Carnê)'}
                    </p>
                    <p className="text-xl font-black text-green-700">
                      {formatCurrency(totalNet)}
                      {selectedPayment.installment && <span className="text-sm text-green-600/70 font-medium ml-2">({formatCurrency(selectedPayment.netValue)}/parcela)</span>}
                    </p>
                    <p className="text-xs text-green-600/70 font-medium mt-1">Taxas Asaas Totais: {formatCurrency(totalGross - totalNet)}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Datas Importantes</p>
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500">Vencimento:</span>
                        <span className="font-bold text-gray-800">{format(new Date(selectedPayment.dueDate), "dd/MM/yyyy")}</span>
                      </div>
                      {selectedPayment.paymentDate && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500">Data do Pagamento:</span>
                          <span className="font-bold text-gray-800">{format(new Date(selectedPayment.paymentDate), "dd/MM/yyyy")}</span>
                        </div>
                      )}
                      {selectedPayment.clientPaymentDate && (
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-500">Aprovação Banco:</span>
                          <span className="font-bold text-gray-800">{format(new Date(selectedPayment.clientPaymentDate), "dd/MM/yyyy")}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedPayment.creditCard && (
                    <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                      <p className="text-xs text-orange-600 font-bold uppercase tracking-wider mb-1">Cartão de Crédito</p>
                      <p className="text-sm font-bold text-gray-800 uppercase">{selectedPayment.creditCard.creditCardBrand}</p>
                      <p className="text-xs text-gray-500 font-mono mt-1">**** **** **** {selectedPayment.creditCard.creditCardNumber}</p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mt-4">
                    <a href={selectedPayment.invoiceUrl} target="_blank" rel="noreferrer" className="w-full text-center bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold py-3 rounded-xl transition-colors">
                      Abrir Fatura do Cliente
                    </a>
                    {selectedPayment.transactionReceiptUrl && (
                      <a href={selectedPayment.transactionReceiptUrl} target="_blank" rel="noreferrer" className="w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold py-3 rounded-xl transition-colors">
                        Ver Comprovante Asaas
                      </a>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
