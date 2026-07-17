"use client";

import { ChevronLeft, History, ArrowUpRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function PwaExtratos() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saldo, setSaldo] = useState(0);
  const [extrato, setExtrato] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: client } = await supabase.from('clients').select('*').eq('email', user.email).single();
      
      if (client) {
        setSaldo(client.cashback_saldo || 0);
        
        // Buscar compras de trilhas
        const { data: reservas } = await supabase
          .from('reservas')
          .select('*, agendas(title, price)')
          .eq('client_id', client.id)
          .eq('status_pagamento', 'pago')
          .order('created_at', { ascending: false });

        // Buscar compras na loja
        const { data: pedidosLoja } = await supabase
          .from('pedidos_loja')
          .select('*, produtos(name, price)')
          .eq('client_id', client.id)
          .eq('status_pagamento', 'pago')
          .order('created_at', { ascending: false });

        const historico: any[] = [];
        
        if (reservas) {
          reservas.forEach((r: any) => {
            historico.push({
              id: `res-${r.id}`,
              title: `Compra: ${r.agendas?.title || 'Trilha'}`,
              date: new Date(r.created_at).toLocaleDateString('pt-BR'),
              value: r.valor_pago || r.agendas?.price || 0,
              type: 'out',
              created_at: new Date(r.created_at).getTime()
            });
          });
        }

        if (pedidosLoja) {
          pedidosLoja.forEach((p: any) => {
            historico.push({
              id: `loj-${p.id}`,
              title: `Compra na Loja: ${p.produtos?.name || 'Produto'}`,
              date: new Date(p.created_at).toLocaleDateString('pt-BR'),
              value: p.valor_total || p.produtos?.price || 0,
              type: 'out',
              created_at: new Date(p.created_at).getTime()
            });
          });
        }

        historico.sort((a, b) => b.created_at - a.created_at);
        setExtrato(historico);
      }
      setLoading(false);
    };
    fetchData();
  }, [supabase]);

  const formatCurrency = (val: number) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white pt-12 pb-6 px-6 rounded-b-[2.5rem] shadow-sm relative z-10 border-b border-gray-100">
        <button onClick={() => router.back()} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700 mb-6 hover:bg-gray-200 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Seu Saldo Total</p>
        <h1 className="text-4xl font-black text-purple-700 mb-2">{formatCurrency(saldo)}</h1>
      </div>

      <div className="px-6 py-6 flex-1 pb-24 overflow-y-auto">
        <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-4 px-2">Histórico Real</h3>
        
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-purple-600 animate-spin" /></div>
        ) : extrato.length > 0 ? (
          <div className="bg-white rounded-3xl p-2 shadow-sm border border-gray-100">
            {extrato.map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
                  <ArrowUpRight className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800 text-sm">{item.title}</h4>
                  <p className="text-xs text-gray-500">{item.date}</p>
                </div>
                <p className="font-black text-gray-800">- {formatCurrency(item.value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400">
              <History className="w-8 h-8" />
            </div>
            <h3 className="font-bold text-gray-800">Nenhuma movimentação</h3>
            <p className="text-xs text-gray-500 mt-1">Você ainda não possui transações pagas registradas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
