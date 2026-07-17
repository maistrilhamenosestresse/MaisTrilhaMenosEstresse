"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2, Wallet, FileText, ArrowUpRight, ArrowDownRight, RefreshCcw, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function AsaasCarteira() {
  const [balance, setBalance] = useState<{ balance: number } | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const resBalance = await fetch('/api/admin/asaas?endpoint=finance/balance');
      const dataBalance = await resBalance.json();
      if (dataBalance && dataBalance.balance !== undefined) {
        setBalance(dataBalance);
      }

      const resTrans = await fetch('/api/admin/asaas?endpoint=financialTransactions&limit=50');
      const dataTrans = await resTrans.json();
      if (dataTrans.data) {
        setTransactions(dataTrans.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (transactions.length === 0) return [];
    
    // Group transactions by Date
    const grouped: { [key: string]: { dateStr: string, income: number, expense: number } } = {};
    
    transactions.forEach(t => {
      const day = format(new Date(t.date), "dd MMM", { locale: ptBR });
      if (!grouped[day]) {
        grouped[day] = { dateStr: day, income: 0, expense: 0 };
      }
      if (t.value > 0) grouped[day].income += t.value;
      else grouped[day].expense += Math.abs(t.value);
    });
    
    // Convert to array and reverse to have chronological order (oldest to newest)
    return Object.values(grouped).reverse();
  }, [transactions]);

  const formatCurrency = (val: number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Saldo Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-4 rounded-2xl">
              <Wallet className="w-8 h-8" />
            </div>
            <div>
              <p className="text-blue-100 font-medium mb-1">Saldo Disponível</p>
              <h3 className="text-4xl md:text-5xl font-black">{balance ? formatCurrency(balance.balance) : 'R$ 0,00'}</h3>
            </div>
          </div>
          <button onClick={fetchData} className="bg-white/10 hover:bg-white/20 transition-colors p-3 rounded-xl border border-white/20 flex items-center gap-2 font-bold">
            <RefreshCcw className="w-5 h-5" /> Atualizar
          </button>
        </div>
      </div>

      {/* Gráfico de Fluxo de Caixa */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm">
          <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-500" /> Fluxo de Caixa Recente
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="dateStr" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#888' }} tickFormatter={(val) => `R$ ${val}`} />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(Number(value))}
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}
                />
                <Bar dataKey="income" name="Entradas" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="expense" name="Saídas" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Extrato Section */}
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-sm">
        <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-500" /> Extrato Detalhado
        </h3>
        
        {transactions.length === 0 ? (
          <p className="text-gray-500 text-center py-10">Nenhuma movimentação recente encontrada.</p>
        ) : (
          <div className="space-y-4">
            {transactions.slice(0, 15).map(t => (
              <div key={t.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${t.value > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {t.value > 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm md:text-base">{t.description || 'Movimentação'}</p>
                    <p className="text-xs text-gray-500">{format(new Date(t.date), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black ${t.value > 0 ? 'text-green-600' : 'text-red-500'}`}>{t.value > 0 ? '+' : ''}{formatCurrency(t.value)}</p>
                  <p className="text-xs text-gray-400 font-medium">Saldo: {formatCurrency(t.balance)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
